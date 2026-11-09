"""Maison connectée — serveur web (FastAPI).

Lancement : python -m app.main   (ou start.bat)
"""
import asyncio
import base64
import csv
import io
import logging
import os
import re
import secrets
import time
from contextlib import asynccontextmanager

import httpx
from datetime import datetime

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles

from . import connectors, system
from .scan import scan as scan_network
from .accounts import TADO, VERISURE, discover_tapo, set_env
from .archive import PowerArchive
from .automations import Engine
from .config import WEB_DIR, expand, load_config, load_devices_raw, load_json, save_json
from .connectors.demo import demo_watts
from .logbook import Logbook
from .settings import Settings
from .sun import sun_times
from . import tariff as tariff_mod

log = logging.getLogger("maison")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
system.setup_logging()

ACTION_LABELS = {"on": "allumé", "off": "éteint", "toggle": "basculé", "wake": "réveillé (Wake on LAN)",
                 "brightness": "luminosité réglée", "arm_home": "armée (partiel)", "arm_away": "armée (totale)",
                 "disarm": "désarmée", "pause": "mise en pause", "resume": "reprise", "stop": "arrêtée",
                 "vm_start": "VM démarrée", "vm_shutdown": "VM arrêtée", "vm_stop": "VM coupée",
                 "set_temperature": "température réglée", "set_mode": "mode changé", "resume_schedule": "retour au planning"}


