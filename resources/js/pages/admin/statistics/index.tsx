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
        sent: number;
        answered: number;
        confirmed: number;
        cancelled: number;
        rescheduled: number;
        by_status: {
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
        rescheduled: number;
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
        closed: number;
        unread: number;
        by_status: {
            [key: string]: number;
        };
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
    <div className={`flex items-center justify-between py-1.5 px-2 rounded-lg transition-colors ${
        index !== undefined && index % 2 === 0 
            ? 'bg-gradient-to-b from-[#f8f9fc] to-[#f4f5f9]' 
            : 'bg-white'
    } hover:bg-gradient-to-b hover:from-[#f0f2f8] hover:to-[#e8ebf5]`}>
        <div className="flex items-center gap-2">
            <Icon className="w-3 h-3 text-[#2e3f84]" />
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                {label}
            </span>
        </div>
        <span className="font-bold" style={{ fontSize: 'var(--text-xs)', color: 'var(--primary-base)' }}>
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
    const messagesStatusData = Object.entries(statistics.messages.by_status).map(([name, value]) => ({
        name: t(`statistics.messages.statuses.${name}`),
        value,
    }));

    const appointmentsData = [
        { name: t('statistics.appointments.confirmed'), value: statistics.appointments.confirmed, color: COLORS.success },
        { name: t('statistics.appointments.cancelled'), value: statistics.appointments.cancelled, color: COLORS.danger },
        { name: t('statistics.appointments.rescheduled'), value: statistics.appointments.rescheduled, color: COLORS.warning },
        { name: t('statistics.appointments.pending'), value: statistics.appointments.pending, color: COLORS.info },
    ];

    const conversationsStatusData = [
        { name: t('statistics.conversations.active'), value: statistics.conversations.active },
        { name: t('statistics.conversations.pending'), value: statistics.conversations.pending },
        { name: t('statistics.conversations.closed'), value: statistics.conversations.closed },
    ];

    const mainStatsData = [
        { name: t('statistics.messages.sent'), value: statistics.messages.sent },
        { name: t('statistics.messages.answered'), value: statistics.messages.answered },
        { name: t('statistics.appointments.total'), value: statistics.appointments.total },
        { name: t('statistics.conversations.total'), value: statistics.conversations.total },
        { name: t('statistics.templates.total'), value: statistics.templates.total },
    ];

    return (
        <AdminLayout>
            <Head title={t('statistics.title')} />

            <div className="min-h-screen bg-[#f0f2f8] p-4 md:p-6 lg:p-8">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="mb-6" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
                            <div>
                                <h1 className="font-bold" style={{ fontSize: 'var(--text-3xl)', color: 'var(--primary-base)' }}>
                                    {t('statistics.title')}
                                </h1>
                                <p className="text-gray-600" style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-xs)' }}>
                                    {t('statistics.subtitle')}
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                                {/* Switch para gráficos */}
                                <div className="flex items-center gap-3 bg-gradient-to-b from-white to-[#fafbfc] rounded-xl p-2 shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_4px_rgba(46,63,132,0.06),inset_0_1px_0_rgba(255,255,255,0.9)]">
                                    <Table2 className={`w-4 h-4 transition-colors ${!showCharts ? 'text-[#2e3f84]' : 'text-gray-400'}`} />
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={showCharts}
                                            onChange={(e) => setShowCharts(e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#2e3f84]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-b peer-checked:from-[#3e4f94] peer-checked:to-[#2e3f84]"></div>
                                    </label>
                                    <BarChart3 className={`w-4 h-4 transition-colors ${showCharts ? 'text-[#2e3f84]' : 'text-gray-400'}`} />
                                </div>
                                <Button
                                    onClick={handleExport}
                                    disabled={isExporting}
                                    className="font-semibold text-white transition-all duration-200 border-0 relative overflow-hidden"
                                    style={{
                                        backgroundColor: 'var(--primary-base)',
                                        boxShadow: 'var(--shadow-md)',
                                        backgroundImage: 'var(--gradient-shine)',
                                        height: 'clamp(2.5rem, 2.5rem + 0.5vw, 3rem)',
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
                            <div className="bg-gradient-to-b from-white to-[#fafbfc] rounded-xl p-4 shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_4px_rgba(46,63,132,0.06),0_4px_12px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.9)] flex flex-wrap gap-4 items-end">
                                <div style={{ flex: '1 1 200px', minWidth: '180px' }}>
                                    <label className="font-semibold block mb-2" style={{ fontSize: 'var(--text-sm)', color: 'var(--primary-base)' }}>
                                        {t('statistics.filters.period')}
                                    </label>
                                    <select
                                        value={period}
                                        onChange={(e) => setPeriod(e.target.value)}
                                        className="w-full border-0 rounded-lg transition-all duration-200"
                                        style={{
                                            backgroundColor: 'var(--layer-base)',
                                            boxShadow: 'var(--shadow-inset-sm)',
                                            height: 'clamp(2.5rem, 2.5rem + 0.5vw, 3rem)',
                                            fontSize: 'var(--text-sm)',
                                            padding: '0 var(--space-base)',
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
                                    <label className="font-semibold block mb-2" style={{ fontSize: 'var(--text-sm)', color: 'var(--primary-base)' }}>
                                        {t('statistics.filters.startDate')}
                                    </label>
                                    <Input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="border-0 rounded-lg transition-all duration-200"
                                        style={{
                                            backgroundColor: 'var(--layer-base)',
                                            boxShadow: 'var(--shadow-inset-sm)',
                                            height: 'clamp(2.5rem, 2.5rem + 0.5vw, 3rem)',
                                            fontSize: 'var(--text-sm)',
                                        }}
                                    />
                                </div>
                                <div style={{ flex: '1 1 180px', minWidth: '160px' }}>
                                    <label className="font-semibold block mb-2" style={{ fontSize: 'var(--text-sm)', color: 'var(--primary-base)' }}>
                                        {t('statistics.filters.endDate')}
                                    </label>
                                    <Input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="border-0 rounded-lg transition-all duration-200"
                                        style={{
                                            backgroundColor: 'var(--layer-base)',
                                            boxShadow: 'var(--shadow-inset-sm)',
                                            height: 'clamp(2.5rem, 2.5rem + 0.5vw, 3rem)',
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
                                            height: 'clamp(2.5rem, 2.5rem + 0.5vw, 3rem)',
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
                            <div className="bg-gradient-to-b from-white to-[#fafbfc] rounded-xl shadow-[0_1px_3px_rgba(46,63,132,0.06),0_2px_6px_rgba(46,63,132,0.08),0_6px_16px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] p-3">
                                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-200">
                                    <MessageSquare className="w-3.5 h-3.5 text-[#2e3f84]" />
                                    <h2 className="font-bold" style={{ fontSize: 'var(--text-xs)', color: 'var(--primary-base)' }}>
                                        {t('statistics.messages.title')}
                                    </h2>
                                </div>
                                <div className="space-y-1">
                                    <StatRow icon={Send} label={t('statistics.messages.sent')} value={statistics.messages.sent} index={0} />
                                    <StatRow icon={MessageSquare} label={t('statistics.messages.answered')} value={statistics.messages.answered} index={1} />
                                    <StatRow icon={CheckCircle2} label={t('statistics.messages.confirmed')} value={statistics.messages.confirmed} index={2} />
                                    <StatRow icon={XCircle} label={t('statistics.messages.cancelled')} value={statistics.messages.cancelled} index={3} />
                                    <StatRow icon={CalendarIcon} label={t('statistics.messages.rescheduled')} value={statistics.messages.rescheduled} index={4} />
                                </div>
                                <div className="mt-2 pt-2 border-t border-gray-200">
                                    <h3 className="font-semibold mb-1.5" style={{ fontSize: 'var(--text-xs)', color: 'var(--primary-base)' }}>
                                        {t('statistics.messages.byStatus')}
                                    </h3>
                                    <div className="space-y-1">
                                        {Object.entries(statistics.messages.by_status).map(([status, count], index) => (
                                            <div key={status} className={`flex items-center justify-between py-1 px-2 rounded-lg transition-colors ${
                                                index % 2 === 0 
                                                    ? 'bg-gradient-to-b from-[#f8f9fc] to-[#f4f5f9]' 
                                                    : 'bg-white'
                                            } hover:bg-gradient-to-b hover:from-[#f0f2f8] hover:to-[#e8ebf5]`}>
                                                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                                                    {t(`statistics.messages.statuses.${status}`)}
                                                </span>
                                                <span className="font-bold" style={{ fontSize: 'var(--text-xs)', color: 'var(--primary-base)' }}>
                                                    {count.toLocaleString()}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Citas */}
                            <div className="bg-gradient-to-b from-white to-[#fafbfc] rounded-xl shadow-[0_1px_3px_rgba(46,63,132,0.06),0_2px_6px_rgba(46,63,132,0.08),0_6px_16px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] p-3">
                                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-200">
                                    <Calendar className="w-3.5 h-3.5 text-[#2e3f84]" />
                                    <h2 className="font-bold" style={{ fontSize: 'var(--text-xs)', color: 'var(--primary-base)' }}>
                                        {t('statistics.appointments.title')}
                                    </h2>
                                </div>
                                <div className="space-y-1">
                                    <StatRow icon={Calendar} label={t('statistics.appointments.total')} value={statistics.appointments.total} index={0} />
                                    <StatRow icon={Send} label={t('statistics.appointments.reminderSent')} value={statistics.appointments.reminder_sent} index={1} />
                                    <StatRow icon={CheckCircle2} label={t('statistics.appointments.confirmed')} value={statistics.appointments.confirmed} index={2} />
                                    <StatRow icon={XCircle} label={t('statistics.appointments.cancelled')} value={statistics.appointments.cancelled} index={3} />
                                    <StatRow icon={CalendarIcon} label={t('statistics.appointments.rescheduled')} value={statistics.appointments.rescheduled} index={4} />
                                    <StatRow icon={Clock} label={t('statistics.appointments.pending')} value={statistics.appointments.pending} index={5} />
                                    <StatRow icon={AlertCircle} label={t('statistics.appointments.failed')} value={statistics.appointments.failed} index={6} />
                                </div>
                            </div>

                            {/* Conversaciones */}
                            <div className="bg-gradient-to-b from-white to-[#fafbfc] rounded-xl shadow-[0_1px_3px_rgba(46,63,132,0.06),0_2px_6px_rgba(46,63,132,0.08),0_6px_16px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] p-3">
                                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-200">
                                    <MessageSquare className="w-3.5 h-3.5 text-[#2e3f84]" />
                                    <h2 className="font-bold" style={{ fontSize: 'var(--text-xs)', color: 'var(--primary-base)' }}>
                                        {t('statistics.conversations.title')}
                                    </h2>
                                </div>
                                <div className="space-y-1">
                                    <StatRow icon={MessageSquare} label={t('statistics.conversations.total')} value={statistics.conversations.total} index={0} />
                                    <StatRow icon={CheckCircle2} label={t('statistics.conversations.active')} value={statistics.conversations.active} index={1} />
                                    <StatRow icon={Clock} label={t('statistics.conversations.pending')} value={statistics.conversations.pending} index={2} />
                                    <StatRow icon={XCircle} label={t('statistics.conversations.closed')} value={statistics.conversations.closed} index={3} />
                                    <StatRow icon={AlertCircle} label={t('statistics.conversations.unread')} value={statistics.conversations.unread} index={4} />
                                </div>
                            </div>

                            {/* Plantillas */}
                            <div className="bg-gradient-to-b from-white to-[#fafbfc] rounded-xl shadow-[0_1px_3px_rgba(46,63,132,0.06),0_2px_6px_rgba(46,63,132,0.08),0_6px_16px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] p-3">
                                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-200">
                                    <FileText className="w-3.5 h-3.5 text-[#2e3f84]" />
                                    <h2 className="font-bold" style={{ fontSize: 'var(--text-xs)', color: 'var(--primary-base)' }}>
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
                            <div className="bg-gradient-to-b from-white to-[#fafbfc] rounded-xl shadow-[0_1px_3px_rgba(46,63,132,0.06),0_2px_6px_rgba(46,63,132,0.08),0_6px_16px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] p-3">
                                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-200">
                                    <Users className="w-3.5 h-3.5 text-[#2e3f84]" />
                                    <h2 className="font-bold" style={{ fontSize: 'var(--text-xs)', color: 'var(--primary-base)' }}>
                                        {t('statistics.users.title')}
                                    </h2>
                                </div>
                                <div className="space-y-1">
                                    <StatRow icon={Users} label={t('statistics.users.total')} value={statistics.users.total} index={0} />
                                    <StatRow icon={Users} label={t('statistics.users.admins')} value={statistics.users.admins} index={1} />
                                    <StatRow icon={Users} label={t('statistics.users.advisors')} value={statistics.users.advisors} index={2} />
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Vista de Gráficos - Bento Grid */
                        <div className="grid grid-cols-2 gap-4 auto-rows-fr">
                            {/* Estadísticas Generales - Ocupa 2 columnas */}
                            <div className="col-span-2 bg-gradient-to-b from-white to-[#fafbfc] rounded-xl shadow-[0_1px_3px_rgba(46,63,132,0.06),0_2px_6px_rgba(46,63,132,0.08),0_6px_16px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] p-4">
                                <h2 className="font-bold mb-3 flex items-center gap-2" style={{ fontSize: 'var(--text-base)', color: 'var(--primary-base)' }}>
                                    <BarChart3 className="w-4 h-4" />
                                    Estadísticas Generales
                                </h2>
                                <ResponsiveContainer width="100%" height={180}>
                                    <BarChart data={mainStatsData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                        <XAxis 
                                            dataKey="name" 
                                            tick={{ fontSize: 10, fill: '#6B7494' }}
                                            angle={-45}
                                            textAnchor="end"
                                            height={80}
                                        />
                                        <YAxis tick={{ fontSize: 10, fill: '#6B7494' }} />
                                        <Tooltip 
                                            contentStyle={{ 
                                                backgroundColor: 'white', 
                                                border: '1px solid #E5E7EB',
                                                borderRadius: '8px',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                                fontSize: '12px'
                                            }}
                                        />
                                        <Bar dataKey="value" fill={COLORS.primary} radius={[6, 6, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Mensajes por Estado */}
                            <div className="bg-gradient-to-b from-white to-[#fafbfc] rounded-xl shadow-[0_1px_3px_rgba(46,63,132,0.06),0_2px_6px_rgba(46,63,132,0.08),0_6px_16px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] p-4">
                                <h2 className="font-bold mb-3 flex items-center gap-2" style={{ fontSize: 'var(--text-sm)', color: 'var(--primary-base)' }}>
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
                                            label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
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
                                                backgroundColor: 'white', 
                                                border: '1px solid #E5E7EB',
                                                borderRadius: '8px',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                                fontSize: '12px'
                                            }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Citas por Estado */}
                            <div className="bg-gradient-to-b from-white to-[#fafbfc] rounded-xl shadow-[0_1px_3px_rgba(46,63,132,0.06),0_2px_6px_rgba(46,63,132,0.08),0_6px_16px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] p-4">
                                <h2 className="font-bold mb-3 flex items-center gap-2" style={{ fontSize: 'var(--text-sm)', color: 'var(--primary-base)' }}>
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
                                            label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
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
                                                backgroundColor: 'white', 
                                                border: '1px solid #E5E7EB',
                                                borderRadius: '8px',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                                fontSize: '12px'
                                            }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Conversaciones */}
                            <div className="bg-gradient-to-b from-white to-[#fafbfc] rounded-xl shadow-[0_1px_3px_rgba(46,63,132,0.06),0_2px_6px_rgba(46,63,132,0.08),0_6px_16px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] p-4">
                                <h2 className="font-bold mb-3 flex items-center gap-2" style={{ fontSize: 'var(--text-sm)', color: 'var(--primary-base)' }}>
                                    <MessageSquare className="w-4 h-4" />
                                    {t('statistics.conversations.title')}
                                </h2>
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={conversationsStatusData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                        <XAxis 
                                            dataKey="name" 
                                            tick={{ fontSize: 9, fill: '#6B7494' }}
                                            angle={-15}
                                            textAnchor="end"
                                            height={60}
                                        />
                                        <YAxis tick={{ fontSize: 9, fill: '#6B7494' }} />
                                        <Tooltip 
                                            contentStyle={{ 
                                                backgroundColor: 'white', 
                                                border: '1px solid #E5E7EB',
                                                borderRadius: '8px',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                                fontSize: '12px'
                                            }}
                                        />
                                        <Bar dataKey="value" fill={COLORS.primary} radius={[6, 6, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Plantillas */}
                            <div className="bg-gradient-to-b from-white to-[#fafbfc] rounded-xl shadow-[0_1px_3px_rgba(46,63,132,0.06),0_2px_6px_rgba(46,63,132,0.08),0_6px_16px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] p-4">
                                <h2 className="font-bold mb-3 flex items-center gap-2" style={{ fontSize: 'var(--text-sm)', color: 'var(--primary-base)' }}>
                                    <FileText className="w-4 h-4" />
                                    {t('statistics.templates.title')}
                                </h2>
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={[
                                        { name: t('statistics.templates.successfulSends'), value: statistics.templates.successful_sends },
                                        { name: t('statistics.templates.failedSends'), value: statistics.templates.failed_sends },
                                    ]}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                        <XAxis 
                                            dataKey="name" 
                                            tick={{ fontSize: 9, fill: '#6B7494' }}
                                            angle={-15}
                                            textAnchor="end"
                                            height={60}
                                        />
                                        <YAxis tick={{ fontSize: 9, fill: '#6B7494' }} />
                                        <Tooltip 
                                            contentStyle={{ 
                                                backgroundColor: 'white', 
                                                border: '1px solid #E5E7EB',
                                                borderRadius: '8px',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                                fontSize: '12px'
                                            }}
                                        />
                                        <Bar dataKey="value" fill={COLORS.primary} radius={[6, 6, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Usuarios */}
                            <div className="bg-gradient-to-b from-white to-[#fafbfc] rounded-xl shadow-[0_1px_3px_rgba(46,63,132,0.06),0_2px_6px_rgba(46,63,132,0.08),0_6px_16px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] p-4">
                                <h2 className="font-bold mb-3 flex items-center gap-2" style={{ fontSize: 'var(--text-sm)', color: 'var(--primary-base)' }}>
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
                                            label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                                            outerRadius={70}
                                            fill="#8884d8"
                                            dataKey="value"
                                        >
                                            <Cell fill={COLORS.primaryLight} />
                                            <Cell fill={COLORS.success} />
                                        </Pie>
                                        <Tooltip 
                                            contentStyle={{ 
                                                backgroundColor: 'white', 
                                                border: '1px solid #E5E7EB',
                                                borderRadius: '8px',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                                fontSize: '12px'
                                            }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}
