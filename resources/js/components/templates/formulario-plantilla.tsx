import { FILETE, FOCO, MONO, TEXTO_NAVY, TEXTO_SUAVE, nombrePropio } from '@/components/appointments/piezas-citas';
import { Rotulo, miles } from '@/components/bulk-sends/piezas-envio';
import { AREA, AYUDA, BOTON_ICONO, BurbujaSale, CAMPO, ERROR_CAMPO, ETIQUETA, Interruptor, type AdjuntoVista } from '@/components/templates/piezas-plantillas';
import { cn } from '@/lib/utils';
import { Building2, FileText, Image as ImageIcon, Paperclip, Users, Video, X } from 'lucide-react';
import { useState, type ChangeEvent, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';

/* ── Formulario de plantilla (crear y editar; el mismo, con la vista previa al lado) ───────────────
   Solo presentación: los valores, los archivos y el envío los llevan TemplateCreateModal y
   TemplateEditModal, que hacen exactamente las mismas peticiones de siempre. */

export type TipoArchivo = 'image' | 'video' | 'document';

export interface ArchivoExistente {
    url: string;
    filename: string;
    type: TipoArchivo;
}

export interface ArchivoNuevo {
    file: File;
    preview: string | null;
    type: TipoArchivo;
}

export interface UsuarioAsignable {
    id: number;
    name: string;
    role: string;
}

export interface ErroresPlantilla {
    name?: string;
    content?: string;
    media_files?: string;
    media_file?: string;
    assigned_users?: string;
    [clave: string]: string | undefined;
}

const ACEPTA = '.jpg,.jpeg,.png,.gif,.webp,.mp4,.mov,.avi,.3gp,.pdf,.doc,.docx';
const ICONO_TIPO = { image: ImageIcon, video: Video, document: FileText } as const;

const iniciales = (nombre: string) =>
    nombre
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p.charAt(0).toLocaleUpperCase('es'))
        .join('');

