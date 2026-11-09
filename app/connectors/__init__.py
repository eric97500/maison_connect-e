from .base import Connector
from .camera import CameraConnector
from .demo import DemoConnector
from .elegoo import ElegooConnector
from .linux import LinuxServerConnector
from .switch import EasySmartSwitchConnector
from .isp import LiveboxConnector, SfrBoxConnector
from .hon import HonApplianceConnector
from .brother import BrotherConnector
from .network import PresenceConnector, ProxmoxConnector, QnapConnector, TerramasterConnector, WolConnector
from .tado import TadoConnector
from .tapo import TapoBulbConnector, TapoClimConnector, TapoConnector
from .verisure import VerisureConnector

TYPES: dict[str, type[Connector]] = {
    "tapo_plug": TapoConnector,
    "tapo_bulb": TapoBulbConnector,
    "tapo_clim": TapoClimConnector,
    "verisure": VerisureConnector,
    "wol": WolConnector,
    "camera": CameraConnector,
    "qnap": QnapConnector,
    "terramaster": TerramasterConnector,
    "proxmox": ProxmoxConnector,
    "elegoo": ElegooConnector,
    "presence": PresenceConnector,
    "tado": TadoConnector,
    "linux": LinuxServerConnector,
    "tplink_switch": EasySmartSwitchConnector,
    "sfr_box": SfrBoxConnector,
    "livebox": LiveboxConnector,
    "hon": HonApplianceConnector,
    "brother": BrotherConnector,
}


def build(dev: dict, cfg: dict) -> Connector:
    cls = TYPES.get(dev.get("type"))
    if cls is None:
        raise ValueError(f"Type d'appareil inconnu '{dev.get('type')}' pour {dev.get('id')}. Types : {', '.join(TYPES)}")
    conn = cls(dev, cfg)
    return DemoConnector(conn) if cfg.get("demo") or dev.get("demo") else conn
