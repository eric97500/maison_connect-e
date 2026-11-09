"""Comptes en ligne : tado° (connexion sur le site tado), Tapo (identifiants + recherche locale), Verisure.

Les identifiants Tapo / Verisure sont écrits dans .env (jamais renvoyés à l'interface).
Le jeton tado° est conservé dans data/tado_token.json (aucun mot de passe : connexion OAuth sur le site de tado).
"""
import asyncio
import json
import logging
import os
import re
import time

import httpx

from .config import DATA_DIR, ROOT

log = logging.getLogger("maison")


# ------------------------------------------------------------------ .env
def set_env(values: dict[str, str]) -> None:
    """Met à jour (ou ajoute) des variables dans .env et dans l'environnement courant."""
    path = ROOT / ".env"
    source = path if path.exists() else ROOT / ".env.example"
    lines = source.read_text(encoding="utf-8").splitlines() if source.exists() else []
    for key, value in values.items():
        value = "" if value is None else str(value)
        quoted = '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'
        pattern = re.compile(rf"^\s*{re.escape(key)}\s*=")
        for i, line in enumerate(lines):
            if pattern.match(line):
                lines[i] = f"{key}={quoted}"
                break
        else:
            lines.append(f"{key}={quoted}")
        os.environ[key] = value
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


# ------------------------------------------------------------------ tado°
TADO_CLIENT_ID = "1bb50063-6b0c-4d11-bd99-387f4a91cc46"  # client public de l'appli web tado (flux « device code »)
TADO_AUTH = "https://login.tado.com/oauth2"
TADO_API = "https://my.tado.com/api/v2"
TOKEN_FILE = DATA_DIR / "tado_token.json"


