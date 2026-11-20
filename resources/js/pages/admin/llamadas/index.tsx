import AdminLayout from '@/layouts/admin-layout';
import i18n from '@/i18n';
import { microfonoDisponible } from '@/lib/llamadas';
import { nombrePropio } from '@/lib/nombres';
import { agrupar, alAviso } from '@/lib/tiempo-real';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Head, Link, router } from '@inertiajs/react';
import axios from 'axios';
import {
    CalendarRange,
    Check,
    CircleAlert,
    CircleCheck,
    CircleHelp,
    Clock,
    Download,
    Headset,
    Loader2,
    Mic,
    Minus,
    Pause,
    PhoneIncoming,
    PhoneMissed,
    PhoneOff,
    Play,
    Plus,
    RotateCw,
    Search,
    Voicemail,
    X,
} from 'lucide-react';
import { type KeyboardEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * PANTALLA «LLAMADAS» (solo administradores). Diseño aprobado el 19/11/2026: design/vista-llamadas.
 *
 * Arriba lo que pasa ahora («En vivo», se refresca con cada aviso de tiempo real) y las cifras del periodo; debajo
 * cuatro pestañas: Historial, Buzón de voz, Indicadores y Ajustes. Cada parte pide sus datos a su ruta JSON
 * (LlamadasPanelController). Todas las horas se muestran en hora de Colombia.
 */

const ZONA = 'America/Bogota';
const BASE = '/admin/llamadas/panel';

type Tab = 'historial' | 'buzon' | 'indicadores' | 'ajustes';
const TABS: Tab[] = ['historial', 'buzon', 'indicadores', 'ajustes'];
type TipoPeriodo = 'hoy' | 'semana' | 'mes' | 'rango';
type Periodo = { tipo: TipoPeriodo; desde: string; hasta: string };
type Resultado = 'timbrando' | 'en_curso' | 'atendida' | 'cortada' | 'buzon' | 'fuera_horario' | 'fallida' | 'perdida';
type Estado = 'ok' | 'falta' | 'desconocido';

type Fila = { id: number; conversation_id: number | null; nombre: string | null; telefono: string | null };
type Timbrando = Fila & { espera: number; le_timbra_asesores: number; le_timbra_admins: number };
type EnCurso = Fila & { atendio: string | null; desde: string | null };
type Vivo = {
    activas: boolean;
    timbrando: Timbrando[];
    en_curso: EnCurso[];
    asesores_turno_conectados: number;
    horario: { dias: number[]; desde: string; hasta: string; abierto: boolean };
    buzon_sin_resolver: number;
    /** Segundos que timbra una llamada antes de irse al buzón (el ajuste «antes del buzón»). */
    segundos_timbre?: number;
    /** Cuándo llegó (para que los contadores sigan corriendo entre una consulta y otra). */
    recibido: number;
};
type Resumen = {
    total: number;
    atendidas: number;
    buzon: number;
    perdidas: number;
    en_curso: number;
    espera_promedio: number;
    duracion_promedio: number;
};
type FilaHistorial = Fila & { inicio: string | null; resultado: Resultado; atendio: string | null; espera: number | null; duracion: number | null };
type Historial = { total: number; pagina: number; paginas: number; filas: FilaHistorial[]; asesores: { id: number; name: string }[] };
type Barra = { hora: number | null; atendidas: number; buzon: number; perdidas: number };
type PorAsesor = { id: number; nombre: string; atendidas: number; hablando: number; duracion_promedio: number; espera_promedio: number; cortadas: number };
type Indicadores = { por_hora: Barra[]; fuera_de_horario: Barra; resumen: Resumen; por_asesor: PorAsesor[] };
type FilaBuzon = Fila & {
    cuando: string | null;
    fuera_de_horario: boolean;
    audio: string | null;
    transcripcion: string | null;
    resuelto_en: string | null;
    resuelto_por: string | null;
};
type Buzon = { sin_resolver: number; filas: FilaBuzon[] };
type AjustesBase = { dias: number[]; desde: string; hasta: string; festivos: string[]; modo: 'turno' | 'grupo'; grupo: number[] };
type AjustesForm = AjustesBase & { espera: number };
type AjustesRespuesta = { ajustes: AjustesBase; espera: number; usuarios: { id: number; name: string; role: string }[] };
type Conexion = { numero: Estado; campo_calls: Estado; firma: 'ok' | 'falta'; anuncio: 'ok' | 'falta'; llamadas_meta: Estado; activas: boolean };

// ── Estilos compartidos (los de Usuarios y Estadísticas) ──────────────────────────────────────────────────────────

const TARJETA =
    'rounded-2xl bg-card shadow-[0_0_0_1px_rgba(46,63,132,0.07),0_1px_2px_rgba(46,63,132,0.05),0_14px_32px_-18px_rgba(46,63,132,0.22)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07),0_14px_32px_-18px_rgba(0,0,0,0.6)]';
const FILETE = 'border-[#2e3f84]/8 dark:border-white/8';
const NAVY = 'text-[#1e2550] dark:text-neutral-100';
const SUAVE = 'text-[#5c6485] dark:text-neutral-400';
const MEDIO = 'text-[#3c4570] dark:text-neutral-300';
const ENLACE = 'font-semibold text-[#2e3f84] underline-offset-2 hover:underline dark:text-[#aab6ee]';
/** Los enlaces de texto miden 15–18 px de alto: el área de clic crece por fuera (≈40 px) sin mover nada. Solo donde lo
 *  vecino interactivo queda a 12 px o más (si no, las áreas se pisarían). */
const AREA_ENLACE = 'relative after:absolute after:-inset-x-1.5 after:-inset-y-3';
const CAMPO =
    'bg-[#f2f4f9] shadow-[inset_0_0_0_1px_#d4d8e8] dark:bg-white/[0.04] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]';
const SEGMENTADO = 'flex shrink-0 rounded-[12px] bg-[#e7ebf4] p-[3px] shadow-[inset_0_0_0_1px_#d4d8e8] dark:bg-white/[0.05] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]';
const SEG_BOTON =
    'flex h-8 items-center gap-1.5 whitespace-nowrap rounded-[9px] px-3.5 text-[13px] transition-[background-color,color,box-shadow] duration-150 focus-visible:outline-offset-0';
const SEG_SI = 'bg-white font-semibold text-[#2e3f84] shadow-[0_1px_2px_rgba(46,63,132,.12),0_2px_6px_rgba(46,63,132,.08)] dark:bg-white/[0.12] dark:text-white';
const SEG_NO = 'font-medium text-[#4a5378] hover:text-[#1e2550] dark:text-neutral-400 dark:hover:text-neutral-100';
/** El input del buscador no pinta borde propio: el anillo de foco va en su contenedor (el mismo del resto de la app). */
const ANILLO_CAMPO =
    'has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-[#2e3f84] dark:has-[input:focus-visible]:outline-[#53bdeb]';
const BOTON_PRIMARIO =
    'inline-flex h-9 items-center justify-center gap-2 rounded-[10px] bg-gradient-to-b from-[#3e4f94] to-[#2e3f84] px-3.5 text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(30,37,80,.25),inset_0_1px_0_rgba(255,255,255,.12)] transition-[filter,scale] duration-150 hover:brightness-110 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50';
const BOTON_SECUNDARIO =
    'inline-flex h-9 items-center justify-center gap-2 rounded-[10px] bg-gradient-to-b from-white to-[#f7f8fb] px-3.5 text-[13px] font-semibold text-[#2e3f84] shadow-[0_0_0_1px_#d4d8e8,0_1px_2px_rgba(46,63,132,.06)] transition-[background-color,scale] duration-150 hover:from-[#f7f8fb] active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50 dark:from-white/[0.07] dark:to-white/[0.04] dark:text-neutral-100 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.1)]';

// ── Formatos (hora de Colombia) ─────────────────────────────────────────────────────────────────────────────────────

const idioma = () => (i18n.language?.startsWith('en') ? 'en-US' : 'es-CO');

/** "2026-11-19" del instante dado, en Colombia. */
function diaDe(fecha: Date): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(fecha);
}

function hoyEnColombia(): string {
    return diaDe(new Date());
}

