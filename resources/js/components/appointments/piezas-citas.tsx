import { nombrePropio } from '@/lib/nombres';
import { cn } from '@/lib/utils';
import { CalendarCheck2, CalendarX, Clock, Phone, Search, X } from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

// nombrePropio vive en lib/nombres (una sola copia); se sigue exportando desde aquí porque otras
// pantallas (Envíos masivos, Chat interno, Plantillas) lo importan de este archivo.
export { nombrePropio };

/* ── Piezas compartidas por el panel de Citas y la lista completa (General y Oncología) ────────────
   Lenguaje de design/vista-citas/gen_citas.mjs, el mismo de Usuarios, Configuración y Estadísticas:
   navy #2e3f84 con alfa sobre la hoja blanca; en oscuro, blanco con alfa sobre bg-card. */

export const FILETE = 'border-[#2e3f84]/8 dark:border-white/8';
export const TEXTO_NAVY = 'text-[#2e3f84] dark:text-neutral-100';
// En oscuro el muted-foreground no llega a 4,5:1 sobre la banda tintada: sube a neutral-400.
export const TEXTO_SUAVE = 'text-muted-foreground dark:text-neutral-400';
// outline-hidden (no outline-none): con el contraste alto de Windows el anillo (una sombra) desaparece
// y el contorno transparente sí se pinta. Igual que Configuración y Estadísticas.
export const FOCO = 'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#2e3f84]/40 dark:focus-visible:ring-[#8b9ae0]/60';
export const MONO = "[font-family:ui-monospace,'Cascadia_Mono','SF_Mono',Consolas,monospace]";
export const BANDA = 'bg-[#2e3f84]/[0.028] dark:bg-white/[0.03]';
export const HOJA =
    '@container/hoja rounded-2xl bg-card shadow-[0_0_0_1px_rgba(46,63,132,0.07),0_1px_2px_rgba(46,63,132,0.05),0_14px_32px_-18px_rgba(46,63,132,0.22)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07),0_14px_32px_-18px_rgba(0,0,0,0.6)]';

/* ── Botones (alto 36 en la hoja) ── */
const BOTON_BASE = cn(
    'inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[10px] pr-4 pl-3.5 text-[13px] leading-[18px] font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed [&_svg]:size-[15px] [&_svg]:shrink-0',
    FOCO,
    'focus-visible:ring-offset-2 focus-visible:ring-offset-card'
);
export const BOTON_PRIMARIO = cn(
    BOTON_BASE,
    'bg-[#2e3f84] text-white shadow-[0_1px_2px_rgba(46,63,132,0.3),0_6px_16px_-6px_rgba(46,63,132,0.55),inset_0_1px_0_rgba(255,255,255,0.14)] hover:bg-[#27366f] disabled:opacity-60',
    'dark:bg-[#4e5fa4] dark:hover:bg-[#5a6bb2] dark:shadow-none'
);
export const BOTON_SECUNDARIO = cn(
    BOTON_BASE,
    'bg-white text-[#2e3f84] shadow-[inset_0_0_0_1px_rgba(46,63,132,0.2),0_1px_2px_rgba(46,63,132,0.08)] hover:bg-[#f6f7fb] disabled:opacity-60',
    'dark:bg-white/5 dark:text-neutral-100 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] dark:hover:bg-white/8'
);
// Peligro de primer paso (abre la confirmación): contorno rojo. El definitivo, dentro del diálogo, va lleno.
export const BOTON_PELIGRO = cn(
    BOTON_BASE,
    'bg-white text-red-700 shadow-[inset_0_0_0_1px_rgba(220,38,38,0.55),0_1px_2px_rgba(220,38,38,0.12)] hover:bg-red-50 disabled:opacity-60',
    'dark:bg-white/5 dark:text-red-300 dark:shadow-[inset_0_0_0_1px_rgba(248,113,113,0.5)] dark:hover:bg-red-500/10'
);
export const BOTON_PELIGRO_LLENO = cn(
    BOTON_BASE,
    'bg-[#dc2626] text-white shadow-[0_1px_2px_rgba(185,28,28,0.35),0_6px_16px_-6px_rgba(220,38,38,0.55),inset_0_1px_0_rgba(255,255,255,0.14)] hover:bg-[#b91c1c] disabled:opacity-60 dark:shadow-none'
);
// Desactivado "de verdad" (hay un envío en curso): tinta navy, sin relleno sólido.
export const BOTON_APAGADO = cn(
    BOTON_BASE,
    'bg-[#2e3f84]/5 text-muted-foreground shadow-[inset_0_0_0_1px_rgba(46,63,132,0.1)]',
    'dark:bg-white/5 dark:text-neutral-400 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]'
);