class Hub:
    def __init__(self):
        self.cfg = load_config()
        arch = self.cfg["archive"]
        self.archive = PowerArchive(arch["interval_seconds"], arch["raw_retention_days"], self.cfg["demo"])
        self.logbook = Logbook(self.cfg["demo"])
        self.settings = Settings()
        self.devices = {d["id"]: connectors.build(d, self.cfg) for d in self.cfg["devices"]}
        self.state: dict[str, dict] = {i: {"online": None, "summary": "…"} for i in self.devices}
        self.engine = Engine(self)
        self.tariff = tariff_mod.normalize(self.settings.get("tariff"), self.cfg["archive"]["price_per_kwh"])
        TADO.poll_seconds = int(self.settings.get("tado_poll_seconds") or 900)
        self._last_poll: dict[str, float] = {}
        self._tasks: list[asyncio.Task] = []

    def name(self, dev_id: str) -> str:
        c = self.devices.get(dev_id)
        return c.dev.get("name", dev_id) if c else str(dev_id)

    def power_devices(self):
        return [c for c in self.devices.values() if "power" in c.capabilities]

    # ------------------------------------------------------------ état
    async def refresh(self, dev_id: str, force: bool = False):
        conn = self.devices.get(dev_id)
        if conn is None:
            return
        now = time.time()
        if not force and now - self._last_poll.get(dev_id, 0) < conn.min_interval:
            return
        self._last_poll[dev_id] = now
        old = self.state.get(dev_id, {})
        try:
            st = await asyncio.wait_for(conn.status(), 25)
            st["error"] = None
        except Exception as e:  # un appareil en panne ne doit pas bloquer les autres
            log.warning("%s : %s", dev_id, e)
            st = {**old, "online": False, "error": str(e) or type(e).__name__, "summary": "Erreur"}
        st["updated"] = int(now)
        if dev_id not in self.devices:  # supprimé entre-temps
            return
        self.state[dev_id] = st
        try:
            await self._on_change(conn, old, st)
        except Exception:
            log.exception("Changement d'état %s", dev_id)

    async def _on_change(self, conn, old: dict, new: dict):
        if not old.get("updated"):
            return
        name = conn.dev.get("name", conn.id)
        if bool(old.get("online")) != bool(new.get("online")) and conn.kind != "presence":
            if new.get("online"):
                self.logbook.add("state", f"{name} est de nouveau en ligne", conn.id)
            else:
                self.logbook.add("state", f"{name} est hors ligne" + (f" ({new['error'][:80]})" if new.get("error") else ""), conn.id)
                if self.settings.get("notify_offline"):
                    await self.notify(f"{name} hors ligne", new.get("error") or "", level="warning", source="Système")
        elif new.get("online") and bool(old.get("on")) != bool(new.get("on")):
            if conn.kind == "verisure":
                self.logbook.add("state", f"Alarme : {new.get('summary')}", conn.id)
            elif conn.kind == "presence":
                self.logbook.add("state", f"{name} : {'arrivé à la maison' if new.get('on') else 'parti'}", conn.id)
            elif conn.kind == "elegoo":
                self.logbook.add("state", f"{name} : {'impression démarrée' if new.get('on') else 'impression terminée / arrêtée'}", conn.id)
            else:
                self.logbook.add("state", f"{name} {'allumé' if new.get('on') else 'éteint'}", conn.id)
        low_new, low_old = set(new.get("low_supplies") or []), set(old.get("low_supplies") or [])
        if low_new - low_old:
            await self.notify(f"{name} : consommable bas", ", ".join(sorted(low_new - low_old)) + " à remplacer bientôt",
                              level="warning", source="Système")
        await self.engine.on_state(conn.id, old, new)

    async def execute(self, dev_id: str, action: str, params: dict, source: str = "Interface") -> dict:
        conn = self.devices.get(dev_id)
        if conn is None:
            raise ValueError(f"Appareil inconnu : {dev_id}")
        result = await asyncio.wait_for(conn.action(action, params or {}), 30)
        label = ACTION_LABELS.get(action, action)
        if action == "brightness":
            label += f" à {params.get('value')} %"
        elif action == "set_temperature":
            label += f" à {params.get('value')} °C"
        elif action == "set_mode":
            label += f" : {params.get('value')}"
        self.logbook.add("action", f"{self.name(dev_id)} : {label}", dev_id, source)
        await asyncio.sleep(0.4)
        await self.refresh(dev_id, force=True)
        return result

    async def notify(self, title: str, message: str = "", level: str = "info", source: str = "Système"):
        self.logbook.notify(title, message, level)
        self.logbook.add("notification", f"{title}" + (f" — {message}" if message else ""), None, source)
        await self.settings.push(title, message)

    # ------------------------------------------------------------ appareils modifiés depuis l'interface
    async def reload_devices(self, raw_devices: list):
        save_json("devices.json", raw_devices)
        self.cfg = load_config()
        new = {}
        for d in self.cfg["devices"]:
            old = self.devices.get(d["id"])
            if old is not None and old.dev == d:
                new[d["id"]] = old
            else:
                if old is not None:
                    await old.close()
                new[d["id"]] = connectors.build(d, self.cfg)
                self._last_poll.pop(d["id"], None)
        for i, c in self.devices.items():
            if i not in new:
                await c.close()
                self.state.pop(i, None)
        self.devices = new
        for i in new:
            self.state.setdefault(i, {"online": None, "summary": "…"})
        self.logbook.add("system", "Liste des appareils mise à jour", None, "Paramètres")
        asyncio.ensure_future(asyncio.gather(*(self.refresh(i, force=True) for i in new)))

    def reload_credentials(self, reset_kinds=()):
        """Relit les identifiants (.env) et les transmet à tous les connecteurs."""
        self.cfg["credentials"] = load_config()["credentials"]
        for c in self.devices.values():
            c.cfg = self.cfg
            if c.kind in reset_kinds:
                if hasattr(c, "_device"):
                    c._device = None
                if hasattr(c, "_session"):
                    c._session = None
                self._last_poll.pop(c.id, None)

    # ------------------------------------------------------------ boucles
    async def status_loop(self):
        while True:
            await asyncio.gather(*(self.refresh(i) for i in list(self.devices)))
            await asyncio.sleep(self.cfg["status_interval_seconds"])

    async def archive_loop(self):
        interval = self.cfg["archive"]["interval_seconds"]
        last_purge = last_servers = 0.0
        while True:
            await asyncio.sleep(interval)
            for dev_id, st in list(self.state.items()):  # compteurs (pages imprimées…)
                if st.get("online") and isinstance(st.get("counter"), (int, float)):
                    await asyncio.to_thread(self.archive.record_counter, dev_id, st["counter"])
            if time.time() - last_servers >= 300:  # statistiques serveurs : toutes les 5 minutes
                last_servers = time.time()
                for dev_id, st in list(self.state.items()):
                    m = st.get("metrics")
                    if m and st.get("online") and m.get("collected", 0) > time.time() - 600:
                        await asyncio.to_thread(self.archive.record_server, dev_id, m)
            for conn in self.power_devices():
                st = self.state.get(conn.id, {})
                if st.get("online") and st.get("updated", 0) > time.time() - 2 * interval:
                    await asyncio.to_thread(self.archive.record, conn.id, st.get("power_w"),
                                            st.get("energy_today_kwh"), None, True,
                                            tariff_mod.is_hc(self.tariff, datetime.now()))
            if time.time() - last_purge > 86400:
                await asyncio.to_thread(self.archive.purge)
                await asyncio.to_thread(self.logbook.purge)
                if not self.cfg["demo"]:
                    try:
                        name, _ = await asyncio.to_thread(system.make_backup)
                        log.info("Sauvegarde automatique : %s", name)
                    except Exception:
                        log.exception("Sauvegarde automatique")
                last_purge = time.time()

    def seed_demo_history(self, days: int = 30):
        """Génère un mois d'historique fictif pour que les graphiques soient visibles en démo."""
        if not self.cfg["demo"] or not self.archive.is_empty():
            return
        log.info("Mode démo : génération de %d jours d'historique de puissance…", days)
        step = self.archive.interval * 5
        orig = self.archive.interval
        self.archive.interval = step
        start = int(time.time()) - days * 86400
        for conn in self.power_devices():
            for ts in range(start, int(time.time()), step):
                self.archive.record(conn.id, round(demo_watts(conn.id, ts), 1), None, ts, commit=False)
        self.archive.commit()
        self.archive.interval = orig

    async def start(self):
        await asyncio.to_thread(self.seed_demo_history)
        self.logbook.add("system", "Démarrage de Maison connectée" + (" (mode démo)" if self.cfg["demo"] else ""))
        self._tasks = [asyncio.create_task(self.status_loop()), asyncio.create_task(self.archive_loop()),
                       asyncio.create_task(self.engine.loop())]

    async def stop(self):
        for t in self._tasks:
            t.cancel()
        await asyncio.gather(*self._tasks, return_exceptions=True)
        for c in self.devices.values():
            try:
                await c.close()
            except Exception:
                pass
        self.archive.close()
        self.logbook.close()


