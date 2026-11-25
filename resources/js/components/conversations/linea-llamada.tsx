import { nombrePropio } from '@/lib/nombres';
import { cn } from '@/lib/utils';
import { CircleAlert, Clock, Phone, PhoneIncoming, PhoneMissed, PhoneOff, PhoneOutgoing, Voicemail } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * LLAMADAS DENTRO DEL CHAT (diseño aprobado el 19/11/2026: design/vista-llamadas-chat, opción B).
 *
 * Cada llamada de WhatsApp es una línea centrada entre los mensajes, en su hora: «Llamada perdida · nadie contestó ·
 * dejó un mensaje de voz» o «Llamada de WhatsApp · la atendió … · duró 3:12». El audio que dejó en el buzón es un
 * mensaje más del chat; encima lleva «Mensaje que dejó en el buzón».
 */

export type LlamadaChat = {
    id: number;
    resultado: 'timbrando' | 'en_curso' | 'atendida' | 'cortada' | 'buzon' | 'fuera_horario' | 'fallida' | 'perdida' | 'rechazada';
    inicio: string | null;
    duracion: number | null;
    atendio: string | null;
    buzon_message_id: number | null;
    /** 'saliente' = la hizo Evarisbot (un asesor llamó al paciente). */
    direccion?: 'entrante' | 'saliente';
    motivo?: string | null;
    /** Llamada del ROBOT (recordatorio de cita por voz): qué pasó con la cita. */
    robot?: 'confirmo' | 'cancelo' | 'en_curso' | 'sin_marcar' | 'no_se_pudo' | 'rechazo' | 'no_contesto' | 'no_llamar' | null;
};

type ConFecha = { id: number; created_at: string };

/**
 * Reparte las llamadas entre los mensajes: cada una va justo antes del primer mensaje que llegó después de ella; las
 * posteriores al último mensaje van al final. Los mensajes llegan ordenados por fecha.
 */
export function repartirLlamadas(mensajes: ConFecha[], llamadas: LlamadaChat[]): { antes: Map<number, LlamadaChat[]>; alFinal: LlamadaChat[] } {
    const antes = new Map<number, LlamadaChat[]>();
    const alFinal: LlamadaChat[] = [];
    const ordenadas = llamadas.filter((l) => l.inicio).sort((a, b) => Date.parse(a.inicio!) - Date.parse(b.inicio!));
    let i = 0;
    for (const l of ordenadas) {
        const cuando = Date.parse(l.inicio!);
        while (i < mensajes.length && Date.parse(mensajes[i].created_at) < cuando) i++;
        if (i >= mensajes.length) {
            alFinal.push(l);
        } else {
            const id = mensajes[i].id;
            antes.set(id, [...(antes.get(id) ?? []), l]);
        }
    }
    return { antes, alFinal };
}

