"""Caméras Avidsen : image via une URL de snapshot HTTP ou via RTSP (nécessite ffmpeg)."""
import asyncio
import shutil

import httpx

from .base import Connector, ping


class CameraConnector(Connector):
    kind = "camera"
    icon = "📷"
    capabilities = ("camera",)

    async def status(self):
        online = await ping(self.host) if self.host else None
        mode = "snapshot" if self.dev.get("snapshot_url") else "rtsp" if self.dev.get("rtsp_url") else "aucun"
        return {"online": online, "on": online, "summary": "En ligne" if online else "Hors ligne",
                "details": {"IP": self.host, "flux": mode}}

    async def snapshot(self) -> bytes:
        if url := self.dev.get("snapshot_url"):
            c = self.creds("camera")
            auth = None
            if c.get("username"):
                auth = (httpx.DigestAuth if self.dev.get("digest", True) else httpx.BasicAuth)(
                    c["username"], c.get("password", ""))
            async with httpx.AsyncClient(timeout=6, verify=False) as client:
                r = await client.get(url, auth=auth)
                r.raise_for_status()
                return r.content
        if url := self.dev.get("rtsp_url"):
            ffmpeg = shutil.which("ffmpeg")
            if not ffmpeg:
                raise RuntimeError("ffmpeg est requis pour lire un flux RTSP (voir README)")
            proc = await asyncio.create_subprocess_exec(
                ffmpeg, "-loglevel", "error", "-rtsp_transport", "tcp", "-i", url,
                "-frames:v", "1", "-q:v", "4", "-f", "image2", "-vcodec", "mjpeg", "-",
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
            try:
                out, err = await asyncio.wait_for(proc.communicate(), 10)
            except asyncio.TimeoutError:
                proc.kill()
                raise RuntimeError("Délai dépassé en lisant le flux RTSP")
            if not out:
                raise RuntimeError(err.decode(errors="ignore")[:200] or "Aucune image reçue")
            return out
        raise RuntimeError("Ni snapshot_url ni rtsp_url configuré")
