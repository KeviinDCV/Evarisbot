"""
ROBOT DE LLAMADAS DE WHATSAPP de Evarisbot (recordatorios de cita por voz).

Corre en el mismo PC que Evarisbot y SOLO escucha en 127.0.0.1. No habla con Meta: Laravel hace las peticiones a la
Calling API (el token se queda allá) y le pasa al robot lo que llega por el webhook. El robot es el «teléfono»: arma la
conexión de audio (WebRTC, igual que el navegador de un asesor), habla con voz sintética y oye los números que marca el
paciente en el teclado de WhatsApp (RFC 4733, van dentro del audio: Meta no los avisa por webhook).

Cómo va una llamada:
  1. Laravel → POST /llamar {id, voz, textos}: el robot prepara los audios, arma su OFERTA WebRTC y la devuelve.
  2. Laravel se la manda a Meta (action connect). La RESPUESTA de Meta llega por el webhook → POST /respuesta.
     Desde ahí el robot ya manda silencio (si no llega audio en ~20 s, WhatsApp corta).
  3. El paciente contesta (webhook ACCEPTED) → POST /contesto: el robot lee el mensaje y pregunta.
  4. Cada número marcado se le pasa a Laravel (POST {callback} evento «digito»), que decide qué significa (confirmar,
     cancelar, repetir…) y qué decir. Al final el robot pide «terminar» y Laravel cuelga en Meta.
  5. Meta avisa el fin (terminate) → POST /cerrar: se suelta todo.

Uso:  .venv/Scripts/python robot.py --puerto 8791 --clave-archivo clave.txt
"""

from __future__ import annotations

import argparse
import asyncio
import fractions
import hashlib
import hmac
import json
import logging
import os
import re
import time
from dataclasses import dataclass, field
from pathlib import Path

import av
import edge_tts
from aiohttp import ClientSession, ClientTimeout, web
from aiortc import MediaStreamTrack, RTCPeerConnection, RTCRtpCodecParameters, RTCSessionDescription
from aiortc.codecs import CODECS
from aiortc.contrib.media import MediaBlackhole
from aiortc.mediastreams import MediaStreamError
from aiortc.rtcrtpreceiver import RTCRtpReceiver

AQUI = Path(__file__).resolve().parent
CACHE_VOZ = AQUI / "cache-voz"
TASA = 48000
MUESTRAS_20MS = 960
log = logging.getLogger("robot")

# ── Teclado del paciente (RFC 4733): se ofrece «telephone-event» a 8000 Hz, el único reloj que admite Meta. ──
PT_DTMF = 126
CODECS["audio"].append(RTCRtpCodecParameters(mimeType="audio/telephone-event", clockRate=8000, channels=1, payloadType=PT_DTMF))
TECLAS = "0123456789*#"

_rtp_original = RTCRtpReceiver._handle_rtp_packet


async def _rtp_con_teclado(self, packet, arrival_time_ms):  # type: ignore[no-untyped-def]
    """Los paquetes del teclado se leen aquí; aiortc no los decodifica (no tiene decodificador para ellos)."""
    oyente = getattr(self, "_oyente_teclado", None)
    if oyente is not None and packet.payload_type in oyente.tipos:
        oyente.paquete(packet)
        return
    if oyente is not None:
        oyente.audio_recibido()
    await _rtp_original(self, packet, arrival_time_ms)


RTCRtpReceiver._handle_rtp_packet = _rtp_con_teclado


class OyenteTeclado:
    def __init__(self, al_marcar) -> None:  # type: ignore[no-untyped-def]
        self.tipos = {PT_DTMF}
        self._al_marcar = al_marcar
        self._vistos: set[int] = set()
        self.primer_audio: float | None = None

    def paquete(self, packet) -> None:  # type: ignore[no-untyped-def]
        datos = packet.payload
        if len(datos) < 4 or packet.timestamp in self._vistos:
            return
        evento = datos[0]
        if evento >= len(TECLAS):
            return
        # Una pulsación son varios paquetes con el mismo timestamp: cuenta una sola vez, la primera.
        self._vistos.add(packet.timestamp)
        self._al_marcar(TECLAS[evento])

    def audio_recibido(self) -> None:
        if self.primer_audio is None:
            self.primer_audio = time.monotonic()


# ── Voz: texto → audio PCM 48 kHz mono (con caché en disco: los mismos textos no se vuelven a fabricar) ──
async def sintetizar(texto: str, voz: str, velocidad: str) -> bytes:
    CACHE_VOZ.mkdir(exist_ok=True)
    clave = hashlib.sha1(f"{voz}|{velocidad}|{texto}".encode()).hexdigest()
    mp3 = CACHE_VOZ / f"{clave}.mp3"
    if not mp3.exists():
        temporal = mp3.with_suffix(f".{os.getpid()}.{id(asyncio.current_task())}.tmp")  # dos llamadas a la vez no chocan
        await edge_tts.Communicate(texto, voz, rate=velocidad).save(str(temporal))
        os.replace(temporal, mp3)
    return await asyncio.to_thread(_decodificar, mp3)


