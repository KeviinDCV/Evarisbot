import { Banda, Confirmacion, EstadoEnvio, FilaAviso, Rotulo, SANGRIA, VALIDAR, leerEstado, sesionVencida } from '@/components/appointments/panel-citas';
import {
    BOTON_APAGADO,
    BOTON_PELIGRO,
    BOTON_PRIMARIO,
    BOTON_SECUNDARIO,
    FILETE,
    FOCO,
    TEXTO_NAVY,
    TEXTO_SUAVE,
    esIngles,
    fechaLarga,
    fechaLocal,
    miles,
    nombrePropio,
} from '@/components/appointments/piezas-citas';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { router } from '@inertiajs/react';
import axios from 'axios';
import { CircleAlert, CircleCheck, Clock, History, Info, LoaderCircle, Pause, Phone, PhoneCall, Play, Square, TriangleAlert, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * RECORDATORIO POR LLAMADA en el panel de Citas (diseño aprobado el 20/11/2026, lienzo «Recordatorios por llamada en
 * Citas»). Una voz automática (el robot) llama a quienes recibieron el WhatsApp y no respondieron, y dieron permiso;
 * el paciente marca 1 o 2 y queda en su cita. La ronda la lleva el servidor (App\Support\RondaLlamadas): esta sección
 * solo la lanza, la pausa, la reanuda o la detiene, y la sigue con un sondeo secuencial mientras está en marcha.
 */

/** Una ronda de llamadas: estado + cifras contadas ahora en el servidor. Horas en hora de Colombia, 'Y-m-d H:i'. */
export interface RondaLlamadas {
    id: string;
    estado: 'en_curso' | 'pausada' | 'terminada' | 'detenida' | 'cortada';
    motivo: string | null;
    fecha_citas: string;
    iniciado_por: string | null;
    inicio: string | null;
    fin: string | null;
    sin_avanzar: boolean;
    total: number;
    confirmaron: number;
    cancelaron: number;
    no_contestaron: number;
    no_marcaron: number;
    no_se_pudo: number;
    sonando: number;
    hablando: number;
    omitidas: number;
    en_curso: number;
    por_llamar: number;
    terminadas: number;
}

/** Cifras de la próxima fecha (diferidas). Sin `activas` las llamadas de WhatsApp están apagadas. */
export interface LlamadasStats {
    activas: boolean;
    robot?: boolean;
    ensayo?: boolean;
    en_horario?: boolean;
    abre?: string | null;
    limite?: number;
    usadas?: number;
    quedan?: number;
    salen?: number;
    fecha?: string;
    no_respondieron?: number;
    con_permiso?: number;
    sin_permiso?: number;
    ya_llamadas?: number;
    fuera_ensayo?: number;
    otras?: number;
}

type Accion = 'start' | 'pause' | 'resume' | 'stop';
type Aviso = { tipo: 'ok' | 'aviso' | 'error'; texto: string };

/** Tarifa aproximada de Meta por minuto de llamada saliente a Colombia (pesos, noviembre de 2026). */
const PRECIO_MINUTO_COP = 41;
/** Llamadas a la vez (RondaLlamadas::SIMULTANEAS) y lo que dura cada una, para estimar cuánto tarda la ronda. */
const SIMULTANEAS = 3;
const SEGUNDOS_POR_LLAMADA = 70;

const ERRORES = {
    desactivadas: 'appointments.calls.errors.desactivadas',
    robot: 'appointments.calls.errors.robot',
    horario: 'appointments.calls.errors.horario',
    limite: 'appointments.calls.errors.limite',
    en_curso: 'appointments.calls.errors.en_curso',
    sin_ronda: 'appointments.calls.errors.sin_ronda',
    datos_invalidos: 'appointments.calls.errors.datos_invalidos',
    fallo: 'appointments.calls.errors.fallo',
} as const;

const MOTIVOS_CORTE = {
    horario: 'appointments.calls.cut.horario',
    limite: 'appointments.calls.cut.limite',
    robot: 'appointments.calls.cut.robot',
    desactivadas: 'appointments.calls.cut.desactivadas',
    sin_pago: 'appointments.calls.cut.sin_pago',
    fallos: 'appointments.calls.cut.fallos',
    vencida: 'appointments.calls.cut.vencida',
} as const;

/** Llamadas de la ronda: sus citas menos las que se saltaron (respondieron mientras tanto, ya no aplicaban…). */
const llamadasDe = (r: RondaLlamadas) => Math.max(0, r.total - r.omitidas);

const claveDe = <T extends Record<string, string>>(mapa: T, clave: string | null | undefined, porDefecto: keyof T) =>
    clave && Object.hasOwn(mapa, clave) ? mapa[clave as keyof T] : mapa[porDefecto];

/** Hoy y mañana en Colombia ('Y-m-d'), sin depender de la zona del equipo. */
const ymdColombia = (desplazamientoDias = 0) => {
    const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
    const f = fechaLocal(hoy)!;
    f.setDate(f.getDate() + desplazamientoDias);
    return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;
};

/** "7:00 a. m." (es) · "7:00 AM" (en) de una hora 'H:i' que ya está en hora de Colombia. */
function horaBonita(hm: string, lng: string) {
    const m = /(\d{1,2}):(\d{2})/.exec(hm);
    if (!m) return hm;
    const d = new Date(2000, 0, 1, Number(m[1]), Number(m[2]));
    return new Intl.DateTimeFormat(esIngles(lng) ? 'en-US' : 'es-CO', { hour: 'numeric', minute: '2-digit' }).format(d);
}

/** Cierra una frase con punto, salvo que ya termine en uno («… 9:31 a. m.»). */
const conPunto = (frase: string) => (frase.endsWith('.') ? frase : `${frase}.`);

const ahoraColombia = (lng: string) =>
    new Intl.DateTimeFormat(esIngles(lng) ? 'en-US' : 'es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' }).format(new Date());

