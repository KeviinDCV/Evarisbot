import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Appearance, useAppearance } from '@/hooks/use-appearance';
import { Monitor, Moon, Sun } from 'lucide-react';
import { HTMLAttributes } from 'react';

export default function AppearanceToggleDropdown({
    className = '',
    ...props
}: HTMLAttributes<HTMLDivElement>) {
    const { appearance, updateAppearance } = useAppearance();

    const options = [
        { value: 'system' as Appearance, icon: Monitor, label: 'Sistema' },
        { value: 'light' as Appearance, icon: Sun, label: 'Claro' },
        { value: 'dark' as Appearance, icon: Moon, label: 'Oscuro' },
    ];

    const currentOption = options.find(opt => opt.value === appearance) || options[0];
    const CurrentIcon = currentOption.icon;

    return (
        <div className={className} {...props}>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        className="flex flex-col items-center gap-0.5 py-2.5 w-full rounded-xl text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-neutral-200 hover:bg-slate-200/60 dark:hover:bg-neutral-800/60 transition-all duration-200"
                        title="Cambiar tema"
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
