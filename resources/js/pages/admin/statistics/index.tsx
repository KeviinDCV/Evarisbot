import AdminLayout from '@/layouts/admin-layout';
import { Head, router } from '@inertiajs/react';
import { BarChart3, Download, Calendar, MessageSquare, FileText, Users, Clock, CheckCircle2, XCircle, Calendar as CalendarIcon, Send, AlertCircle, Filter, Table2 } from 'lucide-react';
import { useState, FormEventHandler } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

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
        by_status: {
            [key: string]: number;
        };
    };
    conversations: {
        total: number;
        active: number;
        pending: number;
        in_progress: number;
        resolved: number;
        closed: number;
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
        total_active: number;
        total_with_unread: number;
        total_messages_sent: number;
        avg_resolution_rate: number;
        top_performer: {
            id: number;
            name: string;
            total_conversations: number;
            resolved_conversations: number;
            active_conversations: number;
            conversations_with_unread: number;
            messages_sent: number;
            resolution_rate: number;
        } | null;
        advisors: Array<{
            id: number;
            name: string;
            total_conversations: number;
            resolved_conversations: number;
            active_conversations: number;
            conversations_with_unread: number;
            messages_sent: number;
            resolution_rate: number;
        }>;
    };
    date_range: {
        start?: string;
        end?: string;
        period: string;
    };
}

interface StatisticsIndexProps {
    statistics: Statistics;
}

const COLORS = {
    primary: '#2E3F84',
    primaryLight: '#3E4F94',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#3B82F6',
};

const StatRow = ({ icon: Icon, label, value, index }: { icon: any; label: string; value: number; index?: number }) => (
    <div 
        className={`flex items-center justify-between py-1.5 px-2 rounded-none transition-colors stat-row-hover ${index !== undefined && index % 2 === 0 ? 'stat-row-alt' : ''}`}
    >
        <div className="flex items-center gap-2">
            <Icon className="w-3 h-3 settings-title" />
            <span className="settings-subtitle" style={{ fontSize: 'var(--text-xs)' }}>
                {label}
            </span>
        </div>
        <span className="font-bold settings-title" style={{ fontSize: 'var(--text-xs)' }}>
            {value.toLocaleString()}
        </span>
    </div>
);

