"""Classe de base des connecteurs et petits utilitaires réseau."""
import asyncio
import platform
import socket


class Connector:
    """Un connecteur = un appareil de config.yaml.

    status() renvoie un dict :
      online (bool), on (bool|None), power_w, energy_today_kwh, summary (texte court), details (dict)
    action(name, params) exécute une commande et renvoie un dict.
    """

    kind = "generic"
    icon = "❔"
    capabilities: tuple[str, ...] = ()
    actions: tuple[str, ...] = ()
    min_interval = 0  # secondes minimum entre deux interrogations (API cloud limitées)

    def __init__(self, dev: dict, cfg: dict):
        self.dev = dev
        self.cfg = cfg
        self.id = dev["id"]
        self.host = dev.get("host")

    def creds(self, name: str) -> dict:
        return self.cfg.get("credentials", {}).get(name, {}) or {}

    async def status(self) -> dict:
        return {"online": await ping(self.host) if self.host else None}

    async def action(self, name: str, params: dict) -> dict:
        raise ValueError(f"Action '{name}' non supportée par {self.kind}")

    async def close(self):
        pass


async def ping(host: str, timeout: float = 1.0) -> bool:
    if not host:
        return False
    if platform.system() == "Windows":
        args = ["ping", "-n", "1", "-w", str(int(timeout * 1000)), host]
    else:
        args = ["ping", "-c", "1", "-W", str(max(1, int(timeout))), host]
    try:
        proc = await asyncio.create_subprocess_exec(
            *args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL
        )
        out, _ = await asyncio.wait_for(proc.communicate(), timeout + 2)
    except (asyncio.TimeoutError, OSError):
        return False
    # Sous Windows le code retour vaut 0 même pour "Impossible de joindre l'hôte" : on vérifie TTL.
    return proc.returncode == 0 and b"TTL=" in out.upper()


async def tcp_open(host: str, port: int, timeout: float = 1.5) -> bool:
    try:
        _, writer = await asyncio.wait_for(asyncio.open_connection(host, port), timeout)
        writer.close()
        return True
    except (OSError, asyncio.TimeoutError):
        return False


def send_magic_packet(mac: str, broadcast: str = "255.255.255.255", port: int = 9) -> None:
    clean = mac.replace(":", "").replace("-", "").replace(".", "")
    if len(clean) != 12:
        raise ValueError(f"Adresse MAC invalide : {mac}")
    packet = b"\xff" * 6 + bytes.fromhex(clean) * 16
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        s.sendto(packet, (broadcast, port))
