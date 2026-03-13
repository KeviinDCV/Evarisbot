import { Link, usePage } from '@inertiajs/react';
import { type PropsWithChildren, type ReactNode, useState, useEffect } from 'react';
import { Users, MessageSquare, Settings, LogOut, Menu, User, X, FileText, Calendar, BarChart3, Send, MessagesSquare, ChevronLeft, ChevronRight } from 'lucide-react';
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

    // Desktop collapse state (persisted)
    const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('sidebar_collapsed') === 'true';
        }
        return false;
    });

    const [unreadConversationsCount, setUnreadConversationsCount] = useState(initialUnreadCount);
    const [unreadInternalChatCount, setUnreadInternalChatCount] = useState(0);

    const toggleDesktopSidebar = (state: boolean) => {
        setIsDesktopCollapsed(state);
        if (typeof window !== 'undefined') {
            localStorage.setItem('sidebar_collapsed', String(state));
        }
    };

    // Actualizar el contador de conversaciones no leídas cada 5 segundos
    useEffect(() => {
        const controller = new AbortController();

        const updateUnreadCount = async () => {
            try {
                const response = await fetch('/admin/chat/unread-count', {
                    signal: controller.signal,
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
                // Silenciar errores de red o cancelaciones
                if (error instanceof Error && error.name !== 'AbortError') {
                    // Solo loguear si NO es error de cancelación y NO es error de red simple
                    // console.error('Error silencioso:', error);
                }
            }
        };

        // Actualizar inmediatamente
        updateUnreadCount();

        // Actualizar cada 5 segundos
        const interval = setInterval(updateUnreadCount, 5000);

        return () => {
            clearInterval(interval);
            controller.abort();
        };
    }, []);

    // Actualizar el contador de chat interno no leído
    useEffect(() => {
        const controller = new AbortController();

        const updateInternalUnread = async () => {
            try {
                const response = await fetch('/admin/internal-chat/unread-count', {
                    signal: controller.signal,
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
                // Silenciar errores de red o cancelaciones
                if (error instanceof Error && error.name !== 'AbortError') {
                    // Solo loguear si NO es error de cancelación y NO es error de red simple
                    // console.error('Error silencioso:', error);
                }
            }
        };

        updateInternalUnread();
        const interval = setInterval(updateInternalUnread, 8000);
        return () => {
            clearInterval(interval);
            controller.abort();
        };
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
                className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-gradient-to-b from-[#3e4f94] to-[#2e3f84] text-white shadow-[0_2px_4px_rgba(46,63,132,0.2),0_4px_12px_rgba(46,63,132,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] hover:shadow-[0_4px_8px_rgba(46,63,132,0.25),0_6px_16px_rgba(46,63,132,0.35)] hover:-translate-y-0.5 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] active:translate-y-0 transition-all duration-200"
                style={{ borderRadius: 'var(--radius)' }}
            >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            {/* Desktop Show Button (Visible only when collapsed) */}
            {isDesktopCollapsed && (
                <button
                    onClick={() => toggleDesktopSidebar(false)}
                    className="hidden lg:flex fixed top-1/2 left-0 -translate-y-1/2 z-50 bg-sidebar border border-sidebar-border border-l-0 shadow-[4px_0px_10px_rgba(0,0,0,0.1)] rounded-r-xl w-5 hover:w-8 h-20 items-center justify-center transition-all duration-300 group cursor-pointer"
                    title="Mostrar menú"
                >
                    <ChevronRight className="w-5 h-5 text-sidebar-foreground opacity-50 group-hover:opacity-100 transition-opacity" />
                </button>
            )}

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
                transition-all duration-300 ease-in-out
                
                ${/* Mobile: Overlay sidebar */''}
                fixed lg:relative top-0 left-0 h-full
                
                ${isMobileMenuOpen
                    ? 'translate-x-0'
                    : '-translate-x-full lg:translate-x-0'
                }
                
                ${isDesktopCollapsed ? 'lg:-ml-64' : 'lg:ml-0'}
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
                        {/* Collapse button on desktop */}
                        <button
                            onClick={() => toggleDesktopSidebar(true)}
                            className="hidden lg:flex ml-auto p-2 hover:bg-sidebar-accent rounded-lg transition-colors text-sidebar-foreground/70 hover:text-sidebar-foreground"
                            title="Ocultar menú"
                        >
                            <ChevronLeft className="w-5 h-5" />
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
                                    className={`flex items-center px-4 py-3 transition-colors rounded-xl group relative ${isActive
                                        ? 'bg-primary text-white font-medium shadow-md shadow-primary/20'
                                        : 'text-sidebar-foreground/70 hover:bg-sidebar-foreground/5 hover:text-sidebar-foreground font-medium'
                                        }`}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    <Icon className={`mr-3 w-5 h-5 transition-transform duration-200 ${!isActive ? 'group-hover:scale-110' : ''}`} />
                                    <span className="text-[15px] flex-1">{item.title}</span>
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
                <div className="mb-6 px-4">
                    <div className="px-4 py-5 bg-sidebar-accent/50 rounded-2xl border border-sidebar-border shadow-sm backdrop-blur-sm">
                        <div className="flex items-center mb-4 pb-4 border-b border-sidebar-border">
                            <Avatar className="h-10 w-10 mr-3 ring-2 ring-sidebar shadow-sm">
                                <AvatarImage src={auth.user?.avatar} alt={auth.user?.name} />
                                <AvatarFallback className="bg-sidebar-primary/20 text-sidebar-primary-foreground text-sm font-bold">
                                    {getInitials(auth.user?.name)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="overflow-hidden flex-1">
                                <p className="text-sidebar-foreground text-[14px] font-semibold truncate leading-tight mb-0.5">{auth.user?.name}</p>
                                <p className="text-sidebar-foreground/70 text-[12px] truncate font-medium">{auth.user?.role === 'admin' ? t('users.roles.admin') : t('users.roles.advisor')}</p>
                            </div>
                        </div>
                        <nav className="flex flex-col gap-0.5">
                            <Link
                                href="/settings/profile"
                                className="flex items-center px-2 py-2 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground rounded-lg text-[13px] transition-colors font-medium"
                            >
                                <User className="mr-2 w-[16px] h-[16px]" />
                                {t('navigation.profile')}
                            </Link>
                            <div className="flex items-center px-2 py-2 text-sidebar-foreground/70 hover:bg-sidebar-accent md:hover:bg-transparent rounded-lg text-[13px] transition-colors">
                                <LanguageSelector variant="admin" />
                            </div>
                            <div className="flex items-center px-2 py-2 text-sidebar-foreground/70 hover:bg-sidebar-accent md:hover:bg-transparent rounded-lg text-[13px] transition-colors">
                                <AppearanceToggleDropdown />
                            </div>
                            <Link
                                href={logout()}
                                method="post"
                                as="button"
                                className="flex items-center px-2 py-2 text-sidebar-foreground/70 hover:bg-red-500/10 hover:text-red-400 rounded-lg text-[13px] transition-colors font-medium mt-1 w-full text-left"
                            >
                                <LogOut className="mr-2 w-[16px] h-[16px]" />
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
