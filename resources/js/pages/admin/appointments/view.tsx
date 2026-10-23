import AdminLayout from '@/layouts/admin-layout';
import {
    BOTON_APAGADO,
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
    TONO_PUNTO,
    TONO_TEXTO,
    Th,
    esIngles,
    fechaLocal,
    miles,
    type CitaFila,
} from '@/components/appointments/piezas-citas';
import { AvisoCampo } from '@/components/avisos-campo';
import { cn } from '@/lib/utils';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowDown,
    ArrowLeft,
    ArrowUp,
    ArrowUpDown,
    Calendar,
    CalendarCheck2,
    CalendarRange,
    CalendarX,
    Check,
    ChevronLeft,
    ChevronRight,
    CircleAlert,
    CircleX,
    Download,
    LoaderCircle,
    X,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';

type Ambito = 'general' | 'oncology';
type Filtro = 'all' | 'pending' | 'failed' | 'confirmed' | 'cancelled';
type Sentido = 'asc' | 'desc';

interface PaginatedAppointments {
    data: CitaFila[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
    prev_page_url: string | null;
    next_page_url: string | null;
}

// Filtros, búsqueda, fechas y orden ya normalizados por el servidor (lo que de verdad listó).
interface AppointmentsViewProps {
    appointments: PaginatedAppointments;
    filter?: string;
    search?: string | null;
    date_from?: string | null;
    date_to?: string | null;
    sort?: string | null;
    direction?: string | null;
    stats: {
        all: number;
        pending: number;
        failed?: number;
        confirmed: number;
        cancelled: number;
    };
    ambito?: Ambito;
    routePrefix?: string;
    limite_exportar?: number;
}

type Parametros = Partial<Record<'filter' | 'search' | 'date_from' | 'date_to' | 'sort' | 'direction', string>>;

// Espera tras la última tecla antes de buscar: cada búsqueda recorre todas las citas del ámbito.
const ESPERA_BUSQUEDA = 350;

// Solo los que tienen valor viajan en la URL (y en el enlace de exportar).
const limpiar = (p: Parametros) => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== '')) as Record<string, string>;

// Filete vertical entre cifras. Solo cuando la franja va en una fila.
const Divisor = () => <div className="hidden w-px self-stretch bg-[#2e3f84]/12 @5xl/pagina:block dark:bg-white/10" aria-hidden="true" />;

// Campo de fecha: la misma caja de Configuración (borde navy al 58 %, borde real en contraste alto, rojo si no vale).
const CAMPO_FECHA = 'caja-ajuste h-9 w-[136px] rounded-[10px] px-2.5 text-[13px] leading-[18px] font-medium tabular-nums outline-hidden dark:[color-scheme:dark]';
const CAMPO_SELECT = 'caja-ajuste h-9 min-w-0 cursor-pointer rounded-[10px] pr-8 pl-2.5 text-[13px] leading-[18px] outline-hidden';

