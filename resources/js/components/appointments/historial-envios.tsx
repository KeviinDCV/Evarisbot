import { FILETE, FOCO, HOJA, TEXTO_NAVY, TEXTO_SUAVE, esIngles, fechaLocal, miles, nombrePropio } from '@/components/appointments/piezas-citas';
import { BotonDescargarExcel } from '@/components/bulk-sends/descargar-excel';
import { Banda, Barra, SANGRIA, Segmentado, fechaHora } from '@/components/bulk-sends/piezas-envio';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import type { TFunction } from 'i18next';
import { Ban, ChevronRight, CircleCheck, CircleX, History, LoaderCircle, Moon, Pause, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

/* ── Historial de envíos de recordatorios (Citas) ─────────────────────────────────────────────────────
   Una fila por envío con sus cifras EN VIVO (App\Support\HistorialEnvios): cuántas llegaron, cuántas confirmaron,
   cancelaron o siguen sin respuesta, y cómo fueron las llamadas del robot. Pulsar una fila abre la lista de citas
   filtrada por ese envío (paciente por paciente). Las horas llegan en hora de Colombia ('Y-m-d H:i'). */

export type TipoEnvioHistorial = 'normal' | 'dia_antes' | 'todas';
export type EstadoHistorial = 'en_curso' | 'terminado' | 'detenido' | 'cortado';

export interface CifrasEnvio {
    llegaron: number;
    no_entregados: number;
    con_error: number;
    por_enviar: number;
    sin_respuesta: number;
    confirmadas: number;
    conf_llamada: number;
    canceladas: number;
    canc_llamada: number;
    canc_hospital: number;
    telefono_2: number;
    borradas: number;
    reenviadas: number;
}

export interface LlamadasEnvio {
    total: number;
    confirmo: number;
    cancelo: number;
    sin_marcar: number;
    no_contesto: number;
    rechazo: number;
    no_se_pudo: number;
    no_llamar: number;
    en_curso: number;
}

export interface EnvioHistorial {
    id: number;
    batch_id: string | null;
    tipo: TipoEnvioHistorial;
    fecha_citas: string | null;
    fecha_hasta: string | null;
    estado: EstadoHistorial;
    motivo: string | null;
    iniciado_por: string | null;
    inicio: string | null;
    fin: string | null;
    total: number;
    sin_celular: number;
    cifras: CifrasEnvio;
    llamadas: LlamadasEnvio;
}

/** El envío que está saliendo ahora (lo actualiza el sondeo de la página): su fila se pinta con estas cifras. */
export interface EnvioEnVivo {
    batchId: string | null;
    progreso: { total: number; sent: number; failed: number; pending: number; percentage: number } | null;
    pausa: boolean;
    espera: boolean;
}

type Filtro = 'todos' | EstadoHistorial;

const COLUMNAS = 'grid-cols-[minmax(0,1.4fr)_108px_140px_minmax(0,1.25fr)_120px_152px_16px] gap-x-5';

/** «1 de diciembre» (y el año si no es el actual). */
function diaMes(ymd: string | null | undefined, lng: string) {
    const fecha = fechaLocal(ymd);
    if (!fecha) return ymd ?? '';
    const otroAnio = fecha.getFullYear() !== new Date().getFullYear();
    return fecha.toLocaleDateString(esIngles(lng) ? 'en-US' : 'es-CO', { day: 'numeric', month: 'long', ...(otroAnio ? { year: 'numeric' } : {}) });
}

/** «Citas del 1 de diciembre» o «Citas del 1 al 31 de diciembre». */
export function nombreEnvio(e: Pick<EnvioHistorial, 'fecha_citas' | 'fecha_hasta'>, t: TFunction, lng: string) {
    if (e.fecha_hasta && e.fecha_hasta !== e.fecha_citas) {
        return t('appointments.history.rangeName', { from: diaMes(e.fecha_citas, lng), to: diaMes(e.fecha_hasta, lng) });
    }
    return t('appointments.history.dayName', { date: diaMes(e.fecha_citas, lng) });
}

/** Cifras de la barra: las del sondeo si es el envío vivo; si no, las contadas en la base. */
function progresoDe(e: EnvioHistorial, enVivo?: EnvioEnVivo | null) {
    if (e.estado === 'en_curso' && enVivo?.progreso && enVivo.batchId && enVivo.batchId === e.batch_id) {
        const p = enVivo.progreso;
        return { total: p.total, ok: p.sent, mal: p.failed, hechas: p.total - p.pending, pct: p.percentage, vivo: true };
    }
    const c = e.cifras;
    const hechas = Math.max(0, e.total - c.por_enviar);
    return { total: e.total, ok: c.llegaron, mal: c.no_entregados + c.con_error, hechas, pct: e.total ? Math.floor((hechas / e.total) * 100) : 0, vivo: false };
}

export function EstadoDeEnvio({ envio, enVivo, peq = false }: { envio: EnvioHistorial; enVivo?: EnvioEnVivo | null; peq?: boolean }) {
    const { t } = useTranslation();
    const texto = peq ? 'text-[12.5px] leading-4' : 'text-[13px] leading-[18px]';
    const base = cn('inline-flex items-center gap-1.5 font-semibold whitespace-nowrap', texto);
    const icono = 'size-3.5 shrink-0';

    if (envio.estado === 'en_curso') {
        const vivo = enVivo?.batchId === envio.batch_id;
        if (vivo && enVivo?.pausa) {
            return (
                <span className={cn(base, 'text-amber-700 dark:text-amber-400')}>
                    <Pause className={icono} strokeWidth={2.25} aria-hidden="true" />
                    {t('appointments.history.statusPaused')}
                </span>
            );
        }
        if (vivo && enVivo?.espera) {
            return (
                <span className={cn(base, 'text-[#2e3f84] dark:text-[#a9b6ec]')}>
                    <Moon className={icono} strokeWidth={2.25} aria-hidden="true" />
                    {t('appointments.history.statusWaiting')}
                </span>
            );
        }
        return (
            <span className={cn(base, 'text-sky-700 dark:text-sky-300')}>
                <LoaderCircle className={cn(icono, 'animate-spin text-sky-600 motion-reduce:animate-none dark:text-sky-400')} strokeWidth={2.25} aria-hidden="true" />
                {t('appointments.history.statusSending')}
            </span>
        );
    }
    if (envio.estado === 'detenido') {
        return (
            <span className={cn(base, 'text-slate-600 dark:text-neutral-300')}>
                <Ban className={icono} strokeWidth={2.25} aria-hidden="true" />
                {t('appointments.history.statusStopped')}
            </span>
        );
    }
    if (envio.estado === 'cortado') {
        const motivo = envio.motivo && ['plantilla', 'cuenta', 'limite'].includes(envio.motivo) ? envio.motivo : 'otro';
        return (
            <span className={cn(base, 'text-red-700 dark:text-red-400')} title={t(`appointments.cutReason.${motivo as 'plantilla' | 'cuenta' | 'limite' | 'otro'}`)}>
                <CircleX className={icono} strokeWidth={2.25} aria-hidden="true" />
                {t('appointments.history.statusCut')}
            </span>
        );
    }
    return (
        <span className={cn(base, 'text-emerald-700 dark:text-emerald-400')}>
            <CircleCheck className={icono} strokeWidth={2.25} aria-hidden="true" />
            {t('appointments.history.statusDone')}
        </span>
    );
}

function Respuestas({ c, lng }: { c: CifrasEnvio; lng: string }) {
    const { t } = useTranslation();
    const detalle = t('appointments.history.confirmedBreakdown', { whatsapp: miles(c.confirmadas - c.conf_llamada, lng), call: miles(c.conf_llamada, lng) });
    return (
        <div className="min-w-0">
            <p className="text-[13px] leading-[18px] font-semibold text-emerald-700 tabular-nums dark:text-emerald-400" title={detalle}>
                {t('appointments.history.confirmed', { count: c.confirmadas, value: miles(c.confirmadas, lng) })}
            </p>
            <p className={cn('mt-0.5 text-[12px] leading-4 tabular-nums', TEXTO_SUAVE)}>
                {t('appointments.history.cancelled', { count: c.canceladas, value: miles(c.canceladas, lng) })} ·{' '}
                {t('appointments.history.noAnswer', { value: miles(c.sin_respuesta, lng) })}
            </p>
        </div>
    );
}

function Llamadas({ l, lng }: { l: LlamadasEnvio; lng: string }) {
    const { t } = useTranslation();
    if (l.total === 0) return <p className={cn('text-[12.5px] leading-4', TEXTO_SUAVE)}>{t('appointments.history.noCalls')}</p>;
    return (
        <div className="min-w-0">
            <p className={cn('text-[13px] leading-[18px] font-semibold tabular-nums', TEXTO_NAVY)}>{t('appointments.history.calls', { count: l.total, value: miles(l.total, lng) })}</p>
            <p className={cn('mt-0.5 text-[12px] leading-4 tabular-nums', TEXTO_SUAVE)}>{t('appointments.history.callsConfirmed', { count: l.confirmo, value: miles(l.confirmo, lng) })}</p>
        </div>
    );
}

export default function HistorialEnvios({ envios, routePrefix, enVivo }: { envios: EnvioHistorial[] | null | undefined; routePrefix: string; enVivo?: EnvioEnVivo | null }) {
    const { t, i18n } = useTranslation();
    const lng = i18n.language;
    const [filtro, setFiltro] = useState<Filtro>('todos');
    const [busqueda, setBusqueda] = useState('');
    const lista = useMemo(() => envios ?? [], [envios]);

    const tipoTexto = (tipo: TipoEnvioHistorial) =>
        tipo === 'todas' ? t('appointments.history.typeAll') : tipo === 'dia_antes' ? t('appointments.history.typeDayBefore') : t('appointments.history.typeNormal');

    // La búsqueda mira lo que se ve en la fila: el nombre del envío, el tipo, quién lo inició y la fecha.
    const encontrados = useMemo(() => {
        const q = busqueda.trim().toLocaleLowerCase(lng).normalize('NFD').replace(/\p{Diacritic}/gu, '');
        if (!q) return lista;
        return lista.filter((e) =>
            [nombreEnvio(e, t, lng), tipoTexto(e.tipo), e.iniciado_por ?? '', fechaHora(e.inicio, lng)]
                .join(' ')
                .toLocaleLowerCase(lng)
                .normalize('NFD')
                .replace(/\p{Diacritic}/gu, '')
                .includes(q)
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lista, busqueda, lng]);

    const cuenta = (estado: EstadoHistorial) => encontrados.filter((e) => e.estado === estado).length;
    const opciones: { value: Filtro; label: string; count?: string }[] = [
        { value: 'todos', label: t('appointments.history.filterAll'), count: encontrados.length > 0 ? miles(encontrados.length, lng) : undefined },
        ...(
            [
                ['en_curso', t('appointments.history.filterSending')],
                ['terminado', t('appointments.history.filterDone')],
                ['detenido', t('appointments.history.filterStopped')],
                ['cortado', t('appointments.history.filterCut')],
            ] as [EstadoHistorial, string][]
        )
            // Solo los estados que hay (o el elegido): menos botones que leer.
            .filter(([valor]) => cuenta(valor) > 0 || filtro === valor)
            .map(([valor, label]) => ({ value: valor as Filtro, label, count: cuenta(valor) > 0 ? miles(cuenta(valor), lng) : undefined })),
    ];
    const visibles = filtro === 'todos' ? encontrados : encontrados.filter((e) => e.estado === filtro);

    return (
        <section aria-labelledby="citas-historial" className={HOJA}>
            <Banda
                id="citas-historial"
                icon={History}
                titulo={t('appointments.history.title')}
                cuenta={envios && envios.length > 0 ? miles(envios.length, lng) : undefined}
                texto={t('appointments.history.subtitle')}
                acciones={
                    envios && envios.length > 0 ? (
                        <BotonDescargarExcel href={`${routePrefix}/envios/export`} ayuda={t('appointments.history.excelHint')} prefijo="citas_export_" />
                    ) : undefined
                }
                className={cn('rounded-t-2xl', (!envios || envios.length === 0) && 'rounded-b-2xl border-b-0')}
            />

            {envios === null && (
                <p className={cn('flex min-h-14 items-center py-3 text-[13px] leading-[18px]', SANGRIA, TEXTO_SUAVE)}>{t('appointments.history.loadError')}</p>
            )}
            {envios && envios.length === 0 && (
                <p className={cn('flex min-h-14 items-center py-3 text-[13px] leading-[18px]', SANGRIA, TEXTO_SUAVE)}>{t('appointments.history.empty')}</p>
            )}

            {envios && envios.length > 0 && (
                <>
                    <div className={cn('flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b py-3 @3xl/hoja:min-h-[60px]', SANGRIA, FILETE)}>
                        <Segmentado opciones={opciones} activa={filtro} onElegir={setFiltro} etiqueta={t('appointments.history.filterLabel')} />
                        <div className="relative w-full @3xl/hoja:w-[300px]">
                            <label htmlFor="historial-buscar" className="sr-only">
                                {t('appointments.history.searchLabel')}
                            </label>
                            <Search className={cn('pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2', TEXTO_SUAVE)} strokeWidth={2} aria-hidden="true" />
                            <input
                                id="historial-buscar"
                                type="search"
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                placeholder={t('appointments.history.searchPlaceholder')}
                                className={cn(
                                    'h-9 w-full rounded-[10px] bg-[#2e3f84]/[0.035] pr-3 pl-[38px] text-[13px] leading-[18px] shadow-[inset_0_0_0_1px_rgba(46,63,132,0.1)] outline-hidden placeholder:text-muted-foreground pointer-coarse:h-11 pointer-coarse:text-[16px] focus-visible:shadow-[inset_0_0_0_1.5px_rgba(46,63,132,0.55)] dark:bg-white/5 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]',
                                    TEXTO_NAVY
                                )}
                            />
                        </div>
                    </div>

                    {visibles.length === 0 ? (
                        <p className={cn('py-8 text-center text-[13px] leading-[18px]', TEXTO_SUAVE)} aria-live="polite">
                            {t('appointments.history.noResults')}
                        </p>
                    ) : (
                        <>
                            <div aria-hidden="true" className={cn('hidden h-9 items-center border-b bg-[#2e3f84]/[0.028] pr-5 pl-16 @5xl/hoja:grid dark:bg-white/[0.03]', COLUMNAS, FILETE)}>
                                {[
                                    t('appointments.history.colSend'),
                                    t('appointments.history.colStatus'),
                                    t('appointments.history.colProgress'),
                                    t('appointments.history.colAnswers'),
                                    t('appointments.history.colCalls'),
                                    t('appointments.history.colDate'),
                                ].map((titulo) => (
                                    <span key={titulo} className={cn('text-[11px] leading-4 font-semibold tracking-[0.07em] uppercase', TEXTO_SUAVE)}>
                                        {titulo}
                                    </span>
                                ))}
                                <span />
                            </div>
                            <ul aria-label={t('appointments.history.title')} className="rounded-b-2xl">
                                {visibles.map((e) => {
                                    const p = progresoDe(e, enVivo);
                                    const nombre = nombreEnvio(e, t, lng);
                                    const detalle = `${tipoTexto(e.tipo)} · ${t('appointments.history.appointments', { count: e.total, value: miles(e.total, lng) })}`;
                                    const lado = e.estado === 'en_curso' ? t('appointments.history.doneOf', { done: miles(p.hechas, lng), total: miles(p.total, lng) }) : t('appointments.history.arrived', { value: miles(p.ok, lng) });
                                    const quien = e.iniciado_por ? nombrePropio(e.iniciado_por) : t('appointments.history.system');
                                    return (
                                        <li key={e.id} className={cn('border-b last:border-b-0', FILETE)}>
                                            <Link
                                                href={`${routePrefix}/view?envio=${e.id}`}
                                                title={t('appointments.history.openDetail')}
                                                className={cn('block w-full text-left hover:bg-[#2e3f84]/[0.025] focus-visible:ring-inset dark:hover:bg-white/[0.025]', FOCO)}
                                            >
                                                {/* Escritorio: una fila de la tabla. */}
                                                <div className={cn('hidden min-h-[62px] items-center py-2 pr-5 pl-16 @5xl/hoja:grid', COLUMNAS)}>
                                                    <div className="min-w-0">
                                                        <p className={cn('truncate text-[13.5px] leading-[18px] font-semibold', TEXTO_NAVY)}>{nombre}</p>
                                                        <p className={cn('mt-0.5 truncate text-[12px] leading-4 tabular-nums', TEXTO_SUAVE)}>{detalle}</p>
                                                    </div>
                                                    <EstadoDeEnvio envio={e} enVivo={enVivo} />
                                                    <div className="min-w-0">
                                                        <div className="flex items-baseline justify-between gap-2 text-[12.5px] leading-4 tabular-nums">
                                                            <span className={cn('font-semibold', TEXTO_NAVY)}>{p.pct} %</span>
                                                            <span className={cn('truncate text-[12px]', TEXTO_SUAVE)}>{lado}</span>
                                                        </div>
                                                        <div className="mt-1.5">
                                                            <Barra ok={p.ok} mal={p.mal} total={p.total} />
                                                        </div>
                                                    </div>
                                                    <Respuestas c={e.cifras} lng={lng} />
                                                    <Llamadas l={e.llamadas} lng={lng} />
                                                    <div className="min-w-0">
                                                        <p className="text-[12.5px] leading-4 whitespace-nowrap text-foreground tabular-nums" title={e.inicio ?? undefined}>
                                                            {fechaHora(e.inicio, lng)}
                                                        </p>
                                                        <p className={cn('mt-0.5 truncate text-[12px] leading-4', TEXTO_SUAVE)}>{quien}</p>
                                                    </div>
                                                    <ChevronRight className={cn('size-4', TEXTO_SUAVE)} aria-hidden="true" />
                                                </div>

                                                {/* Hoja angosta: tarjeta apilada. */}
                                                <div className="flex flex-col gap-2.5 px-4 py-3.5 @5xl/hoja:hidden">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className={cn('text-[13.5px] leading-[18px] font-semibold', TEXTO_NAVY)}>{nombre}</p>
                                                            <p className={cn('mt-0.5 text-[12px] leading-4 tabular-nums', TEXTO_SUAVE)}>{detalle}</p>
                                                        </div>
                                                        <EstadoDeEnvio envio={e} enVivo={enVivo} peq />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-baseline justify-between gap-2 text-[12.5px] leading-4 tabular-nums">
                                                            <span className={cn('font-semibold', TEXTO_NAVY)}>{p.pct} %</span>
                                                            <span className={cn('text-[12px]', TEXTO_SUAVE)}>{lado}</span>
                                                        </div>
                                                        <div className="mt-1.5">
                                                            <Barra ok={p.ok} mal={p.mal} total={p.total} />
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                                        <Respuestas c={e.cifras} lng={lng} />
                                                        <Llamadas l={e.llamadas} lng={lng} />
                                                    </div>
                                                    <p className={cn('text-[12px] leading-4 tabular-nums', TEXTO_SUAVE)}>
                                                        {quien} · {fechaHora(e.inicio, lng)}
                                                    </p>
                                                </div>
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </>
                    )}
                </>
            )}
        </section>
    );
}

/** Esqueleto mientras llega el historial (prop diferida). */
export function HistorialEnviosEsqueleto() {
    const { t } = useTranslation();
    return (
        <section aria-label={t('appointments.history.title')} aria-busy="true" className={HOJA}>
            <div className={cn('flex min-h-16 items-center gap-3 rounded-t-2xl border-b px-4 @3xl/hoja:px-5', FILETE, 'bg-[#2e3f84]/[0.028] dark:bg-white/[0.03]')}>
                <span className={cn('flex w-8 justify-center', TEXTO_NAVY)}>
                    <History className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span className={cn('text-[15px] leading-5 font-semibold', TEXTO_NAVY)}>{t('appointments.history.title')}</span>
            </div>
            {[0, 1, 2].map((i) => (
                <div key={i} className={cn('flex items-center gap-6 border-b py-4 last:border-b-0', SANGRIA, FILETE)}>
                    <div className="h-4 w-48 animate-pulse rounded bg-[#2e3f84]/8 motion-reduce:animate-none dark:bg-white/10" />
                    <div className="h-4 flex-1 animate-pulse rounded bg-[#2e3f84]/6 motion-reduce:animate-none dark:bg-white/8" />
                </div>
            ))}
        </section>
    );
}
