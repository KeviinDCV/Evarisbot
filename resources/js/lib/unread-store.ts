/**
 * Contadores de no leídos (conversaciones + chat interno) en un store a NIVEL DE MÓDULO.
 *
 * ¿Por qué fuera de React? AdminLayout no es un layout persistente de Inertia (se envuelve
 * dentro de cada página), así que se DESMONTA y se re-monta en cada navegación. Con el bucle
 * dentro de un useEffect, cada cambio de página disparaba dos fetches inmediatos y reiniciaba
 * el temporizador desde cero — anulando por completo la mitigación de ERR_NO_BUFFER_SPACE
 * (Windows agota la tabla de sockets con peticiones concurrentes).
 *
 * Viviendo en el módulo, el bucle sobrevive a los re-montajes: mantiene su propio temporizador
 * y su backoff, y los componentes sólo se suscriben. Consigue el beneficio real del layout
 * persistente sin tocar las 20 páginas.
 *
 * Las dos cuentas se piden en SECUENCIA (nunca dos sockets a la vez), con jitter para no
 * sincronizar con los polls de la página de chat y backoff exponencial ante fallos.
 *
 * Con tiempo real (lib/tiempo-real) se piden en cuanto llega un aviso —también con la pestaña oculta,
 * que es justo cuando hace falta avisar al asesor— y la consulta periódica queda de respaldo cada 60 s.
 */
import { agrupar, alAviso, hayTiempoReal } from './tiempo-real';

// chatMensajes: suma de mensajes sin leer en esas conversaciones (sube aunque el mismo paciente vuelva a escribir y la
// cifra de conversaciones no cambie; la usa la notificación de escritorio).
export type UnreadState = { chat: number; internal: number; chatMensajes: number };

type Listener = (state: UnreadState) => void;

const HEADERS = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
const BASE_MS = 20000;
const BASE_CON_TIEMPO_REAL_MS = 60000;
const MAX_MS = 60000;
const JITTER_MS = 4000;

let state: UnreadState = { chat: 0, internal: 0, chatMensajes: 0 };
const listeners = new Set<Listener>();

let timer: ReturnType<typeof setTimeout> | null = null;
let failures = 0;
let running = false;

function emit() {
    for (const l of listeners) l(state);
}

async function fetchCount(url: string): Promise<{ count: number; mensajes: number; anuncios?: AnuncioPendiente[] }> {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const count = Number(data.count) || 0;
    return { count, mensajes: Number(data.mensajes) || count, anuncios: Array.isArray(data.anuncios) ? data.anuncios : undefined };
}

/**
 * Anuncios de lectura obligatoria que le faltan a esta persona (components/anuncio-obligatorio.tsx). Llegan con el
 * contador del chat interno, que ya se pide en todas las páginas: no hace falta otra petición.
 */
export type AnuncioPendiente = { id: number; cuerpo: string; autor: string; creado: string | null; segundos: number };
let anuncios: AnuncioPendiente[] = [];
const oyentesAnuncios = new Set<(lista: AnuncioPendiente[]) => void>();

function ponerAnuncios(lista: AnuncioPendiente[]) {
    if (lista.map((a) => a.id).join(',') === anuncios.map((a) => a.id).join(',')) return;
    anuncios = lista;
    for (const l of oyentesAnuncios) l(anuncios);
}

export function subscribeAnuncios(listener: (lista: AnuncioPendiente[]) => void): () => void {
    oyentesAnuncios.add(listener);
    listener(anuncios);
    return () => {
        oyentesAnuncios.delete(listener);
    };
}

/** Tras «Entendido» (ya guardado en el servidor): se quita sin esperar a la siguiente ronda. */
export function quitarAnuncio(id: number): void {
    ponerAnuncios(anuncios.filter((a) => a.id !== id));
}

function schedule(delay: number) {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(poll, delay);
}

let pidiendo = false;
let pendiente = false;

async function poll(porAviso = false): Promise<void> {
    if (!running) return;

    // Con la pestaña oculta no se pide nada por tiempo; se re-chequea más tarde. Un aviso sí se atiende.
    if (!porAviso && typeof document !== 'undefined' && document.hidden) {
        schedule(BASE_MS);
        return;
    }
    // Nunca dos rondas a la vez (Windows y ERR_NO_BUFFER_SPACE): un aviso que llegue durante otra ronda se atiende
    // justo al terminar esa (pudo leer las cifras antes del cambio).
    if (pidiendo) {
        pendiente = true;
        return;
    }
    pidiendo = true;

    try {
        const chat = await fetchCount('/admin/chat/unread-count');
        // Secuencial: el interno sólo sale cuando el primero ya cerró su socket.
        const interno = await fetchCount('/admin/internal-chat/unread-count');
        const internal = interno.count;
        if (interno.anuncios) ponerAnuncios(interno.anuncios);
        failures = 0;
        if (chat.count !== state.chat || internal !== state.internal || chat.mensajes !== state.chatMensajes) {
            state = { chat: chat.count, internal, chatMensajes: chat.mensajes };
            emit();
        }
    } catch {
        failures++;
    } finally {
        pidiendo = false;
        if (running && pendiente) {
            pendiente = false;
            if (timer !== null) clearTimeout(timer);
            timer = setTimeout(() => void poll(true), 300);
        } else if (running) {
            const ritmo = hayTiempoReal() ? BASE_CON_TIEMPO_REAL_MS : BASE_MS;
            const base = Math.min(ritmo * Math.pow(2, failures), Math.max(MAX_MS, ritmo));
            schedule(base + Math.floor(Math.random() * JITTER_MS));
        }
    }
}

// Avisos que cambian los contadores: un mensaje visible del paciente, cambios de la conversación (asignar, resolver,
// leer), el chat interno y la vuelta del tiempo real tras un corte. Agrupados (un webhook manda varios seguidos) y como
// mucho una ronda cada 3 s: en las horas de más movimiento, cada asesor no pide a cada mensaje.
const pedirPorAviso = agrupar(
    () => {
        if (running) void poll(true);
    },
    600,
    2400,
    3000,
);
let quitarAvisos: (() => void) | null = null;

function onVisibility() {
    if (!document.hidden && running) {
        failures = 0;
        void poll();
    }
}

/**
 * Suscribe un componente. El bucle arranca con el primer suscriptor y NO se detiene en los
 * re-montajes de navegación: sólo para cuando no queda ninguno (p. ej. al cerrar sesión).
 */
export function subscribeUnread(listener: Listener): () => void {
    listeners.add(listener);
    listener(state); // estado actual inmediato, sin esperar al siguiente tick

    if (!running) {
        running = true;
        document.addEventListener('visibilitychange', onVisibility);
        quitarAvisos = alAviso((aviso) => {
            if (['mensaje_entrante', 'conversacion', 'chat_interno', 'reconectado'].includes(aviso.tipo)) pedirPorAviso();
        });
        void poll();
    }

    return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
            running = false;
            if (timer !== null) clearTimeout(timer);
            timer = null;
            document.removeEventListener('visibilitychange', onVisibility);
            quitarAvisos?.();
            quitarAvisos = null;
        }
    };
}

/** Estado actual (para inicializar useState sin esperar al primer emit). */
export function getUnread(): UnreadState {
    return state;
}

/** Semilla desde el servidor (Inertia comparte unreadConversationsCount en el primer render). */
export function seedUnreadChat(count: number): void {
    if (state.chat !== count) {
        state = { ...state, chat: count };
        emit();
    }
}
