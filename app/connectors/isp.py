"""Box Internet : SFR (API locale /gwapi des box récentes) et Orange Livebox (API sysbus /ws).

Lecture seule : état de la connexion Internet, fibre, appareils connectés, ports, téléphone, infos de la box.
"""
import asyncio
import logging
import time

import httpx

from .base import Connector, ping

log = logging.getLogger("maison")

HIDE_KEYS = ("password", "passphrase", "key", "psk", "secret", "token", "pin", "wep")


def _flat(data, prefix="", out=None, depth=0):
    """Aplatit un JSON en lignes « clé : valeur » lisibles (sans secrets, profondeur limitée)."""
    out = [] if out is None else out
    if isinstance(data, dict):
        for k, v in data.items():
            if any(h in str(k).lower() for h in HIDE_KEYS):
                continue
            _flat(v, f"{prefix}{k} › " if isinstance(v, (dict, list)) and depth < 2 else f"{prefix}{k}", out, depth + 1)
    elif isinstance(data, list):
        if all(not isinstance(x, (dict, list)) for x in data):
            out.append((prefix.rstrip(" ›"), ", ".join(str(x) for x in data[:10])))
        else:
            out.append((prefix.rstrip(" ›"), f"{len(data)} élément(s)"))
    elif data not in (None, ""):
        out.append((prefix, data if not isinstance(data, bool) else ("oui" if data else "non")))
    return out


def _find(data, *names, default=None):
    """Cherche la première clé (insensible à la casse) dans un JSON imbriqué."""
    want = {n.lower() for n in names}
    stack = [data]
    while stack:
        cur = stack.pop(0)
        if isinstance(cur, dict):
            for k, v in cur.items():
                if str(k).lower() in want and v not in (None, ""):
                    return v
                if isinstance(v, (dict, list)):
                    stack.append(v)
        elif isinstance(cur, list):
            stack.extend(x for x in cur if isinstance(x, (dict, list)))
    return default


def _hosts(items) -> list[dict]:
    out = []
    for h in items or []:
        if not isinstance(h, dict):
            continue
        out.append({"name": _find(h, "hostname", "name", "HostName", "friendly_name", "Name") or "?",
                    "ip": _find(h, "ip", "ipaddress", "ip_address", "IPAddress", "ipv4"),
                    "mac": _find(h, "mac", "macaddress", "mac_address", "PhysAddress", "Key"),
                    "link": _find(h, "interface", "interface_type", "type", "link", "Layer2Interface", "connection_type"),
                    "active": _find(h, "active", "Active", "online", "status", default=True)})
    return out


class _BoxBase(Connector):
    capabilities = ("network",)
    actions = ()
    min_interval = 60
    cred_name = ""
    AUTH_PAUSE = 900

    def __init__(self, dev, cfg):
        super().__init__(dev, cfg)
        self._auth_failed: tuple | None = None
        self._lock = asyncio.Lock()

    def _key(self):
        c = self.creds(self.cred_name)
        return (c.get("username") or "admin", c.get("password") or "")

    async def status(self):
        if not await ping(self.host):
            return {"online": False, "on": False, "summary": "Hors ligne"}
        key = self._key()
        if not key[1]:
            info = await self._public()
            return {"online": True, "on": True, "summary": "En ligne (détails : mot de passe de la box à saisir)",
                    "details": {"IP": self.host, **info}, "hint": "Saisis le mot de passe administrateur de la box dans sa configuration pour lire la connexion Internet, la fibre et les appareils connectés."}
        if self._auth_failed and self._auth_failed[0] == key and time.time() - self._auth_failed[1] < self.AUTH_PAUSE:
            raise PermissionError("Mot de passe de la box refusé : corrige-le dans sa configuration (nouvel essai automatique plus tard)")
        try:
            async with self._lock:
                st = await self._read(*key)
        except PermissionError:
            self._auth_failed = (key, time.time())
            raise
        self._auth_failed = None
        return st

    async def _public(self) -> dict:
        return {}


