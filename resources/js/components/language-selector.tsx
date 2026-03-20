import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';

interface LanguageSelectorProps {
    variant?: 'default' | 'admin';
}

export function LanguageSelector({ variant = 'default' }: LanguageSelectorProps) {
    const { i18n, t } = useTranslation();

    // Normalizar el código de idioma (ej: 'es-ES' -> 'es', 'en-US' -> 'en')
    const normalizeLanguage = (lng: string): string => {
        const baseCode = lng?.split('-')[0]?.toLowerCase() || 'es';
        return ['es', 'en'].includes(baseCode) ? baseCode : 'es';
    };

    const [currentLanguage, setCurrentLanguage] = useState(normalizeLanguage(i18n.language));

    useEffect(() => {
        // Sincronizar el estado cuando cambia el idioma
        const handleLanguageChange = (lng: string) => {
            setCurrentLanguage(normalizeLanguage(lng));
        };

        i18n.on('languageChanged', handleLanguageChange);

        // Sincronizar al montar si el idioma actual no está normalizado
        const normalized = normalizeLanguage(i18n.language);
        if (i18n.language !== normalized) {
            i18n.changeLanguage(normalized);
        }

        return () => {
            i18n.off('languageChanged', handleLanguageChange);
        };
    }, [i18n]);

    const changeLanguage = async (lng: string) => {
        // Guardar en localStorage explícitamente
        localStorage.setItem('i18nextLng', lng);
        // Cambiar el idioma
        await i18n.changeLanguage(lng);
        setCurrentLanguage(lng);
        // Recargar la página para asegurar que todas las traducciones se apliquen
        window.location.reload();
    };

    const languages = [
        { code: 'es', name: 'Español', flag: '🇪🇸' },
        { code: 'en', name: 'English', flag: '🇺🇸' },
    ];

    const currentLang = languages.find(lang => lang.code === currentLanguage) || languages[0];

    if (variant === 'admin') {
        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        className="flex flex-col items-center gap-0.5 py-2.5 w-full rounded-xl text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-neutral-200 hover:bg-slate-200/60 dark:hover:bg-neutral-800/60 transition-all duration-200"
                        title={t('common.language')}
                    >
                        <span className="text-base leading-none">{currentLang?.flag}</span>
                        <span className="text-[10px] font-medium leading-tight">
                            {currentLang?.name}
                        </span>
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                    {languages.map((language) => (
                        <DropdownMenuItem
                            key={language.code}
                            onClick={() => changeLanguage(language.code)}
                            className="cursor-pointer gap-2"
                        >
                            <span className="text-lg">{language.flag}</span>
                            <span className={currentLanguage === language.code ? 'font-bold' : ''}>
                                {language.name}
                            </span>
                            {currentLanguage === language.code && (
                                <span className="ml-auto text-xs">✓</span>
                            )}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    className="w-full justify-start gap-2 h-10"
                    title={t('common.language')}
                >
                    <Languages className="h-4 w-4" />
                    <span className="flex-1 text-left">
                        {currentLang?.flag} {currentLang?.name}
                    </span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                {languages.map((language) => (
                    <DropdownMenuItem
                        key={language.code}
                        onClick={() => changeLanguage(language.code)}
                        className="cursor-pointer gap-2"
                    >
                        <span className="text-lg">{language.flag}</span>
                        <span className={currentLanguage === language.code ? 'font-bold' : ''}>
                            {language.name}
                        </span>
                        {currentLanguage === language.code && (
                            <span className="ml-auto text-xs">✓</span>
                        )}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