hub: Hub | None = None
_restart_lock = asyncio.Lock()


async def restart_hub(before=None):
    """Redémarre le cœur (connecteurs, automatisations, bases) sans arrêter le serveur web."""
    global hub
    async with _restart_lock:
        await hub.stop()
        try:
            if before:
                await asyncio.to_thread(before)
        finally:
            hub = Hub()
            await hub.start()
        log.info("Redémarrage terminé — %d appareils%s", len(hub.devices), " (MODE DÉMO)" if hub.cfg["demo"] else "")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global hub
    hub = Hub()
    await hub.start()
    log.info("Maison connectée prête — %d appareils%s", len(hub.devices), " (MODE DÉMO)" if hub.cfg["demo"] else "")
    yield
    await hub.stop()


app = FastAPI(title="Maison connectée", lifespan=lifespan)


@app.middleware("http")
async def no_stale_ui(request: Request, call_next):
    """Interface (HTML/JS/CSS) : toujours revalidée, pour que les mises à jour apparaissent sans vider le cache."""
    response = await call_next(request)
    if not request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-cache"
    return response


@app.middleware("http")
async def log_commands(request: Request, call_next):
    """Trace les commandes (POST/PUT/DELETE) dans le journal technique, pour le diagnostic."""
    response = await call_next(request)
    if request.method != "GET":
        log.info("%s %s → %s", request.method, request.url.path, response.status_code)
    return response


@app.middleware("http")
async def basic_auth(request: Request, call_next):
    password = os.environ.get("DASHBOARD_PASSWORD")
    if password:
        header = request.headers.get("authorization", "")
        ok = False
        if header.lower().startswith("basic "):
            try:
                _, _, given = base64.b64decode(header[6:]).decode().partition(":")
                ok = secrets.compare_digest(given, password)
            except Exception:
                ok = False
        if not ok:
            return Response("Authentification requise", 401, {"WWW-Authenticate": 'Basic realm="Maison"'})
    return await call_next(request)


def _get(dev_id: str):
    if dev_id not in hub.devices:
        raise HTTPException(404, "Appareil inconnu")
    return hub.devices[dev_id]


async def _body(request: Request):
    try:
        return await request.json()
    except Exception:
        return {}


# ---------------- Appareils ----------------

@app.get("/api/config")
async def api_config():
    floors = load_json("floors.json", {"floors": []})
    layout = load_json("layout.json", {})
    devices = [{
        "id": c.id, "name": c.dev.get("name", c.id), "type": c.kind, "icon": c.icon,
        "floor": c.dev.get("floor"), "room": c.dev.get("room"), "host": c.host,
        "capabilities": list(c.capabilities), "actions": list(c.actions),
    } for c in hub.devices.values()]
    return {"demo": hub.cfg["demo"], "floors": floors["floors"], "layout": layout, "devices": devices,
            "price_per_kwh": hub.tariff["price_base"], "tariff": hub.tariff, "types": sorted(connectors.TYPES)}


@app.get("/api/tariff")
async def api_tariff():
    return {**hub.tariff, **tariff_mod.status(hub.tariff)}


@app.put("/api/tariff")
async def api_tariff_save(request: Request):
    t = tariff_mod.normalize(await _body(request), hub.cfg["archive"]["price_per_kwh"])
    hub.settings.update({"tariff": t})
    hub.tariff = t
    n = await asyncio.to_thread(hub.archive.recompute_split, lambda d: tariff_mod.is_hc(t, d))
    hub.logbook.add("system", "Tarif électrique mis à jour" + (" (heures pleines / heures creuses)" if t["mode"] == "hphc" else " (base)"), None, "Paramètres")
    return {**t, **tariff_mod.status(t), "recomputed_days": n}


@app.get("/api/state")
async def api_state():
    return hub.state


@app.post("/api/devices/{dev_id}/action/{name}")
async def api_action(dev_id: str, name: str, request: Request):
    _get(dev_id)
    params = await _body(request)
    try:
        result = await hub.execute(dev_id, name, params or {}, "Interface")
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        log.warning("Action %s sur %s refusée : %s", name, dev_id, e)
        hub.logbook.add("system", f"Échec : {hub.name(dev_id)} — {e}", dev_id, "Interface")
        raise HTTPException(502, str(e))
    return {**result, "state": hub.state[dev_id]}


