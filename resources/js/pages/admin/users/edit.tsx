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
                            className="inline-flex items-center hover:bg-gradient-to-b hover:from-[#f4f5f9] hover:to-[#f0f2f8] dark:hover:from-[hsl(231,25%,18%)] dark:hover:to-[hsl(231,25%,16%)] mb-3 md:mb-4 px-3 py-2 rounded-none transition-all duration-200 dark:text-[hsl(231,15%,60%)] dark:hover:text-[hsl(231,55%,70%)]"
                            style={{ color: '#6b7494' }}
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            <span className="hidden sm:inline">{t('users.backToUsers')}</span>
                            <span className="sm:hidden">{t('common.back')}</span>
                        </Link>
                        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold dark:text-[hsl(231,15%,92%)]" style={{ color: '#2e3f84' }}>{t('users.editTitle')}</h1>
                        <p className="text-sm md:text-base mt-1 dark:text-[hsl(231,15%,60%)]" style={{ color: '#6b7494' }}>{t('users.editSubtitle')}</p>
                    </div>

                    {/* Form: Centered box with natural max-width */}
                    <div className="max-w-2xl mx-auto">
                        <form onSubmit={handleSubmit} className="card-gradient rounded-none shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_6px_rgba(46,63,132,0.06),0_6px_16px_rgba(46,63,132,0.1),inset_0_1px_0_rgba(255,255,255,0.9)] p-4 sm:p-6 lg:p-8 space-y-5 md:space-y-6">
                        {/* Nombre */}
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-sm font-medium dark:text-[hsl(231,15%,92%)]" style={{ color: '#2e3f84' }}>
                                {t('users.fullName')}
                            </Label>
                            <Input
                                id="name"
                                type="text"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                placeholder={t('users.fullNamePlaceholder')}
                                className="settings-input rounded-none transition-all duration-200"
                                required
                            />
                            <InputError message={errors.name} />
                        </div>

                        {/* Email */}
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-sm font-medium dark:text-[hsl(231,15%,92%)]" style={{ color: '#2e3f84' }}>
                                {t('auth.email')}
                            </Label>
                            <Input
                                id="email"
                                type="email"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                placeholder={t('users.emailPlaceholder')}
                                className="settings-input rounded-none transition-all duration-200"
                                required
                            />
                            <InputError message={errors.email} />
                        </div>

                        {/* Rol */}
                        <div className="space-y-2">
                            <Label htmlFor="role" className="text-sm font-medium dark:text-[hsl(231,15%,92%)]" style={{ color: '#2e3f84' }}>
                                {t('users.role')}
                            </Label>
                            <Select
                                value={data.role}
                                onValueChange={(value) => setData('role', value as 'admin' | 'advisor')}
                            >
                                <SelectTrigger className="settings-input rounded-none transition-all duration-200">
                                    <SelectValue placeholder={t('users.selectRole')} />
                                </SelectTrigger>
                                <SelectContent className="card-gradient shadow-[0_2px_4px_rgba(46,63,132,0.08),0_4px_8px_rgba(46,63,132,0.12),0_8px_20px_rgba(46,63,132,0.16),inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-[0_2px_4px_rgba(0,0,0,0.2),0_4px_8px_rgba(0,0,0,0.25),0_8px_20px_rgba(0,0,0,0.3)] border-0 rounded-none">
                                    <SelectItem value="advisor" className="hover:bg-gradient-to-b hover:from-[#f8f9fc] hover:to-[#f4f5f9] dark:hover:from-[hsl(231,25%,18%)] dark:hover:to-[hsl(231,25%,16%)] focus:bg-background cursor-pointer rounded-none transition-all duration-150">{t('users.roles.advisor')}</SelectItem>
                                    <SelectItem value="admin" className="hover:bg-gradient-to-b hover:from-[#f8f9fc] hover:to-[#f4f5f9] dark:hover:from-[hsl(231,25%,18%)] dark:hover:to-[hsl(231,25%,16%)] focus:bg-background cursor-pointer rounded-none transition-all duration-150">{t('users.roles.admin')}</SelectItem>
                                </SelectContent>
                            </Select>
                            <InputError message={errors.role} />
                        </div>

                        {/* Contraseña (Opcional) */}
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-sm font-medium dark:text-[hsl(231,15%,92%)]" style={{ color: '#2e3f84' }}>
                                {t('users.newPassword')}
                            </Label>
                            <Input
                                id="password"
                                type="password"
                                value={data.password}
                                onChange={(e) => setData('password', e.target.value)}
                                placeholder={t('users.newPasswordPlaceholder')}
                                className="settings-input rounded-none transition-all duration-200"
                            />
                            <InputError message={errors.password} />
                        </div>

                        {/* Confirmar Contraseña */}
                        {data.password && (
                            <div className="space-y-2">
                                <Label htmlFor="password_confirmation" className="text-sm font-medium dark:text-[hsl(231,15%,92%)]" style={{ color: '#2e3f84' }}>
                                    {t('users.confirmNewPassword')}
                                </Label>
                                <Input
                                    id="password_confirmation"
                                    type="password"
                                    value={data.password_confirmation}
                                    onChange={(e) => setData('password_confirmation', e.target.value)}
                                    placeholder={t('users.confirmNewPasswordPlaceholder')}
                                    className="settings-input rounded-none transition-all duration-200"
                                />
                                <InputError message={errors.password_confirmation} />
                            </div>
                        )}

                        {/* Buttons: Stack on mobile, row on tablet+ */}
                        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border dark:border-[hsl(231,20%,20%)] mt-8">
                                <Button
                                    type="submit"
                                    disabled={processing}
                                    className="w-full sm:w-auto sm:flex-1 settings-btn-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                                >
                                    {processing ? t('common.saving') : t('users.saveChanges')}
                                </Button>
                                <Link href="/admin/users" className="w-full sm:w-auto sm:flex-1">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full settings-btn-secondary"
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
