import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Appearance, useAppearance } from '@/hooks/use-appearance';
import { Check, ChevronDown, Monitor, Moon, Sun } from 'lucide-react';
import { HTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';

export default function AppearanceToggleDropdown({
    className = '',
    variante = 'riel',
    ...props
}: HTMLAttributes<HTMLDivElement> & {
    /** 'fila': en una fila «Tema … Claro ˅» (tarjeta del usuario del menú). 'riel': el botón apilado del menú anterior. */
    variante?: 'riel' | 'fila';
}) {
    const { appearance, updateAppearance } = useAppearance();
    const { t } = useTranslation();

    const options = [
        { value: 'system' as Appearance, icon: Monitor, label: t('common.themeSystem') },
        { value: 'light' as Appearance, icon: Sun, label: t('common.themeLight') },
        { value: 'dark' as Appearance, icon: Moon, label: t('common.themeDark') },
    ];

    const currentOption = options.find(opt => opt.value === appearance) || options[0];
    const CurrentIcon = currentOption.icon;

    if (variante === 'fila') {
        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        aria-label={`${t('common.theme')}: ${currentOption.label}`}
                        className="relative inline-flex h-8 items-center gap-1.5 rounded-lg pr-2 pl-2.5 text-[13px] font-medium text-foreground transition-colors after:absolute after:inset-x-0 after:-inset-y-1 hover:bg-muted"
                    >
                        <CurrentIcon className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
                        {currentOption.label}
                        <ChevronDown className="size-3.5 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 rounded-xl border-0 bg-white p-1 shadow-[0_0_0_1px_rgba(46,63,132,0.1),0_2px_4px_rgba(46,63,132,0.06),0_12px_28px_-12px_rgba(46,63,132,0.3)] dark:bg-popover dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_12px_28px_-12px_rgba(0,0,0,0.7)]">
                    {/* Opciones marcables: el lector de pantalla dice cuál está elegida (antes solo un ✓ oculto). */}
                    <DropdownMenuRadioGroup value={appearance} onValueChange={(v) => updateAppearance(v as Appearance)}>
                        {options.map(({ value, icon: Icon, label }) => (
                            <DropdownMenuRadioItem key={value} value={value} className="h-[30px] cursor-pointer gap-2.5 rounded-lg pr-2.5 pl-2.5 py-0 pointer-coarse:h-11 text-[13px] leading-[18px] font-medium text-[#2e3f84] focus:bg-[#2e3f84]/6 focus:text-[#2e3f84] dark:text-neutral-100 dark:focus:bg-white/8 dark:focus:text-neutral-100 [&>span:first-child]:hidden">
                                <Icon className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
                                <span className={appearance === value ? 'font-semibold' : ''}>{label}</span>
                                {appearance === value && <Check className="ml-auto size-3.5" strokeWidth={2} aria-hidden="true" />}
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>
        );
    }

    return (
        <div className={`w-full ${className}`} {...props}>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        className="flex flex-col items-center gap-0.5 py-2.5 w-full rounded-xl text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-neutral-200 hover:bg-slate-200/60 dark:hover:bg-neutral-800/60 transition-all duration-200"
                        title={t('common.changeTheme')}
                    >
                        <CurrentIcon className="w-5 h-5" />
                        <span className="text-[10px] font-medium leading-tight">
                            {currentOption.label}
                        </span>
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                    {options.map(({ value, icon: Icon, label }) => (
                        <DropdownMenuItem
                            key={value}
                            onClick={() => updateAppearance(value)}
                            className="cursor-pointer gap-2"
                        >
                            <Icon className="w-4 h-4" />
                            <span className={appearance === value ? 'font-bold' : ''}>
                                {label}
                            </span>
                            {appearance === value && (
                                <span className="ml-auto text-xs">✓</span>
                            )}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