@app.get("/api/devices/{dev_id}/diagnose")
async def api_diagnose(dev_id: str):
    conn = _get(dev_id)
    if not hasattr(conn, "diagnose"):
        raise HTTPException(400, "Diagnostic disponible pour les pièces tado° uniquement")
    try:
        return await conn.diagnose()
    except Exception as e:
        raise HTTPException(502, str(e))


@app.post("/api/devices/{dev_id}/refresh")
async def api_refresh(dev_id: str):
    _get(dev_id)
    await hub.refresh(dev_id, force=True)
    return hub.state[dev_id]


@app.get("/api/camera/{dev_id}/snapshot")
async def api_snapshot(dev_id: str):
    conn = _get(dev_id)
    if not hasattr(conn, "snapshot"):
        raise HTTPException(400, "Ce n'est pas une caméra")
    try:
        img = await conn.snapshot()
    except Exception as e:
        raise HTTPException(502, str(e))
    media = "image/png" if img[:4] == b"\x89PNG" else "image/jpeg"
    return Response(img, media_type=media, headers={"Cache-Control": "no-store"})


@app.put("/api/layout")
async def api_layout(request: Request):
    layout = await request.json()
    clean = {k: {"floor": str(v["floor"]), "x": round(float(v["x"])), "y": round(float(v["y"]))}
             for k, v in layout.items() if k in hub.devices}
    save_json("layout.json", clean)
    return {"ok": True}


FURNITURE_KINDS = {"appliance", "ac", "tv", "desk", "it", "sofa", "table", "wardrobe", "bed", "plant", None}


@app.put("/api/floors")
async def api_floors_save(request: Request):
    """Enregistre le plan (pièces, meubles, fenêtres) — utilisé par l'éditeur / les mises à jour du plan."""
    data = await _body(request)
    floors = data.get("floors") if isinstance(data, dict) else None
    if not isinstance(floors, list) or not floors:
        raise HTTPException(400, "Plan invalide")
    for f in floors:
        if not isinstance(f, dict) or not f.get("id") or not isinstance(f.get("rooms"), list):
            raise HTTPException(400, "Étage invalide")
        for it in f.get("furniture") or []:
            if it.get("kind") not in FURNITURE_KINDS:
                raise HTTPException(400, f"Type de meuble inconnu : {it.get('kind')}")
            for k in ("x", "y", "w", "h"):
                if not isinstance(it.get(k), (int, float)):
                    raise HTTPException(400, f"Meuble « {it.get('name')} » : {k} manquant")
    save_json("floors.json", {"floors": floors})
    hub.logbook.add("system", "Plan modifié", None, "Paramètres")
    return {"ok": True}


@app.get("/api/mac")
async def api_mac(ip: str):
    """Trouve l'adresse MAC d'un appareil du réseau local (pour le Wake on LAN)."""
    if not re.fullmatch(r"\d{1,3}(\.\d{1,3}){3}", ip):
        raise HTTPException(400, "Adresse IP invalide")
    from .connectors.base import ping
    from .scan import _arp_table
    await ping(ip)  # remplit la table ARP
    mac = (await asyncio.to_thread(_arp_table)).get(ip)
    if not mac:
        raise HTTPException(404, "Adresse MAC introuvable : l'appareil doit être allumé et sur le même réseau")
    return {"ip": ip, "mac": mac}


DEVICE_ID_RE = re.compile(r"^[a-z0-9_]{2,40}$")


@app.get("/api/devices/config")
async def api_devices_config():
    return load_devices_raw()


@app.put("/api/devices/config")
async def api_devices_save(request: Request):
    items = await request.json()
    if not isinstance(items, list):
        raise HTTPException(400, "Liste attendue")
    seen, clean = set(), []
    for d in items:
        if not isinstance(d, dict):
            raise HTTPException(400, "Appareil invalide")
        d = {k: v for k, v in d.items() if v not in (None, "")}
        if not DEVICE_ID_RE.match(str(d.get("id", ""))):
            raise HTTPException(400, f"Identifiant invalide « {d.get('id')} » (minuscules, chiffres, _)")
        if d["id"] in seen:
            raise HTTPException(400, f"Identifiant en double : {d['id']}")
        if d.get("type") not in connectors.TYPES:
            raise HTTPException(400, f"Type inconnu pour {d['id']}")
        if not str(d.get("name", "")).strip():
            raise HTTPException(400, f"Nom manquant pour {d['id']}")
        try:
            connectors.build(expand(d), hub.cfg)
        except Exception as e:
            raise HTTPException(400, f"{d['id']} : {e}")
        seen.add(d["id"])
        clean.append(d)
    await hub.reload_devices(clean)
    return {"ok": True, "count": len(clean)}


# ---------------- Comptes connectés ----------------

def _mask(email: str) -> str:
    if not email or "@" not in email:
        return email or ""
    name, dom = email.split("@", 1)
    return name[:2] + "•" * max(1, len(name) - 2) + "@" + dom


