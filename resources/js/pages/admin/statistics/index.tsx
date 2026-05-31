import AdminLayout from '@/layouts/admin-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Deferred, Head, router } from '@inertiajs/react';
import { AnimatePresence, motion } from 'framer-motion';
import axios from 'axios';
import {
    Activity,
    AlertCircle,
    BarChart3,
    CalendarCheck2,
    CalendarDays,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Clock,
    Download,
    FileText,
    Filter,
    LineChart as LineChartIcon,
    MessageSquare,
    PieChart as PieChartIcon,
    Send,
    Table2,
    Timer,
    TrendingUp,
    Users,
    XCircle,
    type LucideIcon,
} from 'lucide-react';
import { useCallback, useMemo, useState, type FormEventHandler, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

interface AdvisorDetail {
    advisor: { id: number; name: string };
    summary: {
        messages_sent: number;
        total_conversations: number;
        resolved_conversations: number;
        scheduled_conversations: number;
        active_conversations: number;
        pending_conversations: number;
        resolution_rate: number;
        avg_response_time_minutes: number | null;
    };
    daily_activity: Array<{ date: string; label: string; count: number }>;
    hourly_distribution: Array<{ hour: string; count: number }>;
    message_types: Record<string, number>;
}

interface AdvisorSummary {
    id: number;
    name: string;
    total_conversations: number;
    resolved_conversations: number;
    scheduled_conversations: number;
    active_conversations: number;
    conversations_with_unread: number;
    messages_sent: number;
    resolution_rate: number;
}

interface Statistics {
    messages: {
        total: number;
        sent_by_system: number;
        received_from_users: number;
        delivery_status: {
            pending: number;
            sent: number;
            delivered: number;
            read: number;
            failed: number;
        };
    };
    appointments: {
        total: number;
        reminder_sent: number;
        confirmed: number;
        cancelled: number;
        pending: number;
        failed: number;
        by_status: Record<string, number>;
    };
    conversations: {
        total: number;
        active: number;
        pending: number;
        in_progress: number;
        resolved: number;
        closed: number;
        scheduled: number;
        unread: number;
    };
    templates: {
        total: number;
        successful_sends: number;
        failed_sends: number;
        total_sends: number;
    };
    users: {
        total: number;
        admins: number;
        advisors: number;
    };
    advisors: {
        total_advisors: number;
        total_conversations: number;
        total_resolved: number;
        total_scheduled: number;
        total_active: number;
        total_with_unread: number;
        total_messages_sent: number;
        avg_resolution_rate: number;
        top_performer: AdvisorSummary | null;
        advisors: AdvisorSummary[];
    };
    date_range: {
        start?: string;
        end?: string;
        period: string;
    };
}

interface StatisticsIndexProps {
    // statistics es opcional porque llega DIFERIDA (Inertia v2 deferred prop):
    // está ausente en la respuesta inicial y el <Deferred> muestra el skeleton.
    statistics?: Statistics;
}

interface StatisticsViewProps {
    statistics: Statistics;
}

interface MetricCardProps {
    icon: LucideIcon;
    label: string;
    value: string | number;
    detail: string;
    tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
    onClick?: () => void;
    layoutId?: string;
}

interface SectionCardProps {
    icon: LucideIcon;
    title: string;
    subtitle?: string;
    className?: string;
    children: React.ReactNode;
    action?: React.ReactNode;
}

interface StatLineProps {
    icon: LucideIcon;
    label: string;
    value: number;
    total?: number;
    tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
}

const COLORS = {
    primary: '#2E3F84',
    primaryLight: '#5162A8',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#3B82F6',
    slate: '#64748B',
};

const chartColors = [COLORS.primary, COLORS.success, COLORS.info, COLORS.warning, COLORS.danger, COLORS.primaryLight, COLORS.slate];

const tooltipStyle = {
    backgroundColor: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    boxShadow: '0 8px 24px rgba(46, 63, 132, 0.14)',
    fontSize: '12px',
    color: 'var(--foreground)',
};

function formatNumber(value: number | null | undefined) {
    return Number(value ?? 0).toLocaleString('es-CO');
}

function safePercent(value: number, total: number) {
    if (!total) return 0;
    return Math.min(100, Math.round((value / total) * 100));
}

function toneClasses(tone: MetricCardProps['tone'] = 'primary') {
    const classes = {
        primary: 'border-[#d4d8e8] bg-[#2e3f84]/10 text-[#2e3f84] dark:border-white/10 dark:bg-white/[0.05] dark:text-neutral-100',
        success: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
        warning: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300',
        danger: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300',
        info: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300',
    };

    return classes[tone];
}

function barColor(tone: StatLineProps['tone'] = 'primary') {
    return {
        primary: 'bg-[#2e3f84]',
        success: 'bg-emerald-500',
        warning: 'bg-amber-500',
        danger: 'bg-red-500',
        info: 'bg-sky-500',
    }[tone];
}

function MetricCard({ icon: Icon, label, value, detail, tone = 'primary', onClick, layoutId }: MetricCardProps) {
    const base = 'card-gradient rounded-lg border border-white/50 p-4 shadow-sm shadow-[#2e3f84]/5 dark:border-white/10';
    const inner = (
        <div className="flex items-center gap-3">
            <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border', toneClasses(tone))}>
                <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold uppercase tracking-normal settings-subtitle">{label}</p>
                <p className="mt-1 truncate text-lg font-bold leading-tight settings-title">{value}</p>
                <p className="mt-1 truncate text-xs settings-subtitle">{detail}</p>
            </div>
        </div>
    );

    // Tarjeta interactiva: clic → morph a modal de detalle (shared layout con framer-motion)
    if (layoutId) {
        return (
            <motion.div
                layoutId={layoutId}
                onClick={onClick}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                className={cn(base, 'cursor-pointer hover:shadow-md hover:shadow-[#2e3f84]/10')}
            >
                {inner}
            </motion.div>
        );
    }

    return <div className={base}>{inner}</div>;
}

function SectionCard({ icon: Icon, title, subtitle, className, children, action }: SectionCardProps) {
    return (
        <section className={cn('card-gradient rounded-lg border border-white/40 p-5 shadow-lg shadow-[#2e3f84]/5 dark:border-white/10', className)}>
            <div className="mb-4 flex items-start justify-between gap-3 border-b border-[#d4d8e8]/80 pb-4 dark:border-white/10">
                <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#d4d8e8] bg-[#2e3f84]/10 text-[#2e3f84] dark:border-white/10 dark:bg-white/[0.05] dark:text-neutral-100">
                        <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-base font-bold leading-tight settings-title">{title}</h2>
                        {subtitle && <p className="mt-1 text-xs settings-subtitle">{subtitle}</p>}
                    </div>
                </div>
                {action}
            </div>
            {children}
        </section>
    );
}

function StatLine({ icon: Icon, label, value, total, tone = 'primary' }: StatLineProps) {
    const percent = total ? safePercent(value, total) : 0;

    return (
        <div className="rounded-lg border border-transparent bg-white/45 px-3 py-2.5 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                    <Icon className="h-3.5 w-3.5 shrink-0 settings-subtitle" />
                    <span className="truncate text-xs font-medium settings-subtitle">{label}</span>
                </div>
                <span className="shrink-0 text-sm font-bold settings-title">{formatNumber(value)}</span>
            </div>
            {typeof total === 'number' && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e8ebf3] dark:bg-white/10">
                    <div className={cn('h-full rounded-full', barColor(tone))} style={{ width: `${percent}%` }} />
                </div>
            )}
        </div>
    );
}

