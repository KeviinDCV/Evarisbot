import { Head, useForm, Link, router, usePage } from '@inertiajs/react';
import AdminLayout from '@/layouts/admin-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import InputError from '@/components/input-error';
import { ArrowLeft, Paperclip, X, Image, Video, FileText, Users, Globe, UserCheck, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useRef, useState } from 'react';

interface MediaFile {
    file: File;
    preview: string | null;
    type: 'image' | 'video' | 'document';
}

export default function CreateTemplate() {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFiles, setSelectedFiles] = useState<MediaFile[]>([]);

    // Obtener usuarios del servidor (pasados como props)
    const { users } = usePage().props as any;

    const { data, setData, post, processing, errors } = useForm({
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

        // Limpiar input para permitir seleccionar el mismo archivo de nuevo
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleRemoveFile = (index: number) => {
        setSelectedFiles(prev => {
            const newFiles = [...prev];
            // Revocar URL del preview si existe
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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const formData = new FormData();
        formData.append('name', data.name);
        formData.append('content', data.content);
        formData.append('is_active', data.is_active ? '1' : '0');
        formData.append('is_global', data.is_global ? '1' : '0');

        data.assigned_users.forEach(userId => {
            formData.append('assigned_users[]', userId.toString());
        });

        // Agregar múltiples archivos
        selectedFiles.forEach((mediaFile, index) => {
            formData.append(`media_files[${index}]`, mediaFile.file);
        });

        router.post('/admin/templates', formData, {
            forceFormData: true,
        });
    };

    return (
        <AdminLayout>
            <Head title={t('templates.createTitle')} />

            <div className="min-h-screen p-4 md:p-6 lg:p-8 bg-background">
                <div className="max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="mb-6 md:mb-8">
                        <Link
                            href="/admin/templates"
                            className="inline-flex items-center mb-3 md:mb-4 px-3 py-2 rounded-xl transition-all duration-200 settings-subtitle settings-back-link hover:bg-black/5 dark:hover:bg-white/5"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            <span className="hidden sm:inline">{t('templates.backToTemplates')}</span>
                            <span className="sm:hidden">{t('common.back')}</span>
                        </Link>
                        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold settings-title">{t('templates.createTitle')}</h1>
                        <p className="text-sm md:text-base settings-subtitle mt-1">{t('templates.createSubtitle')}</p>
                    </div>

                    {/* Form */}
                    <div className="max-w-2xl mx-auto">
                        <form onSubmit={handleSubmit} className="card-gradient rounded-2xl border border-white/40 dark:border-white/10 shadow-lg shadow-[#2e3f84]/5 p-4 sm:p-8 space-y-5 md:space-y-6 transition-all duration-300 hover:shadow-xl hover:shadow-[#2e3f84]/10">
                            {/* Nombre */}
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-sm font-medium settings-label">
                                    {t('templates.templateName')}
                                </Label>
                                <Input
                                    id="name"
                                    type="text"
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    placeholder={t('templates.templateNamePlaceholder')}
                                    className="settings-input rounded-xl border-gray-200 dark:border-gray-800 transition-all duration-200 focus:ring-2 focus:ring-[#2e3f84]/30"
                                    required
                                />
                                <InputError message={errors.name} />
                            </div>

                            {/* Mensaje */}
                            <div className="space-y-2">
                                <Label htmlFor="content" className="text-sm font-medium settings-label">
                                    {t('templates.content')}
                                </Label>
                                <Textarea
                                    id="content"
                                    value={data.content}
                                    onChange={(e) => setData('content', e.target.value)}
                                    placeholder={t('templates.contentPlaceholder')}
                                    rows={8}
                                    className="settings-input rounded-xl border-gray-200 dark:border-gray-800 transition-all duration-200 focus:ring-2 focus:ring-[#2e3f84]/30"
                                    required
                                />
                                <p className="text-sm settings-subtitle">
                                    {t('templates.characters')}: {data.content.length} / 4096
                                </p>
                                <InputError message={errors.content} />
                            </div>

                            {/* Archivos Adjuntos (Opcional - Múltiples) */}
                            <div className="space-y-2">
                                <Label className="text-sm font-medium settings-label">
                                    Archivos adjuntos (opcional)
                                </Label>
                                <p className="text-xs settings-subtitle mb-2">
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

                                {/* Lista de archivos seleccionados */}
                                {selectedFiles.length > 0 && (
                                    <div className="space-y-2 mb-3">
                                        {selectedFiles.map((mediaFile, index) => (
                                            <div
                                                key={index}
                                                className="p-3 rounded-xl user-stats-box bg-white/50 dark:bg-black/20 border border-gray-100 dark:border-gray-800"
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
                                                        <p className="text-sm font-medium settings-title truncate">{mediaFile.file.name}</p>
                                                        <p className="text-xs settings-subtitle">
                                                            {getFileTypeLabel(mediaFile.type)} • {(mediaFile.file.size / 1024 / 1024).toFixed(2)} MB
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveFile(index)}
                                                        className="p-2 rounded-xl transition-all settings-subtitle hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Botón para agregar más archivos */}
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full p-4 border-2 border-dashed border-[#e2e4ed] dark:border-[hsl(231,20%,25%)] rounded-2xl hover:border-[#2e3f84] dark:hover:border-[hsl(231,55%,55%)] hover:bg-[#2e3f84]/5 dark:hover:bg-[hsl(231,55%,55%)]/5 transition-all duration-200 flex flex-col items-center gap-2 settings-subtitle template-upload-btn"
                                >
                                    {selectedFiles.length === 0 ? (
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

                                {selectedFiles.length > 0 && (
                                    <p className="text-xs settings-subtitle mt-2">
                                        {selectedFiles.length} archivo{selectedFiles.length !== 1 ? 's' : ''} seleccionado{selectedFiles.length !== 1 ? 's' : ''}
                                    </p>
                                )}
                                <InputError message={(errors as any).media_files} />
                            </div>

                            {/* Tipo de Plantilla */}
                            <div className="space-y-3">
                                <Label className="text-sm font-medium settings-label">
                                    Tipo de Plantilla
                                </Label>
                                <div className="space-y-2">
                                    <label className="flex items-center space-x-3 p-3 border border-[#e2e4ed] dark:border-[hsl(231,20%,22%)] rounded-xl cursor-pointer transition-colors template-radio-option">
                                        <input
                                            type="radio"
                                            name="template_type"
                                            checked={data.is_global}
                                            onChange={() => {
                                                setData('is_global', true);
                                                setData('assigned_users', []);
                                            }}
                                            className="w-4 h-4 text-primary"
                                        />
                                        <Globe className="w-5 h-5 settings-title" />
                                        <div>
                                            <p className="font-medium settings-title">Plantilla Global</p>
                                            <p className="text-sm settings-subtitle">Disponible para todos los asesores y administradores</p>
                                        </div>
                                    </label>
                                    <label className="flex items-center space-x-3 p-3 border border-[#e2e4ed] dark:border-[hsl(231,20%,22%)] rounded-xl cursor-pointer transition-colors template-radio-option">
                                        <input
                                            type="radio"
                                            name="template_type"
                                            checked={!data.is_global}
                                            onChange={() => setData('is_global', false)}
                                            className="w-4 h-4 text-primary"
                                        />
                                        <Users className="w-5 h-5 settings-title" />
                                        <div>
                                            <p className="font-medium settings-title">Plantilla Asignada</p>
                                            <p className="text-sm settings-subtitle">Disponible solo para los usuarios seleccionados</p>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Asignar Usuarios (solo si no es global) */}
                            {!data.is_global && (
                                <div className="space-y-3">
                                    <Label className="text-sm font-medium settings-label">
                                        <UserCheck className="inline w-4 h-4 mr-2" />
                                        Asignar a Usuarios
                                    </Label>
                                    <div className="max-h-40 overflow-y-auto border border-[#e2e4ed] dark:border-[hsl(231,20%,22%)] rounded-xl p-3 space-y-2 template-users-list p-1">
                                        {users?.map((user: any) => (
                                            <label
                                                key={user.id}
                                                className="flex items-center space-x-3 cursor-pointer p-2 rounded transition-colors template-user-item"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={data.assigned_users.includes(user.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setData('assigned_users', [...data.assigned_users, user.id]);
                                                        } else {
                                                            setData('assigned_users', data.assigned_users.filter(id => id !== user.id));
                                                        }
                                                    }}
                                                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                                                />
                                                <div>
                                                    <p className="font-medium text-sm settings-title">{user.name}</p>
                                                    <p className="text-xs settings-subtitle capitalize">{user.role}</p>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                    {data.assigned_users.length === 0 && !data.is_global && (
                                        <p className="text-sm text-amber-600 dark:text-amber-400">Debes seleccionar al menos un usuario</p>
                                    )}
                                </div>
                            )}

                            {/* Activar Plantilla */}
                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="is_active"
                                    checked={data.is_active}
                                    onChange={(e) => setData('is_active', e.target.checked)}
                                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                                />
                                <Label htmlFor="is_active" className="text-sm font-medium settings-label cursor-pointer">
                                    {t('templates.activateImmediately')}
                                </Label>
                            </div>

                            {/* Botones */}
                            <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-200 dark:border-gray-800 mt-8">
                                <Button
                                    type="submit"
                                    disabled={processing}
                                    className="w-full sm:flex-1 h-11 settings-btn-primary rounded-xl font-medium disabled:opacity-50 transition-all"
                                >
                                    {processing ? t('templates.creating') : t('templates.createButton')}
                                </Button>
                                <Link href="/admin/templates" className="w-full sm:flex-1">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full h-11 settings-btn-secondary rounded-xl font-medium transition-all"
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
