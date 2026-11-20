import axios from 'axios';
import { alAviso, hayTiempoReal } from '@/lib/tiempo-real';

/**
 * LLAMADAS DE WHATSAPP entrantes, contestadas desde el navegador (ver App\Services\LlamadasWhatsApp).
 *
 * El servidor avisa por tiempo real («llamada») y esta pantalla pide /admin/llamadas/pendientes, que ya trae solo las
 * que le timbran a este usuario. Al contestar: el navegador arma la respuesta WebRTC a la oferta de Meta, el servidor
 * se la pasa a Meta y el audio va directo entre Meta y este navegador (micrófono y parlantes/audífonos de este PC).
 *
 * Vive a nivel de módulo (como unread-store y tiempo-real): sobrevive a las navegaciones de Inertia. Recargar o cerrar
 * la pestaña corta el audio: se avisa antes de salir y, si sale igual, se cuelga en el servidor (keepalive).
 */
export type LlamadaPendiente = {
    id: number;
    conversation_id: number | null;
    nombre: string | null;
    telefono: string | null;
    desde: string | null;
    sdp_oferta: string;
};

/** Una llamada que este usuario tiene abierta en el servidor pero sin audio en esta pestaña (recargó, otra pestaña). */
export type LlamadaHuerfana = Omit<LlamadaPendiente, 'sdp_oferta'> & { estado: string };

export type EstadoLlamadas =
    | { fase: 'libre' }
    | { fase: 'timbrando'; llamada: LlamadaPendiente; otras: number }
    | { fase: 'conectando'; llamada: LlamadaPendiente }
    // Llamada que hace este usuario al paciente: «Llamando…» y, cuando Meta avisa que el celular suena, «Sonando…».
    | { fase: 'llamando'; llamada: LlamadaPendiente; sonando: boolean }
    | { fase: 'en_curso'; llamada: LlamadaPendiente; inicio: number; silenciado: boolean }
    | { fase: 'terminada'; llamada: LlamadaPendiente; motivo: 'colgo' | 'otro' | 'error'; detalle?: string; duracion?: number }
    | { fase: 'huerfana'; llamada: LlamadaHuerfana };

type Oyente = (estado: EstadoLlamadas) => void;

/**
 * Sin tiempo real, cada cuánto se pregunta si hay llamadas (con tiempo real basta el aviso). Con algo de azar, para que
 * las pantallas de todos no pregunten en el mismo instante (Windows ya se quedó sin sockets por consultas a la par).
 */
const SONDEO_SIN_TIEMPO_REAL_MS = 8000 + Math.floor(Math.random() * 2000);
/** Mientras timbra, se vuelve a preguntar por si el paciente colgó o la contestó otro (el aviso pudo perderse). */
const SONDEO_TIMBRANDO_MS = 4000;
/** Tope de espera para reunir los candidatos ICE antes de mandar la respuesta (Meta no recibe candidatos sueltos). */
const ESPERA_CANDIDATOS_MS = 1500;
/** La tarjeta de «terminó» se queda a la vista este tiempo. */
const MOSTRAR_FIN_MS = 4000;
/** «Colgar» aparece donde estaba «Contestar»: un doble clic no debe colgar la llamada que se acaba de contestar. */
const IGNORAR_COLGAR_MS = 600;

let estado: EstadoLlamadas = { fase: 'libre' };
const oyentes = new Set<Oyente>();
let pendientes: LlamadaPendiente[] = [];
let mia: LlamadaHuerfana | null = null;
const ignoradas = new Set<number>();
let iniciado = false;
let pidiendo = false;
let otraVez = false;
let pc: RTCPeerConnection | null = null;
let microfono: MediaStream | null = null;
let audioRemoto: HTMLAudioElement | null = null;
/** Ensayo (whatsapp:llamadas --solo): en un equipo SIN micrófono se contesta igual, en silencio (solo se escucha). */
let escucharSinMicrofono = false;
let mudo: AudioContext | null = null;
let finTimer: ReturnType<typeof setTimeout> | null = null;
/** Cada intento de contestar lleva su número: si cambia (colgó, otro intento), lo que venía en camino se descarta. */
let intento = 0;
/** El POST de contestar de este intento ya salió: colgar debe avisar al servidor. */
let contestarEnviado = false;
let conectandoDesde = 0;
/** Último «Ignorar»: un doble clic no debe ignorar también la llamada siguiente, que aparece en el mismo sitio. */
let ultimoIgnorar = 0;
/** Llamada que hizo este usuario (saliente) y si ya se aplicó la respuesta SDP de Meta (llega por el webhook). */
let salienteId = 0;
let respuestaAplicada = false;
/** Si después de esto sigue «Llamando…», se cuelga (Meta deja de intentar antes; es un respaldo). */
const TOPE_LLAMANDO_MS = 90_000;
/** Mientras falta la respuesta de Meta, se pregunta seguido: sin ella no hay audio. */
const SONDEO_RESPUESTA_MS = 1500;

