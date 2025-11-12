import AdminLayout from '@/layouts/admin-layout';
import { Head, router } from '@inertiajs/react';
import { Search, ChevronLeft, ChevronRight, CalendarCheck, CalendarX, CalendarClock, Clock, Filter, ArrowLeft } from 'lucide-react';
import { useState } from 'react';
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
    reminder_sent?: boolean;
    reminder_sent_at?: string;
    reminder_status?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'confirmed' | 'cancelled' | 'reschedule_requested';
}

interface PaginatedAppointments {
    data: Appointment[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
    prev_page_url: string | null;
    next_page_url: string | null;
}

interface AppointmentsViewProps {
    appointments: PaginatedAppointments;
    filter: string;
    search?: string;
    stats: {
        all: number;
        pending: number;
        confirmed: number;
        cancelled: number;
        reschedule_requested: number;
    };
}

export default function AppointmentsView({ appointments, filter: initialFilter, search: initialSearch, stats }: AppointmentsViewProps) {
    const [filter, setFilter] = useState(initialFilter || 'all');
    const [searchTerm, setSearchTerm] = useState(initialSearch || '');

    const handleFilterChange = (newFilter: string) => {
        setFilter(newFilter);
        router.get('/admin/appointments/view', {
            filter: newFilter,
            search: searchTerm || undefined,
        }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const handleSearch = (value: string) => {
        setSearchTerm(value);
        router.get('/admin/appointments/view', {
            filter,
            search: value || undefined,
        }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const filterButtons = [
        { key: 'all', label: 'Todas', icon: Filter, count: stats.all },
        { key: 'pending', label: 'Pendientes', icon: Clock, count: stats.pending },
        { key: 'confirmed', label: 'Confirmadas', icon: CalendarCheck, count: stats.confirmed },
        { key: 'cancelled', label: 'Canceladas', icon: CalendarX, count: stats.cancelled },
        { key: 'reschedule_requested', label: 'Reprogramar', icon: CalendarClock, count: stats.reschedule_requested },
    ];

    const getStatusBadge = (appointment: Appointment) => {
        if (!appointment.reminder_sent) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 text-amber-700 text-xs font-medium">
                    <Clock className="w-3 h-3" />
                    Pendiente
                </span>
            );
        }

        switch (appointment.reminder_status) {
            case 'sent':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium">
                        <CalendarCheck className="w-3 h-3" />
                        Enviado
                    </span>
                );
            case 'failed':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 text-red-700 text-xs font-medium">
                        <CalendarX className="w-3 h-3" />
                        Fallido
                    </span>
                );
            case 'delivered':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium">
                        <CalendarCheck className="w-3 h-3" />
                        Entregado
                    </span>
                );
            case 'confirmed':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-green-50 text-green-700 text-xs font-medium">
                        <CalendarCheck className="w-3 h-3" />
                        Confirmada
                    </span>
                );
            case 'cancelled':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 text-red-700 text-xs font-medium">
                        <CalendarX className="w-3 h-3" />
                        Cancelada
                    </span>
                );
            case 'reschedule_requested':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-50 text-orange-700 text-xs font-medium">
                        <CalendarClock className="w-3 h-3" />
                        Reprogramar
                    </span>
                );
            case 'read':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-medium">
                        <CalendarCheck className="w-3 h-3" />
                        Leído
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-50 text-gray-700 text-xs font-medium">
                        <Clock className="w-3 h-3" />
                        Pendiente
                    </span>
                );
        }
    };

    return (
        <AdminLayout>
            <Head title="Ver Todas las Citas" />
            
            <div className="min-h-screen bg-[#f0f2f8] p-4 md:p-6 lg:p-8">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <Button
                                onClick={() => router.visit('/admin/appointments')}
                                className="font-semibold text-[#2e3f84] transition-all duration-200 border-0 flex items-center gap-2 bg-white hover:bg-[#f8f9fc]"
                                style={{
                                    boxShadow: 'var(--shadow-md)',
                                    padding: '0.5rem 1rem',
                                    fontSize: 'var(--text-sm)',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#f8f9fc';
                                    e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'white';
                                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }}
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Volver a Citas
                            </Button>
                        </div>
                        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-[#2e3f84]">
                            Gestión de Citas
                        </h1>
                        <p className="text-sm md:text-base text-[#6b7494] mt-1">
                            Visualiza y filtra todas las citas con sus estados de recordatorio
                        </p>
                    </div>

                {/* Filtros */}
                <div className="bg-gradient-to-b from-white to-[#fafbfc] rounded-2xl shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_6px_rgba(46,63,132,0.06),0_6px_16px_rgba(46,63,132,0.1),inset_0_1px_0_rgba(255,255,255,0.95)] p-4 md:p-6 mb-6">
                    <div className="mb-4">
                        <h2 className="text-lg font-semibold text-[#2e3f84] mb-3 flex items-center gap-2">
                            <Filter className="w-5 h-5" />
                            Filtros
                        </h2>
                        <div className="flex flex-wrap gap-2">
                            {filterButtons.map(({ key, label, icon: Icon, count }) => (
                                <button
                                    key={key}
                                    onClick={() => handleFilterChange(key)}
                                    className={`
                                        flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all duration-200
                                        ${filter === key
                                            ? 'bg-gradient-to-b from-[#3e4f94] to-[#2e3f84] text-white shadow-[0_2px_8px_rgba(46,63,132,0.25)]'
                                            : 'bg-white text-[#6b7494] border border-[#d4d8e8] hover:border-[#2e3f84] hover:text-[#2e3f84]'
                                        }
                                    `}
                                >
                                    <Icon className="w-4 h-4" />
                                    <span>{label}</span>
                                    <span className={`
                                        px-2 py-0.5 rounded-full text-xs
                                        ${filter === key ? 'bg-white/20 text-white' : 'bg-[#f4f5f9] text-[#6b7494]'}
                                    `}>
                                        {count.toLocaleString()}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Buscador */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b7494]" />
                        <input
                            type="text"
                            placeholder="Buscar por paciente, teléfono, médico, especialidad..."
                            value={searchTerm}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-[#d4d8e8] focus:border-[#2e3f84] focus:ring-2 focus:ring-[#2e3f84]/10 outline-none transition-all duration-200 text-sm"
                        />
                    </div>
                </div>

                {/* Tabla */}
                <div className="bg-gradient-to-b from-white to-[#fafbfc] rounded-2xl shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_6px_rgba(46,63,132,0.06),0_6px_16px_rgba(46,63,132,0.1),inset_0_1px_0_rgba(255,255,255,0.95)] p-4 md:p-6">
                    <div className="mb-4">
                        <h2 className="text-lg font-semibold text-[#2e3f84]">
                            Resultados ({appointments.total})
                        </h2>
                        <p className="text-sm text-[#6b7494]">
                            Mostrando {appointments.from} - {appointments.to} de {appointments.total} citas
                        </p>
                    </div>

                    {/* Tabla con scroll horizontal */}
                    <div className="overflow-x-auto rounded-xl border border-[#d4d8e8]">
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
                                {appointments.data.length > 0 ? (
                                    appointments.data.map((appointment, index) => (
                                        <tr 
                                            key={appointment.id} 
                                            className="hover:bg-gradient-to-b hover:from-[#f8f9fc] hover:to-[#f4f5f9] transition-colors duration-150"
                                        >
                                            <td className="px-4 py-3 text-[#6b7494] whitespace-nowrap">
                                                {appointments.from + index}
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
                                                {getStatusBadge(appointment)}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-8 text-center text-[#6b7494]">
                                            No se encontraron citas con los filtros seleccionados
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Paginación */}
                    {appointments.last_page > 1 && (
                        <div className="mt-4 flex items-center justify-between">
                            <p className="text-sm text-[#6b7494]">
                                Página {appointments.current_page} de {appointments.last_page}
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => router.get(appointments.prev_page_url || '', {}, { preserveState: true, preserveScroll: true })}
                                    disabled={!appointments.prev_page_url}
                                    className="px-3 py-2 rounded-lg border border-[#d4d8e8] text-[#6b7494] hover:bg-[#f8f9fc] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-1"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    Anterior
                                </button>
                                <button
                                    onClick={() => router.get(appointments.next_page_url || '', {}, { preserveState: true, preserveScroll: true })}
                                    disabled={!appointments.next_page_url}
                                    className="px-3 py-2 rounded-lg border border-[#d4d8e8] text-[#6b7494] hover:bg-[#f8f9fc] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-1"
                                >
                                    Siguiente
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                </div>
            </div>
        </AdminLayout>
    );
}

