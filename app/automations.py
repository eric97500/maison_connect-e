"""Moteur d'automatisations et de scènes.

Une automatisation = { id, name, enabled, triggers: [...], conditions: [...], actions: [...] }
  Déclencheurs : time, sun, state, power, alarm, presence
  Conditions   : time, days, state, alarm, presence, sun
  Actions      : device, scene, notify, delay
Une scène = { id, name, icon, actions: [...] }
"""
import asyncio
import logging
import time
import uuid
from datetime import datetime, timedelta

from .config import load_json, save_json
from .sun import is_day, sun_times

log = logging.getLogger("maison")

DAYS_FR = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"]

DEFAULT_SCENES = [
    {"id": "soiree_tv", "name": "Soirée TV", "icon": "tv", "actions": [
        {"type": "device", "device": "prise_tv", "action": "on"},
        {"type": "device", "device": "ampoule_salon", "action": "on"},
        {"type": "device", "device": "ampoule_salon", "action": "brightness", "params": {"value": 30}},
        {"type": "device", "device": "ampoule_cuisine", "action": "off"},
    ]},
    {"id": "tout_eteindre", "name": "Tout éteindre", "icon": "power", "actions": [
        {"type": "device", "device": "prise_tv", "action": "off"},
        {"type": "device", "device": "ampoule_salon", "action": "off"},
        {"type": "device", "device": "ampoule_cuisine", "action": "off"},
        {"type": "device", "device": "clim_salon", "action": "off"},
    ]},
    {"id": "bonne_nuit", "name": "Bonne nuit", "icon": "moon", "actions": [
        {"type": "device", "device": "prise_tv", "action": "off"},
        {"type": "device", "device": "ampoule_cuisine", "action": "off"},
        {"type": "device", "device": "ampoule_salon", "action": "brightness", "params": {"value": 5}},
        {"type": "delay", "seconds": 60},
        {"type": "device", "device": "ampoule_salon", "action": "off"},
    ]},
    {"id": "travail", "name": "Travail", "icon": "monitor", "actions": [
        {"type": "device", "device": "pc_bureau", "action": "wake"},
        {"type": "device", "device": "prise_bureau2", "action": "on"},
        {"type": "device", "device": "prise_bureau3", "action": "on"},
    ]},
]

DEFAULT_AUTOMATIONS = [
    {"id": "coucher_soleil", "name": "Lumière au coucher du soleil", "enabled": False,
     "triggers": [{"type": "sun", "event": "sunset", "offset": -15}],
     "conditions": [{"type": "presence", "is": "home"}],
     "actions": [{"type": "device", "device": "ampoule_salon", "action": "on"},
                 {"type": "device", "device": "ampoule_salon", "action": "brightness", "params": {"value": 60}}]},
    {"id": "clim_conso", "name": "Clim : forte consommation prolongée", "enabled": False,
     "triggers": [{"type": "power", "device": "clim_salon", "op": "above", "watts": 1200, "for_min": 30}],
     "conditions": [],
     "actions": [{"type": "notify", "title": "Climatisation", "message": "La clim consomme plus de 1200 W depuis 30 minutes."}]},
    {"id": "impression_finie", "name": "Impression 3D terminée", "enabled": True,
     "triggers": [{"type": "state", "device": "imprimante_3d", "to": "off"}],
     "conditions": [],
     "actions": [{"type": "notify", "title": "Imprimante 3D", "message": "L'impression est terminée (ou arrêtée)."}]},
    {"id": "depart", "name": "Tout le monde est parti", "enabled": False,
     "triggers": [{"type": "presence", "to": "all_away"}],
     "conditions": [],
     "actions": [{"type": "scene", "scene": "tout_eteindre"},
                 {"type": "notify", "title": "Maison", "message": "Plus personne : tout a été éteint. Pense à l'alarme !"}]},
    {"id": "pc_matin", "name": "Allumer le PC en semaine à 8 h", "enabled": False,
     "triggers": [{"type": "time", "at": "08:00", "days": [0, 1, 2, 3, 4]}],
     "conditions": [],
     "actions": [{"type": "device", "device": "pc_bureau", "action": "wake"}]},
]

