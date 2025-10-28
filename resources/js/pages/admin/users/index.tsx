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

interface User {
    id: number;
    name: string;
    email: string;
    role: 'admin' | 'advisor';
    created_at: string;
}

interface UsersIndexProps {
    users: User[];
}

export default function UsersIndex({ users }: UsersIndexProps) {
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
        return role === 'admin' ? 'Administrador' : 'Asesor';
    };

    return (
        <AdminLayout>
            <Head title="Gestión de Usuarios" />

            <div className="min-h-screen bg-[#f0f2f8] p-4 md:p-6 lg:p-8">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="mb-6" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
                            <div>
                                <h1 className="font-bold" style={{ fontSize: 'var(--text-3xl)', color: 'var(--primary-base)' }}>
                                    Gestión de Usuarios
                                </h1>
                                <p className="text-gray-600" style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-xs)' }}>
                                    Administra los usuarios del sistema
                                </p>
                            </div>
                            <Link href="/admin/users/create">
                                <Button 
                                    className="font-semibold text-white transition-all duration-200 border-0 relative overflow-hidden"
                                    style={{
                                        backgroundColor: 'var(--primary-base)',
                                        boxShadow: 'var(--shadow-md)',
                                        backgroundImage: 'var(--gradient-shine)',
                                        height: 'clamp(2.5rem, 2.5rem + 0.5vw, 3rem)',
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
                                    Nuevo Usuario
                                </Button>
                            </Link>
                        </div>

                        {/* Filtros */}
                        <div className="bg-gradient-to-b from-white to-[#fafbfc] rounded-xl p-4 shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_4px_rgba(46,63,132,0.06),0_4px_12px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.9)] flex flex-wrap gap-4 items-end">
                            <div style={{ flex: '1 1 250px', minWidth: '200px' }}>
                                <label className="font-semibold block mb-2" style={{ fontSize: 'var(--text-sm)', color: 'var(--primary-base)' }}>
                                    Buscar
                                </label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <Input
                                        type="text"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Buscar por nombre o email..."
                                        className="pl-10 border-0 rounded-lg transition-all duration-200"
                                        style={{
                                            backgroundColor: 'var(--layer-base)',
                                            boxShadow: 'var(--shadow-inset-sm)',
                                            height: 'clamp(2.5rem, 2.5rem + 0.5vw, 3rem)',
                                            fontSize: 'var(--text-sm)',
                                        }}
                                    />
                                </div>
                            </div>

                            <div style={{ flex: '0 1 150px' }}>
                                <label className="font-semibold block mb-2" style={{ fontSize: 'var(--text-sm)', color: 'var(--primary-base)' }}>
                                    Rol
                                </label>
                                <select
                                    value={roleFilter}
                                    onChange={(e) => setRoleFilter(e.target.value)}
                                    className="w-full border-0 rounded-lg transition-all duration-200"
                                    style={{
                                        backgroundColor: 'var(--layer-base)',
                                        boxShadow: 'var(--shadow-inset-sm)',
                                        height: 'clamp(2.5rem, 2.5rem + 0.5vw, 3rem)',
                                        fontSize: 'var(--text-sm)',
                                        padding: '0 var(--space-base)',
                                    }}
                                >
                                    <option value="all">Todos</option>
                                    <option value="admin">Administradores</option>
                                    <option value="advisor">Asesores</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Lista de Usuarios */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 'var(--space-lg)' }}>
                        {filteredUsers.map((user) => (
                            <div
                                key={user.id}
                                className="bg-gradient-to-b from-white to-[#fafbfc] rounded-xl p-5 shadow-[0_1px_3px_rgba(46,63,132,0.06),0_2px_6px_rgba(46,63,132,0.08),0_6px_16px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] transition-all duration-300"
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 'var(--space-md)',
                                }}
                            >
                                {/* Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                    <div style={{ flex: 1 }}>
                                        <h3 className="font-bold" style={{ fontSize: 'var(--text-lg)', color: 'var(--primary-base)' }}>
                                            {user.name}
                                        </h3>
                                        <p className="text-gray-600" style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-xs)' }}>
                                            {user.email}
                                        </p>
                                    </div>
                                    <Badge
                                        className={
                                            user.role === 'admin'
                                                ? 'bg-gradient-to-b from-[#3e4f94] to-[#2e3f84] text-white shadow-[0_1px_2px_rgba(46,63,132,0.2),0_2px_4px_rgba(46,63,132,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] flex-shrink-0 ml-2'
                                                : 'bg-gradient-to-b from-[#e8ebf5] to-[#dde1f0] text-[#2e3f84] shadow-[0_1px_2px_rgba(46,63,132,0.06),0_2px_3px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.6)] flex-shrink-0 ml-2'
                                        }
                                    >
                                        {getRoleLabel(user.role)}
                                    </Badge>
                                </div>

                                {/* Stats */}
                                <div 
                                    className="rounded-lg p-3"
                                    style={{
                                        backgroundColor: 'var(--layer-base)',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                                        <Calendar className="w-4 h-4 text-gray-500" />
                                        <span style={{ fontSize: 'var(--text-xs)', color: 'gray' }}>
                                            Registrado: {new Date(user.created_at).toLocaleDateString('es-ES', {
                                                day: '2-digit',
                                                month: 'short',
                                                year: 'numeric'
                                            })}
                                        </span>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: 'var(--space-xs)', paddingTop: 'var(--space-sm)', borderTop: '1px solid var(--layer-base)' }}>
                                    <Link href={`/admin/users/${user.id}/edit`} style={{ flex: 1 }}>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="w-full text-[#2e3f84] hover:text-white hover:bg-gradient-to-b hover:from-[#3e4f94] hover:to-[#2e3f84] hover:shadow-[0_2px_4px_rgba(46,63,132,0.2),0_4px_8px_rgba(46,63,132,0.25)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                                            style={{ padding: 'var(--space-xs) var(--space-sm)' }}
                                        >
                                            <Edit className="w-4 h-4 mr-2" />
                                            Editar
                                        </Button>
                                    </Link>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setUserToDelete(user)}
                                        className="text-red-600 transition-all duration-200"
                                        style={{ padding: 'var(--space-xs) var(--space-sm)' }}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Empty State */}
                    {filteredUsers.length === 0 && (
                        <div className="bg-gradient-to-b from-white to-[#fafbfc] rounded-xl p-12 text-center shadow-[0_1px_3px_rgba(46,63,132,0.06),0_2px_6px_rgba(46,63,132,0.08),0_6px_16px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.8)]">
                            <UserCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                            <h3 className="font-bold mb-2" style={{ fontSize: 'var(--text-xl)', color: 'var(--primary-base)' }}>
                                No hay usuarios
                            </h3>
                            <p className="text-gray-600 mb-6" style={{ fontSize: 'var(--text-sm)' }}>
                                No se encontraron usuarios con los filtros seleccionados
                            </p>
                        </div>
                    )}
                </div>

                {/* Modal de Confirmación */}
                <Dialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
                    <DialogContent className="bg-gradient-to-b from-white to-[#fafbfc] shadow-[0_4px_8px_rgba(46,63,132,0.1),0_8px_16px_rgba(46,63,132,0.15),0_16px_32px_rgba(46,63,132,0.2),inset_0_1px_0_rgba(255,255,255,0.9)]">
                        <DialogHeader>
                            <DialogTitle className="text-[#2e3f84]">¿Eliminar usuario?</DialogTitle>
                            <DialogDescription className="text-[#6b7494]">
                                ¿Estás seguro de que deseas eliminar a <strong>{userToDelete?.name}</strong>?
                                Esta acción no se puede deshacer.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button variant="outline" className="border-0 bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] text-[#2e3f84] shadow-[0_1px_2px_rgba(46,63,132,0.06),0_2px_4px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.1),0_4px_8px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] hover:-translate-y-0.5 active:shadow-[inset_0_1px_2px_rgba(46,63,132,0.1)] active:translate-y-0 transition-all duration-200">
                                    Cancelar
                                </Button>
                            </DialogClose>
                            <Button
                                onClick={handleDelete}
                                className="bg-gradient-to-b from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-[0_1px_2px_rgba(239,68,68,0.25),0_2px_4px_rgba(239,68,68,0.3),0_4px_12px_rgba(239,68,68,0.35),inset_0_1px_0_rgba(255,255,255,0.2)] hover:shadow-[0_2px_4px_rgba(239,68,68,0.3),0_4px_8px_rgba(239,68,68,0.35),0_8px_20px_rgba(239,68,68,0.4),inset_0_1px_0_rgba(255,255,255,0.25)] hover:-translate-y-0.5 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.25),inset_0_0_8px_rgba(0,0,0,0.15)] active:translate-y-0 transition-all duration-200"
                            >
                                Eliminar
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </AdminLayout>
    );
}
