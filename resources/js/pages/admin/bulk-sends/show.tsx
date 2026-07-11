import AdminLayout from '@/layouts/admin-layout';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, CheckCircle2, XCircle, Clock, Search, Phone, User, AlertCircle, Send, FileText } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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

const statusBadge = (status: string, t: TFunction) => {
    switch (status) {
        case 'sent':
            return { text: t('bulkSends.statusSent'), color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 };
        case 'failed':
            return { text: t('bulkSends.statusFailed'), color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: XCircle };
        case 'pending':
            return { text: t('bulkSends.statusPending'), color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock };
        default:
            return { text: status, color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400', icon: Clock };
    }
};

const bulkStatusLabel = (status: string, t: TFunction) => {
    switch (status) {
        case 'completed': return { text: t('bulkSends.statusCompleted'), color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
        case 'processing': return { text: t('bulkSends.bulkStatusProcessing'), color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' };
        case 'failed': return { text: t('bulkSends.statusFailed'), color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
        case 'cancelled': return { text: t('bulkSends.statusCancelled'), color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' };
        case 'draft': return { text: t('bulkSends.statusDraft'), color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400' };
        default: return { text: status, color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400' };
    }
};

export default function BulkSendShow({ bulkSend, recipients }: BulkSendShowProps) {
    const { t } = useTranslation();
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
            const errorMatch = r.error ? r.error.toLowerCase().includes(s) : false;
            const matchesSearch = !search ||
                (r.contact_name?.toLowerCase().includes(s)) ||
                r.phone_number.includes(search) ||
                paramsMatch ||
                errorMatch;
            const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
            return matchesSearch && matchesStatus;
        });
    }, [recipients, search, filterStatus]);

    const recipientStats = useMemo(() => {
        const sent = recipients.filter((recipient) => recipient.status === 'sent').length;
        const failed = recipients.filter((recipient) => recipient.status === 'failed').length;
        const pending = recipients.filter((recipient) => recipient.status === 'pending').length;
        const withError = recipients.filter((recipient) => Boolean(recipient.error)).length;

        return { sent, failed, pending, withError };
    }, [recipients]);

    const status = bulkStatusLabel(bulkSend.status, t);
    const pendingCount = bulkSend.total_recipients - bulkSend.sent_count - bulkSend.failed_count;
    const successRate = bulkSend.total_recipients > 0
        ? Math.round((bulkSend.sent_count / bulkSend.total_recipients) * 100)
        : 0;

    return (
        <AdminLayout>
            <Head title={t('bulkSends.showPageTitle', { name: bulkSend.name || bulkSend.template_name })} />

            <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
                <div className="mx-auto flex max-w-7xl flex-col gap-5">
                    <header className="flex flex-col gap-3">
                        <Link
                            href="/admin/bulk-sends"
                            className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            {t('bulkSends.backToBulkSends')}
                        </Link>

                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="flex min-w-0 items-start gap-3">
                                <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#d4d8e8] bg-white/70 text-[#2e3f84] shadow-sm shadow-[#2e3f84]/5 dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-100">
                                    <Send className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <h1 className="truncate font-bold settings-title" style={{ fontSize: 'var(--text-3xl)' }}>
                                        {bulkSend.name || t('bulkSends.heading')}
                                    </h1>
                                    <p className="settings-subtitle" style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-xs)' }}>
                                        <span className="font-mono font-semibold">{bulkSend.template_name}</span> · {bulkSend.created_by_name} · {bulkSend.created_at}
                                    </p>
                                </div>
                            </div>
                            <span className={`inline-flex self-start rounded-full px-3 py-1.5 text-sm font-bold ${status.color}`}>
                                {status.text}
                            </span>
                        </div>
                    </header>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        <div className="rounded-xl border border-border/60 bg-card/80 p-4 shadow-sm">
                            <p className="text-xs font-semibold uppercase text-muted-foreground">{t('bulkSends.total')}</p>
                            <p className="mt-2 text-2xl font-bold settings-title">{bulkSend.total_recipients.toLocaleString()}</p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-card/80 p-4 shadow-sm">
                            <p className="text-xs font-semibold uppercase text-muted-foreground">{t('bulkSends.sent')}</p>
                            <p className="mt-2 text-2xl font-bold text-emerald-700 dark:text-emerald-300">{recipientStats.sent.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">{t('bulkSends.successRateSuffix', { rate: successRate })}</p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-card/80 p-4 shadow-sm">
                            <p className="text-xs font-semibold uppercase text-muted-foreground">{t('bulkSends.failed')}</p>
                            <p className="mt-2 text-2xl font-bold text-red-600 dark:text-red-300">{recipientStats.failed.toLocaleString()}</p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-card/80 p-4 shadow-sm">
                            <p className="text-xs font-semibold uppercase text-muted-foreground">{t('bulkSends.pending')}</p>
                            <p className="mt-2 text-2xl font-bold text-amber-700 dark:text-amber-300">{Math.max(0, pendingCount).toLocaleString()}</p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-card/80 p-4 shadow-sm">
                            <p className="text-xs font-semibold uppercase text-muted-foreground">{t('bulkSends.statWithError')}</p>
                            <p className="mt-2 text-2xl font-bold text-red-600 dark:text-red-300">{recipientStats.withError.toLocaleString()}</p>
                        </div>
                    </div>

                    {bulkSend.template_preview && (
                        <div className="rounded-xl border border-border/60 bg-card/80 p-4 shadow-sm">
                            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold settings-title">
                                <FileText className="h-4 w-4" />
                                {t('bulkSends.messageSent')}
                            </h3>
                            <div className="max-w-2xl rounded-xl border border-emerald-200/70 bg-emerald-50/60 p-4 dark:border-emerald-800/50 dark:bg-emerald-950/20">
                                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                                    {bulkSend.template_preview}
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="rounded-xl border border-border/60 bg-card/80 p-4 shadow-sm">
                        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                            <h2 className="flex items-center gap-2 text-base font-bold settings-title">
                                <Send className="h-4 w-4" />
                                {t('bulkSends.recipients')}
                                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                                    {filteredRecipients.length.toLocaleString()}
                                </span>
                            </h2>

                            <div className="flex flex-col gap-2 md:flex-row md:items-center">
                                <div className="relative min-w-0 md:w-80">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder={t('bulkSends.searchRecipientsPlaceholder')}
                                        className="h-9 w-full rounded-xl pl-9 text-sm"
                                    />
                                </div>

                                <div className="flex flex-wrap gap-1 rounded-xl bg-muted/50 p-1">
                                    {[
                                        { value: 'all', label: t('bulkSends.filterAll'), count: recipients.length },
                                        { value: 'sent', label: t('bulkSends.sent'), count: recipientStats.sent },
                                        { value: 'failed', label: t('bulkSends.failed'), count: recipientStats.failed },
                                        { value: 'pending', label: t('bulkSends.pending'), count: recipientStats.pending },
                                    ].map((f) => (
                                        <button
                                            key={f.value}
                                            onClick={() => setFilterStatus(f.value)}
                                            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                                                filterStatus === f.value
                                                    ? 'bg-white text-foreground shadow-sm dark:bg-gray-800'
                                                    : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                        >
                                            {f.label} {f.count > 0 ? f.count : ''}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {filteredRecipients.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-border/70 bg-background/40 py-10 text-center">
                                <Search className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                                <p className="text-sm font-medium text-muted-foreground">{t('bulkSends.noRecipientsFound')}</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-xl border border-border/60">
                                <table className="w-full min-w-[980px] text-sm">
                                    <thead className="bg-muted/40">
                                        <tr className="border-b border-border/50">
                                            <th className="px-3 py-2.5 text-left text-xs font-bold uppercase text-muted-foreground">#</th>
                                            <th className="px-3 py-2.5 text-left text-xs font-bold uppercase text-muted-foreground">{t('bulkSends.colName')}</th>
                                            <th className="px-3 py-2.5 text-left text-xs font-bold uppercase text-muted-foreground">{t('bulkSends.columnPhone')}</th>
                                            {paramKeys.map(key => (
                                                <th key={key} className="px-3 py-2.5 text-left text-xs font-bold uppercase text-muted-foreground">{key}</th>
                                            ))}
                                            <th className="px-3 py-2.5 text-center text-xs font-bold uppercase text-muted-foreground">{t('bulkSends.colStatus')}</th>
                                            <th className="px-3 py-2.5 text-left text-xs font-bold uppercase text-muted-foreground">{t('bulkSends.statusSent')}</th>
                                            <th className="px-3 py-2.5 text-left text-xs font-bold uppercase text-muted-foreground">{t('bulkSends.columnError')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRecipients.map((r, index) => {
                                            const badge = statusBadge(r.status, t);
                                            const Icon = badge.icon;
                                            return (
                                                <tr key={r.id} className="border-b border-border/30 transition-colors hover:bg-muted/30">
                                                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{index + 1}</td>
                                                    <td className="px-3 py-2.5 font-medium">
                                                        <div className="flex min-w-0 items-center gap-2">
                                                            <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                                            {r.contact_name || (r.params && (() => {
                                                                const nameKey = Object.keys(r.params!).find(k => /nombre|name|paciente|contacto|cliente/i.test(k));
                                                                return nameKey ? r.params![nameKey] : null;
                                                            })()) || '—'}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        <div className="flex items-center gap-2">
                                                            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                                            <span className="font-mono text-xs">{r.phone_number}</span>
                                                        </div>
                                                    </td>
                                                    {paramKeys.map(key => (
                                                        <td key={key} className="max-w-[200px] truncate px-3 py-2.5 text-xs text-muted-foreground" title={r.params?.[key] || ''}>
                                                            {r.params?.[key] || '—'}
                                                        </td>
                                                    ))}
                                                    <td className="px-3 py-2.5 text-center">
                                                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${badge.color}`}>
                                                            <Icon className="h-3 w-3" />
                                                            {badge.text}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                                                        {r.sent_at || '—'}
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        {r.error ? (
                                                            <div className="flex max-w-md items-start gap-1.5 rounded-lg bg-red-50 px-2 py-1.5 dark:bg-red-950/25">
                                                                <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-red-500" />
                                                                <span className="text-xs leading-relaxed text-red-700 dark:text-red-300" title={r.error}>
                                                                    {r.error}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="rounded-md bg-muted/40 px-2 py-1 text-xs text-muted-foreground">{t('bulkSends.noError')}</span>
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
