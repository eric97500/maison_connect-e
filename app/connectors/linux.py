"""Statistiques complètes d'un serveur Linux par SSH (lecture seule).

Utilisé pour le NAS TerraMaster (TOS, SSH sur le port 9222) et pour tout serveur Linux (type « linux »).
Aucune commande ne modifie le serveur : on lit uniquement /proc, /sys, df et (si permis) smartctl.

Modèle « metrics » commun à tous les serveurs (QNAP, TerraMaster, Proxmox, Linux) :
  cpu_pct, cpu_model, cores, load[3], mem{used,total}, swap{used,total}, uptime_s,
  temps{nom: °C}, cpu_temp, volumes[{name,used,total,status}], raid[{name,level,status,devices,progress}],
  disks[{name,model,size,temp,health}], net{rx_bps,tx_bps}, fans{nom: tr/min}, info{…}
"""
import asyncio
import re
import threading
import time

from .base import Connector, ping, send_magic_packet

SCRIPT = r"""
LC_ALL=C; export LC_ALL
echo '@@stat1'; head -1 /proc/stat; cat /proc/net/dev
sleep 1
echo '@@stat2'; head -1 /proc/stat; cat /proc/net/dev
echo '@@load'; cat /proc/loadavg
echo '@@mem'; grep -E '^(MemTotal|MemAvailable|MemFree|Buffers|Cached|SwapTotal|SwapFree):' /proc/meminfo
echo '@@uptime'; cat /proc/uptime
echo '@@df'; df -kP 2>/dev/null
echo '@@md'; cat /proc/mdstat 2>/dev/null
echo '@@hwmon'; for f in /sys/class/hwmon/hwmon*/temp*_input; do [ -f "$f" ] && echo "$(cat $(dirname $f)/name 2>/dev/null)|$(cat ${f%_input}_label 2>/dev/null)|$(cat $f)"; done 2>/dev/null
echo '@@thermal'; for z in /sys/class/thermal/thermal_zone*; do [ -f $z/temp ] && echo "$(cat $z/type)|$(cat $z/temp)"; done 2>/dev/null
echo '@@fans'; for f in /sys/class/hwmon/hwmon*/fan*_input; do [ -f "$f" ] && echo "$(cat $(dirname $f)/name 2>/dev/null) $(basename ${f%_input})|$(cat $f)"; done 2>/dev/null
echo '@@disks'; for d in /sys/block/sd* /sys/block/nvme*n*; do [ -d "$d" ] && echo "$(basename $d)|$(cat $d/size)|$(cat $d/device/model 2>/dev/null)|$(cat $d/queue/rotational 2>/dev/null)"; done 2>/dev/null
echo '@@smart'; for b in /sys/block/sd* /sys/block/nvme*n*; do d=/dev/$(basename $b); [ -e "$d" ] && (smartctl -H -A "$d" 2>/dev/null || sudo -n smartctl -H -A "$d" 2>/dev/null) | grep -Ei 'overall-health|SMART Health Status|Temperature_Celsius|Airflow_Temperature|^Temperature:' | sed "s#^#$(basename $d)|#"; done 2>/dev/null
echo '@@pvs'; pvs --noheadings -o pv_name,vg_name 2>/dev/null
echo '@@mounts'; grep -E ' /Volume[0-9]+ ' /proc/mounts 2>/dev/null
echo '@@cpu'; grep -c ^processor /proc/cpuinfo; grep -m1 -E 'model name|Hardware' /proc/cpuinfo
echo '@@host'; hostname; uname -r; grep PRETTY_NAME /etc/os-release 2>/dev/null
echo '@@end'
"""

SKIP_FS = re.compile(r"^(tmpfs|devtmpfs|overlay|none|udev|shm|rootfs|/dev/loop)")
SKIP_IF = re.compile(r"^(lo|docker|veth|br-|virbr|tun|tap|fwbr|fwln|fwpr|vmbr\d+v)")


def _sections(text: str) -> dict[str, list[str]]:
    out, cur = {}, None
    for line in text.splitlines():
        if line.startswith("@@"):
            cur = line[2:].strip()
            out[cur] = []
        elif cur:
            out[cur].append(line)
    return out


def _cpu_net(lines: list[str]):
    cpu = [int(x) for x in lines[0].split()[1:9]] if lines and lines[0].startswith("cpu") else None
    net = {}
    for l in lines[1:]:
        if ":" not in l:
            continue
        name, data = l.split(":", 1)
        name = name.strip()
        f = data.split()
        if len(f) >= 9 and not SKIP_IF.match(name):
            net[name] = (int(f[0]), int(f[8]))
    return cpu, net


