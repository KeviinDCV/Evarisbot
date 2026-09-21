import { FOCO, TEXTO_NAVY, nombrePropio } from '@/components/appointments/piezas-citas';
import { cn } from '@/lib/utils';
import { Bot, Download, FileSpreadsheet, FileText, Info, Paperclip, Reply, Users, X, type LucideIcon } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes, type MouseEvent, type ReactNode, type TouchEvent } from 'react';

/* ── Piezas del chat (Chat interno; pensadas para heredarse en Conversaciones) ─────────────────────
   Lenguaje de design/vista-chat-interno/gen_chat.mjs: navy #2e3f84 con alfa sobre blanco; en oscuro,
   blanco con alfa sobre bg-card. Lo propio va en navy suave (#e5e9f6); lo ajeno, blanco con filete.
   Solo presentación: ninguna pieza hace llamadas ni guarda estado de la conversación. */

// Tinta de los mensajes (#1c2238 sobre #e5e9f6: 13,1:1) y gris de horas/ayudas (#5c6485: 4,75:1 sobre
// la burbuja propia, 5,3:1 sobre el fondo del chat). En oscuro: neutral-100 / neutral-300-400.
export const TINTA = 'text-[#1c2238] dark:text-neutral-100';
export const GRIS = 'text-[#5c6485] dark:text-neutral-400';
// Nombres, menciones y acentos navy: en oscuro, un lavanda claro (> 7:1 sobre neutral-800).
export const ACENTO = 'text-[#2e3f84] dark:text-[#b4bff0]';
export const FILETE_CHAT = 'border-[#2e3f84]/8 dark:border-white/8';
export const FONDO_CHAT = 'bg-[#f4f5f9] dark:bg-background';
export const HOJA_CHAT = 'bg-white dark:bg-card';
export const SOMBRA_FLOTA =
    'shadow-[0_0_0_1px_rgba(46,63,132,0.1),0_4px_10px_rgba(46,63,132,0.1),0_16px_32px_-12px_rgba(46,63,132,0.35)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_16px_32px_-12px_rgba(0,0,0,0.75)]';
export const SOMBRA_PANEL =
    'shadow-[0_0_0_1px_rgba(46,63,132,0.1),0_6px_14px_rgba(46,63,132,0.1),0_30px_60px_-20px_rgba(46,63,132,0.55)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_30px_60px_-20px_rgba(0,0,0,0.8)]';

/** Botón de icono cuadrado (28-36 px) con el foco visible del resto de la app. */
export const BOTON_ICONO_CHAT = cn(
    'flex shrink-0 cursor-pointer items-center justify-center rounded-[9px] text-[#5c6485] transition-colors hover:bg-[#2e3f84]/8 hover:text-[#2e3f84] disabled:cursor-not-allowed disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-white/8 dark:hover:text-neutral-100',
    FOCO
);

/**
 * Nombre de una persona para PINTARLO: si viene todo en mayúsculas ("ANDREA CAROLINA MUÑOZ PAZ"),
 * como nombre propio; si ya trae minúsculas ("IA - Prueba", "Sofía Quintero"), tal cual. El dato no cambia.
 */
export function nombreVisible(nombre?: string | null) {
    const n = (nombre ?? '').trim();
    if (!n || /\p{Ll}/u.test(n)) return n;
    return nombrePropio(n);
}

/** Primer nombre para las vistas previas y «Visto por…» (el completo va en el title). */
export const nombreCorto = (nombre?: string | null) => nombreVisible(nombre).split(/\s+/)[0] ?? '';