/** "14 de octubre de 2026" (es) · "October 14, 2026" (en): las fechas del filtro pueden ser de otro año. */
function fechaConAnio(ymd: string, lng: string) {
    const fecha = fechaLocal(ymd);
    if (!fecha) return ymd;
    return fecha.toLocaleDateString(esIngles(lng) ? 'en-US' : 'es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function AppointmentsView({
    appointments,
    filter: filtroServidor,
    search: busquedaServidor,
    date_from: desdeServidor,
    date_to: hastaServidor,
    sort: ordenServidor,
    direction: sentidoServidor,
    stats,
    ambito,
    routePrefix = '/admin/appointments',
    limite_exportar: limiteExportar = 40000,
}: AppointmentsViewProps) {
    const { t, i18n } = useTranslation();
    const lng = i18n.language;
    const { flash } = usePage<{ flash: { success?: string; error?: string } }>().props;
    // El ámbito lo manda el servidor; solo si faltara (respuesta vieja) se deduce de las rutas.
    const esOncologia = (ambito ?? (routePrefix.startsWith('/admin/oncology') ? 'oncology' : 'general')) === 'oncology';
    const nombreAmbito = esOncologia ? t('navigation.appointmentsOncology') : t('navigation.appointmentsGeneral');

    // Lo que el servidor listó: de aquí salen la paginación, la exportación y la nota de las cifras.
    const servidor = {
        filter: filtroServidor || 'all',
        search: busquedaServidor ?? '',
        date_from: desdeServidor ?? '',
        date_to: hastaServidor ?? '',
        sort: ordenServidor || 'id',
        direction: (sentidoServidor === 'asc' ? 'asc' : 'desc') as Sentido,
    };

    const [filter, setFilter] = useState(servidor.filter);
    const [searchTerm, setSearchTerm] = useState(servidor.search);
    const [dateFrom, setDateFrom] = useState(servidor.date_from);
    const [dateTo, setDateTo] = useState(servidor.date_to);
    const [sortField, setSortField] = useState(servidor.sort);
    const [sortDirection, setSortDirection] = useState<Sentido>(servidor.direction);
    const [cargando, setCargando] = useState(false);
    const [preparando, setPreparando] = useState(false);
    const [showFlash, setShowFlash] = useState(true);

    const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const busquedaPendiente = useRef(false);
    const textoEscrito = useRef(servidor.search);
    const visitasEnCurso = useRef(0);

    // Tras cada visita (también atrás/adelante del navegador) la pantalla vuelve a decir lo que listó el
    // servidor. El texto que se está escribiendo no se pisa: solo si el servidor listó otra búsqueda.
    useEffect(() => {
        setFilter(filtroServidor || 'all');
        setDateFrom(desdeServidor ?? '');
        setDateTo(hastaServidor ?? '');
        setSortField(ordenServidor || 'id');
        setSortDirection(sentidoServidor === 'asc' ? 'asc' : 'desc');
        const buscada = busquedaServidor ?? '';
        if (!busquedaPendiente.current && textoEscrito.current.trim().slice(0, 100) !== buscada) {
            textoEscrito.current = buscada;
            setSearchTerm(buscada);
        }
    }, [filtroServidor, busquedaServidor, desdeServidor, hastaServidor, ordenServidor, sentidoServidor]);

    useEffect(() => {
        setShowFlash(true);
    }, [flash?.error]);

    useEffect(() => () => clearTimeout(temporizador.current), []);

    /** Todos los parámetros de la pantalla (siempre con el orden), con los cambios de esta visita. */
    const parametros = (cambios: Parametros = {}) =>
        limpiar({ filter, search: searchTerm.trim(), date_from: dateFrom, date_to: dateTo, sort: sortField, direction: sortDirection, ...cambios });

    const visitar = (datos: Record<string, string | number>, reemplazar = false) => {
        clearTimeout(temporizador.current);
        busquedaPendiente.current = false;
        router.get(`${routePrefix}/view`, datos, {
            preserveState: true,
            preserveScroll: true,
            replace: reemplazar,
            onStart: () => {
                visitasEnCurso.current += 1;
                setCargando(true);
            },
            onFinish: () => {
                visitasEnCurso.current = Math.max(0, visitasEnCurso.current - 1);
                setCargando(visitasEnCurso.current > 0);
            },
        });
    };

    const cambiarOrden = (campo: string, sentido: Sentido) => {
        setSortField(campo);
        setSortDirection(sentido);
        visitar(parametros({ sort: campo, direction: sentido }));
    };

    const handleSort = (campo: string) => cambiarOrden(campo, sortField === campo && sortDirection === 'asc' ? 'desc' : 'asc');

    const handleFilterChange = (clave: Filtro) => {
        // Volver a pulsar el filtro activo lo quita (vuelve a "Todas"); "Todas" no se alterna consigo mismo.
        const nuevo = clave === filter && clave !== 'all' ? 'all' : clave;
        setFilter(nuevo);
        visitar(parametros({ filter: nuevo }));
    };

    const handleSearch = (valor: string) => {
        setSearchTerm(valor);
        textoEscrito.current = valor;
        busquedaPendiente.current = true;
        clearTimeout(temporizador.current);
        temporizador.current = setTimeout(() => visitar(parametros({ search: valor.trim() }), true), ESPERA_BUSQUEDA);
    };

    const handleDateChange = (tipo: 'from' | 'to', valor: string) => {
        if (tipo === 'from') setDateFrom(valor);
        else setDateTo(valor);
        visitar(parametros(tipo === 'from' ? { date_from: valor } : { date_to: valor }));
    };

    const handleClearDates = () => {
        setDateFrom('');
        setDateTo('');
        visitar(parametros({ date_from: '', date_to: '' }));
    };

    const quitarFiltros = () => {
        setFilter('all');
        setSearchTerm('');
        textoEscrito.current = '';
        setDateFrom('');
        setDateTo('');
        visitar(parametros({ filter: 'all', search: '', date_from: '', date_to: '' }));
    };

    // Paginación y exportación salen de lo que el servidor listó (no de un texto a medio escribir).
    const delServidor = limpiar(servidor);
    const irAPagina = (pagina: number) => visitar({ ...delServidor, page: pagina }, false);
    const exportHref = `${routePrefix}/export?${new URLSearchParams(delServidor).toString()}`;
    const demasiadas = appointments.total > limiteExportar;
    const exportarApagado = demasiadas || appointments.total === 0;

    const exportar = () => {
        // La descarga tarda unos segundos en empezar: así no se pide dos veces.
        setPreparando(true);
        window.setTimeout(() => setPreparando(false), 6000);
    };

    const hayFiltros = servidor.filter !== 'all' || !!servidor.search || !!servidor.date_from || !!servidor.date_to;
    const rangoInvertido = !!dateFrom && !!dateTo && dateTo < dateFrom;

    // Las cifras siguen las fechas y la búsqueda (no el filtro de estado): se dice de qué citas son.
    const notaCifras = [
        servidor.date_from && servidor.date_to
            ? t('appointments.countsBetween', { from: fechaConAnio(servidor.date_from, lng), to: fechaConAnio(servidor.date_to, lng) })
            : servidor.date_from
              ? t('appointments.countsFrom', { from: fechaConAnio(servidor.date_from, lng) })
              : servidor.date_to
                ? t('appointments.countsTo', { to: fechaConAnio(servidor.date_to, lng) })
                : '',
        servidor.search ? t('appointments.countsSearch') : '',
    ]
        .filter(Boolean)
        .join(' ');

    const filterButtons: { key: Filtro; label: string; marca: ReactNode; count: number }[] = [
        { key: 'all', label: t('common.allFeminine'), marca: <Calendar className={cn('size-3.5', TEXTO_NAVY)} strokeWidth={2} aria-hidden="true" />, count: stats.all },
        {
            key: 'pending',
            label: t('appointments.filterPending'),
            marca: (
                <span className="flex size-3.5 items-center justify-center" aria-hidden="true">
                    <span className={cn('size-[7px] rounded-full', TONO_PUNTO.neutro)} />
                </span>
            ),
            count: stats.pending,
        },
        { key: 'failed', label: t('appointments.filterFailed'), marca: <CircleX className="size-3.5 text-red-600 dark:text-red-400" strokeWidth={2} aria-hidden="true" />, count: stats.failed ?? 0 },
        {
            key: 'confirmed',
            label: t('appointments.filterConfirmed'),
            marca: <CalendarCheck2 className="size-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={2} aria-hidden="true" />,
            count: stats.confirmed,
        },
        { key: 'cancelled', label: t('appointments.filterCancelled'), marca: <CalendarX className="size-3.5 text-red-600 dark:text-red-400" strokeWidth={2} aria-hidden="true" />, count: stats.cancelled },
    ];

    // Cabecera ordenable: los mismos campos e indicadores de siempre.
    const columnas: { campo: string | null; activos: string[]; etiqueta: string }[] = [
        { campo: 'id', activos: ['id'], etiqueta: '#' },
        { campo: 'nom_paciente', activos: ['nom_paciente', 'citide'], etiqueta: t('appointments.columnPatient') },
        { campo: 'citfc', activos: ['citfc', 'cithor'], etiqueta: t('appointments.columnAppointment') },
        { campo: 'mednom', activos: ['mednom', 'espnom'], etiqueta: t('appointments.columnProfessional') },
        { campo: 'reminder_status', activos: ['reminder_status'], etiqueta: t('appointments.columnReminder') },
        { campo: null, activos: [], etiqueta: t('appointments.columnResponse') },
    ];
    const ordenables = columnas.filter((c): c is { campo: string; activos: string[]; etiqueta: string } => c.campo !== null);
    const campoElegido = ordenables.find((c) => c.activos.includes(sortField))?.campo ?? 'id';

    return (
        <AdminLayout>
            <Head title={t('appointments.tabTitleAll', { scope: nombreAmbito })} />

            <div className="min-h-screen bg-background px-4 pt-5 pb-8 md:px-7 md:pt-7 lg:pb-0">
                <div className="@container/pagina mx-auto flex max-w-7xl flex-col gap-6">
                    {/* ── Cabecera ── */}
                    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                        <div className="flex min-w-0 flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
                                <h1 className={cn('text-[28px] leading-[34px] font-semibold tracking-[-0.025em]', TEXTO_NAVY)}>{t('appointments.allAppointmentsTitle')}</h1>
                                <span
                                    title={t('appointments.scopeChipTitle')}
                                    className="inline-flex h-6 items-center rounded-[7px] bg-[#2e3f84]/7 px-2.5 text-[12px] leading-4 font-semibold whitespace-nowrap text-[#2e3f84] forced-colors:border dark:bg-white/8 dark:text-neutral-100"
                                >
                                    {nombreAmbito}
                                </span>
                            </div>
                            <p className="text-[14px] leading-5 text-muted-foreground">{t('appointments.viewSubtitle')}</p>
                        </div>

                        <div className="flex flex-col items-start gap-1.5 sm:shrink-0 sm:items-end">
                            <div className="flex flex-wrap items-center gap-2.5">
                                <Link href={routePrefix} className={BOTON_SECUNDARIO}>
                                    <ArrowLeft strokeWidth={1.9} aria-hidden="true" />
                                    {t('appointments.backToAppointments')}
                                </Link>
                                {exportarApagado ? (
                                    <button type="button" disabled aria-describedby={demasiadas ? 'export-limit' : undefined} className={BOTON_APAGADO}>
                                        <Download strokeWidth={2} aria-hidden="true" />
                                        {appointments.total === 0 ? t('appointments.exportNone') : t('appointments.exportCount', { count: appointments.total, value: miles(appointments.total, lng) })}
                                    </button>
                                ) : (
                                    <a
                                        href={exportHref}
                                        onClick={(event) => {
                                            if (preparando) event.preventDefault();
                                            else exportar();
                                        }}
                                        aria-disabled={preparando || undefined}
                                        title={t('appointments.exportHint')}
                                        className={cn(preparando ? BOTON_APAGADO : BOTON_PRIMARIO, preparando && 'cursor-wait')}
                                    >
                                        {preparando ? (
                                            <LoaderCircle className="animate-spin motion-reduce:animate-none" strokeWidth={2} aria-hidden="true" />
                                        ) : (
                                            <Download strokeWidth={2} aria-hidden="true" />
                                        )}
                                        {preparando ? t('appointments.exportPreparing') : t('appointments.exportCount', { count: appointments.total, value: miles(appointments.total, lng) })}
                                    </a>
                                )}
                            </div>
                            {demasiadas && (
                                <p id="export-limit" className={cn('text-[12.5px] leading-4 font-medium', TONO_TEXTO.aviso)}>
                                    {t('appointments.exportTooMany', { max: miles(limiteExportar, lng) })}
                                </p>
                            )}
                        </div>
                    </header>

                    {/* El tope de la exportación (y otros errores) vuelve como aviso de la sesión. */}
                    {showFlash && flash?.error && (
                        <div
                            role="alert"
                            className="flex items-start gap-3 rounded-xl bg-red-50 px-4 py-3 text-[13px] leading-[18px] font-medium text-red-800 shadow-[inset_0_0_0_1px_var(--color-red-200)] forced-colors:border dark:bg-red-500/10 dark:text-red-300 dark:shadow-[inset_0_0_0_1px_rgba(239,68,68,0.28)]"
                        >
                            <CircleAlert className="mt-px size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                            <p className="min-w-0 flex-1">{flash.error}</p>
                            <button
                                type="button"
                                onClick={() => setShowFlash(false)}
                                aria-label={t('appointments.closeNotice')}
                                title={t('appointments.closeNotice')}
                                className={cn('-my-1 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/10', FOCO)}
                            >
                                <X className="size-4" aria-hidden="true" />
                            </button>
                        </div>
                    )}

                    {/* ── Franja: las cinco cifras son los filtros (pulsar la activa la quita) ── */}
                    <div className="flex flex-col gap-3">
                        <section
                            aria-label={t('appointments.filtersTitle')}
                            className="grid grid-cols-2 gap-x-6 gap-y-5 @3xl/pagina:grid-cols-3 @5xl/pagina:grid-cols-[repeat(4,minmax(0,1fr)_1px)_minmax(0,1fr)] @5xl/pagina:gap-y-0"
                        >
                            {filterButtons.map(({ key, label, marca, count }, i) => {
                                const activa = filter === key;
                                const detalle = !activa ? t('appointments.applyFilter') : key === 'all' ? t('appointments.filterNone') : t('appointments.removeFilter');

                                return [
                                    i > 0 && <Divisor key={`d-${key}`} />,
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => handleFilterChange(key)}
                                        aria-pressed={activa}
                                        className={cn(
                                            'group relative -m-2 flex min-w-0 cursor-pointer flex-col rounded-xl p-2 pb-3.5 text-left transition-colors hover:bg-[#2e3f84]/[0.04] forced-colors:border dark:hover:bg-white/[0.04]',
                                            FOCO
                                        )}
                                    >
                                        <span className="flex min-h-4 items-start gap-2">
                                            <span className="mt-px shrink-0">{marca}</span>
                                            <span
                                                className={cn(
                                                    'line-clamp-2 text-[12px] leading-4 @5xl/pagina:line-clamp-1',
                                                    activa ? cn('font-semibold', TEXTO_NAVY) : 'font-medium text-muted-foreground'
                                                )}
                                            >
                                                {label}
                                            </span>
                                        </span>
                                        <span className={cn('mt-[7px] text-[28px] leading-8 font-medium tracking-[-0.03em] whitespace-nowrap tabular-nums', TEXTO_NAVY)}>{miles(count, lng)}</span>
                                        <span
                                            className={cn(
                                                'mt-[5px] flex min-h-4 min-w-0 items-start gap-1.5 text-[12.5px] leading-4',
                                                activa ? cn('font-semibold', TEXTO_NAVY) : 'text-muted-foreground group-hover:text-[#2e3f84] dark:group-hover:text-neutral-200'
                                            )}
                                        >
                                            {activa && <Check className="mt-px size-[13px] shrink-0" strokeWidth={2.5} aria-hidden="true" />}
                                            <span className="line-clamp-2 @5xl/pagina:line-clamp-1">{detalle}</span>
                                        </span>
                                        {activa && (
                                            <span
                                                className="absolute right-2 bottom-0 left-2 h-[3px] rounded-[3px] bg-[#2e3f84] forced-color-adjust-none forced-colors:bg-[Highlight] dark:bg-[#8b9ae0]"
                                                aria-hidden="true"
                                            />
                                        )}
                                    </button>,
                                ];
                            })}
                        </section>
                        {notaCifras && <p className={cn('text-[12.5px] leading-4', TEXTO_SUAVE)}>{notaCifras}</p>}
                    </div>

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
                                        max={dateTo || undefined}
                                        onChange={(e) => handleDateChange('from', e.target.value)}
                                        className={CAMPO_FECHA}
                                    />
                                </span>
                                <span className="relative flex items-center gap-2">
                                    <label htmlFor="date-to" className={cn('text-[12.5px] leading-4 font-medium whitespace-nowrap', TEXTO_SUAVE)}>
                                        {t('appointments.dateTo')}
                                    </label>
                                    <input
                                        id="date-to"
                                        name="date-to"
                                        type="date"
                                        value={dateTo}
                                        min={dateFrom || undefined}
                                        onChange={(e) => handleDateChange('to', e.target.value)}
                                        aria-invalid={rangoInvertido || undefined}
                                        aria-describedby={rangoInvertido ? 'date-to-error' : undefined}
                                        className={CAMPO_FECHA}
                                    />
                                    <AvisoCampo id="date-to-error" texto={rangoInvertido ? t('appointments.dateRangeInverted') : undefined} />
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

                            {/* En el teléfono no hay cabecera de columnas: el orden se elige aquí. */}
                            <div className="flex w-full items-center gap-2 @3xl/hoja:hidden">
                                <label htmlFor="view-sort" className={cn('text-[12.5px] leading-4 font-medium whitespace-nowrap', TEXTO_SUAVE)}>
                                    {t('appointments.sortLabel')}
                                </label>
                                <select id="view-sort" value={campoElegido} onChange={(e) => cambiarOrden(e.target.value, sortDirection)} className={cn(CAMPO_SELECT, 'flex-1')}>
                                    {ordenables.map(({ campo, etiqueta }) => (
                                        <option key={campo} value={campo}>
                                            {campo === 'id' ? t('appointments.sortLoadOrder') : etiqueta}
                                        </option>
                                    ))}
                                </select>
                                <label htmlFor="view-sort-direction" className="sr-only">
                                    {t('appointments.sortDirectionLabel')}
                                </label>
                                <select
                                    id="view-sort-direction"
                                    value={sortDirection}
                                    onChange={(e) => cambiarOrden(campoElegido, e.target.value === 'asc' ? 'asc' : 'desc')}
                                    className={cn(CAMPO_SELECT, 'w-[136px] shrink-0')}
                                >
                                    <option value="asc">{t('appointments.sortAscending')}</option>
                                    <option value="desc">{t('appointments.sortDescending')}</option>
                                </select>
                            </div>
                        </div>

                        {/* Cabecera ordenable (hoja ≥ 768 px). El nombre de cada botón es su texto; el estado va oculto. */}
                        <div
                            className={cn(
                                'hidden h-9 border-b bg-card bg-[image:linear-gradient(rgba(46,63,132,0.028),rgba(46,63,132,0.028))] lg:sticky lg:top-0 lg:z-[2] @3xl/hoja:grid dark:bg-[image:linear-gradient(rgba(255,255,255,0.03),rgba(255,255,255,0.03))]',
                                COLUMNAS_CITA,
                                FILETE
                            )}
                        >
                            {columnas.map(({ campo, activos, etiqueta }) => {
                                if (!campo) return <Th key="respuesta">{etiqueta}</Th>;
                                const activa = activos.includes(sortField);
                                const Flecha = activa ? (sortDirection === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;

                                return (
                                    <button
                                        key={campo}
                                        type="button"
                                        onClick={() => handleSort(campo)}
                                        title={campo === 'id' ? t('appointments.sortByLoadOrder') : t('appointments.sortBy', { column: etiqueta.toLocaleLowerCase(lng) })}
                                        className={cn(
                                            '-mx-1.5 flex h-7 min-w-0 cursor-pointer items-center gap-1.5 rounded-md px-1.5 transition-colors hover:bg-[#2e3f84]/6 dark:hover:bg-white/8',
                                            campo === 'id' && 'justify-end',
                                            FOCO
                                        )}
                                    >
                                        <Th activa={activa}>
                                            {campo === 'id' ? (
                                                <>
                                                    <span aria-hidden="true">#</span>
                                                    <span className="sr-only">{t('appointments.sortLoadOrder')}</span>
                                                </>
                                            ) : (
                                                etiqueta
                                            )}
                                        </Th>
                                        {activa && <span className="sr-only">{sortDirection === 'asc' ? t('appointments.sortedAsc') : t('appointments.sortedDesc')}</span>}
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
                            <ul aria-label={t('appointments.allAppointmentsTitle')} aria-busy={cargando || undefined} className={cn('transition-opacity', cargando && 'opacity-60')}>
                                {appointments.data.map((appointment, index) => (
                                    <FilaCita key={appointment.id} cita={appointment} indice={(appointments.from ?? 1) + index} conCedula />
                                ))}
                            </ul>
                        ) : (
                            <div className={cn('flex flex-col items-center gap-3 border-b px-4 py-14 text-center', FILETE)}>
                                <p className={cn('max-w-[460px] text-[13px] leading-[18px]', TEXTO_SUAVE)}>
                                    {hayFiltros ? t('appointments.noAppointmentsFound') : t('appointments.noAppointmentsYet')}
                                </p>
                                {hayFiltros && (
                                    <button type="button" onClick={quitarFiltros} className={BOTON_SECUNDARIO}>
                                        <X strokeWidth={2} aria-hidden="true" />
                                        {t('appointments.clearFilters')}
                                    </button>
                                )}
                            </div>
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
                                    t('appointments.noResultsShort')
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
                                            onClick={() => irAPagina(appointments.current_page - 1)}
                                            disabled={appointments.current_page <= 1}
                                            title={appointments.current_page <= 1 ? t('appointments.noPreviousPage') : undefined}
                                            className={cn(BOTON_SECUNDARIO, 'h-[34px] pr-3 pl-[9px] disabled:opacity-45')}
                                        >
                                            <ChevronLeft strokeWidth={2} aria-hidden="true" />
                                            {t('common.previous')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => irAPagina(appointments.current_page + 1)}
                                            disabled={appointments.current_page >= appointments.last_page}
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
