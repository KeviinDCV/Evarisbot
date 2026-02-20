import { Head, useForm, Link, router } from '@inertiajs/react';
import AdminLayout from '@/layouts/admin-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import InputError from '@/components/input-error';
import { ArrowLeft, Users, Globe, UserCheck, X, Image, Video, FileText, Paperclip, Plus } from 'lucide-react';
import { useRef, useState } from 'react';

interface ExistingMediaFile {
    url: string;
    filename: string;
    type: 'image' | 'video' | 'document';
}

interface NewMediaFile {
    file: File;
    preview: string | null;
    type: 'image' | 'video' | 'document';
}

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
    media_files?: ExistingMediaFile[];
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
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Archivos existentes (ya guardados en el servidor)
    const [existingFiles, setExistingFiles] = useState<ExistingMediaFile[]>(
        template.media_files || []
    );

    // Nuevos archivos seleccionados
    const [newFiles, setNewFiles] = useState<NewMediaFile[]>([]);

    const form = useForm({
        name: template.name,
        subject: template.subject || '',
        content: template.content,
        is_active: template.is_active,
        is_global: template.is_global,
        assigned_users: template.assigned_users || [],
        message_type: template.message_type,
    });

    const getFileType = (file: File): 'image' | 'video' | 'document' => {
        if (file.type.startsWith('image/')) return 'image';
        if (file.type.startsWith('video/')) return 'video';
        return 'document';
    };

    const getFileIcon = (type: 'image' | 'video' | 'document') => {
        switch (type) {
            case 'image': return <Image className="w-5 h-5" />;
            case 'video': return <Video className="w-5 h-5" />;
            default: return <FileText className="w-5 h-5" />;
        }
    };

    const getFileTypeLabel = (type: 'image' | 'video' | 'document') => {
        switch (type) {
            case 'image': return 'Imagen';
            case 'video': return 'Video';
            default: return 'Documento';
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const newMediaFiles: NewMediaFile[] = [];

        Array.from(files).forEach(file => {
            const type = getFileType(file);
            let preview: string | null = null;

            if (type === 'image') {
                preview = URL.createObjectURL(file);
            }

            newMediaFiles.push({ file, preview, type });
        });

        setNewFiles(prev => [...prev, ...newMediaFiles]);

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleRemoveExistingFile = (index: number) => {
        setExistingFiles(prev => {
            const newFiles = [...prev];
            newFiles.splice(index, 1);
            return newFiles;
        });
    };

    const handleRemoveNewFile = (index: number) => {
        setNewFiles(prev => {
            const files = [...prev];
            if (files[index].preview) {
                URL.revokeObjectURL(files[index].preview!);
            }
            files.splice(index, 1);
            return files;
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const formData = new FormData();
        formData.append('_method', 'PUT');
        formData.append('name', form.data.name);
        formData.append('subject', form.data.subject);
        formData.append('content', form.data.content);
        formData.append('is_active', form.data.is_active ? '1' : '0');
        formData.append('is_global', form.data.is_global ? '1' : '0');

        form.data.assigned_users.forEach(userId => {
            formData.append('assigned_users[]', userId.toString());
        });

        // Enviar archivos existentes que se mantienen
        formData.append('existing_media_files', JSON.stringify(existingFiles));

        // Agregar nuevos archivos
        newFiles.forEach((mediaFile, index) => {
            formData.append(`media_files[${index}]`, mediaFile.file);
        });

        router.post(`/admin/templates/${template.id}`, formData, {
            forceFormData: true,
        });
    };

    const totalFiles = existingFiles.length + newFiles.length;

    return (
        <AdminLayout>
            <Head title={`Editar: ${template.name}`} />

            <div className="min-h-screen p-4 md:p-6 lg:p-8 bg-background">
                {/* Container: Centered content box */}
                <div className="max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="mb-6 md:mb-8">
                        <Link
                            href="/admin/templates"
                            className="inline-flex items-center text-muted-foreground mb-3 md:mb-4 px-3 py-2 rounded-xl transition-all duration-200 hover:bg-black/5 dark:hover:bg-white/5 hover:text-primary"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            <span className="hidden sm:inline">Volver a plantillas</span>
                            <span className="sm:hidden">Volver</span>
                        </Link>
                        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-primary">Editar Plantilla</h1>
                        <p className="text-sm md:text-base text-muted-foreground mt-1">Modifica los datos de la plantilla</p>
                    </div>

                    {/* Form: Centered box with natural max-width */}
                    <div className="max-w-2xl mx-auto">
                        <form onSubmit={handleSubmit} className="card-gradient rounded-2xl border border-white/40 dark:border-white/10 shadow-lg shadow-[#2e3f84]/5 p-4 sm:p-8 space-y-5 md:space-y-6 transition-all duration-300 hover:shadow-xl hover:shadow-[#2e3f84]/10">
                            {/* Nombre */}
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-sm font-medium text-primary">
                                    Nombre de la Plantilla
                                </Label>
                                <Input
                                    id="name"
                                    type="text"
                                    value={form.data.name}
                                    onChange={(e) => form.setData('name', e.target.value)}
                                    placeholder="Ej: Bienvenida Nuevos Clientes"
                                    className="settings-input rounded-xl border-gray-200 dark:border-gray-800 transition-all duration-200 focus:ring-2 focus:ring-[#2e3f84]/30"
                                    required
                                />
                                <InputError message={form.errors.name} />
                            </div>

                            {/* Asunto */}
                            <div className="space-y-2">
                                <Label htmlFor="subject" className="text-sm font-medium text-primary">
                                    Asunto (Opcional)
                                </Label>
                                <Input
                                    id="subject"
                                    type="text"
                                    value={form.data.subject}
                                    onChange={(e) => form.setData('subject', e.target.value)}
                                    placeholder="Breve descripción"
                                    className="settings-input rounded-xl border-gray-200 dark:border-gray-800 transition-all duration-200 focus:ring-2 focus:ring-[#2e3f84]/30"
                                />
                                <InputError message={form.errors.subject} />
                            </div>

                            {/* Archivos Adjuntos (Múltiples) */}
                            <div className="space-y-2">
                                <Label className="text-sm font-medium text-primary">
                                    Archivos adjuntos
                                </Label>
                                <p className="text-xs text-muted-foreground mb-2">
                                    Puedes adjuntar múltiples imágenes, videos o documentos. Formatos soportados: JPG, PNG, GIF, WebP (se convierte a PNG), MP4, MOV, PDF, DOC. Máximo 20MB por archivo.
                                </p>

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.mov,.avi,.3gp,.pdf,.doc,.docx"
                                    onChange={handleFileSelect}
                                    multiple
                                    className="hidden"
                                />

                                {/* Archivos existentes */}
                                {existingFiles.length > 0 && (
                                    <div className="space-y-2 mb-3">
                                        <p className="text-xs font-medium text-muted-foreground">Archivos actuales:</p>
                                        {existingFiles.map((mediaFile, index) => (
                                            <div
                                                key={`existing-${index}`}
                                                className="p-3 rounded-xl bg-white/50 dark:bg-black/20 border border-gray-100 dark:border-gray-800"
                                            >
                                                <div className="flex items-center gap-3">
                                                    {mediaFile.type === 'image' ? (
                                                        <img src={mediaFile.url} alt="Preview" className="w-12 h-12 object-cover rounded-lg" />
                                                    ) : (
                                                        <div className="w-12 h-12 chat-message-sent rounded-lg flex items-center justify-center text-white">
                                                            {getFileIcon(mediaFile.type)}
                                                        </div>
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-primary truncate">{mediaFile.filename}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {getFileTypeLabel(mediaFile.type)}
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveExistingFile(index)}
                                                        className="p-2 rounded-xl transition-all text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Nuevos archivos seleccionados */}
                                {newFiles.length > 0 && (
                                    <div className="space-y-2 mb-3">
                                        <p className="text-xs font-medium text-muted-foreground">Nuevos archivos:</p>
                                        {newFiles.map((mediaFile, index) => (
                                            <div
                                                key={`new-${index}`}
                                                className="p-3 rounded-xl border border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-950/30"
                                            >
                                                <div className="flex items-center gap-3">
                                                    {mediaFile.preview ? (
                                                        <img src={mediaFile.preview} alt="Preview" className="w-12 h-12 object-cover rounded-lg" />
                                                    ) : (
                                                        <div className="w-12 h-12 chat-message-sent rounded-lg flex items-center justify-center text-white">
                                                            {getFileIcon(mediaFile.type)}
                                                        </div>
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-primary truncate">{mediaFile.file.name}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {getFileTypeLabel(mediaFile.type)} • {(mediaFile.file.size / 1024 / 1024).toFixed(2)} MB • <span className="text-green-600 dark:text-green-400">Nuevo</span>
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveNewFile(index)}
                                                        className="p-2 rounded-xl transition-all text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Botón para agregar archivos */}
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full p-4 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl hover:border-primary transition-all duration-200 flex flex-col items-center gap-2 text-muted-foreground hover:bg-[#2e3f84]/5 dark:hover:bg-[hsl(231,55%,55%)]/5"
                                >
                                    {totalFiles === 0 ? (
                                        <>
                                            <Paperclip className="w-8 h-8" />
                                            <span className="text-sm">Haz clic para seleccionar archivos</span>
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="w-6 h-6" />
                                            <span className="text-sm">Agregar más archivos</span>
                                        </>
                                    )}
                                </button>

                                {totalFiles > 0 && (
                                    <p className="text-xs text-muted-foreground mt-2">
                                        {totalFiles} archivo{totalFiles !== 1 ? 's' : ''} en total
                                    </p>
                                )}
                            </div>

                            {/* Tipo de Plantilla */}
                            <div className="space-y-3">
                                <Label className="text-sm font-medium text-primary">
                                    Tipo de Plantilla
                                </Label>
                                <div className="space-y-2">
                                    <label
                                        className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-800 rounded-xl cursor-pointer transition-colors bg-white/50 dark:bg-black/20 hover:bg-black/5 dark:hover:bg-white/5"
                                    >
                                        <input
                                            type="radio"
                                            name="template_type"
                                            checked={form.data.is_global}
                                            onChange={() => {
                                                form.setData('is_global', true);
                                                form.setData('assigned_users', []);
                                            }}
                                            className="w-4 h-4 text-primary"
                                        />
                                        <Globe className="w-5 h-5 text-primary" />
                                        <div>
                                            <p className="font-medium text-primary">Plantilla Global</p>
                                            <p className="text-sm text-muted-foreground">Disponible para todos los asesores y administradores</p>
                                        </div>
                                    </label>
                                    <label
                                        className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-800 rounded-xl cursor-pointer transition-colors bg-white/50 dark:bg-black/20 hover:bg-black/5 dark:hover:bg-white/5"
                                    >
                                        <input
                                            type="radio"
                                            name="template_type"
                                            checked={!form.data.is_global}
                                            onChange={() => form.setData('is_global', false)}
                                            className="w-4 h-4 text-primary"
                                        />
                                        <Users className="w-5 h-5 text-primary" />
                                        <div>
                                            <p className="font-medium text-primary">Plantilla Asignada</p>
                                            <p className="text-sm text-muted-foreground">Disponible solo para los usuarios seleccionados</p>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Asignar Usuarios (solo si no es global) */}
                            {!form.data.is_global && (
                                <div className="space-y-3">
                                    <Label className="text-sm font-medium text-primary">
                                        <UserCheck className="inline w-4 h-4 mr-2" />
                                        Asignar a Usuarios
                                    </Label>
                                    <div
                                        className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-800 rounded-xl p-3 space-y-2 bg-white/50 dark:bg-black/20 template-users-list p-1"
                                    >
                                        {users?.map((user) => (
                                            <label
                                                key={user.id}
                                                className="flex items-center space-x-3 cursor-pointer p-2 rounded transition-colors hover:bg-accent"
                                            >
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
                                                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                                                />
                                                <div>
                                                    <p className="font-medium text-sm text-primary">{user.name}</p>
                                                    <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                    {form.data.assigned_users.length === 0 && !form.data.is_global && (
                                        <p className="text-sm text-amber-600 dark:text-amber-400">Debes seleccionar al menos un usuario</p>
                                    )}
                                </div>
                            )}

                            {/* Contenido */}
                            <div className="space-y-2">
                                <Label htmlFor="content" className="text-sm font-medium text-primary">
                                    Contenido del Mensaje
                                </Label>
                                <Textarea
                                    id="content"
                                    value={form.data.content}
                                    onChange={(e) => form.setData('content', e.target.value)}
                                    placeholder="Escribe el mensaje aquí..."
                                    rows={8}
                                    className="settings-input rounded-xl border-gray-200 dark:border-gray-800 transition-all duration-200 focus:ring-2 focus:ring-[#2e3f84]/30"
                                    required
                                />
                                <p className="text-xs text-muted-foreground">
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
                                    className="w-4 h-4 rounded accent-primary"
                                />
                                <Label htmlFor="is_active" className="text-sm font-medium text-primary cursor-pointer">
                                    Plantilla activa
                                </Label>
                            </div>

                            {/* Buttons: Stack on mobile, row on tablet+ */}
                            <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-200 dark:border-gray-800 mt-8">
                                <Button
                                    type="submit"
                                    disabled={form.processing}
                                    className="w-full sm:flex-1 h-11 settings-btn-primary rounded-xl font-medium disabled:opacity-50 transition-all"
                                >
                                    {form.processing ? 'Guardando...' : 'Guardar Cambios'}
                                </Button>
                                <Link href="/admin/templates" className="w-full sm:flex-1">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full h-11 settings-btn-secondary rounded-xl font-medium transition-all"
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
