"""Lanceur surveillé : démarre Maison connectée et la relance automatiquement si elle s'arrête.

Utilisé par start.bat, par le démarrage automatique Windows et par le service Linux.
"""
import os
import socket
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)
LOG = ROOT / "data" / "logs" / "launcher.log"


def log(msg: str):
    LOG.parent.mkdir(parents=True, exist_ok=True)
    line = f"{time.strftime('%Y-%m-%d %H:%M:%S')} {msg}"
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")
    if sys.stdout:
        try:
            print(line, flush=True)
        except Exception:
            pass


def port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(1)
        return s.connect_ex(("127.0.0.1", port)) == 0


def port() -> int:
    try:
        import yaml
        with open(ROOT / "config.yaml", encoding="utf-8") as f:
            return int((yaml.safe_load(f) or {}).get("server", {}).get("port", 8123))
    except Exception:
        return 8123


def main():
    p = port()
    if port_in_use(p):
        log(f"Maison connectée tourne déjà sur le port {p} : rien à faire.")
        return
    delay = 2
    while True:
        started = time.time()
        log("Démarrage de Maison connectée")
        try:
            code = subprocess.call([sys.executable, "-m", "app.main"], cwd=ROOT)
        except KeyboardInterrupt:
            log("Arrêt demandé")
            return
        if code == 0:
            log("Arrêt normal")
            return
        # relance avec un délai croissant si l'application plante en boucle
        delay = 2 if time.time() - started > 300 else min(delay * 2, 120)
        log(f"Arrêt inattendu (code {code}) : relance dans {delay} s")
        try:
            time.sleep(delay)
        except KeyboardInterrupt:
            return


if __name__ == "__main__":
    main()