function mmss(segundos: number | null): string {
    if (!segundos || segundos < 0) return '0:00';
    const s = Math.round(segundos);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function LineaLlamada({ llamada, hora }: { llamada: LlamadaChat; hora: string }) {
    const { t } = useTranslation();
    const quien = llamada.atendio ? nombrePropio(llamada.atendio) : '';

    let tono: 'verde' | 'rojo' | 'gris' | 'ambar' = 'gris';
    let Icono = Phone;
    let titulo = '';
    let detalle = '';
    if (llamada.robot) {
        // Recordatorio por llamada (voz automática): «Recordatorio por llamada · confirmó la cita», «· no contestó»…
        Icono = PhoneOutgoing;
        titulo = t('llamadas.chat.robot');
        detalle = t(`llamadas.chat.robotResultado.${llamada.robot}`);
        tono = { confirmo: 'verde', cancelo: 'rojo', en_curso: 'ambar', sin_marcar: 'ambar', no_se_pudo: 'rojo', rechazo: 'gris', no_contesto: 'gris', no_llamar: 'gris' }[llamada.robot] as typeof tono;
        if (llamada.robot === 'no_contesto' || llamada.robot === 'rechazo') Icono = PhoneMissed;
        if (llamada.robot === 'no_se_pudo') Icono = CircleAlert;
    } else if (llamada.direccion === 'saliente') {
        // Las que hizo un asesor: «Llamada saliente · llamó Andrea · duró 2:10», «· el paciente no contestó»…
        Icono = PhoneOutgoing;
        titulo = t('llamadas.chat.saliente');
        switch (llamada.resultado) {
            case 'atendida':
                tono = 'verde';
                detalle = quien ? t('llamadas.chat.laHizo', { nombre: quien, duracion: mmss(llamada.duracion) }) : t('llamadas.chat.duro', { duracion: mmss(llamada.duracion) });
                break;
            case 'cortada':
                tono = 'ambar';
                Icono = PhoneOff;
                detalle = t('llamadas.chat.seCorto', { duracion: mmss(llamada.duracion) });
                break;
            case 'en_curso':
                tono = 'verde';
                titulo = t('llamadas.chat.enCurso');
                detalle = quien ? t('llamadas.chat.laHace', { nombre: quien }) : '';
                break;
            case 'timbrando':
                tono = 'ambar';
                detalle = t('llamadas.chat.sonandoPaciente');
                break;
            case 'rechazada':
                tono = 'rojo';
                Icono = PhoneMissed;
                detalle = t('llamadas.chat.laRechazo');
                break;
            case 'fallida':
                tono = 'rojo';
                Icono = CircleAlert;
                detalle = t('llamadas.chat.noSePudoLlamar');
                break;
            default:
                tono = llamada.motivo === 'cancelo' ? 'gris' : 'rojo';
                Icono = PhoneMissed;
                detalle = llamada.motivo === 'cancelo' ? t('llamadas.chat.cancelada') : t('llamadas.chat.noContesto');
        }
    } else switch (llamada.resultado) {
        case 'atendida':
            tono = 'verde';
            titulo = t('llamadas.chat.deWhatsApp');
            detalle = quien ? t('llamadas.chat.laAtendio', { nombre: quien, duracion: mmss(llamada.duracion) }) : t('llamadas.chat.duro', { duracion: mmss(llamada.duracion) });
            break;
        case 'cortada':
            tono = 'ambar';
            Icono = PhoneOff;
            titulo = t('llamadas.chat.deWhatsApp');
            detalle = quien ? t('llamadas.chat.seCortoCon', { nombre: quien, duracion: mmss(llamada.duracion) }) : t('llamadas.chat.seCorto', { duracion: mmss(llamada.duracion) });
            break;
        case 'buzon':
            tono = 'rojo';
            Icono = PhoneMissed;
            titulo = t('llamadas.chat.perdida');
            detalle = t('llamadas.chat.dejoMensaje');
            break;
        case 'perdida':
            tono = 'rojo';
            Icono = PhoneMissed;
            titulo = t('llamadas.chat.perdida');
            detalle = t('llamadas.chat.nadieContesto');
            break;
        case 'fuera_horario':
            tono = 'gris';
            Icono = Clock;
            titulo = t('llamadas.chat.fueraDeHorario');
            detalle = t('llamadas.chat.noTimbro');
            break;
        case 'fallida':
            tono = 'rojo';
            Icono = CircleAlert;
            titulo = t('llamadas.chat.sinConectar');
            detalle = t('llamadas.chat.noSePudo');
            break;
        case 'en_curso':
            tono = 'verde';
            Icono = PhoneIncoming;
            titulo = t('llamadas.chat.enCurso');
            detalle = quien ? t('llamadas.chat.laAtiende', { nombre: quien }) : '';
            break;
        default:
            tono = 'ambar';
            Icono = PhoneIncoming;
            titulo = t('llamadas.chat.entrante');
            detalle = t('llamadas.chat.timbrando');
    }

    const anillo = {
        verde: 'shadow-[0_1px_1px_rgba(0,0,0,.06),inset_0_0_0_1px_#a7f3d0] dark:shadow-[inset_0_0_0_1px_rgba(52,211,153,.35)]',
        rojo: 'shadow-[0_1px_1px_rgba(0,0,0,.06),inset_0_0_0_1px_#fecaca] dark:shadow-[inset_0_0_0_1px_rgba(248,113,113,.35)]',
        ambar: 'shadow-[0_1px_1px_rgba(0,0,0,.06),inset_0_0_0_1px_#fde68a] dark:shadow-[inset_0_0_0_1px_rgba(251,191,36,.35)]',
        gris: 'shadow-[0_1px_1px_rgba(0,0,0,.06),inset_0_0_0_1px_#e1e4ef] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,.12)]',
    }[tono];
    const tinta = {
        verde: 'text-emerald-800 dark:text-emerald-300',
        rojo: 'text-red-700 dark:text-red-300',
        ambar: 'text-amber-800 dark:text-amber-300',
        gris: 'text-[#3c4570] dark:text-neutral-200',
    }[tono];
    const tintaIcono = {
        verde: 'text-emerald-700 dark:text-emerald-400',
        rojo: 'text-red-600 dark:text-red-400',
        ambar: 'text-amber-700 dark:text-amber-400',
        gris: 'text-[#5c6485] dark:text-neutral-400',
    }[tono];

    return (
        <div className="flex justify-center px-2 py-1">
            <p
                className={cn(
                    'flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-0.5 rounded-[15px] bg-white px-3 py-[5px] text-center text-[12.5px] leading-5 text-[#3b4a54] dark:bg-neutral-800 dark:text-neutral-300',
                    anillo,
                )}
            >
                <Icono className={cn('size-3.5 shrink-0', tintaIcono)} strokeWidth={2.25} aria-hidden="true" />
                <strong className={cn('font-semibold', tinta)}>{titulo}</strong>
                {detalle && <span>· {detalle}</span>}
                {hora && <span className="text-[#667781] tabular-nums dark:text-neutral-400">· {hora}</span>}
            </p>
        </div>
    );
}

/** Lo que va encima del audio que el paciente dejó en el buzón. */
export function EtiquetaBuzon() {
    const { t } = useTranslation();
    return (
        <p className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-semibold text-amber-700 dark:text-amber-400">
            <Voicemail className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
            {t('llamadas.chat.mensajeBuzon')}
        </p>
    );
}