class SfrBoxConnector(_BoxBase):
    """Box SFR récentes (interface « mabox », API /gwapi) : BOX10H, Box 8…"""

    kind = "sfr_box"
    icon = "🌐"
    cred_name = "sfr"
    SECTIONS = [("device/info", "Box"), ("wan/internet_access", "Internet"), ("wan/info", "Connexion WAN"),
                ("wan/ip_address", "Adresses IP"), ("ont/status", "Fibre (ONT)"), ("ont/optical/info", "Signal optique"),
                ("lan/ethernet/port", "Ports Ethernet"), ("phone/info", "Téléphone"), ("lan/connected_device", "Appareils connectés")]

    def __init__(self, dev, cfg):
        super().__init__(dev, cfg)
        self._token: str | None = None

    def _url(self, path):
        return f"http://{self.host}/gwapi/{path}"

    async def _public(self):
        try:
            async with httpx.AsyncClient(timeout=6) as c:
                r = await c.get(self._url("device/info/model_name"))
            return {"modèle": r.json()["data"]["model_name"]}
        except Exception:
            return {}

    async def _login(self, c, user, password):
        r = await c.post(self._url("auth/login"), json={"user": user, "password": password})
        try:
            data = r.json()
        except Exception:
            data = {}
        res = data.get("result") if isinstance(data.get("result"), dict) else data
        token = (data.get("data") or {}).get("token") if isinstance(data.get("data"), dict) else None
        if token and str(res.get("status", "SUCCESS")).upper() == "SUCCESS":
            self._token = token
            return
        code, detail = res.get("error_code"), res.get("error_detail")
        log.warning("Box SFR : connexion refusée (HTTP %s, statut %s, code %s, détail %s)", r.status_code, res.get("status"), code, detail)
        if code == "ERROR_LOCKED_ACCOUNT":
            raise PermissionError(f"Compte de la box SFR verrouillé après trop d'essais ({detail or 'attendre quelques minutes'}) : "
                                  "attends la fin du blocage avant de réessayer")
        raise PermissionError(f"Identifiant ou mot de passe de la box SFR refusé (code {code or res.get('status') or r.status_code})")

    async def _get(self, c, path):
        r = await c.get(self._url(path), headers={"Authorization": f"Bearer {self._token}"})
        if r.status_code in (401, 403):
            raise PermissionError("expired")
        if r.status_code == 404:
            return None
        r.raise_for_status()
        return r.json().get("data")

    async def _read(self, user, password):
        async with httpx.AsyncClient(timeout=10) as c:
            if not self._token:
                await self._login(c, user, password)
            raw = {}
            for path, _ in self.SECTIONS:
                try:
                    raw[path] = await self._get(c, path)
                except PermissionError:  # jeton expiré : reconnexion puis nouvel essai
                    await self._login(c, user, password)
                    raw[path] = await self._get(c, path)
                except Exception as e:
                    raw[path] = {"erreur": str(e)[:80]}
        return self._build(raw)

    def _build(self, raw):
        inet = raw.get("wan/internet_access") or {}
        state = _find(inet, "status", "state", "internet_access", "connected")
        up = str(state).lower() in ("up", "connected", "true", "ok", "online", "1") or state is True
        ip = _find(raw.get("wan/ip_address") or {}, "v4", "ipv4", "ip", "address", "ip_address") or _find(raw.get("wan/info") or {}, "v4", "ipv4", "ip")
        if isinstance(ip, list):
            ip = ip[0] if ip else None
        rx = _find(raw.get("ont/optical/info") or {}, "rx_power", "rxpower", "received_power", "optical_rx_power", "rx")
        hosts = _hosts(raw.get("lan/connected_device") if isinstance(raw.get("lan/connected_device"), list)
                       else _find(raw.get("lan/connected_device") or {}, "devices", "list", "hosts", default=[]))
        model = _find(raw.get("device/info") or {}, "model_name", "model", "product_name")
        fw = _find(raw.get("device/info") or {}, "firmware_version", "software_version", "version", "firmware")
        sections = [{"title": t, "rows": [(k, v) for k, v in _flat(raw.get(p))][:30]}
                    for p, t in self.SECTIONS if p != "lan/connected_device" and raw.get(p)]
        summary = ("Internet OK" if up else f"Internet : {state or 'inconnu'}") + (f" · {ip}" if ip else "") + f" · {len(hosts)} appareil(s)"
        return {"online": True, "on": up, "summary": summary, "internet": up, "wan_ip": ip, "optical_rx": rx,
                "hosts": hosts, "sections": sections, "details": {"modèle": model, "firmware": fw, "IP": self.host}}


