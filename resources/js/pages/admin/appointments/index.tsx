import AdminLayout from '@/layouts/admin-layout';
import { AppointmentsScopeSwitch } from '@/components/appointments-scope-switch';
import {
    BANDA,
    BOTON_APAGADO,
    BOTON_PELIGRO,
    BOTON_PELIGRO_LLENO,
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
    Th,
    fechaLarga,
    fechaLocal,
    miles,
} from '@/components/appointments/piezas-citas';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Deferred, Head, useForm, router, usePage } from '@inertiajs/react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
    ArrowRight,
    Calendar,
    CalendarCheck2,
    CalendarClock,
    ChevronLeft,
    ChevronRight,
    CircleAlert,
    CircleCheck,
    CircleX,
    Clock,
    FileSpreadsheet,
    Info,
    LoaderCircle,
    Pause,
    Play,
    Send,
    Square,
    TriangleAlert,
    Upload,
    X,
    type LucideIcon,
} from 'lucide-react';
import { FormEventHandler, useState, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import axios from 'axios';

// POST de recordatorios vía axios: usa el token CSRF VIVO de la cookie (el <meta> queda
// obsoleto tras un login por Inertia) y deja que el interceptor global reintente ante un 419.
// validateStatus deja pasar 400/500 sin lanzar para que la UI siga mostrando el JSON de
// negocio ({ success:false, message, debug }) como hacía el fetch original.
const postReminder = (url: string) =>
    axios.post(url, null, { validateStatus: (status) => status !== 419 }).then((r) => r.data);

interface Appointment {
    id: number;
    citead?: string;
    cianom?: string;
    citmed?: string;
    mednom?: string;
    citesp?: string;
    espnom?: string;
    citfc?: string;
    cithor?: string;
    citdoc?: string;
    nom_paciente?: string;
    pactel?: string;
    pacnac?: string;
    pachis?: string;
    cittid?: string;
    citide?: string;
    citres?: string;
    cittip?: string;
    nom_cotizante?: string;
    citcon?: string;
    connom?: string;
    citurg?: string;
    citobsobs?: string;
    duracion?: string;
    ageperdes_g?: string;
    dia?: string;
    reminder_sent?: boolean;
    reminder_sent_at?: string;
    reminder_status?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'confirmed' | 'cancelled';
}

interface AppointmentIndexProps {
    // appointments llega DIFERIDA (Inertia v2 deferred prop): ausente en la respuesta
    // inicial — el <Deferred> muestra el skeleton hasta que llega en la 2da petición.
    appointments?: Appointment[];
    totalAppointments?: number;
    remindersStats?: {
        sent: number;
        pending: number;
        pending_tomorrow: number;
        failed: number;
        // Los mismos valores que usa el servidor al enviar (AppointmentController@index). Opcionales:
        // una respuesta antigua en caché puede no traerlos; entonces se cae al cálculo de hoy.
        target_date?: string;
        tomorrow_date?: string;
        days_in_advance?: number;
        max_per_day?: number;
    };
    uploadedFile?: {
        name: string;
        path: string;
        size: number;
        uploaded_at: string;
        total_rows?: number;
    };
    reminderPaused?: boolean;
    reminderProcessing?: boolean;
    reminderProgress?: {
        sent: number;
        failed: number;
        total: number;
        pending: number;
        percentage: number;
    } | null;
    flash?: {
        success?: string;
        error?: string;
    };
    routePrefix?: string;
    pageTitle?: string;
}

/* ── Piezas del panel ────────────────────────────────────────────────────────────────────────────── */

// Sangría del texto de la hoja: 20 px + 32 de la ranura del icono de sección + 12 = 64 px.
const SANGRIA = 'px-4 @3xl/hoja:pr-5 @3xl/hoja:pl-16';

/** Una cifra de la franja: marca + etiqueta arriba, número grande y su detalle debajo. */
function Cifra({ marca, etiqueta, valor, detalle }: { marca: ReactNode; etiqueta: string; valor: string; detalle: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col">
            <div className="flex h-4 items-center gap-2">
                {marca}
                <span className="truncate text-[12px] leading-4 font-medium text-muted-foreground">{etiqueta}</span>
            </div>
            <span className={cn('mt-[7px] text-[28px] leading-8 font-medium tracking-[-0.03em] whitespace-nowrap tabular-nums', TEXTO_NAVY)}>{valor}</span>
            <span className="mt-[5px] flex h-4 min-w-0 items-center gap-1.5 truncate text-[12.5px] leading-4 text-muted-foreground tabular-nums">{detalle}</span>
        </div>
    );
}

// Filete vertical entre cifras (no un borde de tarjeta). Solo cuando la franja va en una fila.
const Divisor = () => <div className="hidden w-px self-stretch bg-[#2e3f84]/12 @5xl/pagina:block dark:bg-white/10" aria-hidden="true" />;
const FRANJA = 'grid grid-cols-2 gap-x-6 gap-y-5 @5xl/pagina:grid-cols-[repeat(3,minmax(0,1fr)_1px)_minmax(0,1fr)] @5xl/pagina:gap-y-0';

/** Banda de sección: icono en la ranura, título + estado, qué hace; acciones a la derecha. */
function Banda({
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
                    <h2 id={id} className={cn('text-[15px] leading-5 font-semibold tracking-[-0.01em]', TEXTO_NAVY)}>
                        {titulo}
                    </h2>
                    {estado}
                </div>
                <p className={cn('text-[12.5px] leading-4 @5xl/hoja:truncate', TEXTO_SUAVE)}>{texto}</p>
            </div>
            {acciones && <div className={cn('flex flex-wrap items-center gap-2.5 @3xl/hoja:shrink-0', accionesClassName)}>{acciones}</div>}
        </div>
    );
}

/** Rótulo en versalitas + apoyo ("PROGRESO DEL ENVÍO  se actualiza solo cada 3 segundos"). */
function Rotulo({ titulo, apoyo }: { titulo: string; apoyo?: string }) {
    return (
        <div className="flex min-h-4 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <span className={cn('text-[11px] leading-4 font-semibold tracking-[0.07em] whitespace-nowrap uppercase', TEXTO_SUAVE)}>{titulo}</span>
            {apoyo && <span className={cn('text-[12px] leading-4', TEXTO_SUAVE)}>{apoyo}</span>}
        </div>
    );
}

/** Estado del envío en la banda: icono o punto + texto del color de su significado. */
function EstadoEnvio({ tipo, texto }: { tipo: 'enviando' | 'pausa' | 'quieto'; texto: string }) {
    if (tipo === 'enviando') {
        return (
            <span className="inline-flex items-center gap-1.5 text-[12.5px] leading-4 font-semibold whitespace-nowrap text-sky-700 dark:text-sky-300">
                <LoaderCircle className="size-3.5 animate-spin text-sky-600 motion-reduce:animate-none dark:text-sky-400" strokeWidth={2.25} aria-hidden="true" />
                {texto}
            </span>
        );
    }
    if (tipo === 'pausa') {
        return (
            <span className="inline-flex items-center gap-1.5 text-[12.5px] leading-4 font-semibold whitespace-nowrap text-amber-700 dark:text-amber-400">
                <Pause className="size-3.5 text-amber-600 dark:text-amber-400" strokeWidth={2.25} aria-hidden="true" />
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

/** Confirmación (Radix Dialog): la opción segura a la izquierda y con el foco; Esc cancela. */
function Confirmacion({
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
}) {
    const seguro = useRef<HTMLButtonElement>(null);

    return (
        <DialogPrimitive.Root open={abierto} onOpenChange={(open) => !open && onCancelar()}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-[65] bg-[#2e3f84]/28 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none dark:bg-black/55" />
                <DialogPrimitive.Content
                    onOpenAutoFocus={(event) => {
                        event.preventDefault();
                        seguro.current?.focus();
                    }}
                    className="fixed top-1/2 left-1/2 z-[65] w-[calc(100%-2rem)] max-w-[460px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-card shadow-[0_0_0_1px_rgba(46,63,132,0.1),0_6px_14px_rgba(46,63,132,0.1),0_30px_60px_-20px_rgba(46,63,132,0.55)] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 motion-reduce:animate-none dark:shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_30px_60px_-20px_rgba(0,0,0,0.8)]"
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
                    <div className={cn('flex flex-wrap justify-end gap-2 border-t px-6 py-3.5', BANDA, FILETE)}>
                        <DialogPrimitive.Close asChild>
                            <button ref={seguro} type="button" className={BOTON_SECUNDARIO}>
                                <IconoSeguro strokeWidth={1.9} aria-hidden="true" />
                                {textoSeguro}
                            </button>
                        </DialogPrimitive.Close>
                        <button type="button" onClick={onConfirmar} className={peligro ? BOTON_PELIGRO_LLENO : BOTON_PRIMARIO}>
                            {peligro ? <Square strokeWidth={2} aria-hidden="true" /> : <Send strokeWidth={2} aria-hidden="true" />}
                            {textoConfirmar}
                        </button>
                    </div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}

const sumarDias = (fecha: Date, dias: number) => new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + dias);

// Columnas del Excel (las mismas de siempre).
const COLUMNAS_EXCEL = [
    ['Citead', 'appointments.columnDescCitead'],
    ['Nom_paciente', 'appointments.columnDescPatientName'],
    ['Pactel', 'appointments.columnDescPhone'],
    ['Citfc', 'appointments.columnDescDate'],
    ['Cithor', 'appointments.columnDescTime'],
    ['Mednom', 'appointments.columnDescDoctorName'],
    ['Espnom', 'appointments.columnDescSpecialty'],
    ['Citdoc', 'appointments.columnDescDocument'],
    ['Citobsobs', 'appointments.columnDescObservations'],
] as const;

export default function AppointmentsIndex({ appointments: initialAppointments = [], totalAppointments = 0, remindersStats, uploadedFile, reminderPaused = false, reminderProcessing = false, reminderProgress: initialProgress = null, routePrefix = '/admin/appointments', pageTitle }: AppointmentIndexProps) {
    const { t, i18n } = useTranslation();
    const lng = i18n.language;
    const resolvedPageTitle = pageTitle ?? t('appointments.pageTitle');
    const { flash } = usePage<{ flash: { success?: string; error?: string } }>().props;
    const [showFlashMessage, setShowFlashMessage] = useState(true);
    const [showUploadResult, setShowUploadResult] = useState(true);
    const [isDragging, setIsDragging] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;
    const [isPaused, setIsPaused] = useState(reminderPaused);
    // Inicializar como procesando si el servidor dice que está procesando
    // (ya sea para citas de pasado mañana O de mañana)
    const [isProcessing, setIsProcessing] = useState(reminderProcessing);
    const [isLoading, setIsLoading] = useState(false);
    const [localStats, setLocalStats] = useState(remindersStats || { sent: 0, pending: 0, pending_tomorrow: 0, failed: 0 });
    // Inicializar progreso con el valor del servidor si existe
    const [progress, setProgress] = useState<{ sent: number; failed: number; total: number; pending: number; percentage: number } | null>(initialProgress);
    // Lo que antes salía con alert(): ahora se ve en la sección de envío, sin perder datos.
    const [avisoEnvio, setAvisoEnvio] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
    // Confirmaciones: qué botón de enviar la abrió, y la de detener.
    const [confirmarEnvio, setConfirmarEnvio] = useState<'start' | 'dayBefore' | null>(null);
    const [confirmarDetener, setConfirmarDetener] = useState(false);

    const dashboardStats = useMemo(() => {
        const recentSent = initialAppointments.filter((appointment) => appointment.reminder_sent).length;
        const recentCancelled = initialAppointments.filter((appointment) => appointment.reminder_status === 'cancelled').length;

        return { recentSent, recentCancelled };
    }, [initialAppointments]);

    const { data, setData, post, processing, errors, reset } = useForm({
        file: null as File | null,
    });

    // Resetear visibilidad del mensaje flash cuando cambie
    useEffect(() => {
        if (flash?.success || flash?.error) {
            setShowFlashMessage(true);
        }
    }, [flash?.success, flash?.error]);

    // Una carga nueva vuelve a mostrar su fila de resultado.
    useEffect(() => {
        setShowUploadResult(true);
    }, [uploadedFile?.uploaded_at]);

    // Sincronizar estadísticas locales con las del servidor cuando cambian
    useEffect(() => {
        if (remindersStats) {
            setLocalStats(remindersStats);
        }
    }, [remindersStats]);

    // Sincronizar estado de procesamiento y progreso con el servidor
    useEffect(() => {
        // Si el servidor dice que está procesando, respetar eso
        if (reminderProcessing) {
            setIsProcessing(true);
            // Sincronizar progreso inicial si existe
            if (initialProgress) {
                setProgress(initialProgress);
            }
        }
    }, [reminderProcessing, initialProgress]);

    // Actualizar estado cada 500ms si está procesando para capturar actualizaciones en tiempo real
    useEffect(() => {
        // Solo hacer polling si el estado local indica que está procesando
        // No depender de reminderProcessing porque puede tardar en actualizarse
        if (!isProcessing) {
            return;
        }

        let updateCount = 0;
        let shouldStop = false;
        let intervalId: ReturnType<typeof setInterval> | null = null;

        // Primera actualización inmediata
        const updateStatus = async () => {
            if (shouldStop) return;

            try {
                const response = await fetch(`${routePrefix}/reminders/status?` + new Date().getTime(), {
                    headers: {
                        'Accept': 'application/json',
                        'Cache-Control': 'no-cache',
                    },
                });
                const data = await response.json();

                setIsPaused(data.paused || false);
                setIsProcessing(data.processing || false);

                // Si el servidor dice que no está procesando, detener polling y recargar estadísticas
                if (!data.processing) {
                    shouldStop = true;
                    setIsProcessing(false);
                    setProgress(null);
                    if (intervalId) {
                        clearInterval(intervalId);
                        intervalId = null;
                    }
                    // Recargar estadísticas finales cuando termine el procesamiento
                    router.reload({
                        only: ['remindersStats', 'reminderProcessing', 'reminderPaused', 'appointments'],
                        onSuccess: (page: any) => {
                            if (page.props.remindersStats) {
                                setLocalStats(page.props.remindersStats as { sent: number; pending: number; pending_tomorrow: number; failed: number });
                            }
                        }
                    });
                    return;
                }

                // Actualizar progreso en tiempo real solo si hay progreso válido
                if (data.progress && data.progress.total > 0) {
                    setProgress(data.progress);
                } else {
                    setProgress(null);
                }

                // Actualizar estadísticas cada 5 polls (15 segundos con intervalo de 3s)
                updateCount++;
                if (updateCount % 5 === 0 && data.pending_count !== undefined) {
                    router.reload({
                        only: ['remindersStats', 'reminderProcessing', 'reminderPaused'],
                        onSuccess: (page: any) => {
                            if (page.props.remindersStats) {
                                setLocalStats(page.props.remindersStats as { sent: number; pending: number; pending_tomorrow: number; failed: number });
                            }
                        }
                    });
                }
            } catch (error) {
                console.error('Error al obtener estado:', error);
            }
        };

        // Actualizar inmediatamente
        updateStatus();

        // Actualizar cada 3 segundos (reduce carga en BD y evita congelamientos)
        intervalId = setInterval(() => {
            if (!shouldStop) {
                updateStatus();
            } else if (intervalId) {
                clearInterval(intervalId);
            }
        }, 3000);

        return () => {
            shouldStop = true;
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [isProcessing, router]);

    // Filtrar citas por búsqueda
    const filteredAppointments = useMemo(() => {
        if (!searchTerm.trim()) return initialAppointments;

        const search = searchTerm.toLowerCase();
        return initialAppointments.filter(apt =>
            apt.nom_paciente?.toLowerCase().includes(search) ||
            apt.pactel?.toLowerCase().includes(search) ||
            apt.mednom?.toLowerCase().includes(search) ||
            apt.espnom?.toLowerCase().includes(search) ||
            apt.citdoc?.toLowerCase().includes(search)
        );
    }, [initialAppointments, searchTerm]);

    // Paginación
    const totalPages = Math.ceil(filteredAppointments.length / itemsPerPage);
    const paginatedAppointments = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredAppointments.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredAppointments, currentPage]);

    // Reset página cuando cambia la búsqueda
    const handleSearch = (value: string) => {
        setSearchTerm(value);
        setCurrentPage(1);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setData('file', e.target.files[0]);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setData('file', e.dataTransfer.files[0]);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(`${routePrefix}/upload`, {
            onSuccess: () => reset('file'),
        });
    };

    const removeFile = () => {
        setData('file', null);
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    const handleStartReminders = async () => {
        setIsLoading(true);

        // Establecer estado de procesamiento inmediatamente para mostrar la barra de progreso
        setIsProcessing(true);
        setIsPaused(false);

        // Inicializar progreso con el total de pendientes (estimado)
        if (localStats.pending > 0) {
            setProgress({
                sent: 0,
                failed: 0,
                total: localStats.pending,
                pending: localStats.pending,
                percentage: 0
            });
        }

        try {
            const data = await postReminder(`${routePrefix}/reminders/start`);

            if (data.success) {
                // Si fue síncrono y terminó inmediatamente, actualizar progreso final
                if (data.sent !== undefined && data.failed !== undefined && data.total !== undefined) {
                    setProgress({
                        sent: data.sent,
                        failed: data.failed,
                        total: data.total,
                        pending: Math.max(0, data.total - data.sent - data.failed),
                        percentage: data.total > 0 ? Math.round(((data.sent + data.failed) / data.total) * 100) : 100
                    });

                    // Esperar un momento para mostrar el resultado final antes de limpiar
                    setTimeout(() => {
                        setIsProcessing(false);
                        setIsPaused(false);
                        setProgress(null);
                    }, 3000);
                } else {
                    // Si es asíncrono, el polling se encargará de actualizar el progreso
                    // El estado ya está establecido arriba
                }

                // Actualizar estadísticas locales si están disponibles
                if (data.sent !== undefined && data.failed !== undefined && remindersStats) {
                    setLocalStats({
                        sent: remindersStats.sent + (data.sent || 0),
                        pending: Math.max(0, remindersStats.pending - (data.sent || 0) - (data.failed || 0)),
                        pending_tomorrow: remindersStats.pending_tomorrow ?? 0,
                        failed: remindersStats.failed + (data.failed || 0)
                    });
                }

                // Recargar estadísticas desde el servidor para asegurar precisión
                router.reload({
                    only: ['remindersStats', 'reminderProcessing', 'reminderPaused'],
                    onSuccess: (page: any) => {
                        // Actualizar estadísticas locales con los datos del servidor
                        if (page.props.remindersStats) {
                            setLocalStats(page.props.remindersStats as { sent: number; pending: number; pending_tomorrow: number; failed: number });
                        }
                    }
                });
            } else {
                // Si hay error, limpiar el estado de procesamiento
                setIsProcessing(false);
                setProgress(null);
                // Mostrar información detallada si está disponible
                let errorMessage = data.message || t('appointments.errorStartSending');

                if (data.debug) {
                    errorMessage += '\n\n' + t('appointments.debugInfoHeader');
                    errorMessage += `\n${t('appointments.debugTargetDate')} ${data.debug.target_date}`;
                    errorMessage += `\n${t('appointments.debugCurrentDate')} ${data.debug.current_date}`;
                    errorMessage += `\n${t('appointments.debugDaysInAdvance')} ${data.debug.days_in_advance}`;
                    errorMessage += `\n${t('appointments.debugTotalPending')} ${data.debug.total_pending_appointments}`;

                    if (data.debug.exact_date_count !== undefined) {
                        errorMessage += `\n${t('appointments.debugAppointmentsTargetDate')} (${data.debug.target_date}): ${data.debug.exact_date_count}`;
                    }

                    if (data.debug.tomorrow_count !== undefined) {
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        errorMessage += `\n${t('appointments.debugAppointmentsTomorrow')} (${tomorrow.toISOString().split('T')[0]}): ${data.debug.tomorrow_count}`;
                    }

                    if (data.debug.day_after_tomorrow_count !== undefined) {
                        const dayAfter = new Date();
                        dayAfter.setDate(dayAfter.getDate() + 2);
                        errorMessage += `\n${t('appointments.debugAppointmentsDayAfter')} (${dayAfter.toISOString().split('T')[0]}): ${data.debug.day_after_tomorrow_count}`;
                    }

                    if (data.debug.dates_with_count && data.debug.dates_with_count.length > 0) {
                        errorMessage += '\n\n' + t('appointments.debugDatesWithPending');
                        data.debug.dates_with_count.slice(0, 10).forEach((item: { date: string; count: number }) => {
                            errorMessage += `\n  - ${item.date}: ${item.count} ${t('appointments.appointmentsSuffix')}`;
                        });
                        if (data.debug.dates_with_count.length > 10) {
                            errorMessage += `\n  ${t('appointments.debugMoreDates', { count: data.debug.dates_with_count.length - 10 })}`;
                        }
                    } else if (data.debug.available_dates && data.debug.available_dates.length > 0) {
                        errorMessage += `\n${t('appointments.debugAvailableDates')} ${data.debug.available_dates.slice(0, 5).join(', ')}`;
                        if (data.debug.available_dates.length > 5) {
                            errorMessage += ` ${t('appointments.debugAndMore', { count: data.debug.available_dates.length - 5 })}`;
                        }
                    }
                }

                setAvisoEnvio({ tipo: 'error', texto: errorMessage });
                // Limpiar estado si hay error
                setIsProcessing(false);
                setProgress(null);
            }
        } catch (error) {
            console.error('Error:', error);
            setAvisoEnvio({ tipo: 'error', texto: t('appointments.errorStartRemindersSending') });
            // Limpiar estado si hay error
            setIsProcessing(false);
            setProgress(null);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePauseReminders = async () => {
        setIsLoading(true);
        try {
            const data = await postReminder(`${routePrefix}/reminders/pause`);

            if (data.success) {
                setIsPaused(true);
                router.reload({ only: ['reminderPaused'] });
            } else {
                setAvisoEnvio({ tipo: 'error', texto: data.message || t('appointments.errorPause') });
            }
        } catch (error) {
            console.error('Error:', error);
            setAvisoEnvio({ tipo: 'error', texto: t('appointments.errorPauseReminders') });
        } finally {
            setIsLoading(false);
        }
    };

    const handleResumeReminders = async () => {
        setIsLoading(true);
        try {
            const data = await postReminder(`${routePrefix}/reminders/resume`);

            if (data.success) {
                setIsPaused(false);
                router.reload({ only: ['reminderPaused'] });
            } else {
                setAvisoEnvio({ tipo: 'error', texto: data.message || t('appointments.errorResume') });
            }
        } catch (error) {
            console.error('Error:', error);
            setAvisoEnvio({ tipo: 'error', texto: t('appointments.errorResumeReminders') });
        } finally {
            setIsLoading(false);
        }
    };

    const handleStartRemindersDayBefore = async () => {
        setIsLoading(true);

        // Establecer estado de procesamiento inmediatamente para mostrar la barra de progreso
        setIsProcessing(true);
        setIsPaused(false);

        // Inicializar progreso con el total de pendientes para mañana
        if (localStats.pending_tomorrow > 0) {
            setProgress({
                sent: 0,
                failed: 0,
                total: localStats.pending_tomorrow,
                pending: localStats.pending_tomorrow,
                percentage: 0
            });
        }

        try {
            const data = await postReminder(`${routePrefix}/reminders/start-day-before`);

            if (data.success) {
                // Si fue síncrono y terminó inmediatamente, actualizar progreso final
                if (data.sent !== undefined && data.failed !== undefined && data.total !== undefined) {
                    setProgress({
                        sent: data.sent,
                        failed: data.failed,
                        total: data.total,
                        pending: Math.max(0, data.total - data.sent - data.failed),
                        percentage: data.total > 0 ? Math.round(((data.sent + data.failed) / data.total) * 100) : 100
                    });

                    // Esperar un momento para mostrar el resultado final antes de limpiar
                    setTimeout(() => {
                        setIsProcessing(false);
                        setIsPaused(false);
                        setProgress(null);
                    }, 3000);
                }

                // Actualizar estadísticas locales si están disponibles
                if (data.sent !== undefined && data.failed !== undefined && remindersStats) {
                    setLocalStats({
                        sent: remindersStats.sent + (data.sent || 0),
                        pending: remindersStats.pending,
                        pending_tomorrow: Math.max(0, remindersStats.pending_tomorrow - (data.sent || 0) - (data.failed || 0)),
                        failed: remindersStats.failed + (data.failed || 0)
                    });
                }

                // Recargar estadísticas desde el servidor
                router.reload({
                    only: ['remindersStats', 'reminderProcessing', 'reminderPaused'],
                    onSuccess: (page: any) => {
                        if (page.props.remindersStats) {
                            setLocalStats(page.props.remindersStats as { sent: number; pending: number; pending_tomorrow: number; failed: number });
                        }
                    }
                });
            } else {
                setIsProcessing(false);
                setProgress(null);
                setAvisoEnvio({ tipo: 'error', texto: data.message || t('appointments.errorStartTomorrow') });
            }
        } catch (error) {
            console.error('Error:', error);
            setAvisoEnvio({ tipo: 'error', texto: t('appointments.errorStartRemindersTomorrow') });
            setIsProcessing(false);
            setProgress(null);
        } finally {
            setIsLoading(false);
        }
    };

    // La confirmación ya no es window.confirm: la da el diálogo "¿Detener el envío…?" antes de llamar aquí.
    const handleStopReminders = async () => {
        setIsLoading(true);
        try {
            const data = await postReminder(`${routePrefix}/reminders/stop`);

            if (data.success) {
                setIsProcessing(false);
                setIsPaused(false);
                router.reload({ only: ['remindersStats', 'reminderProcessing', 'reminderPaused'] });
                setAvisoEnvio({ tipo: 'ok', texto: t('appointments.stopSuccess') });
            } else {
                setAvisoEnvio({ tipo: 'error', texto: data.message || t('appointments.errorStop') });
            }
        } catch (error) {
            console.error('Error:', error);
            setAvisoEnvio({ tipo: 'error', texto: t('appointments.errorStopReminders') });
        } finally {
            setIsLoading(false);
        }
    };

    /* ── Valores reales del servidor para los textos (con caída al cálculo de hoy) ── */
    const hoy = new Date();
    const diasAntes = remindersStats?.days_in_advance ?? 2;
    const fechaObjetivo = fechaLocal(remindersStats?.target_date) ?? sumarDias(hoy, diasAntes);
    const fechaManana = fechaLocal(remindersStats?.tomorrow_date) ?? sumarDias(hoy, 1);
    const maxPorEnvio = remindersStats?.max_per_day;
    // Sin el dato del servidor se conserva el umbral de antes (2.000).
    const limiteAviso = maxPorEnvio ?? 2000;
    const rotuloObjetivo =
        diasAntes === 1
            ? t('appointments.whenTomorrow')
            : diasAntes === 2
              ? t('appointments.whenDayAfterTomorrow')
              : t('appointments.whenInDays', { count: diasAntes });
    const textoFechaObjetivo = fechaLarga(fechaObjetivo, lng);
    const textoFechaManana = fechaLarga(fechaManana, lng);

    const hayEnvio = isProcessing || isPaused;
    const estadoEnvio: 'enviando' | 'pausa' | 'quieto' = isPaused ? 'pausa' : isProcessing ? 'enviando' : 'quieto';
    const conProgreso = isProcessing && progress && progress.total > 0 ? progress : null;

    // Confirmación de enviar: lo que REALMENTE sale en esta pulsación (el servidor limita a max_per_day).
    const pendientesConfirmar = confirmarEnvio === 'dayBefore' ? localStats.pending_tomorrow : localStats.pending;
    const salenAhora = maxPorEnvio ? Math.min(pendientesConfirmar, maxPorEnvio) : pendientesConfirmar;
    const quedanOtraTanda = pendientesConfirmar - salenAhora;

    const aceptarEnvio = () => {
        const tipo = confirmarEnvio;
        setConfirmarEnvio(null);
        setAvisoEnvio(null);
        if (tipo === 'start') void handleStartReminders();
        if (tipo === 'dayBefore') void handleStartRemindersDayBefore();
    };

    const aceptarDetener = () => {
        setConfirmarDetener(false);
        setAvisoEnvio(null);
        void handleStopReminders();
    };

    const notaEnCurso = t('appointments.sendingInProgressNote');

    /** Una fecha con recordatorios por enviar: cuándo, cuántas y su botón (que pide confirmación). */
    const tanda = ({ cuando, fecha, n, boton, final = false }: { cuando: string; fecha: string; n: number; boton: ReactNode; final?: boolean }) => (
        <div
            className={cn(
                'grid grid-cols-1 gap-y-2.5 py-3.5 @3xl/hoja:min-h-16 @3xl/hoja:grid-cols-[220px_minmax(0,1fr)_auto] @3xl/hoja:items-center @3xl/hoja:gap-x-8 @3xl/hoja:py-2 @5xl/hoja:grid-cols-[300px_minmax(0,1fr)_auto]',
                SANGRIA,
                !final && cn('border-b', FILETE)
            )}
        >
            <div className="flex min-w-0 flex-col gap-[3px]">
                <span className={cn('text-[13.5px] leading-[18px] font-semibold tracking-[-0.003em]', TEXTO_NAVY)}>{cuando}</span>
                <span className={cn('text-[12px] leading-4', TEXTO_SUAVE)}>{t('appointments.appointmentsOfDate', { date: fecha })}</span>
            </div>
            <div className="flex min-w-0 items-baseline gap-2">
                <span className={cn('text-[20px] leading-6 font-medium tracking-[-0.02em] tabular-nums', n ? TEXTO_NAVY : TEXTO_SUAVE)}>{miles(n, lng)}</span>
                <span className={cn('text-[13px] leading-[18px]', TEXTO_SUAVE)}>{t('appointments.rowPendingCount', { count: n })}</span>
            </div>
            <div className="flex @3xl/hoja:justify-end">{boton}</div>
        </div>
    );

    const botonEnviar = (tipo: 'start' | 'dayBefore', n: number) => {
        if (n <= 0) return null;
        const Icono = tipo === 'start' ? Send : CalendarCheck2;
        // El botón dice lo que sale en ESTA pulsación: el servidor envía como máximo max_per_day.
        const salen = maxPorEnvio ? Math.min(n, maxPorEnvio) : n;
        const parcial = salen < n;
        const texto =
            isLoading && !hayEnvio
                ? t('appointments.starting')
                : tipo === 'start'
                  ? parcial
                      ? t('appointments.sendRemindersPartial', { value: miles(salen, lng), total: miles(n, lng) })
                      : t('appointments.sendRemindersButton', { count: n, value: miles(n, lng) })
                  : parcial
                    ? t('appointments.sendDayBeforePartial', { value: miles(salen, lng), total: miles(n, lng) })
                    : t('appointments.sendDayBefore', { count: n });
        const apagado = isLoading || hayEnvio;

        return (
            <button
                type="button"
                onClick={() => setConfirmarEnvio(tipo)}
                disabled={apagado}
                title={hayEnvio ? notaEnCurso : t('appointments.sendAsksConfirmation')}
                aria-haspopup="dialog"
                className={apagado ? BOTON_APAGADO : BOTON_PRIMARIO}
            >
                <Icono strokeWidth={2} aria-hidden="true" />
                {texto}
            </button>
        );
    };

    const accionesEnvio = (
        <>
            {isProcessing && !isPaused && (
                <>
                    <button type="button" onClick={handlePauseReminders} disabled={isLoading} className={BOTON_SECUNDARIO}>
                        <Pause strokeWidth={1.9} aria-hidden="true" />
                        {isLoading ? t('appointments.pausing') : t('appointments.pauseButton')}
                    </button>
                    <button type="button" onClick={() => setConfirmarDetener(true)} disabled={isLoading} aria-haspopup="dialog" title={t('appointments.stopAsksConfirmation')} className={BOTON_PELIGRO}>
                        <Square strokeWidth={2} aria-hidden="true" />
                        {isLoading ? t('appointments.stopping') : t('appointments.stopButton')}
                    </button>
                </>
            )}
            {isPaused && (
                <>
                    <button type="button" onClick={handleResumeReminders} disabled={isLoading} className={BOTON_PRIMARIO}>
                        <Play strokeWidth={2} aria-hidden="true" />
                        {isLoading ? t('appointments.resuming') : t('appointments.resumeButton')}
                    </button>
                    <button type="button" onClick={() => setConfirmarDetener(true)} disabled={isLoading} aria-haspopup="dialog" title={t('appointments.stopAsksConfirmation')} className={BOTON_PELIGRO}>
                        <Square strokeWidth={2} aria-hidden="true" />
                        {isLoading ? t('appointments.stopping') : t('appointments.stopButton')}
                    </button>
                </>
            )}
        </>
    );

    const aviso = (texto: string) => (
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
                <span className="font-semibold">{t('appointments.warningLabel')}</span> {texto}
            </p>
        </div>
    );

    // El flash de una carga va en su fila de resultado; el resto (otros avisos, errores) arriba.
    const flashEnResultado = !!uploadedFile && !!flash?.success;
    const mensajeCarga = flashEnResultado && showFlashMessage ? flash!.success! : t('appointments.fileUploadedSuccess');
    const [cabezaCarga, ...restoCarga] = mensajeCarga.split(/(?<=\.)\s+/);

    return (
        <AdminLayout>
            <Head title={resolvedPageTitle} />

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

                        {initialAppointments.length > 0 && (
                            <button type="button" onClick={() => router.visit(`${routePrefix}/view`)} className={cn(BOTON_SECUNDARIO, 'self-start')}>
                                <ArrowRight strokeWidth={1.9} aria-hidden="true" />
                                {t('appointments.viewAllAppointments')}
                            </button>
                        )}
                    </header>

                    {showFlashMessage && !flashEnResultado && (flash?.success || flash?.error) && (
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

                    {/* ── Franja de cifras (sin cajas: filetes entre cifras) ── */}
                    <Deferred data={['appointments', 'totalAppointments', 'remindersStats']} fallback={<AppointmentMetricsSkeleton />}>
                        <section aria-label={t('appointments.summaryLabel')} className={FRANJA}>
                            <Cifra
                                marca={<Calendar className={cn('size-3.5 shrink-0', TEXTO_NAVY)} strokeWidth={2} aria-hidden="true" />}
                                etiqueta={t('appointments.metricTotalAppointments')}
                                valor={miles(totalAppointments, lng)}
                                detalle={`${miles(initialAppointments.length, lng)} ${t('appointments.metricRecentlyLoaded')}`}
                            />
                            <Divisor />
                            <Cifra
                                marca={<Send className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={2} aria-hidden="true" />}
                                etiqueta={t('appointments.metricSent')}
                                valor={miles(localStats.sent, lng)}
                                detalle={`${miles(dashboardStats.recentSent, lng)} ${t('appointments.metricInRecentView')}`}
                            />
                            <Divisor />
                            <Cifra
                                marca={<Clock className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" strokeWidth={2} aria-hidden="true" />}
                                etiqueta={t('appointments.metricPending', { when: rotuloObjetivo.toLocaleLowerCase(lng) })}
                                valor={miles(localStats.pending, lng)}
                                detalle={
                                    <>
                                        <span className="size-[7px] shrink-0 rounded-full bg-amber-600 dark:bg-amber-400" aria-hidden="true" />
                                        <span className="truncate font-medium text-amber-700 dark:text-amber-400">
                                            {miles(localStats.pending_tomorrow, lng)} {t('appointments.metricForTomorrow')}
                                        </span>
                                    </>
                                }
                            />
                            <Divisor />
                            <Cifra
                                marca={<CircleX className="size-3.5 shrink-0 text-red-600 dark:text-red-400" strokeWidth={2} aria-hidden="true" />}
                                etiqueta={t('appointments.metricFailed')}
                                valor={miles(localStats.failed, lng)}
                                detalle={`${miles(dashboardStats.recentCancelled, lng)} ${t('appointments.metricRecentCancelled')}`}
                            />
                        </section>
                    </Deferred>

                    {/* ── La hoja: envío, carga del Excel y últimas citas, una sección tras otra ── */}
                    <div className={HOJA}>
                        {/* ── 1. Envío de recordatorios ── */}
                        <section aria-labelledby="citas-envio">
                            <Banda
                                id="citas-envio"
                                icon={Send}
                                titulo={t('appointments.reminderControlTitle')}
                                estado={
                                    <EstadoEnvio
                                        tipo={estadoEnvio}
                                        texto={isPaused ? t('appointments.statusPaused') : isProcessing ? t('appointments.statusSending') : t('appointments.statusNoActiveProcess')}
                                    />
                                }
                                texto={t('appointments.reminderBandText')}
                                acciones={hayEnvio ? accionesEnvio : undefined}
                                className="rounded-t-2xl"
                            />

                            {/* Resultado de pausar / reanudar / detener / enviar (antes, un alert()). */}
                            <div aria-live="polite">
                                {avisoEnvio && (
                                    <div
                                        className={cn(
                                            'flex items-start gap-3 border-b px-4 py-3 @3xl/hoja:px-5',
                                            avisoEnvio.tipo === 'error'
                                                ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300'
                                                : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
                                        )}
                                    >
                                        <span className="flex w-8 shrink-0 justify-center pt-px">
                                            {avisoEnvio.tipo === 'error' ? (
                                                <CircleAlert className="size-[17px]" strokeWidth={2} aria-hidden="true" />
                                            ) : (
                                                <CircleCheck className="size-[17px]" strokeWidth={2} aria-hidden="true" />
                                            )}
                                        </span>
                                        <p className="min-w-0 flex-1 pt-px text-[13px] leading-[19px] font-medium whitespace-pre-wrap [overflow-wrap:anywhere]">{avisoEnvio.texto}</p>
                                        <button
                                            type="button"
                                            onClick={() => setAvisoEnvio(null)}
                                            aria-label={t('appointments.closeNotice')}
                                            title={t('appointments.closeNotice')}
                                            className={cn('-my-0.5 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/10', FOCO)}
                                        >
                                            <X className="size-4" aria-hidden="true" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {conProgreso && (
                                <div className={cn('border-b pt-[18px] pb-3.5', SANGRIA, FILETE)}>
                                    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                                        <div className="flex min-w-0 flex-col gap-1.5">
                                            <Rotulo
                                                titulo={isPaused ? t('appointments.progressPausedTitle') : t('appointments.sendingProgress')}
                                                apoyo={isPaused ? t('appointments.progressPausedHint') : t('appointments.progressAutoRefresh')}
                                            />
                                            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                                <span
                                                    className={cn(
                                                        'text-[30px] leading-9 font-medium tracking-[-0.03em] whitespace-nowrap tabular-nums',
                                                        isPaused ? 'text-amber-700 dark:text-amber-400' : TEXTO_NAVY
                                                    )}
                                                >
                                                    {conProgreso.percentage} %
                                                </span>
                                                <span className={cn('text-[14px] leading-5 tabular-nums', TEXTO_SUAVE)}>
                                                    <Trans
                                                        i18nKey="appointments.progressProcessedRich"
                                                        values={{ done: miles(conProgreso.sent + conProgreso.failed, lng), total: miles(conProgreso.total, lng) }}
                                                        components={{ strong: <span className={cn('font-semibold', TEXTO_NAVY)} /> }}
                                                    />
                                                </span>
                                            </div>
                                        </div>
                                        <div className={cn('flex flex-wrap items-center gap-x-[22px] gap-y-1.5 pb-1.5 text-[13px] leading-[18px] font-medium whitespace-nowrap tabular-nums', TEXTO_NAVY)}>
                                            <span className="flex items-center gap-2">
                                                <span className="size-[9px] shrink-0 rounded-[2.5px] bg-emerald-600 dark:bg-emerald-500" aria-hidden="true" />
                                                {t('appointments.progressSent')} <span className="font-semibold">{miles(conProgreso.sent, lng)}</span>
                                            </span>
                                            <span className="flex items-center gap-2">
                                                <span className="size-[9px] shrink-0 rounded-[2.5px] bg-red-600 dark:bg-red-500" aria-hidden="true" />
                                                {t('appointments.progressFailed')} <span className="font-semibold">{miles(conProgreso.failed, lng)}</span>
                                            </span>
                                            <span className="flex items-center gap-2">
                                                <span className="size-[9px] shrink-0 rounded-[2.5px] bg-[#2e3f84]/8 shadow-[inset_0_0_0_1px_rgba(46,63,132,0.32)] dark:bg-white/10 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.3)]" aria-hidden="true" />
                                                {t('appointments.progressPending')} <span className="font-semibold">{miles(conProgreso.pending, lng)}</span>
                                            </span>
                                        </div>
                                    </div>
                                    <div
                                        role="progressbar"
                                        aria-label={t('appointments.sendingProgress')}
                                        aria-valuemin={0}
                                        aria-valuemax={100}
                                        aria-valuenow={Math.min(conProgreso.percentage, 100)}
                                        className="mt-3.5 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-[#2e3f84]/8 dark:bg-white/10"
                                    >
                                        <div
                                            className="h-full bg-emerald-600 transition-[width] duration-500 ease-out dark:bg-emerald-500"
                                            style={{ width: `${Math.min((conProgreso.sent / conProgreso.total) * 100, 100)}%` }}
                                        />
                                        {conProgreso.failed > 0 && (
                                            <div
                                                className="h-full min-w-[3px] bg-red-600 transition-[width] duration-500 ease-out dark:bg-red-500"
                                                style={{ width: `${Math.min((conProgreso.failed / conProgreso.total) * 100, 100)}%` }}
                                            />
                                        )}
                                    </div>
                                </div>
                            )}

                            <Deferred data="remindersStats" fallback={<RemindersRowsSkeleton />}>
                                <>
                                    {localStats.pending > limiteAviso &&
                                        aviso(
                                            t('appointments.warningLimitDayAfter', {
                                                value: miles(localStats.pending, lng),
                                                date: textoFechaObjetivo,
                                                max: miles(limiteAviso, lng),
                                                rest: miles(localStats.pending - limiteAviso, lng),
                                            })
                                        )}
                                    {localStats.pending_tomorrow > limiteAviso &&
                                        aviso(
                                            t('appointments.warningLimitTomorrow', {
                                                value: miles(localStats.pending_tomorrow, lng),
                                                date: textoFechaManana,
                                                max: miles(limiteAviso, lng),
                                                rest: miles(localStats.pending_tomorrow - limiteAviso, lng),
                                            })
                                        )}

                                    <div className={cn('flex min-h-10 flex-wrap items-end gap-x-2.5 gap-y-0.5 pt-4 pb-2', SANGRIA)}>
                                        <h3 className={cn('text-[11px] leading-4 font-semibold tracking-[0.07em] uppercase', TEXTO_SUAVE)}>{t('appointments.toSendTitle')}</h3>
                                        <p className={cn('text-[12px] leading-4', TEXTO_SUAVE)}>{hayEnvio ? t('appointments.toSendHint') : t('appointments.toSendHintConfirm')}</p>
                                    </div>

                                    {tanda({ cuando: rotuloObjetivo, fecha: textoFechaObjetivo, n: localStats.pending, boton: botonEnviar('start', localStats.pending) })}
                                    {tanda({
                                        cuando: t('appointments.dayBeforeLabel'),
                                        fecha: textoFechaManana,
                                        n: localStats.pending_tomorrow,
                                        boton: botonEnviar('dayBefore', localStats.pending_tomorrow),
                                        final: true,
                                    })}

                                    {(hayEnvio || (localStats.pending === 0 && localStats.pending_tomorrow === 0)) && (
                                        <div className={cn('flex min-h-12 items-center gap-3 border-t px-4 py-3 @3xl/hoja:px-5', FILETE)}>
                                            <span className={cn('flex w-8 shrink-0 justify-center', TEXTO_SUAVE)}>
                                                <Info className="size-[15px]" strokeWidth={1.9} aria-hidden="true" />
                                            </span>
                                            <p className={cn('text-[12.5px] leading-4', TEXTO_SUAVE)}>{hayEnvio ? notaEnCurso : t('appointments.noPendingReminders')}</p>
                                        </div>
                                    )}
                                </>
                            </Deferred>
                        </section>

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
                                            'rounded-xl border-[1.5px] border-dashed transition-colors',
                                            isDragging
                                                ? 'border-[#2e3f84] bg-[#2e3f84]/8 dark:border-[#8b9ae0] dark:bg-white/8'
                                                : 'border-[#2e3f84]/35 bg-[#2e3f84]/[0.035] hover:border-[#2e3f84]/60 dark:border-white/25 dark:bg-white/[0.03] dark:hover:border-white/40'
                                        )}
                                    >
                                        {!data.file ? (
                                            <label
                                                htmlFor="appointment-file-upload"
                                                className="flex min-h-[136px] cursor-pointer flex-wrap items-center gap-x-[18px] gap-y-4 rounded-xl px-5 py-5 has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-[#2e3f84]/40 @3xl/hoja:flex-nowrap @3xl/hoja:px-6 dark:has-[input:focus-visible]:ring-[#8b9ae0]/60"
                                            >
                                                <input
                                                    id="appointment-file-upload"
                                                    name="appointment-file"
                                                    type="file"
                                                    className="sr-only"
                                                    accept=".xlsx,.xls,.csv"
                                                    onChange={handleFileChange}
                                                    disabled={processing}
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
                                                    <p className={cn('truncate text-[14px] leading-5 font-semibold', MONO, TEXTO_NAVY)}>{data.file.name}</p>
                                                    <p className={cn('text-[13px] leading-[18px] tabular-nums', TEXTO_SUAVE)}>{formatFileSize(data.file.size)}</p>
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
                                                    <button type="submit" disabled={processing} className={BOTON_PRIMARIO}>
                                                        <Upload strokeWidth={2} aria-hidden="true" />
                                                        {processing ? t('appointments.uploading') : t('appointments.uploadFileButton')}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {errors.file && (
                                        <p role="alert" className="mt-3 flex items-start gap-2 text-[13px] leading-[18px] font-medium text-red-700 dark:text-red-400">
                                            <CircleAlert className="mt-px size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                                            <span className="min-w-0 [overflow-wrap:anywhere]">{errors.file}</span>
                                        </p>
                                    )}
                                </div>

                                <div className="hidden w-px self-stretch bg-[#2e3f84]/8 @5xl/hoja:block dark:bg-white/8" aria-hidden="true" />

                                <div className="flex min-w-0 flex-col gap-3">
                                    <Rotulo titulo={t('appointments.excelColumnsTitle')} />
                                    <dl className="grid grid-cols-2 gap-x-[18px] gap-y-2.5 @xl/hoja:grid-cols-3">
                                        {COLUMNAS_EXCEL.map(([columna, clave]) => (
                                            <div key={columna} className="flex min-w-0 flex-col gap-px">
                                                <dt className={cn('text-[12.5px] leading-[17px] font-semibold tracking-[0.01em]', MONO, TEXTO_NAVY)}>{columna}</dt>
                                                <dd className={cn('truncate text-[12px] leading-4', TEXTO_SUAVE)}>{t(clave)}</dd>
                                            </div>
                                        ))}
                                    </dl>
                                </div>
                            </div>

                            {uploadedFile && showUploadResult && (
                                <div role="status" className={cn('flex items-center gap-3 border-b px-4 py-3 @3xl/hoja:min-h-[60px] @3xl/hoja:px-5', FILETE)}>
                                    <span className="flex w-8 shrink-0 justify-center text-emerald-600 dark:text-emerald-400">
                                        <CircleCheck className="size-[18px]" strokeWidth={2} aria-hidden="true" />
                                    </span>
                                    <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                                        <p className={cn('text-[13px] leading-[18px] font-medium tabular-nums @5xl/hoja:truncate', TEXTO_NAVY)}>
                                            <span className="font-semibold text-emerald-700 dark:text-emerald-400">{cabezaCarga}</span>
                                            {restoCarga.length > 0 && ` ${restoCarga.join(' ')}`}
                                        </p>
                                        <p className={cn('flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] leading-4 tabular-nums', TEXTO_SUAVE)}>
                                            <span className={cn('max-w-full truncate text-[12px]', MONO, TEXTO_NAVY)} title={uploadedFile.name}>
                                                {uploadedFile.name}
                                            </span>
                                            <span aria-hidden="true">·</span>
                                            <span>{formatFileSize(uploadedFile.size)}</span>
                                            <span aria-hidden="true">·</span>
                                            <span>
                                                {uploadedFile.total_rows || initialAppointments.length} {t('appointments.appointmentsSuffix')}
                                            </span>
                                            <span aria-hidden="true">·</span>
                                            <span>{new Date(uploadedFile.uploaded_at).toLocaleString('es-CO')}</span>
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowUploadResult(false);
                                            if (flashEnResultado) setShowFlashMessage(false);
                                        }}
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
                                                placeholder={t('appointments.searchPlaceholder')}
                                                value={searchTerm}
                                                onChange={handleSearch}
                                                className="w-full @3xl/hoja:w-[300px]"
                                            />
                                        )
                                    }
                                    accionesClassName="w-full @3xl/hoja:w-auto"
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

                                        {paginatedAppointments.length > 0 ? (
                                            <ul aria-label={t('appointments.latestTitle')}>
                                                {paginatedAppointments.map((appointment, index) => (
                                                    <FilaCita key={appointment.id} cita={appointment} indice={(currentPage - 1) * itemsPerPage + index + 1} />
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className={cn('border-b px-4 py-10 text-center text-[13px] leading-[18px]', FILETE, TEXTO_SUAVE)}>{t('appointments.noSearchResults')}</p>
                                        )}

                                        <div className={cn('flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 rounded-b-2xl py-3 @3xl/hoja:min-h-[52px]', SANGRIA)}>
                                            <p className={cn('text-[12.5px] leading-4 tabular-nums', TEXTO_SUAVE)} aria-live="polite">
                                                <Trans
                                                    i18nKey="appointments.showingLastAppointmentsRich"
                                                    values={{ shown: initialAppointments.length, filtered: filteredAppointments.length }}
                                                    components={{ strong: <span className={cn('font-semibold', TEXTO_NAVY)} /> }}
                                                />
                                            </p>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                                {/* Paginación (en cliente, 50 por página) */}
                                                {totalPages > 1 && (
                                                    <div className="flex items-center gap-2">
                                                        <span className={cn('text-[12.5px] leading-4 tabular-nums', TEXTO_SUAVE)}>
                                                            {t('appointments.pageOf', { current: currentPage, total: totalPages })}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                                            disabled={currentPage === 1}
                                                            aria-label={t('common.previous')}
                                                            className={cn(BOTON_SECUNDARIO, 'size-8 px-0 pr-0 pl-0')}
                                                        >
                                                            <ChevronLeft aria-hidden="true" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                                            disabled={currentPage === totalPages}
                                                            aria-label={t('common.next')}
                                                            className={cn(BOTON_SECUNDARIO, 'size-8 px-0 pr-0 pl-0')}
                                                        >
                                                            <ChevronRight aria-hidden="true" />
                                                        </button>
                                                    </div>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => router.visit(`${routePrefix}/view`)}
                                                    className={cn(
                                                        'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-[13px] leading-[18px] font-semibold transition-colors hover:bg-[#2e3f84]/6 dark:hover:bg-white/8',
                                                        TEXTO_NAVY,
                                                        FOCO
                                                    )}
                                                >
                                                    {t('appointments.viewAllAppointments')}
                                                    <ArrowRight className="size-[15px]" strokeWidth={2} aria-hidden="true" />
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </section>
                        </Deferred>
                    </div>
                </div>
            </div>

            {/* ── Confirmación antes de enviar (nueva): la misma llamada de siempre solo tras "Sí, enviar" ── */}
            <Confirmacion
                abierto={confirmarEnvio !== null}
                onCancelar={() => setConfirmarEnvio(null)}
                onConfirmar={aceptarEnvio}
                icono={Send}
                titulo={t('appointments.confirmSendTitle', { count: salenAhora, value: miles(salenAhora, lng) })}
                textoSeguro={t('common.cancel')}
                iconoSeguro={X}
                textoConfirmar={t('appointments.confirmSendYes', { value: miles(salenAhora, lng) })}
            >
                <p>{t('appointments.confirmSendText', { date: confirmarEnvio === 'dayBefore' ? textoFechaManana : textoFechaObjetivo })}</p>
                {quedanOtraTanda > 0 && maxPorEnvio !== undefined && (
                    <p>
                        <Trans
                            i18nKey="appointments.confirmSendRemaining"
                            values={{ max: miles(maxPorEnvio, lng), rest: miles(quedanOtraTanda, lng), total: miles(pendientesConfirmar, lng) }}
                            components={{ strong: <span className={cn('font-semibold', TEXTO_NAVY)} /> }}
                        />
                    </p>
                )}
            </Confirmacion>

            {/* ── Confirmación de detener (antes, window.confirm) ── */}
            <Confirmacion
                abierto={confirmarDetener}
                onCancelar={() => setConfirmarDetener(false)}
                onConfirmar={aceptarDetener}
                icono={Square}
                peligro
                titulo={t('appointments.confirmStopTitle')}
                textoSeguro={t('appointments.confirmStopKeep')}
                iconoSeguro={Play}
                textoConfirmar={t('appointments.confirmStopYes')}
            >
                <p>
                    {progress && progress.total > 0 ? (
                        <Trans
                            i18nKey="appointments.confirmStopPending"
                            values={{ pending: miles(progress.pending, lng), done: miles(progress.sent + progress.failed, lng) }}
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
