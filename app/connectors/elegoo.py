"""Imprimantes 3D Elegoo.

- protocol: sdcp      -> Centauri Carbon, Saturn 3/4, Mars 4/5 (WebSocket port 3030, découverte UDP 3000)
- protocol: moonraker -> Neptune 4 (Klipper, API HTTP port 7125)
"""
import asyncio
import json
import socket
import time
import uuid

import httpx

from .base import Connector, ping

SDCP_STATUS = {0: "Inactive", 1: "Impression", 2: "Exposition", 3: "Lissage", 8: "Préparation",
               9: "Démarrage", 10: "Pause", 12: "Reprise", 13: "Impression", 16: "Terminé"}
SDCP_PRINT = {0: "Inactive", 1: "Retour", 2: "Descente", 3: "Exposition", 4: "Levage", 5: "Pause",
              6: "En pause", 7: "Arrêt", 8: "Arrêtée", 9: "Terminée", 13: "Impression", 16: "Chauffe"}


class ElegooConnector(Connector):
    kind = "elegoo"
    icon = "🖨️"
    capabilities = ("printer",)
    actions = ("pause", "resume", "stop")

    def __init__(self, dev, cfg):
        super().__init__(dev, cfg)
        self._mainboard = dev.get("mainboard_id")

    async def status(self):
        if not await ping(self.host):
            return {"online": False, "on": False, "summary": "Éteinte"}
        if self.dev.get("protocol", "sdcp") == "moonraker":
            return await self._moonraker_status()
        return await self._sdcp_status()

    # ---------- Moonraker ----------
    def _mr_url(self, path):
        return f"http://{self.host}:{self.dev.get('port', 7125)}{path}"

    async def _moonraker_status(self):
        async with httpx.AsyncClient(timeout=5) as c:
            r = await c.get(self._mr_url("/printer/objects/query?print_stats&extruder&heater_bed&display_status"))
            r.raise_for_status()
        s = r.json()["result"]["status"]
        ps, prog = s.get("print_stats", {}), s.get("display_status", {}).get("progress", 0)
        state = ps.get("state", "?")
        return {"online": True, "on": state == "printing",
                "summary": f"{state} {prog * 100:.0f} %" if state == "printing" else state,
                "progress": round(prog * 100, 1),
                "details": {"fichier": ps.get("filename"), "buse": f"{s['extruder']['temperature']:.0f} °C",
                            "plateau": f"{s['heater_bed']['temperature']:.0f} °C",
                            "durée": f"{ps.get('print_duration', 0) / 60:.0f} min"}}

    # ---------- SDCP ----------
    def _discover(self) -> str:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.settimeout(3)
            s.sendto(b"M99999", (self.host, 3000))
            data, _ = s.recvfrom(4096)
        return json.loads(data)["Data"]["MainboardID"]

    async def _sdcp(self, cmd: int, data: dict | None = None) -> dict:
        import websockets

        if not self._mainboard:
            self._mainboard = await asyncio.to_thread(self._discover)
        req = {"Id": "", "Data": {"Cmd": cmd, "Data": data or {}, "RequestID": uuid.uuid4().hex,
                                  "MainboardID": self._mainboard, "TimeStamp": int(time.time()), "From": 0},
               "Topic": f"sdcp/request/{self._mainboard}"}
        async with websockets.connect(f"ws://{self.host}:3030/websocket", open_timeout=5) as ws:
            await ws.send(json.dumps(req))
            deadline = time.monotonic() + 6
            while time.monotonic() < deadline:
                msg = json.loads(await asyncio.wait_for(ws.recv(), 6))
                if cmd == 0 and msg.get("Topic", "").startswith("sdcp/status/"):
                    return msg
                if cmd != 0 and msg.get("Topic", "").startswith("sdcp/response/"):
                    return msg
        raise RuntimeError("Pas de réponse de l'imprimante")

    async def _sdcp_status(self):
        msg = await self._sdcp(0)
        st = msg.get("Status", {})
        info = st.get("PrintInfo", {})
        cur = st.get("CurrentStatus", [0])
        cur = cur[0] if isinstance(cur, list) and cur else cur
        total, layer = info.get("TotalLayer") or 0, info.get("CurrentLayer") or 0
        progress = info.get("Progress") if info.get("Progress") is not None else (100 * layer / total if total else 0)
        printing = cur in (1, 13) or info.get("Status") in (3, 13)
        details = {"fichier": info.get("Filename"), "couche": f"{layer}/{total}",
                   "état": SDCP_PRINT.get(info.get("Status"), info.get("Status"))}
        if "TempOfNozzle" in st:
            details["buse"] = f"{st['TempOfNozzle']:.0f} °C"
            details["plateau"] = f"{st.get('TempOfHotbed', 0):.0f} °C"
        return {"online": True, "on": printing, "progress": round(progress, 1),
                "summary": f"Impression {progress:.0f} %" if printing else SDCP_STATUS.get(cur, "Inactive"),
                "details": details}

    async def action(self, name, params):
        if self.dev.get("protocol", "sdcp") == "moonraker":
            path = {"pause": "/printer/print/pause", "resume": "/printer/print/resume",
                    "stop": "/printer/print/cancel"}.get(name)
            if not path:
                return await super().action(name, params)
            async with httpx.AsyncClient(timeout=5) as c:
                (await c.post(self._mr_url(path))).raise_for_status()
            return {"ok": True}
        cmd = {"pause": 129, "stop": 130, "resume": 131}.get(name)
        if not cmd:
            return await super().action(name, params)
        await self._sdcp(cmd)
        return {"ok": True}
