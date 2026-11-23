import { BANDA, BOTON_APAGADO, BOTON_PELIGRO_LLENO, BOTON_PRIMARIO, BOTON_SECUNDARIO, FILETE, TEXTO_NAVY, TEXTO_SUAVE } from '@/components/appointments/piezas-citas';
import { cn } from '@/lib/utils';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import axios from 'axios';
import { LoaderCircle, Moon, Pause, Send, Square, TriangleAlert, type LucideIcon } from 'lucide-react';
import { useLayoutEffect, useRef, type ReactNode } from 'react';

/* ── Piezas del PANEL de Citas (General y Oncología): bandas de sección, rótulos, avisos, la confirmación y la
   lectura de errores de axios. Vivían dentro de pages/admin/appointments/index.tsx; salieron aquí (20/11/2026) para
   que las use también la sección «Recordatorio por llamada» (recordatorio-llamada.tsx). ─────────────────────────── */

export const leerEstado = (error: unknown) => (axios.isAxiosError(error) ? error.response?.status : undefined);

// 401 (sin sesión, en JSON) y 419 (token vencido): la sesión caducó. Las acciones los reciben como error (no como
// dato) para decir eso y no «No se pudo…».
export const sesionVencida = (status?: number) => status === 401 || status === 419;
export const VALIDAR = { validateStatus: (s: number) => !sesionVencida(s) };

/* ── Piezas del panel ────────────────────────────────────────────────────────────────────────────── */

// Sangría del texto de la hoja: 20 px + 32 de la ranura del icono de sección + 12 = 64 px.
export const SANGRIA = 'px-4 @3xl/hoja:pr-5 @3xl/hoja:pl-16';

/** Una cifra de la franja: marca + etiqueta arriba, número grande y su detalle debajo. */
export function Cifra({ marca, etiqueta, valor, detalle, puntoDetalle, tonoDetalle }: { marca: ReactNode; etiqueta: string; valor: string; detalle: ReactNode; puntoDetalle?: string; tonoDetalle?: string }) {
    return (
        <div className="flex min-w-0 flex-col">
            {/* En el teléfono la etiqueta puede ir en dos líneas: «Por enviar, pasado mañana» no cabe en una. */}
            <div className="flex min-h-4 items-start gap-2">
                {marca}
                <span className="line-clamp-2 text-[12px] leading-4 font-medium text-muted-foreground @5xl/pagina:line-clamp-1">{etiqueta}</span>
            </div>
            <span className={cn('mt-[7px] text-[28px] leading-8 font-medium tracking-[-0.03em] whitespace-nowrap tabular-nums', TEXTO_NAVY)}>{valor}</span>
            <span className="mt-[5px] flex min-h-4 min-w-0 items-start gap-1.5 text-[12.5px] leading-4 text-muted-foreground tabular-nums">
                {puntoDetalle && <span className={cn('mt-[4.5px] size-[7px] shrink-0 rounded-full', puntoDetalle)} aria-hidden="true" />}
                <span className={cn('line-clamp-2 min-w-0 @5xl/pagina:line-clamp-1', tonoDetalle)}>{detalle}</span>
            </span>
        </div>
    );
}

// Filete vertical entre cifras (no un borde de tarjeta). Solo cuando la franja va en una fila.
export const Divisor = () => <div className="hidden w-px self-stretch bg-[#2e3f84]/12 @5xl/pagina:block dark:bg-white/10" aria-hidden="true" />;
export const FRANJA = 'grid grid-cols-2 gap-x-6 gap-y-5 @5xl/pagina:grid-cols-[repeat(3,minmax(0,1fr)_1px)_minmax(0,1fr)] @5xl/pagina:gap-y-0';

