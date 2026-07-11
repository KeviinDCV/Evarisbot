import { Head, router, useForm } from '@inertiajs/react';
import AdminLayout from '@/layouts/admin-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import InputError from '@/components/input-error';
import { cn } from '@/lib/utils';
import {
    AlertCircle,
    Building2,
    Check,
    CheckCircle2,
    Headphones,
    KeyRound,
    Loader2,
    MessageCircle,
    Phone,
    PlugZap,
    Search,
    ShieldCheck,
    SlidersHorizontal,
    Users,
    X,
    type LucideIcon,
} from 'lucide-react';
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import axios from 'axios';

interface Settings {
    whatsapp: {
        token: string | null;
        phone_id: string | null;
        business_account_id: string | null;
        verify_token: string | null;
        webhook_url: string | null;
        is_configured: boolean;
    };
    groq: {
        api_key: string | null;
        is_configured: boolean;
    };
}

interface Advisor {
    id: number;
    name: string;
    email: string;
    is_on_duty: boolean;
}

interface SettingsIndexProps {
    settings: Settings;
    advisors: Advisor[];
}

interface BusinessProfile {
    business_name: string;
    phone_number: string;
    phone_number_id: string;
    verified: boolean;
    quality_rating: string;
    messaging_limit: string;
}

interface StatusPillProps {
    active: boolean;
    activeLabel: string;
    inactiveLabel: string;
}

interface SectionHeaderProps {
    icon: LucideIcon;
    title: string;
    subtitle: string;
    active?: boolean;
    activeLabel?: string;
    inactiveLabel?: string;
    actions?: ReactNode;
}

interface StatusTileProps {
    icon: LucideIcon;
    title: string;
    value: string;
    detail: string;
    active: boolean;
}

interface CredentialInputProps {
    id: string;
    label: string;
    icon: LucideIcon;
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    error?: string;
    preview?: string | null;
    type?: 'text' | 'password';
}

function StatusPill({ active, activeLabel, inactiveLabel }: StatusPillProps) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold',
                active
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
                    : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300'
            )}
        >
            {active ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
            {active ? activeLabel : inactiveLabel}
        </span>
    );
}

function StatusTile({ icon: Icon, title, value, detail, active }: StatusTileProps) {
    return (
        <div className="card-gradient rounded-2xl border border-white/50 p-4 shadow-sm shadow-[#2e3f84]/5 dark:border-white/10">
            <div className="flex items-center gap-3">
                <div
                    className={cn(
                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border',
                        active
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
                            : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300'
                    )}
                >
                    <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-xs font-semibold settings-subtitle">{title}</p>
                        <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', active ? 'bg-emerald-500' : 'bg-amber-500')} />
                    </div>
                    <p className="mt-1 truncate text-lg font-bold settings-title">{value}</p>
                    <p className="mt-0.5 truncate text-xs settings-subtitle">{detail}</p>
                </div>
            </div>
        </div>
    );
}