def _decodificar(ruta: Path) -> bytes:
    salida = bytearray()
    remuestreo = av.AudioResampler(format="s16", layout="mono", rate=TASA)
    with av.open(str(ruta)) as contenedor:
        for cuadro in contenedor.decode(audio=0):
            for f in remuestreo.resample(cuadro):
                salida += bytes(f.planes[0])[: f.samples * 2]
        for f in remuestreo.resample(None):
            salida += bytes(f.planes[0])[: f.samples * 2]
    return bytes(salida)


class Voz(MediaStreamTrack):
    """Pista de audio que manda silencio y, cuando se le pide, el mensaje (20 ms por cuadro, a ritmo real)."""

    kind = "audio"

    def __init__(self) -> None:
        super().__init__()
        self._pcm = b""
        self._inicio: float | None = None
        self._ts = 0

    def poner(self, pcm: bytes) -> None:
        self._pcm = pcm

    def callar(self) -> None:
        self._pcm = b""

    @property
    def hablando(self) -> bool:
        return len(self._pcm) > 0

    async def recv(self):  # type: ignore[no-untyped-def]
        if self.readyState != "live":
            raise MediaStreamError
        if self._inicio is None:
            self._inicio = time.time()
            self._ts = 0
        else:
            self._ts += MUESTRAS_20MS
            espera = self._inicio + self._ts / TASA - time.time()
            if espera > 0:
                await asyncio.sleep(espera)
        trozo = self._pcm[: MUESTRAS_20MS * 2]
        self._pcm = self._pcm[MUESTRAS_20MS * 2 :]
        if len(trozo) < MUESTRAS_20MS * 2:
            trozo += b"\x00" * (MUESTRAS_20MS * 2 - len(trozo))
        cuadro = av.AudioFrame(format="s16", layout="mono", samples=MUESTRAS_20MS)
        cuadro.planes[0].update(trozo)
        cuadro.pts = self._ts
        cuadro.sample_rate = TASA
        cuadro.time_base = fractions.Fraction(1, TASA)
        return cuadro


# ── Una llamada ──
@dataclass
class Llamada:
    id: int
    voz_nombre: str
    velocidad: str
    textos: dict[str, str]
    callback: str
    clave: str
    pc: RTCPeerConnection
    voz: Voz
    audios: dict[str, bytes] = field(default_factory=dict)
    digitos: asyncio.Queue = field(default_factory=asyncio.Queue)
    tarea: asyncio.Task | None = None
    contesto: bool = False
    creada: float = field(default_factory=time.monotonic)
    oyente: OyenteTeclado | None = None
    sumidero: MediaBlackhole | None = None

    async def avisar(self, evento: str, **datos) -> dict:  # type: ignore[no-untyped-def]
        """Le cuenta algo a Evarisbot (Laravel) y devuelve lo que responda."""
        cuerpo = json.dumps({"id": self.id, "evento": evento, **datos}).encode()
        firma = hmac.new(self.clave.encode(), cuerpo, hashlib.sha256).hexdigest()
        try:
            # Evarisbot puede tardar: aplica la tecla y le escribe al paciente por WhatsApp antes de responder.
            async with ClientSession(timeout=ClientTimeout(total=40)) as s:
                async with s.post(self.callback, data=cuerpo, headers={"Content-Type": "application/json", "X-Robot-Firma": firma}) as r:
                    texto = await r.text()
                    if r.status != 200:
                        log.warning("llamada %s: Evarisbot respondió %s al evento %s: %s", self.id, r.status, evento, texto[:200])
                        return {}
                    return json.loads(texto or "{}")
        except Exception as e:  # noqa: BLE001
            log.warning("llamada %s: no se pudo avisar %s a Evarisbot: %s", self.id, evento, e)
            return {}

    async def decir(self, clave_o_texto: str, interrumpible: bool = True) -> str | None:
        """Dice un texto. Si el paciente marca mientras habla, se calla y devuelve la tecla."""
        pcm = self.audios.get(clave_o_texto)
        if pcm is None:
            pcm = await sintetizar(clave_o_texto, self.voz_nombre, self.velocidad)
        while not self.digitos.empty():  # lo marcado antes de esta frase no cuenta para ella
            self.digitos.get_nowait()
        self.voz.poner(pcm)
        duracion = len(pcm) / (TASA * 2) + 0.3
        if not interrumpible:
            await asyncio.sleep(duracion)
            return None
        try:
            tecla = await asyncio.wait_for(self.digitos.get(), timeout=duracion)
            self.voz.callar()
            return tecla
        except asyncio.TimeoutError:
            return None

    async def esperar_tecla(self, segundos: float) -> str | None:
        try:
            return await asyncio.wait_for(self.digitos.get(), timeout=segundos)
        except asyncio.TimeoutError:
            return None

    async def conversar(self) -> None:
        """Mensaje, pregunta y lo que marque el paciente. Laravel decide qué significa cada tecla."""
        try:
            await asyncio.sleep(0.8)  # que el paciente alcance a ponerse el teléfono en la oreja
            tecla = await self.decir("mensaje")
            vueltas = 0
            while True:
                if tecla is None:
                    tecla = await self.decir("pregunta") or await self.esperar_tecla(8)
                if tecla is None:
                    vueltas += 1
                    if vueltas >= 2:
                        await self.avisar("sin_respuesta")
                        await self.decir("sin_respuesta", interrumpible=False)
                        break
                    tecla = await self.decir("mensaje")
                    continue
                r = await self.avisar("digito", digito=tecla)
                decir = str(r.get("decir") or "no_entendi")
                if r.get("repetir"):
                    tecla = await self.decir("mensaje")
                    continue
                if r.get("fin", True):
                    await self.decir(decir, interrumpible=False)
                    break
                tecla = await self.decir(decir)
            await asyncio.sleep(0.4)
        except asyncio.CancelledError:
            return
        except Exception as e:  # noqa: BLE001
            log.exception("llamada %s: falló la conversación: %s", self.id, e)
        await self.avisar("terminar")

    async def cerrar(self) -> None:
        if self.tarea and not self.tarea.done():
            self.tarea.cancel()
        try:
            if self.sumidero:
                await self.sumidero.stop()
        except Exception:  # noqa: BLE001
            pass
        self.voz.stop()
        await self.pc.close()