/** Banda de sección: icono en la ranura, título + estado, qué hace; acciones a la derecha. */
export function Banda({
    id,
    icon: Icon,
    titulo,
    estado,
    texto,
    acciones,
    className,
    accionesClassName,
}: {
    id: string;
    icon: LucideIcon;
    titulo: string;
    estado?: ReactNode;
    texto: string;
    acciones?: ReactNode;
    className?: string;
    accionesClassName?: string;
}) {
    return (
        <div
            className={cn(
                'flex flex-wrap items-center gap-x-3 gap-y-3 border-b px-4 py-3 @3xl/hoja:min-h-16 @3xl/hoja:flex-nowrap @3xl/hoja:px-5 @3xl/hoja:py-2.5',
                BANDA,
                FILETE,
                className
            )}
        >
            <span className={cn('flex w-8 shrink-0 justify-center self-start pt-px @3xl/hoja:self-center @3xl/hoja:pt-0', TEXTO_NAVY)}>
                <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <div className="flex min-w-0 flex-[1_1_16rem] flex-col gap-[3px]">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {/* tabIndex -1: tras enviar o detener, el foco vuelve aquí (el botón que abrió el diálogo ya no está o está apagado). */}
                    <h2 id={id} tabIndex={-1} className={cn('text-[15px] leading-5 font-semibold tracking-[-0.01em] text-balance focus-visible:outline-hidden', TEXTO_NAVY)}>
                        {titulo}
                    </h2>
                    {estado}
                </div>
                {/* Hasta tres líneas; si aún no cabe, el texto completo queda en el title. */}
                <p title={texto} className={cn('text-[12.5px] leading-[18px] text-pretty @3xl/hoja:line-clamp-3', TEXTO_SUAVE)}>
                    {texto}
                </p>
            </div>
            {/* En el teléfono las acciones bajan a su propia línea, alineadas con el título. */}
            {acciones && (
                <div className={cn('flex flex-wrap items-center gap-2.5 @max-3xl/hoja:basis-full @max-3xl/hoja:pl-11 @3xl/hoja:shrink-0', accionesClassName)}>{acciones}</div>
            )}
        </div>
    );
}

/** Rótulo en versalitas + apoyo ("PROGRESO DEL ENVÍO  se actualiza solo mientras la pestaña está abierta"). */
export function Rotulo({ titulo, apoyo }: { titulo: string; apoyo?: string }) {
    return (
        <div className="flex min-h-4 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <span className={cn('text-[11px] leading-4 font-semibold tracking-[0.07em] whitespace-nowrap uppercase', TEXTO_SUAVE)}>{titulo}</span>
            {apoyo && <span className={cn('text-[12px] leading-4', TEXTO_SUAVE)}>{apoyo}</span>}
        </div>
    );
}