export function iniciales(nombre: string) {
    return [...nombreVisible(nombre)]
        .filter((_, i, arr) => i === 0 || arr[i - 1] === ' ')
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

/** "A, B y C" (es) · "A, B and C" (en). */
export function listaNombres(xs: string[], y: string) {
    return xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')}${y}${xs[xs.length - 1]}`;
}

/* ── Avatares ── */

/** Persona = círculo de iniciales; bot (rol «ai») = cuadro cielo con el robot. Punto verde si está en línea. */
export function AvatarPersona({
    nombre,
    rol,
    enLinea = false,
    tam = 36,
    anillo = 'ring-white dark:ring-card',
    className,
}: {
    nombre: string;
    rol?: string;
    enLinea?: boolean;
    tam?: number;
    /** Color del anillo del punto de «en línea»: el del fondo sobre el que va el avatar. */
    anillo?: string;
    className?: string;
}) {
    const bot = rol === 'ai';
    const punto = tam >= 34 ? 11 : 9;
    return (
        <span title={nombreVisible(nombre)} className={cn('relative flex shrink-0', className)} style={{ width: tam, height: tam }}>
            {bot ? (
                <span
                    className="flex size-full items-center justify-center bg-sky-50 text-sky-700 shadow-[inset_0_0_0_1px_var(--color-sky-200)] dark:bg-sky-500/10 dark:text-sky-300 dark:shadow-[inset_0_0_0_1px_rgba(56,189,248,0.3)]"
                    style={{ borderRadius: Math.round(tam * 0.3) }}
                >
                    <Bot style={{ width: Math.round(tam * 0.5), height: Math.round(tam * 0.5) }} strokeWidth={1.9} aria-hidden="true" />
                </span>
            ) : (
                <span
                    className={cn(
                        'flex size-full items-center justify-center rounded-full font-semibold tracking-[0.02em] text-white',
                        rol === 'admin' ? 'bg-[#2e3a75]' : 'bg-[#3e4f94]',
                        tam >= 36 ? 'text-[13px]' : 'text-[11px]'
                    )}
                    aria-hidden="true"
                >
                    {iniciales(nombre)}
                </span>
            )}
            {enLinea && (
                <span
                    className={cn('absolute -right-px -bottom-px rounded-full bg-emerald-500 ring-2', anillo)}
                    style={{ width: punto, height: punto }}
                    aria-hidden="true"
                />
            )}
        </span>
    );
}

/** Grupo = cuadro redondeado navy con el icono de personas. */
export function AvatarGrupo({ tam = 36 }: { tam?: number }) {
    return (
        <span
            className="flex shrink-0 items-center justify-center bg-[#2e3a75] text-white dark:bg-[#3b4886]"
            style={{ width: tam, height: tam, borderRadius: Math.round(tam * 0.3) }}
            aria-hidden="true"
        >
            <Users style={{ width: Math.round(tam * 0.47), height: Math.round(tam * 0.47) }} strokeWidth={1.9} />
        </span>
    );
}

/* ── Lista de chats ── */

/** Pastilla de no leídos: navy (el rojo es de los pacientes). Blanco sobre navy: 9,7:1. */
export function PildoraNoLeidos({ n, titulo }: { n: number; titulo?: string }) {
    return (
        <span
            title={titulo}
            className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#2e3f84] px-1.5 text-[11px] leading-3 font-semibold text-white tabular-nums dark:bg-[#4e5fa4]"
        >
            {n}
        </span>
    );
}

/** Fila de la lista (64 px): avatar, nombre + extra, hora y vista previa con la pastilla de no leídos. */
export function FilaChat({
    avatar,
    nombre,
    extra,
    hora,
    previa,
    noLeidos = 0,
    tituloNoLeidos,
    activo = false,
    ultima = false,
    titulo,
    datosId,
    onClick,
    onContextMenu,
}: {
    avatar: ReactNode;
    nombre: string;
    extra?: ReactNode;
    hora?: string;
    previa: ReactNode;
    noLeidos?: number;
    tituloNoLeidos?: string;
    activo?: boolean;
    /** Sin filete inferior (la última, o la de encima de la seleccionada). */
    ultima?: boolean;
    titulo?: string;
    datosId?: number;
    onClick: () => void;
    onContextMenu?: (e: MouseEvent<HTMLButtonElement>) => void;
}) {
    const fuerte = noLeidos > 0;
    return (
        <button
            type="button"
            data-chat-id={datosId}
            title={titulo}
            aria-current={activo ? 'true' : undefined}
            onClick={onClick}
            onContextMenu={onContextMenu}
            className={cn(
                'mx-2 flex h-16 shrink-0 cursor-pointer items-center gap-3 rounded-[10px] px-2.5 text-left transition-colors select-none',
                FOCO,
                activo
                    ? 'bg-[#2e3f84]/[0.065] shadow-[inset_0_0_0_1px_rgba(46,63,132,0.12)] dark:bg-white/[0.07] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]'
                    : 'hover:bg-[#2e3f84]/[0.035] dark:hover:bg-white/[0.04]'
            )}
        >
            {avatar}
            <span className={cn('flex min-w-0 flex-1 flex-col justify-center gap-[3px] self-stretch', !ultima && !activo && 'border-b', FILETE_CHAT)}>
                <span className="flex min-w-0 items-center gap-[7px]">
                    <span className={cn('min-w-0 truncate text-[13.5px] leading-[18px]', fuerte || activo ? 'font-semibold' : 'font-medium', TEXTO_NAVY)}>{nombre}</span>
                    {extra}
                    {hora && (
                        <span
                            className={cn(
                                'ml-auto shrink-0 text-[11.5px] leading-4 whitespace-nowrap tabular-nums',
                                fuerte ? cn('font-semibold', ACENTO) : cn('font-normal', GRIS)
                            )}
                        >
                            {hora}
                        </span>
                    )}
                </span>
                <span className="flex min-w-0 items-center gap-2">
                    <span className={cn('min-w-0 flex-1 truncate text-[13px] leading-[18px]', fuerte ? cn('font-medium', TINTA) : cn('font-normal', GRIS))}>{previa}</span>
                    {fuerte && <PildoraNoLeidos n={noLeidos} titulo={tituloNoLeidos} />}
                </span>
            </span>
        </button>
    );
}

/** Icono + texto en línea (vista previa «Foto», «Archivo»…). */
export function ConIcono({ icono: Icono, children }: { icono: LucideIcon; children: ReactNode }) {
    return (
        <span className="inline-flex items-center gap-1 align-[-2px]">
            <Icono className="size-3.5 shrink-0" strokeWidth={1.9} aria-hidden="true" />
            {children}
        </span>
    );
}

/** Filtros de la lista como control segmentado (cuatro opciones con su cifra). */
export function Segmentos<T extends string>({
    opciones,
    valor,
    onCambio,
    etiqueta,
}: {
    opciones: { value: T; label: string; count: number }[];
    valor: T;
    onCambio: (v: T) => void;
    etiqueta: string;
}) {
    return (
        <div role="radiogroup" aria-label={etiqueta} className="flex gap-0.5 rounded-[10px] bg-[#2e3f84]/[0.055] p-[3px] dark:bg-white/[0.06]">
            {opciones.map((o) => {
                const on = o.value === valor;
                return (
                    <button
                        key={o.value}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => onCambio(o.value)}
                        className={cn(
                            'flex h-7 min-w-0 flex-auto cursor-pointer items-center justify-center gap-1 rounded-lg px-1 text-[12px] leading-4 font-semibold whitespace-nowrap transition-colors',
                            FOCO,
                            on
                                ? 'bg-white text-[#2e3f84] shadow-[0_0_0_1px_rgba(46,63,132,0.08),0_1px_2px_rgba(46,63,132,0.12)] dark:bg-white/12 dark:text-neutral-100 dark:shadow-none'
                                : 'text-[#5c6485] hover:text-[#2e3f84] dark:text-neutral-400 dark:hover:text-neutral-100'
                        )}
                    >
                        {o.label}
                        <span className="text-[11px] tabular-nums">{o.count}</span>
                    </button>
                );
            })}
        </div>
    );
}