LLAMADAS: dict[int, Llamada] = {}
TOPE_LLAMADAS = 6


def solo_sha256(sdp: str) -> str:
    """Meta pide una sola huella sha-256 (aiortc anuncia también sha-384 y sha-512)."""
    lineas = [l for l in sdp.split("\r\n") if not (l.startswith("a=fingerprint:") and not l.startswith("a=fingerprint:sha-256"))]
    return "\r\n".join(lineas)


# ── API local (solo 127.0.0.1, con clave) ──
def autorizado(request: web.Request, clave: str) -> bool:
    return hmac.compare_digest(request.headers.get("X-Robot-Clave", ""), clave)


async def llamar(request: web.Request) -> web.Response:
    app = request.app
    if not autorizado(request, app["clave"]):
        return web.json_response({"error": "clave"}, status=403)
    datos = await request.json()
    lid = int(datos["id"])
    if lid in LLAMADAS:
        return web.json_response({"error": "ya_existe"}, status=409)
    if len(LLAMADAS) >= TOPE_LLAMADAS:
        return web.json_response({"error": "ocupado"}, status=429)
    textos = {k: str(v) for k, v in dict(datos["textos"]).items()}
    voz_nombre = str(datos.get("voz") or "es-MX-DaliaNeural")
    velocidad = str(datos.get("velocidad") or "-4%")
    if not re.fullmatch(r"[a-z]{2}-[A-Z]{2}-[A-Za-z]+Neural", voz_nombre) or not re.fullmatch(r"[+-]\d{1,2}%", velocidad):
        return web.json_response({"error": "voz"}, status=422)

    # Primero los audios (si la voz falla, no se llama).
    try:
        audios = {k: await sintetizar(t, voz_nombre, velocidad) for k, t in textos.items() if t.strip()}
    except Exception as e:  # noqa: BLE001
        log.warning("llamada %s: no se pudo fabricar la voz: %s", lid, e)
        return web.json_response({"error": "voz_no_disponible"}, status=503)

    pc = RTCPeerConnection()
    voz = Voz()
    ll = Llamada(id=lid, voz_nombre=voz_nombre, velocidad=velocidad, textos=textos, callback=app["callback"], clave=app["clave"], pc=pc, voz=voz, audios=audios)
    LLAMADAS[lid] = ll

    def al_marcar(tecla: str) -> None:
        log.info("llamada %s: el paciente marcó %s", lid, tecla)
        ll.digitos.put_nowait(tecla)

    @pc.on("track")
    async def al_recibir(pista):  # type: ignore[no-untyped-def]
        ll.sumidero = MediaBlackhole()  # el audio del paciente no se guarda: solo se consume
        ll.sumidero.addTrack(pista)
        await ll.sumidero.start()

    @pc.on("connectionstatechange")
    async def al_cambiar():  # type: ignore[no-untyped-def]
        log.info("llamada %s: conexión %s", lid, pc.connectionState)
        if pc.connectionState == "failed" and lid in LLAMADAS:
            await ll.avisar("fallo")

    transceptor = pc.addTransceiver(voz, direction="sendrecv")
    ll.oyente = OyenteTeclado(al_marcar)
    transceptor.receiver._oyente_teclado = ll.oyente  # type: ignore[attr-defined]
    oferta = await pc.createOffer()
    await pc.setLocalDescription(oferta)  # aiortc reúne los candidatos aquí (sin trickle)
    sdp = solo_sha256(pc.localDescription.sdp)
    log.info("llamada %s: oferta lista (%d audios)", lid, len(audios))
    return web.json_response({"sdp": sdp})


