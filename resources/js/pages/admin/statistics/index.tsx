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
    DollarSign,
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
    Wallet,
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
        /** Mediana (no media): la distribución tiene una cola larga que dispara el promedio. */
        median_response_time_minutes: number | null;
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
    /** null = el asesor no tiene conversaciones asignadas (sin datos), distinto de 0%. */
    resolution_rate: number | null;
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
        /** Recordatorio entregado, sin respuesta aún. confirmed+cancelled+awaiting_reply = reminder_sent. */
        awaiting_reply: number;
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
    costs?: {
        currency: string;
        rates_as_of: string;
        by_category: Record<string, { billable: number; free: number; rate: number; cost: number }>;
        total_cost: number;
        billable_total: number;
        free_total: number;
        outbound_total: number;
        with_pricing: number;
        without_pricing: number;
        coverage_percent: number;
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
    flowDemand?: {
        total: number;
        accepted_privacy: number;
        reached_menu: number;
        by_service: Record<string, number>;
        by_outcome: Record<string, number>;
        by_regimen: Record<string, number>;
        top_eps: { name: string; value: number }[];
        top_sub_service: { name: string; value: number }[];
        automation_rate: number;
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

/**
 * Duración en minutos → texto legible. Antes se rotulaba siempre como "{n} min",
 * de modo que una espera de 14 horas se leía "860,5 min".
 */
function formatDuration(minutes: number | null | undefined) {
    if (minutes === null || minutes === undefined) return 'N/A';
    if (minutes < 1) return '< 1 min';
    if (minutes < 60) return `${Math.round(minutes)} min`;

    const horas = Math.floor(minutes / 60);
    const resto = Math.round(minutes % 60);
    return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}

function formatMoney(value: number | null | undefined, currency = 'USD', maxDigits = 2) {
    try {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: maxDigits,
        }).format(Number(value ?? 0));
    } catch {
        return `${currency} ${Number(value ?? 0).toFixed(maxDigits)}`;
    }
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
    const base = 'card-gradient rounded-2xl p-4 shadow-sm shadow-[#2e3f84]/5';
    const inner = (
        <div className="flex items-center gap-3">
            <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', toneClasses(tone))}>
                <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold settings-subtitle">{label}</p>
                <p className="mt-1 truncate text-lg font-bold leading-tight settings-title">{value}</p>
                <p className="mt-0.5 truncate text-xs settings-subtitle">{detail}</p>
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
        <section className={cn('card-gradient rounded-2xl p-5 shadow-lg shadow-[#2e3f84]/5', className)}>
            <div className="mb-4 flex items-start justify-between gap-3 border-b border-[#d4d8e8]/80 pb-4 dark:border-white/10">
                <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2e3f84]/10 text-[#2e3f84] dark:bg-white/[0.05] dark:text-neutral-100">
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
        <div className="rounded-xl border border-transparent bg-white/45 px-3 py-2.5 dark:bg-white/[0.03]">
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
        <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed border-[#d4d8e8] text-sm settings-subtitle dark:border-white/10">
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
        pending: t('statistics.messages.deliveryStatus.pending'),
        sent: t('statistics.messages.deliveryStatus.sent'),
        delivered: t('statistics.messages.deliveryStatus.delivered'),
        read: t('statistics.messages.deliveryStatus.read'),
        failed: t('statistics.messages.deliveryStatus.failed'),
    };

    const deliveryItems = [
        { key: 'pending', icon: Clock, label: t('statistics.messages.deliveryStatus.pending'), value: statistics.messages.delivery_status.pending, tone: 'warning' as const },
        { key: 'sent', icon: Send, label: t('statistics.messages.sentPlural'), value: statistics.messages.delivery_status.sent, tone: 'info' as const },
        { key: 'delivered', icon: CheckCircle2, label: t('statistics.messages.deliveredPlural'), value: statistics.messages.delivery_status.delivered, tone: 'success' as const },
        { key: 'read', icon: CheckCircle2, label: t('statistics.messages.readPlural'), value: statistics.messages.delivery_status.read, tone: 'primary' as const },
        { key: 'failed', icon: XCircle, label: t('statistics.messages.errors'), value: statistics.messages.delivery_status.failed, tone: 'danger' as const },
    ];

    const appointmentItems = [
        { icon: CalendarDays, label: t('statistics.appointments.totalLoaded'), value: statistics.appointments.total, tone: 'primary' as const },
        { icon: Send, label: t('statistics.appointments.remindersSent'), value: statistics.appointments.reminder_sent, tone: 'info' as const },
        { icon: CheckCircle2, label: t('statistics.appointments.confirmed'), value: statistics.appointments.confirmed, tone: 'success' as const },
        { icon: XCircle, label: t('statistics.appointments.cancelled'), value: statistics.appointments.cancelled, tone: 'danger' as const },
        { icon: Clock, label: t('statistics.appointments.pending'), value: statistics.appointments.pending, tone: 'warning' as const },
        { icon: AlertCircle, label: t('statistics.appointments.failed'), value: statistics.appointments.failed, tone: 'danger' as const },
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

    // Sólo citas cuyo recordatorio SÍ se entregó: es lo único sobre lo que un paciente
    // pudo responder, y el gráfico se titula "Respuesta de pacientes".
    //
    // Antes se incluían 'pending' y 'failed' (citas que nunca recibieron recordatorio, así
    // que el paciente no pudo contestar) y se omitía 'sent' (entregado y aún sin respuesta),
    // que es justo la categoría más relevante: eran 24.606 citas invisibles, el 23% del total.
    // Con esto los tres trozos suman exactamente reminder_sent.
    const appointmentsData = [
        { name: t('statistics.appointments.confirmed'), value: statistics.appointments.confirmed, color: COLORS.success },
        { name: t('statistics.appointments.cancelled'), value: statistics.appointments.cancelled, color: COLORS.danger },
        { name: t('statistics.appointments.awaitingReply'), value: statistics.appointments.awaiting_reply, color: COLORS.warning },
    ].filter((item) => item.value > 0);

    const conversationsStatusData = conversationItems.map((item) => ({
        name: item.label,
        value: item.value,
    }));

    const mainStatsData = [
        { name: t('statistics.chart.messages'), value: statistics.messages.total },
        { name: t('statistics.chart.sent'), value: statistics.messages.sent_by_system },
        { name: t('statistics.chart.received'), value: statistics.messages.received_from_users },
        { name: t('statistics.chart.appointments'), value: statistics.appointments.total },
        { name: t('statistics.chart.conversations'), value: statistics.conversations.total },
        { name: t('statistics.chart.templates'), value: statistics.templates.total_sends },
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
            title: t('statistics.metricModal.messages.title'),
            headlineLabel: t('statistics.metricModal.messages.headline'),
            headlineValue: statistics.messages.total,
            lines: [
                { icon: Send, label: t('statistics.metricModal.messages.sentBySystem'), value: statistics.messages.sent_by_system, total: statistics.messages.total, tone: 'info' as const },
                { icon: MessageSquare, label: t('statistics.metricModal.messages.receivedFromPatients'), value: statistics.messages.received_from_users, total: statistics.messages.total, tone: 'success' as const },
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
            title: t('statistics.metricModal.appointments.title'),
            headlineLabel: t('statistics.appointments.totalLoaded'),
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
            title: t('statistics.metricModal.conversations.title'),
            headlineLabel: t('common.total'),
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
            title: t('statistics.metricModal.advisors.title'),
            headlineLabel: t('statistics.advisors.inTeam'),
            headlineValue: statistics.advisors.total_advisors,
            lines: [
                { icon: MessageSquare, label: t('statistics.advisors.assignedConversations'), value: statistics.advisors.total_conversations, total: undefined, tone: 'info' as const },
                { icon: CheckCircle2, label: t('statistics.advisors.resolved'), value: statistics.advisors.total_resolved, total: Math.max(statistics.advisors.total_conversations, 1), tone: 'success' as const },
                { icon: CalendarCheck2, label: t('statistics.advisors.scheduled'), value: statistics.advisors.total_scheduled, total: undefined, tone: 'primary' as const },
                { icon: Send, label: t('statistics.advisors.messagesSent'), value: statistics.advisors.total_messages_sent, total: undefined, tone: 'info' as const },
                { icon: TrendingUp, label: t('statistics.advisors.avgResolutionPercent'), value: statistics.advisors.avg_resolution_rate, total: 100, tone: 'success' as const },
            ],
            chart: null,
        },
        templates: {
            icon: FileText,
            title: t('statistics.metricModal.templates.title'),
            headlineLabel: t('statistics.chart.templates'),
            headlineValue: statistics.templates.total,
            lines: [
                { icon: Send, label: t('statistics.templates.totalSends'), value: statistics.templates.total_sends, total: undefined, tone: 'info' as const },
                { icon: CheckCircle2, label: t('statistics.templates.successfulSends'), value: statistics.templates.successful_sends, total: Math.max(statistics.templates.total_sends, 1), tone: 'success' as const },
                { icon: XCircle, label: t('statistics.templates.failedSends'), value: statistics.templates.failed_sends, total: Math.max(statistics.templates.total_sends, 1), tone: 'danger' as const },
                { icon: Users, label: t('statistics.users.admins'), value: statistics.users.admins, total: Math.max(statistics.users.total, 1), tone: 'primary' as const },
                { icon: Users, label: t('statistics.users.advisors'), value: statistics.users.advisors, total: Math.max(statistics.users.total, 1), tone: 'info' as const },
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
                            <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-[#2e3f84] shadow-sm shadow-[#2e3f84]/5 dark:bg-white/[0.04] dark:text-neutral-100">
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
                            <div className="inline-flex rounded-xl bg-white/70 p-1 dark:bg-white/[0.04]">
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
                                    {t('statistics.viewTable')}
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
                                    {t('statistics.viewCharts')}
                                </button>
                            </div>

                            <Button
                                type="button"
                                onClick={handleExport}
                                disabled={isExporting}
                                className="h-9 rounded-xl px-5 text-xs font-semibold settings-btn-primary disabled:opacity-50"
                            >
                                <Download className="mr-2 h-3.5 w-3.5" />
                                {isExporting ? t('statistics.exporting') : t('statistics.export')}
                            </Button>
                        </div>
                    </header>

                    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                        <MetricCard icon={MessageSquare} label={t('statistics.chart.messages')} value={formatNumber(statistics.messages.total)} detail={t('statistics.metricCard.sentDetail', { value: formatNumber(statistics.messages.sent_by_system) })} layoutId="metric-messages" onClick={() => setOpenMetric('messages')} />
                        <MetricCard icon={CalendarCheck2} label={t('statistics.chart.appointments')} value={formatNumber(statistics.appointments.total)} detail={t('statistics.metricCard.confirmedDetail', { value: formatNumber(statistics.appointments.confirmed) })} tone="success" layoutId="metric-appointments" onClick={() => setOpenMetric('appointments')} />
                        <MetricCard icon={Activity} label={t('statistics.chart.conversations')} value={formatNumber(statistics.conversations.total)} detail={t('statistics.metricCard.unreadDetail', { value: formatNumber(statistics.conversations.unread) })} tone={statistics.conversations.unread > 0 ? 'warning' : 'info'} layoutId="metric-conversations" onClick={() => setOpenMetric('conversations')} />
                        <MetricCard icon={Users} label={t('statistics.users.advisors')} value={formatNumber(statistics.advisors.total_advisors)} detail={t('statistics.metricCard.avgResolutionDetail', { value: statistics.advisors.avg_resolution_rate })} tone="primary" layoutId="metric-advisors" onClick={() => setOpenMetric('advisors')} />
                        <MetricCard icon={FileText} label={t('statistics.chart.templates')} value={formatNumber(statistics.templates.total)} detail={t('statistics.metricCard.sendsDetail', { value: formatNumber(statistics.templates.total_sends) })} tone="info" layoutId="metric-templates" onClick={() => setOpenMetric('templates')} />
                    </section>

                    <form onSubmit={handleFilterSubmit} className="card-gradient rounded-2xl p-4 shadow-lg shadow-[#2e3f84]/5">
                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_auto] xl:items-end">
                            <div>
                                <Label className="mb-2 block text-xs font-semibold settings-label">{t('statistics.filters.period')}</Label>
                                <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/70 p-1 dark:bg-white/[0.04] sm:grid-cols-5">
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
                                    className="h-10 rounded-xl text-sm settings-input focus:ring-2 focus:ring-[#2e3f84]/30"
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
                                    className="h-10 rounded-xl text-sm settings-input focus:ring-2 focus:ring-[#2e3f84]/30"
                                />
                            </div>

                            <Button type="submit" className="h-10 rounded-xl px-5 text-xs font-semibold settings-btn-primary">
                                <Filter className="mr-2 h-3.5 w-3.5" />
                                {t('statistics.filters.apply')}
                            </Button>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs settings-subtitle">
                            <span className="rounded-md bg-white/70 px-2.5 py-1 font-semibold dark:bg-white/[0.04]">
                                {startDate && endDate ? t('statistics.filters.dateRange', { start: startDate, end: endDate }) : periodLabel}
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
                                    {t('statistics.filters.clearRange')}
                                </button>
                            )}
                        </div>
                    </form>

                    {statistics.costs && (() => {
                        const c = statistics.costs;
                        const catLabels: Record<string, string> = {
                            marketing: t('statistics.costs.categories.marketing'),
                            utility: t('statistics.costs.categories.utility'),
                            authentication: t('statistics.costs.categories.authentication'),
                            service: t('statistics.costs.categories.service'),
                        };
                        const rows = Object.entries(c.by_category);
                        return (
                            <SectionCard
                                icon={Wallet}
                                title={t('statistics.costs.title')}
                                subtitle={`${t('statistics.costs.subtitle')}${c.rates_as_of ? ` (${c.rates_as_of})` : ''}`}
                                action={
                                    <div className="text-right">
                                        <p className="text-xs settings-subtitle">{t('statistics.costs.periodEstimate')}</p>
                                        <p className="text-2xl font-bold settings-title">{formatMoney(c.total_cost, c.currency)}</p>
                                    </div>
                                }
                            >
                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
                                    <div className="overflow-hidden rounded-xl">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="bg-[#2e3f84]/[0.06] text-left settings-subtitle dark:bg-white/[0.05]">
                                                    <th className="px-3 py-2 font-semibold">{t('statistics.costs.table.category')}</th>
                                                    <th className="px-3 py-2 text-right font-semibold">{t('statistics.costs.table.billable')}</th>
                                                    <th className="px-3 py-2 text-right font-semibold">{t('statistics.costs.table.rate')}</th>
                                                    <th className="px-3 py-2 text-right font-semibold">{t('statistics.costs.table.cost')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {rows.map(([key, data]) => (
                                                    <tr key={key} className="border-t border-[#d4d8e8]/60 dark:border-white/10">
                                                        <td className="px-3 py-2 settings-title">{catLabels[key] ?? key}</td>
                                                        <td className="px-3 py-2 text-right settings-title">{formatNumber(data.billable)}</td>
                                                        <td className="px-3 py-2 text-right settings-subtitle">{data.rate === 0 ? t('statistics.costs.free') : formatMoney(data.rate, c.currency, 4)}</td>
                                                        <td className="px-3 py-2 text-right font-semibold settings-title">{formatMoney(data.cost, c.currency)}</td>
                                                    </tr>
                                                ))}
                                                <tr className="border-t-2 border-[#2e3f84]/25 bg-[#2e3f84]/[0.05] dark:bg-white/[0.04]">
                                                    <td className="px-3 py-2 font-bold settings-title" colSpan={3}>{t('statistics.costs.estimatedTotal')}</td>
                                                    <td className="px-3 py-2 text-right font-bold settings-title">{formatMoney(c.total_cost, c.currency)}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="flex flex-col gap-2.5">
                                        <StatLine icon={Send} label={t('statistics.costs.billableOutbound')} value={c.billable_total} tone="warning" />
                                        <StatLine icon={CheckCircle2} label={t('statistics.costs.freeService')} value={c.free_total} tone="success" />
                                        <StatLine icon={AlertCircle} label={t('statistics.costs.noBillingData')} value={c.without_pricing} tone="info" />
                                        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                                            <DollarSign className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                            <span>
                                                {t('statistics.costs.disclaimer', { percent: c.coverage_percent })} <span className="font-semibold">{t('statistics.costs.metaBillingPath')}</span>.
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </SectionCard>
                        );
                    })()}

                    {!showCharts ? (
                        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                            {/* El menú de bienvenida está apagado casi siempre; sin recorridos, este
                                panel entero se oculta en vez de ocupar media pantalla con ceros.
                                Si se reactiva el flujo y llegan datos, vuelve a aparecer solo. */}
                            {(statistics.flowDemand?.total ?? 0) > 0 && (
                            <SectionCard icon={Activity} title={t('statistics.flowDemand.title')} subtitle={t('statistics.flowDemand.subtitle')} className="xl:col-span-2">
                                {(() => {
                                    const fd = statistics.flowDemand!;
                                    const svcLabels: Record<string, string> = { agendamiento: t('statistics.flowDemand.services.scheduling'), cancelacion: t('statistics.flowDemand.services.cancellation'), informacion: t('statistics.flowDemand.services.information'), asesor: t('statistics.flowDemand.services.talkToAdvisor') };
                                    const outLabels: Record<string, string> = { self_service: t('statistics.flowDemand.outcomes.selfService'), advisor: t('statistics.flowDemand.outcomes.advisor'), rejected: t('statistics.flowDemand.outcomes.rejected'), in_progress: t('statistics.flowDemand.outcomes.inProgress') };
                                    return (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                                <MetricCard icon={MessageSquare} label={t('statistics.flowDemand.flows')} value={formatNumber(fd.total)} detail={t('statistics.flowDemand.started')} />
                                                <MetricCard icon={CheckCircle2} label={t('statistics.flowDemand.outcomes.selfService')} value={`${fd.automation_rate}%`} detail={t('statistics.flowDemand.resolvedWithoutAdvisor')} tone="success" />
                                                <MetricCard icon={Activity} label={t('statistics.flowDemand.reachedMenu')} value={formatNumber(fd.reached_menu)} detail={t('statistics.flowDemand.accepted', { value: formatNumber(fd.accepted_privacy) })} tone="info" />
                                                <MetricCard icon={Users} label={t('statistics.flowDemand.toAdvisor')} value={formatNumber(fd.by_outcome.advisor ?? 0)} detail={t('statistics.flowDemand.requiredAgent')} tone="warning" />
                                            </div>
                                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                                <div>
                                                    <h3 className="mb-2 text-xs font-bold settings-title">{t('statistics.flowDemand.byService')}</h3>
                                                    <div className="space-y-2">
                                                        {Object.entries(fd.by_service).map(([k, v]) => (
                                                            <StatLine key={k} icon={MessageSquare} label={svcLabels[k] ?? k} value={v} total={fd.total} tone="primary" />
                                                        ))}
                                                    </div>
                                                </div>
                                                <div>
                                                    <h3 className="mb-2 text-xs font-bold settings-title">{t('statistics.flowDemand.outcome')}</h3>
                                                    <div className="space-y-2">
                                                        {Object.entries(fd.by_outcome).map(([k, v]) => (
                                                            <StatLine key={k} icon={Activity} label={outLabels[k] ?? k} value={v} total={fd.total} tone={k === 'self_service' ? 'success' : k === 'advisor' ? 'warning' : k === 'rejected' ? 'danger' : 'info'} />
                                                        ))}
                                                    </div>
                                                </div>
                                                <div>
                                                    <h3 className="mb-2 text-xs font-bold settings-title">{t('statistics.flowDemand.regimen')}</h3>
                                                    <div className="space-y-2">
                                                        {Object.entries(fd.by_regimen).map(([k, v]) => (
                                                            <StatLine key={k} icon={Users} label={k === 'subsidiado' ? t('statistics.flowDemand.regimens.subsidized') : k === 'contributivo' ? t('statistics.flowDemand.regimens.contributory') : k} value={v} total={fd.total} tone="info" />
                                                        ))}
                                                    </div>
                                                </div>
                                                <div>
                                                    <h3 className="mb-2 text-xs font-bold settings-title">{t('statistics.flowDemand.topEps')}</h3>
                                                    <div className="space-y-2">
                                                        {fd.top_eps.length ? fd.top_eps.map((e) => (
                                                            <StatLine key={e.name} icon={Users} label={e.name} value={e.value} total={fd.total} tone="primary" />
                                                        )) : <EmptyChart message={t('statistics.flowDemand.noEpsData')} />}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </SectionCard>
                            )}

                            <SectionCard
                                icon={Users}
                                title={t('statistics.advisors.performanceTitle')}
                                subtitle={t('statistics.advisors.performanceSubtitle')}
                                className="xl:col-span-2"
                                action={<span className="rounded-md bg-white/70 px-2.5 py-1 text-[11px] font-semibold settings-subtitle dark:bg-white/[0.04]">{t('statistics.advisors.clickForDetail')}</span>}
                            >
                                <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                                    <MetricCard icon={Users} label={t('statistics.users.advisors')} value={statistics.advisors.total_advisors} detail={t('statistics.advisors.onTheTeam')} />
                                    <MetricCard icon={MessageSquare} label={t('statistics.chart.conversations')} value={formatNumber(statistics.advisors.total_conversations)} detail={t('statistics.advisors.assigned')} tone="info" />
                                    <MetricCard icon={CheckCircle2} label={t('statistics.advisors.resolved')} value={formatNumber(statistics.advisors.total_resolved)} detail={t('statistics.advisors.closedResolved')} tone="success" />
                                    <MetricCard icon={Send} label={t('statistics.chart.messages')} value={formatNumber(statistics.advisors.total_messages_sent)} detail={t('statistics.advisors.sentLower')} />
                                    <MetricCard icon={TrendingUp} label={t('statistics.advisors.average')} value={`${statistics.advisors.avg_resolution_rate}%`} detail={t('statistics.advisors.resolution')} tone="success" />
                                </div>

                                {statistics.advisors.top_performer && (
                                    <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
                                        <span className="font-bold">{t('statistics.advisors.topPerformerLabel')}</span> {statistics.advisors.top_performer.name} {t('statistics.advisors.topPerformerText', { resolved: statistics.advisors.top_performer.resolved_conversations, rate: statistics.advisors.top_performer.resolution_rate })}
                                    </div>
                                )}

                                {statistics.advisors.advisors.length > 0 ? (
                                    <div className="space-y-2">
                                        {statistics.advisors.advisors.map((advisor) => {
                                            const expanded = expandedAdvisor === advisor.id;
                                            // resolution_rate es null cuando el asesor no tiene
                                            // conversaciones asignadas: eso es "sin datos", no un 0%.
                                            // Antes caía en el tramo <40 y se pintaba en rojo, señalando
                                            // como bajo rendimiento a quien no tenía carga.
                                            const rate = advisor.resolution_rate;
                                            const rateTone =
                                                rate === null ? 'info' : rate >= 70 ? 'success' : rate >= 40 ? 'warning' : 'danger';

                                            return (
                                                <div key={advisor.id} className="overflow-hidden rounded-xl bg-white/45 dark:bg-white/[0.03]">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleAdvisorDetail(advisor.id)}
                                                        className="flex w-full flex-col gap-3 px-4 py-3 text-left transition-colors hover:bg-white/75 dark:hover:bg-white/[0.04] lg:flex-row lg:items-center lg:justify-between"
                                                    >
                                                        <div className="flex min-w-0 items-center gap-3">
                                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2e3f84] text-xs font-bold text-white shadow-sm shadow-[#2e3f84]/20">
                                                                {advisor.name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    {expanded ? <ChevronUp className="h-4 w-4 settings-title" /> : <ChevronDown className="h-4 w-4 settings-subtitle" />}
                                                                    <p className="truncate text-sm font-bold settings-title">{advisor.name}</p>
                                                                </div>
                                                                <p className="mt-1 text-xs settings-subtitle">
                                                                    {t('statistics.advisors.rowSummary', { conversations: formatNumber(advisor.total_conversations), messages: formatNumber(advisor.messages_sent), scheduled: formatNumber(advisor.scheduled_conversations) })}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-3 gap-2 text-right text-xs lg:w-[360px]">
                                                            <div>
                                                                <p className="font-bold settings-title">{formatNumber(advisor.resolved_conversations)}</p>
                                                                <p className="settings-subtitle">{t('statistics.advisors.resolvedLower')}</p>
                                                            </div>
                                                            <div>
                                                                <p className="font-bold settings-title">{formatNumber(advisor.active_conversations)}</p>
                                                                <p className="settings-subtitle">{t('statistics.advisors.activeLower')}</p>
                                                            </div>
                                                            <div>
                                                                <span className={cn('inline-flex rounded-md border px-2 py-1 text-[11px] font-bold', toneClasses(rateTone))}>
                                                                    {rate === null ? t('statistics.advisors.noData') : `${rate}%`}
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
                                                                    className="h-8 w-[145px] rounded-xl text-xs settings-input"
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
                                                                    className="h-8 w-[145px] rounded-xl text-xs settings-input"
                                                                />
                                                            </div>

                                                            {loadingAdvisor ? (
                                                                <div className="flex items-center justify-center py-8">
                                                                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#2e3f84] border-t-transparent" />
                                                                    <span className="ml-2 text-xs settings-subtitle">{t('statistics.advisors.loadingMetrics')}</span>
                                                                </div>
                                                            ) : advisorDetail ? (
                                                                <div className="space-y-4">
                                                                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
                                                                        <MetricCard icon={Send} label={t('statistics.chart.messages')} value={advisorDetail.summary.messages_sent} detail={t('statistics.advisors.sentLower')} />
                                                                        <MetricCard icon={TrendingUp} label={t('statistics.advisors.resolutionCap')} value={`${advisorDetail.summary.resolution_rate}%`} detail={t('statistics.advisors.rate')} tone="success" />
                                                                        <MetricCard icon={Timer} label={t('statistics.advisors.typicalResponse')} value={formatDuration(advisorDetail.summary.median_response_time_minutes)} detail={t('statistics.advisors.time')} tone="info" />
                                                                        <MetricCard icon={CalendarCheck2} label={t('statistics.advisors.scheduled')} value={advisorDetail.summary.scheduled_conversations} detail={t('statistics.advisors.conversationsLower')} />
                                                                        <MetricCard icon={Activity} label={t('statistics.advisors.open')} value={advisorDetail.summary.active_conversations + advisorDetail.summary.pending_conversations} detail={t('statistics.advisors.activePending')} tone="warning" />
                                                                    </div>

                                                                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                                                        <div className="rounded-xl bg-white/45 p-3 dark:bg-white/[0.03]">
                                                                            <h4 className="mb-2 flex items-center gap-2 text-xs font-bold settings-title">
                                                                                <TrendingUp className="h-3.5 w-3.5" />
                                                                                {t('statistics.advisors.dailyActivity')}
                                                                            </h4>
                                                                            <ResponsiveContainer width="100%" height={150}>
                                                                                <BarChart data={advisorDetail.daily_activity}>
                                                                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                                                                    <XAxis dataKey="label" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                                                                                    <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" allowDecimals={false} />
                                                                                    <Tooltip contentStyle={tooltipStyle} formatter={(value) => [value, t('statistics.chart.messages')]} />
                                                                                    <Bar dataKey="count" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                                                                                </BarChart>
                                                                            </ResponsiveContainer>
                                                                        </div>

                                                                        <div className="rounded-xl bg-white/45 p-3 dark:bg-white/[0.03]">
                                                                            <h4 className="mb-2 flex items-center gap-2 text-xs font-bold settings-title">
                                                                                <Timer className="h-3.5 w-3.5" />
                                                                                {t('statistics.advisors.hourlyDistribution')}
                                                                            </h4>
                                                                            <ResponsiveContainer width="100%" height={150}>
                                                                                <LineChart data={advisorDetail.hourly_distribution}>
                                                                                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                                                                    <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={2} className="fill-muted-foreground" />
                                                                                    <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" allowDecimals={false} />
                                                                                    <Tooltip contentStyle={tooltipStyle} formatter={(value) => [value, t('statistics.chart.messages')]} />
                                                                                    <Line type="monotone" dataKey="count" stroke={COLORS.primary} strokeWidth={2} dot={{ r: 2 }} />
                                                                                </LineChart>
                                                                            </ResponsiveContainer>
                                                                        </div>
                                                                    </div>

                                                                    {Object.keys(advisorDetail.message_types).length > 0 && (
                                                                        <div className="flex flex-wrap gap-2">
                                                                            <span className="text-xs font-bold settings-title">{t('statistics.advisors.messageTypes')}</span>
                                                                            {Object.entries(advisorDetail.message_types).map(([type, count]) => (
                                                                                <span key={type} className="rounded-md border border-[#2e3f84]/15 bg-[#2e3f84]/10 px-2 py-1 text-[11px] font-semibold text-[#2e3f84] dark:border-white/10 dark:bg-white/[0.06] dark:text-neutral-100">
                                                                                    {type}: {count}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="py-6 text-center text-xs settings-subtitle">{t('statistics.advisors.errorLoadingMetrics')}</div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="py-8 text-center text-sm settings-subtitle">{t('statistics.advisors.noData')}</div>
                                )}
                            </SectionCard>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                            <SectionCard icon={BarChart3} title={t('statistics.general.title')} subtitle={t('statistics.general.subtitle')} className="xl:col-span-2">
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

                            <SectionCard icon={PieChartIcon} title={t('statistics.messages.byStatus')} subtitle={t('statistics.messages.byStatusSubtitle')}>
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
                                ) : <EmptyChart message={t('statistics.messages.noOutbound')} />}
                            </SectionCard>

                            <SectionCard icon={CalendarDays} title={t('statistics.appointments.title')} subtitle={t('statistics.appointments.patientResponseSubtitle')}>
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
                                ) : <EmptyChart message={t('statistics.appointments.noData')} />}
                            </SectionCard>

                            <SectionCard icon={LineChartIcon} title={t('statistics.conversations.title')} subtitle={t('statistics.conversations.byStatusSubtitle')}>
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

                            <SectionCard icon={Users} title={t('statistics.users.title')} subtitle={t('statistics.users.teamCompositionSubtitle')}>
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
                                ) : <EmptyChart message={t('statistics.users.noData')} />}
                            </SectionCard>

                            <SectionCard icon={Users} title={t('statistics.advisors.performanceTitle')} subtitle={t('statistics.advisors.chartSubtitle')} className="xl:col-span-2">
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
                                                            name === 'resolved_conversations' ? t('statistics.advisors.resolved') : name === 'active_conversations' ? t('statistics.advisors.active') : name === 'messages_sent' ? t('statistics.chart.messages') : name,
                                                        ]}
                                                    />
                                                    <Legend
                                                        wrapperStyle={{ fontSize: '11px' }}
                                                        formatter={(value) => value === 'resolved_conversations' ? t('statistics.advisors.resolved') : value === 'active_conversations' ? t('statistics.advisors.active') : value === 'messages_sent' ? t('statistics.chart.messages') : value}
                                                    />
                                                    <Bar dataKey="resolved_conversations" fill={COLORS.success} radius={[0, 4, 4, 0]} />
                                                    <Bar dataKey="active_conversations" fill={COLORS.info} radius={[0, 4, 4, 0]} />
                                                    <Bar dataKey="messages_sent" fill={COLORS.primaryLight} radius={[0, 4, 4, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                ) : <EmptyChart message={t('statistics.advisors.noData')} />}
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
                                    className="card-gradient max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl p-6 shadow-2xl"
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
                                        <button onClick={() => setOpenMetric(null)} className="rounded-full p-2 settings-subtitle transition-colors hover:bg-[#2e3f84]/10 dark:hover:bg-white/10" title={t('common.close')}>
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
                                            <div className="rounded-xl bg-white/45 p-3 dark:bg-white/[0.03]">
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
                        <Skeleton key={i} className="h-[88px] rounded-2xl" />
                    ))}
                </div>

                <Skeleton className="h-[116px] rounded-2xl" />

                <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-[240px] rounded-2xl" />
                    ))}
                    <Skeleton className="h-[300px] rounded-2xl xl:col-span-2" />
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