/** Especialidad SOLO para pintar: "MEDICINA  INTERNA" → "Medicina interna". */
export function oracion(texto: string) {
    const limpio = texto.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
    return limpio.charAt(0).toLocaleUpperCase('es') + limpio.slice(1);
}

/**
 * Semáforo de estados, el mismo de Configuración. ok: esmeralda 700; aviso (falta algo): ámbar 700;
 * neutro (no aplica o ya no pasará): pizarra 600; error (algo salió mal): rojo 700.
 */
export type Tono = 'ok' | 'aviso' | 'neutro' | 'error';

export const TONO_TEXTO: Record<Tono, string> = {
    ok: 'text-emerald-700 dark:text-emerald-400',
    aviso: 'text-amber-700 dark:text-amber-400',
    neutro: 'text-slate-600 dark:text-neutral-300',
    error: 'text-red-700 dark:text-red-400',
};

export const TONO_PUNTO: Record<Tono, string> = {
    ok: 'bg-emerald-600 dark:bg-emerald-500',
    aviso: 'bg-amber-700 dark:bg-amber-400',
    neutro: 'bg-slate-500 dark:bg-neutral-500',
    error: 'bg-red-600 dark:bg-red-400',
};

/* ── Fechas: siempre como fecha LOCAL (un "2026-09-16" con new Date() saldría el 15 a las 19:00 en Colombia) ── */
export function fechaLocal(ymd?: string | null): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd ?? '');
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export const esIngles = (lng?: string) => (lng ?? '').startsWith('en');

const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

/** "miércoles 16 de septiembre" (es) · "Wednesday, September 16" (en). */
export function fechaLarga(fecha: Date, lng?: string) {
    if (esIngles(lng)) return fecha.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const dia = fecha.toLocaleDateString('es-CO', { weekday: 'long' });
    const mes = fecha.toLocaleDateString('es-CO', { month: 'long' });
    return `${dia} ${fecha.getDate()} de ${mes}`;
}

/** "lun 14 sept" (es) · "Mon, Sep 14" (en). Si no es una fecha, se devuelve tal cual. */
export function fechaCorta(ymd?: string | null, lng?: string) {
    const f = fechaLocal(ymd);
    if (!f) return ymd || '-';
    if (esIngles(lng)) return f.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    return `${DIAS_CORTOS[f.getDay()]} ${f.getDate()} ${MESES_CORTOS[f.getMonth()]}`;
}

/** reminder_sent_at ("Y-m-d H:i") → "12 sept, 8:02" (es) · "Sep 12, 8:02" (en). */
export function fechaEnvio(ymdhm?: string | null, lng?: string) {
    const f = fechaLocal(ymdhm);
    if (!f || !ymdhm) return ymdhm ?? '';
    const hm = /(\d{1,2}):(\d{2})/.exec(ymdhm.slice(10));
    const hora = hm ? `${Number(hm[1])}:${hm[2]}` : '';
    if (esIngles(lng)) return `${f.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}${hora ? `, ${hora}` : ''}`;
    return `${f.getDate()} ${MESES_CORTOS[f.getMonth()]}${hora ? `, ${hora}` : ''}`;
}

/** "2026-10-15 09:05" → "9:05". Las horas ya llegan en hora de Colombia: nunca pasan por new Date(). */
export function horaDe(ymdhm?: string | null) {
    const hm = /(\d{1,2}):(\d{2})/.exec((ymdhm ?? '').slice(10));
    return hm ? `${Number(hm[1])}:${hm[2]}` : '';
}

