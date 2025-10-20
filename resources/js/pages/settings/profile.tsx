import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import { send } from '@/routes/verification';
import { type SharedData } from '@/types';
import { Transition } from '@headlessui/react';
import { Form, Head, Link, usePage } from '@inertiajs/react';

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

    return (
        <AdminLayout>
            <Head title="Mi Perfil" />

            <div className="p-8 space-y-6">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold text-black">Información Personal</h2>
                    <p className="text-sm text-gray-600">Actualiza tu nombre y correo electrónico</p>
                </div>

                    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
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
                                        <Label htmlFor="name" className="text-sm font-medium text-black">
                                            Nombre Completo
                                        </Label>

                                        <Input
                                            id="name"
                                            className="border-0 bg-gray-100 focus:bg-gray-150 shadow-none"
                                            defaultValue={auth.user.name}
                                            name="name"
                                            required
                                            autoComplete="name"
                                            placeholder="Ej: Juan Pérez"
                                        />

                                        <InputError message={errors.name} />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="email" className="text-sm font-medium text-black">
                                            Correo Electrónico
                                        </Label>

                                        <Input
                                            id="email"
                                            type="email"
                                            className="border-0 bg-gray-100 focus:bg-gray-150 shadow-none"
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
                                            <div className="rounded-lg bg-yellow-50 p-4">
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

                                    <div className="flex items-center gap-4 pt-4">
                                        <Button
                                            disabled={processing}
                                            className="bg-[#2e3f84] hover:bg-[#1e2f74] text-white"
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
            </div>
        </AdminLayout>
    );
}
