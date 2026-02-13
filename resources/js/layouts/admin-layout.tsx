import { Link, usePage } from '@inertiajs/react';
import { type PropsWithChildren, type ReactNode, useState, useEffect } from 'react';
import { Users, MessageSquare, Settings, LogOut, Menu, User, X, FileText, Calendar, BarChart3, Send, MessagesSquare } from 'lucide-react';
import AppLogoIcon from '@/components/app-logo-icon';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { logout } from '@/routes';
import { useInitials } from '@/hooks/use-initials';
import { LanguageSelector } from '@/components/language-selector';
import { useTranslation } from 'react-i18next';
import AppearanceToggleDropdown from '@/components/appearance-dropdown';

interface AdminLayoutProps {
    children: ReactNode;
}

export default function AdminLayout({ children }: PropsWithChildren<AdminLayoutProps>) {
    const { t } = useTranslation();
    const { auth, unreadConversationsCount: initialUnreadCount = 0 } = usePage().props as any;
    const currentUrl = usePage().url;
    const getInitials = useInitials();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [unreadConversationsCount, setUnreadConversationsCount] = useState(initialUnreadCount);
    const [unreadInternalChatCount, setUnreadInternalChatCount] = useState(0);

    // Actualizar el contador de conversaciones no leídas cada 5 segundos
    useEffect(() => {
        const updateUnreadCount = async () => {
            try {
                const response = await fetch('/admin/chat/unread-count', {
                    headers: {
                        'Accept': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                });

                if (response.ok) {
                    const data = await response.json();
                    setUnreadConversationsCount(data.count || 0);
                }
            } catch (error) {
                // Silenciar errores de red
                console.error('Error al actualizar contador de conversaciones:', error);
            }
        };

        // Actualizar inmediatamente
        updateUnreadCount();

        // Actualizar cada 5 segundos
        const interval = setInterval(updateUnreadCount, 5000);

        return () => clearInterval(interval);
    }, []);

    // Actualizar el contador de chat interno no leído
    useEffect(() => {
        const updateInternalUnread = async () => {
            try {
                const response = await fetch('/admin/internal-chat/unread-count', {
                    headers: {
                        'Accept': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                });
                if (response.ok) {
                    const data = await response.json();
                    setUnreadInternalChatCount(data.count || 0);
                }
            } catch (error) {
                // Silenciar
            }
        };

        updateInternalUnread();
        const interval = setInterval(updateInternalUnread, 8000);
        return () => clearInterval(interval);
    }, []);

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
            title: t('navigation.bulkSends'),
            href: '/admin/bulk-sends',
            icon: Send,
        },
        {
            title: t('navigation.internalChat'),
            href: '/admin/internal-chat',
            icon: MessagesSquare,
        },
        {
            title: t('navigation.templates'),
            href: '/admin/templates',
            icon: FileText,
        },
        {
            title: t('navigation.statistics'),
            href: '/admin/statistics',
            icon: BarChart3,
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
            return item.href === '/admin/chat' || item.href === '/admin/templates' || item.href === '/admin/internal-chat';
        }
        // Admins ven todo
        return true;
    });

    return (
        <div className="flex h-screen bg-background relative">
            {/* Mobile Menu Button - Floating Action Button */}
            <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-gradient-to-b from-[#3e4f94] to-[#2e3f84] text-white rounded-none shadow-[0_2px_4px_rgba(46,63,132,0.2),0_4px_12px_rgba(46,63,132,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] hover:shadow-[0_4px_8px_rgba(46,63,132,0.25),0_6px_16px_rgba(46,63,132,0.35)] hover:-translate-y-0.5 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] active:translate-y-0 transition-all duration-200"
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

            {/* Sidebar - Modern Design */}
            <aside className={`
                w-64 bg-sidebar flex flex-col justify-between flex-shrink-0 z-20 shadow-xl relative
                transition-transform duration-300 ease-in-out
                
                ${/* Mobile: Overlay sidebar */''}
                fixed lg:relative top-0 left-0 h-full
                
                ${/* Mobile transform */''}
                ${isMobileMenuOpen
                    ? 'translate-x-0'
                    : '-translate-x-full lg:translate-x-0'
                }
            `}>
                <div>
                    {/* Header with logo */}
                    <div className="h-16 flex items-center px-6 border-b border-sidebar-border bg-sidebar">
                        <AppLogoIcon className="h-7 w-auto object-contain brightness-0 invert dark:invert mr-2" />
                        <h1 className="text-sidebar-foreground font-bold text-lg tracking-wide">Evarisbot</h1>
                        {/* Close button only on mobile */}
                        <button
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="lg:hidden ml-auto p-2 hover:bg-sidebar-accent rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5 text-sidebar-foreground" />
                        </button>
                    </div>

                    {/* Navigation */}
                    <nav className="mt-4 flex flex-col gap-1 px-2">
                        {visibleMenuItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = currentUrl.startsWith(item.href);

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center px-4 py-3 transition-all rounded-lg group ${isActive
                                            ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-md font-semibold'
                                            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                                        }`}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    <Icon className={`mr-3 w-[22px] h-[22px] ${!isActive ? 'group-hover:scale-110 transition-transform' : ''}`} />
                                    <span className="text-sm flex-1">{item.title}</span>
                                    {/* Badge de notificación para Conversaciones */}
                                    {item.href === '/admin/chat' && unreadConversationsCount > 0 && (
                                        <span className="bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                                            {unreadConversationsCount}
                                        </span>
                                    )}
                                    {item.href === '/admin/internal-chat' && unreadInternalChatCount > 0 && (
                                        <span className="bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                                            {unreadInternalChatCount}
                                        </span>
                                    )}
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                {/* User Info & Logout - Footer */}
                <div className="mb-4 px-4">
                    <div className="px-4 py-4 bg-sidebar-accent/50 rounded-xl border border-sidebar-border backdrop-blur-sm">
                        <div className="flex items-center mb-3">
                            <Avatar className="h-10 w-10 mr-3 shadow-md border-2 border-sidebar-border">
                                <AvatarImage src={auth.user?.avatar} alt={auth.user?.name} />
                                <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-sm font-bold">
                                    {getInitials(auth.user?.name)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="overflow-hidden flex-1">
                                <p className="text-sidebar-foreground text-sm font-semibold truncate">{auth.user?.name}</p>
                                <p className="text-sidebar-foreground/60 text-xs truncate">{auth.user?.role === 'admin' ? t('users.roles.admin') : t('users.roles.advisor')}</p>
                            </div>
                        </div>
                        <nav className="flex flex-col gap-1">
                            <Link
                                href="/settings/profile"
                                className="flex items-center py-1.5 text-sidebar-foreground/70 hover:text-sidebar-foreground text-xs transition-colors"
                            >
                                <User className="mr-2 w-[18px] h-[18px]" />
                                {t('navigation.profile')}
                            </Link>
                            <div className="flex items-center py-1.5 text-sidebar-foreground/70 text-xs">
                                <LanguageSelector variant="admin" />
                            </div>
                            <div className="flex items-center py-1.5 text-sidebar-foreground/70 text-xs">
                                <AppearanceToggleDropdown />
                            </div>
                            <Link
                                href={logout()}
                                method="post"
                                as="button"
                                className="flex items-center py-1.5 text-sidebar-foreground/70 hover:text-destructive text-xs mt-2 border-t border-sidebar-border pt-3 transition-colors"
                            >
                                <LogOut className="mr-2 w-[18px] h-[18px]" />
                                {t('common.logout')}
                            </Link>
                        </nav>
                    </div>
                </div>
            </aside>

            {/* Main Content - Adjusts to sidebar */}
            <main className="flex-1 min-w-0 overflow-auto bg-background lg:ml-0 pt-16 lg:pt-0">
                {children}
            </main>
        </div>
    );
}
