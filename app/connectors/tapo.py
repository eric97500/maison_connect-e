"""Prises, ampoules et climatisation Tapo (en local, via python-kasa)."""
from .base import Connector


class TapoConnector(Connector):
    kind = "tapo_plug"
    icon = "🔌"
    capabilities = ("switch", "power")
    actions = ("on", "off", "toggle")

    def __init__(self, dev, cfg):
        super().__init__(dev, cfg)
        self._device = None

    async def _get(self):
        from kasa import Credentials, Discover

        if self._device is None:
            c = self.creds("tapo")
            try:
                self._device = await Discover.discover_single(
                    self.host, credentials=Credentials(c.get("username", ""), c.get("password", ""))
                )
            except Exception as e:
                if "TPAP" in str(e):
                    raise ConnectionError(
                        "Firmware Tapo récent (chiffrement « TPAP ») pas encore géré. Dans l'appli Tapo : "
                        "Moi → Services tiers → désactive puis réactive « Compatibilité tiers », "
                        "puis clique sur Actualiser.") from e
                raise
        try:
            await self._device.update()
        except Exception:
            await self.close()
            raise
        return self._device

    async def status(self) -> dict:
        from kasa import Module

        d = await self._get()
        st = {"online": True, "on": bool(d.is_on), "details": {"modèle": d.model, "alias": d.alias}}
        if Module.Energy in d.modules:
            e = d.modules[Module.Energy]
            st["power_w"] = float(e.current_consumption or 0)
            st["energy_today_kwh"] = float(e.consumption_today or 0)
            st["summary"] = f"{st['power_w']:.0f} W"
        else:
            st["summary"] = "Allumé" if d.is_on else "Éteint"
        return st

    async def action(self, name, params):
        d = await self._get()
        if name == "on" or (name == "toggle" and not d.is_on):
            await d.turn_on()
        elif name in ("off", "toggle"):
            await d.turn_off()
        else:
            return await super().action(name, params)
        return {"ok": True}

    async def close(self):
        if self._device is not None:
            try:
                await self._device.disconnect()
            except Exception:
                pass
            self._device = None


class TapoClimConnector(TapoConnector):
    """Climatisation pilotée par une prise Tapo à mesure (P110/P115)."""

    kind = "tapo_clim"
    icon = "❄️"


# Puissance nominale des ampoules Tapo (W, fiches techniques) — modifiable par appareil avec « watts »
BULB_WATTS = {"L510": 8.7, "L520": 8.0, "L530": 8.7, "L535": 8.7, "L610": 3.5, "L630": 3.7, "L900": 13.5, "L920": 24.0, "L930": 24.0}
STANDBY_W = 0.2  # consommation d'une ampoule connectée éteinte (Wi-Fi)


def estimate_bulb_watts(nominal: float, on: bool, brightness: int | None) -> float:
    """Une LED atténuée consomme moins, mais pas proportionnellement : ~10 % de base + le reste selon la luminosité."""
    if not on:
        return STANDBY_W
    b = max(1, min(100, brightness if brightness is not None else 100))
    return round(nominal * (0.1 + 0.9 * b / 100), 1)


class TapoBulbConnector(TapoConnector):
    kind = "tapo_bulb"
    icon = "💡"
    capabilities = ("switch", "light", "power")
    actions = ("on", "off", "toggle", "brightness", "color_temp")
    USAGE_EVERY = 300  # la consommation du jour calculée par Tapo est relue toutes les 5 min

    def __init__(self, dev, cfg):
        super().__init__(dev, cfg)
        self._usage = (0.0, None)

    async def _today_kwh(self, d) -> float | None:
        import time

        ts, val = self._usage
        if time.time() - ts > self.USAGE_EVERY:
            try:
                r = await d.protocol.query("get_device_usage")
                wh = r["get_device_usage"]["power_usage"]["today"]
                val = round(wh / 1000, 4)
            except Exception:
                val = None
            self._usage = (time.time(), val)
        return val

    async def status(self):
        from kasa import Module

        d = await self._get()
        st = {"online": True, "on": bool(d.is_on), "details": {"modèle": d.model}}
        if Module.Light in d.modules:
            light = d.modules[Module.Light]
            try:
                st["brightness"] = light.brightness
            except Exception:
                pass
            try:
                st["color_temp"] = light.color_temp
            except Exception:
                pass
        nominal = float(self.dev.get("watts") or BULB_WATTS.get(str(d.model)[:4], 9.0))
        st["power_w"] = estimate_bulb_watts(nominal, st["on"], st.get("brightness"))
        st["power_estimated"] = True
        st["energy_today_kwh"] = await self._today_kwh(d)
        st["details"]["puissance nominale"] = f"{nominal:g} W"
        st["summary"] = f"{st.get('brightness', 100)} % · ≈{st['power_w']:.0f} W" if d.is_on else "Éteinte"
        return st

    async def action(self, name, params):
        from kasa import Module

        if name in ("brightness", "color_temp"):
            d = await self._get()
            light = d.modules[Module.Light]
            if name == "brightness":
                await light.set_brightness(int(params["value"]))
            else:
                await light.set_color_temp(int(params["value"]))
            return {"ok": True}
        return await super().action(name, params)
