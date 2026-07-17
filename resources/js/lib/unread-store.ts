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
 */
export type UnreadState = { chat: number; internal: number };

type Listener = (state: UnreadState) => void;

const HEADERS = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
const BASE_MS = 20000;
const MAX_MS = 60000;
const JITTER_MS = 4000;

let state: UnreadState = { chat: 0, internal: 0 };
const listeners = new Set<Listener>();

let timer: ReturnType<typeof setTimeout> | null = null;
let failures = 0;
let running = false;

function emit() {
    for (const l of listeners) l(state);
}

async function fetchCount(url: string): Promise<number> {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.count || 0;
}

function schedule(delay: number) {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(poll, delay);
}

async function poll(): Promise<void> {
    if (!running) return;

    // Con la pestaña oculta no se pide nada; se re-chequea más tarde.
    if (typeof document !== 'undefined' && document.hidden) {
        schedule(BASE_MS);
        return;
    }

    try {
        const chat = await fetchCount('/admin/chat/unread-count');
        // Secuencial: el interno sólo sale cuando el primero ya cerró su socket.
        const internal = await fetchCount('/admin/internal-chat/unread-count');
        failures = 0;
        if (chat !== state.chat || internal !== state.internal) {
            state = { chat, internal };
            emit();
        }
    } catch {
        failures++;
    } finally {
        if (running) {
            const base = Math.min(BASE_MS * Math.pow(2, failures), MAX_MS);
            schedule(base + Math.floor(Math.random() * JITTER_MS));
        }
    }
}

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
        void poll();
    }

    return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
            running = false;
            if (timer !== null) clearTimeout(timer);
            timer = null;
            document.removeEventListener('visibilitychange', onVisibility);
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
