import AppLogoIcon from '@/components/app-logo-icon';
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
        <div className="flex min-h-svh flex-col items-center justify-center bg-white p-6 md:p-10">
            <div className="w-full max-w-sm">
                <div className="flex flex-col gap-6">
                    {/* Logo institucional */}
                    <div className="flex justify-center mb-4">
                        <AppLogoIcon className="h-20 w-auto object-contain" />
                    </div>
                    
                    {/* Card del Login */}
                    <div className="rounded-2xl bg-white p-8 shadow-xl border border-gray-200">
                        <div className="space-y-6">
                            <h1 className="text-3xl font-bold text-center text-black">{title}</h1>
                            {children}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}