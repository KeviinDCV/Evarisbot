import { BANDA, BOTON_PELIGRO_LLENO, BOTON_SECUNDARIO, FILETE, FOCO, TEXTO_NAVY, TEXTO_SUAVE, esIngles } from '@/components/appointments/piezas-citas';
import { cn } from '@/lib/utils';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
    Ban,
    CircleAlert,
    CircleCheck,
    CircleDot,
    CircleX,
    Clock,
    Info,
    LoaderCircle,
    Pause,
    Play,
    Square,
    TriangleAlert,
    X,
    type LucideIcon,
} from 'lucide-react';
import { useRef, type ReactNode, type RefObject } from 'react';
import { Trans, useTranslation } from 'react-i18next';

/* ── Piezas de Envío masivo (índice y detalle) ─────────────────────────────────────────────────────
   Lenguaje de design/vista-envio-masivo/gen_envio.mjs, el mismo de Citas, Usuarios, Configuración y
   Estadísticas: navy #2e3f84 con alfa sobre la hoja blanca; en oscuro, blanco con alfa sobre bg-card.
   Solo presentación: ninguna pieza hace llamadas. */

// Sangría del texto de la hoja: 20 px + 32 de la ranura del icono de sección + 12 = 64 px.
export const SANGRIA = 'px-4 @3xl/hoja:pr-5 @3xl/hoja:pl-16';

/** Miles con punto (es) o coma (en), sin decimales. */
export const miles = (n: number, lng?: string) => Math.round(n).toLocaleString(esIngles(lng) ? 'en-US' : 'es-CO');

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

