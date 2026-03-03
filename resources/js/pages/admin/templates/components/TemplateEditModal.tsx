import { useForm, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import InputError from '@/components/input-error';
import { Paperclip, X, Image, Video, FileText, Users, Globe, UserCheck, Plus, Edit } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useRef, useState, useEffect, FormEvent } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface User {
    id: number;
    name: string;
    role: string;
}

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

interface TemplateEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    template: Template | null;
    users: User[];
}

export default function TemplateEditModal({ isOpen, onClose, template, users }: TemplateEditModalProps) {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [existingFiles, setExistingFiles] = useState<ExistingMediaFile[]>([]);
    const [newFiles, setNewFiles] = useState<NewMediaFile[]>([]);

    const form = useForm({
        name: '',
        subject: '',
        content: '',
        is_active: false,
        is_global: true,
        assigned_users: [] as number[],
    });

    // Cargar datos cuando se abre el modal o cambia el template
    useEffect(() => {
        if (template) {
            form.setData({
                name: template.name,
                subject: template.subject || '',
                content: template.content,
                is_active: template.is_active,
                is_global: template.is_global ?? true,
                assigned_users: template.assigned_users || [],
            });
            setExistingFiles(template.media_files || []);
            setNewFiles([]);
        }
    }, [template]);

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

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();

        if (!template) return;

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

        formData.append('existing_media_files', JSON.stringify(existingFiles));

        if (existingFiles.length === 0 && newFiles.length === 0) {
            formData.append('remove_media', '1');
        }

        newFiles.forEach((mediaFile, index) => {
            formData.append(`media_files[${index}]`, mediaFile.file);
        });

        router.post(`/admin/templates/${template.id}`, formData, {
            forceFormData: true,
            onSuccess: () => {
                handleClose();
            }
        });
    };

    const handleClose = () => {
        form.reset();
        form.clearErrors();
        setNewFiles([]);
        onClose();
    };

    if (!template) return null;

    const totalFiles = existingFiles.length + newFiles.length;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto card-gradient border border-border dark:border-[hsl(231,20%,22%)] p-0 gap-0">
                <DialogHeader className="px-6 py-4 border-b border-border dark:border-[hsl(231,20%,22%)]">
                    <DialogTitle className="settings-title flex items-center gap-2 text-xl">
                        <Edit className="w-5 h-5 text-primary" />
                        Editar Plantilla
                    </DialogTitle>
                    <DialogDescription className="settings-subtitle text-xs">
                        Modifica los datos de {template.name}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="px-6 py-4 space-y-5">
                    {/* Nombre */}
                    <div className="space-y-1.5">
                        <Label htmlFor="edit-name" className="text-sm font-semibold settings-label">
                            Nombre de la Plantilla
                        </Label>
                        <Input
                            id="edit-name"
                            type="text"
                            value={form.data.name}
                            onChange={(e) => form.setData('name', e.target.value)}
                            placeholder="Ej: Bienvenida Nuevos Clientes"
                            className="settings-input rounded-xl border-gray-200 dark:border-gray-800 focus:ring-2 focus:ring-[#2e3f84]/30"
                            required
                        />
                        <InputError message={form.errors.name} />
                    </div>

                    {/* Asunto */}
                    <div className="space-y-1.5">
                        <Label htmlFor="edit-subject" className="text-sm font-semibold settings-label">
                            Asunto (Opcional)
                        </Label>
                        <Input
                            id="edit-subject"
                            type="text"
                            value={form.data.subject}
                            onChange={(e) => form.setData('subject', e.target.value)}
                            placeholder="Breve descripción"
                            className="settings-input rounded-xl border-gray-200 dark:border-gray-800 focus:ring-2 focus:ring-[#2e3f84]/30"
                        />
                        <InputError message={form.errors.subject} />
                    </div>

                    {/* Mensaje */}
                    <div className="space-y-1.5">
                        <Label htmlFor="edit-content" className="text-sm font-semibold settings-label">
                            Contenido del Mensaje
                        </Label>
                        <Textarea
                            id="edit-content"
                            value={form.data.content}
                            onChange={(e) => form.setData('content', e.target.value)}
                            placeholder="Escribe el mensaje aquí..."
                            rows={4}
                            className="settings-input rounded-xl border-gray-200 dark:border-gray-800 focus:ring-2 focus:ring-[#2e3f84]/30"
                            required
                        />
                        <p className="text-xs settings-subtitle">
                            Caracteres: {form.data.content.length} / 4096
                        </p>
                        <InputError message={form.errors.content} />
                    </div>

                    {/* Archivos Adjuntos */}
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold settings-label flex items-center justify-between">
                            Archivos adjuntos
                            <span className="text-[10px] font-normal tracking-wide opacity-70">
                                {totalFiles} archivo(s) seleccionado(s)
                            </span>
                        </Label>
                        <p className="text-[10px] settings-subtitle leading-tight mb-2">
                            (JPG, PNG, GIF, MP4, PDF, DOC). Max 20MB p/u.
                        </p>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.mov,.avi,.3gp,.pdf,.doc,.docx"
                            onChange={handleFileSelect}
                            multiple
                            className="hidden"
                        />

                        {existingFiles.length > 0 && (
                            <div className="space-y-1 mb-2">
                                <p className="text-[10px] font-medium settings-subtitle uppercase tracking-wider">Archivos actuales</p>
                                {existingFiles.map((mediaFile, index) => (
                                    <div key={`existing-${index}`} className="p-1.5 rounded-xl bg-white/50 dark:bg-black/20 border border-gray-100 dark:border-gray-800 flex items-center gap-3">
                                        {mediaFile.type === 'image' ? (
                                            <img src={mediaFile.url} alt="Preview" className="w-8 h-8 object-cover rounded-lg" />
                                        ) : (
                                            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center">
                                                {getFileIcon(mediaFile.type)}
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold settings-title truncate">{mediaFile.filename}</p>
                                        </div>
                                        <button type="button" onClick={() => handleRemoveExistingFile(index)} className="p-1 rounded-lg text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {newFiles.length > 0 && (
                            <div className="space-y-1 mb-2">
                                <p className="text-[10px] font-medium text-green-600 dark:text-green-400 uppercase tracking-wider">Nuevos (sin subir)</p>
                                {newFiles.map((mediaFile, index) => (
                                    <div key={`new-${index}`} className="p-1.5 rounded-xl border border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-900/10 flex items-center gap-3">
                                        {mediaFile.preview ? (
                                            <img src={mediaFile.preview} alt="Preview" className="w-8 h-8 object-cover rounded-lg" />
                                        ) : (
                                            <div className="w-8 h-8 bg-green-200 dark:bg-green-800/40 text-green-700 dark:text-green-300 flex items-center justify-center rounded-lg">
                                                {getFileIcon(mediaFile.type)}
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold settings-title truncate">{mediaFile.file.name}</p>
                                        </div>
                                        <button type="button" onClick={() => handleRemoveNewFile(index)} className="p-1 rounded-lg text-red-500 hover:bg-red-500/10">
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full py-2.5 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors flex items-center justify-center gap-2 text-xs settings-subtitle"
                        >
                            <Paperclip className="w-4 h-4" />
                            Agregar archivos...
                        </button>
                    </div>

                    {/* Tipo de Plantilla */}
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold settings-label mb-1 block">
                            Tipo de Plantilla
                        </Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <label className="flex items-center space-x-3 p-2.5 border border-border dark:border-[hsl(231,20%,22%)] rounded-xl cursor-pointer bg-white/50 dark:bg-black/20">
                                <input
                                    type="radio"
                                    name="edit_template_type"
                                    checked={form.data.is_global}
                                    onChange={() => {
                                        form.setData('is_global', true);
                                        form.setData('assigned_users', []);
                                    }}
                                    className="w-3.5 h-3.5 text-primary"
                                />
                                <Globe className="w-4 h-4 settings-title flex-shrink-0" />
                                <div>
                                    <p className="text-xs font-bold settings-title">Global</p>
                                    <p className="text-[10px] settings-subtitle leading-tight">Para todos</p>
                                </div>
                            </label>
                            <label className="flex items-center space-x-3 p-2.5 border border-border dark:border-[hsl(231,20%,22%)] rounded-xl cursor-pointer bg-white/50 dark:bg-black/20">
                                <input
                                    type="radio"
                                    name="edit_template_type"
                                    checked={!form.data.is_global}
                                    onChange={() => form.setData('is_global', false)}
                                    className="w-3.5 h-3.5 text-primary"
                                />
                                <Users className="w-4 h-4 settings-title flex-shrink-0" />
                                <div>
                                    <p className="text-xs font-bold settings-title">Asignada</p>
                                    <p className="text-[10px] settings-subtitle leading-tight">Usuarios elegidos</p>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Asignar Usuarios */}
                    {!form.data.is_global && (
                        <div className="space-y-1.5">
                            <Label className="text-sm font-semibold settings-label">
                                <UserCheck className="inline w-3.5 h-3.5 mr-1" />
                                Asignar a Usuarios
                            </Label>
                            <div className="max-h-28 overflow-y-auto border border-border dark:border-[hsl(231,20%,22%)] rounded-xl p-1.5 space-y-0.5">
                                {users?.map((user) => (
                                    <label key={user.id} className="flex items-center space-x-2.5 cursor-pointer p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={form.data.assigned_users.includes(user.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) form.setData('assigned_users', [...form.data.assigned_users, user.id]);
                                                else form.setData('assigned_users', form.data.assigned_users.filter(id => id !== user.id));
                                            }}
                                            className="w-3.5 h-3.5 rounded text-primary focus:ring-primary"
                                        />
                                        <div>
                                            <p className="text-xs font-medium settings-title leading-tight">{user.name}</p>
                                            <p className="text-[10px] settings-subtitle capitalize leading-tight">{user.role}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Activar */}
                    <div className="flex items-center gap-1.5 pt-1">
                        <input
                            type="checkbox"
                            id="edit_is_active"
                            checked={form.data.is_active}
                            onChange={(e) => form.setData('is_active', e.target.checked)}
                            className="w-4 h-4 rounded text-primary"
                        />
                        <Label htmlFor="edit_is_active" className="text-sm font-semibold settings-label cursor-pointer">
                            Plantilla activa
                        </Label>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-3 border-t border-border dark:border-[hsl(231,20%,22%)] mt-4">
                        <Button type="button" variant="outline" onClick={handleClose} className="settings-btn-secondary rounded-xl text-sm h-9">
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={form.processing} className="settings-btn-primary rounded-xl text-sm h-9 chat-message-sent text-white shadow-md">
                            {form.processing ? 'Guardando...' : 'Guardar Cambios'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
