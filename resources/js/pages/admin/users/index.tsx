import { Head, router, useForm } from '@inertiajs/react';
import AdminLayout from '@/layouts/admin-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import InputError from '@/components/input-error';
import { cn } from '@/lib/utils';
import {
    Activity,
    Calendar,
    Edit3,
    Headphones,
    KeyRound,
    Mail,
    Plus,
    Search,
    Send,
    ShieldCheck,
    Trash2,
    UserCircle,
    Users,
    X,
    type LucideIcon,
} from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { toast } from 'sonner';

interface User {
    id: number;
    name: string;
    email: string;
    role: 'admin' | 'advisor';
    can_bulk_send: boolean;
    created_at: string;
    is_online: boolean;
    online_status: 'online' | 'offline' | 'never';
    last_activity_at: string | null;
}

interface UsersIndexProps {
    users: User[];
}

interface UserFormData {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    role: User['role'];
}

interface MetricCardProps {
    icon: LucideIcon;
    label: string;
    value: string | number;
    detail: string;
    active?: boolean;
}

type RoleFilter = 'all' | User['role'];

function getInitials(name: string) {
    return name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join('');
}

function MetricCard({ icon: Icon, label, value, detail, active = false }: MetricCardProps) {
    return (
        <div className="card-gradient rounded-2xl p-4 shadow-sm shadow-[#2e3f84]/5">
            <div className="flex items-center gap-3">
                <div
                    className={cn(
                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border',
                        active
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
                            : 'border-[#d4d8e8] bg-[#2e3f84]/10 text-[#2e3f84] dark:border-white/10 dark:bg-white/[0.05] dark:text-neutral-100'
                    )}
                >
                    <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold settings-subtitle">{label}</p>
                    <p className="mt-1 text-lg font-bold leading-tight settings-title">{value}</p>
                    <p className="mt-0.5 truncate text-xs settings-subtitle">{detail}</p>
                </div>
            </div>
        </div>
    );
}

function RolePill({ role, label }: { role: User['role']; label: string }) {
    const admin = role === 'admin';

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold',
                admin
                    ? 'border-[#2e3f84]/20 bg-[#2e3f84]/10 text-[#2e3f84] dark:border-white/15 dark:bg-white/[0.06] dark:text-neutral-100'
                    : 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300'
            )}
        >
            {admin ? <ShieldCheck className="h-3.5 w-3.5" /> : <Headphones className="h-3.5 w-3.5" />}
            {label}
        </span>
    );
}

function OnlinePill({ online, label }: { online: boolean; label: string }) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold',
                online
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
                    : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-300'
            )}
        >
            <span className={cn('h-2 w-2 rounded-full', online ? 'bg-emerald-500' : 'bg-slate-400')} />
            {label}
        </span>
    );
}