/** La sesión se cerró (401/419): se apaga todo (timbre, audio). El paciente queda sin audio y Meta corta sola. */
function sesionPerdida(): void {
    intento++;
    cerrarMedios();
    pendientes = [];
    mia = null;
    contestarEnviado = false;
    if (estado.fase !== 'libre') poner({ fase: 'libre' });
}

function esSesionPerdida(e: unknown): boolean {
    const status = (e as { response?: { status?: number } })?.response?.status;
    return status === 401 || status === 419;
}

export function getEstadoLlamadas(): EstadoLlamadas {
    return estado;
}

export function suscribirLlamadas(oyente: Oyente): () => void {
    oyentes.add(oyente);
    return () => {
        oyentes.delete(oyente);
    };
}

/** El navegador solo da el micrófono en una página segura (https, o http://localhost, o una dirección autorizada). */
export function microfonoDisponible(): boolean {
    return typeof window !== 'undefined' && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;
}

function poner(nuevo: EstadoLlamadas): void {
    estado = nuevo;
    timbre(nuevo.fase === 'timbrando');
    oyentes.forEach((o) => o(nuevo));
}

/** Pide las llamadas. Si ya hay una petición en camino, se repite al terminar (un aviso nunca se pierde). */
async function pedirPendientes(): Promise<void> {
    if (pidiendo) {
        otraVez = true;
        return;
    }
    pidiendo = true;
    try {
        const { data } = await axios.get<{ llamadas: LlamadaPendiente[]; mia?: LlamadaHuerfana | null; sin_microfono?: boolean }>('/admin/llamadas/pendientes');
        escucharSinMicrofono = data?.sin_microfono === true;
        pendientes = Array.isArray(data?.llamadas) ? data.llamadas : [];
        mia = data?.mia ?? null;
        repartir();
    } catch (e) {
        if (esSesionPerdida(e)) sesionPerdida(); // cerró sesión: que no siga timbrando en la pantalla de inicio
        /* sin red: se reintenta en el próximo aviso o sondeo */
    } finally {
        pidiendo = false;
        if (otraVez) {
            otraVez = false;
            void pedirPendientes();
        }
    }
}

function repartir(): void {
    // Ocupado con su llamada (o mostrando cómo terminó): no se interrumpe.
    if (estado.fase === 'conectando' || estado.fase === 'en_curso' || estado.fase === 'terminada' || estado.fase === 'llamando') return;
    // Tiene una llamada abierta sin audio aquí (recargó la página u otra pestaña): primero eso.
    if (mia) {
        if (estado.fase !== 'huerfana' || estado.llamada.id !== mia.id) poner({ fase: 'huerfana', llamada: mia });
        return;
    }
    const vigentes = pendientes.filter((l) => !ignoradas.has(l.id));
    if (vigentes.length > 0) {
        const primera = vigentes[0];
        if (estado.fase !== 'timbrando' || estado.llamada.id !== primera.id || estado.otras !== vigentes.length - 1) {
            poner({ fase: 'timbrando', llamada: primera, otras: vigentes.length - 1 });
        }
    } else if (estado.fase === 'timbrando' || estado.fase === 'huerfana') {
        poner({ fase: 'libre' });
    }
}

/** Token XSRF vivo de la cookie (el del <meta> queda viejo tras iniciar sesión por Inertia y daría 419). */
function tokenXsrf(): string {
    const m = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : '';
}