def parse(text: str) -> dict:
    s = _sections(text)
    m: dict = {"temps": {}, "fans": {}, "volumes": [], "raid": [], "disks": [], "info": {}}
    c1, n1 = _cpu_net(s.get("stat1", []))
    c2, n2 = _cpu_net(s.get("stat2", []))
    if c1 and c2:
        idle = (c2[3] + c2[4]) - (c1[3] + c1[4])
        total = sum(c2) - sum(c1)
        m["cpu_pct"] = round(100 * (1 - idle / total), 1) if total > 0 else 0.0
    if n1 and n2:
        rx = sum(n2[i][0] - n1[i][0] for i in n2 if i in n1)
        tx = sum(n2[i][1] - n1[i][1] for i in n2 if i in n1)
        m["net"] = {"rx_bps": max(rx, 0), "tx_bps": max(tx, 0)}
    if s.get("load"):
        f = s["load"][0].split()
        m["load"] = [float(x) for x in f[:3]]
    mem = {}
    for l in s.get("mem", []):
        k, v = l.split(":")
        mem[k] = int(v.split()[0]) * 1024
    if mem.get("MemTotal"):
        avail = mem.get("MemAvailable", mem.get("MemFree", 0) + mem.get("Buffers", 0) + mem.get("Cached", 0))
        m["mem"] = {"used": mem["MemTotal"] - avail, "total": mem["MemTotal"]}
    if mem.get("SwapTotal"):
        m["swap"] = {"used": mem["SwapTotal"] - mem.get("SwapFree", 0), "total": mem["SwapTotal"]}
    if s.get("uptime"):
        m["uptime_s"] = int(float(s["uptime"][0].split()[0]))

    vol_mounts = {}  # périphérique → /VolumeN (TOS, Synology…)
    for l in s.get("mounts", []):
        f = l.split()
        if len(f) >= 2:
            vol_mounts.setdefault(f[0], f[1])
    by_dev: dict[str, dict] = {}
    for l in s.get("df", [])[1:]:
        f = l.split()
        if len(f) < 6 or SKIP_FS.match(f[0]) or not f[0].startswith("/"):
            continue
        total, used = int(f[1]) * 1024, int(f[2]) * 1024
        if total < 2 * 1024 ** 3:  # partitions système minuscules
            continue
        mount = vol_mounts.get(f[0], f[5])
        vm = re.match(r"^/Volume(\d+)$", mount)
        name = f"Volume {vm.group(1)}" if vm else ("Système" if mount == "/" else mount)
        if f[0] not in by_dev or vm:
            by_dev[f[0]] = {"name": name, "device": f[0], "used": used, "total": total, "status": "ok", "system": mount == "/"}
    m["volumes"] = sorted(by_dev.values(), key=lambda v: (v["system"], v["name"]))

    md = s.get("md", [])
    for i, l in enumerate(md):
        r = re.match(r"^(md\w+)\s*:\s*(\w+)\s+(raid\w+|linear)?\s*(.*)", l)
        if not r:
            continue
        name, state, level, devs = r.groups()
        nxt = md[i + 1] if i + 1 < len(md) else ""
        flags = re.search(r"\[([U_]+)\]", nxt)
        prog = None
        for extra in md[i + 1:i + 4]:
            p = re.search(r"(recovery|resync|reshape|check)\s*=\s*([\d.]+)%", extra)
            if p:
                prog = f"{p.group(1)} {p.group(2)} %"
        degraded = bool(flags and "_" in flags.group(1)) or state != "active"
        members = re.findall(r"([a-z]+)\d*\[\d+\]", devs)
        level = (level or "").upper()
        label = "Disque unique" if level == "RAID1" and len(members) == 1 else level.replace("RAID", "RAID ")
        m["raid"].append({"name": name, "level": label, "status": "dégradé" if degraded else "sain",
                          "devices": len(members), "members": members, "progress": prog})

    for l in s.get("hwmon", []):
        parts = l.split("|")
        if len(parts) == 3 and parts[2].strip().lstrip("-").isdigit():
            name = f"{parts[0]} {parts[1]}".strip() or "capteur"
            m["temps"][name] = round(int(parts[2]) / 1000, 1)
    for l in s.get("thermal", []):
        parts = l.split("|")
        if len(parts) == 2 and parts[1].strip().lstrip("-").isdigit():
            m["temps"].setdefault(parts[0], round(int(parts[1]) / 1000, 1))
    m["temps"] = {k: v for k, v in m["temps"].items() if 0 < v < 120}
    cpu_keys = [k for k in m["temps"] if re.search(r"coretemp|k10temp|cpu|x86_pkg|Package|soc", k, re.I)]
    if cpu_keys or m["temps"]:
        m["cpu_temp"] = max(m["temps"][k] for k in (cpu_keys or m["temps"]))
    for l in s.get("fans", []):
        parts = l.split("|")
        if len(parts) == 2 and parts[1].strip().isdigit() and int(parts[1]) > 0:
            m["fans"][parts[0].strip()] = int(parts[1])

    smart: dict[str, dict] = {}
    for l in s.get("smart", []):
        dev, _, rest = l.partition("|")
        d = smart.setdefault(dev, {})
        if re.search(r"overall-health|Health Status", rest, re.I):
            d["health"] = "OK" if re.search(r"PASSED|OK", rest) else rest.split(":")[-1].strip()
        elif "Temperature" in rest:
            nums = re.findall(r"\b(\d{2})\b", rest.split("-")[-1] if "-" in rest else rest)
            if nums and "temp" not in d:
                d["temp"] = int(nums[0])
    for l in s.get("disks", []):
        parts = l.split("|")
        if len(parts) >= 2 and parts[1].isdigit() and int(parts[1]) > 0:
            name = parts[0]
            rot = parts[3].strip() if len(parts) > 3 else ""
            m["disks"].append({"name": name, "model": (parts[2] if len(parts) > 2 else "").strip() or ("SSD" if rot == "0" else ""),
                               "size": int(parts[1]) * 512, "type": "ssd" if rot == "0" else "hdd" if rot == "1" else None,
                               **smart.get(name, {})})

    # volume ← groupe LVM ← grappe RAID ← disques physiques
    vg_of = {}
    for l in s.get("pvs", []):
        f = l.split()
        if len(f) == 2:
            vg_of[f[0].replace("/dev/", "")] = f[1]
    vol_of_vg = {}
    for v in m["volumes"]:
        vm = re.match(r"/dev/mapper/(\w+?)-", v["device"])
        if vm:
            vol_of_vg[vm.group(1)] = v
    for r in m["raid"]:
        v = vol_of_vg.get(vg_of.get(r["name"], ""))
        if v is None:
            v = next((x for x in m["volumes"] if x["device"] == f"/dev/{r['name']}"), None)
        if v is not None:
            r["volume"] = v["name"]
            r["system"] = v.get("system", False)
            v["raid"] = r["level"]
            v["disks"] = r["members"]
        elif r["name"] in ("md8", "md9", "md13", "md256"):
            r["volume"] = "Système TOS" if r["name"] in ("md9", "md13") else "Swap"
            r["system"] = True
    for d in m["disks"]:
        v = next((x for x in m["volumes"] if d["name"] in x.get("disks", [])), None)
        if v:
            d["volume"] = v["name"]
            d["volume_pct"] = round(100 * v["used"] / v["total"], 1) if v["total"] else None
    m["temps"] = _friendly_temps(m["temps"])
    for d in m["disks"]:  # SSD sans SMART lisible : température de la sonde NVMe
        if d.get("type") == "ssd" and d.get("temp") is None and "SSD NVMe" in m["temps"]:
            d["temp"] = round(m["temps"]["SSD NVMe"])

    cpu = s.get("cpu", [])
    if cpu:
        m["cores"] = int(cpu[0]) if cpu[0].isdigit() else None
        if len(cpu) > 1:
            m["cpu_model"] = cpu[1].split(":", 1)[-1].strip()
    host = s.get("host", [])
    if host:
        m["info"] = {"nom": host[0], "noyau": host[1] if len(host) > 1 else None,
                     "système": host[2].split("=", 1)[-1].strip('"') if len(host) > 2 else None}
    return m