class LiveboxConnector(_BoxBase):
    """Orange Livebox 4 / 5 / 6 / 7 (API sysbus sur /ws)."""

    kind = "livebox"
    icon = "🌐"
    cred_name = "livebox"
    HEADERS = {"Content-Type": "application/x-sah-ws-4-call+json"}

    async def _call(self, c, ctx, service, method, params=None):
        h = {**self.HEADERS, "Authorization": f"X-Sah {ctx}", "X-Context": ctx}
        r = await c.post(f"http://{self.host}/ws", headers=h, json={"service": service, "method": method, "parameters": params or {}})
        if r.status_code in (401, 403):
            raise PermissionError("Session Livebox refusée")
        try:
            j = r.json()
        except Exception:
            return None
        return j.get("data") if "data" in j else j.get("status")

    async def _read(self, user, password):
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.post(f"http://{self.host}/ws", headers={**self.HEADERS, "Authorization": "X-Sah-Login"},
                             json={"service": "sah.Device.Information", "method": "createContext",
                                   "parameters": {"applicationName": "webui", "username": user, "password": password}})
            ctx = ((r.json() if r.content else {}).get("data") or {}).get("contextID")
            if not ctx:
                raise PermissionError("Identifiant ou mot de passe de la Livebox refusé")
            raw = {}
            try:
                for key, svc, meth, params in (
                        ("info", "DeviceInfo", "get", None), ("wan", "NMC", "getWANStatus", None),
                        ("hosts", "Devices", "get", {"expression": {"ETHERNET": "not interface and not self and eth and .Active==true",
                                                                    "WIFI": "not interface and not self and wifi and .Active==true"}}),
                        ("phone", "VoiceService.VoiceApplication", "listTrunks", None)):
                    try:
                        raw[key] = await self._call(c, ctx, svc, meth, params)
                    except PermissionError:
                        raise
                    except Exception as e:
                        raw[key] = {"erreur": str(e)[:80]}
            finally:
                try:
                    await self._call(c, ctx, "sah.Device.Information", "releaseContext", {"applicationName": "webui"})
                except Exception:
                    pass
        wan = raw.get("wan") or {}
        up = str(_find(wan, "ConnectionState", "LinkState")).lower() in ("bound", "up", "connected")
        hosts_raw = raw.get("hosts") or {}
        hosts = _hosts((hosts_raw.get("ETHERNET") or []) + (hosts_raw.get("WIFI") or [])) if isinstance(hosts_raw, dict) else []
        info = raw.get("info") or {}
        sections = [{"title": t, "rows": _flat(raw.get(k))[:30]} for k, t in (("info", "Livebox"), ("wan", "Internet"), ("phone", "Téléphone")) if raw.get(k)]
        ip = _find(wan, "IPAddress")
        summary = ("Internet OK" if up else f"Internet : {_find(wan, 'ConnectionState') or 'inconnu'}") + (f" · {ip}" if ip else "") + f" · {len(hosts)} appareil(s)"
        return {"online": True, "on": up, "summary": summary, "internet": up, "wan_ip": ip, "hosts": hosts, "sections": sections,
                "details": {"modèle": _find(info, "ModelName", "ProductClass"), "firmware": _find(info, "SoftwareVersion"),
                            "liaison": _find(wan, "LinkType"), "IP": self.host}}
