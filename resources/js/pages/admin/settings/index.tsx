import { Head, useForm, router } from '@inertiajs/react';
import AdminLayout from '@/layouts/admin-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, AlertCircle, Loader2, Users, Check } from 'lucide-react';
import InputError from '@/components/input-error';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

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

export default function SettingsIndex({ settings, advisors }: SettingsIndexProps) {
    const { t } = useTranslation();
    const [testingConnection, setTestingConnection] = useState(false);
    const [loadingProfile, setLoadingProfile] = useState(false);
    const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<{
        type: 'success' | 'error' | null;
        message: string;
    }>({ type: null, message: '' });

    // Estado para asesores de turno
    const [selectedAdvisors, setSelectedAdvisors] = useState<number[]>(
        advisors.filter(a => a.is_on_duty).map(a => a.id)
    );
    const [savingAdvisors, setSavingAdvisors] = useState(false);

    // Formulario de WhatsApp
    const whatsappForm = useForm({
        whatsapp_token: '',
        whatsapp_phone_id: settings.whatsapp.phone_id || '',
        whatsapp_business_account_id: settings.whatsapp.business_account_id || '',
        whatsapp_verify_token: '',
    });

    // Formulario de Groq
    const groqForm = useForm({
        groq_api_key: '',
    });

    const handleWhatsAppSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        whatsappForm.post('/admin/settings/whatsapp', {
            preserveScroll: true,
            onSuccess: () => {
                whatsappForm.reset('whatsapp_token', 'whatsapp_verify_token');
            },
        });
    };

    const handleGroqSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        groqForm.post('/admin/settings/groq', {
            preserveScroll: true,
            onSuccess: () => {
                groqForm.reset('groq_api_key');
            },
        });
    };

    const testConnection = async () => {
        setTestingConnection(true);
        setConnectionStatus({ type: null, message: '' });

        try {
            const response = await fetch('/admin/settings/test-whatsapp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
            });

            const data = await response.json();

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

    // Toggle asesor de turno
    const toggleAdvisor = (advisorId: number) => {
        setSelectedAdvisors(prev =>
            prev.includes(advisorId)
                ? prev.filter(id => id !== advisorId)
                : [...prev, advisorId]
        );
    };

    // Guardar asesores de turno
    const saveOnDutyAdvisors = () => {
        setSavingAdvisors(true);
        router.post('/admin/settings/on-duty-advisors', {
            advisor_ids: selectedAdvisors,
        }, {
            preserveScroll: true,
            onFinish: () => setSavingAdvisors(false),
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
                    message: data.message || 'Unable to fetch business profile',
                });
            }
        } catch (error) {
            setConnectionStatus({
                type: 'error',
                message: 'Error fetching business profile',
            });
        } finally {
            setLoadingProfile(false);
        }
    };

    return (
        <AdminLayout>
            <Head title={t('settings.whatsapp.title')} />

            <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="mb-6">
                        <h1 className="font-bold settings-title" style={{ fontSize: 'var(--text-3xl)' }}>
                            {t('settings.whatsapp.title')}
                        </h1>
                        <p className="settings-subtitle" style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-xs)' }}>
                            {t('settings.whatsapp.subtitle')}
                        </p>
                    </div>

                    {/* Layout para WhatsApp Config */}
                    <div className="max-w-5xl mx-auto">

                        {/* WhatsApp Config */}
                        <div>
                            <form onSubmit={handleWhatsAppSubmit} className="card-gradient rounded-2xl border border-white/40 dark:border-white/10 shadow-lg shadow-[#2e3f84]/5 p-4 md:p-8 h-full transition-all duration-300 hover:shadow-xl hover:shadow-[#2e3f84]/10">
                                <div className="mb-6">
                                    <h2 className="text-xl md:text-2xl font-bold settings-title">{t('settings.whatsapp.apiTitle')}</h2>
                                    <p className="text-xs md:text-sm settings-subtitle mt-1">
                                        {t('settings.whatsapp.configureConnection')}
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Token de Acceso */}
                                    <div className="space-y-2">
                                        <Label htmlFor="whatsapp_token" className="text-xs md:text-sm font-medium settings-label">
                                            {t('settings.whatsapp.accessToken')}
                                        </Label>
                                        {settings.whatsapp.token && (
                                            <div className="px-3 py-1.5 token-preview rounded-lg bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                                                <p className="text-xs text-muted-foreground truncate font-mono">●●●●{settings.whatsapp.token.slice(-4)}</p>
                                            </div>
                                        )}
                                        <Input
                                            id="whatsapp_token"
                                            type="password"
                                            value={whatsappForm.data.whatsapp_token}
                                            onChange={(e) => whatsappForm.setData('whatsapp_token', e.target.value)}
                                            placeholder={settings.whatsapp.token ? t('settings.whatsapp.updateToken') : t('settings.whatsapp.accessTokenPlaceholder')}
                                            className="settings-input rounded-xl border-gray-200 dark:border-gray-800 font-mono text-xs md:text-sm focus:ring-2 focus:ring-[#2e3f84]/30"
                                        />
                                        <InputError message={whatsappForm.errors.whatsapp_token} />
                                    </div>

                                    {/* ID del Teléfono */}
                                    <div className="space-y-2">
                                        <Label htmlFor="whatsapp_phone_id" className="text-xs md:text-sm font-medium settings-label">
                                            {t('settings.whatsapp.phoneId')}
                                        </Label>
                                        <Input
                                            id="whatsapp_phone_id"
                                            type="text"
                                            value={whatsappForm.data.whatsapp_phone_id}
                                            onChange={(e) => whatsappForm.setData('whatsapp_phone_id', e.target.value)}
                                            placeholder={t('settings.whatsapp.phoneIdPlaceholder')}
                                            className="settings-input rounded-xl border-gray-200 dark:border-gray-800 text-xs md:text-sm focus:ring-2 focus:ring-[#2e3f84]/30"
                                        />
                                        <InputError message={whatsappForm.errors.whatsapp_phone_id} />
                                    </div>

                                    {/* ID de Cuenta de Negocio */}
                                    <div className="space-y-2">
                                        <Label htmlFor="whatsapp_business_account_id" className="text-xs md:text-sm font-medium settings-label">
                                            {t('settings.whatsapp.businessAccountId')}
                                        </Label>
                                        <Input
                                            id="whatsapp_business_account_id"
                                            type="text"
                                            value={whatsappForm.data.whatsapp_business_account_id}
                                            onChange={(e) => whatsappForm.setData('whatsapp_business_account_id', e.target.value)}
                                            placeholder={t('settings.whatsapp.businessAccountIdPlaceholder')}
                                            className="settings-input rounded-xl border-gray-200 dark:border-gray-800 text-xs md:text-sm focus:ring-2 focus:ring-[#2e3f84]/30"
                                        />
                                        <InputError message={whatsappForm.errors.whatsapp_business_account_id} />
                                    </div>

                                    {/* Verify Token */}
                                    <div className="space-y-2">
                                        <Label htmlFor="whatsapp_verify_token" className="text-xs md:text-sm font-medium settings-label">
                                            {t('settings.whatsapp.verifyToken')}
                                        </Label>
                                        {settings.whatsapp.verify_token && (
                                            <div className="px-3 py-1.5 token-preview rounded-lg bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                                                <p className="text-xs text-muted-foreground truncate">●●●●{settings.whatsapp.verify_token.slice(-4)}</p>
                                            </div>
                                        )}
                                        <Input
                                            id="whatsapp_verify_token"
                                            type="password"
                                            value={whatsappForm.data.whatsapp_verify_token}
                                            onChange={(e) => whatsappForm.setData('whatsapp_verify_token', e.target.value)}
                                            placeholder={settings.whatsapp.verify_token ? t('settings.whatsapp.update') : t('settings.whatsapp.verifyTokenPlaceholder')}
                                            className="settings-input rounded-xl border-gray-200 dark:border-gray-800 text-xs md:text-sm focus:ring-2 focus:ring-[#2e3f84]/30"
                                        />
                                        <InputError message={whatsappForm.errors.whatsapp_verify_token} />
                                    </div>
                                </div>

                                {/* Estado de la conexión */}
                                {connectionStatus.type && (
                                    <div className="mt-4 md:col-span-2">
                                        <div
                                            className={`flex items-center gap-2 p-3.5 rounded-xl border ${connectionStatus.type === 'success'
                                                ? 'bg-gradient-to-br from-green-50 to-green-100/50 border-green-200 text-green-700 shadow-sm'
                                                : 'bg-gradient-to-br from-red-50 to-red-100/50 border-red-200 text-red-700 shadow-sm'
                                                }`}
                                        >
                                            {connectionStatus.type === 'success' ? (
                                                <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
                                            ) : (
                                                <AlertCircle className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
                                            )}
                                            <span className="text-xs md:text-sm font-medium">{connectionStatus.message}</span>
                                        </div>
                                    </div>
                                )}

                                {/* Botones */}
                                <div className="flex flex-col sm:flex-row gap-3 md:gap-4 pt-6 mt-6 border-t border-gray-200 dark:border-gray-800 md:col-span-2">
                                    <Button
                                        type="submit"
                                        disabled={whatsappForm.processing}
                                        className="w-full sm:flex-1 settings-btn-primary rounded-xl text-sm font-medium h-11 transition-all disabled:opacity-50"
                                    >
                                        {whatsappForm.processing ? t('common.saving') : t('common.save')}
                                    </Button>

                                    {settings.whatsapp.is_configured && (
                                        <>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={testConnection}
                                                disabled={testingConnection}
                                                className="w-full sm:flex-1 settings-btn-secondary rounded-xl text-sm font-medium h-11 transition-all"
                                            >
                                                {testingConnection ? (
                                                    <>
                                                        <Loader2 className="w-3 h-3 md:w-4 md:h-4 mr-2 animate-spin" />
                                                        {t('settings.whatsapp.testing')}
                                                    </>
                                                ) : (
                                                    t('settings.whatsapp.testConnection')
                                                )}
                                            </Button>

                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={getBusinessProfile}
                                                disabled={loadingProfile}
                                                className="w-full sm:flex-1 settings-btn-secondary rounded-xl text-sm font-medium h-11 transition-all disabled:opacity-50"
                                            >
                                                {loadingProfile ? (
                                                    <>
                                                        <Loader2 className="w-3 h-3 md:w-4 md:h-4 mr-2 animate-spin" />
                                                        'Loading...'
                                                    </>
                                                ) : (
                                                    'Get business profile'
                                                )}
                                            </Button>
                                        </>
                                    )}
                                </div>

                                {/* Business Profile Info */}
                                {businessProfile && (
                                    <div className="mt-6 p-5 card-gradient rounded-xl border border-white/40 dark:border-white/10 md:col-span-2 shadow-sm">
                                        <h3 className="text-sm font-bold dark:text-[hsl(231,15%,92%)] mb-4 flex items-center gap-2" style={{ color: '#2e3f84' }}>
                                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                            WhatsApp Business Profile
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                            <div>
                                                <span className="dark:text-[hsl(231,15%,60%)] font-medium" style={{ color: '#6b7494' }}>Business name:</span>
                                                <p className="dark:text-[hsl(231,15%,92%)] font-semibold" style={{ color: '#2e3f84' }}>{businessProfile.business_name}</p>
                                            </div>
                                            <div>
                                                <span className="dark:text-[hsl(231,15%,60%)] font-medium" style={{ color: '#6b7494' }}>Phone number:</span>
                                                <p className="dark:text-[hsl(231,15%,92%)] font-semibold" style={{ color: '#2e3f84' }}>{businessProfile.phone_number}</p>
                                            </div>
                                            <div>
                                                <span className="dark:text-[hsl(231,15%,60%)] font-medium" style={{ color: '#6b7494' }}>Phone number ID:</span>
                                                <p className="dark:text-[hsl(231,15%,92%)] font-semibold font-mono" style={{ color: '#2e3f84' }}>{businessProfile.phone_number_id}</p>
                                            </div>
                                            <div>
                                                <span className="dark:text-[hsl(231,15%,60%)] font-medium" style={{ color: '#6b7494' }}>Verified:</span>
                                                <p className={`font-semibold ${businessProfile.verified ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                                                    {businessProfile.verified ? '✓ Verified' : 'Not verified'}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="dark:text-[hsl(231,15%,60%)] font-medium" style={{ color: '#6b7494' }}>Quality rating:</span>
                                                <p className="dark:text-[hsl(231,15%,92%)] font-semibold" style={{ color: '#2e3f84' }}>{businessProfile.quality_rating}</p>
                                            </div>
                                            <div>
                                                <span className="dark:text-[hsl(231,15%,60%)] font-medium" style={{ color: '#6b7494' }}>Messaging limit:</span>
                                                <p className="dark:text-[hsl(231,15%,92%)] font-semibold" style={{ color: '#2e3f84' }}>{businessProfile.messaging_limit}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </form>
                        </div>

                        {/* Groq Transcription Config */}
                        <div className="mt-6 md:mt-8">
                            <form onSubmit={handleGroqSubmit} className="card-gradient rounded-2xl border border-white/40 dark:border-white/10 shadow-lg shadow-[#2e3f84]/5 p-4 md:p-8 transition-all duration-300 hover:shadow-xl hover:shadow-[#2e3f84]/10">
                                <div className="mb-6">
                                    <h2 className="text-lg md:text-xl font-semibold dark:text-[hsl(231,15%,92%)]" style={{ color: '#2e3f84' }}>🎙️ Transcripción de Audio (Groq)</h2>
                                    <p className="text-xs md:text-sm dark:text-[hsl(231,15%,60%)] mt-1" style={{ color: '#6b7494' }}>
                                        Configura Groq para transcribir automáticamente los audios que envían los clientes.
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    {/* Status indicator */}
                                    <div className="flex items-center gap-2">
                                        {settings.groq.is_configured ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 status-configured text-xs font-medium rounded">
                                                <CheckCircle2 className="w-3 h-3" />
                                                Configurado
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-1 status-not-configured text-xs font-medium rounded">
                                                <AlertCircle className="w-3 h-3" />
                                                No configurado
                                            </span>
                                        )}
                                    </div>

                                    {/* API Key */}
                                    <div className="space-y-2">
                                        <Label htmlFor="groq_api_key" className="text-xs md:text-sm font-medium dark:text-[hsl(231,15%,92%)]" style={{ color: '#2e3f84' }}>
                                            API Key de Groq
                                        </Label>
                                        {settings.groq.api_key && (
                                            <div className="px-3 py-1.5 token-preview rounded-lg bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                                                <p className="text-xs text-muted-foreground truncate font-mono">●●●●{settings.groq.api_key.slice(-4)}</p>
                                            </div>
                                        )}
                                        <Input
                                            id="groq_api_key"
                                            type="password"
                                            value={groqForm.data.groq_api_key}
                                            onChange={(e) => groqForm.setData('groq_api_key', e.target.value)}
                                            placeholder={settings.groq.api_key ? 'Actualizar API Key...' : 'gsk_xxxxx...'}
                                            className="settings-input rounded-xl border-gray-200 dark:border-gray-800 font-mono text-xs md:text-sm focus:ring-2 focus:ring-[#2e3f84]/30"
                                        />
                                        <InputError message={groqForm.errors.groq_api_key} />
                                    </div>


                                    <Button
                                        type="submit"
                                        disabled={groqForm.processing || !groqForm.data.groq_api_key}
                                        className="w-full sm:w-auto mt-4 px-6 h-11 settings-btn-primary rounded-xl text-sm font-medium disabled:opacity-50 transition-all"
                                    >
                                        {groqForm.processing ? (
                                            <>
                                                <Loader2 className="w-3 h-3 md:w-4 md:h-4 mr-2 animate-spin" />
                                                Guardando...
                                            </>
                                        ) : (
                                            'Guardar configuración'
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </div>

                        {/* Asesores de Turno */}
                        <div className="mt-6 md:mt-8 mb-10">
                            <div className="card-gradient rounded-2xl border border-white/40 dark:border-white/10 shadow-lg shadow-[#2e3f84]/5 dark:shadow-[0_1px_2px_rgba(0,0,0,0.2),0_2px_6px_rgba(0,0,0,0.15)] p-4 md:p-8 transition-all duration-300 hover:shadow-xl hover:shadow-[#2e3f84]/10">
                                <div className="mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 rounded-xl bg-[#2e3f84]/10 text-[#2e3f84] dark:bg-white/10 dark:text-white">
                                            <Users className="w-6 h-6" />
                                        </div>
                                        <h2 className="text-xl md:text-2xl font-bold settings-title">Asesores de turno</h2>
                                    </div>
                                    <p className="text-xs md:text-sm settings-subtitle mt-1">
                                        Selecciona los asesores que recibirán todas las conversaciones. Útil para rotación semanal de turnos.
                                    </p>
                                </div>

                                {advisors.length === 0 ? (
                                    <div className="text-center py-8 settings-subtitle">
                                        <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                        <p className="text-sm">No hay asesores registrados</p>
                                        <p className="text-xs mt-1">Crea asesores en la sección de Usuarios</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                                            {advisors.map((advisor) => (
                                                <button
                                                    key={advisor.id}
                                                    type="button"
                                                    onClick={() => toggleAdvisor(advisor.id)}
                                                    className={`w-full flex items-center justify-between p-3.5 mb-2 rounded-xl border transition-all duration-200 ${selectedAdvisors.includes(advisor.id)
                                                        ? 'bg-[#2e3f84]/5 border-[#2e3f84]/20 shadow-sm'
                                                        : 'bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:border-gray-200 dark:hover:border-gray-700'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${selectedAdvisors.includes(advisor.id)
                                                                ? 'advisor-avatar-selected'
                                                                : 'advisor-avatar'
                                                                }`}
                                                        >
                                                            {advisor.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="text-left">
                                                            <p className="text-sm font-medium advisor-name">{advisor.name}</p>
                                                            <p className="text-xs advisor-email">{advisor.email}</p>
                                                        </div>
                                                    </div>
                                                    <div
                                                        className={`w-6 h-6 rounded-full flex items-center justify-center ${selectedAdvisors.includes(advisor.id)
                                                            ? 'advisor-check-selected'
                                                            : 'advisor-check'
                                                            }`}
                                                    >
                                                        {selectedAdvisors.includes(advisor.id) && (
                                                            <Check className="w-4 h-4" />
                                                        )}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>

                                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 mt-6 border-t border-gray-200 dark:border-gray-800">
                                            <p className="text-sm font-medium text-muted-foreground bg-gray-100 dark:bg-gray-800/50 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700">
                                                {selectedAdvisors.length} de {advisors.length} asesor{advisors.length !== 1 ? 'es' : ''} seleccionado{selectedAdvisors.length !== 1 ? 's' : ''}
                                            </p>
                                            <Button
                                                type="button"
                                                onClick={saveOnDutyAdvisors}
                                                disabled={savingAdvisors}
                                                className="w-full sm:w-auto min-w-[160px] h-11 settings-btn-primary rounded-xl text-sm font-medium disabled:opacity-50 transition-all"
                                            >
                                                {savingAdvisors ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                        Guardando...
                                                    </>
                                                ) : (
                                                    'Guardar cambios'
                                                )}
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
