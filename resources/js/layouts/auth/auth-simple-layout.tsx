import AppLogoIcon from '@/components/app-logo-icon';
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
                    {/* Caja del Logo - Se reorganiza en diferentes viewports */}
                    <div 
                        className="flex justify-center"
                        style={{ 
                            marginBottom: 'var(--space-xs)' // Espaciado mínimo en mobile
                        }}
                    >
                        <AppLogoIcon 
                            className="object-contain drop-shadow-md transition-all duration-300" 
                            style={{
                                height: 'clamp(4rem, 4rem + 2vw, 6rem)', // 64px-96px fluido
                                width: 'auto'
                            }}
                        />
                    </div>
                    
                    {/* Caja del Card - Padding y spacing responsivos */}
                    <div 
                        className="rounded-2xl relative transition-all duration-300" 
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
                            <h1 
                                className="font-bold text-center transition-all duration-300" 
                                style={{ 
                                    color: 'var(--primary-base)',
                                    fontSize: 'var(--text-3xl)', // 30px-36px fluido
                                    lineHeight: '1.2'
                                }}
                            >
                                {title}
                            </h1>
                            {children}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}