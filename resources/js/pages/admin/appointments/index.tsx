import AdminLayout from '@/layouts/admin-layout';
import { AppointmentsScopeSwitch } from '@/components/appointments-scope-switch';
import { Deferred, Head, useForm, router, usePage } from '@inertiajs/react';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X, Search, ChevronLeft, ChevronRight, Send, Clock, XCircle, Play, Pause, RefreshCw, Square, ExternalLink, CalendarCheck, CalendarX, Phone, type LucideIcon } from 'lucide-react';
import { FormEventHandler, useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from 'react-i18next';
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

interface MetricCardProps {
    icon: LucideIcon;
    label: string;
    value: string | number;
    detail: string;
    tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
}

const toneClasses: Record<NonNullable<MetricCardProps['tone']>, string> = {
    primary: 'border-[#d4d8e8] bg-[#2e3f84]/10 text-[#2e3f84] dark:border-white/10 dark:bg-white/[0.05] dark:text-neutral-100',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
    warning: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300',
    danger: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300',
    info: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300',
};

function MetricCard({ icon: Icon, label, value, detail, tone = 'primary' }: MetricCardProps) {
    return (
        <div className="card-gradient rounded-2xl p-4 shadow-sm shadow-[#2e3f84]/5">
            <div className="flex items-center gap-3">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${toneClasses[tone]}`}>
                    <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold settings-subtitle">{label}</p>
                    <p className="mt-1 truncate text-lg font-bold leading-tight settings-title">{value}</p>
                    <p className="mt-0.5 truncate text-xs settings-subtitle">{detail}</p>
                </div>
            </div>
        </div>
    );
}

export default function AppointmentsIndex({ appointments: initialAppointments = [], totalAppointments = 0, remindersStats, uploadedFile, reminderPaused = false, reminderProcessing = false, reminderProgress: initialProgress = null, routePrefix = '/admin/appointments', pageTitle }: AppointmentIndexProps) {
    const { t } = useTranslation();
    const resolvedPageTitle = pageTitle ?? t('appointments.pageTitle');
    const { flash } = usePage<{ flash: { success?: string; error?: string } }>().props;
    const [showFlashMessage, setShowFlashMessage] = useState(true);
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

                alert(errorMessage);
                // Limpiar estado si hay error
                setIsProcessing(false);
                setProgress(null);
            }
        } catch (error) {
            console.error('Error:', error);
            alert(t('appointments.errorStartRemindersSending'));
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
                alert(data.message || t('appointments.errorPause'));
            }
        } catch (error) {
            console.error('Error:', error);
            alert(t('appointments.errorPauseReminders'));
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
                alert(data.message || t('appointments.errorResume'));
            }
        } catch (error) {
            console.error('Error:', error);
            alert(t('appointments.errorResumeReminders'));
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
                alert(data.message || t('appointments.errorStartTomorrow'));
            }
        } catch (error) {
            console.error('Error:', error);
            alert(t('appointments.errorStartRemindersTomorrow'));
            setIsProcessing(false);
            setProgress(null);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStopReminders = async () => {
        if (!confirm(t('appointments.confirmStopReminders'))) {
            return;
        }

        setIsLoading(true);
        try {
            const data = await postReminder(`${routePrefix}/reminders/stop`);

            if (data.success) {
                setIsProcessing(false);
                setIsPaused(false);
                router.reload({ only: ['remindersStats', 'reminderProcessing', 'reminderPaused'] });
                alert(t('appointments.stopSuccess'));
            } else {
                alert(data.message || t('appointments.errorStop'));
            }
        } catch (error) {
            console.error('Error:', error);
            alert(t('appointments.errorStopReminders'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AdminLayout>
            <Head title={resolvedPageTitle} />

            <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
                <div className="mx-auto flex max-w-7xl flex-col gap-5">
                    <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start gap-3">
                            <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-[#2e3f84] shadow-sm shadow-[#2e3f84]/5 dark:bg-white/[0.04] dark:text-neutral-100">
                                <CalendarCheck className="h-5 w-5" />
                            </div>
                            <div>
                                <h1 className="font-bold settings-title" style={{ fontSize: 'var(--text-3xl)' }}>
                                    {resolvedPageTitle}
                                </h1>
                                <p className="settings-subtitle" style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-xs)' }}>
                                    {t('appointments.headerSubtitle')}
                                </p>
                            </div>
                        </div>

                        {initialAppointments.length > 0 && (
                            <Button onClick={() => router.visit(`${routePrefix}/view`)} className="h-9 rounded-xl px-5 text-xs font-semibold settings-btn-primary">
                                <ExternalLink className="mr-2 h-3.5 w-3.5" />
                                {t('appointments.viewAllAppointments')}
                            </Button>
                        )}
                    </header>

                    {/* El submenú de Citas salió del riel: la sección navega dentro de sí misma. */}
                    <AppointmentsScopeSwitch />

                    {showFlashMessage && (flash?.success || flash?.error) && (
                        <div
                            className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-sm ${flash?.success
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
                                : 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300'
                                }`}
                        >
                            {flash?.success ? (
                                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                            ) : (
                                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                            )}
                            <div className="flex-1">
                                <p>{flash?.success || flash?.error}</p>
                            </div>
                            <button
                                onClick={() => setShowFlashMessage(false)}
                                className="rounded-md p-1 transition-colors hover:bg-black/5"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    )}

                    <Deferred data={['appointments', 'totalAppointments', 'remindersStats']} fallback={<AppointmentMetricsSkeleton />}>
                        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <MetricCard icon={CalendarCheck} label={t('appointments.metricTotalAppointments')} value={totalAppointments.toLocaleString()} detail={`${initialAppointments.length.toLocaleString()} ${t('appointments.metricRecentlyLoaded')}`} />
                            <MetricCard icon={Send} label={t('appointments.metricSent')} value={localStats.sent.toLocaleString()} detail={`${dashboardStats.recentSent} ${t('appointments.metricInRecentView')}`} tone="success" />
                            <MetricCard icon={Clock} label={t('appointments.metricPending')} value={localStats.pending.toLocaleString()} detail={`${localStats.pending_tomorrow.toLocaleString()} ${t('appointments.metricForTomorrow')}`} tone="warning" />
                            <MetricCard icon={XCircle} label={t('appointments.metricFailed')} value={localStats.failed.toLocaleString()} detail={`${dashboardStats.recentCancelled} ${t('appointments.metricRecentCancelled')}`} tone="danger" />
                        </section>
                    </Deferred>

                    <section className="card-gradient rounded-2xl p-5 shadow-sm shadow-[#2e3f84]/5"
                    >
                        <form onSubmit={submit}>
                            <div className="mb-4">
                                <h2 className="mb-1 flex items-center gap-2 text-base font-semibold settings-title">
                                    <FileSpreadsheet className="h-4 w-4" />
                                    {t('appointments.uploadFileTitle')}
                                </h2>
                                <p className="mb-4 text-sm settings-subtitle">{t('appointments.uploadFileSubtitle')}</p>

                                <div
                                    onDrop={handleDrop}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    className={`
                                    cursor-pointer rounded-xl border border-dashed p-6 text-center
                                    upload-dropzone
                                    ${isDragging ? 'border-primary upload-dropzone-active' : 'border-[#d4d8e8] dark:border-[hsl(30,5%,25%)]'}
                                    hover:border-primary hover:upload-dropzone-active
                                    transition-all duration-200
                                `}
                                >
                                    {!data.file ? (
                                        <label htmlFor="appointment-file-upload" className="cursor-pointer block">
                                            <input
                                                id="appointment-file-upload"
                                                name="appointment-file"
                                                type="file"
                                                className="hidden"
                                                accept=".xlsx,.xls,.csv"
                                                onChange={handleFileChange}
                                                disabled={processing}
                                            />
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#2e3f84] text-white shadow-sm shadow-[#2e3f84]/20">
                                                    <Upload className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <p className="mb-1 text-sm font-semibold settings-title">
                                                        {t('appointments.dropzoneTitle')}
                                                    </p>
                                                    <p className="text-sm settings-subtitle">
                                                        {t('appointments.dropzoneOr')} <span className="settings-title font-semibold">{t('appointments.dropzoneClickToSelect')}</span>
                                                    </p>
                                                    <p className="text-xs settings-subtitle mt-2">
                                                        {t('appointments.dropzoneSupportedFormats')}
                                                    </p>
                                                </div>
                                            </div>
                                        </label>
                                    ) : (
                                        <div className="flex items-center justify-between rounded-xl bg-white/55 p-3 shadow-sm dark:bg-white/[0.03]">
                                            <div className="flex items-center gap-4">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2e3f84]/10 text-[#2e3f84] dark:bg-white/[0.05] dark:text-neutral-100">
                                                    <FileSpreadsheet className="h-5 w-5" />
                                                </div>
                                                <div className="text-left">
                                                    <p className="font-semibold settings-title">{data.file.name}</p>
                                                    <p className="text-sm settings-subtitle">
                                                        {formatFileSize(data.file.size)}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={removeFile}
                                                className="rounded-xl p-2 text-red-500 transition-all duration-200 hover:bg-red-50 dark:hover:bg-red-500/10"
                                                disabled={processing}
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {errors.file && (
                                    <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                                        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                                        <p className="text-sm text-red-600 dark:text-red-400">{errors.file}</p>
                                    </div>
                                )}
                            </div>

                            {data.file && (
                                <div className="flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={processing}
                                        className="h-9 rounded-xl px-5 text-sm font-semibold settings-btn-primary disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {processing ? t('appointments.uploading') : t('appointments.uploadFileButton')}
                                    </button>
                                </div>
                            )}
                        </form>
                    </section>

                    {uploadedFile && (
                        <section className="card-gradient rounded-2xl p-4 shadow-sm shadow-[#2e3f84]/5"
                        >
                            <div className="flex items-start gap-4">
                                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                                    <CheckCircle2 className="h-5 w-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className="mb-2 font-semibold settings-title">
                                        {t('appointments.fileUploadedSuccess')}
                                    </h3>
                                    <div className="grid gap-2 text-sm settings-subtitle sm:grid-cols-2 lg:grid-cols-4">
                                        <p><span className="font-semibold settings-title">{t('appointments.fileNameLabel')}</span> {uploadedFile.name}</p>
                                        <p><span className="font-semibold settings-title">{t('appointments.fileSizeLabel')}</span> {formatFileSize(uploadedFile.size)}</p>
                                        <p><span className="font-semibold settings-title">{t('appointments.fileRecordsLabel')}</span> {uploadedFile.total_rows || initialAppointments.length} {t('appointments.appointmentsSuffix')}</p>
                                        <p><span className="font-semibold settings-title">{t('appointments.fileDateLabel')}</span> {new Date(uploadedFile.uploaded_at).toLocaleString('es-CO')}</p>
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}

                    {(remindersStats || localStats) && (
                        <section className="card-gradient rounded-2xl p-5 shadow-sm shadow-[#2e3f84]/5">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="min-w-0 flex-1">
                                    <h2 className="mb-1 flex items-center gap-2 text-base font-semibold settings-title">
                                        <Send className="h-4 w-4" />
                                        {t('appointments.reminderControlTitle')}
                                    </h2>
                                    <div className="flex flex-wrap gap-2 text-xs">
                                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-semibold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                                            <Clock className="h-3.5 w-3.5" />
                                            {localStats.pending.toLocaleString()} {t('appointments.forDayAfterTomorrow')}
                                        </span>
                                        <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 font-semibold text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300">
                                            <CalendarCheck className="h-3.5 w-3.5" />
                                            {localStats.pending_tomorrow.toLocaleString()} {t('appointments.forTomorrow')}
                                        </span>
                                        <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 font-semibold ${isPaused ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300' : (isProcessing ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300' : 'border-[#d4d8e8] bg-white/60 text-[#6b7494] dark:border-white/10 dark:bg-white/[0.03] dark:text-neutral-300')}`}>
                                            {isPaused ? <Pause className="h-3.5 w-3.5" /> : (isProcessing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />)}
                                            {isPaused ? t('appointments.statusPaused') : (isProcessing ? t('appointments.statusSending') : t('appointments.statusNoActiveProcess'))}
                                        </span>
                                    </div>

                                    {localStats.pending === 0 && localStats.pending_tomorrow === 0 && (
                                        <p className="mt-3 text-sm settings-subtitle">{t('appointments.noPendingReminders')}</p>
                                    )}
                                </div>

                                <div className="flex flex-wrap gap-2 lg:justify-end">
                                    {!isProcessing && !isPaused && localStats.pending > 0 && (
                                        <Button onClick={handleStartReminders} disabled={isLoading || isProcessing} className="h-9 rounded-xl px-4 text-xs font-semibold settings-btn-primary disabled:cursor-not-allowed disabled:opacity-50">
                                            <Play className="mr-2 h-3.5 w-3.5" />
                                            {isLoading || isProcessing ? t('appointments.starting') : t('appointments.startButton', { count: localStats.pending })}
                                        </Button>
                                    )}
                                    {!isProcessing && !isPaused && localStats.pending_tomorrow > 0 && (
                                        <Button onClick={handleStartRemindersDayBefore} disabled={isLoading || isProcessing} className="h-9 rounded-xl px-4 text-xs font-semibold settings-btn-primary disabled:cursor-not-allowed disabled:opacity-50">
                                            <CalendarCheck className="mr-2 h-3.5 w-3.5" />
                                            {t('appointments.sendDayBefore', { count: localStats.pending_tomorrow })}
                                        </Button>
                                    )}
                                    {isProcessing && !isPaused && (
                                        <>
                                            <Button onClick={handlePauseReminders} disabled={isLoading} className="h-9 rounded-xl px-4 text-xs font-semibold settings-btn-primary disabled:cursor-not-allowed disabled:opacity-50">
                                                <Pause className="mr-2 h-3.5 w-3.5" />
                                                {isLoading ? t('appointments.pausing') : t('appointments.pauseButton')}
                                            </Button>
                                            <Button onClick={handleStopReminders} disabled={isLoading} className="h-9 rounded-xl bg-red-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
                                                <Square className="mr-2 h-3.5 w-3.5" />
                                                {isLoading ? t('appointments.stopping') : t('appointments.stopButton')}
                                            </Button>
                                        </>
                                    )}
                                    {isPaused && (
                                        <>
                                            <Button onClick={handleResumeReminders} disabled={isLoading} className="h-9 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
                                                <Play className="mr-2 h-3.5 w-3.5" />
                                                {isLoading ? t('appointments.resuming') : t('appointments.resumeButton')}
                                            </Button>
                                            <Button onClick={handleStopReminders} disabled={isLoading} className="h-9 rounded-xl bg-red-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
                                                <Square className="mr-2 h-3.5 w-3.5" />
                                                {isLoading ? t('appointments.stopping') : t('appointments.stopButton')}
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {isProcessing && progress && progress.total > 0 && (
                                <div className="mt-4 rounded-xl bg-white/55 p-4 dark:bg-white/[0.03]">
                                    <div className="mb-2 flex items-center justify-between gap-3 text-xs settings-subtitle">
                                        <span>{t('appointments.sendingProgress')}</span>
                                        <span className="font-semibold settings-title">
                                            {progress.percentage}% ({progress.sent + progress.failed} / {progress.total})
                                        </span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-[#e5e7f0] dark:bg-white/10">
                                        <div className="h-full rounded-full bg-emerald-500 transition-all duration-500 ease-out" style={{ width: `${Math.min(progress.percentage, 100)}%` }} />
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-3 text-xs font-medium">
                                        <span className="text-emerald-600 dark:text-emerald-300">{t('appointments.progressSent')} {progress.sent}</span>
                                        {progress.failed > 0 && <span className="text-red-600 dark:text-red-300">{t('appointments.progressFailed')} {progress.failed}</span>}
                                        <span className="settings-subtitle">{t('appointments.progressPending')} {progress.pending}</span>
                                    </div>
                                </div>
                            )}

                            {localStats.pending > 2000 && (
                                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                                    <AlertCircle className="mr-1 inline h-4 w-4" />
                                    <strong>{t('appointments.warningLabel')}</strong> {t('appointments.warningLimitDayAfter', { count: localStats.pending })}
                                </div>
                            )}
                            {localStats.pending_tomorrow > 2000 && (
                                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                                    <AlertCircle className="mr-1 inline h-4 w-4" />
                                    <strong>{t('appointments.warningLabel')}</strong> {t('appointments.warningLimitTomorrow', { count: localStats.pending_tomorrow })}
                                </div>
                            )}
                        </section>
                    )}

                    <Deferred data="appointments" fallback={<AppointmentsTableSkeleton />}>
                    {initialAppointments.length > 0 && (
                        <section className="card-gradient rounded-2xl p-5 shadow-sm shadow-[#2e3f84]/5">
                            <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div>
                                    <h2 className="text-base font-semibold settings-title">
                                        {t('appointments.appointmentsInDatabase', { count: totalAppointments })}
                                    </h2>
                                    <p className="text-sm settings-subtitle">
                                        {t('appointments.showingLastAppointments', { shown: initialAppointments.length, filtered: filteredAppointments.length })}
                                    </p>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="relative w-full md:w-80">
                                        <label htmlFor="appointment-search" className="sr-only">{t('appointments.searchAppointmentsLabel')}</label>
                                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 settings-subtitle" />
                                        <input
                                            id="appointment-search"
                                            name="appointment-search"
                                            type="text"
                                            placeholder={t('appointments.searchPlaceholder')}
                                            value={searchTerm}
                                            onChange={(e) => handleSearch(e.target.value)}
                                            className="h-9 w-full rounded-xl pl-10 pr-4 text-sm settings-input outline-none transition-all duration-200 focus:ring-2 focus:ring-primary/10"
                                        />
                                    </div>

                                    <Button
                                        onClick={() => router.visit(`${routePrefix}/view`)}
                                        className="h-9 shrink-0 rounded-xl px-4 text-xs font-semibold settings-btn-secondary"
                                    >
                                        <ExternalLink className="mr-2 h-3.5 w-3.5" />
                                        {t('appointments.viewAllAppointments')}
                                    </Button>
                                </div>
                            </div>

                            <div className="overflow-x-auto rounded-xl">
                                <table className="w-full text-left border-collapse">
                                    <thead className="border-b border-border bg-black/5 dark:border-white/10 dark:bg-white/5">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold settings-title whitespace-nowrap" style={{ fontSize: 'var(--text-sm)' }}>
                                                #
                                            </th>
                                            <th className="px-4 py-3 font-semibold settings-title whitespace-nowrap" style={{ fontSize: 'var(--text-sm)' }}>
                                                {t('appointments.columnPatient')}
                                            </th>
                                            <th className="px-4 py-3 font-semibold settings-title whitespace-nowrap" style={{ fontSize: 'var(--text-sm)' }}>
                                                {t('appointments.columnAppointmentDetails')}
                                            </th>
                                            <th className="px-4 py-3 font-semibold settings-title whitespace-nowrap" style={{ fontSize: 'var(--text-sm)' }}>
                                                {t('appointments.columnProfessional')}
                                            </th>
                                            <th className="px-4 py-3 font-semibold settings-title whitespace-nowrap" style={{ fontSize: 'var(--text-sm)' }}>
                                                {t('appointments.columnSendingStatus')}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border dark:divide-white/10">
                                        {paginatedAppointments.map((appointment, index) => (
                                            <tr
                                                key={appointment.id}
                                                className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-200"
                                            >
                                                {/* Índice */}
                                                <td className="px-4 py-4 whitespace-nowrap align-top settings-subtitle font-medium" style={{ fontSize: 'var(--text-sm)' }}>
                                                    {(currentPage - 1) * itemsPerPage + index + 1}
                                                </td>

                                                {/* Paciente y Teléfono */}
                                                <td className="px-4 py-4 align-top w-[25%] min-w-[200px]">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold settings-title truncate" style={{ fontSize: 'var(--text-md)' }}>
                                                            {appointment.nom_paciente || '-'}
                                                        </span>
                                                        <span className="settings-subtitle flex items-center gap-1.5 mt-1" style={{ fontSize: 'var(--text-sm)' }}>
                                                            {appointment.pactel ? (
                                                                <>
                                                                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                                        <Phone className="w-3 h-3 text-primary" />
                                                                    </div>
                                                                    {appointment.pactel}
                                                                </>
                                                            ) : '-'}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Fecha y Hora */}
                                                <td className="px-4 py-4 whitespace-nowrap align-top">
                                                    <div className="flex flex-col gap-1.5">
                                                        <div className="inline-flex w-fit items-center gap-1.5 rounded-md bg-black/5 px-2.5 py-1 font-medium settings-title dark:bg-white/5" style={{ fontSize: 'var(--text-sm)' }}>
                                                            <CalendarCheck className="w-4 h-4 text-primary" />
                                                            {appointment.citfc || '-'}
                                                        </div>
                                                        <div className="inline-flex items-center gap-1.5 settings-subtitle pl-1" style={{ fontSize: 'var(--text-sm)' }}>
                                                            <Clock className="w-3.5 h-3.5" />
                                                            {appointment.cithor || '-'}
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Médico y Especialidad */}
                                                <td className="px-4 py-4 align-top w-[30%] min-w-[220px]">
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold settings-title line-clamp-2 leading-tight" style={{ fontSize: 'var(--text-sm)' }}>
                                                            {t('appointments.doctorPrefix')} {appointment.mednom || '-'}
                                                        </span>
                                                        <span className="settings-subtitle mt-1 inline-flex items-center gap-1.5" style={{ fontSize: 'var(--text-xs)' }}>
                                                            <div className="w-1.5 h-1.5 rounded-full bg-primary/40 flex-shrink-0" />
                                                            {appointment.espnom || '-'}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Estado Integrado */}
                                                <td className="px-4 py-4 whitespace-nowrap align-top">
                                                    <div className="flex flex-col gap-2">
                                                        {appointment.reminder_sent ? (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold w-fit">
                                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                                {t('appointments.badgeSent')}
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-semibold w-fit">
                                                                <Clock className="w-3.5 h-3.5" />
                                                                {t('appointments.badgePending')}
                                                            </span>
                                                        )}

                                                        {appointment.reminder_sent && (
                                                            <>
                                                                {appointment.reminder_status === 'confirmed' ? (
                                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold w-fit">
                                                                        <CalendarCheck className="w-3.5 h-3.5" /> {t('appointments.badgeConfirmed')}
                                                                    </span>
                                                                ) : appointment.reminder_status === 'cancelled' ? (
                                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-semibold w-fit">
                                                                        <CalendarX className="w-3.5 h-3.5" /> {t('appointments.badgeCancelled')}
                                                                    </span>
                                                                ) : appointment.reminder_status === 'failed' ? (
                                                                    <span className="inline-flex items-center gap-1 text-red-500 font-medium ml-1" style={{ fontSize: 'var(--text-xs)' }}>
                                                                        <XCircle className="w-3 h-3" /> {t('appointments.badgeError')}
                                                                    </span>
                                                                ) : appointment.reminder_status && ['delivered', 'read'].includes(appointment.reminder_status) ? (
                                                                    <span className="inline-flex items-center gap-1 text-emerald-500 font-medium ml-1" style={{ fontSize: 'var(--text-xs)' }}>
                                                                        <CheckCircle2 className="w-3 h-3" /> {t('appointments.badgeReceived')}
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1 text-blue-500 font-medium ml-1" style={{ fontSize: 'var(--text-xs)' }}>
                                                                        <Clock className="w-3 h-3" /> {t('appointments.badgeNoResponse')}
                                                                    </span>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Paginación */}
                            {totalPages > 1 && (
                                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-sm settings-subtitle">
                                        {t('appointments.pageOf', { current: currentPage, total: totalPages })}
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                            disabled={currentPage === 1}
                                            className="flex h-9 items-center gap-2 rounded-xl px-3 text-sm settings-title transition-all duration-200 hover:bg-[#f8f9fc] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/5"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                            {t('common.previous')}
                                        </button>
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                            disabled={currentPage === totalPages}
                                            className="flex h-9 items-center gap-2 rounded-xl px-3 text-sm settings-title transition-all duration-200 hover:bg-[#f8f9fc] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/5"
                                        >
                                            {t('common.next')}
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </section>
                    )}

                    {initialAppointments.length === 0 && (
                        <section className="card-gradient rounded-2xl p-5 shadow-sm shadow-[#2e3f84]/5"
                        >
                            <h3 className="mb-4 font-semibold settings-title">
                                {t('appointments.excelFormatTitle')}
                            </h3>
                            <div className="space-y-3 text-sm settings-subtitle">
                                <p className="settings-title font-medium">{t('appointments.excelFormatInstruction')}</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
                                    <div className="rounded-xl bg-white/55 p-2 text-xs settings-subtitle dark:bg-white/[0.03]">
                                        <strong className="settings-title">Citead</strong> - {t('appointments.columnDescCitead')}
                                    </div>
                                    <div className="rounded-xl bg-white/55 p-2 text-xs settings-subtitle dark:bg-white/[0.03]">
                                        <strong className="settings-title">Nom_paciente</strong> - {t('appointments.columnDescPatientName')}
                                    </div>
                                    <div className="rounded-xl bg-white/55 p-2 text-xs settings-subtitle dark:bg-white/[0.03]">
                                        <strong className="settings-title">Pactel</strong> - {t('appointments.columnDescPhone')}
                                    </div>
                                    <div className="rounded-xl bg-white/55 p-2 text-xs settings-subtitle dark:bg-white/[0.03]">
                                        <strong className="settings-title">Citfc</strong> - {t('appointments.columnDescDate')}
                                    </div>
                                    <div className="rounded-xl bg-white/55 p-2 text-xs settings-subtitle dark:bg-white/[0.03]">
                                        <strong className="settings-title">Cithor</strong> - {t('appointments.columnDescTime')}
                                    </div>
                                    <div className="rounded-xl bg-white/55 p-2 text-xs settings-subtitle dark:bg-white/[0.03]">
                                        <strong className="settings-title">Mednom</strong> - {t('appointments.columnDescDoctorName')}
                                    </div>
                                    <div className="rounded-xl bg-white/55 p-2 text-xs settings-subtitle dark:bg-white/[0.03]">
                                        <strong className="settings-title">Espnom</strong> - {t('appointments.columnDescSpecialty')}
                                    </div>
                                    <div className="rounded-xl bg-white/55 p-2 text-xs settings-subtitle dark:bg-white/[0.03]">
                                        <strong className="settings-title">Citdoc</strong> - {t('appointments.columnDescDocument')}
                                    </div>
                                    <div className="rounded-xl bg-white/55 p-2 text-xs settings-subtitle dark:bg-white/[0.03]">
                                        <strong className="settings-title">Citobsobs</strong> - {t('appointments.columnDescObservations')}
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}
                    </Deferred>
                </div>
            </div>
        </AdminLayout>
    );
}

// Skeletons que imitan el layout real mientras Inertia trae las props diferidas
// (appointments, totalAppointments, remindersStats) en la segunda petición.
function AppointmentMetricsSkeleton() {
    return (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[88px] rounded-2xl" />
            ))}
        </section>
    );
}

function AppointmentsTableSkeleton() {
    return (
        <section className="card-gradient rounded-2xl p-5 shadow-sm shadow-[#2e3f84]/5">
            <div className="mb-4 flex flex-col gap-2">
                <Skeleton className="h-5 w-64" />
                <Skeleton className="h-4 w-48" />
            </div>
            <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-xl" />
                ))}
            </div>
        </section>
    );
}
