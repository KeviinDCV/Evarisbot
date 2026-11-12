import { BANDA, FILETE, FOCO, MONO, TEXTO_NAVY, TEXTO_SUAVE, esIngles } from '@/components/appointments/piezas-citas';
import { cn } from '@/lib/utils';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Check, FileText, Image as ImageIcon, Play, X, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';

/* ── Piezas de Plantillas (/admin/templates) ───────────────────────────────────────────────────────
   Lenguaje de design/vista-plantillas/gen_plantillas.mjs, el mismo de Envío masivo, Citas y Usuarios:
   navy #2e3f84 con alfa sobre la hoja blanca; en oscuro, blanco con alfa sobre bg-card. Las burbujas
   imitan WhatsApp (claro y oscuro). Solo presentación: ninguna pieza hace llamadas. */

// Campo editable. Borde navy al 58 % (#868fb7): 3,1:1 contra la hoja (WCAG 1.4.11).
export const CAMPO = cn(
    'h-[38px] w-full min-w-0 rounded-[9px] bg-white px-3 text-[13px] leading-[18px] font-medium text-[#2e3f84] shadow-[inset_0_0_0_1px_rgba(46,63,132,0.58)] transition-shadow outline-none placeholder:font-normal placeholder:text-muted-foreground',
    'focus:shadow-[inset_0_0_0_1px_#2e3f84,0_0_0_3px_rgba(46,63,132,0.2)] disabled:cursor-not-allowed disabled:opacity-60',
    'aria-[invalid=true]:shadow-[inset_0_0_0_1px_var(--color-red-600),0_0_0_3px_rgba(220,38,38,0.14)]',
    'dark:bg-white/[0.04] dark:text-neutral-100 dark:shadow-[inset_0_0_0_1px_var(--color-neutral-500)] dark:placeholder:text-neutral-400 dark:focus:shadow-[inset_0_0_0_1px_#8b9ae0,0_0_0_3px_rgba(139,154,224,0.3)]',
    'dark:aria-[invalid=true]:shadow-[inset_0_0_0_1px_var(--color-red-400),0_0_0_3px_rgba(248,113,113,0.2)]'
);
// Área de texto: la misma piel, con alto propio y texto de párrafo.
export const AREA = cn(CAMPO, 'h-auto resize-y py-2.5 leading-5 font-normal');
// El disparador del desplegable (Radix Select) con la misma piel que el campo.
export const DISPARADOR = cn(
    CAMPO,
    'gap-2 border-0 py-0 pr-2.5 pl-[11px] data-[placeholder]:font-normal data-[placeholder]:text-muted-foreground focus-visible:ring-0 focus-visible:shadow-[inset_0_0_0_1px_#2e3f84,0_0_0_3px_rgba(46,63,132,0.2)]',
    'dark:bg-white/[0.04] dark:data-[placeholder]:text-neutral-400 dark:focus-visible:shadow-[inset_0_0_0_1px_#8b9ae0,0_0_0_3px_rgba(139,154,224,0.3)]',
    '[&_svg:not([class*=text-])]:text-muted-foreground dark:[&_svg:not([class*=text-])]:text-neutral-400 [&>svg:last-child]:opacity-100',
    '[&_[data-slot=select-value]]:flex [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:items-center [&_[data-slot=select-value]]:gap-2'
);
// z-[80]: por encima de los diálogos (z-[65]) cuando el desplegable está dentro de uno.
export const MENU =
    'z-[80] max-h-[320px] rounded-xl border-0 shadow-[0_0_0_1px_rgba(46,63,132,0.12),0_12px_28px_-10px_rgba(46,63,132,0.4)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_12px_28px_-10px_rgba(0,0,0,0.7)]';
