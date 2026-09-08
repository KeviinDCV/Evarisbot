import { Head, router, usePage } from '@inertiajs/react';
import { AnimatePresence, motion } from 'framer-motion';
import AdminLayout from '@/layouts/admin-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
    Bot,
    Edit3,
    FileText,
    Globe2,
    Image,
    MessageSquare,
    Paperclip,
    Plus,
    Power,
    PowerOff,
    Search,
    Send,
    Trash2,
    UserCheck,
    Users,
    Video,
    X,
    type LucideIcon,
} from 'lucide-react';
import { useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import TemplateCreateModal from './components/TemplateCreateModal';
import TemplateEditModal from './components/TemplateEditModal';
import WelcomeFlowSection from './components/WelcomeFlowSection';

interface MediaFile {
    url: string;
    filename: string;
    type: 'image' | 'video' | 'document';
}

interface User {
    id: number;
    name: string;
    role: string;
}

interface Template {
    id: number;
    name: string;
    subject: string | null;
    content: string;
    is_active: boolean;
    message_type: 'text' | 'image' | 'video' | 'document';
    is_global: boolean;
    assigned_users?: number[];
    media_url: string | null;
    media_filename: string | null;
    media_files?: MediaFile[];
    created_by: string;
    updated_by: string | null;
    created_at: string;
    updated_at: string;
    usage_stats: {
        total_sends: number;
    };
}

type WelcomeFlow = ComponentProps<typeof WelcomeFlowSection>['welcomeFlows'][number];

interface Filters {
    status: string;
    type: string;
    search: string;
}

interface TemplatesIndexProps {
    templates: Template[];
    filters: Filters;
    users: User[];
    welcomeFlows?: WelcomeFlow[];
}

interface MetricCardProps {
    icon: LucideIcon;
    label: string;
    value: string | number;
    detail: string;
    tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
}

interface SectionCardProps {
    icon: LucideIcon;
    title: string;
    subtitle?: string;
    action?: ReactNode;
    children: ReactNode;
    className?: string;
}

function formatNumber(value: number | null | undefined) {
    return Number(value ?? 0).toLocaleString('es-CO');
}

function formatDate(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
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

function MetricCard({ icon: Icon, label, value, detail, tone = 'primary' }: MetricCardProps) {
    return (
        <div className="card-gradient rounded-2xl p-4 shadow-sm shadow-[#2e3f84]/5">
            <div className="flex items-center gap-3">
                <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border', toneClasses(tone))}>
                    <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold settings-subtitle">{label}</p>
                    <p className="mt-1 truncate text-lg font-bold leading-tight settings-title">{value}</p>
                    <p className="mt-0.5 truncate text-xs settings-subtitle">{detail}</p>
                </div>
            </div>
        </div>
    );
}

function SectionCard({ icon: Icon, title, subtitle, action, children, className }: SectionCardProps) {
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

function StatusPill({ active }: { active: boolean }) {
    const { t } = useTranslation();

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold',
                active
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
                    : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-300'
            )}
        >
            <span className={cn('h-2 w-2 rounded-full', active ? 'bg-emerald-500' : 'bg-slate-400')} />
            {active ? t('templates.statusLabels.active') : t('templates.statusLabels.inactive')}
        </span>
    );
}

