"""Exploitation : mode démo/réel, sauvegardes, démarrage automatique, journaux techniques."""
import io
import logging
import logging.handlers
import os
import platform
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import time
import zipfile
from datetime import datetime

from .config import DATA_DIR, ROOT, load_json, save_json

VERSION = "1.0.0"
STARTED = time.time()
LOG_DIR = DATA_DIR / "logs"
LOG_FILE = LOG_DIR / "maison.log"
BACKUP_DIR = DATA_DIR / "backups"
TASK_NAME = "MaisonConnectee"
KEEP_BACKUPS = 7

# Fichiers sauvegardés (le .env, qui contient les mots de passe, n'est volontairement pas inclus)
BACKUP_JSON = ("automations.json", "scenes.json", "settings.json", "layout.json", "floors.json",
               "devices.json", "runtime.json", "tado_token.json", "rack.json")
BACKUP_DB = ("archive.db", "logbook.db")


def setup_logging():
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    root = logging.getLogger()
    if any(isinstance(h, logging.handlers.RotatingFileHandler) for h in root.handlers):
        return
    fh = logging.handlers.RotatingFileHandler(LOG_FILE, maxBytes=1_000_000, backupCount=5, encoding="utf-8")
    fh.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s", "%Y-%m-%d %H:%M:%S"))
    fh.setLevel(logging.INFO)
    root.addHandler(fh)
    if root.level > logging.INFO or root.level == logging.NOTSET:
        root.setLevel(logging.INFO)


def tail_log(lines: int = 200) -> list[str]:
    if not LOG_FILE.exists():
        return []
    with open(LOG_FILE, encoding="utf-8", errors="replace") as f:
        return f.readlines()[-lines:]


# ------------------------------------------------------------------ mode démo / réel
def set_demo(demo: bool):
    rt = load_json("runtime.json", {})
    rt["demo"] = bool(demo)
    save_json("runtime.json", rt)


# ------------------------------------------------------------------ sauvegardes
def make_backup(to_disk: bool = True) -> tuple[str, bytes]:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("VERSION", VERSION)
        if (ROOT / "config.yaml").exists():
            z.write(ROOT / "config.yaml", "config.yaml")
        for name in BACKUP_JSON:
            if (DATA_DIR / name).exists():
                z.write(DATA_DIR / name, f"data/{name}")
        for name in BACKUP_DB:
            src = DATA_DIR / name
            if not src.exists():
                continue
            # copie cohérente même si la base est en cours d'écriture
            with tempfile.TemporaryDirectory() as tmp:
                dst = os.path.join(tmp, name)
                s, d = sqlite3.connect(src), sqlite3.connect(dst)
                try:
                    s.backup(d)
                finally:  # fermer explicitement : sous Windows un fichier ouvert ne peut pas être supprimé
                    d.close()
                    s.close()
                z.write(dst, f"data/{name}")
    name = f"maison_{datetime.now():%Y-%m-%d_%H%M}.zip"
    data = buf.getvalue()
    if to_disk:
        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        (BACKUP_DIR / name).write_bytes(data)
        for old in sorted(BACKUP_DIR.glob("maison_*.zip"))[:-KEEP_BACKUPS]:
            old.unlink(missing_ok=True)
    return name, data


def list_backups() -> list[dict]:
    if not BACKUP_DIR.exists():
        return []
    return [{"name": p.name, "size": p.stat().st_size, "ts": int(p.stat().st_mtime)}
            for p in sorted(BACKUP_DIR.glob("maison_*.zip"), reverse=True)]


def restore_backup(data: bytes) -> list[str]:
    allowed = {"config.yaml"} | {f"data/{n}" for n in BACKUP_JSON + BACKUP_DB}
    restored = []
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        names = [n for n in z.namelist() if n in allowed]
        if not names:
            raise ValueError("Ce fichier n'est pas une sauvegarde Maison connectée")
        make_backup()  # filet de sécurité avant d'écraser
        for n in names:
            target = ROOT / n
            target.parent.mkdir(parents=True, exist_ok=True)
            tmp = target.with_suffix(target.suffix + ".restore")
            tmp.write_bytes(z.read(n))
            tmp.replace(target)
            restored.append(n)
    return restored


# ------------------------------------------------------------------ démarrage automatique (Windows)
def _pythonw() -> str:
    exe = sys.executable
    cand = os.path.join(os.path.dirname(exe), "pythonw.exe")
    return cand if os.path.exists(cand) else exe


def autostart_status() -> dict:
    if platform.system() != "Windows":
        return {"supported": False, "enabled": False,
                "hint": "Sous Linux / Proxmox, utilise deploy/install_linux.sh (service systemd)."}
    r = subprocess.run(["schtasks", "/Query", "/TN", TASK_NAME], capture_output=True, text=True)
    return {"supported": True, "enabled": r.returncode == 0}


def set_autostart(enabled: bool) -> dict:
    if platform.system() != "Windows":
        raise RuntimeError("Démarrage automatique géré par systemd sous Linux (voir README)")
    if enabled:
        cmd = f'"{_pythonw()}" "{ROOT / "run.py"}"'
        r = subprocess.run(["schtasks", "/Create", "/F", "/TN", TASK_NAME, "/SC", "ONLOGON", "/RL", "LIMITED", "/TR", cmd],
                           capture_output=True, text=True)
    else:
        r = subprocess.run(["schtasks", "/Delete", "/F", "/TN", TASK_NAME], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError((r.stderr or r.stdout or "schtasks a échoué").strip())
    return autostart_status()


def info(hub) -> dict:
    from .accounts import TADO

    return {
        "version": VERSION, "uptime": int(time.time() - STARTED), "demo": hub.cfg["demo"],
        "python": platform.python_version(), "os": f"{platform.system()} {platform.release()}",
        "ffmpeg": bool(shutil.which("ffmpeg")), "password": bool(os.environ.get("DASHBOARD_PASSWORD")),
        "autostart": autostart_status(), "backups": list_backups(),
        "devices": len(hub.devices), "online": sum(1 for s in hub.state.values() if s.get("online")),
        "tado": TADO.connected,
        "lan_url": _lan_url(hub),
    }


def _lan_url(hub) -> str | None:
    from .scan import local_ip
    try:
        return f"http://{local_ip()}:{hub.cfg['server']['port']}"
    except OSError:
        return None