class TadoAccount:
    def __init__(self):
        self.refresh_token: str | None = None
        self.access_token: str | None = None
        self.expires = 0.0
        self.login: dict | None = None        # connexion en cours (code à saisir sur le site tado)
        self.login_error: str | None = None
        self.me: dict | None = None
        self.poll_seconds = 900               # tado limite le nombre d'appels par jour
        self._states: dict[int, tuple[float, dict]] = {}
        self._caps: dict[tuple, dict] = {}
        self.quota: dict = {}                 # appels restants / remise à zéro, d'après les en-têtes RateLimit de tado
        self.blocked_until = 0.0              # après un refus 429 : plus aucun appel avant cette heure
        self._lock = asyncio.Lock()
        self._poll_task: asyncio.Task | None = None
        if TOKEN_FILE.exists():
            try:
                self.refresh_token = json.loads(TOKEN_FILE.read_text(encoding="utf-8")).get("refresh_token")
            except Exception:
                pass

    @property
    def connected(self) -> bool:
        return bool(self.refresh_token)

    def _save(self):
        DATA_DIR.mkdir(exist_ok=True)
        TOKEN_FILE.write_text(json.dumps({"refresh_token": self.refresh_token}), encoding="utf-8")

    def logout(self):
        if self._poll_task and not self._poll_task.done() and self._poll_task is not asyncio.current_task():
            self._poll_task.cancel()
        self.refresh_token = self.access_token = None
        self.me = None
        self.login = None
        self._states.clear()
        TOKEN_FILE.unlink(missing_ok=True)

    # ---- connexion sur le site de tado (OAuth 2 « device authorization »)
    async def start_login(self) -> dict:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.post(f"{TADO_AUTH}/device_authorize", data={"client_id": TADO_CLIENT_ID, "scope": "offline_access"})
        r.raise_for_status()
        d = r.json()
        self.login = {"user_code": d["user_code"], "url": d.get("verification_uri_complete") or d["verification_uri"],
                      "device_code": d["device_code"], "interval": int(d.get("interval", 5)),
                      "expires_at": time.time() + int(d.get("expires_in", 300))}
        self.login_error = None
        if self._poll_task and not self._poll_task.done():
            self._poll_task.cancel()
        self._poll_task = asyncio.create_task(self._wait_login())
        return {"user_code": self.login["user_code"], "url": self.login["url"], "expires_in": int(d.get("expires_in", 300))}

    async def _wait_login(self):
        lg = self.login
        async with httpx.AsyncClient(timeout=10) as c:
            while lg and time.time() < lg["expires_at"]:
                await asyncio.sleep(lg["interval"])
                r = await c.post(f"{TADO_AUTH}/token", data={
                    "client_id": TADO_CLIENT_ID, "device_code": lg["device_code"],
                    "grant_type": "urn:ietf:params:oauth:grant-type:device_code"})
                if r.status_code == 200:
                    self._store(r.json())
                    self.login = None
                    try:
                        await self.load_me()
                    except Exception as e:
                        log.warning("tado : %s", e)
                    log.info("tado° connecté")
                    return
                err = (r.json() if r.headers.get("content-type", "").startswith("application/json") else {}).get("error")
                if err == "slow_down":
                    lg["interval"] += 5
                elif err != "authorization_pending":
                    self.login_error = f"Connexion refusée ({err or r.status_code})"
                    self.login = None
                    return
        self.login_error = "Le code a expiré, recommence la connexion."
        self.login = None

    def _store(self, tok: dict):
        self.access_token = tok["access_token"]
        self.expires = time.time() + int(tok.get("expires_in", 600)) - 30
        if tok.get("refresh_token"):
            self.refresh_token = tok["refresh_token"]   # le jeton change à chaque renouvellement
            self._save()

    async def _token(self) -> str:
        async with self._lock:
            if self.access_token and time.time() < self.expires:
                return self.access_token
            if not self.refresh_token:
                raise PermissionError("Compte tado° non connecté (Paramètres → Comptes connectés)")
            async with httpx.AsyncClient(timeout=10) as c:
                r = await c.post(f"{TADO_AUTH}/token", data={"client_id": TADO_CLIENT_ID, "grant_type": "refresh_token",
                                                             "refresh_token": self.refresh_token})
            if r.status_code in (400, 401):
                self.logout()
                raise PermissionError("Connexion tado° expirée : reconnecte le compte dans Paramètres")
            r.raise_for_status()
            self._store(r.json())
            return self.access_token

    def _read_quota(self, r):
        """En-tête tado : RateLimit: "perday";r=<restants>;t=<secondes avant remise à zéro>."""
        m_r = re.search(r"(?:^|[;,\s])r=(\d+)", r.headers.get("ratelimit", ""))
        m_t = re.search(r"(?:^|[;,\s])t=(\d+)", r.headers.get("ratelimit", ""))
        m_q = re.search(r"(?:^|[;,\s])q=(\d+)", r.headers.get("ratelimit-policy", ""))
        if m_r:
            self.quota = {"remaining": int(m_r.group(1)), "reset_at": time.time() + int(m_t.group(1)) if m_t else None,
                          "limit": int(m_q.group(1)) if m_q else self.quota.get("limit")}

    def blocked_message(self) -> str:
        return "tado° : quota d'appels du jour atteint, reprise à " + time.strftime("%H:%M", time.localtime(self.blocked_until))

    async def request(self, method: str, path: str, body=None):
        if time.time() < self.blocked_until:
            raise RuntimeError(self.blocked_message())
        token = await self._token()
        async with httpx.AsyncClient(timeout=12) as c:
            r = await c.request(method, TADO_API + path, json=body, headers={"Authorization": f"Bearer {token}"})
        self._read_quota(r)
        if r.status_code == 429:
            # on se tait jusqu'à la remise à zéro du compteur (sinon chaque nouvel essai gaspille encore le quota)
            reset = self.quota.get("reset_at") if self.quota.get("remaining") == 0 else None
            self.blocked_until = reset or time.time() + 3600
            log.warning("tado : quota atteint, appels suspendus jusqu'à %s", time.strftime("%H:%M", time.localtime(self.blocked_until)))
            raise RuntimeError(self.blocked_message())
        if r.status_code >= 400:
            try:
                errs = r.json().get("errors") or [r.json()]
                detail = "; ".join(e.get("title") or e.get("code") or str(e) for e in errs)
            except Exception:
                detail = r.text[:300]
            log.warning("tado %s %s → %s : %s | envoyé : %s", method, path, r.status_code, detail, body)
            raise RuntimeError(f"tado° a refusé la commande ({r.status_code}) : {detail}")
        return r.json() if r.content else None

    async def load_me(self) -> dict:
        self.me = await self.request("GET", "/me")
        return self.me

    async def zones(self) -> list[dict]:
        me = self.me or await self.load_me()
        out = []
        for home in me.get("homes", []):
            for z in await self.request("GET", f"/homes/{home['id']}/zones"):
                if z.get("type") in ("HEATING", "AIR_CONDITIONING", "HOT_WATER"):
                    out.append({"home_id": home["id"], "home": home.get("name"), "zone_id": z["id"],
                                "name": z.get("name"), "zone_type": z["type"]})
        return out

    def interval(self) -> float:
        """Intervalle entre deux lectures : au moins poll_seconds, et étalé pour que le quota restant tienne
        jusqu'à sa remise à zéro (en gardant une réserve de RESERVE appels pour les commandes)."""
        q = self.quota
        if q.get("remaining") is None or not q.get("reset_at"):
            return self.poll_seconds
        left = q["reset_at"] - time.time()
        usable = q["remaining"] - self.RESERVE
        if usable <= 0:
            return max(self.poll_seconds, left)
        return max(self.poll_seconds, left / usable)

    RESERVE = 15

    def last_update(self, home_id: int) -> float:
        return self._states.get(home_id, (0, {}))[0]

    async def zone_state(self, home_id: int, zone_id: int) -> dict:
        """Un seul appel API pour toutes les pièces d'un logement, mis en cache. Si tado refuse (quota),
        on renvoie le dernier état connu plutôt qu'une erreur."""
        ts, states = self._states.get(home_id, (0, {}))
        if time.time() - ts > self.interval() or not states:
            try:
                data = await self.request("GET", f"/homes/{home_id}/zoneStates")
                states = data.get("zoneStates", {})
                self._states[home_id] = (time.time(), states)
            except RuntimeError:
                if not states:
                    raise
        return states.get(str(zone_id), {})

    def apply_overlay(self, home_id: int, zone_id: int, overlay: dict | None):
        """Met à jour le cache avec la réponse de la commande, sans relire tout le logement (économise un appel)."""
        ts, states = self._states.get(home_id, (0, {}))
        z = states.get(str(zone_id))
        if z is None or not overlay or not overlay.get("setting"):
            return self.invalidate(home_id)
        z["overlay"] = overlay
        z["overlayType"] = overlay.get("type")
        z["setting"] = overlay["setting"]

    def invalidate(self, home_id: int):
        ts, states = self._states.get(home_id, (0, {}))
        if states:  # relu au prochain cycle (dans ~1 min) mais on garde l'état connu en cas de refus
            self._states[home_id] = (0, states)

    async def capabilities(self, home_id: int, zone_id: int) -> dict:
        key = (home_id, zone_id)
        if key not in self._caps:
            self._caps[key] = await self.request("GET", f"/homes/{home_id}/zones/{zone_id}/capabilities")
        return self._caps[key]

    def status(self) -> dict:
        homes = [h.get("name") for h in (self.me or {}).get("homes", [])]
        return {"connected": self.connected, "email": (self.me or {}).get("email"), "homes": homes,
                "pending": bool(self.login), "user_code": (self.login or {}).get("user_code"),
                "url": (self.login or {}).get("url"), "error": self.login_error, "poll_seconds": self.poll_seconds,
                "quota": self.quota, "blocked_until": self.blocked_until if time.time() < self.blocked_until else None,
                "effective_interval": round(self.interval())}


