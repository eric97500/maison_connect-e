"""Heures de lever / coucher du soleil (algorithme NOAA simplifié, précision ~1-2 min)."""
import math
from datetime import date, datetime, timedelta, timezone


def _calc(lat: float, lon: float, d: date, rising: bool) -> datetime | None:
    rad, deg = math.radians, math.degrees
    n = d.timetuple().tm_yday
    lng_hour = lon / 15
    t = n + ((6 if rising else 18) - lng_hour) / 24
    m = 0.9856 * t - 3.289
    lng = (m + 1.916 * math.sin(rad(m)) + 0.020 * math.sin(rad(2 * m)) + 282.634) % 360
    ra = deg(math.atan(0.91764 * math.tan(rad(lng)))) % 360
    ra = (ra + (math.floor(lng / 90) * 90 - math.floor(ra / 90) * 90)) / 15
    sin_dec = 0.39782 * math.sin(rad(lng))
    cos_dec = math.cos(math.asin(sin_dec))
    cos_h = (math.cos(rad(90.833)) - sin_dec * math.sin(rad(lat))) / (cos_dec * math.cos(rad(lat)))
    if not -1 <= cos_h <= 1:
        return None  # jour ou nuit polaire
    h = (360 - deg(math.acos(cos_h)) if rising else deg(math.acos(cos_h))) / 15
    ut = (h + ra - 0.06571 * t - 6.622 - lng_hour) % 24
    utc = datetime(d.year, d.month, d.day, tzinfo=timezone.utc) + timedelta(hours=ut)
    return utc.astimezone().replace(tzinfo=None)


def sun_times(lat: float, lon: float, d: date | None = None) -> dict:
    d = d or date.today()
    rise, sset = _calc(lat, lon, d, True), _calc(lat, lon, d, False)
    return {"sunrise": rise, "sunset": sset}


def is_day(lat: float, lon: float, now: datetime | None = None) -> bool:
    now = now or datetime.now()
    t = sun_times(lat, lon, now.date())
    if not t["sunrise"] or not t["sunset"]:
        return 4 <= now.month <= 9 if lat > 0 else not 4 <= now.month <= 9
    return t["sunrise"] <= now <= t["sunset"]
