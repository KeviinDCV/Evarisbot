import AdminLayout from '@/layouts/admin-layout';
import {
    BOTON_PRIMARIO,
    BOTON_SECUNDARIO,
    Buscador,
    COLUMNAS_CITA,
    FILETE,
    FOCO,
    FilaCita,
    HOJA,
    TEXTO_NAVY,
    TEXTO_SUAVE,
    Th,
    miles,
} from '@/components/appointments/piezas-citas';
import { cn } from '@/lib/utils';
import { Head, router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, CalendarCheck2, CalendarX, Clock, ArrowLeft, Calendar, CalendarRange, Download, ArrowUpDown, ArrowUp, ArrowDown, Check, X, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

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

// Filete vertical entre cifras. Solo cuando la franja va en una fila.
const Divisor = () => <div className="hidden w-px self-stretch bg-[#2e3f84]/12 @5xl/pagina:block dark:bg-white/10" aria-hidden="true" />;

// Campo de fecha: borde navy al 58 % (3,1:1 contra la hoja), como los campos de Configuración.
const CAMPO_FECHA = cn(
    'h-9 w-[136px] rounded-[10px] bg-white px-2.5 text-[13px] leading-[18px] font-medium text-[#2e3f84] tabular-nums shadow-[inset_0_0_0_1px_rgba(46,63,132,0.58)] transition-shadow outline-none',
    'focus:shadow-[inset_0_0_0_1px_#2e3f84,0_0_0_3px_rgba(46,63,132,0.2)]',
    'dark:bg-white/[0.04] dark:text-neutral-100 dark:shadow-[inset_0_0_0_1px_var(--color-neutral-500)] dark:[color-scheme:dark] dark:focus:shadow-[inset_0_0_0_1px_#8b9ae0,0_0_0_3px_rgba(139,154,224,0.3)]'
);

export default function AppointmentsView({ appointments, filter: initialFilter, search: initialSearch, date_from: initialDateFrom, date_to: initialDateTo, sort: initialSort, direction: initialDirection, stats, routePrefix = '/admin/appointments', pageTitle }: AppointmentsViewProps) {
    const { t, i18n } = useTranslation();
    const lng = i18n.language;
    const resolvedPageTitle = pageTitle ?? t('appointments.managementTitle');
    const [filter, setFilter] = useState(initialFilter || 'all');
    const [searchTerm, setSearchTerm] = useState(initialSearch || '');
    const [dateFrom, setDateFrom] = useState(initialDateFrom || '');
    const [dateTo, setDateTo] = useState(initialDateTo || '');
    const [sortField, setSortField] = useState<string | null>(initialSort || 'id');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>((initialDirection as 'asc' | 'desc') || 'desc');

    // General y Oncología comparten esta pantalla: el ámbito sale del prefijo de rutas que manda el servidor.
    const esOncologia = routePrefix.includes('oncology');

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

    const filterButtons: { key: string; label: string; icon: LucideIcon; tono: string; count: number }[] = [
        { key: 'all', label: t('common.allFeminine'), icon: Calendar, tono: TEXTO_NAVY, count: stats.all },
        { key: 'pending', label: t('appointments.filterPending'), icon: Clock, tono: 'text-amber-600 dark:text-amber-400', count: stats.pending },
        { key: 'confirmed', label: t('appointments.filterConfirmed'), icon: CalendarCheck2, tono: 'text-emerald-600 dark:text-emerald-400', count: stats.confirmed },
        { key: 'cancelled', label: t('appointments.filterCancelled'), icon: CalendarX, tono: 'text-red-600 dark:text-red-400', count: stats.cancelled },
    ];

    // Cabecera ordenable: los mismos campos e indicadores de siempre.
    const columnas: { campo: string | null; activos: string[]; etiqueta: string; derecha?: boolean }[] = [
        { campo: 'id', activos: ['id'], etiqueta: '#', derecha: true },
        { campo: 'nom_paciente', activos: ['nom_paciente', 'citide'], etiqueta: t('appointments.columnPatient') },
        { campo: 'citfc', activos: ['citfc', 'cithor'], etiqueta: t('appointments.columnAppointment') },
        { campo: 'mednom', activos: ['mednom', 'espnom'], etiqueta: t('appointments.columnProfessional') },
        { campo: 'reminder_status', activos: ['reminder_status'], etiqueta: t('appointments.columnReminder') },
        { campo: null, activos: [], etiqueta: t('appointments.columnResponse') },
    ];

    const exportHref = `${routePrefix}/export?filter=${filter}&search=${searchTerm || ''}&date_from=${dateFrom || ''}&date_to=${dateTo || ''}`;

    return (
        <AdminLayout>
            <Head title={resolvedPageTitle} />

            <div className="min-h-screen bg-background px-4 pt-5 pb-8 md:px-7 md:pt-7 lg:pb-0">
                <div className="@container/pagina mx-auto flex max-w-7xl flex-col gap-6">
                    {/* ── Cabecera ── */}
                    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                        <div className="flex min-w-0 flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
                                <h1 className={cn('text-[28px] leading-[34px] font-semibold tracking-[-0.025em]', TEXTO_NAVY)}>{t('appointments.allAppointmentsTitle')}</h1>
                                <span
                                    title={t('appointments.scopeChipTitle')}
                                    className="inline-flex h-6 items-center rounded-[7px] bg-[#2e3f84]/7 px-2.5 text-[12px] leading-4 font-semibold whitespace-nowrap text-[#2e3f84] dark:bg-white/8 dark:text-neutral-100"
                                >
                                    {esOncologia ? t('navigation.appointmentsOncology') : t('navigation.appointmentsGeneral')}
                                </span>
                            </div>
                            <p className="text-[14px] leading-5 text-muted-foreground">{t('appointments.viewSubtitle')}</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 sm:shrink-0">
                            <button type="button" onClick={() => router.get(`${routePrefix}`)} className={BOTON_SECUNDARIO}>
                                <ArrowLeft strokeWidth={1.9} aria-hidden="true" />
                                {t('appointments.backToAppointments')}
                            </button>
                            <a href={exportHref} title={t('appointments.exportHint')} className={BOTON_PRIMARIO}>
                                <Download strokeWidth={2} aria-hidden="true" />
                                {t('appointments.exportExcel')}
                            </a>
                        </div>
                    </header>

                    {/* ── Franja: las cuatro cifras son los filtros (pulsar la activa la quita) ── */}
                    <section
                        aria-label={t('appointments.filtersTitle')}
                        className="grid grid-cols-2 gap-x-6 gap-y-5 @5xl/pagina:grid-cols-[repeat(3,minmax(0,1fr)_1px)_minmax(0,1fr)] @5xl/pagina:gap-y-0"
                    >
                        {filterButtons.map(({ key, label, icon: Icon, tono, count }, i) => {
                            const activa = filter === key;
                            const detalle = !activa ? t('appointments.applyFilter') : key === 'all' ? t('appointments.filterActive') : t('appointments.removeFilter');

                            return [
                                i > 0 && <Divisor key={`d-${key}`} />,
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => handleFilterChange(key)}
                                    aria-pressed={activa}
                                    className={cn(
                                        'group relative -m-2 flex min-w-0 cursor-pointer flex-col rounded-xl p-2 pb-3.5 text-left transition-colors hover:bg-[#2e3f84]/[0.04] dark:hover:bg-white/[0.04]',
                                        FOCO
                                    )}
                                >
                                    <span className="flex h-4 items-center gap-2">
                                        <Icon className={cn('size-3.5 shrink-0', tono)} strokeWidth={2} aria-hidden="true" />
                                        <span className={cn('truncate text-[12px] leading-4', activa ? cn('font-semibold', TEXTO_NAVY) : 'font-medium text-muted-foreground')}>{label}</span>
                                    </span>
                                    <span className={cn('mt-[7px] text-[28px] leading-8 font-medium tracking-[-0.03em] whitespace-nowrap tabular-nums', TEXTO_NAVY)}>{miles(count, lng)}</span>
                                    <span
                                        className={cn(
                                            'mt-[5px] flex h-4 min-w-0 items-center gap-1.5 text-[12.5px] leading-4',
                                            activa ? cn('font-semibold', TEXTO_NAVY) : 'text-muted-foreground group-hover:text-[#2e3f84] dark:group-hover:text-neutral-200'
                                        )}
                                    >
                                        {activa && <Check className="size-[13px] shrink-0" strokeWidth={2.5} aria-hidden="true" />}
                                        <span className="truncate">{detalle}</span>
                                    </span>
                                    {activa && <span className="absolute right-2 bottom-0 left-2 h-[3px] rounded-[3px] bg-[#2e3f84] dark:bg-[#8b9ae0]" aria-hidden="true" />}
                                </button>,
                            ];
                        })}
                    </section>

                    {/* ── La hoja: barra (buscar + fechas), cabecera ordenable, citas y paginado fijo al pie ── */}
                    <section aria-label={t('appointments.allAppointmentsTitle')} className={cn(HOJA, 'lg:rounded-b-none')}>
                        <div className={cn('flex flex-wrap items-center gap-x-3.5 gap-y-3 border-b px-4 py-3 @3xl/hoja:px-5 @5xl/hoja:min-h-16 @5xl/hoja:py-2.5', FILETE)}>
                            <Buscador
                                id="view-search"
                                etiqueta={t('appointments.searchAppointmentsLabel')}
                                placeholder={t('appointments.viewSearchPlaceholder')}
                                value={searchTerm}
                                onChange={handleSearch}
                                className="w-full @5xl/hoja:w-[410px] @5xl/hoja:shrink-0"
                            />
                            <div className="mx-1 hidden h-7 w-px bg-[#2e3f84]/12 @5xl/hoja:block dark:bg-white/10" aria-hidden="true" />
                            <fieldset className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2.5">
                                <legend className="sr-only">{t('appointments.filterByAppointmentDate')}</legend>
                                <span className={cn('flex items-center gap-[7px] text-[12.5px] leading-4 font-semibold whitespace-nowrap', TEXTO_NAVY)} aria-hidden="true">
                                    <CalendarRange className="size-[15px]" strokeWidth={1.9} />
                                    {t('appointments.filterByAppointmentDate')}
                                </span>
                                <span className="flex items-center gap-2">
                                    <label htmlFor="date-from" className={cn('text-[12.5px] leading-4 font-medium whitespace-nowrap', TEXTO_SUAVE)}>
                                        {t('appointments.dateFrom')}
                                    </label>
                                    <input
                                        id="date-from"
                                        name="date-from"
                                        type="date"
                                        value={dateFrom}
                                        onChange={(e) => handleDateChange('from', e.target.value)}
                                        className={CAMPO_FECHA}
                                    />
                                </span>
                                <span className="flex items-center gap-2">
                                    <label htmlFor="date-to" className={cn('text-[12.5px] leading-4 font-medium whitespace-nowrap', TEXTO_SUAVE)}>
                                        {t('appointments.dateTo')}
                                    </label>
                                    <input
                                        id="date-to"
                                        name="date-to"
                                        type="date"
                                        value={dateTo}
                                        onChange={(e) => handleDateChange('to', e.target.value)}
                                        className={CAMPO_FECHA}
                                    />
                                </span>
                                <button
                                    type="button"
                                    onClick={handleClearDates}
                                    disabled={!dateFrom && !dateTo}
                                    className={cn(
                                        'flex h-8 cursor-pointer items-center gap-[5px] rounded-lg px-2 text-[12.5px] leading-4 font-semibold whitespace-nowrap transition-colors hover:bg-[#2e3f84]/6 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent dark:hover:bg-white/8',
                                        TEXTO_NAVY,
                                        FOCO
                                    )}
                                >
                                    <X className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
                                    {t('appointments.clearDates')}
                                </button>
                            </fieldset>
                        </div>

                        {/* Cabecera ordenable (hoja ≥ 768 px). */}
                        <div
                            className={cn(
                                'hidden h-9 border-b bg-card bg-[image:linear-gradient(rgba(46,63,132,0.028),rgba(46,63,132,0.028))] lg:sticky lg:top-0 lg:z-[2] @3xl/hoja:grid dark:bg-[image:linear-gradient(rgba(255,255,255,0.03),rgba(255,255,255,0.03))]',
                                COLUMNAS_CITA,
                                FILETE
                            )}
                        >
                            {columnas.map(({ campo, activos, etiqueta, derecha }) => {
                                if (!campo) return <Th key="respuesta">{etiqueta}</Th>;
                                const activa = !!sortField && activos.includes(sortField);
                                const Flecha = activa ? (sortDirection === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;

                                return (
                                    <button
                                        key={campo}
                                        type="button"
                                        onClick={() => handleSort(campo)}
                                        title={t('appointments.sortBy', { column: etiqueta === '#' ? '#' : etiqueta.toLocaleLowerCase(lng) })}
                                        aria-label={t('appointments.sortBy', { column: etiqueta === '#' ? '#' : etiqueta.toLocaleLowerCase(lng) })}
                                        className={cn('-mx-1.5 flex h-7 min-w-0 cursor-pointer items-center gap-1.5 rounded-md px-1.5 transition-colors hover:bg-[#2e3f84]/6 dark:hover:bg-white/8', derecha && 'justify-end', FOCO)}
                                    >
                                        <Th activa={activa}>{etiqueta}</Th>
                                        <Flecha
                                            className={cn('size-[13px] shrink-0', activa ? TEXTO_NAVY : 'text-[#2e3f84]/45 dark:text-neutral-500')}
                                            strokeWidth={2}
                                            aria-hidden="true"
                                        />
                                    </button>
                                );
                            })}
                        </div>

                        {appointments.data.length > 0 ? (
                            <ul aria-label={t('appointments.allAppointmentsTitle')}>
                                {appointments.data.map((appointment, index) => (
                                    <FilaCita key={appointment.id} cita={appointment} indice={appointments.from + index} conCedula />
                                ))}
                            </ul>
                        ) : (
                            <p className={cn('border-b px-4 py-14 text-center text-[13px] leading-[18px]', FILETE, TEXTO_SUAVE)}>{t('appointments.noAppointmentsFound')}</p>
                        )}

                        {/* Paginado fijo al pie de la hoja (el scroll, desde lg, es el de la isla). */}
                        <div
                            className={cn(
                                'bottom-0 z-[3] flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 rounded-b-2xl border-t bg-card/95 px-4 py-3 backdrop-blur-sm lg:sticky lg:rounded-none lg:shadow-[0_-10px_20px_-14px_rgba(46,63,132,0.25)] @3xl/hoja:min-h-14 @3xl/hoja:pr-5 @3xl/hoja:pl-16 dark:lg:shadow-[0_-10px_20px_-14px_rgba(0,0,0,0.6)]',
                                'border-[#2e3f84]/12 dark:border-white/10',
                                '-mt-px'
                            )}
                        >
                            <p className={cn('text-[12.5px] leading-4 tabular-nums', TEXTO_SUAVE)} aria-live="polite">
                                {appointments.total > 0 ? (
                                    <Trans
                                        i18nKey="appointments.showingResultsRich"
                                        values={{ from: miles(appointments.from ?? 0, lng), to: miles(appointments.to ?? 0, lng), total: miles(appointments.total, lng) }}
                                        components={{ strong: <span className={cn('font-semibold', TEXTO_NAVY)} /> }}
                                    />
                                ) : (
                                    t('appointments.resultsTitle', { count: 0 })
                                )}
                            </p>

                            {appointments.last_page > 1 && (
                                <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
                                    <span className={cn('text-[12.5px] leading-4 font-medium tabular-nums', TEXTO_SUAVE)}>
                                        <Trans
                                            i18nKey="appointments.pageOfRich"
                                            values={{ current: miles(appointments.current_page, lng), total: miles(appointments.last_page, lng) }}
                                            components={{ strong: <span className={cn('font-semibold', TEXTO_NAVY)} /> }}
                                        />
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => router.get(appointments.prev_page_url || '', {}, { preserveState: true, preserveScroll: true })}
                                            disabled={!appointments.prev_page_url}
                                            title={!appointments.prev_page_url ? t('appointments.noPreviousPage') : undefined}
                                            className={cn(BOTON_SECUNDARIO, 'h-[34px] pr-3 pl-[9px] disabled:opacity-45')}
                                        >
                                            <ChevronLeft strokeWidth={2} aria-hidden="true" />
                                            {t('common.previous')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => router.get(appointments.next_page_url || '', {}, { preserveState: true, preserveScroll: true })}
                                            disabled={!appointments.next_page_url}
                                            className={cn(BOTON_SECUNDARIO, 'h-[34px] pr-[9px] pl-3 disabled:opacity-45')}
                                        >
                                            {t('common.next')}
                                            <ChevronRight strokeWidth={2} aria-hidden="true" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </AdminLayout>
    );
}