function FilaArchivo({ nombre, tipo, detalle, nuevo, miniatura, onQuitar }: { nombre: string; tipo: TipoArchivo; detalle: string; nuevo: boolean; miniatura?: string | null; onQuitar: () => void }) {
    const { t } = useTranslation();
    const [fallo, setFallo] = useState(false);
    const Icono = ICONO_TIPO[tipo] ?? FileText;
    return (
        <li
            className={cn(
                'flex min-h-[46px] items-center gap-2.5 rounded-[10px] bg-white py-1.5 pr-1.5 pl-2 dark:bg-white/[0.03]',
                nuevo
                    ? 'shadow-[inset_0_0_0_1px_var(--color-emerald-200)] dark:shadow-[inset_0_0_0_1px_rgba(16,185,129,0.3)]'
                    : 'shadow-[inset_0_0_0_1px_rgba(46,63,132,0.14)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]'
            )}
        >
            <span
                className={cn(
                    'flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg',
                    nuevo ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-[#2e3f84]/6 text-[#2e3f84] dark:bg-white/8 dark:text-neutral-100'
                )}
            >
                {miniatura && !fallo ? (
                    <img src={miniatura} alt="" onError={() => setFallo(true)} className="size-full object-cover" />
                ) : (
                    <Icono className="size-4" strokeWidth={1.9} aria-hidden="true" />
                )}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-px">
                <span className={cn('truncate text-[12.5px] leading-4 font-semibold', MONO, TEXTO_NAVY)} title={nombre}>
                    {nombre}
                </span>
                <span className={cn('truncate text-[12px] leading-4', nuevo ? 'text-emerald-700 dark:text-emerald-400' : TEXTO_SUAVE)}>{detalle}</span>
            </span>
            <button type="button" onClick={onQuitar} aria-label={t('templates.vista.removeFileNamed', { name: nombre })} title={t('templates.vista.removeFile')} className={BOTON_ICONO}>
                <X className="size-4" strokeWidth={2} aria-hidden="true" />
            </button>
        </li>
    );
}

export function CamposPlantilla({
    prefijo,
    nombre,
    onNombre,
    contenido,
    onContenido,
    esGlobal,
    onGlobal,
    onAsignada,
    asignados,
    onUsuario,
    activa,
    onActiva,
    usuarios,
    existentes = [],
    onQuitarExistente,
    nuevos,
    onQuitarNuevo,
    inputArchivos,
    onArchivos,
    errores,
}: {
    prefijo: string;
    nombre: string;
    onNombre: (v: string) => void;
    contenido: string;
    onContenido: (v: string) => void;
    esGlobal: boolean;
    onGlobal: () => void;
    onAsignada: () => void;
    asignados: number[];
    onUsuario: (id: number, marcado: boolean) => void;
    activa: boolean;
    onActiva: (v: boolean) => void;
    usuarios: UsuarioAsignable[];
    existentes?: ArchivoExistente[];
    onQuitarExistente?: (i: number) => void;
    nuevos: ArchivoNuevo[];
    onQuitarNuevo: (i: number) => void;
    inputArchivos: RefObject<HTMLInputElement | null>;
    onArchivos: (e: ChangeEvent<HTMLInputElement>) => void;
    errores: ErroresPlantilla;
}) {
    const { t, i18n } = useTranslation();
    const lng = i18n.language;
    const tipoTexto = (tipo: TipoArchivo) => t(`templates.types.${tipo}`);
    const rol = (r: string) => (r === 'admin' ? t('templates.vista.roleAdmin') : r === 'advisor' ? t('templates.vista.roleAdvisor') : r);
    const total = existentes.length + nuevos.length;
    const vista: AdjuntoVista[] = [
        ...existentes.map((a) => ({ url: a.url, filename: a.filename, type: a.type })),
        ...nuevos.map((a) => ({ url: a.preview, filename: a.file.name, type: a.type })),
    ];
    const errorArchivos = errores.media_files || errores.media_file;
    const opcionAlcance = cn(
        'flex min-w-0 cursor-pointer items-start gap-2 rounded-[10px] bg-white px-2.5 py-2.5 shadow-[inset_0_0_0_1px_rgba(46,63,132,0.16)] transition-shadow dark:bg-white/[0.03] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]',
        'has-[:checked]:bg-[#2e3f84]/[0.04] has-[:checked]:shadow-[inset_0_0_0_1.5px_#2e3f84] dark:has-[:checked]:bg-white/[0.06] dark:has-[:checked]:shadow-[inset_0_0_0_1.5px_#8b9ae0]',
        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#2e3f84]/40 dark:has-[:focus-visible]:ring-[#8b9ae0]/60'
    );

    return (
        <div className="grid grid-cols-1 items-start gap-x-[22px] gap-y-5 md:grid-cols-[minmax(0,1fr)_262px]">
            <div className="flex min-w-0 flex-col gap-3.5">
                {/* Nombre */}
                <div className="flex flex-col gap-[7px]">
                    <label htmlFor={`${prefijo}-name`} className={ETIQUETA}>
                        {t('templates.vista.nameLabel')}
                    </label>
                    <input
                        id={`${prefijo}-name`}
                        type="text"
                        value={nombre}
                        onChange={(e) => onNombre(e.target.value)}
                        placeholder={t('templates.vista.namePlaceholder')}
                        aria-invalid={errores.name ? true : undefined}
                        aria-describedby={`${prefijo}-name-ayuda`}
                        className={CAMPO}
                        required
                    />
                    <span id={`${prefijo}-name-ayuda`} className={errores.name ? ERROR_CAMPO : AYUDA}>
                        {errores.name || t('templates.vista.nameHelp')}
                    </span>
                </div>

                {/* Mensaje */}
                <div className="flex flex-col gap-[7px]">
                    <label htmlFor={`${prefijo}-content`} className={ETIQUETA}>
                        {t('templates.vista.messageLabel')}
                    </label>
                    <textarea
                        id={`${prefijo}-content`}
                        value={contenido}
                        onChange={(e) => onContenido(e.target.value)}
                        placeholder={t('templates.contentPlaceholder')}
                        rows={4}
                        aria-invalid={errores.content ? true : undefined}
                        aria-describedby={`${prefijo}-content-ayuda`}
                        className={cn(AREA, 'min-h-[104px]')}
                        required
                    />
                    <span id={`${prefijo}-content-ayuda`} className="flex items-start justify-between gap-3">
                        <span className={ERROR_CAMPO}>{errores.content}</span>
                        <span className={cn(AYUDA, 'shrink-0 tabular-nums', contenido.length > 4096 && 'font-semibold text-red-700 dark:text-red-400')}>
                            {t('templates.vista.charCount', { value: miles(contenido.length, lng), max: miles(4096, lng) })}
                        </span>
                    </span>
                </div>

                {/* Adjuntos */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-baseline justify-between gap-3">
                        <span id={`${prefijo}-files-label`} className={ETIQUETA}>
                            {t('templates.vista.attachmentsLabel')} <span className={cn('font-normal', TEXTO_SUAVE)}>{t('templates.vista.optional')}</span>
                        </span>
                        {total > 0 && <span className={cn(AYUDA, 'tabular-nums')}>{t('templates.vista.filesCount', { count: total })}</span>}
                    </div>
                    <input ref={inputArchivos} type="file" accept={ACEPTA} onChange={onArchivos} multiple className="hidden" tabIndex={-1} aria-hidden="true" />
                    {total > 0 && (
                        <ul aria-labelledby={`${prefijo}-files-label`} className="flex flex-col gap-2">
                            {existentes.map((a, i) => (
                                <FilaArchivo
                                    key={`e-${a.filename}-${i}`}
                                    nombre={a.filename}
                                    tipo={a.type}
                                    detalle={t('templates.vista.fileSaved', { type: tipoTexto(a.type) })}
                                    nuevo={false}
                                    miniatura={a.type === 'image' ? a.url : null}
                                    onQuitar={() => onQuitarExistente?.(i)}
                                />
                            ))}
                            {nuevos.map((a, i) => (
                                <FilaArchivo
                                    key={`n-${a.file.name}-${i}`}
                                    nombre={a.file.name}
                                    tipo={a.type}
                                    detalle={t('templates.vista.fileNew', { type: tipoTexto(a.type), size: (a.file.size / 1024 / 1024).toLocaleString(lng?.startsWith('en') ? 'en-US' : 'es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })}
                                    nuevo
                                    miniatura={a.preview}
                                    onQuitar={() => onQuitarNuevo(i)}
                                />
                            ))}
                        </ul>
                    )}
                    <button
                        type="button"
                        onClick={() => inputArchivos.current?.click()}
                        className={cn(
                            'flex h-[38px] w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-dashed border-[#2e3f84]/30 text-[12.5px] leading-4 font-semibold text-[#2e3f84] transition-colors hover:border-[#2e3f84]/60 hover:bg-[#2e3f84]/[0.03] dark:border-white/25 dark:text-neutral-100 dark:hover:border-white/45 dark:hover:bg-white/[0.03]',
                            FOCO
                        )}
                    >
                        <Paperclip className="size-3.5" strokeWidth={2} aria-hidden="true" />
                        {t('templates.vista.addFiles')}
                    </button>
                    <span className={errorArchivos ? ERROR_CAMPO : AYUDA}>{errorArchivos || t('templates.vista.formatsHelp')}</span>
                </div>

                {/* Quién la ve */}
                <fieldset className="flex min-w-0 flex-col gap-2">
                    <legend className={cn(ETIQUETA, 'mb-2')}>{t('templates.vista.whoSeesLabel')}</legend>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        <label className={opcionAlcance}>
                            <input type="radio" name={`${prefijo}_template_type`} checked={esGlobal} onChange={onGlobal} className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[#2e3f84] dark:accent-[#8b9ae0]" />
                            <span className="flex min-w-0 flex-col gap-0.5">
                                <span className={cn('flex items-center gap-1.5 text-[13px] leading-[18px] font-semibold', TEXTO_NAVY)}>
                                    <Building2 className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                                    {t('templates.vista.optEveryone')}
                                </span>
                                <span className={AYUDA}>{t('templates.vista.optEveryoneText')}</span>
                            </span>
                        </label>
                        <label className={opcionAlcance}>
                            <input type="radio" name={`${prefijo}_template_type`} checked={!esGlobal} onChange={onAsignada} className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[#2e3f84] dark:accent-[#8b9ae0]" />
                            <span className="flex min-w-0 flex-col gap-0.5">
                                <span className={cn('flex items-center gap-1.5 text-[13px] leading-[18px] font-semibold', TEXTO_NAVY)}>
                                    <Users className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                                    {t('templates.vista.optSome')}
                                </span>
                                <span className={AYUDA}>{t('templates.vista.optSomeText')}</span>
                            </span>
                        </label>
                    </div>
                    {!esGlobal && (
                        <>
                            <ul
                                aria-label={t('templates.assignToUsers')}
                                className="custom-scrollbar max-h-[196px] overflow-y-auto rounded-[10px] shadow-[inset_0_0_0_1px_rgba(46,63,132,0.14)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
                            >
                                {usuarios.map((u) => {
                                    const marcado = asignados.includes(u.id);
                                    return (
                                        <li key={u.id} className={cn('border-b last:border-b-0', FILETE)}>
                                            <label className="flex min-h-[38px] cursor-pointer items-center gap-2.5 px-2.5 py-1.5 transition-colors hover:bg-[#2e3f84]/[0.03] dark:hover:bg-white/[0.03]">
                                                <input
                                                    type="checkbox"
                                                    checked={marcado}
                                                    onChange={(e) => onUsuario(u.id, e.target.checked)}
                                                    className="size-[18px] shrink-0 cursor-pointer rounded accent-[#2e3f84] dark:accent-[#8b9ae0]"
                                                />
                                                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#2e3f84] text-[11px] leading-[14px] font-semibold text-white dark:bg-[#4e5fa4]" aria-hidden="true">
                                                    {iniciales(u.name)}
                                                </span>
                                                <span className={cn('min-w-0 flex-1 truncate text-[13px] leading-[18px]', marcado ? 'font-semibold' : 'font-medium', TEXTO_NAVY)}>{nombrePropio(u.name)}</span>
                                                <span className={cn('shrink-0 text-[12px] leading-4 font-medium', TEXTO_SUAVE)}>{rol(u.role)}</span>
                                            </label>
                                        </li>
                                    );
                                })}
                            </ul>
                            <span className={errores.assigned_users ? ERROR_CAMPO : cn(AYUDA, 'tabular-nums')}>
                                {errores.assigned_users || t('templates.vista.peopleChosen', { count: asignados.length, total: miles(usuarios.length, lng) })}
                            </span>
                        </>
                    )}
                </fieldset>
            </div>

            {/* Vista previa y activa */}
            <div className="flex min-w-0 flex-col gap-2.5 md:sticky md:top-0">
                <Rotulo titulo={t('templates.vista.previewLabel')} />
                <BurbujaSale texto={contenido} adjuntos={vista} vacio={t('templates.vista.previewEmpty')} ancho="w-[94%]" className="px-2.5 pt-3 pb-3.5" />
                <button
                    type="button"
                    role="switch"
                    aria-checked={activa}
                    aria-label={t('templates.vista.activeSwitch')}
                    onClick={() => onActiva(!activa)}
                    className={cn(
                        'flex w-full cursor-pointer items-center justify-between gap-3 rounded-[10px] px-3.5 py-3 text-left transition-colors',
                        activa
                            ? 'bg-emerald-50 text-emerald-800 shadow-[inset_0_0_0_1px_var(--color-emerald-200)] dark:bg-emerald-500/10 dark:text-emerald-200 dark:shadow-[inset_0_0_0_1px_rgba(16,185,129,0.25)]'
                            : 'bg-white shadow-[inset_0_0_0_1px_rgba(46,63,132,0.14)] dark:bg-white/[0.03] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]',
                        FOCO
                    )}
                >
                    <span className="flex min-w-0 flex-col gap-0.5">
                        <span className={cn('text-[13px] leading-[18px] font-semibold', !activa && TEXTO_NAVY)}>{activa ? t('templates.vista.activeOn') : t('templates.vista.activeOff')}</span>
                        <span className={cn('text-[12px] leading-4', !activa && TEXTO_SUAVE)}>{activa ? t('templates.vista.activeOnText') : t('templates.vista.activeOffText')}</span>
                    </span>
                    <Interruptor on={activa} />
                </button>
            </div>
        </div>
    );
}