def _friendly_temps(t: dict) -> dict:
    """Regroupe les sondes (cœurs, NVMe…) sous des noms lisibles."""
    out, cores, nvme = {}, [], []
    for k, v in t.items():
        if re.search(r"Core \d+", k):
            cores.append(v)
        elif re.search(r"x86_pkg|Package", k):
            out["Processeur"] = max(out.get("Processeur", 0), v)
        elif k.startswith("nvme"):
            nvme.append(v)
        elif "spd5118" in k or "jc42" in k:
            out["Mémoire vive"] = v
        elif k.startswith("acpitz"):
            out["Carte mère"] = v
        elif k.startswith(("drivetemp", "pch", "k10temp", "cpu")):
            out[{"drivetemp": "Disque", "pch": "Chipset"}.get(k.split()[0], "Processeur")] = v
        else:
            out[k] = v
    if cores:
        out["Cœurs (max)"] = max(cores)
    if nvme:
        out["SSD NVMe"] = max(nvme)
    return out


class SSHCollector:
    def __init__(self, host: str, port: int, username: str, password: str):
        self.host, self.port, self.username, self.password = host, port, username, password
        self._client = None
        self._lock = threading.Lock()  # une seule lecture à la fois sur la connexion

    def _run(self) -> str:
        with self._lock:
            return self._run_locked()

    def _run_locked(self) -> str:
        import paramiko

        if self._client is None or not self._client.get_transport() or not self._client.get_transport().is_active():
            c = paramiko.SSHClient()
            c.set_missing_host_key_policy(paramiko.AutoAddPolicy())  # réseau local
            c.connect(self.host, port=self.port, username=self.username, password=self.password, timeout=8,
                      banner_timeout=8, auth_timeout=8, look_for_keys=False, allow_agent=False)
            self._client = c
        # Garder stdin ouvert jusqu'à la fin de l'envoi : s'il est libéré trop tôt, paramiko ferme le canal
        stdin, stdout, stderr = self._client.exec_command("sh -s", timeout=25)
        stdin.write(SCRIPT)
        stdin.flush()
        stdin.channel.shutdown_write()
        out = stdout.read().decode(errors="replace")
        stderr.read()
        return out

    async def collect(self) -> dict:
        import paramiko

        try:
            return parse(await asyncio.to_thread(self._run))
        except paramiko.AuthenticationException:
            self.close()
            raise PermissionError("Identifiant ou mot de passe SSH refusé par le serveur")
        except (paramiko.SSHException, OSError) as e:
            self.close()
            raise ConnectionError(f"Connexion SSH impossible sur le port {self.port} ({e or type(e).__name__})")
        except Exception:
            self.close()
            raise

    def close(self):
        if self._client:
            try:
                self._client.close()
            except Exception:
                pass
            self._client = None


