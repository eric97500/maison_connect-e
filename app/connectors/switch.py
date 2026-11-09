"""Switchs TP-Link « Easy Smart » (TL-SG1016DE, TL-SG108E, TL-SG1024DE…) : état réel des ports.

Lecture seule via l'interface web du switch : connexion, lecture des pages d'information, déconnexion.
Ces switchs n'acceptent qu'une session à la fois : on se déconnecte aussitôt après chaque lecture.
"""
import asyncio
import re
import time

import httpx

from .base import Connector, ping

LINK = {0: "Déconnecté", 1: "Auto", 2: "10M Half", 3: "10M Full", 4: "100M Half", 5: "100M Full", 6: "1000M Full"}
SPEED = {2: 10, 3: 10, 4: 100, 5: 100, 6: 1000}


def _array(text: str, name: str) -> list[str]:
    m = re.search(rf"{name}\s*:\s*\[([^\]]*)\]", text)
    if not m:
        return []
    return [x.strip().strip('"').strip("'").strip() for x in m.group(1).split(",") if x.strip()]


def _ints(text: str, name: str) -> list[int]:
    return [int(x) for x in _array(text, name) if x.lstrip("-").isdigit()]


class EasySmartSwitchConnector(Connector):
    kind = "tplink_switch"
    icon = "🔀"
    capabilities = ("network",)
    actions = ()
    min_interval = 60
    AUTH_PAUSE = 900  # ces switchs se verrouillent après plusieurs échecs : longue pause

    def __init__(self, dev, cfg):
        super().__init__(dev, cfg)
        self._prev: tuple[float, list[int]] | None = None
        self._auth_failed: tuple | None = None
        self._lock = asyncio.Lock()  # une seule session à la fois sur le switch

    async def _read(self, user: str, password: str) -> tuple[str, str]:
        base = f"http://{self.host}"
        async with httpx.AsyncClient(timeout=8, follow_redirects=True) as c:
            await c.post(f"{base}/logon.cgi", data={"username": user, "password": password, "cpassword": "", "logon": "Login"})
            try:
                info = (await c.get(f"{base}/SystemInfoRpm.htm")).text
                if "info_ds" not in info:
                    codes = re.search(r"logonInfo\s*=\s*new Array\(\s*(\d+)", info)
                    code = int(codes.group(1)) if codes else 0
                    if code in (2, 5):  # trop de tentatives / session déjà ouverte ailleurs (selon firmware)
                        raise ConnectionError("Interface du switch occupée ou verrouillée (une seule session à la fois) : réessai plus tard")
                    raise PermissionError("Identifiant ou mot de passe du switch refusé")
                ports = (await c.get(f"{base}/PortStatisticsRpm.htm")).text
                if "link_status" not in ports:
                    raise ConnectionError("Session du switch interrompue (interface web ouverte ailleurs ?) : réessai à la prochaine lecture")
            finally:
                try:
                    await c.get(f"{base}/Logout.htm")
                except Exception:
                    pass
        return info, ports

    async def status(self):
        if not await ping(self.host):
            return {"online": False, "on": False, "summary": "Hors ligne"}
        c = self.creds("switch")
        if not c.get("password"):
            return {"online": True, "on": True, "summary": "En ligne (état des ports : mot de passe du switch à saisir)",
                    "details": {"IP": self.host, "interface": f"http://{self.host}"}, "ports": None,
                    "hint": "Saisis le mot de passe administrateur du switch dans sa configuration pour lire l'état réel des ports."}
        key = (c.get("username") or "admin", c["password"])
        if self._auth_failed and self._auth_failed[0] == key and time.time() - self._auth_failed[1] < self.AUTH_PAUSE:
            raise PermissionError("Mot de passe du switch refusé : corrige-le dans sa configuration (nouvel essai automatique plus tard)")
        try:
            async with self._lock:
                info, page = await self._read(*key)
        except PermissionError:
            self._auth_failed = (key, time.time())
            raise
        self._auth_failed = None

        n = int(re.search(r"max_port_num\s*=\s*(\d+)", page).group(1)) if re.search(r"max_port_num\s*=\s*(\d+)", page) else 16
        state, link, pkts = _ints(page, "state")[:n], _ints(page, "link_status")[:n], _ints(page, "pkts")
        now = time.time()
        rate = None
        if self._prev and len(self._prev[1]) == len(pkts) and now > self._prev[0]:
            rate = [(a - b) / (now - self._prev[0]) for a, b in zip(pkts, self._prev[1])]
        self._prev = (now, pkts)
        ports = []
        for i in range(n):
            lk = link[i] if i < len(link) else 0
            p = pkts[i * 4:i * 4 + 4] + [0, 0, 0, 0]
            r = rate[i * 4:i * 4 + 4] if rate else None
            ports.append({"port": i + 1, "enabled": (state[i] if i < len(state) else 1) == 1, "up": lk not in (0,),
                          "link": LINK.get(lk, str(lk)), "speed": SPEED.get(lk), "tx": p[0], "tx_err": p[1], "rx": p[2], "rx_err": p[3],
                          "pps": round((r[0] + r[2]), 1) if r else None})
        up = [p for p in ports if p["up"]]
        giga = sum(1 for p in up if p["speed"] == 1000)
        model = (_array(info, "descriStr") or ["Switch"])[0]
        details = {"modèle": model, "IP": (_array(info, "ipStr") or [self.host])[0], "MAC": (_array(info, "macStr") or [None])[0],
                   "firmware": (_array(info, "firmwareStr") or [None])[0], "matériel": (_array(info, "hardwareStr") or [None])[0],
                   "interface": f"http://{self.host}"}
        errors = sum(p["tx_err"] + p["rx_err"] for p in ports)
        summary = f"{len(up)}/{n} ports actifs" + (f" · {giga} en 1 Gbit/s" if giga else "") + (f" · ⚠ {errors} erreurs" if errors else "")
        return {"online": True, "on": True, "summary": summary, "ports": ports, "details": details}