/** Arranca una sola vez (desde el marco de la app). */
export function iniciarLlamadas(): void {
    if (iniciado || typeof window === 'undefined') return;
    iniciado = true;

    alAviso((aviso) => {
        if (aviso.tipo === 'llamada' || aviso.tipo === 'reconectado') {
            void pedirPendientes();
            const actual = estado.fase === 'conectando' || estado.fase === 'en_curso' || estado.fase === 'llamando' ? estado.llamada : null;
            if (actual && (aviso.tipo === 'reconectado' || aviso.llamada_id === actual.id)) {
                if (esperaRespuestaDeMeta()) void revisarSaliente(actual);
                else void revisarEstado(actual);
            }
        }
    });
    setInterval(() => {
        if (!hayTiempoReal()) void pedirPendientes();
    }, SONDEO_SIN_TIEMPO_REAL_MS);
    setInterval(() => {
        if (estado.fase === 'timbrando') void pedirPendientes();
        if (esperaRespuestaDeMeta() && (estado.fase === 'llamando' || estado.fase === 'en_curso')) {
            // Saliente: por si el aviso se perdió. Y un tope: que no se quede «Llamando…» para siempre.
            if (estado.fase === 'llamando' && Date.now() - conectandoDesde > TOPE_LLAMANDO_MS) void colgar();
            else void revisarSaliente(estado.llamada);
        } else if (estado.fase === 'en_curso' && !hayTiempoReal()) void revisarEstado(estado.llamada);
    }, SONDEO_TIMBRANDO_MS);
    window.addEventListener('beforeunload', (e) => {
        if (estado.fase === 'en_curso' || estado.fase === 'conectando' || estado.fase === 'llamando') {
            e.preventDefault();
            e.returnValue = '';
        }
    });
    // Salió igual (recargó o cerró en plena llamada): el audio muere con la pestaña, así que se cuelga en el servidor
    // para que el paciente no quede conectado en silencio. keepalive: la petición sale aunque la página se cierre.
    window.addEventListener('pagehide', () => {
        if ((estado.fase === 'en_curso' || estado.fase === 'conectando' || estado.fase === 'llamando') && contestarEnviado && estado.llamada.id > 0) {
            try {
                void fetch(`/admin/llamadas/${estado.llamada.id}/colgar`, {
                    method: 'POST',
                    keepalive: true,
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': tokenXsrf(), 'X-Requested-With': 'XMLHttpRequest', Accept: 'application/json' },
                    body: JSON.stringify({ motivo: 'pestana' }),
                });
            } catch {
                /* Meta corta sola al dejar de recibir audio */
            }
        }
    });
    void pedirPendientes();
}

/** No contestar esta (sigue timbrando a los demás). */
export function ignorar(): void {
    if (estado.fase !== 'timbrando') return;
    if (Date.now() - ultimoIgnorar < IGNORAR_COLGAR_MS) return; // segundo clic de un doble clic: cayó en la siguiente
    ultimoIgnorar = Date.now();
    ignoradas.add(estado.llamada.id);
    poner({ fase: 'libre' });
    repartir();
}

