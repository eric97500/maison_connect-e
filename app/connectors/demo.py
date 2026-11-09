"""Mode démo : simule chaque type d'appareil pour tester l'interface sans matériel."""
import io
import math
import random
import time
import zlib
from datetime import datetime

from .base import Connector


def demo_watts(device_id: str, ts: float, on: bool = True) -> float:
    """Profil de consommation plausible selon le nom de la prise."""
    if not on:
        return 0.0
    h = datetime.fromtimestamp(ts).hour + datetime.fromtimestamp(ts).minute / 60
    rnd = random.Random(f"{device_id}{int(ts // 60)}")
    if "frigo" in device_id or "congel" in device_id:
        cycle = (ts / 60) % 40 < (14 if "congel" in device_id else 11)  # compresseur
        return (95 if "congel" in device_id else 70) + rnd.uniform(-6, 6) if cycle else rnd.uniform(1, 3)
    if "clim" in device_id:
        hot = 13 <= h <= 22
        return 850 + 250 * math.sin(ts / 900) + rnd.uniform(-40, 40) if hot else rnd.uniform(1, 2)
    if "ampoule" in device_id or "lumiere" in device_id or "bulb" in device_id:
        return 6.5 if 18 <= h <= 23.5 or 6.5 <= h <= 8 else 0.2
    if "tv" in device_id:
        return 110 + rnd.uniform(-10, 15) if 19 <= h <= 23.5 else 0.6
    if "bureau" in device_id:
        return 160 + rnd.uniform(-30, 80) if 8 <= h <= 23 else 12 + rnd.uniform(0, 3)
    return 20 + rnd.uniform(0, 10)


