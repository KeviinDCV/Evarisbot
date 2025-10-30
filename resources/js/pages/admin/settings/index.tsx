import { Head, useForm, router } from '@inertiajs/react';
import AdminLayout from '@/layouts/admin-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import InputError from '@/components/input-error';
import { useState } from 'react';
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
}

interface SettingsIndexProps {
    settings: Settings;
}

export default function SettingsIndex({ settings }: SettingsIndexProps) {
    const { t } = useTranslation();
    const [testingConnection, setTestingConnection] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<{
        type: 'success' | 'error' | null;
        message: string;
    }>({ type: null, message: '' });

    // Formulario de WhatsApp
    const whatsappForm = useForm({
        whatsapp_token: '',
        whatsapp_phone_id: settings.whatsapp.phone_id || '',
        whatsapp_business_account_id: settings.whatsapp.business_account_id || '',
        whatsapp_verify_token: '',
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

    return (
        <AdminLayout>
            <Head title={t('settings.whatsapp.title')} />

            <div className="min-h-screen bg-[#f0f2f8] p-4 md:p-6 lg:p-8">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="mb-6">
                        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-[#2e3f84]">{t('settings.whatsapp.title')}</h1>
                        <p className="text-sm md:text-base text-[#6b7494] mt-1">{t('settings.whatsapp.subtitle')}</p>
                    </div>

                    {/* Layout para WhatsApp Config */}
                    <div className="max-w-5xl">

                        {/* WhatsApp Config */}
                        <div>
                            <form onSubmit={handleWhatsAppSubmit} className="bg-gradient-to-b from-white to-[#fafbfc] rounded-2xl shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_6px_rgba(46,63,132,0.06),0_6px_16px_rgba(46,63,132,0.1),inset_0_1px_0_rgba(255,255,255,0.95)] p-4 md:p-6 h-full">
                                <div className="mb-4">
                                    <h2 className="text-lg md:text-xl font-semibold text-[#2e3f84]">{t('settings.whatsapp.apiTitle')}</h2>
                                    <p className="text-xs md:text-sm text-[#6b7494] mt-1">
                                        {t('settings.whatsapp.configureConnection')}
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Token de Acceso */}
                                    <div className="space-y-2">
                                        <Label htmlFor="whatsapp_token" className="text-xs md:text-sm font-medium text-[#2e3f84] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">
                                            {t('settings.whatsapp.accessToken')}
                                        </Label>
                                        {settings.whatsapp.token && (
                                            <div className="px-2 py-1 bg-gradient-to-b from-[#e8ebf5] to-[#dde1f0] rounded-lg">
                                                <p className="text-xs text-[#6b7494] truncate font-mono">●●●●{settings.whatsapp.token.slice(-4)}</p>
                                            </div>
                                        )}
                                        <Input
                                            id="whatsapp_token"
                                            type="password"
                                            value={whatsappForm.data.whatsapp_token}
                                            onChange={(e) => whatsappForm.setData('whatsapp_token', e.target.value)}
                                            placeholder={settings.whatsapp.token ? t('settings.whatsapp.updateToken') : t('settings.whatsapp.accessTokenPlaceholder')}
                                            className="border-0 bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] focus:from-white focus:to-[#fafbfc] shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_3px_rgba(46,63,132,0.06),inset_0_1px_0_rgba(255,255,255,0.6)] focus:shadow-[0_1px_3px_rgba(46,63,132,0.08),0_2px_6px_rgba(46,63,132,0.1),0_4px_12px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.06),0_3px_8px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] rounded-xl transition-all duration-200 font-mono text-xs md:text-sm"
                                        />
                                        <InputError message={whatsappForm.errors.whatsapp_token} />
                                    </div>

                                    {/* ID del Teléfono */}
                                    <div className="space-y-2">
                                        <Label htmlFor="whatsapp_phone_id" className="text-xs md:text-sm font-medium text-[#2e3f84] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">
                                            {t('settings.whatsapp.phoneId')}
                                        </Label>
                                        <Input
                                            id="whatsapp_phone_id"
                                            type="text"
                                            value={whatsappForm.data.whatsapp_phone_id}
                                            onChange={(e) => whatsappForm.setData('whatsapp_phone_id', e.target.value)}
                                            placeholder={t('settings.whatsapp.phoneIdPlaceholder')}
                                            className="border-0 bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] focus:from-white focus:to-[#fafbfc] shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_3px_rgba(46,63,132,0.06),inset_0_1px_0_rgba(255,255,255,0.6)] focus:shadow-[0_1px_3px_rgba(46,63,132,0.08),0_2px_6px_rgba(46,63,132,0.1),0_4px_12px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.06),0_3px_8px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] rounded-xl transition-all duration-200 text-xs md:text-sm"
                                        />
                                        <InputError message={whatsappForm.errors.whatsapp_phone_id} />
                                    </div>

                                    {/* ID de Cuenta de Negocio */}
                                    <div className="space-y-2">
                                        <Label htmlFor="whatsapp_business_account_id" className="text-xs md:text-sm font-medium text-[#2e3f84] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">
                                            {t('settings.whatsapp.businessAccountId')}
                                        </Label>
                                        <Input
                                            id="whatsapp_business_account_id"
                                            type="text"
                                            value={whatsappForm.data.whatsapp_business_account_id}
                                            onChange={(e) => whatsappForm.setData('whatsapp_business_account_id', e.target.value)}
                                            placeholder={t('settings.whatsapp.businessAccountIdPlaceholder')}
                                            className="border-0 bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] focus:from-white focus:to-[#fafbfc] shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_3px_rgba(46,63,132,0.06),inset_0_1px_0_rgba(255,255,255,0.6)] focus:shadow-[0_1px_3px_rgba(46,63,132,0.08),0_2px_6px_rgba(46,63,132,0.1),0_4px_12px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.06),0_3px_8px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] rounded-xl transition-all duration-200 text-xs md:text-sm"
                                        />
                                        <InputError message={whatsappForm.errors.whatsapp_business_account_id} />
                                    </div>

                                    {/* Verify Token */}
                                    <div className="space-y-2">
                                        <Label htmlFor="whatsapp_verify_token" className="text-xs md:text-sm font-medium text-[#2e3f84] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">
                                            {t('settings.whatsapp.verifyToken')}
                                        </Label>
                                        {settings.whatsapp.verify_token && (
                                            <div className="px-2 py-1 bg-gradient-to-b from-[#e8ebf5] to-[#dde1f0] rounded-lg">
                                                <p className="text-xs text-[#6b7494] truncate">●●●●{settings.whatsapp.verify_token.slice(-4)}</p>
                                            </div>
                                        )}
                                        <Input
                                            id="whatsapp_verify_token"
                                            type="password"
                                            value={whatsappForm.data.whatsapp_verify_token}
                                            onChange={(e) => whatsappForm.setData('whatsapp_verify_token', e.target.value)}
                                            placeholder={settings.whatsapp.verify_token ? t('settings.whatsapp.update') : t('settings.whatsapp.verifyTokenPlaceholder')}
                                            className="border-0 bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] focus:from-white focus:to-[#fafbfc] shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_3px_rgba(46,63,132,0.06),inset_0_1px_0_rgba(255,255,255,0.6)] focus:shadow-[0_1px_3px_rgba(46,63,132,0.08),0_2px_6px_rgba(46,63,132,0.1),0_4px_12px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.06),0_3px_8px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] rounded-xl transition-all duration-200 text-xs md:text-sm"
                                        />
                                        <InputError message={whatsappForm.errors.whatsapp_verify_token} />
                                    </div>
                                </div>

                                {/* Estado de la conexión */}
                                {connectionStatus.type && (
                                    <div className="mt-4 md:col-span-2">
                                        <div
                                            className={`flex items-center gap-2 p-3 rounded-xl ${
                                                connectionStatus.type === 'success'
                                                    ? 'bg-gradient-to-b from-green-50 to-green-100/50 text-green-700 shadow-[0_1px_2px_rgba(34,197,94,0.15),0_2px_4px_rgba(34,197,94,0.1),inset_0_1px_0_rgba(255,255,255,0.6)]'
                                                    : 'bg-gradient-to-b from-red-50 to-red-100/50 text-red-700 shadow-[0_1px_2px_rgba(239,68,68,0.15),0_2px_4px_rgba(239,68,68,0.1),inset_0_1px_0_rgba(255,255,255,0.6)]'
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
                                <div className="flex flex-col sm:flex-row gap-2 md:gap-3 pt-4 mt-4 border-t border-[#e8ebf5] md:col-span-2">
                                    <Button
                                        type="submit"
                                        disabled={whatsappForm.processing}
                                        className="w-full sm:flex-1 bg-gradient-to-b from-[#3e4f94] to-[#2e3f84] hover:from-[#4e5fa4] hover:to-[#3e4f94] text-white shadow-[0_1px_2px_rgba(46,63,132,0.15),0_2px_4px_rgba(46,63,132,0.2),0_4px_12px_rgba(46,63,132,0.25),inset_0_1px_0_rgba(255,255,255,0.15)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.2),0_4px_8px_rgba(46,63,132,0.25),0_8px_20px_rgba(46,63,132,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] hover:-translate-y-0.5 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),inset_0_0_8px_rgba(0,0,0,0.1)] active:translate-y-0 transition-all duration-200 text-sm disabled:opacity-50 disabled:hover:translate-y-0"
                                    >
                                        {whatsappForm.processing ? t('common.saving') : t('common.save')}
                                    </Button>

                                    {settings.whatsapp.is_configured && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={testConnection}
                                            disabled={testingConnection}
                                            className="w-full sm:flex-1 border-0 bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] text-[#2e3f84] shadow-[0_1px_2px_rgba(46,63,132,0.06),0_2px_4px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.1),0_4px_8px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] hover:-translate-y-0.5 active:shadow-[inset_0_1px_2px_rgba(46,63,132,0.1)] active:translate-y-0 transition-all duration-200 text-sm"
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
                                    )}
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