function esperarCandidatos(conexion: RTCPeerConnection): Promise<void> {
    if (conexion.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise((resolver) => {
        const listo = () => {
            if (conexion.iceGatheringState === 'complete') {
                conexion.removeEventListener('icegatheringstatechange', listo);
                resolver();
            }
        };
        conexion.addEventListener('icegatheringstatechange', listo);
        setTimeout(resolver, ESPERA_CANDIDATOS_MS);
    });
}

export async function contestar(): Promise<void> {
    if (estado.fase !== 'timbrando') return;
    const llamada = estado.llamada;
    if (!microfonoDisponible()) {
        terminar(llamada, 'error', 'microfono_bloqueado');
        return;
    }
    const mio = ++intento;
    const vigente = () => mio === intento && estado.fase === 'conectando' && estado.llamada.id === llamada.id;
    contestarEnviado = false;
    conectandoDesde = Date.now();
    poner({ fase: 'conectando', llamada });

    // Lo de este intento va en variables propias: si se cancela a mitad, se cierra ESTO y no lo de otro intento.
    let flujo: MediaStream | null = null;
    let conexion: RTCPeerConnection | null = null;
    const soltar = () => {
        flujo?.getTracks().forEach((p) => p.stop());
        try {
            conexion?.close();
        } catch {
            /* ya cerrada */
        }
    };

    try {
        flujo = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
    } catch (e) {
        // Ensayo en un equipo sin micrófono: se contesta con silencio (se oye al paciente; él no oye nada).
        if ((e as DOMException)?.name === 'NotFoundError' && escucharSinMicrofono) flujo = flujoMudo();
        if (!flujo) {
            soltar();
            if (vigente()) terminar(llamada, 'error', 'microfono_denegado');
            return;
        }
    }
    if (!vigente()) return soltar(); // colgó mientras el navegador pedía el micrófono

    try {
        // Sin servidores STUN/TURN: Meta ofrece sus direcciones públicas (ICE lite) y este navegador las alcanza.
        conexion = new RTCPeerConnection();
        const esta = conexion;
        microfono = flujo;
        pc = esta;
        esta.ontrack = (ev) => {
            if (pc !== esta) return;
            if (!audioRemoto) {
                audioRemoto = new Audio();
                audioRemoto.autoplay = true;
            }
            audioRemoto.srcObject = ev.streams[0] ?? new MediaStream([ev.track]);
            void audioRemoto.play().catch(() => {});
        };
        esta.onconnectionstatechange = () => {
            if (pc === esta && esta.connectionState === 'failed') {
                void colgarEnServidor(llamada, 'red');
                cerrarMedios();
                terminar(llamada, 'error', 'red');
            }
        };
        // Primero la oferta y luego la pista del micrófono: así usa el mismo canal de audio que ofreció Meta.
        await esta.setRemoteDescription({ type: 'offer', sdp: llamada.sdp_oferta });
        flujo.getAudioTracks().forEach((pista) => esta.addTrack(pista, flujo!));
        const respuesta = await esta.createAnswer();
        await esta.setLocalDescription(respuesta);
        await esperarCandidatos(esta);
        if (!vigente()) return; // colgó mientras se preparaba (cerrarMedios ya soltó todo)
        const sdp = esta.localDescription?.sdp ?? respuesta.sdp ?? '';

        contestarEnviado = true;
        const { data } = await axios.post<{ ok: boolean; error?: string }>(`/admin/llamadas/${llamada.id}/contestar`, { sdp });
        if (!data?.ok) throw Object.assign(new Error(data?.error || 'meta'), { codigo: data?.error });
        if (!vigente()) {
            // Colgó mientras el servidor contestaba: Meta ya la aceptó, así que se cuelga allá también.
            void colgarEnServidor(llamada);
            return;
        }
        poner({ fase: 'en_curso', llamada, inicio: Date.now(), silenciado: false });
    } catch (e) {
        if (mio !== intento) return; // de un intento ya cancelado: no toca nada
        const err = e as { response?: { status?: number; data?: { error?: string } }; codigo?: string };
        cerrarMedios();
        soltar();
        const yaNo = err.response?.status === 409 && err.response?.data?.error === 'ya_no_timbra';
        terminar(llamada, yaNo ? 'otro' : 'error', yaNo ? undefined : (err.response?.data?.error ?? err.codigo ?? 'conexion'));
    }
}

// ── Llamar al paciente (saliente) ───────────────────────────────────────────────────────────────────────────────────

export type DestinoLlamada = { conversation_id: number; nombre: string | null; telefono: string | null };

/** Es una saliente de este usuario a la que todavía le falta la respuesta de Meta (o el «contestó»). */
function esperaRespuestaDeMeta(): boolean {
    if (estado.fase === 'llamando') return true;
    return estado.fase === 'en_curso' && estado.llamada.id === salienteId && !respuestaAplicada;
}

/**
 * Llamar al paciente de un chat. Este navegador arma la OFERTA WebRTC (micrófono incluido), el servidor se la pasa a
 * Meta y la respuesta de Meta llega después por el webhook: se recoge en /estado (aviso de tiempo real o sondeo).
 */
export async function llamar(destino: DestinoLlamada): Promise<void> {
    if (estado.fase !== 'libre' && estado.fase !== 'terminada') return;
    if (finTimer) clearTimeout(finTimer);
    finTimer = null;
    const borrador: LlamadaPendiente = {
        id: 0,
        conversation_id: destino.conversation_id,
        nombre: destino.nombre,
        telefono: destino.telefono,
        desde: new Date().toISOString(),
        sdp_oferta: '',
    };
    const mio = ++intento;
    const vigente = () => mio === intento && estado.fase === 'llamando';
    contestarEnviado = false;
    respuestaAplicada = false;
    salienteId = 0;
    conectandoDesde = Date.now();
    poner({ fase: 'llamando', llamada: borrador, sonando: false });

    let flujo: MediaStream | null = null;
    let conexion: RTCPeerConnection | null = null;
    const soltar = () => {
        flujo?.getTracks().forEach((p) => p.stop());
        try {
            conexion?.close();
        } catch {
            /* ya cerrada */
        }
    };

    if (microfonoDisponible()) {
        try {
            flujo = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            });
        } catch (e) {
            if ((e as DOMException)?.name === 'NotFoundError' && escucharSinMicrofono) flujo = flujoMudo();
        }
    }
    if (!flujo) {
        if (vigente()) terminar(borrador, 'error', microfonoDisponible() ? 'microfono_denegado' : 'microfono_bloqueado');
        return;
    }
    if (!vigente()) return soltar();

    try {
        conexion = new RTCPeerConnection();
        const esta = conexion;
        microfono = flujo;
        pc = esta;
        esta.ontrack = (ev) => {
            if (pc !== esta) return;
            if (!audioRemoto) {
                audioRemoto = new Audio();
                audioRemoto.autoplay = true;
            }
            audioRemoto.srcObject = ev.streams[0] ?? new MediaStream([ev.track]);
            void audioRemoto.play().catch(() => {});
        };
        esta.onconnectionstatechange = () => {
            if (pc !== esta || esta.connectionState !== 'failed') return;
            const actual = estado.fase === 'llamando' || estado.fase === 'en_curso' ? estado.llamada : borrador;
            if (actual.id > 0) void colgarEnServidor(actual, 'red');
            intento++;
            cerrarMedios();
            terminar(actual, 'error', 'red');
        };
        flujo.getAudioTracks().forEach((pista) => esta.addTrack(pista, flujo!));
        const oferta = await esta.createOffer();
        await esta.setLocalDescription(oferta);
        await esperarCandidatos(esta);
        if (!vigente()) return; // colgó mientras se preparaba (cerrarMedios ya soltó todo)
        const sdp = esta.localDescription?.sdp ?? oferta.sdp ?? '';

        contestarEnviado = true;
        const { data } = await axios.post<{ ok: boolean; error?: string | null; llamada?: LlamadaHuerfana | null }>(
            `/admin/llamadas/llamar/${destino.conversation_id}`,
            { sdp },
        );
        if (!data?.ok || !data.llamada) throw Object.assign(new Error(data?.error || 'meta'), { codigo: data?.error ?? undefined });
        const llamada: LlamadaPendiente = { ...borrador, id: data.llamada.id, nombre: data.llamada.nombre ?? borrador.nombre, telefono: data.llamada.telefono ?? borrador.telefono };
        salienteId = llamada.id;
        if (!vigente()) {
            // Colgó mientras el servidor llamaba: se cuelga allá también.
            void colgarEnServidor(llamada);
            return;
        }
        poner({ fase: 'llamando', llamada, sonando: false });
        void revisarSaliente(llamada);
        // La respuesta de Meta llega por el webhook (y el aviso de tiempo real); por si el aviso se demora, se pregunta.
        void (async () => {
            const sigue = () => estado.fase === 'llamando' && estado.llamada.id === llamada.id && !respuestaAplicada;
            for (let i = 0; i < 40 && sigue(); i++) {
                await new Promise((r) => setTimeout(r, SONDEO_RESPUESTA_MS));
                if (sigue()) await revisarSaliente(llamada);
            }
        })();
    } catch (e) {
        if (mio !== intento) return; // de un intento ya cancelado: no toca nada
        const err = e as { response?: { status?: number; data?: { error?: string | null } }; codigo?: string };
        intento++;
        cerrarMedios();
        soltar();
        terminar(borrador, 'error', err.response?.data?.error ?? err.codigo ?? 'conexion');
    }
}