function ScopePill({ global, assignedCount }: { global: boolean; assignedCount: number }) {
    const { t } = useTranslation();

    return (
        <span className="inline-flex items-center gap-1.5 rounded-md bg-white/50 px-2.5 py-1 text-[11px] font-semibold text-[#2e3f84] dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-200">
            {global ? <Globe2 className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
            {global ? t('templates.global') : t('templates.assignedCount', { count: assignedCount })}
        </span>
    );
}

function TemplateTypePill({ type, label, icon }: { type: Template['message_type']; label: string; icon: ReactNode }) {
    const className = {
        text: 'border-[#d4d8e8] bg-[#2e3f84]/10 text-[#2e3f84] dark:border-white/10 dark:bg-white/[0.05] dark:text-neutral-100',
        image: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300',
        video: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300',
        document: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300',
    }[type];

    return (
        <span className={cn('inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold', className)}>
            {icon}
            {label}
        </span>
    );
}

function EmptyState({ isAdmin, onCreate }: { isAdmin: boolean; onCreate: () => void }) {
    const { t } = useTranslation();

    return (
        <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#d4d8e8] p-8 text-center dark:border-white/10">
            <MessageSquare className="mb-4 h-12 w-12 settings-subtitle" />
            <h3 className="text-lg font-bold settings-title">{t('templates.noTemplates')}</h3>
            <p className="mt-2 max-w-md text-sm settings-subtitle">
                {isAdmin ? t('templates.noTemplatesSubtitle') : t('templates.noTemplatesViewer')}
            </p>
            {isAdmin && (
                <Button onClick={onCreate} className="mt-5 rounded-xl settings-btn-primary text-white">
                    <Plus className="h-4 w-4" />
                    {t('templates.newTemplate')}
                </Button>
            )}
        </div>
    );
}

export default function TemplatesIndex({ templates, filters, users, welcomeFlows = [] }: TemplatesIndexProps) {
    const { t } = useTranslation();
    const { auth } = usePage().props as { auth?: { user?: { role?: string } } };
    const isAdmin = auth?.user?.role === 'admin';

    const [search, setSearch] = useState(filters.search || '');
    const [statusFilter, setStatusFilter] = useState(filters.status || 'all');
    const [typeFilter, setTypeFilter] = useState(filters.type || 'all');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    // Plantilla pendiente de borrar (null = diálogo cerrado).
    const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [templateToEdit, setTemplateToEdit] = useState<Template | null>(null);
    const [openTemplate, setOpenTemplate] = useState<Template | null>(null);

    const stats = useMemo(() => {
        const active = templates.filter((template) => template.is_active).length;
        const withMedia = templates.filter((template) => (template.media_files?.length ?? 0) > 0 || template.media_url).length;
        const totalSends = templates.reduce((total, template) => total + Number(template.usage_stats?.total_sends ?? 0), 0);
        const assigned = templates.filter((template) => !template.is_global).length;
        const activeWelcomeFlows = welcomeFlows.filter((flow) => flow.is_active).length;

        return {
            active,
            inactive: templates.length - active,
            withMedia,
            totalSends,
            assigned,
            activeWelcomeFlows,
        };
    }, [templates, welcomeFlows]);

    const typeOptions = [
        { value: 'all', label: t('common.all') },
        { value: 'text', label: t('templates.types.text') },
        { value: 'image', label: t('templates.types.image') },
        { value: 'video', label: t('templates.types.video') },
        { value: 'document', label: t('templates.types.document') },
    ];

    const statusOptions = [
        { value: 'all', label: t('common.all') },
        { value: 'active', label: t('common.active') },
        { value: 'inactive', label: t('common.inactive') },
    ];

    /**
     * Filtrado INSTANTÁNEO en el cliente.
     *
     * Antes cada filtro hacía router.get() al servidor: había que escribir y además pulsar
     * "Filtrar" (los desplegables no hacían nada solos) y esperar una recarga. Con el
     * catálogo completo ya en memoria (~30 plantillas) no hay motivo para ir al servidor:
     * la lista se reduce mientras escribes. El backend sigue aceptando los filtros por
     * querystring, así que los enlaces directos con ?search=... siguen funcionando.
     */
    const filteredTemplates = useMemo(() => {
        const term = search.trim().toLowerCase();

        return templates.filter((template) => {
            if (statusFilter === 'active' && !template.is_active) return false;
            if (statusFilter === 'inactive' && template.is_active) return false;
            if (typeFilter !== 'all' && template.message_type !== typeFilter) return false;

            if (!term) return true;
            // Busca en nombre, asunto y contenido: el asesor suele recordar una frase,
            // no el nombre exacto de la plantilla.
            return (
                template.name.toLowerCase().includes(term) ||
                (template.subject ?? '').toLowerCase().includes(term) ||
                template.content.toLowerCase().includes(term)
            );
        });
    }, [templates, search, statusFilter, typeFilter]);

    const clearFilters = () => {
        setSearch('');
        setStatusFilter('all');
        setTypeFilter('all');
    };

    const toggleStatus = (templateId: number) => {
        router.post(
            `/admin/templates/${templateId}/toggle`,
            {},
            {
                preserveScroll: true,
                onSuccess: () => toast.success(t('templates.statusUpdated')),
                onError: () => toast.error(t('templates.statusUpdateError')),
            }
        );
    };

    /**
     * Borrado con diálogo propio en vez de confirm() del navegador.
     * El confirm() nativo no decía QUÉ plantilla se borraba ni cuántas veces se había
     * usado: se podía eliminar "AGENDAR CITA" (2.590 usos) con un clic distraído.
     */
    const deleteTemplate = (templateId: number) => {
        const target = templates.find((tpl) => tpl.id === templateId) ?? null;
        setTemplateToDelete(target);
    };

    const confirmDeleteTemplate = () => {
        if (!templateToDelete) return;
        const id = templateToDelete.id;
        setTemplateToDelete(null);
        router.delete(`/admin/templates/${id}`, {
            preserveScroll: true,
            onSuccess: () => toast.success(t('templates.deleted')),
            onError: () => toast.error(t('templates.deleteError')),
        });
    };

    const getTypeIcon = (type: Template['message_type']) => {
        switch (type) {
            case 'image':
                return <Image className="h-3.5 w-3.5" />;
            case 'video':
                return <Video className="h-3.5 w-3.5" />;
            case 'document':
                return <FileText className="h-3.5 w-3.5" />;
            default:
                return <MessageSquare className="h-3.5 w-3.5" />;
        }
    };

    const getTypeLabel = (type: Template['message_type']) => {
        switch (type) {
            case 'image':
                return t('templates.types.image');
            case 'video':
                return t('templates.types.video');
            case 'document':
                return t('templates.types.document');
            default:
                return t('templates.types.text');
        }
    };

    const hasFilters = Boolean(search.trim()) || statusFilter !== 'all' || typeFilter !== 'all';

    return (
        <AdminLayout>
            <Head title={t('templates.title')} />

            <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
                <div className="mx-auto max-w-7xl space-y-6">
                    <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex items-start gap-3">
                            <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-[#2e3f84] shadow-sm shadow-[#2e3f84]/5 dark:bg-white/[0.04] dark:text-neutral-100">
                                <FileText className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-3xl font-bold leading-tight settings-title">{t('templates.title')}</h1>
                                <p className="mt-1 max-w-2xl text-sm settings-subtitle">
                                    {isAdmin ? t('templates.adminSubtitle') : t('templates.viewerSubtitle')}
                                </p>
                            </div>
                        </div>
                        {isAdmin && (
                            <Button onClick={() => setIsCreateModalOpen(true)} className="w-full rounded-xl settings-btn-primary text-white sm:w-auto">
                                <Plus className="h-4 w-4" />
                                {t('templates.newTemplate')}
                            </Button>
                        )}
                    </header>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <MetricCard icon={MessageSquare} label={t('templates.metricTotal')} value={formatNumber(templates.length)} detail={t('templates.metricActiveDetail', { value: formatNumber(stats.active) })} />
                        <MetricCard icon={Paperclip} label={t('templates.metricWithMedia')} value={formatNumber(stats.withMedia)} detail={t('templates.metricWithMediaDetail')} tone="info" />
                        <MetricCard icon={Users} label={t('templates.metricReach')} value={formatNumber(stats.assigned)} detail={t('templates.metricReachDetail')} tone="warning" />
                        <MetricCard icon={Bot} label={t('templates.metricWelcome')} value={formatNumber(welcomeFlows.length)} detail={t('templates.metricWelcomeDetail', { value: formatNumber(stats.activeWelcomeFlows) })} tone="success" />
                    </div>

                    {isAdmin && <WelcomeFlowSection welcomeFlows={welcomeFlows} />}

                    <SectionCard
                        icon={FileText}
                        title={t('templates.catalogTitle')}
                        subtitle={t('templates.catalogSubtitle', { count: templates.length, countFormatted: formatNumber(templates.length), sends: formatNumber(stats.totalSends) })}
                        action={
                            <span className="hidden rounded-md bg-white/50 px-2.5 py-1 text-[11px] font-semibold settings-subtitle dark:border-white/10 dark:bg-white/[0.04] sm:inline-flex">
                                {t('templates.inactiveCount', { value: formatNumber(stats.inactive) })}
                            </span>
                        }
                    >
                        <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(220px,1fr)_170px_170px_auto_auto] lg:items-end">
                            <div>
                                <label htmlFor="template-search" className="mb-1.5 block text-xs font-semibold settings-label">
                                    {t('common.search')}
                                </label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 settings-subtitle" />
                                    <Input
                                        id="template-search"
                                        name="template-search"
                                        type="text"
                                        value={search}
                                        onChange={(event) => setSearch(event.target.value)}
                                        onKeyDown={(event) => event.key === 'Escape' && setSearch('')}
                                        placeholder={t('templates.searchPlaceholder')}
                                        className="h-9 rounded-xl pl-9 settings-input"
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="template-status" className="mb-1.5 block text-xs font-semibold settings-label">
                                    {t('common.status')}
                                </label>
                                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
                                    <SelectTrigger id="template-status" className="w-full h-9 settings-input rounded-xl">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl max-h-[320px]">
                                        {statusOptions.map((option) => (
                                            <SelectItem key={option.value} value={option.value} className="rounded-lg cursor-pointer">
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <label htmlFor="template-type" className="mb-1.5 block text-xs font-semibold settings-label">
                                    {t('templates.type')}
                                </label>
                                <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v)}>
                                    <SelectTrigger id="template-type" className="w-full h-9 settings-input rounded-xl">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl max-h-[320px]">
                                        {typeOptions.map((option) => (
                                            <SelectItem key={option.value} value={option.value} className="rounded-lg cursor-pointer">
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Sin botón "Filtrar": el filtrado es instantáneo al escribir/elegir.
                                Se muestra cuántas plantillas quedan para dar feedback inmediato. */}
                            <span className="flex h-9 items-center whitespace-nowrap text-xs font-semibold settings-subtitle">
                                {hasFilters
                                    ? t('templates.showingCount', {
                                          shown: formatNumber(filteredTemplates.length),
                                          total: formatNumber(templates.length),
                                          defaultValue: '{{shown}} de {{total}}',
                                      })
                                    : null}
                            </span>
                            <Button onClick={clearFilters} variant="outline" className="h-9 rounded-xl settings-btn-secondary" disabled={!hasFilters}>
                                <X className="h-4 w-4" />
                                {t('common.clear')}
                            </Button>
                        </div>

                        {filteredTemplates.length === 0 ? (
                            hasFilters ? (
                                // Sin resultados por los filtros: no es lo mismo que no tener plantillas.
                                <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
                                    <Search className="h-8 w-8 settings-subtitle opacity-50" />
                                    <p className="text-sm font-semibold settings-title">{t('templates.noResults', 'Sin resultados')}</p>
                                    <p className="text-xs settings-subtitle">
                                        {t('templates.noResultsHint', 'Prueba con otro texto o quita los filtros.')}
                                    </p>
                                    <Button onClick={clearFilters} variant="outline" className="h-9 rounded-xl settings-btn-secondary">
                                        {t('templates.clearFilters', 'Limpiar filtros')}
                                    </Button>
                                </div>
                            ) : (
                                <EmptyState isAdmin={isAdmin} onCreate={() => setIsCreateModalOpen(true)} />
                            )
                        ) : (
                            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                            {filteredTemplates.map((template) => {
                                                const attachedFiles = template.media_files?.length ?? (template.media_url ? 1 : 0);
                                                const assignedCount = template.assigned_users?.length ?? 0;

                                                return (
                                                    <motion.div
                                                        key={template.id}
                                                        layoutId={`template-${template.id}`}
                                                        onClick={() => setOpenTemplate(template)}
                                                        whileHover={{ y: -3 }}
                                                        whileTap={{ scale: 0.98 }}
                                                        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                                                        className="card-gradient flex cursor-pointer flex-col gap-3 rounded-2xl p-4 shadow-sm shadow-[#2e3f84]/5 hover:shadow-md hover:shadow-[#2e3f84]/10"
                                                    >
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex min-w-0 items-center gap-2">
                                                                    <h3 className="truncate text-sm font-bold settings-title">{template.name}</h3>
                                                                    {attachedFiles > 0 && (
                                                                        <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#d4d8e8] bg-white/50 px-1.5 py-0.5 text-[10px] font-semibold settings-subtitle dark:border-white/10 dark:bg-white/[0.04]">
                                                                            <Paperclip className="h-3 w-3" />
                                                                            {attachedFiles}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {template.subject && <p className="mt-0.5 truncate text-xs settings-subtitle">{template.subject}</p>}
                                                            </div>
                                                            <StatusPill active={template.is_active} />
                                                        </div>

                                                        <p className="line-clamp-3 min-h-[3.75rem] text-xs leading-5 settings-subtitle [overflow-wrap:anywhere]">{template.content}</p>

                                                        <div className="mt-auto flex items-center justify-between gap-2 border-t border-[#d4d8e8]/60 pt-3 dark:border-white/10">
                                                            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                                                <TemplateTypePill type={template.message_type} label={getTypeLabel(template.message_type)} icon={getTypeIcon(template.message_type)} />
                                                                <ScopePill global={template.is_global} assignedCount={assignedCount} />
                                                            </div>
                                                            <span className="shrink-0 text-xs settings-subtitle">
                                                                <span className="font-bold settings-title">{formatNumber(template.usage_stats?.total_sends)}</span> {t('templates.sends')}
                                                            </span>
                                                        </div>
                                                    </motion.div>
                                                );
                                            })}
                            </div>
                        )}
                    </SectionCard>
                </div>
            </div>

            <AnimatePresence>
                {openTemplate && (
                    <motion.div
                        key="template-detail"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={() => setOpenTemplate(null)}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
                    >
                        <motion.div
                            layoutId={`template-${openTemplate.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="card-gradient flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl shadow-2xl"
                        >
                            <div className="flex items-start justify-between gap-3 border-b border-[#d4d8e8]/80 p-5 dark:border-white/10">
                                <div className="min-w-0">
                                    <h2 className="truncate text-lg font-bold settings-title">{openTemplate.name}</h2>
                                    {openTemplate.subject && <p className="mt-0.5 truncate text-xs settings-subtitle">{openTemplate.subject}</p>}
                                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                        <TemplateTypePill type={openTemplate.message_type} label={getTypeLabel(openTemplate.message_type)} icon={getTypeIcon(openTemplate.message_type)} />
                                        <ScopePill global={openTemplate.is_global} assignedCount={openTemplate.assigned_users?.length ?? 0} />
                                        <StatusPill active={openTemplate.is_active} />
                                    </div>
                                </div>
                                <button onClick={() => setOpenTemplate(null)} className="shrink-0 rounded-full p-2 settings-subtitle transition-colors hover:bg-[#2e3f84]/10 dark:hover:bg-white/10" title={t('common.close')}>
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="flex-1 space-y-4 overflow-y-auto p-5">
                                <div>
                                    <p className="mb-1.5 text-xs font-semibold settings-label">{t('templates.contentLabel')}</p>
                                    <div className="whitespace-pre-wrap rounded-xl border border-[#d4d8e8]/80 bg-white/45 p-3 text-sm leading-6 settings-title [overflow-wrap:anywhere] dark:border-white/10 dark:bg-white/[0.03]">
                                        {openTemplate.content}
                                    </div>
                                </div>

                                {(openTemplate.media_files?.length || openTemplate.media_url) && (
                                    <div>
                                        <p className="mb-1.5 text-xs font-semibold settings-label">{t('templates.attachments')}</p>
                                        <div className="flex flex-wrap gap-2">
                                            {(openTemplate.media_files?.length
                                                ? openTemplate.media_files
                                                : [{ url: openTemplate.media_url!, filename: openTemplate.media_filename || t('templates.fileFallback'), type: (openTemplate.message_type === 'image' ? 'image' : openTemplate.message_type === 'video' ? 'video' : 'document') as MediaFile['type'] }]
                                            ).map((file, i) => (
                                                file.type === 'image' ? (
                                                    <img key={i} src={file.url} alt={file.filename} className="h-28 w-28 rounded-xl border border-[#d4d8e8] object-cover dark:border-white/10" />
                                                ) : file.type === 'video' ? (
                                                    <video key={i} src={file.url} className="h-28 w-28 rounded-xl border border-[#d4d8e8] object-cover dark:border-white/10" />
                                                ) : (
                                                    <a key={i} href={file.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-[#d4d8e8] bg-white/50 px-3 py-2 text-xs font-semibold settings-title dark:border-white/10 dark:bg-white/[0.04]">
                                                        <FileText className="h-4 w-4" /> {file.filename}
                                                    </a>
                                                )
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-2">
                                    <div className="rounded-xl bg-white/45 p-3 dark:bg-white/[0.03]">
                                        <p className="text-[11px] settings-subtitle">{t('templates.recordedSends')}</p>
                                        <p className="mt-0.5 text-lg font-bold settings-title">{formatNumber(openTemplate.usage_stats?.total_sends)}</p>
                                    </div>
                                    <div className="rounded-xl bg-white/45 p-3 dark:bg-white/[0.03]">
                                        <p className="text-[11px] settings-subtitle">{t('templates.lastUpdate')}</p>
                                        <p className="mt-0.5 text-sm font-bold settings-title">{formatDate(openTemplate.updated_at || openTemplate.created_at)}</p>
                                        <p className="text-[11px] settings-subtitle">{openTemplate.updated_by ? t('templates.updatedBy', { name: openTemplate.updated_by }) : t('templates.createdBy', { name: openTemplate.created_by })}</p>
                                    </div>
                                </div>
                            </motion.div>

                            {isAdmin && (
                                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#d4d8e8]/80 p-4 dark:border-white/10">
                                    <Button variant="outline" onClick={() => { deleteTemplate(openTemplate.id); setOpenTemplate(null); }} className="h-9 rounded-xl border-red-200 text-red-600 hover:bg-red-50 dark:border-red-500/20 dark:text-red-300 dark:hover:bg-red-500/10">
                                        <Trash2 className="h-4 w-4" /> {t('common.delete')}
                                    </Button>
                                    <Button variant="outline" onClick={() => { toggleStatus(openTemplate.id); setOpenTemplate(null); }} className="h-9 rounded-xl settings-btn-secondary">
                                        {openTemplate.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                                        {openTemplate.is_active ? t('common.deactivate') : t('common.activate')}
                                    </Button>
                                    <Button variant="outline" onClick={() => { setTemplateToEdit(openTemplate); setIsEditModalOpen(true); setOpenTemplate(null); }} className="h-9 rounded-xl settings-btn-secondary">
                                        <Edit3 className="h-4 w-4" /> {t('common.edit')}
                                    </Button>
                                    <Button onClick={() => router.get(`/admin/templates/${openTemplate.id}/send-form`)} className="h-9 rounded-xl settings-btn-primary text-white">
                                        <Send className="h-4 w-4" /> {t('common.submit')}
                                    </Button>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <TemplateCreateModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} users={users} />

            <TemplateEditModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                template={templateToEdit}
                users={users}
            />

            {/* Confirmación de borrado: dice QUÉ se borra y CUÁNTO se usa. */}
            <Dialog open={templateToDelete !== null} onOpenChange={(open) => !open && setTemplateToDelete(null)}>
                <DialogContent className="card-gradient rounded-2xl shadow-2xl sm:max-w-md sm:rounded-2xl">
                    <DialogHeader>
                        {/* Título en el tono de la app (no rojo): el color destructivo se
                            reserva para el botón, que es la acción irreversible. */}
                        <DialogTitle className="settings-title">
                            {t('templates.deleteTitle', 'Eliminar plantilla')}
                        </DialogTitle>
                        <DialogDescription className="settings-subtitle">
                            {t('templates.deleteIrreversible', 'Esta acción no se puede deshacer.')}
                        </DialogDescription>
                    </DialogHeader>

                    {templateToDelete && (
                        <div className="space-y-3">
                            <div className="rounded-xl bg-white/50 p-3 dark:bg-white/[0.04]">
                                <p className="truncate text-sm font-semibold settings-title">{templateToDelete.name}</p>
                                <p className="mt-0.5 text-xs settings-subtitle">
                                    {t('templates.deleteUsageCount', {
                                        count: Number(templateToDelete.usage_stats?.total_sends ?? 0),
                                        value: formatNumber(Number(templateToDelete.usage_stats?.total_sends ?? 0)),
                                        defaultValue: 'Se ha usado {{value}} veces',
                                    })}
                                </p>
                            </div>

                            {/* Si es muy usada, no basta con informar: hay que frenar al usuario. */}
                            {Number(templateToDelete.usage_stats?.total_sends ?? 0) >= 100 && (
                                <div className="rounded-lg border-l-4 border-amber-400 bg-amber-50 p-3 dark:border-amber-500 dark:bg-amber-900/20">
                                    <p className="text-xs font-medium text-amber-900 dark:text-amber-300">
                                        {t(
                                            'templates.deleteHighUsage',
                                            'Es una de las plantillas más usadas del equipo. Si solo quieres dejar de ofrecerla, considera desactivarla en lugar de eliminarla.',
                                        )}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setTemplateToDelete(null)} className="rounded-xl font-medium settings-btn-secondary">
                            {t('common.cancel')}
                        </Button>
                        <Button
                            onClick={confirmDeleteTemplate}
                            className="rounded-xl border-0 bg-gradient-to-b from-red-500 to-red-600 font-medium text-white shadow-md transition-all duration-200 hover:from-red-600 hover:to-red-700"
                        >
                            {t('common.delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AdminLayout>
    );
}