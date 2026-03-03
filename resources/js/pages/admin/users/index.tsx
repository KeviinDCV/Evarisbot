import { Head, Link, router } from '@inertiajs/react';
import AdminLayout from '@/layouts/admin-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Edit, Trash2, Calendar, UserCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface User {
    id: number;
    name: string;
    email: string;
    role: 'admin' | 'advisor';
    created_at: string;
    is_online: boolean;
    online_status: 'online' | 'offline' | 'never';
    last_activity_at: string | null;
}

interface UsersIndexProps {
    users: User[];
}

export default function UsersIndex({ users }: UsersIndexProps) {
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [userToDelete, setUserToDelete] = useState<User | null>(null);

    const filteredUsers = users.filter(user => {
        const matchesSearch = user.name.toLowerCase().includes(search.toLowerCase()) ||
            user.email.toLowerCase().includes(search.toLowerCase());
        const matchesRole = roleFilter === 'all' || user.role === roleFilter;
        return matchesSearch && matchesRole;
    });

    const handleDelete = () => {
        if (userToDelete) {
            router.delete(`/admin/users/${userToDelete.id}`, {
                onSuccess: () => setUserToDelete(null),
            });
        }
    };

    const getRoleLabel = (role: string) => {
        return role === 'admin' ? t('users.roles.admin') : t('users.roles.advisor');
    };

    const formatLastActivity = (lastActivity: string | null) => {
        if (!lastActivity) return t('users.neverConnected');

        const date = new Date(lastActivity);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return t('users.justNow');
        if (diffMins < 60) return t('users.minutesAgo', { count: diffMins });
        if (diffHours < 24) return t('users.hoursAgo', { count: diffHours });
        if (diffDays === 1) return t('users.yesterday');
        if (diffDays < 7) return t('users.daysAgo', { count: diffDays });

        return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <AdminLayout>
            <Head title={t('users.title')} />

            <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="mb-6" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
                            <div>
                                <h1 className="font-bold settings-title" style={{ fontSize: 'var(--text-3xl)' }}>
                                    {t('users.title')}
                                </h1>
                                <p className="settings-subtitle" style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-xs)' }}>
                                    {t('users.subtitle')}
                                </p>
                            </div>
                            <Link href="/admin/users/create">
                                <Button
                                    className="font-semibold text-white transition-all duration-200 border-0 relative overflow-hidden rounded-xl"
                                    style={{
                                        backgroundColor: 'var(--primary-base)',
                                        boxShadow: 'var(--shadow-md)',
                                        backgroundImage: 'var(--gradient-shine)',
                                        height: 'clamp(2.25rem, 2.25rem + 0.15vw, 2.5rem)',
                                        padding: '0 var(--space-lg)',
                                        fontSize: 'var(--text-sm)',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = 'var(--primary-darker)';
                                        e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = 'var(--primary-base)';
                                        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                    }}
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    {t('users.newUser')}
                                </Button>
                            </Link>
                        </div>

                        {/* Filtros */}
                        <div className="card-gradient rounded-2xl border border-white/40 dark:border-white/10 shadow-lg shadow-[#2e3f84]/5 p-4 md:p-6 flex flex-wrap gap-4 items-end transition-all duration-300 hover:shadow-xl hover:shadow-[#2e3f84]/10">
                            <div style={{ flex: '1 1 250px', minWidth: '200px' }}>
                                <label htmlFor="user-search" className="font-semibold block mb-2 settings-label" style={{ fontSize: 'var(--text-sm)' }}>
                                    {t('common.search')}
                                </label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 settings-subtitle" />
                                    <Input
                                        id="user-search"
                                        name="user-search"
                                        type="text"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder={t('users.searchPlaceholder')}
                                        className="pl-10 settings-input rounded-xl border-gray-200 dark:border-gray-800 transition-all duration-200 focus:ring-2 focus:ring-[#2e3f84]/30"
                                        style={{
                                            height: 'clamp(2.25rem, 2.25rem + 0.15vw, 2.5rem)',
                                            fontSize: 'var(--text-sm)',
                                        }}
                                    />
                                </div>
                            </div>

                            <div style={{ flex: '0 1 150px' }}>
                                <label htmlFor="role-filter" className="font-semibold block mb-2 settings-label" style={{ fontSize: 'var(--text-sm)' }}>
                                    {t('users.role')}
                                </label>
                                <select
                                    id="role-filter"
                                    name="role-filter"
                                    value={roleFilter}
                                    onChange={(e) => setRoleFilter(e.target.value)}
                                    className="w-full settings-input rounded-xl border-gray-200 dark:border-gray-800 transition-all duration-200 cursor-pointer focus:ring-2 focus:ring-[#2e3f84]/30"
                                    style={{
                                        height: 'clamp(2.25rem, 2.25rem + 0.15vw, 2.5rem)',
                                        fontSize: 'var(--text-sm)',
                                        padding: '0 2.5rem 0 var(--space-base)',
                                        appearance: 'none',
                                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                                        backgroundRepeat: 'no-repeat',
                                        backgroundPosition: 'right 0.75rem center',
                                        backgroundSize: '1rem',
                                    }}
                                >
                                    <option value="all">{t('common.all')}</option>
                                    <option value="admin">{t('users.roleFilter.admins')}</option>
                                    <option value="advisor">{t('users.roleFilter.advisors')}</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Lista de Usuarios */}
                    {filteredUsers.length > 0 && (
                        <div className="card-gradient rounded-2xl border border-white/40 dark:border-white/10 shadow-lg shadow-[#2e3f84]/5 overflow-hidden transition-all duration-300 mt-6">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-border dark:border-[hsl(231,20%,20%)] bg-black/5 dark:bg-white/5">
                                            <th className="p-4 font-semibold settings-title whitespace-nowrap" style={{ fontSize: 'var(--text-sm)' }}>
                                                Usuario
                                            </th>
                                            <th className="p-4 font-semibold settings-title whitespace-nowrap" style={{ fontSize: 'var(--text-sm)' }}>
                                                {t('users.role')}
                                            </th>
                                            <th className="p-4 font-semibold settings-title whitespace-nowrap" style={{ fontSize: 'var(--text-sm)' }}>
                                                Estado
                                            </th>
                                            <th className="p-4 font-semibold settings-title whitespace-nowrap" style={{ fontSize: 'var(--text-sm)' }}>
                                                Registro
                                            </th>
                                            <th className="p-4 font-semibold settings-title text-right whitespace-nowrap" style={{ fontSize: 'var(--text-sm)' }}>
                                                Acciones
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredUsers.map((user) => (
                                            <tr key={user.id} className="border-b border-border dark:border-[hsl(231,20%,20%)] last:border-0 hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-200">
                                                <td className="p-4 min-w-[200px]">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium bg-primary text-white flex-shrink-0 shadow-md">
                                                            {user.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h3 className="font-bold settings-title truncate" style={{ fontSize: 'var(--text-md)' }}>
                                                                {user.name}
                                                            </h3>
                                                            <p className="settings-subtitle truncate" style={{ fontSize: 'var(--text-sm)' }}>
                                                                {user.email}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <Badge
                                                        className={
                                                            user.role === 'admin'
                                                                ? 'chat-message-sent text-white shadow-[0_1px_2px_rgba(46,63,132,0.2),0_2px_4px_rgba(46,63,132,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] whitespace-nowrap block w-fit'
                                                                : 'status-badge shadow-[0_1px_2px_rgba(46,63,132,0.06),0_2px_3px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.6)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.2)] whitespace-nowrap block w-fit'
                                                        }
                                                    >
                                                        {getRoleLabel(user.role)}
                                                    </Badge>
                                                </td>
                                                <td className="p-4 whitespace-nowrap">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <div
                                                                className={`w-2 h-2 rounded-full flex-shrink-0 ${user.is_online
                                                                    ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]'
                                                                    : 'bg-gray-400'
                                                                    }`}
                                                            />
                                                            <span className={user.is_online ? 'user-status-online font-medium' : 'user-status-offline'} style={{ fontSize: 'var(--text-sm)' }}>
                                                                {user.is_online ? t('users.online') : t('users.offline')}
                                                            </span>
                                                        </div>
                                                        {!user.is_online && user.last_activity_at && (
                                                            <span className="user-last-activity text-muted-foreground" style={{ fontSize: 'var(--text-xs)' }}>
                                                                {formatLastActivity(user.last_activity_at)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5">
                                                        <Calendar className="w-4 h-4 settings-subtitle flex-shrink-0" />
                                                        <span className="settings-subtitle" style={{ fontSize: 'var(--text-sm)' }}>
                                                            {new Date(user.created_at).toLocaleDateString('es-ES', {
                                                                day: '2-digit',
                                                                month: 'short',
                                                                year: 'numeric'
                                                            })}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Link href={`/admin/users/${user.id}/edit`}>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="settings-btn-secondary rounded-xl hover:!text-white hover:!bg-gradient-to-b hover:!from-[#3e4f94] hover:!to-[#2e3f84] hover:shadow-[0_2px_4px_rgba(46,63,132,0.2),0_4px_8px_rgba(46,63,132,0.25)] transition-all duration-200"
                                                                style={{ padding: 'var(--space-xs) 0.5rem' }}
                                                                title={t('common.edit')}
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </Button>
                                                        </Link>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => setUserToDelete(user)}
                                                            className="rounded-xl hover:!text-white hover:!bg-gradient-to-b hover:!from-red-500 hover:!to-red-600 hover:shadow-[0_2px_4px_rgba(239,68,68,0.2),0_4px_8px_rgba(239,68,68,0.25)] transition-all duration-200 border-gray-200 dark:border-gray-800"
                                                            style={{ padding: 'var(--space-xs) 0.5rem', color: '#dc2626' }}
                                                            title={t('common.delete')}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Empty State */}
                    {filteredUsers.length === 0 && (
                        <div className="card-gradient rounded-2xl border border-white/40 dark:border-white/10 shadow-lg shadow-[#2e3f84]/5 p-12 text-center mt-6">
                            <UserCircle className="w-16 h-16 mx-auto mb-4 settings-subtitle" />
                            <h3 className="font-bold mb-2 settings-title" style={{ fontSize: 'var(--text-xl)' }}>
                                {t('users.noUsers')}
                            </h3>
                            <p className="mb-6 settings-subtitle" style={{ fontSize: 'var(--text-sm)' }}>
                                {t('users.noUsersFiltered')}
                            </p>
                        </div>
                    )}
                </div>

                {/* Modal de Confirmación */}
                <Dialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
                    <DialogContent className="card-gradient rounded-2xl sm:rounded-2xl border border-white/40 dark:border-white/10 shadow-2xl">
                        <DialogHeader>
                            <DialogTitle className="settings-title">{t('users.deleteConfirm')}</DialogTitle>
                            <DialogDescription className="settings-subtitle">
                                {t('users.deleteMessage')} <strong>{userToDelete?.name}</strong>?
                                {t('users.deleteWarning')}
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button variant="outline" className="settings-btn-secondary rounded-xl font-medium">
                                    {t('common.cancel')}
                                </Button>
                            </DialogClose>
                            <Button
                                onClick={handleDelete}
                                className="bg-gradient-to-b from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-md rounded-xl font-medium transition-all duration-200 border-0"
                            >
                                {t('common.delete')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </AdminLayout>
    );
}
