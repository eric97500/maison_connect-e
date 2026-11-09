"""Électroménager hOn (Candy, Haier, Hoover) : lave-linge, sèche-linge… via le cloud hOn (bibliothèque pyhOn).

Les machines Candy récentes n'ont pas d'API locale : tout passe par le compte de l'appli « hOn ».
Le démarrage à distance n'est accepté que si la commande à distance est activée sur la machine.
"""
import asyncio
import logging
import os
import time

from .base import Connector

log = logging.getLogger("maison")

MACH_MODE = {0: "Prête", 1: "Prête", 2: "En marche", 3: "En pause", 4: "Départ différé", 5: "Départ différé", 6: "Erreur", 7: "Terminé"}
PHASE = {0: "Prête", 1: "Lavage", 2: "Lavage", 3: "Essorage", 4: "Rinçage", 5: "Rinçage", 6: "Rinçage", 7: "Séchage",
         9: "Vapeur", 10: "Prête", 11: "Essorage", 12: "Pesée", 13: "Pesée", 14: "Lavage", 15: "Lavage", 16: "Lavage",
         17: "Rinçage", 18: "Rinçage", 19: "Départ différé", 20: "Défroissage", 24: "Rafraîchir", 25: "Lavage", 26: "Chauffe", 27: "Lavage"}


PROGRAM_FR = {
    "cottons": "Coton", "cottons_eu": "Coton Éco", "eco_40_60": "Éco 40-60", "synthetic": "Synthétique", "synthetics": "Synthétique",
    "mix": "Mixte", "mixed": "Mixte", "mixed_fabrics": "Tissus mélangés", "wool": "Laine", "delicates": "Délicat", "delicate": "Délicat",
    "rapid": "Rapide", "rapid_14": "Rapide 14 min", "rapid_30": "Rapide 30 min", "rapid_44": "Rapide 44 min", "quick_14": "Rapide 14 min",
    "baby_care": "Bébé", "babycare": "Bébé", "sport": "Sport", "jeans": "Jeans", "shirts": "Chemises", "shirt": "Chemises",
    "rinse": "Rinçage", "rinse_spin": "Rinçage + essorage", "spin": "Essorage", "drain": "Vidange", "drain_spin": "Vidange + essorage",
    "allergy_care_pro": "Anti-allergie", "anti_pollution": "Anti-pollution", "autocare": "Auto care", "autoclean": "Nettoyage du tambour",
    "auto_clean": "Nettoyage du tambour", "active_wash": "Lavage actif", "all_in_one_49": "Tout-en-un 49 min", "all_in_one_59": "Tout-en-un 59 min",
    "20_degrees_new_energy_label": "20 °C", "hygiene": "Hygiène", "hygiene_plus": "Hygiène+", "steam": "Vapeur", "refresh": "Rafraîchir",
    "duvet": "Couette", "bedding": "Literie", "towels": "Serviettes", "colors": "Couleurs", "dark": "Foncé", "whites": "Blanc",
    "perfect_rapid_59": "Rapide parfait 59 min", "smart_care": "Smart care", "my_program": "Mon programme",
}


def program_label(key) -> str:
    k = str(key or "").split(".")[-1].lower()
    if k in PROGRAM_FR:
        return PROGRAM_FR[k]
    if not k.isascii() or " " in str(key):  # déjà un libellé lisible fourni par hOn
        return str(key)
    return k.replace("_", " ").capitalize()


class HonAccount:
    """Session hOn partagée par toutes les machines du compte."""

    def __init__(self):
        self.hon = None
        self._key = None
        self._lock = asyncio.Lock()

    @staticmethod
    def creds():
        return os.environ.get("HON_EMAIL", ""), os.environ.get("HON_PASSWORD", "")

    async def get(self):
        from pyhon import Hon

        email, password = self.creds()
        if not email or not password:
            raise PermissionError("Compte hOn non configuré (Paramètres → Comptes connectés)")
        async with self._lock:
            if self.hon is None or self._key != (email, password):
                await self.close()
                try:
                    self.hon = await Hon(email, password).create()
                except Exception as e:
                    raise PermissionError(f"Connexion hOn refusée : {e}") from e
                self._key = (email, password)
            return self.hon

    async def appliances(self) -> list[dict]:
        hon = await self.get()
        return [{"mac": a.mac_address, "name": a.nick_name or a.model_name, "model": a.model_name,
                 "type": a.appliance_type, "brand": getattr(a, "brand", "")} for a in hon.appliances]

    async def close(self):
        if self.hon is not None:
            try:
                await self.hon.close()
            except Exception:
                pass
            self.hon = None


HON = HonAccount()


def norm_mac(mac) -> str:
    """20:43:A8:98:29:10 / 20-43-a8-98-29-10 / 2043a8982910 → même valeur."""
    return "".join(c for c in str(mac or "").lower() if c in "0123456789abcdef")


def _val(attrs: dict, key: str):
    v = attrs.get(key)
    v = getattr(v, "value", v)
    try:
        return int(float(v)) if v not in (None, "") and str(v).replace(".", "", 1).lstrip("-").isdigit() else v
    except (TypeError, ValueError):
        return v


def _num(attrs: dict, key: str) -> float | None:
    v = getattr(attrs.get(key), "value", attrs.get(key))
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


