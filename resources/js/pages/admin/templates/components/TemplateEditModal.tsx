import { useForm, router } from '@inertiajs/react';
import { BOTON_PRIMARIO, BOTON_SECUNDARIO } from '@/components/appointments/piezas-citas';
import { Nota } from '@/components/bulk-sends/piezas-envio';
import { CamposPlantilla, type ErroresPlantilla } from '@/components/templates/formulario-plantilla';
import { DialogoPlantilla } from '@/components/templates/piezas-plantillas';
import { Edit3, Save, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useRef, useState, useEffect, FormEvent } from 'react';
import { toast } from '@/lib/toast';

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
    message_type: 'text' | 'image' | 'video' | 'document';
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

/* Editar plantilla: el formulario con la vista previa al lado (diseño aprobado, design/vista-plantillas).
   La petición es la de siempre: POST /admin/templates/{id} con _method PUT y FormData; los adjuntos que
   ya tenía se pueden quitar (existing_media_files) y se pueden añadir nuevos. Sin «Asunto», que ya no se
   guardaba. */
export default function TemplateEditModal({ isOpen, onClose, template, users }: TemplateEditModalProps) {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [existingFiles, setExistingFiles] = useState<ExistingMediaFile[]>([]);
    const [newFiles, setNewFiles] = useState<NewMediaFile[]>([]);
    const [errores, setErrores] = useState<ErroresPlantilla>({});
    const [enviando, setEnviando] = useState(false);

    const form = useForm({
        name: '',
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
                content: template.content,
                is_active: template.is_active,
                is_global: template.is_global ?? true,
                assigned_users: template.assigned_users || [],
            });
            setExistingFiles(template.media_files || []);
            setNewFiles([]);
            setErrores({});
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [template]);

    const getFileType = (file: File): 'image' | 'video' | 'document' => {
        if (file.type.startsWith('image/')) return 'image';
        if (file.type.startsWith('video/')) return 'video';
        return 'document';
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

        if (!template || enviando) return;

        const formData = new FormData();
        formData.append('_method', 'PUT');
        formData.append('name', form.data.name);
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

        setEnviando(true);
        setErrores({});
        router.post(`/admin/templates/${template.id}`, formData, {
            forceFormData: true,
            onSuccess: () => {
                handleClose();
                toast.success(t('templates.templateUpdated'));
            },
            onError: (errors) => {
                setErrores(errors as ErroresPlantilla);
                toast.error(t('templates.templateUpdateError'));
            },
            onFinish: () => setEnviando(false),
        });
    };

    const handleClose = () => {
        form.reset();
        form.clearErrors();
        setNewFiles([]);
        setErrores({});
        setEnviando(false);
        onClose();
    };

    if (!template) return null;

    const hayErrores = Object.values(errores).some(Boolean);

    return (
        <DialogoPlantilla
            abierto={isOpen}
            onCerrar={handleClose}
            icono={Edit3}
            titulo={t('templates.vista.editTitle')}
            sub={t('templates.vista.editSub')}
            cerrarConX
            ancho="max-w-[752px]"
            pie={
                <>
                    <button type="button" onClick={handleClose} className={BOTON_SECUNDARIO}>
                        <X strokeWidth={1.9} aria-hidden="true" />
                        {t('common.cancel')}
                    </button>
                    <button type="submit" form="edit-template-form" disabled={enviando || form.processing} className={BOTON_PRIMARIO}>
                        <Save strokeWidth={2} aria-hidden="true" />
                        {enviando || form.processing ? t('common.saving') : t('common.saveChanges')}
                    </button>
                </>
            }
        >
            <form id="edit-template-form" onSubmit={handleSubmit} className="flex flex-col gap-3.5">
                {hayErrores && <Nota tipo="mal">{t('templates.vista.formErrors')}</Nota>}
                <CamposPlantilla
                    prefijo="edit"
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
                    existentes={existingFiles}
                    onQuitarExistente={handleRemoveExistingFile}
                    nuevos={newFiles}
                    onQuitarNuevo={handleRemoveNewFile}
                    inputArchivos={fileInputRef}
                    onArchivos={handleFileSelect}
                    errores={{ ...(form.errors as ErroresPlantilla), ...errores }}
                />
            </form>
        </DialogoPlantilla>
    );
}
