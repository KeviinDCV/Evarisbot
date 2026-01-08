import { Head, useForm, Link, usePage } from '@inertiajs/react';
import AdminLayout from '@/layouts/admin-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import InputError from '@/components/input-error';
import { ArrowLeft, Users, Globe, UserCheck } from 'lucide-react';

interface Template {
    id: number;
    name: string;
    subject: string | null;
    content: string;
    is_active: boolean;
    is_global: boolean;
    message_type: 'text' | 'image' | 'document';
    media_url: string | null;
    media_filename: string | null;
    assigned_users?: number[];
}

interface EditTemplateProps {
    template: Template;
    users: Array<{
        id: number;
        name: string;
        role: string;
    }>;
}

export default function EditTemplate({ template, users }: EditTemplateProps) {
    const form = useForm({
        name: template.name,
        subject: template.subject || '',
        content: template.content,
        is_active: template.is_active,
        is_global: template.is_global,
        assigned_users: template.assigned_users || [],
        message_type: template.message_type,
        media_url: template.media_url || '',
        media_filename: template.media_filename || '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        form.put(`/admin/templates/${template.id}`);
    };

    return (
        <AdminLayout>
            <Head title={`Editar: ${template.name}`} />

            <div className="min-h-screen bg-[#f0f2f8] p-4 md:p-6 lg:p-8">
                {/* Container: Centered content box */}
                <div className="max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="mb-6 md:mb-8">
                        <Link
                            href="/admin/templates"
                            className="inline-flex items-center text-[#6b7494] hover:text-[#2e3f84] mb-3 md:mb-4 px-3 py-2 rounded-none hover:bg-gradient-to-b hover:from-[#f4f5f9] hover:to-[#f0f2f8] transition-all duration-200"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            <span className="hidden sm:inline">Volver a plantillas</span>
                            <span className="sm:hidden">Volver</span>
                        </Link>
                        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-[#2e3f84]">Editar Plantilla</h1>
                        <p className="text-sm md:text-base text-[#6b7494] mt-1">Modifica los datos de la plantilla</p>
                    </div>

                    {/* Form: Centered box with natural max-width */}
                    <div className="max-w-2xl mx-auto">
                        <form onSubmit={handleSubmit} className="bg-gradient-to-b from-white to-[#fafbfc] rounded-none shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_6px_rgba(46,63,132,0.06),0_6px_16px_rgba(46,63,132,0.1),inset_0_1px_0_rgba(255,255,255,0.9)] p-4 sm:p-6 lg:p-8 space-y-5 md:space-y-6">
                        {/* Nombre */}
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-sm font-medium text-[#2e3f84] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">
                                Nombre de la Plantilla
                            </Label>
                            <Input
                                id="name"
                                type="text"
                                value={form.data.name}
                                onChange={(e) => form.setData('name', e.target.value)}
                                placeholder="Ej: Bienvenida Nuevos Clientes"
                                className="border-0 bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] focus:from-white focus:to-[#fafbfc] shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_3px_rgba(46,63,132,0.06),inset_0_1px_0_rgba(255,255,255,0.6)] focus:shadow-[0_1px_3px_rgba(46,63,132,0.08),0_2px_6px_rgba(46,63,132,0.1),0_4px_12px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.06),0_3px_8px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] rounded-none transition-all duration-200"
                                required
                            />
                            <InputError message={form.errors.name} />
                        </div>

                        {/* Asunto */}
                        <div className="space-y-2">
                            <Label htmlFor="subject" className="text-sm font-medium text-[#2e3f84] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">
                                Asunto (Opcional)
                            </Label>
                            <Input
                                id="subject"
                                type="text"
                                value={form.data.subject}
                                onChange={(e) => form.setData('subject', e.target.value)}
                                placeholder="Breve descripción"
                                className="border-0 bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] focus:from-white focus:to-[#fafbfc] shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_3px_rgba(46,63,132,0.06),inset_0_1px_0_rgba(255,255,255,0.6)] focus:shadow-[0_1px_3px_rgba(46,63,132,0.08),0_2px_6px_rgba(46,63,132,0.1),0_4px_12px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.06),0_3px_8px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] rounded-none transition-all duration-200"
                            />
                            <InputError message={form.errors.subject} />
                        </div>

                        {/* Tipo de Mensaje */}
                        <div className="space-y-2">
                            <Label htmlFor="message_type" className="text-sm font-medium text-[#2e3f84] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">
                                Tipo de Mensaje
                            </Label>
                            <Select
                                value={form.data.message_type}
                                onValueChange={(value) => form.setData('message_type', value as 'text' | 'image' | 'document')}
                            >
                                <SelectTrigger className="border-0 bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_3px_rgba(46,63,132,0.06),inset_0_1px_0_rgba(255,255,255,0.6)] focus:shadow-[0_1px_3px_rgba(46,63,132,0.08),0_2px_6px_rgba(46,63,132,0.1),0_4px_12px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.06),0_3px_8px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] rounded-none transition-all duration-200">
                                    <SelectValue placeholder="Selecciona un tipo" />
                                </SelectTrigger>
                                <SelectContent className="bg-gradient-to-b from-white to-[#fafbfc] shadow-[0_2px_4px_rgba(46,63,132,0.08),0_4px_8px_rgba(46,63,132,0.12),0_8px_20px_rgba(46,63,132,0.16),inset_0_1px_0_rgba(255,255,255,0.9)] border-0 rounded-none">
                                    <SelectItem value="text" className="hover:bg-gradient-to-b hover:from-[#f8f9fc] hover:to-[#f4f5f9] focus:bg-[#f0f2f8] cursor-pointer rounded-none transition-all duration-150">Texto</SelectItem>
                                    <SelectItem value="image" className="hover:bg-gradient-to-b hover:from-[#f8f9fc] hover:to-[#f4f5f9] focus:bg-[#f0f2f8] cursor-pointer rounded-none transition-all duration-150">Imagen</SelectItem>
                                    <SelectItem value="document" className="hover:bg-gradient-to-b hover:from-[#f8f9fc] hover:to-[#f4f5f9] focus:bg-[#f0f2f8] cursor-pointer rounded-none transition-all duration-150">Documento</SelectItem>
                                </SelectContent>
                            </Select>
                            <InputError message={form.errors.message_type} />
                        </div>

                        {/* Campos de Media si no es texto */}
                        {form.data.message_type !== 'text' && (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="media_url" className="text-sm font-medium text-[#2e3f84] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">
                                        Imagen
                                    </Label>
                                    {form.data.media_url && (
                                        <div className="mb-2 p-2 bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] rounded">
                                            <img 
                                                src={form.data.media_url} 
                                                alt="Preview" 
                                                className="max-h-32 rounded"
                                            />
                                            <p className="text-xs text-[#6b7494] mt-1 truncate">{form.data.media_url}</p>
                                            <p className="text-xs text-[#6b7494]">{form.data.media_filename}</p>
                                        </div>
                                    )}
                                    <Input
                                        id="media_url"
                                        type="text"
                                        value={form.data.media_url}
                                        onChange={(e) => form.setData('media_url', e.target.value)}
                                        placeholder="/storage/templates/archivo.jpg"
                                        className="border-0 bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] focus:from-white focus:to-[#fafbfc] shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_3px_rgba(46,63,132,0.06),inset_0_1px_0_rgba(255,255,255,0.6)] focus:shadow-[0_1px_3px_rgba(46,63,132,0.08),0_2px_6px_rgba(46,63,132,0.1),0_4px_12px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.06),0_3px_8px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] rounded-none transition-all duration-200"
                                    />
                                    <InputError message={form.errors.media_url} />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="media_filename" className="text-sm font-medium text-[#2e3f84] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">
                                        Nombre del Archivo
                                    </Label>
                                    <Input
                                        id="media_filename"
                                        type="text"
                                        value={form.data.media_filename}
                                        onChange={(e) => form.setData('media_filename', e.target.value)}
                                        placeholder="archivo.jpg"
                                        className="border-0 bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] focus:from-white focus:to-[#fafbfc] shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_3px_rgba(46,63,132,0.06),inset_0_1px_0_rgba(255,255,255,0.6)] focus:shadow-[0_1px_3px_rgba(46,63,132,0.08),0_2px_6px_rgba(46,63,132,0.1),0_4px_12px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.06),0_3px_8px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] rounded-none transition-all duration-200"
                                    />
                                    <InputError message={form.errors.media_filename} />
                                </div>
                            </>
                        )}

                        {/* Tipo de Plantilla */}
                        <div className="space-y-3">
                            <Label className="text-sm font-medium text-[#2e3f84] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">
                                Tipo de Plantilla
                            </Label>
                            <div className="space-y-2">
                                <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                    <input
                                        type="radio"
                                        name="template_type"
                                        checked={form.data.is_global}
                                        onChange={() => {
                                            form.setData('is_global', true);
                                            form.setData('assigned_users', []);
                                        }}
                                        className="w-4 h-4 text-[#2e3f84]"
                                    />
                                    <Globe className="w-5 h-5 text-[#2e3f84]" />
                                    <div>
                                        <p className="font-medium text-[#2e3f84]">Plantilla Global</p>
                                        <p className="text-sm text-gray-500">Disponible para todos los asesores y administradores</p>
                                    </div>
                                </label>
                                <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                    <input
                                        type="radio"
                                        name="template_type"
                                        checked={!form.data.is_global}
                                        onChange={() => form.setData('is_global', false)}
                                        className="w-4 h-4 text-[#2e3f84]"
                                    />
                                    <Users className="w-5 h-5 text-[#2e3f84]" />
                                    <div>
                                        <p className="font-medium text-[#2e3f84]">Plantilla Asignada</p>
                                        <p className="text-sm text-gray-500">Disponible solo para los usuarios seleccionados</p>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* Asignar Usuarios (solo si no es global) */}
                        {!form.data.is_global && (
                            <div className="space-y-3">
                                <Label className="text-sm font-medium text-[#2e3f84] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">
                                    <UserCheck className="inline w-4 h-4 mr-2" />
                                    Asignar a Usuarios
                                </Label>
                                <div className="max-h-40 overflow-y-auto border rounded-lg p-3 space-y-2">
                                    {users?.map((user) => (
                                        <label key={user.id} className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded">
                                            <input
                                                type="checkbox"
                                                checked={form.data.assigned_users.includes(user.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        form.setData('assigned_users', [...form.data.assigned_users, user.id]);
                                                    } else {
                                                        form.setData('assigned_users', form.data.assigned_users.filter(id => id !== user.id));
                                                    }
                                                }}
                                                className="w-4 h-4 rounded border-gray-300 text-[#2e3f84] focus:ring-[#2e3f84]"
                                            />
                                            <div>
                                                <p className="font-medium text-sm">{user.name}</p>
                                                <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                                {form.data.assigned_users.length === 0 && !form.data.is_global && (
                                    <p className="text-sm text-amber-600">Debes seleccionar al menos un usuario</p>
                                )}
                            </div>
                        )}

                        {/* Contenido */}
                        <div className="space-y-2">
                            <Label htmlFor="content" className="text-sm font-medium text-[#2e3f84] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">
                                Contenido del Mensaje
                            </Label>
                            <Textarea
                                id="content"
                                value={form.data.content}
                                onChange={(e) => form.setData('content', e.target.value)}
                                placeholder="Escribe el mensaje aquí..."
                                rows={8}
                                className="border-0 bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] focus:from-white focus:to-[#fafbfc] shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_3px_rgba(46,63,132,0.06),inset_0_1px_0_rgba(255,255,255,0.6)] focus:shadow-[0_1px_3px_rgba(46,63,132,0.08),0_2px_6px_rgba(46,63,132,0.1),0_4px_12px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.06),0_3px_8px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] rounded-none transition-all duration-200"
                                required
                            />
                            <p className="text-xs text-gray-500">
                                Caracteres: {form.data.content.length} / 4096
                            </p>
                            <InputError message={form.errors.content} />
                        </div>

                        {/* Activar Plantilla */}
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="is_active"
                                checked={form.data.is_active}
                                onChange={(e) => form.setData('is_active', e.target.checked)}
                                className="w-4 h-4 rounded accent-[#2e3f84]"
                            />
                            <Label htmlFor="is_active" className="text-sm font-medium text-[#2e3f84] cursor-pointer">
                                Plantilla activa
                            </Label>
                        </div>

                        {/* Buttons: Stack on mobile, row on tablet+ */}
                        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-[#e8ebf5] mt-8">
                                <Button
                                    type="submit"
                                    disabled={form.processing}
                                    className="w-full sm:w-auto sm:flex-1 bg-gradient-to-b from-[#3e4f94] to-[#2e3f84] hover:from-[#4e5fa4] hover:to-[#3e4f94] text-white shadow-[0_1px_2px_rgba(46,63,132,0.15),0_2px_4px_rgba(46,63,132,0.2),0_4px_12px_rgba(46,63,132,0.25),inset_0_1px_0_rgba(255,255,255,0.15)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.2),0_4px_8px_rgba(46,63,132,0.25),0_8px_20px_rgba(46,63,132,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] hover:-translate-y-0.5 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),inset_0_0_8px_rgba(0,0,0,0.1)] active:translate-y-0 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                                >
                                    {form.processing ? 'Guardando...' : 'Guardar Cambios'}
                                </Button>
                                <Link href="/admin/templates" className="w-full sm:w-auto sm:flex-1">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full border-0 bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] text-[#2e3f84] shadow-[0_1px_2px_rgba(46,63,132,0.06),0_2px_4px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.1),0_4px_8px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.8)] hover:-translate-y-0.5 active:shadow-[inset_0_1px_2px_rgba(46,63,132,0.1)] active:translate-y-0 transition-all duration-200"
                                    >
                                        Cancelar
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
