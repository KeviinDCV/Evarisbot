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
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-white/80 hover:bg-gradient-to-b hover:from-white/15 hover:to-white/10 hover:text-white rounded-none transition-all duration-200 hover:shadow-[0_1px_2px_rgba(255,255,255,0.1),0_2px_4px_rgba(255,255,255,0.08),inset_0_1px_0_rgba(255,255,255,0.15)] hover:translate-x-1 active:shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)] active:translate-x-0"
                        title="Cambiar tema"
                    >
                        <CurrentIcon className="w-4 h-4" />
                        <span className="flex-1 text-left">
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
