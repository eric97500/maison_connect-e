"""Imprimantes Brother (laser ou jet d'encre) : état, compteurs de pages, toners / cartouches, consommables.

Lecture seule par SNMP (bibliothèque « brother », celle de l'intégration Home Assistant).
"""
import dataclasses

from .base import Connector, ping

TONERS = [("black", "Noir", "#1f2937"), ("cyan", "Cyan", "#06b6d4"), ("magenta", "Magenta", "#d946ef"), ("yellow", "Jaune", "#eab308")]
PARTS = [("drum", "Tambour"), ("belt_unit", "Courroie"), ("fuser", "Unité de fusion"), ("laser", "Unité laser"),
         ("pf_kit_1", "Kit papier bac 1"), ("pf_kit_mp", "Kit papier bac multifonction")]
LOW = 10  # % : alerte toner / cartouche bas


class BrotherConnector(Connector):
    kind = "brother"
    icon = "🖨️"
    capabilities = ("printer_office",)
    actions = ()
    min_interval = 60

    def __init__(self, dev, cfg):
        super().__init__(dev, cfg)
        self._b = None

    async def status(self):
        from brother import Brother

        if not await ping(self.host):
            return {"online": False, "on": False, "summary": "Éteinte ou hors réseau"}
        try:
            if self._b is None:
                self._b = await Brother.create(self.host, printer_type=self.dev.get("printer_type", "laser"))
            raw = await self._b.async_update()
        except Exception:
            await self.close()
            raise
        d = dataclasses.asdict(raw) if dataclasses.is_dataclass(raw) else dict(vars(raw))

        inks = []
        for key, label, color in TONERS:
            pct = d.get(f"{key}_toner_remaining", d.get(f"{key}_ink_remaining"))
            if pct is not None:
                inks.append({"key": key, "label": label, "color": color, "pct": pct,
                             "pages": d.get(f"{key}_counter")})
        parts = []
        for key, label in PARTS:
            life = d.get(f"{key}_remaining_life")
            if life is not None:
                parts.append({"label": label, "pct": life,
                              "pages_left": d.get(f"{key}_remaining_pages") or d.get(f"{key}_unit_remaining_pages")})
        low = [i["label"] for i in inks if i["pct"] is not None and i["pct"] <= LOW]
        low += [p["label"] for p in parts if p["pct"] is not None and p["pct"] <= LOW]
        status_txt = str(d.get("status") or "En ligne").capitalize()
        pages = d.get("page_counter")
        summary = status_txt + (f" · {pages} pages" if pages is not None else "")
        if low:
            summary = f"⚠ {', '.join(low)} bas · " + summary
        details = {"modèle": d.get("model") or self.dev.get("model"), "numéro de série": d.get("serial"),
                   "firmware": d.get("firmware"), "allumée depuis": str(d.get("uptime"))[:16] if d.get("uptime") else None,
                   "IP": self.host, "interface web": f"http://{self.host}"}
        return {"online": True, "on": str(d.get("status", "")).lower() not in ("veille", "sleep", "idle", "prêt", "ready"),
                "summary": summary, "printer_status": status_txt,
                "pages": {"total": pages, "bw": d.get("bw_counter"), "color": d.get("color_counter"),
                          "duplex": d.get("duplex_unit_pages_counter"), "images": d.get("image_counter")},
                "inks": inks, "parts": parts, "low_supplies": low, "counter": pages, "details": details}

    async def close(self):
        if self._b is not None:
            try:
                self._b.shutdown()
            except Exception:
                pass
            self._b = None
