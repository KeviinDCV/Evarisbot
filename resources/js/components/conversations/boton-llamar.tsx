import { getEstadoLlamadas, llamar, suscribirLlamadas, type EstadoLlamadas } from '@/lib/llamadas';
import { usePage } from '@inertiajs/react';
import { Phone } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

/** Tiempo que el botón espera el segundo clic («¿Llamar?») antes de volver a ser solo el ícono. */
const CONFIRMAR_MS = 4000;

/**
 * Botón «Llamar» de la cabecera del chat: llama al paciente por WhatsApp desde este navegador (ver lib/llamadas). Pide un
 * segundo clic, porque la llamada sale de inmediato y Meta la cobra por minuto. Solo aparece si el servidor lo permite
 * (prop compartida `llamarPermitido`: llamadas activas y, en ensayo, solo para los usuarios del ensayo).
 */
export function BotonLlamar({ conversacion }: { conversacion: { id: number; contact_name?: string | null; phone_number?: string | null } }) {
    const { t } = useTranslation();
    const { llamarPermitido } = usePage<{ llamarPermitido?: boolean }>().props;
    const [estado, setEstado] = useState<EstadoLlamadas>(getEstadoLlamadas);
    const [confirmar, setConfirmar] = useState(false);
    const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => suscribirLlamadas(setEstado), []);
    useEffect(
        () => () => {
            if (reloj.current) clearTimeout(reloj.current);
        },
        [],
    );
    // Cambió de chat con el «¿Llamar?» a la vista: que no quede armado para el otro paciente.
    useEffect(() => {
        setConfirmar(false);
        if (reloj.current) clearTimeout(reloj.current);
    }, [conversacion.id]);

    if (!llamarPermitido) return null;
    const ocupado = estado.fase !== 'libre' && estado.fase !== 'terminada';

    const alClic = () => {
        if (ocupado) return;
        if (!confirmar) {
            setConfirmar(true);
            if (reloj.current) clearTimeout(reloj.current);
            reloj.current = setTimeout(() => setConfirmar(false), CONFIRMAR_MS);
            return;
        }
        if (reloj.current) clearTimeout(reloj.current);
        setConfirmar(false);
        void llamar({ conversation_id: conversacion.id, nombre: conversacion.contact_name ?? null, telefono: conversacion.phone_number ?? null });
    };

    const titulo = ocupado ? t('llamadas.yaEnLlamada') : t('llamadas.llamarPaciente');

    return (
        <button
            type="button"
            onClick={alClic}
            aria-disabled={ocupado}
            aria-label={confirmar ? t('llamadas.confirmarLlamar') : titulo}
            title={titulo}
            className={
                confirmar
                    ? 'inline-flex h-9 items-center gap-1.5 rounded-full bg-emerald-600 px-3 text-sm font-semibold text-white transition-[background-color,scale] hover:bg-emerald-700 active:scale-[0.96]'
                    : `flex h-9 w-9 items-center justify-center rounded-full text-[#2e3f84] transition-colors hover:bg-muted dark:text-neutral-300 dark:hover:bg-neutral-800 ${ocupado ? 'cursor-not-allowed opacity-40' : ''}`
            }
        >
            <Phone className={confirmar ? 'h-4 w-4' : 'h-5 w-5'} />
            {confirmar && <span>{t('llamadas.confirmarLlamar')}</span>}
        </button>
    );
}
