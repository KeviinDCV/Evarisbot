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

            <div className="p-8">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-black">Gestión de Usuarios</h1>
                        <p className="text-gray-600 mt-1">Administra los usuarios del sistema</p>
                    </div>
                    <Link href="/admin/users/create">
                        <Button className="bg-[#2e3f84] hover:bg-[#1e2f74] text-white">
                            <Plus className="w-4 h-4 mr-2" />
                            Crear Usuario
                        </Button>
                    </Link>
                </div>

                {/* Table */}
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50">
                                <TableHead className="font-semibold text-black">Nombre</TableHead>
                                <TableHead className="font-semibold text-black">Email</TableHead>
                                <TableHead className="font-semibold text-black">Rol</TableHead>
                                <TableHead className="font-semibold text-black">Fecha de Creación</TableHead>
                                <TableHead className="font-semibold text-black text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                                        No hay usuarios registrados
                                    </TableCell>
                                </TableRow>
                            ) : (
                                users.map((user) => (
                                    <TableRow key={user.id} className="hover:bg-gray-50">
                                        <TableCell className="font-medium text-black">{user.name}</TableCell>
                                        <TableCell className="text-gray-600">{user.email}</TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={user.role === 'admin' ? 'default' : 'secondary'}
                                                className={
                                                    user.role === 'admin'
                                                        ? 'bg-[#2e3f84] text-white'
                                                        : 'bg-gray-200 text-black'
                                                }
                                            >
                                                {user.role === 'admin' ? 'Administrador' : 'Asesor'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-gray-600">
                                            {new Date(user.created_at).toLocaleDateString('es-ES')}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Link href={`/admin/users/${user.id}/edit`}>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-gray-600 hover:text-[#2e3f84] hover:bg-gray-100"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>
                                                </Link>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setUserToDelete(user)}
                                                    className="text-gray-600 hover:text-red-600 hover:bg-red-50"
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

                {/* Modal de Confirmación de Eliminación */}
                <Dialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
                    <DialogContent className="bg-white">
                        <DialogHeader>
                            <DialogTitle className="text-black">¿Eliminar usuario?</DialogTitle>
                            <DialogDescription className="text-gray-600">
                                ¿Estás seguro de que deseas eliminar a <strong>{userToDelete?.name}</strong>?
                                Esta acción no se puede deshacer.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button variant="outline" className="border-gray-300 text-gray-700">
                                    Cancelar
                                </Button>
                            </DialogClose>
                            <Button
                                onClick={handleDelete}
                                className="bg-red-600 hover:bg-red-700 text-white"
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
