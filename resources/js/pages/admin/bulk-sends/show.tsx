import AdminLayout from '@/layouts/admin-layout';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, CheckCircle2, XCircle, Clock, Search, Phone, User, AlertCircle, Send, FileText } from 'lucide-react';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Recipient {
    id: number;
    phone_number: string;
    contact_name: string | null;
    params: Record<string, string> | null;
    status: string;
    error: string | null;
    sent_at: string | null;
}

interface BulkSendDetail {
    id: number;
    name: string;
    template_name: string;
    template_preview: string | null;
    status: string;
    total_recipients: number;
    sent_count: number;
    failed_count: number;
    created_by_name: string;
    created_at: string;
}

interface BulkSendShowProps {
    bulkSend: BulkSendDetail;
    recipients: Recipient[];
}

const statusBadge = (status: string) => {
    switch (status) {
        case 'sent':
            return { text: 'Enviado', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 };
        case 'failed':
            return { text: 'Fallido', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: XCircle };
        case 'pending':
            return { text: 'Pendiente', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock };
        default:
            return { text: status, color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400', icon: Clock };
    }
};

const bulkStatusLabel = (status: string) => {
    switch (status) {
        case 'completed': return { text: 'Completado', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
        case 'processing': return { text: 'En proceso', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' };
        case 'failed': return { text: 'Fallido', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
        case 'cancelled': return { text: 'Cancelado', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' };
        case 'draft': return { text: 'Borrador', color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400' };
        default: return { text: status, color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400' };
    }
};

export default function BulkSendShow({ bulkSend, recipients }: BulkSendShowProps) {
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');

    // Obtener todas las claves de params únicas
    const paramKeys = useMemo(() => {
        const keys = new Set<string>();
        recipients.forEach(r => {
            if (r.params) {
                Object.keys(r.params).forEach(k => keys.add(k));
            }
        });
        return Array.from(keys);
    }, [recipients]);

    const filteredRecipients = useMemo(() => {
        return recipients.filter((r) => {
            const s = search.toLowerCase();
            const paramsMatch = r.params ? Object.values(r.params).some(v => String(v).toLowerCase().includes(s)) : false;
            const matchesSearch = !search ||
                (r.contact_name?.toLowerCase().includes(s)) ||
                r.phone_number.includes(search) ||
                paramsMatch;
            const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
            return matchesSearch && matchesStatus;
        });
    }, [recipients, search, filterStatus]);

    const status = bulkStatusLabel(bulkSend.status);
    const pendingCount = bulkSend.total_recipients - bulkSend.sent_count - bulkSend.failed_count;
    const successRate = bulkSend.total_recipients > 0
        ? Math.round((bulkSend.sent_count / bulkSend.total_recipients) * 100)
        : 0;

    return (
        <AdminLayout>
            <Head title={`Envío masivo: ${bulkSend.name || bulkSend.template_name}`} />

            <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="mb-6">
                        <Link
                            href="/admin/bulk-sends"
                            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Volver a envíos masivos
                        </Link>

                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div>
                                <h1 className="font-bold settings-title" style={{ fontSize: 'var(--text-3xl)' }}>
                                    {bulkSend.name || 'Envío masivo'}
                                </h1>
                                <p className="settings-subtitle mt-1" style={{ fontSize: 'var(--text-sm)' }}>
                                    Template: <span className="font-mono font-medium">{bulkSend.template_name}</span> · Creado por {bulkSend.created_by_name} · {bulkSend.created_at}
                                </p>
                            </div>
                            <span className={`inline-flex px-3 py-1.5 rounded-full text-sm font-semibold self-start ${status.color}`}>
                                {status.text}
                            </span>
                        </div>
                    </div>

                    {/* Stats cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
                        <div className="card-gradient rounded-2xl border border-white/40 dark:border-white/10 p-4 shadow-sm">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Total</p>
                            <p className="text-2xl font-bold settings-title">{bulkSend.total_recipients.toLocaleString()}</p>
                        </div>
                        <div className="card-gradient rounded-2xl border border-white/40 dark:border-white/10 p-4 shadow-sm">
                            <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">Enviados</p>
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{bulkSend.sent_count.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">{successRate}% éxito</p>
                        </div>
                        <div className="card-gradient rounded-2xl border border-white/40 dark:border-white/10 p-4 shadow-sm">
                            <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Fallidos</p>
                            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{bulkSend.failed_count.toLocaleString()}</p>
                        </div>
                        <div className="card-gradient rounded-2xl border border-white/40 dark:border-white/10 p-4 shadow-sm">
                            <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400 mb-1">Pendientes</p>
                            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{Math.max(0, pendingCount).toLocaleString()}</p>
                        </div>
                    </div>

                    {/* Template preview */}
                    {bulkSend.template_preview && (
                        <div className="card-gradient rounded-2xl border border-white/40 dark:border-white/10 p-5 shadow-sm mb-6">
                            <h3 className="text-sm font-semibold settings-title flex items-center gap-2 mb-3">
                                <FileText className="w-4 h-4" />
                                Mensaje enviado
                            </h3>
                            <div className="bg-green-50/60 dark:bg-green-950/20 rounded-xl p-4 border border-green-200/60 dark:border-green-800/40 max-w-lg">
                                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                                    {bulkSend.template_preview}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Recipients list */}
                    <div className="card-gradient rounded-2xl border border-white/40 dark:border-white/10 p-5 shadow-lg shadow-[#2e3f84]/5">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                            <h2 className="font-semibold flex items-center gap-2 settings-title" style={{ fontSize: 'var(--text-lg)' }}>
                                <Send className="w-5 h-5" />
                                Destinatarios ({filteredRecipients.length.toLocaleString()})
                            </h2>

                            <div className="flex flex-col sm:flex-row gap-2">
                                {/* Search */}
                                <div className="relative">
                                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Buscar por nombre o teléfono..."
                                        className="pl-9 h-9 text-sm rounded-xl w-full sm:w-64"
                                    />
                                </div>

                                {/* Filter */}
                                <div className="flex rounded-xl overflow-hidden border border-border/60">
                                    {[
                                        { value: 'all', label: 'Todos' },
                                        { value: 'sent', label: 'Enviados' },
                                        { value: 'failed', label: 'Fallidos' },
                                        { value: 'pending', label: 'Pendientes' },
                                    ].map((f) => (
                                        <button
                                            key={f.value}
                                            onClick={() => setFilterStatus(f.value)}
                                            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                                                filterStatus === f.value
                                                    ? 'bg-[#2e3f84] text-white'
                                                    : 'bg-muted/30 text-muted-foreground hover:bg-muted/60'
                                            }`}
                                        >
                                            {f.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {filteredRecipients.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">
                                No se encontraron destinatarios
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border/50">
                                            <th className="text-left py-3 px-3 font-semibold text-foreground/70">#</th>
                                            <th className="text-left py-3 px-3 font-semibold text-foreground/70">Nombre</th>
                                            <th className="text-left py-3 px-3 font-semibold text-foreground/70">Teléfono</th>
                                            {paramKeys.map(key => (
                                                <th key={key} className="text-left py-3 px-3 font-semibold text-foreground/70 capitalize">{key}</th>
                                            ))}
                                            <th className="text-center py-3 px-3 font-semibold text-foreground/70">Estado</th>
                                            <th className="text-left py-3 px-3 font-semibold text-foreground/70">Enviado</th>
                                            <th className="text-left py-3 px-3 font-semibold text-foreground/70">Error</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRecipients.map((r, index) => {
                                            const badge = statusBadge(r.status);
                                            const Icon = badge.icon;
                                            return (
                                                <tr key={r.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                                                    <td className="py-2.5 px-3 text-muted-foreground text-xs">{index + 1}</td>
                                                    <td className="py-2.5 px-3 font-medium">
                                                        <div className="flex items-center gap-2">
                                                            <User className="w-3.5 h-3.5 text-muted-foreground" />
                                                            {r.contact_name || (r.params && (() => {
                                                                const nameKey = Object.keys(r.params!).find(k => /nombre|name|paciente|contacto|cliente/i.test(k));
                                                                return nameKey ? r.params![nameKey] : null;
                                                            })()) || '—'}
                                                        </div>
                                                    </td>
                                                    <td className="py-2.5 px-3">
                                                        <div className="flex items-center gap-2">
                                                            <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                                                            <span className="font-mono text-xs">{r.phone_number}</span>
                                                        </div>
                                                    </td>
                                                    {paramKeys.map(key => (
                                                        <td key={key} className="py-2.5 px-3 text-xs text-muted-foreground max-w-[200px] truncate" title={r.params?.[key] || ''}>
                                                            {r.params?.[key] || '—'}
                                                        </td>
                                                    ))}
                                                    <td className="py-2.5 px-3 text-center">
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${badge.color}`}>
                                                            <Icon className="w-3 h-3" />
                                                            {badge.text}
                                                        </span>
                                                    </td>
                                                    <td className="py-2.5 px-3 text-xs text-muted-foreground">
                                                        {r.sent_at || '—'}
                                                    </td>
                                                    <td className="py-2.5 px-3">
                                                        {r.error ? (
                                                            <div className="flex items-start gap-1.5 max-w-xs">
                                                                <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                                                                <span className="text-xs text-red-600 dark:text-red-400 truncate" title={r.error}>
                                                                    {r.error.length > 80 ? r.error.substring(0, 80) + '...' : r.error}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
