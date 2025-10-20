import { Head, useForm, router } from '@inertiajs/react';
import AdminLayout from '@/layouts/admin-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import InputError from '@/components/input-error';
import { useState } from 'react';

interface Settings {
    whatsapp: {
        token: string | null;
        phone_id: string | null;
        business_account_id: string | null;
        verify_token: string | null;
        webhook_url: string | null;
        is_configured: boolean;
    };
    business: {
        name: string | null;
        welcome_message: string | null;
        away_message: string | null;
        business_hours: string | null;
    };
}

interface SettingsIndexProps {
    settings: Settings;
}

export default function SettingsIndex({ settings }: SettingsIndexProps) {
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

    // Formulario de Negocio
    const businessForm = useForm({
        business_name: settings.business.name || '',
        welcome_message: settings.business.welcome_message || '',
        away_message: settings.business.away_message || '',
        business_hours: settings.business.business_hours || '',
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

    const handleBusinessSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        businessForm.post('/admin/settings/business', {
            preserveScroll: true,
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
        } catch (error) {
            setConnectionStatus({
                type: 'error',
                message: 'Error al probar la conexión',
            });
        } finally {
            setTestingConnection(false);
        }
    };

    return (
        <AdminLayout>
            <Head title="Configuración del Sistema" />

            <div className="p-8 space-y-8">
                {/* Header */}
                <div>
                    <h1 className="text-3xl font-bold text-black">Configuración del Sistema</h1>
                    <p className="text-gray-600 mt-1">Gestiona las configuraciones globales de Evarisbot</p>
                </div>

                {/* Configuración de WhatsApp */}
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                    <div className="border-b border-gray-200 p-6">
                        <h2 className="text-xl font-semibold text-black">WhatsApp Business API</h2>
                        <p className="text-sm text-gray-600 mt-1">
                            Configura la conexión con WhatsApp Business API
                        </p>
                    </div>

                    <form onSubmit={handleWhatsAppSubmit} className="p-6 space-y-6">
                        {/* Token de Acceso */}
                        <div className="space-y-2">
                            <Label htmlFor="whatsapp_token" className="text-sm font-medium text-black">
                                Token de Acceso
                            </Label>
                            {settings.whatsapp.token && (
                                <p className="text-xs text-gray-500">
                                    Token actual: <code className="bg-gray-100 px-2 py-1 rounded">{settings.whatsapp.token}</code>
                                </p>
                            )}
                            <Input
                                id="whatsapp_token"
                                type="password"
                                value={whatsappForm.data.whatsapp_token}
                                onChange={(e) => whatsappForm.setData('whatsapp_token', e.target.value)}
                                placeholder={settings.whatsapp.token ? 'Dejar vacío para mantener el actual' : 'Ej: EAABwzLixnjYBO...'}
                                className="border-0 bg-gray-100 focus:bg-gray-150 shadow-none font-mono text-sm"
                            />
                            <InputError message={whatsappForm.errors.whatsapp_token} />
                        </div>

                        {/* ID del Teléfono */}
                        <div className="space-y-2">
                            <Label htmlFor="whatsapp_phone_id" className="text-sm font-medium text-black">
                                ID del Teléfono de Negocio
                            </Label>
                            <Input
                                id="whatsapp_phone_id"
                                type="text"
                                value={whatsappForm.data.whatsapp_phone_id}
                                onChange={(e) => whatsappForm.setData('whatsapp_phone_id', e.target.value)}
                                placeholder="Ej: 123456789012345"
                                className="border-0 bg-gray-100 focus:bg-gray-150 shadow-none"
                            />
                            <InputError message={whatsappForm.errors.whatsapp_phone_id} />
                        </div>

                        {/* ID de Cuenta de Negocio */}
                        <div className="space-y-2">
                            <Label htmlFor="whatsapp_business_account_id" className="text-sm font-medium text-black">
                                ID de la Cuenta de WhatsApp Business
                            </Label>
                            <Input
                                id="whatsapp_business_account_id"
                                type="text"
                                value={whatsappForm.data.whatsapp_business_account_id}
                                onChange={(e) => whatsappForm.setData('whatsapp_business_account_id', e.target.value)}
                                placeholder="Ej: 987654321098765"
                                className="border-0 bg-gray-100 focus:bg-gray-150 shadow-none"
                            />
                            <InputError message={whatsappForm.errors.whatsapp_business_account_id} />
                        </div>

                        {/* Verify Token */}
                        <div className="space-y-2">
                            <Label htmlFor="whatsapp_verify_token" className="text-sm font-medium text-black">
                                Token de Verificación (Webhook)
                            </Label>
                            {settings.whatsapp.verify_token && (
                                <p className="text-xs text-gray-500">
                                    Token actual: <code className="bg-gray-100 px-2 py-1 rounded">{settings.whatsapp.verify_token}</code>
                                </p>
                            )}
                            <Input
                                id="whatsapp_verify_token"
                                type="password"
                                value={whatsappForm.data.whatsapp_verify_token}
                                onChange={(e) => whatsappForm.setData('whatsapp_verify_token', e.target.value)}
                                placeholder={settings.whatsapp.verify_token ? 'Dejar vacío para mantener el actual' : 'Ej: mi_token_seguro_123'}
                                className="border-0 bg-gray-100 focus:bg-gray-150 shadow-none"
                            />
                            <InputError message={whatsappForm.errors.whatsapp_verify_token} />
                        </div>

                        {/* Estado de la conexión */}
                        {connectionStatus.type && (
                            <div
                                className={`flex items-center gap-2 p-4 rounded-lg ${
                                    connectionStatus.type === 'success'
                                        ? 'bg-green-50 text-green-700'
                                        : 'bg-red-50 text-red-700'
                                }`}
                            >
                                {connectionStatus.type === 'success' ? (
                                    <CheckCircle2 className="w-5 h-5" />
                                ) : (
                                    <AlertCircle className="w-5 h-5" />
                                )}
                                <span className="text-sm">{connectionStatus.message}</span>
                            </div>
                        )}

                        {/* Botones */}
                        <div className="flex gap-3 pt-4">
                            <Button
                                type="submit"
                                disabled={whatsappForm.processing}
                                className="bg-[#2e3f84] hover:bg-[#1e2f74] text-white"
                            >
                                {whatsappForm.processing ? 'Guardando...' : 'Guardar Configuración'}
                            </Button>

                            {settings.whatsapp.is_configured && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={testConnection}
                                    disabled={testingConnection}
                                    className="border-gray-300 text-gray-700"
                                >
                                    {testingConnection ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Probando...
                                        </>
                                    ) : (
                                        'Probar Conexión'
                                    )}
                                </Button>
                            )}
                        </div>
                    </form>
                </div>

                {/* Configuración del Negocio */}
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                    <div className="border-b border-gray-200 p-6">
                        <h2 className="text-xl font-semibold text-black">Información del Negocio</h2>
                        <p className="text-sm text-gray-600 mt-1">
                            Configura mensajes automáticos y datos de tu negocio
                        </p>
                    </div>

                    <form onSubmit={handleBusinessSubmit} className="p-6 space-y-6">
                        {/* Nombre */}
                        <div className="space-y-2">
                            <Label htmlFor="business_name" className="text-sm font-medium text-black">
                                Nombre
                            </Label>
                            <Input
                                id="business_name"
                                type="text"
                                value={businessForm.data.business_name}
                                onChange={(e) => businessForm.setData('business_name', e.target.value)}
                                placeholder="Ej: Evarisbot"
                                className="border-0 bg-gray-100 focus:bg-gray-150 shadow-none"
                            />
                            <InputError message={businessForm.errors.business_name} />
                        </div>

                        {/* Mensaje de Bienvenida */}
                        <div className="space-y-2">
                            <Label htmlFor="welcome_message" className="text-sm font-medium text-black">
                                Mensaje de Bienvenida
                            </Label>
                            <Textarea
                                id="welcome_message"
                                value={businessForm.data.welcome_message}
                                onChange={(e) => businessForm.setData('welcome_message', e.target.value)}
                                placeholder="Hola, gracias por contactarnos. ¿En qué podemos ayudarte?"
                                className="border-0 bg-gray-100 focus:bg-gray-150 shadow-none min-h-[100px]"
                            />
                            <InputError message={businessForm.errors.welcome_message} />
                        </div>

                        {/* Mensaje Fuera de Horario */}
                        <div className="space-y-2">
                            <Label htmlFor="away_message" className="text-sm font-medium text-black">
                                Mensaje Fuera de Horario
                            </Label>
                            <Textarea
                                id="away_message"
                                value={businessForm.data.away_message}
                                onChange={(e) => businessForm.setData('away_message', e.target.value)}
                                placeholder="Gracias por escribirnos. En este momento estamos fuera de horario..."
                                className="border-0 bg-gray-100 focus:bg-gray-150 shadow-none min-h-[100px]"
                            />
                            <InputError message={businessForm.errors.away_message} />
                        </div>

                        {/* Horarios de Atención */}
                        <div className="space-y-2">
                            <Label htmlFor="business_hours" className="text-sm font-medium text-black">
                                Horarios de Atención
                            </Label>
                            <Input
                                id="business_hours"
                                type="text"
                                value={businessForm.data.business_hours}
                                onChange={(e) => businessForm.setData('business_hours', e.target.value)}
                                placeholder="Lun-Vie: 9:00 AM - 6:00 PM"
                                className="border-0 bg-gray-100 focus:bg-gray-150 shadow-none"
                            />
                            <InputError message={businessForm.errors.business_hours} />
                        </div>

                        {/* Botón */}
                        <div className="flex gap-3 pt-4">
                            <Button
                                type="submit"
                                disabled={businessForm.processing}
                                className="bg-[#2e3f84] hover:bg-[#1e2f74] text-white"
                            >
                                {businessForm.processing ? 'Guardando...' : 'Guardar Configuración'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </AdminLayout>
    );
}