export default function StatisticsIndex({ statistics }: StatisticsIndexProps) {
    const { t } = useTranslation();
    const [period, setPeriod] = useState(statistics.date_range.period || 'all');
    const [startDate, setStartDate] = useState(statistics.date_range.start || '');
    const [endDate, setEndDate] = useState(statistics.date_range.end || '');
    const [isExporting, setIsExporting] = useState(false);
    const [showCharts, setShowCharts] = useState(false);

    const handleFilterSubmit: FormEventHandler = (e) => {
        e.preventDefault();
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

    // Preparar datos para gráficos
    const deliveryStatusLabels: Record<string, string> = {
        pending: 'Pendiente de envío',
        sent: 'Procesando',
        delivered: 'Entregado',
        read: 'Leído',
        failed: 'Fallido',
    };

    const messagesStatusData = Object.entries(statistics.messages.delivery_status).map(([name, value]) => ({
        name: deliveryStatusLabels[name] || name,
        value,
    }));

    const appointmentsData = [
        { name: t('statistics.appointments.confirmed'), value: statistics.appointments.confirmed, color: COLORS.success },
        { name: t('statistics.appointments.cancelled'), value: statistics.appointments.cancelled, color: COLORS.danger },
        { name: t('statistics.appointments.pending'), value: statistics.appointments.pending, color: COLORS.info },
    ];

    const conversationsStatusData = [
        { name: t('statistics.conversations.active'), value: statistics.conversations.active },
        { name: t('statistics.conversations.pending'), value: statistics.conversations.pending },
        { name: t('statistics.conversations.inProgress'), value: statistics.conversations.in_progress },
        { name: t('statistics.conversations.resolved'), value: statistics.conversations.resolved },
        { name: t('statistics.conversations.closed'), value: statistics.conversations.closed },
    ];

    const mainStatsData = [
        { name: 'Total mensajes', value: statistics.messages.total },
        { name: 'Enviados (sistema)', value: statistics.messages.sent_by_system },
        { name: 'Recibidos (clientes)', value: statistics.messages.received_from_users },
        { name: t('statistics.appointments.total'), value: statistics.appointments.total },
        { name: t('statistics.conversations.total'), value: statistics.conversations.total },
    ];

    return (
        <AdminLayout>
            <Head title={t('statistics.title')} />

            <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="mb-6" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
                            <div>
                                <h1 className="font-bold settings-title" style={{ fontSize: 'var(--text-3xl)' }}>
                                    {t('statistics.title')}
                                </h1>
                                <p className="settings-subtitle" style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-xs)' }}>
                                    {t('statistics.subtitle')}
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                                {/* Switch para gráficos */}
                                <div className="flex items-center gap-3 card-gradient rounded-none p-2 shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_4px_rgba(46,63,132,0.06),inset_0_1px_0_rgba(255,255,255,0.9)]">
                                    <Table2 className={`w-4 h-4 transition-colors`} style={{ color: !showCharts ? '#2e3f84' : '#6b7494' }} />
                                    <label htmlFor="show-charts-toggle" className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            id="show-charts-toggle"
                                            name="show-charts-toggle"
                                            type="checkbox"
                                            checked={showCharts}
                                            onChange={(e) => setShowCharts(e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-b peer-checked:from-[#3e4f94] peer-checked:to-[#2e3f84]"></div>
                                    </label>
                                    <BarChart3 className={`w-4 h-4 transition-colors`} style={{ color: showCharts ? '#2e3f84' : '#6b7494' }} />
                                </div>
                                <Button
                                    onClick={handleExport}
                                    disabled={isExporting}
                                    className="font-semibold text-white transition-all duration-200 border-0 relative overflow-hidden"
                                    style={{
                                        backgroundColor: 'var(--primary-base)',
                                        boxShadow: 'var(--shadow-md)',
                                        backgroundImage: 'var(--gradient-shine)',
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
                                    <Download className="w-4 h-4 mr-2" />
                                    {isExporting ? t('statistics.exporting') : t('statistics.export')}
                                </Button>
                            </div>
                        </div>

                        {/* Filtros */}
                        <form onSubmit={handleFilterSubmit}>
                            <div className="card-gradient rounded-none p-4 shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_4px_rgba(46,63,132,0.06),0_4px_12px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.9)] flex flex-wrap gap-4 items-end">
                                <div style={{ flex: '1 1 200px', minWidth: '180px' }}>
                                    <label htmlFor="stats-period" className="font-semibold block mb-2 settings-label" style={{ fontSize: 'var(--text-sm)' }}>
                                        {t('statistics.filters.period')}
                                    </label>
                                    <select
                                        id="stats-period"
                                        name="stats-period"
                                        value={period}
                                        onChange={(e) => setPeriod(e.target.value)}
                                        className="settings-input w-full rounded-none transition-all duration-200 cursor-pointer focus:ring-2 focus:ring-primary/20"
                                        style={{
                                            height: 'clamp(2.25rem, 2.25rem + 0.15vw, 2.5rem)',
                                            fontSize: 'var(--text-sm)',
                                            padding: '0 2.5rem 0 var(--space-base)',
                                            appearance: 'none',
                                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%232e3f84' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                                            backgroundRepeat: 'no-repeat',
                                            backgroundPosition: 'right 0.75rem center',
                                            backgroundSize: '1rem',
                                        }}
                                    >
                                        <option value="today">{t('statistics.filters.periods.today')}</option>
                                        <option value="week">{t('statistics.filters.periods.week')}</option>
                                        <option value="month">{t('statistics.filters.periods.month')}</option>
                                        <option value="year">{t('statistics.filters.periods.year')}</option>
                                        <option value="all">{t('statistics.filters.periods.all')}</option>
                                    </select>
                                </div>
                                <div style={{ flex: '1 1 180px', minWidth: '160px' }}>
                                    <label htmlFor="stats-start-date" className="font-semibold block mb-2 settings-label" style={{ fontSize: 'var(--text-sm)' }}>
                                        {t('statistics.filters.startDate')}
                                    </label>
                                    <Input
                                        id="stats-start-date"
                                        name="stats-start-date"
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="settings-input rounded-none transition-all duration-200"
                                        style={{
                                            height: 'clamp(2.25rem, 2.25rem + 0.15vw, 2.5rem)',
                                            fontSize: 'var(--text-sm)',
                                        }}
                                    />
                                </div>
                                <div style={{ flex: '1 1 180px', minWidth: '160px' }}>
                                    <label htmlFor="stats-end-date" className="font-semibold block mb-2 settings-label" style={{ fontSize: 'var(--text-sm)' }}>
                                        {t('statistics.filters.endDate')}
                                    </label>
                                    <Input
                                        id="stats-end-date"
                                        name="stats-end-date"
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="settings-input rounded-none transition-all duration-200"
                                        style={{
                                            height: 'clamp(2.25rem, 2.25rem + 0.15vw, 2.5rem)',
                                            fontSize: 'var(--text-sm)',
                                        }}
                                    />
                                </div>
                                <div style={{ flex: '0 1 auto' }}>
                                    <Button
                                        type="submit"
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
                                        <Filter className="w-4 h-4 mr-2" />
                                        {t('statistics.filters.apply')}
                                    </Button>
                                </div>
                            </div>
                        </form>
                    </div>

                    {!showCharts ? (
                        /* Vista de Estadísticas - Bento Grid */
                        <div className="grid grid-cols-2 gap-4">
                            {/* Mensajes */}
                            <div className="card-gradient rounded-none shadow-[0_1px_3px_rgba(46,63,132,0.06),0_2px_6px_rgba(46,63,132,0.08),0_6px_16px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] p-3">
                                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border dark:border-[hsl(231,20%,22%)]">
                                    <MessageSquare className="w-3.5 h-3.5 settings-title" />
                                    <h2 className="font-bold settings-title" style={{ fontSize: 'var(--text-xs)' }}>
                                        {t('statistics.messages.title')}
                                    </h2>
                                </div>
                                <div className="space-y-1">
                                    <StatRow icon={MessageSquare} label="Total de mensajes" value={statistics.messages.total} index={0} />
                                    <StatRow icon={Send} label="Enviados por asesores/sistema" value={statistics.messages.sent_by_system} index={1} />
                                    <StatRow icon={MessageSquare} label="Recibidos de clientes" value={statistics.messages.received_from_users} index={2} />
                                </div>
                                <div className="mt-2 pt-2 border-t border-border dark:border-[hsl(231,20%,22%)]">
                                    <h3 className="font-semibold mb-1.5 settings-title" style={{ fontSize: 'var(--text-xs)' }}>
                                        Estado de entrega (solo mensajes enviados)
                                    </h3>
                                    <div className="space-y-1">
                                        <StatRow icon={Clock} label="Pendiente de envío" value={statistics.messages.delivery_status.pending} index={0} />
                                        <StatRow icon={Send} label="Procesando envío" value={statistics.messages.delivery_status.sent} index={1} />
                                        <StatRow icon={CheckCircle2} label="Entregado al destinatario" value={statistics.messages.delivery_status.delivered} index={2} />
                                        <StatRow icon={CheckCircle2} label="Leído por el destinatario" value={statistics.messages.delivery_status.read} index={3} />
                                        <StatRow icon={XCircle} label="Fallido" value={statistics.messages.delivery_status.failed} index={4} />
                                    </div>
                                </div>
                            </div>

                            {/* Citas */}
                            <div className="card-gradient rounded-none shadow-[0_1px_3px_rgba(46,63,132,0.06),0_2px_6px_rgba(46,63,132,0.08),0_6px_16px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] p-3">
                                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border dark:border-[hsl(231,20%,22%)]">
                                    <Calendar className="w-3.5 h-3.5 settings-title" />
                                    <h2 className="font-bold settings-title" style={{ fontSize: 'var(--text-xs)' }}>
                                        {t('statistics.appointments.title')}
                                    </h2>
                                </div>
                                <div className="space-y-1">
                                    <StatRow icon={Calendar} label="Total de citas cargadas" value={statistics.appointments.total} index={0} />
                                    <StatRow icon={Send} label="Recordatorios enviados" value={statistics.appointments.reminder_sent} index={1} />
                                </div>
                                <div className="mt-2 pt-2 border-t border-border dark:border-[hsl(231,20%,22%)]">
                                    <h3 className="font-semibold mb-1.5 settings-title" style={{ fontSize: 'var(--text-xs)' }}>
                                        Respuesta del paciente
                                    </h3>
                                    <div className="space-y-1">
                                        <StatRow icon={CheckCircle2} label="Confirmaron asistencia" value={statistics.appointments.confirmed} index={0} />
                                        <StatRow icon={XCircle} label="Cancelaron la cita" value={statistics.appointments.cancelled} index={1} />
                                        <StatRow icon={Clock} label="Sin respuesta aún" value={statistics.appointments.pending} index={2} />
                                        <StatRow icon={AlertCircle} label="Error al enviar" value={statistics.appointments.failed} index={3} />
                                    </div>
                                </div>
                            </div>

                            {/* Conversaciones */}
                            <div className="card-gradient rounded-none shadow-[0_1px_3px_rgba(46,63,132,0.06),0_2px_6px_rgba(46,63,132,0.08),0_6px_16px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] p-3">
                                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border dark:border-[hsl(231,20%,22%)]">
                                    <MessageSquare className="w-3.5 h-3.5 settings-title" />
                                    <h2 className="font-bold settings-title" style={{ fontSize: 'var(--text-xs)' }}>
                                        {t('statistics.conversations.title')}
                                    </h2>
                                </div>
                                <div className="space-y-1">
                                    <StatRow icon={MessageSquare} label={t('statistics.conversations.total')} value={statistics.conversations.total} index={0} />
                                    <StatRow icon={CheckCircle2} label={t('statistics.conversations.active')} value={statistics.conversations.active} index={1} />
                                    <StatRow icon={Clock} label={t('statistics.conversations.pending')} value={statistics.conversations.pending} index={2} />
                                    <StatRow icon={Clock} label={t('statistics.conversations.inProgress')} value={statistics.conversations.in_progress} index={3} />
                                    <StatRow icon={CheckCircle2} label={t('statistics.conversations.resolved')} value={statistics.conversations.resolved} index={4} />
                                    <StatRow icon={XCircle} label={t('statistics.conversations.closed')} value={statistics.conversations.closed} index={5} />
                                    <StatRow icon={AlertCircle} label={t('statistics.conversations.unread')} value={statistics.conversations.unread} index={6} />
                                </div>
                            </div>

                            {/* Plantillas */}
                            <div className="card-gradient rounded-none shadow-[0_1px_3px_rgba(46,63,132,0.06),0_2px_6px_rgba(46,63,132,0.08),0_6px_16px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] p-3">
                                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border dark:border-[hsl(231,20%,22%)]">
                                    <FileText className="w-3.5 h-3.5 settings-title" />
                                    <h2 className="font-bold settings-title" style={{ fontSize: 'var(--text-xs)' }}>
                                        {t('statistics.templates.title')}
                                    </h2>
                                </div>
                                <div className="space-y-1">
                                    <StatRow icon={FileText} label={t('statistics.templates.total')} value={statistics.templates.total} index={0} />
                                    <StatRow icon={CheckCircle2} label={t('statistics.templates.successfulSends')} value={statistics.templates.successful_sends} index={1} />
                                    <StatRow icon={XCircle} label={t('statistics.templates.failedSends')} value={statistics.templates.failed_sends} index={2} />
                                    <StatRow icon={Send} label={t('statistics.templates.totalSends')} value={statistics.templates.total_sends} index={3} />
                                </div>
                            </div>

                            {/* Usuarios */}
                            <div className="card-gradient rounded-none shadow-[0_1px_3px_rgba(46,63,132,0.06),0_2px_6px_rgba(46,63,132,0.08),0_6px_16px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] p-3">
                                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border dark:border-[hsl(231,20%,22%)]">
                                    <Users className="w-3.5 h-3.5 settings-title" />
                                    <h2 className="font-bold settings-title" style={{ fontSize: 'var(--text-xs)' }}>
                                        {t('statistics.users.title')}
                                    </h2>
                                </div>
                                <div className="space-y-1">
                                    <StatRow icon={Users} label={t('statistics.users.total')} value={statistics.users.total} index={0} />
                                    <StatRow icon={Users} label={t('statistics.users.admins')} value={statistics.users.admins} index={1} />
                                    <StatRow icon={Users} label={t('statistics.users.advisors')} value={statistics.users.advisors} index={2} />
                                </div>
                            </div>

                            {/* Asesores */}
                            <div className="card-gradient rounded-none shadow-[0_1px_3px_rgba(46,63,132,0.06),0_2px_6px_rgba(46,63,132,0.08),0_6px_16px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] p-3">
                                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border dark:border-[hsl(231,20%,22%)]">
                                    <Users className="w-3.5 h-3.5 settings-title" />
                                    <h2 className="font-bold settings-title" style={{ fontSize: 'var(--text-xs)' }}>
                                        Rendimiento de Asesores
                                    </h2>
                                </div>
                                {statistics.advisors.advisors.length > 0 ? (
                                    <div className="space-y-1">
                                        {statistics.advisors.advisors.map((advisor, index) => (
                                            <div 
                                                key={advisor.id}
                                                className={`py-1.5 px-2 rounded-none transition-colors stat-row-hover ${index % 2 === 0 ? 'stat-row-alt' : ''}`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="font-semibold settings-title truncate" style={{ fontSize: 'var(--text-xs)' }}>
                                                        {advisor.name}
                                                    </span>
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ 
                                                        backgroundColor: advisor.resolution_rate >= 70 ? '#dcfce7' : advisor.resolution_rate >= 40 ? '#fef9c3' : '#fee2e2',
                                                        color: advisor.resolution_rate >= 70 ? '#166534' : advisor.resolution_rate >= 40 ? '#854d0e' : '#991b1b',
                                                    }}>
                                                        {advisor.resolution_rate}% resueltas
                                                    </span>
                                                </div>
                                                <div className="flex gap-3 mt-0.5">
                                                    <span className="settings-subtitle" style={{ fontSize: '10px' }}>
                                                        {advisor.total_conversations} conv.
                                                    </span>
                                                    <span className="settings-subtitle" style={{ fontSize: '10px' }}>
                                                        {advisor.resolved_conversations} resueltas
                                                    </span>
                                                    <span className="settings-subtitle" style={{ fontSize: '10px' }}>
                                                        {advisor.messages_sent} msgs
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-4 settings-subtitle" style={{ fontSize: 'var(--text-xs)' }}>
                                        No hay datos de asesores disponibles
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* Vista de Gráficos - Bento Grid */
                        <div className="grid grid-cols-2 gap-4 auto-rows-fr">
                            {/* Estadísticas Generales - Ocupa 2 columnas */}
                            <div className="col-span-2 card-gradient rounded-none shadow-[0_1px_3px_rgba(46,63,132,0.06),0_2px_6px_rgba(46,63,132,0.08),0_6px_16px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] p-4">
                                <h2 className="font-bold mb-3 flex items-center gap-2 settings-title" style={{ fontSize: 'var(--text-base)' }}>
                                    <BarChart3 className="w-4 h-4" />
                                    Estadísticas Generales
                                </h2>
                                <ResponsiveContainer width="100%" height={180}>
                                    <BarChart data={mainStatsData}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                        <XAxis 
                                            dataKey="name" 
                                            tick={{ fontSize: 10 }}
                                            className="fill-muted-foreground"
                                            angle={-45}
                                            textAnchor="end"
                                            height={80}
                                        />
                                        <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                                        <Tooltip 
                                            contentStyle={{ 
                                                backgroundColor: 'var(--card)', 
                                                border: '1px solid var(--border)',
                                                borderRadius: '0',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                                fontSize: '12px',
                                                color: 'var(--foreground)'
                                            }}
                                        />
                                        <Bar dataKey="value" fill={COLORS.primary} radius={[6, 6, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Mensajes por Estado */}
                            <div className="card-gradient rounded-none shadow-[0_1px_3px_rgba(46,63,132,0.06),0_2px_6px_rgba(46,63,132,0.08),0_6px_16px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] p-4">
                                <h2 className="font-bold mb-3 flex items-center gap-2 settings-title" style={{ fontSize: 'var(--text-sm)' }}>
                                    <MessageSquare className="w-4 h-4" />
                                    {t('statistics.messages.byStatus')}
                                </h2>
                                <ResponsiveContainer width="100%" height={200}>
                                    <PieChart>
                                        <Pie
                                            data={messagesStatusData}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                                            outerRadius={70}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            {messagesStatusData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={Object.values(COLORS)[index % Object.values(COLORS).length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip 
                                            contentStyle={{ 
                                                backgroundColor: 'var(--card)', 
                                                border: '1px solid var(--border)',
                                                borderRadius: '0',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                                fontSize: '12px',
                                                color: 'var(--foreground)'
                                            }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Citas por Estado */}
                            <div className="card-gradient rounded-none shadow-[0_1px_3px_rgba(46,63,132,0.06),0_2px_6px_rgba(46,63,132,0.08),0_6px_16px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] p-4">
                                <h2 className="font-bold mb-3 flex items-center gap-2 settings-title" style={{ fontSize: 'var(--text-sm)' }}>
                                    <Calendar className="w-4 h-4" />
                                    {t('statistics.appointments.title')}
                                </h2>
                                <ResponsiveContainer width="100%" height={200}>
                                    <PieChart>
                                        <Pie
                                            data={appointmentsData.filter(item => item.value > 0)}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                                            outerRadius={70}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            {appointmentsData.filter(item => item.value > 0).map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip 
                                            contentStyle={{ 
                                                backgroundColor: 'var(--card)', 
                                                border: '1px solid var(--border)',
                                                borderRadius: '0',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                                fontSize: '12px',
                                                color: 'var(--foreground)'
                                            }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Conversaciones */}
                            <div className="card-gradient rounded-none shadow-[0_1px_3px_rgba(46,63,132,0.06),0_2px_6px_rgba(46,63,132,0.08),0_6px_16px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] p-4">
                                <h2 className="font-bold mb-3 flex items-center gap-2 settings-title" style={{ fontSize: 'var(--text-sm)' }}>
                                    <MessageSquare className="w-4 h-4" />
                                    {t('statistics.conversations.title')}
                                </h2>
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={conversationsStatusData}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                        <XAxis 
                                            dataKey="name" 
                                            tick={{ fontSize: 9 }}
                                            className="fill-muted-foreground"
                                            angle={-15}
                                            textAnchor="end"
                                            height={60}
                                        />
                                        <YAxis tick={{ fontSize: 9 }} className="fill-muted-foreground" />
                                        <Tooltip 
                                            contentStyle={{ 
                                                backgroundColor: 'var(--card)', 
                                                border: '1px solid var(--border)',
                                                borderRadius: '0',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                                fontSize: '12px',
                                                color: 'var(--foreground)'
                                            }}
                                        />
                                        <Bar dataKey="value" fill={COLORS.primary} radius={[6, 6, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Plantillas */}
                            <div className="card-gradient rounded-none shadow-[0_1px_3px_rgba(46,63,132,0.06),0_2px_6px_rgba(46,63,132,0.08),0_6px_16px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] p-4">
                                <h2 className="font-bold mb-3 flex items-center gap-2 settings-title" style={{ fontSize: 'var(--text-sm)' }}>
                                    <FileText className="w-4 h-4" />
                                    {t('statistics.templates.title')}
                                </h2>
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={[
                                        { name: t('statistics.templates.successfulSends'), value: statistics.templates.successful_sends },
                                        { name: t('statistics.templates.failedSends'), value: statistics.templates.failed_sends },
                                    ]}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                        <XAxis 
                                            dataKey="name" 
                                            tick={{ fontSize: 9 }}
                                            className="fill-muted-foreground"
                                            angle={-15}
                                            textAnchor="end"
                                            height={60}
                                        />
                                        <YAxis tick={{ fontSize: 9 }} className="fill-muted-foreground" />
                                        <Tooltip 
                                            contentStyle={{ 
                                                backgroundColor: 'var(--card)', 
                                                border: '1px solid var(--border)',
                                                borderRadius: '0',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                                fontSize: '12px',
                                                color: 'var(--foreground)'
                                            }}
                                        />
                                        <Bar dataKey="value" fill={COLORS.primary} radius={[6, 6, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Usuarios */}
                            <div className="card-gradient rounded-none shadow-[0_1px_3px_rgba(46,63,132,0.06),0_2px_6px_rgba(46,63,132,0.08),0_6px_16px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] p-4">
                                <h2 className="font-bold mb-3 flex items-center gap-2 settings-title" style={{ fontSize: 'var(--text-sm)' }}>
                                    <Users className="w-4 h-4" />
                                    {t('statistics.users.title')}
                                </h2>
                                <ResponsiveContainer width="100%" height={200}>
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { name: t('statistics.users.admins'), value: statistics.users.admins },
                                                { name: t('statistics.users.advisors'), value: statistics.users.advisors },
                                            ]}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                                            outerRadius={70}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            <Cell fill={COLORS.primaryLight} />
                                            <Cell fill={COLORS.success} />
                                        </Pie>
                                        <Tooltip 
                                            contentStyle={{ 
                                                backgroundColor: 'var(--card)', 
                                                border: '1px solid var(--border)',
                                                borderRadius: '0',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                                fontSize: '12px',
                                                color: 'var(--foreground)'
                                            }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Asesores - Top Performers */}
                            <div className="card-gradient rounded-none shadow-[0_1px_3px_rgba(46,63,132,0.06),0_2px_6px_rgba(46,63,132,0.08),0_6px_16px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] p-4">
                                <h2 className="font-bold mb-3 flex items-center gap-2 settings-title" style={{ fontSize: 'var(--text-sm)' }}>
                                    <Users className="w-4 h-4" />
                                    Rendimiento de Asesores
                                </h2>
                                {statistics.advisors.advisors.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={200}>
                                        <BarChart 
                                            data={statistics.advisors.advisors.slice(0, 5)} 
                                            layout="horizontal"
                                        >
                                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                            <XAxis 
                                                type="number"
                                                tick={{ fontSize: 9 }}
                                                className="fill-muted-foreground"
                                            />
                                            <YAxis 
                                                type="category"
                                                dataKey="name" 
                                                tick={{ fontSize: 9 }}
                                                className="fill-muted-foreground"
                                                width={80}
                                            />
                                            <Tooltip 
                                                contentStyle={{ 
                                                    backgroundColor: 'var(--card)', 
                                                    border: '1px solid var(--border)',
                                                    borderRadius: '0',
                                                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                                    fontSize: '12px',
                                                    color: 'var(--foreground)'
                                                }}
                                                formatter={(value: any, name: string) => [
                                                    value,
                                                    name === 'resolved_conversations' ? 'Resueltas' : 
                                                    name === 'active_conversations' ? 'Activas' : 
                                                    name === 'messages_sent' ? 'Mensajes' : name
                                                ]}
                                            />
                                            <Legend 
                                                wrapperStyle={{ fontSize: '11px' }}
                                                formatter={(value) => 
                                                    value === 'resolved_conversations' ? 'Resueltas' : 
                                                    value === 'active_conversations' ? 'Activas' : 
                                                    value === 'messages_sent' ? 'Mensajes' : value
                                                }
                                            />
                                            <Bar dataKey="resolved_conversations" fill={COLORS.success} radius={[0, 4, 4, 0]} />
                                            <Bar dataKey="active_conversations" fill={COLORS.info} radius={[0, 4, 4, 0]} />
                                            <Bar dataKey="messages_sent" fill={COLORS.primaryLight} radius={[0, 4, 4, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex items-center justify-center h-48 settings-subtitle">
                                        <p>No hay datos de asesores disponibles</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}
