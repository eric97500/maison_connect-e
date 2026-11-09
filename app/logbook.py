"""Journal des événements (comme le « Journal » de Home Assistant) et centre de notifications."""
import sqlite3
import threading
import time

from .config import DATA_DIR

SCHEMA = """
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    kind TEXT NOT NULL,          -- state | action | automation | scene | notification | system
    entity TEXT,                 -- id de l'appareil / automatisation / scène
    message TEXT NOT NULL,
    source TEXT                  -- Interface, nom de l'automatisation...
);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
CREATE INDEX IF NOT EXISTS idx_events_entity ON events(entity, ts);
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts INTEGER NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    level TEXT NOT NULL DEFAULT 'info',
    read INTEGER NOT NULL DEFAULT 0
);
"""


class Logbook:
    def __init__(self, demo: bool = False):
        DATA_DIR.mkdir(exist_ok=True)
        self._lock = threading.Lock()
        self._db = sqlite3.connect(DATA_DIR / ("logbook_demo.db" if demo else "logbook.db"), check_same_thread=False)
        self._db.row_factory = sqlite3.Row
        self._db.executescript(SCHEMA)
        self._db.commit()

    def add(self, kind: str, message: str, entity: str | None = None, source: str | None = None):
        with self._lock:
            self._db.execute("INSERT INTO events(ts, kind, entity, message, source) VALUES (?,?,?,?,?)",
                             (int(time.time()), kind, entity, message, source))
            self._db.commit()

    def list(self, limit: int = 200, entity: str | None = None, kind: str | None = None, before: int | None = None):
        sql, args = "SELECT * FROM events WHERE 1=1", []
        if entity:
            sql += " AND entity=?"
            args.append(entity)
        if kind:
            sql += " AND kind=?"
            args.append(kind)
        if before:
            sql += " AND ts<?"
            args.append(before)
        sql += " ORDER BY ts DESC, id DESC LIMIT ?"
        args.append(min(limit, 1000))
        with self._lock:
            return [dict(r) for r in self._db.execute(sql, args).fetchall()]

    def notify(self, title: str, message: str = "", level: str = "info") -> int:
        with self._lock:
            cur = self._db.execute("INSERT INTO notifications(ts, title, message, level) VALUES (?,?,?,?)",
                                   (int(time.time()), title, message, level))
            self._db.commit()
            return cur.lastrowid

    def notifications(self, limit: int = 50):
        with self._lock:
            rows = self._db.execute("SELECT * FROM notifications ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
            unread = self._db.execute("SELECT COUNT(*) FROM notifications WHERE read=0").fetchone()[0]
        return {"unread": unread, "items": [dict(r) for r in rows]}

    def mark_read(self):
        with self._lock:
            self._db.execute("UPDATE notifications SET read=1 WHERE read=0")
            self._db.commit()

    def close(self):
        with self._lock:
            self._db.close()

    def purge(self, days: int = 365):
        limit = int(time.time()) - days * 86400
        with self._lock:
            self._db.execute("DELETE FROM events WHERE ts<?", (limit,))
            self._db.execute("DELETE FROM notifications WHERE ts<? AND read=1", (limit,))
            self._db.commit()
