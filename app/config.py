"""Chargement de config.yaml avec substitution des ${VARIABLES} du fichier .env."""
import json
import os
import re
from pathlib import Path

import yaml
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
WEB_DIR = ROOT / "web"

_ENV_RE = re.compile(r"\$\{([A-Z0-9_]+)\}")


def _expand(value):
    if isinstance(value, str):
        return _ENV_RE.sub(lambda m: os.environ.get(m.group(1), ""), value)
    if isinstance(value, dict):
        return {k: _expand(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_expand(v) for v in value]
    return value


def load_config() -> dict:
    load_dotenv(ROOT / ".env")
    with open(ROOT / "config.yaml", encoding="utf-8") as f:
        raw = yaml.safe_load(f) or {}
    # Les appareils modifiés depuis l'interface (Paramètres) priment sur config.yaml
    raw["devices"] = load_devices_raw(raw)
    # Réglages système choisis dans l'interface (ex. passage du mode démo au mode réel)
    runtime = load_json("runtime.json", {})
    if "demo" in runtime:
        raw["demo"] = runtime["demo"]
    cfg = _expand(raw)
    cfg.setdefault("demo", False)
    cfg.setdefault("server", {}).setdefault("port", 8123)
    cfg["server"].setdefault("host", "0.0.0.0")
    arch = cfg.setdefault("archive", {})
    arch.setdefault("interval_seconds", 60)
    arch.setdefault("raw_retention_days", 365)
    arch.setdefault("price_per_kwh", 0.25)
    cfg.setdefault("status_interval_seconds", 15)
    cfg.setdefault("credentials", {})
    cfg.setdefault("devices", [])
    ids = [d["id"] for d in cfg["devices"]]
    dupes = {i for i in ids if ids.count(i) > 1}
    if dupes:
        raise ValueError(f"Identifiants d'appareils en double dans config.yaml : {dupes}")
    return cfg


def load_devices_raw(raw_cfg: dict | None = None) -> list:
    """Liste des appareils SANS substitution des ${VARIABLES} (pour l'éditeur : les secrets restent dans .env)."""
    devices = load_json("devices.json", None)
    if devices is not None:
        return devices
    if raw_cfg is None:
        with open(ROOT / "config.yaml", encoding="utf-8") as f:
            raw_cfg = yaml.safe_load(f) or {}
    return raw_cfg.get("devices") or []


def expand(value):
    return _expand(value)


def load_json(name: str, default):
    path = DATA_DIR / name
    if not path.exists():
        return default
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_json(name: str, data) -> None:
    DATA_DIR.mkdir(exist_ok=True)
    tmp = DATA_DIR / (name + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    tmp.replace(DATA_DIR / name)
