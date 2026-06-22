import { LanguageSelector } from '@/components/language-selector';
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
    return (
        <div
            className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-6 py-10"
            style={{ background: 'linear-gradient(160deg, #e9eaf7 0%, #e0e1f3 55%, #dadcf2 100%)' }}
        >
            {/* Glows decorativos */}
            <div
                className="pointer-events-none absolute -right-[120px] -top-[160px] h-[480px] w-[480px] rounded-full"
                style={{ background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,.55), rgba(255,255,255,0) 70%)' }}
            />
            <div
                className="pointer-events-none absolute -bottom-[200px] -left-[140px] h-[520px] w-[520px] rounded-full"
                style={{ background: 'radial-gradient(circle at 50% 50%, rgba(46,63,132,.06), rgba(46,63,132,0) 70%)' }}
            />

            {/* Selector de idioma */}
            <div className="absolute right-4 top-4 z-10">
                <LanguageSelector />
            </div>

            {/* Contenido */}
            <div className="relative w-full" style={{ maxWidth: '400px' }}>
                {/* Logo real del HUV + marca */}
                <div className="flex flex-col items-center text-center">
                    <img
                        src="/images/logopano.png"
                        alt="Hospital Universitario del Valle"
                        className="object-contain drop-shadow-sm"
                        style={{ height: 'clamp(4.5rem, 4.5rem + 1.5vw, 6.5rem)', width: 'auto', maxWidth: '100%' }}
                    />
                    <div
                        className="mt-4 inline-flex items-center rounded-full px-[14px] py-[5px]"
                        style={{ background: 'rgba(46,63,132,.07)', color: '#4a4f8c', fontSize: '11px', fontWeight: 700, letterSpacing: '.18em' }}
                    >
                        EVARISBOT
                    </div>
                </div>

                {/* Título */}
                <h2
                    className="text-center font-bold"
                    style={{ margin: '30px 0 26px', fontSize: '25px', color: '#262a4d', letterSpacing: '-.01em', lineHeight: 1.2 }}
                >
                    {title}
                </h2>
                {description && (
                    <p className="text-center text-sm" style={{ color: '#7d83ad', marginTop: '-14px', marginBottom: '18px' }}>
                        {description}
                    </p>
                )}

                {children}

                {/* Footer */}
                <p
                    className="text-center"
                    style={{ margin: '30px 0 0', fontSize: '12px', fontWeight: 600, letterSpacing: '.04em', color: '#a4a8c8' }}
                >
                    Innovación y Desarrollo
                </p>
            </div>
        </div>
    );
}