/** Cómo va la saliente: aplica la respuesta de Meta cuando llega y sigue «sonando» → «en curso» → fin. */
async function revisarSaliente(llamada: LlamadaPendiente): Promise<void> {
    if (!llamada.id) return;
    try {
        const { data } = await axios.get<{ estado: string; duracion: number | null; motivo?: string | null; sdp_respuesta?: string | null }>(
            `/admin/llamadas/${llamada.id}/estado`,
        );
        const sigue = () => (estado.fase === 'llamando' || estado.fase === 'en_curso') && estado.llamada.id === llamada.id;
        if (!sigue()) return;

        const esta = pc;
        if (data.sdp_respuesta && !respuestaAplicada && esta) {
            respuestaAplicada = true;
            try {
                await esta.setRemoteDescription({ type: 'answer', sdp: data.sdp_respuesta });
            } catch {
                if (!sigue()) return;
                intento++;
                cerrarMedios();
                void colgarEnServidor(llamada);
                terminar(llamada, 'error', 'conexion');
                return;
            }
            if (!sigue()) return;
        }

        const ahora = estado;
        if (data.estado === 'sonando' && ahora.fase === 'llamando' && !ahora.sonando) {
            poner({ ...ahora, sonando: true });
        } else if (data.estado === 'en_curso' && ahora.fase === 'llamando') {
            poner({ fase: 'en_curso', llamada: ahora.llamada, inicio: Date.now(), silenciado: false });
        } else if (['rechazada', 'perdida', 'fallida', 'terminada'].includes(data.estado)) {
            intento++;
            cerrarMedios();
            if (data.estado === 'terminada') terminar(llamada, 'colgo', undefined, data.duracion ?? undefined);
            else if (data.estado === 'rechazada') terminar(llamada, 'error', 'rechazo');
            else if (data.estado === 'perdida') terminar(llamada, 'error', data.motivo === 'cancelo' ? 'cancelada' : 'no_contesto');
            else terminar(llamada, 'error', (data.motivo ?? '').split(':')[0] || 'meta');
        }
    } catch (e) {
        if (esSesionPerdida(e)) sesionPerdida();
        /* sin red: se reintenta con el próximo aviso o sondeo */
    }
}

