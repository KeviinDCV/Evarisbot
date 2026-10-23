import { router } from '@inertiajs/react';
import axios from 'axios';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

/**
 * TIEMPO REAL (Laravel Reverb), como WhatsApp.
 *
 * El servidor (App\Support\TiempoReal) avisa «la conversación X cambió» por un canal PRIVADO, y cada pantalla pide al
 * instante los datos por sus rutas de siempre, que aplican los permisos de cada asesor. Los avisos no traen datos de
 * pacientes: solo el tipo y los ids.
 *
 * Si no hay conexión (Reverb apagado, la página se abrió por https, red caída…) no se rompe nada: cada pantalla sigue
 * con su consulta periódica, que vuelve a su ritmo rápido mientras no haya tiempo real. Pusher reconecta solo.
 *
 * Vive a nivel de módulo (como unread-store): sobrevive a las navegaciones de Inertia, que vuelven a montar el layout.
 */
export type TipoAviso =
    | 'mensaje_entrante'
    | 'mensaje'
    | 'estado'
    | 'conversacion'
    | 'escribiendo'
    | 'chat_interno'
    // Solo de la pantalla: el tiempo real volvió tras un corte. Pudo perderse algún aviso: cada pantalla vuelve a pedir.
    | 'reconectado';

export type Aviso = {
    tipo: TipoAviso;
    conversation_id?: number;
    conversation_ids?: number[];
    chat_id?: number;
};

type OyenteAviso = (aviso: Aviso) => void;
type OyenteConexion = (conectado: boolean) => void;

/** Si el servidor rechaza un canal (sesión vencida, permiso…), se reintenta a los 30 s. */
const REINTENTO_CANAL_MS = 30000;

const oyentes = new Set<OyenteAviso>();
const oyentesConexion = new Set<OyenteConexion>();

// «Hay tiempo real» = socket conectado Y los dos canales privados suscritos (si la autorización falla, el socket
// sigue abierto pero no llega ningún aviso: las pantallas deben seguir consultando a su ritmo rápido).
let socketConectado = false;
const canalesSuscritos = new Set<string>();
let canalesEsperados: string[] = [];
let conectado = false;
let yaHuboTiempoReal = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let echo: any = null;
let usuarioIniciado: number | null = null;
let vigilandoSesion = false;
const reintentos = new Map<string, ReturnType<typeof setTimeout>>();

/** Al salir (cualquier botón de cerrar sesión), la página nueva ya no trae usuario: se cierra la conexión. */
function vigilarSesion() {
    if (vigilandoSesion) return;
    vigilandoSesion = true;
    router.on('navigate', (event) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const usuario = (event.detail.page.props as any)?.auth?.user;
        if (!usuario && echo) detenerTiempoReal();
    });
}

function repartir(aviso: Aviso) {
    if (!aviso || typeof aviso.tipo !== 'string') return;
    for (const o of oyentes) {
        try {
            o(aviso);
        } catch {
            /* un oyente roto no apaga a los demás */
        }
    }
}

function recalcular() {
    const valor = socketConectado && canalesEsperados.length > 0 && canalesEsperados.every((c) => canalesSuscritos.has(c));
    if (valor === conectado) return;
    conectado = valor;
    for (const o of oyentesConexion) {
        try {
            o(valor);
        } catch {
            /* un oyente roto no apaga a los demás */
        }
    }
    if (valor) {
        // Al volver tras un corte, lo ocurrido mientras tanto no llegó por aviso: que cada pantalla pida ya.
        if (yaHuboTiempoReal) repartir({ tipo: 'reconectado' });
        yaHuboTiempoReal = true;
    }
}

function suscribir(canal: string) {
    if (!echo) return;
    const instancia = echo;
    instancia
        .private(canal)
        .listen('.aviso', repartir)
        .subscribed(() => {
            if (echo !== instancia) return;
            canalesSuscritos.add(canal);
            recalcular();
        })
        .error(() => {
            if (echo !== instancia) return;
            canalesSuscritos.delete(canal);
            recalcular();
            // Pusher no reintenta un canal rechazado: se deja y se vuelve a pedir más tarde (si sigue la misma conexión).
            if (reintentos.has(canal)) return;
            reintentos.set(
                canal,
                setTimeout(() => {
                    reintentos.delete(canal);
                    if (echo !== instancia) return;
                    try {
                        instancia.leaveChannel(`private-${canal}`);
                    } catch {
                        /* ya no estaba */
                    }
                    suscribir(canal);
                }, REINTENTO_CANAL_MS),
            );
        });
}

/**
 * Conecta (una sola vez por usuario) y se suscribe a los canales privados del personal y del propio usuario.
 * Sin clave o con la página en https no hace nada: Reverb escucha ws:// en la red local, no wss://.
 */
