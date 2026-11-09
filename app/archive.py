"""Archive SQLite de la puissance consommée par les prises.

- table `readings` : une mesure par prise toutes les N secondes (purgée après raw_retention_days)
- table `daily`    : total kWh / moyenne / pic par jour et par prise (conservé pour toujours)
"""
import sqlite3
import threading
import time
from datetime import datetime, timedelta

from .config import DATA_DIR

SCHEMA = """
CREATE TABLE IF NOT EXISTS readings (
    ts INTEGER NOT NULL,
    device_id TEXT NOT NULL,
    watts REAL,
    energy_today_kwh REAL
);
CREATE INDEX IF NOT EXISTS idx_readings_dev_ts ON readings(device_id, ts);
CREATE TABLE IF NOT EXISTS server_metrics (
    ts INTEGER NOT NULL,
    device_id TEXT NOT NULL,
    cpu REAL, mem REAL, temp REAL, rx REAL, tx REAL
);
CREATE INDEX IF NOT EXISTS idx_server_dev_ts ON server_metrics(device_id, ts);
CREATE TABLE IF NOT EXISTS counters (
    day TEXT NOT NULL,
    device_id TEXT NOT NULL,
    value REAL NOT NULL,
    PRIMARY KEY (day, device_id)
);
CREATE TABLE IF NOT EXISTS daily (
    day TEXT NOT NULL,
    device_id TEXT NOT NULL,
    kwh REAL NOT NULL DEFAULT 0,
    avg_w REAL,
    max_w REAL,
    samples INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, device_id)
);
"""


