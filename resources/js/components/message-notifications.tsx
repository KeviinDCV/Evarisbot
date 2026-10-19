import { router } from '@inertiajs/react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getUnread, subscribeUnread } from '@/lib/unread-store';

// --- Sonido (sintetizado, sin archivos) ---
let audioCtx: AudioContext | null = null;
function playDing() {
    try {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        if (!Ctx) return;
        audioCtx = audioCtx || new Ctx();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(1320, now + 0.09);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.32);
    } catch {
        /* silencioso */
    }
}

/**
 * Notifica mensajes nuevos de pacientes SOLO cuando la pestaña está en segundo plano
 * (sonido + notificación de escritorio + parpadeo del título). Cuando el asesor está
 * activo en la pestaña no suena: ya ve la bandeja y el badge. Así no es ruidoso.
 *
 * Componente invisible: se monta una vez en el layout (global a toda la app).
 */
export function MessageNotifications() {
    const { t } = useTranslation();
    const pendingRef = useRef(0);
    const cleanTitleRef = useRef<string>(typeof document !== 'undefined' ? document.title : '');
    const lastSoundRef = useRef(0);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().catch(() => {});
        }

        const restoreTitle = () => {
            pendingRef.current = 0;
            if (cleanTitleRef.current) document.title = cleanTitleRef.current;
        };

        const onVisible = () => {
            if (!document.hidden) restoreTitle();
            else cleanTitleRef.current = document.title; // capturar título limpio al ocultar
        };

        // Con tiempo real, el contador del menú (unread-store) se pide en cuanto entra un mensaje del paciente, también con
        // la pestaña oculta. Si SUBE en segundo plano, se avisa: sonido, título y notificación de escritorio. Sin datos
        // del paciente: el aviso de tiempo real solo trae ids, y aquí solo se sabe cuántas conversaciones de ESTE asesor
        // tienen mensajes sin leer (respeta lo que cada uno puede ver). Antes escuchaba un canal público con el texto.
        // También cuando sube la suma de mensajes: el mismo paciente que vuelve a escribir no cambia la otra cifra.
        // Los primeros 3 s no avisa: al cargar, la primera lectura del contador no es un mensaje nuevo.
        const montado = Date.now();
        let anterior = getUnread();
        const quitarContador = subscribeUnread((estado) => {
            const subio = estado.chat > anterior.chat || estado.chatMensajes > anterior.chatMensajes;
            anterior = estado;
            if (!subio || !document.hidden || Date.now() - montado < 3000) return;

            // Sonido (con throttle para no saturar en ráfagas)
            const now = Date.now();
            if (now - lastSoundRef.current > 3500) {
                lastSoundRef.current = now;
                playDing();
            }

            // Parpadeo del título
            if (!cleanTitleRef.current) cleanTitleRef.current = document.title;
            pendingRef.current += 1;
            document.title = `(${pendingRef.current}) 💬 ${t('conversations.newMessageTitle')} · Evarisbot`;

            // Notificación de escritorio (coalescida por tag)
            if ('Notification' in window && Notification.permission === 'granted') {
                try {
                    const n = new Notification(t('conversations.newMessageTitle'), {
                        body: t('conversations.unreadNotificationBody', { count: estado.chat }),
                        tag: 'evarisbot-new-message',
                        icon: '/favicon.ico',
                        renotify: true,
                    } as NotificationOptions);
                    n.onclick = () => {
                        window.focus();
                        // Ya en Conversaciones basta con traer la pestaña al frente (sin recargar ni perder el chat abierto).
                        if (!window.location.pathname.startsWith('/admin/chat')) router.visit('/admin/chat');
                        n.close();
                    };
                } catch {
                    /* algunos navegadores requieren Service Worker; ignoramos */
                }
            }
        });

        window.addEventListener('focus', restoreTitle);
        document.addEventListener('visibilitychange', onVisible);

        return () => {
            quitarContador();
            window.removeEventListener('focus', restoreTitle);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [t]);

    return null;
}
