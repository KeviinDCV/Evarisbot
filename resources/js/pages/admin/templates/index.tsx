import { Head, Link, router, usePage } from '@inertiajs/react';
import AdminLayout from '@/layouts/admin-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, MessageSquare, Image, FileText, Power, PowerOff, Edit, Trash2, Paperclip } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

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
}

export default function TemplatesIndex({ templates, filters }: TemplatesIndexProps) {
    const { t } = useTranslation();
    const { auth } = usePage().props as any;
    const isAdmin = auth.user.role === 'admin';
    
    const [search, setSearch] = useState(filters.search);
    const [statusFilter, setStatusFilter] = useState(filters.status);
    const [typeFilter, setTypeFilter] = useState(filters.type);

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
                                <Link href="/admin/templates/create">
                                    <Button 
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
                                        <Plus className="w-4 h-4 mr-2" />
                                        {t('templates.newTemplate')}
                                    </Button>
                                </Link>
                            )}
                        </div>

                        {/* Filtros */}
                        <div className="card-gradient rounded-none p-4 shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_4px_rgba(46,63,132,0.06),0_4px_12px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.9)] flex flex-wrap gap-4 items-end">
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
                                        className="pl-10 settings-input rounded-none transition-all duration-200"
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
                                    className="w-full settings-input rounded-none transition-all duration-200 cursor-pointer focus:ring-2 focus:ring-primary/20"
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
                                    className="w-full settings-input rounded-none transition-all duration-200 cursor-pointer focus:ring-2 focus:ring-primary/20"
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
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 'var(--space-lg)' }}>
                        {templates.map((template) => (
                            <div
                                key={template.id}
                                className="card-gradient rounded-none p-5 shadow-[0_1px_3px_rgba(46,63,132,0.06),0_2px_6px_rgba(46,63,132,0.08),0_6px_16px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] transition-all duration-300"
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 'var(--space-md)',
                                }}
                            >
                                {/* Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                    <div style={{ flex: 1 }}>
                                        <h3 className="font-bold settings-title" style={{ fontSize: 'var(--text-lg)' }}>
                                            {template.name}
                                        </h3>
                                        {template.subject && (
                                            <p className="settings-subtitle" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-xs)' }}>
                                                {template.subject}
                                            </p>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                                        {(template.media_files?.length ?? 0) > 0 ? (
                                            <>
                                                <Paperclip className="w-4 h-4 settings-title" />
                                                <span className="settings-title" style={{ fontSize: 'var(--text-xs)' }}>
                                                    {template.media_files?.length} archivo{(template.media_files?.length ?? 0) !== 1 ? 's' : ''}
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <span className="settings-title">{getTypeIcon(template.message_type)}</span>
                                                <span className="settings-title" style={{ fontSize: 'var(--text-xs)' }}>
                                                    {getTypeLabel(template.message_type)}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Content Preview */}
                                <p className="text-foreground line-clamp-3" style={{ fontSize: 'var(--text-sm)' }}>
                                    {template.content}
                                </p>

                                {/* Stats */}
                                <div className="rounded-none p-3 user-stats-box">
                                    <div>
                                        <p className="settings-subtitle" style={{ fontSize: 'var(--text-xs)' }}>{t('templates.stats.sends')}</p>
                                        <p className="font-bold settings-title" style={{ fontSize: 'var(--text-base)' }}>
                                            {template.usage_stats.total_sends}
                                        </p>
                                    </div>
                                </div>

                                {/* Status & Actions */}
                                <div className="border-t border-border dark:border-[hsl(231,20%,20%)]" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 'var(--space-sm)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-md)' }}>
                                        {isAdmin ? (
                                            <button
                                                onClick={() => toggleStatus(template.id)}
                                                className="transition-all duration-200"
                                                style={{ padding: 'var(--space-xs)' }}
                                            >
                                                {template.is_active ? (
                                                    <Power className="w-5 h-5 text-green-600 dark:text-green-400" />
                                                ) : (
                                                    <PowerOff className="w-5 h-5" style={{ color: '#6b7494' }} />
                                                )}
                                            </button>
                                        ) : (
                                            <div style={{ padding: 'var(--space-xs)' }}>
                                                {template.is_active ? (
                                                    <Power className="w-5 h-5 text-green-600 dark:text-green-400" />
                                                ) : (
                                                    <PowerOff className="w-5 h-5" style={{ color: '#6b7494' }} />
                                                )}
                                            </div>
                                        )}
                                        <span className={template.is_active ? 'user-status-online' : 'user-status-offline'} style={{ fontSize: 'var(--text-xs)' }}>
                                            {template.is_active ? t('templates.statusLabels.active') : t('templates.statusLabels.inactive')}
                                        </span>
                                    </div>

                                    {isAdmin && (
                                        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                                            <Link href={`/admin/templates/${template.id}/edit`}>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="settings-btn-secondary hover:!text-white hover:!bg-gradient-to-b hover:!from-[#3e4f94] hover:!to-[#2e3f84] transition-all duration-200"
                                                    style={{ padding: 'var(--space-xs) var(--space-sm)' }}
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                            </Link>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => deleteTemplate(template.id)}
                                                className="hover:!text-white hover:!bg-gradient-to-b hover:!from-red-500 hover:!to-red-600 transition-all duration-200"
                                                style={{ padding: 'var(--space-xs) var(--space-sm)', color: '#dc2626' }}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Empty State */}
                    {templates.length === 0 && (
                        <div className="card-gradient rounded-none p-12 text-center shadow-[0_1px_3px_rgba(46,63,132,0.06),0_2px_6px_rgba(46,63,132,0.08),0_6px_16px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.8)]">
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
                                <Link href="/admin/templates/create">
                                    <Button style={{ backgroundColor: 'var(--primary-base)', color: 'white' }}>
                                        <Plus className="w-4 h-4 mr-2" />
                                        {t('templates.newTemplate')}
                                    </Button>
                                </Link>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}
