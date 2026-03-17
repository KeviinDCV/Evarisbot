import { Head } from '@inertiajs/react';

import AppearanceToggleTab from '@/components/appearance-tabs';
import HeadingSmall from '@/components/heading-small';
import { type BreadcrumbItem } from '@/types';

import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { edit as editAppearance } from '@/routes/appearance';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Configuración de apariencia',
        href: editAppearance().url,
    },
];

export default function Appearance() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Configuración de apariencia" />

            <SettingsLayout>
                <div className="space-y-6">
                    <HeadingSmall
                        title="Apariencia"
                        description="Personaliza el tema visual de la aplicación"
                    />
                    <div className="rounded-2xl border border-border bg-card p-6 dark:bg-card">
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-sm font-medium text-foreground">Tema</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Selecciona el modo de visualización que prefieras
                                </p>
                            </div>
                            <AppearanceToggleTab />
                        </div>
                    </div>
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
