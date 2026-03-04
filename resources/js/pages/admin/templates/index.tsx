import { Head, Link, router, usePage } from '@inertiajs/react';
import AdminLayout from '@/layouts/admin-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, MessageSquare, Image, FileText, Power, PowerOff, Edit, Trash2, Paperclip } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import TemplateCreateModal from './components/TemplateCreateModal';
import TemplateEditModal from './components/TemplateEditModal';
import WelcomeFlowSection from './components/WelcomeFlowSection';

interface MediaFile {
    url: string;
    filename: string;
    type: 'image' | 'video' | 'document';
}

interface Template {
    id: number;
    name: string;
    subject: string | null;
    content: string;
    is_active: boolean;
    message_type: 'text' | 'image' | 'document';
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

interface Filters {
    status: string;
    type: string;
    search: string;
}

interface TemplatesIndexProps {
    templates: Template[];
    filters: Filters;
    users: any[];
    welcomeFlows?: any[];
}

export default function TemplatesIndex({ templates, filters, users, welcomeFlows = [] }: TemplatesIndexProps) {
    const { t } = useTranslation();
    const { auth } = usePage().props as any;
    const isAdmin = auth.user.role === 'admin';

    const [search, setSearch] = useState(filters.search);
    const [statusFilter, setStatusFilter] = useState(filters.status);
    const [typeFilter, setTypeFilter] = useState(filters.type);

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [templateToEdit, setTemplateToEdit] = useState<Template | null>(null);

    const handleFilter = () => {
        router.get('/admin/templates', {
            search,
            status: statusFilter,
            type: typeFilter,
        }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const toggleStatus = (templateId: number) => {
        router.post(`/admin/templates/${templateId}/toggle`, {}, {
            preserveScroll: true,
        });
    };

    const deleteTemplate = (templateId: number) => {
        if (confirm(t('templates.deleteConfirm'))) {
            router.delete(`/admin/templates/${templateId}`, {
                preserveScroll: true,
            });
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'text': return <MessageSquare className="w-4 h-4" />;
            case 'image': return <Image className="w-4 h-4" />;
            case 'document': return <FileText className="w-4 h-4" />;
            default: return <MessageSquare className="w-4 h-4" />;
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'text': return t('templates.types.text');
            case 'image': return t('templates.types.image');
            case 'document': return t('templates.types.document');
            default: return type;
        }
    };

    return (
        <AdminLayout>
            <Head title={t('templates.title')} />

            <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="mb-6" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
                            <div>
                                <h1 className="font-bold settings-title" style={{ fontSize: 'var(--text-3xl)' }}>
                                    {t('templates.title')}
                                </h1>
                                <p className="settings-subtitle" style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-xs)' }}>
                                    {isAdmin ? t('templates.adminSubtitle') : t('templates.viewerSubtitle')}
                                </p>
                            </div>
                            {isAdmin && (
                                <Button
                                    onClick={() => setIsCreateModalOpen(true)}
                                    className="font-semibold text-white transition-all duration-200 border-0 relative overflow-hidden rounded-xl"
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
                                    <Plus className="w-4 h-4 mr-2" />
                                    {t('templates.newTemplate')}
                                </Button>
                            )}
                        </div>

                        {/* Sección Menú de Bienvenida - Solo visible para admin */}
                        {isAdmin && (
                            <WelcomeFlowSection welcomeFlows={welcomeFlows} />
                        )}

                        {/* Filtros */}
                        <div className="card-gradient rounded-2xl border border-white/40 dark:border-white/10 shadow-lg shadow-[#2e3f84]/5 p-4 md:p-5 flex flex-wrap gap-4 items-end transition-all duration-300 hover:shadow-xl hover:shadow-[#2e3f84]/10">
                            <div style={{ flex: '1 1 250px', minWidth: '200px' }}>
                                <label htmlFor="template-search" className="font-semibold block mb-2 settings-label" style={{ fontSize: 'var(--text-sm)' }}>
                                    {t('common.search')}
                                </label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 settings-subtitle" />
                                    <Input
                                        id="template-search"
                                        name="template-search"
                                        type="text"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleFilter()}
                                        placeholder={t('templates.searchPlaceholder')}
                                        className="pl-10 settings-input rounded-xl border-gray-200 dark:border-gray-800 transition-all duration-200 focus:ring-2 focus:ring-[#2e3f84]/30"
                                        style={{
                                            height: 'clamp(2.25rem, 2.25rem + 0.15vw, 2.5rem)',
                                            fontSize: 'var(--text-sm)',
                                        }}
                                    />
                                </div>
                            </div>

                            <div style={{ flex: '0 1 150px' }}>
                                <label htmlFor="template-status" className="font-semibold block mb-2 settings-label" style={{ fontSize: 'var(--text-sm)' }}>
                                    {t('common.status')}
                                </label>
                                <select
                                    id="template-status"
                                    name="template-status"
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="w-full settings-input rounded-xl border-gray-200 dark:border-gray-800 transition-all duration-200 cursor-pointer focus:ring-2 focus:ring-[#2e3f84]/30"
                                    style={{
                                        height: 'clamp(2.25rem, 2.25rem + 0.15vw, 2.5rem)',
                                        fontSize: 'var(--text-sm)',
                                        padding: '0 2.5rem 0 var(--space-base)',
                                        appearance: 'none',
                                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                                        backgroundRepeat: 'no-repeat',
                                        backgroundPosition: 'right 0.75rem center',
                                        backgroundSize: '1rem',
                                    }}
                                >
                                    <option value="all">{t('common.all')}</option>
                                    <option value="active">{t('common.active')}</option>
                                    <option value="inactive">{t('common.inactive')}</option>
                                </select>
                            </div>

                            <div style={{ flex: '0 1 150px' }}>
                                <label htmlFor="template-type" className="font-semibold block mb-2 settings-label" style={{ fontSize: 'var(--text-sm)' }}>
                                    {t('templates.type')}
                                </label>
                                <select
                                    id="template-type"
                                    name="template-type"
                                    value={typeFilter}
                                    onChange={(e) => setTypeFilter(e.target.value)}
                                    className="w-full settings-input rounded-xl border-gray-200 dark:border-gray-800 transition-all duration-200 cursor-pointer focus:ring-2 focus:ring-[#2e3f84]/30"
                                    style={{
                                        height: 'clamp(2.25rem, 2.25rem + 0.15vw, 2.5rem)',
                                        fontSize: 'var(--text-sm)',
                                        padding: '0 2.5rem 0 var(--space-base)',
                                        appearance: 'none',
                                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                                        backgroundRepeat: 'no-repeat',
                                        backgroundPosition: 'right 0.75rem center',
                                        backgroundSize: '1rem',
                                    }}
                                >
                                    <option value="all">{t('common.all')}</option>
                                    <option value="text">{t('templates.types.text')}</option>
                                    <option value="image">{t('templates.types.image')}</option>
                                    <option value="document">{t('templates.types.document')}</option>
                                </select>
                            </div>

                            <Button
                                onClick={handleFilter}
                                className="font-semibold transition-all duration-200"
                                style={{
                                    backgroundColor: 'var(--primary-base)',
                                    color: 'white',
                                    boxShadow: 'var(--shadow-sm)',
                                    height: 'clamp(2.25rem, 2.25rem + 0.15vw, 2.5rem)',
                                    padding: '0 var(--space-lg)',
                                    fontSize: 'var(--text-sm)',
                                }}
                            >
                                {t('common.filter')}
                            </Button>
                        </div>
                    </div>

                    {/* Lista de Plantillas */}
                    {templates.length > 0 && (
                        <div className="card-gradient rounded-2xl border border-white/40 dark:border-white/10 shadow-lg shadow-[#2e3f84]/5 overflow-hidden transition-all duration-300 mt-6">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-border dark:border-[hsl(231,20%,20%)] bg-black/5 dark:bg-white/5">
                                            <th className="p-4 font-semibold settings-title whitespace-nowrap" style={{ fontSize: 'var(--text-sm)' }}>
                                                {t('templates.name')}
                                            </th>
                                            <th className="p-4 font-semibold settings-title whitespace-nowrap" style={{ fontSize: 'var(--text-sm)' }}>
                                                {t('templates.type')}
                                            </th>
                                            <th className="p-4 font-semibold settings-title whitespace-nowrap hidden md:table-cell" style={{ fontSize: 'var(--text-sm)' }}>
                                                {t('templates.content')}
                                            </th>
                                            <th className="p-4 font-semibold settings-title text-center whitespace-nowrap" style={{ fontSize: 'var(--text-sm)' }}>
                                                {t('templates.stats.sends')}
                                            </th>
                                            <th className="p-4 font-semibold settings-title text-center whitespace-nowrap" style={{ fontSize: 'var(--text-sm)' }}>
                                                {t('common.status')}
                                            </th>
                                            {isAdmin && (
                                                <th className="p-4 font-semibold settings-title text-right whitespace-nowrap" style={{ fontSize: 'var(--text-sm)' }}>
                                                    {t('common.actions')}
                                                </th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {templates.map((template) => (
                                            <tr key={template.id} className="border-b border-border dark:border-[hsl(231,20%,20%)] last:border-0 hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-200">
                                                <td className="p-4 min-w-[200px] align-top">
                                                    <div className="min-w-0">
                                                        <h3 className="font-bold settings-title truncate" style={{ fontSize: 'var(--text-md)' }}>
                                                            {template.name}
                                                        </h3>
                                                        {template.subject && (
                                                            <p className="settings-subtitle truncate" style={{ fontSize: 'var(--text-sm)' }}>
                                                                {template.subject}
                                                            </p>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-4 align-top whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary dark:text-[hsl(231,55%,70%)] flex items-center justify-center flex-shrink-0">
                                                            {getTypeIcon(template.message_type)}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="settings-title font-medium" style={{ fontSize: 'var(--text-sm)' }}>
                                                                {getTypeLabel(template.message_type)}
                                                            </span>
                                                            {(template.media_files?.length ?? 0) > 0 && (
                                                                <span className="settings-subtitle flex items-center gap-1" style={{ fontSize: 'var(--text-xs)' }}>
                                                                    <Paperclip className="w-3 h-3" />
                                                                    {template.media_files?.length} adjunto{(template.media_files?.length ?? 0) !== 1 ? 's' : ''}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4 align-top hidden md:table-cell w-full max-w-md">
                                                    <p className="settings-subtitle line-clamp-2" style={{ fontSize: 'var(--text-sm)', lineHeight: '1.4' }}>
                                                        {template.content}
                                                    </p>
                                                </td>
                                                <td className="p-4 align-top text-center border-l border-r border-border/50 dark:border-[hsl(231,20%,20%)]/50">
                                                    <div className="font-bold settings-title text-primary dark:text-white" style={{ fontSize: 'var(--text-lg)' }}>
                                                        {template.usage_stats.total_sends}
                                                    </div>
                                                </td>
                                                <td className="p-4 align-top text-center py-5">
                                                    <div className="flex flex-col items-center gap-1.5">
                                                        {isAdmin ? (
                                                            <button
                                                                onClick={() => toggleStatus(template.id)}
                                                                className={`w-10 h-6 flex items-center rounded-full p-1 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-inner ${template.is_active ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-700'}`}
                                                                title={template.is_active ? 'Desactivar' : 'Activar'}
                                                            >
                                                                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${template.is_active ? 'translate-x-4' : 'translate-x-0'}`} />
                                                            </button>
                                                        ) : (
                                                            <div className={`w-2.5 h-2.5 rounded-full ${template.is_active ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]' : 'bg-gray-400'}`} />
                                                        )}
                                                        <span className={template.is_active ? 'text-green-600 dark:text-green-400 font-medium' : 'text-gray-500 dark:text-gray-400 font-medium'} style={{ fontSize: 'var(--text-xs)' }}>
                                                            {template.is_active ? t('templates.statusLabels.active') : t('templates.statusLabels.inactive')}
                                                        </span>
                                                    </div>
                                                </td>
                                                {isAdmin && (
                                                    <td className="p-4 align-top text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => {
                                                                    setTemplateToEdit(template);
                                                                    setIsEditModalOpen(true);
                                                                }}
                                                                className="settings-btn-secondary rounded-xl hover:!text-white hover:!bg-gradient-to-b hover:!from-[#3e4f94] hover:!to-[#2e3f84] hover:shadow-[0_2px_4px_rgba(46,63,132,0.2),0_4px_8px_rgba(46,63,132,0.25)] transition-all duration-200"
                                                                style={{ padding: 'var(--space-xs) 0.5rem' }}
                                                                title={t('common.edit')}
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => deleteTemplate(template.id)}
                                                                className="rounded-xl hover:!text-white hover:!bg-gradient-to-b hover:!from-red-500 hover:!to-red-600 hover:shadow-[0_2px_4px_rgba(239,68,68,0.2),0_4px_8px_rgba(239,68,68,0.25)] transition-all duration-200 border-gray-200 dark:border-gray-800"
                                                                style={{ padding: 'var(--space-xs) 0.5rem', color: '#dc2626' }}
                                                                title={t('common.delete')}
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Empty State */}
                    {templates.length === 0 && (
                        <div className="card-gradient rounded-2xl p-12 text-center border border-white/40 dark:border-white/10 shadow-lg shadow-[#2e3f84]/5">
                            <MessageSquare className="w-16 h-16 mx-auto mb-4 settings-subtitle" />
                            <h3 className="font-bold mb-2 settings-title" style={{ fontSize: 'var(--text-xl)' }}>
                                {t('templates.noTemplates')}
                            </h3>
                            <p className="mb-6 settings-subtitle" style={{ fontSize: 'var(--text-sm)' }}>
                                {isAdmin
                                    ? t('templates.noTemplatesSubtitle')
                                    : t('templates.noTemplatesViewer')
                                }
                            </p>
                            {isAdmin && (
                                <Button onClick={() => setIsCreateModalOpen(true)} style={{ backgroundColor: 'var(--primary-base)', color: 'white' }} className="rounded-xl">
                                    <Plus className="w-4 h-4 mr-2" />
                                    {t('templates.newTemplate')}
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <TemplateCreateModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                users={users}
            />

            <TemplateEditModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                template={templateToEdit}
                users={users}
            />
        </AdminLayout>
    );
}