@app.get("/api/accounts")
async def api_accounts():
    cred = hub.cfg["credentials"]
    from .connectors.verisure import COOKIE_FILE
    return {
        "tapo": {"email": _mask(cred.get("tapo", {}).get("username", "")), "has_password": bool(cred.get("tapo", {}).get("password"))},
        "verisure": {"email": _mask(cred.get("verisure", {}).get("username", "")),
                     "has_password": bool(cred.get("verisure", {}).get("password")), "trusted": COOKIE_FILE.exists(),
                     "mfa_pending": VERISURE.session is not None},
        "tado": TADO.status(),
        "hon": {"email": _mask(os.environ.get("HON_EMAIL", "")), "has_password": bool(os.environ.get("HON_PASSWORD"))},
        "others": {k: (bool(os.environ.get(k)) if k in OTHER_SECRETS else os.environ.get(k, "")) for k in OTHER_KEYS},
    }


OTHER_KEYS = ("QNAP_USER", "QNAP_PASSWORD", "TERRAMASTER_USER", "TERRAMASTER_PASSWORD", "LINUX_USER", "LINUX_PASSWORD",
              "SWITCH_USER", "SWITCH_PASSWORD", "SFR_USER", "SFR_PASSWORD", "LIVEBOX_USER", "LIVEBOX_PASSWORD",
              "PROXMOX_USER", "PROXMOX_TOKEN_NAME", "PROXMOX_TOKEN_VALUE", "CAMERA_USER", "CAMERA_PASSWORD")
OTHER_SECRETS = ("QNAP_PASSWORD", "TERRAMASTER_PASSWORD", "LINUX_PASSWORD", "SWITCH_PASSWORD", "SFR_PASSWORD", "LIVEBOX_PASSWORD", "PROXMOX_TOKEN_VALUE", "CAMERA_PASSWORD")


@app.put("/api/accounts/others")
async def api_account_others(request: Request):
    b = await _body(request)
    values = {k: str(v).strip() for k, v in b.items() if k in OTHER_KEYS and not (k in OTHER_SECRETS and not v)}
    if not values:
        raise HTTPException(400, "Rien à enregistrer")
    set_env(values)
    hub.reload_credentials(("qnap", "proxmox", "camera", "terramaster", "linux", "tplink_switch", "sfr_box", "livebox"))
    hub.logbook.add("system", "Identifiants NAS / Proxmox / caméras mis à jour", None, "Paramètres")
    asyncio.ensure_future(asyncio.gather(*(hub.refresh(c.id, force=True) for c in hub.devices.values()
                                           if c.kind in ("qnap", "proxmox", "camera", "terramaster", "linux", "tplink_switch", "sfr_box", "livebox"))))
    return {"ok": True}


@app.put("/api/accounts/tapo")
async def api_account_tapo(request: Request):
    b = await _body(request)
    values = {"TAPO_EMAIL": str(b.get("username", "")).strip()}
    if b.get("password"):
        values["TAPO_PASSWORD"] = str(b["password"])
    if not values["TAPO_EMAIL"]:
        raise HTTPException(400, "Adresse e-mail du compte Tapo requise")
    set_env(values)
    hub.reload_credentials(("tapo_plug", "tapo_bulb", "tapo_clim"))
    hub.logbook.add("system", "Compte Tapo mis à jour", None, "Paramètres")
    return {"ok": True}


@app.post("/api/accounts/tapo/discover")
async def api_tapo_discover():
    c = hub.cfg["credentials"].get("tapo", {})
    if not c.get("username") or not c.get("password"):
        raise HTTPException(400, "Enregistre d'abord ton e-mail et ton mot de passe Tapo")
    try:
        found = await asyncio.wait_for(discover_tapo(c["username"], c["password"]), 40)
    except Exception as e:
        raise HTTPException(502, f"Recherche impossible : {e}")
    known = {d.get("host"): d["id"] for d in load_devices_raw()}
    for f in found:
        f["configured_as"] = known.get(f["host"])
    return found


@app.put("/api/accounts/verisure")
async def api_account_verisure(request: Request):
    b = await _body(request)
    user = str(b.get("username", "")).strip()
    if not user:
        raise HTTPException(400, "Adresse e-mail Verisure requise")
    values = {"VERISURE_EMAIL": user}
    if b.get("password"):
        values["VERISURE_PASSWORD"] = str(b["password"])
    set_env(values)
    hub.reload_credentials(("verisure",))
    c = hub.cfg["credentials"]["verisure"]
    try:
        res = await asyncio.to_thread(VERISURE.start, c["username"], c["password"])
    except PermissionError as e:
        raise HTTPException(401, str(e))
    except Exception as e:
        raise HTTPException(502, f"Verisure : {e}")
    if res.get("ok"):
        hub.reload_credentials(("verisure",))
        hub.logbook.add("system", "Compte Verisure connecté", None, "Paramètres")
    return res


