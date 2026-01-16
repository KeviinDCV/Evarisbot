import PasswordController from '@/actions/App/Http/Controllers/Settings/PasswordController';
import InputError from '@/components/input-error';
import AdminLayout from '@/layouts/admin-layout';
import { Transition } from '@headlessui/react';
import { Form, Head } from '@inertiajs/react';
import { useRef } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function Password() {
    const passwordInput = useRef<HTMLInputElement>(null);
    const currentPasswordInput = useRef<HTMLInputElement>(null);

    return (
        <AdminLayout>
            <Head title="Cambiar Contraseña" />

            <div className="p-8 space-y-6">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold text-foreground">Cambiar Contraseña</h2>
                    <p className="text-sm text-muted-foreground">Asegúrate de usar una contraseña segura para proteger tu cuenta</p>
                </div>

                    <div className="bg-card rounded-none border border-border shadow-sm p-6">
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
                                        <Label htmlFor="current_password" className="text-sm font-medium text-foreground">
                                            Contraseña Actual
                                        </Label>

                                        <Input
                                            id="current_password"
                                            ref={currentPasswordInput}
                                            name="current_password"
                                            type="password"
                                            className="border-0 bg-accent focus:bg-gray-150 shadow-none"
                                            autoComplete="current-password"
                                            placeholder="Ingresa tu contraseña actual"
                                        />

                                        <InputError message={errors.current_password} />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="password" className="text-sm font-medium text-foreground">
                                            Nueva Contraseña
                                        </Label>

                                        <Input
                                            id="password"
                                            ref={passwordInput}
                                            name="password"
                                            type="password"
                                            className="border-0 bg-accent focus:bg-gray-150 shadow-none"
                                            autoComplete="new-password"
                                            placeholder="Mínimo 8 caracteres"
                                        />

                                        <InputError message={errors.password} />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="password_confirmation" className="text-sm font-medium text-foreground">
                                            Confirmar Nueva Contraseña
                                        </Label>

                                        <Input
                                            id="password_confirmation"
                                            name="password_confirmation"
                                            type="password"
                                            className="border-0 bg-accent focus:bg-gray-150 shadow-none"
                                            autoComplete="new-password"
                                            placeholder="Repite la nueva contraseña"
                                        />

                                        <InputError message={errors.password_confirmation} />
                                    </div>

                                    <div className="flex items-center gap-4 pt-4">
                                        <Button
                                            disabled={processing}
                                            className="bg-primary hover:bg-primary/90 text-white"
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
        </AdminLayout>
    );
}
