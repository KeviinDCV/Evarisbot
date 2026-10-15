import { router } from '@inertiajs/react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

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

        const channel = (window as any).Echo?.channel('conversations');

        const handler = (data: any) => {
            // NewMessageReceived: { message: { is_from_user, content, conversation_id }, conversation: {...} }
            // MessageSent (saliente): is_from_user = false → se ignora
            const msg = data?.message ?? data;
            const isIncoming = msg?.is_from_user === true || msg?.is_from_user === 1;
            if (!isIncoming) return;

            // Solo notificar si la pestaña NO está enfocada (segundo plano)
            if (!document.hidden) return;

            const conv = data?.conversation ?? {};
            const name = conv.contact_name || conv.phone_number || t('conversations.patientFallback');
            const body = (data?.message?.content || t('conversations.newMessage')).toString().slice(0, 120);
            const convId = data?.message?.conversation_id ?? conv.id;

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
                    const n = new Notification(t('conversations.newMessageFrom', { name }), {
                        body,
                        tag: 'evarisbot-new-message',
                        icon: '/favicon.ico',
                        renotify: true,
                    } as NotificationOptions);
                    n.onclick = () => {
                        window.focus();
                        if (convId) router.visit(`/admin/chat/${convId}`);
                        n.close();
                    };
                } catch {
                    /* algunos navegadores requieren Service Worker; ignoramos */
                }
            }
        };

        channel?.listen('.new.message', handler);
        window.addEventListener('focus', restoreTitle);
        document.addEventListener('visibilitychange', onVisible);

        return () => {
            channel?.stopListening('.new.message', handler);
            window.removeEventListener('focus', restoreTitle);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [t]);

    return null;
}
