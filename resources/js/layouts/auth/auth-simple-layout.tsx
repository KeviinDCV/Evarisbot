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
            className="flex min-h-svh flex-col items-center justify-center relative"
            style={{
                backgroundColor: 'var(--layer-deepest)',
                padding: 'var(--space-lg)', // Mobile: 24px
            }}
        >
            {/* Selector de idioma en la esquina superior derecha */}
            <div
                className="absolute top-4 right-4 z-10"
                style={{
                    width: 'auto',
                }}
            >
                <LanguageSelector />
            </div>
            {/* Sistema de cajas flexible: contenedor principal */}
            <div
                className="w-full"
                style={{
                    maxWidth: 'var(--container-sm)', // 384px default
                }}
            >
                {/* Caja de contenido con espaciado fluido */}
                <div
                    className="flex flex-col"
                    style={{
                        gap: 'var(--space-xl)' // 32px entre logo y card
                    }}
                >
                    {/* Logo panorámico para Login */}
                    <div
                        className="flex flex-col items-center"
                        style={{
                            marginBottom: 'var(--space-base)'
                        }}
                    >
                        <img
                            src="/images/logopano.png"
                            alt="Logo"
                            className="object-contain drop-shadow-lg transition-all duration-300 mb-4"
                            style={{
                                height: 'clamp(6rem, 6rem + 2vw, 8rem)',
                                width: 'auto',
                                maxWidth: '100%'
                            }}
                        />
                        <h1
                            className="text-center font-bold text-sm tracking-widest uppercase opacity-80"
                            style={{
                                color: 'var(--primary-base)',
                            }}
                        >
                            Evarisbot
                        </h1>
                    </div>

                    {/* Caja del Card - Padding y spacing responsivos */}
                    <div
                        className="rounded-none relative transition-all duration-300"
                        style={{
                            backgroundColor: 'var(--layer-deep)',
                            boxShadow: 'var(--shadow-xl)',
                            backgroundImage: 'var(--gradient-subtle)',
                            padding: 'clamp(1.5rem, 1.5rem + 1vw, 2.5rem)', // 24px-40px fluido
                        }}
                    >
                        {/* Caja de contenido interno */}
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 'var(--space-lg)' // 24px entre título y contenido
                        }}>
                            <h2
                                className="font-bold text-center transition-all duration-300"
                                style={{
                                    color: 'var(--primary-base)',
                                    fontSize: 'var(--text-2xl)',
                                    lineHeight: '1.2',
                                    marginBottom: 'var(--space-xs)'
                                }}
                            >
                                {title}
                            </h2>
                            {description && (
                                <p
                                    className="text-center text-sm"
                                    style={{
                                        color: 'var(--text-subtle)',
                                        marginBottom: 'var(--space-md)'
                                    }}
                                >
                                    {description}
                                </p>
                            )}
                            {children}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}