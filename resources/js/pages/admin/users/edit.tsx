import { Head, useForm } from '@inertiajs/react';
import AdminLayout from '@/layouts/admin-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@inertiajs/react';
import InputError from '@/components/input-error';
import { useTranslation } from 'react-i18next';

interface User {
    id: number;
    name: string;
    email: string;
    role: 'admin' | 'advisor';
}

interface EditUserProps {
    user: User;
}

export default function EditUser({ user }: EditUserProps) {
    const { t } = useTranslation();
    const { data, setData, put, processing, errors } = useForm({
        name: user.name,
        email: user.email,
        password: '',
        password_confirmation: '',
        role: user.role,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        put(`/admin/users/${user.id}`);
    };

    return (
        <AdminLayout>
            <Head title={t('users.editTitle')} />

            <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
                {/* Container: Centered content box */}
                <div className="max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="mb-6 md:mb-8">
                        <Link
                            href="/admin/users"
                            className="inline-flex items-center mb-3 md:mb-4 px-3 py-2 rounded-xl transition-all duration-200 settings-subtitle settings-back-link hover:bg-black/5 dark:hover:bg-white/5"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            <span className="hidden sm:inline">{t('users.backToUsers')}</span>
                            <span className="sm:hidden">{t('common.back')}</span>
                        </Link>
                        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold settings-title">{t('users.editTitle')}</h1>
                        <p className="text-sm md:text-base mt-1 settings-subtitle">{t('users.editSubtitle')}</p>
                    </div>

                    {/* Form: Centered box with natural max-width */}
                    <div className="max-w-2xl mx-auto">
                        <form onSubmit={handleSubmit} className="card-gradient rounded-2xl border border-white/40 dark:border-white/10 shadow-lg shadow-[#2e3f84]/5 p-4 sm:p-8 space-y-5 md:space-y-6 transition-all duration-300 hover:shadow-xl hover:shadow-[#2e3f84]/10">
                            {/* Nombre */}
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-sm font-medium settings-label">
                                    {t('users.fullName')}
                                </Label>
                                <Input
                                    id="name"
                                    type="text"
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    placeholder={t('users.fullNamePlaceholder')}
                                    className="settings-input rounded-xl border-gray-200 dark:border-gray-800 transition-all duration-200 focus:ring-2 focus:ring-[#2e3f84]/30"
                                    required
                                />
                                <InputError message={errors.name} />
                            </div>

                            {/* Email */}
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-sm font-medium settings-label">
                                    {t('auth.email')}
                                </Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                    placeholder={t('users.emailPlaceholder')}
                                    className="settings-input rounded-xl border-gray-200 dark:border-gray-800 transition-all duration-200 focus:ring-2 focus:ring-[#2e3f84]/30"
                                    required
                                />
                                <InputError message={errors.email} />
                            </div>

                            {/* Rol */}
                            <div className="space-y-2">
                                <Label htmlFor="role" className="text-sm font-medium settings-label">
                                    {t('users.role')}
                                </Label>
                                <Select
                                    value={data.role}
                                    onValueChange={(value) => setData('role', value as 'admin' | 'advisor')}
                                >
                                    <SelectTrigger className="settings-input rounded-xl border-gray-200 dark:border-gray-800 transition-all duration-200 focus:ring-2 focus:ring-[#2e3f84]/30">
                                        <SelectValue placeholder={t('users.selectRole')} />
                                    </SelectTrigger>
                                    <SelectContent className="card-gradient shadow-lg rounded-xl border border-white/40 dark:border-white/10 p-1">
                                        <SelectItem value="advisor" className="hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-gray-100 dark:focus:bg-gray-800 cursor-pointer rounded-lg transition-all duration-150">{t('users.roles.advisor')}</SelectItem>
                                        <SelectItem value="admin" className="hover:bg-gray-100 dark:hover:bg-gray-800 focus:bg-gray-100 dark:focus:bg-gray-800 cursor-pointer rounded-lg transition-all duration-150">{t('users.roles.admin')}</SelectItem>
                                    </SelectContent>
                                </Select>
                                <InputError message={errors.role} />
                            </div>

                            {/* Contraseña (Opcional) */}
                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-sm font-medium settings-label">
                                    {t('users.newPassword')}
                                </Label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    placeholder={t('users.newPasswordPlaceholder')}
                                    className="settings-input rounded-xl border-gray-200 dark:border-gray-800 transition-all duration-200 focus:ring-2 focus:ring-[#2e3f84]/30"
                                />
                                <InputError message={errors.password} />
                            </div>

                            {/* Confirmar Contraseña */}
                            {data.password && (
                                <div className="space-y-2">
                                    <Label htmlFor="password_confirmation" className="text-sm font-medium settings-label">
                                        {t('users.confirmNewPassword')}
                                    </Label>
                                    <Input
                                        id="password_confirmation"
                                        type="password"
                                        value={data.password_confirmation}
                                        onChange={(e) => setData('password_confirmation', e.target.value)}
                                        placeholder={t('users.confirmNewPasswordPlaceholder')}
                                        className="settings-input rounded-xl border-gray-200 dark:border-gray-800 transition-all duration-200 focus:ring-2 focus:ring-[#2e3f84]/30"
                                    />
                                    <InputError message={errors.password_confirmation} />
                                </div>
                            )}

                            {/* Buttons: Stack on mobile, row on tablet+ */}
                            <div className="flex flex-col sm:flex-row gap-4 pt-6 mt-8 border-t border-gray-200 dark:border-gray-800">
                                <Button
                                    type="submit"
                                    disabled={processing}
                                    className="w-full sm:flex-1 h-11 settings-btn-primary rounded-xl font-medium disabled:opacity-50 transition-all"
                                >
                                    {processing ? t('common.saving') : t('users.saveChanges')}
                                </Button>
                                <Link href="/admin/users" className="w-full sm:flex-1">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full h-11 settings-btn-secondary rounded-xl font-medium transition-all"
                                    >
                                        {t('common.cancel')}
                                    </Button>
                                </Link>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
