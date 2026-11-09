"""Recherche des appareils sur le réseau local (NAS, Proxmox, imprimante, caméras, ordinateurs).

Balaye le sous-réseau /24 de cette machine sur quelques ports caractéristiques, puis lit la table ARP
pour connaître les adresses MAC (nécessaires au Wake on LAN).
"""
import asyncio
import ipaddress
import json
import platform
import re
import socket
import subprocess

import httpx

PORTS = (8006, 8080, 443, 80, 5443, 8181, 554, 7125, 3030, 3389, 445)

# Préfixes d'adresses MAC (fabricants) pour reconnaître les NAS même si leur interface web est sur un autre port
OUI = {"24:5E:BE": "qnap", "00:08:9B": "qnap", "6C:BF:B5": "terramaster"}


def local_ip() -> str:
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.connect(("10.255.255.255", 1))  # aucun paquet envoyé : sert juste à choisir l'interface
        return s.getsockname()[0]


async def _open(host: str, port: int, sem: asyncio.Semaphore, timeout=0.7) -> bool:
    async with sem:
        try:
            _, w = await asyncio.wait_for(asyncio.open_connection(host, port), timeout)
            w.close()
            return True
        except (OSError, asyncio.TimeoutError):
            return False


def _arp_table() -> dict[str, str]:
    try:
        out = subprocess.run(["arp", "-a"], capture_output=True, text=True, timeout=10).stdout
    except Exception:
        out = ""
    try:  # Linux : table du noyau, toujours disponible
        with open("/proc/net/arp") as f:
            out += "\n" + f.read()
    except OSError:
        pass
    table = {}
    for ip, mac in re.findall(r"(\d+\.\d+\.\d+\.\d+)\D+?([0-9a-fA-F]{2}(?:[-:][0-9a-fA-F]{2}){5})", out):
        mac = mac.replace("-", ":").upper()
        if not mac.startswith("FF:FF") and not mac.startswith("01:00:5E"):
            table[ip] = mac
    return table


def _elegoo_broadcast(timeout=2.5) -> dict[str, str]:
    """Découverte SDCP des imprimantes Elegoo (Centauri Carbon, Saturn, Mars…)."""
    found = {}
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
            s.settimeout(timeout)
            s.sendto(b"M99999", ("255.255.255.255", 3000))
            while True:
                data, (ip, _) = s.recvfrom(4096)
                try:
                    d = json.loads(data).get("Data", {})
                    found[ip] = d.get("Name") or d.get("MachineName") or "Imprimante Elegoo"
                except Exception:
                    found[ip] = "Imprimante Elegoo"
    except (socket.timeout, OSError):
        pass
    return found


async def _http_text(url: str) -> str:
    try:
        async with httpx.AsyncClient(timeout=2.5, verify=False, follow_redirects=True) as c:
            r = await c.get(url)
            return r.text[:4000]
    except Exception:
        return ""


def _hostname(ip: str) -> str | None:
    try:
        name = socket.gethostbyaddr(ip)[0].split(".")[0]
        return None if name.lower() in ("null", "localhost", ip.split(".")[0]) else name
    except Exception:
        return None


async def scan() -> dict:
    me = local_ip()
    net = ipaddress.ip_network(f"{me}/24", strict=False)
    hosts = [str(h) for h in net.hosts() if str(h) != me]
    sem = asyncio.Semaphore(256)
    elegoo_task = asyncio.create_task(asyncio.to_thread(_elegoo_broadcast))
    checks = [(h, p) for h in hosts for p in PORTS]
    results = await asyncio.gather(*(_open(h, p, sem) for h, p in checks))
    open_ports: dict[str, set] = {}
    for (h, p), ok in zip(checks, results):
        if ok:
            open_ports.setdefault(h, set()).add(p)
    elegoo = await elegoo_task
    for ip in elegoo:
        open_ports.setdefault(ip, set()).add(3030)
    arp = await asyncio.to_thread(_arp_table)

    found = []
    for ip, ports in sorted(open_ports.items(), key=lambda x: tuple(int(o) for o in x[0].split("."))):
        mac = arp.get(ip)
        vendor = OUI.get((mac or "")[:8])
        item = {"host": ip, "mac": mac, "ports": sorted(ports), "kind": None, "label": None, "device": None}
        if 8006 in ports:
            item.update(kind="proxmox", label="Serveur Proxmox", device={"type": "proxmox", "host": ip, "port": 8006})
        elif 3030 in ports or ip in elegoo:
            item.update(kind="elegoo", label=elegoo.get(ip, "Imprimante Elegoo"), device={"type": "elegoo", "host": ip, "protocol": "sdcp"})
        elif 7125 in ports:
            item.update(kind="elegoo", label="Imprimante 3D (Klipper)", device={"type": "elegoo", "host": ip, "protocol": "moonraker"})
        elif vendor == "qnap" or (8080 in ports and re.search(r"QNAP|QTS|qnap", await _http_text(f"http://{ip}:8080/"))):
            web = {"port": 8080} if 8080 in ports else {"port": 443, "https": True} if 443 in ports else {"port": 80}
            item.update(kind="qnap", label="NAS QNAP", device={"type": "qnap", "host": ip, **web})
        elif vendor == "terramaster" or 5443 in ports or 8181 in ports:
            item.update(kind="terramaster", label="NAS TerraMaster",
                        device={"type": "terramaster", "host": ip, "web_port": 5443 if 5443 in ports else 8181 if 8181 in ports else 443})
        elif 554 in ports:
            item.update(kind="camera", label="Caméra (RTSP)", device={"type": "camera", "host": ip,
                        "rtsp_url": f"rtsp://${{CAMERA_USER}}:${{CAMERA_PASSWORD}}@{ip}:554/"})
        elif 3389 in ports or 445 in ports:
            item.update(kind="wol", label="Ordinateur", device={"type": "wol", "host": ip, **({"mac": mac} if mac else {})})
        else:
            continue
        if mac and item["device"] and item["kind"] in ("wol", "proxmox", "qnap", "terramaster"):
            item["device"]["mac"] = mac
        found.append(item)

    names = await asyncio.gather(*(asyncio.wait_for(asyncio.to_thread(_hostname, f["host"]), 2) for f in found),
                                 return_exceptions=True)
    for f, n in zip(found, names):
        f["hostname"] = n if isinstance(n, str) else None
        if f["kind"] == "wol" and f["hostname"]:
            f["label"] = f"Ordinateur {f['hostname']}"
    return {"network": str(net), "me": me, "system": platform.system(), "found": found}
