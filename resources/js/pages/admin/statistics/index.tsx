import AdminLayout from '@/layouts/admin-layout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import i18n from '@/i18n';
import { iniciales, nombrePropio } from '@/lib/nombres';
import { plano } from '@/lib/texto';
import { cn } from '@/lib/utils';
import { Head, router, usePage } from '@inertiajs/react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import axios from 'axios';
import {
    Activity,
    ArrowDown,
    ArrowRight,
    ArrowUp,
    Award,
    Bot,
    CalendarCheck2,
    CalendarRange,
    ChevronRight,
    ChevronsUpDown,
    CircleAlert,
    FileSpreadsheet,
    FileText,
    Headphones,
    Hourglass,
    Info,
    Loader2,
    MessageSquare,
    MessagesSquare,
    RotateCw,
    Search,
    Send,
    Timer,
    TrendingUp,
    Wallet,
    X,
    type LucideIcon,
} from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface AdvisorDetail {
    advisor: { id: number; name: string };
    summary: {
        /** Solo mensajes escritos por la persona (sin masivos, ocultos ni fallidos). */
        messages_sent: number;
        total_conversations: number;
        resolved_conversations: number;
        scheduled_conversations: number;
        active_conversations: number;
        pending_conversations: number;
        /** null = sin conversaciones en el período: «Sin datos», no un 0 %. */
        resolution_rate: number | null;
        /** Mediana (no media) de la espera del paciente hasta la respuesta de una persona; sin tope de 24 h. */
        median_response_time_minutes: number | null;
        /** Cuántas de esas esperas pasaron de 24 h (informativo). */
        waits_over_24h?: number;
        /** Conversaciones que se le liberaron por no responder a tiempo (liberación automática). */
        released_inactive?: number;
    };
    /** Días de Colombia. La etiqueta la arma la pantalla en su idioma (el servidor ya no la manda). */
    daily_activity: Array<{ date: string; count: number }>;
    hourly_distribution: Array<{ hour: string; count: number }>;
    message_types: Record<string, number>;
}

interface AdvisorSummary {
    id: number;
    name: string;
    total_conversations: number;
    resolved_conversations: number;
    scheduled_conversations: number;
    active_conversations: number;
    conversations_with_unread: number;
    /** Solo mensajes escritos (sin masivos, ocultos ni fallidos). */
    messages_sent: number;
    /** null = el asesor no tiene conversaciones asignadas (sin datos), distinto de 0%. */
    resolution_rate: number | null;
    /** Liberadas por inactividad en el periodo (opcional: la caché de 5 min puede no traerlo aún). */
    released_inactive?: number;
}

/** Vacío de datos conocido que se cruza con el período (incidentes, meses sin guardar…). */
interface DataGap {
    key: string;
    topics: string[];
    from: string;
    to: string | null;
}

/*
 * Los campos marcados como opcionales son los nuevos del contrato: durante los 5 minutos de caché tras
 * publicar pueden llegar cifras con la forma anterior, y la pantalla tiene que seguir pintándose.
 */
interface Statistics {
    messages: {
        total: number;
        sent_by_system: number;
        received_from_users: number;
        /** Escritos por pacientes: sin ocultos ni toques de botón (Confirmar/Cancelar…). */
        received_written?: number;
        /** received_from_users − received_written. */
        button_taps?: number;
        delivery_status: {
            pending: number;
            sent: number;
            delivered: number;
            read: number;
            failed: number;
        };
    };
    appointments: {
        /** Citas con FECHA en el período (hora de Colombia), no citas cargadas en el período. */
        total: number;
        reminder_sent: number;
        confirmed: number;
        /** = cancelled_by_patient + cancelled_by_hospital (compatibilidad). */
        cancelled: number;
        cancelled_by_patient?: number;
        /** Canceladas al enviar la plantilla de cancelación: no es una respuesta del paciente. */
        cancelled_by_hospital?: number;
        pending: number;
        failed: number;
        /** Recordatorio enviado, sin respuesta. */
        awaiting_reply: number;
        /** confirmed + cancelled_by_patient + awaiting_reply: el centro del anillo es la suma de la leyenda. */
        with_reminder_base?: number;
        /** Citas del total con fecha posterior a hoy. */
        future?: number;
        by_status: Record<string, number>;
    };
    /** Creadas en el período, contadas por su estado ACTUAL. */
    conversations: {
        total: number;
        active: number;
        pending: number;
        in_progress: number;
        resolved: number;
        closed: number;
        scheduled: number;
        unread: number;
    };
    /** total = respuestas rápidas (de hoy); los envíos son SOLO los masivos del período. */
    templates: {
        total: number;
        successful_sends: number;
        failed_sends: number;
        total_sends: number;
    };
    costs?: {
        currency: string;
        rates_as_of: string;
        by_category: Record<string, { billable: number; free: number; rate: number; cost: number }>;
        // Un punto por día (hora Colombia) con facturables y coste; el mes se agrega aquí.
        series?: { day: string; billable: number; cost: number }[];
        total_cost: number;
        billable_total: number;
        free_total: number;
        outbound_total: number;
        with_pricing: number;
        without_pricing: number;
        coverage_percent: number;
        /** Facturables de categorías sin tarifa configurada: no suman al costo. */
        billable_without_rate?: number;
        /** Con categoría pero sin confirmar si se cobran (van dentro de without_pricing). */
        unconfirmed?: number;
    };
    users: {
        total: number;
        admins: number;
        advisors: number;
        /** admins + advisors (sin el usuario IA). */
        team_total?: number;
    };
    advisors: {
        total_advisors: number;
        total_conversations: number;
        total_resolved: number;
        total_scheduled: number;
        total_active: number;
        total_with_unread: number;
        total_messages_sent: number;
        /** null si no hay conversaciones. */
        avg_resolution_rate: number | null;
        total_released_inactive?: number;
        /** Si la liberación automática está encendida hoy. */
        auto_release_enabled?: boolean;
        /** null si nadie resolvió nada o hay empate en el máximo. */
        top_performer: AdvisorSummary | null;
        advisors: AdvisorSummary[];
    };
    flowDemand?: {
        total: number;
        accepted_privacy: number;
        reached_menu: number;
        by_service: Record<string, number>;
        by_outcome: Record<string, number>;
        by_regimen: Record<string, number>;
        top_eps: { name: string; value: number }[];
        top_sub_service: { name: string; value: number }[];
        automation_rate: number;
    };
    /** Fechas EN HORA DE COLOMBIA; end es el fin real del período (puede ser futuro). 'all' sin rango → null. */
    date_range: {
        start?: string | null;
        end?: string | null;
        period: string;
        custom?: boolean;
    };
    /** Cuándo se calcularon las cifras (ISO con -05:00). */
    generated_at?: string;
    data_gaps?: DataGap[];
}

interface StatisticsIndexProps {
    // statistics es opcional porque llega DIFERIDA (Inertia v2 deferred prop): está ausente en la
    // respuesta inicial y en la de cada cambio de filtro, hasta que llega la segunda petición.
    statistics?: Statistics;
}

type ErrorCarga = 'session' | 'other' | null;

interface StatisticsViewProps {
    statistics: Statistics;
    /** Se están pidiendo cifras nuevas: se siguen pintando las anteriores, atenuadas. */
    actualizando: boolean;
    errorCarga: ErrorCarga;
    lento: boolean;
    onReintentar: () => void;
}

/* ── Tintas de la vista (design/vista-estadisticas/gen_estadisticas.mjs) ──────────────────────────
   Mismo lenguaje que Usuarios y Configuración: navy #2e3f84 con alfa sobre la hoja blanca; en oscuro,
   blanco con alfa sobre bg-card. */
const FILETE = 'border-[#2e3f84]/8 dark:border-white/8';
const FILETE_BG = 'bg-[#2e3f84]/8 dark:bg-white/8';
const TEXTO_NAVY = 'text-[#2e3f84] dark:text-neutral-100';
// Ayudas y rótulos: en oscuro el muted-foreground no llega a 4,5:1 sobre la banda tintada (4,45:1),
// así que sube a neutral-400 (5,85:1). En claro, #5c6485 da 5,7:1 sobre la banda y 5,9:1 sobre la hoja.
const TEXTO_SUAVE = 'text-muted-foreground dark:text-neutral-400';
// outline-hidden (no outline-none): con el contraste alto de Windows el contorno sí se ve. Igual que Configuración.
const FOCO = 'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#2e3f84]/40 dark:focus-visible:ring-[#8b9ae0]/60';
const BANDA = 'bg-[#2e3f84]/[0.028] dark:bg-white/[0.03]';
// Texto con color (AA sobre la hoja), el semáforo de Configuración: esmeralda 700, ámbar 700, rojo 700.
const TXT_OK = 'text-emerald-700 dark:text-emerald-400';
const TXT_AVISO = 'text-amber-700 dark:text-amber-400';
const TXT_MAL = 'text-red-700 dark:text-red-400';
const TXT_NEUTRO = 'text-slate-600 dark:text-neutral-300';
const PUNTO_AVISO = 'bg-amber-700 dark:bg-amber-400';
const PUNTO_OK = 'bg-emerald-600 dark:bg-emerald-500';
// El texto de la hoja arranca a 64 px (20 de sangría + 32 de la ranura del icono de la banda + 12).
const SANGRIA = 'px-4 @3xl/hoja:pr-5 @3xl/hoja:pl-16';
const HOJA =
    'rounded-2xl bg-card shadow-[0_0_0_1px_rgba(46,63,132,0.07),0_1px_2px_rgba(46,63,132,0.05),0_14px_32px_-18px_rgba(46,63,132,0.22)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07),0_14px_32px_-18px_rgba(0,0,0,0.6)]';
const SOMBRA_FLOTANTE =
    'shadow-[0_0_0_1px_rgba(46,63,132,0.1),0_2px_4px_rgba(46,63,132,0.06),0_12px_28px_-12px_rgba(46,63,132,0.35)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_12px_28px_-12px_rgba(0,0,0,0.7)]';
const TH = cn('text-[11px] leading-4 font-semibold tracking-[0.07em] uppercase', TEXTO_SUAVE);

/* ── Paleta de gráficos ────────────────────────────────────────────────────────────────────────────
   La del generador (contraste ≥ 3:1 contra la hoja). En oscuro, el mismo tono un paso más claro
   (≥ 3:1 contra bg-card); la serie principal sube a #aab5ee para separarse de la secundaria. Van en
   variables para que recharts (fill="var(--g-…)") y los divs usen lo mismo; se declaran en la raíz de
   la vista y en el panel lateral (que va en un portal). */
const VARS_GRAFICOS =
    '[--g-serie:#2e3f84] [--g-serie2:#7c88c0] [--g-ok:#059669] [--g-pend:#d97706] [--g-mal:#dc2626] [--g-curso:#0284c7] [--g-neutro:#64748b] [--g-pista:rgba(46,63,132,0.07)] [--g-rejilla:rgba(46,63,132,0.08)] [--g-base:rgba(46,63,132,0.16)] [--g-eje:#5c6485] [--g-realce:rgba(46,63,132,0.05)] dark:[--g-serie:#aab5ee] dark:[--g-serie2:#5f6db5] dark:[--g-ok:#10b981] dark:[--g-pend:#f59e0b] dark:[--g-mal:#ef4444] dark:[--g-curso:#0ea5e9] dark:[--g-neutro:#94a3b8] dark:[--g-pista:rgba(255,255,255,0.07)] dark:[--g-rejilla:rgba(255,255,255,0.08)] dark:[--g-base:rgba(255,255,255,0.16)] dark:[--g-eje:#a3a3a3] dark:[--g-realce:rgba(255,255,255,0.05)]';
const G = {
    serie: 'var(--g-serie)',
    serie2: 'var(--g-serie2)',
    ok: 'var(--g-ok)',
    pend: 'var(--g-pend)',
    mal: 'var(--g-mal)',
    curso: 'var(--g-curso)',
    neutro: 'var(--g-neutro)',
    pista: 'var(--g-pista)',
    rejilla: 'var(--g-rejilla)',
    base: 'var(--g-base)',
    eje: 'var(--g-eje)',
    realce: 'var(--g-realce)',
};
const EJE = { fill: G.eje, fontSize: 11 };

/* ── Formatos: siguen el idioma de la interfaz (en inglés, «1,234» y «57.2%») ─────────────────────── */

const ZONA = 'America/Bogota';
const loc = () => (i18n.language?.startsWith('en') ? 'en-US' : 'es-CO');
const esIngles = () => loc() === 'en-US';

function formatNumber(value: number | null | undefined) {
    return Number(value ?? 0).toLocaleString(loc());
}