export function silenciar(): void {
    if (estado.fase !== 'en_curso' || !microfono) return;
    const silenciado = !estado.silenciado;
    microfono.getAudioTracks().forEach((p) => (p.enabled = !silenciado));
    poner({ ...estado, silenciado });
}

export async function colgar(): Promise<void> {
    if (estado.fase === 'huerfana') {
        const llamada = estado.llamada;
        mia = null;
        // Primero la tarjeta y después el servidor: si mientras tanto entra otra llamada, no se pisa.
        terminar({ ...llamada, sdp_oferta: '' }, 'colgo');
        await colgarEnServidor({ id: llamada.id });
        return;
    }
    if (estado.fase !== 'en_curso' && estado.fase !== 'conectando' && estado.fase !== 'llamando') return;
    // Doble clic en «Contestar»: el segundo cae en «Colgar» (en «Conectando…» o ya en curso, si conectó muy rápido).
    if (Date.now() - conectandoDesde < IGNORAR_COLGAR_MS) return;
    const llamada = estado.llamada;
    const duracion = estado.fase === 'en_curso' ? Math.round((Date.now() - estado.inicio) / 1000) : undefined;
    const cancelada = estado.fase === 'llamando';
    // Saliente: el servidor solo la conoce cuando ya tiene número (si el POST de llamar va en camino, lo cuelga llamar()).
    const avisar = contestarEnviado && llamada.id > 0;
    intento++; // cancela lo que venga en camino de contestar() o llamar()
    cerrarMedios();
    if (cancelada) terminar(llamada, 'error', 'cancelada');
    else terminar(llamada, 'colgo', undefined, duracion);
    if (avisar) await colgarEnServidor(llamada);
}

async function colgarEnServidor(llamada: Pick<LlamadaPendiente, 'id'>, motivo?: 'red'): Promise<void> {
    try {
        await axios.post(`/admin/llamadas/${llamada.id}/colgar`, motivo ? { motivo } : {});
    } catch {
        /* si falla, Meta corta sola al dejar de recibir audio */
    }
}

/** El paciente colgó (o Meta cortó): se mira el estado en el servidor. */
async function revisarEstado(llamada: LlamadaPendiente): Promise<void> {
    try {
        const { data } = await axios.get<{ estado: string; duracion: number | null }>(`/admin/llamadas/${llamada.id}/estado`);
        const local = estado;
        if ((local.fase !== 'en_curso' && local.fase !== 'conectando') || local.llamada.id !== llamada.id) return;
        // Mientras aquí dice «Conectando…», en el servidor puede seguir «timbrando» (todavía no llegó el contestar).
        const viva = data.estado === 'en_curso' || data.estado === 'conectando' || (local.fase === 'conectando' && data.estado === 'timbrando');
        if (viva) return;
        intento++;
        cerrarMedios();
        terminar(llamada, data.estado === 'fallida' ? 'error' : 'colgo', data.estado === 'fallida' ? 'meta' : undefined, data.duracion ?? undefined);
    } catch (e) {
        if (esSesionPerdida(e)) sesionPerdida();
        /* sin red: se reintenta con el próximo aviso */
    }
}

