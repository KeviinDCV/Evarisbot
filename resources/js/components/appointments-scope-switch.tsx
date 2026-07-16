import { Link, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';

/**
 * EL RIEL NAVEGA ENTRE SECCIONES; LA SECCIÓN NAVEGA DENTRO DE SÍ MISMA.
 *
 * General/Oncología vivían como texto de 9px apretado dentro de un riel de 80px.
 * Ahora viven aquí, en la cabecera de su propia sección: al estar en Citas ves
 * los dos ámbitos y saltas entre ellos sin volver al chrome.
 */
export function AppointmentsScopeSwitch() {
    const { t } = useTranslation();
    const url = usePage().url;
    const isOncology = url.startsWith('/admin/oncology-appointments');

    const scopes = [
        { href: '/admin/appointments', label: t('navigation.appointmentsGeneral'), active: !isOncology },
        { href: '/admin/oncology-appointments', label: t('navigation.appointmentsOncology'), active: isOncology },
    ];

    return (
        <div className="inline-flex rounded-xl border border-[#d4d8e8] bg-white/60 p-1 dark:border-white/10 dark:bg-white/[0.04]">
            {scopes.map((scope) => (
                <Link
                    key={scope.href}
                    href={scope.href}
                    aria-current={scope.active ? 'page' : undefined}
                    className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-all duration-200 ${
                        scope.active
                            ? 'bg-[#2e3f84] text-white shadow-sm shadow-[#2e3f84]/25'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    {scope.label}
                </Link>
            ))}
        </div>
    );
}