TRIGGER_TYPES = {"time", "sun", "state", "power", "alarm", "presence", "tariff"}
CONDITION_TYPES = {"time", "days", "state", "alarm", "presence", "sun", "tariff"}
ACTION_TYPES = {"device", "scene", "notify", "delay"}


def _hm(s: str) -> tuple[int, int]:
    h, m = str(s or "00:00").split(":")[:2]
    return int(h), int(m)


def validate(items: list, kind: str) -> list:
    """Nettoie une liste d'automatisations ou de scènes envoyée par l'interface."""
    if not isinstance(items, list):
        raise ValueError("Liste attendue")
    seen, out = set(), []
    for it in items:
        if not isinstance(it, dict) or not str(it.get("name", "")).strip():
            raise ValueError("Chaque élément doit avoir un nom")
        it = dict(it)
        it["id"] = str(it.get("id") or uuid.uuid4().hex[:10])
        if it["id"] in seen:
            it["id"] = uuid.uuid4().hex[:10]
        seen.add(it["id"])
        it["name"] = str(it["name"]).strip()[:80]
        groups = (("actions", ACTION_TYPES),) if kind == "scene" else (
            ("triggers", TRIGGER_TYPES), ("conditions", CONDITION_TYPES), ("actions", ACTION_TYPES))
        for key, allowed in groups:
            rows = it.get(key) or []
            if not isinstance(rows, list) or any(not isinstance(r, dict) or r.get("type") not in allowed for r in rows):
                raise ValueError(f"« {it['name']} » : élément invalide dans {key}")
            it[key] = rows
        if kind == "automation":
            it["enabled"] = bool(it.get("enabled", True))
            if not it["triggers"]:
                raise ValueError(f"« {it['name']} » : il faut au moins un déclencheur")
        out.append(it)
    return out


