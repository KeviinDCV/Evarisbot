import { Head, router, usePage } from '@inertiajs/react';
import AdminLayout from '@/layouts/admin-layout';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AvisoCampo } from '@/components/avisos-campo';
import { cn } from '@/lib/utils';
import { iniciales, nombrePropio } from '@/lib/nombres';
import { plano } from '@/lib/texto';
import {
    AudioLines,
    BadgeCheck,
    Building2,
    CalendarDays,
    Check,
    CircleAlert,
    CircleCheck,
    Hourglass,
    KeyRound,
    Loader2,
    Lock,
    MessageCircle,
    Phone,
    Pencil,
    PlugZap,
    Plus,
    Search,
    ShieldCheck,
    Trash2,
    Users,
    Webhook,
    X,
    type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { toast } from '@/lib/toast';
import { duracionLegible, MINUTOS_POR_UNIDAD, unidadExacta, type UnidadDuracion } from '@/lib/duracion';
import axios from 'axios';

/** Lo que llega de un secreto: solo si está guardado y cuándo cambió (nunca ni un carácter). */
interface ClaveGuardada {
    guardada: boolean;
    cambiada_en: string | null;
}

interface PerfilWhatsApp {
    nombre: string | null;
    numero: string | null;
    calidad: string | null;
    limite: string | null;
    consultado_en: string;
}

interface Settings {
    whatsapp: {
        configurada: boolean;
        clave_acceso: ClaveGuardada;
        clave_verificacion: ClaveGuardada;
        firma: 'sin_activar' | 'observar' | 'exigida';
        phone_id: string | null;
        phone_number_id: string | null;
        business_account_id: string | null;
        webhook_url: string;
        perfil: PerfilWhatsApp | null;
    };
    groq: {
        clave: ClaveGuardada;
    };
    vigilancia: {
        revisado_en: string | null;
        meta_ok_en: string | null;
    };
}

interface Advisor {
    id: number;
    name: string;
    email: string;
    is_on_duty: boolean;
    equipo_id?: number | null;
}

/** Equipo aparte de la línea general (Teleconsulta…): ver app/Models/Equipo.php. */
interface EquipoAjuste {
    id: number;
    nombre: string;
    miembros: number[];
    chats_abiertos: number;
}

interface AutoReleaseConfig {
    enabled: boolean;
    minutes: number;
    min: number;
    max: number;
}

interface WeekendNoticeConfig {
    enabled: boolean;
    text: string;
    default_text: string;
    max_length: number;
}

interface SettingsIndexProps {
    settings: Settings;
    advisors: Advisor[];
    equipos?: EquipoAjuste[];
    autoRelease: AutoReleaseConfig;
    weekendNotice: WeekendNoticeConfig;
}

type ResultadoMeta = 'ok' | 'sin_config' | 'rechazada' | 'error_meta' | 'desviado' | 'sin_respuesta';
type ResultadoGroq = 'ok' | 'rechazada' | 'sin_clave' | 'sin_respuesta';

/** Respuesta de «Comprobar ahora»: alertas como código => texto (o [] si no hay). */
interface ComprobacionWhatsApp {
    meta: ResultadoMeta;
    alertas: Record<string, string> | [];
    perfil: PerfilWhatsApp | null;
    revisado_en: string | null;
    meta_ok_en: string | null;
}

/**
 * Vista previa al estilo WhatsApp: *negrita*, _cursiva_ y ~tachado~, sin interpretar HTML.
 * Como en WhatsApp, la marca no aplica si hay un espacio justo después de abrir o antes de cerrar.
 */
const FORMATO_WHATSAPP = /([*_~])(?=\S)([^\n]*?\S)\1/g;
function TextoWhatsApp({ texto }: { texto: string }) {
    const partes: ReactNode[] = [];
    let ultimo = 0;
    for (const m of texto.matchAll(FORMATO_WHATSAPP)) {
        const inicio = m.index ?? 0;
        if (inicio > ultimo) partes.push(<span key={`t${inicio}`}>{texto.slice(ultimo, inicio)}</span>);
        const contenido = m[2];
        partes.push(
            m[1] === '*' ? <strong key={inicio}>{contenido}</strong> : m[1] === '_' ? <em key={inicio}>{contenido}</em> : <s key={inicio}>{contenido}</s>
        );
        ultimo = inicio + m[0].length;
    }
    if (ultimo < texto.length) partes.push(<span key="fin">{texto.slice(ultimo)}</span>);
    return <>{partes}</>;
}

// Tiempos frecuentes de la liberación automática (minutos).
const TIEMPOS_FRECUENTES = [5, 15, 30, 60, 120, 180, 300, 1440, 2880];

// Alertas de la vigilancia que ya resume el estado de WhatsApp (clave, configuración, desvío).
const esAlertaDeConexion = (codigo: string) =>
    codigo === 'meta_config' || codigo === 'meta_token' || codigo === 'meta_error' || codigo === 'meta_override' || codigo.startsWith('meta_webhook_');
const esDesvio = (codigo: string) => codigo === 'meta_override' || codigo.startsWith('meta_webhook_');

// La vigilancia corre cada 10 minutos mientras se usa la app; sus alertas caducan a los 30.
const REVISION_RECIENTE_MS = 30 * 60 * 1000;

/** La más reciente de dos marcas ISO (la de la página o la de la última comprobación a mano). */
const masReciente = (a: string | null, b: string | null) => (!a ? b : !b ? a : Date.parse(a) >= Date.parse(b) ? a : b);

/* ── Tintas de la vista (design/vista-configuracion/gen_config.mjs) ────────────────────────────────
   Mismo lenguaje que Usuarios: navy #2e3f84 con alfa sobre la hoja blanca; en oscuro, blanco con alfa
   sobre bg-card. */
const FILETE = 'border-[#2e3f84]/8 dark:border-white/8';
const TEXTO_NAVY = 'text-[#2e3f84] dark:text-neutral-100';
// Ayudas y notas: en oscuro el muted-foreground no llega a 4,5:1 sobre la banda tintada (4,45:1),
// así que sube a neutral-400 (5,85:1). En claro, #5c6485 da 5,7:1 sobre la banda y 5,9:1 sobre la hoja.
const TEXTO_SUAVE = 'text-muted-foreground dark:text-neutral-400';
// outline-hidden (no outline-none): con el contraste alto de Windows el contorno sí se ve.
const FOCO = 'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#2e3f84]/40 dark:focus-visible:ring-[#8b9ae0]/60';
// Monoespaciada del diseño (Cascadia Mono en Windows 11; Consolas si no está).
const MONO = "[font-family:ui-monospace,'Cascadia_Mono','SF_Mono',Consolas,monospace]";
const BANDA = 'bg-[#2e3f84]/[0.028] dark:bg-white/[0.03]';

// Rejilla de las filas de ajuste: etiqueta + ayuda a la izquierda, campo a la derecha. En hojas
// estrechas (< 768 px) se apilan. El texto arranca a 64 px (20 de sangría + 32 de la ranura del
// icono de sección + 12), como en el diseño.
const REJILLA = '@3xl/hoja:grid-cols-[220px_minmax(0,1fr)] @3xl/hoja:gap-x-8 @5xl/hoja:grid-cols-[300px_minmax(0,1fr)]';
const SANGRIA = 'px-4 @3xl/hoja:pr-5 @3xl/hoja:pl-16';

/* ── Fechas ─────────────────────────────────────────────────────────────────────────────────────── */

const localeDe = (idioma: string) => (idioma.startsWith('en') ? 'en-US' : 'es-CO');

/** "15/10/2026, 9:05 a. m." en hora de Colombia (el servidor guarda en UTC). */
function fechaCorta(iso: string, idioma: string) {
    return new Intl.DateTimeFormat(localeDe(idioma), {
        timeZone: 'America/Bogota',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(new Date(iso));
}

/** "hace 5 minutos", "hace 2 horas", "ayer"… */
function haceCuanto(iso: string, idioma: string, ahora: number) {
    const rtf = new Intl.RelativeTimeFormat(localeDe(idioma), { numeric: 'auto' });
    const segundos = Math.round((new Date(iso).getTime() - ahora) / 1000);
    const abs = Math.abs(segundos);
    if (abs < 45) return rtf.format(0, 'second');
    if (abs < 3600) return rtf.format(Math.round(segundos / 60), 'minute');
    if (abs < 86400) return rtf.format(Math.round(segundos / 3600), 'hour');
    return rtf.format(Math.round(segundos / 86400), 'day');
}

/* ── Piezas ─────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Semáforo de estados. ok: esmeralda 700 (5,0:1 sobre la banda). aviso (falta algo para funcionar):
 * ámbar 700 (4,8:1). neutro (apagado a propósito): pizarra 600, como «Desconectado» en Usuarios.
 * error (algo está mal ahora): rojo 700.
 */
type Tono = 'ok' | 'aviso' | 'neutro' | 'error';

const TONO_TEXTO: Record<Tono, string> = {
    ok: 'text-emerald-700 dark:text-emerald-400',
    aviso: 'text-amber-700 dark:text-amber-400',
    neutro: 'text-slate-600 dark:text-neutral-300',
    error: 'text-red-700 dark:text-red-400',
};

const TONO_PUNTO: Record<Tono, string> = {
    ok: 'bg-emerald-600 dark:bg-emerald-500',
    aviso: 'bg-amber-700 dark:bg-amber-400',
    neutro: 'bg-slate-500 dark:bg-neutral-500',
    error: 'bg-red-600 dark:bg-red-400',
};

/** Estado en línea: punto + palabra. */
function Estado({ tono, children }: { tono: Tono; children: ReactNode }) {
    return (
        <span className={cn('inline-flex items-center gap-1.5 text-[12.5px] leading-4 font-medium whitespace-nowrap', TONO_TEXTO[tono])}>
            <span className={cn('size-[7px] shrink-0 rounded-full', TONO_PUNTO[tono])} aria-hidden="true" />
            {children}
        </span>
    );
}

/** Avatar de iniciales en tinta navy (los asesores). */
function Iniciales({ name, className }: { name: string; className?: string }) {
    return (
        <span
            className={cn(
                'flex shrink-0 items-center justify-center rounded-full bg-[#2e3f84]/10 text-[11px] leading-none font-semibold tracking-[0.02em] text-[#2e3f84] shadow-[inset_0_0_0_1px_rgba(46,63,132,0.06)] dark:bg-white/8 dark:text-neutral-200 dark:shadow-none',
                className
            )}
            aria-hidden="true"
        >
            {iniciales(name)}
        </span>
    );
}

/** Un estado de la franja: marca + etiqueta arriba; punto, valor grande y detalle debajo. */
function EstadoFranja({ icon: Icon, etiqueta, tono, children }: { icon: LucideIcon; etiqueta: string; tono: Tono; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex h-4 items-center gap-2">
                <Icon className={cn('size-3.5 shrink-0', TEXTO_NAVY)} strokeWidth={2} aria-hidden="true" />
                <span className="truncate text-[12px] leading-4 font-medium text-muted-foreground">{etiqueta}</span>
            </div>
            <div className="flex h-[34px] min-w-0 items-center gap-2.5">
                <span className={cn('size-[9px] shrink-0 rounded-full', TONO_PUNTO[tono])} aria-hidden="true" />
                {children}
            </div>
        </div>
    );
}

const ValorFranja = ({ children }: { children: ReactNode }) => (
    <span className={cn('text-[24px] leading-[34px] font-medium tracking-[-0.025em] whitespace-nowrap tabular-nums', TEXTO_NAVY)}>{children}</span>
);
const DetalleFranja = ({ children, className }: { children: ReactNode; className?: string }) => (
    <span className={cn('mt-[5px] min-w-0 truncate text-[13px] leading-4 text-muted-foreground tabular-nums', className)}>{children}</span>
);

// Filete vertical entre estados (no un borde de tarjeta). Solo cuando la franja va en una fila.
const Divisor = () => <div className="hidden w-px self-stretch bg-[#2e3f84]/12 @5xl/pagina:block dark:bg-white/10" aria-hidden="true" />;

/** Banda de sección: icono en la ranura, título + estado, qué hace; acciones a la derecha. */
function Banda({
    id,
    icon: Icon,
    titulo,
    estado,
    texto,
    acciones,
}: {
    id: string;
    icon: LucideIcon;
    titulo: string;
    estado: ReactNode;
    texto: string;
    acciones?: ReactNode;
}) {
    return (
        <div
            className={cn(
                'flex flex-wrap items-center gap-x-3 gap-y-3 border-b px-4 py-3 @3xl/hoja:min-h-16 @3xl/hoja:flex-nowrap @3xl/hoja:px-5 @3xl/hoja:py-2.5',
                BANDA,
                FILETE
            )}
        >
            <span className={cn('flex w-8 shrink-0 justify-center self-start pt-px @3xl/hoja:self-center @3xl/hoja:pt-0', TEXTO_NAVY)}>
                <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <div className="flex min-w-0 flex-[1_1_16rem] flex-col gap-[3px]">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h2 id={id} className={cn('text-[15px] leading-5 font-semibold tracking-[-0.01em]', TEXTO_NAVY)}>
                        {titulo}
                    </h2>
                    {estado}
                </div>
                {/* Hasta dos líneas; si aún no cabe, el texto completo queda en el title. */}
                <p title={texto} className={cn('text-[12.5px] leading-4 @3xl/hoja:line-clamp-2', TEXTO_SUAVE)}>
                    {texto}
                </p>
            </div>
            {/* En el teléfono las acciones bajan a su propia línea, alineadas con el título. */}
            {acciones && <div className="flex flex-wrap items-center gap-2 @max-3xl/hoja:basis-full @max-3xl/hoja:pl-11 @3xl/hoja:shrink-0">{acciones}</div>}
        </div>
    );
}

/** Subtítulo de grupo dentro de una sección ("Claves" / "Identificadores"). */
function Subgrupo({ titulo, texto }: { titulo: string; texto: string }) {
    return (
        <div className={cn('flex min-h-10 flex-wrap items-end gap-x-2.5 gap-y-0.5 pt-4 pb-2', SANGRIA)}>
            <h3 className={cn('text-[11px] leading-4 font-semibold tracking-[0.07em] uppercase', TEXTO_SUAVE)}>{titulo}</h3>
            <p className={cn('text-[12px] leading-4', TEXTO_SUAVE)}>{texto}</p>
        </div>
    );
}

/** Fila de ajuste: a la izquierda qué es y qué acepta; a la derecha el campo (o el dato). */
function Fila({
    etiqueta,
    htmlFor,
    ayuda,
    ayudaId,
    children,
    abajo = 'pb-4 @3xl/hoja:pb-[15px]',
}: {
    etiqueta: string;
    htmlFor?: string;
    ayuda: string;
    ayudaId?: string;
    children: ReactNode;
    abajo?: string;
}) {
    const claseEtiqueta = cn('text-[13.5px] leading-[18px] font-semibold tracking-[-0.003em]', TEXTO_NAVY);

    return (
        <div className={cn('grid grid-cols-1 gap-y-2.5 border-b pt-4', REJILLA, SANGRIA, FILETE, abajo)}>
            <div className="flex min-w-0 flex-col gap-[3px]">
                {htmlFor ? (
                    <label htmlFor={htmlFor} className={cn(claseEtiqueta, 'w-fit cursor-pointer')}>
                        {etiqueta}
                    </label>
                ) : (
                    <span className={claseEtiqueta}>{etiqueta}</span>
                )}
                <span id={ayudaId} className={cn('text-[12px] leading-[17px] whitespace-pre-line', TEXTO_SUAVE)}>
                    {ayuda}
                </span>
            </div>
            <div className="min-w-0">{children}</div>
        </div>
    );
}

/**
 * Dato de solo lectura: caja tintada con su icono, el valor y un candado. Las claves y los
 * identificadores de WhatsApp y Groq ya no se cambian desde la web (incidente oct 2026).
 */
function CajaSoloLectura({ icon: Icon, children, corto = false, etiquetaCandado }: { icon: LucideIcon; children: ReactNode; corto?: boolean; etiquetaCandado: string }) {
    return (
        <div
            className={cn(
                'flex min-h-[38px] w-full items-center gap-2.5 rounded-[9px] bg-[#2e3f84]/[0.035] px-3 py-2.5 dark:bg-white/5',
                corto ? 'max-w-[300px]' : 'max-w-[440px]'
            )}
        >
            <Icon className="size-[15px] shrink-0 text-muted-foreground dark:text-neutral-400" strokeWidth={1.75} aria-hidden="true" />
            <span className="min-w-0 flex-1 text-[13px] leading-[18px] [overflow-wrap:anywhere]">{children}</span>
            <span title={etiquetaCandado} className="flex shrink-0 text-muted-foreground dark:text-neutral-400">
                <Lock className="size-[13px]" strokeWidth={2} aria-hidden="true" />
                <span className="sr-only">{etiquetaCandado}</span>
            </span>
        </div>
    );
}

/** Una línea de resultado (comprobaciones): icono + texto, en el color de su tono. */
function Mensaje({ tono, children }: { tono: Tono; children: ReactNode }) {
    const Icono = tono === 'ok' ? CircleCheck : CircleAlert;

    return (
        <p className={cn('flex items-start gap-2 text-[13px] leading-[18px] font-medium', TONO_TEXTO[tono])}>
            <Icono className="mt-px size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            <span className="min-w-0 [overflow-wrap:anywhere]">{children}</span>
        </p>
    );
}

/**
 * Pista del interruptor, igual que el de envío masivo en Usuarios. Encendido: pista navy y bolita
 * blanca con la marca. Apagado: contorno y bolita pizarra 500 (4,76:1): se distingue sin color.
 */
function PistaInterruptor({ activo }: { activo: boolean }) {
    return (
        <span
            className={cn(
                'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 forced-colors:border forced-colors:border-[CanvasText]',
                activo
                    ? 'bg-[#2e3f84] shadow-[inset_0_1px_1px_rgba(0,0,0,0.2)] dark:bg-[#596bcf]'
                    : 'bg-card shadow-[inset_0_0_0_1.5px_var(--color-slate-500)] dark:shadow-[inset_0_0_0_1.5px_var(--color-neutral-400)]'
            )}
            aria-hidden="true"
        >
            <span
                className={cn(
                    'absolute flex items-center justify-center rounded-full transition-all duration-200',
                    activo
                        ? 'top-0.5 left-[18px] size-4 bg-white text-[#2e3f84] shadow-[0_1px_2px_rgba(0,0,0,0.28)]'
                        : 'top-[5px] left-[5px] size-2.5 bg-slate-500 dark:bg-neutral-400'
                )}
            >
                {activo && <Check className="size-2.5" strokeWidth={3.5} />}
            </span>
        </span>
    );
}

function Interruptor({
    id,
    activo,
    onToggle,
    describedBy,
    si,
    no,
}: {
    id: string;
    activo: boolean;
    onToggle: () => void;
    describedBy: string;
    si: string;
    no: string;
}) {
    return (
        <button
            id={id}
            type="button"
            role="switch"
            aria-checked={activo}
            aria-describedby={describedBy}
            onClick={onToggle}
            className={cn('inline-flex cursor-pointer items-center gap-2.5 rounded-full py-1 pr-1', FOCO)}
        >
            <PistaInterruptor activo={activo} />
            <span className={cn('text-[13px] leading-[18px] font-semibold', TEXTO_NAVY)}>{activo ? si : no}</span>
        </button>
    );
}

const describir = (...ids: (string | false | null | undefined)[]) => ids.filter(Boolean).join(' ') || undefined;

/**
 * Pie de sección: botón + nota. En secciones de campos se alinea con la columna de los campos.
 * `pendiente` avisa, en ámbar, de que hay cambios sin guardar; `aviso` reemplaza la nota.
 */
function Pie({
    children,
    nota,
    aviso,
    pendiente,
    columna = true,
    final = false,
}: {
    children?: ReactNode;
    nota?: string;
    aviso?: string;
    pendiente?: string | false;
    columna?: boolean;
    final?: boolean;
}) {
    return (
        <div
            className={cn(
                'grid grid-cols-1 py-4 @3xl/hoja:min-h-[68px] @3xl/hoja:items-center @3xl/hoja:py-3',
                columna && REJILLA,
                SANGRIA,
                !final && cn('border-b', FILETE)
            )}
        >
            {columna && <span className="hidden @3xl/hoja:block" aria-hidden="true" />}
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
                {children}
                {pendiente && (
                    <span className={cn('inline-flex items-center gap-1.5 text-[12px] leading-4 font-medium', TONO_TEXTO.aviso)}>
                        <span className={cn('size-[7px] shrink-0 rounded-full', TONO_PUNTO.aviso)} aria-hidden="true" />
                        {pendiente}
                    </span>
                )}
                {aviso ? (
                    <span className={cn('text-[12px] leading-4 font-medium', TONO_TEXTO.aviso)}>{aviso}</span>
                ) : (
                    nota && <span className={cn('text-[12px] leading-4', TEXTO_SUAVE)}>{nota}</span>
                )}
            </div>
        </div>
    );
}

// Sin FOCO: así vale el contorno global de foco (app.css). El anillo de FOCO es una sombra y
// .settings-btn-primary, sin capa, la pisaba: tabulando hasta «Guardar» no se veía nada.
const BOTON_PRIMARIO = 'h-9 gap-2 rounded-[10px] pr-4 pl-3.5 text-[13px] leading-[18px] font-semibold has-[>svg]:pr-4 has-[>svg]:pl-3.5';

// Desactivado "de verdad" (sin cambios que guardar): tinta navy, sin relleno sólido.
const BOTON_APAGADO =
    'bg-[#2e3f84]/6 text-muted-foreground shadow-[inset_0_0_0_1px_rgba(46,63,132,0.1)] hover:bg-[#2e3f84]/6 disabled:opacity-100 dark:bg-white/5 dark:text-neutral-400 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]';

const BOTON_SECUNDARIO = cn(
    'inline-flex h-8 shrink-0 cursor-pointer items-center gap-[7px] rounded-[9px] bg-white pr-3 pl-2.5 text-[12.5px] leading-4 font-semibold whitespace-nowrap text-[#2e3f84] shadow-[inset_0_0_0_1px_rgba(46,63,132,0.16),0_1px_2px_rgba(46,63,132,0.08)] transition-colors hover:bg-[#f6f7fb] disabled:cursor-default disabled:opacity-60',
    'dark:bg-white/5 dark:text-neutral-100 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] dark:hover:bg-white/8',
    FOCO
);

// Avatares de "de turno" en la franja, tocándose. Si hay más gente que huecos, el último es "+N".
const HUECOS_PILA = 7;

// Orden alfabético con acentos bien ordenados ("Álvaro" junto a "Alvaro").
const ordenAlfabetico = (a: Advisor, b: Advisor) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });

export default function SettingsIndex({ settings, advisors, equipos = [], autoRelease, weekendNotice }: SettingsIndexProps) {
    const { t, i18n } = useTranslation();
    const idioma = i18n.language;
    const { alertasSeguridad } = usePage<{ alertasSeguridad?: Record<string, string> | string[] }>().props;
    const alertas = useMemo<Record<string, string>>(
        () => (alertasSeguridad && !Array.isArray(alertasSeguridad) ? alertasSeguridad : {}),
        [alertasSeguridad]
    );
    const codigosAlerta = Object.keys(alertas);

    // Reloj para los "hace N minutos" (se refresca cada minuto).
    const [ahora, setAhora] = useState(() => Date.now());
    useEffect(() => {
        const reloj = window.setInterval(() => setAhora(Date.now()), 60_000);
        return () => window.clearInterval(reloj);
    }, []);

    /* ── WhatsApp: solo lectura + «Comprobar ahora» ── */
    // Lo de la página (se refresca con cada guardado y recarga) o lo de la última comprobación a
    // mano, lo que sea más reciente: así la franja no mezcla alertas de ahora con horas viejas.
    const [revisadoLocal, setRevisadoLocal] = useState<string | null>(null);
    const [metaOkLocal, setMetaOkLocal] = useState<string | null>(null);
    const [perfilLocal, setPerfilLocal] = useState<PerfilWhatsApp | null>(null);
    const revisadoEn = masReciente(revisadoLocal, settings.vigilancia.revisado_en);
    const metaOkEn = masReciente(metaOkLocal, settings.vigilancia.meta_ok_en);
    const perfilPagina = settings.whatsapp.perfil;
    const perfil =
        perfilLocal && perfilPagina
            ? masReciente(perfilLocal.consultado_en, perfilPagina.consultado_en) === perfilLocal.consultado_en
                ? perfilLocal
                : perfilPagina
            : (perfilLocal ?? perfilPagina);
    const [comprobandoMeta, setComprobandoMeta] = useState(false);
    const [comprobacion, setComprobacion] = useState<{ datos: ComprobacionWhatsApp } | { error: string } | null>(null);

    const comprobarWhatsApp = async () => {
        setComprobandoMeta(true);
        try {
            const { data } = await axios.post<ComprobacionWhatsApp>('/admin/settings/whatsapp/check');
            setComprobacion({ datos: data });
            if (data.perfil) setPerfilLocal(data.perfil);
            if (data.revisado_en) setRevisadoLocal(data.revisado_en);
            if (data.meta_ok_en) setMetaOkLocal(data.meta_ok_en);
            setAhora(Date.now());
            // La franja roja y el estado de arriba se ponen al día con lo que se acaba de revisar.
            router.reload({ only: ['alertasSeguridad', 'settings'] });
        } catch (error) {
            const status = axios.isAxiosError(error) ? error.response?.status : undefined;
            setComprobacion({ error: status === 429 ? t('settings.checkTooMany') : t('settings.checkError') });
        } finally {
            setComprobandoMeta(false);
        }
    };

    const revisionReciente = !!revisadoEn && ahora - new Date(revisadoEn).getTime() < REVISION_RECIENTE_MS;
    // ¿Contestó Meta en la última revisión? La marca se pone segundos antes de cerrar la revisión.
    const metaRespondio = !!metaOkEn && !!revisadoEn && Date.parse(revisadoEn) - Date.parse(metaOkEn) < 60_000;
    const ultimaSinRespuesta = !!comprobacion && 'datos' in comprobacion && comprobacion.datos.meta === 'sin_respuesta';
    const desviado = codigosAlerta.some(esDesvio);

    // Estado de WhatsApp: lo guardado y lo que vio la vigilancia, con ese orden de prioridad.
    const estadoWhatsApp: { texto: string; tono: Tono } =
        !settings.whatsapp.configurada || 'meta_config' in alertas
            ? { texto: t('settings.strip.state.notSetUp'), tono: 'aviso' }
            : 'meta_token' in alertas
              ? { texto: t('settings.strip.state.rejected'), tono: 'error' }
              : desviado
                ? { texto: t('settings.strip.state.diverted'), tono: 'error' }
                : ultimaSinRespuesta || (revisionReciente && !metaRespondio)
                  ? { texto: t('settings.strip.state.noResponse'), tono: 'aviso' }
                  : 'meta_error' in alertas || 'meta_plantillas' in alertas || 'silencio' in alertas
                    ? { texto: t('settings.strip.state.alerts'), tono: 'aviso' }
                    : revisionReciente
                      ? { texto: t('settings.strip.state.working'), tono: 'ok' }
                      : { texto: t('settings.strip.state.configured'), tono: 'neutro' };

    const otrasAlertas = Object.entries(alertas).filter(([codigo]) => !esAlertaDeConexion(codigo));

    /* ── Groq: solo lectura + «Comprobar clave» ── */
    const [comprobandoGroq, setComprobandoGroq] = useState(false);
    const [resultadoGroq, setResultadoGroq] = useState<{ estado: ResultadoGroq } | { error: string } | null>(null);

    const comprobarGroq = async () => {
        setComprobandoGroq(true);
        try {
            const { data } = await axios.post<{ estado: ResultadoGroq }>('/admin/settings/groq/check');
            setResultadoGroq({ estado: data.estado });
        } catch (error) {
            const status = axios.isAxiosError(error) ? error.response?.status : undefined;
            setResultadoGroq({ error: status === 429 ? t('settings.checkTooMany') : t('settings.checkError') });
        } finally {
            setComprobandoGroq(false);
        }
    };

    const groqRechazada = !!resultadoGroq && 'estado' in resultadoGroq && resultadoGroq.estado === 'rechazada';
    const estadoGroq: { texto: string; tono: Tono } = !settings.groq.clave.guardada
        ? { texto: t('settings.notSetUp'), tono: 'aviso' }
        : groqRechazada
          ? { texto: t('settings.strip.state.rejected'), tono: 'error' }
          : { texto: t('settings.active'), tono: 'ok' };

    /* ── Liberación automática: el tiempo se edita como cantidad + unidad y se guarda en minutos ── */
    const unidadGuardada = unidadExacta(autoRelease.minutes);
    const cantidadGuardada = String(autoRelease.minutes / MINUTOS_POR_UNIDAD[unidadGuardada]);
    const [releaseEnabled, setReleaseEnabled] = useState(autoRelease.enabled);
    const [releaseUnit, setReleaseUnit] = useState<UnidadDuracion>(unidadGuardada);
    const [releaseAmount, setReleaseAmount] = useState(cantidadGuardada);
    const [tiempoTocado, setTiempoTocado] = useState(false);
    const [savingRelease, setSavingRelease] = useState(false);
    const [confirmarLiberacion, setConfirmarLiberacion] = useState<{ count: number | null } | null>(null);
    const [releasePreview, setReleasePreview] = useState<{ minutes: number; count: number | null; error: boolean } | null>(null);
    const campoTiempo = useRef<HTMLInputElement>(null);

    const releaseAmountNumber = releaseAmount === '' ? NaN : Number(releaseAmount);
    const releaseMinutes = Number.isInteger(releaseAmountNumber) ? releaseAmountNumber * MINUTOS_POR_UNIDAD[releaseUnit] : NaN;
    const releaseValid = Number.isInteger(releaseMinutes) && releaseMinutes >= autoRelease.min && releaseMinutes <= autoRelease.max;
    // Apagar nunca depende del campo de tiempo: si quedó vacío o mal, se conserva el guardado.
    const releaseError = releaseEnabled && !releaseValid;
    const releaseTocado = releaseEnabled !== autoRelease.enabled || releaseAmount !== cantidadGuardada || releaseUnit !== unidadGuardada;
    // ¿Cambia de verdad lo que hace el servidor? (para el aviso «Cambios sin guardar»)
    const releaseChanged = releaseEnabled !== autoRelease.enabled || (releaseValid && releaseMinutes !== autoRelease.minutes);

    const elegirTiempo = (minutos: number) => {
        const unidad = unidadExacta(minutos);
        setReleaseUnit(unidad);
        setReleaseAmount(String(minutos / MINUTOS_POR_UNIDAD[unidad]));
    };

    // Cuántas conversaciones se liberarían ahora con el tiempo elegido (solo consulta). Espera a
    // que se deje de escribir para no lanzar una petición por tecla.
    useEffect(() => {
        if (!releaseValid) {
            setReleasePreview(null);
            return;
        }

        let vigente = true;
        setReleasePreview({ minutes: releaseMinutes, count: null, error: false });
        const espera = window.setTimeout(() => {
            axios
                .get('/admin/settings/auto-release/preview', { params: { minutes: releaseMinutes } })
                .then((response) => {
                    if (vigente) setReleasePreview({ minutes: releaseMinutes, count: Number(response.data?.count ?? 0), error: false });
                })
                .catch(() => {
                    if (vigente) setReleasePreview({ minutes: releaseMinutes, count: null, error: true });
                });
        }, 400);

        return () => {
            vigente = false;
            window.clearTimeout(espera);
        };
    }, [releaseMinutes, releaseValid]);

    const vistaPreviaVigente = releasePreview && releasePreview.minutes === releaseMinutes ? releasePreview : null;
    // Activar (o acortar el tiempo con la liberación activa) puede desasignar muchas conversaciones
    // de golpe en el próximo minuto: se confirma salvo que la vista previa diga que no hay ninguna.
    const liberacionAmplia = releaseEnabled && releaseValid && (!autoRelease.enabled || releaseMinutes < autoRelease.minutes);
    const necesitaConfirmar = liberacionAmplia && !(vistaPreviaVigente && !vistaPreviaVigente.error && vistaPreviaVigente.count === 0);

    const enviarLiberacion = () => {
        setConfirmarLiberacion(null);
        setSavingRelease(true);
        router.post(
            '/admin/settings/auto-release',
            { enabled: releaseEnabled, minutes: releaseValid ? releaseMinutes : null },
            {
                preserveScroll: true,
                onFinish: () => setSavingRelease(false),
                onSuccess: (page) => {
                    // El campo vuelve a mostrar lo que de verdad quedó guardado.
                    const guardado = page.props.autoRelease as AutoReleaseConfig;
                    setReleaseEnabled(guardado.enabled);
                    elegirTiempo(guardado.minutes);
                    setTiempoTocado(false);
                    toast.success(t('settings.autoRelease.savedSuccess'));
                },
                onError: () => toast.error(t('settings.autoRelease.saveError')),
            }
        );
    };

    const saveAutoRelease = () => {
        if (!releaseTocado || savingRelease) return;
        if (releaseError) {
            setTiempoTocado(true);
            campoTiempo.current?.focus();
            return;
        }
        if (necesitaConfirmar) {
            // El conteo se fija al abrir: si la vista previa llega después, el diálogo no cambia.
            setConfirmarLiberacion({ count: vistaPreviaVigente && !vistaPreviaVigente.error ? vistaPreviaVigente.count : null });
            return;
        }
        enviarLiberacion();
    };

    /* ── Mensaje de fin de semana ── */
    const [weekendEnabled, setWeekendEnabled] = useState(weekendNotice.enabled);
    const [weekendText, setWeekendText] = useState(weekendNotice.text);
    const [textoTocado, setTextoTocado] = useState(false);
    const [savingWeekend, setSavingWeekend] = useState(false);
    const campoTexto = useRef<HTMLTextAreaElement>(null);
    const weekendTextTrim = weekendText.trim();
    const weekendSobran = weekendText.length - weekendNotice.max_length;
    const weekendTextValid = weekendTextTrim.length > 0 && weekendSobran <= 0;
    const weekendChanged = weekendEnabled !== weekendNotice.enabled || weekendTextTrim !== weekendNotice.text.trim();
    // Apagar nunca depende del texto: si quedó vacío, se conserva el guardado. Pasarse de largo, en
    // cambio, se avisa siempre (el texto no se puede guardar así).
    const errorTexto =
        weekendSobran > 0
            ? t('settings.weekendNotice.tooLong', { max: weekendNotice.max_length })
            : weekendEnabled && !weekendTextTrim
              ? t('settings.weekendNotice.textRequired')
              : undefined;
    const mostrarErrorTexto = !!errorTexto && (textoTocado || weekendSobran > 0);

    const saveWeekendNotice = () => {
        if (!weekendChanged || savingWeekend) return;
        if (weekendEnabled ? !weekendTextValid : weekendSobran > 0) {
            setTextoTocado(true);
            campoTexto.current?.focus();
            return;
        }
        setSavingWeekend(true);
        router.post(
            '/admin/settings/weekend-notice',
            { enabled: weekendEnabled, text: weekendTextValid ? weekendText : null },
            {
                preserveScroll: true,
                onFinish: () => setSavingWeekend(false),
                onSuccess: (page) => {
                    // Si se apagó con el texto vacío, el servidor conservó el anterior: se vuelve a mostrar.
                    const guardado = page.props.weekendNotice as WeekendNoticeConfig;
                    setWeekendEnabled(guardado.enabled);
                    setWeekendText(guardado.text);
                    setTextoTocado(false);
                    toast.success(t('settings.weekendNotice.savedSuccess'));
                },
                onError: () => toast.error(t('settings.weekendNotice.saveError')),
            }
        );
    };

    /* ── Asesores de turno ── */
    const [advisorSearch, setAdvisorSearch] = useState('');
    const [selectedAdvisors, setSelectedAdvisors] = useState<number[]>(() =>
        advisors.filter((advisor) => advisor.is_on_duty).map((advisor) => advisor.id)
    );
    const [savingAdvisors, setSavingAdvisors] = useState(false);

    /* ── Equipos (Teleconsulta…): crear, cambiar miembros y eliminar ── */
    const [editorEquipo, setEditorEquipo] = useState<{ id: number | null; nombre: string; miembros: number[] } | null>(null);
    const [buscarEnEquipo, setBuscarEnEquipo] = useState('');
    const [guardandoEquipo, setGuardandoEquipo] = useState(false);
    const [errorEquipo, setErrorEquipo] = useState('');
    const [equipoABorrar, setEquipoABorrar] = useState<EquipoAjuste | null>(null);
    const nombreDe = (id: number) => nombrePropio(advisors.find((a) => a.id === id)?.name ?? '');
    const equipoDe = (id?: number | null) => equipos.find((e) => e.id === id)?.nombre ?? '';

    const abrirEquipo = (equipo: EquipoAjuste | null) => {
        setErrorEquipo('');
        setBuscarEnEquipo('');
        setEditorEquipo(equipo ? { id: equipo.id, nombre: equipo.nombre, miembros: equipo.miembros } : { id: null, nombre: '', miembros: [] });
    };

    const guardarEquipo = () => {
        if (!editorEquipo || guardandoEquipo) return;
        if (!editorEquipo.nombre.trim()) {
            setErrorEquipo(t('settings.equipos.nombreFalta'));
            return;
        }
        setGuardandoEquipo(true);
        const datos = { nombre: editorEquipo.nombre.trim(), miembros: editorEquipo.miembros };
        const opciones = {
            preserveScroll: true,
            onFinish: () => setGuardandoEquipo(false),
            onSuccess: () => {
                setEditorEquipo(null);
                toast.success(t('settings.equipos.guardado'));
            },
            onError: (errores: Record<string, string>) => setErrorEquipo(errores.nombre || t('settings.equipos.errorGuardar')),
        };
        if (editorEquipo.id) router.put(`/admin/settings/equipos/${editorEquipo.id}`, datos, opciones);
        else router.post('/admin/settings/equipos', datos, opciones);
    };

    const eliminarEquipo = () => {
        if (!equipoABorrar) return;
        const id = equipoABorrar.id;
        setEquipoABorrar(null);
        router.delete(`/admin/settings/equipos/${id}`, {
            preserveScroll: true,
            onSuccess: () => toast.success(t('settings.equipos.eliminado')),
            onError: () => toast.error(t('settings.equipos.errorEliminar')),
        });
    };

    // Lo guardado (la franja y la banda dicen lo que rige de verdad, no lo marcado sin guardar).
    const deTurnoGuardados = useMemo(() => [...advisors].sort(ordenAlfabetico).filter((advisor) => advisor.is_on_duty), [advisors]);
    // Lo marcado, sin IDs de asesores que ya no existen (p. ej. borrados con la página abierta).
    const marcados = useMemo(() => selectedAdvisors.filter((id) => advisors.some((advisor) => advisor.id === id)), [selectedAdvisors, advisors]);
    const advisorsChanged =
        marcados.length !== deTurnoGuardados.length || marcados.some((id) => !deTurnoGuardados.some((advisor) => advisor.id === id));

    const filteredAdvisors = useMemo(() => {
        const searchTerm = plano(advisorSearch.trim());
        if (!searchTerm) return advisors;

        return advisors.filter((advisor) => plano(`${advisor.name} ${advisor.email}`).includes(searchTerm));
    }, [advisorSearch, advisors]);

    // Solo para pintar: orden alfabético (con acentos bien ordenados). Marcar a alguien no lo mueve.
    const advisorsInOrder = useMemo(() => [...filteredAdvisors].sort(ordenAlfabetico), [filteredAdvisors]);

    const toggleAdvisor = (advisorId: number) => {
        setSelectedAdvisors((currentAdvisors) =>
            currentAdvisors.includes(advisorId)
                ? currentAdvisors.filter((currentAdvisorId) => currentAdvisorId !== advisorId)
                : [...currentAdvisors, advisorId]
        );
    };

    const saveOnDutyAdvisors = () => {
        if (!advisorsChanged || savingAdvisors) return;
        setSavingAdvisors(true);
        router.post(
            '/admin/settings/on-duty-advisors',
            { advisor_ids: marcados },
            {
                preserveScroll: true,
                onFinish: () => setSavingAdvisors(false),
                onSuccess: () => toast.success(t('settings.onDutyAdvisors.savedSuccess')),
                onError: () => toast.error(t('settings.onDutyAdvisors.saveError')),
            }
        );
    };

    /* ── Cambios sin guardar: aviso al salir de la página ── */
    const hayCambios = releaseChanged || weekendChanged || advisorsChanged;

    useEffect(() => {
        if (!hayCambios) return;

        const alCerrar = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', alCerrar);

        const quitar = router.on('before', (event) => {
            const visita = event.detail.visit;
            // Sin preguntar: el prefetch al pasar por el menú, los guardados y comprobaciones de esta
            // página, y sus recargas parciales. Sí se pregunta al volver a pulsar «Configuración» en
            // el menú (recarga la página entera) y al cerrar sesión (POST a otra ruta).
            if (visita.prefetch) return;
            if (visita.method !== 'get' && visita.url.pathname.startsWith('/admin/settings/')) return;
            if (visita.method === 'get' && visita.url.pathname === window.location.pathname && (visita.only.length > 0 || visita.preserveState === true)) return;
            if (!window.confirm(t('settings.unsavedLeave'))) event.preventDefault();
        });

        // Atrás/Adelante: Inertia cambia de página sin pasar por 'before'. Esta escucha (en captura,
        // corre antes que la de Inertia) pregunta y, si se cancela, vuelve a donde estaba.
        let volviendo = false;
        const alNavegarHistorial = (event: PopStateEvent) => {
            if (volviendo) {
                volviendo = false;
                event.stopImmediatePropagation();
                return;
            }
            if (!window.confirm(t('settings.unsavedLeave'))) {
                event.stopImmediatePropagation();
                volviendo = true;
                window.history.go(1);
            }
        };
        window.addEventListener('popstate', alNavegarHistorial, { capture: true });

        return () => {
            window.removeEventListener('beforeunload', alCerrar);
            window.removeEventListener('popstate', alNavegarHistorial, { capture: true });
            quitar();
        };
    }, [hayCambios, t]);

    /* ── Piezas que dependen de t() ───────────────────────────────────────────────────────────── */

    const soloLectura = t('settings.readOnly');

    const botonGuardar = (processing: boolean, texto: string) =>
        processing ? (
            <>
                <Loader2 className="size-[15px] animate-spin" aria-hidden="true" />
                {t('common.saving')}
            </>
        ) : (
            <>
                <Check className="size-[15px]" strokeWidth={2} aria-hidden="true" />
                {texto}
            </>
        );

    const botonComprobar = (comprobando: boolean, texto: string, onClick: () => void) => (
        <button type="button" onClick={onClick} disabled={comprobando} aria-busy={comprobando} className={BOTON_SECUNDARIO}>
            {comprobando ? (
                <Loader2 className="size-[15px] animate-spin" aria-hidden="true" />
            ) : (
                <PlugZap className="size-[15px]" strokeWidth={1.75} aria-hidden="true" />
            )}
            {comprobando ? t('settings.checking') : texto}
        </button>
    );

    const valorClave = (clave: ClaveGuardada) =>
        clave.guardada ? (
            <span className={TEXTO_NAVY}>
                {clave.cambiada_en ? t('settings.savedOn', { date: fechaCorta(clave.cambiada_en, idioma) }) : t('settings.saved')}
            </span>
        ) : (
            <span className={cn('font-medium', TONO_TEXTO.aviso)}>{t('settings.notSaved')}</span>
        );

    const valorId = (id: string | null) =>
        id ? (
            <span className={cn(MONO, 'text-[12.5px] tracking-[0.02em] select-all', TEXTO_NAVY)}>{id}</span>
        ) : (
            <span className={cn('font-medium', TONO_TEXTO.aviso)}>{t('settings.notSet')}</span>
        );

    const dato = (etiqueta: string, valor: ReactNode, titulo?: string) => (
        <div className="flex min-w-0 flex-col gap-0.5">
            <dt className={cn('text-[12px] leading-4', TEXTO_SUAVE)}>{etiqueta}</dt>
            <dd title={titulo} className={cn('text-[13.5px] leading-5 font-medium [overflow-wrap:anywhere] @3xl/hoja:truncate', TEXTO_NAVY)}>
                {valor}
            </dd>
        </div>
    );

    // Códigos de Meta en palabras: GREEN → «Alta»; TIER_1K → «Hasta 1.000 personas distintas cada 24 h».
    const calidad = (codigo: string | null) => {
        const conocida = codigo === 'GREEN' || codigo === 'YELLOW' || codigo === 'RED';
        const tono: Tono = codigo === 'GREEN' ? 'ok' : codigo === 'YELLOW' ? 'aviso' : codigo === 'RED' ? 'error' : 'neutro';
        return (
            <span className="inline-flex items-center gap-1.5">
                <span className={cn('size-[7px] shrink-0 rounded-full', TONO_PUNTO[tono])} aria-hidden="true" />
                {t(`settings.whatsapp.quality.${conocida ? codigo : 'unknown'}`)}
            </span>
        );
    };

    const limite = (codigo: string | null) => {
        if (codigo === 'TIER_UNLIMITED') return t('settings.whatsapp.limitUnlimited');
        const m = codigo?.match(/^TIER_(\d+)(K?)$/);
        if (!m) return t('settings.whatsapp.limitUnknown');
        const n = Number(m[1]) * (m[2] ? 1000 : 1);
        return t('settings.whatsapp.limitN', { n: n.toLocaleString(localeDe(idioma)) });
    };

    const resultadoMetaTono = (meta: ResultadoMeta): Tono => (meta === 'ok' ? 'ok' : meta === 'sin_respuesta' ? 'aviso' : 'error');
    // (error_meta, rechazada, desviado y sin_config: en rojo.)

    const conPila = deTurnoGuardados.length > HUECOS_PILA ? HUECOS_PILA - 1 : deTurnoGuardados.length;
    const restoPila = deTurnoGuardados.length - conPila;

    const advisorCount = advisors.length;
    const filas = {
        '--f1': advisorsInOrder.length,
        '--f2': Math.ceil(advisorsInOrder.length / 2),
        '--f3': Math.ceil(advisorsInOrder.length / 3),
    } as CSSProperties;

    const lineaDistinta =
        !!settings.whatsapp.phone_id && !!settings.whatsapp.phone_number_id && String(settings.whatsapp.phone_id) !== String(settings.whatsapp.phone_number_id);

    const tonoFirma: Tono = settings.whatsapp.firma === 'exigida' ? 'ok' : 'neutro';

    return (
        <AdminLayout>
            <Head title={t('settings.whatsapp.title')} />

            {/* Con alertas, la franja roja flota abajo: el relleno evita que tape el último «Guardar». */}
            <div className={cn('min-h-screen bg-background px-4 pt-5 md:px-7 md:pt-7', codigosAlerta.length > 0 ? 'pb-48' : 'pb-8')}>
                <div className="@container/pagina mx-auto flex max-w-7xl flex-col gap-6">
                    {/* ── Cabecera ── */}
                    <header className="flex flex-col gap-1">
                        <h1 className={cn('text-[28px] leading-[34px] font-semibold tracking-[-0.025em]', TEXTO_NAVY)}>{t('settings.whatsapp.title')}</h1>
                        <p className="text-[14px] leading-5 text-muted-foreground">{t('settings.whatsapp.subtitle')}</p>
                    </header>

                    {/* ── Franja de estados (sin cajas: filetes entre estados). La primera columna no baja de 345 px. ── */}
                    <section
                        aria-label={t('settings.strip.label')}
                        className="grid grid-cols-1 gap-y-5 @2xl/pagina:grid-cols-2 @2xl/pagina:gap-x-6 @5xl/pagina:grid-cols-[minmax(345px,1.25fr)_1px_minmax(0,1fr)_1px_minmax(0,1.35fr)] @5xl/pagina:gap-y-0"
                    >
                        <EstadoFranja icon={MessageCircle} etiqueta={t('settings.strip.whatsapp')} tono={estadoWhatsApp.tono}>
                            <ValorFranja>{estadoWhatsApp.texto}</ValorFranja>
                            <DetalleFranja>
                                {revisadoEn ? t('settings.strip.checkedAgo', { time: haceCuanto(revisadoEn, idioma, ahora) }) : t('settings.strip.notChecked')}
                            </DetalleFranja>
                        </EstadoFranja>
                        <Divisor />
                        <EstadoFranja icon={AudioLines} etiqueta={t('settings.strip.speech')} tono={estadoGroq.tono}>
                            <ValorFranja>{estadoGroq.texto}</ValorFranja>
                            <DetalleFranja>{t('settings.strip.speechDetail')}</DetalleFranja>
                        </EstadoFranja>
                        <Divisor />
                        <div className="min-w-0 @2xl/pagina:col-span-2 @5xl/pagina:col-span-1">
                            <EstadoFranja icon={Users} etiqueta={t('settings.onDutyAdvisors.title')} tono={deTurnoGuardados.length > 0 ? 'ok' : 'aviso'}>
                                <span className="flex shrink-0 items-baseline gap-[7px]">
                                    <ValorFranja>{deTurnoGuardados.length}</ValorFranja>
                                    <span className="text-[13px] leading-4 whitespace-nowrap text-muted-foreground tabular-nums">
                                        {t('settings.strip.ofTotal', { total: advisorCount })}
                                    </span>
                                </span>
                                {conPila > 0 && (
                                    <ul aria-label={t('settings.strip.whoIsOnDuty')} className="ml-1 flex min-w-0 items-center overflow-hidden">
                                        {deTurnoGuardados.slice(0, conPila).map((advisor) => (
                                            <li key={advisor.id} title={nombrePropio(advisor.name)} className="flex shrink-0 rounded-full">
                                                <Iniciales name={advisor.name} className="size-7 ring-2 ring-background" />
                                                <span className="sr-only">{nombrePropio(advisor.name)}</span>
                                            </li>
                                        ))}
                                        {restoPila > 0 && (
                                            <li
                                                title={t('settings.strip.moreOnDuty', { count: restoPila })}
                                                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-card text-[11px] leading-none font-semibold text-[#2e3f84] tabular-nums shadow-[inset_0_0_0_1px_rgba(46,63,132,0.14)] ring-2 ring-background dark:text-neutral-100 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
                                            >
                                                <span aria-hidden="true">+{restoPila}</span>
                                                <span className="sr-only">{t('settings.strip.moreOnDuty', { count: restoPila })}</span>
                                            </li>
                                        )}
                                    </ul>
                                )}
                            </EstadoFranja>
                        </div>
                    </section>

                    {/* ── La hoja: WhatsApp, Groq, liberación, fin de semana y turno, una sección tras otra ── */}
                    <div className="@container/hoja overflow-hidden rounded-2xl bg-card shadow-[0_0_0_1px_rgba(46,63,132,0.07),0_1px_2px_rgba(46,63,132,0.05),0_14px_32px_-18px_rgba(46,63,132,0.22)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07),0_14px_32px_-18px_rgba(0,0,0,0.6)]">
                        {/* ── 1. Conexión con WhatsApp (solo lectura) ── */}
                        <section aria-labelledby="settings-whatsapp">
                            <Banda
                                id="settings-whatsapp"
                                icon={MessageCircle}
                                titulo={t('settings.whatsapp.apiTitle')}
                                estado={<Estado tono={estadoWhatsApp.tono}>{estadoWhatsApp.texto}</Estado>}
                                texto={t('settings.whatsapp.bandText')}
                                acciones={botonComprobar(comprobandoMeta, t('settings.whatsapp.checkNow'), comprobarWhatsApp)}
                            />

                            {/* Lo que oye el lector: solo el resultado (no la hora relativa, que cambia cada minuto). */}
                            <p className="sr-only" aria-live="polite">
                                {comprobacion ? ('error' in comprobacion ? comprobacion.error : t(`settings.whatsapp.result.${comprobacion.datos.meta}`)) : ''}
                            </p>
                            <div>
                                {comprobacion && (
                                    <Fila
                                        etiqueta={t('settings.whatsapp.checkRowLabel')}
                                        ayuda={t('settings.whatsapp.checkRowHelp', { time: revisadoEn ? haceCuanto(revisadoEn, idioma, ahora) : '—' })}
                                    >
                                        {'error' in comprobacion ? (
                                            <Mensaje tono="error">{comprobacion.error}</Mensaje>
                                        ) : (
                                            // Con plantillas ajenas o sin mensajes entrantes, el resultado sale en ámbar
                                            // como la franja, aunque la conexión con Meta esté bien.
                                            <Mensaje
                                                tono={
                                                    comprobacion.datos.meta === 'ok' && ('meta_plantillas' in alertas || 'silencio' in alertas)
                                                        ? 'aviso'
                                                        : resultadoMetaTono(comprobacion.datos.meta)
                                                }
                                            >
                                                {t(`settings.whatsapp.result.${comprobacion.datos.meta}`)}
                                            </Mensaje>
                                        )}
                                    </Fila>
                                )}
                            </div>

                            {/* Alertas vigentes que no son de la conexión (llegada de mensajes, cola, disco, respaldo…),
                                siempre desde la prop viva: se refresca tras comprobar o guardar. Esta no se cierra. */}
                            {otrasAlertas.length > 0 && (
                                <Fila etiqueta={t('settings.whatsapp.alertsRowLabel')} ayuda={t('settings.whatsapp.alertsRowHelp')}>
                                    <ul className={cn('list-disc space-y-1 pl-5 text-[13px] leading-[18px] font-medium', TONO_TEXTO.aviso)}>
                                        {otrasAlertas.map(([codigo, texto]) => (
                                            <li key={codigo}>{texto}</li>
                                        ))}
                                    </ul>
                                </Fila>
                            )}

                            {perfil && (
                                <Fila
                                    etiqueta={t('settings.whatsapp.profileRowLabel')}
                                    ayuda={t('settings.whatsapp.profileRowHelp', { time: haceCuanto(perfil.consultado_en, idioma, ahora) })}
                                    abajo="pb-4 @3xl/hoja:pb-[17px]"
                                >
                                    <dl className="grid grid-cols-2 gap-x-7 gap-y-3.5 @5xl/hoja:grid-cols-[1.4fr_1fr_0.8fr_1.6fr]">
                                        {dato(t('settings.whatsapp.profileName'), perfil.nombre || '—', perfil.nombre ?? undefined)}
                                        {dato(t('settings.whatsapp.profilePhone'), <span className="tabular-nums">{perfil.numero || '—'}</span>, perfil.numero ?? undefined)}
                                        {dato(t('settings.whatsapp.profileQuality'), calidad(perfil.calidad))}
                                        {dato(t('settings.whatsapp.profileMessagingLimit'), limite(perfil.limite), limite(perfil.limite))}
                                    </dl>
                                </Fila>
                            )}

                            <Subgrupo titulo={t('settings.whatsapp.credentialsTitle')} texto={t('settings.whatsapp.credentialsSubtitle')} />

                            <Fila etiqueta={t('settings.whatsapp.accessToken')} ayuda={t('settings.whatsapp.accessTokenHelp')}>
                                <CajaSoloLectura icon={KeyRound} etiquetaCandado={soloLectura}>
                                    {valorClave(settings.whatsapp.clave_acceso)}
                                </CajaSoloLectura>
                            </Fila>

                            <Fila etiqueta={t('settings.whatsapp.verifyToken')} ayuda={t('settings.whatsapp.verifyTokenHelp')}>
                                <CajaSoloLectura icon={ShieldCheck} etiquetaCandado={soloLectura}>
                                    {valorClave(settings.whatsapp.clave_verificacion)}
                                </CajaSoloLectura>
                            </Fila>

                            <Fila etiqueta={t('settings.whatsapp.signature')} ayuda={t('settings.whatsapp.signatureHelp')}>
                                <CajaSoloLectura icon={BadgeCheck} etiquetaCandado={soloLectura}>
                                    <Estado tono={tonoFirma}>{t(`settings.whatsapp.signatureState.${settings.whatsapp.firma}`)}</Estado>
                                </CajaSoloLectura>
                            </Fila>

                            <Subgrupo titulo={t('settings.whatsapp.identifiersTitle')} texto={t('settings.whatsapp.identifiersSubtitle')} />

                            <Fila etiqueta={t('settings.whatsapp.phoneId')} ayuda={t('settings.whatsapp.idHelp')}>
                                <CajaSoloLectura icon={Phone} corto etiquetaCandado={soloLectura}>
                                    {valorId(settings.whatsapp.phone_id)}
                                </CajaSoloLectura>
                                {lineaDistinta && (
                                    <p className={cn('mt-2 flex items-start gap-1.5 text-[12.5px] leading-[18px] font-medium', TONO_TEXTO.aviso)}>
                                        <CircleAlert className="mt-px size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                                        {t('settings.whatsapp.lineMismatch', { id: settings.whatsapp.phone_number_id })}
                                    </p>
                                )}
                            </Fila>

                            <Fila etiqueta={t('settings.whatsapp.businessAccountId')} ayuda={t('settings.whatsapp.idHelp')}>
                                <CajaSoloLectura icon={Building2} corto etiquetaCandado={soloLectura}>
                                    {valorId(settings.whatsapp.business_account_id)}
                                </CajaSoloLectura>
                            </Fila>

                            <Fila etiqueta={t('settings.whatsapp.webhookUrl')} ayuda={t('settings.whatsapp.webhookHelp')}>
                                <CajaSoloLectura icon={Webhook} etiquetaCandado={soloLectura}>
                                    <span className={cn(MONO, 'text-[12.5px] select-all', TEXTO_NAVY)}>{settings.whatsapp.webhook_url}</span>
                                </CajaSoloLectura>
                                {desviado && (
                                    <p className={cn('mt-2 flex items-start gap-1.5 text-[12.5px] leading-[18px] font-medium', TONO_TEXTO.error)}>
                                        <CircleAlert className="mt-px size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                                        {t('settings.whatsapp.webhookDiverted')}
                                    </p>
                                )}
                            </Fila>

                            <Pie nota={t('settings.whatsapp.serverNote')} />
                        </section>

                        {/* ── 2. Transcripción y corrector (Groq, solo lectura) ── */}
                        <section aria-labelledby="settings-groq">
                            <Banda
                                id="settings-groq"
                                icon={AudioLines}
                                titulo={t('settings.groq.sectionTitle')}
                                estado={<Estado tono={estadoGroq.tono}>{estadoGroq.texto}</Estado>}
                                texto={t('settings.groq.sectionText')}
                                acciones={botonComprobar(comprobandoGroq, t('settings.groq.checkKey'), comprobarGroq)}
                            />

                            <div aria-live="polite">
                                {resultadoGroq && (
                                    <Fila etiqueta={t('settings.whatsapp.checkRowLabel')} ayuda={t('settings.groq.checkRowHelp')}>
                                        {'error' in resultadoGroq ? (
                                            <Mensaje tono="error">{resultadoGroq.error}</Mensaje>
                                        ) : (
                                            <Mensaje
                                                tono={resultadoGroq.estado === 'ok' ? 'ok' : resultadoGroq.estado === 'sin_respuesta' ? 'aviso' : 'error'}
                                            >
                                                {t(`settings.groq.result.${resultadoGroq.estado}`)}
                                            </Mensaje>
                                        )}
                                    </Fila>
                                )}
                            </div>

                            <Fila etiqueta={t('settings.groq.apiKeyLabel')} ayuda={t('settings.groq.apiKeyHelp')}>
                                <CajaSoloLectura icon={KeyRound} etiquetaCandado={soloLectura}>
                                    {valorClave(settings.groq.clave)}
                                </CajaSoloLectura>
                            </Fila>

                            <Pie nota={t('settings.groq.serverNote')} />
                        </section>

                        {/* ── 3. Liberación automática de conversaciones sin respuesta ── */}
                        <section aria-labelledby="settings-auto-release">
                            <Banda
                                id="settings-auto-release"
                                icon={Hourglass}
                                titulo={t('settings.autoRelease.title')}
                                estado={
                                    <Estado tono={autoRelease.enabled ? 'ok' : 'neutro'}>
                                        {autoRelease.enabled
                                            ? t('settings.autoRelease.activeState', { time: duracionLegible(autoRelease.minutes, t) })
                                            : t('settings.autoRelease.inactiveState')}
                                    </Estado>
                                }
                                texto={t('settings.autoRelease.bandText')}
                            />

                            <Fila
                                etiqueta={t('settings.autoRelease.toggleLabel')}
                                htmlFor="auto-release-toggle"
                                ayuda={t('settings.autoRelease.toggleHelp')}
                                ayudaId="auto-release-toggle-help"
                            >
                                <Interruptor
                                    id="auto-release-toggle"
                                    activo={releaseEnabled}
                                    onToggle={() => setReleaseEnabled((actual) => !actual)}
                                    describedBy="auto-release-toggle-help"
                                    si={t('settings.autoRelease.on')}
                                    no={t('settings.autoRelease.off')}
                                />
                            </Fila>

                            <Fila etiqueta={t('settings.autoRelease.timeLabel')} htmlFor="auto-release-amount" ayuda={t('settings.autoRelease.timeHelp')} ayudaId="auto-release-time-help">
                                <div className="flex flex-col gap-3">
                                    <div role="group" aria-label={t('settings.autoRelease.presetsLabel')} className="flex flex-wrap gap-1.5">
                                        {TIEMPOS_FRECUENTES.map((minutos) => {
                                            const elegido = releaseValid && releaseMinutes === minutos;
                                            return (
                                                <button
                                                    key={minutos}
                                                    type="button"
                                                    aria-pressed={elegido}
                                                    onClick={() => {
                                                        elegirTiempo(minutos);
                                                        setTiempoTocado(false);
                                                    }}
                                                    className={cn(
                                                        'h-8 cursor-pointer rounded-full px-3 text-[12.5px] leading-4 font-semibold whitespace-nowrap transition-colors forced-colors:border forced-colors:aria-pressed:bg-[Highlight] forced-colors:aria-pressed:text-[HighlightText] forced-colors:aria-pressed:forced-color-adjust-none',
                                                        elegido
                                                            ? 'bg-[#2e3f84] text-white dark:bg-[#596bcf]'
                                                            : 'bg-[#2e3f84]/[0.06] text-[#2e3f84] hover:bg-[#2e3f84]/[0.1] dark:bg-white/[0.06] dark:text-neutral-100 dark:hover:bg-white/10',
                                                        FOCO
                                                    )}
                                                >
                                                    {duracionLegible(minutos, t)}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* El aviso flota bajo la cantidad (no empuja la fila de abajo). */}
                                    <div className="relative flex flex-wrap items-center gap-2">
                                        <label htmlFor="auto-release-amount" className="sr-only">
                                            {t('settings.autoRelease.amountLabel')}
                                        </label>
                                        {/* Texto con teclado numérico (no type=number): ni la rueda del ratón ni las
                                            flechas cambian el tiempo sin querer, y solo admite cifras. */}
                                        <input
                                            ref={campoTiempo}
                                            id="auto-release-amount"
                                            name="auto-release-amount"
                                            type="text"
                                            inputMode="numeric"
                                            autoComplete="off"
                                            maxLength={5}
                                            value={releaseAmount}
                                            onChange={(event) => setReleaseAmount(event.target.value.replace(/\D/g, ''))}
                                            onBlur={() => setTiempoTocado(true)}
                                            aria-describedby={describir('auto-release-time-help', releaseError && tiempoTocado && 'auto-release-time-error')}
                                            aria-invalid={(releaseError && tiempoTocado) || undefined}
                                            className="caja-ajuste h-[38px] w-[96px] rounded-[9px] px-3 text-[13px] leading-[18px] tabular-nums outline-hidden"
                                        />
                                        <label htmlFor="auto-release-unit" className="sr-only">
                                            {t('settings.autoRelease.unitLabel')}
                                        </label>
                                        <select
                                            id="auto-release-unit"
                                            name="auto-release-unit"
                                            value={releaseUnit}
                                            onChange={(event) => setReleaseUnit(event.target.value as UnidadDuracion)}
                                            onBlur={() => setTiempoTocado(true)}
                                            className="caja-ajuste h-[38px] cursor-pointer rounded-[9px] pr-8 pl-3 text-[13px] leading-[18px] outline-hidden"
                                        >
                                            <option value="minutes">{t('settings.autoRelease.unitMinutes')}</option>
                                            <option value="hours">{t('settings.autoRelease.unitHours')}</option>
                                            <option value="days">{t('settings.autoRelease.unitDays')}</option>
                                        </select>
                                        <AvisoCampo id="auto-release-time-error" texto={releaseError && tiempoTocado ? t('settings.autoRelease.outOfRange') : undefined} />
                                    </div>
                                </div>
                            </Fila>

                            <Fila etiqueta={t('settings.autoRelease.previewLabel')} ayuda={t('settings.autoRelease.previewHelp')}>
                                {(() => {
                                    const frase = !releasePreview
                                        ? null
                                        : releasePreview.error
                                          ? t('settings.autoRelease.previewError')
                                          : releasePreview.count === null
                                            ? null
                                            : releasePreview.count === 0
                                              ? t('settings.autoRelease.previewNone', { time: duracionLegible(releasePreview.minutes, t) })
                                              : t('settings.autoRelease.previewCount', { count: releasePreview.count, time: duracionLegible(releasePreview.minutes, t) });
                                    const nota =
                                        releasePreview && !releasePreview.error && releasePreview.count !== null && releasePreview.count > 0 && releaseEnabled && (releaseChanged || autoRelease.enabled)
                                            ? releaseChanged
                                                ? t('settings.autoRelease.previewWillRelease')
                                                : t('settings.autoRelease.previewReleasingSoon')
                                            : null;

                                    return (
                                        <>
                                            {/* Lo visible no se anuncia (diría «Calculando…» a cada cambio); el lector oye
                                                solo la frase final, por la región de abajo. */}
                                            <p
                                                aria-busy={releasePreview?.count === null && !releasePreview?.error}
                                                className={cn('flex items-start gap-2 text-[13px] leading-[18px]', TEXTO_NAVY)}
                                            >
                                                {!releasePreview ? (
                                                    <span className={TEXTO_SUAVE}>—</span>
                                                ) : releasePreview.error ? (
                                                    <span className={TONO_TEXTO.error}>{frase}</span>
                                                ) : releasePreview.count === null ? (
                                                    <span className={cn('inline-flex items-center gap-2', TEXTO_SUAVE)}>
                                                        <Loader2 className="size-[14px] animate-spin" aria-hidden="true" />
                                                        {t('settings.autoRelease.previewLoading')}
                                                    </span>
                                                ) : (
                                                    <span className="min-w-0">
                                                        <span className="font-semibold">{frase}</span>
                                                        {nota && <span className={cn('mt-0.5 block text-[12px] leading-4', TEXTO_SUAVE)}>{nota}</span>}
                                                    </span>
                                                )}
                                            </p>
                                            <span className="sr-only" aria-live="polite">
                                                {frase ? `${frase}${nota ? ` ${nota}` : ''}` : ''}
                                            </span>
                                        </>
                                    );
                                })()}
                            </Fila>

                            <Pie nota={t('settings.autoRelease.saveNote')} pendiente={releaseChanged && t('settings.unsaved')}>
                                <Button
                                    type="button"
                                    onClick={saveAutoRelease}
                                    disabled={savingRelease || !releaseTocado}
                                    className={cn(BOTON_PRIMARIO, releaseTocado ? 'settings-btn-primary disabled:opacity-50' : BOTON_APAGADO)}
                                >
                                    {botonGuardar(savingRelease, t('common.saveChanges'))}
                                </Button>
                            </Pie>
                        </section>

                        {/* ── 4. Mensaje de fin de semana ── */}
                        <section aria-labelledby="settings-weekend">
                            <Banda
                                id="settings-weekend"
                                icon={CalendarDays}
                                titulo={t('settings.weekendNotice.title')}
                                estado={
                                    <Estado tono={weekendNotice.enabled ? 'ok' : 'neutro'}>
                                        {weekendNotice.enabled ? t('settings.weekendNotice.activeState') : t('settings.weekendNotice.inactiveState')}
                                    </Estado>
                                }
                                texto={t('settings.weekendNotice.bandText')}
                            />

                            <Fila
                                etiqueta={t('settings.weekendNotice.toggleLabel')}
                                htmlFor="weekend-toggle"
                                ayuda={t('settings.weekendNotice.toggleHelp')}
                                ayudaId="weekend-toggle-help"
                            >
                                <Interruptor
                                    id="weekend-toggle"
                                    activo={weekendEnabled}
                                    onToggle={() => setWeekendEnabled((actual) => !actual)}
                                    describedBy="weekend-toggle-help"
                                    si={t('settings.weekendNotice.on')}
                                    no={t('settings.weekendNotice.off')}
                                />
                            </Fila>

                            <Fila etiqueta={t('settings.weekendNotice.textLabel')} htmlFor="weekend-text" ayuda={t('settings.weekendNotice.textHelp')} ayudaId="weekend-text-help">
                                <div className="flex w-full max-w-[560px] flex-col gap-2">
                                    <div className="relative">
                                        {/* Sin maxLength: el navegador recortaría en silencio lo pegado de más; el
                                            contador y el aviso dicen cuánto sobra. */}
                                        <textarea
                                            ref={campoTexto}
                                            id="weekend-text"
                                            name="weekend-text"
                                            rows={6}
                                            value={weekendText}
                                            onChange={(event) => setWeekendText(event.target.value)}
                                            onBlur={() => setTextoTocado(true)}
                                            aria-describedby={describir('weekend-text-help', 'weekend-text-count', mostrarErrorTexto && 'weekend-text-error')}
                                            aria-invalid={mostrarErrorTexto || undefined}
                                            className="caja-ajuste block w-full resize-y rounded-[9px] px-3 py-2.5 text-[13px] leading-[19px] outline-hidden"
                                        />
                                        <AvisoCampo id="weekend-text-error" texto={mostrarErrorTexto ? errorTexto : undefined} />
                                    </div>
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setWeekendText(weekendNotice.default_text)}
                                            disabled={weekendText === weekendNotice.default_text}
                                            className={BOTON_SECUNDARIO}
                                        >
                                            {t('settings.weekendNotice.restoreDefault')}
                                        </button>
                                        <span
                                            id="weekend-text-count"
                                            className={cn(
                                                'text-[12px] leading-4 tabular-nums',
                                                weekendSobran > 0 ? cn('font-semibold', TONO_TEXTO.error) : TEXTO_SUAVE
                                            )}
                                        >
                                            {t('settings.weekendNotice.charCount', { count: weekendText.length, max: weekendNotice.max_length })}
                                        </span>
                                    </div>
                                </div>
                            </Fila>

                            <Fila etiqueta={t('settings.weekendNotice.previewLabel')} ayuda={t('settings.weekendNotice.previewHelp')}>
                                <div className="w-full max-w-[420px] rounded-[12px] bg-[#efeae2] p-3 dark:bg-white/[0.04]">
                                    <p className="max-w-[92%] rounded-[10px] rounded-tl-[3px] bg-white px-3 py-2 text-[13px] leading-[19px] whitespace-pre-wrap text-[#111b21] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] [overflow-wrap:anywhere] dark:bg-[#202c33] dark:text-neutral-100">
                                        {/* Como se guarda: sin líneas en blanco al principio ni al final. */}
                                        {weekendTextTrim ? <TextoWhatsApp texto={weekendTextTrim} /> : <span className={TEXTO_SUAVE}>—</span>}
                                    </p>
                                </div>
                            </Fila>

                            <Pie nota={t('settings.weekendNotice.saveNote')} pendiente={weekendChanged && t('settings.unsaved')}>
                                <Button
                                    type="button"
                                    onClick={saveWeekendNotice}
                                    disabled={savingWeekend || !weekendChanged}
                                    className={cn(BOTON_PRIMARIO, weekendChanged ? 'settings-btn-primary disabled:opacity-50' : BOTON_APAGADO)}
                                >
                                    {botonGuardar(savingWeekend, t('common.saveChanges'))}
                                </Button>
                            </Pie>
                        </section>

                        {/* ── 5. Asesores de turno ── */}
                        <section aria-labelledby="settings-duty">
                            <Banda
                                id="settings-duty"
                                icon={Users}
                                titulo={t('settings.onDutyAdvisors.title')}
                                estado={
                                    <Estado tono={deTurnoGuardados.length > 0 ? 'ok' : 'aviso'}>
                                        {deTurnoGuardados.length > 0
                                            ? t('settings.onDutyAdvisors.onDutyCount', { count: deTurnoGuardados.length })
                                            : t('settings.onDutyAdvisors.noneSelected')}
                                    </Estado>
                                }
                                texto={t('settings.onDutyAdvisors.bandText')}
                            />

                            <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-2.5 border-b py-3 @3xl/hoja:h-[60px] @3xl/hoja:flex-nowrap @3xl/hoja:py-0', SANGRIA, FILETE)}>
                                <div className="relative w-full @3xl/hoja:w-[320px] @3xl/hoja:shrink-0">
                                    <label htmlFor="advisor-search" className="sr-only">
                                        {t('settings.onDutyAdvisors.searchLabel')}
                                    </label>
                                    <Search
                                        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground dark:text-neutral-400"
                                        strokeWidth={1.75}
                                        aria-hidden="true"
                                    />
                                    <input
                                        id="advisor-search"
                                        name="advisor-search"
                                        type="text"
                                        value={advisorSearch}
                                        onChange={(event) => setAdvisorSearch(event.target.value)}
                                        placeholder={t('settings.onDutyAdvisors.searchPlaceholder')}
                                        className={cn(
                                            'h-9 w-full rounded-[10px] bg-[#2e3f84]/[0.035] pr-9 pl-[38px] text-[13px] leading-[18px] text-foreground shadow-[inset_0_0_0_1px_rgba(46,63,132,0.1)] transition-shadow placeholder:text-muted-foreground forced-colors:border dark:bg-white/5 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] dark:placeholder:text-neutral-400',
                                            FOCO
                                        )}
                                    />
                                    {advisorSearch && (
                                        <button
                                            type="button"
                                            onClick={() => setAdvisorSearch('')}
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

                                {advisorCount > 0 && (
                                    <span className="ml-auto text-[12.5px] leading-4 whitespace-nowrap text-muted-foreground tabular-nums" aria-live="polite">
                                        <Trans
                                            i18nKey="settings.onDutyAdvisors.selectedOfTotal"
                                            values={{ selected: marcados.length, total: advisorCount }}
                                            components={{ strong: <span className={cn('font-semibold', TEXTO_NAVY)} /> }}
                                        />
                                    </span>
                                )}
                            </div>

                            {advisorCount === 0 ? (
                                <div className="px-4 py-12 text-center">
                                    <Users className="mx-auto mb-3 size-9 text-muted-foreground dark:text-neutral-400" strokeWidth={1.5} aria-hidden="true" />
                                    <p className={cn('text-[15px] leading-5 font-semibold', TEXTO_NAVY)}>{t('settings.onDutyAdvisors.emptyTitle')}</p>
                                    <p className={cn('mt-1 text-[13px] leading-[18px]', TEXTO_SUAVE)}>{t('settings.onDutyAdvisors.emptyDescription')}</p>
                                </div>
                            ) : (
                                <>
                                    {advisorsInOrder.length === 0 ? (
                                        <div className={cn('border-b py-3', SANGRIA, FILETE)}>
                                            <p
                                                className={cn(
                                                    'rounded-xl border border-dashed border-[#2e3f84]/15 px-4 py-7 text-center text-[13px] leading-[18px] dark:border-white/12',
                                                    TEXTO_SUAVE
                                                )}
                                            >
                                                {t('settings.onDutyAdvisors.noResults')}
                                            </p>
                                        </div>
                                    ) : (
                                        // Orden alfabético por columnas (hacia abajo y luego a la derecha): 3, 2 o 1
                                        // columnas según el ancho de la hoja; las filas se calculan para cada caso.
                                        <ul
                                            style={filas}
                                            className={cn(
                                                'grid grid-flow-col grid-cols-1 grid-rows-[repeat(var(--filas),minmax(52px,auto))] gap-x-4 gap-y-1 border-b px-1 py-3 [--filas:var(--f1)] @2xl/hoja:grid-cols-2 @2xl/hoja:[--filas:var(--f2)] @3xl/hoja:pr-5 @3xl/hoja:pl-[52px] @4xl/hoja:grid-cols-3 @4xl/hoja:[--filas:var(--f3)]',
                                                FILETE
                                            )}
                                        >
                                            {advisorsInOrder.map((advisor) => {
                                                const selected = selectedAdvisors.includes(advisor.id);
                                                const nombre = nombrePropio(advisor.name);

                                                return (
                                                    <li key={advisor.id} className="min-w-0">
                                                        <label
                                                            title={`${nombre} · ${advisor.email}`}
                                                            className={cn(
                                                                'relative flex h-full min-h-[52px] min-w-0 cursor-pointer items-center gap-3 rounded-[10px] px-3 py-1.5 transition-colors',
                                                                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#2e3f84]/40 has-[:focus-visible]:outline-hidden dark:has-[:focus-visible]:ring-[#8b9ae0]/60',
                                                                selected
                                                                    ? 'bg-[#2e3f84]/[0.045] dark:bg-white/[0.06]'
                                                                    : 'hover:bg-[#2e3f84]/[0.025] dark:hover:bg-white/[0.03]'
                                                            )}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                className="sr-only"
                                                                checked={selected}
                                                                onChange={() => toggleAdvisor(advisor.id)}
                                                            />
                                                            {/* Casilla: marcada navy con visto blanco; vacía con contorno pizarra 500 (4,76:1). */}
                                                            <span
                                                                className={cn(
                                                                    'flex size-[18px] shrink-0 items-center justify-center rounded-[5px] forced-colors:border forced-colors:border-[CanvasText]',
                                                                    selected
                                                                        ? 'bg-[#2e3f84] text-white dark:bg-[#596bcf]'
                                                                        : 'bg-white shadow-[inset_0_0_0_1.5px_var(--color-slate-500)] dark:bg-transparent dark:shadow-[inset_0_0_0_1.5px_var(--color-neutral-400)]'
                                                                )}
                                                                aria-hidden="true"
                                                            >
                                                                {selected && <Check className="size-3" strokeWidth={3} />}
                                                            </span>
                                                            <Iniciales name={advisor.name} className="size-[30px]" />
                                                            <span className="flex min-w-0 flex-col gap-px">
                                                                {/* Hasta dos líneas: los apellidos largos no se cortan a media palabra. */}
                                                                <span className={cn('line-clamp-2 text-[13px] leading-[18px] font-semibold break-words', TEXTO_NAVY)}>{nombre}</span>
                                                                <span className={cn('truncate text-[12px] leading-4', TEXTO_SUAVE)}>{advisor.email}</span>
                                                            </span>
                                                        </label>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}

                                    <Pie
                                        columna={false}
                                        final
                                        nota={t('settings.onDutyAdvisors.saveNote')}
                                        aviso={advisorsChanged && marcados.length === 0 ? t('settings.onDutyAdvisors.noneWarning') : undefined}
                                        pendiente={advisorsChanged && t('settings.unsaved')}
                                    >
                                        <Button
                                            type="button"
                                            onClick={saveOnDutyAdvisors}
                                            disabled={savingAdvisors || !advisorsChanged}
                                            className={cn(BOTON_PRIMARIO, advisorsChanged ? 'settings-btn-primary disabled:opacity-50' : BOTON_APAGADO)}
                                        >
                                            {botonGuardar(savingAdvisors, t('common.saveChanges'))}
                                        </Button>
                                    </Pie>
                                </>
                            )}
                        </section>

                        {/* ── 6. Equipos (Teleconsulta…) ── */}
                        <section aria-labelledby="settings-equipos" className={cn('border-t', FILETE)}>
                            <Banda
                                id="settings-equipos"
                                icon={Users}
                                titulo={t('settings.equipos.titulo')}
                                estado={
                                    <Estado tono={equipos.length > 0 ? 'ok' : 'neutro'}>
                                        {equipos.length > 0 ? t('settings.equipos.cuantos', { count: equipos.length }) : t('settings.equipos.ninguno')}
                                    </Estado>
                                }
                                texto={t('settings.equipos.bandaTexto')}
                                acciones={
                                    <button type="button" onClick={() => abrirEquipo(null)} className={BOTON_SECUNDARIO}>
                                        <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
                                        {t('settings.equipos.nuevo')}
                                    </button>
                                }
                            />
                            {equipos.length === 0 ? (
                                <p className={cn('border-b py-6 text-[13px] leading-[18px]', SANGRIA, FILETE, TEXTO_SUAVE)}>{t('settings.equipos.vacio')}</p>
                            ) : (
                                equipos.map((equipo) => (
                                    <div key={equipo.id} className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 border-b py-3.5', SANGRIA, FILETE)}>
                                        <div className="flex min-w-0 flex-[1_1_18rem] flex-col gap-[3px]">
                                            <span className={cn('text-[14px] leading-5 font-semibold', TEXTO_NAVY)}>{equipo.nombre}</span>
                                            <span className={cn('text-[12.5px] leading-[17px]', TEXTO_SUAVE)}>
                                                {equipo.miembros.length > 0 ? equipo.miembros.map(nombreDe).join(', ') : t('settings.equipos.sinMiembros')}
                                                {' · '}
                                                {t('settings.equipos.chatsAbiertos', { count: equipo.chats_abiertos })}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button type="button" onClick={() => abrirEquipo(equipo)} className={BOTON_SECUNDARIO}>
                                                <Pencil className="size-3.5" strokeWidth={2} aria-hidden="true" />
                                                {t('common.edit')}
                                            </button>
                                            <button type="button" onClick={() => setEquipoABorrar(equipo)} className={cn(BOTON_SECUNDARIO, 'text-red-700 dark:text-red-400')}>
                                                <Trash2 className="size-3.5" strokeWidth={2} aria-hidden="true" />
                                                {t('common.delete')}
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </section>
                    </div>
                </div>
            </div>

            {/* Crear / editar un equipo */}
            <Dialog open={!!editorEquipo} onOpenChange={(abierto) => !abierto && !guardandoEquipo && setEditorEquipo(null)}>
                <DialogContent className="card-gradient flex max-h-[min(720px,calc(100svh-2rem))] flex-col rounded-2xl shadow-2xl sm:max-w-lg sm:rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="settings-title">{editorEquipo?.id ? t('settings.equipos.editarTitulo') : t('settings.equipos.nuevoTitulo')}</DialogTitle>
                        <DialogDescription>{t('settings.equipos.editorAyuda')}</DialogDescription>
                    </DialogHeader>
                    {editorEquipo && (
                        <div className="flex min-h-0 flex-1 flex-col gap-3">
                            <label className="flex flex-col gap-1.5">
                                <span className={cn('text-[13px] font-semibold', TEXTO_NAVY)}>{t('settings.equipos.nombre')}</span>
                                <input
                                    type="text"
                                    value={editorEquipo.nombre}
                                    maxLength={80}
                                    onChange={(e) => setEditorEquipo({ ...editorEquipo, nombre: e.target.value })}
                                    placeholder={t('settings.equipos.nombreEjemplo')}
                                    className={cn('h-9 rounded-[10px] bg-[#2e3f84]/[0.035] px-3 text-[13.5px] text-foreground shadow-[inset_0_0_0_1px_rgba(46,63,132,0.1)] dark:bg-white/5 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]', FOCO)}
                                />
                            </label>
                            <div className="flex items-center justify-between gap-2">
                                <span className={cn('text-[13px] font-semibold', TEXTO_NAVY)}>{t('settings.equipos.miembros', { count: editorEquipo.miembros.length })}</span>
                                <input
                                    type="search"
                                    value={buscarEnEquipo}
                                    onChange={(e) => setBuscarEnEquipo(e.target.value)}
                                    placeholder={t('settings.onDutyAdvisors.searchPlaceholder')}
                                    aria-label={t('settings.onDutyAdvisors.searchLabel')}
                                    className={cn('h-8 w-44 rounded-[9px] bg-[#2e3f84]/[0.035] px-2.5 text-[12.5px] text-foreground shadow-[inset_0_0_0_1px_rgba(46,63,132,0.1)] dark:bg-white/5', FOCO)}
                                />
                            </div>
                            <ul className="custom-scrollbar min-h-0 flex-1 overflow-y-auto rounded-xl border border-[#2e3f84]/10 p-1 dark:border-white/10">
                                {[...advisors]
                                    .sort(ordenAlfabetico)
                                    .filter((a) => !buscarEnEquipo.trim() || plano(`${a.name} ${a.email}`).includes(plano(buscarEnEquipo.trim())))
                                    .map((a) => {
                                        const marcado = editorEquipo.miembros.includes(a.id);
                                        const otro = a.equipo_id && a.equipo_id !== editorEquipo.id ? equipoDe(a.equipo_id) : '';
                                        return (
                                            <li key={a.id}>
                                                <label className={cn('flex cursor-pointer items-center gap-3 rounded-[10px] px-2.5 py-2', marcado ? 'bg-[#2e3f84]/[0.05] dark:bg-white/[0.06]' : 'hover:bg-[#2e3f84]/[0.03]')}>
                                                    <input
                                                        type="checkbox"
                                                        checked={marcado}
                                                        onChange={() =>
                                                            setEditorEquipo({
                                                                ...editorEquipo,
                                                                miembros: marcado ? editorEquipo.miembros.filter((id) => id !== a.id) : [...editorEquipo.miembros, a.id],
                                                            })
                                                        }
                                                        className="size-4 accent-[#2e3f84]"
                                                    />
                                                    <span className="flex min-w-0 flex-col">
                                                        <span className={cn('truncate text-[13px] font-semibold', TEXTO_NAVY)}>{nombrePropio(a.name)}</span>
                                                        <span className={cn('truncate text-[12px]', TEXTO_SUAVE)}>
                                                            {a.email}
                                                            {otro && ` · ${t('settings.equipos.enOtro', { equipo: otro })}`}
                                                        </span>
                                                    </span>
                                                </label>
                                            </li>
                                        );
                                    })}
                            </ul>
                            <p className={cn('text-[12px] leading-[17px]', TEXTO_SUAVE)}>{t('settings.equipos.notaMiembros')}</p>
                            {errorEquipo && <p className="text-[12.5px] text-red-700 dark:text-red-400">{errorEquipo}</p>}
                        </div>
                    )}
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setEditorEquipo(null)} disabled={guardandoEquipo} className="rounded-xl">
                            {t('common.cancel')}
                        </Button>
                        <Button type="button" onClick={guardarEquipo} disabled={guardandoEquipo} className="settings-btn-primary rounded-xl">
                            {botonGuardar(guardandoEquipo, t('common.save'))}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Eliminar un equipo: sus chats vuelven a la línea general */}
            <Dialog open={!!equipoABorrar} onOpenChange={(abierto) => !abierto && setEquipoABorrar(null)}>
                <DialogContent className="card-gradient rounded-2xl shadow-2xl sm:rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="settings-title">{t('settings.equipos.eliminarTitulo', { equipo: equipoABorrar?.nombre ?? '' })}</DialogTitle>
                        <DialogDescription>{t('settings.equipos.eliminarTexto', { count: equipoABorrar?.chats_abiertos ?? 0 })}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setEquipoABorrar(null)} className="rounded-xl">
                            {t('common.cancel')}
                        </Button>
                        <Button type="button" onClick={eliminarEquipo} className="rounded-xl bg-red-600 text-white hover:bg-red-700">
                            {t('settings.equipos.eliminarBoton')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirmación al activar la liberación (o acortar su tiempo): puede desasignar muchas de golpe. */}
            <Dialog open={!!confirmarLiberacion} onOpenChange={(abierto) => !abierto && setConfirmarLiberacion(null)}>
                <DialogContent className="card-gradient rounded-2xl shadow-2xl sm:rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="settings-title">
                            {t(autoRelease.enabled ? 'settings.autoRelease.confirmTitleShorten' : 'settings.autoRelease.confirmTitle')}
                        </DialogTitle>
                        <DialogDescription className="settings-subtitle">
                            {confirmarLiberacion?.count != null
                                ? t('settings.autoRelease.confirmText', { count: confirmarLiberacion.count })
                                : t('settings.autoRelease.confirmUnknown')}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setConfirmarLiberacion(null)} className="rounded-xl">
                            {t('common.cancel')}
                        </Button>
                        <Button type="button" onClick={enviarLiberacion} className="settings-btn-primary rounded-xl">
                            {t(autoRelease.enabled ? 'settings.autoRelease.confirmButtonShorten' : 'settings.autoRelease.confirmButton')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AdminLayout>
    );
}