export default function RecordatorioLlamada({
    routePrefix,
    ronda: rondaServidor,
    stats: statsServidor,
}: {
    routePrefix: string;
    ronda: RondaLlamadas | null;
    stats: LlamadasStats | undefined;
}) {
    const { t, i18n } = useTranslation();
    const lng = i18n.language;

    const [ronda, setRonda] = useState<RondaLlamadas | null>(rondaServidor);
    const [stats, setStats] = useState<LlamadasStats | undefined>(statsServidor);
    // Al terminar, la barra se queda con el resultado hasta cerrar el aviso.
    const [final, setFinal] = useState<RondaLlamadas | null>(null);
    const [accion, setAccion] = useState<Accion | null>(null);
    const [aviso, setAviso] = useState<Aviso | null>(null);
    const [confirmarInicio, setConfirmarInicio] = useState(false);
    const [cambio, setCambio] = useState(false);
    const [confirmarDetener, setConfirmarDetener] = useState(false);
    const [fallosSondeo, setFallosSondeo] = useState(0);
    const [anuncio, setAnuncio] = useState('');
    const version = useRef(0);

    useEffect(() => setRonda(rondaServidor), [rondaServidor]);
    useEffect(() => setStats(statsServidor), [statsServidor]);

    const enMarcha = ronda?.estado === 'en_curso';
    const activa = enMarcha || ronda?.estado === 'pausada';

    const anunciar = useCallback((texto: string) => {
        setAnuncio('');
        window.setTimeout(() => setAnuncio(texto), 80);
    }, []);

    const fechaTexto = useCallback(
        (ymd?: string | null) => {
            const f = fechaLocal(ymd);
            return f ? fechaLarga(f, lng) : (ymd ?? '');
        },
        [lng]
    );

    /** «Mañana» o el día («Lunes») de la fecha de las citas. */
    const cuandoDe = useCallback(
        (ymd?: string | null) => {
            if (ymd === ymdColombia(1)) return t('appointments.calls.tomorrow');
            const f = fechaLocal(ymd);
            if (!f) return ymd ?? '';
            const dia = f.toLocaleDateString(esIngles(lng) ? 'en-US' : 'es-CO', { weekday: 'long' });
            return dia.charAt(0).toLocaleUpperCase(lng) + dia.slice(1);
        },
        [t, lng]
    );

    /** 'Y-m-d H:i' → «hoy a las 7:00 a. m.», «mañana a las …» o «el lunes a las …». */
    const aperturaTexto = useCallback(
        (abre?: string | null) => {
            if (!abre) return '';
            const ymd = abre.slice(0, 10);
            const hora = horaBonita(abre.slice(11), lng);
            if (ymd === ymdColombia(0)) return t('appointments.calls.opensToday', { time: hora });
            if (ymd === ymdColombia(1)) return t('appointments.calls.opensTomorrow', { time: hora });
            const f = fechaLocal(ymd);
            const dia = f ? f.toLocaleDateString(esIngles(lng) ? 'en-US' : 'es-CO', { weekday: 'long' }) : ymd;
            return t('appointments.calls.opensOn', { day: dia, time: hora });
        },
        [t, lng]
    );

    /** «7 confirmaron, 2 cancelaron, 2 no contestaron y 1 no marcó» (solo lo que no es cero). */
    const partesResultado = useCallback(
        (r: RondaLlamadas) => {
            const partes = [
                r.confirmaron > 0 && t('appointments.calls.partConfirmed', { count: r.confirmaron, value: miles(r.confirmaron, lng) }),
                r.cancelaron > 0 && t('appointments.calls.partCancelled', { count: r.cancelaron, value: miles(r.cancelaron, lng) }),
                r.no_contestaron > 0 && t('appointments.calls.partNoAnswer', { count: r.no_contestaron, value: miles(r.no_contestaron, lng) }),
                r.no_marcaron > 0 && t('appointments.calls.partNoKey', { count: r.no_marcaron, value: miles(r.no_marcaron, lng) }),
                r.no_se_pudo > 0 && t('appointments.calls.partFailed', { count: r.no_se_pudo, value: miles(r.no_se_pudo, lng) }),
            ].filter(Boolean) as string[];
            if (partes.length < 2) return partes.join('');
            return `${partes.slice(0, -1).join(', ')} ${t('appointments.calls.and')} ${partes[partes.length - 1]}`;
        },
        [t, lng]
    );

    /** El aviso al terminar, detener o cortarse una ronda. */
    const resumenDe = useCallback(
        (r: RondaLlamadas): Aviso => {
            const hechas = r.terminadas + r.en_curso;
            const detalle = partesResultado(r);
            if (r.estado === 'cortada') {
                return {
                    tipo: 'error',
                    texto: t('appointments.calls.cutSummary', {
                        reason: t(claveDe(MOTIVOS_CORTE, r.motivo, 'fallos')),
                        count: hechas,
                        value: miles(hechas, lng),
                    }),
                };
            }
            if (r.estado === 'detenida') {
                return { tipo: 'ok', texto: t('appointments.calls.stopSummary', { count: hechas, value: miles(hechas, lng), left: miles(r.por_llamar, lng) }) };
            }
            return {
                tipo: 'ok',
                texto: [t('appointments.calls.finishedSummary', { count: llamadasDe(r), value: miles(llamadasDe(r), lng) }), detalle ? `${detalle}.` : '', t('appointments.calls.finishedUpdated')]
                    .filter(Boolean)
                    .join(' '),
            };
        },
        [t, lng, partesResultado]
    );

    const alTerminar = useCallback(
        (r: RondaLlamadas | null) => {
            setRonda(r);
            setFallosSondeo(0);
            if (r) {
                setFinal(llamadasDe(r) > 0 ? r : null);
                const resumen = resumenDe(r);
                setAviso(resumen);
                anunciar(resumen.texto);
            }
            router.reload({ only: ['llamadasStats', 'appointments'] });
        },
        [resumenDe, anunciar]
    );

    /**
     * Sondeo de la ronda en marcha o en pausa: SECUENCIAL (Windows agota los sockets con peticiones en paralelo), cada 4 s
     * (15 s en pausa) después de que vuelva la anterior, solo con la pestaña visible; ante errores espera 8, 15 y 30 s.
     * Así se ve también lo que hace otra persona (pausar, reanudar) desde otra pestaña.
     */
    useEffect(() => {
        if (!activa) return;
        let vivo = true;
        let enCurso = false;
        let fallos = 0;
        let temporizador: ReturnType<typeof setTimeout> | undefined;

        const vuelta = async () => {
            if (!vivo || enCurso || document.visibilityState !== 'visible') return;
            enCurso = true;
            let espera = 4000;
            const v = version.current;
            try {
                const { data } = await axios.get(`${routePrefix}/calls/status`, { headers: { Accept: 'application/json' }, timeout: 10000 });
                if (!vivo) return;
                if (!data || typeof data !== 'object' || !('ronda' in data)) {
                    vivo = false;
                    setAviso({ tipo: 'error', texto: t('appointments.sessionExpired') });
                    return;
                }
                fallos = 0;
                setFallosSondeo(0);
                if (v === version.current) {
                    const r = data.ronda as RondaLlamadas | null;
                    if (!r || (r.estado !== 'en_curso' && r.estado !== 'pausada')) {
                        vivo = false;
                        alTerminar(r);
                        return;
                    }
                    if (r.estado === 'pausada') espera = 15000;
                    setRonda(r);
                }
            } catch (error) {
                if (!vivo) return;
                if (sesionVencida(leerEstado(error))) {
                    vivo = false;
                    setAviso({ tipo: 'error', texto: t('appointments.sessionExpired') });
                    return;
                }
                fallos += 1;
                setFallosSondeo(fallos);
                espera = [8000, 15000, 30000][Math.min(fallos, 3) - 1];
            } finally {
                enCurso = false;
            }
            if (vivo) {
                clearTimeout(temporizador);
                temporizador = setTimeout(() => void vuelta(), espera + Math.random() * 500);
            }
        };

        const alVolver = () => {
            if (document.visibilityState !== 'visible') return;
            clearTimeout(temporizador);
            void vuelta();
        };

        document.addEventListener('visibilitychange', alVolver);
        temporizador = setTimeout(() => void vuelta(), 1500);
        return () => {
            vivo = false;
            clearTimeout(temporizador);
            document.removeEventListener('visibilitychange', alVolver);
        };
    }, [activa, routePrefix, t, alTerminar]);

    // Si la ronda cambia por debajo, los diálogos que ya no aplican se cierran.
    useEffect(() => {
        if (activa) setConfirmarInicio(false);
        if (!activa) setConfirmarDetener(false);
    }, [activa]);

    const textoError = useCallback(
        (status: number | undefined, code: string | undefined) =>
            sesionVencida(status) ? t('appointments.sessionExpired') : t(claveDe(ERRORES, code, 'fallo')),
        [t]
    );

    const iniciar = async () => {
        if (!stats?.fecha || !stats.salen) return;
        setAccion('start');
        version.current += 1;
        try {
            const { status, data } = await axios.post(`${routePrefix}/calls/start`, { fecha_citas: stats.fecha, esperadas: stats.salen }, VALIDAR);
            if (data?.success && data.ronda) {
                setConfirmarInicio(false);
                setCambio(false);
                setFinal(null);
                setAviso(null);
                setRonda(data.ronda);
                anunciar(t('appointments.calls.announceStarted', { count: data.ronda.total, value: miles(data.ronda.total, lng) }));
                return;
            }
            if (data?.code === 'cambio' && data.cifras) {
                setStats(data.cifras);
                setCambio(true);
                if (!data.cifras.salen) {
                    setConfirmarInicio(false);
                    setAviso({ tipo: 'aviso', texto: t('appointments.calls.nothingLeft') });
                }
                return;
            }
            setConfirmarInicio(false);
            if (data?.code === 'en_curso' && data.ronda) setRonda(data.ronda);
            if (data?.cifras) setStats(data.cifras);
            setAviso({ tipo: status === 409 ? 'aviso' : 'error', texto: textoError(status, data?.code) });
        } catch (error) {
            setConfirmarInicio(false);
            setAviso({ tipo: 'error', texto: textoError(leerEstado(error), undefined) });
        } finally {
            version.current += 1;
            setAccion(null);
        }
    };

    const cambiar = async (tipo: 'pause' | 'resume' | 'stop') => {
        setAccion(tipo);
        version.current += 1;
        const ruta = { pause: 'pause', resume: 'resume', stop: 'stop' }[tipo];
        try {
            const { status, data } = await axios.post(`${routePrefix}/calls/${ruta}`, {}, VALIDAR);
            setConfirmarDetener(false);
            if (data?.ronda !== undefined) setRonda(data.ronda);
            if (data?.cifras) setStats(data.cifras);
            if (data?.success) {
                if (tipo === 'stop' && data.ronda) {
                    alTerminar(data.ronda);
                } else {
                    setAviso(null);
                    anunciar(tipo === 'pause' ? t('appointments.calls.announcePaused') : t('appointments.calls.announceResumed'));
                }
                return;
            }
            setAviso({ tipo: status === 409 ? 'aviso' : 'error', texto: textoError(status, data?.code) });
        } catch (error) {
            setConfirmarDetener(false);
            setAviso({ tipo: 'error', texto: textoError(leerEstado(error), undefined) });
        } finally {
            version.current += 1;
            setAccion(null);
        }
    };

    // Con las llamadas de WhatsApp apagadas y sin ninguna ronda que mostrar, la sección no aparece.
    if (stats && !stats.activas && !ronda && !aviso) return null;

    const estadoBanda: { tipo: 'enviando' | 'pausa' | 'sin_avanzar' | 'quieto'; texto: string } = enMarcha
        ? ronda!.sin_avanzar
            ? { tipo: 'sin_avanzar', texto: t('appointments.calls.statusStalled') }
            : { tipo: 'enviando', texto: t('appointments.calls.statusCalling') }
        : ronda?.estado === 'pausada'
          ? { tipo: 'pausa', texto: t('appointments.calls.statusPaused') }
          : { tipo: 'quieto', texto: t('appointments.calls.statusIdle') };

    const barra = activa ? ronda : final;
    const salen = stats?.salen ?? 0;
    const conPermiso = stats?.con_permiso ?? 0;
    const parcial = salen > 0 && salen < conPermiso;
    const motivoApagado = activa
        ? t('appointments.calls.disabledRunning')
        : !stats?.robot
          ? t('appointments.calls.errors.robot')
          : !stats?.en_horario
            ? t('appointments.calls.errors.horario')
            : (stats?.quedan ?? 0) <= 0
              ? t('appointments.calls.errors.limite')
              : null;
    const apagado = accion !== null || motivoApagado !== null;
    const minutos = Math.max(1, Math.ceil((salen * SEGUNDOS_POR_LLAMADA) / SIMULTANEAS / 60));
    const costo = Math.max(100, Math.round((salen * PRECIO_MINUTO_COP) / 100) * 100);

    const acciones = activa ? (
        <>
            {enMarcha && (
                <button type="button" onClick={() => void cambiar('pause')} disabled={accion !== null} className={BOTON_SECUNDARIO}>
                    <Pause strokeWidth={1.9} aria-hidden="true" />
                    {accion === 'pause' ? t('appointments.pausing') : t('appointments.pauseButton')}
                </button>
            )}
            {ronda?.estado === 'pausada' && (
                <button type="button" onClick={() => void cambiar('resume')} disabled={accion !== null} className={BOTON_PRIMARIO}>
                    <Play strokeWidth={2} aria-hidden="true" />
                    {accion === 'resume' ? t('appointments.resuming') : t('appointments.resumeButton')}
                </button>
            )}
            <button
                type="button"
                onClick={() => setConfirmarDetener(true)}
                disabled={accion !== null}
                aria-haspopup="dialog"
                title={t('appointments.stopAsksConfirmation')}
                className={BOTON_PELIGRO}
            >
                <Square strokeWidth={2} aria-hidden="true" />
                {accion === 'stop' ? t('appointments.stopping') : t('appointments.stopButton')}
            </button>
        </>
    ) : undefined;

    return (
        <section aria-labelledby="citas-llamadas" className={cn('border-t', FILETE)}>
            <Banda id="citas-llamadas" icon={PhoneCall} titulo={t('appointments.calls.title')} estado={<EstadoEnvio tipo={estadoBanda.tipo} texto={estadoBanda.texto} />} texto={t('appointments.calls.bandText')} acciones={acciones} />

            <p className="sr-only" aria-live="polite">
                {anuncio}
            </p>

            {aviso && (
                <div
                    role={aviso.tipo === 'error' ? 'alert' : 'status'}
                    className={cn(
                        'flex items-start gap-3 border-b px-4 py-3 @3xl/hoja:px-5',
                        aviso.tipo === 'error'
                            ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300'
                            : aviso.tipo === 'aviso'
                              ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
                    )}
                >
                    <span className="flex w-8 shrink-0 justify-center pt-px">
                        {aviso.tipo === 'error' ? (
                            <CircleAlert className="size-[17px]" strokeWidth={2} aria-hidden="true" />
                        ) : aviso.tipo === 'aviso' ? (
                            <TriangleAlert className="size-[17px]" strokeWidth={2} aria-hidden="true" />
                        ) : (
                            <CircleCheck className="size-[17px]" strokeWidth={2} aria-hidden="true" />
                        )}
                    </span>
                    <p className="min-w-0 flex-1 pt-px text-[13px] leading-[19px] font-medium tabular-nums [overflow-wrap:anywhere]">{aviso.texto}</p>
                    <button
                        type="button"
                        onClick={() => {
                            setAviso(null);
                            setFinal(null);
                        }}
                        aria-label={t('appointments.closeNotice')}
                        title={t('appointments.closeNotice')}
                        className={cn('-my-0.5 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/10', FOCO)}
                    >
                        <X className="size-4" aria-hidden="true" />
                    </button>
                </div>
            )}

            {enMarcha && ronda?.sin_avanzar && <FilaAviso>{t('appointments.calls.stalledText')}</FilaAviso>}
            {enMarcha && fallosSondeo >= 2 && <FilaAviso>{t('appointments.progressRefreshFailed')}</FilaAviso>}
            {stats?.activas && stats.ensayo && <FilaAviso etiqueta={t('appointments.calls.testLabel')}>{t('appointments.calls.testText')}</FilaAviso>}
            {stats?.activas && stats.robot === false && !activa && <FilaAviso>{t('appointments.calls.robotOff')}</FilaAviso>}

            {barra && llamadasDe(barra) > 0 && (
                <div className={cn('border-b pt-[18px] pb-3.5', SANGRIA, FILETE)}>
                    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                        <div className="flex min-w-0 flex-col gap-1.5">
                            <Rotulo
                                titulo={activa ? t('appointments.calls.progressTitle') : t('appointments.calls.resultTitle')}
                                apoyo={enMarcha ? t('appointments.calls.progressAuto') : ronda?.estado === 'pausada' ? t('appointments.calls.progressPaused') : undefined}
                            />
                            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                <span
                                    className={cn(
                                        'text-[30px] leading-9 font-medium tracking-[-0.03em] whitespace-nowrap tabular-nums',
                                        ronda?.estado === 'pausada' ? 'text-amber-700 dark:text-amber-400' : TEXTO_NAVY
                                    )}
                                >
                                    {t('appointments.calls.ofTotal', { done: miles(barra.terminadas, lng), total: miles(llamadasDe(barra), lng) })}
                                </span>
                                <span className={cn('text-[14px] leading-5', TEXTO_SUAVE)}>{t('appointments.calls.callsDone', { count: llamadasDe(barra) })}</span>
                            </div>
                        </div>
                        <div className={cn('flex flex-wrap items-center gap-x-[22px] gap-y-1.5 pb-1.5 text-[13px] leading-[18px] font-medium whitespace-nowrap tabular-nums', TEXTO_NAVY)}>
                            <Leyenda color="bg-emerald-600 dark:bg-emerald-500" texto={t('appointments.calls.legendConfirmed')} valor={barra.confirmaron} />
                            <Leyenda color="bg-red-600 dark:bg-red-500" texto={t('appointments.calls.legendCancelled')} valor={barra.cancelaron} />
                            <Leyenda color="bg-slate-400 dark:bg-neutral-500" texto={t('appointments.calls.legendNoAnswer')} valor={barra.no_contestaron} />
                            <Leyenda color="bg-amber-600 dark:bg-amber-500" texto={t('appointments.calls.legendNoKey')} valor={barra.no_marcaron} />
                            {barra.no_se_pudo > 0 && <Leyenda color="bg-slate-700 dark:bg-neutral-300" texto={t('appointments.calls.legendFailed')} valor={barra.no_se_pudo} />}
                            {activa && (
                                <Leyenda
                                    color="bg-[#2e3f84]/8 shadow-[inset_0_0_0_1px_rgba(46,63,132,0.32)] dark:bg-white/10 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.3)]"
                                    texto={t('appointments.calls.legendPending')}
                                    valor={barra.por_llamar}
                                />
                            )}
                        </div>
                    </div>
                    <div
                        role="progressbar"
                        aria-label={activa ? t('appointments.calls.progressTitle') : t('appointments.calls.resultTitle')}
                        aria-valuemin={0}
                        aria-valuemax={llamadasDe(barra)}
                        aria-valuenow={barra.terminadas}
                        aria-valuetext={t('appointments.calls.ofTotal', { done: miles(barra.terminadas, lng), total: miles(llamadasDe(barra), lng) })}
                        className="mt-3.5 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-[#2e3f84]/8 forced-colors:border dark:bg-white/10"
                    >
                        <Tramo valor={barra.confirmaron} total={llamadasDe(barra)} color="bg-emerald-600 dark:bg-emerald-500" />
                        <Tramo valor={barra.cancelaron} total={llamadasDe(barra)} color="bg-red-600 dark:bg-red-500" />
                        <Tramo valor={barra.no_contestaron} total={llamadasDe(barra)} color="bg-slate-400 dark:bg-neutral-500" />
                        <Tramo valor={barra.no_marcaron} total={llamadasDe(barra)} color="bg-amber-600 dark:bg-amber-500" />
                        <Tramo valor={barra.no_se_pudo} total={llamadasDe(barra)} color="bg-slate-700 dark:bg-neutral-300" />
                    </div>
                    {activa && barra.en_curso > 0 && (
                        <p className={cn('mt-3 flex items-center gap-2 text-[12.5px] leading-4 tabular-nums', TEXTO_SUAVE)}>
                            <Phone className="size-[14px] shrink-0 text-sky-600 dark:text-sky-400" strokeWidth={1.9} aria-hidden="true" />
                            {t('appointments.calls.liveNow', { ringing: miles(barra.sonando, lng), talking: miles(barra.hablando, lng) })}
                        </p>
                    )}
                </div>
            )}

            {/* Sin ronda en marcha: cómo fue la última (o por qué se cortó). */}
            {ronda && !activa && !final && llamadasDe(ronda) > 0 && (
                ronda.estado === 'cortada' ? (
                    <FilaAviso>{resumenDe(ronda).texto}</FilaAviso>
                ) : (
                    <div className={cn('flex min-h-11 items-center gap-3 border-b px-4 py-2.5 @3xl/hoja:px-5', FILETE)}>
                        <span className={cn('flex w-8 shrink-0 justify-center', TEXTO_SUAVE)}>
                            <History className="size-[15px]" strokeWidth={1.9} aria-hidden="true" />
                        </span>
                        <p className={cn('text-[12.5px] leading-4 tabular-nums', TEXTO_SUAVE)}>
                            {[
                                t('appointments.calls.lastRound', { date: fechaTexto(ronda.fecha_citas), count: llamadasDe(ronda), value: miles(llamadasDe(ronda), lng) }),
                                partesResultado(ronda) ? `${partesResultado(ronda)}.` : '',
                                ronda.fin
                                    ? conPunto(
                                          t(ronda.estado === 'detenida' ? 'appointments.calls.lastStoppedAt' : 'appointments.calls.lastFinishedAt', {
                                              when: fechaTexto(ronda.fin.slice(0, 10)),
                                              time: horaBonita(ronda.fin.slice(11), lng),
                                          })
                                      )
                                    : '',
                                ronda.iniciado_por ? t('appointments.calls.lastBy', { name: nombrePropio(ronda.iniciado_por) }) : '',
                            ]
                                .filter(Boolean)
                                .join(' ')}
                        </p>
                    </div>
                )
            )}

            {/* Por llamar: la próxima fecha con citas. */}
            <div className={cn('flex min-h-10 flex-wrap items-end gap-x-2.5 gap-y-0.5 pt-4 pb-2', SANGRIA)}>
                <h3 className={cn('text-[11px] leading-4 font-semibold tracking-[0.07em] uppercase', TEXTO_SUAVE)}>{t('appointments.calls.toCallTitle')}</h3>
                <p className={cn('text-[12px] leading-4', TEXTO_SUAVE)}>{t('appointments.calls.toCallHint')}</p>
            </div>

            {!stats ? (
                <div className={cn('flex items-center gap-8 py-4', SANGRIA)} aria-hidden="true">
                    <Skeleton className="h-9 w-56 rounded-lg" />
                    <Skeleton className="h-9 flex-1 rounded-lg" />
                    <Skeleton className="h-9 w-32 rounded-[10px]" />
                </div>
            ) : stats.activas ? (
                <>
                    <div
                        className={cn(
                            'grid grid-cols-1 gap-y-2.5 border-b py-3.5 @3xl/hoja:min-h-[72px] @3xl/hoja:grid-cols-[220px_minmax(0,1fr)_auto] @3xl/hoja:items-center @3xl/hoja:gap-x-8 @3xl/hoja:py-2.5 @5xl/hoja:grid-cols-[300px_minmax(0,1fr)_auto]',
                            SANGRIA,
                            stats.en_horario ? FILETE : 'border-amber-200 dark:border-amber-500/20'
                        )}
                    >
                        <div className="flex min-w-0 flex-col gap-[3px]">
                            <span className={cn('text-[13.5px] leading-[18px] font-semibold tracking-[-0.003em]', TEXTO_NAVY)}>{cuandoDe(stats.fecha)}</span>
                            <span className={cn('text-[12px] leading-4', TEXTO_SUAVE)}>{t('appointments.appointmentsOfDate', { date: fechaTexto(stats.fecha) })}</span>
                        </div>
                        <div className="flex min-w-0 flex-col gap-[3px]">
                            <div className="flex min-w-0 items-baseline gap-2">
                                <span className={cn('text-[20px] leading-6 font-medium tracking-[-0.02em] tabular-nums', conPermiso ? TEXTO_NAVY : TEXTO_SUAVE)}>{miles(conPermiso, lng)}</span>
                                <span className={cn('text-[13px] leading-[18px]', TEXTO_SUAVE)}>{t('appointments.calls.withPermission', { count: conPermiso })}</span>
                            </div>
                            <span className={cn('text-[12px] leading-4 tabular-nums', TEXTO_SUAVE)}>
                                {(stats.no_respondieron ?? 0) === 0
                                    ? t('appointments.calls.nobodyPending')
                                    : [
                                          t('appointments.calls.ofNoResponse', { count: stats.no_respondieron, value: miles(stats.no_respondieron ?? 0, lng) }),
                                          (stats.sin_permiso ?? 0) > 0 && t('appointments.calls.noPermission', { count: stats.sin_permiso, value: miles(stats.sin_permiso ?? 0, lng) }),
                                          (stats.ya_llamadas ?? 0) > 0 && t('appointments.calls.alreadyCalled', { count: stats.ya_llamadas, value: miles(stats.ya_llamadas ?? 0, lng) }),
                                          (stats.fuera_ensayo ?? 0) > 0 && t('appointments.calls.outsideTest', { count: stats.fuera_ensayo, value: miles(stats.fuera_ensayo ?? 0, lng) }),
                                      ]
                                          .filter(Boolean)
                                          .join(' · ')}
                            </span>
                        </div>
                        <div className="flex @3xl/hoja:justify-end">
                            {salen > 0 && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCambio(false);
                                        setConfirmarInicio(true);
                                    }}
                                    disabled={apagado}
                                    title={motivoApagado ?? t('appointments.calls.asksConfirmation')}
                                    aria-haspopup="dialog"
                                    className={apagado ? BOTON_APAGADO : BOTON_PRIMARIO}
                                >
                                    {accion === 'start' ? <LoaderCircle className="animate-spin motion-reduce:animate-none" strokeWidth={2} aria-hidden="true" /> : <Phone strokeWidth={2} aria-hidden="true" />}
                                    {parcial
                                        ? t('appointments.calls.callButtonPartial', { value: miles(salen, lng), total: miles(conPermiso, lng) })
                                        : t('appointments.calls.callButton', { value: miles(salen, lng) })}
                                </button>
                            )}
                        </div>
                    </div>

                    {stats.en_horario ? (
                        <Linea icono={<Clock className="size-[15px]" strokeWidth={1.9} aria-hidden="true" />}>{t('appointments.calls.hours')}</Linea>
                    ) : (
                        <div className="flex min-h-[52px] items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 @3xl/hoja:px-5 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                            <span className="flex w-8 shrink-0 justify-center text-amber-700 dark:text-amber-400">
                                <Clock className="size-4" strokeWidth={2} aria-hidden="true" />
                            </span>
                            <p className="text-[13px] leading-[18px]">
                                <span className="font-semibold">{t('appointments.calls.outsideHoursLabel')}</span>{' '}
                                {stats.abre
                                    ? conPunto(t('appointments.calls.outsideHoursText', { now: ahoraColombia(lng), opens: aperturaTexto(stats.abre) }))
                                    : t('appointments.calls.hours')}
                            </p>
                        </div>
                    )}
                    <Linea icono={<Info className="size-[15px]" strokeWidth={1.9} aria-hidden="true" />} final>
                        {t('appointments.calls.metaLimit', { limit: miles(stats.limite ?? 0, lng), used: miles(stats.usadas ?? 0, lng), left: miles(stats.quedan ?? 0, lng) })}
                    </Linea>
                </>
            ) : (
                <Linea icono={<Info className="size-[15px]" strokeWidth={1.9} aria-hidden="true" />} final>
                    {t('appointments.calls.disabledWhatsApp')}
                </Linea>
            )}

            <Confirmacion
                abierto={confirmarInicio}
                onCancelar={() => {
                    setConfirmarInicio(false);
                    setCambio(false);
                }}
                onConfirmar={() => void iniciar()}
                icono={Phone}
                titulo={t('appointments.calls.confirmTitle', { count: salen, value: miles(salen, lng) })}
                textoSeguro={t('common.cancel')}
                iconoSeguro={X}
                textoConfirmar={accion === 'start' ? t('appointments.starting') : t('appointments.calls.callButton', { value: miles(salen, lng) })}
                iconoConfirmar={Phone}
                confirmarDesactivado={accion === 'start' || salen === 0}
                respaldoFoco="citas-llamadas"
            >
                {cambio && <p className="font-medium text-amber-800 dark:text-amber-300">{t('appointments.calls.changedText', { value: miles(salen, lng) })}</p>}
                <p>
                    {t('appointments.calls.confirmText', {
                        count: salen,
                        value: miles(salen, lng),
                        when: stats?.fecha === ymdColombia(1) ? t('appointments.calls.tomorrowLower') : t('appointments.calls.onDay'),
                        date: fechaTexto(stats?.fecha),
                    })}
                </p>
                <p>
                    {t('appointments.calls.confirmDuration', { minutes: miles(minutos, lng), count: minutos })} {t('appointments.calls.confirmCost', { cost: miles(costo, lng), perMinute: PRECIO_MINUTO_COP })}{' '}
                    {t('appointments.calls.confirmNoRetry')}
                </p>
            </Confirmacion>

            <Confirmacion
                abierto={confirmarDetener}
                onCancelar={() => setConfirmarDetener(false)}
                onConfirmar={() => void cambiar('stop')}
                icono={Square}
                peligro
                titulo={t('appointments.calls.stopTitle')}
                textoSeguro={t('appointments.calls.keepCalling')}
                iconoSeguro={Play}
                textoConfirmar={accion === 'stop' ? t('appointments.stopping') : t('appointments.calls.stopConfirm')}
                confirmarDesactivado={accion === 'stop'}
                respaldoFoco="citas-llamadas"
            >
                <p>{t('appointments.calls.stopText', { count: ronda?.por_llamar ?? 0, value: miles(ronda?.por_llamar ?? 0, lng) })}</p>
            </Confirmacion>
        </section>
    );
}