function SectionHeader({ icon: Icon, title, subtitle, active, activeLabel, inactiveLabel, actions }: SectionHeaderProps) {
    return (
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#d4d8e8] bg-[#2e3f84]/10 text-[#2e3f84] dark:border-white/10 dark:bg-white/[0.05] dark:text-neutral-100">
                    <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-bold leading-tight settings-title">{title}</h2>
                        {typeof active === 'boolean' && activeLabel && inactiveLabel && (
                            <StatusPill active={active} activeLabel={activeLabel} inactiveLabel={inactiveLabel} />
                        )}
                    </div>
                    <p className="mt-1 text-sm leading-relaxed settings-subtitle">{subtitle}</p>
                </div>
            </div>
            {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
    );
}

function CredentialInput({ id, label, icon: Icon, value, onChange, placeholder, error, preview, type = 'text' }: CredentialInputProps) {
    return (
        <div className="space-y-2">
            <div className="flex min-h-5 items-center justify-between gap-3">
                <Label htmlFor={id} className="flex items-center gap-2 text-[13px] font-semibold settings-label">
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                </Label>
                {preview && (
                    <span className="max-w-[160px] truncate rounded-lg bg-[#eef1f8] px-2 py-1 font-mono text-[10px] text-[#6b7494] dark:bg-white/5 dark:text-neutral-400">
                        {preview}
                    </span>
                )}
            </div>
            <Input
                id={id}
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className="h-11 rounded-xl text-sm settings-input focus:ring-2 focus:ring-[#2e3f84]/30"
            />
            <InputError message={error} />
        </div>
    );
}

export default function SettingsIndex({ settings, advisors }: SettingsIndexProps) {
    const { t } = useTranslation();
    const [testingConnection, setTestingConnection] = useState(false);
    const [loadingProfile, setLoadingProfile] = useState(false);
    const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
    const [advisorSearch, setAdvisorSearch] = useState('');
    const [connectionStatus, setConnectionStatus] = useState<{
        type: 'success' | 'error' | null;
        message: string;
    }>({ type: null, message: '' });

    const [selectedAdvisors, setSelectedAdvisors] = useState<number[]>(
        advisors.filter((advisor) => advisor.is_on_duty).map((advisor) => advisor.id)
    );
    const [savingAdvisors, setSavingAdvisors] = useState(false);

    const whatsappForm = useForm({
        whatsapp_token: '',
        whatsapp_phone_id: settings.whatsapp.phone_id || '',
        whatsapp_business_account_id: settings.whatsapp.business_account_id || '',
        whatsapp_verify_token: '',
    });

    const groqForm = useForm({
        groq_api_key: '',
    });

    const filteredAdvisors = useMemo(() => {
        const searchTerm = advisorSearch.trim().toLowerCase();

        if (!searchTerm) {
            return advisors;
        }

        return advisors.filter((advisor) => `${advisor.name} ${advisor.email}`.toLowerCase().includes(searchTerm));
    }, [advisorSearch, advisors]);

    const handleWhatsAppSubmit = (event: FormEvent) => {
        event.preventDefault();
        whatsappForm.post('/admin/settings/whatsapp', {
            preserveScroll: true,
            onSuccess: () => {
                whatsappForm.reset('whatsapp_token', 'whatsapp_verify_token');
                toast.success(t('settings.whatsapp.savedSuccess'));
            },
            onError: () => toast.error(t('settings.saveError')),
        });
    };

    const handleGroqSubmit = (event: FormEvent) => {
        event.preventDefault();
        groqForm.post('/admin/settings/groq', {
            preserveScroll: true,
            onSuccess: () => {
                groqForm.reset('groq_api_key');
                toast.success(t('settings.groq.savedSuccess'));
            },
            onError: () => toast.error(t('settings.saveError')),
        });
    };

    const testConnection = async () => {
        setTestingConnection(true);
        setConnectionStatus({ type: null, message: '' });

        try {
            // axios usa el token CSRF VIVO de la cookie (el <meta> queda obsoleto tras login por
            // Inertia) y el interceptor global reintenta ante 419. validateStatus deja pasar 4xx/5xx
            // sin lanzar para conservar el manejo del JSON de negocio ({ success, message }).
            const response = await axios.post('/admin/settings/test-whatsapp', null, {
                validateStatus: (status) => status !== 419,
            });

            const data = response.data;

            setConnectionStatus({
                type: data.success ? 'success' : 'error',
                message: data.message,
            });
        } catch {
            setConnectionStatus({
                type: 'error',
                message: t('settings.whatsapp.connectionError'),
            });
        } finally {
            setTestingConnection(false);
        }
    };

    const toggleAdvisor = (advisorId: number) => {
        setSelectedAdvisors((currentAdvisors) =>
            currentAdvisors.includes(advisorId)
                ? currentAdvisors.filter((currentAdvisorId) => currentAdvisorId !== advisorId)
                : [...currentAdvisors, advisorId]
        );
    };

    const saveOnDutyAdvisors = () => {
        setSavingAdvisors(true);
        router.post('/admin/settings/on-duty-advisors', {
            advisor_ids: selectedAdvisors,
        }, {
            preserveScroll: true,
            onFinish: () => setSavingAdvisors(false),
            onSuccess: () => toast.success(t('settings.onDutyAdvisors.savedSuccess')),
            onError: () => toast.error(t('settings.onDutyAdvisors.saveError')),
        });
    };

    const getBusinessProfile = async () => {
        setLoadingProfile(true);

        try {
            const response = await fetch('/admin/settings/business-profile', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();

            if (data.success) {
                setBusinessProfile(data.profile);
            } else {
                setConnectionStatus({
                    type: 'error',
                    message: data.message || t('settings.whatsapp.profileFetchFailed'),
                });
            }
        } catch {
            setConnectionStatus({
                type: 'error',
                message: t('settings.whatsapp.profileFetchError'),
            });
        } finally {
            setLoadingProfile(false);
        }
    };

    return (
        <AdminLayout>
            <Head title={t('settings.whatsapp.title')} />

            <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
                <div className="mx-auto flex max-w-7xl flex-col gap-5">
                    <header className="flex items-start gap-3">
                        <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#d4d8e8] bg-white/70 text-[#2e3f84] shadow-sm shadow-[#2e3f84]/5 dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-100">
                            <SlidersHorizontal className="h-5 w-5" />
                        </div>
                        <div>
                            <h1 className="font-bold settings-title" style={{ fontSize: 'var(--text-3xl)' }}>
                                {t('settings.whatsapp.title')}
                            </h1>
                            <p className="settings-subtitle" style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-xs)' }}>
                                {t('settings.whatsapp.subtitle')}
                            </p>
                        </div>
                    </header>

                    <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <StatusTile
                            icon={MessageCircle}
                            title="WhatsApp"
                            value={settings.whatsapp.is_configured ? t('settings.whatsapp.connected') : t('settings.pending')}
                            detail={settings.whatsapp.phone_id || t('settings.whatsapp.noPhoneId')}
                            active={settings.whatsapp.is_configured}
                        />
                        <StatusTile
                            icon={Headphones}
                            title={t('settings.audioTile.title')}
                            value={settings.groq.is_configured ? t('settings.active') : t('settings.pending')}
                            detail={t('settings.audioTile.detail')}
                            active={settings.groq.is_configured}
                        />
                        <StatusTile
                            icon={Users}
                            title={t('settings.shiftsTile.title')}
                            value={`${selectedAdvisors.length}/${advisors.length}`}
                            detail={t('settings.shiftsTile.detail')}
                            active={selectedAdvisors.length > 0}
                        />
                    </section>

                    <form onSubmit={handleWhatsAppSubmit} className="card-gradient rounded-2xl border border-white/40 p-5 shadow-lg shadow-[#2e3f84]/5 dark:border-white/10 md:p-6">
                        <SectionHeader
                            icon={MessageCircle}
                            title={t('settings.whatsapp.apiTitle')}
                            subtitle={t('settings.whatsapp.configureConnection')}
                            active={settings.whatsapp.is_configured}
                            activeLabel={t('settings.configured')}
                            inactiveLabel={t('settings.whatsapp.requiresData')}
                            actions={settings.whatsapp.is_configured && (
                                <>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={testConnection}
                                        disabled={testingConnection}
                                        className="h-9 rounded-xl px-5 text-xs font-semibold settings-btn-secondary"
                                    >
                                        {testingConnection ? (
                                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <PlugZap className="mr-2 h-3.5 w-3.5" />
                                        )}
                                        {testingConnection ? t('settings.whatsapp.testing') : t('settings.whatsapp.testConnection')}
                                    </Button>

                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={getBusinessProfile}
                                        disabled={loadingProfile}
                                        className="h-9 rounded-xl px-5 text-xs font-semibold settings-btn-secondary disabled:opacity-50"
                                    >
                                        {loadingProfile ? (
                                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                            <Building2 className="mr-2 h-3.5 w-3.5" />
                                        )}
                                        {t('settings.whatsapp.profileButton')}
                                    </Button>
                                </>
                            )}
                        />

                        <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
                            <section>
                                <h3 className="text-[15px] font-bold settings-title">{t('settings.whatsapp.credentialsTitle')}</h3>
                                <p className="mt-1 text-[13px] settings-subtitle">{t('settings.whatsapp.credentialsSubtitle')}</p>
                                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <CredentialInput
                                        id="whatsapp_token"
                                        label={t('settings.whatsapp.accessToken')}
                                        icon={KeyRound}
                                        type="password"
                                        value={whatsappForm.data.whatsapp_token}
                                        onChange={(value) => whatsappForm.setData('whatsapp_token', value)}
                                        placeholder={settings.whatsapp.token ? t('settings.whatsapp.updateToken') : t('settings.whatsapp.accessTokenPlaceholder')}
                                        preview={settings.whatsapp.token}
                                        error={whatsappForm.errors.whatsapp_token}
                                    />

                                    <CredentialInput
                                        id="whatsapp_verify_token"
                                        label={t('settings.whatsapp.verifyToken')}
                                        icon={ShieldCheck}
                                        type="password"
                                        value={whatsappForm.data.whatsapp_verify_token}
                                        onChange={(value) => whatsappForm.setData('whatsapp_verify_token', value)}
                                        placeholder={settings.whatsapp.verify_token ? t('settings.whatsapp.update') : t('settings.whatsapp.verifyTokenPlaceholder')}
                                        preview={settings.whatsapp.verify_token}
                                        error={whatsappForm.errors.whatsapp_verify_token}
                                    />
                                </div>
                            </section>

                            <section className="border-t border-[#d4d8e8]/70 pt-6 dark:border-white/10 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                                <h3 className="text-[15px] font-bold settings-title">{t('settings.whatsapp.identifiersTitle')}</h3>
                                <p className="mt-1 text-[13px] settings-subtitle">{t('settings.whatsapp.identifiersSubtitle')}</p>
                                <div className="mt-4 space-y-4">
                                    <CredentialInput
                                        id="whatsapp_phone_id"
                                        label={t('settings.whatsapp.phoneId')}
                                        icon={Phone}
                                        value={whatsappForm.data.whatsapp_phone_id}
                                        onChange={(value) => whatsappForm.setData('whatsapp_phone_id', value)}
                                        placeholder={t('settings.whatsapp.phoneIdPlaceholder')}
                                        error={whatsappForm.errors.whatsapp_phone_id}
                                    />

                                    <CredentialInput
                                        id="whatsapp_business_account_id"
                                        label={t('settings.whatsapp.businessAccountId')}
                                        icon={Building2}
                                        value={whatsappForm.data.whatsapp_business_account_id}
                                        onChange={(value) => whatsappForm.setData('whatsapp_business_account_id', value)}
                                        placeholder={t('settings.whatsapp.businessAccountIdPlaceholder')}
                                        error={whatsappForm.errors.whatsapp_business_account_id}
                                    />
                                </div>
                            </section>
                        </div>

                        {settings.whatsapp.webhook_url && (
                            <div className="mt-5 rounded-xl border border-[#d4d8e8]/80 bg-white/55 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
                                <div className="flex items-center gap-2 text-xs font-semibold settings-label">
                                    <ShieldCheck className="h-4 w-4" />
                                    Webhook URL
                                </div>
                                <p className="mt-2 break-all font-mono text-xs settings-title">{settings.whatsapp.webhook_url}</p>
                            </div>
                        )}

                        {connectionStatus.type && (
                            <div
                                className={cn(
                                    'mt-5 flex items-start gap-2 rounded-xl border px-4 py-3 text-xs font-medium shadow-sm',
                                    connectionStatus.type === 'success'
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
                                        : 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300'
                                )}
                            >
                                {connectionStatus.type === 'success' ? (
                                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                                ) : (
                                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                )}
                                <span>{connectionStatus.message}</span>
                            </div>
                        )}

                        {businessProfile && (
                            <div className="mt-5 rounded-xl border border-[#d4d8e8]/80 bg-white/55 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                                <div className="mb-4 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <Building2 className="h-4 w-4 text-[#2e3f84] dark:text-neutral-100" />
                                        <h3 className="text-sm font-bold settings-title">WhatsApp Business Profile</h3>
                                    </div>
                                    <StatusPill active={businessProfile.verified} activeLabel={t('settings.whatsapp.verified')} inactiveLabel={t('settings.whatsapp.notVerified')} />
                                </div>
                                <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
                                    {[
                                        [t('settings.whatsapp.profileName'), businessProfile.business_name],
                                        [t('settings.whatsapp.profilePhone'), businessProfile.phone_number],
                                        ['Phone ID', businessProfile.phone_number_id],
                                        [t('settings.whatsapp.profileQuality'), businessProfile.quality_rating],
                                        [t('settings.whatsapp.profileMessagingLimit'), businessProfile.messaging_limit],
                                    ].map(([label, value]) => (
                                        <div key={label} className="min-w-0 rounded-xl bg-[#f4f5f9]/70 px-3 py-2 dark:bg-white/[0.04]">
                                            <p className="text-[10px] font-semibold uppercase tracking-normal settings-subtitle">{label}</p>
                                            <p className="truncate font-semibold settings-title">{value}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="mt-5 flex flex-wrap gap-3 border-t border-[#d4d8e8]/80 pt-5 dark:border-white/10">
                            <Button
                                type="submit"
                                disabled={whatsappForm.processing}
                                className="h-9 rounded-xl px-5 text-xs font-semibold settings-btn-primary disabled:opacity-50"
                            >
                                {whatsappForm.processing ? (
                                    <>
                                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                        {t('common.saving')}
                                    </>
                                ) : (
                                    <>
                                        <Check className="mr-2 h-3.5 w-3.5" />
                                        {t('common.save')}
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>

                    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[2fr_3fr]">
                        <form onSubmit={handleGroqSubmit} className="card-gradient rounded-2xl border border-white/40 p-5 shadow-lg shadow-[#2e3f84]/5 dark:border-white/10">
                            <SectionHeader
                                icon={Headphones}
                                title={t('settings.groq.title')}
                                subtitle={t('settings.groq.subtitle')}
                                active={settings.groq.is_configured}
                                activeLabel={t('settings.active')}
                                inactiveLabel={t('settings.pending')}
                            />

                            <div className="mt-5">
                                <CredentialInput
                                    id="groq_api_key"
                                    label={t('settings.groq.apiKeyLabel')}
                                    icon={KeyRound}
                                    type="password"
                                    value={groqForm.data.groq_api_key}
                                    onChange={(value) => groqForm.setData('groq_api_key', value)}
                                    placeholder={settings.groq.api_key ? t('settings.groq.updateApiKeyPlaceholder') : 'gsk_xxxxx...'}
                                    preview={settings.groq.api_key}
                                    error={groqForm.errors.groq_api_key}
                                />
                            </div>

                            <Button
                                type="submit"
                                disabled={groqForm.processing || !groqForm.data.groq_api_key}
                                className="mt-5 h-9 w-full rounded-xl text-xs font-semibold settings-btn-primary disabled:opacity-50"
                            >
                                {groqForm.processing ? (
                                    <>
                                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                        {t('common.saving')}
                                    </>
                                ) : (
                                    <>
                                        <Check className="mr-2 h-3.5 w-3.5" />
                                        {t('settings.saveConfiguration')}
                                    </>
                                )}
                            </Button>
                        </form>

                        <section className="card-gradient rounded-2xl border border-white/40 p-5 shadow-lg shadow-[#2e3f84]/5 dark:border-white/10">
                            <SectionHeader
                                icon={Users}
                                title={t('settings.onDutyAdvisors.title')}
                                subtitle={t('settings.onDutyAdvisors.subtitle')}
                                active={selectedAdvisors.length > 0}
                                activeLabel={`${selectedAdvisors.length}/${advisors.length}`}
                                inactiveLabel={t('settings.onDutyAdvisors.noneSelected')}
                            />

                            <div className="relative mt-4">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 settings-subtitle" />
                                <Input
                                    value={advisorSearch}
                                    onChange={(event) => setAdvisorSearch(event.target.value)}
                                    placeholder={t('settings.onDutyAdvisors.searchPlaceholder')}
                                    className="h-10 rounded-xl pl-9 pr-9 text-xs settings-input focus:ring-2 focus:ring-[#2e3f84]/30"
                                />
                                {advisorSearch && (
                                    <button
                                        type="button"
                                        onClick={() => setAdvisorSearch('')}
                                        className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[#6b7494] transition-colors hover:bg-black/5 hover:text-[#2e3f84] dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-neutral-100"
                                        aria-label={t('common.clearSearch')}
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>

                            {advisors.length === 0 ? (
                                <div className="py-6 text-center settings-subtitle">
                                    <Users className="mx-auto mb-3 h-8 w-8 opacity-50" />
                                    <p className="text-sm font-semibold settings-title">{t('settings.onDutyAdvisors.emptyTitle')}</p>
                                    <p className="mt-1 text-xs">{t('settings.onDutyAdvisors.emptyDescription')}</p>
                                </div>
                            ) : (
                                <>
                                    <div className="mt-3 grid max-h-[220px] grid-cols-1 gap-2 overflow-y-auto pr-1 custom-scrollbar-light xl:grid-cols-2">
                                        {filteredAdvisors.length === 0 ? (
                                            <div className="rounded-xl border border-dashed border-[#d4d8e8] px-4 py-6 text-center text-xs settings-subtitle dark:border-white/10 xl:col-span-2">
                                                {t('settings.onDutyAdvisors.noResults')}
                                            </div>
                                        ) : (
                                            filteredAdvisors.map((advisor) => {
                                                const selected = selectedAdvisors.includes(advisor.id);

                                                return (
                                                    <button
                                                        key={advisor.id}
                                                        type="button"
                                                        onClick={() => toggleAdvisor(advisor.id)}
                                                        aria-pressed={selected}
                                                        className={cn(
                                                            'flex w-full items-center justify-between gap-3 rounded-xl border p-2.5 text-left transition-all duration-200',
                                                            selected
                                                                ? 'border-[#2e3f84]/25 bg-[#2e3f84]/5 shadow-sm dark:border-white/15 dark:bg-white/[0.06]'
                                                                : 'border-transparent bg-transparent hover:border-[#d4d8e8] hover:bg-white/70 dark:hover:border-white/10 dark:hover:bg-white/[0.04]'
                                                        )}
                                                    >
                                                        <div className="flex min-w-0 items-center gap-3">
                                                            <div
                                                                className={cn(
                                                                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold',
                                                                    selected
                                                                        ? 'bg-[#2e3f84] text-white shadow-sm shadow-[#2e3f84]/20'
                                                                        : 'bg-[#eef1f8] text-[#2e3f84] dark:bg-white/10 dark:text-neutral-100'
                                                                )}
                                                            >
                                                                {advisor.name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="truncate text-xs font-semibold advisor-name">{advisor.name}</p>
                                                                <p className="truncate text-[11px] advisor-email">{advisor.email}</p>
                                                            </div>
                                                        </div>
                                                        <div
                                                            className={cn(
                                                                'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors',
                                                                selected
                                                                    ? 'border-[#2e3f84] bg-[#2e3f84] text-white dark:border-white/20 dark:bg-white/20'
                                                                    : 'border-[#c8cde0] bg-white/80 dark:border-white/10 dark:bg-white/[0.04]'
                                                            )}
                                                        >
                                                            {selected && <Check className="h-3.5 w-3.5" />}
                                                        </div>
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>

                                    <div className="mt-4 flex flex-col gap-3 border-t border-[#d4d8e8]/80 pt-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                                        <p className="rounded-md border border-[#d4d8e8] bg-white/70 px-2.5 py-1 text-[11px] font-semibold settings-subtitle dark:border-white/10 dark:bg-white/[0.04]">
                                            {t('settings.onDutyAdvisors.selectedCount', { count: selectedAdvisors.length })}
                                        </p>
                                        <Button
                                            type="button"
                                            onClick={saveOnDutyAdvisors}
                                            disabled={savingAdvisors}
                                            className="h-9 rounded-xl px-5 text-xs font-semibold settings-btn-primary disabled:opacity-50"
                                        >
                                            {savingAdvisors ? (
                                                <>
                                                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                                    {t('common.saving')}
                                                </>
                                            ) : (
                                                <>
                                                    <Check className="mr-2 h-3.5 w-3.5" />
                                                    {t('common.saveChanges')}
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </>
                            )}
                        </section>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