export default function UsersIndex({ users }: UsersIndexProps) {
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [userToEdit, setUserToEdit] = useState<User | null>(null);

    const createForm = useForm<UserFormData>({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        role: 'advisor',
    });

    const editForm = useForm<UserFormData>({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        role: 'advisor',
    });

    const stats = useMemo(() => {
        const admins = users.filter((user) => user.role === 'admin').length;
        const advisors = users.filter((user) => user.role === 'advisor').length;
        const online = users.filter((user) => user.is_online).length;
        const bulkEnabled = users.filter((user) => user.role === 'advisor' && user.can_bulk_send).length;

        return { admins, advisors, online, bulkEnabled };
    }, [users]);

    const filteredUsers = useMemo(() => {
        const searchTerm = search.trim().toLowerCase();

        return users.filter((user) => {
            const matchesSearch = !searchTerm || `${user.name} ${user.email}`.toLowerCase().includes(searchTerm);
            const matchesRole = roleFilter === 'all' || user.role === roleFilter;

            return matchesSearch && matchesRole;
        });
    }, [roleFilter, search, users]);

    const roleOptions: { value: RoleFilter; label: string }[] = [
        { value: 'all', label: t('common.all') },
        { value: 'admin', label: t('users.roleFilter.admins') },
        { value: 'advisor', label: t('users.roleFilter.advisors') },
    ];

    const getRoleLabel = (role: User['role']) => {
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
            minute: '2-digit',
        });
    };

    const formatCreatedAt = (createdAt: string) => {
        return new Date(createdAt).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    };

    const handleDelete = () => {
        if (!userToDelete) return;

        router.delete(`/admin/users/${userToDelete.id}`, {
            onSuccess: () => {
                setUserToDelete(null);
                toast.success(t('users.toastDeleted'));
            },
            onError: () => toast.error(t('users.toastDeleteError')),
        });
    };

    const handleCreate = (event: FormEvent) => {
        event.preventDefault();
        createForm.post('/admin/users', {
            onSuccess: () => {
                setShowCreateModal(false);
                createForm.reset();
                toast.success(t('users.toastCreated'));
            },
        });
    };

    const handleEdit = (event: FormEvent) => {
        event.preventDefault();
        if (!userToEdit) return;

        editForm.put(`/admin/users/${userToEdit.id}`, {
            onSuccess: () => {
                setShowEditModal(false);
                setUserToEdit(null);
                toast.success(t('users.toastUpdated'));
            },
        });
    };

    const openEditModal = (user: User) => {
        setUserToEdit(user);
        editForm.setData({
            name: user.name,
            email: user.email,
            password: '',
            password_confirmation: '',
            role: user.role,
        });
        editForm.clearErrors();
        setShowEditModal(true);
    };

    const openCreateModal = () => {
        createForm.reset();
        createForm.clearErrors();
        setShowCreateModal(true);
    };

    const toggleBulkSend = (user: User) => {
        router.post(`/admin/users/${user.id}/toggle-bulk-send`, {}, {
            preserveScroll: true,
            onSuccess: () => toast.success(
                user.can_bulk_send
                    ? t('users.toastBulkSendRemoved', { name: user.name })
                    : t('users.toastBulkSendGranted', { name: user.name })
            ),
        });
    };

    return (
        <AdminLayout>
            <Head title={t('users.title')} />

            <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
                <div className="mx-auto flex max-w-7xl flex-col gap-5">
                    <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start gap-3">
                            <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-[#2e3f84] shadow-sm shadow-[#2e3f84]/5 dark:bg-white/[0.04] dark:text-neutral-100">
                                <Users className="h-5 w-5" />
                            </div>
                            <div>
                                <h1 className="font-bold settings-title" style={{ fontSize: 'var(--text-3xl)' }}>
                                    {t('users.title')}
                                </h1>
                                <p className="settings-subtitle" style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-xs)' }}>
                                    {t('users.subtitle')}
                                </p>
                            </div>
                        </div>

                        <Button onClick={openCreateModal} className="h-10 rounded-xl px-5 text-xs font-semibold settings-btn-primary">
                            <Plus className="mr-2 h-3.5 w-3.5" />
                            {t('users.newUser')}
                        </Button>
                    </header>

                    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <MetricCard icon={Users} label={t('users.metricUsers')} value={users.length} detail={t('users.metricVisible', { count: filteredUsers.length })} />
                        <MetricCard icon={Activity} label={t('users.metricOnline')} value={stats.online} detail={t('users.metricOnlineDetail')} active={stats.online > 0} />
                        <MetricCard icon={ShieldCheck} label={t('users.metricAdmins')} value={stats.admins} detail={t('users.metricAdminsDetail')} />
                        <MetricCard icon={Headphones} label={t('users.metricAdvisors')} value={stats.advisors} detail={t('users.metricAdvisorsDetail', { count: stats.bulkEnabled })} />
                    </section>

                    <section className="card-gradient rounded-2xl p-4 shadow-lg shadow-[#2e3f84]/5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                            <div className="min-w-0 flex-1">
                                <Label htmlFor="user-search" className="mb-2 block text-xs font-semibold settings-label">
                                    {t('common.search')}
                                </Label>
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 settings-subtitle" />
                                    <Input
                                        id="user-search"
                                        name="user-search"
                                        type="text"
                                        value={search}
                                        onChange={(event) => setSearch(event.target.value)}
                                        placeholder={t('users.searchPlaceholder')}
                                        className="h-10 rounded-xl pl-9 pr-9 text-sm settings-input focus:ring-2 focus:ring-[#2e3f84]/30"
                                    />
                                    {search && (
                                        <button
                                            type="button"
                                            onClick={() => setSearch('')}
                                            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[#6b7494] transition-colors hover:bg-black/5 hover:text-[#2e3f84] dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-neutral-100"
                                            aria-label={t('users.clearSearch')}
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="min-w-0">
                                <p className="mb-2 text-xs font-semibold settings-label">{t('users.role')}</p>
                                <div className="inline-flex w-full rounded-xl bg-white/70 p-1 dark:bg-white/[0.04] sm:w-auto">
                                    {roleOptions.map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => setRoleFilter(option.value)}
                                            className={cn(
                                                'flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors sm:flex-none',
                                                roleFilter === option.value
                                                    ? 'bg-[#2e3f84] text-white shadow-sm shadow-[#2e3f84]/20'
                                                    : 'settings-subtitle hover:bg-[#eef1f8] hover:text-[#2e3f84] dark:hover:bg-white/10 dark:hover:text-neutral-100'
                                            )}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="card-gradient overflow-hidden rounded-2xl shadow-lg shadow-[#2e3f84]/5">
                        <div className="flex flex-col gap-2 border-b border-[#d4d8e8]/80 px-4 py-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-base font-bold settings-title">{t('users.directoryTitle')}</h2>
                                <p className="mt-1 text-xs settings-subtitle">
                                    {t('users.directoryCount', { filtered: filteredUsers.length, total: users.length })}
                                </p>
                            </div>
                        </div>

                        {filteredUsers.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[900px] text-left">
                                    <thead>
                                        <tr className="border-b border-[#d4d8e8]/80 bg-[#f4f5f9]/70 dark:border-white/10 dark:bg-white/[0.04]">
                                            <th className="px-4 py-3.5 text-xs font-semibold settings-title">{t('users.tableUser')}</th>
                                            <th className="px-4 py-3.5 text-xs font-semibold settings-title">{t('users.role')}</th>
                                            <th className="px-4 py-3.5 text-xs font-semibold settings-title">{t('users.tableStatus')}</th>
                                            <th className="px-4 py-3.5 text-center text-xs font-semibold settings-title">
                                                <span className="inline-flex items-center justify-center gap-1.5">
                                                    <Send className="h-3.5 w-3.5" />
                                                    {t('users.tableBulkSend')}
                                                </span>
                                            </th>
                                            <th className="px-4 py-3.5 text-xs font-semibold settings-title">{t('users.tableRegistered')}</th>
                                            <th className="px-4 py-3.5 text-right text-xs font-semibold settings-title">{t('users.tableActions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredUsers.map((user) => (
                                            <tr key={user.id} className="border-b border-[#d4d8e8]/60 transition-colors last:border-0 hover:bg-white/55 dark:border-white/10 dark:hover:bg-white/[0.04]">
                                                <td className="px-4 py-3.5">
                                                    <div className="flex min-w-0 items-center gap-3">
                                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2e3f84] text-xs font-bold text-white shadow-sm shadow-[#2e3f84]/20">
                                                            {getInitials(user.name)}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-bold settings-title">{user.name}</p>
                                                            <p className="truncate text-xs settings-subtitle">{user.email}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <RolePill role={user.role} label={getRoleLabel(user.role)} />
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <div className="flex flex-col gap-1.5">
                                                        <OnlinePill online={user.is_online} label={user.is_online ? t('users.online') : t('users.offline')} />
                                                        <span className="text-[11px] settings-subtitle">
                                                            {user.is_online ? t('users.justNow') : formatLastActivity(user.last_activity_at)}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5 text-center">
                                                    {user.role === 'advisor' ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleBulkSend(user)}
                                                            className={cn(
                                                                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#2e3f84]/30 focus:ring-offset-2',
                                                                user.can_bulk_send ? 'bg-[#2e3f84]' : 'bg-slate-300 dark:bg-neutral-700'
                                                            )}
                                                            aria-label={user.can_bulk_send ? t('users.disableBulkSend') : t('users.enableBulkSend')}
                                                            title={user.can_bulk_send ? t('users.disableBulkSend') : t('users.enableBulkSend')}
                                                        >
                                                            <span
                                                                className={cn(
                                                                    'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200',
                                                                    user.can_bulk_send ? 'translate-x-6' : 'translate-x-1'
                                                                )}
                                                            />
                                                        </button>
                                                    ) : (
                                                        <span className="text-xs settings-subtitle">-</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <div className="flex items-center gap-2 text-xs settings-subtitle">
                                                        <Calendar className="h-4 w-4 shrink-0" />
                                                        <span>{formatCreatedAt(user.created_at)}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => openEditModal(user)}
                                                            className="h-8 w-8 rounded-xl p-0 settings-btn-secondary"
                                                            title={t('common.edit')}
                                                        >
                                                            <Edit3 className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => setUserToDelete(user)}
                                                            className="h-8 w-8 rounded-xl border-0 p-0 text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 dark:text-red-300 dark:hover:bg-red-500/10"
                                                            title={t('common.delete')}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="px-4 py-12 text-center">
                                <UserCircle className="mx-auto mb-4 h-14 w-14 settings-subtitle" />
                                <h3 className="text-lg font-bold settings-title">{t('users.noUsers')}</h3>
                                <p className="mx-auto mt-2 max-w-md text-sm settings-subtitle">{t('users.noUsersFiltered')}</p>
                            </div>
                        )}
                    </section>
                </div>

                <Dialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
                    <DialogContent className="card-gradient rounded-2xl shadow-2xl sm:rounded-2xl">
                        <DialogHeader>
                            <DialogTitle className="settings-title">{t('users.deleteConfirm')}</DialogTitle>
                            <DialogDescription className="settings-subtitle">
                                <Trans
                                    i18nKey="users.deleteMessageFull"
                                    values={{ name: userToDelete?.name ?? '' }}
                                    components={{ strong: <strong /> }}
                                />{' '}
                                {t('users.deleteWarning')}
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button variant="outline" className="rounded-xl font-medium settings-btn-secondary">
                                    {t('common.cancel')}
                                </Button>
                            </DialogClose>
                            <Button onClick={handleDelete} className="rounded-xl border-0 bg-gradient-to-b from-red-500 to-red-600 font-medium text-white shadow-md transition-all duration-200 hover:from-red-600 hover:to-red-700">
                                {t('common.delete')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
                    <DialogContent className="card-gradient overflow-hidden rounded-2xl p-0 shadow-2xl sm:max-w-xl sm:rounded-2xl">
                        <DialogHeader className="border-b border-[#d4d8e8]/80 px-5 py-4 dark:border-white/10">
                            <DialogTitle className="flex items-center gap-2 text-xl settings-title">
                                <UserCircle className="h-5 w-5 text-[#2e3f84] dark:text-neutral-100" />
                                {t('users.createTitle')}
                            </DialogTitle>
                            <DialogDescription className="text-xs settings-subtitle">
                                {t('users.createSubtitle')}
                            </DialogDescription>
                        </DialogHeader>

                        <form onSubmit={handleCreate} className="space-y-4 px-5 py-4">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label htmlFor="create-name" className="flex items-center gap-2 text-xs font-semibold settings-label">
                                        <UserCircle className="h-3.5 w-3.5" />
                                        {t('users.fullName')}
                                    </Label>
                                    <Input
                                        id="create-name"
                                        type="text"
                                        value={createForm.data.name}
                                        onChange={(event) => createForm.setData('name', event.target.value)}
                                        placeholder={t('users.fullNamePlaceholder')}
                                        className="rounded-xl text-sm settings-input focus:ring-2 focus:ring-[#2e3f84]/30"
                                        required
                                    />
                                    <InputError message={createForm.errors.name} />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="create-email" className="flex items-center gap-2 text-xs font-semibold settings-label">
                                        <Mail className="h-3.5 w-3.5" />
                                        {t('auth.email')}
                                    </Label>
                                    <Input
                                        id="create-email"
                                        type="email"
                                        value={createForm.data.email}
                                        onChange={(event) => createForm.setData('email', event.target.value)}
                                        placeholder={t('users.emailPlaceholder')}
                                        className="rounded-xl text-sm settings-input focus:ring-2 focus:ring-[#2e3f84]/30"
                                        required
                                    />
                                    <InputError message={createForm.errors.email} />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="create-password" className="flex items-center gap-2 text-xs font-semibold settings-label">
                                        <KeyRound className="h-3.5 w-3.5" />
                                        {t('auth.password')}
                                    </Label>
                                    <Input
                                        id="create-password"
                                        type="password"
                                        value={createForm.data.password}
                                        onChange={(event) => createForm.setData('password', event.target.value)}
                                        placeholder={t('users.passwordPlaceholder')}
                                        className="rounded-xl text-sm settings-input focus:ring-2 focus:ring-[#2e3f84]/30"
                                        required
                                    />
                                    <InputError message={createForm.errors.password} />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="create-password-confirm" className="flex items-center gap-2 text-xs font-semibold settings-label">
                                        <KeyRound className="h-3.5 w-3.5" />
                                        {t('users.confirmPassword')}
                                    </Label>
                                    <Input
                                        id="create-password-confirm"
                                        type="password"
                                        value={createForm.data.password_confirmation}
                                        onChange={(event) => createForm.setData('password_confirmation', event.target.value)}
                                        placeholder={t('users.confirmPasswordPlaceholder')}
                                        className="rounded-xl text-sm settings-input focus:ring-2 focus:ring-[#2e3f84]/30"
                                        required
                                    />
                                    <InputError message={createForm.errors.password_confirmation} />
                                </div>

                                <div className="space-y-1.5 md:col-span-2">
                                    <Label htmlFor="create-role" className="flex items-center gap-2 text-xs font-semibold settings-label">
                                        <ShieldCheck className="h-3.5 w-3.5" />
                                        {t('users.role')}
                                    </Label>
                                    <Select value={createForm.data.role} onValueChange={(value) => createForm.setData('role', value as User['role'])}>
                                        <SelectTrigger className="h-10 w-full rounded-xl text-sm settings-input focus:ring-2 focus:ring-[#2e3f84]/30 sm:w-1/2">
                                            <SelectValue placeholder={t('users.selectRole')} />
                                        </SelectTrigger>
                                        <SelectContent className="card-gradient rounded-xl p-1 shadow-lg">
                                            <SelectItem value="advisor" className="cursor-pointer rounded-md text-sm focus:bg-gray-100 dark:focus:bg-gray-800">{t('users.roles.advisor')}</SelectItem>
                                            <SelectItem value="admin" className="cursor-pointer rounded-md text-sm focus:bg-gray-100 dark:focus:bg-gray-800">{t('users.roles.admin')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <InputError message={createForm.errors.role} />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 border-t border-[#d4d8e8]/80 pt-4 dark:border-white/10">
                                <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)} className="rounded-xl text-sm settings-btn-secondary">
                                    {t('common.cancel')}
                                </Button>
                                <Button type="submit" disabled={createForm.processing} className="rounded-xl text-sm settings-btn-primary disabled:opacity-50">
                                    {createForm.processing ? t('users.creating') : t('users.createUser')}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>

                <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
                    <DialogContent className="card-gradient overflow-hidden rounded-2xl p-0 shadow-2xl sm:max-w-xl sm:rounded-2xl">
                        <DialogHeader className="border-b border-[#d4d8e8]/80 px-5 py-4 dark:border-white/10">
                            <DialogTitle className="flex items-center gap-2 text-xl settings-title">
                                <Edit3 className="h-5 w-5 text-[#2e3f84] dark:text-neutral-100" />
                                {t('users.editTitle')}
                            </DialogTitle>
                            <DialogDescription className="text-xs settings-subtitle">
                                {t('users.editSubtitleFor', { name: userToEdit?.name })}
                            </DialogDescription>
                        </DialogHeader>

                        <form onSubmit={handleEdit} className="space-y-4 px-5 py-4">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label htmlFor="edit-name" className="flex items-center gap-2 text-xs font-semibold settings-label">
                                        <UserCircle className="h-3.5 w-3.5" />
                                        {t('users.fullName')}
                                    </Label>
                                    <Input
                                        id="edit-name"
                                        type="text"
                                        value={editForm.data.name}
                                        onChange={(event) => editForm.setData('name', event.target.value)}
                                        placeholder={t('users.fullNamePlaceholder')}
                                        className="rounded-xl text-sm settings-input focus:ring-2 focus:ring-[#2e3f84]/30"
                                        required
                                    />
                                    <InputError message={editForm.errors.name} />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="edit-email" className="flex items-center gap-2 text-xs font-semibold settings-label">
                                        <Mail className="h-3.5 w-3.5" />
                                        {t('auth.email')}
                                    </Label>
                                    <Input
                                        id="edit-email"
                                        type="email"
                                        value={editForm.data.email}
                                        onChange={(event) => editForm.setData('email', event.target.value)}
                                        placeholder={t('users.emailPlaceholder')}
                                        className="rounded-xl text-sm settings-input focus:ring-2 focus:ring-[#2e3f84]/30"
                                        required
                                    />
                                    <InputError message={editForm.errors.email} />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="edit-password" className="flex items-center gap-2 text-xs font-semibold settings-label">
                                        <KeyRound className="h-3.5 w-3.5" />
                                        {t('users.newPassword')} <span className="text-[10px] opacity-60">{t('users.optional')}</span>
                                    </Label>
                                    <Input
                                        id="edit-password"
                                        type="password"
                                        value={editForm.data.password}
                                        onChange={(event) => editForm.setData('password', event.target.value)}
                                        placeholder={t('users.newPasswordPlaceholder')}
                                        className="rounded-xl text-sm settings-input focus:ring-2 focus:ring-[#2e3f84]/30"
                                    />
                                    <InputError message={editForm.errors.password} />
                                </div>

                                <div className={cn('space-y-1.5 transition-opacity', !editForm.data.password && 'pointer-events-none opacity-35')}>
                                    <Label htmlFor="edit-password-confirm" className="flex items-center gap-2 text-xs font-semibold settings-label">
                                        <KeyRound className="h-3.5 w-3.5" />
                                        {t('users.confirmNewPassword')}
                                    </Label>
                                    <Input
                                        id="edit-password-confirm"
                                        type="password"
                                        value={editForm.data.password_confirmation}
                                        onChange={(event) => editForm.setData('password_confirmation', event.target.value)}
                                        placeholder={t('users.confirmNewPasswordPlaceholder')}
                                        className="rounded-xl text-sm settings-input focus:ring-2 focus:ring-[#2e3f84]/30"
                                        required={!!editForm.data.password}
                                    />
                                    <InputError message={editForm.errors.password_confirmation} />
                                </div>

                                <div className="space-y-1.5 md:col-span-2">
                                    <Label htmlFor="edit-role" className="flex items-center gap-2 text-xs font-semibold settings-label">
                                        <ShieldCheck className="h-3.5 w-3.5" />
                                        {t('users.role')}
                                    </Label>
                                    <Select value={editForm.data.role} onValueChange={(value) => editForm.setData('role', value as User['role'])}>
                                        <SelectTrigger className="h-10 w-full rounded-xl text-sm settings-input focus:ring-2 focus:ring-[#2e3f84]/30 sm:w-1/2">
                                            <SelectValue placeholder={t('users.selectRole')} />
                                        </SelectTrigger>
                                        <SelectContent className="card-gradient rounded-xl p-1 shadow-lg">
                                            <SelectItem value="advisor" className="cursor-pointer rounded-md text-sm focus:bg-gray-100 dark:focus:bg-gray-800">{t('users.roles.advisor')}</SelectItem>
                                            <SelectItem value="admin" className="cursor-pointer rounded-md text-sm focus:bg-gray-100 dark:focus:bg-gray-800">{t('users.roles.admin')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <InputError message={editForm.errors.role} />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 border-t border-[#d4d8e8]/80 pt-4 dark:border-white/10">
                                <Button type="button" variant="outline" onClick={() => setShowEditModal(false)} className="rounded-xl text-sm settings-btn-secondary">
                                    {t('common.cancel')}
                                </Button>
                                <Button type="submit" disabled={editForm.processing} className="rounded-xl text-sm settings-btn-primary disabled:opacity-50">
                                    {editForm.processing ? t('common.saving') : t('users.saveChanges')}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </AdminLayout>
    );
}
