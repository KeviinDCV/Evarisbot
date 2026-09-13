import AdminLayout from '@/layouts/admin-layout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Deferred, Head, router, usePage } from '@inertiajs/react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import axios from 'axios';
import {
    Activity,
    ArrowRight,
    Award,
    Bot,
    CalendarCheck2,
    CalendarRange,
    ChevronRight,
    CircleAlert,
    FileSpreadsheet,
    FileText,
    Headphones,
    Loader2,
    MessageSquare,
    MessagesSquare,
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
        messages_sent: number;
        total_conversations: number;
        resolved_conversations: number;
        scheduled_conversations: number;
        active_conversations: number;
        pending_conversations: number;
        resolution_rate: number;
        /** Mediana (no media): la distribución tiene una cola larga que dispara el promedio. */
        median_response_time_minutes: number | null;
    };
    daily_activity: Array<{ date: string; label: string; count: number }>;
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
    messages_sent: number;
    /** null = el asesor no tiene conversaciones asignadas (sin datos), distinto de 0%. */
    resolution_rate: number | null;
}

interface Statistics {
    messages: {
        total: number;
        sent_by_system: number;
        received_from_users: number;
        delivery_status: {
            pending: number;
            sent: number;
            delivered: number;
            read: number;
            failed: number;
        };
    };
    appointments: {
        total: number;
        reminder_sent: number;
        confirmed: number;
        cancelled: number;
        pending: number;
        failed: number;
        /** Recordatorio entregado, sin respuesta aún. confirmed+cancelled+awaiting_reply = reminder_sent. */
        awaiting_reply: number;
        by_status: Record<string, number>;
    };
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
    };
    users: {
        total: number;
        admins: number;
        advisors: number;
    };
    advisors: {
        total_advisors: number;
        total_conversations: number;
        total_resolved: number;
        total_scheduled: number;
        total_active: number;
        total_with_unread: number;
        total_messages_sent: number;
        avg_resolution_rate: number;
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
    date_range: {
        start?: string;
        end?: string;
        period: string;
    };
}

interface StatisticsIndexProps {
    // statistics es opcional porque llega DIFERIDA (Inertia v2 deferred prop):
    // está ausente en la respuesta inicial y el <Deferred> muestra el skeleton.
    statistics?: Statistics;
}

interface StatisticsViewProps {
    statistics: Statistics;
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
const FOCO = 'outline-none focus-visible:ring-2 focus-visible:ring-[#2e3f84]/40 dark:focus-visible:ring-[#8b9ae0]/60';
const BANDA = 'bg-[#2e3f84]/[0.028] dark:bg-white/[0.03]';
// Texto con color (AA sobre la hoja): esmeralda 700 5,48:1, ámbar 700 5,02:1, rojo 600 4,83:1.
const TXT_OK = 'text-emerald-700 dark:text-emerald-400';
const TXT_AVISO = 'text-amber-700 dark:text-amber-400';
const TXT_MAL = 'text-red-600 dark:text-red-400';
// El texto de la hoja arranca a 64 px (20 de sangría + 32 de la ranura del icono de la banda + 12).
const SANGRIA = 'px-4 @3xl/hoja:pr-5 @3xl/hoja:pl-16';
const HOJA =
    'rounded-2xl bg-card shadow-[0_0_0_1px_rgba(46,63,132,0.07),0_1px_2px_rgba(46,63,132,0.05),0_14px_32px_-18px_rgba(46,63,132,0.22)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07),0_14px_32px_-18px_rgba(0,0,0,0.6)]';
const SOMBRA_FLOTANTE =
    'shadow-[0_0_0_1px_rgba(46,63,132,0.1),0_2px_4px_rgba(46,63,132,0.06),0_12px_28px_-12px_rgba(46,63,132,0.35)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_12px_28px_-12px_rgba(0,0,0,0.7)]';

/* ── Paleta de gráficos ────────────────────────────────────────────────────────────────────────────
   La del generador (contraste ≥ 3:1 contra la hoja). En oscuro, el mismo tono un paso más claro
   (≥ 3:1 contra bg-card). Van en variables para que recharts (fill="var(--g-…)") y los divs usen lo
   mismo; se declaran en la raíz de la vista y en el panel lateral (que va en un portal). */
const VARS_GRAFICOS =
    '[--g-serie:#2e3f84] [--g-serie2:#7c88c0] [--g-ok:#059669] [--g-pend:#d97706] [--g-mal:#dc2626] [--g-curso:#0284c7] [--g-neutro:#64748b] [--g-pista:rgba(46,63,132,0.07)] [--g-rejilla:rgba(46,63,132,0.08)] [--g-base:rgba(46,63,132,0.16)] [--g-eje:#5c6485] [--g-realce:rgba(46,63,132,0.05)] dark:[--g-serie:#8b9ae0] dark:[--g-serie2:#5f6db5] dark:[--g-ok:#10b981] dark:[--g-pend:#f59e0b] dark:[--g-mal:#ef4444] dark:[--g-curso:#0ea5e9] dark:[--g-neutro:#94a3b8] dark:[--g-pista:rgba(255,255,255,0.07)] dark:[--g-rejilla:rgba(255,255,255,0.08)] dark:[--g-base:rgba(255,255,255,0.16)] dark:[--g-eje:#a3a3a3] dark:[--g-realce:rgba(255,255,255,0.05)]';
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

function formatNumber(value: number | null | undefined) {
    return Number(value ?? 0).toLocaleString('es-CO');
}

/**
 * Duración en minutos → texto legible. Antes se rotulaba siempre como "{n} min",
 * de modo que una espera de 14 horas se leía "860,5 min".
 */
function formatDuration(minutes: number | null | undefined) {
    if (minutes === null || minutes === undefined) return 'N/A';
    if (minutes < 1) return '< 1 min';
    if (minutes < 60) return `${Math.round(minutes)} min`;

    const horas = Math.floor(minutes / 60);
    const resto = Math.round(minutes % 60);
    return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}

function formatMoney(value: number | null | undefined, currency = 'USD', maxDigits = 2) {
    try {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: maxDigits,
        }).format(Number(value ?? 0));
    } catch {
        return `${currency} ${Number(value ?? 0).toFixed(maxDigits)}`;
    }
}

/** Tasa que ya llega calculada del servidor (resolución, automatización, cobertura): mismo valor, con coma. */
function formatRate(value: number | null | undefined) {
    return `${formatNumber(value)} %`;
}

/** Parte de un total, para las leyendas del diseño ("57,2 %"). */
function pct(value: number, total: number, digits = 1) {
    if (!total) return '0 %';
    return `${((value / total) * 100).toLocaleString('es-CO', { minimumFractionDigits: digits, maximumFractionDigits: digits })} %`;
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

function getInitials(name: string) {
    return name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join('');
}

/** Nombre propio SOLO para pintar (el dato no cambia): "ANDREA CAROLINA MUÑOZ PAZ" → "Andrea Carolina Muñoz Paz". */
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y']);

function nombrePropio(nombre: string) {
    const mayuscula = (parte: string) => parte.charAt(0).toLocaleUpperCase('es') + parte.slice(1);

    return nombre
        .toLocaleLowerCase('es')
        .split(/\s+/)
        .filter(Boolean)
        .map((palabra, i) => (i > 0 && PARTICULAS.has(palabra) ? palabra : palabra.split('-').map(mayuscula).join('-')))
        .join(' ');
}

/** 'YYYY-MM-DD' → Date local (sin desfase de zona). */
function fechaLocal(iso: string) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
}

/** Una fecha completa y con año de 4 cifras (el input nativo emite valores como 0002-09-01 mientras se teclea). */
function fechaValida(iso: string) {
    return /^\d{4}-\d{2}-\d{2}$/.test(iso) && Number(iso.slice(0, 4)) >= 2000;
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
            {apoyo && <span className={cn('min-w-0 truncate text-[12px] leading-4 tabular-nums', TEXTO_SUAVE)}>{apoyo}</span>}
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
            <span className={cn('truncate text-[13px] leading-[18px] font-medium', TEXTO_NAVY)}>{etiqueta}</span>
            <span className={cn('text-right text-[13px] leading-[18px] font-medium tabular-nums', TEXTO_NAVY)}>{formatNumber(valor)}</span>
            <span className={cn('text-right text-[12px] leading-[18px] tabular-nums', TEXTO_SUAVE)}>{pct(valor, total)}</span>
        </div>
    );
}