function terminar(llamada: LlamadaPendiente, motivo: 'colgo' | 'otro' | 'error', detalle?: string, duracion?: number): void {
    ignoradas.add(llamada.id);
    contestarEnviado = false;
    poner({ fase: 'terminada', llamada, motivo, detalle, duracion });
    if (finTimer) clearTimeout(finTimer);
    finTimer = setTimeout(() => {
        finTimer = null;
        if (estado.fase === 'terminada') {
            poner({ fase: 'libre' });
            void pedirPendientes();
        }
    }, MOSTRAR_FIN_MS);
}

/** Cerrar la tarjeta de «terminó» antes de tiempo. */
export function cerrarAviso(): void {
    if (estado.fase !== 'terminada') return;
    if (finTimer) clearTimeout(finTimer);
    finTimer = null;
    poner({ fase: 'libre' });
    void pedirPendientes();
}

/** Pista de audio en silencio (ensayo sin micrófono): Meta corta la llamada si no le llega audio. */
function flujoMudo(): MediaStream | null {
    try {
        void mudo?.close().catch(() => {});
        mudo = new AudioContext();
        void mudo.resume().catch(() => {});
        const destino = mudo.createMediaStreamDestination();
        const tono = mudo.createOscillator();
        const volumen = mudo.createGain();
        volumen.gain.value = 0;
        tono.connect(volumen).connect(destino);
        tono.start();
        return destino.stream;
    } catch {
        return null;
    }
}

function cerrarMedios(): void {
    const conexion = pc;
    pc = null;
    try {
        conexion?.close();
    } catch {
        /* ya cerrada */
    }
    microfono?.getTracks().forEach((p) => p.stop());
    microfono = null;
    if (mudo) {
        void mudo.close().catch(() => {});
        mudo = null;
    }
    if (audioRemoto) {
        audioRemoto.pause();
        audioRemoto.srcObject = null;
    }
}

// ── Timbre: «trin-trin» de teléfono cada 3 s, con Web Audio (sin archivos). Si el navegador no deja sonar todavía
// (nadie ha tocado la página), la tarjeta igual aparece. 19/11/2026: el de dos notas suaves casi no se oía. ──
let ctx: AudioContext | null = null;
let timbreTimer: ReturnType<typeof setInterval> | null = null;
/** Volumen del timbre (0–1). Pasa por un compresor: suena fuerte sin saturar los parlantes. */
const VOLUMEN_TIMBRE = 0.7;

function sonarUnaVez(): void {
    try {
        ctx ??= new AudioContext();
        if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
        const t0 = ctx.currentTime + 0.02;
        const compresor = ctx.createDynamicsCompressor();
        const salida = ctx.createGain();
        salida.gain.value = VOLUMEN_TIMBRE;
        compresor.connect(salida).connect(ctx.destination);
        // Dos ráfagas de ~0,45 s; cada una es un trino rápido entre dos notas, como el timbre de un teléfono.
        for (const rafaga of [0, 0.7]) {
            for (let k = 0; k < 6; k++) {
                const t = t0 + rafaga + k * 0.075;
                const osc = ctx.createOscillator();
                const vol = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.value = k % 2 ? 1046.5 : 784;
                vol.gain.setValueAtTime(0.0001, t);
                vol.gain.exponentialRampToValueAtTime(1, t + 0.008);
                vol.gain.setValueAtTime(1, t + 0.06);
                vol.gain.exponentialRampToValueAtTime(0.0001, t + 0.072);
                osc.connect(vol).connect(compresor);
                osc.start(t);
                osc.stop(t + 0.075);
            }
        }
    } catch {
        /* sin audio: solo la tarjeta */
    }
}

function timbre(encendido: boolean): void {
    if (encendido && !timbreTimer) {
        sonarUnaVez();
        timbreTimer = setInterval(sonarUnaVez, 3000);
    } else if (!encendido && timbreTimer) {
        clearInterval(timbreTimer);
        timbreTimer = null;
    }
}

/** Prefijo que se pone al título de la pestaña mientras timbra (lo quita igual quien lo encuentre). */
export const PREFIJO_TITULO = '📞 ';
export function quitarPrefijoLlamada(titulo: string): string {
    return titulo.startsWith(PREFIJO_TITULO) ? titulo.replace(/^📞 [^·]*· /, '') : titulo;
}
