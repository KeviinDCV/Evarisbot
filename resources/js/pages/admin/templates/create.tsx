import { Head, useForm, Link } from '@inertiajs/react';
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
import { ArrowLeft } from 'lucide-react';

export default function CreateTemplate() {
    const { data, setData, post, processing, errors } = useForm({
        name: '',
        subject: '',
        content: '',
        is_active: false,
        message_type: 'text',
        media_url: '',
        media_filename: '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/admin/templates');
    };

    return (
        <AdminLayout>
            <Head title="Nueva Plantilla" />

            <div className="min-h-screen bg-[#f0f2f8] p-4 md:p-6 lg:p-8">
                <div className="max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="mb-6 md:mb-8">
                        <Link
                            href="/admin/templates"
                            className="inline-flex items-center text-[#6b7494] hover:text-[#2e3f84] mb-3 md:mb-4 px-3 py-2 rounded-lg hover:bg-gradient-to-b hover:from-[#f4f5f9] hover:to-[#f0f2f8] transition-all duration-200"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            <span className="hidden sm:inline">Volver a plantillas</span>
                            <span className="sm:hidden">Volver</span>
                        </Link>
                        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-[#2e3f84]">Crear Nueva Plantilla</h1>
                        <p className="text-sm md:text-base text-[#6b7494] mt-1">Completa los datos para crear una plantilla de mensaje</p>
                    </div>

                    {/* Form */}
                    <div className="max-w-2xl mx-auto">
                        <form onSubmit={handleSubmit} className="bg-gradient-to-b from-white to-[#fafbfc] rounded-2xl shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_6px_rgba(46,63,132,0.06),0_6px_16px_rgba(46,63,132,0.1),inset_0_1px_0_rgba(255,255,255,0.9)] p-4 sm:p-6 lg:p-8 space-y-5 md:space-y-6">
                            {/* Nombre */}
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-sm font-medium text-[#2e3f84] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">
                                    Nombre de la Plantilla
                                </Label>
                                <Input
                                    id="name"
                                    type="text"
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    placeholder="Ej: Bienvenida Nuevos Clientes"
                                    className="border-0 bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] focus:from-white focus:to-[#fafbfc] shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_3px_rgba(46,63,132,0.06),inset_0_1px_0_rgba(255,255,255,0.6)] focus:shadow-[0_1px_3px_rgba(46,63,132,0.08),0_2px_6px_rgba(46,63,132,0.1),0_4px_12px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.06),0_3px_8px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] rounded-xl transition-all duration-200"
                                    required
                                />
                                <InputError message={errors.name} />
                            </div>

                            {/* Asunto */}
                            <div className="space-y-2">
                                <Label htmlFor="subject" className="text-sm font-medium text-[#2e3f84] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">
                                    Asunto (Opcional)
                                </Label>
                                <Input
                                    id="subject"
                                    type="text"
                                    value={data.subject}
                                    onChange={(e) => setData('subject', e.target.value)}
                                    placeholder="Breve descripción"
                                    className="border-0 bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] focus:from-white focus:to-[#fafbfc] shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_3px_rgba(46,63,132,0.06),inset_0_1px_0_rgba(255,255,255,0.6)] focus:shadow-[0_1px_3px_rgba(46,63,132,0.08),0_2px_6px_rgba(46,63,132,0.1),0_4px_12px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.06),0_3px_8px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] rounded-xl transition-all duration-200"
                                />
                                <InputError message={errors.subject} />
                            </div>

                            {/* Tipo de Mensaje */}
                            <div className="space-y-2">
                                <Label htmlFor="message_type" className="text-sm font-medium text-[#2e3f84] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">
                                    Tipo de Mensaje
                                </Label>
                                <Select
                                    value={data.message_type}
                                    onValueChange={(value) => setData('message_type', value as 'text' | 'image' | 'document')}
                                >
                                    <SelectTrigger className="border-0 bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_3px_rgba(46,63,132,0.06),inset_0_1px_0_rgba(255,255,255,0.6)] focus:shadow-[0_1px_3px_rgba(46,63,132,0.08),0_2px_6px_rgba(46,63,132,0.1),0_4px_12px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.06),0_3px_8px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] rounded-xl transition-all duration-200">
                                        <SelectValue placeholder="Selecciona tipo" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-gradient-to-b from-white to-[#fafbfc] shadow-[0_2px_4px_rgba(46,63,132,0.08),0_4px_8px_rgba(46,63,132,0.12),0_8px_20px_rgba(46,63,132,0.16),inset_0_1px_0_rgba(255,255,255,0.9)] border-0 rounded-xl">
                                        <SelectItem value="text" className="hover:bg-gradient-to-b hover:from-[#f8f9fc] hover:to-[#f4f5f9] focus:bg-[#f0f2f8] cursor-pointer rounded-lg transition-all duration-150">Texto</SelectItem>
                                        <SelectItem value="image" className="hover:bg-gradient-to-b hover:from-[#f8f9fc] hover:to-[#f4f5f9] focus:bg-[#f0f2f8] cursor-pointer rounded-lg transition-all duration-150">Imagen</SelectItem>
                                        <SelectItem value="document" className="hover:bg-gradient-to-b hover:from-[#f8f9fc] hover:to-[#f4f5f9] focus:bg-[#f0f2f8] cursor-pointer rounded-lg transition-all duration-150">Documento</SelectItem>
                                    </SelectContent>
                                </Select>
                                <InputError message={errors.message_type} />
                            </div>

                            {/* Campos de Media si no es texto */}
                            {data.message_type !== 'text' && (
                                <>
                                    <div className="space-y-2">
                                        <Label htmlFor="media_url" className="text-sm font-medium text-[#2e3f84] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">
                                            URL del Archivo
                                        </Label>
                                        <Input
                                            id="media_url"
                                            type="url"
                                            value={data.media_url}
                                            onChange={(e) => setData('media_url', e.target.value)}
                                            placeholder="https://ejemplo.com/archivo.jpg"
                                            className="border-0 bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] focus:from-white focus:to-[#fafbfc] shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_3px_rgba(46,63,132,0.06),inset_0_1px_0_rgba(255,255,255,0.6)] focus:shadow-[0_1px_3px_rgba(46,63,132,0.08),0_2px_6px_rgba(46,63,132,0.1),0_4px_12px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.06),0_3px_8px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] rounded-xl transition-all duration-200"
                                        />
                                        <InputError message={errors.media_url} />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="media_filename" className="text-sm font-medium text-[#2e3f84] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">
                                            Nombre del Archivo
                                        </Label>
                                        <Input
                                            id="media_filename"
                                            type="text"
                                            value={data.media_filename}
                                            onChange={(e) => setData('media_filename', e.target.value)}
                                            placeholder="archivo.jpg"
                                            className="border-0 bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] focus:from-white focus:to-[#fafbfc] shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_3px_rgba(46,63,132,0.06),inset_0_1px_0_rgba(255,255,255,0.6)] focus:shadow-[0_1px_3px_rgba(46,63,132,0.08),0_2px_6px_rgba(46,63,132,0.1),0_4px_12px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.06),0_3px_8px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] rounded-xl transition-all duration-200"
                                        />
                                        <InputError message={errors.media_filename} />
                                    </div>
                                </>
                            )}

                            {/* Contenido */}
                            <div className="space-y-2">
                                <Label htmlFor="content" className="text-sm font-medium text-[#2e3f84] drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">
                                    Contenido del Mensaje
                                </Label>
                                <Textarea
                                    id="content"
                                    value={data.content}
                                    onChange={(e) => setData('content', e.target.value)}
                                    placeholder="Escribe el mensaje aquí..."
                                    rows={8}
                                    className="border-0 bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] focus:from-white focus:to-[#fafbfc] shadow-[0_1px_2px_rgba(46,63,132,0.04),0_2px_3px_rgba(46,63,132,0.06),inset_0_1px_0_rgba(255,255,255,0.6)] focus:shadow-[0_1px_3px_rgba(46,63,132,0.08),0_2px_6px_rgba(46,63,132,0.1),0_4px_12px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.06),0_3px_8px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] rounded-xl transition-all duration-200"
                                    required
                                />
                                <p className="text-sm text-[#6b7494]">
                                    Caracteres: {data.content.length} / 4096
                                </p>
                                <InputError message={errors.content} />
                            </div>

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
                                    Activar plantilla inmediatamente
                                </Label>
                            </div>

                            {/* Botones */}
                            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-[#e8ebf5] mt-8">
                                <Button
                                    type="submit"
                                    disabled={processing}
                                    className="w-full sm:w-auto sm:flex-1 bg-gradient-to-b from-[#3e4f94] to-[#2e3f84] hover:from-[#4e5fa4] hover:to-[#3e4f94] text-white shadow-[0_1px_2px_rgba(46,63,132,0.15),0_2px_4px_rgba(46,63,132,0.2),0_4px_12px_rgba(46,63,132,0.25),inset_0_1px_0_rgba(255,255,255,0.15)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.2),0_4px_8px_rgba(46,63,132,0.25),0_8px_20px_rgba(46,63,132,0.3),inset_0_1px_0_rgba(255,255,255,0.2)] hover:-translate-y-0.5 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),inset_0_0_8px_rgba(0,0,0,0.1)] active:translate-y-0 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                                >
                                    {processing ? 'Creando...' : 'Crear Plantilla'}
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