/** Suma días a un "AAAA-MM-DD" (sin zonas: se trabaja en UTC puro). */
function sumarDias(dia: string, n: number): string {
    const [a, m, d] = dia.split('-').map(Number);
    return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

function hora(iso: string | null): string {
    if (!iso) return '—';
    return new Intl.DateTimeFormat(idioma(), { timeZone: ZONA, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso));
}

/** "06:30" → "6:30 a. m." (con espacios que no parten: la hora nunca queda «4:00» en una línea y «p. m.» en otra). */
function horaDeReloj(hhmm: string): string {
    const [h, m] = hhmm.split(':').map(Number);
    return new Intl.DateTimeFormat(idioma(), { timeZone: 'UTC', hour: 'numeric', minute: '2-digit', hour12: true })
        .format(new Date(Date.UTC(2000, 0, 1, h, m)))
        .replace(/\s/g, '\u00a0');
}

/** "2026-12-08" → "lunes 8 de diciembre" (o "Monday, December 8"). */
function fechaLarga(dia: string, conDiaSemana = true): string {
    const [a, m, d] = dia.split('-').map(Number);
    return new Intl.DateTimeFormat(idioma(), {
        timeZone: 'UTC',
        ...(conDiaSemana ? { weekday: 'long' } : {}),
        day: 'numeric',
        month: 'long',
    })
        .format(new Date(Date.UTC(a, m - 1, d)))
        .replace(',', '');
}

/** Nombre del día 1 (lunes) … 7 (domingo). El 1/1/2024 fue lunes. */
function nombreDia(n: number, formato: 'long' | 'short'): string {
    const texto = new Intl.DateTimeFormat(idioma(), { timeZone: 'UTC', weekday: formato }).format(new Date(Date.UTC(2024, 0, n)));
    return formato === 'short' ? texto.charAt(0).toLocaleUpperCase() + texto.slice(1).replace('.', '') : texto;
}

/** 222 → "3:42"; null → "—". */
function mmss(segundos: number | null | undefined): string {
    if (segundos === null || segundos === undefined || !Number.isFinite(segundos)) return '—';
    const s = Math.max(0, Math.round(segundos));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = String(s % 60).padStart(2, '0');
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

function porcentaje(parte: number, total: number): string {
    if (!total) return '';
    return new Intl.NumberFormat(idioma(), { style: 'percent', maximumFractionDigits: 1 }).format(parte / total);
}

function numero(n: number): string {
    return new Intl.NumberFormat(idioma()).format(n);
}

/** "573154824421" → "+57 315 482 4421". */
function telefono(t: string | null): string {
    const d = (t ?? '').replace(/\D/g, '');
    if (!d) return '';
    if (d.length === 12 && d.startsWith('57')) return `+57 ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
    return `+${d}`;
}

function paramsDe(o: Record<string, string | number | undefined | null>): string {
    const p = new URLSearchParams();
    Object.entries(o).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
    });
    return p.toString();
}

function paramsPeriodo(p: Periodo): Record<string, string> {
    return p.tipo === 'rango' ? { periodo: 'rango', desde: p.desde, hasta: p.hasta } : { periodo: p.tipo };
}

/** Cambia parámetros de la dirección sin recargar ni pedir nada (null quita el parámetro). */
function ponerEnDireccion(cambios: Record<string, string | null>) {
    try {
        const url = new URL(window.location.href);
        Object.entries(cambios).forEach(([k, v]) => (v ? url.searchParams.set(k, v) : url.searchParams.delete(k)));
        window.history.replaceState(window.history.state, '', url.toString());
    } catch {
        // sin dirección: no pasa nada
    }
}

/** El periodo guardado en la dirección (?periodo=semana, o rango con desde y hasta); si falta o no sirve, «hoy». */
function periodoDeDireccion(): Periodo {
    const hoy = hoyEnColombia();
    try {
        const p = new URLSearchParams(window.location.search);
        const tipo = p.get('periodo');
        if (tipo === 'semana' || tipo === 'mes') return { tipo, desde: hoy, hasta: hoy };
        const desde = p.get('desde') ?? '';
        const hasta = p.get('hasta') ?? '';
        const dia = /^\d{4}-\d{2}-\d{2}$/;
        if (tipo === 'rango' && dia.test(desde) && dia.test(hasta) && desde <= hasta && hasta <= hoy) return { tipo: 'rango', desde, hasta };
    } catch {
        // sin dirección: hoy
    }
    return { tipo: 'hoy', desde: hoy, hasta: hoy };
}

const RESULTADOS_FILTRABLES = ['atendida', 'buzon', 'perdida', 'cortada', 'fuera_horario', 'fallida', 'en_curso'];

/** Los filtros del historial guardados en la dirección (la búsqueda escrita no se guarda). */
function filtrosDeDireccion(): Filtros {
    try {
        const p = new URLSearchParams(window.location.search);
        const resultado = p.get('resultado') ?? '';
        const atendio = p.get('atendio') ?? '';
        return { resultado: RESULTADOS_FILTRABLES.includes(resultado) ? resultado : '', atendio: /^\d+$/.test(atendio) ? atendio : '', buscar: '' };
    } catch {
        return { resultado: '', atendio: '', buscar: '' };
    }
}

/** Pide JSON cada vez que cambia la dirección o la versión; ignora respuestas viejas. `reintentar` vuelve a pedirlo. */
function useDatos<T>(url: string | null, version: number) {
    const [datos, setDatos] = useState<T | null>(null);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState(false);
    const [intento, setIntento] = useState(0);
    const reintentar = useCallback(() => setIntento((n) => n + 1), []);
    useEffect(() => {
        if (!url) return;
        let vigente = true;
        setCargando(true);
        axios
            .get<T>(url)
            .then((r) => {
                if (!vigente) return;
                setDatos(r.data);
                setError(false);
            })
            .catch(() => {
                if (vigente) setError(true);
            })
            .finally(() => {
                if (vigente) setCargando(false);
            });
        return () => {
            vigente = false;
        };
    }, [url, version, intento]);
    return { datos, setDatos, cargando, error, reintentar };
}

/** No se pudieron traer los datos: lo dice y deja volver a intentarlo ahí mismo. */
function ErrorCarga({ onReintentar, className }: { onReintentar: () => void; className?: string }) {
    const { t } = useTranslation();
    return (
        <div role="alert" className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-8 text-[13px] text-red-700 dark:text-red-400', className)}>
            <p className="flex items-center gap-2">
                <CircleAlert className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                {t('llamadas.panel.errorCarga')}
            </p>
            <button type="button" onClick={onReintentar} className={BOTON_SECUNDARIO}>
                <RotateCw className="size-4" strokeWidth={2} aria-hidden="true" />
                {t('llamadas.panel.reintentar')}
            </button>
        </div>
    );
}

// ── La página ───────────────────────────────────────────────────────────────────────────────────────────────────────

type Props = { activas: boolean; tabInicial: Tab };

export default function LlamadasIndex({ activas, tabInicial }: Props) {
    const { t } = useTranslation();
    const [tab, setTab] = useState<Tab>(tabInicial);
    // El periodo y los filtros quedan en la dirección (como en Estadísticas): al recargar o compartir el enlace se conservan.
    const [periodo, setPeriodoEstado] = useState<Periodo>(periodoDeDireccion);
    const setPeriodo = useCallback((p: Periodo) => {
        setPeriodoEstado(p);
        ponerEnDireccion(p.tipo === 'rango' ? { periodo: 'rango', desde: p.desde, hasta: p.hasta } : { periodo: p.tipo === 'hoy' ? null : p.tipo, desde: null, hasta: null });
    }, []);
    /** Sube con cada aviso de llamada: las pestañas vuelven a pedir sus datos. */
    const [version, setVersion] = useState(0);
    const [vivo, setVivo] = useState<Vivo | null>(null);
    // La última consulta de «En vivo» falló: lo que se ve puede estar viejo (la franja lo dice).
    const [vivoSinConexion, setVivoSinConexion] = useState(false);
    const [sinResolver, setSinResolver] = useState<number | null>(null);
    // Ajustes se queda montado (oculto) una vez abierto: así los cambios sin guardar no se pierden al cambiar de pestaña.
    const [ajustesAbierto, setAjustesAbierto] = useState(tabInicial === 'ajustes');
    const [ajustesPendientes, setAjustesPendientes] = useState(false);

    // ── En vivo: al entrar, con cada aviso de llamada y, de respaldo, cada ~20 s con la pestaña a la vista ──
    const pedirVivo = useCallback(async () => {
        try {
            const r = await axios.get<Omit<Vivo, 'recibido'>>(`${BASE}/en-vivo`);
            setVivo({ ...r.data, recibido: Date.now() });
            setSinResolver(r.data.buzon_sin_resolver);
            setVivoSinConexion(false);
        } catch {
            // Sin red: se queda lo último que llegó (la franja avisa que puede estar viejo); el siguiente ciclo reintenta.
            setVivoSinConexion(true);
        }
    }, []);

    useEffect(() => {
        let cerrado = false;
        let temporizador: ReturnType<typeof setTimeout> | null = null;
        // Una consulta tras otra (nunca dos a la vez) y con algo de azar: varias pantallas abiertas no piden juntas.
        const ciclo = async () => {
            if (document.visibilityState === 'visible') await pedirVivo();
            if (!cerrado) temporizador = setTimeout(ciclo, 20000 + Math.floor(Math.random() * 4000));
        };
        void ciclo();
        const porAviso = agrupar(
            () => {
                void pedirVivo();
                setVersion((v) => v + 1);
            },
            500,
            2000,
            1500,
        );
        const quitar = alAviso((aviso) => {
            if (aviso.tipo === 'llamada' || aviso.tipo === 'reconectado') porAviso();
        });
        const alVolver = () => {
            if (document.visibilityState === 'visible') void pedirVivo();
        };
        document.addEventListener('visibilitychange', alVolver);
        return () => {
            cerrado = true;
            if (temporizador) clearTimeout(temporizador);
            quitar();
            document.removeEventListener('visibilitychange', alVolver);
        };
    }, [pedirVivo]);

    /** Colgó desde aquí: la fila sale al instante (sin esperar al aviso de Meta) y luego se confirma con el servidor. */
    const alColgar = useCallback(
        (id: number) => {
            setVivo((v) => (v ? { ...v, en_curso: v.en_curso.filter((l) => l.id !== id) } : v));
            void pedirVivo();
        },
        [pedirVivo],
    );

    const cambiarTab = useCallback((nueva: Tab) => {
        setTab(nueva);
        if (nueva === 'ajustes') setAjustesAbierto(true);
        ponerEnDireccion({ tab: nueva === 'historial' ? null : nueva });
    }, []);

    const conPeriodo = tab === 'historial' || tab === 'indicadores';
    const subtitulo = useMemo(() => {
        if (!conPeriodo) return t('llamadas.panel.subtitulo');
        const hoy = hoyEnColombia();
        let desde = hoy;
        if (periodo.tipo === 'semana') {
            const dow = new Date(`${hoy}T12:00:00Z`).getUTCDay(); // 0 = domingo
            desde = sumarDias(hoy, -((dow + 6) % 7));
        } else if (periodo.tipo === 'mes') desde = `${hoy.slice(0, 8)}01`;
        else if (periodo.tipo === 'rango') desde = periodo.desde;
        const hasta = periodo.tipo === 'rango' ? periodo.hasta : hoy;
        const cuando = desde === hasta ? fechaLarga(desde) : t('llamadas.panel.delAl', { desde: fechaLarga(desde, false), hasta: fechaLarga(hasta, false) });
        return `${t('llamadas.panel.subtitulo')} · ${cuando}`;
    }, [conPeriodo, periodo, t]);

    const sufijoPeriodo = {
        hoy: t('llamadas.panel.periodo.sufijoHoy'),
        semana: t('llamadas.panel.periodo.sufijoSemana'),
        mes: t('llamadas.panel.periodo.sufijoMes'),
        rango: t('llamadas.panel.periodo.sufijoRango'),
    }[periodo.tipo];

    // Filtros del historial (también los usa «Exportar a Excel»).
    const [filtros, setFiltrosEstado] = useState<Filtros>(filtrosDeDireccion);
    const setFiltros = useCallback((f: Filtros) => {
        setFiltrosEstado(f);
        ponerEnDireccion({ resultado: f.resultado || null, atendio: f.atendio || null });
    }, []);
    // Cuántas llamadas hay con el periodo y los filtros del historial (null mientras carga): con 0 no se exporta.
    const [totalHistorial, setTotalHistorial] = useState<number | null>(null);
    const exportar = `${BASE}/exportar?${paramsDe({ ...paramsPeriodo(periodo), ...filtros })}`;

    const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ historial: null, buzon: null, indicadores: null, ajustes: null });
    const alTeclaTabs = (e: KeyboardEvent<HTMLDivElement>) => {
        const i = TABS.indexOf(tab);
        let j = -1;
        if (e.key === 'ArrowRight') j = (i + 1) % TABS.length;
        else if (e.key === 'ArrowLeft') j = (i - 1 + TABS.length) % TABS.length;
        else if (e.key === 'Home') j = 0;
        else if (e.key === 'End') j = TABS.length - 1;
        if (j < 0) return;
        e.preventDefault();
        cambiarTab(TABS[j]);
        tabRefs.current[TABS[j]]?.focus();
    };

    const nombreTab: Record<Tab, string> = {
        historial: t('llamadas.panel.tabs.historial'),
        buzon: t('llamadas.panel.tabs.buzon'),
        indicadores: t('llamadas.panel.tabs.indicadores'),
        ajustes: t('llamadas.panel.tabs.ajustes'),
    };

    return (
        <AdminLayout>
            <Head title={t('llamadas.panel.titulo')} />

            <div className="min-h-screen bg-background px-4 pt-5 pb-10 md:px-7 md:pt-7">
                <div className="mx-auto flex max-w-7xl flex-col gap-5">
                    {/* ── Cabecera: título; a la derecha el periodo (solo en las pestañas que lo usan) ── */}
                    <header className="flex min-h-[38px] flex-wrap items-end justify-between gap-x-6 gap-y-3">
                        <div className="min-w-0">
                            <h1 className={cn('text-[24px] leading-[30px] font-semibold tracking-[-0.02em] text-balance', NAVY)}>{t('llamadas.panel.titulo')}</h1>
                            <p className={cn('mt-0.5 text-[13px] leading-[18px]', SUAVE)}>{subtitulo}</p>
                        </div>
                        {conPeriodo && (
                            <div className="flex max-w-full flex-wrap items-center gap-2.5">
                                <SelectorPeriodo periodo={periodo} onCambiar={setPeriodo} />
                                {tab === 'historial' &&
                                    (totalHistorial === 0 ? (
                                        // aria-disabled (no disabled): sigue recibiendo el ratón y el foco, así se lee por qué no exporta.
                                        <button
                                            type="button"
                                            aria-disabled="true"
                                            title={t('llamadas.panel.exportarVacio')}
                                            className={cn(BOTON_SECUNDARIO, 'cursor-not-allowed opacity-50 active:scale-100')}
                                        >
                                            <Download className="size-4" strokeWidth={2} aria-hidden="true" />
                                            {t('llamadas.panel.exportar')}
                                        </button>
                                    ) : (
                                        <a href={exportar} className={BOTON_SECUNDARIO}>
                                            <Download className="size-4" strokeWidth={2} aria-hidden="true" />
                                            {t('llamadas.panel.exportar')}
                                        </a>
                                    ))}
                            </div>
                        )}
                    </header>

                    {!activas && <AvisoApagadas onAjustes={() => cambiarTab('ajustes')} enAjustes={tab === 'ajustes'} />}

                    {/* En vivo es de toda la pantalla: la misma franja en las cuatro pestañas, así las pestañas no se mueven al
                        cambiar de una a otra. Solo crece cuando hay llamadas sonando o en curso. */}
                    <EnVivo
                        vivo={vivo}
                        sinConexion={vivoSinConexion}
                        onReintentar={() => void pedirVivo()}
                        onColgada={alColgar}
                        onIrAjustes={() => cambiarTab('ajustes')}
                    />

                    <div role="tablist" aria-label={t('llamadas.panel.tabs.etiqueta')} onKeyDown={alTeclaTabs} className={cn('-mb-1 flex overflow-x-auto border-b [scrollbar-width:none] sm:gap-1', FILETE)}>
                        {TABS.map((id) => {
                            const si = id === tab;
                            return (
                                <button
                                    key={id}
                                    ref={(el) => {
                                        tabRefs.current[id] = el;
                                    }}
                                    type="button"
                                    role="tab"
                                    id={`tab-${id}`}
                                    aria-selected={si}
                                    aria-controls={si ? `panel-${id}` : undefined}
                                    tabIndex={si ? 0 : -1}
                                    onClick={() => cambiarTab(id)}
                                    className={cn(
                                        'flex h-[38px] shrink-0 items-center gap-2 px-2.5 text-[13px] whitespace-nowrap transition-colors duration-150 focus-visible:outline-offset-[-2px] sm:px-3.5',
                                        si
                                            ? 'font-semibold text-[#2e3f84] shadow-[inset_0_-2px_0_#2e3f84] dark:text-white dark:shadow-[inset_0_-2px_0_#aab6ee]'
                                            : 'font-medium text-[#4a5378] hover:text-[#1e2550] dark:text-neutral-400 dark:hover:text-neutral-100',
                                    )}
                                >
                                    {nombreTab[id]}
                                    {id === 'ajustes' && ajustesPendientes && (
                                        <>
                                            <span aria-hidden="true" title={t('llamadas.panel.ajustes.cambiosSinGuardar')} className="size-2 rounded-full bg-amber-600 dark:bg-amber-400" />
                                            <span className="sr-only">({t('llamadas.panel.ajustes.cambiosSinGuardar')})</span>
                                        </>
                                    )}
                                    {id === 'buzon' && !!sinResolver && (
                                        <span
                                            aria-label={t('llamadas.panel.buzon.sinResolverCuenta', { count: sinResolver })}
                                            className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#b45309] px-1.5 text-[11px] font-bold text-white tabular-nums"
                                        >
                                            {sinResolver > 99 ? '99+' : sinResolver}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={-1} className="outline-none">
                        {tab === 'historial' && (
                            <div className="flex flex-col gap-4">
                                {/* Las cifras son del periodo del historial: van dentro de su pestaña, sobre la tabla. */}
                                <Cifras url={`${BASE}/cifras?${paramsDe(paramsPeriodo(periodo))}`} version={version} />
                                <PestanaHistorial periodo={periodo} sufijoPeriodo={sufijoPeriodo} filtros={filtros} onFiltros={setFiltros} version={version} activas={activas} onTotal={setTotalHistorial} />
                            </div>
                        )}
                        {tab === 'buzon' && <PestanaBuzon version={version} onSinResolver={setSinResolver} />}
                        {tab === 'indicadores' && <PestanaIndicadores url={`${BASE}/indicadores?${paramsDe(paramsPeriodo(periodo))}`} version={version} />}
                        {(tab === 'ajustes' || ajustesAbierto) && (
                            <div hidden={tab !== 'ajustes'}>
                                <PestanaAjustes onPendientes={setAjustesPendientes} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}

// ── Aviso: llamadas apagadas ────────────────────────────────────────────────────────────────────────────────────────

function AvisoApagadas({ onAjustes, enAjustes }: { onAjustes: () => void; enAjustes: boolean }) {
    const { t } = useTranslation();
    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-[#eef0f7] px-4 py-3 text-[13px] leading-[18px] text-[#3c4570] shadow-[inset_0_0_0_1px_#dde1ee] dark:bg-white/[0.05] dark:text-neutral-300 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
            <PhoneOff className="size-4 shrink-0 text-[#5c6485] dark:text-neutral-400" strokeWidth={2} aria-hidden="true" />
            <p className="min-w-0 flex-1 text-pretty">{t('llamadas.panel.apagadas')}</p>
            {!enAjustes && (
                <button type="button" onClick={onAjustes} className={cn('text-[13px]', ENLACE, AREA_ENLACE)}>
                    {t('llamadas.panel.verQueFalta')}
                </button>
            )}
        </div>
    );
}

// ── Periodo ─────────────────────────────────────────────────────────────────────────────────────────────────────────

function SelectorPeriodo({ periodo, onCambiar }: { periodo: Periodo; onCambiar: (p: Periodo) => void }) {
    const { t } = useTranslation();
    const [abierto, setAbierto] = useState(false);
    const [desde, setDesde] = useState(periodo.desde);
    const [hasta, setHasta] = useState(periodo.hasta);
    const caja = useRef<HTMLDivElement>(null);
    const botonFechas = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!abierto) return;
        const fuera = (e: PointerEvent) => {
            if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
        };
        const tecla = (e: globalThis.KeyboardEvent) => {
            if (e.key === 'Escape') {
                setAbierto(false);
                botonFechas.current?.focus();
            }
        };
        document.addEventListener('pointerdown', fuera);
        document.addEventListener('keydown', tecla);
        return () => {
            document.removeEventListener('pointerdown', fuera);
            document.removeEventListener('keydown', tecla);
        };
    }, [abierto]);

    const opciones: { id: Exclude<TipoPeriodo, 'rango'>; texto: string }[] = [
        { id: 'hoy', texto: t('llamadas.panel.periodo.hoy') },
        { id: 'semana', texto: t('llamadas.panel.periodo.semana') },
        { id: 'mes', texto: t('llamadas.panel.periodo.mes') },
    ];
    const hoy = hoyEnColombia();

    return (
        <div ref={caja} className="relative max-w-full">
            <div role="group" aria-label={t('llamadas.panel.periodo.etiqueta')} className={cn(SEGMENTADO, 'max-w-full overflow-x-auto')}>
                {opciones.map((o) => (
                    <button
                        key={o.id}
                        type="button"
                        aria-pressed={periodo.tipo === o.id}
                        onClick={() => onCambiar({ tipo: o.id, desde: hoy, hasta: hoy })}
                        className={cn(SEG_BOTON, periodo.tipo === o.id ? SEG_SI : SEG_NO)}
                    >
                        {o.texto}
                    </button>
                ))}
                <button
                    ref={botonFechas}
                    type="button"
                    aria-pressed={periodo.tipo === 'rango'}
                    aria-expanded={abierto}
                    onClick={() => setAbierto((a) => !a)}
                    className={cn(SEG_BOTON, 'px-3', periodo.tipo === 'rango' ? SEG_SI : SEG_NO)}
                >
                    <CalendarRange className="size-[15px]" strokeWidth={2} aria-hidden="true" />
                    {t('llamadas.panel.periodo.fechas')}
                </button>
            </div>
            {abierto && (
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!desde || !hasta) return;
                        onCambiar({ tipo: 'rango', desde: desde <= hasta ? desde : hasta, hasta: desde <= hasta ? hasta : desde });
                        setAbierto(false);
                    }}
                    className={cn(TARJETA, 'absolute right-0 z-30 mt-2 flex w-[280px] origin-top-right animate-in fade-in-0 zoom-in-95 duration-150 motion-reduce:animate-none shadow-[0_0_0_1px_rgba(46,63,132,0.08),0_2px_4px_rgba(46,63,132,0.06),0_16px_36px_-10px_rgba(30,37,80,0.3)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_16px_36px_-10px_rgba(0,0,0,0.7)] flex-col gap-3 p-4')}
                >
                    <label className={cn('flex flex-col gap-1 text-[12px] font-medium', MEDIO)}>
                        {t('llamadas.panel.periodo.desde')}
                        <input type="date" value={desde} max={hoy} onChange={(e) => setDesde(e.target.value)} className={cn(CAMPO, 'h-9 rounded-[9px] px-2.5 text-[16px] sm:text-[13px]', NAVY)} required />
                    </label>
                    <label className={cn('flex flex-col gap-1 text-[12px] font-medium', MEDIO)}>
                        {t('llamadas.panel.periodo.hasta')}
                        <input type="date" value={hasta} max={hoy} onChange={(e) => setHasta(e.target.value)} className={cn(CAMPO, 'h-9 rounded-[9px] px-2.5 text-[16px] sm:text-[13px]', NAVY)} required />
                    </label>
                    <button type="submit" className={BOTON_PRIMARIO}>
                        {t('llamadas.panel.periodo.aplicar')}
                    </button>
                </form>
            )}
        </div>
    );
}

// ── En vivo ─────────────────────────────────────────────────────────────────────────────────────────────────────────

function textoDias(dias: number[], textos: { lunesAViernes: string; todos: string; ninguno: string }): string {
    const orden = [...dias].sort((a, b) => a - b);
    if (orden.join() === '1,2,3,4,5') return textos.lunesAViernes;
    if (orden.length === 7) return textos.todos;
    if (!orden.length) return textos.ninguno;
    return orden.map((d) => nombreDia(d, 'long')).join(', ');
}

/** «40 s» o «3 min»: hace cuánto llegó lo último de «En vivo». */
function haceCuanto(segundos: number): string {
    return segundos < 60 ? `${segundos} s` : `${Math.floor(segundos / 60)} min`;
}

function EnVivo({
    vivo,
    sinConexion,
    onReintentar,
    onColgada,
    onIrAjustes,
}: {
    vivo: Vivo | null;
    sinConexion: boolean;
    onReintentar: () => void;
    onColgada: (id: number) => void;
    onIrAjustes: () => void;
}) {
    const { t } = useTranslation();
    // Los contadores (espera, en curso, «actualizado hace…») corren cada segundo solo aquí y solo cuando hace falta.
    const [ahora, setAhora] = useState(() => Date.now());
    const corre = sinConexion || (!!vivo && vivo.timbrando.length + vivo.en_curso.length > 0);
    useEffect(() => {
        if (!corre) return;
        setAhora(Date.now());
        const id = setInterval(() => setAhora(Date.now()), 1000);
        return () => clearInterval(id);
    }, [corre]);
    const pasado = vivo ? Math.max(0, Math.floor((ahora - vivo.recibido) / 1000)) : 0;
    const filas = vivo ? vivo.timbrando.length + vivo.en_curso.length : 0;
    // Angosto: cada llamada en tres líneas (paciente y botones; estado; a quién le timbra). Desde lg, en una sola. Así los
    // botones nunca quedan fuera de la vista (antes la fila se desplazaba de lado y «Colgar» no se veía en el celular).
    const columnas =
        "grid grid-cols-[36px_minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 border-t py-2.5 [grid-template-areas:'i_p_a'_'i_e_e'_'i_d_d'] lg:min-h-11 lg:grid-cols-[36px_minmax(0,1.25fr)_minmax(0,1.5fr)_minmax(0,1.6fr)_150px] lg:items-center lg:gap-x-3.5 lg:py-1 lg:[grid-template-areas:'i_p_e_d_a']";

    return (
        // Sin título ni punto con halo (20/11/2026, se veía «de IA»): la franja dice solo lo que pasa. El nombre «En vivo»
        // queda para el lector de pantalla.
        <section aria-label={t('llamadas.panel.vivo.titulo')} className={cn(TARJETA, 'px-4 sm:px-5')}>
            {/* Sin llamadas, una sola línea: lo que pasa, quién está conectado y el horario. Las filas solo aparecen si hay. */}
            <div className="flex min-h-[52px] flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                    {!vivo &&
                        (sinConexion ? (
                            <span role="alert" className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-red-700 dark:text-red-400">
                                <span className="flex items-center gap-1.5">
                                    <CircleAlert className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                                    {t('llamadas.panel.errorCarga')}
                                </span>
                                <button type="button" onClick={onReintentar} className={cn('text-[13px]', ENLACE, AREA_ENLACE)}>
                                    {t('llamadas.panel.reintentar')}
                                </button>
                            </span>
                        ) : (
                            <span className={cn('flex items-center gap-1.5 text-[13px]', SUAVE)}>
                                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                                {t('llamadas.panel.cargando')}
                            </span>
                        ))}
                    {vivo && (
                        // Una frase: «2 timbrando · 2 en curso · 6 asesores de turno conectados», o «No hay llamadas en este
                        // momento · …». El color va en las palabras, sin píldoras.
                        <p className="text-[14px] leading-5 text-pretty tabular-nums" aria-live="polite">
                            {filas === 0 && <span className={NAVY}>{t('llamadas.panel.vivo.nada')}</span>}
                            {!!vivo.timbrando.length && (
                                <span className="font-semibold text-amber-800 dark:text-amber-300">
                                    {t('llamadas.panel.vivo.timbrandoCuenta', { count: vivo.timbrando.length })}
                                </span>
                            )}
                            {!!vivo.timbrando.length && !!vivo.en_curso.length && <span className={SUAVE}> · </span>}
                            {!!vivo.en_curso.length && (
                                <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                                    {t('llamadas.panel.vivo.enCursoCuenta', { count: vivo.en_curso.length })}
                                </span>
                            )}
                            <span className={SUAVE}>
                                {' · '}
                                {t('llamadas.panel.vivo.asesoresConectados', { count: vivo.asesores_turno_conectados })}
                            </span>
                        </p>
                    )}
                </div>
                {vivo && (
                    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] leading-[18px]', SUAVE)}>
                        {sinConexion && (
                            <span role="status" className="flex items-center gap-1.5 font-semibold text-amber-800 tabular-nums dark:text-amber-300">
                                <CircleAlert className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                                {t('llamadas.panel.vivo.sinConexion', { tiempo: haceCuanto(pasado) })}
                            </span>
                        )}
                        <p className="flex min-w-0 items-start gap-1.5">
                            <Clock className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                            <span className="text-pretty">
                                <span
                                    className={cn(
                                        'font-semibold',
                                        !vivo.activas ? MEDIO : vivo.horario.abierto ? 'text-emerald-700 dark:text-emerald-400' : MEDIO,
                                    )}
                                >
                                    {!vivo.activas
                                        ? t('llamadas.panel.vivo.apagadasAhora')
                                        : vivo.horario.abierto
                                          ? t('llamadas.panel.vivo.abiertoAhora')
                                          : t('llamadas.panel.vivo.fueraDeHorarioAhora')}
                                </span>
                                {' · '}
                                {t('llamadas.panel.vivo.horario', {
                                    dias: textoDias(vivo.horario.dias, {
                                        lunesAViernes: t('llamadas.panel.vivo.lunesAViernes'),
                                        todos: t('llamadas.panel.vivo.todosLosDias'),
                                        ninguno: t('llamadas.panel.vivo.ningunDia'),
                                    }),
                                    desde: horaDeReloj(vivo.horario.desde),
                                    hasta: horaDeReloj(vivo.horario.hasta),
                                })}
                            </span>
                        </p>
                    </div>
                )}
            </div>

            {vivo && filas > 0 && (
                <div className="pb-1.5">
                    <ul>
                        {vivo.timbrando.map((l) => {
                            const nadie = l.le_timbra_asesores + l.le_timbra_admins === 0;
                            // Cuánto le falta para irse al buzón (si el servidor manda el ajuste).
                            const restante = typeof vivo.segundos_timbre === 'number' ? Math.max(0, vivo.segundos_timbre - (l.espera + pasado)) : null;
                            return (
                                <li key={`t${l.id}`} className={cn(columnas, FILETE)}>
                                    <span className="flex size-8 items-center justify-center self-start rounded-[10px] bg-amber-100 text-amber-700 [grid-area:i] lg:self-center dark:bg-amber-500/15 dark:text-amber-300">
                                        <PhoneIncoming className="size-4" strokeWidth={2} aria-hidden="true" />
                                    </span>
                                    <Paciente fila={l} className="[grid-area:p]" />
                                    <p className="text-[13px] font-semibold text-amber-800 [grid-area:e] dark:text-amber-300">
                                        {t('llamadas.panel.vivo.timbrandoEspera')} <span className="tabular-nums">{mmss(l.espera + pasado)}</span>
                                    </p>
                                    {nadie ? (
                                        // Nadie la puede contestar: decir cuándo pasa al buzón y dónde se cambia a quién le timbra.
                                        <p className="flex flex-wrap items-baseline gap-x-2 text-[12px] [grid-area:d]">
                                            <span className="font-semibold text-red-700 tabular-nums dark:text-red-400">
                                                {restante === null
                                                    ? t('llamadas.panel.vivo.nadieConectado')
                                                    : restante > 0
                                                      ? t('llamadas.panel.vivo.nadieBuzonEn', { tiempo: mmss(restante) })
                                                      : t('llamadas.panel.vivo.nadieAlBuzon')}
                                            </span>
                                            <button type="button" onClick={onIrAjustes} className={cn('text-[12px] whitespace-nowrap', ENLACE, AREA_ENLACE)}>
                                                {t('llamadas.panel.vivo.verAQuien')}
                                            </button>
                                        </p>
                                    ) : (
                                        <p className={cn('text-[12px] [grid-area:d]', SUAVE)}>
                                            {t('llamadas.panel.vivo.leTimbra', {
                                                asesores: t('llamadas.panel.vivo.asesores', { count: l.le_timbra_asesores }),
                                                admins: t('llamadas.panel.vivo.admins', { count: l.le_timbra_admins }),
                                            })}
                                        </p>
                                    )}
                                    <span className="justify-self-end [grid-area:a]">{l.conversation_id && <VerChat id={l.conversation_id} fila={l} />}</span>
                                </li>
                            );
                        })}
                        {vivo.en_curso.map((l) => (
                            <li key={`c${l.id}`} className={cn(columnas, FILETE)}>
                                <span className="flex size-8 items-center justify-center self-start rounded-[10px] bg-emerald-100 text-emerald-700 [grid-area:i] lg:self-center dark:bg-emerald-500/15 dark:text-emerald-300">
                                    <Headset className="size-4" strokeWidth={2} aria-hidden="true" />
                                </span>
                                <Paciente fila={l} className="[grid-area:p]" />
                                <p className="text-[13px] font-semibold text-emerald-800 [grid-area:e] dark:text-emerald-300">
                                    {t('llamadas.panel.vivo.enCurso')}{' '}
                                    <span className="tabular-nums">{l.desde ? mmss((ahora - Date.parse(l.desde)) / 1000) : ''}</span>
                                </p>
                                <p className={cn('truncate text-[12px] [grid-area:d]', MEDIO)}>
                                    {t('llamadas.panel.vivo.con')} <strong className="font-semibold">{l.atendio ? nombrePropio(l.atendio) : '—'}</strong>
                                </p>
                                <span className="flex items-center gap-3 justify-self-end [grid-area:a]">
                                    {l.conversation_id && <VerChat id={l.conversation_id} fila={l} />}
                                    <BotonColgar id={l.id} fila={l} onColgada={onColgada} />
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}

function Paciente({ fila, enLinea = false, celda = false, className }: { fila: Fila; enLinea?: boolean; celda?: boolean; className?: string }) {
    const { t } = useTranslation();
    const nombre = fila.nombre ? nombrePropio(fila.nombre) : t('llamadas.panel.sinNombre');
    if (enLinea) {
        return (
            <span role={celda ? 'cell' : undefined} className={cn('min-w-0 truncate', className)}>
                <strong className={cn('font-semibold', NAVY)}>{nombre}</strong>{' '}
                <span className={cn('text-[12px] tabular-nums', SUAVE)}>{telefono(fila.telefono)}</span>
            </span>
        );
    }
    return (
        <div role={celda ? 'cell' : undefined} className={cn('min-w-0', className)}>
            <p className={cn('truncate text-[13px] font-semibold', NAVY)}>{nombre}</p>
            <p className={cn('text-[12px] tabular-nums', SUAVE)}>{telefono(fila.telefono)}</p>
        </div>
    );
}

/** Nombre del paciente para leerlo en voz (botones de la fila): su nombre, si no su número. */
function nombreDe(fila: Fila, sinNombre: string): string {
    return fila.nombre ? nombrePropio(fila.nombre) : fila.telefono ? telefono(fila.telefono) : sinNombre;
}

function VerChat({ id, fila }: { id: number; fila: Fila }) {
    const { t } = useTranslation();
    return (
        <Link
            href={`/admin/chat/${id}`}
            aria-label={t('llamadas.verChatDe', { nombre: nombreDe(fila, t('llamadas.panel.sinNombre')) })}
            className={cn('text-[12px] whitespace-nowrap', ENLACE, AREA_ENLACE)}
        >
            {t('llamadas.verChat')}
        </Link>
    );
}

/** Colgar una llamada ajena es fuerte: pide un segundo clic (8 s para confirmarlo; el lector de pantalla lo anuncia). */
function BotonColgar({ id, fila, onColgada }: { id: number; fila: Fila; onColgada: (id: number) => void }) {
    const { t } = useTranslation();
    const nombre = nombreDe(fila, t('llamadas.panel.sinNombre'));
    const [paso, setPaso] = useState<'listo' | 'confirmar' | 'enviando'>('listo');
    useEffect(() => {
        if (paso !== 'confirmar') return;
        const tiempo = setTimeout(() => setPaso('listo'), 8000);
        return () => clearTimeout(tiempo);
    }, [paso]);
    const alPulsar = async () => {
        if (paso === 'listo') {
            setPaso('confirmar');
            return;
        }
        if (paso !== 'confirmar') return;
        setPaso('enviando');
        try {
            await axios.post(`/admin/llamadas/${id}/colgar`);
            toast.success(t('llamadas.panel.vivo.colgada'));
            onColgada(id);
        } catch {
            toast.error(t('llamadas.panel.vivo.noColgo'));
        } finally {
            setPaso('listo');
        }
    };
    return (
        <button
            type="button"
            onClick={alPulsar}
            aria-disabled={paso === 'enviando'}
            aria-label={paso === 'confirmar' ? t('llamadas.panel.vivo.colgarConfirmarDe', { nombre }) : t('llamadas.colgarDe', { nombre })}
            className={cn(
                'relative flex h-7 items-center gap-1.5 rounded-[8px] after:absolute after:inset-x-0 after:-inset-y-1.5 px-2.5 text-[12px] font-semibold whitespace-nowrap transition-[background-color,scale] duration-150 active:scale-[0.96]',
                paso === 'confirmar'
                    ? 'bg-red-600 text-white'
                    : 'bg-red-50 text-red-700 shadow-[inset_0_0_0_1px_#fecaca] hover:bg-red-100 dark:bg-red-500/10 dark:text-red-300 dark:shadow-[inset_0_0_0_1px_rgba(248,113,113,.3)]',
            )}
        >
            {paso === 'enviando' && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
            {paso === 'confirmar' ? t('llamadas.panel.vivo.colgarSeguro') : t('llamadas.colgar')}
            {/* Siempre montada: así el aviso se lee al aparecer el segundo paso. */}
            <span className="sr-only" aria-live="assertive">
                {paso === 'confirmar' ? t('llamadas.panel.vivo.colgarAviso', { nombre }) : ''}
            </span>
        </button>
    );
}

// ── Cifras del periodo ──────────────────────────────────────────────────────────────────────────────────────────────

function Cifras({ url, version }: { url: string; version: number }) {
    const { t } = useTranslation();
    const { datos, error, reintentar } = useDatos<Resumen>(url, version);
    if (error && !datos) {
        return (
            <section aria-label={t('llamadas.panel.cifras.etiqueta')} className={TARJETA}>
                <ErrorCarga onReintentar={reintentar} className="py-4" />
            </section>
        );
    }
    const celdas: { etiqueta: string; valor: ReactNode; tinta?: string }[] = datos
        ? [
              { etiqueta: t('llamadas.panel.cifras.llamadas'), valor: numero(datos.total) },
              { etiqueta: t('llamadas.panel.cifras.atendidas'), valor: <ConPorcentaje n={datos.atendidas} total={datos.total} />, tinta: datos.atendidas ? 'text-emerald-700 dark:text-emerald-400' : undefined },
              { etiqueta: t('llamadas.panel.cifras.perdidas'), valor: <ConPorcentaje n={datos.perdidas} total={datos.total} />, tinta: datos.perdidas ? 'text-red-600 dark:text-red-400' : undefined },
              { etiqueta: t('llamadas.panel.cifras.buzon'), valor: <ConPorcentaje n={datos.buzon} total={datos.total} />, tinta: datos.buzon ? 'text-amber-700 dark:text-amber-400' : undefined },
              { etiqueta: t('llamadas.panel.cifras.esperaPromedio'), valor: datos.atendidas ? mmss(datos.espera_promedio) : '—' },
              { etiqueta: t('llamadas.panel.cifras.duracionPromedio'), valor: datos.atendidas ? mmss(datos.duracion_promedio) : '—' },
          ]
        : [];
    return (
        <section aria-label={t('llamadas.panel.cifras.etiqueta')} className={cn(TARJETA, 'grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6')}>
            {!datos
                ? Array.from({ length: 6 }, (_, i) => (
                      <div key={i} className="px-[18px] py-3">
                          <div className="h-3 w-20 animate-pulse rounded bg-[#eef0f6] dark:bg-white/10" />
                          <div className="mt-2.5 h-6 w-14 animate-pulse rounded bg-[#eef0f6] dark:bg-white/10" />
                      </div>
                  ))
                : celdas.map((c, i) => (
                      <div key={c.etiqueta} className={cn('border-[#eef0f6] px-[18px] py-3 dark:border-white/[0.06]', BORDES_CIFRAS[i])}>
                          <p className={cn('text-[12px]', SUAVE)}>{c.etiqueta}</p>
                          <p className={cn('mt-0.5 text-[22px] leading-7 font-semibold tabular-nums', c.tinta ?? NAVY)}>{c.valor}</p>
                      </div>
                  ))}
        </section>
    );
}

/** Separadores de las 6 cifras en 2, 3 o 6 columnas (filetes solo entre celdas, nunca en el borde). */
const BORDES_CIFRAS = [
    '',
    'border-l',
    'border-t sm:border-t-0 sm:border-l',
    'border-l border-t sm:border-l-0 xl:border-l xl:border-t-0',
    'border-t sm:border-l xl:border-t-0',
    'border-l border-t xl:border-t-0',
];

function ConPorcentaje({ n, total }: { n: number; total: number }) {
    return (
        <>
            {numero(n)} {total > 0 && <span className={cn('text-[12px] font-medium', SUAVE)}>{porcentaje(n, total)}</span>}
        </>
    );
}

// ── Resultado (la píldora del historial) ────────────────────────────────────────────────────────────────────────────

function PildoraResultado({ resultado }: { resultado: Resultado }) {
    const { t } = useTranslation();
    const base = 'flex h-6 items-center gap-1.5 justify-self-start rounded-full px-2.5 text-[12px] font-semibold whitespace-nowrap';
    const icono = 'size-[13px]';
    switch (resultado) {
        case 'en_curso':
            return (
                <span className={cn(base, 'bg-emerald-50 text-emerald-800 shadow-[inset_0_0_0_1px_#a7f3d0] dark:bg-emerald-500/10 dark:text-emerald-300 dark:shadow-none')}>
                    <span aria-hidden="true" className="size-[7px] rounded-full bg-emerald-500" />
                    {t('llamadas.panel.resultado.en_curso')}
                </span>
            );
        case 'timbrando':
            return (
                <span className={cn(base, 'bg-amber-50 text-amber-800 shadow-[inset_0_0_0_1px_#fde68a] dark:bg-amber-500/10 dark:text-amber-300 dark:shadow-none')}>
                    <span aria-hidden="true" className="size-[7px] rounded-full bg-amber-500" />
                    {t('llamadas.panel.resultado.timbrando')}
                </span>
            );
        case 'atendida':
            return (
                <span className={cn(base, 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300')}>
                    <Check className={icono} strokeWidth={2.25} aria-hidden="true" />
                    {t('llamadas.panel.resultado.atendida')}
                </span>
            );
        case 'cortada':
            return (
                <span className={cn(base, 'bg-[#f1f3f8] text-[#3c4570] dark:bg-white/[0.06] dark:text-neutral-300')}>
                    <PhoneOff className={icono} strokeWidth={2.25} aria-hidden="true" />
                    {t('llamadas.panel.resultado.cortada')}
                </span>
            );
        case 'buzon':
            return (
                <span className={cn(base, 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300')}>
                    <Voicemail className={icono} strokeWidth={2.25} aria-hidden="true" />
                    {t('llamadas.panel.resultado.buzon')}
                </span>
            );
        case 'fuera_horario':
            return (
                <span className={cn(base, 'bg-[#f1f3f8] text-[#3c4570] dark:bg-white/[0.06] dark:text-neutral-300')}>
                    <Clock className={icono} strokeWidth={2.25} aria-hidden="true" />
                    {t('llamadas.panel.resultado.fuera_horario')}
                </span>
            );
        case 'fallida':
            return (
                <span className={cn(base, 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300')}>
                    <CircleAlert className={icono} strokeWidth={2.25} aria-hidden="true" />
                    {t('llamadas.panel.resultado.fallida')}
                </span>
            );
        default:
            return (
                <span className={cn(base, 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300')}>
                    <PhoneMissed className={icono} strokeWidth={2.25} aria-hidden="true" />
                    {t('llamadas.panel.resultado.perdida')}
                </span>
            );
    }
}

// ── Historial ───────────────────────────────────────────────────────────────────────────────────────────────────────

type Filtros = { resultado: string; atendio: string; buscar: string };

function PestanaHistorial({
    periodo,
    sufijoPeriodo,
    filtros,
    onFiltros,
    version,
    activas,
    onTotal,
}: {
    periodo: Periodo;
    sufijoPeriodo: string;
    filtros: Filtros;
    onFiltros: (f: Filtros) => void;
    version: number;
    activas: boolean;
    onTotal: (total: number | null) => void;
}) {
    const { t } = useTranslation();
    const [texto, setTexto] = useState(filtros.buscar);
    const [pagina, setPagina] = useState(1);
    const [asesores, setAsesores] = useState<{ id: number; name: string }[]>([]);

    // La búsqueda espera a que se deje de escribir.
    useEffect(() => {
        if (texto.trim() === filtros.buscar) return;
        const tiempo = setTimeout(() => {
            onFiltros({ ...filtros, buscar: texto.trim() });
            setPagina(1);
        }, 300);
        return () => clearTimeout(tiempo);
    }, [texto, filtros, onFiltros]);

    const clavePeriodo = JSON.stringify(periodo);
    const [periodoVisto, setPeriodoVisto] = useState(clavePeriodo);
    if (periodoVisto !== clavePeriodo) {
        setPeriodoVisto(clavePeriodo);
        setPagina(1);
    }

    const url = `${BASE}/historial?${paramsDe({ ...paramsPeriodo(periodo), ...filtros, pagina })}`;
    const { datos, cargando, error, reintentar } = useDatos<Historial>(url, version);
    useEffect(() => {
        onTotal(datos ? datos.total : null);
    }, [datos, onTotal]);
    useEffect(() => {
        if (!datos?.asesores?.length) return;
        setAsesores(datos.asesores);
        if (filtros.atendio && !datos.asesores.some((a) => String(a.id) === filtros.atendio)) onFiltros({ ...filtros, atendio: '' });
    }, [datos, filtros, onFiltros]);

    const resultados: { id: string; texto: string }[] = [
        { id: '', texto: t('llamadas.panel.historial.todos') },
        { id: 'atendida', texto: t('llamadas.panel.resultado.atendida') },
        { id: 'buzon', texto: t('llamadas.panel.resultado.buzon') },
        { id: 'perdida', texto: t('llamadas.panel.resultado.perdida') },
        { id: 'cortada', texto: t('llamadas.panel.resultado.cortada') },
        { id: 'fuera_horario', texto: t('llamadas.panel.resultado.fuera_horario') },
        { id: 'fallida', texto: t('llamadas.panel.resultado.fallida') },
        { id: 'en_curso', texto: t('llamadas.panel.resultado.en_curso') },
    ];
    const columnas = 'grid grid-cols-[92px_minmax(0,1.6fr)_150px_minmax(0,1.3fr)_70px_80px_70px] items-center gap-x-3.5';

    return (
        <section aria-label={t('llamadas.panel.tabs.historial')} className={TARJETA}>
            <div className={cn('flex flex-wrap items-center gap-2.5 border-b px-4 py-3', FILETE)}>
                <label className={cn(CAMPO, ANILLO_CAMPO, 'flex h-9 w-full items-center gap-2 rounded-[10px] px-3 sm:w-[300px]', SUAVE)}>
                    <Search className="size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                    <span className="sr-only">{t('llamadas.panel.historial.buscar')}</span>
                    <input
                        type="search"
                        value={texto}
                        onChange={(e) => setTexto(e.target.value)}
                        placeholder={t('llamadas.panel.historial.buscar')}
                        className={cn('h-full min-w-0 flex-1 bg-transparent text-[16px] outline-hidden placeholder:text-[#5c6485] sm:text-[13px] dark:placeholder:text-neutral-400', NAVY)}
                    />
                </label>
                <Desplegable
                    etiqueta={t('llamadas.panel.historial.resultado')}
                    valor={filtros.resultado}
                    opciones={resultados}
                    onCambiar={(v) => {
                        onFiltros({ ...filtros, resultado: v });
                        setPagina(1);
                    }}
                />
                <Desplegable
                    etiqueta={t('llamadas.panel.historial.atendio')}
                    valor={filtros.atendio}
                    opciones={[{ id: '', texto: t('llamadas.panel.historial.todos') }, ...asesores.map((a) => ({ id: String(a.id), texto: nombrePropio(a.name) }))]}
                    onCambiar={(v) => {
                        onFiltros({ ...filtros, atendio: v });
                        setPagina(1);
                    }}
                />
                <span className={cn('ml-auto flex items-center gap-2 text-[12px] tabular-nums', SUAVE)} aria-live="polite">
                    {cargando && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                    {datos && `${t('llamadas.panel.historial.cuenta', { count: datos.total })} ${sufijoPeriodo}`}
                </span>
            </div>

            {error && !datos ? (
                <ErrorCarga onReintentar={reintentar} />
            ) : !datos ? (
                <div className={cn('flex items-center gap-2 px-5 py-8 text-[13px]', SUAVE)}>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    {t('llamadas.panel.cargando')}
                </div>
            ) : datos.filas.length === 0 ? (
                <div className="px-5 py-12 text-center">
                    <p className={cn('text-[14px] font-semibold', NAVY)}>{t('llamadas.panel.historial.vacio')}</p>
                    <p className={cn('mx-auto mt-1 max-w-md text-[13px] text-pretty', SUAVE)}>
                        {activas ? t('llamadas.panel.historial.vacioDetalle') : t('llamadas.panel.historial.vacioApagadas')}
                    </p>
                </div>
            ) : (
                <>
                    {/* relative: el «Acciones» oculto (sr-only, absoluto) queda dentro; sin él ensanchaba la página en el celular. */}
                    <div className="relative overflow-x-auto">
                        <div role="table" aria-label={t('llamadas.panel.tabs.historial')} className="min-w-[860px]">
                            <div role="row" className={cn(columnas, 'h-[34px] border-b bg-[#f4f5f9]/70 px-4 text-[11px] font-semibold tracking-[.04em] uppercase dark:bg-white/[0.03]', FILETE, SUAVE)}>
                                <span role="columnheader">{t('llamadas.panel.historial.col.hora')}</span>
                                <span role="columnheader">{t('llamadas.panel.historial.col.paciente')}</span>
                                <span role="columnheader">{t('llamadas.panel.historial.col.resultado')}</span>
                                <span role="columnheader">{t('llamadas.panel.historial.col.atendio')}</span>
                                <span role="columnheader" className="text-right">{t('llamadas.panel.historial.col.espero')}</span>
                                <span role="columnheader" className="text-right">{t('llamadas.panel.historial.col.duracion')}</span>
                                <span role="columnheader">
                                    <span className="sr-only">{t('llamadas.panel.acciones')}</span>
                                </span>
                            </div>
                            <div role="rowgroup">
                                {datos.filas.map((f) => (
                                    <div role="row" key={f.id} className={cn(columnas, 'h-[46px] border-b px-4 text-[13px] last:border-b-0', FILETE)}>
                                        <span role="cell" className={cn('tabular-nums', MEDIO)}>
                                            {periodo.tipo !== 'hoy' && f.inicio && diaDe(new Date(f.inicio)) !== hoyEnColombia() ? (
                                                <>
                                                    <span className="block text-[11px] leading-3">{fechaCorta(f.inicio)}</span>
                                                    {hora(f.inicio)}
                                                </>
                                            ) : (
                                                hora(f.inicio)
                                            )}
                                        </span>
                                        <Paciente fila={f} enLinea celda />
                                        <span role="cell">
                                            <PildoraResultado resultado={f.resultado} />
                                        </span>
                                        <span role="cell" className={cn('truncate', f.atendio ? NAVY : SUAVE)}>
                                            {f.atendio
                                                ? nombrePropio(f.atendio)
                                                : f.resultado === 'buzon' || f.resultado === 'perdida'
                                                  ? t('llamadas.panel.historial.nadieContesto')
                                                  : '—'}
                                        </span>
                                        <span role="cell" className={cn('text-right tabular-nums', MEDIO)}>{mmss(f.espera)}</span>
                                        <span role="cell" className={cn('text-right tabular-nums', MEDIO)}>{f.duracion ? mmss(f.duracion) : '—'}</span>
                                        <span role="cell" className="justify-self-end">{f.conversation_id && <VerChat id={f.conversation_id} fila={f} />}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    {datos.paginas > 1 && (
                        <nav aria-label={t('llamadas.panel.historial.paginas')} className={cn('flex items-center justify-end gap-3 border-t px-4 py-2.5 text-[12px]', FILETE, SUAVE)}>
                            <button type="button" className={cn(BOTON_SECUNDARIO, 'h-8 px-3 text-[12px]')} disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
                                {t('llamadas.panel.historial.anterior')}
                            </button>
                            <span className="tabular-nums">{t('llamadas.panel.historial.paginaDe', { pagina: datos.pagina, paginas: datos.paginas })}</span>
                            <button type="button" className={cn(BOTON_SECUNDARIO, 'h-8 px-3 text-[12px]')} disabled={pagina >= datos.paginas} onClick={() => setPagina((p) => p + 1)}>
                                {t('llamadas.panel.historial.siguiente')}
                            </button>
                        </nav>
                    )}
                </>
            )}
        </section>
    );
}

/** "12 nov." (para filas que no son de hoy). */
function fechaCorta(iso: string): string {
    return new Intl.DateTimeFormat(idioma(), { timeZone: ZONA, day: 'numeric', month: 'short' }).format(new Date(iso));
}

/** «Resultado: Todos ˅» con el Select de la app (el mismo menú y las mismas opciones que Masivos y Usuarios). Radix no
 *  admite el valor vacío, así que «Todos» ('') viaja como TODOS. */
const TODOS = '__todos__';
const MENU_OPCIONES =
    'max-h-[320px] rounded-xl border-0 shadow-[0_0_0_1px_rgba(46,63,132,0.12),0_12px_28px_-10px_rgba(46,63,132,0.4)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_12px_28px_-10px_rgba(0,0,0,0.7)]';
const OPCION =
    'cursor-pointer rounded-lg py-2 pr-8 pl-2.5 text-[13px] leading-[18px] focus:bg-[#2e3f84]/6 focus:text-[#2e3f84] dark:focus:bg-white/8 dark:focus:text-neutral-100';

function Desplegable({ etiqueta, valor, opciones, onCambiar }: { etiqueta: string; valor: string; opciones: { id: string; texto: string }[]; onCambiar: (v: string) => void }) {
    const actual = opciones.find((o) => o.id === valor)?.texto ?? opciones[0]?.texto;
    return (
        <Select value={valor || TODOS} onValueChange={(v) => onCambiar(v === TODOS ? '' : v)}>
            <SelectTrigger
                aria-label={`${etiqueta}: ${actual}`}
                className={cn(
                    CAMPO,
                    'h-9 w-auto gap-1.5 rounded-[10px] border-0 pr-2.5 pl-3 text-[13px] focus-visible:ring-0 dark:bg-white/[0.04]',
                    MEDIO,
                )}
            >
                <span aria-hidden="true">
                    {etiqueta}: <strong className={cn('font-semibold', NAVY)}>{actual}</strong>
                </span>
            </SelectTrigger>
            <SelectContent className={MENU_OPCIONES}>
                {opciones.map((o) => (
                    <SelectItem key={o.id || TODOS} value={o.id || TODOS} className={OPCION}>
                        {o.texto}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

// ── Buzón de voz ────────────────────────────────────────────────────────────────────────────────────────────────────

function PestanaBuzon({ version, onSinResolver }: { version: number; onSinResolver: (n: number) => void }) {
    const { t } = useTranslation();
    const [filtro, setFiltro] = useState<'sin_resolver' | 'resueltos' | 'todos'>('sin_resolver');
    const [texto, setTexto] = useState('');
    const [buscar, setBuscar] = useState('');
    const [propia, setPropia] = useState(0);
    const [ocupado, setOcupado] = useState<number | null>(null);

    useEffect(() => {
        const tiempo = setTimeout(() => setBuscar(texto.trim()), 300);
        return () => clearTimeout(tiempo);
    }, [texto]);

    const { datos, setDatos, cargando, error, reintentar } = useDatos<Buzon>(`${BASE}/buzon?${paramsDe({ filtro, buscar })}`, version + propia);
    useEffect(() => {
        if (datos) onSinResolver(datos.sin_resolver);
    }, [datos, onSinResolver]);

    const resolver = async (fila: FilaBuzon, deshacer: boolean) => {
        setOcupado(fila.id);
        try {
            const r = await axios.post<{ ok: boolean; sin_resolver: number }>(`${BASE}/buzon/${fila.id}/resolver`, { deshacer });
            onSinResolver(r.data.sin_resolver);
            // Al instante en la lista; la consulta trae el orden y los nombres de verdad.
            setDatos((d) =>
                d
                    ? {
                          sin_resolver: r.data.sin_resolver,
                          filas: d.filas
                              .map((f) => (f.id === fila.id ? { ...f, resuelto_en: deshacer ? null : new Date().toISOString(), resuelto_por: deshacer ? null : f.resuelto_por } : f))
                              .filter((f) => filtro === 'todos' || (filtro === 'sin_resolver' ? !f.resuelto_en : !!f.resuelto_en)),
                      }
                    : d,
            );
            if (!deshacer) {
                toast.success(t('llamadas.panel.buzon.resueltoAviso'), {
                    boton: { titulo: t('llamadas.panel.buzon.deshacer'), alPulsar: () => void resolver(fila, true) },
                });
            }
            setPropia((p) => p + 1);
        } catch {
            toast.error(t('llamadas.panel.buzon.noSeGuardo'));
        } finally {
            setOcupado(null);
        }
    };

    const hoy = hoyEnColombia();
    const ayer = sumarDias(hoy, -1);
    const cuando = (iso: string | null) => {
        if (!iso) return '—';
        const dia = diaDe(new Date(iso));
        if (dia === hoy) return hora(iso);
        if (dia === ayer) return t('llamadas.panel.buzon.ayerA', { hora: hora(iso) });
        return `${fechaCorta(iso)}, ${hora(iso)}`;
    };
    // Angosto: apilado (paciente y hora; audio y lo que dijo; botones). Desde lg, las cuatro columnas de la tabla.
    const columnas =
        "grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 [grid-template-areas:'p_c'_'m_m'_'a_a'] lg:grid-cols-[110px_minmax(0,1fr)_minmax(0,2.3fr)_230px] lg:items-start lg:[grid-template-areas:'c_p_m_a']";

    return (
        <div className="flex flex-col gap-4">
            {/* 54ch de esta letra ≈ 75 caracteres por línea (con 68ch salían ~97). */}
            <p className={cn('max-w-[54ch] text-[13px] leading-5 text-pretty', MEDIO)}>{t('llamadas.panel.buzon.explicacion')}</p>
            <section aria-label={t('llamadas.panel.tabs.buzon')} className={TARJETA}>
                <div className={cn('flex flex-wrap items-center gap-2.5 border-b px-4 py-3', FILETE)}>
                    <div role="group" aria-label={t('llamadas.panel.buzon.filtro')} className={cn(SEGMENTADO, 'max-w-full overflow-x-auto')}>
                        {(
                            [
                                ['sin_resolver', datos ? t('llamadas.panel.buzon.sinResolverN', { n: datos.sin_resolver }) : t('llamadas.panel.buzon.sinResolver')],
                                ['resueltos', t('llamadas.panel.buzon.resueltos')],
                                ['todos', t('llamadas.panel.buzon.todos')],
                            ] as const
                        ).map(([id, txt]) => (
                            <button key={id} type="button" aria-pressed={filtro === id} onClick={() => setFiltro(id)} className={cn(SEG_BOTON, filtro === id ? SEG_SI : SEG_NO)}>
                                {txt}
                            </button>
                        ))}
                    </div>
                    <label className={cn(CAMPO, ANILLO_CAMPO, 'flex h-9 w-full items-center gap-2 rounded-[10px] px-3 sm:w-[320px]', SUAVE)}>
                        <Search className="size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                        <span className="sr-only">{t('llamadas.panel.buzon.buscar')}</span>
                        <input
                            type="search"
                            value={texto}
                            onChange={(e) => setTexto(e.target.value)}
                            placeholder={t('llamadas.panel.buzon.buscar')}
                            className={cn('h-full min-w-0 flex-1 bg-transparent text-[16px] outline-hidden placeholder:text-[#5c6485] sm:text-[13px] dark:placeholder:text-neutral-400', NAVY)}
                        />
                    </label>
                    {cargando && <Loader2 className={cn('ml-auto size-4 animate-spin', SUAVE)} aria-label={t('llamadas.panel.cargando')} />}
                </div>

                {error && !datos ? (
                    <ErrorCarga onReintentar={reintentar} />
                ) : !datos ? (
                    <div className={cn('flex items-center gap-2 px-5 py-8 text-[13px]', SUAVE)}>
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        {t('llamadas.panel.cargando')}
                    </div>
                ) : datos.filas.length === 0 ? (
                    <div className="px-5 py-12 text-center">
                        <Voicemail className={cn('mx-auto mb-2 size-6', SUAVE)} strokeWidth={1.75} aria-hidden="true" />
                        <p className={cn('text-[14px] font-semibold', NAVY)}>
                            {filtro === 'sin_resolver' ? t('llamadas.panel.buzon.vacioSinResolver') : t('llamadas.panel.buzon.vacio')}
                        </p>
                    </div>
                ) : (
                    <div className="relative overflow-x-auto">
                        <div role="table" aria-label={t('llamadas.panel.tabs.buzon')} className="lg:min-w-[880px]">
                            {/* Encabezados: a la vista solo con columnas; apilado los sigue leyendo el lector de pantalla. */}
                            <div
                                role="row"
                                className={cn(
                                    columnas,
                                    // max-lg:sr-only y no lg:not-sr-only: este último pone el relleno en 0 y la fila perdía su forma.
                                    'items-center border-b bg-[#f4f5f9]/70 px-4 py-2 text-[11px] font-semibold tracking-[.04em] uppercase max-lg:sr-only dark:bg-white/[0.03]',
                                    FILETE,
                                    SUAVE,
                                )}
                            >
                                <span role="columnheader" className="[grid-area:c]">{t('llamadas.panel.buzon.col.cuando')}</span>
                                <span role="columnheader" className="[grid-area:p]">{t('llamadas.panel.buzon.col.paciente')}</span>
                                <span role="columnheader" className="[grid-area:m]">{t('llamadas.panel.buzon.col.loQueDijo')}</span>
                                <span role="columnheader" className="[grid-area:a]">
                                    <span className="sr-only">{t('llamadas.panel.acciones')}</span>
                                </span>
                            </div>
                            <div role="rowgroup">
                                {datos.filas.map((f) => (
                                    <div
                                        role="row"
                                        key={f.id}
                                        className={cn(columnas, 'gap-y-3 border-b px-4 py-3.5 text-[13px] last:border-b-0 lg:gap-y-0', FILETE, f.resuelto_en && 'bg-[#f4f5f9]/45 dark:bg-white/[0.02]')}
                                    >
                                        <div role="cell" className="text-right [grid-area:c] lg:text-left">
                                            <p className={cn('tabular-nums', MEDIO)}>{cuando(f.cuando)}</p>
                                            <p className={cn('text-[12px]', SUAVE)}>{f.fuera_de_horario ? t('llamadas.panel.buzon.fueraDeHorario') : t('llamadas.panel.buzon.nadieContesto')}</p>
                                        </div>
                                        <Paciente fila={f} celda className="[grid-area:p]" />
                                        <div role="cell" className="flex min-w-0 flex-col gap-1.5 [grid-area:m]">
                                            {f.audio ? (
                                                <AudioBuzon src={f.audio} resuelto={!!f.resuelto_en} />
                                            ) : (
                                                <p className={cn('text-[12px]', SUAVE)}>{t('llamadas.panel.buzon.audioPendiente')}</p>
                                            )}
                                            {f.transcripcion ? (
                                                <p className={cn('text-[13px] leading-[19px] text-pretty', NAVY)}>«{f.transcripcion}»</p>
                                            ) : (
                                                <p className={cn('text-[12px] italic', SUAVE)}>{t('llamadas.panel.buzon.sinTranscripcion')}</p>
                                            )}
                                        </div>
                                        <div role="cell" className="flex flex-col items-end gap-2 [grid-area:a]">
                                            {f.resuelto_en ? (
                                                <>
                                                    <span className="flex h-6 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 text-[12px] font-semibold text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
                                                        <Check className="size-[13px]" strokeWidth={2.25} aria-hidden="true" />
                                                        {t('llamadas.panel.buzon.resuelto')}
                                                    </span>
                                                    {f.resuelto_por && (
                                                        <p className={cn('text-right text-[12px]', SUAVE)}>
                                                            {t('llamadas.panel.buzon.loResolvio', { nombre: nombrePropio(f.resuelto_por), hora: cuando(f.resuelto_en) })}
                                                        </p>
                                                    )}
                                                    <div className="flex items-center gap-3">
                                                        {f.conversation_id && <VerChat id={f.conversation_id} fila={f} />}
                                                        <button
                                                            type="button"
                                                            aria-disabled={ocupado !== null}
                                                            onClick={() => ocupado === null && void resolver(f, true)}
                                                            className={cn('text-[12px]', ENLACE, AREA_ENLACE)}
                                                        >
                                                            {t('llamadas.panel.buzon.marcarSinResolver')}
                                                        </button>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    {filtro !== 'sin_resolver' && (
                                                        <span className="flex h-6 items-center rounded-full bg-amber-50 px-2.5 text-[12px] font-semibold text-amber-800 shadow-[inset_0_0_0_1px_#fde68a] dark:bg-amber-500/10 dark:text-amber-300 dark:shadow-none">
                                                            {t('llamadas.panel.buzon.sinResolver')}
                                                        </span>
                                                    )}
                                                    <div className="flex items-center gap-3">
                                                        {f.conversation_id && <VerChat id={f.conversation_id} fila={f} />}
                                                        <button
                                                            type="button"
                                                            aria-disabled={ocupado !== null}
                                                            onClick={() => ocupado === null && void resolver(f, false)}
                                                            className={cn(BOTON_PRIMARIO, 'h-8 px-3 text-[12px]', ocupado !== null && ocupado !== f.id && 'opacity-60')}
                                                        >
                                                            {ocupado === f.id && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                                                            {t('llamadas.panel.buzon.marcarResuelto')}
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
}

/** Solo suena un mensaje a la vez: al dar play a otro, el anterior se pausa. */
let sonandoAhora: HTMLAudioElement | null = null;

function AudioBuzon({ src, resuelto }: { src: string; resuelto: boolean }) {
    const { t } = useTranslation();
    const ref = useRef<HTMLAudioElement>(null);
    const [sonando, setSonando] = useState(false);
    const [pos, setPos] = useState(0);
    const [dur, setDur] = useState<number | null>(null);

    useEffect(() => {
        const a = ref.current;
        return () => {
            if (a && sonandoAhora === a) sonandoAhora = null;
        };
    }, []);

    const alternar = () => {
        const a = ref.current;
        if (!a) return;
        if (a.paused) {
            if (sonandoAhora && sonandoAhora !== a) sonandoAhora.pause();
            sonandoAhora = a;
            a.play().catch(() => toast.error(t('llamadas.panel.buzon.noSuena')));
        } else {
            a.pause();
        }
    };

    return (
        <div className="flex items-center gap-2.5">
            <button
                type="button"
                onClick={alternar}
                aria-label={sonando ? t('llamadas.panel.buzon.pausar') : t('llamadas.panel.buzon.escuchar')}
                className={cn(
                    'relative flex size-8 shrink-0 items-center justify-center rounded-full transition-[scale,background-color] duration-150 active:scale-[0.96] after:absolute after:-inset-1.5',
                    resuelto && !sonando ? 'bg-[#e3e7f2] text-[#2e3f84] dark:bg-white/10 dark:text-neutral-100' : 'bg-[#2e3f84] text-white',
                )}
            >
                {sonando ? <Pause className="size-3.5" fill="currentColor" strokeWidth={0} aria-hidden="true" /> : <Play className="ml-0.5 size-3.5" fill="currentColor" strokeWidth={0} aria-hidden="true" />}
            </button>
            <input
                type="range"
                min={0}
                max={dur ?? 0}
                step={0.1}
                value={Math.min(pos, dur ?? 0)}
                disabled={!dur}
                onChange={(e) => {
                    if (ref.current) ref.current.currentTime = Number(e.target.value);
                    setPos(Number(e.target.value));
                }}
                aria-label={t('llamadas.panel.buzon.posicion')}
                className="h-6 min-w-0 flex-1 cursor-pointer accent-[#2e3f84] disabled:cursor-default dark:accent-[#aab6ee]"
            />
            <span className={cn('w-10 text-right text-[12px] tabular-nums', SUAVE)}>{mmss(sonando || pos > 0 ? pos : dur)}</span>
            <audio
                ref={ref}
                src={src}
                preload="metadata"
                onPlay={() => setSonando(true)}
                onPause={() => setSonando(false)}
                onEnded={() => {
                    setSonando(false);
                    setPos(0);
                }}
                onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => setDur(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : null)}
            />
        </div>
    );
}

// ── Indicadores ─────────────────────────────────────────────────────────────────────────────────────────────────────

// Buzón en ámbar claro: el ámbar oscuro junto al rojo de las perdidas se confundía (1,5:1).
const COLOR = { atendidas: 'bg-[#2e3f84] dark:bg-[#7d8fdc]', buzon: 'bg-amber-400', perdidas: 'bg-red-600' };

function PestanaIndicadores({ url, version }: { url: string; version: number }) {
    const { t } = useTranslation();
    const { datos, error, reintentar } = useDatos<Indicadores>(url, version);

    if (error && !datos) return <ErrorCarga onReintentar={reintentar} className={TARJETA} />;
    if (!datos) {
        return (
            <div className={cn(TARJETA, 'flex items-center gap-2 px-5 py-8 text-[13px]', SUAVE)}>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                {t('llamadas.panel.cargando')}
            </div>
        );
    }
    const r = datos.resumen;
    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
                <PorHora barras={datos.por_hora} fuera={datos.fuera_de_horario} />
                <section aria-labelledby="como-terminaron" className={cn(TARJETA, 'flex flex-col gap-4 p-5')}>
                    <h2 id="como-terminaron" className={cn('text-[15px] font-semibold', NAVY)}>
                        {t('llamadas.panel.indicadores.comoTerminaron')}
                    </h2>
                    {r.total === 0 ? (
                        <p className={cn('text-[13px]', SUAVE)}>{t('llamadas.panel.indicadores.sinDatos')}</p>
                    ) : (
                        <>
                            <div className="flex h-3 gap-px overflow-hidden rounded-full bg-card" aria-hidden="true">
                                {r.atendidas > 0 && <span className={COLOR.atendidas} style={{ flexGrow: r.atendidas }} />}
                                {r.buzon > 0 && <span className={COLOR.buzon} style={{ flexGrow: r.buzon }} />}
                                {r.perdidas > 0 && <span className={COLOR.perdidas} style={{ flexGrow: r.perdidas }} />}
                            </div>
                            <dl className="flex flex-col text-[13px]">
                                {(
                                    [
                                        ['atendidas', t('llamadas.panel.indicadores.atendidas'), r.atendidas],
                                        ['buzon', t('llamadas.panel.indicadores.buzon'), r.buzon],
                                        ['perdidas', t('llamadas.panel.indicadores.perdidas'), r.perdidas],
                                    ] as const
                                ).map(([clave, texto, n]) => (
                                    <div key={clave} className={cn('flex items-center justify-between gap-3 border-b py-2', FILETE)}>
                                        <dt className={cn('flex items-center gap-2', MEDIO)}>
                                            <span aria-hidden="true" className={cn('size-2.5 rounded-[3px]', COLOR[clave])} />
                                            {texto}
                                        </dt>
                                        <dd className="tabular-nums">
                                            <strong className={cn('font-semibold', NAVY)}>{numero(n)}</strong> <span className={SUAVE}>· {porcentaje(n, r.total)}</span>
                                        </dd>
                                    </div>
                                ))}
                                <div className="flex items-center justify-between gap-3 pt-2">
                                    <dt className={MEDIO}>{t('llamadas.panel.indicadores.total')}</dt>
                                    <dd className={cn('font-semibold tabular-nums', NAVY)}>{numero(r.total)}</dd>
                                </div>
                            </dl>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-xl bg-[#f4f5f9] px-3.5 py-3 dark:bg-white/[0.04]">
                                    <p className={cn('text-[12px]', SUAVE)}>{t('llamadas.panel.cifras.esperaPromedio')}</p>
                                    <p className={cn('text-[20px] leading-7 font-semibold tabular-nums', NAVY)}>{r.atendidas ? mmss(r.espera_promedio) : '—'}</p>
                                    <p className={cn('text-[12px]', SUAVE)}>{t('llamadas.panel.indicadores.hastaQueContestan')}</p>
                                </div>
                                <div className="rounded-xl bg-[#f4f5f9] px-3.5 py-3 dark:bg-white/[0.04]">
                                    <p className={cn('text-[12px]', SUAVE)}>{t('llamadas.panel.cifras.duracionPromedio')}</p>
                                    <p className={cn('text-[20px] leading-7 font-semibold tabular-nums', NAVY)}>{r.atendidas ? mmss(r.duracion_promedio) : '—'}</p>
                                    <p className={cn('text-[12px]', SUAVE)}>{t('llamadas.panel.indicadores.deLasAtendidas')}</p>
                                </div>
                            </div>
                        </>
                    )}
                </section>
            </div>
            <PorAsesorTabla filas={datos.por_asesor} />
        </div>
    );
}

function PorHora({ barras, fuera }: { barras: Barra[]; fuera: Barra }) {
    const { t } = useTranslation();
    const todas = [...barras, fuera];
    const total = (b: Barra) => b.atendidas + b.buzon + b.perdidas;
    // La escala la ponen las horas: «Fuera de horario» suma muchas horas y aplastaría las demás (si las pasa, va al tope
    // y su número dice cuántas son).
    const max = Math.max(1, ...barras.map(total));
    const alto = 170;
    const vacia = todas.every((b) => total(b) === 0);

    const etiqueta = (b: Barra, i: number) => {
        if (b.hora === null) return t('llamadas.panel.indicadores.fueraDeHorario');
        const h = b.hora;
        if (h === 12) return t('llamadas.panel.indicadores.mediodia');
        const doce = h > 12 ? h - 12 : h === 0 ? 12 : h;
        const primeraTarde = h > 12 && (i === 0 || (barras[i - 1]?.hora ?? 0) <= 12);
        if (i === 0 || primeraTarde) return h < 12 ? t('llamadas.panel.indicadores.am', { h: doce }) : t('llamadas.panel.indicadores.pm', { h: doce });
        return String(doce);
    };

    // La frase de abajo: solo hechos (la hora con más llamadas y la que más pierde).
    const dentro = barras.filter((b) => total(b) > 0);
    const pico = dentro.reduce<Barra | null>((m, b) => (!m || total(b) > total(m) ? b : m), null);
    const masPierde = dentro.reduce<Barra | null>((m, b) => (b.perdidas > 0 && (!m || b.perdidas > m.perdidas) ? b : m), null);
    const nombreHora = (b: Barra) => horaDeReloj(`${String(b.hora).padStart(2, '0')}:00`).replace(':00', '');
    let frase = '';
    if (pico && masPierde && pico.hora === masPierde.hora) {
        frase = t('llamadas.panel.indicadores.fraseMismaHora', { hora: nombreHora(pico), perdidas: masPierde.perdidas, total: total(pico) });
    } else if (pico) {
        frase = t('llamadas.panel.indicadores.frasePico', { hora: nombreHora(pico), total: total(pico) });
        if (masPierde) frase += ` ${t('llamadas.panel.indicadores.fraseMasPierde', { hora: nombreHora(masPierde), perdidas: masPierde.perdidas, total: total(masPierde) })}`;
    }

    return (
        <section aria-labelledby="por-hora" className={cn(TARJETA, 'flex flex-col gap-4 p-5')}>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="por-hora" className={cn('text-[15px] font-semibold', NAVY)}>
                    {t('llamadas.panel.indicadores.porHora')}
                </h2>
                <div className={cn('flex flex-wrap items-center gap-3 text-[12px]', SUAVE)}>
                    {(['atendidas', 'buzon', 'perdidas'] as const).map((c) => (
                        <span key={c} className="flex items-center gap-1.5">
                            <span aria-hidden="true" className={cn('size-2.5 rounded-[3px]', COLOR[c])} />
                            {c === 'atendidas' ? t('llamadas.panel.indicadores.leyendaAtendidas') : c === 'buzon' ? t('llamadas.panel.indicadores.leyendaBuzon') : t('llamadas.panel.indicadores.leyendaPerdidas')}
                        </span>
                    ))}
                </div>
            </div>
            {vacia ? (
                <p className={cn('py-6 text-[13px]', SUAVE)}>{t('llamadas.panel.indicadores.sinDatos')}</p>
            ) : (
                <div className="overflow-x-auto">
                    <div className="min-w-[480px]">
                        <ul
                            className="grid items-end gap-2 bg-[repeating-linear-gradient(to_top,transparent_0,transparent_42px,rgba(46,63,132,.07)_42px,rgba(46,63,132,.07)_43px)] dark:bg-[repeating-linear-gradient(to_top,transparent_0,transparent_42px,rgba(255,255,255,.06)_42px,rgba(255,255,255,.06)_43px)]"
                            style={{ gridTemplateColumns: `repeat(${todas.length}, minmax(0,1fr))`, height: alto + 22 }}
                        >
                            {todas.map((b, i) => {
                                const n = total(b);
                                const leer = t('llamadas.panel.indicadores.barraLectura', { hora: etiqueta(b, i), total: n, atendidas: b.atendidas, buzon: b.buzon, perdidas: b.perdidas });
                                return (
                                    <li key={b.hora ?? 'fuera'} className="relative flex h-full flex-col items-center justify-end gap-1" title={leer}>
                                        <span className="sr-only">{leer}</span>
                                        <span aria-hidden="true" className={cn('text-[11px] font-semibold tabular-nums', n === max && n > 0 ? NAVY : MEDIO)}>
                                            {n || ''}
                                        </span>
                                        <span aria-hidden="true" className="flex w-full max-w-[34px] flex-col-reverse gap-px overflow-hidden rounded-t-[5px]" style={{ height: n ? Math.min(alto, Math.max(3, Math.round((n / max) * alto))) : 0 }}>
                                            {b.atendidas > 0 && <span className={COLOR.atendidas} style={{ flexGrow: b.atendidas }} />}
                                            {b.buzon > 0 && <span className={COLOR.buzon} style={{ flexGrow: b.buzon }} />}
                                            {b.perdidas > 0 && <span className={COLOR.perdidas} style={{ flexGrow: b.perdidas }} />}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                        <div aria-hidden="true" className={cn('mt-1.5 grid gap-2 border-t pt-1.5 text-center text-[11px]', FILETE, SUAVE)} style={{ gridTemplateColumns: `repeat(${todas.length}, minmax(0,1fr))` }}>
                            {todas.map((b, i) => (
                                <span key={b.hora ?? 'fuera'} className={cn('leading-[14px]', b.hora === null && 'font-semibold text-amber-700 dark:text-amber-400')}>
                                    {etiqueta(b, i)}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            {frase && <p className={cn('text-[13px] leading-5 text-pretty', MEDIO)}>{frase}</p>}
        </section>
    );
}

function PorAsesorTabla({ filas }: { filas: PorAsesor[] }) {
    const { t } = useTranslation();
    const columnas = 'grid grid-cols-[minmax(0,2fr)_100px_130px_130px_150px_100px] items-center gap-x-3.5';
    const horasMin = (s: number) => {
        const h = Math.floor(s / 3600);
        const m = Math.round((s % 3600) / 60);
        return h > 0 ? t('llamadas.panel.indicadores.horasMin', { h, m: String(m).padStart(2, '0') }) : t('llamadas.panel.indicadores.min', { m });
    };
    return (
        <section aria-labelledby="por-asesor" className={TARJETA}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-4 pb-3">
                <h2 id="por-asesor" className={cn('text-[15px] font-semibold', NAVY)}>
                    {t('llamadas.panel.indicadores.porAsesor')}
                </h2>
                <span className={cn('text-[12px]', SUAVE)}>{t('llamadas.panel.indicadores.ordenado')}</span>
            </div>
            {filas.length === 0 ? (
                <p className={cn('border-t px-5 py-6 text-[13px]', FILETE, SUAVE)}>{t('llamadas.panel.indicadores.sinAtendidas')}</p>
            ) : (
                <div className="relative overflow-x-auto">
                    <div role="table" aria-labelledby="por-asesor" className="min-w-[760px]">
                        <div role="row" className={cn(columnas, 'h-[34px] border-y bg-[#f4f5f9]/70 px-5 text-[11px] font-semibold tracking-[.04em] uppercase dark:bg-white/[0.03]', FILETE, SUAVE)}>
                            <span role="columnheader">{t('llamadas.panel.indicadores.col.asesor')}</span>
                            <span role="columnheader" className="text-right">{t('llamadas.panel.indicadores.col.atendidas')}</span>
                            <span role="columnheader" className="text-right">{t('llamadas.panel.indicadores.col.hablando')}</span>
                            <span role="columnheader" className="text-right">{t('llamadas.panel.indicadores.col.duracion')}</span>
                            <span role="columnheader" className="text-right">{t('llamadas.panel.indicadores.col.espera')}</span>
                            <span role="columnheader" className="text-right">{t('llamadas.panel.indicadores.col.cortadas')}</span>
                        </div>
                        <div role="rowgroup">
                            {filas.map((f) => (
                                <div role="row" key={f.id} className={cn(columnas, 'h-11 border-b px-5 text-[13px] last:border-b-0', FILETE)}>
                                    <span role="cell" className={cn('truncate font-semibold', NAVY)}>{nombrePropio(f.nombre)}</span>
                                    <span role="cell" className={cn('text-right tabular-nums', NAVY)}>{numero(f.atendidas)}</span>
                                    <span role="cell" className={cn('text-right tabular-nums', MEDIO)}>{horasMin(f.hablando)}</span>
                                    <span role="cell" className={cn('text-right tabular-nums', MEDIO)}>{mmss(f.duracion_promedio)}</span>
                                    <span role="cell" className={cn('text-right tabular-nums', MEDIO)}>{mmss(f.espera_promedio)}</span>
                                    <span role="cell" className={cn('text-right tabular-nums', f.cortadas ? 'text-amber-700 dark:text-amber-400' : MEDIO)}>{numero(f.cortadas)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}

// ── Ajustes ─────────────────────────────────────────────────────────────────────────────────────────────────────────

function PestanaAjustes({ onPendientes }: { onPendientes: (pendientes: boolean) => void }) {
    const { t } = useTranslation();
    const { datos, error, reintentar } = useDatos<AjustesRespuesta>(`${BASE}/ajustes`, 0);
    const [form, setForm] = useState<AjustesForm | null>(null);
    const [original, setOriginal] = useState<string>('');
    const [guardando, setGuardando] = useState(false);
    const [falla, setFalla] = useState<string | null>(null);
    const [nuevoFestivo, setNuevoFestivo] = useState<string | null>(null);
    // Lo que se está escribiendo en «Timbra durante» (null: se muestra lo guardado en el formulario).
    const [esperaTexto, setEsperaTexto] = useState<string | null>(null);

    const [visto, setVisto] = useState<AjustesRespuesta | null>(null);
    if (datos && datos !== visto) {
        setVisto(datos);
        const f = { ...datos.ajustes, espera: Math.max(5, Math.min(30, datos.espera || 25)) };
        setForm(f);
        setOriginal(JSON.stringify(f));
    }

    const cambiado = !!form && JSON.stringify(form) !== original;

    // La pestaña muestra un punto mientras haya cambios sin guardar.
    useEffect(() => {
        onPendientes(cambiado);
    }, [cambiado, onPendientes]);

    // Con cambios sin guardar, salir de la pantalla (otro menú, recargar, cerrar) pregunta antes.
    useEffect(() => {
        if (!cambiado) return;
        const alCerrar = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', alCerrar);
        const quitar = router.on('before', (evento) => {
            const visita = evento.detail.visit;
            if (visita.prefetch || visita.only.length > 0 || visita.method !== 'get') return;
            if (!window.confirm(t('llamadas.panel.ajustes.salirSinGuardar'))) evento.preventDefault();
        });
        return () => {
            window.removeEventListener('beforeunload', alCerrar);
            quitar();
        };
    }, [cambiado, t]);

    if (error && !datos) return <ErrorCarga onReintentar={reintentar} className={TARJETA} />;

    const poner = (parcial: Partial<AjustesForm>) => setForm((f) => (f ? { ...f, ...parcial } : f));
    // Lo que no tiene sentido no se deja guardar (cierre antes de la apertura); lo raro, se avisa.
    const horaInvalida = !!form && form.desde >= form.hasta;
    const sinDias = !!form && form.dias.length === 0;
    const grupoVacio = !!form && form.modo === 'grupo' && form.grupo.length === 0;

    const guardar = async () => {
        if (!form || guardando || horaInvalida) return;
        setGuardando(true);
        setFalla(null);
        try {
            const r = await axios.post<{ ok: boolean; ajustes: AjustesBase; aviso_meta: string | null }>(`${BASE}/ajustes`, form);
            const f = { ...r.data.ajustes, espera: r.data.aviso_meta ? JSON.parse(original).espera : form.espera };
            setForm(f);
            setOriginal(JSON.stringify(f));
            if (r.data.aviso_meta) toast.warning(t('llamadas.panel.ajustes.metaNoAcepto'));
            else toast.success(t('llamadas.panel.ajustes.guardado'));
        } catch (e) {
            const msg = axios.isAxiosError(e) ? (e.response?.data as { message?: string } | undefined)?.message : undefined;
            setFalla(msg || t('llamadas.panel.ajustes.noSeGuardo'));
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
            <section aria-label={t('llamadas.panel.tabs.ajustes')} className={TARJETA}>
                {!form || !datos ? (
                    <div className={cn('flex items-center gap-2 px-5 py-8 text-[13px]', SUAVE)}>
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        {t('llamadas.panel.cargando')}
                    </div>
                ) : (
                    <>
                        {/* Horario */}
                        <div className="flex flex-col gap-3.5 px-5 pt-5 pb-5">
                            <div>
                                <h2 className={cn('text-[15px] font-semibold', NAVY)}>{t('llamadas.panel.ajustes.horario')}</h2>
                                <p className={cn('mt-0.5 text-[13px] leading-[18px] text-pretty', SUAVE)}>{t('llamadas.panel.ajustes.horarioAyuda')}</p>
                            </div>
                            <div role="group" aria-label={t('llamadas.panel.ajustes.dias')} className="flex flex-wrap gap-1.5">
                                {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                                    const si = form.dias.includes(d);
                                    return (
                                        <button
                                            key={d}
                                            type="button"
                                            aria-pressed={si}
                                            aria-label={nombreDia(d, 'long')}
                                            onClick={() => poner({ dias: si ? form.dias.filter((x) => x !== d) : [...form.dias, d].sort((a, b) => a - b) })}
                                            className={cn(
                                                'h-9 min-w-12 rounded-[10px] px-3 text-[13px] font-semibold transition-[background-color,color,scale] duration-150 active:scale-[0.96]',
                                                si
                                                    ? 'bg-[#2e3f84] text-white dark:bg-[#5d6fc0]'
                                                    : 'bg-[#f0f2f8] text-[#4a5378] shadow-[inset_0_0_0_1px_#d4d8e8] hover:text-[#1e2550] dark:bg-white/[0.04] dark:text-neutral-400 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]',
                                            )}
                                        >
                                            {nombreDia(d, 'short')}
                                        </button>
                                    );
                                })}
                            </div>
                            <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]', MEDIO)}>
                                <label className="flex items-center gap-2">
                                    <span className="w-11 sm:w-auto">{t('llamadas.panel.ajustes.desde')}</span>
                                    <input type="time" step={300} value={form.desde} onChange={(e) => poner({ desde: e.target.value })} className={cn(CAMPO, 'h-9 rounded-[9px] px-2.5 text-[16px] tabular-nums sm:text-[13px]', NAVY)} />
                                </label>
                                <label className="flex items-center gap-2">
                                    <span className="w-11 sm:w-auto">{t('llamadas.panel.ajustes.hasta')}</span>
                                    <input
                                        type="time"
                                        step={300}
                                        value={form.hasta}
                                        aria-invalid={horaInvalida}
                                        aria-describedby={horaInvalida ? 'ajustes-hora-invalida' : undefined}
                                        onChange={(e) => poner({ hasta: e.target.value })}
                                        className={cn(CAMPO, 'h-9 rounded-[9px] px-2.5 text-[16px] tabular-nums sm:text-[13px]', NAVY, horaInvalida && 'shadow-[inset_0_0_0_1.5px_#dc2626]')}
                                    />
                                </label>
                            </div>
                            {horaInvalida && (
                                <p id="ajustes-hora-invalida" role="alert" className="flex items-center gap-1.5 text-[12px] font-medium text-red-700 dark:text-red-400">
                                    <CircleAlert className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                                    {t('llamadas.panel.ajustes.horaInvalida')}
                                </p>
                            )}
                            {sinDias && (
                                <p className="flex items-center gap-1.5 text-[12px] font-medium text-amber-800 dark:text-amber-300">
                                    <CircleAlert className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                                    {t('llamadas.panel.ajustes.sinDias')}
                                </p>
                            )}
                            <div className="flex flex-col gap-2">
                                <p className={cn('text-[13px] font-medium', MEDIO)}>{t('llamadas.panel.ajustes.festivos')}</p>
                                <div className="flex flex-wrap items-center gap-1.5">
                                    {form.festivos.map((f) => (
                                        <span key={f} className="flex h-8 items-center gap-1 rounded-full bg-[#eef0f7] pr-1 pl-3 text-[12px] font-medium text-[#3c4570] dark:bg-white/[0.06] dark:text-neutral-300">
                                            {fechaLarga(f)}
                                            <button
                                                type="button"
                                                onClick={() => poner({ festivos: form.festivos.filter((x) => x !== f) })}
                                                aria-label={t('llamadas.panel.ajustes.quitarFestivo', { fecha: fechaLarga(f) })}
                                                className="relative flex size-6 items-center justify-center rounded-full text-[#5c6485] hover:bg-black/5 after:absolute after:-inset-x-2 after:-inset-y-1.5 dark:text-neutral-400 dark:hover:bg-white/10"
                                            >
                                                <X className="size-3.5" strokeWidth={2} aria-hidden="true" />
                                            </button>
                                        </span>
                                    ))}
                                    {nuevoFestivo === null ? (
                                        <button
                                            type="button"
                                            onClick={() => setNuevoFestivo('')}
                                            className="flex h-8 items-center gap-1 rounded-full px-3 text-[12px] font-semibold text-[#2e3f84] shadow-[inset_0_0_0_1px_#c8cee2] hover:bg-[#2e3f84]/5 dark:text-[#aab6ee] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.15)]"
                                        >
                                            <Plus className="size-3.5" strokeWidth={2} aria-hidden="true" />
                                            {t('llamadas.panel.ajustes.agregarFestivo')}
                                        </button>
                                    ) : (
                                        <span className="flex items-center gap-1.5">
                                            <input
                                                type="date"
                                                value={nuevoFestivo}
                                                autoFocus
                                                aria-label={t('llamadas.panel.ajustes.fechaFestivo')}
                                                onChange={(e) => setNuevoFestivo(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Escape') setNuevoFestivo(null);
                                                }}
                                                className={cn(CAMPO, 'h-8 rounded-[9px] px-2 text-[16px] sm:text-[12px]', NAVY)}
                                            />
                                            <button
                                                type="button"
                                                disabled={!nuevoFestivo}
                                                onClick={() => {
                                                    if (nuevoFestivo && !form.festivos.includes(nuevoFestivo)) poner({ festivos: [...form.festivos, nuevoFestivo].sort() });
                                                    setNuevoFestivo(null);
                                                }}
                                                className={cn(BOTON_PRIMARIO, 'h-8 px-3 text-[12px]')}
                                            >
                                                {t('llamadas.panel.ajustes.agregar')}
                                            </button>
                                            <button type="button" onClick={() => setNuevoFestivo(null)} className={cn('px-1 text-[12px]', ENLACE)}>
                                                {t('llamadas.panel.ajustes.cancelar')}
                                            </button>
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Espera antes del buzón */}
                        <div className={cn('flex flex-col gap-2 border-t px-5 py-5', FILETE)}>
                            <h2 className={cn('text-[15px] font-semibold', NAVY)}>{t('llamadas.panel.ajustes.antesDelBuzon')}</h2>
                            <div className={cn('flex flex-wrap items-center gap-2 text-[13px]', MEDIO)}>
                                {t('llamadas.panel.ajustes.timbraDurante')}
                                <span className={cn(CAMPO, ANILLO_CAMPO, 'flex h-9 items-center rounded-[10px]')}>
                                    <button
                                        type="button"
                                        onClick={() => poner({ espera: Math.max(5, form.espera - 1) })}
                                        aria-label={t('llamadas.panel.ajustes.menos')}
                                        disabled={form.espera <= 5}
                                        className="relative m-0.5 flex size-8 items-center justify-center rounded-[8px] text-[#2e3f84] transition-[background-color,scale] duration-150 after:absolute after:-inset-0.5 hover:bg-[#2e3f84]/8 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40 dark:text-[#aab6ee] dark:hover:bg-white/10"
                                    >
                                        <Minus className="size-4" strokeWidth={2} aria-hidden="true" />
                                    </button>
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        min={5}
                                        max={30}
                                        value={esperaTexto ?? String(form.espera)}
                                        aria-label={t('llamadas.panel.ajustes.segundosEtiqueta')}
                                        onChange={(e) => {
                                            setEsperaTexto(e.target.value);
                                            const n = Number.parseInt(e.target.value, 10);
                                            if (n >= 5 && n <= 30) poner({ espera: n });
                                        }}
                                        onBlur={() => setEsperaTexto(null)}
                                        className={cn(
                                            'w-9 bg-transparent text-center text-[16px] font-semibold tabular-nums outline-hidden [appearance:textfield] sm:text-[13px] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
                                            NAVY,
                                        )}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => poner({ espera: Math.min(30, form.espera + 1) })}
                                        aria-label={t('llamadas.panel.ajustes.mas')}
                                        disabled={form.espera >= 30}
                                        className="relative m-0.5 flex size-8 items-center justify-center rounded-[8px] text-[#2e3f84] transition-[background-color,scale] duration-150 after:absolute after:-inset-0.5 hover:bg-[#2e3f84]/8 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40 dark:text-[#aab6ee] dark:hover:bg-white/10"
                                    >
                                        <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
                                    </button>
                                </span>
                                {t('llamadas.panel.ajustes.segundosSiNadie')}
                            </div>
                            <p className={cn('text-[12px]', SUAVE)}>{t('llamadas.panel.ajustes.maximo')}</p>
                        </div>

                        {/* A quién le timbra */}
                        <fieldset className={cn('flex flex-col gap-2.5 border-t px-5 py-5', FILETE)}>
                            <legend className={cn('float-left mb-1 text-[15px] font-semibold', NAVY)}>{t('llamadas.panel.ajustes.aQuien')}</legend>
                            {(
                                [
                                    ['turno', t('llamadas.panel.ajustes.modoTurno'), t('llamadas.panel.ajustes.modoTurnoAyuda')],
                                    ['grupo', t('llamadas.panel.ajustes.modoGrupo'), t('llamadas.panel.ajustes.modoGrupoAyuda')],
                                ] as const
                            ).map(([id, titulo, ayuda]) => (
                                <label key={id} className="flex cursor-pointer items-start gap-3 rounded-xl px-1 py-1">
                                    <input type="radio" name="modo" value={id} checked={form.modo === id} onChange={() => poner({ modo: id })} className="mt-0.5 size-[18px] accent-[#2e3f84]" />
                                    <span className="flex flex-col">
                                        <span className={cn('text-[13px] font-semibold', NAVY)}>{titulo}</span>
                                        <span className={cn('text-[12px] leading-[17px]', SUAVE)}>{ayuda}</span>
                                    </span>
                                </label>
                            ))}
                            {form.modo === 'grupo' && (
                                // Un campo de selección (fondo de campo, como los buscadores), no una tarjeta dentro de la tarjeta.
                                <div className={cn(CAMPO, 'ml-8 max-h-64 overflow-y-auto rounded-[10px]')}>
                                    {datos.usuarios.filter((u) => u.role === 'advisor').map((u) => {
                                        const si = form.grupo.includes(u.id);
                                        return (
                                            <label
                                                key={u.id}
                                                className="flex cursor-pointer items-center gap-3 border-b border-[#d4d8e8]/70 px-3 py-2 last:border-b-0 dark:border-white/[0.07]"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={si}
                                                    onChange={() => poner({ grupo: si ? form.grupo.filter((x) => x !== u.id) : [...form.grupo, u.id] })}
                                                    className="size-4 accent-[#2e3f84]"
                                                />
                                                <span className={cn('min-w-0 flex-1 truncate text-[13px]', NAVY)}>{nombrePropio(u.name)}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                            {grupoVacio && (
                                <p className="ml-8 flex items-center gap-1.5 text-[12px] font-medium text-amber-800 dark:text-amber-300">
                                    <CircleAlert className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                                    {t('llamadas.panel.ajustes.grupoVacio')}
                                </p>
                            )}
                        </fieldset>

                        {/* Fija abajo: en pantallas bajas Guardar quedaba fuera de la vista. */}
                        <div className={cn('sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2.5 rounded-b-2xl border-t bg-card px-5 py-3.5', FILETE)}>
                            {cambiado && !falla && <p className={cn('mr-auto text-[12px] font-medium', 'text-amber-800 dark:text-amber-300')}>{t('llamadas.panel.ajustes.cambiosSinGuardar')}</p>}
                            {falla && (
                                <p role="alert" className="mr-auto text-[13px] text-red-700 dark:text-red-400">
                                    {falla}
                                </p>
                            )}
                            <button
                                type="button"
                                className={BOTON_SECUNDARIO}
                                disabled={!cambiado || guardando}
                                onClick={() => {
                                    setForm(JSON.parse(original));
                                    setFalla(null);
                                    setNuevoFestivo(null);
                                }}
                            >
                                {t('llamadas.panel.ajustes.descartar')}
                            </button>
                            <button type="button" className={BOTON_PRIMARIO} disabled={!cambiado || guardando || horaInvalida} onClick={guardar}>
                                {guardando && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                                {t('llamadas.panel.ajustes.guardar')}
                            </button>
                        </div>
                    </>
                )}
            </section>
            <ConexionWhatsApp />
        </div>
    );
}

function ConexionWhatsApp() {
    const { t } = useTranslation();
    const [refrescar, setRefrescar] = useState(0);
    const { datos, cargando, error, reintentar } = useDatos<Conexion>(`${BASE}/conexion${refrescar ? `?refrescar=1&n=${refrescar}` : ''}`, 0);
    const [microfono, setMicrofono] = useState<'si' | 'no' | 'bloqueado'>(() => (microfonoDisponible() ? 'si' : 'no'));

    useEffect(() => {
        if (!microfonoDisponible() || !navigator.permissions?.query) return;
        let vigente = true;
        navigator.permissions
            .query({ name: 'microphone' as PermissionName })
            .then((p) => {
                if (vigente && p.state === 'denied') setMicrofono('bloqueado');
            })
            .catch(() => undefined);
        return () => {
            vigente = false;
        };
    }, []);

    type Item = { estado: 'ok' | 'falta' | 'desconocido' | 'info'; titulo: string; detalle: string };
    const items: Item[] = datos
        ? [
              {
                  estado: datos.numero,
                  titulo: t('llamadas.panel.conexion.numero'),
                  detalle: datos.numero === 'ok' ? t('llamadas.panel.conexion.numeroOk') : datos.numero === 'falta' ? t('llamadas.panel.conexion.numeroFalta') : t('llamadas.panel.conexion.noSeSupo'),
              },
              {
                  estado: datos.campo_calls,
                  titulo: t('llamadas.panel.conexion.campo'),
                  detalle:
                      datos.campo_calls === 'ok'
                          ? t('llamadas.panel.conexion.campoOk')
                          : datos.campo_calls === 'falta'
                            ? t('llamadas.panel.conexion.campoFalta')
                            : t('llamadas.panel.conexion.campoDesconocido'),
              },
              {
                  estado: datos.firma,
                  titulo: datos.firma === 'ok' ? t('llamadas.panel.conexion.firmaOk') : t('llamadas.panel.conexion.firmaFalta'),
                  detalle: datos.firma === 'ok' ? t('llamadas.panel.conexion.firmaOkDetalle') : t('llamadas.panel.conexion.firmaFaltaDetalle'),
              },
              {
                  estado: datos.anuncio,
                  titulo: t('llamadas.panel.conexion.anuncio'),
                  detalle: datos.anuncio === 'ok' ? t('llamadas.panel.conexion.anuncioOk') : t('llamadas.panel.conexion.anuncioFalta'),
              },
              {
                  estado: 'info',
                  titulo: datos.activas ? t('llamadas.panel.conexion.encendidas') : t('llamadas.panel.conexion.apagadas'),
                  detalle: datos.activas ? t('llamadas.panel.conexion.encendidasDetalle') : t('llamadas.panel.conexion.apagadasDetalle'),
              },
              {
                  estado: microfono === 'si' ? 'ok' : 'falta',
                  titulo: microfono === 'si' ? t('llamadas.panel.conexion.microfonoSi') : t('llamadas.panel.conexion.microfonoNo'),
                  detalle: microfono === 'bloqueado' ? t('llamadas.panel.conexion.microfonoBloqueado') : t('llamadas.panel.conexion.microfonoDetalle'),
              },
          ]
        : [];

    const icono = (e: Item['estado']) => {
        if (e === 'ok') return <CircleCheck className="size-[18px] text-emerald-600 dark:text-emerald-400" strokeWidth={2} aria-hidden="true" />;
        if (e === 'falta') return <CircleAlert className="size-[18px] text-amber-600 dark:text-amber-400" strokeWidth={2} aria-hidden="true" />;
        if (e === 'info') return datos?.activas ? <PhoneIncoming className="size-[18px] text-[#2e3f84] dark:text-[#aab6ee]" strokeWidth={2} aria-hidden="true" /> : <PhoneOff className={cn('size-[18px]', SUAVE)} strokeWidth={2} aria-hidden="true" />;
        return <CircleHelp className={cn('size-[18px]', SUAVE)} strokeWidth={2} aria-hidden="true" />;
    };

    return (
        <section aria-labelledby="conexion-titulo" className={cn(TARJETA, 'flex flex-col gap-3 p-5')}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h2 id="conexion-titulo" className={cn('text-[15px] font-semibold', NAVY)}>
                        {t('llamadas.panel.conexion.titulo')}
                    </h2>
                    <p className={cn('mt-0.5 text-[12px] leading-[17px] text-pretty', SUAVE)}>{t('llamadas.panel.conexion.ayuda')}</p>
                </div>
                <button
                    type="button"
                    onClick={() => setRefrescar((n) => n + 1)}
                    aria-label={t('llamadas.panel.conexion.volver')}
                    title={t('llamadas.panel.conexion.volver')}
                    className={cn('relative flex size-8 shrink-0 items-center justify-center rounded-[9px] after:absolute after:-inset-1 hover:bg-[#2e3f84]/5 dark:hover:bg-white/10', SUAVE)}
                >
                    <RotateCw className={cn('size-4', cargando && 'animate-spin')} strokeWidth={2} aria-hidden="true" />
                </button>
            </div>
            {error && !datos ? (
                <ErrorCarga onReintentar={reintentar} className="px-0 py-3" />
            ) : !datos ? (
                <div className={cn('flex items-center gap-2 py-4 text-[13px]', SUAVE)}>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    {t('llamadas.panel.conexion.consultando')}
                </div>
            ) : (
                <ul className="flex flex-col">
                    {/* Falló «Volver a consultar»: se queda lo último que se supo, pero se avisa. */}
                    {error && !cargando && (
                        <li role="alert" className="flex items-center gap-1.5 pb-2 text-[12px] font-medium text-red-700 dark:text-red-400">
                            <CircleAlert className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                            {t('llamadas.panel.errorCarga')}
                        </li>
                    )}
                    {items.map((it) => (
                        <li key={it.titulo} className={cn('flex items-start gap-3 border-t py-2.5 first:border-t-0', FILETE)}>
                            <span className="mt-px">{icono(it.estado)}</span>
                            <span className="flex min-w-0 flex-col">
                                <span className={cn('text-[13px] font-semibold', it.estado === 'falta' ? 'text-amber-800 dark:text-amber-300' : NAVY)}>{it.titulo}</span>
                                <span className={cn('text-[12px] leading-[17px] text-pretty', SUAVE)}>{it.detalle}</span>
                            </span>
                        </li>
                    ))}
                </ul>
            )}
            <p className={cn('flex items-center gap-1.5 text-[12px]', SUAVE)}>
                <Mic className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
                {t('llamadas.panel.conexion.pie')}
            </p>
        </section>
    );
}