/** «57,2 %» en español, «57.2%» en inglés. */
function conPorcentaje(valor: number, decimales: number) {
    const texto = valor.toLocaleString(loc(), { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
    return esIngles() ? `${texto}%` : `${texto} %`;
}

/** Tasa que ya llega calculada del servidor, siempre con un decimal. null = sin datos («—»). */
function formatRate(value: number | null | undefined) {
    if (value === null || value === undefined) return '—';
    return conPorcentaje(Number(value), 1);
}

/** Parte de un total, para las leyendas del diseño ("57,2 %"). */
function pct(value: number, total: number, digits = 1) {
    if (!total) return conPorcentaje(0, 0);
    return conPorcentaje((value / total) * 100, digits);
}

/**
 * Duración en minutos → texto legible. Antes se rotulaba siempre como "{n} min",
 * de modo que una espera de 14 horas se leía "860,5 min".
 */
function formatDuration(minutes: number) {
    if (minutes < 1) return '< 1 min';
    if (minutes < 60) return `${Math.round(minutes)} min`;

    const horas = Math.floor(minutes / 60);
    const resto = Math.round(minutes % 60);
    return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}

function formatMoney(value: number | null | undefined, currency = 'USD', maxDigits = 2) {
    try {
        return new Intl.NumberFormat(loc(), {
            style: 'currency',
            currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: maxDigits,
        }).format(Number(value ?? 0));
    } catch {
        return `${currency} ${Number(value ?? 0).toFixed(maxDigits)}`;
    }
}

/** Ancho de una barra sobre su pista: proporción v/max; lo que no es cero se ve siempre (≥ 1,2 %). */
function anchoBarra(value: number, max: number) {
    if (!max || value <= 0) return '0%';
    return `${Math.min(100, Math.max((value / max) * 100, 1.2))}%`;
}

/** Marcas "redondas" del eje Y (0; 0,5; 1; 1,5…): paso 1-2-2,5-5 × 10ⁿ con como mucho `objetivo` tramos. */
function marcasRedondas(max: number, objetivo = 5) {
    if (!(max > 0)) return [0, 1];
    const base = 10 ** Math.floor(Math.log10(max / objetivo));
    const paso = [1, 2, 2.5, 5, 10].map((m) => m * base).find((p) => Math.ceil(max / p) <= objetivo) ?? 10 * base;
    const tramos = Math.max(1, Math.ceil(max / paso - 1e-9));
    return Array.from({ length: tramos + 1 }, (_, i) => Number((i * paso).toFixed(6)));
}

/* ── Fechas (las del servidor ya vienen en hora de Colombia, como 'YYYY-MM-DD') ──────────────────── */

const dos = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' → Date local (sin desfase de zona). */
function fechaLocal(iso: string) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
}

function isoLocal(fecha: Date) {
    return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

function sumarDias(iso: string, dias: number) {
    const fecha = fechaLocal(iso);
    fecha.setDate(fecha.getDate() + dias);
    return isoLocal(fecha);
}

/** Hoy en Colombia ('YYYY-MM-DD'): el servidor cuenta los días en hora de Colombia, no en la del equipo. */
function hoyColombia() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/**
 * Una fecha completa, que existe y con un año razonable (el input nativo emite valores como 0002-09-01
 * mientras se teclea, y el servidor descarta los años fuera de 2000…año siguiente).
 */
function fechaValida(iso: string | null | undefined): iso is string {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
    const anio = Number(iso.slice(0, 4));
    if (anio < 2000 || anio > new Date().getFullYear() + 1) return false;
    return isoLocal(fechaLocal(iso)) === iso;
}

/** «oct» / «Oct» (sin el punto de la abreviatura en español). */
function mesCorto(fecha: Date) {
    return fecha.toLocaleDateString(loc(), { month: 'short' }).replace('.', '');
}

/** «miércoles, 7 de octubre de 2026» / «Wednesday, October 7, 2026». */
function diaLargo(iso: string) {
    return fechaLocal(iso).toLocaleDateString(loc(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/** «7 de octubre de 2026» / «October 7, 2026». */
function fechaLarga(iso: string) {
    return fechaLocal(iso).toLocaleDateString(loc(), { day: 'numeric', month: 'long', year: 'numeric' });
}

/** «octubre de 2026» / «October 2026» a partir de 'YYYY-MM'. */
function mesLargo(anioMes: string) {
    return fechaLocal(`${anioMes}-01`).toLocaleDateString(loc(), { month: 'long', year: 'numeric' });
}

function usePrefiereMenosMovimiento() {
    const [reducir, setReducir] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return;
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        setReducir(mq.matches);
        const cambio = () => setReducir(mq.matches);
        mq.addEventListener?.('change', cambio);
        return () => mq.removeEventListener?.('change', cambio);
    }, []);

    return reducir;
}

/* ── Piezas ─────────────────────────────────────────────────────────────────────────────────────── */

/** Rótulo en versalitas con su texto de apoyo (el de "Credenciales" en Configuración). */
function Rotulo({ titulo, apoyo, className }: { titulo: string; apoyo?: ReactNode; className?: string }) {
    return (
        <div className={cn('flex min-h-4 min-w-0 flex-wrap items-baseline gap-x-2.5', className)}>
            <h3 className={cn('text-[11px] leading-4 font-semibold tracking-[0.07em] whitespace-nowrap uppercase', TEXTO_SUAVE)}>{titulo}</h3>
            {apoyo && (
                <span className={cn('min-w-0 text-[12px] leading-4 tabular-nums @3xl/hoja:truncate', TEXTO_SUAVE)} title={typeof apoyo === 'string' ? apoyo : undefined}>
                    {apoyo}
                </span>
            )}
        </div>
    );
}

/** Cuadro de color de las leyendas. */
function Cuadro({ color }: { color: string }) {
    return <span className="size-[9px] shrink-0 rounded-[2.5px]" style={{ background: color }} aria-hidden="true" />;
}

/** Barra apilada horizontal: segmentos separados por 2 px de hoja (no dependen solo del color). */
function Apilada({ partes, alto = 12 }: { partes: { etiqueta: string; valor: number; color: string }[]; alto?: number }) {
    const visibles = partes.filter((p) => p.valor > 0);

    return (
        <div className="flex gap-[2px] overflow-hidden" style={{ height: alto, borderRadius: alto / 3, background: visibles.length ? undefined : G.pista }} aria-hidden="true">
            {visibles.map((p) => (
                <div key={p.etiqueta} title={`${p.etiqueta}: ${formatNumber(p.valor)}`} className="min-w-[3px]" style={{ flex: `${p.valor} 1 0`, background: p.color }} />
            ))}
        </div>
    );
}

/** Barra simple sobre pista. */
function BarraPista({ valor, max, color = G.serie, alto = 6 }: { valor: number; max: number; color?: string; alto?: number }) {
    return (
        <div className="min-w-0 overflow-hidden rounded-full" style={{ height: alto, background: G.pista }} aria-hidden="true">
            <div className="h-full rounded-full" style={{ width: anchoBarra(valor, max), background: color }} />
        </div>
    );
}

/** Fila de leyenda: cuadro, etiqueta, cifra y porcentaje. */
function Leyenda({ color, etiqueta, valor, total, alto = 26 }: { color: string; etiqueta: string; valor: number; total: number; alto?: number }) {
    return (
        <div className="grid grid-cols-[9px_minmax(0,1fr)_72px_56px] items-center gap-x-2.5" style={{ height: alto }}>
            <Cuadro color={color} />
            <span className={cn('truncate text-[13px] leading-[18px] font-medium', TEXTO_NAVY)} title={etiqueta}>
                {etiqueta}
            </span>
            <span className={cn('text-right text-[13px] leading-[18px] font-medium tabular-nums', TEXTO_NAVY)}>{formatNumber(valor)}</span>
            <span className={cn('text-right text-[12px] leading-[18px] tabular-nums', TEXTO_SUAVE)}>{pct(valor, total)}</span>
        </div>
    );
}

/** Fila con barra: etiqueta con su cuadro, barra sobre pista, cifra y porcentaje. En estrecho la etiqueta usa dos líneas. */
function FilaBarra({
    etiqueta,
    valor,
    total,
    max,
    color,
    alto = 34,
    cuadro = true,
    anchoEtiqueta = 'grid-cols-[minmax(0,1.7fr)_minmax(40px,1fr)_52px_44px] @xl/hoja:grid-cols-[minmax(0,190px)_minmax(0,1fr)_64px_52px]',
}: {
    etiqueta: string;
    valor: number;
    total: number;
    max?: number;
    color: string;
    alto?: number;
    cuadro?: boolean;
    anchoEtiqueta?: string;
}) {
    return (
        <div className={cn('grid items-center gap-x-3.5', anchoEtiqueta)} style={{ height: alto }}>
            <span className="flex min-w-0 items-center gap-2">
                {cuadro && <Cuadro color={color} />}
                <span className={cn('line-clamp-2 text-[13px] leading-[15px] font-medium @xl/hoja:line-clamp-1 @xl/hoja:leading-[18px]', TEXTO_NAVY)} title={etiqueta}>
                    {etiqueta}
                </span>
            </span>
            <BarraPista valor={valor} max={max ?? total} color={color} alto={8} />
            <span className={cn('text-right text-[13px] leading-[18px] font-semibold tabular-nums', TEXTO_NAVY)}>{formatNumber(valor)}</span>
            <span className={cn('text-right text-[12px] leading-[18px] tabular-nums', TEXTO_SUAVE)}>{pct(valor, total)}</span>
        </div>
    );
}

/** Cifra mediana (dentro de un tema). */
function MiniCifra({ etiqueta, valor, detalle, tono, icono: Icono }: { etiqueta: string; valor: string; detalle?: ReactNode; tono?: string; icono?: LucideIcon }) {
    return (
        <div className="flex min-w-0 flex-col gap-1">
            <span className={cn('flex min-w-0 items-center gap-[7px] text-[12px] leading-4 font-medium', TEXTO_SUAVE)}>
                {Icono && <Icono className={cn('size-[13px] shrink-0', TEXTO_NAVY)} strokeWidth={2} aria-hidden="true" />}
                <span className="truncate" title={etiqueta}>
                    {etiqueta}
                </span>
            </span>
            <span className={cn('text-[24px] leading-[30px] font-medium tracking-[-0.025em] whitespace-nowrap tabular-nums', tono ?? TEXTO_NAVY)}>{valor}</span>
            {detalle !== undefined && (
                <span className={cn('truncate text-[12px] leading-4 tabular-nums', TEXTO_SUAVE)} title={typeof detalle === 'string' ? detalle : undefined}>
                    {detalle}
                </span>
            )}
        </div>
    );
}

/** Filete vertical entre columnas (solo cuando van en fila). */
function DivisorV({ desde = '@4xl/hoja:block' }: { desde?: string }) {
    return <div className={cn('hidden w-px self-stretch', FILETE_BG, desde)} aria-hidden="true" />;
}

function Vacio({ mensaje, alto = 'h-[168px]' }: { mensaje: string; alto?: string }) {
    return (
        <div className={cn('flex items-center justify-center rounded-xl px-4 text-center text-[13px] leading-[18px] shadow-[inset_0_0_0_1px_rgba(46,63,132,0.1)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]', alto, TEXTO_SUAVE)}>
            {mensaje}
        </div>
    );
}

/** Banda de tema: icono en su ranura, título y texto de apoyo; a la derecha, lo que el tema destaque. */
function Banda({ id, icono: Icono, titulo, texto, derecha, className }: { id: string; icono: LucideIcon; titulo: string; texto: ReactNode; derecha?: ReactNode; className?: string }) {
    return (
        <div className={cn('flex min-h-16 flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3 @3xl/hoja:flex-nowrap @3xl/hoja:px-5', BANDA, FILETE, className)}>
            <span className={cn('hidden w-8 shrink-0 justify-center @3xl/hoja:flex', TEXTO_NAVY)}>
                <Icono className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <h2 id={id} className={cn('text-[15px] leading-5 font-semibold tracking-[-0.01em]', TEXTO_NAVY)}>
                    {titulo}
                </h2>
                <p className={cn('text-[12.5px] leading-4 tabular-nums @3xl/hoja:truncate', TEXTO_SUAVE)} title={typeof texto === 'string' ? texto : undefined}>
                    {texto}
                </p>
            </div>
            {derecha && <div className="flex shrink-0 items-center gap-2">{derecha}</div>}
        </div>
    );
}

/**
 * Notas bajo la banda de un tema: los vacíos de datos conocidos (ámbar, con el aviso) y aclaraciones
 * de lo que cuenta el tema (en tono suave). Así un 0 o una caída no se leen como «no hubo actividad».
 */
function NotasTema({ avisos = [], notas = [] }: { avisos?: string[]; notas?: string[] }) {
    if (avisos.length === 0 && notas.length === 0) return null;

    return (
        <ul className={cn('flex flex-col gap-1.5 border-b py-2.5', SANGRIA, FILETE)}>
            {avisos.map((texto) => (
                <li key={texto} className={cn('flex items-start gap-1.5 text-[12px] leading-4 font-medium', TXT_AVISO)}>
                    <CircleAlert className="mt-px size-[13px] shrink-0" strokeWidth={2} aria-hidden="true" />
                    <span>{texto}</span>
                </li>
            ))}
            {notas.map((texto) => (
                <li key={texto} className={cn('flex items-start gap-1.5 text-[12px] leading-4', TEXTO_SUAVE)}>
                    <Info className="mt-px size-[13px] shrink-0" strokeWidth={2} aria-hidden="true" />
                    <span>{texto}</span>
                </li>
            ))}
        </ul>
    );
}

/** Tema de la hoja: se puede enfocar (la franja lleva hasta aquí) y deja margen al hacer scroll. */
function Tema({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
    return (
        <section id={id} aria-labelledby={`${id}-titulo`} tabIndex={-1} className={cn('scroll-mt-20 outline-none lg:scroll-mt-5', className)}>
            {children}
        </section>
    );
}

/**
 * Tabla solo para lectores de pantalla: las mismas cifras que dibuja un gráfico. El sr-only va en
 * un div: una <table> no respeta el ancho de 1 px y crecía con su contenido (scroll lateral en móvil).
 */
function TablaOculta({ titulo, columnas, filas }: { titulo: string; columnas: string[]; filas: { clave: string; celdas: string[] }[] }) {
    return (
        <div className="sr-only">
        <table>
            <caption>{titulo}</caption>
            <thead>
                <tr>
                    {columnas.map((c) => (
                        <th key={c} scope="col">
                            {c}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {filas.map((f) => (
                    <tr key={f.clave}>
                        <th scope="row">{f.celdas[0]}</th>
                        {f.celdas.slice(1).map((celda, i) => (
                            <td key={i}>{celda}</td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
        </div>
    );
}

/** Botón de reintento de los errores de carga; si la sesión venció, recarga la página. */
function BotonReintentar({ sesion, onReintentar }: { sesion: boolean; onReintentar: () => void }) {
    const { t } = useTranslation();

    return (
        <button
            type="button"
            onClick={sesion ? () => window.location.reload() : onReintentar}
            className={cn(
                'inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-card px-3 text-[12.5px] leading-4 font-semibold shadow-[inset_0_0_0_1px_rgba(46,63,132,0.16)] transition-colors hover:bg-[#2e3f84]/8 dark:bg-white/5 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] dark:hover:bg-white/10',
                TEXTO_NAVY,
                FOCO
            )}
        >
            <RotateCw className="size-3.5" strokeWidth={2} aria-hidden="true" />
            {sesion ? t('statistics.view.reloadPage') : t('statistics.view.retry')}
        </button>
    );
}

/** Segmentado (el filtro de rol de Usuarios): la opción elegida en blanco. */
function Segmentado({
    opciones,
    activa,
    onElegir,
    etiqueta,
    peq = false,
    className,
}: {
    opciones: { value: string; label: string }[];
    activa: string | null;
    onElegir: (value: string) => void;
    etiqueta: string;
    peq?: boolean;
    className?: string;
}) {
    return (
        <div role="group" aria-label={etiqueta} className={cn('flex items-center gap-0.5 rounded-[11px] bg-[#2e3f84]/[0.055] p-[3px] dark:bg-white/5', className)}>
            {opciones.map((option) => {
                const on = activa === option.value;

                return (
                    <button
                        key={option.value}
                        type="button"
                        aria-pressed={on}
                        onClick={() => onElegir(option.value)}
                        className={cn(
                            'flex-1 cursor-pointer rounded-lg font-semibold whitespace-nowrap transition-colors',
                            peq ? 'h-7 px-[11px] text-[12px] leading-4' : 'h-[30px] px-3 text-[12.5px] leading-4 @lg/pagina:px-[13px]',
                            FOCO,
                            on
                                ? 'bg-white text-[#2e3f84] shadow-[0_0_0_1px_rgba(46,63,132,0.08),0_1px_2px_rgba(46,63,132,0.12),0_2px_6px_-2px_rgba(46,63,132,0.12)] dark:bg-white/12 dark:text-neutral-100 dark:shadow-none'
                                : cn(TEXTO_SUAVE, 'hover:text-[#2e3f84] dark:hover:text-neutral-100')
                        )}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}

type Borrador = { inicio: string; fin: string };

/**
 * Campo de rango de fechas: un solo campo que abre fecha inicio y fecha fin.
 *
 * Lo que se teclea es un BORRADOR: el rango aplicado (inicio/fin) no cambia hasta que el borrador es
 * válido y se termina de elegir: Enter, salir del calendario (Tab o clic fuera) o 800 ms sin cambios.
 * Así, corregir el día 01 por el 20 no se aplica en la primera tecla. Escape cierra sin aplicar y
 * devuelve el borrador al rango aplicado. Un rango invertido no se aplica nunca y se avisa.
 */
function CampoRango({
    inicio,
    fin,
    onAplicar,
    onLimpiar,
    placeholder,
    peq = false,
    className,
    clasePanel = 'right-0',
}: {
    inicio: string;
    fin: string;
    onAplicar: (inicio: string, fin: string) => void;
    onLimpiar: () => void;
    placeholder: string;
    peq?: boolean;
    className?: string;
    /** Dónde se ancla el calendario: a la derecha por defecto; a la izquierda cuando el campo queda a la izquierda. */
    clasePanel?: string;
}) {
    const { t } = useTranslation();
    const [abierto, setAbierto] = useState(false);
    const [borrador, setBorrador] = useState<Borrador>({ inicio, fin });
    const raiz = useRef<HTMLDivElement>(null);
    const disparador = useRef<HTMLButtonElement>(null);
    const primerCampo = useRef<HTMLInputElement>(null);
    const temporizador = useRef<number | null>(null);
    const uid = useId();
    const idPanel = `${uid}-panel`;
    const idAviso = `${uid}-aviso`;
    const conRango = !!(inicio && fin);

    // El borrador vuelve al rango aplicado cuando este cambia (al aplicarlo, al limpiarlo, al elegir un período).
    useEffect(() => {
        setBorrador({ inicio, fin });
    }, [inicio, fin]);

    const listo = (b: Borrador) => fechaValida(b.inicio) && fechaValida(b.fin) && b.inicio <= b.fin;
    const invertido = fechaValida(borrador.inicio) && fechaValida(borrador.fin) && borrador.inicio > borrador.fin;

    const pararTemporizador = () => {
        if (temporizador.current !== null) {
            window.clearTimeout(temporizador.current);
            temporizador.current = null;
        }
    };

    const aplicar = (b: Borrador) => {
        pararTemporizador();
        if (listo(b) && (b.inicio !== inicio || b.fin !== fin)) onAplicar(b.inicio, b.fin);
    };

    const cerrar = (accion: 'aplicar' | 'descartar', devolverFoco = true) => {
        if (accion === 'aplicar' && listo(borrador)) {
            aplicar(borrador);
        } else {
            pararTemporizador();
            setBorrador({ inicio, fin });
        }
        setAbierto(false);
        if (devolverFoco) disparador.current?.focus();
    };
    const cerrarRef = useRef(cerrar);
    cerrarRef.current = cerrar;

    const cambiar = (b: Borrador) => {
        setBorrador(b);
        pararTemporizador();
        if (listo(b) && (b.inicio !== inicio || b.fin !== fin)) temporizador.current = window.setTimeout(() => aplicar(b), 800);
    };

    useEffect(() => {
        if (!abierto) return;
        primerCampo.current?.focus();
        const fuera = (event: MouseEvent) => {
            if (raiz.current && !raiz.current.contains(event.target as Node)) cerrarRef.current('aplicar', false);
        };
        document.addEventListener('mousedown', fuera);
        return () => document.removeEventListener('mousedown', fuera);
    }, [abierto]);

    useEffect(
        () => () => {
            if (temporizador.current !== null) window.clearTimeout(temporizador.current);
        },
        []
    );

    const fmt = (iso: string) => (fechaValida(iso) ? fechaLocal(iso).toLocaleDateString(loc(), { day: '2-digit', month: '2-digit', year: 'numeric' }) : '…');
    const texto = conRango ? `${fmt(inicio)} – ${fmt(fin)}` : placeholder;

    return (
        <div
            ref={raiz}
            data-rango-abierto={abierto ? 'true' : undefined}
            className={cn('relative', className)}
            onKeyDown={(event) => {
                if (!abierto) return;
                if (event.key === 'Escape') {
                    event.stopPropagation();
                    cerrar('descartar');
                } else if (event.key === 'Enter' && (event.target as HTMLElement).tagName === 'INPUT') {
                    event.preventDefault();
                    if (listo(borrador)) cerrar('aplicar');
                }
            }}
            onBlur={(event) => {
                // Tab fuera del calendario: se aplica lo elegido. Un clic fuera lo resuelve el mousedown;
                // sin relatedTarget (el calendario nativo, una zona no enfocable) no se cierra aquí.
                const destino = event.relatedTarget as Node | null;
                if (!abierto || !destino || raiz.current?.contains(destino)) return;
                cerrar('aplicar', false);
            }}
        >
            <button
                ref={disparador}
                type="button"
                aria-expanded={abierto}
                aria-controls={idPanel}
                title={t('statistics.view.rangeHint')}
                onClick={() => (abierto ? cerrar('aplicar', false) : setAbierto(true))}
                className={cn(
                    'flex w-full cursor-pointer items-center gap-[9px] rounded-[10px] bg-card pl-3 text-left shadow-[inset_0_0_0_1px_rgba(46,63,132,0.16),0_1px_2px_rgba(46,63,132,0.06)] transition-shadow hover:shadow-[inset_0_0_0_1px_rgba(46,63,132,0.28),0_1px_2px_rgba(46,63,132,0.06)] dark:bg-white/5 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] dark:hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.22)]',
                    peq ? 'h-[34px] text-[12px]' : 'h-9 text-[12.5px]',
                    conRango ? 'pr-9' : 'pr-3',
                    FOCO
                )}
            >
                <CalendarRange className={cn('size-[15px] shrink-0', conRango ? TEXTO_NAVY : TEXTO_SUAVE)} strokeWidth={1.75} aria-hidden="true" />
                <span className={cn('truncate leading-4 font-medium tabular-nums', conRango ? TEXTO_NAVY : TEXTO_SUAVE)}>{texto}</span>
            </button>
            {conRango && (
                <button
                    type="button"
                    onClick={() => {
                        pararTemporizador();
                        setAbierto(false);
                        onLimpiar();
                    }}
                    title={t('statistics.filters.clearRange')}
                    aria-label={t('statistics.filters.clearRange')}
                    className={cn(
                        'absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-[#2e3f84]/8 hover:text-[#2e3f84] dark:hover:bg-white/10 dark:hover:text-neutral-100',
                        TEXTO_SUAVE,
                        FOCO
                    )}
                >
                    <X className="size-3.5" aria-hidden="true" />
                </button>
            )}
            {abierto && (
                <div
                    id={idPanel}
                    role="dialog"
                    aria-label={t('statistics.filters.custom')}
                    className={cn('absolute top-full z-30 mt-1.5 flex w-[268px] max-w-[calc(100vw-2rem)] flex-col gap-3 rounded-xl bg-white p-3.5 dark:bg-popover', clasePanel, SOMBRA_FLOTANTE)}
                >
                    <div className="grid grid-cols-2 gap-2.5">
                        {(
                            [
                                ['inicio', t('statistics.filters.startDate'), borrador.inicio, primerCampo],
                                ['fin', t('statistics.filters.endDate'), borrador.fin, null],
                            ] as const
                        ).map(([clave, etiqueta, valor, ref]) => (
                            <label key={clave} className="flex min-w-0 flex-col gap-1.5">
                                <span className={cn('text-[12px] leading-4 font-medium', TEXTO_SUAVE)}>{etiqueta}</span>
                                <input
                                    ref={ref ?? undefined}
                                    type="date"
                                    value={valor}
                                    max={clave === 'inicio' && fechaValida(borrador.fin) ? borrador.fin : undefined}
                                    min={clave === 'fin' && fechaValida(borrador.inicio) ? borrador.inicio : undefined}
                                    aria-invalid={clave === 'fin' && invertido ? true : undefined}
                                    aria-describedby={idAviso}
                                    onChange={(event) =>
                                        clave === 'inicio' ? cambiar({ inicio: event.target.value, fin: borrador.fin }) : cambiar({ inicio: borrador.inicio, fin: event.target.value })
                                    }
                                    className={cn(
                                        'h-9 w-full min-w-0 rounded-lg bg-[#2e3f84]/[0.035] px-2 text-[12.5px] leading-4 text-foreground tabular-nums shadow-[inset_0_0_0_1px_rgba(46,63,132,0.12)] dark:bg-white/5 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] dark:[color-scheme:dark]',
                                        clave === 'fin' && invertido && 'shadow-[inset_0_0_0_1px_rgba(185,28,28,0.6)] dark:shadow-[inset_0_0_0_1px_rgba(248,113,113,0.6)]',
                                        FOCO
                                    )}
                                />
                            </label>
                        ))}
                    </div>
                    <p id={idAviso} aria-live="polite" className={cn('text-[12px] leading-4 font-medium empty:hidden', TXT_MAL)}>
                        {invertido ? t('statistics.view.rangeInverted') : ''}
                    </p>
                    <p className={cn('text-[12px] leading-4', TEXTO_SUAVE)}>{t('statistics.view.rangeHint')}</p>
                </div>
            )}
        </div>
    );
}

/** Tooltip de los gráficos, con el estilo del diseño (tarjeta blanca; popover en oscuro). */
function Globo({ titulo, filas }: { titulo: string; filas: { color?: string; etiqueta: string; valor: string; fuerte?: boolean }[] }) {
    return (
        <div className={cn('flex min-w-[168px] flex-col gap-[3px] rounded-[10px] bg-white px-3 pt-[9px] pb-2.5 dark:bg-popover', SOMBRA_FLOTANTE)}>
            <span className={cn('text-[12px] leading-4 font-medium tabular-nums', TEXTO_SUAVE)}>{titulo}</span>
            {filas.map((f) => (
                <span key={f.etiqueta} className={cn('flex items-center gap-2', !f.color && 'pl-[17px]')}>
                    {f.color && <Cuadro color={f.color} />}
                    <span className={cn(f.fuerte ? cn('text-[13px] leading-[18px] font-medium', TEXTO_NAVY) : cn('text-[12px] leading-4', TEXTO_SUAVE))}>{f.etiqueta}</span>
                    <span className={cn('ml-auto pl-4 tabular-nums', TEXTO_NAVY, f.fuerte ? 'text-[13px] leading-[18px] font-semibold' : 'text-[12px] leading-4 font-medium')}>{f.valor}</span>
                </span>
            ))}
        </div>
    );
}

type ContenidoGlobo = { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }>; label?: unknown };

/** Etiqueta del eje X en dos líneas ("lun" / "07"), como en el diseño del panel. */
function TickDosLineas(props: { x?: number | string; y?: number | string; payload?: { value?: unknown } }) {
    const [a, ...resto] = String(props.payload?.value ?? '').replace(/\./g, '').split(' ');
    const x = Number(props.x ?? 0);
    const y = Number(props.y ?? 0);

    return (
        <g transform={`translate(${x},${y})`}>
            <text x={0} y={0} dy={11} textAnchor="middle" fill={G.eje} fontSize={11}>
                {a}
            </text>
            {resto.length > 0 && (
                <text x={0} y={0} dy={26} textAnchor="middle" fill={G.eje} fontSize={11}>
                    {resto.join(' ')}
                </text>
            )}
        </g>
    );
}

/** Cabecera de columna que ordena la tabla de asesores (descendente al primer clic, ascendente al segundo). */
function ThOrden({
    etiqueta,
    activo,
    dir,
    onOrdenar,
    derecha = false,
    className,
    children,
}: {
    etiqueta: string;
    activo: boolean;
    dir: 'desc' | 'asc';
    onOrdenar: () => void;
    derecha?: boolean;
    className?: string;
    children?: ReactNode;
}) {
    const { t } = useTranslation();
    const Icono = !activo ? ChevronsUpDown : dir === 'desc' ? ArrowDown : ArrowUp;

    return (
        <th scope="col" aria-sort={activo ? (dir === 'desc' ? 'descending' : 'ascending') : undefined} className={cn('px-2.5', derecha && 'text-right', className)}>
            <button
                type="button"
                onClick={onOrdenar}
                title={t('statistics.view.sortBy', { col: etiqueta })}
                className={cn(
                    // Sin max-w-full: el botón puede ocupar el relleno de la celda, así «Resueltas» o «Agendadas» no se cortan.
                    '-mx-1 inline-flex cursor-pointer items-center gap-1 rounded px-1 text-[11px] leading-4 font-semibold tracking-[0.07em] whitespace-nowrap uppercase transition-colors hover:text-[#2e3f84] dark:hover:text-neutral-100',
                    derecha && 'flex-row-reverse',
                    activo ? TEXTO_NAVY : TEXTO_SUAVE,
                    FOCO
                )}
            >
                <span className="truncate">{etiqueta}</span>
                {children}
                <Icono className={cn('size-3 shrink-0', !activo && 'opacity-60')} strokeWidth={2} aria-hidden="true" />
            </button>
        </th>
    );
}

const PERIOD_KEYS = ['today', 'week', 'month', 'year', 'all'] as const;
type Periodo = (typeof PERIOD_KEYS)[number];
const esPeriodo = (valor: string | null | undefined): valor is Periodo => !!valor && (PERIOD_KEYS as readonly string[]).includes(valor);

type ColAsesor = 'rate' | 'total' | 'resolved' | 'active' | 'scheduled' | 'released' | 'messages';

function valorColumna(a: AdvisorSummary, col: ColAsesor): number | null {
    switch (col) {
        case 'rate':
            return a.resolution_rate;
        case 'total':
            return a.total_conversations;
        case 'resolved':
            return a.resolved_conversations;
        case 'active':
            return a.active_conversations;
        case 'scheduled':
            return a.scheduled_conversations;
        case 'released':
            return a.released_inactive ?? 0;
        case 'messages':
            return a.messages_sent;
    }
}

function StatisticsView({ statistics, actualizando, errorCarga, lento, onReintentar }: StatisticsViewProps) {
    const { t } = useTranslation();
    const { url } = usePage();
    const reducirMovimiento = usePrefiereMenosMovimiento();
    const animar = !reducirMovimiento;

    // Filtro APLICADO: sale de la URL (lo que se pidió), no del borrador del campo de fechas. La
    // cabecera, el segmentado, el Excel y el panel del asesor usan siempre este. Un rango solo cuenta
    // si las dos fechas son válidas y están en orden (el servidor descarta los demás).
    const consulta = useMemo(() => new URLSearchParams(url.split('?')[1] ?? ''), [url]);
    const periodoUrl = consulta.get('period');
    const periodoAplicado: Periodo = esPeriodo(periodoUrl) ? periodoUrl : esPeriodo(statistics.date_range.period) ? statistics.date_range.period : 'all';
    const inicioUrl = consulta.get('start_date') ?? '';
    const finUrl = consulta.get('end_date') ?? '';
    const rangoAplicado = fechaValida(inicioUrl) && fechaValida(finUrl) && inicioUrl <= finUrl;
    const inicioAplicado = rangoAplicado ? inicioUrl : '';
    const finAplicado = rangoAplicado ? finUrl : '';
    const periodoActivo = rangoAplicado ? null : periodoAplicado;

    // Agrupación de la evolución del costo: null = automática (por mes si hay más de 62 días).
    // Solo cambia cómo se agrupa lo que ya vino del servidor, así que no dispara ninguna petición.
    const [costGroup, setCostGroup] = useState<'day' | 'month' | null>(null);
    const [expandedAdvisor, setExpandedAdvisor] = useState<number | null>(null);
    const [advisorDetail, setAdvisorDetail] = useState<AdvisorDetail | null>(null);
    const [loadingAdvisor, setLoadingAdvisor] = useState(false);
    const [advisorError, setAdvisorError] = useState<ErrorCarga>(null);
    const [advisorPeriod, setAdvisorPeriod] = useState<string>('all');
    const [advisorStartDate, setAdvisorStartDate] = useState('');
    const [advisorEndDate, setAdvisorEndDate] = useState('');
    const [isExporting, setIsExporting] = useState(false);
    const [exportError, setExportError] = useState<ErrorCarga>(null);
    const [busqueda, setBusqueda] = useState('');
    const [orden, setOrden] = useState<{ col: ColAsesor; dir: 'desc' | 'asc' } | null>(null);
    const peticion = useRef<AbortController | null>(null);

    const periodOptions = useMemo(() => PERIOD_KEYS.map((value) => ({ value, label: t(`statistics.filters.periods.${value}`) })), [t]);

    // Una sola petición del panel en curso: la anterior se cancela, y una respuesta vieja (de otro
    // período u otro asesor) nunca pisa a la nueva ni apaga su indicador de carga.
    const fetchAdvisorDetail = useCallback(async (advisorId: number, period: string, start: string, end: string) => {
        peticion.current?.abort();
        const ctrl = new AbortController();
        peticion.current = ctrl;
        setLoadingAdvisor(true);
        setAdvisorError(null);

        try {
            const params: Record<string, string> = { period };
            if (start && end) {
                params.start_date = start;
                params.end_date = end;
            }
            const response = await axios.get<AdvisorDetail>(`/admin/statistics/advisor/${advisorId}`, { params, signal: ctrl.signal });
            if (peticion.current !== ctrl) return;
            setAdvisorDetail(response.data);
        } catch (error) {
            if (axios.isCancel(error) || peticion.current !== ctrl) return;
            const status = axios.isAxiosError(error) ? error.response?.status : undefined;
            setAdvisorDetail(null);
            setAdvisorError(status === 401 || status === 419 ? 'session' : 'other');
        } finally {
            if (peticion.current === ctrl) setLoadingAdvisor(false);
        }
    }, []);

    useEffect(() => () => peticion.current?.abort(), []);

    // El panel abre con el filtro aplicado en la página, para que sus cifras casen con la fila pulsada.
    const openAdvisorDetail = (advisorId: number) => {
        const periodo = rangoAplicado ? 'custom' : periodoAplicado;
        setExpandedAdvisor(advisorId);
        setAdvisorDetail(null);
        setAdvisorPeriod(periodo);
        setAdvisorStartDate(inicioAplicado);
        setAdvisorEndDate(finAplicado);
        fetchAdvisorDetail(advisorId, periodo, inicioAplicado, finAplicado);
    };

    const closeAdvisorDetail = () => {
        peticion.current?.abort();
        peticion.current = null;
        setExpandedAdvisor(null);
        setAdvisorDetail(null);
        setLoadingAdvisor(false);
        setAdvisorError(null);
    };

    // Se manda al pulsar el periodo (sin rango) o al terminar de elegir el rango.
    const aplicarFiltro = (nextPeriod: string, start: string, end: string) => {
        // Una carga vieja todavía en curso («Todo el tiempo» es la más lenta) no debe llegar después y
        // pisar las cifras del filtro nuevo.
        router.cancelAll();
        router.get(
            '/admin/statistics',
            {
                period: nextPeriod,
                start_date: start || undefined,
                end_date: end || undefined,
            },
            {
                preserveState: true,
                preserveScroll: true,
            }
        );
    };

    const elegirPeriodo = (value: string) => {
        if (value === periodoActivo) return;
        aplicarFiltro(value, '', '');
    };

    const aplicarRango = (start: string, end: string) => aplicarFiltro(periodoAplicado, start, end);

    const limpiarRango = () => {
        if (rangoAplicado) aplicarFiltro(periodoAplicado, '', '');
    };

    // El Excel se baja con los MISMOS parámetros que la página (misma clave de caché en el servidor):
    // sale con exactamente las cifras que se ven. Con axios, para poder avisar de un fallo sin sacar
    // al usuario de la app y para no reactivar el botón antes de tiempo.
    const handleExport = async () => {
        if (isExporting) return;
        setExportError(null);
        setIsExporting(true);

        try {
            const params: Record<string, string> = { period: periodoAplicado };
            if (rangoAplicado) {
                params.start_date = inicioAplicado;
                params.end_date = finAplicado;
            }
            const respuesta = await axios.get<Blob>('/admin/statistics/export', { params, responseType: 'blob' });
            const tipo = String(respuesta.headers['content-type'] ?? '');
            if (/text\/html|application\/json/i.test(tipo)) {
                setExportError('other');
                return;
            }
            const disposicion = String(respuesta.headers['content-disposition'] ?? '');
            const coincide = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposicion);
            let nombre = 'estadisticas.xlsx';
            if (coincide) {
                try {
                    nombre = decodeURIComponent(coincide[1]);
                } catch {
                    nombre = coincide[1];
                }
            }
            const href = URL.createObjectURL(respuesta.data);
            const enlace = document.createElement('a');
            enlace.href = href;
            enlace.download = nombre;
            document.body.appendChild(enlace);
            enlace.click();
            enlace.remove();
            window.setTimeout(() => URL.revokeObjectURL(href), 1000);
        } catch (error) {
            const status = axios.isAxiosError(error) ? error.response?.status : undefined;
            setExportError(status === 401 || status === 419 ? 'session' : 'other');
        } finally {
            setIsExporting(false);
        }
    };

    const irA = (id: string) => {
        const destino = document.getElementById(id);
        if (!destino) return;
        // Primero el foco (sin mover) y después el scroll: un focus() durante un scroll suave lo corta.
        destino.focus({ preventScroll: true });
        destino.scrollIntoView({ behavior: reducirMovimiento ? 'auto' : 'smooth', block: 'start' });
    };

    /* ── Datos derivados ── */
    const { messages, appointments, conversations, templates, users, advisors, costs } = statistics;
    const fd = statistics.flowDemand;
    const periodLabel = periodOptions.find((option) => option.value === periodoAplicado)?.label ?? '';
    const hoy = hoyColombia();
    const rangoDatos = statistics.date_range;

    const textoRango = (inicio: string, fin: string) => {
        const locale = loc();
        const a = fechaLocal(inicio);
        const b = fechaLocal(fin);
        if (inicio === fin) return fechaLarga(inicio);
        if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
            return t('statistics.view.rangeSameMonth', {
                from: a.getDate(),
                to: b.getDate(),
                month: a.toLocaleDateString(locale, { month: 'long' }),
                year: a.getFullYear(),
            });
        }
        return t('statistics.view.rangeGeneric', { from: fechaLarga(inicio), to: fechaLarga(fin) });
    };

    // Mientras llegan las cifras de un período nuevo no se sabe aún su inicio y fin: solo la etiqueta.
    const textoCabecera = (() => {
        if (rangoAplicado) return textoRango(inicioAplicado, finAplicado);
        if (actualizando) return '';
        const inicio = rangoDatos.start ?? null;
        let fin = rangoDatos.end ?? null;
        if (!inicio || !fin) return t('statistics.view.allTimeRange');
        // Un periodo en curso ("Este mes") llega hasta fin de mes: se rotula hasta hoy.
        if (fin > hoy && inicio <= hoy) fin = hoy;
        return textoRango(inicio, fin);
    })();

    const horaDatos = (() => {
        if (!statistics.generated_at) return null;
        const fecha = new Date(statistics.generated_at);
        if (Number.isNaN(fecha.getTime())) return null;
        return new Intl.DateTimeFormat(loc(), { timeZone: ZONA, hour: 'numeric', minute: '2-digit' }).format(fecha);
    })();
    const datosDeHoy = rangoDatos.period === 'today' && !rangoDatos.custom;

    /* Vacíos de datos conocidos: cada aviso va bajo la banda de los temas que afecta. */
    const vacios = statistics.data_gaps ?? [];
    const textosVacio: Record<string, string> = {
        messages_nov2025_jan2026: t('statistics.view.gaps.messagesNov2025Jan2026'),
        appointments_since_aug2026: t('statistics.view.gaps.appointmentsSinceAug2026'),
        webhook_oct2026: t('statistics.view.gaps.webhookOct2026'),
        late_oct2026: t('statistics.view.gaps.lateOct2026'),
        cost_attacker_oct2026: t('statistics.view.gaps.costAttackerOct2026'),
        history_before_mar2026: t('statistics.view.gaps.historyBeforeMar2026'),
    };
    const textoVacio = (g: DataGap) =>
        textosVacio[g.key] ??
        (g.to ? t('statistics.view.gaps.genericRange', { from: fechaLarga(g.from), to: fechaLarga(g.to) }) : t('statistics.view.gaps.genericFrom', { from: fechaLarga(g.from) }));
    const avisosDe = (...temas: string[]) => [...new Set(vacios.filter((g) => (g.topics ?? []).some((tema) => temas.includes(tema))).map(textoVacio))];

    /* Mensajes */
    const escritos = messages.received_written ?? messages.received_from_users;
    const toques = messages.button_taps ?? Math.max(messages.received_from_users - escritos, 0);
    const delivery = [
        { key: 'read', label: t('statistics.messages.readPlural'), value: messages.delivery_status.read, color: G.serie },
        { key: 'delivered', label: t('statistics.messages.deliveredPlural'), value: messages.delivery_status.delivered, color: G.ok },
        { key: 'sent', label: t('statistics.messages.sentPlural'), value: messages.delivery_status.sent, color: G.curso },
        { key: 'pending', label: t('statistics.messages.deliveryStatus.pending'), value: messages.delivery_status.pending, color: G.pend },
        { key: 'failed', label: t('statistics.messages.errors'), value: messages.delivery_status.failed, color: G.mal },
    ];
    const outboundTotal = Object.values(messages.delivery_status).reduce((sum, value) => sum + value, 0);

    /* Citas. «Respuesta de pacientes» solo cuenta citas con recordatorio enviado: es lo único sobre lo
       que un paciente pudo responder. Las canceladas por el hospital (al enviar la plantilla de
       cancelación) no son una respuesta suya: van aparte, en la columna de la izquierda. Con eso los
       trozos del anillo suman exactamente el número del centro. */
    const canceladasPaciente = appointments.cancelled_by_patient ?? appointments.cancelled;
    const canceladasHospital = appointments.cancelled_by_hospital;
    const appointmentsData = [
        { name: t('statistics.appointments.confirmed'), value: appointments.confirmed, color: G.ok },
        { name: t('statistics.appointments.cancelled'), value: canceladasPaciente, color: G.mal },
        { name: t('statistics.appointments.awaitingReply'), value: appointments.awaiting_reply, color: G.pend },
    ].filter((item) => item.value > 0);
    const respuestasTotal = appointmentsData.reduce((s, a) => s + a.value, 0);
    const centroAnillo = appointments.with_reminder_base ?? respuestasTotal;
    const citasFuturas = appointments.future ?? 0;
    // La cabecera rotula un período en curso «hasta hoy», pero Citas cuenta el período completo.
    const notaCitas =
        !rangoDatos.custom && rangoDatos.start && rangoDatos.end && rangoDatos.end > hoy && rangoDatos.start <= hoy
            ? [t('statistics.view.appointmentsFullPeriod', { range: textoRango(rangoDatos.start, rangoDatos.end) })]
            : [];

    /* Conversaciones: «En progreso» y «Cerradas» ya no se pueden asignar; en 0 no se muestran. */
    const conversationItems = [
        { key: 'active', label: t('statistics.conversations.active'), value: conversations.active },
        { key: 'pending', label: t('statistics.conversations.pending'), value: conversations.pending },
        { key: 'in_progress', label: t('statistics.conversations.inProgress'), value: conversations.in_progress },
        { key: 'resolved', label: t('statistics.conversations.resolved'), value: conversations.resolved },
        { key: 'closed', label: t('statistics.conversations.closed'), value: conversations.closed },
        { key: 'scheduled', label: t('statistics.conversations.scheduled'), value: conversations.scheduled },
    ].filter((c) => !((c.key === 'in_progress' || c.key === 'closed') && c.value === 0));
    const maxConversationItem = Math.max(...conversationItems.map((c) => c.value), 1);
    const sinLeer = conversations.unread > 0;

    /* Equipo: sin el usuario IA, la misma cifra en la banda y en la composición. */
    const usersData = [
        { name: t('statistics.users.admins'), value: users.admins, color: G.serie },
        { name: t('statistics.users.advisors'), value: users.advisors, color: G.curso },
    ].filter((item) => item.value > 0);
    const teamTotal = users.team_total ?? users.admins + users.advisors;

    /* Asesores */
    const advisorList = advisors.advisors;
    const maxAdvisorConv = Math.max(...advisorList.map((a) => a.total_conversations), 0);
    const maxAdvisorMsgs = Math.max(...advisorList.map((a) => a.messages_sent), 0);
    const selectedAdvisor = advisorList.find((a) => a.id === expandedAdvisor) ?? null;
    const liberacionApagada = advisors.auto_release_enabled === false;
    const liberadasTotal = advisors.total_released_inactive ?? 0;
    const mejor = advisors.top_performer && advisors.top_performer.resolved_conversations > 0 ? advisors.top_performer : null;
    const tasaEquipo = advisors.avg_resolution_rate;

    // Búsqueda y orden solo en el cliente (sin peticiones). Los «Sin datos» van siempre al final.
    const termino = plano(busqueda.trim());
    const asesoresVisibles = (() => {
        const filtrados = termino ? advisorList.filter((a) => plano(a.name).includes(termino)) : advisorList;
        if (!orden) return filtrados;
        const signo = orden.dir === 'desc' ? -1 : 1;
        return [...filtrados].sort((a, b) => {
            const va = valorColumna(a, orden.col);
            const vb = valorColumna(b, orden.col);
            if (va === null && vb === null) return 0;
            if (va === null) return 1;
            if (vb === null) return -1;
            return (va - vb) * signo;
        });
    })();
    const ordenarPor = (col: ColAsesor) =>
        setOrden((actual) => (actual?.col === col ? { col, dir: actual.dir === 'desc' ? 'asc' : 'desc' } : { col, dir: 'desc' }));
    const thOrden = (col: ColAsesor, etiqueta: string, className: string, derecha = false, extra?: ReactNode) => (
        <ThOrden etiqueta={etiqueta} activo={orden?.col === col} dir={orden?.col === col ? orden.dir : 'desc'} onOrdenar={() => ordenarPor(col)} derecha={derecha} className={className}>
            {extra}
        </ThOrden>
    );

    /* ── Franja ── */
    const cifras: { id: string; icono: LucideIcon; iconoTono?: string; etiqueta: string; valor: string; detalle: ReactNode; destino: string }[] = [
        {
            id: 'est-mensajes',
            icono: MessageSquare,
            etiqueta: t('statistics.chart.messages'),
            valor: formatNumber(messages.total),
            detalle: t('statistics.metricCard.sentDetail', { value: formatNumber(messages.sent_by_system) }),
            destino: t('statistics.messages.title'),
        },
        {
            id: 'est-citas',
            icono: CalendarCheck2,
            etiqueta: t('statistics.chart.appointments'),
            valor: formatNumber(appointments.total),
            detalle: t('statistics.metricCard.confirmedDetail', { value: formatNumber(appointments.confirmed) }),
            destino: t('statistics.view.appointmentsTitle'),
        },
        {
            id: 'est-conversaciones',
            icono: MessagesSquare,
            etiqueta: t('statistics.chart.conversations'),
            valor: formatNumber(conversations.total),
            detalle: sinLeer ? (
                <span className={cn('flex min-w-0 items-center gap-1.5 font-medium', TXT_AVISO)}>
                    <span className={cn('size-[7px] shrink-0 rounded-full', PUNTO_AVISO)} aria-hidden="true" />
                    <span className="truncate">{t('statistics.metricCard.unreadDetail', { value: formatNumber(conversations.unread) })}</span>
                </span>
            ) : (
                t('statistics.metricCard.unreadDetail', { value: formatNumber(conversations.unread) })
            ),
            destino: t('statistics.conversations.title'),
        },
        {
            id: 'est-asesores',
            icono: Headphones,
            iconoTono: 'text-sky-700 dark:text-sky-300',
            etiqueta: t('statistics.users.advisors'),
            valor: formatNumber(advisors.total_advisors),
            detalle: tasaEquipo === null ? t('statistics.view.resolutionNoData') : t('statistics.view.resolutionDetail', { value: formatRate(tasaEquipo) }),
            destino: t('statistics.advisors.performanceTitle'),
        },
        {
            id: 'est-plantillas',
            icono: FileText,
            etiqueta: t('statistics.chart.templates'),
            valor: formatNumber(templates.total_sends),
            detalle: t('statistics.metricCard.failedDetail', { value: formatNumber(templates.failed_sends) }),
            destino: t('statistics.view.templatesTeamTitle'),
        },
    ];
    if (costs) {
        cifras.push({
            id: 'est-costo',
            icono: Wallet,
            etiqueta: t('statistics.view.costShort'),
            valor: formatMoney(costs.total_cost, costs.currency),
            detalle: t('statistics.view.costDetail'),
            destino: t('statistics.view.costTitle'),
        });
    }

    /* Línea de estado bajo el título: hora de las cifras, «Actualizando…» o el error con su salida. */
    const lineaEstado = errorCarga ? (
        <span className={cn('flex flex-wrap items-center gap-x-2.5 gap-y-1.5 font-medium', TXT_MAL)}>
            <span className="flex items-center gap-1.5">
                <CircleAlert className="size-[13px] shrink-0" strokeWidth={2} aria-hidden="true" />
                {errorCarga === 'session' ? t('statistics.view.sessionExpired') : t('statistics.view.loadError')}
            </span>
            <BotonReintentar sesion={errorCarga === 'session'} onReintentar={onReintentar} />
        </span>
    ) : actualizando ? (
        <span className="inline-flex items-center gap-1.5">
            <Loader2 className={cn('size-3.5 animate-spin motion-reduce:animate-none', TEXTO_NAVY)} aria-hidden="true" />
            {lento ? t('statistics.view.slowLoading') : t('statistics.view.updating')}
        </span>
    ) : horaDatos ? (
        datosDeHoy ? (
            t('statistics.view.dataAsOfToday', { time: horaDatos })
        ) : (
            t('statistics.view.dataAsOf', { time: horaDatos })
        )
    ) : null;

    return (
        <div className={cn('min-h-screen bg-background px-4 pt-5 pb-8 md:px-7 md:pt-7', VARS_GRAFICOS)}>
            <div className="@container/pagina mx-auto flex max-w-7xl flex-col gap-6">
                {/* ── Cabecera: título con el periodo aplicado; periodo, rango y exportar ── */}
                <header className="flex flex-col gap-4 @min-[1100px]/pagina:flex-row @min-[1100px]/pagina:items-start @min-[1100px]/pagina:justify-between @min-[1100px]/pagina:gap-6">
                    <div className="flex min-w-0 flex-col gap-1">
                        <h1 className={cn('text-[28px] leading-[34px] font-semibold tracking-[-0.025em]', TEXTO_NAVY)}>{t('statistics.title')}</h1>
                        <p className="text-[14px] leading-5 text-muted-foreground" aria-live="polite">
                            <span className={cn('font-semibold', TEXTO_NAVY)}>{rangoAplicado ? t('statistics.filters.custom') : periodLabel}</span>
                            {textoCabecera && `, ${textoCabecera}`}
                        </p>
                        <div className={cn('min-h-4 text-[12.5px] leading-4 tabular-nums', TEXTO_SUAVE)} aria-live="polite">
                            {lineaEstado}
                        </div>
                    </div>

                    <div className="flex flex-col @min-[1100px]/pagina:items-end">
                        <div className="flex flex-col gap-2.5 @xl/pagina:flex-row @xl/pagina:flex-wrap @xl/pagina:items-center @min-[1100px]/pagina:flex-nowrap">
                            <Segmentado
                                opciones={periodOptions}
                                activa={periodoActivo}
                                onElegir={elegirPeriodo}
                                etiqueta={t('statistics.filters.period')}
                                className="grid grid-cols-3 @lg/pagina:flex"
                            />
                            <div className="flex items-center gap-2.5">
                                <CampoRango
                                    inicio={inicioAplicado}
                                    fin={finAplicado}
                                    onAplicar={aplicarRango}
                                    onLimpiar={limpiarRango}
                                    placeholder={t('statistics.view.dateRange')}
                                    className="min-w-0 flex-1 @xl/pagina:w-[200px] @xl/pagina:flex-none"
                                    clasePanel="left-0 @min-[1100px]/pagina:left-auto @min-[1100px]/pagina:right-0"
                                />
                                <Button
                                    type="button"
                                    onClick={handleExport}
                                    disabled={isExporting || actualizando}
                                    aria-busy={isExporting || undefined}
                                    className="h-9 shrink-0 gap-2 rounded-[10px] pr-4 pl-3.5 text-[13px] leading-[18px] font-semibold settings-btn-primary disabled:opacity-50 has-[>svg]:pr-4 has-[>svg]:pl-3.5"
                                >
                                    {isExporting ? (
                                        <Loader2 className="size-[15px] animate-spin motion-reduce:animate-none" strokeWidth={2} aria-hidden="true" />
                                    ) : (
                                        <FileSpreadsheet className="size-[15px]" strokeWidth={2} aria-hidden="true" />
                                    )}
                                    {isExporting ? t('statistics.exporting') : t('statistics.view.exportExcel')}
                                </Button>
                            </div>
                        </div>
                        <p aria-live="polite" className={cn('mt-2 flex items-center gap-1.5 text-[12.5px] leading-4 font-medium empty:mt-0', TXT_MAL)}>
                            {exportError && (
                                <>
                                    <CircleAlert className="size-[13px] shrink-0" strokeWidth={2} aria-hidden="true" />
                                    {exportError === 'session' ? t('statistics.view.sessionExpired') : t('statistics.view.exportError')}
                                </>
                            )}
                        </p>
                    </div>
                </header>

                {/* Mientras llegan las cifras nuevas se siguen viendo las anteriores, atenuadas: los
                    controles no desaparecen y el foco no se pierde. */}
                <div className={cn('flex flex-col gap-6 transition-opacity motion-reduce:transition-none', actualizando && 'opacity-60')} aria-busy={actualizando || undefined}>
                    {/* ── Franja de cifras: cada una lleva a su tema ── */}
                    <nav
                        aria-label={t('statistics.view.summaryLabel')}
                        className={cn(
                            'grid grid-cols-2 gap-x-6 gap-y-5 @xl/pagina:grid-cols-3 @5xl/pagina:gap-x-5 @5xl/pagina:gap-y-0',
                            costs
                                ? '@5xl/pagina:grid-cols-[repeat(5,minmax(0,1fr)_1px)_minmax(0,1.2fr)]'
                                : '@5xl/pagina:grid-cols-[repeat(4,minmax(0,1fr)_1px)_minmax(0,1fr)]'
                        )}
                    >
                        {cifras.map((c, i) => {
                            const Icono = c.icono;

                            return [
                                i > 0 && <div key={`${c.id}-div`} className="hidden w-px self-stretch bg-[#2e3f84]/12 @5xl/pagina:block dark:bg-white/10" aria-hidden="true" />,
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => irA(c.id)}
                                    title={t('statistics.view.goTo', { section: c.destino })}
                                    className={cn('group relative -m-1.5 flex min-w-0 cursor-pointer flex-col rounded-lg p-1.5 text-left transition-colors hover:bg-[#2e3f84]/[0.035] dark:hover:bg-white/[0.03]', FOCO)}
                                >
                                    <span className="flex h-4 min-w-0 items-center gap-2">
                                        <Icono className={cn('size-3.5 shrink-0', c.iconoTono ?? TEXTO_NAVY)} strokeWidth={2} aria-hidden="true" />
                                        <span className="truncate text-[12px] leading-4 font-medium text-muted-foreground">{c.etiqueta}</span>
                                        <ChevronRight className="-ml-[3px] size-3 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" strokeWidth={2} aria-hidden="true" />
                                        <span className="sr-only">{t('statistics.view.goTo', { section: c.destino })}</span>
                                    </span>
                                    <span
                                        className={cn(
                                            'mt-[7px] truncate font-medium tracking-[-0.03em] whitespace-nowrap tabular-nums',
                                            TEXTO_NAVY,
                                            c.valor.length > 10 ? 'text-[22px] leading-8' : 'text-[26px] leading-8 @min-[1120px]/pagina:text-[28px]'
                                        )}
                                    >
                                        {c.valor}
                                    </span>
                                    <span className="mt-[5px] flex h-4 min-w-0 items-center truncate text-[12.5px] leading-4 text-muted-foreground tabular-nums">{c.detalle}</span>
                                </button>,
                            ];
                        })}
                    </nav>

                    {/* ── La hoja: un tema tras otro, cada uno con su banda ── */}
                    <div className={cn('@container/hoja overflow-hidden', HOJA)}>
                        {/* 1. Costo estimado de WhatsApp */}
                        {costs &&
                            (() => {
                                const c = costs;
                                const catNames: Record<string, string> = {
                                    marketing: t('statistics.view.costCategories.marketing'),
                                    utility: t('statistics.view.costCategories.utility'),
                                    authentication: t('statistics.view.costCategories.authentication'),
                                    service: t('statistics.view.costCategories.service'),
                                };
                                const catHints: Record<string, string> = {
                                    marketing: t('statistics.view.costCategories.marketingHint'),
                                    utility: t('statistics.view.costCategories.utilityHint'),
                                    authentication: t('statistics.view.costCategories.authenticationHint'),
                                    service: t('statistics.view.costCategories.serviceHint'),
                                };
                                const rows = Object.entries(c.by_category);
                                const serie = [...(c.series ?? [])].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
                                const conSerie = serie.length > 0;

                                // Cada día del período (hasta hoy) aparece aunque no tenga cobro: un hueco
                                // (fines de semana, días sin datos de Meta) se ve como hueco y no se pega al
                                // siguiente. Con «Todo el tiempo», del primer al último día con datos.
                                const porDia = new Map(serie.map((p) => [p.day, p]));
                                const desde = rangoDatos.start ?? serie[0]?.day;
                                let hasta = rangoDatos.end ?? serie[serie.length - 1]?.day;
                                if (hasta && hasta > hoy) hasta = hoy;
                                const relleno: { day: string; billable: number; cost: number }[] = [];
                                if (conSerie && desde && hasta && desde <= hasta) {
                                    for (let d = desde; d <= hasta && relleno.length < 4000; d = sumarDias(d, 1)) {
                                        relleno.push(porDia.get(d) ?? { day: d, billable: 0, cost: 0 });
                                    }
                                }
                                const dias = relleno.length > 0 ? relleno : serie;
                                const grupo = costGroup ?? (dias.length > 62 ? 'month' : 'day');

                                // "Por mes" se agrega aquí mismo: el cambio es instantáneo y no hay que volver a consultar.
                                const porMes = new Map<string, { day: string; billable: number; cost: number }>();
                                for (const p of dias) {
                                    const k = p.day.slice(0, 7);
                                    const acc = porMes.get(k) ?? { day: k, billable: 0, cost: 0 };
                                    acc.billable += p.billable;
                                    acc.cost += p.cost;
                                    porMes.set(k, acc);
                                }
                                const puntos = grupo === 'month' ? [...porMes.values()] : dias;
                                const cruzaAnio = puntos.length > 1 && puntos[0].day.slice(0, 4) !== puntos[puntos.length - 1].day.slice(0, 4);
                                const etiqueta = (d: string) => {
                                    if (grupo === 'month') {
                                        const f = fechaLocal(`${d}-01`);
                                        return `${mesCorto(f)} ${f.getFullYear()}`;
                                    }
                                    const [y, m, dd] = d.split('-');
                                    return cruzaAnio ? `${dd}/${m}/${y.slice(2)}` : `${dd}/${m}`;
                                };
                                const tituloPunto = (d: string) => (grupo === 'month' ? mesLargo(d) : diaLargo(d));
                                const datos = puntos.map((p) => ({ day: p.day, name: etiqueta(p.day), cost: Number(p.cost.toFixed(2)), billable: p.billable }));
                                const marcasCosto = marcasRedondas(Math.max(...datos.map((d) => d.cost), 0));

                                // «2025-11» → «noviembre de 2025».
                                const [anioTarifa, mesTarifa] = (c.rates_as_of ?? '').split('-').map(Number);
                                const tarifasDe = anioTarifa ? mesLargo(`${anioTarifa}-${dos(mesTarifa || 1)}`) : null;
                                const sinTarifa = c.billable_without_rate ?? 0;

                                return (
                                    <Tema id="est-costo">
                                        <Banda
                                            id="est-costo-titulo"
                                            icono={Wallet}
                                            titulo={t('statistics.view.costTitle')}
                                            texto={tarifasDe ? t('statistics.view.costSubtitleAsOf', { date: tarifasDe }) : t('statistics.view.costSubtitle')}
                                            derecha={
                                                <div className="flex flex-col items-start gap-px @3xl/hoja:items-end">
                                                    <span className={cn('text-[12px] leading-4', TEXTO_SUAVE)}>{t('statistics.costs.periodEstimate')}</span>
                                                    <span className={cn('text-[20px] leading-6 font-semibold tracking-[-0.02em] tabular-nums', TEXTO_NAVY)}>{formatMoney(c.total_cost, c.currency)}</span>
                                                </div>
                                            }
                                        />
                                        <NotasTema avisos={avisosDe('costs')} />
                                        <div className={cn('grid gap-y-6 border-b py-[18px] @5xl/hoja:grid-cols-[minmax(0,1fr)_1px_minmax(380px,0.72fr)] @5xl/hoja:gap-x-8', SANGRIA, FILETE)}>
                                            <div className="flex min-w-0 flex-col gap-3.5">
                                                <div className="flex min-h-[30px] flex-wrap items-center justify-between gap-2">
                                                    <Rotulo
                                                        titulo={t('statistics.view.costEvolution')}
                                                        apoyo={c.currency === 'USD' ? t('statistics.view.costEvolutionHintUsd') : t('statistics.view.costEvolutionHint', { currency: c.currency })}
                                                    />
                                                    {conSerie && (
                                                        <Segmentado
                                                            peq
                                                            etiqueta={t('statistics.costs.groupBy')}
                                                            opciones={[
                                                                { value: 'day', label: t('statistics.costs.byDay') },
                                                                { value: 'month', label: t('statistics.costs.byMonth') },
                                                            ]}
                                                            activa={grupo}
                                                            onElegir={(g) => setCostGroup(g as 'day' | 'month')}
                                                        />
                                                    )}
                                                </div>
                                                {conSerie ? (
                                                    <>
                                                        <div className="h-[214px] min-w-0">
                                                            <ResponsiveContainer width="100%" height="100%">
                                                                <BarChart data={datos} title={t('statistics.view.costEvolution')} margin={{ top: 8, right: 0, bottom: 0, left: 0 }} barCategoryGap="25%">
                                                                    <CartesianGrid vertical={false} stroke={G.rejilla} />
                                                                    <XAxis dataKey="name" tick={EJE} axisLine={{ stroke: G.base }} tickLine={false} interval="preserveStartEnd" minTickGap={8} tickMargin={6} />
                                                                    <YAxis
                                                                        tick={EJE}
                                                                        axisLine={false}
                                                                        tickLine={false}
                                                                        width={52}
                                                                        tickMargin={8}
                                                                        ticks={marcasCosto}
                                                                        domain={[0, marcasCosto[marcasCosto.length - 1]]}
                                                                        tickFormatter={(v: number) => (v === 0 ? '0' : v.toLocaleString(loc(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}
                                                                    />
                                                                    <Tooltip
                                                                        cursor={{ fill: G.realce, radius: 6 }}
                                                                        isAnimationActive={false}
                                                                        content={({ active, payload }: ContenidoGlobo) => {
                                                                            const p = payload?.[0]?.payload as (typeof datos)[number] | undefined;
                                                                            if (!active || !p) return null;
                                                                            return (
                                                                                <Globo
                                                                                    titulo={tituloPunto(p.day)}
                                                                                    filas={[
                                                                                        { color: G.serie, etiqueta: t('statistics.costs.table.cost'), valor: formatMoney(p.cost, c.currency), fuerte: true },
                                                                                        { etiqueta: t('statistics.costs.table.billable'), valor: formatNumber(p.billable) },
                                                                                    ]}
                                                                                />
                                                                            );
                                                                        }}
                                                                    />
                                                                    <Bar dataKey="cost" fill={G.serie} radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={animar} />
                                                                </BarChart>
                                                            </ResponsiveContainer>
                                                        </div>
                                                        <TablaOculta
                                                            titulo={t('statistics.view.costEvolution')}
                                                            columnas={[grupo === 'month' ? t('statistics.view.monthCol') : t('statistics.view.dayCol'), t('statistics.costs.table.cost'), t('statistics.costs.table.billable')]}
                                                            filas={datos.map((p) => ({ clave: p.day, celdas: [tituloPunto(p.day), formatMoney(p.cost, c.currency), formatNumber(p.billable)] }))}
                                                        />
                                                        <p className={cn('text-[12px] leading-4', TEXTO_SUAVE)}>{t('statistics.view.costGapNote')}</p>
                                                    </>
                                                ) : (
                                                    <Vacio mensaje={t('statistics.view.noCostSeries')} alto="h-[214px]" />
                                                )}
                                            </div>

                                            <DivisorV desde="@5xl/hoja:block" />

                                            <div className="relative min-w-0 overflow-x-auto">
                                                <table className="w-full table-fixed border-collapse text-left">
                                                    <thead>
                                                        <tr className="border-b border-[#2e3f84]/12 dark:border-white/10">
                                                            <th scope="col" className={cn('pb-2.5 align-bottom', TH)}>
                                                                {t('statistics.costs.table.category')}
                                                            </th>
                                                            <th scope="col" className={cn('w-[80px] pb-2.5 align-bottom pl-2 text-right @xl/hoja:w-[86px] @xl/hoja:pl-3', TH)}>
                                                                {t('statistics.costs.table.billable')}
                                                            </th>
                                                            <th scope="col" className={cn('hidden w-[84px] pb-2.5 align-bottom pl-2 text-right @md/hoja:table-cell @xl/hoja:w-[92px] @xl/hoja:pl-3', TH)}>
                                                                {t('statistics.costs.table.rate')}
                                                            </th>
                                                            <th scope="col" className={cn('w-[74px] pb-2.5 align-bottom pl-2 text-right @xl/hoja:w-[82px] @xl/hoja:pl-3', TH)}>
                                                                {t('statistics.costs.table.cost')}
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {rows.map(([key, data]) => {
                                                            const nombreCat = catNames[key] ?? t('statistics.view.otherCategory', { key });
                                                            const pista = catHints[key];

                                                            return (
                                                                <tr key={key} className={cn('h-[42px] border-b', FILETE)}>
                                                                    <th scope="row" className="py-1 pr-2 text-left font-normal" title={pista ? `${nombreCat} · ${pista}` : nombreCat}>
                                                                        <span className={cn('block truncate text-[13px] leading-[17px] font-medium', TEXTO_NAVY)}>{nombreCat}</span>
                                                                        {pista && <span className={cn('block truncate text-[11.5px] leading-[14px]', TEXTO_SUAVE)}>{pista}</span>}
                                                                    </th>
                                                                    <td className={cn('pl-2 text-right text-[13px] leading-[18px] font-medium tabular-nums @xl/hoja:pl-3', data.billable ? TEXTO_NAVY : TEXTO_SUAVE)}>
                                                                        {formatNumber(data.billable)}
                                                                    </td>
                                                                    <td
                                                                        className={cn(
                                                                            'hidden pl-2 text-right text-[12.5px] leading-[18px] whitespace-nowrap tabular-nums @md/hoja:table-cell @xl/hoja:pl-3',
                                                                            data.rate === 0 && data.billable > 0 ? cn('font-medium', TXT_AVISO) : TEXTO_SUAVE
                                                                        )}
                                                                    >
                                                                        {data.rate === 0 ? (data.billable > 0 ? t('statistics.view.noRate') : t('statistics.costs.free')) : formatMoney(data.rate, c.currency, 4)}
                                                                    </td>
                                                                    <td className={cn('pl-2 text-right text-[13px] leading-[18px] font-semibold whitespace-nowrap tabular-nums @xl/hoja:pl-3', data.cost ? TEXTO_NAVY : TEXTO_SUAVE)}>
                                                                        {formatMoney(data.cost, c.currency)}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                    <tfoot>
                                                        <tr className="h-11">
                                                            <th scope="row" colSpan={2} className={cn('text-left text-[13px] leading-[18px] font-semibold', TEXTO_NAVY)}>
                                                                {t('statistics.costs.estimatedTotal')}
                                                            </th>
                                                            <td className="hidden @md/hoja:table-cell" />
                                                            <td className={cn('pl-2 text-right text-[14px] leading-[18px] font-semibold whitespace-nowrap tabular-nums @xl/hoja:pl-3', TEXTO_NAVY)}>
                                                                {formatMoney(c.total_cost, c.currency)}
                                                            </td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        </div>

                                        {/* Mensajes con dato de cobro */}
                                        <div className={cn('flex flex-col gap-3 border-b py-4', SANGRIA, FILETE)}>
                                            <Rotulo
                                                titulo={t('statistics.view.pricingCoverage')}
                                                apoyo={t('statistics.view.pricingCoverageText', { percent: formatRate(c.coverage_percent), total: formatNumber(c.outbound_total) })}
                                            />
                                            <Apilada
                                                alto={10}
                                                partes={[
                                                    { etiqueta: t('statistics.costs.billableOutbound'), valor: c.billable_total, color: G.serie },
                                                    { etiqueta: t('statistics.costs.free'), valor: c.free_total, color: G.ok },
                                                    { etiqueta: t('statistics.costs.noBillingData'), valor: c.without_pricing, color: G.neutro },
                                                ]}
                                            />
                                            <div className="flex flex-wrap items-center gap-x-7 gap-y-2">
                                                {(
                                                    [
                                                        [G.serie, t('statistics.costs.billableOutbound'), c.billable_total],
                                                        [G.ok, t('statistics.view.freeService'), c.free_total],
                                                        [G.neutro, t('statistics.costs.noBillingData'), c.without_pricing],
                                                    ] as const
                                                ).map(([color, etq, v]) => (
                                                    <span key={etq} className="flex items-center gap-2 whitespace-nowrap">
                                                        <Cuadro color={color} />
                                                        <span className={cn('text-[12.5px] leading-4 font-medium', TEXTO_NAVY)}>{etq}</span>
                                                        <span className={cn('text-[12.5px] leading-4 font-semibold tabular-nums', TEXTO_NAVY)}>{formatNumber(v)}</span>
                                                    </span>
                                                ))}
                                            </div>
                                            {(c.without_pricing > 0 || sinTarifa > 0) && (
                                                <div className="flex flex-col gap-1.5">
                                                    {c.without_pricing > 0 && (
                                                        <p className={cn('flex items-start gap-1.5 text-[12px] leading-4 font-medium', TXT_AVISO)}>
                                                            <CircleAlert className="mt-px size-[13px] shrink-0" strokeWidth={2} aria-hidden="true" />
                                                            {t('statistics.view.missingRatesWarning')}
                                                        </p>
                                                    )}
                                                    {sinTarifa > 0 && (
                                                        <p className={cn('flex items-start gap-1.5 text-[12px] leading-4 font-medium', TXT_AVISO)}>
                                                            <CircleAlert className="mt-px size-[13px] shrink-0" strokeWidth={2} aria-hidden="true" />
                                                            {t('statistics.view.unknownRateWarning', { value: formatNumber(sinTarifa) })}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                            <p className={cn('text-[12px] leading-4', TEXTO_SUAVE)}>
                                                <Trans
                                                    i18nKey="statistics.view.metaBillingNote"
                                                    values={{ path: t('statistics.costs.metaBillingPath') }}
                                                    components={{ strong: <span className={cn('font-semibold', TEXTO_NAVY)} /> }}
                                                />
                                            </p>
                                        </div>
                                    </Tema>
                                );
                            })()}

                        {/* 2. Mensajes */}
                        <Tema id="est-mensajes">
                            <Banda
                                id="est-mensajes-titulo"
                                icono={MessageSquare}
                                titulo={t('statistics.messages.title')}
                                texto={t('statistics.view.messagesSubtitle', { value: formatNumber(messages.total) })}
                            />
                            <NotasTema avisos={avisosDe('messages', 'delivery')} />
                            <div className={cn('grid gap-y-6 border-b py-[18px] @4xl/hoja:grid-cols-[minmax(0,1fr)_1px_minmax(0,1.2fr)] @4xl/hoja:gap-x-8', SANGRIA, FILETE)}>
                                <div className="flex min-w-0 flex-col gap-[18px]">
                                    <Rotulo titulo={t('statistics.view.whoWrites')} />
                                    <div className="grid grid-cols-2 gap-x-6">
                                        {(
                                            [
                                                ['sistema', t('statistics.view.writerSystem'), messages.sent_by_system, G.serie],
                                                ['pacientes', t('statistics.view.writerPatients'), escritos, G.serie2],
                                            ] as const
                                        ).map(([clave, etq, v, color]) => (
                                            <div key={clave} className="flex min-w-0 flex-col gap-1">
                                                <span className="flex min-w-0 items-center gap-2">
                                                    <Cuadro color={color} />
                                                    <span className={cn('line-clamp-2 text-[12.5px] leading-4 font-medium', TEXTO_SUAVE)} title={etq}>
                                                        {etq}
                                                    </span>
                                                </span>
                                                <span className="flex items-baseline gap-2">
                                                    <span className={cn('text-[24px] leading-[30px] font-medium tracking-[-0.025em] tabular-nums', TEXTO_NAVY)}>{formatNumber(v)}</span>
                                                    <span className={cn('text-[12.5px] leading-4 tabular-nums', TEXTO_SUAVE)}>{pct(v, messages.total, 0)}</span>
                                                </span>
                                                {clave === 'pacientes' && toques > 0 && (
                                                    <span className={cn('text-[12px] leading-4 tabular-nums', TEXTO_SUAVE)}>{t('statistics.view.buttonTaps', { value: formatNumber(toques) })}</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <Apilada
                                        partes={[
                                            { etiqueta: t('statistics.view.writerSystem'), valor: messages.sent_by_system, color: G.serie },
                                            { etiqueta: t('statistics.view.writerPatients'), valor: escritos, color: G.serie2 },
                                            { etiqueta: t('statistics.view.buttonTapsShort'), valor: toques, color: G.neutro },
                                        ]}
                                    />
                                    <p className={cn('text-[12px] leading-[17px] tabular-nums', TEXTO_SUAVE)}>
                                        {t('statistics.metricModal.messages.headline')}: <span className={cn('font-semibold', TEXTO_NAVY)}>{formatNumber(messages.total)}</span>
                                    </p>
                                </div>
                                <DivisorV />
                                <div className="flex min-w-0 flex-col gap-3.5">
                                    <Rotulo titulo={t('statistics.view.deliveryStatus')} apoyo={t('statistics.view.ofOutbound', { value: formatNumber(outboundTotal) })} />
                                    {outboundTotal > 0 ? (
                                        <>
                                            <Apilada partes={delivery.map((d) => ({ etiqueta: d.label, valor: d.value, color: d.color }))} />
                                            <div className="flex flex-col">
                                                {delivery.map((d) => (
                                                    <Leyenda key={d.key} color={d.color} etiqueta={d.label} valor={d.value} total={outboundTotal} />
                                                ))}
                                            </div>
                                            <p className={cn('text-[12px] leading-4', TEXTO_SUAVE)}>{t('statistics.view.readNote')}</p>
                                        </>
                                    ) : (
                                        <Vacio mensaje={t('statistics.messages.noOutbound')} alto="h-[150px]" />
                                    )}
                                </div>
                            </div>
                        </Tema>

                        {/* 3. Citas y recordatorios */}
                        <Tema id="est-citas">
                            <Banda
                                id="est-citas-titulo"
                                icono={CalendarCheck2}
                                titulo={t('statistics.view.appointmentsTitle')}
                                texto={t('statistics.view.appointmentsSubtitle', { value: formatNumber(appointments.total) })}
                            />
                            <NotasTema avisos={avisosDe('appointments')} notas={notaCitas} />
                            <div className={cn('grid gap-y-6 border-b py-[18px] @4xl/hoja:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] @4xl/hoja:gap-x-8', SANGRIA, FILETE)}>
                                <div className="flex min-w-0 flex-col gap-3.5">
                                    <Rotulo titulo={t('statistics.view.loadedAppointments')} apoyo={t('statistics.view.andReminder')} />
                                    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                                        <span className={cn('text-[24px] leading-[30px] font-medium tracking-[-0.025em] tabular-nums', TEXTO_NAVY)}>{formatNumber(appointments.total)}</span>
                                        <span className={cn('text-[12.5px] leading-4', TEXTO_SUAVE)}>{t('statistics.view.totalLoadedLower')}</span>
                                        {citasFuturas > 0 && (
                                            <span className={cn('text-[12.5px] leading-4 tabular-nums', TEXTO_SUAVE)}>· {t('statistics.view.futureAppointments', { value: formatNumber(citasFuturas) })}</span>
                                        )}
                                    </div>
                                    <div className="flex flex-col">
                                        <FilaBarra etiqueta={t('statistics.appointments.remindersSent')} valor={appointments.reminder_sent} total={appointments.total} color={G.serie} />
                                        <FilaBarra etiqueta={t('statistics.appointments.pending')} valor={appointments.pending} total={appointments.total} color={G.neutro} />
                                        <FilaBarra etiqueta={t('statistics.appointments.failed')} valor={appointments.failed} total={appointments.total} color={G.mal} />
                                        {canceladasHospital !== undefined && (
                                            <FilaBarra etiqueta={t('statistics.appointments.cancelledByHospital')} valor={canceladasHospital} total={appointments.total} color={G.serie2} />
                                        )}
                                    </div>
                                </div>
                                <DivisorV />
                                <div className="flex min-w-0 flex-col gap-3.5">
                                    <Rotulo titulo={t('statistics.view.patientResponse')} apoyo={t('statistics.view.patientResponseHint')} />
                                    {appointmentsData.length > 0 ? (
                                        <div className="flex flex-col items-center gap-5 @md/hoja:flex-row @md/hoja:gap-8">
                                            <div className="relative size-[150px] shrink-0">
                                                {/* El anillo es decorativo para el lector: la leyenda ya da cifras y %. */}
                                                <div aria-hidden="true">
                                                    <PieChart width={150} height={150} accessibilityLayer={false}>
                                                        <Pie
                                                            data={appointmentsData}
                                                            dataKey="value"
                                                            nameKey="name"
                                                            cx="50%"
                                                            cy="50%"
                                                            innerRadius={57}
                                                            outerRadius={75}
                                                            startAngle={90}
                                                            endAngle={-270}
                                                            paddingAngle={appointmentsData.length > 1 ? 1.2 : 0}
                                                            stroke="none"
                                                            isAnimationActive={animar}
                                                        >
                                                            {appointmentsData.map((entry) => (
                                                                <Cell key={entry.name} fill={entry.color} />
                                                            ))}
                                                        </Pie>
                                                        <Tooltip
                                                            isAnimationActive={false}
                                                            content={({ active, payload }: ContenidoGlobo) => {
                                                                const p = payload?.[0]?.payload as (typeof appointmentsData)[number] | undefined;
                                                                if (!active || !p) return null;
                                                                return (
                                                                    <Globo
                                                                        titulo={t('statistics.view.patientResponse')}
                                                                        filas={[{ color: p.color, etiqueta: p.name, valor: `${formatNumber(p.value)} · ${pct(p.value, respuestasTotal)}`, fuerte: true }]}
                                                                    />
                                                                );
                                                            }}
                                                        />
                                                    </PieChart>
                                                </div>
                                                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                                                    <span className={cn('text-[22px] leading-[26px] font-medium tracking-[-0.02em] tabular-nums', TEXTO_NAVY)}>{formatNumber(centroAnillo)}</span>
                                                    <span className={cn('text-center text-[11.5px] leading-[14px] font-medium', TEXTO_SUAVE)}>{t('statistics.view.withReminder')}</span>
                                                </div>
                                            </div>
                                            <div className="flex w-full min-w-0 flex-1 flex-col">
                                                {appointmentsData.map((r) => (
                                                    <Leyenda key={r.name} color={r.color} etiqueta={r.name} valor={r.value} total={respuestasTotal} alto={34} />
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <Vacio mensaje={appointments.total > 0 ? t('statistics.view.noRemindersSent') : t('statistics.appointments.noData')} alto="h-[150px]" />
                                    )}
                                </div>
                            </div>
                        </Tema>

                        {/* 4. Conversaciones | Envíos masivos y equipo */}
                        <div className={cn('grid border-b @5xl/hoja:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]', FILETE)}>
                            <Tema id="est-conversaciones" className="min-w-0">
                                <Banda
                                    id="est-conversaciones-titulo"
                                    icono={MessagesSquare}
                                    titulo={t('statistics.conversations.title')}
                                    texto={t('statistics.view.conversationsSubtitle', { value: formatNumber(conversations.total) })}
                                />
                                <NotasTema avisos={avisosDe('conversations')} />
                                <div className={cn('flex flex-col gap-3 py-[18px] @3xl/hoja:pr-8', SANGRIA)}>
                                    <Rotulo titulo={t('statistics.conversations.byStatus')} apoyo={t('statistics.view.ofConversations', { value: formatNumber(conversations.total) })} />
                                    <div className="flex flex-col">
                                        {conversationItems.map((c) => (
                                            <FilaBarra
                                                key={c.key}
                                                etiqueta={c.label}
                                                valor={c.value}
                                                total={conversations.total}
                                                max={maxConversationItem}
                                                color={G.serie}
                                                alto={30}
                                                cuadro={false}
                                                anchoEtiqueta="grid-cols-[88px_minmax(0,1fr)_52px_48px] @xl/hoja:grid-cols-[96px_minmax(0,1fr)_56px_48px]"
                                            />
                                        ))}
                                    </div>
                                    {conversations.scheduled > 0 && <p className={cn('text-[12px] leading-4', TEXTO_SUAVE)}>{t('statistics.view.scheduledNote')}</p>}
                                    <div className={cn('h-px', FILETE_BG)} aria-hidden="true" />
                                    <div className="grid min-h-[22px] grid-cols-[minmax(0,1fr)_56px_48px] items-center gap-x-3.5">
                                        <span className={cn('flex min-w-0 flex-wrap items-baseline gap-x-2 text-[13px] leading-[18px] font-medium', sinLeer ? TXT_AVISO : TEXTO_SUAVE)}>
                                            <span className="flex items-center gap-2">
                                                {sinLeer && <span className={cn('size-2 shrink-0 self-center rounded-full', PUNTO_AVISO)} aria-hidden="true" />}
                                                {t('statistics.conversations.unread')}
                                            </span>
                                            <span className={cn('text-[12px] leading-4 font-normal', TEXTO_SUAVE)}>{t('statistics.view.unreadAnyState')}</span>
                                        </span>
                                        <span className={cn('text-right text-[13px] leading-[18px] font-semibold tabular-nums', sinLeer ? TXT_AVISO : TEXTO_SUAVE)}>{formatNumber(conversations.unread)}</span>
                                        <span className={cn('text-right text-[12px] leading-[18px] tabular-nums', TEXTO_SUAVE)}>{pct(conversations.unread, conversations.total)}</span>
                                    </div>
                                </div>
                            </Tema>

                            <Tema id="est-plantillas" className={cn('min-w-0 border-t @5xl/hoja:border-t-0 @5xl/hoja:border-l', FILETE)}>
                                <Banda
                                    id="est-plantillas-titulo"
                                    icono={FileText}
                                    titulo={t('statistics.view.templatesTeamTitle')}
                                    texto={t('statistics.view.templatesTeamSubtitle', { templates: formatNumber(templates.total), users: formatNumber(teamTotal) })}
                                />
                                <div className={cn('flex flex-col gap-6 py-[18px]', SANGRIA, '@5xl/hoja:pl-16')}>
                                    <div className="flex flex-col gap-3">
                                        <Rotulo titulo={t('statistics.view.templateSends')} apoyo={t('statistics.view.bulkInPeriod', { value: formatNumber(templates.total_sends) })} />
                                        <Apilada
                                            alto={10}
                                            partes={[
                                                { etiqueta: t('statistics.templates.successfulSends'), valor: templates.successful_sends, color: G.ok },
                                                { etiqueta: t('statistics.templates.failedSends'), valor: templates.failed_sends, color: G.mal },
                                            ]}
                                        />
                                        <div className="flex flex-col">
                                            <Leyenda color={G.ok} etiqueta={t('statistics.templates.successfulSends')} valor={templates.successful_sends} total={templates.total_sends} />
                                            <Leyenda color={G.mal} etiqueta={t('statistics.templates.failedSends')} valor={templates.failed_sends} total={templates.total_sends} />
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-3">
                                        <Rotulo titulo={t('statistics.users.teamCompositionSubtitle')} apoyo={t('statistics.view.usersCount', { value: formatNumber(teamTotal) })} />
                                        {usersData.length > 0 ? (
                                            <>
                                                <Apilada alto={10} partes={usersData.map((u) => ({ etiqueta: u.name, valor: u.value, color: u.color }))} />
                                                <div className="flex flex-col">
                                                    <Leyenda color={G.serie} etiqueta={t('statistics.users.admins')} valor={users.admins} total={teamTotal} />
                                                    <Leyenda color={G.curso} etiqueta={t('statistics.users.advisors')} valor={users.advisors} total={teamTotal} />
                                                </div>
                                            </>
                                        ) : (
                                            <Vacio mensaje={t('statistics.users.noData')} alto="h-[64px]" />
                                        )}
                                    </div>
                                </div>
                            </Tema>
                        </div>

                        {/* 5. Demanda del menú de bienvenida. El menú de bienvenida está apagado casi siempre;
                            sin recorridos, este tema entero se oculta en vez de ocupar media pantalla con ceros.
                            Si se reactiva el flujo y llegan datos, vuelve a aparecer solo. */}
                        {fd &&
                            (fd.total ?? 0) > 0 &&
                            (() => {
                                const svcLabels: Record<string, string> = {
                                    agendamiento: t('statistics.flowDemand.services.scheduling'),
                                    cancelacion: t('statistics.flowDemand.services.cancellation'),
                                    informacion: t('statistics.flowDemand.services.information'),
                                    asesor: t('statistics.flowDemand.services.talkToAdvisor'),
                                };
                                const outLabels: Record<string, string> = {
                                    self_service: t('statistics.flowDemand.outcomes.selfService'),
                                    advisor: t('statistics.flowDemand.outcomes.advisor'),
                                    rejected: t('statistics.flowDemand.outcomes.rejected'),
                                    in_progress: t('statistics.flowDemand.outcomes.inProgress'),
                                };
                                const outColors: Record<string, string> = { self_service: G.ok, advisor: G.serie, rejected: G.mal, in_progress: G.neutro };
                                const regimenLabel = (k: string) =>
                                    k === 'subsidiado'
                                        ? t('statistics.flowDemand.regimens.subsidized')
                                        : k === 'contributivo'
                                          ? t('statistics.flowDemand.regimens.contributory')
                                          : k.charAt(0).toLocaleUpperCase('es') + k.slice(1);
                                const desenlace = Object.entries(fd.by_outcome).map(([k, v]) => ({ key: k, etiqueta: outLabels[k] ?? k, valor: v, color: outColors[k] ?? G.neutro }));
                                // La tasa del menú es sobre los que TERMINARON (solos o con asesor), no sobre el total.
                                const terminaron = (fd.by_outcome.self_service ?? 0) + (fd.by_outcome.advisor ?? 0);
                                const ListaTop = ({ titulo, filas, vacio }: { titulo: string; filas: { name: string; value: number }[]; vacio?: string }) => (
                                    <div className="flex min-w-0 flex-col gap-2.5">
                                        <Rotulo titulo={titulo} />
                                        {filas.length > 0 ? (
                                            <div className="flex flex-col">
                                                {filas.map((f) => (
                                                    <div key={f.name} className="flex h-[34px] flex-col justify-center gap-[5px]">
                                                        <div className="flex items-baseline gap-2.5">
                                                            <span className={cn('min-w-0 flex-1 truncate text-[12.5px] leading-4 font-medium', TEXTO_NAVY)} title={f.name}>
                                                                {f.name}
                                                            </span>
                                                            <span className={cn('text-[12.5px] leading-4 font-semibold tabular-nums', TEXTO_NAVY)}>{formatNumber(f.value)}</span>
                                                        </div>
                                                        <BarraPista valor={f.value} max={fd.total} alto={4} />
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            vacio && <Vacio mensaje={vacio} alto="h-[88px]" />
                                        )}
                                    </div>
                                );
                                const flecha = (
                                    <span className="hidden items-center text-[#2e3f84]/35 @4xl/hoja:flex dark:text-white/30" aria-hidden="true">
                                        <ArrowRight className="size-4" strokeWidth={1.75} />
                                    </span>
                                );

                                return (
                                    <Tema id="est-menu">
                                        <Banda
                                            id="est-menu-titulo"
                                            icono={Bot}
                                            titulo={t('statistics.flowDemand.title')}
                                            texto={t('statistics.view.flowSubtitle')}
                                            derecha={
                                                <span className={cn('inline-flex items-center gap-1.5 text-[12.5px] leading-4 font-medium whitespace-nowrap tabular-nums', TXT_OK)}>
                                                    <span className={cn('size-[7px] rounded-full', PUNTO_OK)} aria-hidden="true" />
                                                    {t('statistics.view.flowRuns', { value: formatNumber(fd.total) })}
                                                </span>
                                            }
                                        />
                                        <div
                                            className={cn(
                                                'grid grid-cols-2 items-center gap-x-5 gap-y-5 border-b py-4 @4xl/hoja:grid-cols-[minmax(0,1fr)_16px_minmax(0,1fr)_16px_minmax(0,1fr)_1px_minmax(0,1fr)]',
                                                SANGRIA,
                                                FILETE
                                            )}
                                        >
                                            <MiniCifra etiqueta={t('statistics.flowDemand.flows')} valor={formatNumber(fd.total)} detalle={t('statistics.flowDemand.started')} />
                                            {flecha}
                                            <MiniCifra
                                                etiqueta={t('statistics.flowDemand.reachedMenu')}
                                                valor={formatNumber(fd.reached_menu)}
                                                detalle={t('statistics.view.acceptedPrivacy', { value: formatNumber(fd.accepted_privacy) })}
                                            />
                                            {flecha}
                                            <MiniCifra
                                                etiqueta={t('statistics.view.solvedByMenu')}
                                                valor={formatRate(fd.automation_rate)}
                                                detalle={t('statistics.view.solvedByMenuDetail', { value: formatNumber(terminaron) })}
                                                tono={TXT_OK}
                                            />
                                            <DivisorV />
                                            <MiniCifra etiqueta={t('statistics.flowDemand.toAdvisor')} valor={formatNumber(fd.by_outcome.advisor ?? 0)} detalle={t('statistics.flowDemand.requiredAgent')} />
                                        </div>
                                        <div className={cn('flex flex-col gap-3 border-b py-4', SANGRIA, FILETE)}>
                                            <Rotulo titulo={t('statistics.flowDemand.outcome')} apoyo={t('statistics.view.ofFlows', { value: formatNumber(fd.total) })} />
                                            <Apilada alto={10} partes={desenlace} />
                                            <div className="flex flex-wrap items-center gap-x-7 gap-y-2">
                                                {desenlace.map((d) => (
                                                    <span key={d.key} className="flex items-center gap-2 whitespace-nowrap">
                                                        <Cuadro color={d.color} />
                                                        <span className={cn('text-[12.5px] leading-4 font-medium', TEXTO_NAVY)}>{d.etiqueta}</span>
                                                        <span className={cn('text-[12.5px] leading-4 font-semibold tabular-nums', TEXTO_NAVY)}>{formatNumber(d.valor)}</span>
                                                        <span className={cn('text-[12px] leading-4 tabular-nums', TEXTO_SUAVE)}>{pct(d.valor, fd.total, 0)}</span>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div
                                            className={cn(
                                                'grid gap-y-6 border-b py-[18px] @2xl/hoja:grid-cols-2 @2xl/hoja:gap-x-8 @5xl/hoja:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)_1px_minmax(0,1fr)]',
                                                SANGRIA,
                                                FILETE
                                            )}
                                        >
                                            <div className="flex min-w-0 flex-col gap-[22px]">
                                                <ListaTop titulo={t('statistics.flowDemand.byService')} filas={Object.entries(fd.by_service).map(([k, v]) => ({ name: svcLabels[k] ?? k, value: v }))} />
                                                <ListaTop titulo={t('statistics.flowDemand.regimen')} filas={Object.entries(fd.by_regimen).map(([k, v]) => ({ name: regimenLabel(k), value: v }))} />
                                            </div>
                                            <DivisorV desde="@5xl/hoja:block" />
                                            <ListaTop titulo={t('statistics.flowDemand.topEps')} filas={fd.top_eps} vacio={t('statistics.flowDemand.noEpsData')} />
                                            <DivisorV desde="@5xl/hoja:block" />
                                            <ListaTop titulo={t('statistics.view.topSubService')} filas={fd.top_sub_service ?? []} vacio={t('statistics.view.noSubServiceData')} />
                                        </div>
                                    </Tema>
                                );
                            })()}

                        {/* 6. Rendimiento de asesores */}
                        <Tema id="est-asesores">
                            <Banda id="est-asesores-titulo" icono={Headphones} titulo={t('statistics.advisors.performanceTitle')} texto={t('statistics.view.advisorsSubtitle')} />
                            <NotasTema avisos={avisosDe('advisors')} />
                            <div
                                className={cn(
                                    'grid grid-cols-2 gap-x-5 gap-y-5 py-4 @xl/hoja:grid-cols-3 @5xl/hoja:grid-cols-[repeat(6,minmax(0,1fr)_1px)_minmax(0,1fr)] @5xl/hoja:gap-y-0',
                                    SANGRIA
                                )}
                            >
                                <MiniCifra etiqueta={t('statistics.users.advisors')} valor={formatNumber(advisors.total_advisors)} detalle={t('statistics.advisors.onTheTeam')} />
                                <DivisorV desde="@5xl/hoja:block" />
                                <MiniCifra etiqueta={t('statistics.chart.conversations')} valor={formatNumber(advisors.total_conversations)} detalle={t('statistics.advisors.assigned')} />
                                <DivisorV desde="@5xl/hoja:block" />
                                <MiniCifra etiqueta={t('statistics.advisors.resolved')} valor={formatNumber(advisors.total_resolved)} detalle={t('statistics.view.closedOrResolved')} />
                                <DivisorV desde="@5xl/hoja:block" />
                                <MiniCifra etiqueta={t('statistics.advisors.scheduled')} valor={formatNumber(advisors.total_scheduled)} detalle={t('statistics.view.scheduledDetail')} />
                                <DivisorV desde="@5xl/hoja:block" />
                                <MiniCifra etiqueta={t('statistics.chart.messages')} valor={formatNumber(advisors.total_messages_sent)} detalle={t('statistics.advisors.sentLower')} />
                                <DivisorV desde="@5xl/hoja:block" />
                                <MiniCifra
                                    etiqueta={t('statistics.advisors.resolutionCap')}
                                    valor={tasaEquipo === null ? t('statistics.view.noDataShort') : formatRate(tasaEquipo)}
                                    detalle={tasaEquipo === null ? t('statistics.view.noConversationsInPeriod') : t('statistics.view.teamAverage')}
                                    tono={tasaEquipo === null ? TEXTO_SUAVE : undefined}
                                />
                                <DivisorV desde="@5xl/hoja:block" />
                                <div className="col-span-2 @xl/hoja:col-span-3 @5xl/hoja:col-span-1">
                                    <MiniCifra
                                        etiqueta={t('statistics.view.released')}
                                        valor={liberacionApagada && liberadasTotal === 0 ? '—' : formatNumber(liberadasTotal)}
                                        detalle={liberacionApagada ? (liberadasTotal === 0 ? t('statistics.view.releasedOff') : t('statistics.view.releasedOffNow')) : t('statistics.view.releasedDetail')}
                                        tono={liberacionApagada && liberadasTotal === 0 ? TEXTO_SUAVE : undefined}
                                    />
                                </div>
                            </div>
                            <p className={cn('border-b pb-4 text-[12px] leading-[17px]', SANGRIA, FILETE, TEXTO_SUAVE)}>{t('statistics.view.advisorsHelp')}</p>

                            <div className={cn('flex min-h-[52px] flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3 @3xl/hoja:px-5 @5xl/hoja:flex-nowrap', FILETE)}>
                                {mejor && (
                                    <>
                                        <span className={cn('hidden w-8 shrink-0 justify-center @3xl/hoja:flex', TEXTO_NAVY)}>
                                            <Award className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
                                        </span>
                                        <p className={cn('min-w-0 text-[13px] leading-[18px] tabular-nums @5xl/hoja:truncate', TEXTO_SUAVE)}>
                                            <Trans
                                                i18nKey="statistics.view.topPerformer"
                                                values={{
                                                    name: nombrePropio(mejor.name),
                                                    resolved: formatNumber(mejor.resolved_conversations),
                                                    rate: formatRate(mejor.resolution_rate),
                                                }}
                                                components={{ strong: <span className={cn('font-semibold', TEXTO_NAVY)} /> }}
                                            />
                                        </p>
                                    </>
                                )}
                                {advisorList.length > 0 && (
                                    <div className="relative w-full @3xl/hoja:ml-auto @3xl/hoja:w-[260px] @3xl/hoja:shrink-0">
                                        <label htmlFor="buscar-asesor" className="sr-only">
                                            {t('statistics.view.searchAdvisor')}
                                        </label>
                                        <Search className={cn('pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2', TEXTO_SUAVE)} strokeWidth={1.75} aria-hidden="true" />
                                        <input
                                            id="buscar-asesor"
                                            type="text"
                                            value={busqueda}
                                            onChange={(event) => setBusqueda(event.target.value)}
                                            placeholder={t('statistics.view.searchAdvisor')}
                                            className={cn(
                                                'h-9 w-full rounded-[10px] bg-[#2e3f84]/[0.035] pr-9 pl-[38px] text-[13px] leading-[18px] text-foreground shadow-[inset_0_0_0_1px_rgba(46,63,132,0.1)] transition-shadow placeholder:text-muted-foreground dark:bg-white/5 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] dark:placeholder:text-neutral-400',
                                                FOCO
                                            )}
                                        />
                                        {busqueda && (
                                            <button
                                                type="button"
                                                onClick={() => setBusqueda('')}
                                                className={cn(
                                                    'absolute top-1/2 right-2 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-[#2e3f84]/8 hover:text-[#2e3f84] dark:hover:bg-white/10 dark:hover:text-neutral-100',
                                                    TEXTO_SUAVE,
                                                    FOCO
                                                )}
                                                aria-label={t('common.clearSearch')}
                                                title={t('common.clearSearch')}
                                            >
                                                <X className="size-3.5" aria-hidden="true" />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className={cn('flex flex-wrap items-center gap-x-6 gap-y-1.5 border-b px-4 py-2.5 text-[12px] leading-4 @3xl/hoja:pr-5 @3xl/hoja:pl-16', FILETE, TEXTO_SUAVE)}>
                                <span className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
                                    {t('statistics.view.conversationsBarLegend')}
                                    <span className="flex items-center gap-1.5">
                                        <Cuadro color={G.serie} />
                                        {t('statistics.advisors.resolvedLower')}
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <Cuadro color={G.serie2} />
                                        {t('statistics.view.otherLower')}
                                    </span>
                                </span>
                                <span>{t('statistics.view.rateLegend')}</span>
                            </div>

                            {advisorList.length === 0 ? (
                                <div className="p-5">
                                    <Vacio mensaje={t('statistics.advisors.noData')} alto="h-[120px]" />
                                </div>
                            ) : asesoresVisibles.length === 0 ? (
                                <div className="p-5">
                                    <Vacio mensaje={t('statistics.view.noAdvisorMatch', { q: busqueda.trim() })} alto="h-[120px]" />
                                </div>
                            ) : (
                                // El contorno global (2 px sólido) se dibuja por dentro: la hoja no lo recorta y se ve en contraste alto.
                                <div className="relative overflow-x-auto focus-visible:-outline-offset-2" role="region" aria-labelledby="est-asesores-titulo" tabIndex={0}>
                                    <table className="w-full min-w-[1088px] table-fixed border-collapse text-left @4xl/hoja:min-w-[1032px]">
                                        <thead>
                                            <tr className={cn('h-9 border-b', BANDA, FILETE)}>
                                                <th
                                                    scope="col"
                                                    className="sticky left-0 z-[2] bg-card bg-[image:linear-gradient(rgba(46,63,132,0.028),rgba(46,63,132,0.028))] pr-2.5 pl-4 @3xl/hoja:pl-[64px] dark:bg-[image:linear-gradient(rgba(255,255,255,0.03),rgba(255,255,255,0.03))]"
                                                >
                                                    <span className={TH}>{t('statistics.view.advisorColumn', { count: asesoresVisibles.length })}</span>
                                                </th>
                                                {thOrden('rate', t('statistics.advisors.resolutionCap'), 'w-[128px]')}
                                                {thOrden('total', t('statistics.chart.conversations'), 'w-[152px] @6xl/hoja:w-[204px]')}
                                                {thOrden('resolved', t('statistics.advisors.resolved'), 'w-[108px]', true)}
                                                {thOrden('active', t('statistics.advisors.active'), 'w-[92px]', true)}
                                                {thOrden('scheduled', t('statistics.advisors.scheduled'), 'w-[112px]', true)}
                                                {thOrden('released', t('statistics.view.released'), 'w-[108px]', true, <span className="sr-only"> {t('statistics.view.releasedDetail')}</span>)}
                                                {thOrden('messages', t('statistics.chart.messages'), 'w-[104px] @6xl/hoja:w-[170px]')}
                                                <th scope="col" className="w-[44px] pr-5 font-normal">
                                                    <span className="sr-only">{t('statistics.view.detail')}</span>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {asesoresVisibles.map((advisor) => {
                                                // resolution_rate es null cuando el asesor no tiene conversaciones
                                                // asignadas: eso es "sin datos", no un 0% (no se marca en rojo a quien no tenía carga).
                                                const rate = advisor.resolution_rate;
                                                const rateColor = rate === null ? G.neutro : rate >= 70 ? G.ok : rate >= 40 ? G.pend : G.mal;
                                                const rateText = rate === null ? TXT_NEUTRO : rate >= 70 ? TEXTO_NAVY : rate >= 40 ? TXT_AVISO : TXT_MAL;
                                                const nombre = nombrePropio(advisor.name);
                                                const abierto = expandedAdvisor === advisor.id;
                                                // Atendidas en el período = resueltas + sin resolver (las activas son de AHORA y no entran).
                                                const otras = Math.max(advisor.total_conversations - advisor.resolved_conversations, 0);
                                                const liberadas = advisor.released_inactive ?? 0;
                                                const numero = (v: number, fuerte = false) => (
                                                    <td className={cn('px-2.5 text-right text-[13px] leading-[18px] tabular-nums', fuerte ? 'font-semibold' : 'font-medium', v ? TEXTO_NAVY : TEXTO_SUAVE)}>{formatNumber(v)}</td>
                                                );

                                                return (
                                                    <tr
                                                        key={advisor.id}
                                                        onClick={() => openAdvisorDetail(advisor.id)}
                                                        className={cn(
                                                            'group h-[50px] cursor-pointer border-b transition-colors last:border-b-0 hover:bg-[#2e3f84]/[0.035] dark:hover:bg-white/[0.03]',
                                                            abierto && 'bg-[#2e3f84]/[0.045] dark:bg-white/[0.045]',
                                                            FILETE
                                                        )}
                                                    >
                                                        {/* Columna fija: al desplazar la tabla de lado (móvil) el nombre no se pierde. El
                                                            fondo opaco repite el tinte de la fila para no taparlo. */}
                                                        <th
                                                            scope="row"
                                                            className={cn(
                                                                'sticky left-0 z-[1] bg-card pr-2.5 pl-4 text-left font-normal @3xl/hoja:pl-5',
                                                                abierto
                                                                    ? 'bg-[image:linear-gradient(rgba(46,63,132,0.045),rgba(46,63,132,0.045))] dark:bg-[image:linear-gradient(rgba(255,255,255,0.045),rgba(255,255,255,0.045))]'
                                                                    : 'group-hover:bg-[image:linear-gradient(rgba(46,63,132,0.035),rgba(46,63,132,0.035))] dark:group-hover:bg-[image:linear-gradient(rgba(255,255,255,0.03),rgba(255,255,255,0.03))]'
                                                            )}
                                                        >
                                                            <div className="flex min-w-0 items-center gap-3">
                                                                <span
                                                                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#2e3f84]/10 text-[11px] leading-none font-semibold tracking-[0.02em] text-[#2e3f84] shadow-[inset_0_0_0_1px_rgba(46,63,132,0.06)] dark:bg-white/8 dark:text-neutral-200 dark:shadow-none"
                                                                    aria-hidden="true"
                                                                >
                                                                    {iniciales(advisor.name)}
                                                                </span>
                                                                <div className="flex min-w-0 flex-col gap-0.5">
                                                                    <button
                                                                        type="button"
                                                                        onClick={(event) => {
                                                                            event.stopPropagation();
                                                                            openAdvisorDetail(advisor.id);
                                                                        }}
                                                                        title={t('statistics.view.seeDetailOf', { name: nombre })}
                                                                        aria-haspopup="dialog"
                                                                        className={cn('-mx-1 truncate rounded px-1 text-left text-[13.5px] leading-[18px] font-semibold tracking-[-0.003em] hover:underline', TEXTO_NAVY, FOCO)}
                                                                    >
                                                                        {nombre}
                                                                    </button>
                                                                    {advisor.conversations_with_unread > 0 && (
                                                                        <span className={cn('flex min-w-0 items-center gap-1.5 text-[12px] leading-4 tabular-nums', TEXTO_SUAVE)}>
                                                                            <span className={cn('size-1.5 shrink-0 rounded-full', PUNTO_AVISO)} aria-hidden="true" />
                                                                            <span className="truncate">
                                                                                {t('statistics.view.withUnread', { count: advisor.conversations_with_unread, value: formatNumber(advisor.conversations_with_unread) })}
                                                                            </span>
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </th>
                                                        <td className="px-2.5">
                                                            {rate === null ? (
                                                                <div className="flex flex-col">
                                                                    <span className={cn('text-[13px] leading-[18px] font-medium', rateText)}>{t('statistics.view.noDataShort')}</span>
                                                                    <span className={cn('text-[11.5px] leading-[14px]', TEXTO_SUAVE)}>{t('statistics.view.noConversations')}</span>
                                                                </div>
                                                            ) : (
                                                                <div className="flex flex-col gap-[5px]">
                                                                    <span className={cn('text-[13px] leading-[18px] font-semibold tabular-nums', rateText)}>{formatRate(rate)}</span>
                                                                    <BarraPista valor={rate} max={100} color={rateColor} alto={4} />
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-2.5">
                                                            <div className="grid grid-cols-[48px_minmax(0,1fr)] items-center gap-x-3">
                                                                <span className={cn('text-right text-[13px] leading-[18px] font-semibold tabular-nums', advisor.total_conversations ? TEXTO_NAVY : TEXTO_SUAVE)}>
                                                                    {formatNumber(advisor.total_conversations)}
                                                                </span>
                                                                <div className="h-2 overflow-hidden rounded-full" style={{ background: G.pista }} aria-hidden="true">
                                                                    {advisor.total_conversations > 0 && (
                                                                        <div className="flex h-full gap-[2px]" style={{ width: anchoBarra(advisor.total_conversations, maxAdvisorConv) }}>
                                                                            <div style={{ flex: `${advisor.resolved_conversations} 1 0`, background: G.serie }} />
                                                                            {otras > 0 && <div style={{ flex: `${otras} 1 0`, background: G.serie2 }} />}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        {numero(advisor.resolved_conversations)}
                                                        {numero(advisor.active_conversations)}
                                                        {numero(advisor.scheduled_conversations)}
                                                        {liberacionApagada && liberadas === 0 ? (
                                                            <td className={cn('px-2.5 text-right text-[13px] leading-[18px] font-medium', TEXTO_SUAVE)} title={t('statistics.view.releasedOff')}>
                                                                <span aria-hidden="true">—</span>
                                                                <span className="sr-only">{t('statistics.view.releasedOff')}</span>
                                                            </td>
                                                        ) : (
                                                            <td className={cn('px-2.5 text-right text-[13px] leading-[18px] font-medium tabular-nums', liberadas ? TXT_AVISO : TEXTO_SUAVE)}>{formatNumber(liberadas)}</td>
                                                        )}
                                                        <td className="px-2.5">
                                                            <div className="grid grid-cols-[48px_minmax(0,1fr)] items-center gap-x-3">
                                                                <span className={cn('text-right text-[13px] leading-[18px] font-medium tabular-nums', advisor.messages_sent ? TEXTO_NAVY : TEXTO_SUAVE)}>
                                                                    {formatNumber(advisor.messages_sent)}
                                                                </span>
                                                                <BarraPista valor={advisor.messages_sent} max={maxAdvisorMsgs} alto={4} />
                                                            </div>
                                                        </td>
                                                        <td className="pr-5 text-right">
                                                            <ChevronRight
                                                                className={cn('ml-auto size-4 transition-colors group-hover:text-[#2e3f84] dark:group-hover:text-neutral-100', abierto ? TEXTO_NAVY : TEXTO_SUAVE)}
                                                                strokeWidth={1.75}
                                                                aria-hidden="true"
                                                            />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </Tema>
                    </div>
                </div>
            </div>

            {/* ── Panel lateral: detalle de un asesor ── */}
            <DialogPrimitive.Root open={expandedAdvisor !== null} onOpenChange={(open) => !open && closeAdvisorDetail()}>
                <DialogPrimitive.Portal>
                    <DialogPrimitive.Overlay className="fixed inset-0 z-[65] bg-[#2e3f84]/20 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none dark:bg-black/50" />
                    <DialogPrimitive.Content
                        aria-describedby={undefined}
                        onEscapeKeyDown={(event) => {
                            // Radix escucha Escape antes que React: con el calendario del rango abierto, Escape
                            // cierra solo el calendario (lo hace CampoRango), no el panel entero.
                            if ((event.target as HTMLElement | null)?.closest?.('[data-rango-abierto="true"]')) event.preventDefault();
                        }}
                        className={cn(
                            'fixed inset-y-0 right-0 z-[65] flex w-full max-w-[620px] flex-col bg-card shadow-[0_0_0_1px_rgba(46,63,132,0.08),-24px_0_48px_-24px_rgba(46,63,132,0.4)] outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=open]:duration-300 motion-reduce:animate-none sm:inset-y-2.5 sm:right-2.5 sm:rounded-[18px] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08),-24px_0_48px_-24px_rgba(0,0,0,0.8)]',
                            VARS_GRAFICOS
                        )}
                    >
                        {selectedAdvisor && (
                            <PanelAsesor
                                advisor={selectedAdvisor}
                                detail={advisorDetail?.advisor.id === selectedAdvisor.id ? advisorDetail : null}
                                loading={loadingAdvisor}
                                error={advisorError}
                                periodOptions={periodOptions}
                                advisorPeriod={advisorPeriod}
                                advisorStartDate={advisorStartDate}
                                advisorEndDate={advisorEndDate}
                                autoReleaseEnabled={advisors.auto_release_enabled}
                                animar={animar}
                                onPeriod={(value) => {
                                    if (value === advisorPeriod) return;
                                    setAdvisorPeriod(value);
                                    setAdvisorStartDate('');
                                    setAdvisorEndDate('');
                                    fetchAdvisorDetail(selectedAdvisor.id, value, '', '');
                                }}
                                onRange={(start, end) => {
                                    setAdvisorPeriod('custom');
                                    setAdvisorStartDate(start);
                                    setAdvisorEndDate(end);
                                    fetchAdvisorDetail(selectedAdvisor.id, 'custom', start, end);
                                }}
                                onClearRange={() => {
                                    if (advisorPeriod !== 'custom') return;
                                    setAdvisorPeriod(periodoAplicado);
                                    setAdvisorStartDate('');
                                    setAdvisorEndDate('');
                                    fetchAdvisorDetail(selectedAdvisor.id, periodoAplicado, '', '');
                                }}
                                onRetry={() => fetchAdvisorDetail(selectedAdvisor.id, advisorPeriod, advisorStartDate, advisorEndDate)}
                            />
                        )}
                    </DialogPrimitive.Content>
                </DialogPrimitive.Portal>
            </DialogPrimitive.Root>
        </div>
    );
}

function PanelAsesor({
    advisor,
    detail,
    loading,
    error,
    periodOptions,
    advisorPeriod,
    advisorStartDate,
    advisorEndDate,
    autoReleaseEnabled,
    animar,
    onPeriod,
    onRange,
    onClearRange,
    onRetry,
}: {
    advisor: AdvisorSummary;
    detail: AdvisorDetail | null;
    loading: boolean;
    error: ErrorCarga;
    periodOptions: { value: string; label: string }[];
    advisorPeriod: string;
    advisorStartDate: string;
    advisorEndDate: string;
    autoReleaseEnabled?: boolean;
    animar: boolean;
    onPeriod: (value: string) => void;
    onRange: (start: string, end: string) => void;
    onClearRange: () => void;
    onRetry: () => void;
}) {
    const { t } = useTranslation();
    const nombre = nombrePropio(detail?.advisor.name ?? advisor.name);
    const s = detail?.summary;
    const tipos = detail ? Object.entries(detail.message_types).sort((a, b) => b[1] - a[1]) : [];
    const totalTipos = tipos.reduce((sum, [, v]) => sum + v, 0);
    const maxTipo = tipos[0]?.[1] ?? 0;
    const nombresTipo: Record<string, string> = {
        text: t('statistics.view.messageTypeNames.text'),
        image: t('statistics.view.messageTypeNames.image'),
        document: t('statistics.view.messageTypeNames.document'),
        audio: t('statistics.view.messageTypeNames.audio'),
        video: t('statistics.view.messageTypeNames.video'),
        location: t('statistics.view.messageTypeNames.location'),
        sticker: t('statistics.view.messageTypeNames.sticker'),
        contact: t('statistics.view.messageTypeNames.contact'),
    };
    const miles = (v: number) => {
        if (v < 1000) return formatNumber(v);
        const n = (v / 1000).toLocaleString(loc(), { maximumFractionDigits: 1 });
        // «1,5 mil» en español; «1.5k» en inglés.
        return esIngles() ? `${n}${t('statistics.view.thousandShort')}` : `${n} ${t('statistics.view.thousandShort')}`;
    };
    const globoMensajes = (titulo: string, valor: number) => <Globo titulo={titulo} filas={[{ color: G.serie, etiqueta: t('statistics.chart.messages'), valor: formatNumber(valor), fuerte: true }]} />;

    // Actividad diaria: con muchos días las barras no se leen; se agrupan por semana (lunes) o por mes.
    const dias = detail?.daily_activity ?? [];
    const grupoDia: 'day' | 'week' | 'month' = dias.length > 92 ? 'month' : dias.length > 31 ? 'week' : 'day';
    const actividad = (() => {
        if (grupoDia === 'day') return dias.map((d) => ({ key: d.date, count: d.count }));
        const mapa = new Map<string, number>();
        for (const d of dias) {
            const f = fechaLocal(d.date);
            const clave = grupoDia === 'month' ? d.date.slice(0, 7) : isoLocal(new Date(f.getFullYear(), f.getMonth(), f.getDate() - ((f.getDay() + 6) % 7)));
            mapa.set(clave, (mapa.get(clave) ?? 0) + d.count);
        }
        return [...mapa.entries()].map(([key, count]) => ({ key, count }));
    })();
    const etiquetaDia = (clave: string) => {
        if (grupoDia === 'month') {
            const f = fechaLocal(`${clave}-01`);
            return `${mesCorto(f)} ${f.getFullYear()}`;
        }
        const f = fechaLocal(clave);
        if (grupoDia === 'week') return `${f.getDate()} ${mesCorto(f)}`;
        return `${f.toLocaleDateString(loc(), { weekday: 'short' }).replace(/\./g, '')} ${dos(f.getDate())}`;
    };
    const tituloDia = (clave: string) => (grupoDia === 'month' ? mesLargo(clave) : grupoDia === 'week' ? t('statistics.view.weekOf', { date: fechaLarga(clave) }) : diaLargo(clave));
    const datosDia = actividad.map((p) => ({ ...p, name: etiquetaDia(p.key) }));
    const marcasDia = marcasRedondas(Math.max(...datosDia.map((d) => d.count), 0), 4);
    const marcasHora = marcasRedondas(Math.max(...(detail?.hourly_distribution ?? []).map((d) => d.count), 0), 4);
    const rangoHora = (h: string) => t('statistics.view.hourRange', { from: h, to: `${h.slice(0, 2)}:59` });
    const apoyoDia = [
        advisorPeriod === 'all' ? t('statistics.view.last7Days') : null,
        t('statistics.view.colombiaTime'),
        grupoDia === 'week' ? t('statistics.view.byWeek') : grupoDia === 'month' ? t('statistics.view.byMonthLower') : null,
    ]
        .filter(Boolean)
        .join(' · ');
    const liberadas = s?.released_inactive ?? 0;
    const liberacionApagada = autoReleaseEnabled === false;
    const esperasLargas = s?.waits_over_24h ?? 0;

    return (
        <>
            <div className={cn('flex h-[84px] shrink-0 items-center gap-3.5 border-b px-4 sm:pr-5 sm:pl-6', FILETE)}>
                <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#2e3f84]/10 text-[13px] leading-none font-semibold tracking-[0.02em] text-[#2e3f84] shadow-[inset_0_0_0_1px_rgba(46,63,132,0.06)] dark:bg-white/8 dark:text-neutral-200 dark:shadow-none"
                    aria-hidden="true"
                >
                    {iniciales(detail?.advisor.name ?? advisor.name)}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <DialogPrimitive.Title className={cn('truncate text-[17px] leading-[22px] font-semibold tracking-[-0.012em]', TEXTO_NAVY)} title={nombre}>
                        {nombre}
                    </DialogPrimitive.Title>
                    <span className="inline-flex items-center gap-[5px] text-[12.5px] leading-4 font-semibold text-sky-700 dark:text-sky-300">
                        <Headphones className="size-[13px]" strokeWidth={2} aria-hidden="true" />
                        {t('statistics.view.advisorRole')}
                    </span>
                </div>
                <DialogPrimitive.Close
                    className={cn(
                        'flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-[9px] shadow-[inset_0_0_0_1px_rgba(46,63,132,0.12)] transition-colors hover:bg-[#2e3f84]/8 hover:text-[#2e3f84] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] dark:hover:bg-white/8 dark:hover:text-neutral-100',
                        TEXTO_SUAVE,
                        FOCO
                    )}
                    aria-label={t('common.close')}
                    title={t('common.close')}
                >
                    <X className="size-4" strokeWidth={2} aria-hidden="true" />
                </DialogPrimitive.Close>
            </div>

            <div className={cn('@container/panel flex shrink-0 flex-wrap items-center gap-2.5 border-b px-4 py-3 sm:px-6', BANDA, FILETE)}>
                <Segmentado
                    peq
                    opciones={periodOptions}
                    activa={advisorPeriod === 'custom' ? null : advisorPeriod}
                    onElegir={onPeriod}
                    etiqueta={t('statistics.filters.period')}
                    className="grid w-full grid-cols-3 @lg/panel:flex @lg/panel:w-auto"
                />
                <CampoRango
                    peq
                    inicio={advisorPeriod === 'custom' ? advisorStartDate : ''}
                    fin={advisorPeriod === 'custom' ? advisorEndDate : ''}
                    onAplicar={onRange}
                    onLimpiar={onClearRange}
                    placeholder={t('statistics.view.rangeShort')}
                    className="w-full @lg/panel:w-[140px] @lg/panel:flex-1"
                />
            </div>

            <div className="@container/cuerpo min-h-0 flex-1 overflow-y-auto" aria-busy={loading}>
                {loading ? (
                    <div className="flex items-center justify-center gap-2 py-16" role="status">
                        <Loader2 className={cn('size-5 animate-spin motion-reduce:animate-none', TEXTO_NAVY)} aria-hidden="true" />
                        <span className={cn('text-[13px] leading-[18px]', TEXTO_SUAVE)}>{t('statistics.advisors.loadingMetrics')}</span>
                    </div>
                ) : detail && s ? (
                    <>
                        <div className={cn('grid grid-cols-2 gap-x-[18px] gap-y-[18px] px-4 pt-5 pb-4 sm:px-6 @md/cuerpo:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)_1px_minmax(0,1fr)]')}>
                            <MiniCifra icono={Send} etiqueta={t('statistics.chart.messages')} valor={formatNumber(s.messages_sent)} detalle={t('statistics.advisors.sentLower')} />
                            <DivisorV desde="@md/cuerpo:block" />
                            <MiniCifra
                                icono={TrendingUp}
                                etiqueta={t('statistics.advisors.resolutionCap')}
                                valor={s.resolution_rate === null ? t('statistics.view.noDataShort') : formatRate(s.resolution_rate)}
                                detalle={
                                    s.resolution_rate === null
                                        ? t('statistics.view.noConversationsInPeriod')
                                        : t('statistics.view.resolvedOf', { resolved: formatNumber(s.resolved_conversations), total: formatNumber(s.total_conversations) })
                                }
                                tono={s.resolution_rate === null ? TEXTO_SUAVE : undefined}
                            />
                            <DivisorV desde="@md/cuerpo:block" />
                            <MiniCifra
                                icono={Timer}
                                etiqueta={t('statistics.view.typicalResponse')}
                                valor={s.median_response_time_minutes == null ? t('statistics.view.noReplies') : formatDuration(s.median_response_time_minutes)}
                                detalle={s.median_response_time_minutes == null ? undefined : t('statistics.view.medianWait')}
                                tono={s.median_response_time_minutes == null ? TEXTO_SUAVE : undefined}
                            />
                            <MiniCifra icono={CalendarCheck2} etiqueta={t('statistics.advisors.scheduled')} valor={formatNumber(s.scheduled_conversations)} detalle={t('statistics.view.scheduledDetail')} />
                            <DivisorV desde="@md/cuerpo:block" />
                            <MiniCifra
                                icono={Activity}
                                etiqueta={t('statistics.advisors.open')}
                                valor={formatNumber(s.active_conversations + s.pending_conversations)}
                                detalle={t('statistics.view.activePendingDetail', { active: formatNumber(s.active_conversations), pending: formatNumber(s.pending_conversations) })}
                            />
                            <DivisorV desde="@md/cuerpo:block" />
                            <MiniCifra
                                icono={Hourglass}
                                etiqueta={t('statistics.view.released')}
                                valor={liberacionApagada && liberadas === 0 ? '—' : formatNumber(liberadas)}
                                detalle={liberacionApagada ? (liberadas === 0 ? t('statistics.view.releasedOff') : t('statistics.view.releasedOffNow')) : t('statistics.view.releasedDetail')}
                                tono={liberacionApagada && liberadas === 0 ? TEXTO_SUAVE : undefined}
                            />
                        </div>
                        <p className={cn('border-b px-4 pb-4 text-[12px] leading-[17px] sm:px-6', FILETE, TEXTO_SUAVE)}>
                            {t('statistics.view.typicalResponseHelp')}
                            {esperasLargas > 0 && ` ${t('statistics.view.waitsOver24h', { count: esperasLargas, value: formatNumber(esperasLargas) })}`}
                        </p>

                        <div className={cn('grid gap-y-6 border-b px-4 pt-[18px] pb-4 sm:px-6 @md/cuerpo:grid-cols-2 @md/cuerpo:gap-x-7', FILETE)}>
                            <div className="flex min-w-0 flex-col gap-3">
                                <Rotulo titulo={t('statistics.advisors.dailyActivity')} apoyo={apoyoDia} />
                                <div className="h-[214px] min-w-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={datosDia} title={t('statistics.advisors.dailyActivity')} margin={{ top: 8, right: 0, bottom: 0, left: 0 }} barCategoryGap="24%">
                                            <CartesianGrid vertical={false} stroke={G.rejilla} />
                                            <XAxis
                                                dataKey="name"
                                                tick={<TickDosLineas />}
                                                axisLine={{ stroke: G.base }}
                                                tickLine={false}
                                                height={36}
                                                interval={datosDia.length <= 14 ? 0 : 'preserveStartEnd'}
                                                minTickGap={4}
                                            />
                                            <YAxis tick={EJE} axisLine={false} tickLine={false} width={34} allowDecimals={false} tickFormatter={(v: number) => formatNumber(v)} ticks={marcasDia} domain={[0, marcasDia[marcasDia.length - 1]]} />
                                            <Tooltip
                                                cursor={{ fill: G.realce, radius: 6 }}
                                                isAnimationActive={false}
                                                content={({ active, payload }: ContenidoGlobo) => {
                                                    const p = payload?.[0]?.payload as (typeof datosDia)[number] | undefined;
                                                    if (!active || !p) return null;
                                                    return globoMensajes(tituloDia(p.key), p.count);
                                                }}
                                            />
                                            <Bar dataKey="count" fill={G.serie} radius={[3, 3, 0, 0]} maxBarSize={26} isAnimationActive={animar} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                <TablaOculta
                                    titulo={t('statistics.advisors.dailyActivity')}
                                    columnas={[grupoDia === 'month' ? t('statistics.view.monthCol') : grupoDia === 'week' ? t('statistics.view.weekCol') : t('statistics.view.dayCol'), t('statistics.chart.messages')]}
                                    filas={datosDia.map((p) => ({ clave: p.key, celdas: [tituloDia(p.key), formatNumber(p.count)] }))}
                                />
                            </div>
                            <div className="flex min-w-0 flex-col gap-3">
                                <Rotulo titulo={t('statistics.advisors.hourlyDistribution')} apoyo={t('statistics.view.colombiaTime')} />
                                <div className="h-[214px] min-w-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={detail.hourly_distribution} title={t('statistics.advisors.hourlyDistribution')} margin={{ top: 8, right: 0, bottom: 0, left: 0 }} barCategoryGap="14%">
                                            <CartesianGrid vertical={false} stroke={G.rejilla} />
                                            <XAxis dataKey="hour" tick={EJE} axisLine={{ stroke: G.base }} tickLine={false} interval={5} tickFormatter={(h: string) => h.slice(0, 2)} tickMargin={6} />
                                            <YAxis tick={EJE} axisLine={false} tickLine={false} width={44} allowDecimals={false} tickFormatter={miles} ticks={marcasHora} domain={[0, marcasHora[marcasHora.length - 1]]} />
                                            <Tooltip
                                                cursor={{ fill: G.realce, radius: 4 }}
                                                isAnimationActive={false}
                                                content={({ active, payload }: ContenidoGlobo) => {
                                                    const p = payload?.[0]?.payload as AdvisorDetail['hourly_distribution'][number] | undefined;
                                                    if (!active || !p) return null;
                                                    return globoMensajes(rangoHora(p.hour), p.count);
                                                }}
                                            />
                                            <Bar dataKey="count" fill={G.serie} radius={[2, 2, 0, 0]} isAnimationActive={animar} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                <TablaOculta
                                    titulo={t('statistics.advisors.hourlyDistribution')}
                                    columnas={[t('statistics.view.hourCol'), t('statistics.chart.messages')]}
                                    filas={detail.hourly_distribution.map((p) => ({ clave: p.hour, celdas: [rangoHora(p.hour), formatNumber(p.count)] }))}
                                />
                            </div>
                        </div>

                        {tipos.length > 0 && (
                            <div className="flex flex-col gap-2.5 px-4 py-[18px] sm:px-6">
                                <Rotulo titulo={t('statistics.view.messageTypes')} apoyo={t('statistics.view.sentCount', { value: formatNumber(totalTipos) })} />
                                <div className="flex flex-col">
                                    {tipos.map(([type, count]) => (
                                        <div key={type} className="grid h-[30px] grid-cols-[128px_minmax(0,1fr)_64px_52px] items-center gap-x-3.5">
                                            <span className={cn('truncate text-[12.5px] leading-4 font-medium', TEXTO_NAVY)} title={nombresTipo[type] ?? type}>
                                                {nombresTipo[type] ?? type}
                                            </span>
                                            <BarraPista valor={count} max={maxTipo} alto={6} />
                                            <span className={cn('text-right text-[13px] leading-[18px] font-semibold tabular-nums', TEXTO_NAVY)}>{formatNumber(count)}</span>
                                            <span className={cn('text-right text-[12px] leading-[18px] tabular-nums', TEXTO_SUAVE)}>{pct(count, totalTipos)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                ) : error ? (
                    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center" role="alert">
                        <p className={cn('max-w-[380px] text-[13px] leading-[18px]', TEXTO_SUAVE)}>
                            {error === 'session' ? t('statistics.view.sessionExpired') : t('statistics.advisors.errorLoadingMetrics', { name: nombre })}
                        </p>
                        <BotonReintentar sesion={error === 'session'} onReintentar={onRetry} />
                    </div>
                ) : null}
            </div>
        </>
    );
}

// Skeleton con la forma nueva (cabecera, franja de seis cifras y la hoja con sus bandas grises)
// mientras Inertia trae la prop diferida `statistics` por primera vez.
function StatisticsSkeleton({ lento }: { lento: boolean }) {
    const { t } = useTranslation();
    const bandaGris = (
        <div className={cn('flex h-16 items-center gap-3 border-b px-5', BANDA, FILETE)}>
            <Skeleton className="hidden size-5 rounded-md sm:block" />
            <div className="flex flex-col gap-2">
                <Skeleton className="h-3.5 w-44" />
                <Skeleton className="h-3 w-72 max-w-[60vw]" />
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-background px-4 pt-5 pb-8 md:px-7 md:pt-7" aria-busy="true">
            <div className="@container/pagina mx-auto flex max-w-7xl flex-col gap-6">
                <p role="status" className={lento ? cn('flex items-center gap-1.5 text-[13px] leading-[18px]', TEXTO_SUAVE) : 'sr-only'}>
                    {lento && <Loader2 className={cn('size-3.5 animate-spin motion-reduce:animate-none', TEXTO_NAVY)} aria-hidden="true" />}
                    {lento ? t('statistics.view.slowLoading') : t('statistics.loading')}
                </p>
                <div className="flex flex-col gap-4 @min-[1100px]/pagina:flex-row @min-[1100px]/pagina:items-start @min-[1100px]/pagina:justify-between">
                    <div className="flex flex-col gap-2.5">
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-4 w-72" />
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5">
                        <Skeleton className="h-9 w-[420px] max-w-full rounded-[11px]" />
                        <Skeleton className="h-9 w-[200px] rounded-[10px]" />
                        <Skeleton className="h-9 w-[150px] rounded-[10px]" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-5 @xl/pagina:grid-cols-3 @5xl/pagina:grid-cols-6">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="flex flex-col gap-2.5">
                            <Skeleton className="h-3.5 w-24" />
                            <Skeleton className="h-7 w-28" />
                            <Skeleton className="h-3 w-20" />
                        </div>
                    ))}
                </div>

                <div className={cn('overflow-hidden', HOJA)}>
                    {bandaGris}
                    <div className={cn('grid gap-8 border-b px-5 py-5 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] md:pl-16', FILETE)}>
                        <Skeleton className="h-[230px] rounded-xl" />
                        <div className="flex flex-col gap-3">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <Skeleton key={i} className="h-7" />
                            ))}
                        </div>
                    </div>
                    {bandaGris}
                    <div className={cn('grid gap-8 border-b px-5 py-5 md:grid-cols-2 md:pl-16', FILETE)}>
                        <Skeleton className="h-[150px] rounded-xl" />
                        <Skeleton className="h-[150px] rounded-xl" />
                    </div>
                    {bandaGris}
                    <div className="grid gap-8 px-5 py-5 md:grid-cols-2 md:pl-16">
                        <Skeleton className="h-[150px] rounded-xl" />
                        <Skeleton className="h-[150px] rounded-xl" />
                    </div>
                </div>
            </div>
        </div>
    );
}

/** La primera carga falló (red, reinicio del servidor, sesión vencida): mensaje y salida, no un skeleton eterno. */
function ErrorEstadisticas({ tipo, onReintentar }: { tipo: 'session' | 'other'; onReintentar: () => void }) {
    const { t } = useTranslation();

    return (
        <div className="min-h-screen bg-background px-4 pt-5 pb-8 md:px-7 md:pt-7">
            <div className="mx-auto flex max-w-7xl flex-col gap-6">
                <h1 className={cn('text-[28px] leading-[34px] font-semibold tracking-[-0.025em]', TEXTO_NAVY)}>{t('statistics.title')}</h1>
                <div role="alert" className={cn('flex flex-col items-center justify-center gap-3 px-6 py-16 text-center', HOJA)}>
                    <CircleAlert className={cn('size-6', TXT_MAL)} strokeWidth={1.75} aria-hidden="true" />
                    <p className={cn('max-w-[460px] text-[14px] leading-5', TEXTO_NAVY)}>{tipo === 'session' ? t('statistics.view.sessionExpired') : t('statistics.view.loadError')}</p>
                    <BotonReintentar sesion={tipo === 'session'} onReintentar={onReintentar} />
                </div>
            </div>
        </div>
    );
}

export default function StatisticsIndex({ statistics }: StatisticsIndexProps) {
    const { t } = useTranslation();

    // Las últimas cifras recibidas. Al cambiar de filtro la prop diferida desaparece hasta que llega la
    // segunda petición: mientras tanto se siguen pintando estas (atenuadas) en vez del skeleton, así los
    // controles no desaparecen, el foco no se pierde y el panel abierto sigue abierto.
    const [ultimas, setUltimas] = useState(statistics);
    if (statistics && statistics !== ultimas) setUltimas(statistics);
    const datos = statistics ?? ultimas;

    const [errorCarga, setErrorCarga] = useState<ErrorCarga>(null);
    const [lento, setLento] = useState(false);
    const [intento, setIntento] = useState(0);
    // ¿Hay en curso una carga de `statistics`? En la primera visita puede empezar antes de suscribirse.
    const cargando = useRef(statistics === undefined);

    // <Deferred> no tiene estado de error: si la carga diferida falla (red, Apache reiniciándose, un 500)
    // se quedaría en el skeleton para siempre. Se escuchan solo las visitas que piden `statistics`.
    useEffect(() => {
        const pideEstadisticas = (only: string[]) => only.includes('statistics');
        const offStart = router.on('start', (event) => {
            if (!pideEstadisticas(event.detail.visit.only)) return;
            cargando.current = true;
            setErrorCarga(null);
            setLento(false);
            setIntento((n) => n + 1);
        });
        const offFinish = router.on('finish', (event) => {
            if (pideEstadisticas(event.detail.visit.only)) cargando.current = false;
        });
        const offInvalid = router.on('invalid', (event) => {
            if (!cargando.current) return;
            // Sin esto Inertia abre su modal con la página de error del servidor.
            event.preventDefault();
            const status = event.detail.response.status;
            setErrorCarga(status === 401 || status === 419 ? 'session' : 'other');
        });
        const offException = router.on('exception', (event) => {
            if (!cargando.current) return;
            event.preventDefault();
            setErrorCarga('other');
        });

        return () => {
            offStart();
            offFinish();
            offInvalid();
            offException();
        };
    }, []);

    // «Todo el tiempo» sin caché puede tardar de verdad: no se aborta, solo se avisa a los 20 s.
    useEffect(() => {
        if (statistics || errorCarga) return;
        const id = window.setTimeout(() => setLento(true), 20000);
        return () => window.clearTimeout(id);
    }, [statistics, errorCarga, intento]);

    const reintentar = () => {
        setErrorCarga(null);
        setLento(false);
        router.reload({ only: ['statistics'] });
    };

    return (
        <AdminLayout>
            <Head title={t('statistics.title')} />
            {datos ? (
                <StatisticsView statistics={datos} actualizando={!statistics} errorCarga={errorCarga} lento={lento} onReintentar={reintentar} />
            ) : errorCarga ? (
                <ErrorEstadisticas tipo={errorCarga} onReintentar={reintentar} />
            ) : (
                <StatisticsSkeleton lento={lento} />
            )}
        </AdminLayout>
    );
}
