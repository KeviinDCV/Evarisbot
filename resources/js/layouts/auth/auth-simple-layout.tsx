import { LanguageSelector } from '@/components/language-selector';
import { useAppearance } from '@/hooks/use-appearance';
import { Moon, Sun } from 'lucide-react';
import { type PropsWithChildren } from 'react';

interface AuthLayoutProps {
    name?: string;
    title?: string;
    description?: string;
}

export default function AuthSimpleLayout({
    children,
    title,
    description,
}: PropsWithChildren<AuthLayoutProps>) {
    const { appearance, updateAppearance } = useAppearance();
    const isDark =
        appearance === 'dark' ||
        (appearance === 'system' &&
            typeof window !== 'undefined' &&
            window.matchMedia('(prefers-color-scheme: dark)').matches);

    return (
        <div
            className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-6 py-10"
            style={{ background: 'var(--auth-bg)' }}
        >
            {/* Glows decorativos */}
            <div
                className="pointer-events-none absolute -right-[120px] -top-[160px] h-[480px] w-[480px] rounded-full"
                style={{ background: 'radial-gradient(circle at 30% 30%, var(--auth-glow-1), transparent 70%)' }}
            />
            <div
                className="pointer-events-none absolute -bottom-[200px] -left-[140px] h-[520px] w-[520px] rounded-full"
                style={{ background: 'radial-gradient(circle at 50% 50%, var(--auth-glow-2), transparent 70%)' }}
            />

            {/* Selector de idioma + cambio de tema (claro/oscuro) */}
            <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => updateAppearance(isDark ? 'light' : 'dark')}
                    className="flex h-9 w-9 items-center justify-center rounded-full transition-all hover:scale-105 active:scale-95"
                    style={{ background: 'var(--auth-badge-bg)', color: 'var(--auth-badge-text)' }}
                    title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                    aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                >
                    {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
                </button>
                {/* Envuelto para aislar el ancho del selector (su Button usa w-full). */}
                <div>
                    <LanguageSelector />
                </div>
            </div>

            {/* Contenido */}
            <div className="relative w-full" style={{ maxWidth: '400px' }}>
                {/* Logo real del HUV + marca */}
                <div className="flex flex-col items-center text-center">
                    <img
                        src="/images/logopano.png"
                        alt="Hospital Universitario del Valle"
                        className="auth-logo object-contain drop-shadow-sm"
                        style={{ height: 'clamp(4.5rem, 4.5rem + 1.5vw, 6.5rem)', width: 'auto', maxWidth: '100%' }}
                    />
                    <div
                        className="mt-4 inline-flex items-center rounded-full px-[14px] py-[5px]"
                        style={{ background: 'var(--auth-badge-bg)', color: 'var(--auth-badge-text)', fontSize: '11px', fontWeight: 700, letterSpacing: '.18em' }}
                    >
                        EVARISBOT
                    </div>
                </div>

                {/* Título */}
                <h2
                    className="text-center font-bold"
                    style={{ margin: '30px 0 26px', fontSize: '25px', color: 'var(--auth-title)', letterSpacing: '-.01em', lineHeight: 1.2 }}
                >
                    {title}
                </h2>
                {description && (
                    <p className="text-center text-sm" style={{ color: 'var(--auth-subtle)', marginTop: '-14px', marginBottom: '18px' }}>
                        {description}
                    </p>
                )}

                {children}

                {/* Footer */}
                <p
                    className="text-center"
                    style={{ margin: '30px 0 0', fontSize: '12px', fontWeight: 600, letterSpacing: '.04em', color: 'var(--auth-subtle)' }}
                >
                    Innovación y Desarrollo
                </p>
            </div>
        </div>
    );
}