@app.post("/api/accounts/verisure/mfa")
async def api_account_verisure_mfa(request: Request):
    code = str((await _body(request)).get("code", "")).strip()
    if not code:
        raise HTTPException(400, "Code requis")
    try:
        res = await asyncio.to_thread(VERISURE.validate, code)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(401, f"Code refusé : {e}")
    hub.reload_credentials(("verisure",))
    hub.logbook.add("system", "Compte Verisure connecté (appareil de confiance)", None, "Paramètres")
    return res


@app.put("/api/accounts/hon")
async def api_account_hon(request: Request):
    from .connectors.hon import HON
    b = await _body(request)
    email = str(b.get("username", "")).strip()
    if not email:
        raise HTTPException(400, "Adresse e-mail du compte hOn requise")
    values = {"HON_EMAIL": email}
    if b.get("password"):
        values["HON_PASSWORD"] = str(b["password"])
    set_env(values)
    await HON.close()
    try:
        found = await asyncio.wait_for(HON.appliances(), 40)
    except PermissionError as e:
        raise HTTPException(401, str(e))
    except Exception as e:
        raise HTTPException(502, f"hOn : {e}")
    hub.logbook.add("system", "Compte hOn connecté", None, "Paramètres")
    from .connectors.hon import norm_mac
    known = {norm_mac(d.get("mac")): d["id"] for d in load_devices_raw() if d.get("type") == "hon"}
    for f in found:
        f["configured_as"] = known.get(norm_mac(f["mac"]))
    return found


@app.post("/api/accounts/tado/login")
async def api_tado_login():
    try:
        return await TADO.start_login()
    except Exception as e:
        raise HTTPException(502, f"Impossible de joindre tado° : {e}")


@app.post("/api/accounts/tado/logout")
async def api_tado_logout():
    TADO.logout()
    hub.logbook.add("system", "Compte tado° déconnecté", None, "Paramètres")
    return {"ok": True}


@app.get("/api/accounts/tado/zones")
async def api_tado_zones():
    try:
        zones = await TADO.zones()
    except PermissionError as e:
        raise HTTPException(401, str(e))
    except Exception as e:
        raise HTTPException(502, f"tado° : {e}")
    known = {(d.get("home_id"), d.get("zone_id")): d["id"] for d in load_devices_raw() if d.get("type") == "tado"}
    for z in zones:
        z["configured_as"] = known.get((z["home_id"], z["zone_id"]))
    return zones


@app.put("/api/accounts/tado/settings")
async def api_tado_settings(request: Request):
    secs = int((await _body(request)).get("poll_seconds") or 900)
    TADO.poll_seconds = max(120, min(secs, 3600))
    hub.settings.update({"tado_poll_seconds": TADO.poll_seconds})
    return TADO.status()


# ---------------- Système ----------------

@app.get("/api/health")
async def api_health():
    return {"ok": True, "version": system.VERSION}


@app.get("/api/system")
async def api_system():
    return await asyncio.to_thread(system.info, hub)


@app.put("/api/system/mode")
async def api_system_mode(request: Request):
    demo = bool((await _body(request)).get("demo"))
    system.set_demo(demo)
    await restart_hub()
    hub.logbook.add("system", "Passage en mode " + ("démo" if demo else "réel"), None, "Paramètres")
    return {"ok": True, "demo": hub.cfg["demo"]}


@app.post("/api/system/restart")
async def api_system_restart():
    await restart_hub()
    return {"ok": True}


@app.put("/api/system/password")
async def api_system_password(request: Request):
    pw = str((await _body(request)).get("password", ""))
    if pw and len(pw) < 6:
        raise HTTPException(400, "6 caractères minimum")
    set_env({"DASHBOARD_PASSWORD": pw})
    hub.logbook.add("system", "Mot de passe de l'interface " + ("défini" if pw else "supprimé"), None, "Paramètres")
    return {"ok": True, "password": bool(pw)}


@app.put("/api/system/autostart")
async def api_system_autostart(request: Request):
    try:
        return await asyncio.to_thread(system.set_autostart, bool((await _body(request)).get("enabled")))
    except Exception as e:
        raise HTTPException(400, str(e))


@app.get("/api/system/logs")
async def api_system_logs(lines: int = 200):
    return {"lines": await asyncio.to_thread(system.tail_log, min(lines, 2000))}


@app.post("/api/system/backup")
async def api_system_backup():
    name, data = await asyncio.to_thread(system.make_backup)
    return Response(data, media_type="application/zip", headers={"Content-Disposition": f'attachment; filename="{name}"'})


@app.get("/api/system/backups/{name}")
async def api_system_backup_file(name: str):
    if not re.fullmatch(r"maison_[\d_-]+\.zip", name) or not (system.BACKUP_DIR / name).exists():
        raise HTTPException(404, "Sauvegarde introuvable")
    return FileResponse(system.BACKUP_DIR / name, media_type="application/zip", filename=name)