/** "2026-09-12 07:52[:11]" → "12 sept 2026, 7:52[:11]" (es) · "Sep 12, 2026, 7:52" (en). Si no encaja, tal cual. */
export function fechaHora(valor?: string | null, lng?: string) {
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(valor ?? '');
    if (!m) return valor ?? '';
    const [, a, mes, d, h, mi, s] = m;
    const hora = h ? `${Number(h)}:${mi}${s ? `:${s}` : ''}` : '';
    if (esIngles(lng)) {
        const f = new Date(Number(a), Number(mes) - 1, Number(d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return hora ? `${f}, ${hora}` : f;
    }
    const f = `${Number(d)} ${MESES_CORTOS[Number(mes) - 1]} ${a}`;
    return hora ? `${f}, ${hora}` : f;
}

/* ── Cabecera de página, franja y hoja ── */

export const H1 = cn('text-[28px] leading-[34px] font-semibold tracking-[-0.025em]', TEXTO_NAVY);

/** Una cifra de la franja: marca + etiqueta arriba, número grande y su detalle debajo. */
export function Cifra({ marca, etiqueta, valor, detalle }: { marca: ReactNode; etiqueta: string; valor: string; detalle: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col">
            <div className="flex h-4 items-center gap-2">
                {marca}
                <span className="truncate text-[12px] leading-4 font-medium text-muted-foreground dark:text-neutral-400">{etiqueta}</span>
            </div>
            <span className={cn('mt-[7px] text-[28px] leading-8 font-medium tracking-[-0.03em] whitespace-nowrap tabular-nums', TEXTO_NAVY)}>{valor}</span>
            <span className="mt-[5px] flex min-h-4 min-w-0 items-center gap-1.5 text-[12.5px] leading-4 text-muted-foreground tabular-nums dark:text-neutral-400">
                {detalle}
            </span>
        </div>
    );
}

/** Franja de cifras con filetes entre ellas (sin cajas). En pantallas estrechas, de dos en dos. */
export function Franja({ cifras, etiqueta }: { cifras: ReactNode[]; etiqueta: string }) {
    const cinco = cifras.length === 5;
    return (
        <section
            aria-label={etiqueta}
            className={cn(
                'grid grid-cols-2 gap-x-6 gap-y-5 @5xl/pagina:gap-y-0',
                cinco
                    ? '@5xl/pagina:grid-cols-[repeat(4,minmax(0,1fr)_1px)_minmax(0,1fr)]'
                    : '@5xl/pagina:grid-cols-[repeat(3,minmax(0,1fr)_1px)_minmax(0,1fr)]'
            )}
        >
            {cifras.map((c, i) => [
                i > 0 && <div key={`d${i}`} className="hidden w-px self-stretch bg-[#2e3f84]/12 @5xl/pagina:block dark:bg-white/10" aria-hidden="true" />,
                <div key={`c${i}`} className="min-w-0">
                    {c}
                </div>,
            ])}
        </section>
    );
}

/** Chip con la cuenta junto a un título ("Historial de envíos  48"). */
export function Cuenta({ children }: { children: ReactNode }) {
    return (
        <span className="inline-flex h-5 items-center rounded-md bg-[#2e3f84]/7 px-[7px] text-[12px] leading-4 font-semibold text-[#2e3f84] tabular-nums dark:bg-white/8 dark:text-neutral-100">
            {children}
        </span>
    );
}

/** Banda de sección: icono en la ranura, título (+ cuenta y estado), qué hace; acciones a la derecha. */
export function Banda({
    id,
    icon: Icon,
    titulo,
    cuenta,
    estado,
    texto,
    acciones,
    className,
    accionesClassName,
}: {
    id: string;
    icon: LucideIcon;
    titulo: string;
    cuenta?: ReactNode;
    estado?: ReactNode;
    texto: ReactNode;
    acciones?: ReactNode;
    className?: string;
    accionesClassName?: string;
}) {
    return (
        <div
            className={cn(
                'flex flex-wrap items-center gap-x-3 gap-y-3 border-b px-4 py-3 @3xl/hoja:min-h-16 @3xl/hoja:px-5 @3xl/hoja:py-2.5 @5xl/hoja:flex-nowrap',
                BANDA,
                FILETE,
                className
            )}
        >
            <span className={cn('flex w-8 shrink-0 justify-center self-start pt-px @3xl/hoja:self-center @3xl/hoja:pt-0', TEXTO_NAVY)}>
                <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <div className="flex min-w-0 flex-[1_1_16rem] flex-col gap-[3px]">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <h2 id={id} className={cn('text-[15px] leading-5 font-semibold tracking-[-0.01em]', TEXTO_NAVY)}>
                        {titulo}
                    </h2>
                    {cuenta !== undefined && <Cuenta>{cuenta}</Cuenta>}
                    {estado}
                </div>
                <p className={cn('text-[12.5px] leading-4 tabular-nums', TEXTO_SUAVE)}>{texto}</p>
            </div>
            {acciones && <div className={cn('flex flex-wrap items-center gap-2.5 @5xl/hoja:shrink-0', accionesClassName)}>{acciones}</div>}
        </div>
    );
}

/** Rótulo en versalitas + apoyo ("PROGRESO DEL ENVÍO  se actualiza solo cada 3 segundos"). */
export function Rotulo({ titulo, apoyo, as: Tag = 'span', id }: { titulo: string; apoyo?: ReactNode; as?: 'span' | 'h2' | 'h3' | 'h4'; id?: string }) {
    return (
        <div className="flex min-h-4 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <Tag id={id} className={cn('text-[11px] leading-4 font-semibold tracking-[0.07em] whitespace-nowrap uppercase', TEXTO_SUAVE)}>{titulo}</Tag>
            {apoyo && <span className={cn('text-[12px] leading-4 tabular-nums', TEXTO_SUAVE)}>{apoyo}</span>}
        </div>
    );
}

/** Segmentado (el de Usuarios, Estadísticas y Citas) con cuenta opcional: la opción elegida en blanco. */
export function Segmentado<V extends string>({
    opciones,
    activa,
    onElegir,
    etiqueta,
    className,
}: {
    opciones: { value: V; label: string; count?: number | string }[];
    activa: V;
    onElegir: (value: V) => void;
    etiqueta: string;
    className?: string;
}) {
    return (
        <div role="group" aria-label={etiqueta} className={cn('flex max-w-full items-center gap-0.5 overflow-x-auto rounded-[11px] bg-[#2e3f84]/[0.055] p-[3px] dark:bg-white/5', className)}>
            {opciones.map((o) => {
                const on = activa === o.value;
                return (
                    <button
                        key={o.value}
                        type="button"
                        aria-pressed={on}
                        onClick={() => onElegir(o.value)}
                        className={cn(
                            'flex h-[30px] shrink-0 cursor-pointer items-center gap-[7px] rounded-lg px-3 text-[13px] leading-4 font-semibold whitespace-nowrap transition-colors',
                            FOCO,
                            on
                                ? 'bg-white text-[#2e3f84] shadow-[0_0_0_1px_rgba(46,63,132,0.08),0_1px_2px_rgba(46,63,132,0.12),0_2px_6px_-2px_rgba(46,63,132,0.12)] dark:bg-white/12 dark:text-neutral-100 dark:shadow-none'
                                : cn(TEXTO_SUAVE, 'hover:text-[#2e3f84] dark:hover:text-neutral-100')
                        )}
                    >
                        {o.label}
                        {o.count !== undefined && o.count !== '' && <span className={cn('text-[12px] font-semibold tabular-nums', TEXTO_SUAVE)}>{o.count}</span>}
                    </button>
                );
            })}
        </div>
    );
}

/* ── Estados: icono + texto del color de su significado (nunca solo color) ── */

type Tono = 'ok' | 'mal' | 'aviso' | 'curso' | 'neutro';
const TONO_TXT: Record<Tono, string> = {
    ok: 'text-emerald-700 dark:text-emerald-400',
    mal: 'text-red-700 dark:text-red-400',
    aviso: 'text-amber-700 dark:text-amber-400',
    curso: 'text-sky-700 dark:text-sky-300',
    neutro: 'text-slate-600 dark:text-neutral-300',
};
const TONO_ICO: Record<Tono, string> = {
    ok: 'text-emerald-600 dark:text-emerald-400',
    mal: 'text-red-600 dark:text-red-400',
    aviso: 'text-amber-600 dark:text-amber-400',
    curso: 'text-sky-600 dark:text-sky-400',
    neutro: 'text-slate-600 dark:text-neutral-400',
};

// Estados de BulkSend y de BulkSendRecipient (comparten 'sent', 'failed' y 'pending').
const ESTADOS_ENVIO: Record<string, [LucideIcon, Tono, string]> = {
    completed: [CircleCheck, 'ok', 'bulkSends.statusCompleted'],
    sent: [CircleCheck, 'ok', 'bulkSends.statusSent'],
    processing: [LoaderCircle, 'curso', 'bulkSends.statusProcessing'],
    failed: [CircleX, 'mal', 'bulkSends.statusFailed'],
    cancelled: [Ban, 'neutro', 'bulkSends.statusCancelled'],
    draft: [CircleDot, 'neutro', 'bulkSends.statusDraft'],
    pending: [Clock, 'aviso', 'bulkSends.statusPending'],
};
const ESTADOS_PLANTILLA: Record<string, [LucideIcon, Tono, string]> = {
    APPROVED: [CircleCheck, 'ok', 'bulkSends.tplStatusApproved'],
    PENDING: [Clock, 'aviso', 'bulkSends.tplStatusPending'],
    REJECTED: [CircleX, 'mal', 'bulkSends.tplStatusRejected'],
    PAUSED: [Pause, 'aviso', 'bulkSends.tplStatusPaused'],
    DISABLED: [Ban, 'neutro', 'bulkSends.tplStatusDisabled'],
};

export function Estado({
    status,
    tipo = 'envio',
    peq = false,
    className,
}: {
    status: string;
    tipo?: 'envio' | 'plantilla';
    peq?: boolean;
    className?: string;
}) {
    const { t } = useTranslation();
    const def = (tipo === 'plantilla' ? ESTADOS_PLANTILLA : ESTADOS_ENVIO)[status];
    const [Icono, tono, clave] = def ?? [CircleDot, 'neutro' as Tono, ''];
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 font-semibold whitespace-nowrap',
                peq ? 'text-[12.5px] leading-4' : 'text-[13px] leading-[18px]',
                TONO_TXT[tono],
                className
            )}
        >
            <Icono
                className={cn('size-3.5 shrink-0', TONO_ICO[tono], status === 'processing' && 'animate-spin motion-reduce:animate-none')}
                strokeWidth={2.25}
                aria-hidden="true"
            />
            {clave ? t(clave) : status}
        </span>
    );
}

