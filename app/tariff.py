"""Tarif électrique : Base ou Heures pleines / Heures creuses (plages horaires configurables)."""
from datetime import datetime, timedelta

DEFAULT = {"mode": "base", "price_base": None, "price_hp": None, "price_hc": None, "hc_ranges": [["22:00", "06:00"]]}


def _minutes(hm: str) -> int:
    h, m = str(hm).split(":")[:2]
    return int(h) * 60 + int(m)


def normalize(t: dict | None, base_price: float) -> dict:
    t = {**DEFAULT, **(t or {})}
    if t.get("price_base") in (None, ""):
        t["price_base"] = base_price
    ranges = []
    for r in t.get("hc_ranges") or []:
        try:
            a, b = _minutes(r[0]), _minutes(r[1])
            if a != b:
                ranges.append([f"{a // 60:02d}:{a % 60:02d}", f"{b // 60:02d}:{b % 60:02d}"])
        except Exception:
            continue
    t["hc_ranges"] = ranges
    t["mode"] = "hphc" if t.get("mode") == "hphc" and ranges else "base"
    for k in ("price_base", "price_hp", "price_hc"):
        t[k] = float(t[k]) if t.get(k) not in (None, "") else None
    if t["mode"] == "hphc":
        t["price_hp"] = t["price_hp"] if t["price_hp"] is not None else t["price_base"]
        t["price_hc"] = t["price_hc"] if t["price_hc"] is not None else t["price_base"]
    return t


def is_hc(t: dict, when: datetime) -> bool:
    if t.get("mode") != "hphc":
        return False
    cur = when.hour * 60 + when.minute
    for a, b in t["hc_ranges"]:
        a, b = _minutes(a), _minutes(b)
        if (a < b and a <= cur < b) or (a > b and (cur >= a or cur < b)):
            return True
    return False


def next_change(t: dict, when: datetime) -> datetime | None:
    """Prochaine bascule HP ↔ HC (à la minute près, dans les 24 h)."""
    if t.get("mode") != "hphc":
        return None
    now_hc = is_hc(t, when)
    probe = when.replace(second=0, microsecond=0)
    for _ in range(24 * 60 + 1):
        probe += timedelta(minutes=1)
        if is_hc(t, probe) != now_hc:
            return probe
    return None


def status(t: dict, when: datetime | None = None) -> dict:
    when = when or datetime.now()
    hc = is_hc(t, when)
    nxt = next_change(t, when)
    price = (t["price_hc"] if hc else t["price_hp"]) if t["mode"] == "hphc" else t["price_base"]
    return {"mode": t["mode"], "hc": hc, "price": price, "until": nxt.strftime("%H:%M") if nxt else None}
