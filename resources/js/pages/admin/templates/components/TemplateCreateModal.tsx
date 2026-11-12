import { router, useForm } from '@inertiajs/react';
import { BOTON_PRIMARIO, BOTON_SECUNDARIO } from '@/components/appointments/piezas-citas';
import { Nota } from '@/components/bulk-sends/piezas-envio';
import { CamposPlantilla, type ErroresPlantilla } from '@/components/templates/formulario-plantilla';
import { DialogoPlantilla } from '@/components/templates/piezas-plantillas';
import { MessageSquareText, Save, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useRef, useState, FormEvent } from 'react';
import { toast } from '@/lib/toast';

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

/* Nueva plantilla: el mismo formulario que editar, vacío y con la vista previa al lado (diseño aprobado,
   design/vista-plantillas). La petición es la de siempre: POST /admin/templates con FormData (sin
   «Asunto», que ya no se guardaba). */
export default function TemplateCreateModal({ isOpen, onClose, users }: TemplateCreateModalProps) {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFiles, setSelectedFiles] = useState<MediaFile[]>([]);
    const [errores, setErrores] = useState<ErroresPlantilla>({});
    const [enviando, setEnviando] = useState(false);

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

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (enviando) return;

        // FormData a mano: los archivos van en media_files[i] (varios adjuntos por plantilla).
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

        setEnviando(true);
        setErrores({});
        router.post('/admin/templates', formData, {
            forceFormData: true,
            onSuccess: () => {
                handleClose();
                toast.success(t('templates.createdSuccess'));
            },
            onError: (errors) => {
                setErrores(errors as ErroresPlantilla);
                toast.error(t('templates.createError'));
            },
            onFinish: () => setEnviando(false),
        });
    };

    const handleClose = () => {
        form.reset();
        form.clearErrors();
        setSelectedFiles([]);
        setErrores({});
        setEnviando(false);
        onClose();
    };

    const hayErrores = Object.values(errores).some(Boolean);

    return (
        <DialogoPlantilla
            abierto={isOpen}
            onCerrar={handleClose}
            icono={MessageSquareText}
            titulo={t('templates.vista.createTitle')}
            sub={t('templates.vista.createSub')}
            cerrarConX
            ancho="max-w-[752px]"
            pie={
                <>
                    <button type="button" onClick={handleClose} className={BOTON_SECUNDARIO}>
                        <X strokeWidth={1.9} aria-hidden="true" />
                        {t('common.cancel')}
                    </button>
                    <button type="submit" form="create-template-form" disabled={enviando || form.processing} className={BOTON_PRIMARIO}>
                        <Save strokeWidth={2} aria-hidden="true" />
                        {enviando || form.processing ? t('templates.creating') : t('templates.vista.createSave')}
                    </button>
                </>
            }
        >
            <form id="create-template-form" onSubmit={handleSubmit} className="flex flex-col gap-3.5">
                {hayErrores && <Nota tipo="mal">{t('templates.vista.formErrors')}</Nota>}
                <CamposPlantilla
                    prefijo="create"
                    nombre={form.data.name}
                    onNombre={(v) => form.setData('name', v)}
                    contenido={form.data.content}
                    onContenido={(v) => form.setData('content', v)}
                    esGlobal={form.data.is_global}
                    onGlobal={() => {
                        form.setData('is_global', true);
                        form.setData('assigned_users', []);
                    }}
                    onAsignada={() => form.setData('is_global', false)}
                    asignados={form.data.assigned_users}
                    onUsuario={(id, marcado) => {
                        if (marcado) form.setData('assigned_users', [...form.data.assigned_users, id]);
                        else form.setData('assigned_users', form.data.assigned_users.filter(x => x !== id));
                    }}
                    activa={form.data.is_active}
                    onActiva={(v) => form.setData('is_active', v)}
                    usuarios={users ?? []}
                    nuevos={selectedFiles}
                    onQuitarNuevo={handleRemoveFile}
                    inputArchivos={fileInputRef}
                    onArchivos={handleFileSelect}
                    errores={{ ...(form.errors as ErroresPlantilla), ...errores }}
                />
            </form>
        </DialogoPlantilla>
    );
}