/** Estado del paso: punto + texto (listo en esmeralda, falta en rojo, pendiente en pizarra, aviso en ámbar). */
export function EstadoPaso({ tono, children }: { tono: 'ok' | 'mal' | 'aviso' | 'neutro'; children: ReactNode }) {
    const punto = { ok: 'bg-emerald-600 dark:bg-emerald-400', mal: 'bg-red-600 dark:bg-red-400', aviso: 'bg-amber-600 dark:bg-amber-400', neutro: 'bg-slate-400 dark:bg-neutral-500' }[tono];
    return (
        <span className={cn('inline-flex items-center gap-1.5 text-[12.5px] leading-4 whitespace-nowrap tabular-nums', tono === 'mal' ? 'font-semibold' : 'font-medium', TONO_TXT[tono])}>
            <span className={cn('size-[7px] shrink-0 rounded-full', punto)} aria-hidden="true" />
            {children}
        </span>
    );
}

/** Barra de progreso: enviados en esmeralda y fallidos en rojo sobre la pista navy. */
export function Barra({ ok, mal, total, alto = 'h-1.5', etiqueta }: { ok: number; mal: number; total: number; alto?: string; etiqueta?: string }) {
    const pct = (n: number) => (total > 0 ? Math.min(100, (n / total) * 100) : 0);
    return (
        <div
            role={etiqueta ? 'progressbar' : undefined}
            aria-label={etiqueta}
            aria-valuemin={etiqueta ? 0 : undefined}
            aria-valuemax={etiqueta ? 100 : undefined}
            aria-valuenow={etiqueta ? Math.round(pct(ok + mal)) : undefined}
            aria-hidden={etiqueta ? undefined : true}
            className={cn('flex gap-px overflow-hidden rounded-full bg-[#2e3f84]/8 dark:bg-white/10', alto)}
        >
            <div className="h-full bg-emerald-600 transition-[width] duration-500 ease-out dark:bg-emerald-500" style={{ width: `${pct(ok)}%` }} />
            {mal > 0 && <div className="h-full min-w-[2px] bg-red-600 transition-[width] duration-500 ease-out dark:bg-red-500" style={{ width: `${pct(mal)}%` }} />}
        </div>
    );
}

