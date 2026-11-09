"""Wake on LAN, NAS QNAP / TerraMaster, Proxmox."""
import asyncio

import time

from .base import Connector, ping, send_magic_packet, tcp_open
from .linux import LinuxServerConnector, summarize


class WolConnector(Connector):
    kind = "wol"
    icon = "💻"
    capabilities = ("wake",)
    actions = ("wake",)

    async def status(self):
        online = await ping(self.host) if self.host else None
        return {"online": online, "on": online, "summary": "Allumé" if online else "Éteint",
                "details": {"IP": self.host, "MAC": self.dev.get("mac")}}

    async def action(self, name, params):
        if name != "wake":
            return await super().action(name, params)
        send_magic_packet(self.dev["mac"], self.dev.get("broadcast", "255.255.255.255"))
        return {"ok": True, "message": "Paquet magique envoyé"}


class QnapConnector(Connector):
    kind = "qnap"
    icon = "🗄️"
    capabilities = ("nas",)
    actions = ("wake",)
    min_interval = 60

    def _fetch(self):
        import urllib3
        from qnapstats import QNAPStats

        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        c = self.creds("qnap")
        if not c.get("username") or not c.get("password"):
            raise PermissionError("Identifiants QNAP manquants (Paramètres → Comptes connectés)")
        scheme = "https" if self.dev.get("https") else "http"
        q = QNAPStats(f"{scheme}://{self.host}", self.dev.get("port", 8080),
                      c.get("username", ""), c.get("password", ""), verify_ssl=False, timeout=8)
        sysstats = q.get_system_stats()
        if not sysstats:
            raise PermissionError("Connexion QNAP refusée : vérifie l'identifiant et le mot de passe")
        extra = {}
        for name, fn in (("volumes", q.get_volumes), ("disks", q.get_smart_disk_health),
                         ("bandwidth", q.get_bandwidth), ("health", q.get_system_health)):
            try:
                extra[name] = fn()
            except Exception:
                extra[name] = None
        return sysstats, extra

    async def status(self):
        if not await ping(self.host):
            return {"online": False, "on": False, "summary": "Hors ligne"}
        c = self.creds("qnap")
        if not c.get("username") or not c.get("password"):
            return {"online": True, "on": True, "summary": "En ligne (statistiques : identifiants QNAP à saisir)",
                    "details": {"IP": self.host}, "metrics": None,
                    "hint": "Saisis l'identifiant et le mot de passe du QNAP dans Paramètres → Comptes connectés pour avoir toutes les statistiques."}
        s, x = await asyncio.to_thread(self._fetch)
        mem = s.get("memory", {})
        up = s.get("uptime", {})
        sysinfo = s.get("system", {})
        m = {
            "cpu_pct": s.get("cpu", {}).get("usage_percent"), "cpu_model": s.get("cpu", {}).get("model"),
            "cpu_temp": s.get("cpu", {}).get("temp_c") or sysinfo.get("temp_c"),
            "mem": {"used": (mem["total"] - mem["free"]) * 1024 ** 2, "total": mem["total"] * 1024 ** 2} if mem.get("total") else None,
            "uptime_s": up.get("days", 0) * 86400 + up.get("hours", 0) * 3600 + up.get("minutes", 0) * 60 + up.get("seconds", 0),
            "temps": {k: v for k, v in (("Processeur", s.get("cpu", {}).get("temp_c")), ("Système", sysinfo.get("temp_c"))) if v},
            "volumes": [{"name": v.get("label", n), "used": v["total_size"] - v["free_size"], "total": v["total_size"], "status": "ok"}
                        for n, v in (x.get("volumes") or {}).items() if v.get("total_size")],
            "disks": [{"name": f"Disque {str(d['drive_number']).split(':')[-1]}", "model": d.get("model"), "temp": d.get("temp_c"),
                       "health": "OK" if str(d.get("health")).upper() in ("OK", "GOOD", "NORMAL") else d.get("health"),
                       "size_text": d.get("capacity"), "type": d.get("type")} for d in (x.get("disks") or {}).values()],
            "raid": [], "fans": {},
            "info": {"nom": sysinfo.get("name"), "modèle": sysinfo.get("model"), "numéro de série": sysinfo.get("serial_number"),
                     "système": f"QTS {s.get('firmware', {}).get('version', '')} (build {s.get('firmware', {}).get('build', '')})",
                     "santé": {"good": "bonne", "warning": "avertissement", "error": "erreur"}.get(str(x.get("health")).lower(), x.get("health"))},
            "collected": int(time.time()),
        }
        bw = x.get("bandwidth") or {}
        if bw:
            m["net"] = {"rx_bps": sum(i.get("rx", 0) for i in bw.values()), "tx_bps": sum(i.get("tx", 0) for i in bw.values())}
        return {"online": True, "on": True, "summary": summarize(m), "metrics": m,
                "details": {"IP": self.host, **{k: v for k, v in m["info"].items() if v}}}

    async def action(self, name, params):
        if name == "wake":
            if not self.dev.get("mac"):
                raise ValueError("Renseigne l'adresse MAC (mac:) de cet appareil dans config.yaml")
            send_magic_packet(self.dev["mac"])
            return {"ok": True}
        return await super().action(name, params)


