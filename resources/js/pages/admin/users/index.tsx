import { Head, Link, router } from '@inertiajs/react';
import AdminLayout from '@/layouts/admin-layout';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
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
    const [userToDelete, setUserToDelete] = useState<User | null>(null);

    const handleDelete = () => {
        if (userToDelete) {
            router.delete(`/admin/users/${userToDelete.id}`, {
                onSuccess: () => setUserToDelete(null),
            });
        }
    };

    return (
        <AdminLayout>
            <Head title="Gestión de Usuarios" />

            <div className="min-h-screen bg-[#f0f2f8] p-4 md:p-8">
                {/* Header - MEDIUM SHADOW LEVEL */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 bg-gradient-to-b from-white to-[#fafbfc] p-6 rounded-2xl shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_4px_rgba(46,63,132,0.06),0_4px_12px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.9)]">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-[#2e3f84] drop-shadow-[0_1px_2px_rgba(46,63,132,0.1)]">Gestión de Usuarios</h1>
                        <p className="text-[#6b7494] mt-1">Administra los usuarios del sistema</p>
                    </div>
                    <Link href="/admin/users/create">
                        <Button className="bg-gradient-to-b from-[#3e4f94] to-[#2e3f84] hover:from-[#4e5fa4] hover:to-[#3e4f94] text-white shadow-[0_1px_2px_rgba(46,63,132,0.15),0_2px_4px_rgba(46,63,132,0.2),0_4px_12px_rgba(46,63,132,0.25),inset_0_1px_0_rgba(255,255,255,0.15)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.2),0_4px_8px_rgba(46,63,132,0.25),0_8px_20px_rgba(46,63,132,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] hover:-translate-y-0.5 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),inset_0_0_8px_rgba(0,0,0,0.1)] active:translate-y-0 transition-all duration-200">
                            <Plus className="w-4 h-4 mr-2" />
                            Crear Usuario
                        </Button>
                    </Link>
                </div>

                {/* Mobile: Cards View | Tablet+: Table View */}
                {/* LARGE SHADOW LEVEL (prominent) */}
                <div className="bg-gradient-to-b from-white to-[#fafbfc] rounded-2xl shadow-[0_1px_3px_rgba(46,63,132,0.06),0_2px_6px_rgba(46,63,132,0.08),0_6px_16px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] overflow-hidden">
                    {/* Mobile Cards - Reorganized with purpose */}
                    <div className="md:hidden">
                        {users.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 px-4 text-[#6b7494]">
                                <p className="text-center">No hay usuarios registrados</p>
                            </div>
                        ) : (
                            <div className="p-4 space-y-3">
                                {users.map((user) => (
                                    <div
                                        key={user.id}
                                        className="bg-gradient-to-b from-[#fafbfc] to-[#f8f9fc] p-4 rounded-xl shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_4px_rgba(46,63,132,0.06),inset_0_1px_0_rgba(255,255,255,0.9)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.06),0_4px_8px_rgba(46,63,132,0.08)] transition-all duration-200"
                                    >
                                        {/* Card Header */}
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-semibold text-black text-base truncate">{user.name}</h3>
                                                <p className="text-sm text-[#6b7494] truncate mt-0.5">{user.email}</p>
                                            </div>
                                            <Badge
                                                variant={user.role === 'admin' ? 'default' : 'secondary'}
                                                className={
                                                    user.role === 'admin'
                                                        ? 'bg-gradient-to-b from-[#3e4f94] to-[#2e3f84] text-white shadow-[0_1px_2px_rgba(46,63,132,0.2),0_2px_4px_rgba(46,63,132,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] flex-shrink-0 ml-2'
                                                        : 'bg-gradient-to-b from-[#e8ebf5] to-[#dde1f0] text-[#2e3f84] shadow-[0_1px_2px_rgba(46,63,132,0.06),0_2px_3px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.6)] flex-shrink-0 ml-2'
                                                }
                                            >
                                                {user.role === 'admin' ? 'Admin' : 'Asesor'}
                                            </Badge>
                                        </div>

                                        {/* Card Footer */}
                                        <div className="flex items-center justify-between pt-3 border-t border-[#e8ebf5]">
                                            <span className="text-xs text-[#6b7494]">
                                                {new Date(user.created_at).toLocaleDateString('es-ES', { 
                                                    day: '2-digit', 
                                                    month: 'short',
                                                    year: 'numeric'
                                                })}
                                            </span>
                                            <div className="flex gap-2">
                                                <Link href={`/admin/users/${user.id}/edit`}>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-[#6b7494] hover:text-[#2e3f84] hover:bg-gradient-to-b hover:from-[#f4f5f9] hover:to-[#f0f2f8] hover:shadow-[0_1px_2px_rgba(46,63,132,0.06),0_2px_4px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] transition-all duration-200"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>
                                                </Link>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setUserToDelete(user)}
                                                    className="text-[#6b7494] hover:text-red-600 hover:bg-gradient-to-b hover:from-red-50 hover:to-red-100 hover:shadow-[0_1px_2px_rgba(239,68,68,0.12),0_2px_4px_rgba(239,68,68,0.18),inset_0_1px_0_rgba(255,255,255,0.6)] transition-all duration-200"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Tablet+ Table View */}
                    <div className="hidden md:block">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-[#e8ebf5]">
                                    <TableHead className="font-semibold text-[#2e3f84]">Nombre</TableHead>
                                    <TableHead className="font-semibold text-[#2e3f84] hidden lg:table-cell">Email</TableHead>
                                    <TableHead className="font-semibold text-[#2e3f84]">Rol</TableHead>
                                    <TableHead className="font-semibold text-[#2e3f84] hidden xl:table-cell">Fecha de Creación</TableHead>
                                    <TableHead className="font-semibold text-[#2e3f84] text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-[#6b7494]">
                                            No hay usuarios registrados
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    users.map((user) => (
                                        <TableRow key={user.id} className="hover:bg-[#f8f9fc] transition-colors duration-150 border-b border-[#e8ebf5] last:border-0">
                                            <TableCell>
                                                <div>
                                                    <div className="font-medium text-black">{user.name}</div>
                                                    {/* Show email on tablet when hidden in column */}
                                                    <div className="text-sm text-[#6b7494] lg:hidden mt-0.5">{user.email}</div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-[#6b7494] hidden lg:table-cell">{user.email}</TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={user.role === 'admin' ? 'default' : 'secondary'}
                                                    className={
                                                        user.role === 'admin'
                                                            ? 'bg-gradient-to-b from-[#3e4f94] to-[#2e3f84] text-white shadow-[0_1px_2px_rgba(46,63,132,0.2),0_2px_4px_rgba(46,63,132,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.25),0_3px_6px_rgba(46,63,132,0.35),inset_0_1px_0_rgba(255,255,255,0.25)] transition-shadow duration-200'
                                                            : 'bg-gradient-to-b from-[#e8ebf5] to-[#dde1f0] text-[#2e3f84] shadow-[0_1px_2px_rgba(46,63,132,0.06),0_2px_3px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.6)] hover:shadow-[0_2px_3px_rgba(46,63,132,0.08),0_3px_5px_rgba(46,63,132,0.1),inset_0_1px_0_rgba(255,255,255,0.7)] transition-shadow duration-200'
                                                    }
                                                >
                                                    {user.role === 'admin' ? 'Admin' : 'Asesor'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-[#6b7494] hidden xl:table-cell">
                                                {new Date(user.created_at).toLocaleDateString('es-ES')}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Link href={`/admin/users/${user.id}/edit`}>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-[#6b7494] hover:text-[#2e3f84] hover:bg-gradient-to-b hover:from-[#f4f5f9] hover:to-[#f0f2f8] hover:shadow-[0_1px_2px_rgba(46,63,132,0.06),0_2px_4px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] hover:-translate-y-0.5 active:shadow-[inset_0_1px_2px_rgba(46,63,132,0.1)] active:translate-y-0 transition-all duration-200"
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </Button>
                                                    </Link>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setUserToDelete(user)}
                                                        className="text-[#6b7494] hover:text-red-600 hover:bg-gradient-to-b hover:from-red-50 hover:to-red-100 hover:shadow-[0_1px_2px_rgba(239,68,68,0.12),0_2px_4px_rgba(239,68,68,0.18),inset_0_1px_0_rgba(255,255,255,0.6)] hover:-translate-y-0.5 active:shadow-[inset_0_1px_2px_rgba(239,68,68,0.15)] active:translate-y-0 transition-all duration-200"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                {/* Modal de Confirmación de Eliminación - ULTRA LARGE SHADOW (overlay) */}
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