/** Fila con barra: etiqueta con su cuadro, barra sobre pista, cifra y porcentaje. */
function FilaBarra({ etiqueta, valor, total, max, color, alto = 34, cuadro = true, anchoEtiqueta = 'grid-cols-[minmax(0,1.3fr)_minmax(48px,1fr)_60px_48px] @xl/hoja:grid-cols-[minmax(0,170px)_minmax(0,1fr)_64px_52px]' }: {
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
                <span className={cn('truncate text-[13px] leading-[18px] font-medium', TEXTO_NAVY)}>{etiqueta}</span>
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
                <span className="truncate">{etiqueta}</span>
            </span>
            <span className={cn('text-[24px] leading-[30px] font-medium tracking-[-0.025em] whitespace-nowrap tabular-nums', tono ?? TEXTO_NAVY)}>{valor}</span>
            {detalle !== undefined && <span className={cn('truncate text-[12px] leading-4 tabular-nums', TEXTO_SUAVE)}>{detalle}</span>}
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
                <p className={cn('text-[12.5px] leading-4 tabular-nums @3xl/hoja:truncate', TEXTO_SUAVE)}>{texto}</p>
            </div>
            {derecha && <div className="flex shrink-0 items-center gap-2">{derecha}</div>}
        </div>
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

/**
 * Campo de rango de fechas: un solo campo que abre fecha inicio y fecha fin. El rango se aplica al
 * tener las dos (lo hace quien lo usa, en onCambio); la x lo limpia.
 */
function CampoRango({
    inicio,
    fin,
    onCambio,
    onLimpiar,
    placeholder,
    peq = false,
    className,
}: {
    inicio: string;
    fin: string;
    onCambio: (inicio: string, fin: string) => boolean;
    onLimpiar: () => void;
    placeholder: string;
    peq?: boolean;
    className?: string;
}) {
    const { t } = useTranslation();
    const [abierto, setAbierto] = useState(false);
    const raiz = useRef<HTMLDivElement>(null);
    const disparador = useRef<HTMLButtonElement>(null);
    const primerCampo = useRef<HTMLInputElement>(null);
    const uid = useId();
    const idPanel = `${uid}-panel`;
    const conRango = !!(inicio || fin);

    useEffect(() => {
        if (!abierto) return;
        primerCampo.current?.focus();
        const fuera = (event: MouseEvent) => {
            if (raiz.current && !raiz.current.contains(event.target as Node)) setAbierto(false);
        };
        document.addEventListener('mousedown', fuera);
        return () => document.removeEventListener('mousedown', fuera);
    }, [abierto]);

    const fmt = (iso: string) => (fechaValida(iso) ? fechaLocal(iso).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '…');
    const texto = conRango ? `${inicio ? fmt(inicio) : '…'} – ${fin ? fmt(fin) : '…'}` : placeholder;

    const cambiar = (nuevoInicio: string, nuevoFin: string) => {
        if (onCambio(nuevoInicio, nuevoFin)) {
            setAbierto(false);
            disparador.current?.focus();
        }
    };

    return (
        <div
            ref={raiz}
            className={cn('relative', className)}
            onKeyDown={(event) => {
                if (event.key === 'Escape' && abierto) {
                    event.stopPropagation();
                    setAbierto(false);
                    disparador.current?.focus();
                }
            }}
        >
            <button
                ref={disparador}
                type="button"
                aria-expanded={abierto}
                aria-controls={idPanel}
                title={t('statistics.view.rangeHint')}
                onClick={() => setAbierto((v) => !v)}
                className={cn(
                    'flex w-full cursor-pointer items-center gap-[9px] rounded-[10px] bg-card pl-3 text-left shadow-[inset_0_0_0_1px_rgba(46,63,132,0.16),0_1px_2px_rgba(46,63,132,0.06)] transition-shadow hover:shadow-[inset_0_0_0_1px_rgba(46,63,132,0.28),0_1px_2px_rgba(46,63,132,0.06)] dark:bg-white/5 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]',
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
                    className={cn('absolute top-full right-0 z-30 mt-1.5 flex w-[268px] flex-col gap-3 rounded-xl bg-white p-3.5 dark:bg-popover', SOMBRA_FLOTANTE)}
                >
                    <div className="grid grid-cols-2 gap-2.5">
                        {(
                            [
                                ['inicio', t('statistics.filters.startDate'), inicio, primerCampo],
                                ['fin', t('statistics.filters.endDate'), fin, null],
                            ] as const
                        ).map(([clave, etiqueta, valor, ref]) => (
                            <label key={clave} className="flex min-w-0 flex-col gap-1.5">
                                <span className={cn('text-[12px] leading-4 font-medium', TEXTO_SUAVE)}>{etiqueta}</span>
                                <input
                                    ref={ref ?? undefined}
                                    type="date"
                                    value={valor}
                                    max={clave === 'inicio' && fin ? fin : undefined}
                                    min={clave === 'fin' && inicio ? inicio : undefined}
                                    onChange={(event) => (clave === 'inicio' ? cambiar(event.target.value, fin) : cambiar(inicio, event.target.value))}
                                    className={cn(
                                        'h-9 w-full min-w-0 rounded-lg bg-[#2e3f84]/[0.035] px-2 text-[12.5px] leading-4 text-foreground tabular-nums shadow-[inset_0_0_0_1px_rgba(46,63,132,0.12)] dark:bg-white/5 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] dark:[color-scheme:dark]',
                                        FOCO
                                    )}
                                />
                            </label>
                        ))}
                    </div>
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

const PERIOD_KEYS = ['today', 'week', 'month', 'year', 'all'] as const;

function StatisticsView({ statistics }: StatisticsViewProps) {
    const { t, i18n } = useTranslation();
    const { url } = usePage();
    const reducirMovimiento = usePrefiereMenosMovimiento();
    const animar = !reducirMovimiento;

    // El rango aplicado vive en la URL (?start_date=…&end_date=…). Con un periodo, el servidor también
    // devuelve inicio y fin en date_range, pero eso no es un rango elegido: el campo queda vacío.
    const consulta = useMemo(() => new URLSearchParams(url.split('?')[1] ?? ''), [url]);
    const [period, setPeriod] = useState(statistics.date_range.period || 'all');
    // Granularidad de la evolución de costes. Solo afecta a cómo se agrupa lo que ya
    // vino del servidor, así que cambiarla no dispara ninguna petición.
    const [costGroup, setCostGroup] = useState<'day' | 'month'>('day');
    const [startDate, setStartDate] = useState(() => consulta.get('start_date') ?? '');
    const [endDate, setEndDate] = useState(() => consulta.get('end_date') ?? '');
    const [expandedAdvisor, setExpandedAdvisor] = useState<number | null>(null);
    const [advisorDetail, setAdvisorDetail] = useState<AdvisorDetail | null>(null);
    const [loadingAdvisor, setLoadingAdvisor] = useState(false);
    const [advisorPeriod, setAdvisorPeriod] = useState('all');
    const [advisorStartDate, setAdvisorStartDate] = useState('');
    const [advisorEndDate, setAdvisorEndDate] = useState('');
    const [isExporting, setIsExporting] = useState(false);

    const periodOptions = useMemo(() => PERIOD_KEYS.map((value) => ({ value, label: t(`statistics.filters.periods.${value}`) })), [t]);

    const fetchAdvisorDetail = useCallback(async (advisorId: number, selectedPeriod?: string, selectedStart?: string, selectedEnd?: string) => {
        setLoadingAdvisor(true);
        try {
            const usePeriod = selectedPeriod ?? advisorPeriod;
            const useStart = selectedStart ?? advisorStartDate;
            const useEnd = selectedEnd ?? advisorEndDate;
            const params: Record<string, string> = { period: usePeriod };

            if (useStart) params.start_date = useStart;
            if (useEnd) params.end_date = useEnd;

            const response = await axios.get(`/admin/statistics/advisor/${advisorId}`, { params });
            setAdvisorDetail(response.data);
        } catch {
            setAdvisorDetail(null);
        } finally {
            setLoadingAdvisor(false);
        }
    }, [advisorEndDate, advisorPeriod, advisorStartDate]);

    const openAdvisorDetail = useCallback(async (advisorId: number) => {
        setExpandedAdvisor(advisorId);
        setAdvisorPeriod('all');
        setAdvisorStartDate('');
        setAdvisorEndDate('');
        await fetchAdvisorDetail(advisorId, 'all', '', '');
    }, [fetchAdvisorDetail]);

    const closeAdvisorDetail = useCallback(() => {
        setExpandedAdvisor(null);
        setAdvisorDetail(null);
    }, []);

    // Mismos parámetros y opciones que el antiguo "Aplicar filtros"; ahora se manda al pulsar el
    // periodo (sin rango) o al tener las dos fechas del rango.
    const aplicarFiltro = (nextPeriod: string, start: string, end: string) => {
        router.get('/admin/statistics', {
            period: nextPeriod,
            start_date: start || undefined,
            end_date: end || undefined,
        }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const elegirPeriodo = (value: string) => {
        setPeriod(value);
        setStartDate('');
        setEndDate('');
        aplicarFiltro(value, '', '');
    };

    const cambiarRango = (start: string, end: string) => {
        setStartDate(start);
        setEndDate(end);
        if (fechaValida(start) && fechaValida(end) && start <= end) {
            aplicarFiltro(period, start, end);
            return true;
        }
        return false;
    };

    const limpiarRango = () => {
        const habiaRango = !!(startDate && endDate);
        setStartDate('');
        setEndDate('');
        if (habiaRango) aplicarFiltro(period, '', '');
    };

    const handleExport = () => {
        setIsExporting(true);
        const params = new URLSearchParams({
            period,
            ...(startDate && { start_date: startDate }),
            ...(endDate && { end_date: endDate }),
        });

        window.location.href = `/admin/statistics/export?${params.toString()}`;
        setTimeout(() => setIsExporting(false), 2000);
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
    const rangoAplicado = fechaValida(startDate) && fechaValida(endDate);
    const periodoActivo = rangoAplicado ? null : period;
    const periodLabel = periodOptions.find((option) => option.value === statistics.date_range.period)?.label ?? statistics.date_range.period;

    const locale = i18n.language?.startsWith('en') ? 'en-US' : 'es-CO';
    const textoRango = (() => {
        const inicio = rangoAplicado ? startDate : statistics.date_range.start;
        let fin = rangoAplicado ? endDate : statistics.date_range.end;
        if (!inicio || !fin) return t('statistics.view.allTimeRange');
        // Un periodo en curso ("Este mes") llega hasta fin de mes: se cuenta hasta hoy.
        const hoy = new Date();
        const hoyIso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
        if (!rangoAplicado && fin > hoyIso && inicio <= hoyIso) fin = hoyIso;
        const a = fechaLocal(inicio);
        const b = fechaLocal(fin);
        const largo = (d: Date) => d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
        if (inicio === fin) return largo(a);
        if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
            return t('statistics.view.rangeSameMonth', {
                from: a.getDate(),
                to: b.getDate(),
                month: a.toLocaleDateString(locale, { month: 'long' }),
                year: a.getFullYear(),
            });
        }
        return t('statistics.view.rangeGeneric', { from: largo(a), to: largo(b) });
    })();

    const delivery = [
        { key: 'read', label: t('statistics.messages.readPlural'), value: messages.delivery_status.read, color: G.serie },
        { key: 'delivered', label: t('statistics.messages.deliveredPlural'), value: messages.delivery_status.delivered, color: G.ok },
        { key: 'sent', label: t('statistics.messages.sentPlural'), value: messages.delivery_status.sent, color: G.curso },
        { key: 'pending', label: t('statistics.messages.deliveryStatus.pending'), value: messages.delivery_status.pending, color: G.pend },
        { key: 'failed', label: t('statistics.messages.errors'), value: messages.delivery_status.failed, color: G.mal },
    ];
    const outboundTotal = Object.values(messages.delivery_status).reduce((sum, value) => sum + value, 0);

    // Sólo citas cuyo recordatorio SÍ se entregó: es lo único sobre lo que un paciente
    // pudo responder, y el gráfico se titula "Respuesta de pacientes".
    //
    // Antes se incluían 'pending' y 'failed' (citas que nunca recibieron recordatorio, así
    // que el paciente no pudo contestar) y se omitía 'sent' (entregado y aún sin respuesta),
    // que es justo la categoría más relevante: eran 24.606 citas invisibles, el 23% del total.
    // Con esto los tres trozos suman exactamente reminder_sent.
    const appointmentsData = [
        { name: t('statistics.appointments.confirmed'), value: appointments.confirmed, color: G.ok },
        { name: t('statistics.appointments.cancelled'), value: appointments.cancelled, color: G.mal },
        { name: t('statistics.appointments.awaitingReply'), value: appointments.awaiting_reply, color: G.pend },
    ].filter((item) => item.value > 0);
    const respuestasTotal = appointmentsData.reduce((s, a) => s + a.value, 0);

    const conversationItems = [
        { label: t('statistics.conversations.active'), value: conversations.active },
        { label: t('statistics.conversations.pending'), value: conversations.pending },
        { label: t('statistics.conversations.inProgress'), value: conversations.in_progress },
        { label: t('statistics.conversations.resolved'), value: conversations.resolved },
        { label: t('statistics.conversations.closed'), value: conversations.closed },
        { label: t('statistics.conversations.scheduled'), value: conversations.scheduled },
    ];
    const maxConversationItem = Math.max(...conversationItems.map((c) => c.value), 1);

    const usersData = [
        { name: t('statistics.users.admins'), value: users.admins, color: G.serie },
        { name: t('statistics.users.advisors'), value: users.advisors, color: G.curso },
    ].filter((item) => item.value > 0);
    const teamTotal = users.admins + users.advisors;

    const advisorList = advisors.advisors;
    const maxAdvisorConv = Math.max(...advisorList.map((a) => a.total_conversations), 0);
    const maxAdvisorMsgs = Math.max(...advisorList.map((a) => a.messages_sent), 0);
    const selectedAdvisor = advisorList.find((a) => a.id === expandedAdvisor) ?? null;

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
            detalle:
                conversations.unread > 0 ? (
                    <span className={cn('flex min-w-0 items-center gap-1.5 font-medium', TXT_AVISO)}>
                        <span className="size-[7px] shrink-0 rounded-full bg-[var(--g-pend)]" aria-hidden="true" />
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
            detalle: t('statistics.view.resolutionDetail', { value: formatRate(advisors.avg_resolution_rate) }),
            destino: t('statistics.advisors.performanceTitle'),
        },
        {
            id: 'est-plantillas',
            icono: FileText,
            etiqueta: t('statistics.chart.templates'),
            valor: formatNumber(templates.total),
            detalle: t('statistics.metricCard.sendsDetail', { value: formatNumber(templates.total_sends) }),
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

    return (
        <div className={cn('min-h-screen bg-background px-4 pt-5 pb-8 md:px-7 md:pt-7', VARS_GRAFICOS)}>
            <div className="@container/pagina mx-auto flex max-w-7xl flex-col gap-6">
                {/* ── Cabecera: título con el periodo aplicado; periodo, rango y exportar ── */}
                <header className="flex flex-col gap-4 @min-[1100px]/pagina:flex-row @min-[1100px]/pagina:items-start @min-[1100px]/pagina:justify-between @min-[1100px]/pagina:gap-6">
                    <div className="flex min-w-0 flex-col gap-1">
                        <h1 className={cn('text-[28px] leading-[34px] font-semibold tracking-[-0.025em]', TEXTO_NAVY)}>{t('statistics.title')}</h1>
                        <p className="text-[14px] leading-5 text-muted-foreground" aria-live="polite">
                            <span className={cn('font-semibold', TEXTO_NAVY)}>{rangoAplicado ? t('statistics.filters.custom') : periodLabel}</span>
                            {`, ${textoRango}`}
                        </p>
                    </div>

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
                                inicio={startDate}
                                fin={endDate}
                                onCambio={cambiarRango}
                                onLimpiar={limpiarRango}
                                placeholder={t('statistics.view.dateRange')}
                                className="min-w-0 flex-1 @xl/pagina:w-[200px] @xl/pagina:flex-none"
                            />
                            <Button
                                type="button"
                                onClick={handleExport}
                                disabled={isExporting}
                                className="h-9 shrink-0 gap-2 rounded-[10px] pr-4 pl-3.5 text-[13px] leading-[18px] font-semibold settings-btn-primary disabled:opacity-50 has-[>svg]:pr-4 has-[>svg]:pl-3.5"
                            >
                                <FileSpreadsheet className="size-[15px]" strokeWidth={2} aria-hidden="true" />
                                {isExporting ? t('statistics.exporting') : t('statistics.view.exportExcel')}
                            </Button>
                        </div>
                    </div>
                </header>

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
                    {costs && (() => {
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
                        const conSerie = !!(c.series && c.series.length > 0);

                        // Evolución del coste dentro del período elegido arriba. El servidor
                        // manda un punto por día; "Por mes" se agrega aquí mismo, así el
                        // cambio es instantáneo y no hay que volver a consultar.
                        const porMes = new Map<string, { day: string; billable: number; cost: number }>();
                        for (const p of c.series ?? []) {
                            const k = p.day.slice(0, 7);
                            const acc = porMes.get(k) ?? { day: k, billable: 0, cost: 0 };
                            acc.billable += p.billable;
                            acc.cost += p.cost;
                            porMes.set(k, acc);
                        }
                        const puntos = costGroup === 'month' ? [...porMes.values()] : (c.series ?? []);
                        const etiqueta = (d: string) => {
                            const [y, m, dd] = d.split('-');
                            return costGroup === 'month'
                                ? new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('es-CO', { month: 'short', year: '2-digit' })
                                : `${dd}/${m}`;
                        };
                        const tituloPunto = (d: string) => {
                            if (costGroup === 'month') return etiqueta(d);
                            const dia = fechaLocal(d).toLocaleDateString('es-CO', { weekday: 'short' }).replace(/\./g, '');
                            return `${dia} ${etiqueta(d)}`;
                        };
                        const datos = puntos.map((p) => ({ day: p.day, name: etiqueta(p.day), cost: Number(p.cost.toFixed(2)), billable: p.billable }));
                        const marcasCosto = marcasRedondas(Math.max(...datos.map((d) => d.cost), 0));

                        return (
                            <Tema id="est-costo">
                                <Banda
                                    id="est-costo-titulo"
                                    icono={Wallet}
                                    titulo={t('statistics.view.costTitle')}
                                    texto={c.rates_as_of ? t('statistics.view.costSubtitleAsOf', { date: c.rates_as_of }) : t('statistics.view.costSubtitle')}
                                    derecha={
                                        <div className="flex flex-col items-start gap-px @3xl/hoja:items-end">
                                            <span className={cn('text-[12px] leading-4', TEXTO_SUAVE)}>{t('statistics.costs.periodEstimate')}</span>
                                            <span className={cn('text-[20px] leading-6 font-semibold tracking-[-0.02em] tabular-nums', TEXTO_NAVY)}>{formatMoney(c.total_cost, c.currency)}</span>
                                        </div>
                                    }
                                />
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
                                                    activa={costGroup}
                                                    onElegir={(g) => setCostGroup(g as 'day' | 'month')}
                                                />
                                            )}
                                        </div>
                                        {conSerie ? (
                                            <div className="h-[214px] min-w-0" role="img" aria-label={t('statistics.view.costEvolution')}>
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={datos} margin={{ top: 8, right: 0, bottom: 0, left: 0 }} barCategoryGap="25%">
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
                                                            tickFormatter={(v: number) => (v === 0 ? '0' : v.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}
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
                                        ) : (
                                            <Vacio mensaje={t('statistics.view.noCostSeries')} alto="h-[214px]" />
                                        )}
                                    </div>

                                    <DivisorV desde="@5xl/hoja:block" />

                                    <div className="relative min-w-0 overflow-x-auto">
                                        <table className="w-full min-w-[316px] table-fixed border-collapse text-left">
                                            <thead>
                                                <tr className="border-b border-[#2e3f84]/12 dark:border-white/10">
                                                    <th scope="col" className={cn('pb-2.5 text-[11px] leading-4 font-semibold tracking-[0.07em] uppercase', TEXTO_SUAVE)}>{t('statistics.costs.table.category')}</th>
                                                    <th scope="col" className={cn('w-[80px] pb-2.5 pl-2 text-right @xl/hoja:w-[86px] @xl/hoja:pl-3 text-[11px] leading-4 font-semibold tracking-[0.07em] uppercase', TEXTO_SUAVE)}>{t('statistics.costs.table.billable')}</th>
                                                    <th scope="col" className={cn('w-[76px] pb-2.5 pl-2 text-right @xl/hoja:w-[84px] @xl/hoja:pl-3 text-[11px] leading-4 font-semibold tracking-[0.07em] uppercase', TEXTO_SUAVE)}>{t('statistics.costs.table.rate')}</th>
                                                    <th scope="col" className={cn('w-[74px] pb-2.5 pl-2 text-right @xl/hoja:w-[82px] @xl/hoja:pl-3 text-[11px] leading-4 font-semibold tracking-[0.07em] uppercase', TEXTO_SUAVE)}>{t('statistics.costs.table.cost')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {rows.map(([key, data]) => (
                                                    <tr key={key} className={cn('h-[42px] border-b', FILETE)}>
                                                        <th scope="row" className="py-1 pr-2 text-left font-normal">
                                                            <span className={cn('block truncate text-[13px] leading-[17px] font-medium', TEXTO_NAVY)}>{catNames[key] ?? key}</span>
                                                            {catHints[key] && <span className={cn('block truncate text-[11.5px] leading-[14px]', TEXTO_SUAVE)}>{catHints[key]}</span>}
                                                        </th>
                                                        <td className={cn('pl-2 text-right @xl/hoja:pl-3 text-[13px] leading-[18px] font-medium tabular-nums', data.billable ? TEXTO_NAVY : TEXTO_SUAVE)}>{formatNumber(data.billable)}</td>
                                                        <td className={cn('pl-2 text-right @xl/hoja:pl-3 text-[12.5px] leading-[18px] whitespace-nowrap tabular-nums', TEXTO_SUAVE)}>{data.rate === 0 ? t('statistics.costs.free') : formatMoney(data.rate, c.currency, 4)}</td>
                                                        <td className={cn('pl-2 text-right @xl/hoja:pl-3 text-[13px] leading-[18px] font-semibold whitespace-nowrap tabular-nums', data.cost ? TEXTO_NAVY : TEXTO_SUAVE)}>{formatMoney(data.cost, c.currency)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot>
                                                <tr className="h-11">
                                                    <th scope="row" colSpan={3} className={cn('text-left text-[13px] leading-[18px] font-semibold', TEXTO_NAVY)}>{t('statistics.costs.estimatedTotal')}</th>
                                                    <td className={cn('pl-2 text-right @xl/hoja:pl-3 text-[14px] leading-[18px] font-semibold whitespace-nowrap tabular-nums', TEXTO_NAVY)}>{formatMoney(c.total_cost, c.currency)}</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>

                                {/* Cobertura de precios */}
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
                                        {c.without_pricing > 0 && (
                                            <span className={cn('flex items-center gap-1.5 text-[12px] leading-4 font-medium @5xl/hoja:ml-auto', TXT_AVISO)}>
                                                <CircleAlert className="size-[13px] shrink-0" strokeWidth={2} aria-hidden="true" />
                                                {t('statistics.view.missingRatesWarning')}
                                            </span>
                                        )}
                                    </div>
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
                        <div className={cn('grid gap-y-6 border-b py-[18px] @4xl/hoja:grid-cols-[minmax(0,1fr)_1px_minmax(0,1.2fr)] @4xl/hoja:gap-x-8', SANGRIA, FILETE)}>
                            <div className="flex min-w-0 flex-col gap-[18px]">
                                <Rotulo titulo={t('statistics.view.whoWrites')} />
                                <div className="grid grid-cols-2 gap-x-6">
                                    {(
                                        [
                                            [t('statistics.view.sentBySystemAndAdvisors'), messages.sent_by_system, G.serie],
                                            [t('statistics.metricModal.messages.receivedFromPatients'), messages.received_from_users, G.serie2],
                                        ] as const
                                    ).map(([etq, v, color]) => (
                                        <div key={etq} className="flex min-w-0 flex-col gap-1">
                                            <span className="flex min-w-0 items-center gap-2">
                                                <Cuadro color={color} />
                                                <span className={cn('truncate text-[12.5px] leading-4 font-medium', TEXTO_SUAVE)}>{etq}</span>
                                            </span>
                                            <span className="flex items-baseline gap-2">
                                                <span className={cn('text-[24px] leading-[30px] font-medium tracking-[-0.025em] tabular-nums', TEXTO_NAVY)}>{formatNumber(v)}</span>
                                                <span className={cn('text-[12.5px] leading-4 tabular-nums', TEXTO_SUAVE)}>{pct(v, messages.total, 0)}</span>
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <Apilada
                                    partes={[
                                        { etiqueta: t('statistics.chart.sent'), valor: messages.sent_by_system, color: G.serie },
                                        { etiqueta: t('statistics.chart.received'), valor: messages.received_from_users, color: G.serie2 },
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
                        <div className={cn('grid gap-y-6 border-b py-[18px] @4xl/hoja:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] @4xl/hoja:gap-x-8', SANGRIA, FILETE)}>
                            <div className="flex min-w-0 flex-col gap-3.5">
                                <Rotulo titulo={t('statistics.view.loadedAppointments')} apoyo={t('statistics.view.andReminder')} />
                                <div className="flex items-baseline gap-2.5">
                                    <span className={cn('text-[24px] leading-[30px] font-medium tracking-[-0.025em] tabular-nums', TEXTO_NAVY)}>{formatNumber(appointments.total)}</span>
                                    <span className={cn('text-[12.5px] leading-4', TEXTO_SUAVE)}>{t('statistics.view.totalLoadedLower')}</span>
                                </div>
                                <div className="flex flex-col">
                                    <FilaBarra etiqueta={t('statistics.appointments.remindersSent')} valor={appointments.reminder_sent} total={appointments.total} color={G.serie} />
                                    <FilaBarra etiqueta={t('statistics.appointments.pending')} valor={appointments.pending} total={appointments.total} color={G.neutro} />
                                    <FilaBarra etiqueta={t('statistics.appointments.failed')} valor={appointments.failed} total={appointments.total} color={G.mal} />
                                </div>
                            </div>
                            <DivisorV />
                            <div className="flex min-w-0 flex-col gap-3.5">
                                <Rotulo titulo={t('statistics.view.patientResponse')} apoyo={t('statistics.view.patientResponseHint')} />
                                {appointmentsData.length > 0 ? (
                                    <div className="flex flex-col items-center gap-5 @md/hoja:flex-row @md/hoja:gap-8">
                                        <div className="relative size-[150px] shrink-0">
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
                                                        return <Globo titulo={t('statistics.view.patientResponse')} filas={[{ color: p.color, etiqueta: p.name, valor: `${formatNumber(p.value)} · ${pct(p.value, respuestasTotal)}`, fuerte: true }]} />;
                                                    }}
                                                />
                                            </PieChart>
                                            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                                                <span className={cn('text-[22px] leading-[26px] font-medium tracking-[-0.02em] tabular-nums', TEXTO_NAVY)}>{formatNumber(appointments.reminder_sent)}</span>
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
                                    <Vacio mensaje={t('statistics.appointments.noData')} alto="h-[150px]" />
                                )}
                            </div>
                        </div>
                    </Tema>

                    {/* 4. Conversaciones | Plantillas y equipo */}
                    <div className={cn('grid border-b @5xl/hoja:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]', FILETE)}>
                        <Tema id="est-conversaciones" className="min-w-0">
                            <Banda
                                id="est-conversaciones-titulo"
                                icono={MessagesSquare}
                                titulo={t('statistics.conversations.title')}
                                texto={t('statistics.view.conversationsSubtitle', { value: formatNumber(conversations.total) })}
                            />
                            <div className={cn('flex flex-col gap-3 py-[18px] @3xl/hoja:pr-8', SANGRIA)}>
                                <Rotulo titulo={t('statistics.conversations.byStatus')} apoyo={t('statistics.view.ofConversations', { value: formatNumber(conversations.total) })} />
                                <div className="flex flex-col">
                                    {conversationItems.map((c) => (
                                        <FilaBarra
                                            key={c.label}
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
                                <div className={cn('h-px', FILETE_BG)} aria-hidden="true" />
                                <div className="grid min-h-[22px] grid-cols-[minmax(0,1fr)_56px_48px] items-center gap-x-3.5">
                                    <span className={cn('flex min-w-0 flex-wrap items-baseline gap-x-2 text-[13px] leading-[18px] font-medium', TXT_AVISO)}>
                                        <span className="flex items-center gap-2">
                                            <span className="size-2 shrink-0 self-center rounded-full bg-[var(--g-pend)]" aria-hidden="true" />
                                            {t('statistics.conversations.unread')}
                                        </span>
                                        <span className={cn('text-[12px] leading-4 font-normal', TEXTO_SUAVE)}>{t('statistics.view.unreadAnyState')}</span>
                                    </span>
                                    <span className={cn('text-right text-[13px] leading-[18px] font-semibold tabular-nums', TXT_AVISO)}>{formatNumber(conversations.unread)}</span>
                                    <span className={cn('text-right text-[12px] leading-[18px] tabular-nums', TEXTO_SUAVE)}>{pct(conversations.unread, conversations.total)}</span>
                                </div>
                            </div>
                        </Tema>

                        <Tema id="est-plantillas" className={cn('min-w-0 border-t @5xl/hoja:border-t-0 @5xl/hoja:border-l', FILETE)}>
                            <Banda
                                id="est-plantillas-titulo"
                                icono={FileText}
                                titulo={t('statistics.view.templatesTeamTitle')}
                                texto={t('statistics.view.templatesTeamSubtitle', { templates: formatNumber(templates.total), users: formatNumber(users.total) })}
                            />
                            <div className={cn('flex flex-col gap-6 py-[18px]', SANGRIA, '@5xl/hoja:pl-16')}>
                                <div className="flex flex-col gap-3">
                                    <Rotulo titulo={t('statistics.view.templateSends')} apoyo={t('statistics.view.inPeriod', { value: formatNumber(templates.total_sends) })} />
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
                    {fd && (fd.total ?? 0) > 0 && (() => {
                        const svcLabels: Record<string, string> = { agendamiento: t('statistics.flowDemand.services.scheduling'), cancelacion: t('statistics.flowDemand.services.cancellation'), informacion: t('statistics.flowDemand.services.information'), asesor: t('statistics.flowDemand.services.talkToAdvisor') };
                        const outLabels: Record<string, string> = { self_service: t('statistics.flowDemand.outcomes.selfService'), advisor: t('statistics.flowDemand.outcomes.advisor'), rejected: t('statistics.flowDemand.outcomes.rejected'), in_progress: t('statistics.flowDemand.outcomes.inProgress') };
                        const outColors: Record<string, string> = { self_service: G.ok, advisor: G.serie, rejected: G.mal, in_progress: G.neutro };
                        const regimenLabel = (k: string) => (k === 'subsidiado' ? t('statistics.flowDemand.regimens.subsidized') : k === 'contributivo' ? t('statistics.flowDemand.regimens.contributory') : k.charAt(0).toLocaleUpperCase('es') + k.slice(1));
                        const desenlace = Object.entries(fd.by_outcome).map(([k, v]) => ({ key: k, etiqueta: outLabels[k] ?? k, valor: v, color: outColors[k] ?? G.neutro }));
                        const ListaTop = ({ titulo, filas, vacio }: { titulo: string; filas: { name: string; value: number }[]; vacio?: string }) => (
                            <div className="flex min-w-0 flex-col gap-2.5">
                                <Rotulo titulo={titulo} />
                                {filas.length > 0 ? (
                                    <div className="flex flex-col">
                                        {filas.map((f) => (
                                            <div key={f.name} className="flex h-[34px] flex-col justify-center gap-[5px]">
                                                <div className="flex items-baseline gap-2.5">
                                                    <span className={cn('min-w-0 flex-1 truncate text-[12.5px] leading-4 font-medium', TEXTO_NAVY)}>{f.name}</span>
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
                                            <span className="size-[7px] rounded-full bg-[var(--g-ok)]" aria-hidden="true" />
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
                                    <MiniCifra etiqueta={t('statistics.flowDemand.reachedMenu')} valor={formatNumber(fd.reached_menu)} detalle={t('statistics.view.acceptedPrivacy', { value: formatNumber(fd.accepted_privacy) })} />
                                    {flecha}
                                    <MiniCifra etiqueta={t('statistics.flowDemand.outcomes.selfService')} valor={formatRate(fd.automation_rate)} detalle={t('statistics.flowDemand.resolvedWithoutAdvisor')} tono={TXT_OK} />
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
                                <div className={cn('grid gap-y-6 border-b py-[18px] @2xl/hoja:grid-cols-2 @2xl/hoja:gap-x-8 @5xl/hoja:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)_1px_minmax(0,1fr)]', SANGRIA, FILETE)}>
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
                        <div
                            className={cn(
                                'grid grid-cols-2 gap-x-5 gap-y-5 border-b py-4 @xl/hoja:grid-cols-3 @5xl/hoja:grid-cols-[repeat(5,minmax(0,1fr)_1px)_minmax(0,1fr)] @5xl/hoja:gap-y-0',
                                SANGRIA,
                                FILETE
                            )}
                        >
                            <MiniCifra etiqueta={t('statistics.users.advisors')} valor={formatNumber(advisors.total_advisors)} detalle={t('statistics.advisors.onTheTeam')} />
                            <DivisorV desde="@5xl/hoja:block" />
                            <MiniCifra etiqueta={t('statistics.chart.conversations')} valor={formatNumber(advisors.total_conversations)} detalle={t('statistics.advisors.assigned')} />
                            <DivisorV desde="@5xl/hoja:block" />
                            <MiniCifra etiqueta={t('statistics.advisors.resolved')} valor={formatNumber(advisors.total_resolved)} detalle={t('statistics.view.closedOrResolved')} />
                            <DivisorV desde="@5xl/hoja:block" />
                            <MiniCifra etiqueta={t('statistics.advisors.scheduled')} valor={formatNumber(advisors.total_scheduled)} detalle={t('statistics.advisors.conversationsLower')} />
                            <DivisorV desde="@5xl/hoja:block" />
                            <MiniCifra etiqueta={t('statistics.chart.messages')} valor={formatNumber(advisors.total_messages_sent)} detalle={t('statistics.advisors.sentLower')} />
                            <DivisorV desde="@5xl/hoja:block" />
                            <MiniCifra etiqueta={t('statistics.advisors.resolutionCap')} valor={formatRate(advisors.avg_resolution_rate)} detalle={t('statistics.view.teamAverage')} />
                        </div>

                        <div className={cn('flex min-h-[52px] flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3 @3xl/hoja:px-5 @5xl/hoja:flex-nowrap', FILETE)}>
                            {advisors.top_performer && (
                                <>
                                    <span className={cn('hidden w-8 shrink-0 justify-center @3xl/hoja:flex', TEXTO_NAVY)}>
                                        <Award className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
                                    </span>
                                    <p className={cn('min-w-0 text-[13px] leading-[18px] tabular-nums @5xl/hoja:truncate', TEXTO_SUAVE)}>
                                        <Trans
                                            i18nKey="statistics.view.topPerformer"
                                            values={{
                                                name: nombrePropio(advisors.top_performer.name),
                                                resolved: formatNumber(advisors.top_performer.resolved_conversations),
                                                rate: formatRate(advisors.top_performer.resolution_rate),
                                            }}
                                            components={{ strong: <span className={cn('font-semibold', TEXTO_NAVY)} /> }}
                                        />
                                    </p>
                                </>
                            )}
                            <span className={cn('flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12px] leading-4 whitespace-nowrap @5xl/hoja:ml-auto', TEXTO_SUAVE)}>
                                {t('statistics.view.conversationsBarLegend')}
                                <span className="flex items-center gap-1.5"><Cuadro color={G.serie} />{t('statistics.advisors.resolvedLower')}</span>
                                <span className="flex items-center gap-1.5"><Cuadro color={G.curso} />{t('statistics.advisors.activeLower')}</span>
                                <span className="flex items-center gap-1.5"><Cuadro color={G.serie2} />{t('statistics.view.otherLower')}</span>
                            </span>
                        </div>

                        {advisorList.length > 0 ? (
                            <div className={cn('relative overflow-x-auto', FOCO)} role="region" aria-labelledby="est-asesores-titulo" tabIndex={0}>
                                <table className="w-full min-w-[980px] table-fixed @4xl/hoja:min-w-[860px] border-collapse text-left">
                                    <thead>
                                        <tr className={cn('h-9 border-b', BANDA, FILETE)}>
                                            <th scope="col" className="pr-2.5 pl-4 @3xl/hoja:pl-[64px]">
                                                <span className={cn('text-[11px] leading-4 font-semibold tracking-[0.07em] uppercase', TEXTO_SUAVE)}>{t('statistics.view.advisorColumn', { count: advisorList.length })}</span>
                                            </th>
                                            <th scope="col" className={cn('w-[128px] px-2.5 text-[11px] leading-4 font-semibold tracking-[0.07em] uppercase', TEXTO_SUAVE)}>{t('statistics.advisors.resolutionCap')}</th>
                                            <th scope="col" className={cn('w-[170px] px-2.5 text-[11px] leading-4 font-semibold tracking-[0.07em] uppercase @6xl/hoja:w-[204px]', TEXTO_SUAVE)}>{t('statistics.chart.conversations')}</th>
                                            <th scope="col" className={cn('w-[92px] px-2.5 text-right text-[11px] leading-4 font-semibold tracking-[0.07em] uppercase', TEXTO_SUAVE)}>{t('statistics.advisors.resolved')}</th>
                                            <th scope="col" className={cn('w-[80px] px-2.5 text-right text-[11px] leading-4 font-semibold tracking-[0.07em] uppercase', TEXTO_SUAVE)}>{t('statistics.advisors.active')}</th>
                                            <th scope="col" className={cn('w-[98px] px-2.5 text-right text-[11px] leading-4 font-semibold tracking-[0.07em] uppercase', TEXTO_SUAVE)}>{t('statistics.advisors.scheduled')}</th>
                                            <th scope="col" className={cn('w-[140px] px-2.5 text-[11px] leading-4 font-semibold tracking-[0.07em] uppercase @6xl/hoja:w-[170px]', TEXTO_SUAVE)}>{t('statistics.chart.messages')}</th>
                                            <th scope="col" className="w-[44px] pr-5 font-normal"><span className="sr-only">{t('statistics.view.detail')}</span></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {advisorList.map((advisor) => {
                                            // resolution_rate es null cuando el asesor no tiene
                                            // conversaciones asignadas: eso es "sin datos", no un 0%.
                                            // Antes caía en el tramo <40 y se pintaba en rojo, señalando
                                            // como bajo rendimiento a quien no tenía carga.
                                            const rate = advisor.resolution_rate;
                                            const rateColor = rate === null ? G.neutro : rate >= 70 ? G.ok : rate >= 40 ? G.pend : G.mal;
                                            const rateText = rate === null ? 'text-slate-600 dark:text-neutral-300' : rate >= 70 ? TEXTO_NAVY : rate >= 40 ? TXT_AVISO : TXT_MAL;
                                            const nombre = nombrePropio(advisor.name);
                                            const abierto = expandedAdvisor === advisor.id;
                                            const otras = Math.max(advisor.total_conversations - advisor.resolved_conversations - advisor.active_conversations, 0);
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
                                                    <th scope="row" className="pr-2.5 pl-4 text-left font-normal @3xl/hoja:pl-5">
                                                        <div className="flex min-w-0 items-center gap-3">
                                                            <span
                                                                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#2e3f84]/10 text-[11px] leading-none font-semibold tracking-[0.02em] text-[#2e3f84] shadow-[inset_0_0_0_1px_rgba(46,63,132,0.06)] dark:bg-white/8 dark:text-neutral-200 dark:shadow-none"
                                                                aria-hidden="true"
                                                            >
                                                                {getInitials(advisor.name)}
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
                                                                        <span className="size-1.5 shrink-0 rounded-full bg-[var(--g-pend)]" aria-hidden="true" />
                                                                        <span className="truncate">
                                                                        {t('statistics.view.withUnread', { count: advisor.conversations_with_unread, value: formatNumber(advisor.conversations_with_unread) })}</span>
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
                                                            <span className={cn('text-right text-[13px] leading-[18px] font-semibold tabular-nums', advisor.total_conversations ? TEXTO_NAVY : TEXTO_SUAVE)}>{formatNumber(advisor.total_conversations)}</span>
                                                            <div className="h-2 overflow-hidden rounded-full" style={{ background: G.pista }} aria-hidden="true">
                                                                {advisor.total_conversations > 0 && (
                                                                    <div className="flex h-full gap-[2px]" style={{ width: anchoBarra(advisor.total_conversations, maxAdvisorConv) }}>
                                                                        <div style={{ flex: `${advisor.resolved_conversations} 1 0`, background: G.serie }} />
                                                                        {advisor.active_conversations > 0 && <div className="min-w-[2px]" style={{ flex: `${advisor.active_conversations} 1 0`, background: G.curso }} />}
                                                                        {otras > 0 && <div style={{ flex: `${otras} 1 0`, background: G.serie2 }} />}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    {numero(advisor.resolved_conversations)}
                                                    {numero(advisor.active_conversations)}
                                                    {numero(advisor.scheduled_conversations)}
                                                    <td className="px-2.5">
                                                        <div className="grid grid-cols-[48px_minmax(0,1fr)] items-center gap-x-3">
                                                            <span className={cn('text-right text-[13px] leading-[18px] font-medium tabular-nums', advisor.messages_sent ? TEXTO_NAVY : TEXTO_SUAVE)}>{formatNumber(advisor.messages_sent)}</span>
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
                        ) : (
                            <div className="p-5">
                                <Vacio mensaje={t('statistics.advisors.noData')} alto="h-[120px]" />
                            </div>
                        )}
                    </Tema>
                </div>
            </div>

            {/* ── Panel lateral: detalle de un asesor ── */}
            <DialogPrimitive.Root open={expandedAdvisor !== null} onOpenChange={(open) => !open && closeAdvisorDetail()}>
                <DialogPrimitive.Portal>
                    <DialogPrimitive.Overlay className="fixed inset-0 z-[65] bg-[#2e3f84]/20 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none dark:bg-black/50" />
                    <DialogPrimitive.Content
                        aria-describedby={undefined}
                        className={cn(
                            'fixed inset-y-0 right-0 z-[65] flex w-full max-w-[620px] flex-col bg-card shadow-[0_0_0_1px_rgba(46,63,132,0.08),-24px_0_48px_-24px_rgba(46,63,132,0.4)] outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=open]:duration-300 motion-reduce:animate-none sm:inset-y-2.5 sm:right-2.5 sm:rounded-[18px] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08),-24px_0_48px_-24px_rgba(0,0,0,0.8)]',
                            VARS_GRAFICOS
                        )}
                    >
                        {selectedAdvisor && (
                            <PanelAsesor
                                advisor={selectedAdvisor}
                                detail={advisorDetail}
                                loading={loadingAdvisor}
                                periodOptions={periodOptions}
                                advisorPeriod={advisorPeriod}
                                advisorStartDate={advisorStartDate}
                                advisorEndDate={advisorEndDate}
                                animar={animar}
                                onPeriod={(value) => {
                                    setAdvisorPeriod(value);
                                    setAdvisorStartDate('');
                                    setAdvisorEndDate('');
                                    fetchAdvisorDetail(selectedAdvisor.id, value, '', '');
                                }}
                                onRange={(start, end) => {
                                    setAdvisorStartDate(start);
                                    setAdvisorEndDate(end);
                                    if (fechaValida(start) && fechaValida(end)) {
                                        setAdvisorPeriod('custom');
                                        fetchAdvisorDetail(selectedAdvisor.id, 'custom', start, end);
                                        return true;
                                    }
                                    return false;
                                }}
                                onClearRange={() => {
                                    const habia = !!(advisorStartDate && advisorEndDate);
                                    setAdvisorStartDate('');
                                    setAdvisorEndDate('');
                                    if (habia) {
                                        setAdvisorPeriod('all');
                                        fetchAdvisorDetail(selectedAdvisor.id, 'all', '', '');
                                    }
                                }}
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
    periodOptions,
    advisorPeriod,
    advisorStartDate,
    advisorEndDate,
    animar,
    onPeriod,
    onRange,
    onClearRange,
}: {
    advisor: AdvisorSummary;
    detail: AdvisorDetail | null;
    loading: boolean;
    periodOptions: { value: string; label: string }[];
    advisorPeriod: string;
    advisorStartDate: string;
    advisorEndDate: string;
    animar: boolean;
    onPeriod: (value: string) => void;
    onRange: (start: string, end: string) => boolean;
    onClearRange: () => void;
}) {
    const { t } = useTranslation();
    const nombre = nombrePropio(detail?.advisor.name ?? advisor.name);
    const s = detail?.summary;
    const tipos = detail ? Object.entries(detail.message_types).sort((a, b) => b[1] - a[1]) : [];
    const totalTipos = tipos.reduce((sum, [, v]) => sum + v, 0);
    const maxTipo = tipos[0]?.[1] ?? 0;
    const miles = (v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} ${t('statistics.view.thousandShort')}` : formatNumber(v));
    const marcasDia = marcasRedondas(Math.max(...(detail?.daily_activity ?? []).map((d) => d.count), 0), 4);
    const marcasHora = marcasRedondas(Math.max(...(detail?.hourly_distribution ?? []).map((d) => d.count), 0), 4);
    const globoMensajes = (titulo: string, valor: number) => <Globo titulo={titulo} filas={[{ color: G.serie, etiqueta: t('statistics.chart.messages'), valor: formatNumber(valor), fuerte: true }]} />;

    return (
        <>
            <div className={cn('flex h-[84px] shrink-0 items-center gap-3.5 border-b pr-5 pl-6', FILETE)}>
                <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#2e3f84]/10 text-[13px] leading-none font-semibold tracking-[0.02em] text-[#2e3f84] shadow-[inset_0_0_0_1px_rgba(46,63,132,0.06)] dark:bg-white/8 dark:text-neutral-200 dark:shadow-none"
                    aria-hidden="true"
                >
                    {getInitials(detail?.advisor.name ?? advisor.name)}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <DialogPrimitive.Title className={cn('truncate text-[17px] leading-[22px] font-semibold tracking-[-0.012em]', TEXTO_NAVY)}>{nombre}</DialogPrimitive.Title>
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
                    activa={advisorStartDate && advisorEndDate ? null : advisorPeriod}
                    onElegir={onPeriod}
                    etiqueta={t('statistics.filters.period')}
                    className="grid w-full grid-cols-3 @lg/panel:flex @lg/panel:w-auto"
                />
                <CampoRango
                    peq
                    inicio={advisorStartDate}
                    fin={advisorEndDate}
                    onCambio={onRange}
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
                        <div className={cn('grid grid-cols-2 gap-x-[18px] gap-y-[18px] border-b px-4 py-5 sm:px-6 @md/cuerpo:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)_1px_minmax(0,1fr)]', FILETE)}>
                            <MiniCifra icono={Send} etiqueta={t('statistics.chart.messages')} valor={formatNumber(s.messages_sent)} detalle={t('statistics.advisors.sentLower')} />
                            <DivisorV desde="@md/cuerpo:block" />
                            <MiniCifra
                                icono={TrendingUp}
                                etiqueta={t('statistics.advisors.resolutionCap')}
                                valor={formatRate(s.resolution_rate)}
                                detalle={t('statistics.view.resolvedOf', { resolved: formatNumber(s.resolved_conversations), total: formatNumber(s.total_conversations) })}
                            />
                            <DivisorV desde="@md/cuerpo:block" />
                            <MiniCifra icono={Timer} etiqueta={t('statistics.view.typicalResponse')} valor={formatDuration(s.median_response_time_minutes)} detalle={t('statistics.view.medianWait')} />
                            <MiniCifra icono={CalendarCheck2} etiqueta={t('statistics.advisors.scheduled')} valor={formatNumber(s.scheduled_conversations)} detalle={t('statistics.advisors.conversationsLower')} />
                            <DivisorV desde="@md/cuerpo:block" />
                            <MiniCifra
                                icono={Activity}
                                etiqueta={t('statistics.advisors.open')}
                                valor={formatNumber(s.active_conversations + s.pending_conversations)}
                                detalle={t('statistics.view.activePendingDetail', { active: formatNumber(s.active_conversations), pending: formatNumber(s.pending_conversations) })}
                            />
                        </div>

                        <div className={cn('grid gap-y-6 border-b px-4 pt-[18px] pb-4 sm:px-6 @md/cuerpo:grid-cols-2 @md/cuerpo:gap-x-7', FILETE)}>
                            <div className="flex min-w-0 flex-col gap-3">
                                <Rotulo titulo={t('statistics.advisors.dailyActivity')} apoyo={advisorPeriod === 'all' && !advisorStartDate ? t('statistics.view.last7Days') : undefined} />
                                <div className="h-[214px] min-w-0" role="img" aria-label={t('statistics.advisors.dailyActivity')}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={detail.daily_activity} margin={{ top: 8, right: 0, bottom: 0, left: 0 }} barCategoryGap="24%">
                                            <CartesianGrid vertical={false} stroke={G.rejilla} />
                                            <XAxis dataKey="label" tick={<TickDosLineas />} axisLine={{ stroke: G.base }} tickLine={false} height={36} interval={detail.daily_activity.length <= 14 ? 0 : 'preserveStartEnd'} minTickGap={4} />
                                            <YAxis tick={EJE} axisLine={false} tickLine={false} width={34} allowDecimals={false} tickFormatter={(v: number) => formatNumber(v)} ticks={marcasDia} domain={[0, marcasDia[marcasDia.length - 1]]} />
                                            <Tooltip
                                                cursor={{ fill: G.realce, radius: 6 }}
                                                isAnimationActive={false}
                                                content={({ active, payload }: ContenidoGlobo) => {
                                                    const p = payload?.[0]?.payload as AdvisorDetail['daily_activity'][number] | undefined;
                                                    if (!active || !p) return null;
                                                    return globoMensajes(`${p.label} · ${p.date}`, p.count);
                                                }}
                                            />
                                            <Bar dataKey="count" fill={G.serie} radius={[3, 3, 0, 0]} maxBarSize={26} isAnimationActive={animar} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            <div className="flex min-w-0 flex-col gap-3">
                                <Rotulo titulo={t('statistics.advisors.hourlyDistribution')} apoyo={t('statistics.view.colombiaTime')} />
                                <div className="h-[214px] min-w-0" role="img" aria-label={t('statistics.advisors.hourlyDistribution')}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={detail.hourly_distribution} margin={{ top: 8, right: 0, bottom: 0, left: 0 }} barCategoryGap="14%">
                                            <CartesianGrid vertical={false} stroke={G.rejilla} />
                                            <XAxis
                                                dataKey="hour"
                                                tick={EJE}
                                                axisLine={{ stroke: G.base }}
                                                tickLine={false}
                                                interval={5}
                                                tickFormatter={(h: string) => h.slice(0, 2)}
                                                tickMargin={6}
                                            />
                                            <YAxis tick={EJE} axisLine={false} tickLine={false} width={44} allowDecimals={false} tickFormatter={miles} ticks={marcasHora} domain={[0, marcasHora[marcasHora.length - 1]]} />
                                            <Tooltip
                                                cursor={{ fill: G.realce, radius: 4 }}
                                                isAnimationActive={false}
                                                content={({ active, payload }: ContenidoGlobo) => {
                                                    const p = payload?.[0]?.payload as AdvisorDetail['hourly_distribution'][number] | undefined;
                                                    if (!active || !p) return null;
                                                    return globoMensajes(p.hour, p.count);
                                                }}
                                            />
                                            <Bar dataKey="count" fill={G.serie} radius={[2, 2, 0, 0]} isAnimationActive={animar} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {tipos.length > 0 && (
                            <div className="flex flex-col gap-2.5 px-4 py-[18px] sm:px-6">
                                <Rotulo titulo={t('statistics.view.messageTypes')} apoyo={t('statistics.view.sentCount', { value: formatNumber(totalTipos) })} />
                                <div className="flex flex-col">
                                    {tipos.map(([type, count]) => (
                                        <div key={type} className="grid h-[30px] grid-cols-[96px_minmax(0,1fr)_64px_52px] items-center gap-x-3.5">
                                            <span className={cn("truncate text-[12px] leading-4 font-medium [font-family:ui-monospace,'Cascadia_Mono','SF_Mono',Consolas,monospace]", TEXTO_NAVY)}>{type}</span>
                                            <BarraPista valor={count} max={maxTipo} alto={6} />
                                            <span className={cn('text-right text-[13px] leading-[18px] font-semibold tabular-nums', TEXTO_NAVY)}>{formatNumber(count)}</span>
                                            <span className={cn('text-right text-[12px] leading-[18px] tabular-nums', TEXTO_SUAVE)}>{pct(count, totalTipos)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className={cn('py-16 text-center text-[13px] leading-[18px]', TEXTO_SUAVE)} role="alert">
                        {t('statistics.advisors.errorLoadingMetrics')}
                    </div>
                )}
            </div>
        </>
    );
}

// Skeleton con la forma nueva (cabecera, franja de seis cifras y la hoja con sus bandas grises)
// mientras Inertia trae la prop diferida `statistics` en la segunda petición.
function StatisticsSkeleton() {
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

export default function StatisticsIndex({ statistics }: StatisticsIndexProps) {
    const { t } = useTranslation();

    return (
        <AdminLayout>
            <Head title={t('statistics.title')} />
            {/* El layout (sidebar/topbar) y este cascarón aparecen al instante.
                <Deferred> muestra el skeleton hasta que llega la prop `statistics`. */}
            <Deferred data="statistics" fallback={<StatisticsSkeleton />}>
                <StatisticsView statistics={statistics as Statistics} />
            </Deferred>
        </AdminLayout>
    );
}