class TerramasterConnector(LinuxServerConnector):
    """TOS n'a pas d'API publique : statistiques complètes lues par SSH (activé par défaut sur le port 9222)."""

    kind = "terramaster"
    icon = "🗄️"
    capabilities = ("nas", "server")
    cred_name = "terramaster"
    default_port = 9222

    async def status(self):
        st = await super().status()
        if st.get("online"):
            port = int(self.dev.get("web_port", 5443))
            st.setdefault("details", {})["interface web"] = f"https://{self.host}:{port}" if port == 5443 else f"http://{self.host}:{port}"
        return st


class ProxmoxConnector(Connector):
    kind = "proxmox"
    icon = "🖥️"
    capabilities = ("hypervisor",)
    actions = ("vm_start", "vm_shutdown", "vm_stop", "wake")
    min_interval = 20

    def _api(self):
        from proxmoxer import ProxmoxAPI

        c = self.creds("proxmox")
        if not c.get("token_value"):
            raise PermissionError("Jeton Proxmox manquant (Paramètres → Comptes connectés)")
        return ProxmoxAPI(self.host, port=self.dev.get("port", 8006), user=c.get("user"),
                          token_name=c.get("token_name"), token_value=c.get("token_value"),
                          verify_ssl=False, timeout=8)

    def _fetch(self):
        px = self._api()
        nodes, guests = [], []
        for n in px.nodes.get():
            nodes.append(n)
            if n.get("status") != "online":
                continue
            node = px.nodes(n["node"])
            for key, call in (("node_status", lambda: node.status.get()), ("storage", lambda: node.storage.get()),
                              ("disks", lambda: node.disks.list.get()),
                              ("rrd", lambda: node.rrddata.get(timeframe="hour", cf="AVERAGE"))):
                try:
                    n[key] = call()
                except Exception:
                    n[key] = None
            for kind in ("qemu", "lxc"):
                for g in getattr(px.nodes(n["node"]), kind).get():
                    guests.append({"node": n["node"], "kind": kind, "vmid": g["vmid"],
                                   "name": g.get("name"), "status": g.get("status"),
                                   "cpu": round(100 * g.get("cpu", 0), 1),
                                   "mem_pct": round(100 * g["mem"] / g["maxmem"]) if g.get("maxmem") else None})
        return nodes, sorted(guests, key=lambda g: g["vmid"])

    async def status(self):
        if not await ping(self.host):
            return {"online": False, "on": False, "summary": "Hors ligne"}
        nodes, guests = await asyncio.to_thread(self._fetch)
        running = sum(1 for g in guests if g["status"] == "running")
        details = {}
        for n in nodes:
            mem = round(100 * n["mem"] / n["maxmem"]) if n.get("maxmem") else "?"
            details[f"nœud {n['node']}"] = f"{n.get('status')} — CPU {100 * n.get('cpu', 0):.0f} %, RAM {mem} %"
        m = self._metrics(next((n for n in nodes if n.get("node_status")), None))
        return {"online": True, "on": True, "summary": f"{running}/{len(guests)} VM actives" + (f" · {summarize(m)}" if m else ""),
                "details": details, "guests": guests, "metrics": m}

    @staticmethod
    def _metrics(n):
        if not n:
            return None
        ns = n["node_status"]
        mem, swap, cpuinfo = ns.get("memory", {}), ns.get("swap", {}), ns.get("cpuinfo", {})
        rrd = [r for r in (n.get("rrd") or []) if r.get("netin") is not None]
        last = rrd[-1] if rrd else {}
        return {
            "cpu_pct": round(100 * ns.get("cpu", 0), 1), "cpu_model": cpuinfo.get("model"),
            "cores": cpuinfo.get("cpus"), "load": [float(x) for x in ns.get("loadavg", [])[:3]],
            "mem": {"used": mem.get("used", 0), "total": mem.get("total", 0)} if mem.get("total") else None,
            "swap": {"used": swap.get("used", 0), "total": swap.get("total", 0)} if swap.get("total") else None,
            "uptime_s": ns.get("uptime"), "temps": {}, "fans": {}, "raid": [],
            "volumes": [{"name": f"{s['storage']} ({s.get('type')})", "used": s.get("used", 0), "total": s.get("total", 0),
                         "status": "ok" if s.get("active") else "inactif"} for s in (n.get("storage") or []) if s.get("total")],
            "disks": [{"name": d.get("devpath"), "model": d.get("model"), "size": d.get("size"),
                       "health": "OK" if d.get("health") in ("PASSED", "OK") else d.get("health"),
                       "wearout": d.get("wearout") if isinstance(d.get("wearout"), (int, float)) else None}
                      for d in (n.get("disks") or [])],
            "net": {"rx_bps": int(last.get("netin", 0)), "tx_bps": int(last.get("netout", 0))} if last else None,
            "info": {"nœud": n["node"], "version": ns.get("pveversion"), "noyau": (ns.get("kversion") or "").split(" #")[0]},
            "collected": int(time.time()),
        }

    async def action(self, name, params):
        if name == "wake":
            if not self.dev.get("mac"):
                raise ValueError("Renseigne l'adresse MAC (mac:) de cet appareil dans config.yaml")
            send_magic_packet(self.dev["mac"])
            return {"ok": True}
        op = {"vm_start": "start", "vm_shutdown": "shutdown", "vm_stop": "stop"}.get(name)
        if not op:
            return await super().action(name, params)
        kind = params.get("kind", "qemu")
        if kind not in ("qemu", "lxc"):
            raise ValueError("kind doit être qemu ou lxc")

        def run():
            px = self._api()
            target = getattr(px.nodes(params["node"]), kind)(int(params["vmid"]))
            return getattr(target.status, op).post()

        await asyncio.to_thread(run)
        return {"ok": True}


class PresenceConnector(Connector):
    """Présence d'une personne via son téléphone sur le Wi-Fi.

    Les téléphones mettent leur Wi-Fi en veille : on ne déclare « absent » qu'après
    away_after_min minutes sans réponse (10 par défaut).
    """

    kind = "presence"
    icon = "👤"
    capabilities = ("presence",)

    def __init__(self, dev, cfg):
        super().__init__(dev, cfg)
        self._last_seen = 0.0

    async def status(self):
        import time

        if await ping(self.host, timeout=1.5) or await tcp_open(self.host, 62078, 1.0):  # 62078 : port iPhone
            self._last_seen = time.time()
        away_after = float(self.dev.get("away_after_min", 10)) * 60
        home = self._last_seen > 0 and time.time() - self._last_seen < away_after
        seen = time.strftime("%H:%M", time.localtime(self._last_seen)) if self._last_seen else "jamais"
        return {"online": True, "on": home, "summary": "À la maison" if home else "Absent",
                "details": {"téléphone": self.host, "vu pour la dernière fois": seen}}