/* ── Hilo ── */

/** Separador de día («Hoy», «Ayer», fecha). */
export function SeparadorDia({ texto }: { texto: string }) {
    return (
        <div className="mt-2.5 mb-1 flex justify-center" role="separator" aria-label={texto}>
            <span className={cn('inline-flex h-6 items-center rounded-full bg-white px-[11px] text-[11.5px] leading-4 font-semibold whitespace-nowrap shadow-[0_0_0_1px_rgba(46,63,132,0.08)] dark:bg-card dark:shadow-[0_0_0_1px_rgba(255,255,255,0.1)]', GRIS)}>
                {texto}
            </span>
        </div>
    );
}

/** Globo de un mensaje. Propio = navy suave; ajeno = blanco con filete. `primero` pone la esquina «colita». */
export const Burbuja = forwardRef<
    HTMLDivElement,
    {
        propia: boolean;
        primero: boolean;
        children: ReactNode;
        className?: string;
        onContextMenu?: (e: MouseEvent<HTMLDivElement>) => void;
        onTouchStart?: (e: TouchEvent<HTMLDivElement>) => void;
        onTouchEnd?: () => void;
        onTouchMove?: () => void;
    }
>(function Burbuja({ propia, primero, children, className, ...eventos }, ref) {
    return (
        <div
            ref={ref}
            {...eventos}
            className={cn(
                'relative max-w-full min-w-0 rounded-xl pt-[7px] pr-2.5 pb-1.5 pl-[11px] [-webkit-touch-callout:none]',
                propia
                    ? cn('bg-[#e5e9f6] shadow-[0_1px_1px_rgba(46,63,132,0.08)] dark:bg-[#2c3766] dark:shadow-none', primero && 'rounded-tr-[4px]')
                    : cn('bg-white shadow-[0_0_0_1px_rgba(46,63,132,0.07),0_1px_2px_rgba(46,63,132,0.06)] dark:bg-neutral-800 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07)]', primero && 'rounded-tl-[4px]'),
                className
            )}
        >
            {children}
        </div>
    );
});