TADO = TadoAccount()


# ------------------------------------------------------------------ Tapo : recherche sur le réseau local
async def discover_tapo(username: str, password: str, timeout: int = 6) -> list[dict]:
    from kasa import Credentials, Discover, DeviceType, Module
    from kasa.exceptions import AuthenticationError

    found = await Discover.discover(credentials=Credentials(username, password), discovery_timeout=timeout)
    out = []
    for host, dev in found.items():
        item = {"host": host, "model": getattr(dev, "model", "?"), "alias": None, "type": None, "auth_error": False,
                "energy": False, "note": None}
        try:
            await dev.update()
            item["alias"] = dev.alias
            dt = dev.device_type
            item["energy"] = Module.Energy in dev.modules
            if dt in (DeviceType.Bulb, DeviceType.LightStrip, DeviceType.Dimmer):
                item["type"] = "tapo_bulb"
            elif dt in (DeviceType.Plug, DeviceType.Strip, DeviceType.WallSwitch, DeviceType.StripSocket):
                item["type"] = "tapo_plug"
            else:
                item["note"] = f"Type {dt.value} pas encore géré"
        except AuthenticationError:
            item["auth_error"] = True
            item["note"] = "Identifiants refusés"
        except Exception as e:
            item["note"] = str(e)[:120]
        finally:
            try:
                await dev.disconnect()
            except Exception:
                pass
        out.append(item)
    return sorted(out, key=lambda x: x["host"])


# ------------------------------------------------------------------ Verisure : connexion avec code SMS / e-mail
class VerisureLogin:
    def __init__(self):
        self.session = None

    def _session(self, username, password):
        import verisure

        from .connectors.verisure import COOKIE_FILE
        return verisure.Session(username, password, cookie_file_name=str(COOKIE_FILE))

    def start(self, username: str, password: str) -> dict:
        import verisure

        s = self._session(username, password)
        try:
            inst = s.login()
            self.session = None
            return {"ok": True, "installations": _installs(inst)}
        except verisure.LoginError as e:
            if "multifactor" in str(e).lower() or "mfa" in str(e).lower() or getattr(s, "_mfa_login_pending", False):
                s.request_mfa()
                self.session = s
                return {"ok": False, "mfa": True}
            raise PermissionError("Identifiants Verisure refusés") from e

    def validate(self, code: str) -> dict:
        if not self.session:
            raise ValueError("Aucune connexion Verisure en cours")
        inst = self.session.validate_mfa(code.strip())
        self.session = None
        return {"ok": True, "installations": _installs(inst)}


def _installs(inst) -> list[str]:
    try:
        return [i.get("alias") or i["giid"] for i in inst["data"]["account"]["installations"]]
    except Exception:
        return []


VERISURE = VerisureLogin()
