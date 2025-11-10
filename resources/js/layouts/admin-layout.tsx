import { Link, usePage } from '@inertiajs/react';
import { type PropsWithChildren, type ReactNode, useState } from 'react';
import { Users, MessageSquare, Settings, LogOut, Menu, User, X, FileText, Calendar } from 'lucide-react';
import AppLogoIcon from '@/components/app-logo-icon';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { logout } from '@/routes';
import { useInitials } from '@/hooks/use-initials';
import { LanguageSelector } from '@/components/language-selector';
import { useTranslation } from 'react-i18next';

interface AdminLayoutProps {
    children: ReactNode;
}

export default function AdminLayout({ children }: PropsWithChildren<AdminLayoutProps>) {
    const { t } = useTranslation();
    const { auth } = usePage().props as any;
    const currentUrl = usePage().url;
    const getInitials = useInitials();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const menuItems = [
        {
            title: t('navigation.conversations'),
            href: '/admin/chat',
            icon: MessageSquare,
        },
        {
            title: t('navigation.appointments'),
            href: '/admin/appointments',
            icon: Calendar,
        },
        {
            title: t('navigation.templates'),
            href: '/admin/templates',
            icon: FileText,
        },
        {
            title: t('navigation.users'),
            href: '/admin/users',
            icon: Users,
        },
        {
            title: t('navigation.settings'),
            href: '/admin/settings',
            icon: Settings,
        },
    ];

    // Filtrar menú según rol
    const visibleMenuItems = menuItems.filter((item) => {
        // Asesores solo ven Conversaciones y Plantillas
        if (auth.user.role === 'advisor') {
            return item.href === '/admin/chat' || item.href === '/admin/templates';
        }
        // Admins ven todo
        return true;
    });

    return (
        <div className="flex h-screen bg-[#f0f2f8] relative">
            {/* Mobile Menu Button - Floating Action Button */}
            <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-gradient-to-b from-[#3e4f94] to-[#2e3f84] text-white rounded-xl shadow-[0_2px_4px_rgba(46,63,132,0.2),0_4px_12px_rgba(46,63,132,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] hover:shadow-[0_4px_8px_rgba(46,63,132,0.25),0_6px_16px_rgba(46,63,132,0.35)] hover:-translate-y-0.5 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] active:translate-y-0 transition-all duration-200"
            >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar - Responsive System of Boxes */}
            <aside className={`
                bg-gradient-to-b from-[#2a3a78] to-[#2e3f84] text-white flex flex-col 
                shadow-[1px_0_2px_rgba(46,63,132,0.15),2px_0_8px_rgba(46,63,132,0.2),4px_0_20px_rgba(46,63,132,0.15),inset_-1px_0_0_rgba(255,255,255,0.05)]
                transition-transform duration-300 ease-in-out
                
                ${/* Mobile: Overlay sidebar */''}
                fixed lg:relative top-0 left-0 h-full z-40
                w-64 lg:w-64 xl:w-72
                
                ${/* Mobile transform */''}
                ${
                    isMobileMenuOpen 
                        ? 'translate-x-0' 
                        : '-translate-x-full lg:translate-x-0'
                }
            `}>
                {/* Logo - Elevated Layer */}
                <div className="p-4 lg:p-6 bg-gradient-to-b from-[#3e4f94]/20 to-transparent drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)]">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <AppLogoIcon className="h-8 lg:h-10 w-auto object-contain brightness-0 invert" />
                            <span className="text-lg lg:text-xl font-bold">Evarisbot</span>
                        </div>
                        {/* Close button only on mobile */}
                        <button
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="lg:hidden p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Navigation - Mid Layer */}
                <nav className="flex-1 p-3 lg:p-4 space-y-2 bg-gradient-to-b from-transparent via-[#2e3f84]/30 to-transparent overflow-y-auto">
                    {visibleMenuItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = currentUrl.startsWith(item.href);
                        
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 px-3 lg:px-4 py-2.5 lg:py-3 rounded-xl transition-all duration-200 ${
                                    isActive
                                        ? 'bg-gradient-to-b from-white to-[#fafbfc] text-[#2e3f84] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.06),0_2px_4px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] scale-[1.02]'
                                        : 'text-white/80 hover:bg-gradient-to-b hover:from-white/15 hover:to-white/10 hover:text-white hover:shadow-[0_1px_2px_rgba(255,255,255,0.08),0_2px_4px_rgba(255,255,255,0.12),inset_0_1px_0_rgba(255,255,255,0.15)] hover:scale-[1.01] active:shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] active:scale-100'
                                }`}
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                <Icon className="w-5 h-5 flex-shrink-0" />
                                <span className="text-sm lg:text-base">{item.title}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* User Info & Logout - Footer Layer */}
                <div className="p-3 lg:p-4 bg-gradient-to-t from-[#1e2f74]/30 to-transparent border-t border-white/10 lg:border-0">
                    <div className="flex items-center gap-3 mb-3">
                        <Avatar className="h-9 lg:h-10 w-9 lg:w-10 shadow-[0_1px_2px_rgba(0,0,0,0.15),0_2px_4px_rgba(0,0,0,0.2),0_4px_8px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.25)] ring-1 ring-white/10">
                            <AvatarImage src={auth.user?.avatar} alt={auth.user?.name} />
                            <AvatarFallback className="bg-gradient-to-b from-white to-[#f4f5f9] text-[#2e3f84] font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.8),inset_0_-1px_0_rgba(0,0,0,0.05)]">
                                {getInitials(auth.user?.name)}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs lg:text-sm font-medium truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]">{auth.user?.name}</p>
                            <p className="text-xs text-white/70 drop-shadow-[0_1px_1px_rgba(0,0,0,0.2)] hidden sm:block">{t('admin.role')}</p>
                        </div>
                    </div>
                    
                    <div className="mb-2">
                        <Link
                            href="/settings/profile"
                            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-white/80 hover:bg-gradient-to-b hover:from-white/15 hover:to-white/10 hover:text-white rounded-xl transition-all duration-200 hover:shadow-[0_1px_2px_rgba(255,255,255,0.1),0_2px_4px_rgba(255,255,255,0.08),inset_0_1px_0_rgba(255,255,255,0.15)] hover:translate-x-1 active:shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)] active:translate-x-0"
                        >
                            <User className="w-4 h-4" />
                            <span>{t('navigation.profile')}</span>
                        </Link>
                    </div>
                    
                    {/* Language Selector */}
                    <div className="mb-2">
                        <LanguageSelector variant="admin" />
                    </div>
                    
                    <Link
                        href={logout().url}
                        method="post"
                        as="button"
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-white/80 hover:bg-gradient-to-b hover:from-red-500/20 hover:to-red-600/15 hover:text-white rounded-xl transition-all duration-200 hover:shadow-[0_1px_2px_rgba(239,68,68,0.15),0_2px_4px_rgba(239,68,68,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] hover:translate-x-1 active:shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] active:translate-x-0 mt-2 pt-3 relative before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent"
                    >
                        <LogOut className="w-4 h-4" />
                        <span>{t('common.logout')}</span>
                    </Link>
                </div>
            </aside>

            {/* Main Content - Adjusts to sidebar */}
            <main className="flex-1 overflow-auto bg-[#f0f2f8] lg:ml-0 pt-16 lg:pt-0">
                {children}
            </main>
        </div>
    );
}
