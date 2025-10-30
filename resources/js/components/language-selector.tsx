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
    const [currentLanguage, setCurrentLanguage] = useState(i18n.language);

    useEffect(() => {
        // Sincronizar el estado cuando cambia el idioma
        const handleLanguageChange = (lng: string) => {
            setCurrentLanguage(lng);
        };

        i18n.on('languageChanged', handleLanguageChange);

        return () => {
            i18n.off('languageChanged', handleLanguageChange);
        };
    }, [i18n]);

    const changeLanguage = async (lng: string) => {
        console.log('Cambiando idioma a:', lng);
        await i18n.changeLanguage(lng);
        setCurrentLanguage(lng);
    };

    const languages = [
        { code: 'es', name: 'Español', flag: '🇪🇸' },
        { code: 'en', name: 'English', flag: '🇺🇸' },
    ];

    const currentLang = languages.find(lang => lang.code === currentLanguage);

    if (variant === 'admin') {
        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-white/80 hover:bg-gradient-to-b hover:from-white/15 hover:to-white/10 hover:text-white rounded-xl transition-all duration-200 hover:shadow-[0_1px_2px_rgba(255,255,255,0.1),0_2px_4px_rgba(255,255,255,0.08),inset_0_1px_0_rgba(255,255,255,0.15)] hover:translate-x-1 active:shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)] active:translate-x-0"
                        title={t('common.language')}
                    >
                        <Languages className="w-4 h-4" />
                        <span className="flex-1 text-left">
                            {currentLang?.flag} {currentLang?.name}
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