/** El mensaje como burbuja de WhatsApp (fondo del chat y globo blanco). */
export function Burbuja({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div className={cn('rounded-xl bg-[#efeae2] p-3.5 pb-4 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)] dark:bg-[#0b141a] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]', className)}>
            <div className="rounded-[3px_10px_10px_10px] bg-white px-[11px] pt-[9px] pb-2.5 text-[13.5px] leading-5 text-[#111b21] shadow-[0_1px_1px_rgba(0,0,0,0.1)] [overflow-wrap:anywhere] dark:bg-[#202c33] dark:text-[#e9edef]">
                {children}
            </div>
        </div>
    );
}

/** Aviso dentro de la hoja o de un diálogo (ámbar, rojo o informativo). */
export function Nota({ tipo, titulo, children, className }: { tipo: 'aviso' | 'mal' | 'info'; titulo?: ReactNode; children?: ReactNode; className?: string }) {
    const estilos = {
        aviso: ['bg-amber-50 shadow-[inset_0_0_0_1px_var(--color-amber-200)] dark:bg-amber-500/10 dark:shadow-[inset_0_0_0_1px_rgba(245,158,11,0.25)]', 'text-amber-700 dark:text-amber-400', 'text-amber-800 dark:text-amber-200', TriangleAlert],
        mal: ['bg-red-50 shadow-[inset_0_0_0_1px_var(--color-red-200)] dark:bg-red-500/10 dark:shadow-[inset_0_0_0_1px_rgba(239,68,68,0.28)]', 'text-red-700 dark:text-red-400', 'text-red-800 dark:text-red-200', CircleX],
        info: ['bg-sky-50 shadow-[inset_0_0_0_1px_var(--color-sky-200)] dark:bg-sky-500/10 dark:shadow-[inset_0_0_0_1px_rgba(14,165,233,0.25)]', 'text-sky-700 dark:text-sky-300', 'text-sky-900 dark:text-sky-100', Info],
    } as const;
    const [fondo, ico, txt, Icono] = estilos[tipo];
    return (
        <div className={cn('flex items-start gap-2.5 rounded-[10px] px-3.5 pt-[11px] pb-3', fondo, className)}>
            <Icono className={cn('mt-px size-4 shrink-0', ico)} strokeWidth={2} aria-hidden="true" />
            <div className={cn('flex min-w-0 flex-col gap-[3px] text-[12.5px] leading-[18px] tabular-nums [overflow-wrap:anywhere]', txt)}>
                {titulo && <span className="text-[13px] font-semibold">{titulo}</span>}
                {children}
            </div>
        </div>
    );
}

