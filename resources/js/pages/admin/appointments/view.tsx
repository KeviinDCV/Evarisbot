import AdminLayout from '@/layouts/admin-layout';
import { Head, router } from '@inertiajs/react';
import { Search, ChevronLeft, ChevronRight, CalendarCheck, CalendarX, Clock, Filter, ArrowLeft, Calendar, Download, ArrowUpDown, ArrowUp, ArrowDown, Phone, XCircle, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
    routePrefix?: string;
    pageTitle?: string;
}

export default function AppointmentsView({ appointments, filter: initialFilter, search: initialSearch, date_from: initialDateFrom, date_to: initialDateTo, sort: initialSort, direction: initialDirection, stats, routePrefix = '/admin/appointments', pageTitle }: AppointmentsViewProps) {
    const { t } = useTranslation();
    const resolvedPageTitle = pageTitle ?? t('appointments.managementTitle');
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

        router.get(`${routePrefix}/view`, {
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

    const handleFilterChange = (clickedFilter: string) => {
        // Volver a pulsar el filtro activo lo quita (vuelve a "Todas"). Sin esto, una vez
        // aplicado un filtro no había forma de soltarlo salvo pulsando "Todas" a propósito.
        // "Todas" ya ES el estado sin filtro, así que no se alterna consigo mismo.
        const newFilter = clickedFilter === filter && clickedFilter !== 'all' ? 'all' : clickedFilter;

        setFilter(newFilter);
        router.get(`${routePrefix}/view`, {
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
        router.get(`${routePrefix}/view`, {
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

        router.get(`${routePrefix}/view`, {
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
        router.get(`${routePrefix}/view`, {
            filter,
            search: searchTerm || undefined,
        }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const filterButtons = [
        { key: 'all', label: t('common.allFeminine'), icon: Filter, count: stats.all },
        { key: 'pending', label: t('appointments.filterPending'), icon: Clock, count: stats.pending },
        { key: 'confirmed', label: t('appointments.filterConfirmed'), icon: CalendarCheck, count: stats.confirmed },
        { key: 'cancelled', label: t('appointments.filterCancelled'), icon: CalendarX, count: stats.cancelled },
    ];

    const getStatusBadge = (appointment: Appointment) => {
        if (!appointment.reminder_sent) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium">
                    <Clock className="w-3 h-3" />
                    {t('appointments.badgePending')}
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
                <CalendarCheck className="w-3 h-3" />
                {t('appointments.badgeSent')}
            </span>
        );
    };

    const getDeliveryStatusBadge = (appointment: Appointment) => {
        if (!appointment.reminder_sent) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-medium settings-subtitle">
                    —
                </span>
            );
        }

        if (appointment.reminder_status === 'failed') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-medium">
                    <CalendarX className="w-3 h-3" />
                    {t('appointments.badgeError')}
                </span>
            );
        }

        if (appointment.reminder_status && ['delivered', 'read', 'confirmed', 'cancelled'].includes(appointment.reminder_status)) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium">
                    <CalendarCheck className="w-3 h-3" />
                    {t('appointments.badgeReceived')}
                </span>
            );
        }

        return (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium">
                <Clock className="w-3 h-3" />
                {t('appointments.badgeNoResponse')}
            </span>
        );
    };

    return (
        <AdminLayout>
            <Head title={resolvedPageTitle} />

            <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
                <div className="mx-auto flex max-w-7xl flex-col gap-5">
                    <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start gap-3">
                            <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#d4d8e8] bg-white/70 text-[#2e3f84] shadow-sm shadow-[#2e3f84]/5 dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-100">
                                <CalendarCheck className="h-5 w-5" />
                            </div>
                            <div>
                                <h1 className="font-bold settings-title" style={{ fontSize: 'var(--text-3xl)' }}>
                                    {resolvedPageTitle}
                                </h1>
                                <p className="settings-subtitle" style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-xs)' }}>
                                    {t('appointments.viewSubtitle')}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Button onClick={() => router.get(`${routePrefix}`)} className="h-9 rounded-xl px-4 text-xs font-semibold settings-btn-secondary">
                                <ArrowLeft className="mr-2 h-3.5 w-3.5" />
                                {t('appointments.backToAppointments')}
                            </Button>
                            <a href={`${routePrefix}/export?filter=${filter}&search=${searchTerm || ''}&date_from=${dateFrom || ''}&date_to=${dateTo || ''}`} className="inline-flex h-9 items-center rounded-xl px-4 text-xs font-semibold settings-btn-primary">
                                <Download className="mr-2 h-3.5 w-3.5" />
                                {t('appointments.exportExcel')}
                            </a>
                        </div>
                    </header>

                    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {filterButtons.map(({ key, label, icon: Icon, count }) => (
                            <button
                                key={key}
                                onClick={() => handleFilterChange(key)}
                                className={`card-gradient rounded-2xl border p-4 text-left shadow-sm shadow-[#2e3f84]/5 transition-colors ${filter === key
                                    ? 'border-[#2e3f84]/40 bg-[#2e3f84]/10 dark:border-white/20 dark:bg-white/[0.06]'
                                    : 'border-white/50 hover:border-[#d4d8e8] dark:border-white/10 dark:hover:border-white/20'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#d4d8e8] bg-white/60 text-[#2e3f84] dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-100">
                                        <Icon className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-xs font-semibold settings-subtitle">{label}</p>
                                        <p className="mt-1 text-lg font-bold leading-tight settings-title">{count.toLocaleString()}</p>
                                        <p className="mt-1 text-xs settings-subtitle">
                                            {key !== filter
                                                ? t('appointments.applyFilter')
                                                : key === 'all'
                                                    ? t('appointments.filterActive')
                                                    : t('appointments.removeFilter')}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </section>

                    <section className="card-gradient rounded-2xl border border-white/50 p-5 shadow-sm shadow-[#2e3f84]/5 dark:border-white/10">
                        <div className="mb-4">
                            <h2 className="mb-1 flex items-center gap-2 text-base font-semibold settings-title">
                                <Filter className="h-4 w-4" />
                                {t('appointments.filtersTitle')}
                            </h2>
                            <p className="text-sm settings-subtitle">{t('appointments.filtersSubtitle')}</p>
                        </div>

                        <div className="mb-4">
                            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold settings-title">
                                <Calendar className="h-4 w-4" />
                                {t('appointments.filterByAppointmentDate')}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                    <label htmlFor="date-from" className="block text-xs font-medium settings-label mb-1">{t('appointments.dateFrom')}</label>
                                    <input
                                        id="date-from"
                                        name="date-from"
                                        type="date"
                                        value={dateFrom}
                                        onChange={(e) => handleDateChange('from', e.target.value)}
                                        className="h-9 w-full rounded-xl px-3 text-sm settings-input outline-none transition-all duration-200 focus:ring-2 focus:ring-primary/10"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="date-to" className="block text-xs font-medium settings-label mb-1">{t('appointments.dateTo')}</label>
                                    <input
                                        id="date-to"
                                        name="date-to"
                                        type="date"
                                        value={dateTo}
                                        onChange={(e) => handleDateChange('to', e.target.value)}
                                        className="h-9 w-full rounded-xl px-3 text-sm settings-input outline-none transition-all duration-200 focus:ring-2 focus:ring-primary/10"
                                    />
                                </div>
                                <div className="flex items-end">
                                    <button
                                        onClick={handleClearDates}
                                        disabled={!dateFrom && !dateTo}
                                        className="h-9 w-full rounded-xl border border-[#d4d8e8] bg-white px-4 text-sm font-medium text-[#6b7494] transition-all duration-200 hover:border-[#2e3f84] hover:bg-[#f8f9fc] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-neutral-300 dark:hover:bg-white/5"
                                    >
                                        {t('appointments.clearDates')}
                                    </button>
                                </div>
                            </div>
                            {(dateFrom || dateTo) && (
                                <p className="mt-2 text-xs text-[#2e3f84] dark:text-[hsl(231,55%,70%)] flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {t('appointments.filteringAppointments')} {dateFrom && t('appointments.fromDate', { date: dateFrom })} {dateFrom && dateTo && '-'} {dateTo && t('appointments.toDate', { date: dateTo })}
                                </p>
                            )}
                        </div>

                        {/* Buscador */}
                        <div className="relative">
                            <label htmlFor="view-search" className="sr-only">{t('appointments.searchAppointmentsLabel')}</label>
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7494] dark:text-neutral-400" />
                            <input
                                id="view-search"
                                name="view-search"
                                type="text"
                                placeholder={t('appointments.viewSearchPlaceholder')}
                                value={searchTerm}
                                onChange={(e) => handleSearch(e.target.value)}
                                className="h-9 w-full rounded-xl pl-10 pr-4 text-sm settings-input outline-none transition-all duration-200 focus:ring-2 focus:ring-primary/10"
                            />
                        </div>
                    </section>

                    <section className="card-gradient rounded-2xl border border-white/50 p-5 shadow-sm shadow-[#2e3f84]/5 dark:border-white/10">
                        <div className="mb-4">
                            <h2 className="text-base font-semibold settings-title">
                                {t('appointments.resultsTitle', { count: appointments.total })}
                            </h2>
                            <p className="text-sm settings-subtitle">
                                {t('appointments.showingResults', { from: appointments.from, to: appointments.to, total: appointments.total })}
                            </p>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-[#d4d8e8] dark:border-white/10">
                            <table className="w-full text-left border-collapse">
                                <thead className="border-b border-border bg-black/5 dark:border-white/10 dark:bg-white/5">
                                    <tr>
                                        <th className="cursor-pointer whitespace-nowrap px-4 py-3 font-semibold settings-title transition-colors hover:bg-black/10 dark:hover:bg-white/10" onClick={() => handleSort('id')} style={{ fontSize: 'var(--text-sm)' }}>
                                            <div className="flex items-center gap-2">
                                                #
                                                {sortField === 'id' ? (
                                                    sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                                                ) : (
                                                    <ArrowUpDown className="w-4 h-4 opacity-50" />
                                                )}
                                            </div>
                                        </th>
                                        <th className="cursor-pointer whitespace-nowrap px-4 py-3 font-semibold settings-title transition-colors hover:bg-black/10 dark:hover:bg-white/10" onClick={() => handleSort('nom_paciente')} style={{ fontSize: 'var(--text-sm)' }}>
                                            <div className="flex items-center gap-2">
                                                {t('appointments.columnPatient')}
                                                {sortField === 'nom_paciente' || sortField === 'citide' ? (
                                                    sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                                                ) : (
                                                    <ArrowUpDown className="w-4 h-4 opacity-50" />
                                                )}
                                            </div>
                                        </th>
                                        <th className="cursor-pointer whitespace-nowrap px-4 py-3 font-semibold settings-title transition-colors hover:bg-black/10 dark:hover:bg-white/10" onClick={() => handleSort('citfc')} style={{ fontSize: 'var(--text-sm)' }}>
                                            <div className="flex items-center gap-2">
                                                {t('appointments.columnAppointmentDetails')}
                                                {sortField === 'citfc' || sortField === 'cithor' ? (
                                                    sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                                                ) : (
                                                    <ArrowUpDown className="w-4 h-4 opacity-50" />
                                                )}
                                            </div>
                                        </th>
                                        <th className="cursor-pointer whitespace-nowrap px-4 py-3 font-semibold settings-title transition-colors hover:bg-black/10 dark:hover:bg-white/10" onClick={() => handleSort('mednom')} style={{ fontSize: 'var(--text-sm)' }}>
                                            <div className="flex items-center gap-2">
                                                {t('appointments.columnProfessional')}
                                                {sortField === 'mednom' || sortField === 'espnom' ? (
                                                    sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                                                ) : (
                                                    <ArrowUpDown className="w-4 h-4 opacity-50" />
                                                )}
                                            </div>
                                        </th>
                                        <th className="cursor-pointer whitespace-nowrap px-4 py-3 font-semibold settings-title transition-colors hover:bg-black/10 dark:hover:bg-white/10" onClick={() => handleSort('reminder_status')} style={{ fontSize: 'var(--text-sm)' }}>
                                            <div className="flex items-center gap-2">
                                                {t('appointments.columnSendingStatus')}
                                                {sortField === 'reminder_status' ? (
                                                    sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                                                ) : (
                                                    <ArrowUpDown className="w-4 h-4 opacity-50" />
                                                )}
                                            </div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border dark:divide-white/10">
                                    {appointments.data.length > 0 ? (
                                        appointments.data.map((appointment, index) => (
                                            <tr
                                                key={appointment.id}
                                                className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-200"
                                            >
                                                {/* Índice */}
                                                <td className="px-4 py-4 whitespace-nowrap align-top settings-subtitle font-medium" style={{ fontSize: 'var(--text-sm)' }}>
                                                    {appointments.from + index}
                                                </td>

                                                {/* Paciente, Doc y Teléfono */}
                                                <td className="px-4 py-4 align-top w-[25%] min-w-[200px]">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold settings-title truncate leading-tight" style={{ fontSize: 'var(--text-md)' }}>
                                                            {appointment.nom_paciente || '-'}
                                                        </span>
                                                        <span className="settings-subtitle mt-1" style={{ fontSize: 'var(--text-xs)' }}>
                                                            {t('appointments.idPrefix')} {appointment.citide || '-'}
                                                        </span>
                                                        <span className="settings-subtitle flex items-center gap-1.5 mt-1.5" style={{ fontSize: 'var(--text-sm)' }}>
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
                                                        <span className="settings-subtitle mt-1.5 inline-flex items-center gap-1.5" style={{ fontSize: 'var(--text-xs)' }}>
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
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-8 text-center settings-subtitle">
                                                {t('appointments.noAppointmentsFound')}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Paginación */}
                        {appointments.last_page > 1 && (
                            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm settings-subtitle">
                                    {t('appointments.pageOf', { current: appointments.current_page, total: appointments.last_page })}
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => router.get(appointments.prev_page_url || '', {}, { preserveState: true, preserveScroll: true })}
                                        disabled={!appointments.prev_page_url}
                                        className="flex h-9 items-center gap-2 rounded-xl border border-[#d4d8e8] px-3 text-sm settings-title transition-all duration-200 hover:bg-[#f8f9fc] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/5"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                        {t('common.previous')}
                                    </button>
                                    <button
                                        onClick={() => router.get(appointments.next_page_url || '', {}, { preserveState: true, preserveScroll: true })}
                                        disabled={!appointments.next_page_url}
                                        className="flex h-9 items-center gap-2 rounded-xl border border-[#d4d8e8] px-3 text-sm settings-title transition-all duration-200 hover:bg-[#f8f9fc] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/5"
                                    >
                                        {t('common.next')}
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </AdminLayout>
    );
}

