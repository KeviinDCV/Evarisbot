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

// Última posición del puntero: es el origen del círculo de la transición de tema
// (el botón donde se hizo clic). Se registra en fase de captura para tenerla lista
// justo cuando updateAppearance se dispara desde el onClick del botón.
let lastPointerPosition: { x: number; y: number } | null = null;
if (typeof window !== 'undefined') {
    window.addEventListener(
        'pointerdown',
        (e) => { lastPointerPosition = { x: e.clientX, y: e.clientY }; },
        { capture: true },
    );
}

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

        const doc = document as Document & {
            startViewTransition?: (callback: () => void) => unknown;
        };
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // Sin View Transitions API (o con "reducir movimiento" activo): cambio instantáneo.
        if (!doc.startViewTransition || prefersReducedMotion) {
            applyTheme(mode);
            return;
        }

        // Origen del círculo = último clic (el botón de tema); si no hubo (activación por
        // teclado) usa el centro. Radio = distancia a la esquina más lejana, para que el
        // círculo alcance a cubrir toda la pantalla salga desde donde salga.
        const { innerWidth: w, innerHeight: h } = window;
        const x = lastPointerPosition?.x ?? w / 2;
        const y = lastPointerPosition?.y ?? h / 2;
        const radius = Math.hypot(Math.max(x, w - x), Math.max(y, h - y));

        const root = document.documentElement;
        root.style.setProperty('--theme-x', `${x}px`);
        root.style.setProperty('--theme-y', `${y}px`);
        root.style.setProperty('--theme-r', `${radius}px`);

        doc.startViewTransition(() => applyTheme(mode));
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