/** Miles con punto en español ("12.640") y coma en inglés. */
export const miles = (n: number, lng?: string) => n.toLocaleString(esIngles(lng) ? 'en-US' : 'es-CO');

/* ── Tabla de citas ── */

/** Estado del recordatorio de una cita; lo calcula el servidor (Recordatorios::estadoFila) y aquí solo se pinta. */
export type EstadoRecordatorio = 'con_error' | 'enviado' | 'no_aplica' | 'sin_fecha' | 'sin_enviar' | 'sin_celular' | 'por_enviar';
export type RespuestaCita = 'confirmada' | 'cancelada' | 'cancelada_hospital' | 'sin_respuesta';

/** Una cita tal como la mandan index() y view() (misma forma en los dos). */
export interface CitaFila {
    id: number;
    nom_paciente: string | null;
    citide: string | null;
    cittid: string | null;
    pactel: string | null;
    /** Segundo teléfono (columna «pactel2» del Excel): de respaldo si el primero no tiene WhatsApp. */
    pactel2?: string | null;
    /** El recordatorio salió al segundo teléfono. */
    al_segundo?: boolean;
    citdoc: string | null;
    citfc: string | null;
    cithor: string | null;
    mednom: string | null;
    espnom: string | null;
    reminder_sent: boolean;
    reminder_sent_at: string | null;
    reminder_status: string | null;
    recordatorio: EstadoRecordatorio;
    respuesta: RespuestaCita | null;
    motivo: string | null;
}

const RECORDATORIO = {
    con_error: { clave: 'appointments.recordatorio.con_error', tono: 'error' },
    enviado: { clave: 'appointments.recordatorio.enviado', tono: 'ok' },
    por_enviar: { clave: 'appointments.recordatorio.por_enviar', tono: 'aviso' },
    sin_enviar: { clave: 'appointments.recordatorio.sin_enviar', tono: 'neutro' },
    sin_celular: { clave: 'appointments.recordatorio.sin_celular', tono: 'neutro' },
    sin_fecha: { clave: 'appointments.recordatorio.sin_fecha', tono: 'neutro' },
    no_aplica: { clave: 'appointments.recordatorio.no_aplica', tono: 'neutro' },
} as const satisfies Record<EstadoRecordatorio, { clave: string; tono: Tono }>;

/** Por qué no salió un recordatorio (las claves del contrato, 0.5). */
export const MOTIVOS = {
    telefono: 'appointments.motivo.telefono',
    sin_whatsapp: 'appointments.motivo.sin_whatsapp',
    rechazado: 'appointments.motivo.rechazado',
    datos: 'appointments.motivo.datos',
    plantilla: 'appointments.motivo.plantilla',
    cuenta: 'appointments.motivo.cuenta',
    limite: 'appointments.motivo.limite',
    temporal: 'appointments.motivo.temporal',
    caducado: 'appointments.motivo.caducado',
    sin_respuesta: 'appointments.motivo.sin_respuesta',
    otro: 'appointments.motivo.otro',
} as const;

export const claveMotivo = (motivo?: string | null) => (motivo && Object.hasOwn(MOTIVOS, motivo) ? MOTIVOS[motivo as keyof typeof MOTIVOS] : MOTIVOS.otro);

// Si un dato llegara sin el estado calculado (respuesta vieja en caché), se pinta neutro: nunca «Por enviar».
const estadoDe = (cita: CitaFila): EstadoRecordatorio =>
    cita.recordatorio && Object.hasOwn(RECORDATORIO, cita.recordatorio)
        ? cita.recordatorio
        : cita.reminder_status === 'failed'
          ? 'con_error'
          : cita.reminder_sent
            ? 'enviado'
            : 'sin_enviar';

const respuestaDe = (cita: CitaFila): RespuestaCita | null => {
    if (cita.respuesta !== undefined) return cita.respuesta;
    if (cita.reminder_status === 'confirmed') return 'confirmada';
    if (cita.reminder_status === 'cancelled') return 'cancelada';
    return cita.reminder_sent ? 'sin_respuesta' : null;
};

