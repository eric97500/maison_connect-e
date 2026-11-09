"""Réglages modifiables depuis l'interface (data/settings.json)."""
import logging

import httpx

from .config import load_json, save_json

log = logging.getLogger("maison")

DEFAULTS = {
    "city": "",
    "latitude": None,
    "longitude": None,
    "ntfy_server": "https://ntfy.sh",
    "ntfy_topic": "",
    "telegram_token": "",
    "telegram_chat_id": "",
    "notify_offline": False,     # prévenir quand un appareil se déconnecte
    "tado_poll_seconds": 900,    # tado limite le nombre d'appels à son API par jour
    "network_scanned": False,    # étape de l'assistant de mise en service
    "tariff": None,              # tarif électrique (Base ou HP/HC), voir app/tariff.py
}
SECRET_KEYS = ("telegram_token",)
MASK = "••••••••"


class Settings:
    def __init__(self):
        self.data = {**DEFAULTS, **load_json("settings.json", {})}

    def get(self, key):
        return self.data.get(key)

    def public(self) -> dict:
        out = dict(self.data)
        for k in SECRET_KEYS:
            if out.get(k):
                out[k] = MASK
        return out

    def update(self, changes: dict):
        for k, v in changes.items():
            if k not in DEFAULTS or (k in SECRET_KEYS and v == MASK):
                continue
            if k == "tado_poll_seconds":
                v = int(v)
            if k in ("latitude", "longitude"):
                v = float(v) if v not in (None, "") else None
            self.data[k] = v
        save_json("settings.json", self.data)

    @property
    def location(self):
        lat, lon = self.data.get("latitude"), self.data.get("longitude")
        return (lat, lon) if lat is not None and lon is not None else None

    async def push(self, title: str, message: str) -> list[str]:
        """Envoie la notification sur le téléphone (ntfy et/ou Telegram). Renvoie les canaux utilisés."""
        sent = []
        async with httpx.AsyncClient(timeout=10) as c:
            if topic := self.data.get("ntfy_topic"):
                try:
                    server = (self.data.get("ntfy_server") or "https://ntfy.sh").rstrip("/")
                    r = await c.post(server, json={"topic": topic, "title": title, "message": message or title,
                                                   "tags": ["house"]})
                    r.raise_for_status()
                    sent.append("ntfy")
                except Exception as e:
                    log.warning("ntfy : %s", e)
            if (token := self.data.get("telegram_token")) and (chat := self.data.get("telegram_chat_id")):
                try:
                    r = await c.post(f"https://api.telegram.org/bot{token}/sendMessage",
                                     json={"chat_id": chat, "text": f"🏠 {title}\n{message}".strip()})
                    r.raise_for_status()
                    sent.append("telegram")
                except Exception as e:
                    log.warning("Telegram : %s", type(e).__name__)
        return sent