/** Nombre del autor dentro del globo (grupos, mensajes ajenos). */
export function NombreAutor({ nombre, etiqueta }: { nombre: string; etiqueta?: string }) {
    return (
        <span className={cn('mb-0.5 block truncate text-[12.5px] leading-[17px] font-semibold', ACENTO)}>
            {nombreVisible(nombre)}
            {etiqueta && <span className={cn('ml-1.5 text-[11px] leading-[14px] font-medium', GRIS)}>{etiqueta}</span>}
        </span>
    );
}

/** Caja citada (respuesta a otro mensaje). */
export function CajaCitada({
    autor,
    texto,
    icono: Icono,
    propia,
    titulo,
    onClick,
}: {
    autor: string;
    texto: string;
    icono?: LucideIcon;
    propia: boolean;
    titulo?: string;
    onClick?: () => void;
}) {
    return (
        <button
            type="button"
            title={titulo}
            onClick={onClick}
            className={cn(
                'mt-px mb-1.5 flex w-full max-w-full min-w-0 cursor-pointer flex-col gap-px rounded-lg px-[9px] pt-1.5 pb-[7px] text-left shadow-[inset_0_0_0_1px_rgba(46,63,132,0.08)] transition-colors dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]',
                FOCO,
                propia ? 'bg-white/60 hover:bg-white/80 dark:bg-white/[0.07] dark:hover:bg-white/10' : 'bg-[#2e3f84]/5 hover:bg-[#2e3f84]/8 dark:bg-white/[0.05] dark:hover:bg-white/[0.08]'
            )}
        >
            <span className={cn('flex min-w-0 items-center gap-[5px] text-[11.5px] leading-4 font-semibold', ACENTO)}>
                <Reply className="size-3 shrink-0" strokeWidth={2.2} aria-hidden="true" />
                <span className="truncate">{nombreVisible(autor)}</span>
            </span>
            <span className={cn('flex min-w-0 items-center gap-1 text-[12.5px] leading-[17px]', GRIS)}>
                {Icono && <Icono className="size-[13px] shrink-0" strokeWidth={1.9} aria-hidden="true" />}
                <span className="truncate">{texto}</span>
            </span>
        </button>
    );
}

const EXT_HOJA = new Set(['XLS', 'XLSX', 'CSV', 'ODS']);

/** Documento adjunto: ficha con la extensión, nombre, tipo · peso y botón de descarga. */
export function AdjuntoDocumento({
    nombre,
    tipo,
    peso,
    url,
    propia,
    textoDescargar,
}: {
    nombre: string;
    tipo: string;
    peso?: string | null;
    url: string;
    propia: boolean;
    textoDescargar: string;
}) {
    const ext = (nombre.includes('.') ? nombre.split('.').pop() ?? '' : '').toUpperCase().slice(0, 4);
    const hoja = EXT_HOJA.has(ext);
    const Icono = hoja ? FileSpreadsheet : FileText;
    return (
        <div
            className={cn(
                'mt-px mb-1.5 flex min-w-0 items-center gap-2.5 rounded-[9px] py-2 pr-2 pl-[9px] shadow-[inset_0_0_0_1px_rgba(46,63,132,0.08)] sm:min-w-[250px] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]',
                propia ? 'bg-white/60 dark:bg-white/[0.07]' : 'bg-[#f4f5f9] dark:bg-white/[0.05]'
            )}
        >
            <span
                className={cn(
                    'flex h-10 w-[34px] shrink-0 flex-col items-center justify-center gap-px rounded-md bg-white shadow-[inset_0_0_0_1px_rgba(46,63,132,0.14)] dark:bg-white/10 dark:shadow-none',
                    hoja ? 'text-emerald-700 dark:text-emerald-300' : 'text-[#2e3f84] dark:text-neutral-100'
                )}
                aria-hidden="true"
            >
                <Icono className="size-4" strokeWidth={1.75} />
                {ext && <span className="text-[11px] leading-[11px] font-semibold tracking-[-0.03em]">{ext}</span>}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-px">
                <span className={cn('truncate text-[13px] leading-[18px] font-semibold', TINTA)} title={nombre}>
                    {nombre}
                </span>
                <span className={cn('truncate text-[11.5px] leading-4 tabular-nums', GRIS)}>{peso ? `${tipo} · ${peso}` : tipo}</span>
            </span>
            <a
                href={url}
                download
                target="_blank"
                rel="noopener noreferrer"
                title={textoDescargar}
                aria-label={`${textoDescargar}: ${nombre}`}
                className={cn(BOTON_ICONO_CHAT, 'size-[30px] bg-white text-[#2e3f84] shadow-[inset_0_0_0_1px_rgba(46,63,132,0.14)] dark:bg-white/10 dark:text-neutral-100 dark:shadow-none')}
            >
                <Download className="size-4" strokeWidth={1.9} aria-hidden="true" />
            </a>
        </div>
    );
}