class PowerArchive:
    def __init__(self, interval_seconds: int, retention_days: int, demo: bool = False):
        DATA_DIR.mkdir(exist_ok=True)
        # Base séparée en démo pour ne jamais mélanger données simulées et réelles.
        db_path = DATA_DIR / ("archive_demo.db" if demo else "archive.db")
        self.interval = interval_seconds
        self.retention_days = retention_days
        self._lock = threading.Lock()
        self._db = sqlite3.connect(db_path, check_same_thread=False)
        self._db.row_factory = sqlite3.Row
        self._db.executescript(SCHEMA)
        cols = {r[1] for r in self._db.execute("PRAGMA table_info(daily)")}
        for col in ("int_hp", "int_hc"):  # énergie intégrée (kWh) en heures pleines / creuses
            if col not in cols:
                self._db.execute(f"ALTER TABLE daily ADD COLUMN {col} REAL NOT NULL DEFAULT 0")
        self._db.commit()

    def record(self, device_id: str, watts: float | None, energy_today_kwh: float | None, ts: int | None = None,
               commit: bool = True, hc: bool = False):
        ts = ts or int(time.time())
        day = datetime.fromtimestamp(ts).strftime("%Y-%m-%d")
        with self._lock:
            self._db.execute(
                "INSERT INTO readings(ts, device_id, watts, energy_today_kwh) VALUES (?,?,?,?)",
                (ts, device_id, watts, energy_today_kwh),
            )
            row = self._db.execute(
                "SELECT kwh, avg_w, max_w, samples FROM daily WHERE day=? AND device_id=?", (day, device_id)
            ).fetchone()
            w = watts or 0.0
            part = w * self.interval / 3_600_000
            if row is None:
                kwh_int = w * self.interval / 3_600_000
                self._db.execute(
                    "INSERT INTO daily(day, device_id, kwh, avg_w, max_w, samples, int_hp, int_hc) VALUES (?,?,?,?,?,1,?,?)",
                    (day, device_id, energy_today_kwh if energy_today_kwh else kwh_int, w, w,
                     0 if hc else part, part if hc else 0),
                )
            else:
                n = row["samples"] + 1
                avg = (row["avg_w"] * row["samples"] + w) / n
                if energy_today_kwh:
                    # Le compteur de la prise est la source la plus fiable.
                    kwh = max(row["kwh"], energy_today_kwh)
                else:
                    kwh = row["kwh"] + w * self.interval / 3_600_000
                self._db.execute(
                    f"UPDATE daily SET kwh=?, avg_w=?, max_w=?, samples=?, {'int_hc' if hc else 'int_hp'}={'int_hc' if hc else 'int_hp'}+? "
                    "WHERE day=? AND device_id=?",
                    (kwh, avg, max(row["max_w"] or 0, w), n, part, day, device_id),
                )
            if commit:
                self._db.commit()

    def recompute_split(self, is_hc_fn):
        """Recalcule la répartition HP/HC de chaque jour à partir des mesures conservées (changement de tarif)."""
        with self._lock:
            rows = self._db.execute("SELECT device_id, ts, watts FROM readings ORDER BY device_id, ts").fetchall()
        acc: dict[tuple, list] = {}
        prev = None
        for r in rows:
            if prev is not None and prev["device_id"] == r["device_id"]:
                gap = min(r["ts"] - prev["ts"], 3 * self.interval)
            else:
                gap = self.interval
            when = datetime.fromtimestamp(r["ts"])
            key = (when.strftime("%Y-%m-%d"), r["device_id"])
            a = acc.setdefault(key, [0.0, 0.0])
            a[1 if is_hc_fn(when) else 0] += (r["watts"] or 0) * gap / 3_600_000
            prev = r
        with self._lock:
            for (day, dev), (hp, hc) in acc.items():
                self._db.execute("UPDATE daily SET int_hp=?, int_hc=? WHERE day=? AND device_id=?", (hp, hc, day, dev))
            self._db.commit()
        return len(acc)

    def commit(self):
        with self._lock:
            self._db.commit()

    def purge(self):
        limit = int(time.time()) - self.retention_days * 86400
        with self._lock:
            self._db.execute("DELETE FROM readings WHERE ts < ?", (limit,))
            self._db.execute("DELETE FROM server_metrics WHERE ts < ?", (limit,))
            self._db.commit()

    def history(self, device_id: str, start: int, end: int, buckets: int = 300) -> list[dict]:
        step = max(self.interval, (end - start) // buckets)
        with self._lock:
            rows = self._db.execute(
                """SELECT (ts / ?) * ? AS t, AVG(watts) AS w, MAX(watts) AS wmax
                   FROM readings WHERE device_id=? AND ts BETWEEN ? AND ?
                   GROUP BY t ORDER BY t""",
                (step, step, device_id, start, end),
            ).fetchall()
        return [{"t": r["t"], "w": round(r["w"] or 0, 1), "max": round(r["wmax"] or 0, 1)} for r in rows]

    def daily(self, device_ids: list[str] | None, days: int) -> list[dict]:
        since = (datetime.now() - timedelta(days=days - 1)).strftime("%Y-%m-%d")
        sql = "SELECT day, device_id, kwh, avg_w, max_w, int_hp, int_hc FROM daily WHERE day >= ?"
        args: list = [since]
        if device_ids:
            sql += f" AND device_id IN ({','.join('?' * len(device_ids))})"
            args += device_ids
        with self._lock:
            rows = self._db.execute(sql + " ORDER BY day", args).fetchall()
        out = []
        for r in rows:
            d = dict(r)
            tot = (d.pop("int_hp") or 0) + (d.pop("int_hc") or 0)
            share = (r["int_hc"] or 0) / tot if tot > 0 else 0.0
            d["kwh_hc"] = round(d["kwh"] * share, 5)
            d["kwh_hp"] = round(d["kwh"] - d["kwh_hc"], 5)
            out.append(d)
        return out

    def monthly(self, device_ids: list[str] | None) -> list[dict]:
        sql = "SELECT substr(day,1,7) AS month, device_id, SUM(kwh) AS kwh FROM daily"
        args: list = []
        if device_ids:
            sql += f" WHERE device_id IN ({','.join('?' * len(device_ids))})"
            args += device_ids
        with self._lock:
            rows = self._db.execute(sql + " GROUP BY month, device_id ORDER BY month", args).fetchall()
        return [dict(r) for r in rows]

    def export_rows(self, device_id: str | None, start: int, end: int):
        sql = "SELECT ts, device_id, watts, energy_today_kwh FROM readings WHERE ts BETWEEN ? AND ?"
        args: list = [start, end]
        if device_id:
            sql += " AND device_id=?"
            args.append(device_id)
        with self._lock:
            return self._db.execute(sql + " ORDER BY ts", args).fetchall()

    def record_server(self, device_id: str, m: dict, ts: int | None = None, commit: bool = True):
        mem = m.get("mem") or {}
        net = m.get("net") or {}
        with self._lock:
            self._db.execute("INSERT INTO server_metrics(ts, device_id, cpu, mem, temp, rx, tx) VALUES (?,?,?,?,?,?,?)", (
                ts or int(time.time()), device_id, m.get("cpu_pct"),
                round(100 * mem["used"] / mem["total"], 1) if mem.get("total") else None,
                m.get("cpu_temp"), net.get("rx_bps"), net.get("tx_bps")))
            if commit:
                self._db.commit()

    def server_history(self, device_id: str, start: int, end: int, buckets: int = 200) -> list[dict]:
        step = max(300, (end - start) // buckets)
        with self._lock:
            rows = self._db.execute(
                """SELECT (ts / ?) * ? AS t, AVG(cpu) AS cpu, AVG(mem) AS mem, AVG(temp) AS temp, AVG(rx) AS rx, AVG(tx) AS tx
                   FROM server_metrics WHERE device_id=? AND ts BETWEEN ? AND ? GROUP BY t ORDER BY t""",
                (step, step, device_id, start, end)).fetchall()
        return [{k: (round(r[k], 1) if r[k] is not None else None) for k in ("t", "cpu", "mem", "temp", "rx", "tx")} for r in rows]

    def record_counter(self, device_id: str, value: float):
        day = datetime.now().strftime("%Y-%m-%d")
        with self._lock:
            self._db.execute("INSERT INTO counters(day, device_id, value) VALUES (?,?,?) "
                             "ON CONFLICT(day, device_id) DO UPDATE SET value=MAX(value, excluded.value)", (day, device_id, value))
            self._db.commit()

    def counters(self, device_id: str, days: int = 30) -> list[dict]:
        since = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        with self._lock:
            rows = self._db.execute("SELECT day, value FROM counters WHERE device_id=? AND day>=? ORDER BY day",
                                    (device_id, since)).fetchall()
        return [dict(r) for r in rows]

    def close(self):
        with self._lock:
            self._db.close()

    def is_empty(self) -> bool:
        with self._lock:
            return self._db.execute("SELECT 1 FROM readings LIMIT 1").fetchone() is None
