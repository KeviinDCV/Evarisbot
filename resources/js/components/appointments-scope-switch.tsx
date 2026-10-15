import { cn } from '@/lib/utils';
import { Link, usePage } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';

/**
 * EL RIEL NAVEGA ENTRE SECCIONES; LA SECCIÓN NAVEGA DENTRO DE SÍ MISMA.
 *
 * General/Oncología vivían como texto de 9px apretado dentro de un riel de 80px.
 * Ahora viven aquí, en la cabecera de su propia sección: al estar en Citas ves
 * los dos ámbitos y saltas entre ellos sin volver al chrome.
 *
 * Segmentado del lenguaje "Marco navy" (el de rol en Usuarios y el de periodo en Estadísticas):
 * pista navy tenue y la opción activa en blanco.
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
        <div
            role="group"
            aria-label={t('navigation.appointmentsScope')}
            className="flex shrink-0 items-center gap-0.5 rounded-[11px] bg-[#2e3f84]/[0.055] p-[3px] dark:bg-white/5"
        >
            {scopes.map((scope) => (
                <Link
                    key={scope.href}
                    href={scope.href}
                    aria-current={scope.active ? 'page' : undefined}
                    className={cn(
                        'flex h-[30px] items-center rounded-lg px-3.5 text-[13px] leading-4 font-semibold whitespace-nowrap transition-colors',
                        'outline-none focus-visible:ring-2 focus-visible:ring-[#2e3f84]/40 dark:focus-visible:ring-[#8b9ae0]/60',
                        scope.active
                            ? 'bg-white text-[#2e3f84] shadow-[0_0_0_1px_rgba(46,63,132,0.08),0_1px_2px_rgba(46,63,132,0.12),0_2px_6px_-2px_rgba(46,63,132,0.12)] dark:bg-white/12 dark:text-neutral-100 dark:shadow-none'
                            : 'text-muted-foreground hover:text-[#2e3f84] dark:text-neutral-400 dark:hover:text-neutral-100'
                    )}
                >
                    {scope.label}
                </Link>
            ))}
        </div>
    );
}