export const OPCION = 'cursor-pointer rounded-lg py-2 text-[13px] leading-[18px]';
export const ETIQUETA = cn('text-[12.5px] leading-4 font-semibold', TEXTO_NAVY);
export const AYUDA = cn('text-[12px] leading-4', TEXTO_SUAVE);
export const ERROR_CAMPO = 'text-[12px] leading-4 font-medium text-red-700 dark:text-red-400';
export const BOTON_TEXTO = cn(
    'inline-flex h-[30px] shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-[12.5px] leading-4 font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0',
    FOCO
);
export const BOTON_TEXTO_NAVY = cn(BOTON_TEXTO, TEXTO_NAVY, 'hover:bg-[#2e3f84]/7 dark:hover:bg-white/8');
export const BOTON_TEXTO_ROJO = cn(BOTON_TEXTO, 'text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10');
export const BOTON_ICONO = cn(
    'flex size-[30px] shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-[#2e3f84]/8 hover:text-[#2e3f84] disabled:cursor-not-allowed disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-white/8 dark:hover:text-neutral-100',
    FOCO
);

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

/** "2026-08-28 10:02" (o ISO) → "28 ago 2026" (es) · "Aug 28, 2026" (en). Si no encaja, tal cual. */
export function fechaDia(valor?: string | null, lng?: string) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor ?? '');
    if (!m) return valor ?? '';
    if (esIngles(lng)) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${Number(m[3])} ${MESES_CORTOS[Number(m[2]) - 1]} ${m[1]}`;
}

/** Franja de cifras con filetes entre ellas (2 a 4 cifras). En pantallas estrechas, de dos en dos. */
export function FranjaCifras({ cifras, etiqueta }: { cifras: ReactNode[]; etiqueta: string }) {
    const columnas =
        cifras.length >= 4
            ? '@5xl/pagina:grid-cols-[repeat(3,minmax(0,1fr)_1px)_minmax(0,1fr)]'
            : cifras.length === 3
              ? '@5xl/pagina:grid-cols-[repeat(2,minmax(0,1fr)_1px)_minmax(0,1fr)]'
              : '@5xl/pagina:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)]';
    return (
        <section aria-label={etiqueta} className={cn('grid grid-cols-2 gap-x-6 gap-y-5 @5xl/pagina:gap-y-0', columnas)}>
            {cifras.map((c, i) => [
                i > 0 && <div key={`d${i}`} className="hidden w-px self-stretch bg-[#2e3f84]/12 @5xl/pagina:block dark:bg-white/10" aria-hidden="true" />,
                <div key={`c${i}`} className="min-w-0">
                    {c}
                </div>,
            ])}
        </section>
    );
}

/** Estado con punto + texto del color de su significado (esmeralda = activa; pizarra = inactiva). */
export function EstadoPunto({ on, children, className, title }: { on: boolean; children: ReactNode; className?: string; title?: string }) {
    return (
        <span
            title={title}
            className={cn(
                'inline-flex items-center gap-1.5 text-[12.5px] leading-4 font-semibold whitespace-nowrap',
                on ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-neutral-300',
                className
            )}
        >
            <span className={cn('size-[7px] shrink-0 rounded-full', on ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-slate-400 dark:bg-neutral-500')} aria-hidden="true" />
            {children}
        </span>
    );
}

/**
 * Interruptor (solo la pieza visual; el <button role="switch"> lo pone quien lo usa).
 * Pista esmeralda 600 encendido (3,8:1 contra blanco) y pizarra 500 apagado (4,8:1).
 */
export function Interruptor({ on, className }: { on: boolean; className?: string }) {
    return (
        <span
            aria-hidden="true"
            className={cn(
                'relative inline-flex h-[22px] w-10 shrink-0 items-center rounded-full transition-colors',
                on ? 'bg-emerald-600 dark:bg-emerald-500' : 'bg-slate-500 dark:bg-neutral-500',
                className
            )}
        >
            <span className={cn('block size-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-transform', on ? 'translate-x-[21px]' : 'translate-x-[3px]')} />
        </span>
    );
}

/** Chip pequeño ("Entrada", "Botones", "Lista"…). */
export function Chip({ icon: Icono, children, tono = 'navy' }: { icon: LucideIcon; children: ReactNode; tono?: 'navy' | 'ok' }) {
    return (
        <span
            className={cn(
                'inline-flex h-[22px] shrink-0 items-center gap-[5px] rounded-md pr-2 pl-[7px] text-[12px] leading-4 font-semibold whitespace-nowrap',
                tono === 'ok'
                    ? 'bg-emerald-50 text-emerald-700 shadow-[inset_0_0_0_1px_var(--color-emerald-200)] dark:bg-emerald-500/10 dark:text-emerald-300 dark:shadow-[inset_0_0_0_1px_rgba(16,185,129,0.25)]'
                    : 'bg-[#2e3f84]/5 text-[#2e3f84] shadow-[inset_0_0_0_1px_rgba(46,63,132,0.1)] dark:bg-white/5 dark:text-neutral-100 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]'
            )}
        >
            <Icono className="size-3" strokeWidth={2.25} aria-hidden="true" />
            {children}
        </span>
    );
}

/** Fila "etiqueta · valor" del panel de detalle (dentro de un <dl>). */
export function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
    return (
        <div className={cn('grid min-h-[30px] grid-cols-[112px_minmax(0,1fr)] items-baseline gap-x-3 border-b py-1.5', FILETE)}>
            <dt className={cn('text-[12.5px] leading-[18px] font-medium', TEXTO_SUAVE)}>{etiqueta}</dt>
            <dd className={cn('min-w-0 text-[13px] leading-[18px] font-medium tabular-nums [overflow-wrap:anywhere]', TEXTO_NAVY)}>{children}</dd>
        </div>
    );
}

/* ── Burbujas de WhatsApp ── */

export interface AdjuntoVista {
    url?: string | null;
    filename: string;
    type: 'image' | 'video' | 'document';
}

const NOMBRE_SOBRE_MEDIO = cn(
    'absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate rounded-md bg-[rgba(17,27,33,0.66)] px-2 py-[3px] text-[11.5px] leading-4 font-medium text-white',
    MONO
);

/** Imagen, video o documento tal como se ve dentro del globo. */
function AdjuntoEnBurbuja({ adjunto, suelto = false }: { adjunto: AdjuntoVista; suelto?: boolean }) {
    const [fallo, setFallo] = useState(false);
    if (adjunto.type === 'image' || adjunto.type === 'video') {
        const video = adjunto.type === 'video';
        return (
            <div
                className={cn(
                    'relative flex h-28 items-center justify-center overflow-hidden rounded-[7px] bg-gradient-to-br from-[#dbe3ee] to-[#c9d4e3] text-slate-500 dark:from-[#2a3942] dark:to-[#1f2c33] dark:text-neutral-400',
                    suelto ? '' : '-mx-[5px] -mt-[3px] mb-1.5'
                )}
            >
                {video ? (
                    <span className="flex size-11 items-center justify-center rounded-full bg-[rgba(17,27,33,0.55)] text-white">
                        <Play className="size-5" strokeWidth={2} aria-hidden="true" />
                    </span>
                ) : adjunto.url && !fallo ? (
                    <img src={adjunto.url} alt="" loading="lazy" onError={() => setFallo(true)} className="absolute inset-0 size-full object-cover" />
                ) : (
                    <ImageIcon className="size-[30px]" strokeWidth={1.5} aria-hidden="true" />
                )}
                <span className={NOMBRE_SOBRE_MEDIO}>{adjunto.filename}</span>
            </div>
        );
    }
    const ext = (adjunto.filename.split('.').pop() ?? '').toUpperCase();
    return (
        <div className={cn('flex items-center gap-2.5 rounded-[7px] bg-[rgba(17,27,33,0.05)] px-2.5 py-[9px] dark:bg-white/[0.06]', suelto ? '' : '-mx-1 -mt-0.5 mb-[7px]')}>
            <span className="flex h-9 w-[30px] shrink-0 items-center justify-center rounded bg-white text-[#2e3f84] shadow-[inset_0_0_0_1px_rgba(17,27,33,0.12)] dark:bg-white/10 dark:text-neutral-100 dark:shadow-none">
                <FileText className="size-4" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <span className="flex min-w-0 flex-col gap-px">
                <span className="truncate text-[12.5px] leading-4 font-medium text-[#111b21] dark:text-[#e9edef]">{adjunto.filename}</span>
                {ext && <span className="text-[11px] leading-[14px] text-[#54656f] dark:text-[#aebac1]">{ext}</span>}
            </span>
        </div>
    );
}

const HORA = () => {
    const d = new Date();
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Mensaje que manda el asesor (globo verde a la derecha), con sus adjuntos. */
export function BurbujaSale({ texto, adjuntos = [], vacio, className, ancho = 'w-[88%]' }: { texto: string; adjuntos?: AdjuntoVista[]; vacio?: string; className?: string; ancho?: string }) {
    const [hora] = useState(HORA);
    const globo = 'rounded-[10px] bg-[#d9fdd3] px-2.5 pt-2 pb-1.5 shadow-[0_1px_1px_rgba(0,0,0,0.1)] dark:bg-[#005c4b]';
    return (
        <div className={cn('flex flex-col items-end gap-1 rounded-xl bg-[#efeae2] p-3.5 pb-4 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)] dark:bg-[#0b141a] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]', className)}>
            {adjuntos.slice(1).map((a, i) => (
                <div key={`${a.filename}-${i}`} className={cn(ancho, globo, 'pb-2')}>
                    <AdjuntoEnBurbuja adjunto={a} suelto />
                </div>
            ))}
            <div className={cn(ancho, globo, 'rounded-[10px_3px_10px_10px]')}>
                {adjuntos[0] && <AdjuntoEnBurbuja adjunto={adjuntos[0]} />}
                {texto ? (
                    <p className="text-[13.5px] leading-5 whitespace-pre-wrap text-[#111b21] [overflow-wrap:anywhere] dark:text-[#e9edef]">{texto}</p>
                ) : (
                    <p className="text-[13.5px] leading-5 text-[#54656f] italic dark:text-[#c8d3d0]">{vacio}</p>
                )}
                <span className="mt-0.5 flex items-center justify-end gap-[3px] text-[11px] leading-[14px] text-[#54656f] tabular-nums dark:text-[#c8d3d0]" aria-hidden="true">
                    {hora}
                    <Check className="size-[13px] text-[#027eb5] dark:text-[#53bdeb]" strokeWidth={2.25} />
                </span>
            </div>
        </div>
    );
}

/** Mensaje que recibe el paciente (globo blanco a la izquierda), con sus botones de WhatsApp debajo. */
export function BurbujaEntra({ texto, botones = [], vacio, className }: { texto: string; botones?: ReactNode[]; vacio?: string; className?: string }) {
    const [hora] = useState(HORA);
    return (
        <div className={cn('rounded-xl bg-[#efeae2] p-3 pb-3.5 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)] dark:bg-[#0b141a] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]', className)}>
            <div className="flex max-w-[92%] flex-col gap-0.5">
                <div className="rounded-[3px_10px_10px_10px] bg-white px-2.5 pt-2 pb-1.5 shadow-[0_1px_1px_rgba(0,0,0,0.1)] dark:bg-[#202c33]">
                    {texto ? (
                        <p className="text-[13px] leading-[19px] whitespace-pre-wrap text-[#111b21] [overflow-wrap:anywhere] dark:text-[#e9edef]">{texto}</p>
                    ) : (
                        <p className="text-[13px] leading-[19px] text-[#54656f] italic dark:text-[#aebac1]">{vacio}</p>
                    )}
                    <span className="mt-0.5 block text-right text-[11px] leading-[14px] text-[#54656f] tabular-nums dark:text-[#aebac1]" aria-hidden="true">
                        {hora}
                    </span>
                </div>
                {botones.map((b, i) => (
                    <div
                        key={i}
                        className="flex min-h-[34px] items-center justify-center gap-1.5 rounded-[10px] bg-white px-2.5 py-1 text-[13px] leading-[18px] font-medium text-[#0271a6] shadow-[0_1px_1px_rgba(0,0,0,0.1)] dark:bg-[#202c33] dark:text-[#53bdeb]"
                    >
                        {b}
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ── Diálogo (Radix): overlay navy, cabecera con icono, título y subtítulo, pie en banda. Esc = cancelar ── */

export function DialogoPlantilla({
    abierto,
    onCerrar,
    icono: Icono,
    peligro = false,
    titulo,
    sub,
    cerrarConX = false,
    ancho = 'max-w-[480px]',
    children,
    pie,
    izquierda,
    enfoqueInicial,
}: {
    abierto: boolean;
    onCerrar: () => void;
    icono: LucideIcon;
    peligro?: boolean;
    titulo: string;
    sub?: ReactNode;
    cerrarConX?: boolean;
    ancho?: string;
    children?: ReactNode;
    pie: ReactNode;
    izquierda?: ReactNode;
    enfoqueInicial?: RefObject<HTMLElement | null>;
}) {
    const { t } = useTranslation();
    return (
        <DialogPrimitive.Root open={abierto} onOpenChange={(open) => !open && onCerrar()}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-[65] bg-[#2e3f84]/28 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none dark:bg-black/55" />
                <DialogPrimitive.Content
                    onOpenAutoFocus={(event) => {
                        // Con enfoqueInicial (p. ej. la opción segura de un diálogo de eliminar), ese; si no,
                        // el primer campo de texto del formulario (y no la X de cerrar).
                        const destino =
                            enfoqueInicial?.current ??
                            (event.currentTarget as HTMLElement | null)?.querySelector<HTMLElement>('input[type="text"], input:not([type]), textarea');
                        if (destino) {
                            event.preventDefault();
                            destino.focus();
                        }
                    }}
                    {...(sub ? {} : { 'aria-describedby': undefined })}
                    className={cn(
                        'fixed top-1/2 left-1/2 z-[65] flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-card shadow-[0_0_0_1px_rgba(46,63,132,0.1),0_6px_14px_rgba(46,63,132,0.1),0_30px_60px_-20px_rgba(46,63,132,0.55)] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 motion-reduce:animate-none dark:shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_30px_60px_-20px_rgba(0,0,0,0.8)]',
                        ancho
                    )}
                >
                    <div className="flex items-center gap-3.5 px-5 pt-5 sm:px-6">
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
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <DialogPrimitive.Title className={cn('text-[16.5px] leading-[22px] font-semibold tracking-[-0.01em] [overflow-wrap:anywhere]', TEXTO_NAVY)}>{titulo}</DialogPrimitive.Title>
                            {sub && <DialogPrimitive.Description className={cn('text-[12.5px] leading-4', TEXTO_SUAVE)}>{sub}</DialogPrimitive.Description>}
                        </div>
                        {cerrarConX && (
                            <DialogPrimitive.Close asChild>
                                <button type="button" aria-label={t('common.close')} title={t('common.close')} className={BOTON_ICONO}>
                                    <X className="size-4" strokeWidth={2} aria-hidden="true" />
                                </button>
                            </DialogPrimitive.Close>
                        )}
                    </div>
                    <div className="custom-scrollbar flex min-h-0 flex-col gap-3.5 overflow-y-auto px-5 pt-4 pb-5 sm:px-6">{children}</div>
                    <div className={cn('flex flex-wrap items-center gap-2 border-t px-5 py-3.5 sm:px-6', izquierda ? 'justify-between' : 'justify-end', BANDA, FILETE)}>
                        {izquierda}
                        <div className="flex flex-wrap items-center justify-end gap-2">{pie}</div>
                    </div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}

/** Tarjeta "qué se borra" dentro de un diálogo de eliminar. */
export function QueSeBorra({ nombre, detalle }: { nombre: string; detalle: ReactNode }) {
    return (
        <div className="flex flex-col gap-0.5 rounded-[10px] bg-[#2e3f84]/[0.04] px-3 py-2.5 shadow-[inset_0_0_0_1px_rgba(46,63,132,0.1)] dark:bg-white/[0.04] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]">
            <span className={cn('truncate text-[13.5px] leading-[18px] font-semibold', TEXTO_NAVY)} title={nombre}>
                {nombre}
            </span>
            <span className={cn('text-[12.5px] leading-4 tabular-nums', TEXTO_SUAVE)}>{detalle}</span>
        </div>
    );
}