/** Archivo que ya no existe (perdido en la migración). */
export function ArchivoNoDisponible({ titulo, nombre }: { titulo: string; nombre: string }) {
    return (
        <div className={cn('mt-px mb-1.5 flex items-center gap-3 rounded-[9px] border border-dashed border-[#2e3f84]/25 bg-[#2e3f84]/[0.03] px-3.5 py-2.5 dark:border-white/20 dark:bg-white/[0.03]', GRIS)}>
            <FileText className="size-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span className="flex min-w-0 flex-col">
                <span className={cn('text-[13px] leading-[18px] font-medium', TINTA)}>{titulo}</span>
                <span className="truncate text-[12px] leading-4">{nombre}</span>
            </span>
        </div>
    );
}

/** Adjunto que se está subiendo (mensaje optimista). */
export function AdjuntoSubiendo({ nombre, peso, texto }: { nombre: string; peso?: string | null; texto: string }) {
    return (
        <div className="mt-px mb-1.5 flex min-w-0 items-center gap-2.5 rounded-[9px] bg-white/60 py-2 pr-3 pl-[9px] shadow-[inset_0_0_0_1px_rgba(46,63,132,0.08)] sm:min-w-[250px] dark:bg-white/[0.07] dark:shadow-none">
            <span className="flex size-[34px] shrink-0 items-center justify-center rounded-md bg-white text-[#2e3f84] dark:bg-white/10 dark:text-neutral-100" aria-hidden="true">
                <Paperclip className="size-4" strokeWidth={1.9} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-px">
                <span className={cn('truncate text-[13px] leading-[18px] font-semibold', TINTA)}>{nombre}</span>
                <span className={cn('flex items-center gap-1.5 text-[11.5px] leading-4 tabular-nums', GRIS)}>
                    <span className="size-3 shrink-0 animate-spin rounded-full border-2 border-[#2e3f84]/25 border-t-[#2e3f84] dark:border-white/25 dark:border-t-white" aria-hidden="true" />
                    {peso ? `${texto} · ${peso}` : texto}
                </span>
            </span>
        </div>
    );
}

/** Hora (+ «editado» + check de enviado) al pie del globo. */
export function MetaMensaje({ hora, editado, textoEditado, propia, textoEnviado }: { hora: string; editado?: boolean; textoEditado: string; propia: boolean; textoEnviado: string }) {
    return (
        <span className={cn('inline-flex items-center gap-[3px] text-[11px] leading-[14px] whitespace-nowrap tabular-nums', propia ? 'text-[#5c6485] dark:text-neutral-300' : GRIS)}>
            {editado && (
                <>
                    <span className="italic">{textoEditado}</span>
                    <span aria-hidden="true">·</span>
                </>
            )}
            {hora}
            {propia && (
                <svg viewBox="0 0 24 24" className="size-[13px]" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={textoEnviado}>
                    <path d="M20 6 9 17l-5-5" />
                </svg>
            )}
        </span>
    );
}