function Leyenda({ color, texto, valor }: { color: string; texto: string; valor: number }) {
    const { i18n } = useTranslation();
    return (
        <span className="flex items-center gap-2">
            <span className={cn('size-[9px] shrink-0 rounded-[2.5px]', color)} aria-hidden="true" />
            {texto} <span className="font-semibold">{miles(valor, i18n.language)}</span>
        </span>
    );
}

function Tramo({ valor, total, color }: { valor: number; total: number; color: string }) {
    if (valor <= 0 || total <= 0) return null;
    return (
        <div
            className={cn('h-full min-w-[3px] transition-[width] duration-500 ease-out motion-reduce:transition-none forced-color-adjust-none forced-colors:bg-[Highlight]', color)}
            style={{ width: `${Math.min((valor / total) * 100, 100)}%` }}
        />
    );
}

/** Fila de nota de la hoja: icono en la ranura y texto suave. */
function Linea({ icono, children, final = false }: { icono: ReactNode; children: ReactNode; final?: boolean }) {
    return (
        <div className={cn('flex min-h-11 items-center gap-3 px-4 py-2.5 @3xl/hoja:px-5', !final && cn('border-b', FILETE))}>
            <span className={cn('flex w-8 shrink-0 justify-center', TEXTO_SUAVE)}>{icono}</span>
            <p className={cn('text-[12.5px] leading-4 tabular-nums', TEXTO_SUAVE)}>{children}</p>
        </div>
    );
}