export function iniciarTiempoReal(userId: number): void {
    if (typeof window === 'undefined' || !userId) return;
    if (usuarioIniciado === userId && echo) return;

    const clave = import.meta.env.VITE_REVERB_APP_KEY as string | undefined;
    const puerto = Number(import.meta.env.VITE_REVERB_PORT || 8080);
    if (!clave || window.location.protocol !== 'http:') return;

    detenerTiempoReal();
    vigilarSesion();
    usuarioIniciado = userId;

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).Pusher = Pusher;
        echo = new Echo({
            broadcaster: 'reverb',
            key: clave,
            // El mismo equipo que sirvió la página (p. ej. 192.168.2.172): así funciona desde cualquier PC de la red.
            wsHost: window.location.hostname,
            wsPort: puerto,
            wssPort: puerto,
            forceTLS: false,
            enabledTransports: ['ws'],
            // Autorización de los canales privados por axios: usa el token XSRF vivo de la cookie (el <meta> queda
            // viejo tras iniciar sesión por Inertia y daría 419).
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            authorizer: (channel: any) => ({
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                authorize: (socketId: string, callback: (error: any, data: any) => void) => {
                    axios
                        .post('/broadcasting/auth', { socket_id: socketId, channel_name: channel.name })
                        .then((r) => callback(null, r.data))
                        .catch((e) => callback(e, null));
                },
            }),
        });

        const conexion = echo.connector?.pusher?.connection;
        conexion?.bind('state_change', (estados: { current: string }) => {
            socketConectado = estados.current === 'connected';
            // Al caerse el socket se pierden las suscripciones; Pusher las repite al reconectar y vuelve a confirmarlas.
            if (!socketConectado) canalesSuscritos.clear();
            recalcular();
        });

        canalesEsperados = ['conversaciones', `App.Models.User.${userId}`];
        for (const canal of canalesEsperados) suscribir(canal);
    } catch {
        detenerTiempoReal();
    }
}

/** Cierra la conexión (cambio de usuario o cierre de sesión). */
export function detenerTiempoReal(): void {
    try {
        echo?.disconnect();
    } catch {
        /* ya estaba cerrada */
    }
    echo = null;
    usuarioIniciado = null;
    for (const t of reintentos.values()) clearTimeout(t);
    reintentos.clear();
    socketConectado = false;
    canalesSuscritos.clear();
    canalesEsperados = [];
    yaHuboTiempoReal = false;
    recalcular();
}

/** Escucha los avisos. Devuelve la función para dejar de escuchar. */
export function alAviso(oyente: OyenteAviso): () => void {
    oyentes.add(oyente);
    return () => {
        oyentes.delete(oyente);
    };
}

/** Escucha los cambios de conexión (para acelerar o frenar la consulta periódica). */
export function alCambiarConexion(oyente: OyenteConexion): () => void {
    oyentesConexion.add(oyente);
    return () => {
        oyentesConexion.delete(oyente);
    };
}

/** ¿Hay tiempo real ahora mismo? (conectado y con los canales autorizados) */
export function hayTiempoReal(): boolean {
    return conectado;
}

/** ¿El aviso toca esta conversación? */
export function avisoDe(aviso: Aviso, conversationId: number | null | undefined): boolean {
    if (!conversationId) return false;
    return aviso.conversation_id === conversationId || (aviso.conversation_ids?.includes(conversationId) ?? false);
}

/**
 * Agrupa llamadas seguidas en una sola, al final de la ráfaga: un webhook dispara varios avisos en pocos milisegundos
 * y basta con pedir los datos una vez, ya con el estado final.
 * - esperaMs: silencio que se espera antes de ejecutar.
 * - maximoMs: con avisos sin pausa, se ejecuta igual pasado este tiempo desde el primero.
 * - minimoEntreMs: separación mínima entre dos ejecuciones (freno para las horas de más movimiento: muchos asesores
 *   pidiendo a la vez cada vez que escribe un paciente).
 */
export function agrupar(fn: () => void, esperaMs: number, maximoMs = esperaMs * 4, minimoEntreMs = 0): () => void {
    let temporizador: ReturnType<typeof setTimeout> | null = null;
    let primera = 0;
    let ultimaVez = 0;
    return () => {
        const ahora = Date.now();
        if (temporizador === null) primera = ahora;
        else clearTimeout(temporizador);
        // Ambos límites son instantes fijos (primera + máximo, última + mínimo): la ráfaga no puede aplazarla para siempre.
        const espera = Math.max(Math.min(esperaMs, primera + maximoMs - ahora), ultimaVez + minimoEntreMs - ahora, 0);
        temporizador = setTimeout(() => {
            temporizador = null;
            ultimaVez = Date.now();
            fn();
        }, espera);
    };
}
