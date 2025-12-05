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

export default function CreateUser() {
    const { t } = useTranslation();
    const { data, setData, post, processing, errors } = useForm({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        role: 'advisor',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/admin/users');
    };

    return (
        <AdminLayout>
            <Head title={t('users.createTitle')} />

            <div className="min-h-screen bg-[#f0f2f8] p-4 md:p-6 lg:p-8">
                {/* Container: Centered content box */}
                <div className="max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="mb-6 md:mb-8">
                        <Link
                            href="/admin/users"
                            className="inline-flex items-center text-[#6b7494] hover:text-[#2e3f84] mb-3 md:mb-4 px-3 py-2 rounded-none hover:bg-gradient-to-b hover:from-[#f4f5f9] hover:to-[#f0f2f8] transition-all duration-200"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            <span className="hidden sm:inline">{t('users.backToUsers')}</span>
                            <span className="sm:hidden">{t('common.back')}</span>
                        </Link>
                        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-[#2e3f84]">{t('users.createTitle')}</h1>
                        <p className="text-sm md:text-base text-[#6b7494] mt-1">{t('users.createSubtitle')}</p>
                    </div>

                    {/* Form: Centered box with natural max-width */}
                    <div className="max-w-2xl mx-auto">
                        <form onSubmit={handleSubmit} className="bg-gradient-to-b from-white to-[#fafbfc] rounded-none shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_6px_rgba(46,63,132,0.06),0_6px_16px_rgba(46,63,132,0.1),inset_0_1px_0_rgba(255,255,255,0.9)] p-4 sm:p-6 lg:p-8 space-y-5 md:space-y-6">
                            {/* Nombre */}
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-sm font-medium text-[#2e3f84] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">
                                    {t('users.fullName')}
                                </Label>
                                <Input
                                    id="name"
                                    type="text"
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    placeholder={t('users.fullNamePlaceholder')}
                                    className="border-0 bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] focus:from-white focus:to-[#fafbfc] shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_3px_rgba(46,63,132,0.06),inset_0_1px_0_rgba(255,255,255,0.6)] focus:shadow-[0_1px_3px_rgba(46,63,132,0.08),0_2px_6px_rgba(46,63,132,0.1),0_4px_12px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.06),0_3px_8px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] rounded-none transition-all duration-200"
                                    required
                                />
                                <InputError message={errors.name} />
                            </div>

                            {/* Email */}
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-sm font-medium text-[#2e3f84] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">
                                    {t('auth.email')}
                                </Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                    placeholder={t('users.emailPlaceholder')}
                                    className="border-0 bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] focus:from-white focus:to-[#fafbfc] shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_3px_rgba(46,63,132,0.06),inset_0_1px_0_rgba(255,255,255,0.6)] focus:shadow-[0_1px_3px_rgba(46,63,132,0.08),0_2px_6px_rgba(46,63,132,0.1),0_4px_12px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.06),0_3px_8px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] rounded-none transition-all duration-200"
                                    required
                                />
                                <InputError message={errors.email} />
                            </div>

                            {/* Rol */}
                            <div className="space-y-2">
                                <Label htmlFor="role" className="text-sm font-medium text-[#2e3f84] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">
                                    {t('users.role')}
                                </Label>
                                <Select
                                    value={data.role}
                                    onValueChange={(value) => setData('role', value as 'admin' | 'advisor')}
                                >
                                    <SelectTrigger className="border-0 bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_3px_rgba(46,63,132,0.06),inset_0_1px_0_rgba(255,255,255,0.6)] focus:shadow-[0_1px_3px_rgba(46,63,132,0.08),0_2px_6px_rgba(46,63,132,0.1),0_4px_12px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.06),0_3px_8px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] rounded-none transition-all duration-200">
                                        <SelectValue placeholder={t('users.selectRole')} />
                                    </SelectTrigger>
                                    <SelectContent className="bg-gradient-to-b from-white to-[#fafbfc] shadow-[0_2px_4px_rgba(46,63,132,0.08),0_4px_8px_rgba(46,63,132,0.12),0_8px_20px_rgba(46,63,132,0.16),inset_0_1px_0_rgba(255,255,255,0.9)] border-0 rounded-none">
                                        <SelectItem value="advisor" className="hover:bg-gradient-to-b hover:from-[#f8f9fc] hover:to-[#f4f5f9] focus:bg-[#f0f2f8] cursor-pointer rounded-none transition-all duration-150">{t('users.roles.advisor')}</SelectItem>
                                        <SelectItem value="admin" className="hover:bg-gradient-to-b hover:from-[#f8f9fc] hover:to-[#f4f5f9] focus:bg-[#f0f2f8] cursor-pointer rounded-none transition-all duration-150">{t('users.roles.admin')}</SelectItem>
                                    </SelectContent>
                                </Select>
                                <InputError message={errors.role} />
                            </div>

                            {/* Contraseña */}
                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-sm font-medium text-[#2e3f84] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">
                                    {t('auth.password')}
                                </Label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    placeholder={t('users.passwordPlaceholder')}
                                    className="border-0 bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] focus:from-white focus:to-[#fafbfc] shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_3px_rgba(46,63,132,0.06),inset_0_1px_0_rgba(255,255,255,0.6)] focus:shadow-[0_1px_3px_rgba(46,63,132,0.08),0_2px_6px_rgba(46,63,132,0.1),0_4px_12px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.06),0_3px_8px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] rounded-none transition-all duration-200"
                                    required
                                />
                                <InputError message={errors.password} />
                            </div>

                            {/* Confirmar Contraseña */}
                            <div className="space-y-2">
                                <Label htmlFor="password_confirmation" className="text-sm font-medium text-[#2e3f84] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">
                                    {t('users.confirmPassword')}
                                </Label>
                                <Input
                                    id="password_confirmation"
                                    type="password"
                                    value={data.password_confirmation}
                                    onChange={(e) => setData('password_confirmation', e.target.value)}
                                    placeholder={t('users.confirmPasswordPlaceholder')}
                                    className="border-0 bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] focus:from-white focus:to-[#fafbfc] shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_3px_rgba(46,63,132,0.06),inset_0_1px_0_rgba(255,255,255,0.6)] focus:shadow-[0_1px_3px_rgba(46,63,132,0.08),0_2px_6px_rgba(46,63,132,0.1),0_4px_12px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.06),0_3px_8px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] rounded-none transition-all duration-200"
                                    required
                                />
                                <InputError message={errors.password_confirmation} />
                            </div>

                            {/* Buttons: Stack on mobile, row on tablet+ */}
                            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-[#e8ebf5] mt-8">
                                <Button
                                    type="submit"
                                    disabled={processing}
                                    className="w-full sm:w-auto sm:flex-1 bg-gradient-to-b from-[#3e4f94] to-[#2e3f84] hover:from-[#4e5fa4] hover:to-[#3e4f94] text-white shadow-[0_1px_2px_rgba(46,63,132,0.15),0_2px_4px_rgba(46,63,132,0.2),0_4px_12px_rgba(46,63,132,0.25),inset_0_1px_0_rgba(255,255,255,0.15)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.2),0_4px_8px_rgba(46,63,132,0.25),0_8px_20px_rgba(46,63,132,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] hover:-translate-y-0.5 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),inset_0_0_8px_rgba(0,0,0,0.1)] active:translate-y-0 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                                >
                                    {processing ? t('users.creating') : t('users.createUser')}
                                </Button>
                                <Link href="/admin/users" className="w-full sm:w-auto sm:flex-1">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full border-0 bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] text-[#2e3f84] shadow-[0_1px_2px_rgba(46,63,132,0.06),0_2px_4px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.1),0_4px_8px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] hover:-translate-y-0.5 active:shadow-[inset_0_1px_2px_rgba(46,63,132,0.1)] active:translate-y-0 transition-all duration-200"
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
