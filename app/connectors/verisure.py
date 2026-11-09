"""Alarme Verisure (API cloud, bibliothèque vsure).

Lecture de l'état toutes les 5 minutes maximum (Verisure bloque les comptes trop sollicités).
L'armement se fait avec le code saisi dans l'interface : il n'est jamais enregistré.
"""
import asyncio

from ..config import DATA_DIR
from .base import Connector

COOKIE_FILE = DATA_DIR / "verisure.cookie"

ARM_LABELS = {
    "DISARMED": "Désarmée",
    "ARMED_HOME": "Armée (partiel)",
    "ARMED_AWAY": "Armée (totale)",
}


class VerisureConnector(Connector):
    kind = "verisure"
    icon = "🛡️"
    capabilities = ("alarm",)
    actions = ("arm_home", "arm_away", "disarm")
    min_interval = 300

    def __init__(self, dev, cfg):
        super().__init__(dev, cfg)
        self._session = None

    def _login(self):
        import verisure

        if self._session is None:
            c = self.creds("verisure")
            if not c.get("username") or not c.get("password"):
                raise ValueError("Identifiants Verisure absents du fichier .env")
            s =verisure.Session(c.get("username", ""), c.get("password", ""), cookie_file_name=str(COOKIE_FILE))
            # Le cookie "de confiance" (créé par verisure_mfa.py) évite la double authentification.
            installations = s.login_cookie() if COOKIE_FILE.exists() else s.login()
            inst = ((installations.get("data") or {}).get("account") or {}).get("installations") or []
            giid = self.dev.get("giid") or (inst[0]["giid"] if inst else None)
            if not giid:
                raise ValueError(
                    "Connexion Verisure réussie, mais aucune alarme n'est liée à ce compte. "
                    "Vérifie que l'e-mail saisi dans Réglages → Comptes est celui que tu utilises "
                    "dans l'appli My Verisure (le propriétaire ou un utilisateur avec accès à l'appli).")
            s.set_giid(giid)
            self._session = s
        return self._session

    def _status_sync(self):
        s = self._login()
        try:
            data = s.request(s.arm_state())
        except Exception:
            self._session = None
            raise
        state = data["data"]["installation"]["armState"]
        return state.get("statusType"), state.get("changedVia"), state.get("date")

    async def status(self):
        status_type, via, date = await asyncio.to_thread(self._status_sync)
        return {
            "online": True,
            "on": status_type != "DISARMED",
            "alarm_state": status_type,
            "summary": ARM_LABELS.get(status_type, status_type),
            "details": {"état": ARM_LABELS.get(status_type, status_type), "via": via, "depuis": date},
        }

    async def action(self, name, params):
        code = str(params.get("code", "")).strip()
        if not code:
            raise ValueError("Le code de l'alarme est requis")
        target = {"arm_home": "ARMED_HOME", "arm_away": "ARMED_AWAY", "disarm": "DISARMED"}.get(name)
        if not target:
            return await super().action(name, params)

        def run():
            s = self._login()
            if target == "DISARMED":
                return s.request(s.disarm(code))
            return s.request(s.arm_home(code) if target == "ARMED_HOME" else s.arm_away(code))

        await asyncio.to_thread(run)
        return {"ok": True}
