import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import PasswordController from '@/actions/App/Http/Controllers/Settings/PasswordController';
import { send } from '@/routes/verification';
import { type SharedData } from '@/types';
import { Transition } from '@headlessui/react';
import { Form, Head, Link, usePage } from '@inertiajs/react';
import { useRef } from 'react';

import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AdminLayout from '@/layouts/admin-layout';

export default function Profile({
    mustVerifyEmail,
    status,
}: {
    mustVerifyEmail: boolean;
    status?: string;
}) {
    const { auth } = usePage<SharedData>().props;
    const passwordInput = useRef<HTMLInputElement>(null);
    const currentPasswordInput = useRef<HTMLInputElement>(null);

    return (
        <AdminLayout>
            <Head title="Mi Perfil" />

            <div className="min-h-screen bg-[#f0f2f8] p-4 md:p-6 lg:p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="mb-6 md:mb-8">
                        <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-[#2e3f84]">Mi Perfil</h2>
                        <p className="text-sm md:text-base text-[#6b7494] mt-1">Gestiona tu información personal y seguridad</p>
                    </div>

                    {/* Bento Grid Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                        {/* Información Personal Card */}
                        <div className="bg-gradient-to-b from-white to-[#fafbfc] rounded-2xl shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_6px_rgba(46,63,132,0.06),0_6px_16px_rgba(46,63,132,0.1),inset_0_1px_0_rgba(255,255,255,0.95)] p-4 sm:p-6 lg:p-8">
                            <div className="mb-6">
                                <h3 className="text-xl md:text-2xl font-bold text-[#2e3f84]">Información Personal</h3>
                                <p className="text-sm md:text-base text-[#6b7494] mt-1">Actualiza tu nombre y correo</p>
                            </div>
                        <Form
                            {...ProfileController.update.form()}
                            options={{
                                preserveScroll: true,
                            }}
                            className="space-y-6"
                        >
                            {({ processing, recentlySuccessful, errors }) => (
                                <>
                                    <div className="space-y-2">
                                        <Label htmlFor="name" className="text-sm font-medium text-[#2e3f84] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">
                                            Nombre Completo
                                        </Label>

                                        <Input
                                            id="name"
                                            className="border-0 bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] focus:from-white focus:to-[#fafbfc] shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_3px_rgba(46,63,132,0.06),inset_0_1px_0_rgba(255,255,255,0.6)] focus:shadow-[0_1px_3px_rgba(46,63,132,0.08),0_2px_6px_rgba(46,63,132,0.1),0_4px_12px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.06),0_3px_8px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] rounded-xl transition-all duration-200"
                                            defaultValue={auth.user.name}
                                            name="name"
                                            required
                                            autoComplete="name"
                                            placeholder="Ej: Juan Pérez"
                                        />

                                        <InputError message={errors.name} />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="email" className="text-sm font-medium text-[#2e3f84] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">
                                            Correo Electrónico
                                        </Label>

                                        <Input
                                            id="email"
                                            type="email"
                                            className="border-0 bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] focus:from-white focus:to-[#fafbfc] shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_3px_rgba(46,63,132,0.06),inset_0_1px_0_rgba(255,255,255,0.6)] focus:shadow-[0_1px_3px_rgba(46,63,132,0.08),0_2px_6px_rgba(46,63,132,0.1),0_4px_12px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.06),0_3px_8px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] rounded-xl transition-all duration-200"
                                            defaultValue={auth.user.email}
                                            name="email"
                                            required
                                            autoComplete="username"
                                            placeholder="usuario@ejemplo.com"
                                        />

                                        <InputError message={errors.email} />
                                    </div>

                                    {mustVerifyEmail &&
                                        auth.user.email_verified_at === null && (
                                            <div className="rounded-xl bg-gradient-to-b from-yellow-50 to-yellow-100/50 p-4 shadow-[0_1px_2px_rgba(234,179,8,0.15),0_2px_4px_rgba(234,179,8,0.1),inset_0_1px_0_rgba(255,255,255,0.6)]">
                                                <p className="text-sm text-yellow-800">
                                                    Tu correo electrónico no está verificado.{' '}
                                                    <Link
                                                        href={send()}
                                                        as="button"
                                                        className="font-medium underline hover:no-underline"
                                                    >
                                                        Haz clic aquí para reenviar el correo de verificación.
                                                    </Link>
                                                </p>

                                                {status === 'verification-link-sent' && (
                                                    <div className="mt-2 text-sm font-medium text-green-700">
                                                        Se ha enviado un nuevo enlace de verificación a tu correo.
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-4 border-t border-[#e8ebf5] mt-6">
                                        <Button
                                            disabled={processing}
                                            className="w-full sm:w-auto bg-gradient-to-b from-[#3e4f94] to-[#2e3f84] hover:from-[#4e5fa4] hover:to-[#3e4f94] text-white shadow-[0_1px_2px_rgba(46,63,132,0.15),0_2px_4px_rgba(46,63,132,0.2),0_4px_12px_rgba(46,63,132,0.25),inset_0_1px_0_rgba(255,255,255,0.15)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.2),0_4px_8px_rgba(46,63,132,0.25),0_8px_20px_rgba(46,63,132,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] hover:-translate-y-0.5 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),inset_0_0_8px_rgba(0,0,0,0.1)] active:translate-y-0 transition-all duration-200 disabled:opacity-50 disabled:hover:translate-y-0"
                                        >
                                            {processing ? 'Guardando...' : 'Guardar Cambios'}
                                        </Button>

                                        <Transition
                                            show={recentlySuccessful}
                                            enter="transition ease-in-out"
                                            enterFrom="opacity-0"
                                            leave="transition ease-in-out"
                                            leaveTo="opacity-0"
                                        >
                                            <p className="text-sm text-green-600 font-medium">
                                                ✓ Guardado
                                            </p>
                                        </Transition>
                                    </div>
                                </>
                            )}
                        </Form>
                        </div>

                        {/* Cambiar Contraseña Card */}
                        <div className="bg-gradient-to-b from-white to-[#fafbfc] rounded-2xl shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_6px_rgba(46,63,132,0.06),0_6px_16px_rgba(46,63,132,0.1),inset_0_1px_0_rgba(255,255,255,0.95)] p-4 sm:p-6 lg:p-8">
                        <div className="mb-6">
                            <h3 className="text-xl md:text-2xl font-bold text-[#2e3f84]">Cambiar Contraseña</h3>
                            <p className="text-sm md:text-base text-[#6b7494] mt-1">Asegúrate de usar una contraseña segura para proteger tu cuenta</p>
                        </div>

                        <Form
                            {...PasswordController.update.form()}
                            options={{
                                preserveScroll: true,
                            }}
                            resetOnError={[
                                'password',
                                'password_confirmation',
                                'current_password',
                            ]}
                            resetOnSuccess
                            onError={(errors) => {
                                if (errors.password) {
                                    passwordInput.current?.focus();
                                }

                                if (errors.current_password) {
                                    currentPasswordInput.current?.focus();
                                }
                            }}
                            className="space-y-6"
                        >
                            {({ errors, processing, recentlySuccessful }) => (
                                <>
                                    <div className="space-y-2">
                                        <Label htmlFor="current_password" className="text-sm font-medium text-[#2e3f84] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">
                                            Contraseña Actual
                                        </Label>

                                        <Input
                                            id="current_password"
                                            ref={currentPasswordInput}
                                            name="current_password"
                                            type="password"
                                            className="border-0 bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] focus:from-white focus:to-[#fafbfc] shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_3px_rgba(46,63,132,0.06),inset_0_1px_0_rgba(255,255,255,0.6)] focus:shadow-[0_1px_3px_rgba(46,63,132,0.08),0_2px_6px_rgba(46,63,132,0.1),0_4px_12px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.06),0_3px_8px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] rounded-xl transition-all duration-200"
                                            autoComplete="current-password"
                                            placeholder="Ingresa tu contraseña actual"
                                        />

                                        <InputError message={errors.current_password} />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="password" className="text-sm font-medium text-[#2e3f84] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">
                                            Nueva Contraseña
                                        </Label>

                                        <Input
                                            id="password"
                                            ref={passwordInput}
                                            name="password"
                                            type="password"
                                            className="border-0 bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] focus:from-white focus:to-[#fafbfc] shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_3px_rgba(46,63,132,0.06),inset_0_1px_0_rgba(255,255,255,0.6)] focus:shadow-[0_1px_3px_rgba(46,63,132,0.08),0_2px_6px_rgba(46,63,132,0.1),0_4px_12px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.06),0_3px_8px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] rounded-xl transition-all duration-200"
                                            autoComplete="new-password"
                                            placeholder="Mínimo 8 caracteres"
                                        />

                                        <InputError message={errors.password} />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="password_confirmation" className="text-sm font-medium text-[#2e3f84] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">
                                            Confirmar Nueva Contraseña
                                        </Label>

                                        <Input
                                            id="password_confirmation"
                                            name="password_confirmation"
                                            type="password"
                                            className="border-0 bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] focus:from-white focus:to-[#fafbfc] shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_3px_rgba(46,63,132,0.06),inset_0_1px_0_rgba(255,255,255,0.6)] focus:shadow-[0_1px_3px_rgba(46,63,132,0.08),0_2px_6px_rgba(46,63,132,0.1),0_4px_12px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.06),0_3px_8px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] rounded-xl transition-all duration-200"
                                            autoComplete="new-password"
                                            placeholder="Repite la nueva contraseña"
                                        />

                                        <InputError message={errors.password_confirmation} />
                                    </div>

                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-4 border-t border-[#e8ebf5] mt-6">
                                        <Button
                                            disabled={processing}
                                            className="w-full sm:w-auto bg-gradient-to-b from-[#3e4f94] to-[#2e3f84] hover:from-[#4e5fa4] hover:to-[#3e4f94] text-white shadow-[0_1px_2px_rgba(46,63,132,0.15),0_2px_4px_rgba(46,63,132,0.2),0_4px_12px_rgba(46,63,132,0.25),inset_0_1px_0_rgba(255,255,255,0.15)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.2),0_4px_8px_rgba(46,63,132,0.25),0_8px_20px_rgba(46,63,132,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] hover:-translate-y-0.5 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),inset_0_0_8px_rgba(0,0,0,0.1)] active:translate-y-0 transition-all duration-200 disabled:opacity-50 disabled:hover:translate-y-0"
                                        >
                                            {processing ? 'Guardando...' : 'Cambiar Contraseña'}
                                        </Button>

                                        <Transition
                                            show={recentlySuccessful}
                                            enter="transition ease-in-out"
                                            enterFrom="opacity-0"
                                            leave="transition ease-in-out"
                                            leaveTo="opacity-0"
                                        >
                                            <p className="text-sm text-green-600 font-medium">
                                                ✓ Contraseña actualizada
                                            </p>
                                        </Transition>
                                    </div>
                                </>
                            )}
                        </Form>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