/** Aviso de resultado arriba de la hoja (éxito o error de cualquier acción), con su cierre. */
export function AvisoAccion({ tipo, texto, onCerrar }: { tipo: 'ok' | 'error'; texto: string; onCerrar: () => void }) {
    const { t } = useTranslation();
    return (
        <div
            role={tipo === 'error' ? 'alert' : 'status'}
            className={cn(
                'flex items-start gap-3 rounded-xl px-4 py-3 text-[13px] leading-[18px] font-medium',
                tipo === 'ok'
                    ? 'bg-emerald-50 text-emerald-800 shadow-[inset_0_0_0_1px_var(--color-emerald-200)] dark:bg-emerald-500/10 dark:text-emerald-300 dark:shadow-[inset_0_0_0_1px_rgba(16,185,129,0.25)]'
                    : 'bg-red-50 text-red-800 shadow-[inset_0_0_0_1px_var(--color-red-200)] dark:bg-red-500/10 dark:text-red-300 dark:shadow-[inset_0_0_0_1px_rgba(239,68,68,0.28)]'
            )}
        >
            {tipo === 'ok' ? (
                <CircleCheck className="mt-px size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            ) : (
                <CircleAlert className="mt-px size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            )}
            <p className="min-w-0 flex-1 [overflow-wrap:anywhere]">{texto}</p>
            <button
                type="button"
                onClick={onCerrar}
                aria-label={t('bulkSends.closeNotice')}
                title={t('bulkSends.closeNotice')}
                className={cn('-my-1 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/10', FOCO)}
            >
                <X className="size-4" aria-hidden="true" />
            </button>
        </div>
    );
}

/* ── Diálogos (Radix): overlay navy, cabecera con icono, pie en banda. Esc cierra (= la opción segura) ── */

export function Dialogo({
    abierto,
    onCerrar,
    icono: Icono,
    peligro = false,
    titulo,
    descripcion,
    cerrarConX = false,
    ancho = 'max-w-[480px]',
    children,
    pie,
    enfoqueInicial,
    bloquearFuera = false,
}: {
    abierto: boolean;
    onCerrar: () => void;
    icono: LucideIcon;
    peligro?: boolean;
    titulo: string;
    descripcion?: ReactNode;
    cerrarConX?: boolean;
    ancho?: string;
    children?: ReactNode;
    pie: ReactNode;
    enfoqueInicial?: RefObject<HTMLElement | null>;
    bloquearFuera?: boolean;
}) {
    const { t } = useTranslation();
    return (
        <DialogPrimitive.Root open={abierto} onOpenChange={(open) => !open && onCerrar()}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-[65] bg-[#2e3f84]/28 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none dark:bg-black/55" />
                <DialogPrimitive.Content
                    onOpenAutoFocus={(event) => {
                        if (enfoqueInicial?.current) {
                            event.preventDefault();
                            enfoqueInicial.current.focus();
                        }
                    }}
                    onInteractOutside={bloquearFuera ? (event) => event.preventDefault() : undefined}
                    {...(descripcion ? {} : { 'aria-describedby': undefined })}
                    className={cn(
                        'fixed top-1/2 left-1/2 z-[65] flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-card shadow-[0_0_0_1px_rgba(46,63,132,0.1),0_6px_14px_rgba(46,63,132,0.1),0_30px_60px_-20px_rgba(46,63,132,0.55)] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 motion-reduce:animate-none dark:shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_30px_60px_-20px_rgba(0,0,0,0.8)]',
                        ancho
                    )}
                >
                    <div className="flex items-center gap-3.5 px-6 pt-5">
                        <span
                            className={cn(
                                'flex size-[38px] shrink-0 items-center justify-center rounded-[10px]',
                                peligro
                                    ? 'bg-red-50 text-red-700 shadow-[inset_0_0_0_1px_var(--color-red-200)] dark:bg-red-500/10 dark:text-red-300 dark:shadow-none'
                                    : 'bg-[#2e3f84]/8 text-[#2e3f84] dark:bg-white/8 dark:text-neutral-100'
                            )}
                        >
                            <Icono className="size-[18px]" strokeWidth={2} aria-hidden="true" />
                        </span>
                        <DialogPrimitive.Title className={cn('min-w-0 flex-1 text-[16.5px] leading-[22px] font-semibold tracking-[-0.01em] tabular-nums', TEXTO_NAVY)}>
                            {titulo}
                        </DialogPrimitive.Title>
                        {cerrarConX && (
                            <DialogPrimitive.Close asChild>
                                <button
                                    type="button"
                                    aria-label={t('common.close')}
                                    title={t('common.close')}
                                    className={cn(
                                        'flex size-[30px] shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-[#2e3f84]/8 hover:text-[#2e3f84] dark:text-neutral-400 dark:hover:bg-white/8 dark:hover:text-neutral-100',
                                        FOCO
                                    )}
                                >
                                    <X className="size-4" strokeWidth={2} aria-hidden="true" />
                                </button>
                            </DialogPrimitive.Close>
                        )}
                    </div>
                    <div className="custom-scrollbar flex min-h-0 flex-col gap-3.5 overflow-y-auto px-6 pt-4 pb-5">
                        {descripcion && (
                            <DialogPrimitive.Description asChild>
                                <div className="flex flex-col gap-2 text-[13.5px] leading-5 text-muted-foreground tabular-nums dark:text-neutral-400">{descripcion}</div>
                            </DialogPrimitive.Description>
                        )}
                        {children}
                    </div>
                    <div className={cn('flex flex-wrap items-center justify-end gap-2 border-t px-6 py-3.5', BANDA, FILETE)}>{pie}</div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}

/**
 * Confirmación de DETENER un envío en curso (índice y detalle). "Seguir enviando" va a la izquierda y
 * con el foco; Esc o pulsar fuera equivalen a seguir. Solo "Sí, detener el envío" llama a onDetener.
 */
export function ConfirmarDetener({
    abierto,
    onSeguir,
    onDetener,
    pendientes,
    procesados,
}: {
    abierto: boolean;
    onSeguir: () => void;
    onDetener: () => void;
    pendientes?: number | null;
    procesados?: number | null;
}) {
    const { t, i18n } = useTranslation();
    const seguro = useRef<HTMLButtonElement>(null);
    const conCifras = typeof pendientes === 'number' && typeof procesados === 'number';

    return (
        <Dialogo
            abierto={abierto}
            onCerrar={onSeguir}
            icono={Square}
            peligro
            titulo={t('bulkSends.confirmStopTitle')}
            enfoqueInicial={seguro}
            descripcion={
                <>
                    <p>
                        {conCifras ? (
                            <Trans
                                i18nKey="bulkSends.confirmStopPending"
                                values={{ pending: miles(pendientes!, i18n.language), done: miles(procesados!, i18n.language) }}
                                components={{ strong: <span className={cn('font-semibold', TEXTO_NAVY)} /> }}
                            />
                        ) : (
                            t('bulkSends.confirmStopGeneric')
                        )}
                    </p>
                    <p>{t('bulkSends.confirmStopAfter')}</p>
                </>
            }
            pie={
                <>
                    <DialogPrimitive.Close asChild>
                        <button ref={seguro} type="button" className={BOTON_SECUNDARIO}>
                            <Play strokeWidth={1.9} aria-hidden="true" />
                            {t('bulkSends.confirmStopKeep')}
                        </button>
                    </DialogPrimitive.Close>
                    <button type="button" onClick={onDetener} className={BOTON_PELIGRO_LLENO}>
                        <Square strokeWidth={2} aria-hidden="true" />
                        {t('bulkSends.confirmStopYes')}
                    </button>
                </>
            }
        />
    );
}
