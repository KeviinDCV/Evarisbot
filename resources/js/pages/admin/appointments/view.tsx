import AdminLayout from '@/layouts/admin-layout';
import { Head, router } from '@inertiajs/react';
import { Search, ChevronLeft, ChevronRight, CalendarCheck, CalendarX, Clock, Filter, ArrowLeft, Calendar, Download, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
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
    reminder_status?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'confirmed' | 'cancelled';
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
    date_from?: string;
    date_to?: string;
    sort?: string;
    direction?: string;
    stats: {
        all: number;
        pending: number;
        confirmed: number;
        cancelled: number;
    };
}

export default function AppointmentsView({ appointments, filter: initialFilter, search: initialSearch, date_from: initialDateFrom, date_to: initialDateTo, sort: initialSort, direction: initialDirection, stats }: AppointmentsViewProps) {
    const [filter, setFilter] = useState(initialFilter || 'all');
    const [searchTerm, setSearchTerm] = useState(initialSearch || '');
    const [dateFrom, setDateFrom] = useState(initialDateFrom || '');
    const [dateTo, setDateTo] = useState(initialDateTo || '');
    const [sortField, setSortField] = useState<string | null>(initialSort || 'id');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>((initialDirection as 'asc' | 'desc') || 'desc');

    const handleSort = (field: string) => {
        const newDirection = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
        setSortField(field);
        setSortDirection(newDirection);
        
        router.get('/admin/appointments/view', {
            filter,
            search: searchTerm || undefined,
            date_from: dateFrom || undefined,
            date_to: dateTo || undefined,
            sort: field,
            direction: newDirection,
        }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const handleFilterChange = (newFilter: string) => {
        setFilter(newFilter);
        router.get('/admin/appointments/view', {
            filter: newFilter,
            search: searchTerm || undefined,
            date_from: dateFrom || undefined,
            date_to: dateTo || undefined,
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
            date_from: dateFrom || undefined,
            date_to: dateTo || undefined,
        }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const handleDateChange = (type: 'from' | 'to', value: string) => {
        if (type === 'from') {
            setDateFrom(value);
        } else {
            setDateTo(value);
        }
        
        router.get('/admin/appointments/view', {
            filter,
            search: searchTerm || undefined,
            date_from: type === 'from' ? (value || undefined) : (dateFrom || undefined),
            date_to: type === 'to' ? (value || undefined) : (dateTo || undefined),
        }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const handleClearDates = () => {
        setDateFrom('');
        setDateTo('');
        router.get('/admin/appointments/view', {
            filter,
            search: searchTerm || undefined,
        }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const filterButtons = [
        { key: 'all', label: 'Todas', icon: Filter, count: stats.all },
        { key: 'pending', label: 'Pendientes', icon: Clock, count: stats.pending },
        { key: 'confirmed', label: 'Confirmadas', icon: CalendarCheck, count: stats.confirmed },
        { key: 'cancelled', label: 'Canceladas', icon: CalendarX, count: stats.cancelled },
    ];

    const getStatusBadge = (appointment: Appointment) => {
        if (!appointment.reminder_sent) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-none bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium">
                    <Clock className="w-3 h-3" />
                    Pendiente
                </span>
            );
        }

        switch (appointment.reminder_status) {
            case 'sent':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-none bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
                        <CalendarCheck className="w-3 h-3" />
                        Enviado
                    </span>
                );
            case 'failed':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-none bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-medium">
                        <CalendarX className="w-3 h-3" />
                        Fallido
                    </span>
                );
            case 'delivered':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-none bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium">
                        <CalendarCheck className="w-3 h-3" />
                        Entregado
                    </span>
                );
            case 'confirmed':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-none bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium">
                        <CalendarCheck className="w-3 h-3" />
                        Confirmada
                    </span>
                );
            case 'cancelled':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-none bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-medium">
                        <CalendarX className="w-3 h-3" />
                        Cancelada
                    </span>
                );
            case 'read':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-none bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-xs font-medium">
                        <CalendarCheck className="w-3 h-3" />
                        Leído
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-none bg-muted text-foreground text-xs font-medium">
                        <Clock className="w-3 h-3" />
                        Pendiente
                    </span>
                );
        }
    };

    return (
        <AdminLayout>
            <Head title="Ver Todas las Citas" />
            
            <div className="min-h-screen p-4 md:p-6 lg:p-8" style={{ background: 'linear-gradient(to bottom, #f0f2f8, #e8ebf5)' }}>
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="mb-6 md:mb-8">
                        <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
                            <Button
                                onClick={() => router.get('/admin/appointments')}
                                className="font-semibold text-white transition-all duration-200 border-0"
                                style={{
                                    backgroundColor: 'var(--primary-base)',
                                    boxShadow: 'var(--shadow-md)',
                                    height: 'clamp(2.25rem, 2.25rem + 0.15vw, 2.5rem)',
                                    padding: '0 var(--space-lg)',
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
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Volver a Citas
                            </Button>

                            <a
                                href={`/admin/appointments/export?filter=${filter}&search=${searchTerm || ''}&date_from=${dateFrom || ''}&date_to=${dateTo || ''}`}
                                style={{
                                    backgroundColor: 'var(--primary-base)',
                                    backgroundImage: 'var(--gradient-shine)',
                                    color: 'white',
                                    padding: '0.5rem 1rem',
                                    fontSize: 'var(--text-sm)',
                                    fontWeight: '600',
                                    borderRadius: '0',
                                    boxShadow: 'var(--shadow-md)',
                                    transition: 'all 0.2s',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    cursor: 'pointer',
                                    textDecoration: 'none',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'var(--primary-darker)';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'var(--primary-base)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                                }}
                                onMouseDown={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                                }}
                                onMouseUp={(e) => {
                                    e.currentTarget.style.backgroundColor = 'var(--primary-base)';
                                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                                }}
                            >
                                <Download className="w-4 h-4" />
                                Exportar a Excel
                            </a>
                        </div>
                        <h1 className="font-bold dark:text-[hsl(231,15%,92%)]" style={{ fontSize: 'var(--text-3xl)', color: '#2e3f84' }}>
                            Gestión de Citas
                        </h1>
                        <p className="text-sm md:text-base dark:text-[hsl(231,15%,60%)] mt-1" style={{ color: '#6b7494' }}>
                            Visualiza y filtra todas las citas con sus estados de recordatorio
                        </p>
                    </div>

                {/* Filtros */}
                <div className="card-gradient rounded-none shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_6px_rgba(46,63,132,0.06),0_6px_16px_rgba(46,63,132,0.1),inset_0_1px_0_rgba(255,255,255,0.95)] p-4 md:p-6 mb-6">
                    <div className="mb-4">
                        <h2 className="text-lg font-semibold dark:text-[hsl(231,15%,92%)] mb-3 flex items-center gap-2" style={{ color: '#2e3f84' }}>
                            <Filter className="w-5 h-5" />
                            Filtros
                        </h2>
                        <div className="flex flex-wrap gap-2">
                            {filterButtons.map(({ key, label, icon: Icon, count }) => (
                                <button
                                    key={key}
                                    onClick={() => handleFilterChange(key)}
                                    className={`
                                        flex items-center gap-2 px-4 py-2 rounded-none font-medium text-sm transition-all duration-200
                                        ${filter === key
                                            ? 'chat-message-sent text-white shadow-[0_2px_8px_rgba(46,63,132,0.25)]'
                                            : 'border border-[#d4d8e8] dark:border-[hsl(231,20%,22%)] dark:bg-[hsl(231,25%,14%)] dark:text-[hsl(231,15%,60%)] hover:border-[#2e3f84] dark:hover:text-[hsl(231,55%,70%)]'
                                        }
                                    `}
                                    style={filter !== key ? { background: 'linear-gradient(to bottom, #ffffff, #fafbfc)', color: '#6b7494' } : undefined}
                                >
                                    <Icon className="w-4 h-4" />
                                    <span>{label}</span>
                                    <span 
                                        className={`
                                            px-2 py-0.5 rounded-none text-xs
                                            ${filter === key ? 'bg-white/20 text-white' : 'bg-[#f4f5f9] dark:bg-[hsl(231,25%,18%)] dark:text-[hsl(231,15%,60%)]'}
                                        `}
                                        style={filter !== key ? { color: '#6b7494' } : undefined}
                                    >
                                        {count.toLocaleString()}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Filtro por Fecha */}
                    <div className="mb-4">
                        <h3 className="text-sm font-semibold dark:text-[hsl(231,15%,92%)] mb-2 flex items-center gap-2" style={{ color: '#2e3f84' }}>
                            <Calendar className="w-4 h-4" />
                            Filtrar por Fecha de Cita
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                                <label htmlFor="date-from" className="block text-xs font-medium dark:text-[hsl(231,15%,60%)] mb-1" style={{ color: '#6b7494' }}>Desde</label>
                                <input
                                    id="date-from"
                                    name="date-from"
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => handleDateChange('from', e.target.value)}
                                    className="w-full px-3 py-2 rounded-none settings-input focus:ring-2 focus:ring-primary/10 outline-none transition-all duration-200 text-sm"
                                />
                            </div>
                            <div>
                                <label htmlFor="date-to" className="block text-xs font-medium dark:text-[hsl(231,15%,60%)] mb-1" style={{ color: '#6b7494' }}>Hasta</label>
                                <input
                                    id="date-to"
                                    name="date-to"
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => handleDateChange('to', e.target.value)}
                                    className="w-full px-3 py-2 rounded-none settings-input focus:ring-2 focus:ring-primary/10 outline-none transition-all duration-200 text-sm"
                                />
                            </div>
                            <div className="flex items-end">
                                <button
                                    onClick={handleClearDates}
                                    disabled={!dateFrom && !dateTo}
                                    className="w-full px-4 py-2 rounded-none border border-[#d4d8e8] dark:border-[hsl(231,20%,22%)] dark:text-[hsl(231,15%,60%)] hover:bg-[#f8f9fc] dark:hover:bg-[hsl(231,25%,18%)] dark:hover:text-[hsl(231,55%,70%)] hover:border-[#2e3f84] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 text-sm font-medium"
                                    style={{ color: '#6b7494' }}
                                >
                                    Limpiar Fechas
                                </button>
                            </div>
                        </div>
                        {(dateFrom || dateTo) && (
                            <p className="mt-2 text-xs dark:text-[hsl(231,55%,70%)] flex items-center gap-1" style={{ color: '#2e3f84' }}>
                                <Calendar className="w-3 h-3" />
                                Filtrando citas {dateFrom && `desde ${dateFrom}`} {dateFrom && dateTo && '-'} {dateTo && `hasta ${dateTo}`}
                            </p>
                        )}
                    </div>

                    {/* Buscador */}
                    <div className="relative">
                        <label htmlFor="view-search" className="sr-only">Buscar citas</label>
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#6b7494' }} />
                        <input
                            id="view-search"
                            name="view-search"
                            type="text"
                            placeholder="Buscar por paciente, cédula, teléfono, médico, especialidad..."
                            value={searchTerm}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-none settings-input focus:ring-2 focus:ring-primary/10 outline-none transition-all duration-200 text-sm"
                        />
                    </div>
                </div>

                {/* Tabla */}
                <div className="card-gradient rounded-none shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_6px_rgba(46,63,132,0.06),0_6px_16px_rgba(46,63,132,0.1),inset_0_1px_0_rgba(255,255,255,0.95)] p-4 md:p-6">
                    <div className="mb-4">
                        <h2 className="text-lg font-semibold dark:text-[hsl(231,15%,92%)]" style={{ color: '#2e3f84' }}>
                            Resultados ({appointments.total})
                        </h2>
                        <p className="text-sm dark:text-[hsl(231,15%,60%)]" style={{ color: '#6b7494' }}>
                            Mostrando {appointments.from} - {appointments.to} de {appointments.total} citas
                        </p>
                    </div>

                    {/* Tabla con scroll horizontal */}
                    <div className="overflow-x-auto rounded-none border border-[#d4d8e8] dark:border-[hsl(231,20%,22%)]">
                        <table className="w-full text-sm">
                            <thead className="bg-gradient-to-b from-[#2e3f84] to-[#263470] text-white">
                                <tr>
                                    <th className="px-4 py-3 text-left font-semibold whitespace-nowrap cursor-pointer hover:bg-[#263470] transition-colors" onClick={() => handleSort('id')}>
                                        <div className="flex items-center gap-2">
                                            #
                                            {sortField === 'id' ? (
                                                sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                                            ) : (
                                                <ArrowUpDown className="w-4 h-4 opacity-50" />
                                            )}
                                        </div>
                                    </th>
                                    <th className="px-4 py-3 text-left font-semibold whitespace-nowrap cursor-pointer hover:bg-[#263470] transition-colors" onClick={() => handleSort('nom_paciente')}>
                                        <div className="flex items-center gap-2">
                                            Paciente
                                            {sortField === 'nom_paciente' ? (
                                                sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                                            ) : (
                                                <ArrowUpDown className="w-4 h-4 opacity-50" />
                                            )}
                                        </div>
                                    </th>
                                    <th className="px-4 py-3 text-left font-semibold whitespace-nowrap cursor-pointer hover:bg-[#263470] transition-colors" onClick={() => handleSort('citide')}>
                                        <div className="flex items-center gap-2">
                                            Cédula
                                            {sortField === 'citide' ? (
                                                sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                                            ) : (
                                                <ArrowUpDown className="w-4 h-4 opacity-50" />
                                            )}
                                        </div>
                                    </th>
                                    <th className="px-4 py-3 text-left font-semibold whitespace-nowrap cursor-pointer hover:bg-[#263470] transition-colors" onClick={() => handleSort('pactel')}>
                                        <div className="flex items-center gap-2">
                                            Teléfono
                                            {sortField === 'pactel' ? (
                                                sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                                            ) : (
                                                <ArrowUpDown className="w-4 h-4 opacity-50" />
                                            )}
                                        </div>
                                    </th>
                                    <th className="px-4 py-3 text-left font-semibold whitespace-nowrap cursor-pointer hover:bg-[#263470] transition-colors" onClick={() => handleSort('citfc')}>
                                        <div className="flex items-center gap-2">
                                            Fecha Cita
                                            {sortField === 'citfc' ? (
                                                sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                                            ) : (
                                                <ArrowUpDown className="w-4 h-4 opacity-50" />
                                            )}
                                        </div>
                                    </th>
                                    <th className="px-4 py-3 text-left font-semibold whitespace-nowrap cursor-pointer hover:bg-[#263470] transition-colors" onClick={() => handleSort('cithor')}>
                                        <div className="flex items-center gap-2">
                                            Hora
                                            {sortField === 'cithor' ? (
                                                sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                                            ) : (
                                                <ArrowUpDown className="w-4 h-4 opacity-50" />
                                            )}
                                        </div>
                                    </th>
                                    <th className="px-4 py-3 text-left font-semibold whitespace-nowrap cursor-pointer hover:bg-[#263470] transition-colors" onClick={() => handleSort('mednom')}>
                                        <div className="flex items-center gap-2">
                                            Médico
                                            {sortField === 'mednom' ? (
                                                sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                                            ) : (
                                                <ArrowUpDown className="w-4 h-4 opacity-50" />
                                            )}
                                        </div>
                                    </th>
                                    <th className="px-4 py-3 text-left font-semibold whitespace-nowrap cursor-pointer hover:bg-[#263470] transition-colors" onClick={() => handleSort('espnom')}>
                                        <div className="flex items-center gap-2">
                                            Especialidad
                                            {sortField === 'espnom' ? (
                                                sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                                            ) : (
                                                <ArrowUpDown className="w-4 h-4 opacity-50" />
                                            )}
                                        </div>
                                    </th>
                                    <th className="px-4 py-3 text-left font-semibold whitespace-nowrap cursor-pointer hover:bg-[#263470] transition-colors" onClick={() => handleSort('reminder_status')}>
                                        <div className="flex items-center gap-2">
                                            Recordatorio
                                            {sortField === 'reminder_status' ? (
                                                sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                                            ) : (
                                                <ArrowUpDown className="w-4 h-4 opacity-50" />
                                            )}
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#e5e7f0] dark:divide-[hsl(231,20%,22%)]" style={{ background: 'linear-gradient(to bottom, #ffffff, #fafbfc)' }}>
                                {appointments.data.length > 0 ? (
                                    appointments.data.map((appointment, index) => (
                                        <tr 
                                            key={appointment.id} 
                                            className="hover:bg-gradient-to-b hover:from-[#f8f9fc] hover:to-[#f4f5f9] dark:hover:from-[hsl(231,25%,18%)] dark:hover:to-[hsl(231,25%,16%)] transition-colors duration-150 dark:bg-[hsl(231,25%,14%)]"
                                        >
                                            <td className="px-4 py-3 whitespace-nowrap dark:text-[hsl(231,15%,60%)]" style={{ color: '#6b7494' }}>
                                                {appointments.from + index}
                                            </td>
                                            <td className="px-4 py-3 dark:text-[hsl(231,15%,92%)] font-medium whitespace-nowrap" style={{ color: '#2e3f84' }}>
                                                {appointment.nom_paciente || '-'}
                                            </td>
                                            <td className="px-4 py-3 dark:text-[hsl(231,15%,92%)] font-semibold whitespace-nowrap" style={{ color: '#2e3f84' }}>
                                                {appointment.citide || '-'}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap dark:text-[hsl(231,15%,60%)]" style={{ color: '#6b7494' }}>
                                                {appointment.pactel || '-'}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap dark:text-[hsl(231,15%,60%)]" style={{ color: '#6b7494' }}>
                                                {appointment.citfc || '-'}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap dark:text-[hsl(231,15%,60%)]" style={{ color: '#6b7494' }}>
                                                {appointment.cithor || '-'}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap dark:text-[hsl(231,15%,60%)]" style={{ color: '#6b7494' }}>
                                                {appointment.mednom || '-'}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap dark:text-[hsl(231,15%,60%)]" style={{ color: '#6b7494' }}>
                                                {appointment.espnom || '-'}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                {getStatusBadge(appointment)}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={9} className="px-4 py-8 text-center dark:text-[hsl(231,15%,60%)]" style={{ color: '#6b7494' }}>
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
                            <p className="text-sm dark:text-[hsl(231,15%,60%)]" style={{ color: '#6b7494' }}>
                                Página {appointments.current_page} de {appointments.last_page}
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => router.get(appointments.prev_page_url || '', {}, { preserveState: true, preserveScroll: true })}
                                    disabled={!appointments.prev_page_url}
                                    className="px-3 py-2 rounded-none border border-[#d4d8e8] dark:border-[hsl(231,20%,22%)] dark:text-[hsl(231,15%,92%)] hover:bg-[#f8f9fc] dark:hover:bg-[hsl(231,25%,18%)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-1"
                                    style={{ color: '#2e3f84' }}
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    Anterior
                                </button>
                                <button
                                    onClick={() => router.get(appointments.next_page_url || '', {}, { preserveState: true, preserveScroll: true })}
                                    disabled={!appointments.next_page_url}
                                    className="px-3 py-2 rounded-none border border-[#d4d8e8] dark:border-[hsl(231,20%,22%)] dark:text-[hsl(231,15%,92%)] hover:bg-[#f8f9fc] dark:hover:bg-[hsl(231,25%,18%)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-1"
                                    style={{ color: '#2e3f84' }}
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

