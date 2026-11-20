import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Check, ChevronDown, Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';

interface LanguageSelectorProps {
    /** 'translucido': para fondos navy (login "Tarjeta sobre el hospital"). 'fila': «Idioma … Español ˅» (tarjeta
     *  del usuario del menú). */
    variant?: 'default' | 'admin' | 'translucido' | 'fila';
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

    const changeLanguage = async (lng: string, recargar = true) => {
        // Guardar en localStorage explícitamente
        localStorage.setItem('i18nextLng', lng);
        // Cambiar el idioma
        await i18n.changeLanguage(lng);
        setCurrentLanguage(lng);
        // Recargar la página para asegurar que todas las traducciones se apliquen
        if (recargar) window.location.reload();
    };

    const languages = [
        { code: 'es', name: 'Español', flag: '🇪🇸' },
        { code: 'en', name: 'English', flag: '🇺🇸' },
    ];

    const currentLang = languages.find(lang => lang.code === currentLanguage) || languages[0];

    if (variant === 'fila') {
        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        aria-label={`${t('common.language')}: ${currentLang?.name}`}
                        className="relative inline-flex h-8 items-center gap-1.5 rounded-lg pr-2 pl-2.5 text-[13px] font-medium text-foreground transition-colors after:absolute after:inset-x-0 after:-inset-y-1 hover:bg-muted"
                    >
                        {currentLang?.name}
                        <ChevronDown className="size-3.5 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 rounded-xl border-0 bg-white p-1 shadow-[0_0_0_1px_rgba(46,63,132,0.1),0_2px_4px_rgba(46,63,132,0.06),0_12px_28px_-12px_rgba(46,63,132,0.3)] dark:bg-popover dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_12px_28px_-12px_rgba(0,0,0,0.7)]">
                    {languages.map((language) => (
                        <DropdownMenuItem key={language.code} onClick={() => changeLanguage(language.code)} className="h-[30px] cursor-pointer gap-2.5 rounded-lg px-2.5 py-0 pointer-coarse:h-11 text-[13px] leading-[18px] font-medium text-[#2e3f84] focus:bg-[#2e3f84]/6 focus:text-[#2e3f84] dark:text-neutral-100 dark:focus:bg-white/8 dark:focus:text-neutral-100">
                            <span className={currentLanguage === language.code ? 'font-semibold' : ''}>{language.name}</span>
                            {currentLanguage === language.code && <Check className="ml-auto size-3.5" strokeWidth={2} aria-hidden="true" />}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        );
    }

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

    // Login: todo el texto es del cliente, así que el idioma cambia SIN recargar (la recarga borraba el correo
    // y la clave escritos). Sin banderas (Windows las pinta como letras «ES»/«US», y la de España no es la de
    // un hospital colombiano) y como opciones de radio: el lector de pantalla dice cuál está marcada.
    if (variant === 'translucido') {
        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        className="lh-control flex h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-white/[0.16]"
                        aria-label={t('loginHospital.language', { idioma: currentLang?.name })}
                    >
                        <Languages className="h-4 w-4" aria-hidden="true" />
                        {currentLang?.name}
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuRadioGroup value={currentLanguage} onValueChange={(lng) => void changeLanguage(lng, false)}>
                        {languages.map((language) => (
                            <DropdownMenuRadioItem key={language.code} value={language.code} lang={language.code} className="cursor-pointer">
                                {language.name}
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
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
