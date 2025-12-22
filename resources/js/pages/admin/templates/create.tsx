import { Head, useForm, Link, router, usePage } from '@inertiajs/react';
import AdminLayout from '@/layouts/admin-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import InputError from '@/components/input-error';
import { ArrowLeft, Paperclip, X, Image, Video, FileText, Users, Globe, UserCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useRef, useState } from 'react';

export default function CreateTemplate() {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    
    // Obtener usuarios del servidor (pasados como props)
    const { users } = usePage().props as any;
    
    const { data, setData, post, processing, errors } = useForm({
        name: '',
        content: '',
        is_active: false,
        is_global: true,
        assigned_users: [] as number[],
        media_file: null as File | null,
    });

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setData('media_file', file);
            
            // Crear preview para imágenes
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => setPreview(e.target?.result as string);
                reader.readAsDataURL(file);
            } else {
                setPreview(null);
            }
        }
    };

    const handleRemoveFile = () => {
        setSelectedFile(null);
        setPreview(null);
        setData('media_file', null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const getFileIcon = () => {
        if (!selectedFile) return null;
        if (selectedFile.type.startsWith('image/')) return <Image className="w-5 h-5" />;
        if (selectedFile.type.startsWith('video/')) return <Video className="w-5 h-5" />;
        return <FileText className="w-5 h-5" />;
    };

    const getFileType = () => {
        if (!selectedFile) return '';
        if (selectedFile.type.startsWith('image/')) return 'Imagen';
        if (selectedFile.type.startsWith('video/')) return 'Video';
        return 'Documento';
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        router.post('/admin/templates', {
            name: data.name,
            content: data.content,
            is_active: data.is_active,
            is_global: data.is_global,
            assigned_users: data.assigned_users,
            media_file: data.media_file,
        }, {
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

                            {/* Archivo Adjunto (Opcional) */}
                            <div className="space-y-2">
                                <Label className="text-sm font-medium text-[#2e3f84] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">
                                    Archivo adjunto (opcional)
                                </Label>
                                <p className="text-xs text-[#6b7494] mb-2">
                                    Puedes adjuntar una imagen, video o documento. Formatos soportados: JPG, PNG, GIF, MP4, MOV, PDF, DOC. Máximo 20MB.
                                </p>
                                
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*,video/*,.pdf,.doc,.docx"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                                
                                {!selectedFile ? (
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full p-4 border-2 border-dashed border-[#dde1f0] rounded-none hover:border-[#2e3f84] hover:bg-[#f8f9fc] transition-all duration-200 flex flex-col items-center gap-2 text-[#6b7494]"
                                    >
                                        <Paperclip className="w-8 h-8" />
                                        <span className="text-sm">Haz clic para seleccionar un archivo</span>
                                    </button>
                                ) : (
                                    <div className="p-4 bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] rounded-none">
                                        <div className="flex items-center gap-3">
                                            {preview ? (
                                                <img src={preview} alt="Preview" className="w-16 h-16 object-cover rounded-none" />
                                            ) : (
                                                <div className="w-16 h-16 bg-gradient-to-b from-[#3e4f94] to-[#2e3f84] rounded-none flex items-center justify-center text-white">
                                                    {getFileIcon()}
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-[#2e3f84] truncate">{selectedFile.name}</p>
                                                <p className="text-xs text-[#6b7494]">
                                                    {getFileType()} • {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleRemoveFile}
                                                className="p-2 text-[#6b7494] hover:text-red-500 hover:bg-red-50 rounded-none transition-all"
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <InputError message={errors.media_file} />
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
