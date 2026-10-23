import { Head } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';

import AppearanceToggleTab from '@/components/appearance-tabs';
import HeadingSmall from '@/components/heading-small';

import AdminLayout from '@/layouts/admin-layout';
import SettingsLayout from '@/layouts/settings/layout';

export default function Appearance() {
    const { t } = useTranslation();

    return (
        <AdminLayout>
            <Head title={t('appearance.pageTitle')} />

            <SettingsLayout>
                <div className="space-y-6">
                    <HeadingSmall
                        title={t('settings.appearance')}
                        description={t('appearance.headingDescription')}
                    />
                    <div className="rounded-2xl border border-border bg-card p-6 dark:bg-card">
                        <div className="space-y-4">
                            <div>
                                <h3 className="text-sm font-medium text-foreground">{t('appearance.themeLabel')}</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {t('appearance.themeDescription')}
                                </p>
                            </div>
                            <AppearanceToggleTab />
                        </div>
                    </div>
                </div>
            </SettingsLayout>
        </AdminLayout>
    );
}
