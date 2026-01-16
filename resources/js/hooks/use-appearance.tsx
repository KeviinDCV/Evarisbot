import { useCallback, useEffect, useState } from 'react';

export type Appearance = 'light' | 'dark' | 'system';

const setCookie = (name: string, value: string, days = 365) => {
    if (typeof document === 'undefined') {
        return;
    }

    const maxAge = days * 24 * 60 * 60;
    document.cookie = `${name}=${value};path=/;max-age=${maxAge};SameSite=Lax`;
};

const getSystemTheme = (): 'light' | 'dark' => {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const applyTheme = (appearance: Appearance) => {
    const isDark = appearance === 'dark' || (appearance === 'system' && getSystemTheme() === 'dark');
    
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
};

export function initializeTheme() {
    const saved = localStorage.getItem('appearance') as Appearance | null;
    // Si no hay tema guardado, usar 'light' por defecto en lugar de 'system'
    const appearance = saved || 'light';
    applyTheme(appearance);
    // Guardar el valor por defecto si no existe
    if (!saved) {
        localStorage.setItem('appearance', 'light');
    }
}

export function useAppearance() {
    const [appearance, setAppearance] = useState<Appearance>(() => {
        if (typeof window === 'undefined') return 'light';
        return (localStorage.getItem('appearance') as Appearance) || 'light';
    });

    const updateAppearance = useCallback((mode: Appearance) => {
        setAppearance(mode);
        localStorage.setItem('appearance', mode);
        setCookie('appearance', mode);
        applyTheme(mode);
    }, []);

    useEffect(() => {
        const saved = localStorage.getItem('appearance') as Appearance | null;
        if (saved) {
            applyTheme(saved);
        } else {
            // Si no hay tema guardado, aplicar light por defecto
            applyTheme('light');
        }

        // Escuchar cambios en preferencia del sistema
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => {
            const current = localStorage.getItem('appearance') as Appearance;
            if (current === 'system') {
                applyTheme('system');
            }
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    return { appearance, updateAppearance } as const;
}