class Engine:
    def __init__(self, hub):
        self.hub = hub
        self.automations = load_json("automations.json", None)
        if self.automations is None:
            self.automations = DEFAULT_AUTOMATIONS
            save_json("automations.json", self.automations)
        self.scenes = load_json("scenes.json", None)
        if self.scenes is None:
            self.scenes = DEFAULT_SCENES
            save_json("scenes.json", self.scenes)
        self.last_run: dict[str, int] = {}
        self._fired: dict[str, str] = {}
        self._since: dict[str, float] = {}
        self._running: set[str] = set()

    # ------------------------------------------------------------ stockage
    def set_automations(self, items):
        self.automations = validate(items, "automation")
        save_json("automations.json", self.automations)
        self._fired.clear()
        self._since.clear()

    def set_scenes(self, items):
        self.scenes = validate(items, "scene")
        save_json("scenes.json", self.scenes)

    # ------------------------------------------------------------ état courant
    def _dev_is(self, dev_id: str, what: str) -> bool:
        st = self.hub.state.get(dev_id, {})
        return {"on": st.get("on") is True, "off": st.get("on") is False,
                "online": st.get("online") is True, "offline": st.get("online") is False}.get(what, False)

    def _alarm_state(self):
        for c in self.hub.devices.values():
            if c.kind == "verisure":
                return self.hub.state.get(c.id, {}).get("alarm_state")
        return None

    def someone_home(self, state=None) -> bool | None:
        state = state or self.hub.state
        ids = [c.id for c in self.hub.devices.values() if c.kind == "presence"]
        if not ids:
            return None
        return any(state.get(i, {}).get("on") for i in ids)

    def _sun_dt(self, event: str, offset: int, day=None):
        loc = self.hub.settings.location
        if not loc:
            return None
        t = sun_times(*loc, day)[event]
        return t + timedelta(minutes=int(offset or 0)) if t else None

    # ------------------------------------------------------------ conditions
    def conditions_ok(self, a: dict) -> bool:
        now = datetime.now()
        for c in a.get("conditions", []):
            t = c.get("type")
            if t == "time":
                cur = now.hour * 60 + now.minute
                after, before = (lambda h: h[0] * 60 + h[1])(_hm(c.get("after"))), (lambda h: h[0] * 60 + h[1])(_hm(c.get("before")))
                ok = after <= cur < before if after <= before else (cur >= after or cur < before)
            elif t == "days":
                ok = now.weekday() in (c.get("days") or [])
            elif t == "state":
                ok = self._dev_is(c.get("device"), c.get("is"))
            elif t == "alarm":
                ok = self._alarm_state() == c.get("is")
            elif t == "presence":
                home = self.someone_home()
                ok = home is None or home == (c.get("is") == "home")
            elif t == "sun":
                loc = self.hub.settings.location
                ok = True if not loc else is_day(*loc) == (c.get("is") == "day")
            elif t == "tariff":
                from .tariff import is_hc
                ok = is_hc(self.hub.tariff, now) == (c.get("is") == "hc")
            else:
                ok = True
            if not ok:
                return False
        return True

    # ------------------------------------------------------------ déclencheurs
    async def on_state(self, dev_id: str, old: dict, new: dict):
        """Appelé à chaque rafraîchissement d'un appareil (ancien et nouvel état)."""
        if not old or not old.get("updated"):
            return  # premier relevé : pas de transition
        conn = self.hub.devices.get(dev_id)
        presence_change = None
        if conn and conn.kind == "presence" and bool(old.get("on")) != bool(new.get("on")):
            before = self.someone_home({**self.hub.state, dev_id: old})
            after = self.someone_home()
            if before and not after:
                presence_change = "all_away"
            elif not before and after:
                presence_change = "someone_home"
        for a in self.automations:
            if not a.get("enabled"):
                continue
            for trig in a.get("triggers", []):
                t = trig.get("type")
                hit = False
                if t == "state" and trig.get("device") == dev_id:
                    to = trig.get("to")
                    if to in ("on", "off"):
                        hit = new.get("online") and bool(old.get("on")) != bool(new.get("on")) and bool(new.get("on")) == (to == "on")
                    elif to in ("online", "offline"):
                        hit = bool(old.get("online")) != bool(new.get("online")) and bool(new.get("online")) == (to == "online")
                elif t == "alarm" and conn and conn.kind == "verisure":
                    hit = old.get("alarm_state") != new.get("alarm_state") and new.get("alarm_state") == trig.get("to")
                elif t == "presence" and presence_change:
                    hit = trig.get("to") == presence_change
                if hit:
                    self._launch(a, self._describe_trigger(trig))
                    break

    async def tick(self):
        now = datetime.now()
        minute_key = now.strftime("%Y-%m-%d %H:%M")
        for a in self.automations:
            if not a.get("enabled"):
                continue
            for i, trig in enumerate(a.get("triggers", [])):
                key = f"{a['id']}#{i}"
                t = trig.get("type")
                if t == "time":
                    h, m = _hm(trig.get("at"))
                    days = trig.get("days") or list(range(7))
                    if now.hour == h and now.minute == m and now.weekday() in days and self._fired.get(key) != minute_key:
                        self._fired[key] = minute_key
                        self._launch(a, self._describe_trigger(trig))
                elif t == "sun":
                    at = self._sun_dt(trig.get("event", "sunset"), trig.get("offset", 0))
                    if at and at.strftime("%Y-%m-%d %H:%M") == minute_key and self._fired.get(key) != minute_key:
                        self._fired[key] = minute_key
                        self._launch(a, self._describe_trigger(trig))
                elif t == "tariff":
                    from .tariff import is_hc
                    hc_now, hc_before = is_hc(self.hub.tariff, now), is_hc(self.hub.tariff, now - timedelta(minutes=1))
                    if hc_now != hc_before and (trig.get("to") == "hc") == hc_now and self._fired.get(key) != minute_key:
                        self._fired[key] = minute_key
                        self._launch(a, self._describe_trigger(trig))
                elif t == "power":
                    st = self.hub.state.get(trig.get("device"), {})
                    w = st.get("power_w")
                    limit = float(trig.get("watts") or 0)
                    cond = w is not None and st.get("online") and (w > limit if trig.get("op", "above") == "above" else w < limit)
                    if not cond:
                        self._since.pop(key, None)
                        self._fired.pop(key, None)
                        continue
                    since = self._since.setdefault(key, time.time())
                    if time.time() - since >= float(trig.get("for_min") or 0) * 60 and self._fired.get(key) != "done":
                        self._fired[key] = "done"
                        self._launch(a, self._describe_trigger(trig))

    async def loop(self):
        while True:
            try:
                await self.tick()
            except Exception:
                log.exception("Automatisations")
            await asyncio.sleep(20 - datetime.now().second % 20 + 0.5)

    # ------------------------------------------------------------ exécution
    def _launch(self, a: dict, reason: str, force: bool = False):
        if a["id"] in self._running:
            return
        if not force and not self.conditions_ok(a):
            return
        asyncio.create_task(self.run_automation(a, reason))

    async def run_automation(self, a: dict, reason: str = "manuel"):
        self._running.add(a["id"])
        self.last_run[a["id"]] = int(time.time())
        self.hub.logbook.add("automation", f"« {a['name']} » déclenchée ({reason})", a["id"], "Automatisation")
        try:
            await self.run_actions(a.get("actions", []), a["name"])
        finally:
            self._running.discard(a["id"])

    async def run_scene(self, scene_id: str, source: str = "Interface"):
        scene = next((s for s in self.scenes if s["id"] == scene_id), None)
        if not scene:
            raise ValueError("Scène inconnue")
        self.hub.logbook.add("scene", f"Scène « {scene['name']} » activée", scene_id, source)
        await self.run_actions(scene.get("actions", []), f"Scène {scene['name']}")

    async def run_actions(self, actions: list, source: str, depth: int = 0):
        for act in actions:
            t = act.get("type")
            try:
                if t == "delay":
                    await asyncio.sleep(min(float(act.get("seconds") or 0), 6 * 3600))
                elif t == "device":
                    await self.hub.execute(act.get("device"), act.get("action"), act.get("params") or {}, source)
                elif t == "scene" and depth < 3:
                    scene = next((s for s in self.scenes if s["id"] == act.get("scene")), None)
                    if scene:
                        self.hub.logbook.add("scene", f"Scène « {scene['name']} » activée", scene["id"], source)
                        await self.run_actions(scene.get("actions", []), source, depth + 1)
                elif t == "notify":
                    await self.hub.notify(act.get("title") or "Maison", act.get("message") or "", source=source)
            except Exception as e:
                log.warning("Action %s (%s) : %s", t, source, e)
                self.hub.logbook.add("system", f"Échec de l'action {t} : {e}", act.get("device"), source)

    # ------------------------------------------------------------ texte lisible
    def _dev_name(self, dev_id):
        c = self.hub.devices.get(dev_id)
        return c.dev.get("name", dev_id) if c else dev_id

    def _describe_trigger(self, trig: dict) -> str:
        t = trig.get("type")
        if t == "time":
            return f"à {trig.get('at')}"
        if t == "sun":
            off = int(trig.get("offset") or 0)
            return ("coucher" if trig.get("event") == "sunset" else "lever") + " du soleil" + (f" {off:+d} min" if off else "")
        if t == "state":
            return f"{self._dev_name(trig.get('device'))} → {trig.get('to')}"
        if t == "power":
            return f"{self._dev_name(trig.get('device'))} {'>' if trig.get('op') == 'above' else '<'} {trig.get('watts')} W"
        if t == "alarm":
            return f"alarme {trig.get('to')}"
        if t == "presence":
            return "tout le monde est parti" if trig.get("to") == "all_away" else "quelqu'un est arrivé"
        if t == "tariff":
            return "début des heures creuses" if trig.get("to") == "hc" else "début des heures pleines"
        return t
