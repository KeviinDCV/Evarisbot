import { Link, usePage } from '@inertiajs/react';
import { type PropsWithChildren, type ReactNode, useState, useEffect } from 'react';
import { Users, MessageSquare, Settings, LogOut, Menu, User, X, FileText, Calendar, BarChart3, Send, MessagesSquare, ChevronDown } from 'lucide-react';
import AppLogoIcon from '@/components/app-logo-icon';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { logout } from '@/routes';
import { useInitials } from '@/hooks/use-initials';
import { LanguageSelector } from '@/components/language-selector';
import { useTranslation } from 'react-i18next';
import AppearanceToggleDropdown from '@/components/appearance-dropdown';
import { Toaster } from 'sonner';

interface AdminLayoutProps {
    children: ReactNode;
}

export default function AdminLayout({ children }: PropsWithChildren<AdminLayoutProps>) {
    const { t } = useTranslation();
    const { auth, unreadConversationsCount: initialUnreadCount = 0 } = usePage().props as any;
    const currentUrl = usePage().url;
    const getInitials = useInitials();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [expandedMenus, setExpandedMenus] = useState<string[]>([]);

    const [unreadConversationsCount, setUnreadConversationsCount] = useState(initialUnreadCount);
    const [unreadInternalChatCount, setUnreadInternalChatCount] = useState(0);

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
            children: [
                { title: 'General', href: '/admin/appointments' },
                { title: 'Oncología', href: '/admin/oncology-appointments' },
            ],
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

    // Auto-expand menus when a child is active
    useEffect(() => {
        menuItems.forEach((item) => {
            if (item.children) {
                const isChildActive = item.children.some((child) => currentUrl.startsWith(child.href));
                if (isChildActive && !expandedMenus.includes(item.href)) {
                    setExpandedMenus((prev) => [...prev, item.href]);
                }
            }
        });
    }, [currentUrl]);

    // Filtrar menú según rol
    const visibleMenuItems = menuItems.filter((item) => {
        // Asesores solo ven Conversaciones, Plantillas, Chat Interno, y Envío masivo si tienen permiso
        if (auth.user.role === 'advisor') {
            if (item.href === '/admin/chat' || item.href === '/admin/templates' || item.href === '/admin/internal-chat') {
                return true;
            }
            if (item.href === '/admin/bulk-sends' && (auth.user as any).can_bulk_send) {
                return true;
            }
            return false;
        }
        // Admins ven todo
        return true;
    });

    return (
        <div className="flex h-screen bg-background relative">
            {/* Mobile Menu Button - Floating */}
            <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-gradient-to-b from-[#3e4f94] to-[#2e3f84] text-white shadow-lg rounded-xl"
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

            {/* Rail Sidebar */}
            <aside className={`
                w-20 bg-slate-50 dark:bg-neutral-900 flex flex-col items-center py-4 flex-shrink-0 z-40
                transition-all duration-300 ease-in-out
                fixed lg:relative top-0 left-0 h-full
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                {/* Logo */}
                <div className="mb-6 flex items-center justify-center">
                    <AppLogoIcon className="h-8 w-auto object-contain" />
                </div>

                {/* Navigation Icons */}
                <nav className="flex flex-col gap-1.5 flex-grow w-full px-2">
                    {visibleMenuItems.map((item) => {
                        const Icon = item.icon;
                        const hasChildren = !!(item as any).children;
                        const children = (item as any).children as { title: string; href: string }[] | undefined;
                        const isExpanded = expandedMenus.includes(item.href);
                        const isActive = hasChildren
                            ? children!.some((child) => currentUrl.startsWith(child.href))
                            : currentUrl.startsWith(item.href);
                        const badge = item.href === '/admin/chat' ? unreadConversationsCount
                            : item.href === '/admin/internal-chat' ? unreadInternalChatCount
                            : 0;

                        if (hasChildren) {
                            return (
                                <div key={item.href}>
                                    <button
                                        onClick={() =>
                                            setExpandedMenus((prev) =>
                                                prev.includes(item.href)
                                                    ? prev.filter((h) => h !== item.href)
                                                    : [...prev, item.href]
                                            )
                                        }
                                        className={`relative flex flex-col items-center gap-0.5 py-2.5 rounded-xl transition-all duration-200 group w-full ${
                                            isActive
                                                ? 'bg-blue-100 dark:bg-blue-900/30 text-[#2e3a75] dark:text-blue-300'
                                                : 'text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-neutral-200 hover:bg-slate-200/60 dark:hover:bg-neutral-800/60'
                                        }`}
                                    >
                                        <Icon className={`w-5 h-5 transition-transform duration-200 ${!isActive ? 'group-hover:scale-110' : ''}`} />
                                        <span className={`text-[10px] leading-tight text-center px-0.5 truncate w-full ${isActive ? 'font-semibold' : 'font-medium'}`}>
                                            {item.title}
                                        </span>
                                        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                    </button>
                                    {isExpanded && (
                                        <div className="flex flex-col gap-0.5 mt-0.5">
                                            {children!.map((child) => {
                                                const isChildActive = currentUrl.startsWith(child.href);
                                                return (
                                                    <Link
                                                        key={child.href}
                                                        href={child.href}
                                                        className={`flex flex-col items-center py-1.5 rounded-lg transition-all duration-200 ${
                                                            isChildActive
                                                                ? 'bg-blue-50 dark:bg-blue-900/20 text-[#2e3a75] dark:text-blue-300 font-semibold'
                                                                : 'text-slate-400 dark:text-neutral-500 hover:text-slate-700 dark:hover:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-800/40'
                                                        }`}
                                                        onClick={() => setIsMobileMenuOpen(false)}
                                                    >
                                                        <span className="text-[9px] leading-tight text-center px-1 truncate w-full">
                                                            {child.title}
                                                        </span>
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`relative flex flex-col items-center gap-0.5 py-2.5 rounded-xl transition-all duration-200 group ${
                                    isActive
                                        ? 'bg-blue-100 dark:bg-blue-900/30 text-[#2e3a75] dark:text-blue-300'
                                        : 'text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-neutral-200 hover:bg-slate-200/60 dark:hover:bg-neutral-800/60'
                                }`}
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                <Icon className={`w-5 h-5 transition-transform duration-200 ${!isActive ? 'group-hover:scale-110' : ''}`} />
                                <span className={`text-[10px] leading-tight text-center px-0.5 truncate w-full ${isActive ? 'font-semibold' : 'font-medium'}`}>
                                    {item.title}
                                </span>
                                {/* Notification badge */}
                                {badge > 0 && (
                                    <span className="absolute -top-0.5 right-1.5 bg-destructive text-destructive-foreground text-[9px] font-bold min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full shadow-sm">
                                        {badge}
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* Bottom actions */}
                <div className="mt-auto flex flex-col gap-2 items-center w-full px-2 pt-4 border-t border-slate-200 dark:border-neutral-700/50">
                    <div className="flex flex-col items-center gap-0.5 w-full">
                        <AppearanceToggleDropdown />
                    </div>
                    <div className="flex flex-col items-center gap-0.5 w-full">
                        <LanguageSelector variant="admin" />
                    </div>
                    <Link
                        href={logout()}
                        method="post"
                        as="button"
                        className="flex flex-col items-center gap-0.5 py-2.5 w-full rounded-xl text-slate-500 dark:text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200"
                    >
                        <LogOut className="w-5 h-5" />
                        <span className="text-[10px] font-medium">{t('common.logout')}</span>
                    </Link>
                    {/* User avatar */}
                    <Link href="/settings/profile" className="mt-1 group">
                        <Avatar className="h-10 w-10 ring-2 ring-white dark:ring-neutral-700 shadow-sm transition-transform group-hover:scale-105">
                            <AvatarImage src={auth.user?.avatar} alt={auth.user?.name} />
                            <AvatarFallback className="bg-[#2e3a75] text-white text-sm font-bold">
                                {getInitials(auth.user?.name)}
                            </AvatarFallback>
                        </Avatar>
                    </Link>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 min-w-0 overflow-auto bg-background lg:ml-0 pt-16 lg:pt-0">
                {children}
            </main>

            <Toaster position="bottom-right" richColors closeButton duration={4000} />
        </div>
    );
}