/** Chips de reacciones bajo el globo. `mia` resalta la tuya (pulsar la quita). */
export function Reacciones({
    reacciones,
    propia,
    onReaccionar,
    tituloQuitar,
}: {
    reacciones: { emoji: string; count: number; users: string[]; mine: boolean }[];
    propia: boolean;
    onReaccionar: (emoji: string) => void;
    tituloQuitar: string;
}) {
    return (
        <div className={cn('relative z-[2] -mt-[7px] flex flex-wrap gap-1', propia ? 'justify-end pr-2.5' : 'pl-2.5')}>
            {reacciones.map((r) => (
                <button
                    key={r.emoji}
                    type="button"
                    onClick={() => onReaccionar(r.emoji)}
                    title={`${r.users.map(nombreVisible).join(', ')}${r.mine ? ` · ${tituloQuitar}` : ''}`}
                    className={cn(
                        'inline-flex h-6 cursor-pointer items-center gap-1 rounded-full pr-[7px] pl-1.5 transition-transform hover:scale-105 active:scale-95',
                        FOCO,
                        r.mine
                            ? 'bg-[#e5e9f6] shadow-[0_0_0_1px_rgba(46,63,132,0.42),0_1px_2px_rgba(46,63,132,0.08)] dark:bg-[#2c3766] dark:shadow-[0_0_0_1px_rgba(180,191,240,0.5)]'
                            : 'bg-white shadow-[0_0_0_1px_rgba(46,63,132,0.14),0_1px_2px_rgba(46,63,132,0.08)] dark:bg-neutral-800 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.14)]'
                    )}
                >
                    <span className="text-[13px] leading-none">{r.emoji}</span>
                    {r.count > 1 && <span className={cn('text-[11.5px] leading-3 font-semibold tabular-nums', r.mine ? ACENTO : GRIS)}>{r.count}</span>}
                </button>
            ))}
        </div>
    );
}

/** «Visto» / «Visto por …» bajo tu mensaje. */
export function Visto({ texto, titulo, conReacciones }: { texto: string; titulo: string; conReacciones: boolean }) {
    return (
        <div title={titulo} className={cn('flex items-center justify-end gap-1.5 pr-0.5', conReacciones ? 'mt-[5px]' : 'mt-1')}>
            <svg viewBox="0 0 24 24" className={cn('size-3.5 shrink-0', ACENTO)} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 6 7 17l-5-5" />
                <path d="m22 10-7.5 7.5L13 16" />
            </svg>
            <span className={cn('text-[11.5px] leading-4 font-medium', GRIS)}>{texto}</span>
        </div>
    );
}

/* ── Compositor ── */

/** Franja sobre el compositor: «Respondiendo a…» (navy) o «Editando tu mensaje» (ámbar). */
export function FranjaCompositor({
    tipo,
    titulo,
    texto,
    icono: Icono,
    tituloCerrar,
    onCerrar,
}: {
    tipo: 'responder' | 'editar';
    titulo: string;
    texto: string;
    icono?: LucideIcon;
    tituloCerrar: string;
    onCerrar: () => void;
}) {
    const ed = tipo === 'editar';
    return (
        <div
            className={cn(
                'flex items-center gap-2.5 rounded-[10px] py-[7px] pr-1.5 pl-3',
                ed
                    ? 'bg-amber-50 shadow-[inset_0_0_0_1px_var(--color-amber-200)] dark:bg-amber-500/10 dark:shadow-[inset_0_0_0_1px_rgba(245,158,11,0.3)]'
                    : 'bg-[#2e3f84]/[0.045] shadow-[inset_0_0_0_1px_rgba(46,63,132,0.1)] dark:bg-white/[0.05] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]'
            )}
        >
            <span className={cn('flex shrink-0', ed ? 'text-amber-700 dark:text-amber-300' : ACENTO)} aria-hidden="true">
                {ed ? (
                    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z" />
                    </svg>
                ) : (
                    <Reply className="size-4" strokeWidth={2} />
                )}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-px">
                <span className={cn('truncate text-[12px] leading-4 font-semibold', ed ? 'text-amber-800 dark:text-amber-300' : ACENTO)}>{titulo}</span>
                <span className={cn('flex min-w-0 items-center gap-1 text-[12.5px] leading-[17px]', GRIS)}>
                    {Icono && <Icono className="size-[13px] shrink-0" strokeWidth={1.9} aria-hidden="true" />}
                    <span className="truncate">{texto}</span>
                </span>
            </span>
            <button type="button" onClick={onCerrar} title={tituloCerrar} aria-label={tituloCerrar} className={cn(BOTON_ICONO_CHAT, 'size-7')}>
                <X className="size-4" strokeWidth={2} aria-hidden="true" />
            </button>
        </div>
    );
}

