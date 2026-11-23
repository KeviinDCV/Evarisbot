import AdminLayout from '@/layouts/admin-layout';
import { AppointmentsScopeSwitch } from '@/components/appointments-scope-switch';
import {
    BANDA,
    BOTON_APAGADO,
    BOTON_PELIGRO,
    BOTON_PRIMARIO,
    BOTON_SECUNDARIO,
    Buscador,
    COLUMNAS_CITA,
    FILETE,
    FOCO,
    FilaCita,
    HOJA,
    MONO,
    TEXTO_NAVY,
    TEXTO_SUAVE,
    TONO_TEXTO,
    Th,
    esIngles,
    fechaCorta,
    fechaEnvio,
    fechaLarga,
    fechaLocal,
    horaDe,
    miles,
    nombrePropio,
    type CitaFila,
} from '@/components/appointments/piezas-citas';
import { Banda, Cifra, Confirmacion, Divisor, EstadoEnvio, FilaAviso, FRANJA, Rotulo, SANGRIA, VALIDAR, leerEstado, sesionVencida } from '@/components/appointments/panel-citas';
import RecordatorioLlamada, { type LlamadasStats, type RondaLlamadas } from '@/components/appointments/recordatorio-llamada';
import { AvisoCampo } from '@/components/avisos-campo';
import { Skeleton } from '@/components/ui/skeleton';
import { plano } from '@/lib/texto';
import { cn } from '@/lib/utils';
import { Deferred, Head, Link, useForm, router, usePage } from '@inertiajs/react';
import {
    ArrowRight,
    Calendar,
    CalendarCheck2,
    CalendarClock,
    CircleAlert,
    CircleCheck,
    CircleX,
    Clock,
    FileSpreadsheet,
    History,
    Info,
    LoaderCircle,
    Moon,
    Pause,
    Play,
    Send,
    Square,
    TriangleAlert,
    Upload,
    X,
} from 'lucide-react';
import { FormEventHandler, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import axios from 'axios';

/* ── Datos que manda el servidor (contrato de Citas: index, reminders/*, upload) ─────────────────── */

type Ambito = 'general' | 'oncology';

/** Cifras de un envío, contadas en la BD sobre las citas del lote. */
interface Progreso {
    total: number;
    sent: number;
    failed: number;
    pending: number;
    skipped: number;
    percentage: number;
}

/** El último envío del ámbito. Las horas llegan en hora de Colombia como 'Y-m-d H:i' (sin zona). */
interface UltimoEnvio {
    batch_id: string;
    tipo: 'normal' | 'dia_antes' | 'todas';
    fecha_citas: string;
    /** Solo en «todas»: la última fecha (fecha_citas es la primera). */
    fecha_hasta?: string | null;
    total: number;
    sin_celular: number;
    iniciado_por: string | null;
    inicio: string;
    estado: 'en_curso' | 'terminado' | 'detenido' | 'cortado';
    motivo: 'plantilla' | 'cuenta' | 'limite' | null;
    fin: string | null;
    enviados: number;
    con_error: number;
    sin_enviar: number;
    omitidas: number;
}

/** Una fecha con recordatorios por enviar: `salen` es lo que sale al pulsar (tope max_per_day). */
interface Tanda {
    fecha: string;
    por_enviar: number;
    sin_celular: number;
    salen: number;
}

/** «Enviar todas ya»: todas las citas desde mañana; desde/hasta son la primera y la última fecha de las que salen. */
interface TandaTodas {
    desde: string | null;
    hasta: string | null;
    dias: number;
    por_enviar: number;
    sin_celular: number;
    salen: number;
    hora_inicio: number;
    hora_fin: number;
}

interface RemindersStats {
    hoy: string;
    days_in_advance: number;
    max_per_day: number;
    objetivo: Tanda;
    manana: Tanda;
    todas?: TandaTodas;
    sent: number;
    failed: number;
    futuras: number;
}

interface UploadResult {
    name: string;
    size: number;
    uploaded_at: string;
    nuevas: number;
    actualizadas: number;
    reprogramadas: number;
    duplicadas: number;
    sin_fecha: number;
    sin_celular: number;
}

interface AppointmentIndexProps {
    ambito?: Ambito;
    routePrefix?: string;
    reminderProcessing?: boolean;
    reminderPaused?: boolean;
    reminderProgress?: Progreso | null;
    reminderStalled?: boolean;
    /** «Enviar todas» esperando la mañana: hasta cuándo ('Y-m-d H:i', hora de Colombia). */
    reminderEspera?: string | null;
    ultimoEnvio?: UltimoEnvio | null;
    uploadedFile?: UploadResult | null;
    uploadError?: { code: string; columnas?: string[] } | null;
    // Diferidas (Inertia v2): ausentes en la primera respuesta; <Deferred> pinta el esqueleto.
    appointments?: CitaFila[];
    totalAppointments?: number;
    remindersStats?: RemindersStats;
    // Recordatorio por llamada: la ronda llega con la página; sus cifras, diferidas (grupo «llamadas»).
    rondaLlamadas?: RondaLlamadas | null;
    llamadasStats?: LlamadasStats;
}

// Lo que se recarga para saber el estado del envío y las cifras: al abrir la confirmación, al volver a
// la pestaña sin envío en curso y al terminar un envío (entonces, además, las citas).
const ESTADO = ['reminderProcessing', 'reminderPaused', 'reminderProgress', 'reminderStalled', 'reminderEspera', 'ultimoEnvio', 'remindersStats'];
const ESTADO_Y_CITAS = [...ESTADO, 'appointments', 'totalAppointments'];

// Cada mensaje tarda unos 3-4 s (la pausa de 3 s del trabajo más la llamada a WhatsApp).
const SEGUNDOS_POR_MENSAJE = 4;
const MAX_MB = 10;

type TipoEnvio = 'start' | 'dayBefore' | 'all';
type Accion = TipoEnvio | 'pause' | 'resume' | 'stop';
type AvisoEnvio = { tipo: 'ok' | 'aviso' | 'error'; texto: string };

const ERROR_CARGA = {
    requerido: 'appointments.uploadError.requerido',
    tipo: 'appointments.uploadError.tipo',
    tamano: 'appointments.uploadError.tamano',
    subida_incompleta: 'appointments.uploadError.subida_incompleta',
    vacio: 'appointments.uploadError.vacio',
    columnas_faltantes: 'appointments.uploadError.columnas_faltantes',
    fallo: 'appointments.uploadError.fallo',
} as const;

const COLUMNA_OBLIGATORIA = {
    citfci: 'appointments.requiredColumn.citfci',
    cithor: 'appointments.requiredColumn.cithor',
    pactel: 'appointments.requiredColumn.pactel',
    nom_paciente: 'appointments.requiredColumn.nom_paciente',
} as const;

const RAZON_CORTE = {
    plantilla: 'appointments.cutReason.plantilla',
    cuenta: 'appointments.cutReason.cuenta',
    limite: 'appointments.cutReason.limite',
    otro: 'appointments.cutReason.otro',
} as const;

// Columnas que lee la carga (fila 1 del Excel): las cuatro obligatorias primero.
const COLUMNAS_EXCEL = [
    ['Citfci', 'appointments.columnDescDate', true],
    ['Cithor', 'appointments.columnDescTime', true],
    ['Pactel', 'appointments.columnDescPhone', true],
    ['Nom_paciente', 'appointments.columnDescPatientName', true],
    ['Pactel2', 'appointments.columnDescPhone2', false],
    ['Citide', 'appointments.columnDescPatientId', false],
    ['Citdoc', 'appointments.columnDescDocument', false],
    ['Mednom', 'appointments.columnDescDoctorName', false],
    ['Espnom', 'appointments.columnDescSpecialty', false],
    ['Citcon', 'appointments.columnDescRoomCode', false],
    ['Connom', 'appointments.columnDescLocation', false],
] as const;

/* ── Utilidades ─────────────────────────────────────────────────────────────────────────────────── */

const progresoDe = (u: UltimoEnvio): Progreso => ({
    total: u.total,
    sent: u.enviados,
    failed: u.con_error,
    pending: u.sin_enviar,
    skipped: u.omitidas,
    percentage: u.total ? Math.floor(((u.total - u.sin_enviar) / u.total) * 100) : 0,
});

/** Hoy en Colombia ('Y-m-d'), sin depender de la zona horaria del equipo. */
const hoyColombia = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());

/** La hora actual en Colombia (0-23). */
function horaColombia() {
    const partes = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/Bogota' }).formatToParts(new Date());
    return Number(partes.find((parte) => parte.type === 'hour')?.value ?? 12);
}

/** "9:05 p. m." (es) · "9:05 PM" (en), en hora de Colombia: es el instante actual, no un dato del servidor. */
const ahoraColombia = (lng: string) =>
    new Intl.DateTimeFormat(esIngles(lng) ? 'en-US' : 'es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' }).format(new Date());

/** Una hora en punto del día: "7 a. m." (es) · "7 AM" (en). */
const horaCorta = (hora: number, lng: string) =>
    new Intl.DateTimeFormat(esIngles(lng) ? 'en-US' : 'es-CO', { hour: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, 0, 1, hora)));

/** "1,5 MB" (es) · "1.5 MB" (en). */
function tamanoArchivo(bytes: number, lng: string) {
    const formato = new Intl.NumberFormat(esIngles(lng) ? 'en-US' : 'es-CO', { maximumFractionDigits: 1 });
    if (bytes < 1024) return `${formato.format(bytes)} bytes`;
    if (bytes < 1024 * 1024) return `${formato.format(bytes / 1024)} KB`;
    return `${formato.format(bytes / (1024 * 1024))} MB`;
}

/* Las piezas del panel (Banda, Rótulo, avisos, Confirmación…) viven en components/appointments/panel-citas.tsx. */