class DemoConnector(Connector):
    def __init__(self, real: Connector):
        super().__init__(real.dev, real.cfg)
        self.kind, self.icon = real.kind, real.icon
        self.capabilities, self.actions = real.capabilities, real.actions
        self.on = True
        self.brightness = 80
        self.alarm = "DISARMED"
        self.printer_start = time.time() - 3600

    async def status(self):
        now = time.time()
        k = self.kind
        if k in ("tapo_plug", "tapo_clim"):
            w = demo_watts(self.id, now, self.on)
            return {"online": True, "on": self.on, "power_w": round(w, 1),
                    "energy_today_kwh": None, "summary": f"{w:.0f} W", "details": {"mode": "démo"}}
        if k == "tapo_bulb":
            from .tapo import estimate_bulb_watts
            w = estimate_bulb_watts(float(self.dev.get("watts") or 8.7), self.on, self.brightness)
            return {"online": True, "on": self.on, "brightness": self.brightness, "power_w": w, "power_estimated": True,
                    "summary": f"{self.brightness} % · ≈{w:.0f} W" if self.on else "Éteinte"}
        if k == "verisure":
            labels = {"DISARMED": "Désarmée", "ARMED_HOME": "Armée (partiel)", "ARMED_AWAY": "Armée (totale)"}
            return {"online": True, "on": self.alarm != "DISARMED", "alarm_state": self.alarm, "summary": labels[self.alarm],
                    "details": {"état": labels[self.alarm]}}
        if k == "proxmox":
            guests = [
                {"node": "pve", "kind": "qemu", "vmid": 100, "name": "home-assistant", "status": "running", "cpu": 3.2, "mem_pct": 41},
                {"node": "pve", "kind": "lxc", "vmid": 101, "name": "pihole", "status": "running", "cpu": 0.4, "mem_pct": 22},
                {"node": "pve", "kind": "qemu", "vmid": 102, "name": "windows-11", "status": "stopped", "cpu": 0, "mem_pct": None},
            ]
            return {"online": True, "on": True, "summary": "2/3 VM actives", "guests": guests,
                    "details": {"nœud pve": "online — CPU 7 %, RAM 46 %"}}
        if k == "qnap":
            return {"online": True, "on": True, "summary": "CPU 4 %",
                    "details": {"modèle": "TS-453D", "CPU": "4 %", "temp CPU": "41 °C", "RAM": "32 %",
                                "DataVol1": "61 % utilisé (3.12 To libres)"}}
        if k == "terramaster":
            return {"online": True, "on": True, "summary": "En ligne",
                    "details": {"IP": self.host, "interface web": "OK"}}
        if k == "elegoo":
            p = min(100.0, (now - self.printer_start) / 72)
            return {"online": True, "on": self.on and p < 100, "progress": round(p, 1),
                    "summary": f"Impression {p:.0f} %" if self.on else "En pause",
                    "details": {"fichier": "support_casque.gcode", "buse": "215 °C", "plateau": "60 °C"}}
        if k == "tado":
            ac = self.dev.get("zone_type") == "AIR_CONDITIONING"
            inside = round((24.5 if ac else 19.6) + math.sin(now / 1800) * 0.6, 1)
            tgt = getattr(self, "target", 22 if ac else 20.5)
            mode = getattr(self, "mode", "COOL")
            summary = (f"{'Froid ' if ac and mode == 'COOL' else ''}{tgt:.1f} °C · {inside:.1f} °C") if self.on else f"Éteint · {inside:.1f} °C"
            return {"online": True, "on": self.on, "summary": summary, "zone_type": "AIR_CONDITIONING" if ac else "HEATING",
                    "current_temp": inside, "target_temp": tgt, "humidity": 48, "mode": mode if ac else None,
                    "manual": getattr(self, "manual", False),
                    "details": {"température": f"{inside} °C", "humidité": "48 %", "mode": "Manuel" if getattr(self, "manual", False) else "Planning"}}
        if k == "tplink_switch":
            ports = [{"port": i, "enabled": True, "up": i in (1, 2, 3, 5, 9), "link": "1000M Full" if i in (1, 2, 3, 9) else ("100M Full" if i == 5 else "Déconnecté"),
                      "speed": 1000 if i in (1, 2, 3, 9) else (100 if i == 5 else None), "tx": 1000 * i, "tx_err": 0, "rx": 900 * i, "rx_err": 0, "pps": 12.0 * i}
                     for i in range(1, 17)]
            return {"online": True, "on": True, "summary": "5/16 ports actifs · 4 en 1 Gbit/s", "ports": ports,
                    "details": {"modèle": "TL-SG1016DE", "IP": self.host}}
        if k == "presence":
            return {"online": True, "on": self.on, "summary": "À la maison" if self.on else "Absent",
                    "details": {"téléphone": self.host, "mode": "démo (clique Allumer/Éteindre pour simuler)"}}
        if k in ("wol", "camera"):
            return {"online": self.on, "on": self.on, "summary": "Allumé" if self.on else "Éteint",
                    "details": {"IP": self.host}}
        return {"online": True}

    async def action(self, name, params):
        if name in ("on", "wake", "resume"):
            self.on = True
        elif name in ("off", "pause", "stop"):
            self.on = False
        elif name == "toggle":
            self.on = not self.on
        elif name == "brightness":
            self.brightness = int(params["value"])
        elif name == "set_temperature":
            self.target, self.on, self.manual = float(params["value"]), True, True
        elif name == "set_mode":
            self.mode, self.on, self.manual = str(params["value"]), True, True
        elif name == "resume_schedule":
            self.manual = False
        elif name in ("arm_home", "arm_away", "disarm"):
            if not str(params.get("code", "")).strip():
                raise ValueError("Le code de l'alarme est requis")
            self.alarm = {"arm_home": "ARMED_HOME", "arm_away": "ARMED_AWAY", "disarm": "DISARMED"}[name]
        return {"ok": True, "message": "(démo)"}

    async def snapshot(self) -> bytes:
        return _demo_png(int(time.time()))


def _demo_png(seed: int) -> bytes:
    """Petite image PNG générée (dégradé) pour simuler une caméra."""
    w, h = 320, 180
    rows = bytearray()
    for y in range(h):
        rows.append(0)
        for x in range(w):
            v = (x + y + seed * 7) % 256
            rows += bytes((40 + v // 4, 50 + y // 3, 70 + x // 5))
    def chunk(tag, data):
        c = tag + data
        return len(data).to_bytes(4, "big") + c + zlib.crc32(c).to_bytes(4, "big")
    out = io.BytesIO()
    out.write(b"\x89PNG\r\n\x1a\n")
    out.write(chunk(b"IHDR", w.to_bytes(4, "big") + h.to_bytes(4, "big") + bytes([8, 2, 0, 0, 0])))
    out.write(chunk(b"IDAT", zlib.compress(bytes(rows))))
    out.write(chunk(b"IEND", b""))
    return out.getvalue()