def summarize(m: dict) -> str:
    parts = []
    if m.get("cpu_pct") is not None:
        parts.append(f"CPU {m['cpu_pct']:.0f} %")
    if m.get("mem"):
        parts.append(f"RAM {100 * m['mem']['used'] / m['mem']['total']:.0f} %")
    if m.get("cpu_temp"):
        parts.append(f"{m['cpu_temp']:.0f} °C")
    if any(r["status"] != "sain" for r in m.get("raid", [])):
        parts.insert(0, "⚠ RAID dégradé")
    return " · ".join(parts) or "En ligne"


class LinuxServerConnector(Connector):
    """Serveur Linux quelconque (Docker, Raspberry Pi…) : statistiques complètes par SSH."""

    kind = "linux"
    icon = "🖥️"
    capabilities = ("server",)
    actions = ("wake",)
    min_interval = 30
    cred_name = "linux"
    default_port = 22

    AUTH_PAUSE = 600  # après un mot de passe refusé : pause de 10 min (protège le compte d'un blocage)

    def __init__(self, dev, cfg):
        super().__init__(dev, cfg)
        self._ssh: SSHCollector | None = None
        self._auth_failed: tuple | None = None  # (identifiants refusés, heure)

    def _collector(self) -> SSHCollector | None:
        c = self.creds(self.cred_name)
        if not c.get("username") or not c.get("password"):
            return None
        port = int(self.dev.get("ssh_port") or self.default_port)
        key = (c["username"], c["password"], port)
        if self._ssh is None or (self._ssh.username, self._ssh.password, self._ssh.port) != key:
            if self._ssh:
                self._ssh.close()
            self._ssh = SSHCollector(self.host, port, *key[:2])
        return self._ssh

    async def status(self):
        if not await ping(self.host):
            return {"online": False, "on": False, "summary": "Hors ligne"}
        col = self._collector()
        if col is None:
            return {"online": True, "on": True, "summary": "En ligne (statistiques : identifiants SSH à saisir)",
                    "details": {"IP": self.host}, "metrics": None,
                    "hint": "Saisis l'identifiant SSH dans Paramètres → Comptes connectés pour avoir toutes les statistiques."}
        key = (col.username, col.password, col.port)
        if self._auth_failed and self._auth_failed[0] == key and time.time() - self._auth_failed[1] < self.AUTH_PAUSE:
            raise PermissionError("Mot de passe SSH refusé : corrige-le dans la configuration de l'appareil "
                                  "(nouvel essai automatique dans quelques minutes)")
        try:
            m = await col.collect()
        except PermissionError:
            self._auth_failed = (key, time.time())
            raise
        self._auth_failed = None
        m["collected"] = int(time.time())
        return {"online": True, "on": True, "summary": summarize(m), "metrics": m,
                "details": {"IP": self.host, **{k: v for k, v in m.get("info", {}).items() if v}}}

    async def action(self, name, params):
        if name == "wake":
            if not self.dev.get("mac"):
                raise ValueError("Renseigne l'adresse MAC (mac:) de cet appareil")
            send_magic_packet(self.dev["mac"])
            return {"ok": True}
        return await super().action(name, params)

    async def close(self):
        if self._ssh:
            self._ssh.close()
            self._ssh = None