export default function AppointmentsIndex({
    ambito,
    routePrefix = '/admin/appointments',
    reminderProcessing = false,
    reminderPaused = false,
    reminderProgress = null,
    reminderStalled = false,
    reminderEspera = null,
    ultimoEnvio: ultimoEnvioServidor = null,
    uploadedFile = null,
    uploadError = null,
    appointments: initialAppointments = [],
    totalAppointments = 0,
    remindersStats,
    rondaLlamadas = null,
    llamadasStats,
}: AppointmentIndexProps) {
    const { t, i18n } = useTranslation();
    const lng = i18n.language;
    const { flash } = usePage<{ flash: { success?: string; error?: string } }>().props;
    // El ámbito lo manda el servidor; solo si faltara (respuesta vieja) se deduce de las rutas.
    const esOncologia = (ambito ?? (routePrefix.startsWith('/admin/oncology') ? 'oncology' : 'general')) === 'oncology';
    const nombreAmbito = esOncologia ? t('navigation.appointmentsOncology') : t('navigation.appointmentsGeneral');
    const stats = remindersStats;

    const [showFlashMessage, setShowFlashMessage] = useState(true);
    const [showUploadResult, setShowUploadResult] = useState(true);
    const [isDragging, setIsDragging] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Estado del envío: lo manda el servidor (props) y lo actualiza el sondeo o la respuesta de cada acción.
    const [isProcessing, setIsProcessing] = useState(reminderProcessing);
    const [isPaused, setIsPaused] = useState(reminderProcessing && reminderPaused);
    const [progress, setProgress] = useState<Progreso | null>(reminderProgress);
    const [sinAvanzar, setSinAvanzar] = useState(reminderProcessing && reminderStalled);
    const [espera, setEspera] = useState<string | null>(reminderProcessing ? reminderEspera : null);
    const [ultimo, setUltimo] = useState<UltimoEnvio | null>(ultimoEnvioServidor);
    // Al terminar o detener, la barra se queda con las cifras finales hasta cerrar el aviso del resultado.
    const [barraFinal, setBarraFinal] = useState<UltimoEnvio | null>(null);
    // Qué botón está esperando respuesta: cada uno muestra su propio «…ando» (antes los cuatro a la vez).
    const [accion, setAccion] = useState<Accion | null>(null);
    const [avisoEnvio, setAvisoEnvio] = useState<AvisoEnvio | null>(null);
    const [fallosSondeo, setFallosSondeo] = useState(0);
    // El sondeo se paró porque la sesión caducó: la barra deja de decir «se actualiza solo».
    const [sondeoParado, setSondeoParado] = useState(false);
    const [confirmarEnvio, setConfirmarEnvio] = useState<TipoEnvio | null>(null);
    const [recalculando, setRecalculando] = useState(false);
    const [confirmarDetener, setConfirmarDetener] = useState(false);
    const [confirmarReanudar, setConfirmarReanudar] = useState(false);
    // Región viva siempre montada: los lectores de pantalla oyen el inicio, la pausa y la reanudación.
    const [anuncio, setAnuncio] = useState('');
    const [avisoArchivo, setAvisoArchivo] = useState<string | undefined>();
    const [errorCargaOculto, setErrorCargaOculto] = useState(false);

    const { data, setData, post, processing, errors, reset, progress: subida } = useForm({
        file: null as File | null,
    });

    const botonCargar = useRef<HTMLButtonElement>(null);
    const campoArchivo = useRef<HTMLInputElement>(null);
    const enfocarTras = useRef<'cargar' | 'elegir' | null>(null);
    // Por objeto y no por uploaded_at: dos cargas en el mismo minuto tienen la misma hora y la segunda no se mostraba.
    const cargaAnunciada = useRef<UploadResult | null>(null);
    const sinAvanzarAntes = useRef(sinAvanzar);
    // Sube al empezar y al terminar cada pausa o reanudación: una vuelta del sondeo pedida antes trae el estado
    // viejo y se descarta (si no, «Pausar» y «Reanudar» parpadeaban 3 s y se podían pulsar de nuevo).
    const versionEnvio = useRef(0);

    const anunciar = useCallback((texto: string) => {
        setAnuncio('');
        window.setTimeout(() => setAnuncio(texto), 80);
    }, []);

    const fechaTexto = useCallback(
        (ymd?: string | null) => {
            const fecha = fechaLocal(ymd);
            return fecha ? fechaLarga(fecha, lng) : (ymd ?? '');
        },
        [lng]
    );

    const textoEnCurso = useCallback(
        (u?: UltimoEnvio | null) =>
            u?.iniciado_por ? t('appointments.errorAlreadyRunning', { name: nombrePropio(u.iniciado_por) }) : t('appointments.errorAlreadyRunningAnon'),
        [t]
    );

    // Las que fallaron por su cuenta antes del corte (sin WhatsApp, bloqueo…) sí quedan con error: el texto habla
    // solo de las que faltaban, y dice cuántas alcanzaron a salir.
    const textoCorte = useCallback(
        (u: UltimoEnvio) =>
            t('appointments.lastSendCut', {
                reason: t(u.motivo && Object.hasOwn(RAZON_CORTE, u.motivo) ? RAZON_CORTE[u.motivo] : RAZON_CORTE.otro),
                sent: miles(u.enviados, lng),
            }),
        [t, lng]
    );

    /** El resultado de un envío que acaba de terminar, de detenerse o de cortarse (va a la región viva). */
    const resumenDe = useCallback(
        (u: UltimoEnvio | null): AvisoEnvio => {
            if (!u || u.estado === 'en_curso') return { tipo: 'ok', texto: t('appointments.sendFinishedGeneric') };
            if (u.estado === 'cortado') return { tipo: 'error', texto: textoCorte(u) };
            if (u.estado === 'detenido') {
                return { tipo: 'ok', texto: t('appointments.stopSummary', { sent: miles(u.enviados, lng), left: miles(u.sin_enviar, lng) }) };
            }
            const frases = [
                u.con_error > 0
                    ? t('appointments.sendFinished', { count: u.enviados, sent: miles(u.enviados, lng), failed: miles(u.con_error, lng) })
                    : t('appointments.sendFinishedAll', { count: u.enviados, sent: miles(u.enviados, lng) }),
            ];
            if (u.omitidas > 0) frases.push(t('appointments.sendFinishedSkipped', { count: u.omitidas, value: miles(u.omitidas, lng) }));
            if (u.sin_enviar > 0) frases.push(t('appointments.sendFinishedLeft', { count: u.sin_enviar, value: miles(u.sin_enviar, lng) }));
            return { tipo: u.con_error > 0 || u.sin_enviar > 0 ? 'aviso' : 'ok', texto: frases.join(' ') };
        },
        [t, lng, textoCorte]
    );

    /** El envío terminó (lo dijo el sondeo): cifras finales, resumen y una sola recarga de estado y citas. */
    const alTerminar = useCallback(
        (u: UltimoEnvio | null) => {
            setIsProcessing(false);
            setIsPaused(false);
            setSinAvanzar(false);
            setEspera(null);
            setFallosSondeo(0);
            setUltimo(u);
            setBarraFinal(u && u.estado !== 'en_curso' && u.total > 0 ? u : null);
            setAvisoEnvio(resumenDe(u));
            router.reload({ only: ESTADO_Y_CITAS });
        },
        [resumenDe]
    );

    // El servidor manda: cada vez que llegan sus props (carga de la página o recarga parcial) se toma su estado.
    useEffect(() => {
        setIsProcessing(reminderProcessing);
        setIsPaused(reminderProcessing && reminderPaused);
        setProgress(reminderProgress);
        setSinAvanzar(reminderProcessing && reminderStalled);
        setEspera(reminderProcessing ? reminderEspera : null);
        setUltimo(ultimoEnvioServidor);
    }, [reminderProcessing, reminderPaused, reminderProgress, reminderStalled, reminderEspera, ultimoEnvioServidor]);

    // Resetear visibilidad del mensaje flash cuando cambie
    useEffect(() => {
        if (flash?.success || flash?.error) {
            setShowFlashMessage(true);
        }
    }, [flash?.success, flash?.error]);

    // Un error nuevo de la carga se muestra aunque se hubiera ocultado el anterior al elegir otro archivo.
    useEffect(() => {
        setErrorCargaOculto(false);
    }, [uploadError, errors.file]);

    // Si el envío cambia por debajo (terminó, otra persona lo reanudó…), los diálogos que ya no aplican se cierran.
    useEffect(() => {
        if (isProcessing) setConfirmarEnvio(null);
        if (!isProcessing) setConfirmarDetener(false);
        if (!isPaused) setConfirmarReanudar(false);
    }, [isProcessing, isPaused]);

    useEffect(() => {
        if (sinAvanzar && !sinAvanzarAntes.current) anunciar(t('appointments.stalledText'));
        sinAvanzarAntes.current = sinAvanzar;
    }, [sinAvanzar, anunciar, t]);

    /**
     * Sondeo del envío en curso. Windows agota los sockets con peticiones en paralelo, así que es un bucle
     * SECUENCIAL: la siguiente vuelta sale 3 s (+ azar) después de que vuelva la anterior, solo con la pestaña
     * visible, y ante errores espera 6, 12 y 30 s. Una sesión caducada nunca se toma como «terminó».
     */
    useEffect(() => {
        if (!isProcessing) return;

        let vivo = true;
        let enCurso = false;
        let fallos = 0;
        let temporizador: ReturnType<typeof setTimeout> | undefined;

        const vuelta = async () => {
            if (!vivo || enCurso || document.visibilityState !== 'visible') return;
            enCurso = true;
            let espera = 3000;
            const version = versionEnvio.current;
            try {
                const { data: estado } = await axios.get(`${routePrefix}/reminders/status`, { headers: { Accept: 'application/json' }, timeout: 10000 });
                if (!vivo) return;
                if (!estado || typeof estado !== 'object' || typeof estado.processing !== 'boolean') {
                    // Llegó HTML (la sesión caducó y respondió el login): parar y avisar.
                    vivo = false;
                    setSondeoParado(true);
                    setAvisoEnvio({ tipo: 'error', texto: t('appointments.sessionExpired') });
                    return;
                }
                fallos = 0;
                setFallosSondeo(0);
                // Pedida antes de (o durante) una pausa o reanudación: trae el estado viejo y la siguiente vuelta lo corrige.
                if (version === versionEnvio.current) {
                    if (!estado.processing) {
                        vivo = false;
                        alTerminar(estado.ultimo_envio ?? null);
                        return;
                    }
                    setIsPaused(estado.paused === true);
                    setProgress(estado.progress ?? null);
                    setSinAvanzar(estado.sin_avanzar === true);
                    setEspera(typeof estado.espera_hasta === 'string' ? estado.espera_hasta : null);
                    setUltimo(estado.ultimo_envio ?? null);
                }
            } catch (error) {
                if (!vivo) return;
                if (sesionVencida(leerEstado(error))) {
                    vivo = false;
                    setSondeoParado(true);
                    setAvisoEnvio({ tipo: 'error', texto: t('appointments.sessionExpired') });
                    return;
                }
                fallos += 1;
                setFallosSondeo(fallos);
                espera = [6000, 12000, 30000][Math.min(fallos, 3) - 1];
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
        void vuelta();

        return () => {
            vivo = false;
            clearTimeout(temporizador);
            document.removeEventListener('visibilitychange', alVolver);
        };
    }, [isProcessing, routePrefix, t, alTerminar]);

    // Sin envío en curso, las cifras se refrescan al volver a la pestaña (la página pudo quedar abierta desde ayer).
    useEffect(() => {
        if (isProcessing) return;
        let ultimaVez = Date.now();
        let enVuelo = false;

        const refrescar = () => {
            // 'focus' y 'visibilitychange' llegan casi juntos al volver: una sola recarga.
            if (document.visibilityState !== 'visible' || enVuelo || Date.now() - ultimaVez < 5000) return;
            enVuelo = true;
            ultimaVez = Date.now();
            router.reload({
                // Al volver a la pestaña también las cifras de llamadas (horario, robot, tope de Meta pudieron cambiar).
                only: [...ESTADO, 'llamadasStats'],
                onFinish: () => {
                    enVuelo = false;
                },
            });
        };

        document.addEventListener('visibilitychange', refrescar);
        window.addEventListener('focus', refrescar);
        return () => {
            document.removeEventListener('visibilitychange', refrescar);
            window.removeEventListener('focus', refrescar);
        };
    }, [isProcessing]);

    /* ── Envío: abrir la confirmación, iniciar, pausar, reanudar, detener ── */

    // Al abrir la confirmación se piden las cifras de nuevo: el diálogo dice la fecha y la cantidad de AHORA.
    const abrirConfirmacion = (tipo: TipoEnvio) => {
        setAvisoEnvio(null);
        setConfirmarEnvio(tipo);
        setRecalculando(true);
        router.reload({
            only: ESTADO,
            onSuccess: (pagina) => {
                const props = pagina.props as AppointmentIndexProps;
                if (props.reminderProcessing) {
                    setConfirmarEnvio(null);
                    setAvisoEnvio({ tipo: 'aviso', texto: textoEnCurso(props.ultimoEnvio) });
                    return;
                }
                if (tipo === 'all') {
                    const todas = props.remindersStats?.todas;
                    if (todas && todas.salen <= 0) {
                        setConfirmarEnvio(null);
                        setAvisoEnvio({ tipo: 'aviso', texto: t('appointments.errorNothingLeftAll') });
                    }
                    return;
                }
                const tanda = tipo === 'dayBefore' ? props.remindersStats?.manana : props.remindersStats?.objetivo;
                if (tanda && tanda.salen <= 0) {
                    setConfirmarEnvio(null);
                    setAvisoEnvio({ tipo: 'aviso', texto: t('appointments.errorNothingLeft', { date: fechaTexto(tanda.fecha) }) });
                }
            },
            onFinish: () => setRecalculando(false),
        });
    };

    const iniciar = async (tipo: TipoEnvio) => {
        const todas = stats?.todas;
        const tanda = tipo === 'dayBefore' ? stats?.manana : stats?.objetivo;
        // La fecha (o el rango, en «todas») la decide el servidor; esto solo le dice lo que la persona confirmó.
        const cuerpo =
            tipo === 'all'
                ? todas?.desde && todas.hasta
                    ? { fecha_citas: todas.desde, fecha_hasta: todas.hasta, esperadas: todas.salen }
                    : null
                : tanda
                  ? { fecha_citas: tanda.fecha, esperadas: tanda.salen }
                  : null;
        if (!cuerpo) return;
        setAccion(tipo);
        setAvisoEnvio(null);
        setBarraFinal(null);

        try {
            const ruta = tipo === 'all' ? 'start-all' : tipo === 'dayBefore' ? 'start-day-before' : 'start';
            const { status, data: r } = await axios.post(`${routePrefix}/reminders/${ruta}`, cuerpo, VALIDAR);
            const codigo = r && typeof r === 'object' ? r.code : undefined;

            if (status === 200 && (!r || typeof r !== 'object')) {
                // HTML en vez de JSON: respondió el login (la sesión caducó) y no se inició nada.
                setAvisoEnvio({ tipo: 'error', texto: t('appointments.sessionExpired') });
            } else if (status === 200 && r.success) {
                versionEnvio.current += 1;
                setSondeoParado(false);
                const total = Number(r.total) || cuerpo.esperadas;
                setProgress({ total, sent: 0, failed: 0, pending: total, skipped: 0, percentage: 0 });
                setIsPaused(false);
                setSinAvanzar(false);
                setEspera(null);
                setFallosSondeo(0);
                setUltimo(r.ultimo_envio ?? null);
                setIsProcessing(true);
                anunciar(t('appointments.announceStarted', { count: total, value: miles(total, lng) }));
            } else if (status === 409 && codigo === 'en_curso') {
                setUltimo(r.ultimo_envio ?? null);
                setProgress(null);
                setIsProcessing(true);
                setAvisoEnvio({ tipo: 'aviso', texto: textoEnCurso(r.ultimo_envio) });
            } else if (status === 409 && codigo === 'cambio') {
                router.reload({ only: ESTADO });
                const total = Number(r.total) || 0;
                setAvisoEnvio({
                    tipo: 'aviso',
                    texto:
                        tipo === 'all'
                            ? total > 0
                                ? t('appointments.errorChangedAll', { count: total, value: miles(total, lng), from: fechaTexto(r.fecha), to: fechaTexto(r.hasta) })
                                : t('appointments.errorNothingLeftAll')
                            : total > 0
                              ? t('appointments.errorChanged', { count: total, value: miles(total, lng), date: fechaTexto(r.fecha) })
                              : t('appointments.errorNothingLeft', { date: fechaTexto(r.fecha) }),
                });
            } else if (codigo === 'sin_configurar') {
                setAvisoEnvio({ tipo: 'error', texto: t('appointments.errorNotConfigured') });
            } else if (codigo === 'datos_invalidos') {
                setAvisoEnvio({ tipo: 'error', texto: t('appointments.errorReload') });
            } else {
                setAvisoEnvio({ tipo: 'error', texto: t('appointments.errorStart') });
            }
        } catch (error) {
            if (leerEstado(error) !== undefined) {
                setAvisoEnvio({ tipo: 'error', texto: t('appointments.sessionExpired') });
                return;
            }
            // Sin respuesta del servidor: el envío pudo haber arrancado. Una sola consulta para saberlo.
            try {
                const { data: estado } = await axios.get(`${routePrefix}/reminders/status`, { headers: { Accept: 'application/json' }, timeout: 10000 });
                if (estado && estado.processing === true) {
                    setUltimo(estado.ultimo_envio ?? null);
                    setProgress(estado.progress ?? null);
                    setIsPaused(estado.paused === true);
                    setIsProcessing(true);
                    return;
                }
            } catch {
                // Tampoco respondió: se avisa abajo.
            }
            setAvisoEnvio({ tipo: 'error', texto: t('appointments.errorNoAnswer') });
        } finally {
            setAccion(null);
        }
    };

    /** Error de pausar, reanudar o detener: si la sesión caducó se dice eso, no «No se pudo…». */
    const avisoDeError = (error: unknown, texto: string): AvisoEnvio =>
        sesionVencida(leerEstado(error)) ? { tipo: 'error', texto: t('appointments.sessionExpired') } : { tipo: 'error', texto };

    const pausar = async () => {
        setAccion('pause');
        versionEnvio.current += 1;
        try {
            const { status, data: r } = await axios.post(`${routePrefix}/reminders/pause`, null, VALIDAR);
            if (status === 200 && r?.success) {
                setIsPaused(true);
                setSinAvanzar(false);
                anunciar(t('appointments.announcePaused'));
            } else if (status === 409) {
                setAvisoEnvio({ tipo: 'aviso', texto: t('appointments.errorNoSend') });
                router.reload({ only: ESTADO });
            } else {
                setAvisoEnvio({ tipo: 'error', texto: t('appointments.errorPause') });
            }
        } catch (error) {
            setAvisoEnvio(avisoDeError(error, t('appointments.errorPause')));
        } finally {
            versionEnvio.current += 1;
            setAccion(null);
        }
    };

    const reanudar = async () => {
        setAccion('resume');
        versionEnvio.current += 1;
        try {
            const { status, data: r } = await axios.post(`${routePrefix}/reminders/resume`, null, VALIDAR);
            if (status === 200 && r?.success) {
                setIsPaused(false);
                anunciar(t('appointments.announceResumed'));
            } else if (status === 409) {
                setAvisoEnvio({ tipo: 'aviso', texto: t('appointments.errorNoSend') });
                router.reload({ only: ESTADO });
            } else {
                setAvisoEnvio({ tipo: 'error', texto: t('appointments.errorResume') });
            }
        } catch (error) {
            setAvisoEnvio(avisoDeError(error, t('appointments.errorResume')));
        } finally {
            versionEnvio.current += 1;
            setAccion(null);
        }
    };

    const detener = async () => {
        setAccion('stop');
        try {
            const { status, data: r } = await axios.post(`${routePrefix}/reminders/stop`, null, VALIDAR);
            if (status === 200 && r?.success) {
                const u: UltimoEnvio | null = r.ultimo_envio ?? null;
                setIsProcessing(false);
                setIsPaused(false);
                setSinAvanzar(false);
                setEspera(null);
                setFallosSondeo(0);
                setUltimo(u);
                setBarraFinal(u && u.total > 0 ? u : null);
                setAvisoEnvio({
                    tipo: 'ok',
                    texto: u ? t('appointments.stopSummary', { sent: miles(u.enviados, lng), left: miles(u.sin_enviar, lng) }) : t('appointments.stopSuccess'),
                });
                router.reload({ only: ESTADO_Y_CITAS });
            } else {
                setAvisoEnvio({ tipo: 'error', texto: t('appointments.errorStop') });
            }
        } catch (error) {
            setAvisoEnvio(avisoDeError(error, t('appointments.errorStop')));
        } finally {
            setAccion(null);
        }
    };

    const aceptarEnvio = () => {
        const tipo = confirmarEnvio;
        setConfirmarEnvio(null);
        if (tipo) void iniciar(tipo);
    };

    const aceptarDetener = () => {
        setConfirmarDetener(false);
        setAvisoEnvio(null);
        void detener();
    };

    const aceptarReanudar = () => {
        setConfirmarReanudar(false);
        setAvisoEnvio(null);
        void reanudar();
    };

    const cerrarAvisoEnvio = () => {
        setAvisoEnvio(null);
        setBarraFinal(null);
    };

    /* ── Carga del Excel ── */

    const problemaArchivo = (archivo: File) => {
        if (!/\.(xlsx|xls)$/i.test(archivo.name)) return t('appointments.fileTypeInvalid');
        if (archivo.size > MAX_MB * 1024 * 1024) return t('appointments.fileTooLarge');
        return undefined;
    };

    const elegirArchivo = (archivo?: File | null) => {
        if (!archivo) return;
        const problema = problemaArchivo(archivo);
        setAvisoArchivo(problema);
        if (problema) return;
        setErrorCargaOculto(true);
        enfocarTras.current = 'cargar';
        setData('file', archivo);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        elegirArchivo(e.target.files?.[0]);
        // Así, elegir otra vez el mismo archivo (tras un aviso) vuelve a avisar.
        e.target.value = '';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        elegirArchivo(e.dataTransfer.files?.[0]);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        // Pasar por encima de los textos de dentro no es salir del recuadro (antes parpadeaba).
        if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
        setIsDragging(false);
    };

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        if (!data.file) return;
        setErrorCargaOculto(false);
        anunciar(t('appointments.uploadingWait'));
        post(`${routePrefix}/upload`, {
            onSuccess: () => reset('file'),
        });
    };

    const removeFile = () => {
        enfocarTras.current = 'elegir';
        setData('file', null);
    };

    // Al elegir el archivo el foco pasa a «Cargar citas»; al quitarlo, vuelve al selector.
    useEffect(() => {
        if (enfocarTras.current === 'cargar') botonCargar.current?.focus();
        if (enfocarTras.current === 'elegir') campoArchivo.current?.focus();
        enfocarTras.current = null;
    }, [data.file]);

    const errorCarga = useMemo(() => {
        if (!uploadError) return errors.file;
        const codigo = uploadError.code;
        if (!Object.hasOwn(ERROR_CARGA, codigo)) return errors.file;
        if (codigo === 'columnas_faltantes') {
            const columnas = (uploadError.columnas ?? [])
                .map((c) => (Object.hasOwn(COLUMNA_OBLIGATORIA, c) ? `${c} (${t(COLUMNA_OBLIGATORIA[c as keyof typeof COLUMNA_OBLIGATORIA])})` : c))
                .join(', ');
            return t(ERROR_CARGA.columnas_faltantes, { columns: columnas });
        }
        return t(ERROR_CARGA[codigo as keyof typeof ERROR_CARGA]);
    }, [uploadError, errors.file, t]);

    // El resultado de la carga se arma aquí con sus cifras (antes, «50 citas» aunque no entrara ninguna).
    const frasesCarga = useMemo(() => {
        if (!uploadedFile) return [];
        const n = (valor?: number) => Number(valor) || 0;
        const nuevas = n(uploadedFile.nuevas);
        const actualizadas = n(uploadedFile.actualizadas);
        const reprogramadas = n(uploadedFile.reprogramadas);
        const duplicadas = n(uploadedFile.duplicadas);
        const sinFecha = n(uploadedFile.sin_fecha);
        const sinCelular = n(uploadedFile.sin_celular);
        const frases: string[] = [];

        if (nuevas + actualizadas + reprogramadas === 0) frases.push(t('appointments.uploadResultNone'));
        if (nuevas > 0) frases.push(t('appointments.uploadResultNew', { count: nuevas, value: miles(nuevas, lng) }));
        if (actualizadas > 0) frases.push(t('appointments.uploadResultUpdated', { count: actualizadas, value: miles(actualizadas, lng) }));
        if (reprogramadas > 0) frases.push(t('appointments.uploadResultMoved', { count: reprogramadas, value: miles(reprogramadas, lng) }));
        if (duplicadas > 0) frases.push(t('appointments.uploadResultSkipped', { count: duplicadas, value: miles(duplicadas, lng) }));
        if (sinFecha > 0) frases.push(t('appointments.uploadResultNoDate', { count: sinFecha, value: miles(sinFecha, lng) }));
        if (sinCelular > 0) frases.push(t('appointments.uploadResultNoMobile', { count: sinCelular, value: miles(sinCelular, lng) }));
        return frases;
    }, [uploadedFile, t, lng]);

    const cargaSinCambios = !!uploadedFile && (Number(uploadedFile.nuevas) || 0) + (Number(uploadedFile.actualizadas) || 0) + (Number(uploadedFile.reprogramadas) || 0) === 0;

    // Una carga nueva vuelve a mostrar su fila de resultado y se anuncia (la fila llega ya montada tras la redirección).
    useEffect(() => {
        if (!uploadedFile || cargaAnunciada.current === uploadedFile) return;
        cargaAnunciada.current = uploadedFile;
        setShowUploadResult(true);
        anunciar(frasesCarga.join(' '));
    }, [uploadedFile, frasesCarga, anunciar]);

    /* ── Últimas citas: búsqueda en el navegador, sin tildes y por palabras ── */

    const filteredAppointments = useMemo(() => {
        const palabras = plano(searchTerm.trim()).split(/\s+/).filter(Boolean);
        if (!palabras.length) return initialAppointments;

        return initialAppointments.filter((cita) => {
            const texto = plano([cita.nom_paciente, cita.citide, cita.pactel, cita.pactel2, cita.mednom, cita.espnom, cita.citdoc].filter(Boolean).join(' '));
            return palabras.every((palabra) => texto.includes(palabra));
        });
    }, [initialAppointments, searchTerm]);

    /* ── Textos que dependen de las cifras ── */

    const objetivo = stats?.objetivo;
    const manana = stats?.manana;
    // Si se envía con un día de anticipación, «Mañana» sería la misma fecha: esa segunda fila no se pinta.
    const mananaVisible = !!objetivo && !!manana && manana.fecha !== objetivo.fecha;
    const diasAntes = stats?.days_in_advance ?? 2;
    const maxPorEnvio = stats?.max_per_day ?? 0;
    const rotuloObjetivo =
        diasAntes === 1
            ? t('appointments.whenTomorrow')
            : diasAntes === 2
              ? t('appointments.whenDayAfterTomorrow')
              : t('appointments.whenInDays', { count: diasAntes });

    const iniciando = accion === 'start' || accion === 'dayBefore' || accion === 'all';
    const hayEnvio = isProcessing || isPaused;
    // «Enviar todas» de noche: espera a la mañana a propósito.
    const esperando = isProcessing && !isPaused && !!espera;
    const horaEspera = espera ? horaDe(espera) : '';
    const estadoEnvio = iniciando
        ? 'enviando'
        : isPaused
          ? 'pausa'
          : esperando
            ? 'espera'
            : isProcessing
              ? sinAvanzar
                  ? 'sin_avanzar'
                  : 'enviando'
              : 'quieto';
    const textoEstado = iniciando
        ? t('appointments.statusStarting')
        : isPaused
          ? t('appointments.statusPaused')
          : esperando
            ? t('appointments.statusWaitingMorning', { time: horaEspera })
            : isProcessing
              ? sinAvanzar
                  ? t('appointments.statusStalled')
                  : t('appointments.statusSending')
              : t('appointments.statusNoActiveProcess');
    const barra: Progreso | null = isProcessing ? (progress && progress.total > 0 ? progress : null) : barraFinal ? progresoDe(barraFinal) : null;
    const esFinal = !isProcessing && !!barraFinal;

    // «Todas las citas cargadas»: se ofrece cuando hay citas por enviar más allá de las dos fechas de arriba.
    const todas = stats?.todas;
    const todasVisible =
        !!todas && !!todas.desde && !!objetivo && !!manana && todas.por_enviar > objetivo.por_enviar + (mananaVisible ? manana.por_enviar : 0);

    // Confirmación de enviar: la tanda de la fila que la abrió (recargada al abrir).
    const confirmaTodas = confirmarEnvio === 'all';
    const tandaConfirmar = confirmaTodas ? todas : confirmarEnvio === 'dayBefore' ? manana : objetivo;
    const salen = tandaConfirmar?.salen ?? 0;
    const quedanOtraTanda = Math.max(0, (tandaConfirmar?.por_enviar ?? 0) - salen);
    const minutos = Math.max(1, Math.ceil((salen * SEGUNDOS_POR_MENSAJE) / 60));
    const horas = Math.max(1, Math.round((salen * SEGUNDOS_POR_MENSAJE) / 3600));
    const horaAhora = horaColombia();
    const deNoche = horaAhora >= 19 || horaAhora < 7;
    const horaInicio = todas?.hora_inicio ?? 7;
    const horaFin = todas?.hora_fin ?? 19;
    // «todas» fuera de horario: no sale nada hasta la mañana (el trabajo duerme hasta horaInicio).
    const todasDeNoche = horaAhora >= horaFin || horaAhora < horaInicio;

    const notaEnCurso = t('appointments.sendingInProgressNote');

    /** «Último envío: citas del … · 120 enviados · 3 con error · terminó a las 9:05 · lo inició …». */
    const lineaUltimo = (u: UltimoEnvio) => {
        const partes = [
            u.tipo === 'todas' && u.fecha_hasta && u.fecha_hasta !== u.fecha_citas
                ? t('appointments.lastSendPrefixRange', { from: fechaTexto(u.fecha_citas), to: fechaTexto(u.fecha_hasta) })
                : t('appointments.lastSendPrefix', { date: fechaTexto(u.fecha_citas) }),
        ];
        partes.push(t('appointments.lastSendSent', { count: u.enviados, value: miles(u.enviados, lng) }));
        partes.push(t('appointments.lastSendFailed', { value: miles(u.con_error, lng) }));
        if (u.omitidas > 0) partes.push(t('appointments.lastSendSkipped', { count: u.omitidas, value: miles(u.omitidas, lng) }));
        if (u.fin) {
            const hora = horaDe(u.fin);
            const otroDia = u.fin.slice(0, 10) !== hoyColombia();
            const dia = fechaCorta(u.fin.slice(0, 10), lng);
            if (u.estado === 'detenido') {
                partes.push(otroDia ? t('appointments.lastSendStoppedOn', { date: dia, time: hora }) : t('appointments.lastSendStoppedAt', { time: hora }));
            } else {
                partes.push(otroDia ? t('appointments.lastSendFinishedOn', { date: dia, time: hora }) : t('appointments.lastSendFinishedAt', { time: hora }));
            }
        }
        if (u.estado === 'detenido' && u.sin_enviar > 0) partes.push(t('appointments.lastSendLeft', { count: u.sin_enviar, value: miles(u.sin_enviar, lng) }));
        if (u.iniciado_por) partes.push(t('appointments.lastSendBy', { name: nombrePropio(u.iniciado_por) }));
        return partes.join(' · ');
    };

    const botonEnviar = (tipo: TipoEnvio, tanda: { por_enviar: number; salen: number }) => {
        if (tanda.por_enviar <= 0) return null;
        const Icono = tipo === 'dayBefore' ? CalendarCheck2 : Send;
        // El botón dice lo que sale en ESTA pulsación: el servidor envía como máximo max_per_day.
        const parcial = tanda.salen < tanda.por_enviar;
        const propia = accion === tipo;
        const texto = propia
            ? t('appointments.starting')
            : parcial
              ? t('appointments.sendRemindersPartial', { value: miles(tanda.salen, lng), total: miles(tanda.por_enviar, lng) })
              : tipo === 'all'
                ? t('appointments.sendAllButton', { value: miles(tanda.por_enviar, lng) })
                : t('appointments.sendRemindersButton', { count: tanda.por_enviar, value: miles(tanda.por_enviar, lng) });
        const apagado = accion !== null || hayEnvio;

        return (
            <button
                type="button"
                onClick={() => abrirConfirmacion(tipo)}
                disabled={apagado}
                title={hayEnvio ? notaEnCurso : t('appointments.sendAsksConfirmation')}
                aria-haspopup="dialog"
                className={apagado ? BOTON_APAGADO : BOTON_PRIMARIO}
            >
                {propia ? <LoaderCircle className="animate-spin motion-reduce:animate-none" strokeWidth={2} aria-hidden="true" /> : <Icono strokeWidth={2} aria-hidden="true" />}
                {texto}
            </button>
        );
    };

    /** Una fecha con recordatorios por enviar: cuándo, cuántas (y cuántas sin celular) y su botón. */
    const filaTanda = ({ tipo, cuando, pista, tanda, final = false }: { tipo: 'start' | 'dayBefore'; cuando: string; pista?: string; tanda: Tanda; final?: boolean }) => (
        <div
            className={cn(
                'grid grid-cols-1 gap-y-2.5 py-3.5 @3xl/hoja:min-h-16 @3xl/hoja:grid-cols-[220px_minmax(0,1fr)_auto] @3xl/hoja:items-center @3xl/hoja:gap-x-8 @3xl/hoja:py-2 @5xl/hoja:grid-cols-[300px_minmax(0,1fr)_auto]',
                SANGRIA,
                !final && cn('border-b', FILETE)
            )}
        >
            <div className="flex min-w-0 flex-col gap-[3px]">
                <span className={cn('text-[13.5px] leading-[18px] font-semibold tracking-[-0.003em]', TEXTO_NAVY)}>{cuando}</span>
                <span className={cn('text-[12px] leading-4', TEXTO_SUAVE)}>{t('appointments.appointmentsOfDate', { date: fechaTexto(tanda.fecha) })}</span>
                {pista && <span className={cn('text-[12px] leading-4', TEXTO_SUAVE)}>{pista}</span>}
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex min-w-0 items-baseline gap-2">
                    <span className={cn('text-[20px] leading-6 font-medium tracking-[-0.02em] tabular-nums', tanda.por_enviar ? TEXTO_NAVY : TEXTO_SUAVE)}>{miles(tanda.por_enviar, lng)}</span>
                    <span className={cn('text-[13px] leading-[18px]', TEXTO_SUAVE)}>{t('appointments.rowPendingCount', { count: tanda.por_enviar })}</span>
                </div>
                {tanda.sin_celular > 0 && (
                    <span className={cn('text-[12px] leading-4 tabular-nums', TEXTO_SUAVE)}>{t('appointments.rowNoMobile', { count: tanda.sin_celular, value: miles(tanda.sin_celular, lng) })}</span>
                )}
            </div>
            <div className="flex @3xl/hoja:justify-end">{botonEnviar(tipo, tanda)}</div>
        </div>
    );

    /** «Todas las citas cargadas»: el rango de fechas, cuántas y el botón «Enviar todas ya». */
    const filaTodas = (tanda: TandaTodas) => (
        <div
            className={cn(
                'grid grid-cols-1 gap-y-2.5 border-t py-3.5 @3xl/hoja:min-h-16 @3xl/hoja:grid-cols-[220px_minmax(0,1fr)_auto] @3xl/hoja:items-center @3xl/hoja:gap-x-8 @3xl/hoja:py-2 @5xl/hoja:grid-cols-[300px_minmax(0,1fr)_auto]',
                SANGRIA,
                FILETE
            )}
        >
            <div className="flex min-w-0 flex-col gap-[3px]">
                <span className={cn('text-[13.5px] leading-[18px] font-semibold tracking-[-0.003em]', TEXTO_NAVY)}>{t('appointments.allLabel')}</span>
                <span className={cn('text-[12px] leading-4', TEXTO_SUAVE)}>
                    {tanda.desde === tanda.hasta
                        ? t('appointments.appointmentsOfDate', { date: fechaTexto(tanda.desde) })
                        : t('appointments.appointmentsOfRange', { from: fechaTexto(tanda.desde), to: fechaTexto(tanda.hasta), count: tanda.dias })}
                </span>
                <span className={cn('text-[12px] leading-4', TEXTO_SUAVE)}>{t('appointments.allHint', { from: horaCorta(horaInicio, lng), to: horaCorta(horaFin, lng) })}</span>
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex min-w-0 items-baseline gap-2">
                    <span className={cn('text-[20px] leading-6 font-medium tracking-[-0.02em] tabular-nums', TEXTO_NAVY)}>{miles(tanda.por_enviar, lng)}</span>
                    <span className={cn('text-[13px] leading-[18px]', TEXTO_SUAVE)}>{t('appointments.rowPendingCount', { count: tanda.por_enviar })}</span>
                </div>
                {tanda.sin_celular > 0 && (
                    <span className={cn('text-[12px] leading-4 tabular-nums', TEXTO_SUAVE)}>{t('appointments.rowNoMobile', { count: tanda.sin_celular, value: miles(tanda.sin_celular, lng) })}</span>
                )}
            </div>
            <div className="flex @3xl/hoja:justify-end">{botonEnviar('all', tanda)}</div>
        </div>
    );

    const avisoTope = (cuando: string, tanda: Tanda) =>
        maxPorEnvio > 0 &&
        tanda.por_enviar > maxPorEnvio && (
            <FilaAviso key={`tope-${tanda.fecha}`} etiqueta={t('appointments.warningLabel')}>
                {t('appointments.warningLimit', {
                    value: miles(tanda.por_enviar, lng),
                    when: `${cuando.toLocaleLowerCase(lng)} (${fechaTexto(tanda.fecha)})`,
                    max: miles(maxPorEnvio, lng),
                    rest: miles(tanda.por_enviar - maxPorEnvio, lng),
                })}
            </FilaAviso>
        );

    const accionesEnvio = (
        <>
            {isProcessing && !isPaused && (
                <button type="button" onClick={() => void pausar()} disabled={accion !== null} className={BOTON_SECUNDARIO}>
                    <Pause strokeWidth={1.9} aria-hidden="true" />
                    {accion === 'pause' ? t('appointments.pausing') : t('appointments.pauseButton')}
                </button>
            )}
            {isPaused && (
                <button type="button" onClick={() => setConfirmarReanudar(true)} disabled={accion !== null} aria-haspopup="dialog" className={BOTON_PRIMARIO}>
                    <Play strokeWidth={2} aria-hidden="true" />
                    {accion === 'resume'
                        ? t('appointments.resuming')
                        : progress
                          ? t('appointments.resumeButtonCount', { value: miles(progress.pending, lng) })
                          : t('appointments.resumeButton')}
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
    );

    const textoTitulo = t('appointments.tabTitle', { scope: nombreAmbito });

    return (
        <AdminLayout>
            <Head title={textoTitulo} />

            <div className="min-h-screen bg-background px-4 pt-5 pb-8 md:px-7 md:pt-7">
                <div className="@container/pagina mx-auto flex max-w-7xl flex-col gap-6">
                    {/* ── Cabecera: título + ámbito (General / Oncología) ── */}
                    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                        <div className="flex min-w-0 flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-x-[18px] gap-y-2">
                                <h1 className={cn('text-[28px] leading-[34px] font-semibold tracking-[-0.025em]', TEXTO_NAVY)}>{t('navigation.appointments')}</h1>
                                {/* El submenú de Citas salió del riel: la sección navega dentro de sí misma. */}
                                <AppointmentsScopeSwitch />
                            </div>
                            <p className="text-[14px] leading-5 text-muted-foreground">{t('appointments.headerSubtitle')}</p>
                        </div>

                        {/* Enlace de verdad (se puede abrir en otra pestaña); siempre visible: la lista tiene su propio vacío. */}
                        <Link href={`${routePrefix}/view`} className={cn(BOTON_SECUNDARIO, 'self-start')}>
                            <ArrowRight strokeWidth={1.9} aria-hidden="true" />
                            {t('appointments.viewAllAppointments')}
                        </Link>
                    </header>

                    {showFlashMessage && (flash?.success || flash?.error) && (
                        <div
                            role={flash?.error ? 'alert' : 'status'}
                            className={cn(
                                'flex items-start gap-3 rounded-xl px-4 py-3 text-[13px] leading-[18px] font-medium',
                                flash?.success
                                    ? 'bg-emerald-50 text-emerald-800 shadow-[inset_0_0_0_1px_var(--color-emerald-200)] dark:bg-emerald-500/10 dark:text-emerald-300 dark:shadow-[inset_0_0_0_1px_rgba(16,185,129,0.25)]'
                                    : 'bg-red-50 text-red-800 shadow-[inset_0_0_0_1px_var(--color-red-200)] dark:bg-red-500/10 dark:text-red-300 dark:shadow-[inset_0_0_0_1px_rgba(239,68,68,0.28)]'
                            )}
                        >
                            {flash?.success ? (
                                <CircleCheck className="mt-px size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                            ) : (
                                <CircleAlert className="mt-px size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                            )}
                            <p className="min-w-0 flex-1">{flash?.success || flash?.error}</p>
                            <button
                                type="button"
                                onClick={() => setShowFlashMessage(false)}
                                aria-label={t('appointments.closeNotice')}
                                title={t('appointments.closeNotice')}
                                className={cn('-my-1 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/10', FOCO)}
                            >
                                <X className="size-4" aria-hidden="true" />
                            </button>
                        </div>
                    )}

                    <p className="sr-only" aria-live="polite">
                        {anuncio}
                    </p>

                    {/* ── Franja de cifras (sin cajas: filetes entre cifras) ── */}
                    <Deferred data={['appointments', 'totalAppointments', 'remindersStats']} fallback={<AppointmentMetricsSkeleton />}>
                        {() =>
                            // Con un servidor sin el contrato nuevo (despliegue a medias) no hay objetivo: la franja no se pinta en vez de romper la página.
                            stats?.objetivo &&
                            stats.manana && (
                                <section aria-label={t('appointments.summaryLabel')} className={FRANJA}>
                                    <Cifra
                                        marca={<Calendar className={cn('mt-px size-3.5 shrink-0', TEXTO_NAVY)} strokeWidth={2} aria-hidden="true" />}
                                        etiqueta={t('appointments.metricTotalAppointments')}
                                        valor={miles(totalAppointments, lng)}
                                        detalle={t('appointments.metricFuture', { value: miles(stats.futuras ?? 0, lng) })}
                                    />
                                    <Divisor />
                                    <Cifra
                                        marca={<Send className="mt-px size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={2} aria-hidden="true" />}
                                        etiqueta={t('appointments.metricSent')}
                                        valor={miles(stats.sent, lng)}
                                        detalle={ultimo?.inicio ? t('appointments.metricLastSent', { date: fechaEnvio(ultimo.inicio, lng) }) : t('appointments.metricLastSentNone')}
                                    />
                                    <Divisor />
                                    <Cifra
                                        marca={<Clock className="mt-px size-3.5 shrink-0 text-amber-600 dark:text-amber-400" strokeWidth={2} aria-hidden="true" />}
                                        etiqueta={t('appointments.metricPending', { when: rotuloObjetivo.toLocaleLowerCase(lng) })}
                                        valor={miles(stats.objetivo.por_enviar, lng)}
                                        detalle={
                                            mananaVisible
                                                ? t('appointments.metricForTomorrow', { value: miles(stats.manana.por_enviar, lng) })
                                                : stats.objetivo.sin_celular > 0
                                                  ? t('appointments.metricNoMobile', { value: miles(stats.objetivo.sin_celular, lng) })
                                                  : ''
                                        }
                                        puntoDetalle={mananaVisible && stats.manana.por_enviar > 0 ? 'bg-amber-600 dark:bg-amber-400' : undefined}
                                        tonoDetalle={mananaVisible && stats.manana.por_enviar > 0 ? 'font-medium text-amber-800 dark:text-amber-400' : undefined}
                                    />
                                    <Divisor />
                                    <Cifra
                                        marca={<CircleX className="mt-px size-3.5 shrink-0 text-red-600 dark:text-red-400" strokeWidth={2} aria-hidden="true" />}
                                        etiqueta={t('appointments.metricFailed')}
                                        valor={miles(stats.failed, lng)}
                                        detalle={t('appointments.metricFailedDetail')}
                                    />
                                </section>
                            )
                        }
                    </Deferred>

                    {/* ── La hoja: envío, carga del Excel y últimas citas, una sección tras otra ── */}
                    <div className={HOJA}>
                        {/* ── 1. Envío de recordatorios ── */}
                        <section aria-labelledby="citas-envio">
                            <Banda
                                id="citas-envio"
                                icon={Send}
                                titulo={t('appointments.reminderControlTitle')}
                                estado={<EstadoEnvio tipo={estadoEnvio} texto={textoEstado} />}
                                texto={t('appointments.reminderBandText')}
                                acciones={hayEnvio && !iniciando ? accionesEnvio : undefined}
                                className="rounded-t-2xl"
                            />

                            {/* Resultado de enviar / pausar / reanudar / detener, y el resumen al terminar. */}
                            <div aria-live="polite">
                                {avisoEnvio && (
                                    <div
                                        className={cn(
                                            'flex items-start gap-3 border-b px-4 py-3 @3xl/hoja:px-5',
                                            avisoEnvio.tipo === 'error'
                                                ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300'
                                                : avisoEnvio.tipo === 'aviso'
                                                  ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200'
                                                  : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
                                        )}
                                    >
                                        <span className="flex w-8 shrink-0 justify-center pt-px">
                                            {avisoEnvio.tipo === 'error' ? (
                                                <CircleAlert className="size-[17px]" strokeWidth={2} aria-hidden="true" />
                                            ) : avisoEnvio.tipo === 'aviso' ? (
                                                <TriangleAlert className="size-[17px]" strokeWidth={2} aria-hidden="true" />
                                            ) : (
                                                <CircleCheck className="size-[17px]" strokeWidth={2} aria-hidden="true" />
                                            )}
                                        </span>
                                        <p className="min-w-0 flex-1 pt-px text-[13px] leading-[19px] font-medium tabular-nums [overflow-wrap:anywhere]">{avisoEnvio.texto}</p>
                                        <button
                                            type="button"
                                            onClick={cerrarAvisoEnvio}
                                            aria-label={t('appointments.closeNotice')}
                                            title={t('appointments.closeNotice')}
                                            className={cn('-my-0.5 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/10', FOCO)}
                                        >
                                            <X className="size-4" aria-hidden="true" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {isProcessing && fallosSondeo >= 2 && <FilaAviso>{t('appointments.progressRefreshFailed')}</FilaAviso>}
                            {isProcessing && !isPaused && sinAvanzar && <FilaAviso>{t('appointments.stalledText')}</FilaAviso>}

                            {barra && (
                                <div className={cn('border-b pt-[18px] pb-3.5', SANGRIA, FILETE)}>
                                    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                                        <div className="flex min-w-0 flex-col gap-1.5">
                                            <Rotulo
                                                titulo={esFinal ? t('appointments.progressFinalTitle') : isPaused ? t('appointments.progressPausedTitle') : t('appointments.sendingProgress')}
                                                apoyo={
                                                    esFinal
                                                        ? undefined
                                                        : sondeoParado
                                                          ? t('appointments.sessionExpired')
                                                          : isPaused
                                                            ? ultimo?.tipo === 'todas'
                                                                ? t('appointments.progressPausedHintAll')
                                                                : t('appointments.progressPausedHint')
                                                            : esperando
                                                              ? t('appointments.progressWaitingHint', { time: horaEspera })
                                                              : t('appointments.progressAutoRefresh')
                                                }
                                            />
                                            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                                <span
                                                    className={cn(
                                                        'text-[30px] leading-9 font-medium tracking-[-0.03em] whitespace-nowrap tabular-nums',
                                                        isPaused ? 'text-amber-700 dark:text-amber-400' : TEXTO_NAVY
                                                    )}
                                                >
                                                    {barra.percentage} %
                                                </span>
                                                <span className={cn('text-[14px] leading-5 tabular-nums', TEXTO_SUAVE)}>
                                                    <Trans
                                                        i18nKey="appointments.progressProcessedRich"
                                                        values={{ done: miles(barra.total - barra.pending, lng), total: miles(barra.total, lng) }}
                                                        components={{ strong: <span className={cn('font-semibold', TEXTO_NAVY)} /> }}
                                                    />
                                                </span>
                                            </div>
                                        </div>
                                        <div className={cn('flex flex-wrap items-center gap-x-[22px] gap-y-1.5 pb-1.5 text-[13px] leading-[18px] font-medium whitespace-nowrap tabular-nums', TEXTO_NAVY)}>
                                            <span className="flex items-center gap-2">
                                                <span className="size-[9px] shrink-0 rounded-[2.5px] bg-emerald-600 dark:bg-emerald-500" aria-hidden="true" />
                                                {t('appointments.progressSent')} <span className="font-semibold">{miles(barra.sent, lng)}</span>
                                            </span>
                                            <span className="flex items-center gap-2">
                                                <span className="size-[9px] shrink-0 rounded-[2.5px] bg-red-600 dark:bg-red-500" aria-hidden="true" />
                                                {t('appointments.progressFailed')} <span className="font-semibold">{miles(barra.failed, lng)}</span>
                                            </span>
                                            {barra.skipped > 0 && (
                                                <span className="flex items-center gap-2" title={t('appointments.progressSkippedHint')}>
                                                    <span className="size-[9px] shrink-0 rounded-[2.5px] bg-slate-400 dark:bg-neutral-500" aria-hidden="true" />
                                                    {t('appointments.progressSkipped')} <span className="font-semibold">{miles(barra.skipped, lng)}</span>
                                                </span>
                                            )}
                                            <span className="flex items-center gap-2">
                                                <span className="size-[9px] shrink-0 rounded-[2.5px] bg-[#2e3f84]/8 shadow-[inset_0_0_0_1px_rgba(46,63,132,0.32)] dark:bg-white/10 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.3)]" aria-hidden="true" />
                                                {t('appointments.progressPending')} <span className="font-semibold">{miles(barra.pending, lng)}</span>
                                            </span>
                                        </div>
                                    </div>
                                    <div
                                        role="progressbar"
                                        aria-label={esFinal ? t('appointments.progressFinalTitle') : isPaused ? t('appointments.progressPausedTitle') : t('appointments.sendingProgress')}
                                        aria-valuemin={0}
                                        aria-valuemax={100}
                                        aria-valuenow={Math.min(barra.percentage, 100)}
                                        aria-valuetext={t('appointments.progressValueText', {
                                            done: miles(barra.total - barra.pending, lng),
                                            total: miles(barra.total, lng),
                                            failed: miles(barra.failed, lng),
                                        })}
                                        className="mt-3.5 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-[#2e3f84]/8 forced-colors:border dark:bg-white/10"
                                    >
                                        <div
                                            className="h-full bg-emerald-600 transition-[width] duration-500 ease-out motion-reduce:transition-none forced-color-adjust-none forced-colors:bg-[Highlight] dark:bg-emerald-500"
                                            style={{ width: `${Math.min((barra.sent / barra.total) * 100, 100)}%` }}
                                        />
                                        {barra.failed > 0 && (
                                            <div
                                                className="h-full min-w-[3px] bg-red-600 transition-[width] duration-500 ease-out motion-reduce:transition-none forced-color-adjust-none forced-colors:bg-[CanvasText] dark:bg-red-500"
                                                style={{ width: `${Math.min((barra.failed / barra.total) * 100, 100)}%` }}
                                            />
                                        )}
                                        {barra.skipped > 0 && (
                                            <div
                                                className="h-full min-w-[3px] bg-slate-400 transition-[width] duration-500 ease-out motion-reduce:transition-none forced-color-adjust-none forced-colors:bg-[GrayText] dark:bg-neutral-500"
                                                style={{ width: `${Math.min((barra.skipped / barra.total) * 100, 100)}%` }}
                                            />
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Sin envío en curso: cómo fue el último (o, si se cortó, por qué). */}
                            {!hayEnvio &&
                                !iniciando &&
                                !barraFinal &&
                                ultimo &&
                                ultimo.estado !== 'en_curso' &&
                                (ultimo.estado === 'cortado' ? (
                                    <FilaAviso>{textoCorte(ultimo)}</FilaAviso>
                                ) : (
                                    <div className={cn('flex min-h-11 items-center gap-3 border-b px-4 py-2.5 @3xl/hoja:px-5', FILETE)}>
                                        <span className={cn('flex w-8 shrink-0 justify-center', TEXTO_SUAVE)}>
                                            <History className="size-[15px]" strokeWidth={1.9} aria-hidden="true" />
                                        </span>
                                        <p className={cn('text-[12.5px] leading-4 tabular-nums', TEXTO_SUAVE)}>{lineaUltimo(ultimo)}</p>
                                    </div>
                                ))}

                            <Deferred data="remindersStats" fallback={<RemindersRowsSkeleton />}>
                                {() =>
                                    objetivo &&
                                    manana && (
                                        <>
                                            {avisoTope(rotuloObjetivo, objetivo)}
                                            {mananaVisible && avisoTope(t('appointments.dayBeforeLabel'), manana)}

                                            <div className={cn('flex min-h-10 flex-wrap items-end gap-x-2.5 gap-y-0.5 pt-4 pb-2', SANGRIA)}>
                                                <h3 className={cn('text-[11px] leading-4 font-semibold tracking-[0.07em] uppercase', TEXTO_SUAVE)}>{t('appointments.toSendTitle')}</h3>
                                                <p className={cn('text-[12px] leading-4', TEXTO_SUAVE)}>{hayEnvio ? t('appointments.toSendHint') : t('appointments.toSendHintConfirm')}</p>
                                            </div>

                                            {filaTanda({ tipo: 'start', cuando: rotuloObjetivo, tanda: objetivo, final: !mananaVisible })}
                                            {mananaVisible &&
                                                filaTanda({ tipo: 'dayBefore', cuando: t('appointments.dayBeforeLabel'), pista: t('appointments.dayBeforeHint'), tanda: manana, final: true })}
                                            {todasVisible && todas && filaTodas(todas)}

                                            {(hayEnvio || (!todasVisible && objetivo.por_enviar === 0 && (!mananaVisible || manana.por_enviar === 0))) && (
                                                <div className={cn('flex min-h-12 items-center gap-3 border-t px-4 py-3 @3xl/hoja:px-5', FILETE)}>
                                                    <span className={cn('flex w-8 shrink-0 justify-center', TEXTO_SUAVE)}>
                                                        <Info className="size-[15px]" strokeWidth={1.9} aria-hidden="true" />
                                                    </span>
                                                    <p className={cn('text-[12.5px] leading-4', TEXTO_SUAVE)}>{hayEnvio ? notaEnCurso : t('appointments.noPendingReminders')}</p>
                                                </div>
                                            )}
                                        </>
                                    )
                                }
                            </Deferred>
                        </section>

                        {/* ── 1b. Recordatorio por llamada (rondas del robot) ── */}
                        <RecordatorioLlamada routePrefix={routePrefix} ronda={rondaLlamadas} stats={llamadasStats} />

                        {/* ── 2. Cargar archivo de citas ── */}
                        <form onSubmit={submit} aria-labelledby="citas-carga">
                            <Banda id="citas-carga" icon={FileSpreadsheet} titulo={t('appointments.uploadFileTitle')} texto={t('appointments.uploadFileSubtitle')} className="border-t" />

                            <div className={cn('grid grid-cols-1 gap-5 border-b py-5 @5xl/hoja:grid-cols-[minmax(0,1fr)_1px_minmax(0,380px)] @5xl/hoja:gap-x-7 @6xl/hoja:grid-cols-[minmax(0,1fr)_1px_minmax(0,440px)]', SANGRIA, FILETE)}>
                                <div className="flex min-w-0 flex-col">
                                    <div
                                        onDrop={handleDrop}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        className={cn(
                                            'relative rounded-xl border-[1.5px] border-dashed transition-colors',
                                            isDragging
                                                ? 'border-[#2e3f84] bg-[#2e3f84]/8 dark:border-[#8b9ae0] dark:bg-white/8'
                                                : 'border-[#2e3f84]/35 bg-[#2e3f84]/[0.035] hover:border-[#2e3f84]/60 dark:border-white/25 dark:bg-white/[0.03] dark:hover:border-white/40'
                                        )}
                                    >
                                        {!data.file ? (
                                            <label
                                                htmlFor="appointment-file-upload"
                                                className="flex min-h-[136px] cursor-pointer flex-wrap items-center gap-x-[18px] gap-y-4 rounded-xl px-5 py-5 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-[#2e3f84] @3xl/hoja:flex-nowrap @3xl/hoja:px-6 dark:has-[input:focus-visible]:outline-[#53bdeb]"
                                            >
                                                <input
                                                    ref={campoArchivo}
                                                    id="appointment-file-upload"
                                                    name="appointment-file"
                                                    type="file"
                                                    className="sr-only"
                                                    accept=".xlsx,.xls"
                                                    onChange={handleFileChange}
                                                    disabled={processing}
                                                    aria-invalid={avisoArchivo ? true : undefined}
                                                    aria-describedby={avisoArchivo ? 'appointment-file-error' : undefined}
                                                />
                                                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#2e3f84] text-white shadow-[0_1px_2px_rgba(46,63,132,0.3),0_6px_14px_-6px_rgba(46,63,132,0.5)] dark:bg-[#4e5fa4]">
                                                    <Upload className="size-5" strokeWidth={2} aria-hidden="true" />
                                                </span>
                                                <span className="flex min-w-0 flex-[1_1_14rem] flex-col gap-1">
                                                    <span className={cn('text-[14px] leading-5 font-semibold', TEXTO_NAVY)}>{t('appointments.dropzoneTitle')}</span>
                                                    <span className={cn('text-[13px] leading-[18px]', TEXTO_SUAVE)}>{t('appointments.dropzoneHint')}</span>
                                                    <span className={cn('mt-1 text-[12px] leading-4', TEXTO_SUAVE)}>{t('appointments.dropzoneSupportedFormats')}</span>
                                                </span>
                                                <span className={cn(BOTON_SECUNDARIO, 'pointer-events-none')} aria-hidden="true">
                                                    <FileSpreadsheet strokeWidth={1.9} />
                                                    {t('appointments.selectFile')}
                                                </span>
                                            </label>
                                        ) : (
                                            <div className="flex min-h-[136px] flex-wrap items-center gap-x-4 gap-y-4 px-5 py-5 @3xl/hoja:flex-nowrap @3xl/hoja:px-6">
                                                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#2e3f84]/10 text-[#2e3f84] dark:bg-white/8 dark:text-neutral-100">
                                                    <FileSpreadsheet className="size-5" strokeWidth={1.9} aria-hidden="true" />
                                                </span>
                                                <div className="flex min-w-0 flex-[1_1_12rem] flex-col gap-1">
                                                    <p className={cn('truncate text-[14px] leading-5 font-semibold', MONO, TEXTO_NAVY)} title={data.file.name}>
                                                        {data.file.name}
                                                    </p>
                                                    <p className={cn('text-[13px] leading-[18px] tabular-nums', TEXTO_SUAVE)}>{tamanoArchivo(data.file.size, lng)}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={removeFile}
                                                        disabled={processing}
                                                        aria-label={t('appointments.removeFile')}
                                                        title={t('appointments.removeFile')}
                                                        className={cn(
                                                            'flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10',
                                                            FOCO
                                                        )}
                                                    >
                                                        <X className="size-4" aria-hidden="true" />
                                                    </button>
                                                    <button ref={botonCargar} type="submit" disabled={processing} className={BOTON_PRIMARIO}>
                                                        {processing ? (
                                                            <LoaderCircle className="animate-spin motion-reduce:animate-none" strokeWidth={2} aria-hidden="true" />
                                                        ) : (
                                                            <Upload strokeWidth={2} aria-hidden="true" />
                                                        )}
                                                        {processing
                                                            ? subida?.percentage !== undefined && subida.percentage < 100
                                                                ? t('appointments.uploadingPercent', { value: subida.percentage })
                                                                : t('appointments.uploadingChecking')
                                                            : t('appointments.uploadFileButton')}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        <AvisoCampo id="appointment-file-error" texto={avisoArchivo} />
                                    </div>

                                    {processing && <p className={cn('mt-3 text-[12.5px] leading-4', TEXTO_SUAVE)}>{t('appointments.uploadingWait')}</p>}

                                    {!processing && !errorCargaOculto && errorCarga && (
                                        <p role="alert" className="mt-3 flex items-start gap-2 text-[13px] leading-[18px] font-medium text-red-700 dark:text-red-400">
                                            <CircleAlert className="mt-px size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                                            <span className="min-w-0 [overflow-wrap:anywhere]">{errorCarga}</span>
                                        </p>
                                    )}
                                </div>

                                <div className="hidden w-px self-stretch bg-[#2e3f84]/8 @5xl/hoja:block dark:bg-white/8" aria-hidden="true" />

                                <div className="flex min-w-0 flex-col gap-3">
                                    <Rotulo titulo={t('appointments.excelColumnsTitle')} />
                                    <dl className="grid grid-cols-2 gap-x-[18px] gap-y-2.5 @xl/hoja:grid-cols-3">
                                        {COLUMNAS_EXCEL.map(([columna, clave, obligatoria]) => (
                                            <div key={columna} className="flex min-w-0 flex-col gap-px">
                                                <dt className={cn('flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12.5px] leading-[17px] font-semibold tracking-[0.01em]', TEXTO_NAVY)}>
                                                    <span className={MONO}>{columna}</span>
                                                    {obligatoria && (
                                                        <span className="rounded-[5px] bg-[#2e3f84]/8 px-1.5 text-[11px] leading-4 font-semibold tracking-[0.02em] forced-colors:border dark:bg-white/10 dark:text-neutral-200">
                                                            {t('appointments.columnRequired')}
                                                        </span>
                                                    )}
                                                </dt>
                                                <dd className={cn('line-clamp-2 text-[12px] leading-4', TEXTO_SUAVE)} title={t(clave)}>
                                                    {t(clave)}
                                                </dd>
                                            </div>
                                        ))}
                                    </dl>
                                    <p className={cn('text-[12px] leading-4', TEXTO_SUAVE)}>{t('appointments.excelColumnsNote')}</p>
                                </div>
                            </div>

                            {uploadedFile && showUploadResult && frasesCarga.length > 0 && (
                                <div className={cn('flex items-start gap-3 border-b px-4 py-3 @3xl/hoja:min-h-[60px] @3xl/hoja:items-center @3xl/hoja:px-5', FILETE)}>
                                    <span className={cn('flex w-8 shrink-0 justify-center', cargaSinCambios ? TONO_TEXTO.aviso : TONO_TEXTO.ok)}>
                                        {cargaSinCambios ? (
                                            <CircleAlert className="size-[18px]" strokeWidth={2} aria-hidden="true" />
                                        ) : (
                                            <CircleCheck className="size-[18px]" strokeWidth={2} aria-hidden="true" />
                                        )}
                                    </span>
                                    <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                                        <p className={cn('text-[13px] leading-[18px] font-medium tabular-nums', TEXTO_NAVY)}>
                                            <span className={cn('font-semibold', cargaSinCambios ? TONO_TEXTO.aviso : TONO_TEXTO.ok)}>{frasesCarga[0]}</span>
                                            {frasesCarga.length > 1 && ` ${frasesCarga.slice(1).join(' ')}`}
                                        </p>
                                        <p className={cn('flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] leading-4 tabular-nums', TEXTO_SUAVE)}>
                                            <span className={cn('max-w-full truncate text-[12px]', MONO, TEXTO_NAVY)} title={uploadedFile.name}>
                                                {uploadedFile.name}
                                            </span>
                                            <span aria-hidden="true">·</span>
                                            <span>{tamanoArchivo(Number(uploadedFile.size) || 0, lng)}</span>
                                            <span aria-hidden="true">·</span>
                                            <span>{fechaEnvio(uploadedFile.uploaded_at, lng)}</span>
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowUploadResult(false)}
                                        aria-label={t('appointments.closeNotice')}
                                        title={t('appointments.closeNotice')}
                                        className={cn(
                                            'flex size-[30px] shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-[#2e3f84]/8 hover:text-[#2e3f84] dark:text-neutral-400 dark:hover:bg-white/8 dark:hover:text-neutral-100',
                                            FOCO
                                        )}
                                    >
                                        <X className="size-4" strokeWidth={2} aria-hidden="true" />
                                    </button>
                                </div>
                            )}
                        </form>

                        {/* ── 3. Últimas citas cargadas ── */}
                        <Deferred data="appointments" fallback={<AppointmentsTableSkeleton />}>
                            <section aria-labelledby="citas-ultimas">
                                <Banda
                                    id="citas-ultimas"
                                    icon={CalendarClock}
                                    titulo={t('appointments.latestTitle')}
                                    texto={
                                        initialAppointments.length > 0
                                            ? t('appointments.latestText', { shown: miles(initialAppointments.length, lng), total: miles(totalAppointments, lng) })
                                            : t('appointments.noAppointmentsYet')
                                    }
                                    acciones={
                                        initialAppointments.length > 0 && (
                                            <Buscador
                                                id="appointment-search"
                                                etiqueta={t('appointments.searchAppointmentsLabel')}
                                                placeholder={t('appointments.searchPlaceholderRecent', { shown: miles(initialAppointments.length, lng) })}
                                                value={searchTerm}
                                                onChange={setSearchTerm}
                                                className="w-full @3xl/hoja:w-[300px]"
                                            />
                                        )
                                    }
                                    accionesClassName="@3xl/hoja:w-auto"
                                    className={initialAppointments.length === 0 ? 'rounded-b-2xl border-b-0' : undefined}
                                />

                                {initialAppointments.length > 0 && (
                                    <>
                                        <div
                                            aria-hidden="true"
                                            className={cn(
                                                'hidden h-9 border-b bg-card bg-[image:linear-gradient(rgba(46,63,132,0.028),rgba(46,63,132,0.028))] lg:sticky lg:top-0 lg:z-[2] @3xl/hoja:grid dark:bg-[image:linear-gradient(rgba(255,255,255,0.03),rgba(255,255,255,0.03))]',
                                                COLUMNAS_CITA,
                                                FILETE
                                            )}
                                        >
                                            <Th className="text-right">#</Th>
                                            <Th>{t('appointments.columnPatient')}</Th>
                                            <Th>{t('appointments.columnAppointment')}</Th>
                                            <Th>{t('appointments.columnProfessional')}</Th>
                                            <Th>{t('appointments.columnReminder')}</Th>
                                            <Th>{t('appointments.columnResponse')}</Th>
                                        </div>

                                        {filteredAppointments.length > 0 ? (
                                            <ul aria-label={t('appointments.latestTitle')}>
                                                {filteredAppointments.map((appointment, index) => (
                                                    <FilaCita key={appointment.id} cita={appointment} indice={index + 1} />
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className={cn('border-b px-4 py-10 text-center text-[13px] leading-[18px]', FILETE, TEXTO_SUAVE)}>{t('appointments.noSearchResults')}</p>
                                        )}

                                        <div className={cn('flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 rounded-b-2xl py-3 @3xl/hoja:min-h-[52px]', SANGRIA)}>
                                            <p className={cn('text-[12.5px] leading-4 tabular-nums', TEXTO_SUAVE)} aria-live="polite">
                                                <Trans
                                                    i18nKey={searchTerm.trim() ? 'appointments.showingSearchRich' : 'appointments.showingLastAppointmentsRich'}
                                                    values={{ shown: miles(initialAppointments.length, lng), filtered: miles(filteredAppointments.length, lng) }}
                                                    components={{ strong: <span className={cn('font-semibold', TEXTO_NAVY)} /> }}
                                                />
                                            </p>
                                            <Link
                                                href={`${routePrefix}/view`}
                                                className={cn(
                                                    'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-[13px] leading-[18px] font-semibold transition-colors pointer-coarse:h-11 hover:bg-[#2e3f84]/6 dark:hover:bg-white/8',
                                                    TEXTO_NAVY,
                                                    FOCO
                                                )}
                                            >
                                                {t('appointments.viewAllAppointments')}
                                                <ArrowRight className="size-[15px]" strokeWidth={2} aria-hidden="true" />
                                            </Link>
                                        </div>
                                    </>
                                )}
                            </section>
                        </Deferred>
                    </div>
                </div>
            </div>

            {/* ── Confirmación antes de enviar: fecha, cuántos, de qué ámbito, cuánto tarda y si es de noche ── */}
            <Confirmacion
                abierto={confirmarEnvio !== null}
                onCancelar={() => setConfirmarEnvio(null)}
                onConfirmar={aceptarEnvio}
                icono={Send}
                titulo={t('appointments.confirmSendTitle', {
                    count: salen,
                    value: miles(salen, lng),
                    scope: t(esOncologia ? 'appointments.scopeInSentence.oncology' : 'appointments.scopeInSentence.general'),
                })}
                textoSeguro={t('common.cancel')}
                iconoSeguro={X}
                textoConfirmar={recalculando ? t('appointments.confirmSendRefreshing') : t('appointments.confirmSendYes', { value: miles(salen, lng) })}
                confirmarDesactivado={recalculando || salen <= 0}
                respaldoFoco="citas-envio"
            >
                {confirmaTodas && todas ? (
                    <>
                        <p>{t('appointments.confirmAllText', { from: fechaTexto(todas.desde), to: fechaTexto(todas.hasta), count: diasAntes })}</p>
                        <p>{t('appointments.confirmAllDuration', { count: horas })}</p>
                        <p>{t('appointments.confirmAllHours', { from: horaCorta(horaInicio, lng), to: horaCorta(horaFin, lng) })}</p>
                        {todas.sin_celular > 0 && <p>{t('appointments.confirmAllNoMobile', { count: todas.sin_celular, value: miles(todas.sin_celular, lng) })}</p>}
                    </>
                ) : (
                    <>
                        <p>{t('appointments.confirmSendText', { date: fechaTexto(confirmarEnvio === 'dayBefore' ? manana?.fecha : objetivo?.fecha) })}</p>
                        <p>{t('appointments.confirmSendDuration', { count: minutos })}</p>
                        {(tandaConfirmar?.sin_celular ?? 0) > 0 && (
                            <p>{t('appointments.confirmSendNoMobile', { count: tandaConfirmar?.sin_celular ?? 0, value: miles(tandaConfirmar?.sin_celular ?? 0, lng) })}</p>
                        )}
                    </>
                )}
                {quedanOtraTanda > 0 && (
                    <p>
                        <Trans
                            i18nKey="appointments.confirmSendRemaining"
                            values={{ max: miles(maxPorEnvio, lng), rest: miles(quedanOtraTanda, lng), total: miles(tandaConfirmar?.por_enviar ?? 0, lng) }}
                            components={{ strong: <span className={cn('font-semibold', TEXTO_NAVY)} /> }}
                        />
                    </p>
                )}
                {confirmaTodas
                    ? todasDeNoche && (
                          <p className={cn('flex items-start gap-2 font-medium', TONO_TEXTO.aviso)}>
                              <Moon className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                              <span>{t('appointments.confirmAllNight', { time: ahoraColombia(lng), from: horaCorta(horaInicio, lng) })}</span>
                          </p>
                      )
                    : deNoche && (
                          <p className={cn('flex items-start gap-2 font-medium', TONO_TEXTO.aviso)}>
                              <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                              <span>{t('appointments.confirmSendNight', { time: ahoraColombia(lng) })}</span>
                          </p>
                      )}
            </Confirmacion>

            {/* ── Confirmación de reanudar: dice cuántos van a salir ── */}
            <Confirmacion
                abierto={confirmarReanudar}
                onCancelar={() => setConfirmarReanudar(false)}
                onConfirmar={aceptarReanudar}
                icono={Play}
                titulo={t('appointments.confirmResumeTitle')}
                textoSeguro={t('appointments.confirmStopKeepPaused')}
                iconoSeguro={Pause}
                textoConfirmar={t('appointments.confirmResumeYes')}
                iconoConfirmar={Play}
                respaldoFoco="citas-envio"
            >
                <p>{progress ? t('appointments.confirmResumeText', { count: progress.pending, value: miles(progress.pending, lng) }) : t('appointments.confirmResumeGeneric')}</p>
            </Confirmacion>

            {/* ── Confirmación de detener ── */}
            <Confirmacion
                abierto={confirmarDetener}
                onCancelar={() => setConfirmarDetener(false)}
                onConfirmar={aceptarDetener}
                icono={Square}
                peligro
                titulo={t('appointments.confirmStopTitle')}
                textoSeguro={isPaused ? t('appointments.confirmStopKeepPaused') : t('appointments.confirmStopKeep')}
                iconoSeguro={isPaused ? Pause : Play}
                textoConfirmar={t('appointments.confirmStopYes')}
                respaldoFoco="citas-envio"
            >
                <p>
                    {progress && progress.total > 0 ? (
                        <Trans
                            i18nKey="appointments.confirmStopPending"
                            values={{ pending: miles(progress.pending, lng), done: miles(progress.sent, lng) }}
                            components={{ strong: <span className={cn('font-semibold', TEXTO_NAVY)} /> }}
                        />
                    ) : (
                        t('appointments.confirmStopGeneric')
                    )}
                </p>
                <p>{t('appointments.confirmStopAfter')}</p>
            </Confirmacion>
        </AdminLayout>
    );
}

// Skeletons que imitan el layout real mientras Inertia trae las props diferidas
// (appointments, totalAppointments, remindersStats) en la segunda petición.
function AppointmentMetricsSkeleton() {
    return (
        <section className={FRANJA} aria-hidden="true">
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2 @5xl/pagina:col-span-2 @5xl/pagina:last:col-span-1">
                    <Skeleton className="h-4 w-32 rounded-md" />
                    <Skeleton className="h-8 w-24 rounded-md" />
                    <Skeleton className="h-4 w-36 rounded-md" />
                </div>
            ))}
        </section>
    );
}

function RemindersRowsSkeleton() {
    return (
        <div aria-hidden="true">
            <div className={cn('flex min-h-10 items-end pt-4 pb-2', SANGRIA)}>
                <Skeleton className="h-3.5 w-40 rounded-md" />
            </div>
            {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className={cn('flex min-h-16 items-center gap-8 py-3', SANGRIA, i === 0 && cn('border-b', FILETE))}>
                    <div className="flex w-[220px] flex-col gap-1.5">
                        <Skeleton className="h-4 w-28 rounded-md" />
                        <Skeleton className="h-3.5 w-44 rounded-md" />
                    </div>
                    <Skeleton className="hidden h-5 w-56 rounded-md @3xl/hoja:block" />
                    <Skeleton className="ml-auto h-9 w-48 rounded-[10px]" />
                </div>
            ))}
        </div>
    );
}

function AppointmentsTableSkeleton() {
    return (
        <section aria-hidden="true">
            <div className={cn('flex min-h-16 items-center gap-3 border-b px-4 @3xl/hoja:px-5', BANDA, FILETE)}>
                <Skeleton className="size-5 rounded-md" />
                <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-4 w-44 rounded-md" />
                    <Skeleton className="h-3.5 w-72 rounded-md" />
                </div>
            </div>
            <div className="flex flex-col gap-2 px-4 py-4 @3xl/hoja:px-5">
                {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-11 w-full rounded-lg" />
                ))}
            </div>
        </section>
    );
}