/** Línea de ayuda de teclas bajo el compositor (se oculta en el celular). */
export function AyudaTeclas({ teclas, derecha }: { teclas: { tecla: string; que: string }[]; derecha?: string }) {
    return (
        <div className={cn('hidden min-w-0 items-center gap-3.5 overflow-hidden px-1 text-[11.5px] leading-[14px] whitespace-nowrap md:flex', GRIS)}>
            {teclas.map((k, i) => (
                <span key={k.tecla} className={cn(i >= 3 && 'hidden lg:inline')}>
                    <b className="font-semibold">{k.tecla}</b> {k.que}
                </span>
            ))}
            {derecha && <span className="ml-auto hidden xl:inline">{derecha}</span>}
        </div>
    );
}

/** Franja informativa fija bajo la cabecera (p. ej. el chat de prueba con la IA). */
export function FranjaInfo({ titulo, children }: { titulo: string; children: ReactNode }) {
    return (
        <div className="relative z-[2] flex shrink-0 items-start gap-2.5 bg-sky-50 py-[9px] pr-5 pl-4 shadow-[inset_0_-1px_0_var(--color-sky-200)] dark:bg-sky-500/10 dark:shadow-[inset_0_-1px_0_rgba(56,189,248,0.25)]">
            <Info className="mt-px size-4 shrink-0 text-sky-700 dark:text-sky-300" strokeWidth={2} aria-hidden="true" />
            <p className="text-[12.5px] leading-[18px] text-sky-900 dark:text-sky-100">
                <b className="font-semibold">{titulo}</b> {children}
            </p>
        </div>
    );
}

/** Estado vacío (sin chat elegido, sin conversaciones, sin resultados, sin mensajes). */
export function Vacio({ icono: Icono, titulo, texto, accion, className }: { icono: LucideIcon; titulo: string; texto: string; accion?: ReactNode; className?: string }) {
    return (
        <div className={cn('flex flex-col items-center justify-center gap-2.5 p-6 text-center', className)}>
            <span className={cn('flex size-12 items-center justify-center rounded-[14px] bg-[#2e3f84]/7 dark:bg-white/8', TEXTO_NAVY)} aria-hidden="true">
                <Icono className="size-[22px]" strokeWidth={1.75} />
            </span>
            <span className={cn('text-[14.5px] leading-5 font-semibold', TEXTO_NAVY)}>{titulo}</span>
            <span className={cn('max-w-[300px] text-[12.5px] leading-[18px]', GRIS)}>{texto}</span>
            {accion && <div className="mt-1">{accion}</div>}
        </div>
    );
}

/* ── Menús flotantes (clic derecho en la lista y en un mensaje) ── */

export function MenuFlotante({ x, y, ancho = 232, alto, etiqueta, children }: { x: number; y: number; ancho?: number; alto: number; etiqueta: string; children: ReactNode }) {
    // Se recoloca si no cabe a la derecha o abajo (igual que el menú de la lista de siempre).
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
    const left = vw - x < ancho ? Math.max(12, vw - ancho - 12) : x;
    const top = vh - y < alto ? Math.max(12, y - alto) : y;
    return (
        <div
            role="menu"
            aria-label={etiqueta}
            className={cn('fixed z-50 flex flex-col rounded-xl bg-white p-1.5 dark:bg-neutral-900', SOMBRA_FLOTA)}
            style={{ left, top, width: ancho }}
            onClick={(e) => e.stopPropagation()}
        >
            {children}
        </div>
    );
}

export function OpcionMenu({
    icono: Icono,
    children,
    nota,
    peligro = false,
    ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { icono: LucideIcon; nota?: string; peligro?: boolean }) {
    return (
        <button
            type="button"
            role="menuitem"
            {...props}
            className={cn(
                'flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] leading-[18px] font-medium whitespace-nowrap transition-colors',
                FOCO,
                peligro ? 'text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10' : cn(TEXTO_NAVY, 'hover:bg-[#2e3f84]/[0.055] dark:hover:bg-white/8')
            )}
        >
            <Icono className="size-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
            <span className="min-w-0 truncate">{children}</span>
            {nota && <span className={cn('ml-auto text-[11.5px] leading-4 font-normal', GRIS)}>{nota}</span>}
        </button>
    );
}

export const SeparadorMenu = () => <div className={cn('mx-1 my-[5px] h-px bg-[#2e3f84]/8 dark:bg-white/10')} role="separator" />;