// Columnas: #, paciente, cita, profesional, recordatorio, respuesta. Hoja ≥ 768 px: compactas;
// ≥ 1024 px: las del diseño. Por debajo de 768 px cada cita es una tarjeta apilada.
export const COLUMNAS_CITA =
    'grid-cols-[32px_minmax(0,1.3fr)_112px_minmax(0,1fr)_118px_118px] items-center gap-x-4 px-5 @5xl/hoja:grid-cols-[40px_minmax(0,1.25fr)_132px_minmax(0,1.2fr)_150px_140px] @5xl/hoja:gap-x-5';

/** Nombre de columna de la cabecera de la tabla. */
export const Th = ({ children, className, activa = false }: { children: ReactNode; className?: string; activa?: boolean }) => (
    <span className={cn('truncate text-[11px] leading-4 font-semibold tracking-[0.07em] uppercase', activa ? TEXTO_NAVY : TEXTO_SUAVE, className)}>{children}</span>
);

/**
 * Si el recordatorio salió, cuándo, y si no, por qué. Los fallos van en rojo con su motivo (antes salían
 * como «Pendiente»); lo que ya no se enviará (cita pasada, sin celular, cancelada antes) va en gris.
 */
export function CeldaRecordatorio({ cita }: { cita: CitaFila }) {
    const { t, i18n } = useTranslation();
    const estado = estadoDe(cita);
    const { clave, tono } = RECORDATORIO[estado];
    const envio = estado === 'enviado' && cita.reminder_sent_at ? fechaEnvio(cita.reminder_sent_at, i18n.language) : null;
    const detalle =
        estado === 'con_error'
            ? t(claveMotivo(cita.motivo))
            : envio && cita.al_segundo
              ? `${envio} · ${t('appointments.sentToPhone2')}`
              : envio;

    return (
        <div className="flex min-w-0 flex-col gap-0.5">
            <span className={cn('inline-flex min-w-0 items-start gap-[7px] text-[13px] leading-[18px] font-medium', TONO_TEXTO[tono])}>
                <span className={cn('mt-[5.5px] size-[7px] shrink-0 rounded-full', TONO_PUNTO[tono])} aria-hidden="true" />
                <span className="min-w-0">
                    <span className="sr-only">{t('appointments.columnReminder')}: </span>
                    {t(clave)}
                </span>
            </span>
            {detalle && (
                <span
                    className={cn('line-clamp-2 pl-3.5 text-[12px] leading-4 tabular-nums', estado === 'con_error' ? TONO_TEXTO.error : TEXTO_SUAVE)}
                    title={estado === 'enviado' ? (cita.reminder_sent_at ?? undefined) : detalle}
                >
                    {detalle}
                </span>
            )}
        </div>
    );
}

function Pastilla({ tono, children }: { tono: 'ok' | 'mal'; children: ReactNode }) {
    return (
        <span
            className={cn(
                'inline-flex h-6 items-center gap-1.5 rounded-[7px] pr-[9px] pl-[7px] text-[12px] leading-4 font-semibold whitespace-nowrap [&_svg]:size-[13px]',
                tono === 'ok'
                    ? 'bg-emerald-50 text-emerald-700 shadow-[inset_0_0_0_1px_var(--color-emerald-200)] dark:bg-emerald-500/10 dark:text-emerald-300 dark:shadow-[inset_0_0_0_1px_rgba(16,185,129,0.25)]'
                    : 'bg-red-50 text-red-700 shadow-[inset_0_0_0_1px_var(--color-red-200)] dark:bg-red-500/10 dark:text-red-300 dark:shadow-[inset_0_0_0_1px_rgba(239,68,68,0.28)]',
                'forced-colors:border'
            )}
        >
            {children}
        </span>
    );
}