STANDBY_W = 0.5      # machine branchée, à l'arrêt
POWER_WINDOW = 600   # la puissance est la moyenne sur les 10 dernières minutes (le compteur hOn est au 1/100 kWh)


class HonApplianceConnector(Connector):
    kind = "hon"
    icon = "🫧"
    capabilities = ("appliance", "power")
    actions = ("start", "pause", "resume", "stop")
    min_interval = 60

    def __init__(self, dev, cfg):
        super().__init__(dev, cfg)
        self._samples: list[tuple[float, float]] = []  # (horodatage, compteur kWh) pendant un cycle

    def _energy(self, total: float | None, running: bool) -> tuple[float, float | None]:
        """Puissance estimée (W) à partir de l'évolution du compteur, et consommation du jour (kWh)."""
        from ..config import load_json, save_json

        now = time.time()
        if total is None:
            return (STANDBY_W, None)
        if running:
            self._samples = [s for s in self._samples if now - s[0] <= POWER_WINDOW] + [(now, total)]
        else:
            self._samples = []
        watts = STANDBY_W
        if running and len(self._samples) >= 2:
            (t0, e0), (t1, e1) = self._samples[0], self._samples[-1]
            if t1 - t0 >= 120:
                watts = max(STANDBY_W, round((e1 - e0) * 3_600_000 / (t1 - t0)))
        day = time.strftime("%Y-%m-%d")
        base = load_json("hon_energy.json", {})
        b = base.get(self.id)
        if not b or b.get("day") != day or total < b.get("start", 0):
            b = base[self.id] = {"day": day, "start": total}
            save_json("hon_energy.json", base)
        return (watts, round(total - b["start"], 3))

    async def _appliance(self):
        hon = await HON.get()
        mac = norm_mac(self.dev.get("mac"))
        for a in hon.appliances:
            if not mac or norm_mac(a.mac_address) == mac:
                return a
        raise ConnectionError("Machine introuvable sur le compte hOn (vérifie l'adresse MAC)")

    async def status(self):
        a = await self._appliance()
        await a.update()
        attrs = (a.attributes or {}).get("parameters", {})
        mode = _val(attrs, "machMode")
        phase = _val(attrs, "prPhase")
        remaining = _val(attrs, "remainingTimeMM")
        running = mode in (2, 3, 4, 5)
        program = None
        try:
            program = a.commands["startProgram"].category
        except Exception:
            pass
        programs = []
        try:
            programs = sorted(a.commands["startProgram"].categories.keys())
        except Exception:
            pass
        remote_ok = _val(attrs, "remoteCtrValid") in (1, "1", True)
        online = (a.attributes or {}).get("lastConnEvent", {}).get("category", "CONNECTED") != "DISCONNECTED"
        state = MACH_MODE.get(mode, "Inconnu" if mode is None else str(mode))
        summary = state
        if running:
            summary = f"{PHASE.get(phase, state)}" + (f" · reste {remaining} min" if isinstance(remaining, int) and remaining > 0 else "")
        total = _num(attrs, "totalElectricityUsed")
        watts, today = await asyncio.to_thread(self._energy, total, running)
        details = {"modèle": a.model_name, "programme": program_label(program) if program else None, "phase": PHASE.get(phase, phase) if running else None,
                   "temps restant": f"{remaining} min" if isinstance(remaining, int) and running else None,
                   "température": f"{_val(attrs, 'temp')} °C" if _val(attrs, "temp") not in (None, "", 0) else None,
                   "essorage": f"{_val(attrs, 'spinSpeed')} tr/min" if _val(attrs, "spinSpeed") not in (None, "", 0) else None,
                   "porte": {0: "ouverte", 1: "fermée", 2: "verrouillée"}.get(_val(attrs, "doorLockStatus")),
                   "commande à distance": "activée" if remote_ok else "désactivée (à activer sur la machine)",
                   "consommation du cycle": f"{_num(attrs, 'currentElectricityUsed'):g} kWh" if running and _num(attrs, "currentElectricityUsed") else None,
                   "eau du cycle": f"{_num(attrs, 'currentWaterUsed'):g} L" if running and _num(attrs, "currentWaterUsed") else None,
                   "consommation totale": f"{total:g} kWh" if total is not None else None}
        return {"online": online, "on": running, "summary": summary, "mode": state, "remaining_min": remaining if running else None,
                "program": program_label(program) if program else None, "program_key": program,
                "programs": sorted(({"key": p, "label": program_label(p)} for p in programs), key=lambda x: x["label"].lower()), "remote_ok": remote_ok, "details": details, "updated_at": int(time.time()),
                "power_w": watts, "power_estimated": True, "energy_today_kwh": today}

    async def action(self, name, params):
        a = await self._appliance()
        cmd_name = {"start": "startProgram", "pause": "pauseProgram", "resume": "resumeProgram", "stop": "stopProgram"}.get(name)
        if not cmd_name:
            return await super().action(name, params)
        if cmd_name not in a.commands:
            raise ValueError(f"Commande « {name} » non disponible sur cette machine")
        cmd = a.commands[cmd_name]
        if name == "start" and params.get("program"):
            if params["program"] not in cmd.categories:
                raise ValueError("Programme inconnu")
            cmd.category = params["program"]
            cmd = a.commands[cmd_name]
        ok = await cmd.send()
        if not ok:
            raise RuntimeError("La machine a refusé la commande (commande à distance désactivée ?)")
        return {"ok": True}
