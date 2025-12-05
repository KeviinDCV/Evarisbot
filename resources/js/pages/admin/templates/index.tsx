import { Head, Link, router, usePage } from '@inertiajs/react';
import AdminLayout from '@/layouts/admin-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, MessageSquare, Image, FileText, Power, PowerOff, Edit, Trash2, Send } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Template {
    id: number;
    name: string;
    subject: string | null;
    content: string;
    is_active: boolean;
    message_type: 'text' | 'image' | 'document';
    media_url: string | null;
    media_filename: string | null;
    created_by: string;
    updated_by: string | null;
    created_at: string;
    updated_at: string;
    usage_stats: {
        total_sends: number;
        total_recipients: number;
        successful_sends: number;
        failed_sends: number;
        last_sent_at: string | null;
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

            <div className="min-h-screen bg-[#f0f2f8] p-4 md:p-6 lg:p-8">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="mb-6" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
                            <div>
                                <h1 className="font-bold" style={{ fontSize: 'var(--text-3xl)', color: 'var(--primary-base)' }}>
                                    {t('templates.title')}
                                </h1>
                                <p className="text-gray-600" style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-xs)' }}>
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
                                        <Plus className="w-4 h-4 mr-2" />
                                        {t('templates.newTemplate')}
                                    </Button>
                                </Link>
                            )}
                        </div>

                        {/* Filtros */}
                        <div className="bg-gradient-to-b from-white to-[#fafbfc] rounded-none p-4 shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_4px_rgba(46,63,132,0.06),0_4px_12px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.9)] flex flex-wrap gap-4 items-end">
                            <div style={{ flex: '1 1 250px', minWidth: '200px' }}>
                                <label className="font-semibold block mb-2" style={{ fontSize: 'var(--text-sm)', color: 'var(--primary-base)' }}>
                                    {t('common.search')}
                                </label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <Input
                                        type="text"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleFilter()}
                                        placeholder={t('templates.searchPlaceholder')}
                                        className="pl-10 border-0 rounded-none transition-all duration-200"
                                        style={{
                                            backgroundColor: 'var(--layer-base)',
                                            boxShadow: 'var(--shadow-inset-sm)',
                                            height: 'clamp(2.5rem, 2.5rem + 0.5vw, 3rem)',
                                            fontSize: 'var(--text-sm)',
                                        }}
                                    />
                                </div>
                            </div>

                            <div style={{ flex: '0 1 150px' }}>
                                <label className="font-semibold block mb-2" style={{ fontSize: 'var(--text-sm)', color: 'var(--primary-base)' }}>
                                    {t('common.status')}
                                </label>
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="w-full border-0 rounded-none transition-all duration-200"
                                    style={{
                                        backgroundColor: 'var(--layer-base)',
                                        boxShadow: 'var(--shadow-inset-sm)',
                                        height: 'clamp(2.5rem, 2.5rem + 0.5vw, 3rem)',
                                        fontSize: 'var(--text-sm)',
                                        padding: '0 var(--space-base)',
                                    }}
                                >
                                    <option value="all">{t('common.all')}</option>
                                    <option value="active">{t('common.active')}</option>
                                    <option value="inactive">{t('common.inactive')}</option>
                                </select>
                            </div>

                            <div style={{ flex: '0 1 150px' }}>
                                <label className="font-semibold block mb-2" style={{ fontSize: 'var(--text-sm)', color: 'var(--primary-base)' }}>
                                    {t('templates.type')}
                                </label>
                                <select
                                    value={typeFilter}
                                    onChange={(e) => setTypeFilter(e.target.value)}
                                    className="w-full border-0 rounded-none transition-all duration-200"
                                    style={{
                                        backgroundColor: 'var(--layer-base)',
                                        boxShadow: 'var(--shadow-inset-sm)',
                                        height: 'clamp(2.5rem, 2.5rem + 0.5vw, 3rem)',
                                        fontSize: 'var(--text-sm)',
                                        padding: '0 var(--space-base)',
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
                                    height: 'clamp(2.5rem, 2.5rem + 0.5vw, 3rem)',
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
                                className="bg-gradient-to-b from-white to-[#fafbfc] rounded-none p-5 shadow-[0_1px_3px_rgba(46,63,132,0.06),0_2px_6px_rgba(46,63,132,0.08),0_6px_16px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] transition-all duration-300"
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 'var(--space-md)',
                                }}
                            >
                                {/* Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                    <div style={{ flex: 1 }}>
                                        <h3 className="font-bold" style={{ fontSize: 'var(--text-lg)', color: 'var(--primary-base)' }}>
                                            {template.name}
                                        </h3>
                                        {template.subject && (
                                            <p className="text-gray-600" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-xs)' }}>
                                                {template.subject}
                                            </p>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                                        {getTypeIcon(template.message_type)}
                                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--primary-base)' }}>
                                            {getTypeLabel(template.message_type)}
                                        </span>
                                    </div>
                                </div>

                                {/* Content Preview */}
                                <p className="text-gray-700 line-clamp-3" style={{ fontSize: 'var(--text-sm)' }}>
                                    {template.content}
                                </p>

                                {/* Stats */}
                                <div 
                                    className="rounded-none p-3"
                                    style={{
                                        backgroundColor: 'var(--layer-base)',
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(2, 1fr)',
                                        gap: 'var(--space-sm)',
                                    }}
                                >
                                    <div>
                                        <p className="text-gray-500" style={{ fontSize: 'var(--text-xs)' }}>{t('templates.stats.sends')}</p>
                                        <p className="font-bold" style={{ fontSize: 'var(--text-base)', color: 'var(--primary-base)' }}>
                                            {template.usage_stats.total_sends}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500" style={{ fontSize: 'var(--text-xs)' }}>{t('templates.stats.recipients')}</p>
                                        <p className="font-bold" style={{ fontSize: 'var(--text-base)', color: 'var(--primary-base)' }}>
                                            {template.usage_stats.total_recipients}
                                        </p>
                                    </div>
                                </div>

                                {/* Status & Actions */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 'var(--space-sm)', borderTop: '1px solid var(--layer-base)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-md)' }}>
                                        {isAdmin ? (
                                            <button
                                                onClick={() => toggleStatus(template.id)}
                                                className="transition-all duration-200"
                                                style={{ padding: 'var(--space-xs)' }}
                                            >
                                                {template.is_active ? (
                                                    <Power className="w-5 h-5 text-green-600" />
                                                ) : (
                                                    <PowerOff className="w-5 h-5 text-gray-400" />
                                                )}
                                            </button>
                                        ) : (
                                            <div style={{ padding: 'var(--space-xs)' }}>
                                                {template.is_active ? (
                                                    <Power className="w-5 h-5 text-green-600" />
                                                ) : (
                                                    <PowerOff className="w-5 h-5 text-gray-400" />
                                                )}
                                            </div>
                                        )}
                                        <span style={{ fontSize: 'var(--text-xs)', color: template.is_active ? 'green' : 'gray' }}>
                                            {template.is_active ? t('templates.statusLabels.active') : t('templates.statusLabels.inactive')}
                                        </span>
                                    </div>

                                    {isAdmin && (
                                        <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                                            {template.is_active && (
                                                <Link href={`/admin/templates/${template.id}/send-form`}>
                                                    <Button
                                                        size="sm"
                                                        className="transition-all duration-200"
                                                        style={{
                                                            backgroundColor: 'var(--primary-base)',
                                                            color: 'white',
                                                            padding: 'var(--space-xs) var(--space-sm)',
                                                        }}
                                                    >
                                                        <Send className="w-4 h-4" />
                                                    </Button>
                                                </Link>
                                            )}
                                            <Link href={`/admin/templates/${template.id}/edit`}>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="transition-all duration-200"
                                                    style={{ padding: 'var(--space-xs) var(--space-sm)' }}
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                            </Link>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => deleteTemplate(template.id)}
                                                className="text-red-600 transition-all duration-200"
                                                style={{ padding: 'var(--space-xs) var(--space-sm)' }}
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
                        <div className="bg-gradient-to-b from-white to-[#fafbfc] rounded-none p-12 text-center shadow-[0_1px_3px_rgba(46,63,132,0.06),0_2px_6px_rgba(46,63,132,0.08),0_6px_16px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.8)]">
                            <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                            <h3 className="font-bold mb-2" style={{ fontSize: 'var(--text-xl)', color: 'var(--primary-base)' }}>
                                {t('templates.noTemplates')}
                            </h3>
                            <p className="text-gray-600 mb-6" style={{ fontSize: 'var(--text-sm)' }}>
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
