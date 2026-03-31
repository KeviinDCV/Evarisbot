import { useForm } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import InputError from '@/components/input-error';
import { Paperclip, X, Image, Video, FileText, Users, Globe, UserCheck, Plus, MessageSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useRef, useState, FormEvent } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface User {
    id: number;
    name: string;
    role: string;
}

interface TemplateCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
    users: User[];
}

interface MediaFile {
    file: File;
    preview: string | null;
    type: 'image' | 'video' | 'document';
}

export default function TemplateCreateModal({ isOpen, onClose, users }: TemplateCreateModalProps) {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFiles, setSelectedFiles] = useState<MediaFile[]>([]);

    const form = useForm({
        name: '',
        content: '',
        is_active: false,
        is_global: true,
        assigned_users: [] as number[],
    });

    const getFileType = (file: File): 'image' | 'video' | 'document' => {
        if (file.type.startsWith('image/')) return 'image';
        if (file.type.startsWith('video/')) return 'video';
        return 'document';
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        const newFiles: MediaFile[] = [];

        Array.from(files).forEach(file => {
            const type = getFileType(file);
            let preview: string | null = null;

            if (type === 'image') {
                preview = URL.createObjectURL(file);
            }

            newFiles.push({ file, preview, type });
        });

        setSelectedFiles(prev => [...prev, ...newFiles]);

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleRemoveFile = (index: number) => {
        setSelectedFiles(prev => {
            const newFiles = [...prev];
            if (newFiles[index].preview) {
                URL.revokeObjectURL(newFiles[index].preview!);
            }
            newFiles.splice(index, 1);
            return newFiles;
        });
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

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();

        // Limpiamos los arrays no serializables en el payload normal de useForm
        // Sin embargo, para archivos necesitamos forceFormData u object manipulation
        // En Inertia JS el `useForm` postea como form data automáticamente si mandamos Files
        // Pero usamos router o adaptamos form data
        // La implementación que teníamos usa `router.post` custom con FormData
        // Adaptemos lo que sea para usar el form hook:

        const formData = new FormData();
        formData.append('name', form.data.name);
        formData.append('content', form.data.content);
        formData.append('is_active', form.data.is_active ? '1' : '0');
        formData.append('is_global', form.data.is_global ? '1' : '0');

        form.data.assigned_users.forEach(userId => {
            formData.append('assigned_users[]', userId.toString());
        });

        selectedFiles.forEach((mediaFile, index) => {
            formData.append(`media_files[${index}]`, mediaFile.file);
        });

        // Hacemos el request con Inertia router para mayor flexibilidad y control manual de Modal
        import('@inertiajs/react').then(({ router }) => {
            router.post('/admin/templates', formData, {
                forceFormData: true,
                onSuccess: () => {
                    handleClose();
                    toast.success('Plantilla creada exitosamente');
                },
                onError: () => toast.error('Error al crear la plantilla'),
            });
        });
    };

    const handleClose = () => {
        form.reset();
        form.clearErrors();
        setSelectedFiles([]);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto card-gradient border border-border dark:border-[hsl(231,20%,22%)] p-0 gap-0">
                <DialogHeader className="px-6 py-4 border-b border-border dark:border-[hsl(231,20%,22%)]">
                    <DialogTitle className="settings-title flex items-center gap-2 text-xl">
                        <MessageSquare className="w-5 h-5 text-primary" />
                        {t('templates.createTitle')}
                    </DialogTitle>
                    <DialogDescription className="settings-subtitle text-xs">
                        {t('templates.createSubtitle')}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="px-6 py-4 space-y-5">
                    {/* Nombre */}
                    <div className="space-y-1.5">
                        <Label htmlFor="create-name" className="text-sm font-semibold settings-label">
                            {t('templates.templateName')}
                        </Label>
                        <Input
                            id="create-name"
                            type="text"
                            value={form.data.name}
                            onChange={(e) => form.setData('name', e.target.value)}
                            placeholder={t('templates.templateNamePlaceholder')}
                            className="settings-input rounded-xl border-gray-200 dark:border-gray-800 focus:ring-2 focus:ring-[#2e3f84]/30"
                            required
                        />
                        <InputError message={form.errors.name} />
                    </div>

                    {/* Mensaje */}
                    <div className="space-y-1.5">
                        <Label htmlFor="create-content" className="text-sm font-semibold settings-label">
                            {t('templates.content')}
                        </Label>
                        <Textarea
                            id="create-content"
                            value={form.data.content}
                            onChange={(e) => form.setData('content', e.target.value)}
                            placeholder={t('templates.contentPlaceholder')}
                            rows={4}
                            className="settings-input rounded-xl border-gray-200 dark:border-gray-800 focus:ring-2 focus:ring-[#2e3f84]/30"
                            required
                        />
                        <p className="text-xs settings-subtitle">
                            {t('templates.characters')}: {form.data.content.length} / 4096
                        </p>
                        <InputError message={form.errors.content} />
                    </div>

                    {/* Archivos Adjuntos */}
                    <div className="space-y-1.5">
                        <Label className="text-sm font-semibold settings-label">
                            Archivos adjuntos (opcional)
                        </Label>
                        <p className="text-xs settings-subtitle mb-2">
                            Múltiples formatos soportados (JPG, PNG, GIF, MP4, PDF, DOC). Max 20MB p/u.
                        </p>

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.mov,.avi,.3gp,.pdf,.doc,.docx"
                            onChange={handleFileSelect}
                            multiple
                            className="hidden"
                        />

                        {selectedFiles.length > 0 && (
                            <div className="space-y-2 mb-3">
                                {selectedFiles.map((mediaFile, index) => (
                                    <div key={index} className="p-2 rounded-xl user-stats-box bg-white/50 dark:bg-black/20 border border-gray-100 dark:border-gray-800 flex items-center gap-3">
                                        {mediaFile.preview ? (
                                            <img src={mediaFile.preview} alt="Preview" className="w-10 h-10 object-cover rounded-lg" />
                                        ) : (
                                            <div className="w-10 h-10 chat-message-sent rounded-lg flex items-center justify-center text-white">
                                                {getFileIcon(mediaFile.type)}
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium settings-title truncate">{mediaFile.file.name}</p>
                                            <p className="text-[10px] settings-subtitle">
                                                {getFileTypeLabel(mediaFile.type)} • {(mediaFile.file.size / 1024 / 1024).toFixed(2)} MB
                                            </p>
                                        </div>
                                        <button type="button" onClick={() => handleRemoveFile(index)} className="p-1.5 rounded-xl settings-subtitle hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full py-4 border-2 border-dashed border-[#e2e4ed] dark:border-[hsl(231,20%,25%)] rounded-xl hover:border-[#2e3f84] dark:hover:border-[hsl(231,55%,55%)] transition-all duration-200 flex flex-col items-center gap-1 settings-subtitle"
                        >
                            <Paperclip className="w-5 h-5 mb-1" />
                            <span className="text-xs font-semibold">Haz clic para adjuntar archivos</span>
                        </button>
                    </div>

                    {/* Tipo de Plantilla */}
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold settings-label mb-1 block">
                            Tipo de Plantilla
                        </Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <label className="flex items-center space-x-3 p-3 border border-border dark:border-[hsl(231,20%,22%)] rounded-xl cursor-pointer bg-white/50 dark:bg-black/20">
                                <input
                                    type="radio"
                                    name="create_template_type"
                                    checked={form.data.is_global}
                                    onChange={() => {
                                        form.setData('is_global', true);
                                        form.setData('assigned_users', []);
                                    }}
                                    className="w-4 h-4 text-primary"
                                />
                                <Globe className="w-4 h-4 settings-title flex-shrink-0" />
                                <div>
                                    <p className="text-xs font-bold settings-title">Global</p>
                                    <p className="text-[10px] settings-subtitle leading-tight">Para todos los usuarios</p>
                                </div>
                            </label>
                            <label className="flex items-center space-x-3 p-3 border border-border dark:border-[hsl(231,20%,22%)] rounded-xl cursor-pointer bg-white/50 dark:bg-black/20">
                                <input
                                    type="radio"
                                    name="create_template_type"
                                    checked={!form.data.is_global}
                                    onChange={() => form.setData('is_global', false)}
                                    className="w-4 h-4 text-primary"
                                />
                                <Users className="w-4 h-4 settings-title flex-shrink-0" />
                                <div>
                                    <p className="text-xs font-bold settings-title">Asignada</p>
                                    <p className="text-[10px] settings-subtitle leading-tight">Solo usuarios elegidos</p>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Asignar Usuarios */}
                    {!form.data.is_global && (
                        <div className="space-y-1.5">
                            <Label className="text-sm font-semibold settings-label">
                                <UserCheck className="inline w-3.5 h-3.5 mr-1.5" />
                                Asignar a Usuarios
                            </Label>
                            <div className="max-h-32 overflow-y-auto border border-border dark:border-[hsl(231,20%,22%)] rounded-xl p-2 space-y-1">
                                {users?.map((user) => (
                                    <label key={user.id} className="flex items-center space-x-2.5 cursor-pointer p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={form.data.assigned_users.includes(user.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) form.setData('assigned_users', [...form.data.assigned_users, user.id]);
                                                else form.setData('assigned_users', form.data.assigned_users.filter(id => id !== user.id));
                                            }}
                                            className="w-4 h-4 rounded text-primary focus:ring-primary"
                                        />
                                        <div>
                                            <p className="text-sm font-medium settings-title leading-tight">{user.name}</p>
                                            <p className="text-[10px] settings-subtitle capitalize">{user.role}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Activar */}
                    <div className="flex items-center gap-2 pt-2">
                        <input
                            type="checkbox"
                            id="create_is_active"
                            checked={form.data.is_active}
                            onChange={(e) => form.setData('is_active', e.target.checked)}
                            className="w-4 h-4 rounded text-primary"
                        />
                        <Label htmlFor="create_is_active" className="text-sm font-semibold settings-label cursor-pointer">
                            {t('templates.activateImmediately')}
                        </Label>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-4 border-t border-border dark:border-[hsl(231,20%,22%)]">
                        <Button type="button" variant="outline" onClick={handleClose} className="settings-btn-secondary rounded-xl text-sm">
                            {t('common.cancel')}
                        </Button>
                        <Button type="submit" disabled={form.processing} className="settings-btn-primary rounded-xl text-sm chat-message-sent text-white shadow-md">
                            {form.processing ? t('templates.creating') : t('templates.createButton')}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
