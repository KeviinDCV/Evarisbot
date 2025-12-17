import AdminLayout from '@/layouts/admin-layout';
import { Head, useForm, router, usePage } from '@inertiajs/react';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X, Search, ChevronLeft, ChevronRight, Send, Clock, XCircle, Play, Pause, RefreshCw, Square, ExternalLink, CalendarCheck, CalendarX } from 'lucide-react';
import { FormEventHandler, useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';

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
    appointments: Appointment[];
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
}

export default function AppointmentsIndex({ appointments: initialAppointments, totalAppointments = 0, remindersStats, uploadedFile, reminderPaused = false, reminderProcessing = false, reminderProgress: initialProgress = null }: AppointmentIndexProps) {
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
        let intervalId: NodeJS.Timeout | null = null;

        // Primera actualización inmediata
        const updateStatus = async () => {
            if (shouldStop) return;

            try {
                const response = await fetch('/admin/appointments/reminders/status?' + new Date().getTime(), {
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

                // Actualizar estadísticas cada 3 segundos (cada 6 consultas con 500ms) para no sobrecargar
                updateCount++;
                if (updateCount % 6 === 0 && data.pending_count !== undefined) {
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

        // Luego actualizar cada 500ms (más espaciado para reducir carga)
        intervalId = setInterval(() => {
            if (!shouldStop) {
                updateStatus();
            } else if (intervalId) {
                clearInterval(intervalId);
            }
        }, 500);

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
        post('/admin/appointments/upload', {
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
            const response = await fetch('/admin/appointments/reminders/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
            });

            const data = await response.json();

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
                let errorMessage = data.message || 'Error al iniciar el envío';

                if (data.debug) {
                    errorMessage += '\n\nInformación de depuración:';
                    errorMessage += `\n- Fecha objetivo: ${data.debug.target_date}`;
                    errorMessage += `\n- Fecha actual: ${data.debug.current_date}`;
                    errorMessage += `\n- Días de anticipación: ${data.debug.days_in_advance}`;
                    errorMessage += `\n- Total citas pendientes: ${data.debug.total_pending_appointments}`;

                    if (data.debug.exact_date_count !== undefined) {
                        errorMessage += `\n- Citas para fecha objetivo (${data.debug.target_date}): ${data.debug.exact_date_count}`;
                    }

                    if (data.debug.tomorrow_count !== undefined) {
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        errorMessage += `\n- Citas para mañana (${tomorrow.toISOString().split('T')[0]}): ${data.debug.tomorrow_count}`;
                    }

                    if (data.debug.day_after_tomorrow_count !== undefined) {
                        const dayAfter = new Date();
                        dayAfter.setDate(dayAfter.getDate() + 2);
                        errorMessage += `\n- Citas para pasado mañana (${dayAfter.toISOString().split('T')[0]}): ${data.debug.day_after_tomorrow_count}`;
                    }

                    if (data.debug.dates_with_count && data.debug.dates_with_count.length > 0) {
                        errorMessage += '\n\nFechas con citas pendientes:';
                        data.debug.dates_with_count.slice(0, 10).forEach((item: { date: string; count: number }) => {
                            errorMessage += `\n  - ${item.date}: ${item.count} citas`;
                        });
                        if (data.debug.dates_with_count.length > 10) {
                            errorMessage += `\n  ... y ${data.debug.dates_with_count.length - 10} fechas más`;
                        }
                    } else if (data.debug.available_dates && data.debug.available_dates.length > 0) {
                        errorMessage += `\n- Fechas disponibles: ${data.debug.available_dates.slice(0, 5).join(', ')}`;
                        if (data.debug.available_dates.length > 5) {
                            errorMessage += ` y ${data.debug.available_dates.length - 5} más`;
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
            alert('Error al iniciar el envío de recordatorios');
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
            const response = await fetch('/admin/appointments/reminders/pause', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
            });

            const data = await response.json();

            if (data.success) {
                setIsPaused(true);
                router.reload({ only: ['reminderPaused'] });
            } else {
                alert(data.message || 'Error al pausar');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error al pausar el envío de recordatorios');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResumeReminders = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/admin/appointments/reminders/resume', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
            });

            const data = await response.json();

            if (data.success) {
                setIsPaused(false);
                router.reload({ only: ['reminderPaused'] });
            } else {
                alert(data.message || 'Error al reanudar');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error al reanudar el envío de recordatorios');
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
            const response = await fetch('/admin/appointments/reminders/start-day-before', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
            });

            const data = await response.json();

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
                alert(data.message || 'Error al iniciar el envío para mañana');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error al iniciar el envío de recordatorios para mañana');
            setIsProcessing(false);
            setProgress(null);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStopReminders = async () => {
        if (!confirm('¿Estás seguro de que deseas detener completamente el envío de recordatorios? Esto cancelará todos los trabajos pendientes.')) {
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch('/admin/appointments/reminders/stop', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
            });

            const data = await response.json();

            if (data.success) {
                setIsProcessing(false);
                setIsPaused(false);
                router.reload({ only: ['remindersStats', 'reminderProcessing', 'reminderPaused'] });
                alert('El envío de recordatorios ha sido detenido completamente');
            } else {
                alert(data.message || 'Error al detener');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error al detener el envío de recordatorios');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AdminLayout>
            <Head title="Citas" />

            <div className="min-h-screen bg-[#f0f2f8] p-4 md:p-6 lg:p-8">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="mb-6">
                        <h1 className="font-bold" style={{ fontSize: 'var(--text-3xl)', color: 'var(--primary-base)' }}>
                            Gestión de Citas
                        </h1>
                        <p className="text-gray-600" style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-xs)' }}>
                            Carga un archivo Excel con las citas programadas para enviar recordatorios automáticos
                        </p>
                    </div>

                    {/* Mensaje Flash de Éxito/Error */}
                    {showFlashMessage && (flash?.success || flash?.error) && (
                        <div
                            className={`mb-6 p-4 rounded-none flex items-start gap-3 transition-all duration-300 ${flash?.success
                                    ? 'bg-emerald-50 text-emerald-800'
                                    : 'bg-red-50 text-red-800'
                                }`}
                            style={{
                                boxShadow: flash?.success
                                    ? '0 2px 8px -2px rgba(16, 185, 129, 0.15)'
                                    : '0 2px 8px -2px rgba(239, 68, 68, 0.15)',
                            }}
                        >
                            {flash?.success ? (
                                <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0 text-emerald-600" />
                            ) : (
                                <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-red-600" />
                            )}
                            <div className="flex-1">
                                <p className="font-medium">{flash?.success || flash?.error}</p>
                            </div>
                            <button
                                onClick={() => setShowFlashMessage(false)}
                                className="p-1 hover:bg-black/5 rounded-none transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {/* Control de Recordatorios */}
                    {(remindersStats || localStats) && (
                        <div className="bg-gradient-to-b from-white to-[#fafbfc] rounded-none shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_6px_rgba(46,63,132,0.06),0_6px_16px_rgba(46,63,132,0.1),inset_0_1px_0_rgba(255,255,255,0.95)] p-4 md:p-6 mb-6">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div>
                                    <h2 className="text-lg font-semibold text-[#2e3f84] mb-1 flex items-center gap-2">
                                        <Send className="w-5 h-5" />
                                        Control de Envío de Recordatorios
                                    </h2>
                                    <div className="text-sm text-[#6b7494] space-y-1">
                                        {localStats.pending > 0 ? (
                                            <p>
                                                <strong className="text-[#2e3f84]">{localStats.pending}</strong> recordatorios pendientes para <strong>pasado mañana</strong> (2 días)
                                                {isProcessing && !isPaused && (
                                                    <span className="ml-2 inline-flex items-center gap-1 text-emerald-600 font-medium">
                                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                                        Enviando...
                                                    </span>
                                                )}
                                                {isProcessing && isPaused && (
                                                    <span className="ml-2 inline-flex items-center gap-1 text-amber-600 font-medium">
                                                        <Pause className="w-3 h-3" />
                                                        Pausado
                                                    </span>
                                                )}
                                            </p>
                                        ) : (
                                            <p className="text-amber-600">
                                                No hay citas pendientes para pasado mañana.
                                            </p>
                                        )}
                                        {localStats.pending_tomorrow > 0 && (
                                            <p className="text-amber-600">
                                                <CalendarCheck className="w-4 h-4 inline mr-1" />
                                                <strong>{localStats.pending_tomorrow}</strong> citas para <strong>mañana</strong> sin recordatorio enviado (usa "Enviar Día Antes")
                                            </p>
                                        )}
                                    </div>

                                    {/* Barra de progreso en tiempo real - usar estado local isProcessing, no depender del servidor */}
                                    {isProcessing && progress && progress.total > 0 && (
                                        <div className="mt-4 space-y-2">
                                            <div className="flex items-center justify-between text-xs text-[#6b7494]">
                                                <span>Progreso del envío</span>
                                                <span className="font-medium text-[#2e3f84]">
                                                    {progress.percentage}% ({progress.sent + progress.failed} / {progress.total})
                                                </span>
                                            </div>
                                            <div className="w-full bg-[#e5e7f0] rounded-full h-2.5 overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-[#22c55e] to-[#16a34a] transition-all duration-500 ease-out rounded-full"
                                                    style={{ width: `${Math.min(progress.percentage, 100)}%` }}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between text-xs">
                                                <div className="flex items-center gap-4 flex-wrap">
                                                    <span className="text-emerald-600 font-medium">
                                                        ✓ Enviados: {progress.sent}
                                                    </span>
                                                    {progress.failed > 0 && (
                                                        <span className="text-red-600 font-medium">
                                                            ✗ Fallidos: {progress.failed}
                                                        </span>
                                                    )}
                                                    <span className="text-[#6b7494]">
                                                        ⏳ Pendientes: {progress.pending}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-3 flex-wrap">
                                    {/* Botón para enviar citas de pasado mañana */}
                                    {!isProcessing && !isPaused && localStats.pending > 0 && (
                                        <Button
                                            onClick={handleStartReminders}
                                            disabled={isLoading || isProcessing}
                                            className="font-semibold text-white transition-all duration-200 border-0"
                                            style={{
                                                backgroundColor: 'var(--primary-base)',
                                                boxShadow: 'var(--shadow-md)',
                                                height: 'clamp(2.25rem, 2.25rem + 0.15vw, 2.5rem)',
                                                padding: '0 var(--space-lg)',
                                                fontSize: 'var(--text-sm)',
                                            }}
                                            onMouseEnter={(e) => {
                                                if (!isLoading && !isProcessing) {
                                                    e.currentTarget.style.backgroundColor = 'var(--primary-darker)';
                                                    e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = 'var(--primary-base)';
                                                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                                                e.currentTarget.style.transform = 'translateY(0)';
                                            }}
                                        >
                                            <Play className="w-4 h-4 mr-2" />
                                            {isLoading || isProcessing ? 'Iniciando...' : `Comenzar Envío (${localStats.pending})`}
                                        </Button>
                                    )}
                                    {/* Botón para enviar citas de mañana - independiente */}
                                    {!isProcessing && !isPaused && localStats.pending_tomorrow > 0 && (
                                        <Button
                                            onClick={handleStartRemindersDayBefore}
                                            disabled={isLoading || isProcessing}
                                            className="font-semibold text-white transition-all duration-200 border-0"
                                            style={{
                                                backgroundColor: '#F59E0B',
                                                boxShadow: 'var(--shadow-md)',
                                                height: 'clamp(2.25rem, 2.25rem + 0.15vw, 2.5rem)',
                                                padding: '0 var(--space-lg)',
                                                fontSize: 'var(--text-sm)',
                                            }}
                                            onMouseEnter={(e) => {
                                                if (!isLoading && !isProcessing) {
                                                    e.currentTarget.style.backgroundColor = '#D97706';
                                                    e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = '#F59E0B';
                                                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                                                e.currentTarget.style.transform = 'translateY(0)';
                                            }}
                                        >
                                            <CalendarCheck className="w-4 h-4 mr-2" />
                                            Enviar Día Antes ({localStats.pending_tomorrow})
                                        </Button>
                                    )}
                                    {isProcessing && !isPaused && (
                                        <>
                                            <Button
                                                onClick={handlePauseReminders}
                                                disabled={isLoading}
                                                className="font-semibold text-white transition-all duration-200 border-0"
                                                style={{
                                                    backgroundColor: '#F59E0B',
                                                    boxShadow: 'var(--shadow-md)',
                                                    height: 'clamp(2.25rem, 2.25rem + 0.15vw, 2.5rem)',
                                                    padding: '0 var(--space-lg)',
                                                    fontSize: 'var(--text-sm)',
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.backgroundColor = '#D97706';
                                                    e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.backgroundColor = '#F59E0B';
                                                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                }}
                                            >
                                                <Pause className="w-4 h-4 mr-2" />
                                                {isLoading ? 'Pausando...' : 'Pausar'}
                                            </Button>
                                            <Button
                                                onClick={handleStopReminders}
                                                disabled={isLoading}
                                                className="font-semibold text-white transition-all duration-200 border-0"
                                                style={{
                                                    backgroundColor: '#EF4444',
                                                    boxShadow: 'var(--shadow-md)',
                                                    height: 'clamp(2.25rem, 2.25rem + 0.15vw, 2.5rem)',
                                                    padding: '0 var(--space-lg)',
                                                    fontSize: 'var(--text-sm)',
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.backgroundColor = '#DC2626';
                                                    e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.backgroundColor = '#EF4444';
                                                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                }}
                                            >
                                                <Square className="w-4 h-4 mr-2" />
                                                {isLoading ? 'Deteniendo...' : 'Detener'}
                                            </Button>
                                        </>
                                    )}
                                    {isProcessing && isPaused && (
                                        <Button
                                            onClick={handleResumeReminders}
                                            disabled={isLoading}
                                            className="font-semibold text-white transition-all duration-200 border-0"
                                            style={{
                                                backgroundColor: '#10B981',
                                                boxShadow: 'var(--shadow-md)',
                                                height: 'clamp(2.25rem, 2.25rem + 0.15vw, 2.5rem)',
                                                padding: '0 var(--space-lg)',
                                                fontSize: 'var(--text-sm)',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = '#059669';
                                                e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                                                e.currentTarget.style.transform = 'translateY(-2px)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = '#10B981';
                                                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                                                e.currentTarget.style.transform = 'translateY(0)';
                                            }}
                                        >
                                            <Play className="w-4 h-4 mr-2" />
                                            {isLoading ? 'Reanudando...' : 'Reanudar'}
                                        </Button>
                                    )}
                                </div>
                            </div>
                            {localStats.pending > 2000 && (
                                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-none">
                                    <p className="text-sm text-amber-800">
                                        <AlertCircle className="w-4 h-4 inline mr-1" />
                                        <strong>Advertencia:</strong> Tienes {localStats.pending} recordatorios pendientes para pasado mañana.
                                        El sistema respetará el límite de 2,000 mensajes por día según las políticas de Meta.
                                    </p>
                                </div>
                            )}
                            {localStats.pending_tomorrow > 2000 && (
                                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-none">
                                    <p className="text-sm text-amber-800">
                                        <AlertCircle className="w-4 h-4 inline mr-1" />
                                        <strong>Advertencia:</strong> Tienes {localStats.pending_tomorrow} citas para mañana sin recordatorio.
                                        El sistema respetará el límite de 2,000 mensajes por día.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Reminders Stats */}
                    {(remindersStats || localStats) && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            {/* Enviados */}
                            <div className="bg-gradient-to-b from-white to-[#fafbfc] rounded-none shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_6px_rgba(46,63,132,0.06),inset_0_1px_0_rgba(255,255,255,0.95)] p-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-none flex items-center justify-center bg-gradient-to-b from-[#3e4f94] to-[#2e3f84] shadow-[0_2px_8px_rgba(46,63,132,0.25),inset_0_1px_0_rgba(255,255,255,0.2)]">
                                        <Send className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-[#2e3f84] transition-all duration-300 transform scale-100 hover:scale-105">
                                            {localStats.sent.toLocaleString()}
                                        </p>
                                        <p className="text-sm text-[#6b7494]">Recordatorios Enviados</p>
                                    </div>
                                </div>
                            </div>

                            {/* Pendientes */}
                            <div className="bg-gradient-to-b from-white to-[#fafbfc] rounded-none shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_6px_rgba(46,63,132,0.06),inset_0_1px_0_rgba(255,255,255,0.95)] p-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-none flex items-center justify-center bg-gradient-to-b from-[#3e4f94] to-[#2e3f84] shadow-[0_2px_8px_rgba(46,63,132,0.25),inset_0_1px_0_rgba(255,255,255,0.2)]">
                                        <Clock className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-[#2e3f84] transition-all duration-300 transform scale-100 hover:scale-105">
                                            {localStats.pending.toLocaleString()}
                                        </p>
                                        <p className="text-sm text-[#6b7494]">Por Enviar</p>
                                    </div>
                                </div>
                            </div>

                            {/* Fallidos */}
                            <div className="bg-gradient-to-b from-white to-[#fafbfc] rounded-none shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_6px_rgba(46,63,132,0.06),inset_0_1px_0_rgba(255,255,255,0.95)] p-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-none flex items-center justify-center bg-gradient-to-b from-[#3e4f94] to-[#2e3f84] shadow-[0_2px_8px_rgba(46,63,132,0.25),inset_0_1px_0_rgba(255,255,255,0.2)]">
                                        <XCircle className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-[#2e3f84] transition-all duration-300 transform scale-100 hover:scale-105">
                                            {localStats.failed.toLocaleString()}
                                        </p>
                                        <p className="text-sm text-[#6b7494]">Fallidos</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Upload Section */}
                    <div className="bg-gradient-to-b from-white to-[#fafbfc] rounded-none shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_6px_rgba(46,63,132,0.06),0_6px_16px_rgba(46,63,132,0.1),inset_0_1px_0_rgba(255,255,255,0.95)] p-4 md:p-6 mb-6"
                    >
                        <form onSubmit={submit}>
                            <div className="mb-6">
                                <h2 className="text-lg font-semibold text-[#2e3f84] mb-4 flex items-center gap-2">
                                    <FileSpreadsheet className="w-5 h-5" />
                                    Cargar Archivo de Citas
                                </h2>

                                {/* File Upload Area */}
                                <div
                                    onDrop={handleDrop}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    className={`
                                    border-2 border-dashed rounded-none p-8 text-center cursor-pointer
                                    bg-gradient-to-b from-[#f8f9fc] to-[#f4f5f9]
                                    ${isDragging ? 'border-[#2e3f84] from-white to-[#fafbfc]' : 'border-[#d4d8e8]'}
                                    hover:border-[#2e3f84] hover:from-white hover:to-[#fafbfc]
                                    transition-all duration-200
                                    shadow-[inset_0_1px_2px_rgba(46,63,132,0.05)]
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
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="w-16 h-16 rounded-full flex items-center justify-center bg-gradient-to-b from-[#3e4f94] to-[#2e3f84] shadow-[0_2px_8px_rgba(46,63,132,0.2),inset_0_1px_0_rgba(255,255,255,0.15)]">
                                                    <Upload className="w-8 h-8 text-white" />
                                                </div>
                                                <div>
                                                    <p className="text-lg font-medium text-[#2e3f84] mb-1">
                                                        Arrastra y suelta tu archivo aquí
                                                    </p>
                                                    <p className="text-sm text-[#6b7494]">
                                                        o <span className="text-[#2e3f84] font-semibold">haz click para seleccionar</span>
                                                    </p>
                                                    <p className="text-xs text-[#8891b3] mt-2">
                                                        Formatos soportados: .xlsx, .xls, .csv (máx. 10MB)
                                                    </p>
                                                </div>
                                            </div>
                                        </label>
                                    ) : (
                                        <div className="flex items-center justify-between p-4 bg-gradient-to-b from-white to-[#fafbfc] rounded-none shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_4px_rgba(46,63,132,0.06),inset_0_1px_0_rgba(255,255,255,0.95)]">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-none flex items-center justify-center bg-gradient-to-b from-[#3e4f94] to-[#2e3f84] shadow-[0_2px_6px_rgba(46,63,132,0.15),inset_0_1px_0_rgba(255,255,255,0.15)]">
                                                    <FileSpreadsheet className="w-6 h-6 text-white" />
                                                </div>
                                                <div className="text-left">
                                                    <p className="font-medium text-[#2e3f84]">{data.file.name}</p>
                                                    <p className="text-sm text-[#6b7494]">
                                                        {formatFileSize(data.file.size)}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={removeFile}
                                                className="p-2 hover:bg-gradient-to-b hover:from-red-50 hover:to-red-100 rounded-none transition-all duration-200"
                                                disabled={processing}
                                            >
                                                <X className="w-5 h-5 text-red-500" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {errors.file && (
                                    <div className="mt-4 flex items-start gap-2 p-4 bg-gradient-to-b from-red-50 to-red-100/50 rounded-none shadow-[0_1px_2px_rgba(239,68,68,0.1),inset_0_1px_0_rgba(255,255,255,0.5)]">
                                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                        <p className="text-sm text-red-600">{errors.file}</p>
                                    </div>
                                )}
                            </div>

                            {/* Upload Button */}
                            {data.file && (
                                <div className="flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={processing}
                                        className="px-6 py-3 text-white rounded-none font-medium bg-gradient-to-b from-[#3e4f94] to-[#2e3f84] shadow-[0_2px_4px_rgba(46,63,132,0.15),0_4px_12px_rgba(46,63,132,0.2),inset_0_1px_0_rgba(255,255,255,0.15)] hover:shadow-[0_4px_8px_rgba(46,63,132,0.2),0_6px_16px_rgba(46,63,132,0.25)] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                                    >
                                        {processing ? 'Subiendo...' : 'Subir Archivo'}
                                    </button>
                                </div>
                            )}
                        </form>
                    </div>

                    {/* Uploaded File Info */}
                    {uploadedFile && (
                        <div className="bg-gradient-to-b from-white to-[#fafbfc] rounded-none shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_6px_rgba(46,63,132,0.06),0_6px_16px_rgba(46,63,132,0.1),inset_0_1px_0_rgba(255,255,255,0.95)] p-4 md:p-6 mb-6"
                        >
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 bg-gradient-to-b from-emerald-400 to-emerald-500 shadow-[0_2px_8px_rgba(16,185,129,0.3),inset_0_1px_0_rgba(255,255,255,0.2)]">
                                    <CheckCircle2 className="w-6 h-6 text-white" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-[#2e3f84] mb-2">
                                        Archivo Cargado Exitosamente
                                    </h3>
                                    <div className="space-y-1 text-sm text-[#6b7494]">
                                        <p><span className="font-semibold text-[#2e3f84]">Nombre:</span> {uploadedFile.name}</p>
                                        <p><span className="font-semibold text-[#2e3f84]">Tamaño:</span> {formatFileSize(uploadedFile.size)}</p>
                                        <p><span className="font-semibold text-[#2e3f84]">Registros:</span> {uploadedFile.total_rows || initialAppointments.length} citas</p>
                                        <p><span className="font-semibold text-[#2e3f84]">Fecha:</span> {new Date(uploadedFile.uploaded_at).toLocaleString('es-CO')}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tabla de Citas */}
                    {initialAppointments.length > 0 && (
                        <div className="bg-gradient-to-b from-white to-[#fafbfc] rounded-none shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_6px_rgba(46,63,132,0.06),0_6px_16px_rgba(46,63,132,0.1),inset_0_1px_0_rgba(255,255,255,0.95)] p-4 md:p-6 mb-6">
                            {/* Header con búsqueda */}
                            <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div>
                                    <h2 className="text-lg font-semibold text-[#2e3f84]">
                                        Citas en Base de Datos ({totalAppointments})
                                    </h2>
                                    <p className="text-sm text-[#6b7494]">
                                        Mostrando últimas {initialAppointments.length} citas (filtradas: {filteredAppointments.length})
                                    </p>
                                </div>

                                <div className="flex items-center gap-3">
                                    {/* Buscador */}
                                    <div className="relative">
                                        <label htmlFor="appointment-search" className="sr-only">Buscar citas</label>
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b7494]" />
                                        <input
                                            id="appointment-search"
                                            name="appointment-search"
                                            type="text"
                                            placeholder="Buscar por paciente, teléfono, médico..."
                                            value={searchTerm}
                                            onChange={(e) => handleSearch(e.target.value)}
                                            className="pl-10 pr-4 py-2 rounded-none border border-[#d4d8e8] focus:border-[#2e3f84] focus:ring-2 focus:ring-[#2e3f84]/10 outline-none transition-all duration-200 w-full md:w-80 text-sm"
                                        />
                                    </div>

                                    {/* Botón para abrir página dedicada */}
                                    <Button
                                        onClick={() => router.visit('/admin/appointments/view')}
                                        className="font-semibold text-white transition-all duration-200 border-0 flex items-center gap-2"
                                        style={{
                                            backgroundColor: 'var(--primary-base)',
                                            boxShadow: 'var(--shadow-md)',
                                            padding: '0.5rem 1rem',
                                            fontSize: 'var(--text-sm)',
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = 'var(--primary-darker)';
                                            e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = 'var(--primary-base)';
                                            e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                                            e.currentTarget.style.transform = 'translateY(0)';
                                        }}
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                        Ver Todas las Citas
                                    </Button>
                                </div>
                            </div>

                            {/* Tabla con scroll horizontal */}
                            <div className="overflow-x-auto rounded-none border border-[#d4d8e8]">
                                <table className="w-full text-sm">
                                    <thead className="bg-gradient-to-b from-[#2e3f84] to-[#263470] text-white">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">#</th>
                                            <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Paciente</th>
                                            <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Teléfono</th>
                                            <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Fecha Cita</th>
                                            <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Hora</th>
                                            <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Médico</th>
                                            <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Especialidad</th>
                                            <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Recordatorio</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-[#e5e7f0]">
                                        {paginatedAppointments.map((appointment, index) => (
                                            <tr
                                                key={appointment.id}
                                                className="hover:bg-gradient-to-b hover:from-[#f8f9fc] hover:to-[#f4f5f9] transition-colors duration-150"
                                            >
                                                <td className="px-4 py-3 text-[#6b7494] whitespace-nowrap">
                                                    {(currentPage - 1) * itemsPerPage + index + 1}
                                                </td>
                                                <td className="px-4 py-3 text-[#2e3f84] font-medium whitespace-nowrap">
                                                    {appointment.nom_paciente || '-'}
                                                </td>
                                                <td className="px-4 py-3 text-[#6b7494] whitespace-nowrap">
                                                    {appointment.pactel || '-'}
                                                </td>
                                                <td className="px-4 py-3 text-[#6b7494] whitespace-nowrap">
                                                    {appointment.citfc || '-'}
                                                </td>
                                                <td className="px-4 py-3 text-[#6b7494] whitespace-nowrap">
                                                    {appointment.cithor || '-'}
                                                </td>
                                                <td className="px-4 py-3 text-[#6b7494] whitespace-nowrap">
                                                    {appointment.mednom || '-'}
                                                </td>
                                                <td className="px-4 py-3 text-[#6b7494] whitespace-nowrap">
                                                    {appointment.espnom || '-'}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    {appointment.reminder_sent ? (
                                                        <div className="flex items-center gap-2">
                                                            {appointment.reminder_status === 'sent' && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-none bg-emerald-50 text-emerald-700 text-xs font-medium">
                                                                    <CheckCircle2 className="w-3 h-3" />
                                                                    Enviado
                                                                </span>
                                                            )}
                                                            {appointment.reminder_status === 'failed' && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-none bg-red-50 text-red-700 text-xs font-medium">
                                                                    <XCircle className="w-3 h-3" />
                                                                    Fallido
                                                                </span>
                                                            )}
                                                            {appointment.reminder_status === 'delivered' && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-none bg-blue-50 text-blue-700 text-xs font-medium">
                                                                    <CheckCircle2 className="w-3 h-3" />
                                                                    Entregado
                                                                </span>
                                                            )}
                                                            {appointment.reminder_status === 'confirmed' && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-none bg-green-50 text-green-700 text-xs font-medium">
                                                                    <CalendarCheck className="w-3 h-3" />
                                                                    Confirmada
                                                                </span>
                                                            )}
                                                            {appointment.reminder_status === 'cancelled' && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-none bg-red-50 text-red-700 text-xs font-medium">
                                                                    <CalendarX className="w-3 h-3" />
                                                                    Cancelada
                                                                </span>
                                                            )}
                                                            {appointment.reminder_status === 'read' && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-none bg-indigo-50 text-indigo-700 text-xs font-medium">
                                                                    <CheckCircle2 className="w-3 h-3" />
                                                                    Leído
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-none bg-amber-50 text-amber-700 text-xs font-medium">
                                                            <Clock className="w-3 h-3" />
                                                            Pendiente
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Paginación */}
                            {totalPages > 1 && (
                                <div className="mt-4 flex items-center justify-between">
                                    <p className="text-sm text-[#6b7494]">
                                        Página {currentPage} de {totalPages}
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                            disabled={currentPage === 1}
                                            className="px-3 py-2 rounded-none border border-[#d4d8e8] text-[#2e3f84] hover:bg-gradient-to-b hover:from-[#f8f9fc] hover:to-[#f4f5f9] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                            Anterior
                                        </button>
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                            disabled={currentPage === totalPages}
                                            className="px-3 py-2 rounded-none border border-[#d4d8e8] text-[#2e3f84] hover:bg-gradient-to-b hover:from-[#f8f9fc] hover:to-[#f4f5f9] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
                                        >
                                            Siguiente
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Instructions */}
                    {initialAppointments.length === 0 && (
                        <div className="bg-gradient-to-b from-white to-[#fafbfc] rounded-none shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_6px_rgba(46,63,132,0.06),0_6px_16px_rgba(46,63,132,0.1),inset_0_1px_0_rgba(255,255,255,0.95)] p-4 md:p-6"
                        >
                            <h3 className="font-semibold text-[#2e3f84] mb-4">
                                Formato del Archivo Excel
                            </h3>
                            <div className="space-y-3 text-sm text-[#6b7494]">
                                <p className="text-[#2e3f84] font-medium">El archivo debe contener las siguientes columnas:</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
                                    <div className="text-xs bg-gradient-to-b from-[#f8f9fc] to-[#f4f5f9] p-2 rounded-none">
                                        <strong className="text-[#2e3f84]">citead</strong> - Código admisión
                                    </div>
                                    <div className="text-xs bg-gradient-to-b from-[#f8f9fc] to-[#f4f5f9] p-2 rounded-none">
                                        <strong className="text-[#2e3f84]">nom_paciente</strong> - Nombre paciente
                                    </div>
                                    <div className="text-xs bg-gradient-to-b from-[#f8f9fc] to-[#f4f5f9] p-2 rounded-none">
                                        <strong className="text-[#2e3f84]">pactel</strong> - Teléfono
                                    </div>
                                    <div className="text-xs bg-gradient-to-b from-[#f8f9fc] to-[#f4f5f9] p-2 rounded-none">
                                        <strong className="text-[#2e3f84]">citfc</strong> - Fecha cita
                                    </div>
                                    <div className="text-xs bg-gradient-to-b from-[#f8f9fc] to-[#f4f5f9] p-2 rounded-none">
                                        <strong className="text-[#2e3f84]">cithor</strong> - Hora cita
                                    </div>
                                    <div className="text-xs bg-gradient-to-b from-[#f8f9fc] to-[#f4f5f9] p-2 rounded-none">
                                        <strong className="text-[#2e3f84]">mednom</strong> - Nombre médico
                                    </div>
                                    <div className="text-xs bg-gradient-to-b from-[#f8f9fc] to-[#f4f5f9] p-2 rounded-none">
                                        <strong className="text-[#2e3f84]">espnom</strong> - Especialidad
                                    </div>
                                    <div className="text-xs bg-gradient-to-b from-[#f8f9fc] to-[#f4f5f9] p-2 rounded-none">
                                        <strong className="text-[#2e3f84]">citdoc</strong> - Documento
                                    </div>
                                    <div className="text-xs bg-gradient-to-b from-[#f8f9fc] to-[#f4f5f9] p-2 rounded-none">
                                        <strong className="text-[#2e3f84]">citobsobs</strong> - Observaciones
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}
