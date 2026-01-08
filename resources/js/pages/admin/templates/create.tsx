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

            <div className="min-h-screen bg-[#f0f2f8] p-4 md:p-6 lg:p-8">
                <div className="max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="mb-6 md:mb-8">
                        <Link
                            href="/admin/templates"
                            className="inline-flex items-center text-[#6b7494] hover:text-[#2e3f84] mb-3 md:mb-4 px-3 py-2 rounded-none hover:bg-gradient-to-b hover:from-[#f4f5f9] hover:to-[#f0f2f8] transition-all duration-200"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            <span className="hidden sm:inline">{t('templates.backToTemplates')}</span>
                            <span className="sm:hidden">{t('common.back')}</span>
                        </Link>
                        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-[#2e3f84]">{t('templates.createTitle')}</h1>
                        <p className="text-sm md:text-base text-[#6b7494] mt-1">{t('templates.createSubtitle')}</p>
                    </div>

                    {/* Form */}
                    <div className="max-w-2xl mx-auto">
                        <form onSubmit={handleSubmit} className="bg-gradient-to-b from-white to-[#fafbfc] rounded-none shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_6px_rgba(46,63,132,0.06),0_6px_16px_rgba(46,63,132,0.1),inset_0_1px_0_rgba(255,255,255,0.9)] p-4 sm:p-6 lg:p-8 space-y-5 md:space-y-6">
                            {/* Nombre */}
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-sm font-medium text-[#2e3f84] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">
                                    {t('templates.templateName')}
                                </Label>
                                <Input
                                    id="name"
                                    type="text"
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    placeholder={t('templates.templateNamePlaceholder')}
                                    className="border-0 bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] focus:from-white focus:to-[#fafbfc] shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_3px_rgba(46,63,132,0.06),inset_0_1px_0_rgba(255,255,255,0.6)] focus:shadow-[0_1px_3px_rgba(46,63,132,0.08),0_2px_6px_rgba(46,63,132,0.1),0_4px_12px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.06),0_3px_8px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] rounded-none transition-all duration-200"
                                    required
                                />
                                <InputError message={errors.name} />
                            </div>

                            {/* Mensaje */}
                            <div className="space-y-2">
                                <Label htmlFor="content" className="text-sm font-medium text-[#2e3f84] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">
                                    {t('templates.content')}
                                </Label>
                                <Textarea
                                    id="content"
                                    value={data.content}
                                    onChange={(e) => setData('content', e.target.value)}
                                    placeholder={t('templates.contentPlaceholder')}
                                    rows={8}
                                    className="border-0 bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] focus:from-white focus:to-[#fafbfc] shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_3px_rgba(46,63,132,0.06),inset_0_1px_0_rgba(255,255,255,0.6)] focus:shadow-[0_1px_3px_rgba(46,63,132,0.08),0_2px_6px_rgba(46,63,132,0.1),0_4px_12px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.06),0_3px_8px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] rounded-none transition-all duration-200"
                                    required
                                />
                                <p className="text-sm text-[#6b7494]">
                                    {t('templates.characters')}: {data.content.length} / 4096
                                </p>
                                <InputError message={errors.content} />
                            </div>

                            {/* Archivos Adjuntos (Opcional - Múltiples) */}
                            <div className="space-y-2">
                                <Label className="text-sm font-medium text-[#2e3f84] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">
                                    Archivos adjuntos (opcional)
                                </Label>
                                <p className="text-xs text-[#6b7494] mb-2">
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
                                            <div key={index} className="p-3 bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] rounded-none">
                                                <div className="flex items-center gap-3">
                                                    {mediaFile.preview ? (
                                                        <img src={mediaFile.preview} alt="Preview" className="w-12 h-12 object-cover rounded-none" />
                                                    ) : (
                                                        <div className="w-12 h-12 bg-gradient-to-b from-[#3e4f94] to-[#2e3f84] rounded-none flex items-center justify-center text-white">
                                                            {getFileIcon(mediaFile.type)}
                                                        </div>
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-[#2e3f84] truncate">{mediaFile.file.name}</p>
                                                        <p className="text-xs text-[#6b7494]">
                                                            {getFileTypeLabel(mediaFile.type)} • {(mediaFile.file.size / 1024 / 1024).toFixed(2)} MB
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveFile(index)}
                                                        className="p-2 text-[#6b7494] hover:text-red-500 hover:bg-red-50 rounded-none transition-all"
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
                                    className="w-full p-4 border-2 border-dashed border-[#dde1f0] rounded-none hover:border-[#2e3f84] hover:bg-[#f8f9fc] transition-all duration-200 flex flex-col items-center gap-2 text-[#6b7494]"
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
                                    <p className="text-xs text-[#6b7494] mt-2">
                                        {selectedFiles.length} archivo{selectedFiles.length !== 1 ? 's' : ''} seleccionado{selectedFiles.length !== 1 ? 's' : ''}
                                    </p>
                                )}
                                <InputError message={errors.media_files} />
                            </div>

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
                                            checked={data.is_global}
                                            onChange={() => {
                                                setData('is_global', true);
                                                setData('assigned_users', []);
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
                                            checked={!data.is_global}
                                            onChange={() => setData('is_global', false)}
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
                            {!data.is_global && (
                                <div className="space-y-3">
                                    <Label className="text-sm font-medium text-[#2e3f84] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">
                                        <UserCheck className="inline w-4 h-4 mr-2" />
                                        Asignar a Usuarios
                                    </Label>
                                    <div className="max-h-40 overflow-y-auto border rounded-lg p-3 space-y-2">
                                        {users?.map((user: any) => (
                                            <label key={user.id} className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded">
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
                                                    className="w-4 h-4 rounded border-gray-300 text-[#2e3f84] focus:ring-[#2e3f84]"
                                                />
                                                <div>
                                                    <p className="font-medium text-sm">{user.name}</p>
                                                    <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                    {data.assigned_users.length === 0 && !data.is_global && (
                                        <p className="text-sm text-amber-600">Debes seleccionar al menos un usuario</p>
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
                                    className="w-4 h-4 rounded border-[#dde1f0] text-[#2e3f84] focus:ring-[#2e3f84]"
                                />
                                <Label htmlFor="is_active" className="text-sm font-medium text-[#2e3f84] cursor-pointer">
                                    {t('templates.activateImmediately')}
                                </Label>
                            </div>

                            {/* Botones */}
                            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-[#e8ebf5] mt-8">
                                <Button
                                    type="submit"
                                    disabled={processing}
                                    className="w-full sm:w-auto sm:flex-1 bg-gradient-to-b from-[#3e4f94] to-[#2e3f84] hover:from-[#4e5fa4] hover:to-[#3e4f94] text-white shadow-[0_1px_2px_rgba(46,63,132,0.15),0_2px_4px_rgba(46,63,132,0.2),0_4px_12px_rgba(46,63,132,0.25),inset_0_1px_0_rgba(255,255,255,0.15)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.2),0_4px_8px_rgba(46,63,132,0.25),0_8px_20px_rgba(46,63,132,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] hover:-translate-y-0.5 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),inset_0_0_8px_rgba(0,0,0,0.1)] active:translate-y-0 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                                >
                                    {processing ? t('templates.creating') : t('templates.createButton')}
                                </Button>
                                <Link href="/admin/templates" className="w-full sm:w-auto sm:flex-1">
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