/** Qué hizo el paciente. La cancelación del hospital se distingue (y se ve aunque no saliera recordatorio). */
export function CeldaRespuesta({ cita }: { cita: CitaFila }) {
    const { t } = useTranslation();
    const respuesta = respuestaDe(cita);
    const columna = <span className="sr-only">{t('appointments.columnResponse')}: </span>;

    if (respuesta === 'confirmada') {
        return (
            <Pastilla tono="ok">
                <CalendarCheck2 strokeWidth={2} aria-hidden="true" />
                {columna}
                {t('appointments.badgeConfirmed')}
            </Pastilla>
        );
    }
    if (respuesta === 'cancelada' || respuesta === 'cancelada_hospital') {
        return (
            <span className="inline-flex flex-col items-start gap-0.5">
                <Pastilla tono="mal">
                    <CalendarX strokeWidth={2} aria-hidden="true" />
                    {columna}
                    {t('appointments.badgeCancelled')}
                </Pastilla>
                {respuesta === 'cancelada_hospital' && <span className={cn('pl-[7px] text-[12px] leading-4', TEXTO_SUAVE)}>{t('appointments.cancelledByHospital')}</span>}
            </span>
        );
    }
    if (respuesta === 'sin_respuesta') {
        return (
            <span className={cn('inline-flex items-center gap-1.5 text-[13px] leading-[18px] whitespace-nowrap', TONO_TEXTO.neutro)}>
                <Clock className="size-3.5" strokeWidth={1.9} aria-hidden="true" />
                {columna}
                {t('appointments.badgeNoResponse')}
            </span>
        );
    }
    return (
        <span className="text-[13px] leading-[18px] text-muted-foreground dark:text-neutral-400">
            <span aria-hidden="true">—</span>
            <span className="sr-only">
                {t('appointments.columnResponse')}: {t('appointments.noResponseYet')}
            </span>
        </span>
    );
}

/** Una cita: fila de rejilla en hojas ≥ 768 px; tarjeta apilada por debajo. */
export function FilaCita({ cita, indice, conCedula = false }: { cita: CitaFila; indice: number; conCedula?: boolean }) {
    const { t, i18n } = useTranslation();
    const nombre = cita.nom_paciente ? nombrePropio(cita.nom_paciente) : '-';
    const medico = cita.mednom ? nombrePropio(cita.mednom) : '-';
    const especialidad = cita.espnom ? oracion(cita.espnom) : '';
    const fecha = fechaCorta(cita.citfc, i18n.language);
    // El tipo de documento solo llega si es una sigla limpia (CC, TI, RC, CE…); si no, «Doc.».
    const tipoDocumento = cita.cittid || t('appointments.idPrefix');

    const contacto = (
        <span className="flex min-w-0 items-center gap-1.5 text-[12px] leading-4 text-muted-foreground tabular-nums dark:text-neutral-400">
            {conCedula && cita.citide ? (
                <>
                    <span className="truncate">
                        {tipoDocumento} {cita.citide}
                    </span>
                    <span aria-hidden="true">·</span>
                </>
            ) : (
                <Phone className="size-3 shrink-0" strokeWidth={2} aria-hidden="true" />
            )}
            <span className="truncate">{cita.pactel || (cita.pactel2 ? '' : '-')}</span>
            {cita.pactel2 && (
                <>
                    {cita.pactel && <span aria-hidden="true">·</span>}
                    <span className="truncate" title={t('appointments.phone2')}>
                        <span className="sr-only">{t('appointments.phone2')}: </span>
                        {cita.pactel2}
                    </span>
                </>
            )}
        </span>
    );

    return (
        <li className={cn('border-b transition-colors hover:bg-[#2e3f84]/[0.025] dark:hover:bg-white/[0.025]', FILETE)}>
            {/* Fila de escritorio */}
            <div className={cn('hidden min-h-[54px] py-2 @3xl/hoja:grid', COLUMNAS_CITA)}>
                <span className="pr-1 text-right text-[12.5px] leading-4 font-medium text-muted-foreground tabular-nums dark:text-neutral-400">{indice}</span>
                <div className="flex min-w-0 flex-col gap-0.5">
                    <span className={cn('truncate text-[13.5px] leading-[18px] font-semibold tracking-[-0.003em]', TEXTO_NAVY)} title={cita.nom_paciente ?? undefined}>
                        {nombre}
                    </span>
                    {contacto}
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                    <span className={cn('text-[13px] leading-[18px] font-medium whitespace-nowrap tabular-nums', TEXTO_NAVY)} title={cita.citfc ?? undefined}>
                        {fecha}
                    </span>
                    <span className="flex items-center gap-[5px] text-[12px] leading-4 text-muted-foreground tabular-nums dark:text-neutral-400">
                        <Clock className="size-3 shrink-0" strokeWidth={2} aria-hidden="true" />
                        {cita.cithor || '-'}
                    </span>
                </div>
                <div className="flex min-w-0 flex-col gap-0.5">
                    <span className={cn('truncate text-[13px] leading-[18px] font-medium', TEXTO_NAVY)} title={cita.mednom ?? undefined}>
                        {medico}
                    </span>
                    <span className="truncate text-[12px] leading-4 text-muted-foreground dark:text-neutral-400" title={cita.espnom ?? undefined}>
                        {especialidad || '-'}
                    </span>
                </div>
                <CeldaRecordatorio cita={cita} />
                <div className="min-w-0">
                    <CeldaRespuesta cita={cita} />
                </div>
            </div>

            {/* Tarjeta apilada (hoja < 768 px): las mismas piezas */}
            <div className="flex flex-col gap-2 px-4 py-3.5 @3xl/hoja:hidden">
                <div className="flex items-start gap-3">
                    <span className="w-6 shrink-0 pt-px text-right text-[12px] leading-[18px] font-medium text-muted-foreground tabular-nums dark:text-neutral-400">{indice}</span>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className={cn('line-clamp-2 text-[13.5px] leading-[18px] font-semibold [overflow-wrap:anywhere]', TEXTO_NAVY)} title={cita.nom_paciente ?? undefined}>
                            {nombre}
                        </span>
                        {contacto}
                    </div>
                    <div className="shrink-0">
                        <CeldaRespuesta cita={cita} />
                    </div>
                </div>
                <div className="flex flex-wrap items-start gap-x-5 gap-y-2 pl-9">
                    <div className="flex min-w-0 flex-col gap-0.5">
                        <span className={cn('text-[13px] leading-[18px] font-medium whitespace-nowrap tabular-nums', TEXTO_NAVY)}>
                            {fecha} · {cita.cithor || '-'}
                        </span>
                        <span className="text-[12px] leading-4 text-muted-foreground dark:text-neutral-400">
                            {medico}
                            {especialidad ? ` · ${especialidad}` : ''}
                        </span>
                    </div>
                    <CeldaRecordatorio cita={cita} />
                </div>
            </div>
        </li>
    );
}

