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

export default function CreateUser() {
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
            <Head title="Crear Usuario" />

            <div className="p-8">
                {/* Header */}
                <div className="mb-8">
                    <Link
                        href="/admin/users"
                        className="inline-flex items-center text-gray-600 hover:text-[#2e3f84] mb-4"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Volver a usuarios
                    </Link>
                    <h1 className="text-3xl font-bold text-black">Crear Nuevo Usuario</h1>
                    <p className="text-gray-600 mt-1">Completa los datos para crear un usuario</p>
                </div>

                {/* Form */}
                <div className="max-w-2xl">
                    <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-6">
                        {/* Nombre */}
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-sm font-medium text-black">
                                Nombre completo
                            </Label>
                            <Input
                                id="name"
                                type="text"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                placeholder="Ej: Juan Pérez"
                                className="border-0 bg-gray-100 focus:bg-gray-150 shadow-none"
                                required
                            />
                            <InputError message={errors.name} />
                        </div>

                        {/* Email */}
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-sm font-medium text-black">
                                Correo electrónico
                            </Label>
                            <Input
                                id="email"
                                type="email"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                placeholder="usuario@ejemplo.com"
                                className="border-0 bg-gray-100 focus:bg-gray-150 shadow-none"
                                required
                            />
                            <InputError message={errors.email} />
                        </div>

                        {/* Rol */}
                        <div className="space-y-2">
                            <Label htmlFor="role" className="text-sm font-medium text-black">
                                Rol
                            </Label>
                            <Select
                                value={data.role}
                                onValueChange={(value) => setData('role', value as 'admin' | 'advisor')}
                            >
                                <SelectTrigger className="border-0 bg-gray-100 focus:bg-gray-150 shadow-none">
                                    <SelectValue placeholder="Selecciona un rol" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="advisor">Asesor</SelectItem>
                                    <SelectItem value="admin">Administrador</SelectItem>
                                </SelectContent>
                            </Select>
                            <InputError message={errors.role} />
                        </div>

                        {/* Contraseña */}
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-sm font-medium text-black">
                                Contraseña
                            </Label>
                            <Input
                                id="password"
                                type="password"
                                value={data.password}
                                onChange={(e) => setData('password', e.target.value)}
                                placeholder="Mínimo 8 caracteres"
                                className="border-0 bg-gray-100 focus:bg-gray-150 shadow-none"
                                required
                            />
                            <InputError message={errors.password} />
                        </div>

                        {/* Confirmar Contraseña */}
                        <div className="space-y-2">
                            <Label htmlFor="password_confirmation" className="text-sm font-medium text-black">
                                Confirmar contraseña
                            </Label>
                            <Input
                                id="password_confirmation"
                                type="password"
                                value={data.password_confirmation}
                                onChange={(e) => setData('password_confirmation', e.target.value)}
                                placeholder="Repite la contraseña"
                                className="border-0 bg-gray-100 focus:bg-gray-150 shadow-none"
                                required
                            />
                            <InputError message={errors.password_confirmation} />
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-3 pt-4">
                            <Button
                                type="submit"
                                disabled={processing}
                                className="bg-[#2e3f84] hover:bg-[#1e2f74] text-white"
                            >
                                {processing ? 'Creando...' : 'Crear Usuario'}
                            </Button>
                            <Link href="/admin/users">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="border-gray-300 text-gray-700 hover:bg-gray-100"
                                >
                                    Cancelar
                                </Button>
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </AdminLayout>
    );
}