async def respuesta(request: web.Request) -> web.Response:
    if not autorizado(request, request.app["clave"]):
        return web.json_response({"error": "clave"}, status=403)
    datos = await request.json()
    ll = LLAMADAS.get(int(datos["id"]))
    if not ll:
        return web.json_response({"error": "no_existe"}, status=404)
    sdp = str(datos["sdp"])
    m = re.search(r"a=rtpmap:(\d+) telephone-event/8000", sdp)
    if m and ll.oyente:
        ll.oyente.tipos.add(int(m.group(1)))
    await ll.pc.setRemoteDescription(RTCSessionDescription(sdp=sdp, type="answer"))
    log.info("llamada %s: respuesta de Meta aplicada", ll.id)
    return web.json_response({"ok": True})


async def contesto(request: web.Request) -> web.Response:
    if not autorizado(request, request.app["clave"]):
        return web.json_response({"error": "clave"}, status=403)
    datos = await request.json()
    ll = LLAMADAS.get(int(datos["id"]))
    if not ll:
        return web.json_response({"error": "no_existe"}, status=404)
    if not ll.contesto:
        ll.contesto = True
        if ll.oyente and ll.oyente.primer_audio:
            log.info("llamada %s: contestó (el audio del paciente empezó %.1f s antes del aviso)", ll.id, time.monotonic() - ll.oyente.primer_audio)
        ll.tarea = asyncio.create_task(ll.conversar())
    return web.json_response({"ok": True})


async def cerrar(request: web.Request) -> web.Response:
    if not autorizado(request, request.app["clave"]):
        return web.json_response({"error": "clave"}, status=403)
    datos = await request.json()
    ll = LLAMADAS.pop(int(datos["id"]), None)
    if ll:
        await ll.cerrar()
        log.info("llamada %s: cerrada", ll.id)
    return web.json_response({"ok": True})


async def estado(request: web.Request) -> web.Response:
    if not autorizado(request, request.app["clave"]):
        return web.json_response({"error": "clave"}, status=403)
    return web.json_response({"ok": True, "llamadas": len(LLAMADAS), "tope": TOPE_LLAMADAS})


async def limpiar_viejas(app: web.Application) -> None:
    """Respaldo: una llamada que nadie cerró en 10 minutos se suelta (Meta ya la terminó)."""
    while True:
        await asyncio.sleep(30)
        for lid, ll in list(LLAMADAS.items()):
            if time.monotonic() - ll.creada > 600:
                LLAMADAS.pop(lid, None)
                await ll.cerrar()
                log.info("llamada %s: soltada por vieja", lid)


async def al_iniciar(app: web.Application) -> None:
    app["limpieza"] = asyncio.create_task(limpiar_viejas(app))


def main() -> None:
    p = argparse.ArgumentParser(description="Robot de llamadas de WhatsApp de Evarisbot")
    p.add_argument("--puerto", type=int, default=8791)
    p.add_argument("--clave-archivo", default=str(AQUI / "clave.txt"))
    p.add_argument("--callback", default="http://127.0.0.1:8000/interno/robot-llamadas")
    a = p.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    logging.getLogger("aioice").setLevel(logging.WARNING)
    clave = Path(a.clave_archivo).read_text(encoding="utf-8").strip()
    if len(clave) < 32:
        raise SystemExit("La clave del robot es muy corta (mínimo 32 caracteres).")
    app = web.Application(client_max_size=256 * 1024)
    app["clave"] = clave
    app["callback"] = a.callback
    app.router.add_post("/llamar", llamar)
    app.router.add_post("/respuesta", respuesta)
    app.router.add_post("/contesto", contesto)
    app.router.add_post("/cerrar", cerrar)
    app.router.add_get("/estado", estado)
    app.on_startup.append(al_iniciar)
    web.run_app(app, host="127.0.0.1", port=a.puerto, print=None)


if __name__ == "__main__":
    main()
