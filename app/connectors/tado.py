"""Pièces tado° : chauffage (vannes / thermostats), climatisation (Smart AC Control), eau chaude.

Le compte est connecté une fois pour toutes dans Paramètres → Comptes connectés.
"""
import time

from ..accounts import TADO
from .base import Connector

AC_MODES = {"COOL": "Froid", "HEAT": "Chaud", "DRY": "Déshumidification", "FAN": "Ventilation", "AUTO": "Auto"}


class TadoConnector(Connector):
    kind = "tado"
    icon = "🌡️"
    capabilities = ("switch", "climate")
    actions = ("on", "off", "toggle", "set_temperature", "set_mode", "resume_schedule")
    min_interval = 60

    def __init__(self, dev, cfg):
        super().__init__(dev, cfg)
        self.home_id = int(dev.get("home_id", 0))
        self.zone_id = int(dev.get("zone_id", 0))
        self._last = {}

    async def status(self):
        s = await TADO.zone_state(self.home_id, self.zone_id)
        self._last = s
        setting = s.get("setting") or {}
        ztype = setting.get("type", "HEATING")
        on = setting.get("power") == "ON"
        sensors = s.get("sensorDataPoints") or {}
        inside = (sensors.get("insideTemperature") or {}).get("celsius")
        humidity = (sensors.get("humidity") or {}).get("percentage")
        target = (setting.get("temperature") or {}).get("celsius")
        mode = setting.get("mode")
        heating = ((s.get("activityDataPoints") or {}).get("heatingPower") or {}).get("percentage")
        manual = bool(s.get("overlay"))
        online = (s.get("link") or {}).get("state", "ONLINE") == "ONLINE"
        if ztype == "HOT_WATER":
            summary = "Eau chaude " + ("en marche" if on else "arrêtée")
        elif not on:
            summary = "Éteint" + (f" · {inside:.1f} °C" if inside is not None else "")
        else:
            label = AC_MODES.get(mode, "") + " " if ztype == "AIR_CONDITIONING" and mode else ""
            summary = f"{label}{target:.1f} °C" if target is not None else label.strip() or "Allumé"
            if inside is not None:
                summary += f" · {inside:.1f} °C"
        details = {"pièce tado": self.dev.get("name"), "température": f"{inside:.1f} °C" if inside is not None else None,
                   "humidité": f"{humidity:.0f} %" if humidity is not None else None,
                   "consigne": f"{target:.1f} °C" if target is not None and on else None,
                   "mode": "Manuel" if manual else "Planning", "chauffe": f"{heating:.0f} %" if heating is not None else None,
                   "relevé tado": time.strftime("%H:%M", time.localtime(TADO.last_update(self.home_id))) if TADO.last_update(self.home_id) else None,
                   "appels tado restants": f"{TADO.quota['remaining']} / {TADO.quota.get('limit') or '?'}" if TADO.quota.get("remaining") is not None else None}
        return {"online": online, "on": on, "summary": summary, "zone_type": ztype,
                "current_temp": inside, "target_temp": target, "humidity": humidity, "mode": mode,
                "manual": manual, "details": details}

    # ---------------------------------------------------------------- commandes
    async def _overlay(self, setting: dict):
        resp = await TADO.request("PUT", f"/homes/{self.home_id}/zones/{self.zone_id}/overlay",
                                  {"setting": setting, "termination": {"typeSkillBasedApp": "MANUAL"}})
        TADO.apply_overlay(self.home_id, self.zone_id, resp)

    async def _setting(self, power="ON", temperature=None, mode=None) -> dict:
        cur = dict((self._last or {}).get("setting") or {})
        ztype = cur.get("type") or self.dev.get("zone_type", "HEATING")
        if power == "OFF":
            return {"type": ztype, "power": "OFF"}
        if ztype == "HEATING":
            t = temperature or (cur.get("temperature") or {}).get("celsius") or 20
            return {"type": "HEATING", "power": "ON", "temperature": {"celsius": round(float(t), 1)}}
        if ztype == "HOT_WATER":
            return {"type": "HOT_WATER", "power": "ON"}
        # Climatisation : on part des possibilités déclarées par le climatiseur
        caps = await TADO.capabilities(self.home_id, self.zone_id)
        initial = caps.get("initialStates") or {}
        mode = (mode or cur.get("mode") or initial.get("mode")
                or ("COOL" if "COOL" in caps else next((m for m in AC_MODES if m in caps), "COOL")))
        mcap = caps.get(mode, {})
        # Réglages mémorisés par tado pour ce mode (utilisés quand la clim est éteinte)
        remembered = (initial.get("modes") or {}).get(mode, {})
        base = cur if cur.get("mode") == mode else remembered
        st = {"type": "AIR_CONDITIONING", "power": "ON", "mode": mode}
        if "temperatures" in mcap:
            rng = mcap["temperatures"]["celsius"]
            t = temperature or (base.get("temperature") or {}).get("celsius") or (22 if mode == "COOL" else 21)
            st["temperature"] = {"celsius": max(rng["min"], min(rng["max"], round(float(t))))}
        for key in ("fanLevel", "fanSpeed", "verticalSwing", "horizontalSwing", "swing", "light"):
            if key in mcap:
                opts = mcap[key]
                keep = base.get(key)
                st[key] = keep if keep in opts else ("AUTO" if "AUTO" in opts else "OFF" if "OFF" in opts else opts[0])
        return st

    async def diagnose(self) -> dict:
        """Lecture seule : état actuel, possibilités du climatiseur et commande qui serait envoyée."""
        TADO.invalidate(self.home_id)
        st = await TADO.zone_state(self.home_id, self.zone_id)
        self._last = st
        out = {"setting": st.get("setting"), "overlay": st.get("overlay"), "link": st.get("link")}
        if (st.get("setting") or {}).get("type", self.dev.get("zone_type")) == "AIR_CONDITIONING":
            out["capabilities"] = await TADO.capabilities(self.home_id, self.zone_id)
        cur = (st.get("setting") or {}).get("temperature") or {}
        out["would_send_set_temperature"] = await self._setting("ON", temperature=(cur.get("celsius") or 22) + 1)
        return out

    async def action(self, name, params):
        if name == "toggle":
            name = "off" if (self._last.get("setting") or {}).get("power") == "ON" else "on"
        if name == "on":
            await self._overlay(await self._setting("ON"))
        elif name == "off":
            await self._overlay(await self._setting("OFF"))
        elif name == "set_temperature":
            await self._overlay(await self._setting("ON", temperature=float(params["value"])))
        elif name == "set_mode":
            await self._overlay(await self._setting("ON", mode=str(params["value"])))
        elif name == "resume_schedule":
            await TADO.request("DELETE", f"/homes/{self.home_id}/zones/{self.zone_id}/overlay")
            TADO.invalidate(self.home_id)
        else:
            return await super().action(name, params)
        return {"ok": True}