function EmptyChart({ message }: { message: string }) {
    return (
        <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed border-[#d4d8e8] text-sm settings-subtitle dark:border-white/10">
            {message}
        </div>
    );
}

function StatisticsView({ statistics }: StatisticsViewProps) {
    const { t } = useTranslation();
    const [period, setPeriod] = useState(statistics.date_range.period || 'all');
    const [startDate, setStartDate] = useState(statistics.date_range.start || '');
    const [endDate, setEndDate] = useState(statistics.date_range.end || '');
    const [expandedAdvisor, setExpandedAdvisor] = useState<number | null>(null);
    const [advisorDetail, setAdvisorDetail] = useState<AdvisorDetail | null>(null);
    const [loadingAdvisor, setLoadingAdvisor] = useState(false);
    const [advisorPeriod, setAdvisorPeriod] = useState('all');
    const [advisorStartDate, setAdvisorStartDate] = useState('');
    const [advisorEndDate, setAdvisorEndDate] = useState('');
    const [isExporting, setIsExporting] = useState(false);
    const [openMetric, setOpenMetric] = useState<'messages' | 'appointments' | 'conversations' | 'advisors' | 'templates' | null>(null);
    const [showCharts, setShowCharts] = useState(false);

    const periodOptions = useMemo(() => [
        { value: 'today', label: t('statistics.filters.periods.today') },
        { value: 'week', label: t('statistics.filters.periods.week') },
        { value: 'month', label: t('statistics.filters.periods.month') },
        { value: 'year', label: t('statistics.filters.periods.year') },
        { value: 'all', label: t('statistics.filters.periods.all') },
    ], [t]);

    const fetchAdvisorDetail = useCallback(async (advisorId: number, selectedPeriod?: string, selectedStart?: string, selectedEnd?: string) => {
        setLoadingAdvisor(true);
        try {
            const usePeriod = selectedPeriod ?? advisorPeriod;
            const useStart = selectedStart ?? advisorStartDate;
            const useEnd = selectedEnd ?? advisorEndDate;
            const params: Record<string, string> = { period: usePeriod };

            if (useStart) params.start_date = useStart;
            if (useEnd) params.end_date = useEnd;

            const response = await axios.get(`/admin/statistics/advisor/${advisorId}`, { params });
            setAdvisorDetail(response.data);
        } catch {
            setAdvisorDetail(null);
        } finally {
            setLoadingAdvisor(false);
        }
    }, [advisorEndDate, advisorPeriod, advisorStartDate]);

    const toggleAdvisorDetail = useCallback(async (advisorId: number) => {
        if (expandedAdvisor === advisorId) {
            setExpandedAdvisor(null);
            setAdvisorDetail(null);
            return;
        }

        setExpandedAdvisor(advisorId);
        setAdvisorPeriod('all');
        setAdvisorStartDate('');
        setAdvisorEndDate('');
        await fetchAdvisorDetail(advisorId, 'all', '', '');
    }, [expandedAdvisor, fetchAdvisorDetail]);

    const handleFilterSubmit: FormEventHandler = (event) => {
        event.preventDefault();
        router.get('/admin/statistics', {
            period,
            start_date: startDate || undefined,
            end_date: endDate || undefined,
        }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const handleExport = () => {
        setIsExporting(true);
        const params = new URLSearchParams({
            period,
            ...(startDate && { start_date: startDate }),
            ...(endDate && { end_date: endDate }),
        });

        window.location.href = `/admin/statistics/export?${params.toString()}`;
        setTimeout(() => setIsExporting(false), 2000);
    };

    const deliveryStatusLabels: Record<string, string> = {
        pending: 'En cola',
        sent: 'Enviado',
        delivered: 'Entregado',
        read: 'Leído',
        failed: 'Error',
    };

    const deliveryItems = [
        { key: 'pending', icon: Clock, label: 'En cola', value: statistics.messages.delivery_status.pending, tone: 'warning' as const },
        { key: 'sent', icon: Send, label: 'Enviados', value: statistics.messages.delivery_status.sent, tone: 'info' as const },
        { key: 'delivered', icon: CheckCircle2, label: 'Entregados', value: statistics.messages.delivery_status.delivered, tone: 'success' as const },
        { key: 'read', icon: CheckCircle2, label: 'Leídos', value: statistics.messages.delivery_status.read, tone: 'primary' as const },
        { key: 'failed', icon: XCircle, label: 'Errores', value: statistics.messages.delivery_status.failed, tone: 'danger' as const },
    ];

    const appointmentItems = [
        { icon: CalendarDays, label: 'Total cargadas', value: statistics.appointments.total, tone: 'primary' as const },
        { icon: Send, label: 'Recordatorios enviados', value: statistics.appointments.reminder_sent, tone: 'info' as const },
        { icon: CheckCircle2, label: 'Confirmadas', value: statistics.appointments.confirmed, tone: 'success' as const },
        { icon: XCircle, label: 'Canceladas', value: statistics.appointments.cancelled, tone: 'danger' as const },
        { icon: Clock, label: 'Pendientes', value: statistics.appointments.pending, tone: 'warning' as const },
        { icon: AlertCircle, label: 'Fallidas', value: statistics.appointments.failed, tone: 'danger' as const },
    ];

    const conversationItems = [
        { icon: Activity, label: t('statistics.conversations.active'), value: statistics.conversations.active, tone: 'success' as const },
        { icon: Clock, label: t('statistics.conversations.pending'), value: statistics.conversations.pending, tone: 'warning' as const },
        { icon: Timer, label: t('statistics.conversations.inProgress'), value: statistics.conversations.in_progress, tone: 'info' as const },
        { icon: CheckCircle2, label: t('statistics.conversations.resolved'), value: statistics.conversations.resolved, tone: 'success' as const },
        { icon: XCircle, label: t('statistics.conversations.closed'), value: statistics.conversations.closed, tone: 'danger' as const },
        { icon: CalendarCheck2, label: t('statistics.conversations.scheduled'), value: statistics.conversations.scheduled, tone: 'primary' as const },
        { icon: AlertCircle, label: t('statistics.conversations.unread'), value: statistics.conversations.unread, tone: 'warning' as const },
    ];

    const messagesStatusData = Object.entries(statistics.messages.delivery_status).map(([name, value]) => ({
        name: deliveryStatusLabels[name] || name,
        value,
    })).filter((item) => item.value > 0);

    const appointmentsData = [
        { name: t('statistics.appointments.confirmed'), value: statistics.appointments.confirmed, color: COLORS.success },
        { name: t('statistics.appointments.cancelled'), value: statistics.appointments.cancelled, color: COLORS.danger },
        { name: t('statistics.appointments.pending'), value: statistics.appointments.pending, color: COLORS.warning },
        { name: t('statistics.appointments.failed'), value: statistics.appointments.failed, color: COLORS.info },
    ].filter((item) => item.value > 0);

    const conversationsStatusData = conversationItems.map((item) => ({
        name: item.label,
        value: item.value,
    }));

    const mainStatsData = [
        { name: 'Mensajes', value: statistics.messages.total },
        { name: 'Enviados', value: statistics.messages.sent_by_system },
        { name: 'Recibidos', value: statistics.messages.received_from_users },
        { name: 'Citas', value: statistics.appointments.total },
        { name: 'Conversaciones', value: statistics.conversations.total },
        { name: 'Plantillas', value: statistics.templates.total_sends },
    ];

    const usersData = [
        { name: t('statistics.users.admins'), value: statistics.users.admins },
        { name: t('statistics.users.advisors'), value: statistics.users.advisors },
    ].filter((item) => item.value > 0);

    const periodLabel = periodOptions.find((option) => option.value === period)?.label ?? period;
    const outboundTotal = Object.values(statistics.messages.delivery_status).reduce((sum, value) => sum + value, 0);
    const appointmentTotalForBars = Math.max(statistics.appointments.total, 1);
    const conversationTotalForBars = Math.max(statistics.conversations.total, 1);

    // Detalle de cada tarjeta de métrica para el modal (morph). Reutiliza datos ya calculados.
    type MetricModalData = {
        icon: LucideIcon;
        title: string;
        headlineLabel: string;
        headlineValue: number;
        lines: { icon: LucideIcon; label: string; value: number; total?: number; tone: 'primary' | 'success' | 'warning' | 'danger' | 'info' }[];
        chart: ReactNode;
    };
    const metricModals: Record<'messages' | 'appointments' | 'conversations' | 'advisors' | 'templates', MetricModalData> = {
        messages: {
            icon: MessageSquare,
            title: 'Mensajes',
            headlineLabel: 'Total intercambiados',
            headlineValue: statistics.messages.total,
            lines: [
                { icon: Send, label: 'Enviados por sistema/asesores', value: statistics.messages.sent_by_system, total: statistics.messages.total, tone: 'info' as const },
                { icon: MessageSquare, label: 'Recibidos de pacientes', value: statistics.messages.received_from_users, total: statistics.messages.total, tone: 'success' as const },
                ...deliveryItems.map((d) => ({ icon: d.icon, label: d.label, value: d.value, total: outboundTotal, tone: d.tone })),
            ],
            chart: messagesStatusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                        <Pie data={messagesStatusData} cx="50%" cy="50%" labelLine={false} label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`} outerRadius={75} dataKey="value">
                            {messagesStatusData.map((entry, index) => (<Cell key={entry.name} fill={chartColors[index % chartColors.length]} />))}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                </ResponsiveContainer>
            ) : null,
        },
        appointments: {
            icon: CalendarCheck2,
            title: 'Citas',
            headlineLabel: 'Total cargadas',
            headlineValue: statistics.appointments.total,
            lines: appointmentItems.map((a) => ({ icon: a.icon, label: a.label, value: a.value, total: appointmentTotalForBars, tone: a.tone })),
            chart: appointmentsData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                        <Pie data={appointmentsData} cx="50%" cy="50%" labelLine={false} label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`} outerRadius={75} dataKey="value">
                            {appointmentsData.map((entry) => (<Cell key={entry.name} fill={entry.color} />))}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                </ResponsiveContainer>
            ) : null,
        },
        conversations: {
            icon: Activity,
            title: 'Conversaciones',
            headlineLabel: 'Total',
            headlineValue: statistics.conversations.total,
            lines: conversationItems.map((c) => ({ icon: c.icon, label: c.label, value: c.value, total: conversationTotalForBars, tone: c.tone })),
            chart: (
                <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={conversationsStatusData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="name" tick={{ fontSize: 9 }} className="fill-muted-foreground" angle={-20} textAnchor="end" height={50} />
                        <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" allowDecimals={false} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="value" fill={COLORS.info} radius={[6, 6, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            ),
        },
        advisors: {
            icon: Users,
            title: 'Asesores',
            headlineLabel: 'Asesores en el equipo',
            headlineValue: statistics.advisors.total_advisors,
            lines: [
                { icon: MessageSquare, label: 'Conversaciones asignadas', value: statistics.advisors.total_conversations, total: undefined, tone: 'info' as const },
                { icon: CheckCircle2, label: 'Resueltas', value: statistics.advisors.total_resolved, total: Math.max(statistics.advisors.total_conversations, 1), tone: 'success' as const },
                { icon: CalendarCheck2, label: 'Agendadas', value: statistics.advisors.total_scheduled, total: undefined, tone: 'primary' as const },
                { icon: Send, label: 'Mensajes enviados', value: statistics.advisors.total_messages_sent, total: undefined, tone: 'info' as const },
                { icon: TrendingUp, label: 'Resolución promedio (%)', value: statistics.advisors.avg_resolution_rate, total: 100, tone: 'success' as const },
            ],
            chart: null,
        },
        templates: {
            icon: FileText,
            title: 'Plantillas y equipo',
            headlineLabel: 'Plantillas',
            headlineValue: statistics.templates.total,
            lines: [
                { icon: Send, label: 'Envíos totales', value: statistics.templates.total_sends, total: undefined, tone: 'info' as const },
                { icon: CheckCircle2, label: 'Envíos exitosos', value: statistics.templates.successful_sends, total: Math.max(statistics.templates.total_sends, 1), tone: 'success' as const },
                { icon: XCircle, label: 'Envíos fallidos', value: statistics.templates.failed_sends, total: Math.max(statistics.templates.total_sends, 1), tone: 'danger' as const },
                { icon: Users, label: 'Administradores', value: statistics.users.admins, total: Math.max(statistics.users.total, 1), tone: 'primary' as const },
                { icon: Users, label: 'Asesores', value: statistics.users.advisors, total: Math.max(statistics.users.total, 1), tone: 'info' as const },
            ],
            chart: usersData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                        <Pie data={usersData} cx="50%" cy="50%" labelLine={false} label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`} outerRadius={75} dataKey="value">
                            <Cell fill={COLORS.primaryLight} />
                            <Cell fill={COLORS.success} />
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                </ResponsiveContainer>
            ) : null,
        },
    };

    return (
        <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
                <div className="mx-auto flex max-w-7xl flex-col gap-5">
                    <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex items-start gap-3">
                            <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#d4d8e8] bg-white/70 text-[#2e3f84] shadow-sm shadow-[#2e3f84]/5 dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-100">
                                <BarChart3 className="h-5 w-5" />
                            </div>
                            <div>
                                <h1 className="font-bold settings-title" style={{ fontSize: 'var(--text-3xl)' }}>
                                    {t('statistics.title')}
                                </h1>
                                <p className="settings-subtitle" style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-xs)' }}>
                                    {t('statistics.subtitle')}
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <div className="inline-flex rounded-lg border border-[#d4d8e8] bg-white/70 p-1 dark:border-white/10 dark:bg-white/[0.04]">
                                <button
                                    type="button"
                                    onClick={() => setShowCharts(false)}
                                    className={cn(
                                        'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                                        !showCharts
                                            ? 'bg-[#2e3f84] text-white shadow-sm shadow-[#2e3f84]/20'
                                            : 'settings-subtitle hover:bg-[#eef1f8] hover:text-[#2e3f84] dark:hover:bg-white/10 dark:hover:text-neutral-100'
                                    )}
                                >
                                    <Table2 className="h-3.5 w-3.5" />
                                    Tabla
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowCharts(true)}
                                    className={cn(
                                        'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                                        showCharts
                                            ? 'bg-[#2e3f84] text-white shadow-sm shadow-[#2e3f84]/20'
                                            : 'settings-subtitle hover:bg-[#eef1f8] hover:text-[#2e3f84] dark:hover:bg-white/10 dark:hover:text-neutral-100'
                                    )}
                                >
                                    <BarChart3 className="h-3.5 w-3.5" />
                                    Gráficos
                                </button>
                            </div>

                            <Button
                                type="button"
                                onClick={handleExport}
                                disabled={isExporting}
                                className="h-9 rounded-lg px-5 text-xs font-semibold settings-btn-primary disabled:opacity-50"
                            >
                                <Download className="mr-2 h-3.5 w-3.5" />
                                {isExporting ? t('statistics.exporting') : t('statistics.export')}
                            </Button>
                        </div>
                    </header>

                    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                        <MetricCard icon={MessageSquare} label="Mensajes" value={formatNumber(statistics.messages.total)} detail={`${formatNumber(statistics.messages.sent_by_system)} enviados`} layoutId="metric-messages" onClick={() => setOpenMetric('messages')} />
                        <MetricCard icon={CalendarCheck2} label="Citas" value={formatNumber(statistics.appointments.total)} detail={`${formatNumber(statistics.appointments.confirmed)} confirmadas`} tone="success" layoutId="metric-appointments" onClick={() => setOpenMetric('appointments')} />
                        <MetricCard icon={Activity} label="Conversaciones" value={formatNumber(statistics.conversations.total)} detail={`${formatNumber(statistics.conversations.unread)} sin leer`} tone={statistics.conversations.unread > 0 ? 'warning' : 'info'} layoutId="metric-conversations" onClick={() => setOpenMetric('conversations')} />
                        <MetricCard icon={Users} label="Asesores" value={formatNumber(statistics.advisors.total_advisors)} detail={`${statistics.advisors.avg_resolution_rate}% resolución promedio`} tone="primary" layoutId="metric-advisors" onClick={() => setOpenMetric('advisors')} />
                        <MetricCard icon={FileText} label="Plantillas" value={formatNumber(statistics.templates.total)} detail={`${formatNumber(statistics.templates.total_sends)} envíos`} tone="info" layoutId="metric-templates" onClick={() => setOpenMetric('templates')} />
                    </section>

                    <form onSubmit={handleFilterSubmit} className="card-gradient rounded-lg border border-white/40 p-4 shadow-lg shadow-[#2e3f84]/5 dark:border-white/10">
                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_auto] xl:items-end">
                            <div>
                                <Label className="mb-2 block text-xs font-semibold settings-label">{t('statistics.filters.period')}</Label>
                                <div className="grid grid-cols-2 gap-1 rounded-lg border border-[#d4d8e8] bg-white/70 p-1 dark:border-white/10 dark:bg-white/[0.04] sm:grid-cols-5">
                                    {periodOptions.map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => setPeriod(option.value)}
                                            className={cn(
                                                'rounded-md px-3 py-2 text-xs font-semibold transition-colors',
                                                period === option.value && !startDate && !endDate
                                                    ? 'bg-[#2e3f84] text-white shadow-sm shadow-[#2e3f84]/20'
                                                    : 'settings-subtitle hover:bg-[#eef1f8] hover:text-[#2e3f84] dark:hover:bg-white/10 dark:hover:text-neutral-100'
                                            )}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="stats-start-date" className="mb-2 block text-xs font-semibold settings-label">
                                    {t('statistics.filters.startDate')}
                                </Label>
                                <Input
                                    id="stats-start-date"
                                    name="stats-start-date"
                                    type="date"
                                    value={startDate}
                                    onChange={(event) => setStartDate(event.target.value)}
                                    className="h-10 rounded-lg text-sm settings-input focus:ring-2 focus:ring-[#2e3f84]/30"
                                />
                            </div>

                            <div>
                                <Label htmlFor="stats-end-date" className="mb-2 block text-xs font-semibold settings-label">
                                    {t('statistics.filters.endDate')}
                                </Label>
                                <Input
                                    id="stats-end-date"
                                    name="stats-end-date"
                                    type="date"
                                    value={endDate}
                                    onChange={(event) => setEndDate(event.target.value)}
                                    className="h-10 rounded-lg text-sm settings-input focus:ring-2 focus:ring-[#2e3f84]/30"
                                />
                            </div>

                            <Button type="submit" className="h-10 rounded-lg px-5 text-xs font-semibold settings-btn-primary">
                                <Filter className="mr-2 h-3.5 w-3.5" />
                                {t('statistics.filters.apply')}
                            </Button>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs settings-subtitle">
                            <span className="rounded-md border border-[#d4d8e8] bg-white/70 px-2.5 py-1 font-semibold dark:border-white/10 dark:bg-white/[0.04]">
                                {startDate && endDate ? `${startDate} a ${endDate}` : periodLabel}
                            </span>
                            {(startDate || endDate) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setStartDate('');
                                        setEndDate('');
                                    }}
                                    className="rounded-md px-2.5 py-1 font-semibold text-[#2e3f84] transition-colors hover:bg-[#2e3f84]/10 dark:text-neutral-100 dark:hover:bg-white/10"
                                >
                                    Limpiar rango
                                </button>
                            )}
                        </div>
                    </form>

                    {!showCharts ? (
                        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                            <SectionCard
                                icon={Users}
                                title="Rendimiento de asesores"
                                subtitle="Conversaciones, mensajes enviados y resolución"
                                className="xl:col-span-2"
                                action={<span className="rounded-md border border-[#d4d8e8] bg-white/70 px-2.5 py-1 text-[11px] font-semibold settings-subtitle dark:border-white/10 dark:bg-white/[0.04]">Click para detalle</span>}
                            >
                                <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                                    <MetricCard icon={Users} label="Asesores" value={statistics.advisors.total_advisors} detail="en el equipo" />
                                    <MetricCard icon={MessageSquare} label="Conversaciones" value={formatNumber(statistics.advisors.total_conversations)} detail="asignadas" tone="info" />
                                    <MetricCard icon={CheckCircle2} label="Resueltas" value={formatNumber(statistics.advisors.total_resolved)} detail="cerradas/resueltas" tone="success" />
                                    <MetricCard icon={Send} label="Mensajes" value={formatNumber(statistics.advisors.total_messages_sent)} detail="enviados" />
                                    <MetricCard icon={TrendingUp} label="Promedio" value={`${statistics.advisors.avg_resolution_rate}%`} detail="resolución" tone="success" />
                                </div>

                                {statistics.advisors.top_performer && (
                                    <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
                                        <span className="font-bold">Mejor desempeño:</span> {statistics.advisors.top_performer.name} con {statistics.advisors.top_performer.resolved_conversations} conversaciones resueltas y {statistics.advisors.top_performer.resolution_rate}% de resolución.
                                    </div>
                                )}

                                {statistics.advisors.advisors.length > 0 ? (
                                    <div className="space-y-2">
                                        {statistics.advisors.advisors.map((advisor) => {
                                            const expanded = expandedAdvisor === advisor.id;
                                            const rateTone = advisor.resolution_rate >= 70 ? 'success' : advisor.resolution_rate >= 40 ? 'warning' : 'danger';

                                            return (
                                                <div key={advisor.id} className="overflow-hidden rounded-lg border border-[#d4d8e8]/80 bg-white/45 dark:border-white/10 dark:bg-white/[0.03]">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleAdvisorDetail(advisor.id)}
                                                        className="flex w-full flex-col gap-3 px-4 py-3 text-left transition-colors hover:bg-white/75 dark:hover:bg-white/[0.04] lg:flex-row lg:items-center lg:justify-between"
                                                    >
                                                        <div className="flex min-w-0 items-center gap-3">
                                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#2e3f84] text-xs font-bold text-white shadow-sm shadow-[#2e3f84]/20">
                                                                {advisor.name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    {expanded ? <ChevronUp className="h-4 w-4 settings-title" /> : <ChevronDown className="h-4 w-4 settings-subtitle" />}
                                                                    <p className="truncate text-sm font-bold settings-title">{advisor.name}</p>
                                                                </div>
                                                                <p className="mt-1 text-xs settings-subtitle">
                                                                    {formatNumber(advisor.total_conversations)} conv. · {formatNumber(advisor.messages_sent)} mensajes · {formatNumber(advisor.scheduled_conversations)} agendadas
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-3 gap-2 text-right text-xs lg:w-[360px]">
                                                            <div>
                                                                <p className="font-bold settings-title">{formatNumber(advisor.resolved_conversations)}</p>
                                                                <p className="settings-subtitle">resueltas</p>
                                                            </div>
                                                            <div>
                                                                <p className="font-bold settings-title">{formatNumber(advisor.active_conversations)}</p>
                                                                <p className="settings-subtitle">activas</p>
                                                            </div>
                                                            <div>
                                                                <span className={cn('inline-flex rounded-md border px-2 py-1 text-[11px] font-bold', toneClasses(rateTone))}>
                                                                    {advisor.resolution_rate}%
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </button>

                                                    {expanded && (
                                                        <div className="border-t border-[#d4d8e8]/80 p-4 dark:border-white/10">
                                                            <div className="mb-4 flex flex-wrap items-center gap-2">
                                                                {periodOptions.map((option) => (
                                                                    <button
                                                                        key={option.value}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setAdvisorPeriod(option.value);
                                                                            setAdvisorStartDate('');
                                                                            setAdvisorEndDate('');
                                                                            fetchAdvisorDetail(advisor.id, option.value, '', '');
                                                                        }}
                                                                        className={cn(
                                                                            'rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors',
                                                                            advisorPeriod === option.value && !advisorStartDate && !advisorEndDate
                                                                                ? 'bg-[#2e3f84] text-white shadow-sm shadow-[#2e3f84]/20'
                                                                                : 'settings-subtitle hover:bg-[#eef1f8] hover:text-[#2e3f84] dark:hover:bg-white/10 dark:hover:text-neutral-100'
                                                                        )}
                                                                    >
                                                                        {option.label}
                                                                    </button>
                                                                ))}
                                                                <Input
                                                                    type="date"
                                                                    value={advisorStartDate}
                                                                    onChange={(event) => {
                                                                        setAdvisorStartDate(event.target.value);
                                                                        if (event.target.value && advisorEndDate) {
                                                                            setAdvisorPeriod('custom');
                                                                            fetchAdvisorDetail(advisor.id, 'custom', event.target.value, advisorEndDate);
                                                                        }
                                                                    }}
                                                                    className="h-8 w-[145px] rounded-lg text-xs settings-input"
                                                                />
                                                                <Input
                                                                    type="date"
                                                                    value={advisorEndDate}
                                                                    onChange={(event) => {
                                                                        setAdvisorEndDate(event.target.value);
                                                                        if (advisorStartDate && event.target.value) {
                                                                            setAdvisorPeriod('custom');
                                                                            fetchAdvisorDetail(advisor.id, 'custom', advisorStartDate, event.target.value);
                                                                        }
                                                                    }}
                                                                    className="h-8 w-[145px] rounded-lg text-xs settings-input"
                                                                />
                                                            </div>

                                                            {loadingAdvisor ? (
                                                                <div className="flex items-center justify-center py-8">
                                                                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#2e3f84] border-t-transparent" />
                                                                    <span className="ml-2 text-xs settings-subtitle">Cargando métricas...</span>
                                                                </div>
                                                            ) : advisorDetail ? (
                                                                <div className="space-y-4">
                                                                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
                                                                        <MetricCard icon={Send} label="Mensajes" value={advisorDetail.summary.messages_sent} detail="enviados" />
                                                                        <MetricCard icon={TrendingUp} label="Resolución" value={`${advisorDetail.summary.resolution_rate}%`} detail="tasa" tone="success" />
                                                                        <MetricCard icon={Timer} label="Resp. prom." value={advisorDetail.summary.avg_response_time_minutes !== null ? `${advisorDetail.summary.avg_response_time_minutes} min` : 'N/A'} detail="tiempo" tone="info" />
                                                                        <MetricCard icon={CalendarCheck2} label="Agendadas" value={advisorDetail.summary.scheduled_conversations} detail="conversaciones" />
                                                                        <MetricCard icon={Activity} label="Abiertas" value={advisorDetail.summary.active_conversations + advisorDetail.summary.pending_conversations} detail="activas/pendientes" tone="warning" />
                                                                    </div>

                                                                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                                                        <div className="rounded-lg border border-[#d4d8e8]/80 bg-white/45 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                                                                            <h4 className="mb-2 flex items-center gap-2 text-xs font-bold settings-title">
                                                                                <TrendingUp className="h-3.5 w-3.5" />
                                                                                Actividad diaria
                                                                            </h4>
                                                                            <ResponsiveContainer width="100%" height={150}>
                                                                                <BarChart data={advisorDetail.daily_activity}>
                                                                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                                                                    <XAxis dataKey="label" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                                                                                    <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" allowDecimals={false} />
                                                                                    <Tooltip contentStyle={tooltipStyle} formatter={(value) => [value, 'Mensajes']} />
                                                                                    <Bar dataKey="count" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                                                                                </BarChart>
                                                                            </ResponsiveContainer>
                                                                        </div>

                                                                        <div className="rounded-lg border border-[#d4d8e8]/80 bg-white/45 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                                                                            <h4 className="mb-2 flex items-center gap-2 text-xs font-bold settings-title">
                                                                                <Timer className="h-3.5 w-3.5" />
                                                                                Distribución por hora
                                                                            </h4>
                                                                            <ResponsiveContainer width="100%" height={150}>
                                                                                <LineChart data={advisorDetail.hourly_distribution}>
                                                                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                                                                    <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={2} className="fill-muted-foreground" />
                                                                                    <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" allowDecimals={false} />
                                                                                    <Tooltip contentStyle={tooltipStyle} formatter={(value) => [value, 'Mensajes']} />
                                                                                    <Line type="monotone" dataKey="count" stroke={COLORS.primary} strokeWidth={2} dot={{ r: 2 }} />
                                                                                </LineChart>
                                                                            </ResponsiveContainer>
                                                                        </div>
                                                                    </div>

                                                                    {Object.keys(advisorDetail.message_types).length > 0 && (
                                                                        <div className="flex flex-wrap gap-2">
                                                                            <span className="text-xs font-bold settings-title">Tipos de mensaje:</span>
                                                                            {Object.entries(advisorDetail.message_types).map(([type, count]) => (
                                                                                <span key={type} className="rounded-md border border-[#2e3f84]/15 bg-[#2e3f84]/10 px-2 py-1 text-[11px] font-semibold text-[#2e3f84] dark:border-white/10 dark:bg-white/[0.06] dark:text-neutral-100">
                                                                                    {type}: {count}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="py-6 text-center text-xs settings-subtitle">Error al cargar métricas</div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="py-8 text-center text-sm settings-subtitle">No hay datos de asesores disponibles</div>
                                )}
                            </SectionCard>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                            <SectionCard icon={BarChart3} title="Estadísticas generales" subtitle="Resumen comparativo del período" className="xl:col-span-2">
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={mainStatsData}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                        <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                                        <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" allowDecimals={false} />
                                        <Tooltip contentStyle={tooltipStyle} />
                                        <Bar dataKey="value" fill={COLORS.primary} radius={[6, 6, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </SectionCard>

                            <SectionCard icon={PieChartIcon} title={t('statistics.messages.byStatus')} subtitle="Mensajes salientes por estado">
                                {messagesStatusData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={250}>
                                        <PieChart>
                                            <Pie data={messagesStatusData} cx="50%" cy="50%" labelLine={false} label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`} outerRadius={82} dataKey="value">
                                                {messagesStatusData.map((entry, index) => (
                                                    <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={tooltipStyle} />
                                            <Legend wrapperStyle={{ fontSize: '11px' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : <EmptyChart message="No hay mensajes salientes en este período" />}
                            </SectionCard>

                            <SectionCard icon={CalendarDays} title={t('statistics.appointments.title')} subtitle="Respuesta de pacientes">
                                {appointmentsData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={250}>
                                        <PieChart>
                                            <Pie data={appointmentsData} cx="50%" cy="50%" labelLine={false} label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`} outerRadius={82} dataKey="value">
                                                {appointmentsData.map((entry) => (
                                                    <Cell key={entry.name} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip contentStyle={tooltipStyle} />
                                            <Legend wrapperStyle={{ fontSize: '11px' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : <EmptyChart message="No hay citas en este período" />}
                            </SectionCard>

                            <SectionCard icon={LineChartIcon} title={t('statistics.conversations.title')} subtitle="Distribución por estado">
                                <ResponsiveContainer width="100%" height={260}>
                                    <BarChart data={conversationsStatusData}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                        <XAxis dataKey="name" tick={{ fontSize: 10 }} className="fill-muted-foreground" angle={-15} textAnchor="end" height={60} />
                                        <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" allowDecimals={false} />
                                        <Tooltip contentStyle={tooltipStyle} />
                                        <Bar dataKey="value" fill={COLORS.info} radius={[6, 6, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </SectionCard>

                            <SectionCard icon={Users} title={t('statistics.users.title')} subtitle="Composición del equipo">
                                {usersData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={260}>
                                        <PieChart>
                                            <Pie data={usersData} cx="50%" cy="50%" labelLine={false} label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`} outerRadius={82} dataKey="value">
                                                <Cell fill={COLORS.primaryLight} />
                                                <Cell fill={COLORS.success} />
                                            </Pie>
                                            <Tooltip contentStyle={tooltipStyle} />
                                            <Legend wrapperStyle={{ fontSize: '11px' }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : <EmptyChart message="No hay usuarios registrados" />}
                            </SectionCard>

                            <SectionCard icon={Users} title="Rendimiento de asesores" subtitle="Resueltas, activas y mensajes enviados" className="xl:col-span-2">
                                {statistics.advisors.advisors.length > 0 ? (
                                    <div className="max-h-[360px] overflow-y-auto pr-1 custom-scrollbar-light">
                                        <div style={{ height: Math.max(260, statistics.advisors.advisors.length * 48) }}>
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={statistics.advisors.advisors} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                                    <XAxis type="number" tick={{ fontSize: 10 }} className="fill-muted-foreground" allowDecimals={false} />
                                                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} className="fill-muted-foreground" width={130} />
                                                    <Tooltip
                                                        contentStyle={tooltipStyle}
                                                        formatter={(value, name) => [
                                                            value,
                                                            name === 'resolved_conversations' ? 'Resueltas' : name === 'active_conversations' ? 'Activas' : name === 'messages_sent' ? 'Mensajes' : name,
                                                        ]}
                                                    />
                                                    <Legend
                                                        wrapperStyle={{ fontSize: '11px' }}
                                                        formatter={(value) => value === 'resolved_conversations' ? 'Resueltas' : value === 'active_conversations' ? 'Activas' : value === 'messages_sent' ? 'Mensajes' : value}
                                                    />
                                                    <Bar dataKey="resolved_conversations" fill={COLORS.success} radius={[0, 4, 4, 0]} />
                                                    <Bar dataKey="active_conversations" fill={COLORS.info} radius={[0, 4, 4, 0]} />
                                                    <Bar dataKey="messages_sent" fill={COLORS.primaryLight} radius={[0, 4, 4, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                ) : <EmptyChart message="No hay datos de asesores disponibles" />}
                            </SectionCard>
                        </div>
                    )}
                </div>

                <AnimatePresence>
                    {openMetric && (() => {
                        const m = metricModals[openMetric];
                        const MIcon = m.icon;
                        return (
                            <motion.div
                                key="metric-modal"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                onClick={() => setOpenMetric(null)}
                                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
                            >
                                <motion.div
                                    layoutId={`metric-${openMetric}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="card-gradient max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/50 p-6 shadow-2xl dark:border-white/10"
                                >
                                    <div className="mb-4 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#d4d8e8] bg-[#2e3f84]/10 text-[#2e3f84] dark:border-white/10 dark:bg-white/[0.05] dark:text-neutral-100">
                                                <MIcon className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h2 className="text-lg font-bold settings-title">{m.title}</h2>
                                                <p className="text-xs settings-subtitle">{m.headlineLabel}: <span className="font-bold settings-title">{formatNumber(m.headlineValue)}</span></p>
                                            </div>
                                        </div>
                                        <button onClick={() => setOpenMetric(null)} className="rounded-full p-2 settings-subtitle transition-colors hover:bg-[#2e3f84]/10 dark:hover:bg-white/10" title="Cerrar">
                                            <XCircle className="h-5 w-5" />
                                        </button>
                                    </div>

                                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="space-y-4">
                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                            {m.lines.map((line, idx) => (
                                                <StatLine key={idx} icon={line.icon} label={line.label} value={line.value} total={line.total} tone={line.tone} />
                                            ))}
                                        </div>
                                        {m.chart && (
                                            <div className="rounded-lg border border-[#d4d8e8]/80 bg-white/45 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                                                {m.chart}
                                            </div>
                                        )}
                                    </motion.div>
                                </motion.div>
                            </motion.div>
                        );
                    })()}
                </AnimatePresence>
            </div>
    );
}

// Skeleton que imita el layout real (cabecera, métricas, filtros y paneles)
// mientras Inertia trae la prop diferida `statistics` en la segunda petición.
function StatisticsSkeleton() {
    return (
        <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
            <div className="mx-auto flex max-w-7xl flex-col gap-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex items-start gap-3">
                        <Skeleton className="h-11 w-11 rounded-lg" />
                        <div className="space-y-2">
                            <Skeleton className="h-7 w-56" />
                            <Skeleton className="h-4 w-72" />
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <Skeleton className="h-9 w-44 rounded-lg" />
                        <Skeleton className="h-9 w-28 rounded-lg" />
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-[88px] rounded-lg" />
                    ))}
                </div>

                <Skeleton className="h-[116px] rounded-lg" />

                <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-[240px] rounded-lg" />
                    ))}
                    <Skeleton className="h-[300px] rounded-lg xl:col-span-2" />
                </div>
            </div>
        </div>
    );
}

export default function StatisticsIndex({ statistics }: StatisticsIndexProps) {
    const { t } = useTranslation();

    return (
        <AdminLayout>
            <Head title={t('statistics.title')} />
            {/* El layout (sidebar/topbar) y este cascarón aparecen al instante.
                <Deferred> muestra el skeleton hasta que llega la prop `statistics`. */}
            <Deferred data="statistics" fallback={<StatisticsSkeleton />}>
                <StatisticsView statistics={statistics as Statistics} />
            </Deferred>
        </AdminLayout>
    );
}