@app.post("/api/system/restore")
async def api_system_restore(request: Request):
    data = await request.body()
    if not data or len(data) > 500_000_000:
        raise HTTPException(400, "Fichier vide ou trop gros")
    import zipfile
    if not zipfile.is_zipfile(io.BytesIO(data)):
        raise HTTPException(400, "Ce fichier n'est pas une sauvegarde (.zip) Maison connectée")
    restored: list = []

    def do():
        restored.extend(system.restore_backup(data))
    try:
        await restart_hub(before=do)
    except ValueError as e:
        raise HTTPException(400, str(e))
    hub.logbook.add("system", f"Sauvegarde restaurée ({len(restored)} fichiers)", None, "Paramètres")
    return {"ok": True, "restored": restored}


@app.get("/api/scan")
async def api_scan():
    try:
        res = await asyncio.wait_for(scan_network(), 90)
    except Exception as e:
        raise HTTPException(502, f"Recherche impossible : {e}")
    raw = load_devices_raw()
    by_host = {d.get("host"): d["id"] for d in raw if d.get("host")}
    for f in res["found"]:
        f["configured_as"] = by_host.get(f["host"])
    return res


# ---------------- Baie de brassage ----------------

RACK_TYPES = {"patch", "switch", "router", "firewall", "server", "nas", "ups", "pdu", "shelf", "cable", "blank", "other"}


@app.get("/api/rack")
async def api_rack():
    return load_json("rack.json", {"racks": {}})


@app.put("/api/rack/{name}")
async def api_rack_save(name: str, request: Request):
    b = await _body(request)
    units = int(b.get("units") or 12)
    if not 4 <= units <= 48:
        raise HTTPException(400, "Hauteur de baie entre 4U et 48U")
    items, used = [], {}
    for it in b.get("items") or []:
        try:
            u, h = int(it["u"]), int(it.get("h") or 1)
        except (KeyError, TypeError, ValueError):
            raise HTTPException(400, "Équipement invalide")
        if it.get("type") not in RACK_TYPES:
            raise HTTPException(400, "Type d'équipement inconnu")
        if not 1 <= h <= 10 or u < 1 or u + h - 1 > units:
            raise HTTPException(400, f"« {it.get('name')} » dépasse de la baie ({units}U)")
        side = it.get("side") if it.get("side") in ("left", "right") else None
        for slot in range(u, u + h):
            for half in ((side,) if side else ("left", "right")):
                if (slot, half) in used:
                    raise HTTPException(400, f"« {it.get('name')} » chevauche « {used[(slot, half)]} » (U{slot})")
                used[(slot, half)] = it.get("name") or "équipement"
        ports = int(it["ports"]) if str(it.get("ports") or "").isdigit() else None
        port_map = {}
        for k, v in (it.get("port_map") or {}).items():
            if not (str(k).isdigit() and ports and 1 <= int(k) <= ports and isinstance(v, dict)):
                continue
            entry = {"label": str(v.get("label") or "")[:40], "device": v.get("device") or None}
            if entry["label"] or entry["device"]:
                port_map[str(int(k))] = entry
        items.append({"id": str(it.get("id") or secrets.token_hex(5))[:20], "name": str(it.get("name") or "")[:60],
                      "type": it["type"], "u": u, "h": h, "device": it.get("device") or None,
                      "ports": ports, "model": str(it.get("model") or "")[:40] or None, "port_map": port_map, "side": side,
                      "notes": str(it.get("notes") or "")[:300]})
    data = load_json("rack.json", {"racks": {}})
    data["racks"][name[:60]] = {"units": units, "items": sorted(items, key=lambda x: -x["u"])}
    save_json("rack.json", data)
    return data["racks"][name[:60]]


# ---------------- Automatisations & scènes ----------------

@app.get("/api/automations")
async def api_automations():
    return {"automations": hub.engine.automations, "last_run": hub.engine.last_run}


@app.put("/api/automations")
async def api_automations_save(request: Request):
    try:
        hub.engine.set_automations(await request.json())
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"ok": True, "automations": hub.engine.automations}


@app.post("/api/automations/{auto_id}/run")
async def api_automation_run(auto_id: str):
    a = next((a for a in hub.engine.automations if a["id"] == auto_id), None)
    if not a:
        raise HTTPException(404, "Automatisation inconnue")
    asyncio.create_task(hub.engine.run_automation(a, "lancée à la main"))
    return {"ok": True}


@app.get("/api/scenes")
async def api_scenes():
    return hub.engine.scenes


@app.put("/api/scenes")
async def api_scenes_save(request: Request):
    try:
        hub.engine.set_scenes(await request.json())
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"ok": True, "scenes": hub.engine.scenes}


@app.post("/api/scenes/{scene_id}/run")
async def api_scene_run(scene_id: str):
    if not any(s["id"] == scene_id for s in hub.engine.scenes):
        raise HTTPException(404, "Scène inconnue")
    asyncio.create_task(hub.engine.run_scene(scene_id))
    return {"ok": True}


# ---------------- Journal & notifications ----------------

@app.get("/api/logbook")
async def api_logbook(limit: int = 200, entity: str = "", kind: str = "", before: int = 0):
    return await asyncio.to_thread(hub.logbook.list, limit, entity or None, kind or None, before or None)


