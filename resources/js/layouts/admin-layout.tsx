import { Link, usePage } from '@inertiajs/react';
import { type PropsWithChildren, type ReactNode } from 'react';
import { Users, MessageSquare, Settings, LogOut, Menu, User, KeyRound } from 'lucide-react';
import AppLogoIcon from '@/components/app-logo-icon';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { logout } from '@/routes';
import { useInitials } from '@/hooks/use-initials';

interface AdminLayoutProps {
    children: ReactNode;
}

const menuItems = [
    {
        title: 'Conversaciones',
        href: '/admin/chat',
        icon: MessageSquare,
    },
    {
        title: 'Gestión de Usuarios',
        href: '/admin/users',
        icon: Users,
    },
    {
        title: 'Configuración',
        href: '/admin/settings',
        icon: Settings,
    },
];

export default function AdminLayout({ children }: PropsWithChildren<AdminLayoutProps>) {
    const { auth } = usePage().props as any;
    const currentUrl = usePage().url;
    const getInitials = useInitials();

    return (
        <div className="flex h-screen bg-white">
            {/* Sidebar */}
            <aside className="w-64 bg-[#2e3f84] text-white flex flex-col">
                {/* Logo */}
                <div className="p-6 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <AppLogoIcon className="h-10 w-auto object-contain brightness-0 invert" />
                        <span className="text-xl font-bold">Evarisbot</span>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-2">
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = currentUrl.startsWith(item.href);
                        
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                                    isActive
                                        ? 'bg-white text-[#2e3f84] font-medium'
                                        : 'text-white/80 hover:bg-white/10 hover:text-white'
                                }`}
                            >
                                <Icon className="w-5 h-5" />
                                <span>{item.title}</span>
                            </Link>
                        );
                    })}
                </nav>

                {/* User Info & Logout */}
                <div className="p-4 border-t border-white/10">
                    <div className="flex items-center gap-3 mb-3">
                        <Avatar className="h-10 w-10">
                            <AvatarImage src={auth.user?.avatar} alt={auth.user?.name} />
                            <AvatarFallback className="bg-white text-[#2e3f84] font-medium">
                                {getInitials(auth.user?.name)}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{auth.user?.name}</p>
                            <p className="text-xs text-white/60">Administrador</p>
                        </div>
                    </div>
                    
                    <div className="space-y-1 mb-2">
                        <Link
                            href="/settings/profile"
                            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-white/80 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <User className="w-4 h-4" />
                            <span>Mi Perfil</span>
                        </Link>
                        
                        <Link
                            href="/settings/password"
                            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-white/80 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <KeyRound className="w-4 h-4" />
                            <span>Cambiar Contraseña</span>
                        </Link>
                    </div>
                    
                    <Link
                        href={logout().url}
                        method="post"
                        as="button"
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-white/80 hover:bg-white/10 rounded-lg transition-colors border-t border-white/10 pt-3"
                    >
                        <LogOut className="w-4 h-4" />
                        <span>Cerrar Sesión</span>
                    </Link>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto bg-gray-50">
                {children}
            </main>
        </div>
    );
}
