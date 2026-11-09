"""Déploie Maison connectée sur un serveur Docker distant par SSH (code + configuration + données).

    .venv\\Scripts\\python deploy\\deploy_ssh.py 192.168.10.105              # tout (premier déploiement)
    .venv\\Scripts\\python deploy\\deploy_ssh.py 192.168.10.105 --code-only  # mise à jour : code seulement,
                                                                      # sans toucher aux données / .env / config.yaml du serveur

Utilise l'identifiant « Serveurs Linux » enregistré dans l'appli (.env : LINUX_USER / LINUX_PASSWORD).
Le compte doit pouvoir utiliser Docker (membre du groupe docker).
"""
import io
import os
import sqlite3
import sys
import tarfile
import tempfile
import time
from pathlib import Path

import paramiko

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from app.config import load_config  # noqa: E402

REMOTE_DIR = "maison-connectee"
FILES = ["run.py", "requirements.txt", "Dockerfile", "docker-compose.yml", "config.yaml", ".env", ".env.example", "README.md"]
DIRS = ["app", "web", "deploy"]
DATA_JSON = ["floors.json", "layout.json", "devices.json", "automations.json", "scenes.json", "settings.json",
             "runtime.json", "rack.json", "tado_token.json", "verisure.cookie"]
DATA_DB = ["archive.db", "logbook.db"]


def build_archive(code_only: bool = False) -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        def add(path: Path, arc: str):
            tar.add(str(path), arcname=arc, filter=lambda ti: None if "__pycache__" in ti.name else ti)
        for f in FILES:
            if code_only and f in (".env", "config.yaml"):
                continue
            if (ROOT / f).exists():
                add(ROOT / f, f)
        for d in DIRS:
            add(ROOT / d, d)
        return_now = code_only
        for f in ([] if return_now else DATA_JSON):
            if (ROOT / "data" / f).exists():
                add(ROOT / "data" / f, f"data/{f}")
        with tempfile.TemporaryDirectory() as tmp:
            for f in ([] if return_now else DATA_DB):
                src = ROOT / "data" / f
                if not src.exists():
                    continue
                dst = os.path.join(tmp, f)
                s, d = sqlite3.connect(src), sqlite3.connect(dst)
                try:
                    s.backup(d)
                finally:
                    d.close()
                    s.close()
                tar.add(dst, arcname=f"data/{f}")
    return buf.getvalue()


def run(cl, cmd, timeout=900):
    print(f"$ {cmd}")
    _, o, e = cl.exec_command(cmd, timeout=timeout)
    out = o.read().decode(errors="replace")
    err = e.read().decode(errors="replace")
    code = o.channel.recv_exit_status()
    if out.strip():
        print(out.strip()[-3000:])
    if err.strip():
        print(err.strip()[-3000:])
    if code != 0:
        raise SystemExit(f"Échec (code {code}) : {cmd}")
    return out


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    code_only = "--code-only" in sys.argv
    host = args[0] if args else "192.168.10.105"
    c = load_config()["credentials"]["linux"]
    archive = build_archive(code_only)
    print(f"Archive : {len(archive) / 1e6:.1f} Mo")
    cl = paramiko.SSHClient()
    cl.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    cl.connect(host, username=c["username"], password=c["password"], timeout=10, look_for_keys=False, allow_agent=False)
    try:
        run(cl, "docker info --format '{{.ServerVersion}}'")
        sftp = cl.open_sftp()
        sftp.putfo(io.BytesIO(archive), "maison-connectee.tar.gz")
        sftp.close()
        stamp = time.strftime("%Y%m%d-%H%M%S")
        run(cl, f"if [ -d {REMOTE_DIR} ]; then cp -a {REMOTE_DIR} {REMOTE_DIR}.avant-{stamp}; fi; mkdir -p {REMOTE_DIR} && "
                f"tar -xzf maison-connectee.tar.gz -C {REMOTE_DIR} && rm maison-connectee.tar.gz && chmod 600 {REMOTE_DIR}/.env")
        def wait_compose():
            t0 = time.time()
            while time.time() - t0 < 1800:
                _, o, _ = cl.exec_command("pgrep -f '[d]ocker compose up' >/dev/null && echo build || echo fini", timeout=20)
                if o.read().decode().strip() == "fini":
                    return
                time.sleep(10)

        wait_compose()  # une construction précédente encore en cours ?
        if code_only and "--build" not in sys.argv:
            # le code (app/, web/) est monté dans le conteneur : mise à jour = redémarrage (quelques secondes)
            run(cl, f"cd {REMOTE_DIR} && docker compose up -d 2>&1 | tail -3 && docker compose restart 2>&1 | tail -2")
        else:
            # construction détachée (survit à une coupure SSH), puis attente du redémarrage
            run(cl, f"cd {REMOTE_DIR} && nohup docker compose up -d --build > ../maison-build.log 2>&1 < /dev/null & echo lancé")
            time.sleep(5)
            wait_compose()
            run(cl, "tail -5 maison-build.log")
        time.sleep(10)
        run(cl, f"cd {REMOTE_DIR} && docker compose ps && curl -s -o /dev/null -w 'HTTP %{{http_code}}\\n' http://localhost:8123/api/health")
    finally:
        cl.close()
    print(f"\nMaison connectée tourne sur http://{host}:8123")


if __name__ == "__main__":
    main()