/** Buscador de la hoja (campo tintado, como el de Usuarios), con la X para vaciarlo de Configuración. */
export function Buscador({
    id,
    etiqueta,
    placeholder,
    value,
    onChange,
    className,
}: {
    id: string;
    etiqueta: string;
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
    className?: string;
}) {
    const { t } = useTranslation();
    const campo = useRef<HTMLInputElement>(null);

    return (
        <div className={cn('relative', className)}>
            <label htmlFor={id} className="sr-only">
                {etiqueta}
            </label>
            <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground dark:text-neutral-400"
                strokeWidth={1.75}
                aria-hidden="true"
            />
            <input
                ref={campo}
                id={id}
                name={id}
                type="text"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className={cn(
                    'h-9 w-full rounded-[10px] bg-[#2e3f84]/[0.035] pr-9 pl-[38px] text-[13px] leading-[18px] text-foreground shadow-[inset_0_0_0_1px_rgba(46,63,132,0.1)] transition-shadow placeholder:text-muted-foreground forced-colors:border dark:bg-white/5 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] dark:placeholder:text-neutral-400',
                    FOCO
                )}
            />
            {value && (
                <button
                    type="button"
                    onClick={() => {
                        onChange('');
                        campo.current?.focus();
                    }}
                    className={cn(
                        'absolute top-1/2 right-2 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-[#2e3f84]/8 hover:text-[#2e3f84] dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-neutral-100',
                        FOCO
                    )}
                    aria-label={t('common.clearSearch')}
                    title={t('common.clearSearch')}
                >
                    <X className="size-3.5" aria-hidden="true" />
                </button>
            )}
        </div>
    );
}