/** Estado del envío en la banda: icono o punto + texto del color de su significado. */
export function EstadoEnvio({ tipo, texto }: { tipo: 'enviando' | 'pausa' | 'sin_avanzar' | 'espera' | 'quieto'; texto: string }) {
    if (tipo === 'espera') {
        // «Enviar todas»: de noche espera a la mañana a propósito (no es un problema, por eso no va en ámbar).
        return (
            <span className="inline-flex items-center gap-1.5 text-[12.5px] leading-4 font-semibold whitespace-nowrap text-[#2e3f84] dark:text-[#a9b6ec]">
                <Moon className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
                {texto}
            </span>
        );
    }
    if (tipo === 'enviando') {
        return (
            <span className="inline-flex items-center gap-1.5 text-[12.5px] leading-4 font-semibold whitespace-nowrap text-sky-700 dark:text-sky-300">
                <LoaderCircle className="size-3.5 animate-spin text-sky-600 motion-reduce:animate-none dark:text-sky-400" strokeWidth={2.25} aria-hidden="true" />
                {texto}
            </span>
        );
    }
    if (tipo === 'pausa' || tipo === 'sin_avanzar') {
        const Icono = tipo === 'pausa' ? Pause : TriangleAlert;
        return (
            <span className="inline-flex items-center gap-1.5 text-[12.5px] leading-4 font-semibold whitespace-nowrap text-amber-700 dark:text-amber-400">
                <Icono className="size-3.5 text-amber-600 dark:text-amber-400" strokeWidth={2.25} aria-hidden="true" />
                {texto}
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 text-[12.5px] leading-4 font-medium whitespace-nowrap text-slate-600 dark:text-neutral-300">
            <span className="size-[7px] shrink-0 rounded-full bg-slate-400 dark:bg-neutral-500" aria-hidden="true" />
            {texto}
        </span>
    );
}

/** Fila de aviso ámbar dentro de la hoja (límite por envío, envío sin avanzar, último envío cortado…). */
export function FilaAviso({ etiqueta, children }: { etiqueta?: string; children: ReactNode }) {
    return (
        <div
            className={cn(
                'flex items-start gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 @3xl/hoja:min-h-14 @3xl/hoja:items-center @3xl/hoja:px-5',
                'dark:border-amber-500/20 dark:bg-amber-500/10'
            )}
        >
            <span className="flex w-8 shrink-0 justify-center text-amber-700 dark:text-amber-400">
                <TriangleAlert className="size-[17px]" strokeWidth={2} aria-hidden="true" />
            </span>
            <p className="text-[13px] leading-[18px] text-amber-800 tabular-nums dark:text-amber-200">
                {etiqueta && <span className="font-semibold">{etiqueta} </span>}
                {children}
            </p>
        </div>
    );
}

/**
 * Confirmación (Radix Dialog): la opción segura con el foco; Esc cancela. Al cerrar, el foco vuelve al botón
 * que la abrió; si ese botón ya no existe o quedó apagado (tras enviar o detener), va al título de la sección.
 */
export function Confirmacion({
    abierto,
    onCancelar,
    onConfirmar,
    icono: Icono,
    peligro = false,
    titulo,
    children,
    textoSeguro,
    iconoSeguro: IconoSeguro,
    textoConfirmar,
    iconoConfirmar,
    confirmarDesactivado = false,
    respaldoFoco,
}: {
    abierto: boolean;
    onCancelar: () => void;
    onConfirmar: () => void;
    icono: LucideIcon;
    peligro?: boolean;
    titulo: string;
    children: ReactNode;
    textoSeguro: string;
    iconoSeguro: LucideIcon;
    textoConfirmar: string;
    iconoConfirmar?: LucideIcon;
    confirmarDesactivado?: boolean;
    respaldoFoco?: string;
}) {
    const seguro = useRef<HTMLButtonElement>(null);
    const origen = useRef<HTMLElement | null>(null);
    const IconoConfirmar = iconoConfirmar ?? (peligro ? Square : Send);

    // Antes de que Radix mueva el foco al diálogo (sus efectos corren después de este).
    useLayoutEffect(() => {
        if (abierto) origen.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }, [abierto]);

    return (
        <DialogPrimitive.Root open={abierto} onOpenChange={(open) => !open && onCancelar()}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-[65] bg-[#2e3f84]/28 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none dark:bg-black/55" />
                <DialogPrimitive.Content
                    onOpenAutoFocus={(event) => {
                        event.preventDefault();
                        seguro.current?.focus();
                    }}
                    onCloseAutoFocus={(event) => {
                        event.preventDefault();
                        const boton = origen.current;
                        if (boton?.isConnected && !(boton as HTMLButtonElement).disabled) boton.focus();
                        else if (respaldoFoco) document.getElementById(respaldoFoco)?.focus();
                    }}
                    className="fixed top-1/2 left-1/2 z-[65] w-[calc(100%-2rem)] max-w-[460px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-card shadow-[0_0_0_1px_rgba(46,63,132,0.1),0_6px_14px_rgba(46,63,132,0.1),0_30px_60px_-20px_rgba(46,63,132,0.55)] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 motion-reduce:animate-none forced-colors:border dark:shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_30px_60px_-20px_rgba(0,0,0,0.8)]"
                >
                    <div className="flex gap-3.5 px-6 pt-[22px] pb-[18px]">
                        <span
                            className={cn(
                                'flex size-[38px] shrink-0 items-center justify-center rounded-[10px]',
                                peligro
                                    ? 'bg-red-50 text-red-700 shadow-[inset_0_0_0_1px_var(--color-red-200)] dark:bg-red-500/10 dark:text-red-300 dark:shadow-none'
                                    : 'bg-[#2e3f84]/8 text-[#2e3f84] dark:bg-white/8 dark:text-neutral-100'
                            )}
                        >
                            <Icono className="size-[17px]" strokeWidth={2.25} aria-hidden="true" />
                        </span>
                        <div className="flex min-w-0 flex-col gap-2">
                            <DialogPrimitive.Title className={cn('text-[16.5px] leading-[22px] font-semibold tracking-[-0.01em] tabular-nums', TEXTO_NAVY)}>
                                {titulo}
                            </DialogPrimitive.Title>
                            <DialogPrimitive.Description asChild>
                                <div className="flex flex-col gap-2 text-[13.5px] leading-5 text-muted-foreground tabular-nums dark:text-neutral-400">{children}</div>
                            </DialogPrimitive.Description>
                        </div>
                    </div>
                    {/* En el teléfono los dos botones van a lo ancho: la acción arriba y la opción segura debajo. */}
                    <div className={cn('flex flex-col-reverse gap-2 border-t px-6 py-3.5 sm:flex-row sm:justify-end', BANDA, FILETE)}>
                        <DialogPrimitive.Close asChild>
                            <button ref={seguro} type="button" className={cn(BOTON_SECUNDARIO, 'w-full sm:w-auto')}>
                                <IconoSeguro strokeWidth={1.9} aria-hidden="true" />
                                {textoSeguro}
                            </button>
                        </DialogPrimitive.Close>
                        <button
                            type="button"
                            onClick={onConfirmar}
                            disabled={confirmarDesactivado}
                            className={cn(confirmarDesactivado ? BOTON_APAGADO : peligro ? BOTON_PELIGRO_LLENO : BOTON_PRIMARIO, 'w-full sm:w-auto')}
                        >
                            {confirmarDesactivado ? (
                                <LoaderCircle className="animate-spin motion-reduce:animate-none" strokeWidth={2} aria-hidden="true" />
                            ) : (
                                <IconoConfirmar strokeWidth={2} aria-hidden="true" />
                            )}
                            {textoConfirmar}
                        </button>
                    </div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}
