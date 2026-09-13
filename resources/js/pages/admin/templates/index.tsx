import { Head, router, usePage } from '@inertiajs/react';
import AdminLayout from '@/layouts/admin-layout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    BOTON_PELIGRO,
    BOTON_PELIGRO_LLENO,
    BOTON_PRIMARIO,
    BOTON_SECUNDARIO,
    FILETE,
    FOCO,
    HOJA,
    MONO,
    TEXTO_NAVY,
    TEXTO_SUAVE,
    nombrePropio,
} from '@/components/appointments/piezas-citas';
import { Banda, Cifra, H1, Nota, Rotulo, Segmentado, miles } from '@/components/bulk-sends/piezas-envio';
import {
    AREA,
    AYUDA,
    BOTON_TEXTO_NAVY,
    BOTON_TEXTO_ROJO,
    BurbujaSale,
    CAMPO,
    DISPARADOR,
    Dato,
    DialogoPlantilla,
    ERROR_CAMPO,
    ETIQUETA,
    EstadoPunto,
    FranjaCifras,
    MENU,
    OPCION,
    QueSeBorra,
    fechaDia,
    type AdjuntoVista,
} from '@/components/templates/piezas-plantillas';
import { cn } from '@/lib/utils';
import axios from 'axios';
import {
    Bot,
    Building2,
    Edit3,
    FileText,
    Image,
    LayoutGrid,
    Lock,
    MessageSquare,
    MessageSquareText,
    Paperclip,
    Plus,
    Power,
    PowerOff,
    Save,
    Search,
    Trash2,
    UserRound,
    Users,
    Video,
    X,
    type LucideIcon,
} from 'lucide-react';
import { useMemo, useRef, useState, type ComponentProps, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import TemplateCreateModal from './components/TemplateCreateModal';
import TemplateEditModal from './components/TemplateEditModal';
import WelcomeFlowSection from './components/WelcomeFlowSection';

/* ── Plantillas (/admin/templates) ────────────────────────────────────────────────────────────────
   Diseño aprobado: design/vista-plantillas/gen_plantillas.mjs. Son las respuestas rápidas del chat
   (el equipo las inserta escribiendo «/»), no las de Meta de Envío masivo. A la izquierda la lista por
   grupos; a la derecha, fija, la plantilla elegida tal como queda en el chat, quién la ve, cuánto se usa
   y lo que se puede hacer con ella. Debajo (administrador) el menú de bienvenida del bot.
   Las llamadas son las de siempre; lo nuevo es que el asesor edita y elimina aquí sus plantillas
   personales con /admin/my-templates (las mismas rutas JSON que usa el chat). */

interface MediaFile {
    url: string;
    filename: string;
    type: 'image' | 'video' | 'document';
}

interface User {
    id: number;
    name: string;
    role: string;
}

interface Template {
    id: number;
    name: string;
    subject: string | null;
    content: string;
    is_active: boolean;
    message_type: 'text' | 'image' | 'video' | 'document';
    is_global: boolean;
    assigned_users?: number[];
    media_url: string | null;
    media_filename: string | null;
    media_files?: MediaFile[];
    created_by: string;
    // Nuevo (lo añade el servidor): id de quien la creó. Si no llega, se deduce (ver esMia).
    created_by_id?: number | null;
    updated_by: string | null;
    created_at: string;
    updated_at: string;
    usage_stats: {
        total_sends: number;
    };
}

type WelcomeFlow = ComponentProps<typeof WelcomeFlowSection>['welcomeFlows'][number];

interface Filters {
    status: string;
    type: string;
    search: string;
}

interface TemplatesIndexProps {
    templates: Template[];
    filters: Filters;
    users: User[];
    welcomeFlows?: WelcomeFlow[];
}

type Grupo = { clave: string; icono: LucideIcon; titulo: string; nota: string; lista: Template[] };

// Mutaciones de las plantillas personales: axios lleva el token CSRF vivo de la cookie (tras un login
// SPA el del <meta> caduca y daría 419). validateStatus deja pasar 422/403/500 para leer su JSON.
const conEstado = { validateStatus: (s: number) => s !== 419 };

const TIPOS: Record<Template['message_type'], LucideIcon> = { text: MessageSquare, image: Image, video: Video, document: FileText };

/** Adjuntos de la plantilla en la forma de la burbuja (media_files o, en las antiguas, media_url). */
function adjuntosDe(tpl: Template, fallback: string): AdjuntoVista[] {
    if (tpl.media_files?.length) return tpl.media_files;
    if (tpl.media_url) {
        const type: AdjuntoVista['type'] = tpl.message_type === 'image' ? 'image' : tpl.message_type === 'video' ? 'video' : 'document';
        return [{ url: tpl.media_url, filename: tpl.media_filename || fallback, type }];
    }
    return [];
}

/** "/ubicación": lo que se escribe en el chat (la primera palabra del nombre, en minúsculas). */
const atajo = (nombre: string) => `/${(nombre.trim().split(/\s+/)[0] ?? '').toLocaleLowerCase('es')}`;

export default function TemplatesIndex({ templates, filters, users, welcomeFlows = [] }: TemplatesIndexProps) {
    const { t, i18n } = useTranslation();
    const lng = i18n.language;
    const { auth } = usePage().props as { auth?: { user?: { id?: number; name?: string; role?: string } } };
    const isAdmin = auth?.user?.role === 'admin';
    const miId = auth?.user?.id;

    const [search, setSearch] = useState(filters.search || '');
    const [statusFilter, setStatusFilter] = useState(filters.status || 'all');
    const [typeFilter, setTypeFilter] = useState(filters.type || 'all');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    // Plantilla pendiente de borrar (null = diálogo cerrado).
    const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [templateToEdit, setTemplateToEdit] = useState<Template | null>(null);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const panelRef = useRef<HTMLElement>(null);
    const seguroBorrar = useRef<HTMLButtonElement>(null);

    // Plantillas personales del asesor (editar y eliminar con /admin/my-templates).
    const [personalEdit, setPersonalEdit] = useState<Template | null>(null);
    const [personalName, setPersonalName] = useState('');
    const [personalContent, setPersonalContent] = useState('');
    const [personalErrors, setPersonalErrors] = useState<{ name?: string; content?: string; general?: string }>({});
    const [personalSaving, setPersonalSaving] = useState(false);
    const [personalDelete, setPersonalDelete] = useState<Template | null>(null);
    const [personalDeleteError, setPersonalDeleteError] = useState('');
    const [personalDeleting, setPersonalDeleting] = useState(false);
    const seguroBorrarPersonal = useRef<HTMLButtonElement>(null);

    /** ¿La creé yo? Con created_by_id es exacto; sin él (respuesta antigua), se deduce. */
    const esMia = (tpl: Template) => {
        if (tpl.created_by_id != null) return tpl.created_by_id === miId;
        if (isAdmin) return !!auth?.user?.name && tpl.created_by === auth.user.name;
        return !tpl.is_global && !(tpl.assigned_users ?? []).includes(miId ?? -1);
    };
    const esPersonalMia = (tpl: Template) => !tpl.is_global && esMia(tpl);

    const stats = useMemo(() => {
        const active = templates.filter((template) => template.is_active).length;
        const withMedia = templates.filter((template) => (template.media_files?.length ?? 0) > 0 || template.media_url).length;
        const assigned = templates.filter((template) => !template.is_global).length;
        return { active, inactive: templates.length - active, withMedia, assigned };
    }, [templates]);

    /**
     * Filtrado INSTANTÁNEO en el cliente (la misma lógica de antes): estado, tipo y texto en nombre,
     * asunto y contenido. El backend sigue aceptando los filtros por querystring, así que los enlaces
     * directos con ?search=... siguen funcionando (llegan en `filters`).
     */
    const filteredTemplates = useMemo(() => {
        const term = search.trim().toLowerCase();

        return templates.filter((template) => {
            if (statusFilter === 'active' && !template.is_active) return false;
            if (statusFilter === 'inactive' && template.is_active) return false;
            if (typeFilter !== 'all' && template.message_type !== typeFilter) return false;

            if (!term) return true;
            return (
                template.name.toLowerCase().includes(term) ||
                (template.subject ?? '').toLowerCase().includes(term) ||
                template.content.toLowerCase().includes(term)
            );
        });
    }, [templates, search, statusFilter, typeFilter]);

    // Grupos de la lista (las más usadas primero dentro de cada uno).
    const grupos: Grupo[] = useMemo(() => {
        const porUso = (a: Template, b: Template) => Number(b.usage_stats?.total_sends ?? 0) - Number(a.usage_stats?.total_sends ?? 0) || a.name.localeCompare(b.name, 'es');
        const de = (f: (tpl: Template) => boolean) => filteredTemplates.filter(f).sort(porUso);
        if (isAdmin) {
            return [
                { clave: 'global', icono: Building2, titulo: t('templates.vista.groupEveryone'), nota: t('templates.vista.groupEveryoneNote'), lista: de((x) => x.is_global) },
                { clave: 'some', icono: Users, titulo: t('templates.vista.groupSome'), nota: t('templates.vista.groupSomeNote'), lista: de((x) => !x.is_global) },
            ];
        }
        return [
            { clave: 'mine', icono: UserRound, titulo: t('templates.vista.groupMine'), nota: t('templates.vista.groupMineNote'), lista: de((x) => esPersonalMia(x)) },
            { clave: 'assigned', icono: Users, titulo: t('templates.vista.groupAssigned'), nota: t('templates.vista.groupAssignedNote'), lista: de((x) => !x.is_global && !esPersonalMia(x)) },
            { clave: 'hospital', icono: Building2, titulo: t('templates.vista.groupHospital'), nota: t('templates.vista.groupHospitalNote'), lista: de((x) => x.is_global) },
        ];
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filteredTemplates, isAdmin, miId, t]);

    const visibles = grupos.flatMap((g) => g.lista);
    const selected = visibles.find((tpl) => tpl.id === selectedId) ?? visibles[0] ?? null;

    const clearFilters = () => {
        setSearch('');
        setStatusFilter('all');
        setTypeFilter('all');
    };

    const toggleStatus = (templateId: number) => {
        router.post(
            `/admin/templates/${templateId}/toggle`,
            {},
            {
                preserveScroll: true,
                onSuccess: () => toast.success(t('templates.statusUpdated')),
                onError: () => toast.error(t('templates.statusUpdateError')),
            }
        );
    };

    /**
     * Borrado con diálogo propio en vez de confirm() del navegador: dice QUÉ plantilla se borra y
     * cuántas veces se ha usado (se podía eliminar "AGENDAR CITA", con miles de usos, de un clic).
     */
    const deleteTemplate = (templateId: number) => {
        const target = templates.find((tpl) => tpl.id === templateId) ?? null;
        setTemplateToDelete(target);
    };

    const confirmDeleteTemplate = () => {
        if (!templateToDelete) return;
        const id = templateToDelete.id;
        setTemplateToDelete(null);
        router.delete(`/admin/templates/${id}`, {
            preserveScroll: true,
            onSuccess: () => toast.success(t('templates.deleted')),
            onError: () => toast.error(t('templates.deleteError')),
        });
    };

    /* ── Plantillas personales (asesor) ── */
    const abrirEditarPersonal = (tpl: Template) => {
        setPersonalEdit(tpl);
        setPersonalName(tpl.name);
        setPersonalContent(tpl.content);
        setPersonalErrors({});
        setPersonalSaving(false);
    };
    const cerrarEditarPersonal = () => {
        if (personalSaving) return;
        setPersonalEdit(null);
        setPersonalErrors({});
    };
    const guardarPersonal = async (event: FormEvent) => {
        event.preventDefault();
        if (!personalEdit || personalSaving) return;
        setPersonalSaving(true);
        setPersonalErrors({});
        try {
            const r = await axios.put(`/admin/my-templates/${personalEdit.id}`, { name: personalName, content: personalContent }, conEstado);
            if (r.status >= 200 && r.status < 300) {
                setPersonalEdit(null);
                toast.success(t('templates.templateUpdated'));
                router.reload({ only: ['templates'] });
                return;
            }
            const errs = (r.data?.errors ?? {}) as Record<string, string[] | string>;
            const primero = (v?: string[] | string) => (Array.isArray(v) ? v[0] : v);
            if (r.status === 422 && (errs.name || errs.content)) {
                setPersonalErrors({ name: primero(errs.name), content: primero(errs.content) });
            } else {
                setPersonalErrors({ general: (typeof r.data?.message === 'string' && r.data.message) || t('templates.vista.personalSaveError') });
            }
        } catch {
            setPersonalErrors({ general: t('templates.vista.requestFailed') });
        } finally {
            setPersonalSaving(false);
        }
    };
    const abrirBorrarPersonal = (tpl: Template) => {
        setPersonalDelete(tpl);
        setPersonalDeleteError('');
        setPersonalDeleting(false);
    };
    const confirmarBorrarPersonal = async () => {
        if (!personalDelete || personalDeleting) return;
        setPersonalDeleting(true);
        setPersonalDeleteError('');
        try {
            const r = await axios.delete(`/admin/my-templates/${personalDelete.id}`, conEstado);
            if (r.status >= 200 && r.status < 300) {
                setPersonalDelete(null);
                toast.success(t('templates.deleted'));
                router.reload({ only: ['templates'] });
                return;
            }
            setPersonalDeleteError((typeof r.data?.message === 'string' && r.data.message) || t('templates.vista.personalDeleteError'));
        } catch {
            setPersonalDeleteError(t('templates.vista.requestFailed'));
        } finally {
            setPersonalDeleting(false);
        }
    };

    /** Elegir una fila. Si el panel está debajo de la lista (pantalla estrecha), se lleva la vista a él. */
    const elegir = (id: number) => {
        setSelectedId(id);
        requestAnimationFrame(() => {
            const panel = panelRef.current;
            if (!panel) return;
            const top = panel.getBoundingClientRect().top;
            if (top > window.innerHeight * 0.75) {
                const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                panel.scrollIntoView({ behavior: suave ? 'smooth' : 'auto', block: 'start' });
            }
        });
    };

    const irAlMenu = () => {
        const destino = document.getElementById('menu-bienvenida');
        if (!destino) return;
        const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        destino.scrollIntoView({ behavior: suave ? 'smooth' : 'auto', block: 'start' });
        document.getElementById('menu-bienvenida-titulo')?.focus({ preventScroll: true });
    };

    const hasFilters = Boolean(search.trim()) || statusFilter !== 'all' || typeFilter !== 'all';
    const typeLabel = (type: Template['message_type']) => t(`templates.types.${type}`);
    const usos = (tpl: Template) => Number(tpl.usage_stats?.total_sends ?? 0);
    const nombresDe = (ids: number[]) => ids.map((id) => users.find((u) => u.id === id)?.name).filter((n): n is string => !!n);

    /** Icono y texto corto de "quién la ve" (columna de la lista y cabecera del panel). */
    const alcance = (tpl: Template): [LucideIcon, string] => {
        if (tpl.is_global) return [Building2, isAdmin ? t('templates.vista.scopeEveryone') : t('templates.vista.scopeHospital')];
        const asignados = tpl.assigned_users?.length ?? 0;
        if (!isAdmin && !esMia(tpl)) return [Users, t('templates.vista.scopeAssignedYou')];
        if (asignados > 0) return [Users, t('templates.vista.scopePeople', { count: asignados, value: miles(asignados, lng) })];
        return [UserRound, esMia(tpl) ? t('templates.vista.scopeOnlyYou') : t('templates.vista.scopeOnlyCreator')];
    };

    /** Texto largo de "quién la ve" (panel de detalle). */
    const quienLaVe = (tpl: Template) => {
        if (tpl.is_global) return isAdmin ? t('templates.vista.whoEveryoneAdmin') : t('templates.vista.whoEveryoneAdvisor');
        const ids = tpl.assigned_users ?? [];
        if (!isAdmin && !esMia(tpl)) {
            const otros = ids.filter((id) => id !== miId).length;
            return otros > 0 ? t('templates.vista.whoAssignedYouMore', { count: otros, value: miles(otros, lng) }) : t('templates.vista.whoAssignedYouOnly');
        }
        if (ids.length > 0) {
            const nombres = nombresDe(ids);
            return nombres.length ? nombres.map(nombrePropio).join(', ') : t('templates.vista.scopePeople', { count: ids.length, value: miles(ids.length, lng) });
        }
        return esMia(tpl) ? t('templates.vista.whoOnlyYou') : t('templates.vista.whoOnlyCreator', { name: tpl.created_by });
    };

    const activeFlow = welcomeFlows.find((flow) => flow.is_active) ?? null;
    const misPersonales = templates.filter((x) => esPersonalMia(x)).length;
    const asignadasAMi = isAdmin ? 0 : templates.filter((x) => !x.is_global && !esPersonalMia(x)).length;

    const marca = (Icono: LucideIcon, color: string) => <Icono className={cn('size-3.5 shrink-0', color)} strokeWidth={2} aria-hidden="true" />;
    const detalleActivas = t('templates.vista.metricActiveInactive', { active: miles(stats.active, lng), inactive: miles(stats.inactive, lng) });

    const cifras = isAdmin
        ? [
              <Cifra key="total" marca={marca(MessageSquareText, TEXTO_NAVY)} etiqueta={t('templates.vista.metricTemplates')} valor={miles(templates.length, lng)} detalle={<span className="truncate">{detalleActivas}</span>} />,
              <Cifra key="media" marca={marca(Paperclip, 'text-sky-600 dark:text-sky-400')} etiqueta={t('templates.metricWithMedia')} valor={miles(stats.withMedia, lng)} detalle={<span className="truncate">{t('templates.metricWithMediaDetail')}</span>} />,
              <Cifra
                  key="some"
                  marca={marca(Users, TEXTO_NAVY)}
                  etiqueta={t('templates.vista.metricSomePeople')}
                  valor={miles(stats.assigned, lng)}
                  detalle={<span className="truncate">{t('templates.vista.metricSomePeopleDetail', { value: miles(templates.length - stats.assigned, lng) })}</span>}
              />,
              <Cifra
                  key="welcome"
                  marca={marca(Bot, 'text-emerald-600 dark:text-emerald-400')}
                  etiqueta={t('templates.vista.metricWelcome')}
                  valor={t('templates.vista.metricWelcomeValue', { count: welcomeFlows.length, value: miles(welcomeFlows.length, lng) })}
                  detalle={
                      activeFlow ? (
                          <EstadoPunto on className="min-w-0 font-medium [&>span:last-child]:truncate">
                              <span className="truncate">{t('templates.vista.metricWelcomeActive', { name: activeFlow.name })}</span>
                          </EstadoPunto>
                      ) : (
                          <EstadoPunto on={false} className="font-medium">
                              {t('templates.vista.metricWelcomeNone')}
                          </EstadoPunto>
                      )
                  }
              />,
          ]
        : [
              <Cifra key="avail" marca={marca(MessageSquareText, TEXTO_NAVY)} etiqueta={t('templates.vista.metricAvailable')} valor={miles(templates.length, lng)} detalle={<span className="truncate">{detalleActivas}</span>} />,
              <Cifra key="mine" marca={marca(UserRound, 'text-sky-600 dark:text-sky-400')} etiqueta={t('templates.vista.metricMine')} valor={miles(misPersonales, lng)} detalle={<span className="truncate">{t('templates.vista.metricMineDetail')}</span>} />,
              ...(asignadasAMi > 0
                  ? [<Cifra key="asig" marca={marca(Users, TEXTO_NAVY)} etiqueta={t('templates.vista.metricAssigned')} valor={miles(asignadasAMi, lng)} detalle={<span className="truncate">{t('templates.vista.metricAssignedDetail')}</span>} />]
                  : []),
              <Cifra key="media" marca={marca(Paperclip, TEXTO_NAVY)} etiqueta={t('templates.metricWithMedia')} valor={miles(stats.withMedia, lng)} detalle={<span className="truncate">{t('templates.metricWithMediaDetail')}</span>} />,
          ];

    const statusOptions = [
        { value: 'all', label: t('common.allFeminine') },
        { value: 'active', label: t('common.active') },
        { value: 'inactive', label: t('common.inactive') },
    ];
    const typeOptions = [
        { value: 'all', label: t('templates.vista.allTypes') },
        { value: 'text', label: t('templates.types.text') },
        { value: 'image', label: t('templates.types.image') },
        { value: 'video', label: t('templates.types.video') },
        { value: 'document', label: t('templates.types.document') },
    ];

    // Columnas de la lista (lista de al menos 32rem): icono · plantilla · quién la ve · usos · estado.
    const COLUMNAS = 'grid-cols-[32px_minmax(0,1fr)_118px_52px_74px] gap-x-3';

    /* ── Panel de la derecha: la plantilla elegida ── */
    const panel = selected ? (
        (() => {
            const tpl = selected;
            const IconoTipo = TIPOS[tpl.message_type] ?? MessageSquare;
            const [IconoAlcance, textoAlcance] = alcance(tpl);
            const adjuntos = adjuntosDe(tpl, t('templates.fileFallback'));
            const personal = !isAdmin && esPersonalMia(tpl);
            return (
                <>
                    <div className={cn('flex flex-col gap-1.5 border-b px-5 pt-[18px] pb-4 @3xl/hoja:px-6', FILETE)}>
                        <div className="flex items-start justify-between gap-3">
                            <h3 id="detalle-plantilla" className={cn('min-w-0 text-[17px] leading-[22px] font-semibold tracking-[-0.01em] [overflow-wrap:anywhere]', tpl.is_active ? TEXTO_NAVY : TEXTO_SUAVE)}>
                                {tpl.name}
                            </h3>
                            <EstadoPunto on={tpl.is_active} className="mt-[3px] text-[13px]" title={tpl.is_active ? undefined : t('templates.vista.inactiveHint')}>
                                {tpl.is_active ? t('templates.statusLabels.active') : t('templates.statusLabels.inactive')}
                            </EstadoPunto>
                        </div>
                        <div className={cn('flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12.5px] leading-4 font-medium', TEXTO_SUAVE)}>
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                                <IconoTipo className="size-3.5" strokeWidth={1.9} aria-hidden="true" />
                                {typeLabel(tpl.message_type)}
                            </span>
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                                <IconoAlcance className="size-3.5" strokeWidth={1.9} aria-hidden="true" />
                                {textoAlcance}
                            </span>
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap tabular-nums">
                                <MessageSquare className="size-3.5" strokeWidth={1.9} aria-hidden="true" />
                                {t('templates.vista.usesInChat', { count: usos(tpl), value: miles(usos(tpl), lng) })}
                            </span>
                        </div>

                        <div className="mt-2">
                            {isAdmin ? (
                                <div className="flex flex-col gap-2.5">
                                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2.5">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setTemplateToEdit(tpl);
                                                setIsEditModalOpen(true);
                                            }}
                                            title={t('templates.vista.editHintAdmin')}
                                            className={BOTON_PRIMARIO}
                                        >
                                            <Edit3 strokeWidth={2} aria-hidden="true" />
                                            {t('common.edit')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => toggleStatus(tpl.id)}
                                            title={tpl.is_active ? t('templates.vista.deactivateHint') : t('templates.vista.activateHint')}
                                            className={BOTON_SECUNDARIO}
                                        >
                                            {tpl.is_active ? <PowerOff strokeWidth={1.9} aria-hidden="true" /> : <Power strokeWidth={1.9} aria-hidden="true" />}
                                            {tpl.is_active ? t('common.deactivate') : t('common.activate')}
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <span className={cn('min-w-0 text-[12px] leading-4', TEXTO_SUAVE)}>{tpl.is_active ? t('templates.vista.deactivateNote') : t('templates.vista.inactiveNote')}</span>
                                        <button
                                            type="button"
                                            onClick={() => deleteTemplate(tpl.id)}
                                            aria-haspopup="dialog"
                                            title={t('templates.vista.asksConfirmation')}
                                            className={cn(BOTON_TEXTO_ROJO, '-mr-2')}
                                        >
                                            <Trash2 strokeWidth={2} aria-hidden="true" />
                                            {t('templates.vista.deleteEllipsis')}
                                        </button>
                                    </div>
                                </div>
                            ) : personal ? (
                                <div className="flex items-center gap-2.5">
                                    <button type="button" onClick={() => abrirEditarPersonal(tpl)} title={t('templates.vista.editHintPersonal')} className={cn(BOTON_PRIMARIO, 'flex-1')}>
                                        <Edit3 strokeWidth={2} aria-hidden="true" />
                                        {t('common.edit')}
                                    </button>
                                    <button type="button" onClick={() => abrirBorrarPersonal(tpl)} aria-haspopup="dialog" title={t('templates.vista.asksConfirmation')} className={BOTON_PELIGRO}>
                                        <Trash2 strokeWidth={2} aria-hidden="true" />
                                        {t('templates.vista.deleteEllipsis')}
                                    </button>
                                </div>
                            ) : (
                                <p className={cn('flex items-start gap-[9px] text-[12.5px] leading-[18px]', TEXTO_SUAVE)}>
                                    <Lock className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                                    {t('templates.vista.lockedNote')}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-3.5 px-5 pt-4 pb-6 @3xl/hoja:px-6">
                        <div className="flex flex-col gap-2">
                            <Rotulo as="h4" titulo={t('templates.vista.previewInChat')} />
                            <BurbujaSale texto={tpl.content} adjuntos={adjuntos} vacio={t('templates.vista.emptyContent')} />
                        </div>
                        <dl className={cn('flex flex-col border-t', FILETE)}>
                            <Dato etiqueta={t('templates.vista.toUse')}>
                                <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <span
                                        className={cn(
                                            'inline-flex h-[22px] items-center rounded-md bg-white px-[7px] text-[12px] leading-4 font-semibold whitespace-nowrap shadow-[inset_0_0_0_1px_rgba(46,63,132,0.16)] dark:bg-white/5 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)]',
                                            MONO,
                                            TEXTO_NAVY
                                        )}
                                    >
                                        {atajo(tpl.name)}
                                    </span>
                                    <span className={cn('font-normal', TEXTO_SUAVE)}>{t('templates.vista.toUseHint')}</span>
                                </span>
                            </Dato>
                            <Dato etiqueta={t('templates.vista.whoSees')}>{quienLaVe(tpl)}</Dato>
                            {adjuntos.length > 0 && (
                                <Dato etiqueta={adjuntos.length === 1 ? t('templates.vista.attachmentOne') : t('templates.vista.attachmentMany')}>
                                    <span className="flex flex-col">
                                        {adjuntos.map((a, i) => (
                                            <a
                                                key={`${a.filename}-${i}`}
                                                href={a.url ?? undefined}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={cn('w-fit max-w-full truncate text-[12px] underline decoration-[#2e3f84]/30 underline-offset-2 hover:decoration-current dark:decoration-white/30', MONO, FOCO)}
                                            >
                                                {a.filename}
                                            </a>
                                        ))}
                                    </span>
                                </Dato>
                            )}
                            <Dato etiqueta={t('templates.vista.updated')}>
                                {tpl.updated_by
                                    ? t('templates.vista.updatedValue', { date: fechaDia(tpl.updated_at || tpl.created_at, lng), name: tpl.updated_by })
                                    : fechaDia(tpl.updated_at || tpl.created_at, lng)}
                            </Dato>
                            {isAdmin && <Dato etiqueta={t('templates.vista.createdByLabel')}>{tpl.created_by}</Dato>}
                        </dl>
                    </div>
                </>
            );
        })()
    ) : (
        <div className="px-5 py-8 @3xl/hoja:px-6">
            <p className={cn('text-[13px] leading-[18px]', TEXTO_SUAVE)}>{t('templates.vista.pickOne')}</p>
        </div>
    );

    /* ── Lista ── */
    const fila = (tpl: Template, final: boolean) => {
        const on = selected?.id === tpl.id;
        const IconoTipo = TIPOS[tpl.message_type] ?? MessageSquare;
        const [IconoAlcance, textoAlcance] = alcance(tpl);
        const nAdj = adjuntosDe(tpl, '').length;
        const alcanceTenue = tpl.is_global;
        const estado = (
            <EstadoPunto on={tpl.is_active} title={tpl.is_active ? undefined : t('templates.vista.inactiveHint')}>
                {tpl.is_active ? t('templates.statusLabels.active') : t('templates.statusLabels.inactive')}
            </EstadoPunto>
        );
        const icono = (
            <span
                className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-[9px]',
                    on ? 'bg-white shadow-[inset_0_0_0_1px_rgba(46,63,132,0.14)] dark:bg-white/10 dark:shadow-none' : 'bg-[#2e3f84]/[0.055] dark:bg-white/[0.06]',
                    tpl.is_active ? TEXTO_NAVY : TEXTO_SUAVE
                )}
                title={typeLabel(tpl.message_type)}
            >
                <IconoTipo className="size-4" strokeWidth={1.9} aria-hidden="true" />
                <span className="sr-only">{typeLabel(tpl.message_type)}</span>
            </span>
        );
        const nombre = (
            <span className="flex min-w-0 items-center gap-[7px]">
                <span className={cn('truncate text-[13.5px] leading-[18px] font-semibold', tpl.is_active ? TEXTO_NAVY : TEXTO_SUAVE)}>{tpl.name}</span>
                {nAdj > 0 && (
                    <span className={cn('inline-flex shrink-0 items-center gap-[3px] text-[12px] leading-4 font-semibold tabular-nums', TEXTO_SUAVE)} title={t('templates.vista.attachmentsCount', { count: nAdj })}>
                        <Paperclip className="size-3" strokeWidth={2} aria-hidden="true" />
                        {nAdj}
                        <span className="sr-only">{t('templates.vista.attachmentsCount', { count: nAdj })}</span>
                    </span>
                )}
            </span>
        );
        const extracto = <span className={cn('truncate text-[12.5px] leading-4', TEXTO_SUAVE)}>{tpl.content}</span>;
        const quien = (
            <span className={cn('inline-flex min-w-0 items-center gap-1.5 text-[12.5px] leading-4 font-medium', alcanceTenue ? TEXTO_SUAVE : TEXTO_NAVY)}>
                <IconoAlcance className="size-3.5 shrink-0" strokeWidth={1.9} aria-hidden="true" />
                <span className="truncate">{textoAlcance}</span>
            </span>
        );
        return (
            <li key={tpl.id} className={cn(!final && 'border-b', FILETE)}>
                <button
                    type="button"
                    onClick={() => elegir(tpl.id)}
                    aria-current={on ? 'true' : undefined}
                    aria-controls="panel-plantilla"
                    title={t('templates.vista.rowHint')}
                    className={cn(
                        'block w-full cursor-pointer text-left transition-colors',
                        on
                            ? 'bg-[#2e3f84]/6 shadow-[inset_0_0_0_1px_rgba(46,63,132,0.16)] dark:bg-white/[0.06] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]'
                            : 'hover:bg-[#2e3f84]/[0.025] dark:hover:bg-white/[0.025]',
                        FOCO,
                        'focus-visible:ring-inset'
                    )}
                >
                    {/* Fila ancha (lista de 32rem o más) */}
                    <span className={cn('hidden min-h-14 items-center px-5 py-2 @lg/lista:grid', COLUMNAS)}>
                        {icono}
                        <span className="flex min-w-0 flex-col gap-0.5">
                            {nombre}
                            {extracto}
                        </span>
                        {quien}
                        <span className={cn('text-right text-[13px] leading-[18px] font-semibold tabular-nums', TEXTO_NAVY)}>{miles(usos(tpl), lng)}</span>
                        {estado}
                    </span>
                    {/* Fila estrecha */}
                    <span className="flex items-start gap-3 px-4 py-3 @lg/lista:hidden">
                        {icono}
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                            {nombre}
                            {extracto}
                            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                {quien}
                                <span className={cn('text-[12.5px] leading-4 tabular-nums', TEXTO_SUAVE)}>{t('templates.vista.usesInChat', { count: usos(tpl), value: miles(usos(tpl), lng) })}</span>
                                {estado}
                            </span>
                        </span>
                    </span>
                </button>
            </li>
        );
    };

    const gruposConFilas = grupos.filter((g) => g.lista.length > 0);
    const ultimoGrupo = gruposConFilas[gruposConFilas.length - 1]?.clave;

    const lista =
        visibles.length === 0 ? (
            <div className="px-4 py-8 @3xl/hoja:px-5">
                <div className="flex flex-col items-center gap-2 rounded-xl border-[1.5px] border-dashed border-[#2e3f84]/26 bg-[#2e3f84]/[0.035] px-5 py-7 text-center dark:border-white/20 dark:bg-white/[0.03]">
                    <span className={cn('flex size-10 items-center justify-center rounded-xl bg-white shadow-[inset_0_0_0_1px_rgba(46,63,132,0.12)] dark:bg-white/5 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]', TEXTO_SUAVE)}>
                        {hasFilters ? <Search className="size-[19px]" strokeWidth={1.9} aria-hidden="true" /> : <MessageSquareText className="size-[19px]" strokeWidth={1.9} aria-hidden="true" />}
                    </span>
                    <p className={cn('text-[13.5px] leading-[18px] font-semibold', TEXTO_NAVY)} aria-live="polite">
                        {hasFilters ? t('templates.vista.noResults') : isAdmin ? t('templates.vista.emptyAdminTitle') : t('templates.vista.emptyAdvisorTitle')}
                    </p>
                    <p className={cn('max-w-md text-[12.5px] leading-[18px]', TEXTO_SUAVE)}>
                        {hasFilters ? t('templates.vista.noResultsHint') : isAdmin ? t('templates.vista.emptyAdminText') : t('templates.vista.listTextAdvisor')}
                    </p>
                    {hasFilters ? (
                        <button type="button" onClick={clearFilters} className={cn(BOTON_SECUNDARIO, 'mt-2')}>
                            <X strokeWidth={2} aria-hidden="true" />
                            {t('templates.vista.clearFilters')}
                        </button>
                    ) : (
                        isAdmin && (
                            <button type="button" onClick={() => setIsCreateModalOpen(true)} className={cn(BOTON_PRIMARIO, 'mt-2')}>
                                <Plus strokeWidth={2} aria-hidden="true" />
                                {t('templates.newTemplate')}
                            </button>
                        )
                    )}
                </div>
            </div>
        ) : (
            <>
                <div aria-hidden="true" className={cn('hidden h-[34px] items-center border-b px-5 @lg/lista:grid', COLUMNAS, FILETE)}>
                    <span />
                    {[t('templates.vista.colTemplate'), t('templates.vista.colWho'), t('templates.vista.colUses'), t('templates.vista.colStatus')].map((h, i) => (
                        <span key={h} className={cn('truncate text-[11px] leading-4 font-semibold tracking-[0.07em] uppercase', TEXTO_SUAVE, i === 2 && 'text-right')}>
                            {h}
                        </span>
                    ))}
                </div>
                {gruposConFilas.map((g) => {
                    const Icono = g.icono;
                    return (
                        <section key={g.clave} aria-labelledby={`grupo-${g.clave}`}>
                            <div className={cn('flex min-h-8 flex-wrap items-center gap-x-2 gap-y-0.5 border-b bg-[#2e3f84]/[0.028] px-4 py-1.5 @3xl/hoja:px-5 dark:bg-white/[0.03]', FILETE)}>
                                <Icono className={cn('size-3.5 shrink-0', TEXTO_SUAVE)} strokeWidth={1.9} aria-hidden="true" />
                                <h3 id={`grupo-${g.clave}`} className={cn('text-[12.5px] leading-4 font-semibold whitespace-nowrap', TEXTO_NAVY)}>
                                    {g.titulo}
                                </h3>
                                <span className={cn('text-[12.5px] leading-4 font-medium tabular-nums', TEXTO_SUAVE)}>{miles(g.lista.length, lng)}</span>
                                <span className={cn('ml-auto truncate text-[12px] leading-4', TEXTO_SUAVE)}>{g.nota}</span>
                            </div>
                            <ul aria-labelledby={`grupo-${g.clave}`} className={cn(g.clave !== ultimoGrupo && 'border-b', FILETE)}>
                                {g.lista.map((tpl, i) => fila(tpl, i === g.lista.length - 1))}
                            </ul>
                        </section>
                    );
                })}
            </>
        );

    const personalDeleteUsos = personalDelete ? usos(personalDelete) : 0;
    const deleteUsos = templateToDelete ? usos(templateToDelete) : 0;

    return (
        <AdminLayout>
            <Head title={t('templates.title')} />

            <div className="min-h-screen bg-background px-4 pt-5 pb-8 md:px-7 md:pt-7">
                <div className="@container/pagina mx-auto flex max-w-7xl flex-col gap-6">
                    {/* ── Cabecera ── */}
                    <header className="flex min-w-0 flex-wrap items-start justify-between gap-x-6 gap-y-1">
                        <h1 className={cn(H1, 'order-1')}>{t('templates.title')}</h1>
                        {/* Ancho: botones a la derecha del título y el subtítulo debajo, a lo ancho (como el diseño).
                            Estrecho: título, subtítulo y luego los botones. */}
                        <p className="order-2 basis-full text-[14px] leading-5 text-muted-foreground @3xl/pagina:order-3 dark:text-neutral-400">
                            {isAdmin ? t('templates.vista.subAdmin') : t('templates.vista.subAdvisor')}
                        </p>
                        {isAdmin && (
                            <div className="order-3 mt-2 flex flex-wrap items-center gap-2.5 @3xl/pagina:order-2 @3xl/pagina:mt-0 @3xl/pagina:pt-px">
                                <button type="button" onClick={irAlMenu} title={t('templates.vista.welcomeMenuButtonHint')} className={BOTON_SECUNDARIO}>
                                    <Bot strokeWidth={1.9} aria-hidden="true" />
                                    {t('templates.vista.welcomeMenuButton')}
                                </button>
                                <button type="button" onClick={() => setIsCreateModalOpen(true)} aria-haspopup="dialog" className={BOTON_PRIMARIO}>
                                    <Plus strokeWidth={2} aria-hidden="true" />
                                    {t('templates.newTemplate')}
                                </button>
                            </div>
                        )}
                    </header>

                    {/* ── Franja de cifras ── */}
                    <FranjaCifras etiqueta={t('templates.vista.summaryLabel')} cifras={cifras} />

                    {/* ── Hoja: lista a la izquierda, plantilla elegida a la derecha ── */}
                    <section aria-labelledby="respuestas-rapidas" className={HOJA}>
                        <Banda
                            id="respuestas-rapidas"
                            icon={MessageSquareText}
                            titulo={isAdmin ? t('templates.vista.listTitleAdmin') : t('templates.vista.listTitleAdvisor')}
                            cuenta={miles(templates.length, lng)}
                            texto={isAdmin ? t('templates.vista.listTextAdmin') : t('templates.vista.listTextAdvisor')}
                            className="rounded-t-2xl"
                        />
                        <div className="grid grid-cols-1 @5xl/hoja:grid-cols-[minmax(0,1fr)_400px] @min-[68rem]/hoja:grid-cols-[minmax(0,1fr)_452px]">
                            <div className="@container/lista flex min-w-0 flex-col">
                                {/* Filtros: instantáneos, sin botón "Filtrar" */}
                                <div className={cn('flex flex-wrap items-center gap-2.5 border-b px-4 py-3 @3xl/hoja:px-5', FILETE)}>
                                    <div className="relative min-w-0 flex-[1_1_100%] @xl/lista:flex-[1_1_10rem]">
                                        <label htmlFor="template-search" className="sr-only">
                                            {t('templates.vista.searchLabel')}
                                        </label>
                                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground dark:text-neutral-400" strokeWidth={1.75} aria-hidden="true" />
                                        <input
                                            id="template-search"
                                            name="template-search"
                                            type="text"
                                            value={search}
                                            onChange={(event) => setSearch(event.target.value)}
                                            onKeyDown={(event) => event.key === 'Escape' && setSearch('')}
                                            placeholder={t('templates.vista.searchPlaceholder')}
                                            className={cn(
                                                'h-9 w-full rounded-[10px] bg-[#2e3f84]/[0.035] pr-3 pl-[38px] text-[13px] leading-[18px] text-foreground shadow-[inset_0_0_0_1px_rgba(46,63,132,0.1)] transition-shadow placeholder:text-muted-foreground dark:bg-white/5 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] dark:placeholder:text-neutral-400',
                                                FOCO
                                            )}
                                        />
                                    </div>
                                    <Segmentado opciones={statusOptions} activa={statusFilter} onElegir={setStatusFilter} etiqueta={t('templates.vista.filterStatus')} className="[&>button]:px-[9px]" />
                                    <div className="relative min-w-[9.5rem] flex-1 @xl/lista:w-40 @xl/lista:flex-none @3xl/lista:w-44">
                                        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v)}>
                                            <SelectTrigger id="template-type" aria-label={t('templates.vista.filterType')} className={cn(DISPARADOR, 'h-9 rounded-[10px]')}>
                                                <LayoutGrid className="size-[15px] shrink-0 text-muted-foreground dark:text-neutral-400" strokeWidth={1.75} aria-hidden="true" />
                                                <span className="flex min-w-0 flex-1 truncate text-left">
                                                    <SelectValue />
                                                </span>
                                            </SelectTrigger>
                                            <SelectContent className={MENU}>
                                                {typeOptions.map((option) => (
                                                    <SelectItem key={option.value} value={option.value} className={OPCION}>
                                                        {option.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {hasFilters && (
                                        <span className="flex basis-full items-center justify-between gap-3 @3xl/lista:basis-auto">
                                            <span className={cn('text-[12.5px] leading-4 font-medium whitespace-nowrap tabular-nums', TEXTO_SUAVE)} aria-live="polite">
                                                {t('templates.vista.showing', { shown: miles(filteredTemplates.length, lng), total: miles(templates.length, lng) })}
                                            </span>
                                            <button type="button" onClick={clearFilters} className={BOTON_TEXTO_NAVY}>
                                                <X strokeWidth={2} aria-hidden="true" />
                                                {t('common.clear')}
                                            </button>
                                        </span>
                                    )}
                                </div>
                                {lista}
                            </div>

                            <aside
                                ref={panelRef}
                                id="panel-plantilla"
                                aria-labelledby={selected ? 'detalle-plantilla' : undefined}
                                aria-label={selected ? undefined : t('templates.vista.detailLabel')}
                                className={cn('scroll-mt-4 rounded-b-2xl border-t bg-[#f7f8fb] @5xl/hoja:rounded-bl-none @5xl/hoja:border-t-0 @5xl/hoja:border-l dark:bg-white/[0.02]', FILETE)}
                            >
                                {/* Con dos columnas el panel acompaña al bajar por la lista (se pega arriba del
                                    <main> de la isla, que es el contenedor de scroll del Marco). */}
                                <div className="custom-scrollbar @5xl/hoja:sticky @5xl/hoja:top-0 @5xl/hoja:max-h-dvh @5xl/hoja:overflow-y-auto">{panel}</div>
                            </aside>
                        </div>
                    </section>

                    {isAdmin && <WelcomeFlowSection welcomeFlows={welcomeFlows} />}
                </div>
            </div>

            <TemplateCreateModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} users={users} />

            <TemplateEditModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} template={templateToEdit} users={users} />

            {/* ── Eliminar plantilla (administrador): qué se borra y cuánto se usa. Cancelar tiene el foco ── */}
            <DialogoPlantilla
                abierto={templateToDelete !== null}
                onCerrar={() => setTemplateToDelete(null)}
                icono={Trash2}
                peligro
                titulo={t('templates.vista.deleteTitle')}
                ancho="max-w-[400px]"
                enfoqueInicial={seguroBorrar}
                pie={
                    <>
                        <button ref={seguroBorrar} type="button" onClick={() => setTemplateToDelete(null)} className={BOTON_SECUNDARIO}>
                            <X strokeWidth={1.9} aria-hidden="true" />
                            {t('common.cancel')}
                        </button>
                        <button type="button" onClick={confirmDeleteTemplate} className={BOTON_PELIGRO_LLENO}>
                            <Trash2 strokeWidth={2} aria-hidden="true" />
                            {t('templates.vista.deleteYes')}
                        </button>
                    </>
                }
            >
                {templateToDelete && (
                    <>
                        <p className={cn('text-[13.5px] leading-5', TEXTO_SUAVE)}>{templateToDelete.is_global ? t('templates.vista.deleteTextGlobal') : t('templates.vista.deleteTextSome')}</p>
                        <QueSeBorra nombre={templateToDelete.name} detalle={t('templates.vista.usedTimes', { count: deleteUsos, value: miles(deleteUsos, lng) })} />
                        {/* Si es muy usada, no basta con informar: hay que frenar al usuario. */}
                        {deleteUsos >= 100 && <Nota tipo="aviso">{t('templates.vista.deleteHighUsage')}</Nota>}
                    </>
                )}
            </DialogoPlantilla>

            {/* ── Editar plantilla personal (asesor): PUT /admin/my-templates/{id} ── */}
            <DialogoPlantilla
                abierto={personalEdit !== null}
                onCerrar={cerrarEditarPersonal}
                icono={UserRound}
                titulo={t('templates.vista.personalEditTitle')}
                sub={t('templates.vista.personalEditSub')}
                cerrarConX
                ancho="max-w-[470px]"
                pie={
                    <>
                        <button type="button" onClick={cerrarEditarPersonal} disabled={personalSaving} className={BOTON_SECUNDARIO}>
                            <X strokeWidth={1.9} aria-hidden="true" />
                            {t('common.cancel')}
                        </button>
                        <button type="submit" form="form-personal" disabled={personalSaving} className={BOTON_PRIMARIO}>
                            <Save strokeWidth={2} aria-hidden="true" />
                            {personalSaving ? t('common.saving') : t('common.save')}
                        </button>
                    </>
                }
            >
                <form id="form-personal" onSubmit={guardarPersonal} className="flex flex-col gap-3.5" noValidate>
                    {personalErrors.general && <Nota tipo="mal">{personalErrors.general}</Nota>}
                    <div className="flex flex-col gap-[7px]">
                        <label htmlFor="personal-name" className={ETIQUETA}>
                            {t('templates.vista.nameLabel')} <span className={cn('font-normal', TEXTO_SUAVE)}>{t('templates.vista.countOf', { count: personalName.length, max: 60 })}</span>
                        </label>
                        <input
                            id="personal-name"
                            type="text"
                            value={personalName}
                            maxLength={60}
                            onChange={(e) => setPersonalName(e.target.value)}
                            aria-invalid={personalErrors.name ? true : undefined}
                            aria-describedby="personal-name-ayuda"
                            className={CAMPO}
                        />
                        {personalErrors.name ? (
                            <span id="personal-name-ayuda" className={ERROR_CAMPO}>
                                {personalErrors.name}
                            </span>
                        ) : (
                            <span id="personal-name-ayuda" className={AYUDA}>
                                {t('templates.vista.personalNameHelp')}
                            </span>
                        )}
                    </div>
                    <div className="flex flex-col gap-[7px]">
                        <label htmlFor="personal-content" className={ETIQUETA}>
                            {t('templates.vista.textLabel')}
                        </label>
                        <textarea
                            id="personal-content"
                            value={personalContent}
                            maxLength={4096}
                            rows={4}
                            onChange={(e) => setPersonalContent(e.target.value)}
                            aria-invalid={personalErrors.content ? true : undefined}
                            aria-describedby="personal-content-ayuda"
                            className={cn(AREA, 'min-h-[104px]')}
                        />
                        <span id="personal-content-ayuda" className="flex items-start justify-between gap-3">
                            <span className={ERROR_CAMPO}>{personalErrors.content}</span>
                            <span className={cn(AYUDA, 'shrink-0 tabular-nums')}>{t('templates.vista.charCount', { value: miles(personalContent.length, lng), max: miles(4096, lng) })}</span>
                        </span>
                    </div>
                </form>
            </DialogoPlantilla>

            {/* ── Eliminar plantilla personal (asesor): DELETE /admin/my-templates/{id} ── */}
            <DialogoPlantilla
                abierto={personalDelete !== null}
                onCerrar={() => !personalDeleting && setPersonalDelete(null)}
                icono={Trash2}
                peligro
                titulo={t('templates.vista.deleteTitle')}
                ancho="max-w-[400px]"
                enfoqueInicial={seguroBorrarPersonal}
                pie={
                    <>
                        <button ref={seguroBorrarPersonal} type="button" onClick={() => setPersonalDelete(null)} disabled={personalDeleting} className={BOTON_SECUNDARIO}>
                            <X strokeWidth={1.9} aria-hidden="true" />
                            {t('common.cancel')}
                        </button>
                        <button type="button" onClick={confirmarBorrarPersonal} disabled={personalDeleting} className={BOTON_PELIGRO_LLENO}>
                            <Trash2 strokeWidth={2} aria-hidden="true" />
                            {personalDeleting ? t('templates.vista.deleting') : t('templates.vista.deleteYes')}
                        </button>
                    </>
                }
            >
                {personalDelete && (
                    <>
                        <p className={cn('text-[13.5px] leading-5', TEXTO_SUAVE)}>{t('templates.vista.deletePersonalText')}</p>
                        <QueSeBorra nombre={personalDelete.name} detalle={t('templates.vista.usedTimes', { count: personalDeleteUsos, value: miles(personalDeleteUsos, lng) })} />
                        {personalDeleteError && <Nota tipo="mal">{personalDeleteError}</Nota>}
                    </>
                )}
            </DialogoPlantilla>
        </AdminLayout>
    );
}