@app.get("/api/notifications")
async def api_notifications():
    return hub.logbook.notifications()


@app.post("/api/notifications/read")
async def api_notifications_read():
    hub.logbook.mark_read()
    return {"ok": True}


# ---------------- Réglages, soleil, météo ----------------

@app.get("/api/settings")
async def api_settings():
    return hub.settings.public()


@app.put("/api/settings")
async def api_settings_save(request: Request):
    hub.settings.update(await request.json())
    _weather_cache.clear()
    return hub.settings.public()


@app.post("/api/settings/test-notification")
async def api_settings_test():
    sent = await hub.settings.push("Test Maison connectée", "Les notifications fonctionnent 🎉")
    hub.logbook.notify("Notification de test", "Envoyée vers : " + (", ".join(sent) or "interface uniquement"))
    return {"sent": sent}


@app.get("/api/geocode")
async def api_geocode(q: str):
    async with httpx.AsyncClient(timeout=8) as c:
        r = await c.get("https://geocoding-api.open-meteo.com/v1/search",
                        params={"name": q, "count": 5, "language": "fr", "format": "json"})
    r.raise_for_status()
    return [{"name": x["name"], "region": x.get("admin1"), "country": x.get("country"),
             "latitude": x["latitude"], "longitude": x["longitude"]} for x in r.json().get("results", [])]


@app.get("/api/sun")
async def api_sun():
    loc = hub.settings.location
    if not loc:
        return {}
    t = sun_times(*loc)
    return {k: v.strftime("%H:%M") if v else None for k, v in t.items()}


_weather_cache: dict = {}


@app.get("/api/weather")
async def api_weather():
    loc = hub.settings.location
    if not loc:
        return {"configured": False}
    if _weather_cache.get("ts", 0) > time.time() - 600:
        return _weather_cache["data"]
    try:
        async with httpx.AsyncClient(timeout=8) as c:
            r = await c.get("https://api.open-meteo.com/v1/forecast", params={
                "latitude": loc[0], "longitude": loc[1], "timezone": "auto", "forecast_days": 5,
                "current": "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day",
                "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
            })
        r.raise_for_status()
    except Exception as e:
        if "data" in _weather_cache:
            return _weather_cache["data"]
        raise HTTPException(502, f"Météo indisponible : {e}")
    data = {"configured": True, "city": hub.settings.get("city"), **r.json()}
    _weather_cache.update(ts=time.time(), data=data)
    return data


# ---------------- Archive de puissance ----------------

RANGES = {"6h": 6 * 3600, "24h": 86400, "7d": 7 * 86400, "30d": 30 * 86400, "365d": 365 * 86400}


@app.get("/api/power/history")
async def api_power_history(range: str = "24h", devices: str = ""):
    span = RANGES.get(range, 86400)
    end = int(time.time())
    ids = [d for d in devices.split(",") if d] or [c.id for c in hub.power_devices()]
    return {i: await asyncio.to_thread(hub.archive.history, i, end - span, end) for i in ids}


@app.get("/api/servers/history")
async def api_servers_history(device: str, range: str = "24h"):
    end = int(time.time())
    return await asyncio.to_thread(hub.archive.server_history, device, end - RANGES.get(range, 86400), end)


@app.get("/api/counters")
async def api_counters(device: str, days: int = 30):
    return await asyncio.to_thread(hub.archive.counters, device, min(days, 3650))


@app.get("/api/power/daily")
async def api_power_daily(days: int = 30, devices: str = ""):
    ids = [d for d in devices.split(",") if d] or None
    return await asyncio.to_thread(hub.archive.daily, ids, min(days, 3650))


@app.get("/api/power/monthly")
async def api_power_monthly(devices: str = ""):
    ids = [d for d in devices.split(",") if d] or None
    return await asyncio.to_thread(hub.archive.monthly, ids)


@app.get("/api/power/export.csv")
async def api_power_export(range: str = "30d", device: str = ""):
    end = int(time.time())
    rows = await asyncio.to_thread(hub.archive.export_rows, device or None, end - RANGES.get(range, 30 * 86400), end)
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";")
    w.writerow(["date", "appareil", "watts", "kwh_jour_compteur"])
    for r in rows:
        w.writerow([time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(r["ts"])), r["device_id"],
                    str(r["watts"]).replace(".", ","), "" if r["energy_today_kwh"] is None
                    else str(r["energy_today_kwh"]).replace(".", ",")])
    return StreamingResponse(iter(["﻿" + buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f'attachment; filename="puissance_{range}.csv"'})


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    log.exception("Erreur %s", request.url.path)
    return JSONResponse({"detail": str(exc)}, 500)


@app.get("/")
async def index():
    return FileResponse(WEB_DIR / "index.html")


app.mount("/", StaticFiles(directory=WEB_DIR), name="web")


def main():
    cfg = load_config()
    uvicorn.run("app.main:app", host=cfg["server"]["host"], port=cfg["server"]["port"], log_level="warning")


if __name__ == "__main__":
    main()
