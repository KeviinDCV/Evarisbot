import AdminLayout from '@/layouts/admin-layout';
import { BOTON_APAGADO, BOTON_PELIGRO, BOTON_PELIGRO_LLENO, BOTON_PRIMARIO, BOTON_SECUNDARIO, FILETE, FOCO, HOJA, MONO, TEXTO_NAVY, TEXTO_SUAVE, nombrePropio } from '@/components/appointments/piezas-citas';
import {
    AvisoAccion,
    Banda,
    Barra,
    Burbuja,
    Cifra,
    ConfirmarDetener,
    Dialogo,
    Estado,
    EstadoPaso,
    Franja,
    H1,
    Nota,
    Rotulo,
    SANGRIA,
    Segmentado,
    fechaHora,
    miles,
} from '@/components/bulk-sends/piezas-envio';
import { Head, router } from '@inertiajs/react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
    ArrowRight,
    Check,
    ChevronDown,
    ChevronRight,
    CircleAlert,
    CircleCheck,
    CircleDashed,
    CircleX,
    Clock,
    Columns3,
    Eye,
    FilePlus2,
    FileSpreadsheet,
    FileText,
    Globe,
    Image,
    Info,
    KeyRound,
    LoaderCircle,
    Megaphone,
    CircleSlash,
    MessageSquareText,
    Paperclip,
    PencilLine,
    Phone,
    Plus,
    RefreshCw,
    Search,
    Send,
    Shield,
    Square,
    Trash2,
    TriangleAlert,
    Type,
    Upload,
    UserRound,
    Video,
    X,
    type LucideIcon,
} from 'lucide-react';
import React, { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import axios from 'axios';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useTranslation, Trans } from 'react-i18next';

// Las llamadas que MUTAN estado van por axios: así usan el token CSRF vivo (cookie
// XSRF-TOKEN) y pasan por el interceptor de app.tsx que reintenta 1 vez ante 419.
// validateStatus deja pasar 4xx/5xx (como fetch) para conservar el manejo de errores
// de negocio/validación, pero rechaza el 419 para que el interceptor lo reintente.
const csrfPost = (url: string, body?: unknown) =>
    axios.post(url, body, { validateStatus: (s: number) => s !== 419 });
const csrfDelete = (url: string) =>
    axios.delete(url, { validateStatus: (s: number) => s !== 419 });

interface Recipient {
    phone: string;
    name: string;
    params?: Record<string, string>;
}

interface MatchingRecipient {
    id: number;
    phone_number: string;
    contact_name: string | null;
    status: string;
    error: string | null;
    sent_at: string | null;
    params: Record<string, string> | null;
}

interface BulkSendRecord {
    id: number;
    name: string;
    template_name: string;
    status: string;
    total_recipients: number;
    sent_count: number;
    failed_count: number;
    created_by_name: string;
    created_at: string;
    matching_recipients?: MatchingRecipient[] | null;
}

interface ActiveProgress {
    id: number;
    name: string;
    template_name: string;
    total: number;
    sent: number;
    failed: number;
    pending: number;
    percentage: number;
}

interface WhatsappTemplate {
    id: number;
    name: string;
    meta_template_name: string;
    preview_text: string | null;
    language: string;
    default_params: string[] | null;
    category: string;
    header_format: string | null;
    header_media_url: string | null;
}

interface ColumnMapping {
    [paramIndex: string]: {
        source: 'nombre' | 'column' | 'static' | 'unset';
        column?: string;
        value?: string;
    };
}

interface TemplateRecord {
    id: number;
    name: string;
    meta_template_name: string;
    preview_text: string | null;
    language: string;
    category: string;
    status: string;
    header_text: string | null;
    footer_text: string | null;
    is_active: boolean;
    created_at: string | null;
}

interface BulkSendsProps {
    bulkSends: BulkSendRecord[];
    activeProgress: ActiveProgress | null;
    whatsappTemplates: WhatsappTemplate[];
    allTemplates: TemplateRecord[];
}

// --- Detección de tipos para el mapeo de parámetros ---
// Las plantillas de Meta son posicionales ({{N}} sin nombre); el único indicio del
// dato que espera cada hueco es el texto que lo precede ("a las {{4}}" → hora).
/** Máximo de destinatarios que se PINTAN en la vista previa (el envío usa todos). */
const RECIPIENTS_PREVIEW_LIMIT = 100;

const normalizeText = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// Acepta tanto el formato que la gente escribe a mano (30/07/2026, 9:30 a.m.) como el
// que produce el propio sistema al exportar: citfc es DATE -> "2026-07-30" y cithor es
// TIME -> "09:30:00", con segundos. Sin esto, un Excel sacado de la aplicación dejaba
// los huecos de fecha y hora SIN asignar y había que mapearlos a mano uno por uno.
const DATE_RX = /^(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{1,2}-\d{1,2})$/;
const TIME_RX = /^\d{1,2}:\d{2}(:\d{2})?(\s?[ap]\.?\s?m\.?)?$/i;

type SlotType = 'nombre' | 'date' | 'time' | 'doctor' | 'especialidad' | 'any';

function expectedSlotType(previewText: string, idx: number): SlotType {
    const pos = previewText.indexOf(`{{${idx}}}`);
    if (pos < 0) return 'any';
    const before = normalizeText(previewText.slice(Math.max(0, pos - 28), pos));
    if (/(a las|para las|hora)\s*[:.]?\s*$/.test(before)) return 'time';
    if (/(el dia|del dia|fecha|para el)\s*[:.]?\s*$/.test(before)) return 'date';
    if (/(dr\.?\s*\(?a?\)?|doctor|medic[oa])\s*[:.]?\s*$/.test(before)) return 'doctor';
    if (/(especialidad|cita de)\s*[:.]?\s*$/.test(before)) return 'especialidad';
    if (/(sr\s*\(?a?\)?\.?|sra\.?|senor(a)?)\s*$/.test(before)) return 'nombre';
    return 'any';
}

function columnSlotType(col: string, sample?: string): SlotType {
    const n = normalizeText(col);
    if (n.includes('hora')) return 'time';
    if (n.includes('fecha') || n.includes('dia')) return 'date';
    if (n.includes('medic') || n.includes('doctor') || n.includes('profesional') || n.startsWith('dr')) return 'doctor';
    if (n.includes('especialidad')) return 'especialidad';
    if (n.includes('nombre') || n.includes('paciente')) return 'nombre';
    if (sample) {
        const v = String(sample).trim();
        if (TIME_RX.test(v)) return 'time';
        if (DATE_RX.test(v)) return 'date';
    }
    return 'any';
}

/* ── Presentación (design/vista-envio-masivo/gen_envio.mjs) ─────────────────────────────────────────
   Preparar un envío se lee como cuatro pasos numerados en una sola hoja: a la izquierda lo que se va
   eligiendo (1 plantilla, 2 destinatarios, 3 de dónde sale cada dato); a la derecha, el paso 4 con el
   mensaje tal como le llega al primer paciente, las comprobaciones y el único botón de enviar, que
   siempre abre la confirmación. Debajo, el historial. Las plantillas de Meta son la otra pestaña. */

// Campo editable. Borde navy al 58 % (#868fb7): 3,1:1 contra la hoja (WCAG 1.4.11).
const CAMPO = cn(
    'h-[38px] w-full min-w-0 rounded-[9px] bg-white px-3 text-[13px] leading-[18px] font-medium text-[#2e3f84] shadow-[inset_0_0_0_1px_rgba(46,63,132,0.58)] transition-shadow outline-none placeholder:font-normal placeholder:text-muted-foreground',
    'focus:shadow-[inset_0_0_0_1px_#2e3f84,0_0_0_3px_rgba(46,63,132,0.2)] disabled:cursor-not-allowed disabled:opacity-60',
    'dark:bg-white/[0.04] dark:text-neutral-100 dark:shadow-[inset_0_0_0_1px_var(--color-neutral-500)] dark:placeholder:text-neutral-400 dark:focus:shadow-[inset_0_0_0_1px_#8b9ae0,0_0_0_3px_rgba(139,154,224,0.3)]'
);
// El disparador del desplegable (Radix Select) con la misma piel que el campo.
const DISPARADOR = cn(
    CAMPO,
    'gap-2 border-0 py-0 pr-2.5 pl-[11px] data-[placeholder]:font-normal data-[placeholder]:text-muted-foreground focus-visible:ring-0 focus-visible:shadow-[inset_0_0_0_1px_#2e3f84,0_0_0_3px_rgba(46,63,132,0.2)]',
    'dark:bg-white/[0.04] dark:data-[placeholder]:text-neutral-400 dark:focus-visible:shadow-[inset_0_0_0_1px_#8b9ae0,0_0_0_3px_rgba(139,154,224,0.3)]',
    '[&_svg:not([class*=text-])]:text-muted-foreground dark:[&_svg:not([class*=text-])]:text-neutral-400 [&>svg:last-child]:opacity-100',
    // El valor elegido se pinta con su icono en línea (el SVG es display:block por el reset de Tailwind).
    '[&_[data-slot=select-value]]:flex [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:items-center [&_[data-slot=select-value]]:gap-2'
);
// Sin origen: borde rojo + halo (y el texto de ayuda en rojo).
const DISPARADOR_MAL = cn(
    'shadow-[inset_0_0_0_1px_var(--color-red-600),0_0_0_3px_rgba(220,38,38,0.14)] data-[placeholder]:text-red-700',
    'dark:shadow-[inset_0_0_0_1px_var(--color-red-400),0_0_0_3px_rgba(248,113,113,0.2)] dark:data-[placeholder]:text-red-400'
);
const MENU = 'max-h-[320px] rounded-xl border-0 shadow-[0_0_0_1px_rgba(46,63,132,0.12),0_12px_28px_-10px_rgba(46,63,132,0.4)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_12px_28px_-10px_rgba(0,0,0,0.7)]';
const OPCION = 'cursor-pointer rounded-lg py-2 text-[13px] leading-[18px]';
const ETIQUETA = cn('text-[12.5px] leading-4 font-semibold', TEXTO_NAVY);
const AYUDA = cn('text-[12px] leading-4', TEXTO_SUAVE);
const ICONO_CAMPO = 'pointer-events-none absolute top-1/2 left-3 size-[15px] -translate-y-1/2 text-muted-foreground dark:text-neutral-400';
const BOTON_TEXTO = cn(
    'inline-flex h-[30px] shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-[12.5px] leading-4 font-semibold whitespace-nowrap transition-colors [&_svg]:size-3.5',
    FOCO
);
const BOTON_ICONO = cn(
    'flex size-[30px] shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-[#2e3f84]/8 hover:text-[#2e3f84] disabled:cursor-not-allowed disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-white/8 dark:hover:text-neutral-100',
    FOCO
);

const IDIOMAS: Record<string, string> = {
    es: 'bulkSends.langSpanish',
    es_CO: 'bulkSends.langSpanishCO',
    es_MX: 'bulkSends.langSpanishMX',
    es_AR: 'bulkSends.langSpanishAR',
    en: 'bulkSends.langEnglish',
    en_US: 'bulkSends.langEnglishUS',
    pt_BR: 'bulkSends.langPortugueseBR',
};
const CATEGORIAS: Record<string, [LucideIcon, string]> = {
    MARKETING: [Megaphone, 'bulkSends.categoryMarketing'],
    UTILITY: [Shield, 'bulkSends.categoryUtility'],
    AUTHENTICATION: [KeyRound, 'bulkSends.categoryAuthentication'],
};
const conMedio = (formato: string | null | undefined) => !!formato && ['DOCUMENT', 'IMAGE', 'VIDEO'].includes(formato);

/** {{N}} como ficha monoespaciada (roja si el dato no tiene origen). */
function Ficha({ idx, mal = false }: { idx: number | string; mal?: boolean }) {
    return (
        <span
            className={cn(
                'inline-flex h-[22px] w-fit items-center rounded-md px-[7px] text-[12px] leading-4 font-semibold whitespace-nowrap',
                MONO,
                mal
                    ? 'bg-red-50 text-red-700 shadow-[inset_0_0_0_1px_var(--color-red-200)] dark:bg-red-500/10 dark:text-red-300 dark:shadow-[inset_0_0_0_1px_rgba(239,68,68,0.3)]'
                    : 'bg-[#2e3f84]/7 text-[#2e3f84] shadow-[inset_0_0_0_1px_rgba(46,63,132,0.12)] dark:bg-white/8 dark:text-neutral-100 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]'
            )}
        >{`{{${idx}}}`}</span>
    );
}

/** Número del paso: hecho = círculo esmeralda con visto; pendiente = número navy en círculo claro. */
function CabezaPaso({ id, n, titulo, hecho, estado, className }: { id: string; n: number; titulo: string; hecho: boolean; estado?: ReactNode; className?: string }) {
    const { t } = useTranslation();
    return (
        <div className={cn('flex min-h-[52px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 @3xl/hoja:px-5', className)}>
            <span className="flex w-8 shrink-0 justify-center">
                {hecho ? (
                    <span className="flex size-6 items-center justify-center rounded-full bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950" title={t('bulkSends.stepDone')}>
                        <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                        <span className="sr-only">{t('bulkSends.stepDone')}</span>
                    </span>
                ) : (
                    <span className="flex size-6 items-center justify-center rounded-full bg-white text-[12px] leading-4 font-semibold text-[#2e3f84] tabular-nums shadow-[inset_0_0_0_1.5px_rgba(46,63,132,0.58)] dark:bg-transparent dark:text-neutral-100 dark:shadow-[inset_0_0_0_1.5px_var(--color-neutral-500)]">
                        {n}
                    </span>
                )}
            </span>
            <h3 id={id} className={cn('min-w-0 flex-1 text-[15px] leading-5 font-semibold tracking-[-0.01em]', TEXTO_NAVY)}>
                {titulo}
            </h3>
            {estado}
        </div>
    );
}

/** «…su cita de ___ el día…»: el hueco resaltado dentro del extracto de la plantilla. */
function Contexto({ texto, mal = false }: { texto: string; mal?: boolean }) {
    const [antes, ...resto] = texto.split('___');
    return (
        <span className={cn('min-w-0 truncate text-[12.5px] leading-4', TEXTO_SUAVE)} title={texto}>
            «{antes}
            {resto.length > 0 && (
                <>
                    <span className={cn('font-semibold', mal ? 'text-red-700 dark:text-red-400' : TEXTO_NAVY)}>___</span>
                    {resto.join('___')}
                </>
            )}
            »
        </span>
    );
}

export default function BulkSendsIndex({ bulkSends, activeProgress: initialProgress, whatsappTemplates, allTemplates }: BulkSendsProps) {
    const { t, i18n } = useTranslation();
    const lng = i18n.language;
    const [activeTab, setActiveTab] = useState<'send' | 'templates'>('send');
    const [recipients, setRecipients] = useState<Recipient[]>([]);
    const [templateName, setTemplateName] = useState('');
    const [templateParams, setTemplateParams] = useState<string[]>([]);
    const [sendName, setSendName] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [uploadedFileName, setUploadedFileName] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [manualPhone, setManualPhone] = useState('');
    const [manualName, setManualName] = useState('');
    const [activeProgress, setActiveProgress] = useState<ActiveProgress | null>(initialProgress);
    const [isProcessing, setIsProcessing] = useState(!!initialProgress);
    const [newParamValue, setNewParamValue] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState<WhatsappTemplate | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [extraColumns, setExtraColumns] = useState<string[]>([]);
    const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
    const [showConfirmSend, setShowConfirmSend] = useState(false);
    // Plantilla de Meta pendiente de borrar (null = diálogo cerrado).
    const [templateToDelete, setTemplateToDelete] = useState<{ id: number; name: string } | null>(null);
    const [confirmChecked, setConfirmChecked] = useState(false);
    // Ref para leer la muestra del primer destinatario en el auto-mapeo sin que
    // cada cambio de destinatarios pise los ajustes manuales del mapeo.
    const recipientsRef = useRef<Recipient[]>([]);
    const [historySearch, setHistorySearch] = useState('');
    const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'processing' | 'completed' | 'failed' | 'cancelled'>('all');
    const [searchResults, setSearchResults] = useState<BulkSendRecord[] | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const searchAbortRef = useRef<AbortController | null>(null);

    // Template creation state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newTplName, setNewTplName] = useState('');
    const [newTplDisplayName, setNewTplDisplayName] = useState('');
    const [newTplCategory, setNewTplCategory] = useState<'MARKETING' | 'UTILITY' | 'AUTHENTICATION'>('UTILITY');
    const [newTplLanguage, setNewTplLanguage] = useState('es');
    const [newTplHeader, setNewTplHeader] = useState('');
    const [newTplHeaderFormat, setNewTplHeaderFormat] = useState<'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'>('NONE');
    const [newTplHeaderMediaUrl, setNewTplHeaderMediaUrl] = useState('');
    const [newTplBody, setNewTplBody] = useState('');
    const [newTplFooter, setNewTplFooter] = useState('');
    const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    // Solo presentación: cuántos números trajo el último archivo y si está abierta la confirmación de detener.
    const [uploadedTotal, setUploadedTotal] = useState(0);
    const [confirmarDetener, setConfirmarDetener] = useState(false);

    useEffect(() => {
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        const q = historySearch.trim();
        if (!q) {
            setSearchResults(null);
            setIsSearching(false);
            return;
        }
        setIsSearching(true);
        searchTimerRef.current = setTimeout(() => {
            if (searchAbortRef.current) searchAbortRef.current.abort();
            const controller = new AbortController();
            searchAbortRef.current = controller;
            axios.get('/admin/bulk-sends/search', { params: { q }, signal: controller.signal })
                .then(res => { setSearchResults(res.data); setIsSearching(false); })
                .catch(err => { if (!axios.isCancel(err)) setIsSearching(false); });
        }, 350);
        return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
    }, [historySearch]);

    const filteredBulkSends = searchResults ?? bulkSends;
    const visibleBulkSends = useMemo(() => {
        if (historyStatusFilter === 'all') return filteredBulkSends;
        return filteredBulkSends.filter((bulkSend) => bulkSend.status === historyStatusFilter);
    }, [filteredBulkSends, historyStatusFilter]);

    const sendMetrics = useMemo(() => {
        const totalRecipients = bulkSends.reduce((sum, item) => sum + item.total_recipients, 0);
        const sentRecipients = bulkSends.reduce((sum, item) => sum + item.sent_count, 0);
        const failedRecipients = bulkSends.reduce((sum, item) => sum + item.failed_count, 0);
        const pendingRecipients = Math.max(0, totalRecipients - sentRecipients - failedRecipients);
        const completedSends = bulkSends.filter((item) => item.status === 'completed' || item.status === 'sent').length;
        const processingSends = bulkSends.filter((item) => item.status === 'processing').length;
        const blockedSends = bulkSends.filter((item) => item.status === 'failed' || item.status === 'cancelled').length;

        return {
            totalSends: bulkSends.length,
            totalRecipients,
            sentRecipients,
            failedRecipients,
            pendingRecipients,
            completedSends,
            processingSends,
            blockedSends,
            successRate: totalRecipients > 0 ? Math.round((sentRecipients / totalRecipients) * 100) : 0,
        };
    }, [bulkSends]);

    const templateMetrics = useMemo(() => {
        const approved = allTemplates.filter((template) => template.status === 'APPROVED' && template.is_active).length;
        const pending = allTemplates.filter((template) => template.status === 'PENDING').length;
        const rejected = allTemplates.filter((template) => template.status === 'REJECTED').length;
        const paused = allTemplates.filter((template) => template.status === 'PAUSED').length;
        const disabled = allTemplates.filter((template) => template.status === 'DISABLED').length;

        return { approved, pending, rejected, paused, disabled, usable: whatsappTemplates.length };
    }, [allTemplates, whatsappTemplates.length]);

    const getProgress = useCallback((bulkSend: BulkSendRecord) => {
        if (bulkSend.total_recipients === 0) return 0;
        return Math.min(100, Math.round(((bulkSend.sent_count + bulkSend.failed_count) / bulkSend.total_recipients) * 100));
    }, []);

    // Detect {{N}} placeholders in selected template's preview_text
    const templatePlaceholders = useMemo(() => {
        if (!selectedTemplate?.preview_text) return [];
        const matches = selectedTemplate.preview_text.match(/\{\{(\d+)\}\}/g);
        if (!matches) return [];
        const indices = [...new Set(matches.map(m => parseInt(m.replace(/[{}]/g, ''))))].sort((a, b) => a - b);
        return indices;
    }, [selectedTemplate]);

    // Auto-mapea por SIGNIFICADO, no por orden de columnas: el hueco tras "a las" solo
    // acepta columnas de hora, los de fecha solo fechas, el de "DR.(A)" solo médico, etc.
    // Mapear por orden causó el incidente del 10-jun: la plantilla de Cartago (5 campos,
    // sin especialidad) recibió las columnas corridas y los pacientes leyeron fechas donde
    // iba la hora. Si no hay columna compatible, el hueco queda SIN asignar (en rojo) para
    // forzar la decisión humana. El usuario puede sobrescribir cualquier dropdown.
    useEffect(() => {
        if (templatePlaceholders.length === 0) {
            setColumnMapping({});
            return;
        }
        const preview = selectedTemplate?.preview_text || '';
        const sample = recipientsRef.current[0]?.params || {};
        const used = new Set<string>();
        const newMapping: ColumnMapping = {};

        // Pase 1: huecos con tipo claro (hora/fecha/doctor/nombre) toman su columna compatible
        templatePlaceholders.forEach((idx, i) => {
            if (i === 0) {
                newMapping[String(idx)] = { source: 'nombre' };
                return;
            }
            const expected = expectedSlotType(preview, idx);
            if (expected === 'any') return;
            if (expected === 'nombre') {
                newMapping[String(idx)] = { source: 'nombre' };
                return;
            }
            const col = extraColumns.find(c => !used.has(c) && columnSlotType(c, sample[c]) === expected);
            if (col) {
                used.add(col);
                newMapping[String(idx)] = { source: 'column', column: col };
            }
        });

        // Pase 2: SOLO los huecos genéricos toman columnas genéricas restantes, en orden.
        // Un hueco tipado (hora/fecha/doctor) sin columna compatible queda SIN asignar:
        // mejor un rojo que obligue a elegir, que adivinar y mandar datos cruzados.
        templatePlaceholders.forEach((idx, i) => {
            if (i === 0 || newMapping[String(idx)]) return;
            const expected = expectedSlotType(preview, idx);
            if (expected !== 'any') {
                newMapping[String(idx)] = { source: 'unset' };
                return;
            }
            const col = extraColumns.find(c => !used.has(c) && columnSlotType(c, sample[c]) === 'any');
            if (col) {
                used.add(col);
                newMapping[String(idx)] = { source: 'column', column: col };
            } else {
                newMapping[String(idx)] = { source: 'unset' };
            }
        });

        // Pase 3: si queda exactamente UN hueco sin asignar y UNA columna sin usar,
        // son la única combinación posible — se emparejan. La vista previa y el
        // modal de confirmación siguen siendo la red de seguridad.
        const unsetSlots = templatePlaceholders.filter((idx, i) => i > 0 && newMapping[String(idx)]?.source === 'unset');
        const freeCols = extraColumns.filter(c => !used.has(c));
        if (unsetSlots.length === 1 && freeCols.length === 1) {
            newMapping[String(unsetSlots[0])] = { source: 'column', column: freeCols[0] };
        }
        setColumnMapping(newMapping);
    }, [templatePlaceholders, extraColumns, selectedTemplate]);

    // El mapeo está completo cuando cada {{N}} de la plantilla tiene un origen válido.
    const mappingComplete = useMemo(() => {
        if (templatePlaceholders.length === 0) return true;
        return templatePlaceholders.every((idx) => {
            const m = columnMapping[String(idx)];
            if (!m) return false;
            if (m.source === 'nombre') return true;
            if (m.source === 'column') return !!m.column && extraColumns.includes(m.column);
            if (m.source === 'static') return !!m.value?.trim();
            return false;
        });
    }, [templatePlaceholders, columnMapping, extraColumns]);

    useEffect(() => {
        recipientsRef.current = recipients;
    }, [recipients]);

    // Mensaje final renderizado con los datos reales del primer destinatario
    const renderedPreview = useMemo(() => {
        if (!selectedTemplate?.preview_text) return '';
        let text = selectedTemplate.preview_text;
        const sample = recipients[0];
        Object.entries(columnMapping).forEach(([paramIdx, map]) => {
            const placeholder = `{{${paramIdx}}}`;
            let replacement: string;
            if (map.source === 'nombre') {
                replacement = sample?.name || t('bulkSends.previewNoName');
            } else if (map.source === 'column') {
                replacement = sample?.params?.[map.column || ''] ?? t('bulkSends.previewColumnFallback', { column: map.column });
            } else if (map.source === 'static') {
                replacement = map.value || t('bulkSends.previewEmptyStatic');
            } else {
                replacement = t('bulkSends.previewUnassigned');
            }
            text = text.split(placeholder).join(replacement);
        });
        return text;
    }, [selectedTemplate, columnMapping, recipients, t]);

    // Guía del Excel ideal para la plantilla seleccionada: deriva el nombre de cada
    // columna del contexto del texto ("a las ___" → hora) y muestra dónde se usa.
    const excelGuide = useMemo(() => {
        if (!selectedTemplate?.preview_text || templatePlaceholders.length === 0) return null;
        const preview = selectedTemplate.preview_text;
        const counts: Record<string, number> = {};
        return templatePlaceholders.map((idx, i) => {
            const tag = `{{${idx}}}`;
            const pos = preview.indexOf(tag);
            const before = pos >= 0 ? preview.slice(Math.max(0, pos - 26), pos).replace(/\s+/g, ' ').trimStart() : '';
            const after = pos >= 0 ? preview.slice(pos + tag.length, pos + tag.length + 20).replace(/\s+/g, ' ').trimEnd() : '';
            let base: string;
            if (i === 0) {
                base = 'nombre';
            } else {
                const t = expectedSlotType(preview, idx);
                base = t === 'date' ? 'fecha' : t === 'time' ? 'hora' : t === 'doctor' ? 'medico'
                    : t === 'especialidad' ? 'especialidad' : t === 'nombre' ? 'nombre' : `dato_${idx}`;
            }
            counts[base] = (counts[base] || 0) + 1;
            const header = counts[base] > 1 ? `${base}_${counts[base]}` : base;
            // Los {{N}} vecinos en el extracto confunden: se reemplazan por puntos suspensivos
            const clean = (s: string) => s.replace(/\{\{\d+\}\}/g, '…');
            const sample = base.startsWith('fecha') ? '20/06/2026'
                : base.startsWith('hora') ? '8:30 AM'
                : base.startsWith('medico') ? 'CARLOS GOMEZ RIOS'
                : base.startsWith('especialidad') ? 'dermatologia'
                : base.startsWith('nombre') ? 'PEREZ LOPEZ, MARIA'
                : 'texto';
            return { idx, header, sample, context: `…${clean(before)}___${clean(after)}…` };
        });
    }, [selectedTemplate, templatePlaceholders]);

    // Salud de la plantilla ELEGIDA, antes de hablar de columnas.
    //
    // Caso real (30-jul): 'cancelacion_de_cita' se creó en Meta copiando y pegando la
    // vista previa de ESTA pantalla, marcadores incluidos. Quedó aprobada con CERO {{N}}
    // y con "[nombre del contacto]" y "⚠️[sin asignar]" como texto fijo. Meta no lo
    // detecta: para ella es texto corriente. Aquí sí, porque reconocemos nuestros propios
    // marcadores. Sin este aviso la pantalla no decía nada y parecía un fallo del mapeo.
    const templateHealth = useMemo(() => {
        const body = selectedTemplate?.preview_text;
        if (!body) return null;
        // Marcadores que solo existen en la previsualización: si viajaron a Meta, la
        // plantilla se construyó mal y el paciente los leería tal cual.
        const leftovers = [t('bulkSends.previewUnassigned'), t('bulkSends.previewNoName')]
            .filter((marker) => marker && body.includes(marker));
        if (leftovers.length > 0) return { kind: 'broken' as const, leftovers };
        if (templatePlaceholders.length === 0) return { kind: 'noParams' as const, leftovers: [] };
        return null;
    }, [selectedTemplate, templatePlaceholders, t]);

    // Coherencia del mapeo: detecta fechas donde va una hora, horas donde va una
    // fecha o un nombre de médico, columnas duplicadas y columnas sin usar.
    const validationIssues = useMemo(() => {
        const errors: string[] = [];
        const warnings: string[] = [];
        if (!selectedTemplate?.preview_text || templatePlaceholders.length === 0) return { errors, warnings };
        const preview = selectedTemplate.preview_text;
        const sample = recipients[0]?.params || {};
        const usedCols: string[] = [];

        templatePlaceholders.forEach((idx) => {
            const m = columnMapping[String(idx)];
            if (!m) return;
            let value = '';
            if (m.source === 'nombre') value = recipients[0]?.name || '';
            else if (m.source === 'column' && m.column) { value = sample[m.column] ?? ''; usedCols.push(m.column); }
            else if (m.source === 'static') value = m.value || '';
            if (!value) return;

            const expected = expectedSlotType(preview, idx);
            const v = String(value).trim();
            const isDate = DATE_RX.test(v);
            const isTime = TIME_RX.test(v);
            if (expected === 'time' && isDate) errors.push(t('bulkSends.validation.expectsTimeGotDate', { token: `{{${idx}}}`, value: v }));
            if (expected === 'date' && isTime) errors.push(t('bulkSends.validation.expectsDateGotTime', { token: `{{${idx}}}`, value: v }));
            if (expected === 'doctor' && (isDate || isTime)) errors.push(t('bulkSends.validation.expectsDoctorGotOther', { token: `{{${idx}}}`, value: v }));
        });

        const dup = usedCols.filter((c, i) => usedCols.indexOf(c) !== i);
        [...new Set(dup)].forEach(c => warnings.push(t('bulkSends.validation.columnDuplicated', { column: c })));
        extraColumns.filter(c => !usedCols.includes(c)).forEach(c => warnings.push(t('bulkSends.validation.columnUnused', { column: c })));
        return { errors, warnings };
    }, [selectedTemplate, templatePlaceholders, columnMapping, recipients, extraColumns, t]);

    const handleSelectTemplate = (templateId: string) => {
        const template = whatsappTemplates.find(t => t.id === Number(templateId));
        if (template) {
            setSelectedTemplate(template);
            setTemplateName(template.meta_template_name);
            if (template.default_params) {
                setTemplateParams(template.default_params);
            } else {
                setTemplateParams([]);
            }
            setColumnMapping({});
        } else {
            setSelectedTemplate(null);
            setTemplateName('');
            setTemplateParams([]);
            setColumnMapping({});
        }
    };

    // Polling para progreso activo
    useEffect(() => {
        if (!isProcessing) return;

        let shouldStop = false;
        let intervalId: ReturnType<typeof setInterval> | null = null;

        const checkStatus = async () => {
            if (shouldStop) return;
            try {
                const response = await fetch('/admin/bulk-sends/status?' + Date.now(), {
                    headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' },
                });
                const data = await response.json();

                if (!data.processing) {
                    shouldStop = true;
                    setIsProcessing(false);
                    setActiveProgress(null);
                    if (intervalId) clearInterval(intervalId);
                    router.reload();
                    return;
                }

                setActiveProgress({
                    id: data.id,
                    name: data.name,
                    template_name: data.template_name,
                    total: data.total,
                    sent: data.sent,
                    failed: data.failed,
                    pending: data.pending,
                    percentage: data.percentage,
                });
            } catch (err) {
                console.error('Error polling status:', err);
            }
        };

        checkStatus();
        intervalId = setInterval(checkStatus, 3000);

        return () => {
            shouldStop = true;
            if (intervalId) clearInterval(intervalId);
        };
    }, [isProcessing]);

    const handleFileUpload = async (file: File) => {
        setIsUploading(true);
        setError('');

        const formData = new FormData();
        formData.append('file', file);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutos

            const response = await axios.post('/admin/bulk-sends/upload', formData, {
                signal: controller.signal,
                timeout: 300000,
                validateStatus: (s) => s !== 419,
            });

            clearTimeout(timeoutId);

            const status = response.status;

            // Si el servidor devuelve error HTTP sin JSON (ej: 413 nginx, 500 HTML)
            if (!(status >= 200 && status < 300)) {
                const data = response.data;
                if (data && typeof data === 'object') {
                    if (data.errors) {
                        const firstError = Object.values(data.errors).flat()[0] as string;
                        setError(firstError || t('bulkSends.validationError'));
                    } else {
                        setError(data.message || t('bulkSends.serverError', { status }));
                    }
                } else {
                    const text = typeof data === 'string' ? data : '';
                    setError(t('bulkSends.serverErrorWithBody', { status, text: text.substring(0, 200) }));
                }
                return;
            }

            const data = response.data;

            if (data.success) {
                setRecipients(data.recipients);
                setUploadedFileName(data.filename);
                setUploadedTotal(Number(data.total) || data.recipients?.length || 0);
                if (data.extra_columns?.length > 0) {
                    setExtraColumns(data.extra_columns);
                }
                setSuccess(t('bulkSends.fileLoadedSuccess', { total: data.total, filename: data.filename }));
                setTimeout(() => setSuccess(''), 5000);
            } else {
                setError(data.message || t('bulkSends.fileProcessError'));
            }
        } catch (err: any) {
            if (axios.isCancel(err) || err?.code === 'ERR_CANCELED' || err?.code === 'ECONNABORTED' || err?.name === 'CanceledError' || err?.name === 'AbortError') {
                setError(t('bulkSends.fileTooLargeTimeout'));
            } else {
                setError(t('bulkSends.fileUploadError'));
            }
        } finally {
            setIsUploading(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files?.[0]) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            handleFileUpload(e.target.files[0]);
        }
    };

    const addManualRecipient = () => {
        const phone = manualPhone.trim();
        if (!phone) return;

        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const exists = recipients.some(r => r.phone.replace(/[^0-9]/g, '') === cleanPhone);
        if (exists) {
            setError(t('bulkSends.duplicatePhone'));
            setTimeout(() => setError(''), 3000);
            return;
        }

        if (cleanPhone.length < 10) {
            setError(t('bulkSends.phoneMinDigits'));
            setTimeout(() => setError(''), 3000);
            return;
        }

        setRecipients(prev => [...prev, { phone: phone, name: manualName.trim() }]);
        setManualPhone('');
        setManualName('');
    };

    const removeRecipient = (index: number) => {
        setRecipients(prev => prev.filter((_, i) => i !== index));
    };

    const clearRecipients = () => {
        setRecipients([]);
        setUploadedFileName('');
    };

    const addParam = () => {
        if (newParamValue.trim()) {
            setTemplateParams(prev => [...prev, newParamValue.trim()]);
            setNewParamValue('');
        }
    };

    const removeParam = (index: number) => {
        setTemplateParams(prev => prev.filter((_, i) => i !== index));
    };

    // Paso 1: abrir la confirmación obligatoria (con vista previa y chequeos de coherencia)
    const handleStartSend = () => {
        if (!selectedTemplate) {
            setError(t('bulkSends.selectTemplateError'));
            return;
        }
        if (recipients.length === 0) {
            setError(t('bulkSends.addRecipientError'));
            return;
        }
        if (!mappingComplete) {
            setError(t('bulkSends.mappingIncompleteError'));
            return;
        }
        setError('');
        setConfirmChecked(false);
        setShowConfirmSend(true);
    };

    // Paso 2: envío real, solo tras confirmar en el modal
    const executeSend = async () => {
        if (!selectedTemplate || recipients.length === 0) return;

        setIsSending(true);
        setError('');

        try {
            const response = await csrfPost('/admin/bulk-sends/start', {
                template_name: templateName,
                template_params: templateParams.length > 0 ? templateParams : null,
                column_mapping: Object.keys(columnMapping).length > 0 ? columnMapping : null,
                name: sendName || null,
                recipients: recipients.map(r => ({
                    phone: r.phone,
                    name: r.name,
                    params: r.params || null,
                })),
            });

            const data = response.data;

            if (data.success) {
                setSuccess(data.message);
                setIsProcessing(true);
                setRecipients([]);
                setUploadedFileName('');
                setTemplateName('');
                setTemplateParams([]);
                setSendName('');
                setSelectedTemplate(null);
                setShowPreview(false);
                setExtraColumns([]);
                setColumnMapping({});
                setShowConfirmSend(false);
                setTimeout(() => setSuccess(''), 5000);
            } else {
                setError(data.message || t('bulkSends.startSendError'));
                setShowConfirmSend(false);
            }
        } catch (err) {
            setError(t('bulkSends.startBulkSendError'));
            setShowConfirmSend(false);
        } finally {
            setIsSending(false);
        }
    };

    const handleCancel = async (id: number) => {
        try {
            const response = await csrfPost(`/admin/bulk-sends/${id}/cancel`);

            const data = response.data;
            if (data.success) {
                setIsProcessing(false);
                setActiveProgress(null);
                router.reload();
            } else {
                setError(data.message);
            }
        } catch (err) {
            setError(t('bulkSends.cancelError'));
        }
    };

    const handleCreateTemplate = async () => {
        if (!newTplName || !newTplBody || !newTplDisplayName) {
            setError(t('bulkSends.createRequiredFieldsError'));
            return;
        }
        setIsCreatingTemplate(true);
        setError('');
        try {
            const response = await csrfPost('/admin/bulk-sends/templates/create', {
                name: newTplName,
                display_name: newTplDisplayName,
                category: newTplCategory,
                language: newTplLanguage,
                header_format: newTplHeaderFormat !== 'NONE' ? newTplHeaderFormat : null,
                header_text: newTplHeaderFormat === 'TEXT' ? newTplHeader || null : null,
                header_media_url: ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(newTplHeaderFormat) ? newTplHeaderMediaUrl || null : null,
                body_text: newTplBody,
                footer_text: newTplFooter || null,
            });
            const data = response.data;
            if (data.success) {
                setSuccess(data.message);
                setShowCreateModal(false);
                setNewTplName('');
                setNewTplDisplayName('');
                setNewTplCategory('UTILITY');
                setNewTplLanguage('es');
                setNewTplHeader('');
                setNewTplHeaderFormat('NONE');
                setNewTplHeaderMediaUrl('');
                setNewTplBody('');
                setNewTplFooter('');
                setTimeout(() => setSuccess(''), 5000);
                router.reload();
            } else {
                setError(data.message || t('bulkSends.createTemplateError'));
            }
        } catch {
            setError(t('bulkSends.sendTemplateToMetaError'));
        } finally {
            setIsCreatingTemplate(false);
        }
    };

    const handleSyncTemplates = async () => {
        setIsSyncing(true);
        setError('');
        try {
            const response = await csrfPost('/admin/bulk-sends/templates/sync');
            const data = response.data;
            if (data.success) {
                setSuccess(data.message);
                setTimeout(() => setSuccess(''), 5000);
                router.reload();
            } else {
                setError(data.message || t('bulkSends.syncError'));
            }
        } catch {
            setError(t('bulkSends.syncTemplatesError'));
        } finally {
            setIsSyncing(false);
        }
    };

    const handleDeleteTemplate = async (id: number, name: string) => {
        // Sólo abre el diálogo: el borrado real ocurre en confirmDeleteTemplate.
        setTemplateToDelete({ id, name });
    };

    const confirmDeleteTemplate = async () => {
        if (!templateToDelete) return;
        const { id } = templateToDelete;
        setTemplateToDelete(null);
        try {
            const response = await csrfDelete(`/admin/bulk-sends/templates/${id}`);
            const data = response.data;
            if (data.success) {
                setSuccess(data.message);
                setTimeout(() => setSuccess(''), 5000);
                router.reload();
            } else {
                setError(data.message || t('bulkSends.deleteError'));
            }
        } catch {
            setError(t('bulkSends.deleteTemplateError'));
        }
    };

    // Auto-generate technical name from display name
    const handleDisplayNameChange = (value: string) => {
        setNewTplDisplayName(value);
        const techName = value
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '_')
            .replace(/^_+|_+$/g, '');
        setNewTplName(techName);
    };

    /* ══ Presentación: solo lee el estado de arriba; las llamadas son las de siempre ══════════════════ */

    const idiomaTexto = (codigo: string) => (IDIOMAS[codigo] ? t(IDIOMAS[codigo]) : codigo);
    const plantillaEnMeta = selectedTemplate ? allTemplates.find((p) => p.id === selectedTemplate.id) : undefined;
    // Lo que rodea a cada {{N}} en la plantilla, para decir dónde cae: «…su cita de ___ el día…». Tres palabras
    // a cada lado, sin cruzar a otro {{N}}. soloAntes → «su cita de ___» (la frase de la guía del Excel).
    const contextoHueco = (idx: number, soloAntes = false) => {
        const texto = selectedTemplate?.preview_text ?? '';
        const tag = `{{${idx}}}`;
        const pos = texto.indexOf(tag);
        if (pos < 0) return soloAntes ? '___' : `…${tag}…`;
        const antesTodo = texto.slice(0, pos).split(/\{\{\d+\}\}/).pop() ?? '';
        const despuesTodo = texto.slice(pos + tag.length).split(/\{\{\d+\}\}/)[0] ?? '';
        const palabrasAntes = antesTodo.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
        const palabrasDespues = despuesTodo.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
        const antes = palabrasAntes.slice(-3).join(' ');
        if (soloAntes) return antes ? `${antes} ___` : '___';
        const despues = palabrasDespues.slice(0, 3).join(' ');
        const pegado = /^[,.;:!?)]/.test(despues) ? '' : ' ';
        return `${palabrasAntes.length > 3 || antesTodo !== texto.slice(0, pos) ? '…' : ''}${antes}${antes ? ' ' : ''}___${despues ? pegado + despues : ''}${palabrasDespues.length > 3 || despuesTodo !== texto.slice(pos + tag.length) ? '…' : ''}`;
    };
    // Mismo criterio que mappingComplete, hueco a hueco, para decir cuántos faltan.
    const conOrigen = (idx: number) => {
        const m = columnMapping[String(idx)];
        if (!m) return false;
        if (m.source === 'nombre') return true;
        if (m.source === 'column') return !!m.column && extraColumns.includes(m.column);
        if (m.source === 'static') return !!m.value?.trim();
        return false;
    };
    const faltanOrigen = templatePlaceholders.filter((idx) => !conOrigen(idx)).length;

    // La vista previa en trozos para resaltar cada dato. Es la MISMA sustitución que renderedPreview;
    // si por lo que sea no coincidiera letra a letra, se pinta renderedPreview tal cual.
    const trozosVista = useMemo(() => {
        const texto = selectedTemplate?.preview_text;
        if (!texto) return null;
        const muestra = recipients[0];
        const trozos: { texto: string; tipo: 'txt' | 'dato' | 'hueco' | 'sin' }[] = [];
        const re = /\{\{(\d+)\}\}/g;
        let ultimo = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(texto))) {
            if (m.index > ultimo) trozos.push({ texto: texto.slice(ultimo, m.index), tipo: 'txt' });
            ultimo = m.index + m[0].length;
            const map = columnMapping[m[1]];
            if (!map) {
                trozos.push({ texto: m[0], tipo: 'txt' });
            } else if (map.source === 'nombre') {
                trozos.push(muestra?.name ? { texto: muestra.name, tipo: 'dato' } : { texto: t('bulkSends.previewNoName'), tipo: 'hueco' });
            } else if (map.source === 'column') {
                const v = muestra?.params?.[map.column || ''];
                trozos.push(v !== undefined && v !== null ? { texto: v, tipo: 'dato' } : { texto: t('bulkSends.previewColumnFallback', { column: map.column }), tipo: 'hueco' });
            } else if (map.source === 'static') {
                trozos.push(map.value ? { texto: map.value, tipo: 'dato' } : { texto: t('bulkSends.previewEmptyStatic'), tipo: 'hueco' });
            } else {
                trozos.push({ texto: t('bulkSends.previewUnassigned'), tipo: 'sin' });
            }
        }
        if (ultimo < texto.length) trozos.push({ texto: texto.slice(ultimo), tipo: 'txt' });
        return trozos.map((x) => x.texto).join('') === renderedPreview ? trozos : null;
    }, [selectedTemplate, columnMapping, recipients, renderedPreview, t]);

    const vistaPrevia = (
        <p className="whitespace-pre-wrap">
            {trozosVista
                ? trozosVista.map((x, i) =>
                      x.tipo === 'txt' ? (
                          <React.Fragment key={i}>{x.texto}</React.Fragment>
                      ) : (
                          <span
                              key={i}
                              className={cn(
                                  'rounded-[3px] px-0.5 font-semibold',
                                  x.tipo === 'dato' && 'bg-[#2e3f84]/7 dark:bg-white/10',
                                  x.tipo === 'hueco' && 'bg-black/5 font-medium text-slate-600 italic dark:bg-white/8 dark:text-neutral-300',
                                  x.tipo === 'sin' && 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                              )}
                          >
                              {x.texto}
                          </span>
                      )
                  )
                : renderedPreview || selectedTemplate?.preview_text}
        </p>
    );
    const medioAdjunto = (formato: string | null | undefined) => {
        const def = formato === 'DOCUMENT' ? [FileText, 'bulkSends.pdfAttached'] : formato === 'IMAGE' ? [Image, 'bulkSends.imageAttached'] : formato === 'VIDEO' ? [Video, 'bulkSends.videoAttached'] : null;
        if (!def) return null;
        const [Icono, clave] = def as [LucideIcon, string];
        return (
            <span className="mb-2 flex items-center gap-2 rounded-lg bg-black/5 px-2.5 py-2 text-[12px] leading-4 text-slate-600 dark:bg-white/8 dark:text-neutral-300">
                <Icono className="size-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
                {t(clave)}
            </span>
        );
    };
    const destinatarioVista = recipients[0] ? (recipients[0].name ? nombrePropio(recipients[0].name) : recipients[0].phone) : '';
    const rotuloVista = recipients[0] ? (
        <Trans i18nKey="bulkSends.previewToRecipient" values={{ recipient: destinatarioVista }} components={{ strong: <span className={cn('font-semibold', TEXTO_NAVY)} /> }} />
    ) : (
        t('bulkSends.messagePreviewColon')
    );

    // Estado de cada paso (el círculo pasa a visto verde y lo dice con palabras).
    const paso1Hecho = !!selectedTemplate && templateHealth?.kind !== 'broken';
    const paso2Hecho = recipients.length > 0;
    const paso3Hecho = paso1Hecho && mappingComplete && validationIssues.errors.length === 0;
    const estadoPaso1 = !selectedTemplate ? (
        <EstadoPaso tono="neutro">{t('bulkSends.stepTemplateMissing')}</EstadoPaso>
    ) : templateHealth?.kind === 'broken' ? (
        <EstadoPaso tono="mal">{t('bulkSends.stepTemplateBroken')}</EstadoPaso>
    ) : (
        <EstadoPaso tono="ok">{plantillaEnMeta?.status === 'APPROVED' ? t('bulkSends.stepTemplateApproved') : t('bulkSends.stepTemplateActive')}</EstadoPaso>
    );
    const estadoPaso2 = paso2Hecho ? (
        <EstadoPaso tono="ok">{t('bulkSends.recipientsCount', { value: miles(recipients.length, lng) })}</EstadoPaso>
    ) : (
        <EstadoPaso tono="neutro">{t('bulkSends.stepRecipientsMissing')}</EstadoPaso>
    );
    const estadoPaso3 = !selectedTemplate ? null : templatePlaceholders.length === 0 ? (
        <EstadoPaso tono="neutro">{t('bulkSends.stepDataFixed')}</EstadoPaso>
    ) : faltanOrigen > 0 ? (
        <EstadoPaso tono="mal">{t('bulkSends.stepDataMissing', { count: faltanOrigen })}</EstadoPaso>
    ) : validationIssues.errors.length > 0 ? (
        <EstadoPaso tono="mal">{t('bulkSends.checkCrossed', { count: validationIssues.errors.length })}</EstadoPaso>
    ) : (
        <EstadoPaso tono="ok">{t('bulkSends.stepDataReady', { done: templatePlaceholders.length, total: templatePlaceholders.length })}</EstadoPaso>
    );

    // Comprobaciones del paso 4 (icono + texto; lo que falta, en rojo; lo dudoso, en ámbar).
    // 'falta' = aún no se ha hecho (pizarra, sin alarma); 'mal' = un problema de verdad.
    const comprobaciones: { tono: 'ok' | 'aviso' | 'mal' | 'falta'; texto: string }[] = [];
    if (!selectedTemplate) comprobaciones.push({ tono: 'falta', texto: t('bulkSends.selectTemplateBeforeSend') });
    else if (templateHealth?.kind === 'broken') comprobaciones.push({ tono: 'mal', texto: t('bulkSends.templateBrokenTitle') });
    else if (templatePlaceholders.length === 0) comprobaciones.push({ tono: 'aviso', texto: t('bulkSends.checkTemplateNoParams') });
    else comprobaciones.push({ tono: 'ok', texto: t('bulkSends.checkTemplateParams', { count: templatePlaceholders.length }) });
    comprobaciones.push(
        recipients.length > 0
            ? { tono: 'ok', texto: t('bulkSends.checkRecipients', { count: recipients.length, value: miles(recipients.length, lng) }) }
            : { tono: 'falta', texto: t('bulkSends.addRecipientError') }
    );
    if (selectedTemplate && templatePlaceholders.length > 0) {
        comprobaciones.push(mappingComplete ? { tono: 'ok', texto: t('bulkSends.checkMappingOk') } : { tono: 'mal', texto: t('bulkSends.stepDataMissing', { count: faltanOrigen }) });
        comprobaciones.push(
            validationIssues.errors.length > 0
                ? { tono: 'mal', texto: t('bulkSends.checkCrossed', { count: validationIssues.errors.length }) }
                : { tono: 'ok', texto: t('bulkSends.checkCrossedOk') }
        );
        // Un aviso se lee entero; varios se resumen (están uno por uno en el paso 3).
        if (validationIssues.warnings.length === 1) comprobaciones.push({ tono: 'aviso', texto: validationIssues.warnings[0] });
        else if (validationIssues.warnings.length > 1) comprobaciones.push({ tono: 'aviso', texto: t('bulkSends.checkWarnings', { count: validationIssues.warnings.length }) });
    }

    const motivoApagado = !selectedTemplate
        ? t('bulkSends.selectTemplateBeforeSend')
        : recipients.length === 0
          ? t('bulkSends.addRecipientError')
          : !mappingComplete
            ? t('bulkSends.assignSourceBeforeSend')
            : '';
    const puedeEnviar = !isSending && !!selectedTemplate && mappingComplete && recipients.length > 0;

    // Errores de añadir un número: se ven junto al campo (arriba quedaría fuera de la vista).
    const errorNumero = error && (error === t('bulkSends.duplicatePhone') || error === t('bulkSends.phoneMinDigits')) ? error : '';

    const filtrosHistorial = [
        { value: 'all' as const, label: t('bulkSends.filterAll'), count: filteredBulkSends.length },
        { value: 'processing' as const, label: t('bulkSends.filterQueued'), count: filteredBulkSends.filter((item) => item.status === 'processing').length },
        { value: 'completed' as const, label: t('bulkSends.filterCompleted'), count: filteredBulkSends.filter((item) => item.status === 'completed').length },
        { value: 'failed' as const, label: t('bulkSends.filterFailed'), count: filteredBulkSends.filter((item) => item.status === 'failed').length },
        { value: 'cancelled' as const, label: t('bulkSends.filterCancelled'), count: filteredBulkSends.filter((item) => item.status === 'cancelled').length },
    ].map((f) => ({ ...f, count: f.count > 0 ? miles(f.count, lng) : undefined }));

    const plantillaABorrar = templateToDelete ? allTemplates.find((p) => p.id === templateToDelete.id) : undefined;
    const seguroBorrar = useRef<HTMLButtonElement>(null);
    const seguroEnvio = useRef<HTMLButtonElement>(null);
    const verDetalle = (id: number) => router.visit(`/admin/bulk-sends/${id}`);

    /* ── Piezas de la pestaña Enviar ── */

    const COLUMNAS_HIST = 'grid-cols-[minmax(0,1.8fr)_112px_150px_166px_minmax(0,1fr)_122px_16px] gap-x-5';
    const COLUMNAS_TPL = 'grid-cols-[minmax(0,1.7fr)_116px_84px_124px_minmax(0,1.2fr)_100px_30px] gap-x-5';

    const seccionEnCurso = (
        <section aria-labelledby="envio-en-curso">
            <Banda
                id="envio-en-curso"
                icon={Send}
                titulo={t('bulkSends.sendInProgressTitle')}
                estado={<Estado status="processing" peq />}
                texto={
                    activeProgress
                        ? t('bulkSends.inProgressText', { name: activeProgress.name || t('bulkSends.unnamed'), template: activeProgress.template_name })
                        : t('bulkSends.sendInProgress')
                }
                acciones={
                    activeProgress && (
                        <button type="button" onClick={() => setConfirmarDetener(true)} aria-haspopup="dialog" title={t('bulkSends.stopAsksConfirmation')} className={BOTON_PELIGRO}>
                            <Square strokeWidth={2} aria-hidden="true" />
                            {t('bulkSends.stopButton')}
                        </button>
                    )
                }
                className="rounded-t-2xl"
            />
            {activeProgress && (
                <div className={cn('border-b pt-[18px] pb-5', SANGRIA, FILETE)}>
                    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                        <div className="flex min-w-0 flex-col gap-1.5">
                            <Rotulo titulo={t('bulkSends.progressTitle')} apoyo={t('bulkSends.progressAutoRefresh')} />
                            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                <span className={cn('text-[30px] leading-9 font-medium tracking-[-0.03em] whitespace-nowrap tabular-nums', TEXTO_NAVY)}>{activeProgress.percentage} %</span>
                                <span className={cn('text-[14px] leading-5 tabular-nums', TEXTO_SUAVE)}>
                                    <Trans
                                        i18nKey="bulkSends.progressProcessedRich"
                                        values={{ done: miles(activeProgress.sent + activeProgress.failed, lng), total: miles(activeProgress.total, lng) }}
                                        components={{ strong: <span className={cn('font-semibold', TEXTO_NAVY)} /> }}
                                    />
                                </span>
                            </div>
                        </div>
                        <div className={cn('flex flex-wrap items-center gap-x-[22px] gap-y-1.5 pb-1.5 text-[13px] leading-[18px] font-medium whitespace-nowrap tabular-nums', TEXTO_NAVY)}>
                            <span className="flex items-center gap-2">
                                <span className="size-[9px] shrink-0 rounded-[2.5px] bg-emerald-600 dark:bg-emerald-500" aria-hidden="true" />
                                {t('bulkSends.sent')} <span className="font-semibold">{miles(activeProgress.sent, lng)}</span>
                            </span>
                            <span className="flex items-center gap-2">
                                <span className="size-[9px] shrink-0 rounded-[2.5px] bg-red-600 dark:bg-red-500" aria-hidden="true" />
                                {t('bulkSends.failed')} <span className="font-semibold">{miles(activeProgress.failed, lng)}</span>
                            </span>
                            <span className="flex items-center gap-2">
                                <span className="size-[9px] shrink-0 rounded-[2.5px] bg-[#2e3f84]/8 shadow-[inset_0_0_0_1px_rgba(46,63,132,0.32)] dark:bg-white/10 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.3)]" aria-hidden="true" />
                                {t('bulkSends.pending')} <span className="font-semibold">{miles(activeProgress.pending, lng)}</span>
                            </span>
                        </div>
                    </div>
                    <Barra ok={activeProgress.sent} mal={activeProgress.failed} total={activeProgress.total} alto="mt-3.5 h-2.5" etiqueta={t('bulkSends.progressTitle')} />
                </div>
            )}
            <div className={cn('flex min-h-12 items-center gap-3 px-4 py-3 @3xl/hoja:px-5', FILETE)}>
                <span className={cn('flex w-8 shrink-0 justify-center', TEXTO_SUAVE)}>
                    <Info className="size-[15px]" strokeWidth={1.9} aria-hidden="true" />
                </span>
                <p className={cn('text-[12.5px] leading-4', TEXTO_SUAVE)}>{t('bulkSends.inProgressNote')}</p>
            </div>
        </section>
    );

    /* Paso 1 · Plantilla */
    const paso1 = (
        <section aria-labelledby="paso-plantilla" className={cn('border-b', FILETE)}>
            <CabezaPaso id="paso-plantilla" n={1} titulo={t('bulkSends.stepTemplate')} hecho={paso1Hecho} estado={estadoPaso1} />
            <div className="flex flex-col gap-4 px-4 pb-[22px] @3xl/hoja:pr-7 @3xl/hoja:pl-16">
                <div className="grid grid-cols-1 gap-x-4 gap-y-4 @3xl/hoja:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                    <div className="flex min-w-0 flex-col gap-[7px]">
                        <span id="etq-plantilla" className={ETIQUETA}>
                            {t('bulkSends.whatsappTemplateLabel')}
                        </span>
                        {whatsappTemplates.length > 0 ? (
                            <Select value={selectedTemplate?.id ? String(selectedTemplate.id) : ''} onValueChange={(v) => handleSelectTemplate(v)}>
                                <SelectTrigger aria-labelledby="etq-plantilla" className={DISPARADOR}>
                                    <div className="flex min-w-0 flex-1 items-center gap-[9px]">
                                        <MessageSquareText className="size-[15px] shrink-0 text-muted-foreground dark:text-neutral-400" strokeWidth={1.75} aria-hidden="true" />
                                        <span className="min-w-0 truncate text-left">
                                            <SelectValue placeholder={t('bulkSends.selectTemplatePlaceholder')} />
                                        </span>
                                    </div>
                                </SelectTrigger>
                                <SelectContent className={MENU}>
                                    {whatsappTemplates.map((tpl) => (
                                        <SelectItem key={tpl.id} value={String(tpl.id)} className={OPCION}>
                                            {tpl.name}
                                            {conMedio(tpl.header_format) && <Paperclip className="size-3.5 text-muted-foreground" strokeWidth={2} aria-label={t('bulkSends.withAttachment')} />}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <div className="flex min-h-[38px] items-start gap-2.5 rounded-[10px] border-[1.5px] border-dashed border-[#2e3f84]/26 bg-[#2e3f84]/[0.035] px-3 py-2.5 dark:border-white/20 dark:bg-white/[0.03]">
                                <MessageSquareText className={cn('mt-px size-4 shrink-0', TEXTO_SUAVE)} strokeWidth={1.9} aria-hidden="true" />
                                <div className="flex min-w-0 flex-col gap-0.5">
                                    <span className={cn('text-[13px] leading-[18px] font-semibold', TEXTO_NAVY)}>{t('bulkSends.noTemplatesConfigured')}</span>
                                    <span className={AYUDA}>{t('bulkSends.noTemplatesHelp')}</span>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex min-w-0 flex-col gap-[7px]">
                        <label htmlFor="bulk-send-name" className={ETIQUETA}>
                            <Trans i18nKey="bulkSends.sendNameLabel" components={{ opt: <span className={cn('font-normal', TEXTO_SUAVE)} /> }} />
                        </label>
                        <div className="relative">
                            <PencilLine className={ICONO_CAMPO} strokeWidth={1.75} aria-hidden="true" />
                            <input
                                id="bulk-send-name"
                                type="text"
                                value={sendName}
                                onChange={(e) => setSendName(e.target.value)}
                                placeholder={t('bulkSends.sendNamePlaceholder')}
                                className={cn(CAMPO, 'pl-[37px]')}
                            />
                        </div>
                    </div>
                </div>

                {selectedTemplate && (
                    <div className="-mt-1.5 flex flex-col gap-2.5">
                        <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] leading-4', TEXTO_SUAVE)}>
                            <span className={cn('text-[12px]', MONO, TEXTO_NAVY)}>{selectedTemplate.meta_template_name}</span>
                            <span aria-hidden="true">·</span>
                            <span>{idiomaTexto(selectedTemplate.language)}</span>
                            <span aria-hidden="true">·</span>
                            <span>{CATEGORIAS[selectedTemplate.category] ? t(CATEGORIAS[selectedTemplate.category][1]) : selectedTemplate.category}</span>
                            {conMedio(selectedTemplate.header_format) && (
                                <>
                                    <span aria-hidden="true">·</span>
                                    <span className="inline-flex items-center gap-1">
                                        <Paperclip className="size-3" strokeWidth={2} aria-hidden="true" />
                                        {t('bulkSends.withAttachment')}
                                    </span>
                                </>
                            )}
                            <button
                                type="button"
                                onClick={() => setShowPreview(!showPreview)}
                                aria-expanded={showPreview}
                                className={cn(BOTON_TEXTO, '-my-1.5 ml-auto', TEXTO_NAVY, 'hover:bg-[#2e3f84]/6 dark:hover:bg-white/8')}
                            >
                                {showPreview ? t('bulkSends.hideOriginal') : t('bulkSends.showOriginal')}
                                <ChevronDown className={cn('transition-transform', showPreview && 'rotate-180')} strokeWidth={2} aria-hidden="true" />
                            </button>
                        </div>
                        {showPreview && (
                            <div className="flex flex-col gap-2 rounded-xl bg-[#2e3f84]/[0.035] p-3.5 shadow-[inset_0_0_0_1px_rgba(46,63,132,0.08)] dark:bg-white/[0.03] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
                                {medioAdjunto(selectedTemplate.header_format)}
                                <p className={cn('text-[13px] leading-5 whitespace-pre-wrap [overflow-wrap:anywhere]', TEXTO_NAVY)}>{selectedTemplate.preview_text || t('bulkSends.noPreviewText')}</p>
                                <p className={cn('text-[12px] leading-4', TEXTO_SUAVE)}>
                                    <Trans
                                        i18nKey="bulkSends.templateMetaLanguage"
                                        values={{ name: selectedTemplate.meta_template_name, language: selectedTemplate.language }}
                                        components={{ meta: <span className={cn(MONO, 'font-medium', TEXTO_NAVY)} /> }}
                                    />
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Plantilla mal construida o sin parámetros: decirlo, no callar (antes de hablar de columnas). */}
                {templateHealth && (
                    <Nota tipo={templateHealth.kind === 'broken' ? 'mal' : 'aviso'} titulo={templateHealth.kind === 'broken' ? t('bulkSends.templateBrokenTitle') : t('bulkSends.templateNoParamsTitle')}>
                        <span>
                            {templateHealth.kind === 'broken'
                                ? t('bulkSends.templateBrokenHelp', { markers: templateHealth.leftovers.join('  ') })
                                : t('bulkSends.templateNoParamsHelp')}
                        </span>
                    </Nota>
                )}

                {/* Guía: formato de Excel sugerido para la plantilla seleccionada */}
                {selectedTemplate && excelGuide && (
                    <div className="flex flex-col gap-2.5 rounded-xl bg-[#2e3f84]/[0.035] px-4 py-3.5 shadow-[inset_0_0_0_1px_rgba(46,63,132,0.08)] dark:bg-white/[0.03] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
                        <div className="flex items-center gap-2">
                            <FileSpreadsheet className={cn('size-[15px] shrink-0', TEXTO_NAVY)} strokeWidth={1.9} aria-hidden="true" />
                            <h4 className={cn('text-[13px] leading-[18px] font-semibold', TEXTO_NAVY)}>{t('bulkSends.excelGuideTitle')}</h4>
                        </div>
                        <div className="custom-scrollbar overflow-x-auto rounded-lg bg-white shadow-[0_0_0_1px_rgba(46,63,132,0.14)] dark:bg-white/[0.03] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.14)]">
                            <table className="w-full border-collapse text-left">
                                <thead>
                                    <tr>
                                        {[t('bulkSends.excelColPhone'), ...excelGuide.map((g) => g.header)].map((h, i) => (
                                            <th
                                                key={i}
                                                scope="col"
                                                className={cn(
                                                    'border-b border-[#2e3f84]/12 bg-[#2e3f84]/5 px-2 py-1.5 text-[11.5px] leading-4 font-semibold whitespace-nowrap dark:border-white/12 dark:bg-white/5',
                                                    i > 0 && 'border-l',
                                                    MONO,
                                                    TEXTO_NAVY
                                                )}
                                            >
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        {['3101234567', ...excelGuide.map((g) => g.sample)].map((v, i) => (
                                            <td key={i} className={cn('border-[#2e3f84]/12 px-2 py-1.5 text-[11.5px] leading-4 whitespace-nowrap tabular-nums dark:border-white/12', i > 0 && 'border-l', TEXTO_SUAVE)}>
                                                {v}
                                            </td>
                                        ))}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p className={cn('text-[12px] leading-[17px]', TEXTO_SUAVE)}>
                            {t('bulkSends.excelGuideLead')}{' '}
                            {excelGuide.map((g, i) => (
                                <React.Fragment key={g.idx}>
                                    {i > 0 && ', '}
                                    <Trans i18nKey="bulkSends.excelGuideItem" values={{ column: g.header, context: contextoHueco(g.idx, true) }} components={{ col: <span className={cn('font-medium', TEXTO_NAVY)} /> }} />
                                </React.Fragment>
                            ))}
                            .
                        </p>
                    </div>
                )}
            </div>
        </section>
    );

    /* Paso 2 · Destinatarios */
    const zonaArchivo = (
        <div
            onDrop={handleDrop}
            onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
            }}
            onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
            }}
            className={cn(
                'rounded-xl transition-colors',
                isDragging && 'bg-[#2e3f84]/8 shadow-[inset_0_0_0_1.5px_#2e3f84] dark:bg-white/8 dark:shadow-[inset_0_0_0_1.5px_#8b9ae0]'
            )}
        >
            <input id="bulk-file-input" type="file" accept=".xlsx,.xls,.csv" onChange={handleFileInput} className="sr-only" tabIndex={-1} aria-hidden="true" />
            {uploadedFileName && !isUploading ? (
                <div className="flex flex-wrap items-center gap-x-3.5 gap-y-3 rounded-xl bg-white py-3 pr-3 pl-3.5 shadow-[inset_0_0_0_1px_rgba(46,63,132,0.14)] dark:bg-white/[0.03] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]">
                    <span className="flex size-[38px] shrink-0 items-center justify-center rounded-[10px] bg-emerald-50 text-emerald-700 shadow-[inset_0_0_0_1px_var(--color-emerald-200)] dark:bg-emerald-500/10 dark:text-emerald-300 dark:shadow-none">
                        <FileSpreadsheet className="size-[18px]" strokeWidth={1.9} aria-hidden="true" />
                    </span>
                    <div className="flex min-w-0 flex-[1_1_14rem] flex-col gap-[3px]">
                        <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] leading-[18px] tabular-nums">
                            <span className={cn('max-w-full truncate text-[12.5px] font-semibold', MONO, TEXTO_NAVY)} title={uploadedFileName}>
                                {uploadedFileName}
                            </span>
                            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                                <CircleCheck className="mr-1 -mt-0.5 inline size-3.5" strokeWidth={2.25} aria-hidden="true" />
                                {t('bulkSends.fileLoadedCount', { value: miles(uploadedTotal, lng) })}
                            </span>
                        </p>
                        {extraColumns.length > 0 && <p className={cn('text-[12px] leading-4', TEXTO_SUAVE)}>{t('bulkSends.extraColumnsDetected', { columns: extraColumns.join(', ') })}</p>}
                    </div>
                    <button type="button" onClick={() => document.getElementById('bulk-file-input')?.click()} title={t('bulkSends.changeFileHint')} className={BOTON_SECUNDARIO}>
                        <Upload strokeWidth={1.9} aria-hidden="true" />
                        {t('bulkSends.changeFile')}
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => document.getElementById('bulk-file-input')?.click()}
                    className={cn(
                        'flex min-h-[112px] w-full cursor-pointer flex-wrap items-center gap-x-[18px] gap-y-3 rounded-xl border-[1.5px] border-dashed border-[#2e3f84]/35 bg-[#2e3f84]/[0.035] px-5 py-5 text-left transition-colors hover:border-[#2e3f84]/60 disabled:cursor-wait dark:border-white/25 dark:bg-white/[0.03] dark:hover:border-white/40',
                        FOCO
                    )}
                >
                    {isUploading ? (
                        <span className={cn('flex w-full items-center justify-center gap-2.5 text-[13.5px] leading-5 font-medium', TEXTO_NAVY)} role="status">
                            <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" strokeWidth={2} aria-hidden="true" />
                            {t('bulkSends.processingFile')}
                        </span>
                    ) : (
                        <>
                            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#2e3f84] text-white shadow-[0_1px_2px_rgba(46,63,132,0.3),0_6px_14px_-6px_rgba(46,63,132,0.5)] dark:bg-[#4e5fa4]">
                                <Upload className="size-5" strokeWidth={2} aria-hidden="true" />
                            </span>
                            <span className="flex min-w-0 flex-[1_1_14rem] flex-col gap-1">
                                <span className={cn('text-[14px] leading-5 font-semibold', TEXTO_NAVY)}>{t('bulkSends.dragExcelHere')}</span>
                                <span className={cn('text-[12.5px] leading-[18px]', TEXTO_SUAVE)}>{t('bulkSends.fileFormatsHelp')}</span>
                            </span>
                            <span className={cn(BOTON_SECUNDARIO, 'pointer-events-none')} aria-hidden="true">
                                <FileSpreadsheet strokeWidth={1.9} />
                                {t('bulkSends.selectFile')}
                            </span>
                        </>
                    )}
                </button>
            )}
        </div>
    );

    const paso2 = (
        <section aria-labelledby="paso-destinatarios" className={cn('border-b', FILETE)}>
            <CabezaPaso id="paso-destinatarios" n={2} titulo={t('bulkSends.stepRecipients')} hecho={paso2Hecho} estado={estadoPaso2} />
            <div className="flex flex-col gap-4 px-4 pb-[22px] @3xl/hoja:pr-7 @3xl/hoja:pl-16">
                {zonaArchivo}
                <p className={cn('-mt-1.5 flex items-start gap-[7px] text-[12px] leading-4', TEXTO_SUAVE)}>
                    <Info className="mt-px size-[13px] shrink-0" strokeWidth={2} aria-hidden="true" />
                    {t('bulkSends.recipientsRules')}
                </p>

                <div className="flex flex-col gap-2">
                    <div className="grid grid-cols-1 items-center gap-2.5 @2xl/hoja:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] @4xl/hoja:grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)_auto]">
                        <span className={cn(ETIQUETA, '@2xl/hoja:col-span-3 @4xl/hoja:col-span-1')}>{t('bulkSends.addNumber')}</span>
                        <div className="relative">
                            <label htmlFor="bulk-manual-phone" className="sr-only">
                                {t('common.phone')}
                            </label>
                            <Phone className={ICONO_CAMPO} strokeWidth={1.75} aria-hidden="true" />
                            <input
                                id="bulk-manual-phone"
                                type="text"
                                inputMode="tel"
                                value={manualPhone}
                                onChange={(e) => setManualPhone(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addManualRecipient()}
                                placeholder="3001234567"
                                aria-invalid={errorNumero ? true : undefined}
                                aria-describedby={errorNumero ? 'bulk-manual-error' : undefined}
                                className={cn(CAMPO, 'pl-[37px] tabular-nums', errorNumero && 'shadow-[inset_0_0_0_1px_var(--color-red-600)] dark:shadow-[inset_0_0_0_1px_var(--color-red-400)]')}
                            />
                        </div>
                        <div className="relative">
                            <label htmlFor="bulk-manual-name" className="sr-only">
                                {t('common.name')}
                            </label>
                            <UserRound className={ICONO_CAMPO} strokeWidth={1.75} aria-hidden="true" />
                            <input
                                id="bulk-manual-name"
                                type="text"
                                value={manualName}
                                onChange={(e) => setManualName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addManualRecipient()}
                                placeholder={t('bulkSends.namePlaceholderShort')}
                                className={cn(CAMPO, 'pl-[37px]')}
                            />
                        </div>
                        <button type="button" onClick={addManualRecipient} className={cn(BOTON_SECUNDARIO, 'h-[38px]')}>
                            <Plus strokeWidth={2} aria-hidden="true" />
                            {t('bulkSends.addButton')}
                        </button>
                    </div>
                    {errorNumero && (
                        <p id="bulk-manual-error" role="alert" className="flex items-center gap-1.5 text-[12.5px] leading-[18px] font-medium text-red-700 @4xl/hoja:pl-[160px] dark:text-red-400">
                            <CircleAlert className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                            {errorNumero}
                        </p>
                    )}
                </div>

                {recipients.length > 0 && (
                    <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <Rotulo
                                as="h4"
                                titulo={t('bulkSends.listLabel')}
                                apoyo={
                                    recipients.length > RECIPIENTS_PREVIEW_LIMIT
                                        ? `${t('bulkSends.recipientsCount', { value: miles(recipients.length, lng) })} · ${t('bulkSends.listShowingFirst', { limit: RECIPIENTS_PREVIEW_LIMIT })}`
                                        : t('bulkSends.recipientsCount', { value: miles(recipients.length, lng) })
                                }
                            />
                            <button type="button" onClick={clearRecipients} title={t('bulkSends.removeAllHint')} className={cn(BOTON_TEXTO, 'text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10')}>
                                <Trash2 strokeWidth={2} aria-hidden="true" />
                                {t('bulkSends.removeAll')}
                            </button>
                        </div>
                        <div className="custom-scrollbar-light max-h-[372px] overflow-y-auto rounded-xl shadow-[inset_0_0_0_1px_rgba(46,63,132,0.12)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]">
                            {/* Sólo se pintan los primeros RECIPIENTS_PREVIEW_LIMIT: un Excel real llegó a 2.027
                                destinatarios y pintarlos todos dejaba el navegador pesado JUSTO antes de enviar.
                                El envío sigue usando el array completo. */}
                            <ul>
                                {recipients.slice(0, RECIPIENTS_PREVIEW_LIMIT).map((r, index) => (
                                    <li
                                        key={index}
                                        className={cn(
                                            'grid min-h-[46px] grid-cols-[26px_minmax(0,1fr)_30px] items-center gap-x-3 border-b py-1.5 pr-2 pl-3 last:border-b-0 @2xl/hoja:grid-cols-[26px_118px_minmax(0,1fr)_30px]',
                                            FILETE
                                        )}
                                    >
                                        <span className={cn('text-right text-[12px] leading-4 font-medium tabular-nums', TEXTO_SUAVE)}>{index + 1}</span>
                                        <span className={cn('hidden text-[12.5px] leading-4 font-semibold whitespace-nowrap tabular-nums @2xl/hoja:block', MONO, TEXTO_NAVY)}>{r.phone}</span>
                                        <div className="flex min-w-0 flex-col gap-px">
                                            <span className={cn('text-[12.5px] leading-4 font-semibold tabular-nums @2xl/hoja:hidden', MONO, TEXTO_NAVY)}>{r.phone}</span>
                                            {r.name && <span className={cn('truncate text-[13px] leading-[18px] font-medium', TEXTO_NAVY)}>{r.name}</span>}
                                            {r.params && Object.keys(r.params).length > 0 && (
                                                <span className="truncate text-[12px] leading-4 text-sky-700 tabular-nums dark:text-sky-300">{Object.values(r.params).join(' · ')}</span>
                                            )}
                                        </div>
                                        <button type="button" onClick={() => removeRecipient(index)} aria-label={`${t('bulkSends.removeFromList')}: ${r.phone}`} title={t('bulkSends.removeFromList')} className={BOTON_ICONO}>
                                            <X className="size-4" strokeWidth={2} aria-hidden="true" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        {recipients.length > RECIPIENTS_PREVIEW_LIMIT && (
                            <p className={cn('text-[12px] leading-4 tabular-nums', TEXTO_SUAVE)}>
                                {t('bulkSends.andMoreRecipients', {
                                    count: recipients.length - RECIPIENTS_PREVIEW_LIMIT,
                                    defaultValue: '…y {{count}} destinatarios más (se enviará a los {{total}})',
                                    total: miles(recipients.length, lng),
                                    limit: RECIPIENTS_PREVIEW_LIMIT,
                                })}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </section>
    );

    /* Paso 3 · Datos de cada mensaje (column_mapping o parámetros fijos) */
    const paso3 = (
        <section aria-labelledby="paso-datos">
            <CabezaPaso id="paso-datos" n={3} titulo={t('bulkSends.stepData')} hecho={paso3Hecho} estado={estadoPaso3} />
            <div className="flex flex-col gap-4 px-4 pb-[22px] @3xl/hoja:pr-7 @3xl/hoja:pl-16">
                {!selectedTemplate && <p className={cn('-mt-1 text-[12.5px] leading-[18px]', TEXTO_SUAVE)}>{t('bulkSends.stepDataWaiting')}</p>}

                {selectedTemplate && templatePlaceholders.length > 0 && (
                    <>
                        <p className={cn('-mt-1 text-[12.5px] leading-[18px]', TEXTO_SUAVE)}>
                            {t('bulkSends.paramMappingHelp')}
                            {extraColumns.length === 0 && recipients.length === 0 && (
                                <span className="mt-1 flex items-start gap-1.5 font-medium text-amber-700 dark:text-amber-400">
                                    <TriangleAlert className="mt-px size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                                    {t('bulkSends.uploadExcelToMap')}
                                </span>
                            )}
                        </p>
                        <ul className={cn('flex flex-col border-t', FILETE)} aria-label={t('bulkSends.paramMapping')}>
                            {templatePlaceholders.map((idx) => {
                                const mapping = columnMapping[String(idx)];
                                const source = mapping?.source || 'unset';
                                const columnMissing = source === 'column' && !extraColumns.includes(mapping?.column || '');
                                const isUnset = source === 'unset' || columnMissing;
                                // Un valor fijo vacío tampoco tiene origen (mappingComplete lo exige): se marca igual.
                                const fijoVacio = source === 'static' && !mapping?.value?.trim();
                                const token = `{{${idx}}}`;
                                return (
                                    <li
                                        key={idx}
                                        className={cn(
                                            'grid grid-cols-[44px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 border-b py-2.5 @3xl/hoja:min-h-[50px] @3xl/hoja:py-2 @4xl/hoja:grid-cols-[44px_minmax(0,1fr)_16px_260px]',
                                            FILETE
                                        )}
                                    >
                                        <Ficha idx={idx} mal={isUnset || fijoVacio} />
                                        <Contexto texto={contextoHueco(idx)} mal={isUnset || fijoVacio} />
                                        <ArrowRight className={cn('hidden size-[15px] @4xl/hoja:block', TEXTO_SUAVE)} strokeWidth={2} aria-hidden="true" />
                                        <div className={cn('col-span-2 grid gap-2 @4xl/hoja:col-span-1', source === 'static' && 'grid-cols-[120px_minmax(0,1fr)]')}>
                                            <Select
                                                value={
                                                    source === 'nombre' ? '__nombre__' :
                                                    source === 'column' && !columnMissing ? `__col__${mapping?.column}` :
                                                    source === 'static' ? '__static__' :
                                                    ''
                                                }
                                                onValueChange={(v) => {
                                                    const val = v;
                                                    const newMapping = { ...columnMapping };
                                                    if (val === '__nombre__') {
                                                        newMapping[String(idx)] = { source: 'nombre' };
                                                    } else if (val.startsWith('__col__')) {
                                                        const col = val.replace('__col__', '');
                                                        newMapping[String(idx)] = { source: 'column', column: col };
                                                    } else if (val === '__static__') {
                                                        newMapping[String(idx)] = { source: 'static', value: mapping?.value || '' };
                                                    }
                                                    setColumnMapping(newMapping);
                                                }}
                                            >
                                                <SelectTrigger aria-label={t('bulkSends.mappingSourceFor', { token })} aria-invalid={isUnset || undefined} className={cn(DISPARADOR, 'h-[34px]', isUnset && DISPARADOR_MAL)}>
                                                    <div className="flex min-w-0 flex-1 items-center gap-2 truncate text-left">
                                                        <SelectValue placeholder={t('bulkSends.selectSourcePlaceholder')} />
                                                    </div>
                                                </SelectTrigger>
                                                <SelectContent className={MENU}>
                                                    <SelectItem value="__nombre__" className={OPCION}>
                                                        <UserRound className="size-[15px]" strokeWidth={1.75} aria-hidden="true" />
                                                        {t('bulkSends.sourceContactName')}
                                                    </SelectItem>
                                                    {extraColumns.map((col) => (
                                                        <SelectItem key={col} value={`__col__${col}`} className={OPCION}>
                                                            <Columns3 className="size-[15px]" strokeWidth={1.75} aria-hidden="true" />
                                                            {t('bulkSends.sourceColumn', { col })}
                                                        </SelectItem>
                                                    ))}
                                                    <SelectItem value="__static__" className={OPCION}>
                                                        <PencilLine className="size-[15px]" strokeWidth={1.75} aria-hidden="true" />
                                                        {t('bulkSends.sourceStatic')}
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {source === 'static' && (
                                                <input
                                                    type="text"
                                                    value={mapping?.value || ''}
                                                    onChange={(e) => {
                                                        const newMapping = { ...columnMapping };
                                                        newMapping[String(idx)] = { source: 'static', value: e.target.value };
                                                        setColumnMapping(newMapping);
                                                    }}
                                                    placeholder={t('bulkSends.staticValuePlaceholder')}
                                                    aria-label={t('bulkSends.staticValueFor', { token })}
                                                    aria-invalid={fijoVacio || undefined}
                                                    className={cn(CAMPO, 'h-[34px]', fijoVacio && 'shadow-[inset_0_0_0_1px_var(--color-red-600),0_0_0_3px_rgba(220,38,38,0.14)] placeholder:text-red-700 dark:shadow-[inset_0_0_0_1px_var(--color-red-400)] dark:placeholder:text-red-400')}
                                                />
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                        {validationIssues.warnings.map((msg, i) => (
                            <p key={`w${i}`} className="flex items-start gap-[7px] text-[12.5px] leading-[18px] font-medium text-amber-700 dark:text-amber-400">
                                <TriangleAlert className="mt-px size-3.5 shrink-0 text-amber-600 dark:text-amber-400" strokeWidth={2} aria-hidden="true" />
                                {msg}
                            </p>
                        ))}
                        {validationIssues.errors.length > 0 && (
                            <Nota tipo="mal" titulo={t('bulkSends.possibleCrossedData')}>
                                {validationIssues.errors.map((msg, i) => (
                                    <span key={`e${i}`}>{msg}</span>
                                ))}
                            </Nota>
                        )}
                    </>
                )}

                {/* Parámetros estáticos (solo si la plantilla no tiene {{N}} detectados, o por retrocompatibilidad) */}
                {selectedTemplate && templatePlaceholders.length === 0 && (
                    <div className="flex flex-col gap-2">
                        <span className={ETIQUETA}>
                            <Trans i18nKey="bulkSends.templateParamsLabel" components={{ opt: <span className={cn('font-normal', TEXTO_SUAVE)} /> }} />
                        </span>
                        {templateParams.map((param, index) => (
                            <div key={index} className="grid grid-cols-[44px_minmax(0,1fr)_30px] items-center gap-x-2.5">
                                <Ficha idx={index + 1} />
                                <span className={cn('flex h-[34px] min-w-0 items-center truncate rounded-[9px] bg-[#2e3f84]/[0.035] px-3 text-[13px] leading-[18px] font-medium dark:bg-white/5', TEXTO_NAVY)}>{param}</span>
                                <button type="button" onClick={() => removeParam(index)} aria-label={`${t('bulkSends.removeParam')}: {{${index + 1}}}`} title={t('bulkSends.removeParam')} className={BOTON_ICONO}>
                                    <X className="size-4" strokeWidth={2} aria-hidden="true" />
                                </button>
                            </div>
                        ))}
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2.5">
                            <input
                                type="text"
                                value={newParamValue}
                                onChange={(e) => setNewParamValue(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addParam()}
                                placeholder={t('bulkSends.paramValuePlaceholder', { token: `{{${templateParams.length + 1}}}` })}
                                aria-label={t('bulkSends.paramValuePlaceholder', { token: `{{${templateParams.length + 1}}}` })}
                                className={cn(CAMPO, 'h-[34px]')}
                            />
                            <button type="button" onClick={addParam} className={cn(BOTON_SECUNDARIO, 'h-[34px]')}>
                                <Plus strokeWidth={2} aria-hidden="true" />
                                {t('bulkSends.addButton')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );

    /* Paso 4 · Revisar y enviar (columna derecha) */
    const paso4 = (
        <section
            aria-labelledby="paso-revisar"
            className={cn('border-t bg-[#f7f8fb] @5xl/hoja:border-t-0 @5xl/hoja:border-l dark:bg-white/[0.02]', FILETE)}
        >
            {/* Con dos columnas, el paso 4 acompaña al bajar por los pasos 1-3: se pega arriba del <main> de la
                isla (el contenedor de scroll del menú Marco; ningún ancestro tiene overflow propio). La sección
                sigue estirada a lo alto de la fila, así que su fondo gris llega hasta abajo. */}
            <div className="@5xl/hoja:sticky @5xl/hoja:top-0">
                <CabezaPaso id="paso-revisar" n={4} titulo={t('bulkSends.stepReview')} hecho={false} className="@3xl/hoja:px-4" />
                <div className="flex flex-col gap-4 px-4 pb-6 @3xl/hoja:pr-6 @3xl/hoja:pl-[60px]">
                    <div className="flex flex-col gap-2">
                        <span className={cn('text-[12.5px] leading-4 font-medium', TEXTO_SUAVE)}>{selectedTemplate ? rotuloVista : t('bulkSends.messagePreviewColon')}</span>
                        <Burbuja>
                            {selectedTemplate ? (
                                <>
                                    {medioAdjunto(selectedTemplate.header_format)}
                                    {selectedTemplate.preview_text ? vistaPrevia : <p className="text-slate-600 italic dark:text-neutral-300">{t('bulkSends.noPreviewText')}</p>}
                                </>
                            ) : (
                                <p className="text-slate-600 dark:text-neutral-300">{t('bulkSends.previewWaiting')}</p>
                            )}
                        </Burbuja>
                    </div>
                    <div className="flex flex-col gap-[9px]">
                        <Rotulo as="h4" titulo={t('bulkSends.checksTitle')} />
                        <ul className="flex flex-col gap-[9px]">
                            {comprobaciones.map((c, i) => {
                                const Icono = c.tono === 'ok' ? CircleCheck : c.tono === 'aviso' ? TriangleAlert : c.tono === 'falta' ? CircleDashed : CircleX;
                                return (
                                    <li
                                        key={i}
                                        className={cn(
                                            'flex items-start gap-[9px] text-[12.5px] leading-[18px] [overflow-wrap:anywhere]',
                                            c.tono === 'ok' ? TEXTO_NAVY : c.tono === 'falta' ? TEXTO_SUAVE : c.tono === 'aviso' ? 'font-medium text-amber-700 dark:text-amber-400' : 'font-medium text-red-700 dark:text-red-400'
                                        )}
                                    >
                                        <Icono
                                            className={cn(
                                                'mt-px size-[15px] shrink-0',
                                                c.tono === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : c.tono === 'falta' ? 'text-slate-500 dark:text-neutral-400' : c.tono === 'aviso' ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
                                            )}
                                            strokeWidth={2}
                                            aria-hidden="true"
                                        />
                                        {c.texto}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                    <div className="h-px bg-[#2e3f84]/12 dark:bg-white/10" aria-hidden="true" />
                    <div className="flex flex-col gap-2.5">
                        <button
                            type="button"
                            onClick={handleStartSend}
                            disabled={!puedeEnviar}
                            aria-haspopup="dialog"
                            aria-describedby="nota-enviar"
                            title={motivoApagado || undefined}
                            className={cn(puedeEnviar || isSending ? BOTON_PRIMARIO : BOTON_APAGADO, 'h-[42px] w-full text-[14px]')}
                        >
                            {isSending ? (
                                <>
                                    <LoaderCircle className="animate-spin motion-reduce:animate-none" strokeWidth={2} aria-hidden="true" />
                                    {t('bulkSends.startingSend')}
                                </>
                            ) : (
                                <>
                                    <Send strokeWidth={2} aria-hidden="true" />
                                    {t('bulkSends.sendToRecipients', { value: miles(recipients.length, lng) })}
                                </>
                            )}
                        </button>
                        <p id="nota-enviar" className={cn('text-[12px] leading-[17px]', motivoApagado && selectedTemplate && recipients.length > 0 ? 'font-medium text-red-700 dark:text-red-400' : TEXTO_SUAVE)}>
                            {motivoApagado || t('bulkSends.sendNote')}
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );

    const seccionPreparar = (
        <section aria-labelledby="preparar-envio">
            <Banda id="preparar-envio" icon={Send} titulo={t('bulkSends.prepareTitle')} texto={t('bulkSends.prepareText')} className="rounded-t-2xl" />
            <div className="grid grid-cols-1 @5xl/hoja:grid-cols-[minmax(0,1fr)_400px] @6xl/hoja:grid-cols-[minmax(0,1fr)_424px]">
                <div className="flex min-w-0 flex-col">
                    {paso1}
                    {paso2}
                    {paso3}
                </div>
                {paso4}
            </div>
        </section>
    );

    /* Historial */
    const seccionHistorial = (
        <section aria-labelledby="historial-envios" className={cn('border-t', FILETE)}>
            <Banda
                id="historial-envios"
                icon={Clock}
                titulo={t('bulkSends.sendHistory')}
                cuenta={miles(visibleBulkSends.length, lng)}
                texto={historySearch.trim() ? t('bulkSends.historySearchSubtitle') : t('bulkSends.historyDefaultSubtitle')}
            />
            <div className={cn('flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b py-3 @3xl/hoja:min-h-[60px]', SANGRIA, FILETE)}>
                <Segmentado opciones={filtrosHistorial} activa={historyStatusFilter} onElegir={setHistoryStatusFilter} etiqueta={t('bulkSends.filterByStatus')} />
                <div className="relative w-full @3xl/hoja:w-[340px]">
                    <label htmlFor="bulk-history-search" className="sr-only">
                        {t('bulkSends.searchHistoryLabel')}
                    </label>
                    {isSearching ? (
                        <LoaderCircle className={cn('pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 animate-spin motion-reduce:animate-none', TEXTO_NAVY)} strokeWidth={2} aria-hidden="true" />
                    ) : (
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground dark:text-neutral-400" strokeWidth={1.75} aria-hidden="true" />
                    )}
                    <input
                        id="bulk-history-search"
                        type="text"
                        value={historySearch}
                        onChange={(e) => setHistorySearch(e.target.value)}
                        placeholder={t('bulkSends.searchPlaceholder')}
                        className={cn(
                            'h-9 w-full rounded-[10px] bg-[#2e3f84]/[0.035] pr-3 pl-[38px] text-[13px] leading-[18px] text-foreground shadow-[inset_0_0_0_1px_rgba(46,63,132,0.1)] transition-shadow placeholder:text-muted-foreground dark:bg-white/5 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] dark:placeholder:text-neutral-400',
                            FOCO
                        )}
                    />
                </div>
            </div>

            {visibleBulkSends.length === 0 ? (
                <div className="px-4 py-8 @3xl/hoja:px-5">
                    <div className="flex flex-col items-center gap-2 rounded-xl border-[1.5px] border-dashed border-[#2e3f84]/26 bg-[#2e3f84]/[0.035] px-5 py-7 text-center dark:border-white/20 dark:bg-white/[0.03]">
                        <span className={cn('flex size-10 items-center justify-center rounded-xl bg-white shadow-[inset_0_0_0_1px_rgba(46,63,132,0.12)] dark:bg-white/5 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]', TEXTO_SUAVE)}>
                            <Search className="size-[19px]" strokeWidth={1.9} aria-hidden="true" />
                        </span>
                        <p className={cn('text-[13.5px] leading-[18px] font-semibold', TEXTO_NAVY)} aria-live="polite">
                            {isSearching ? t('common.searching') : historySearch.trim() ? t('bulkSends.noSearchResults') : t('bulkSends.noBulkSends')}
                        </p>
                    </div>
                </div>
            ) : (
                <>
                    <div aria-hidden="true" className={cn('hidden h-9 items-center border-b bg-[#2e3f84]/[0.028] @5xl/hoja:grid dark:bg-white/[0.03]', COLUMNAS_HIST, 'pr-5 pl-16', FILETE)}>
                        {[t('bulkSends.colSend'), t('bulkSends.colStatus'), t('bulkSends.colProgress'), t('bulkSends.colResult'), t('bulkSends.colResponsible'), t('bulkSends.colDate')].map((h) => (
                            <span key={h} className={cn('truncate text-[11px] leading-4 font-semibold tracking-[0.07em] uppercase', TEXTO_SUAVE)}>
                                {h}
                            </span>
                        ))}
                        <span />
                    </div>
                    <ul aria-label={t('bulkSends.sendHistory')} className="rounded-b-2xl">
                        {visibleBulkSends.map((bs) => {
                            const progress = getProgress(bs);
                            const pending = Math.max(0, bs.total_recipients - bs.sent_count - bs.failed_count);
                            const hasMatches = bs.matching_recipients && bs.matching_recipients.length > 0;
                            const nombre = bs.name || t('bulkSends.unnamed');
                            const resultado = (
                                <span className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] leading-4 font-semibold whitespace-nowrap tabular-nums', TEXTO_NAVY)}>
                                    <span title={t('bulkSends.sent')} className="inline-flex items-center gap-[5px] text-emerald-700 dark:text-emerald-400">
                                        <Check className="size-[13px]" strokeWidth={2.5} aria-hidden="true" />
                                        <span className="sr-only">{t('bulkSends.sent')}</span>
                                        {miles(bs.sent_count, lng)}
                                    </span>
                                    <span title={t('bulkSends.failed')} className={cn('inline-flex items-center gap-[5px]', bs.failed_count ? 'text-red-700 dark:text-red-400' : TEXTO_SUAVE)}>
                                        <X className="size-[13px]" strokeWidth={2.5} aria-hidden="true" />
                                        <span className="sr-only">{t('bulkSends.failed')}</span>
                                        {miles(bs.failed_count, lng)}
                                    </span>
                                    <span title={t('bulkSends.pending')} className={cn('inline-flex items-center gap-[5px]', pending ? 'text-amber-700 dark:text-amber-400' : TEXTO_SUAVE)}>
                                        <Clock className="size-[13px]" strokeWidth={2.25} aria-hidden="true" />
                                        <span className="sr-only">{t('bulkSends.pending')}</span>
                                        {miles(pending, lng)}
                                    </span>
                                </span>
                            );
                            const progreso = (
                                <span className="flex min-w-0 flex-col gap-1.5">
                                    <span className={cn('flex justify-between gap-2 text-[12px] leading-4 font-medium tabular-nums', TEXTO_SUAVE)}>
                                        <span className={cn('font-semibold', TEXTO_NAVY)}>{progress} %</span>
                                        <span className="truncate">{t('bulkSends.totalCount', { total: miles(bs.total_recipients, lng) })}</span>
                                    </span>
                                    <Barra ok={bs.sent_count} mal={bs.failed_count} total={bs.total_recipients} />
                                </span>
                            );
                            return (
                                <li key={bs.id} className={cn('border-b last:border-b-0', FILETE)}>
                                    <button
                                        type="button"
                                        onClick={() => verDetalle(bs.id)}
                                        title={t('bulkSends.openDetail')}
                                        className={cn('block w-full cursor-pointer text-left transition-colors hover:bg-[#2e3f84]/[0.025] dark:hover:bg-white/[0.025]', FOCO, 'focus-visible:ring-inset')}
                                    >
                                        {/* Fila de escritorio */}
                                        <span className={cn('hidden min-h-[58px] items-center py-2 pr-5 pl-16 @5xl/hoja:grid', COLUMNAS_HIST)}>
                                            <span className="flex min-w-0 flex-col gap-0.5">
                                                <span className={cn('truncate text-[13.5px] leading-[18px] font-semibold', bs.name ? TEXTO_NAVY : TEXTO_SUAVE)} title={nombre}>
                                                    {nombre}
                                                </span>
                                                <span className={cn('truncate text-[12px] leading-4', MONO, TEXTO_SUAVE)} title={bs.template_name}>
                                                    {bs.template_name}
                                                </span>
                                            </span>
                                            <Estado status={bs.status} />
                                            {progreso}
                                            {resultado}
                                            <span className={cn('truncate text-[13px] leading-[18px]', TEXTO_NAVY)} title={bs.created_by_name}>
                                                {bs.created_by_name}
                                            </span>
                                            <span className={cn('text-[12.5px] leading-4 whitespace-nowrap tabular-nums', TEXTO_SUAVE)} title={bs.created_at}>
                                                {fechaHora(bs.created_at, lng)}
                                            </span>
                                            <ChevronRight className={cn('size-4', TEXTO_SUAVE)} strokeWidth={2} aria-hidden="true" />
                                        </span>
                                        {/* Tarjeta (hoja estrecha) */}
                                        <span className="flex flex-col gap-2.5 px-4 py-3.5 @5xl/hoja:hidden">
                                            <span className="flex items-start justify-between gap-3">
                                                <span className="flex min-w-0 flex-col gap-0.5">
                                                    <span className={cn('truncate text-[13.5px] leading-[18px] font-semibold', bs.name ? TEXTO_NAVY : TEXTO_SUAVE)}>{nombre}</span>
                                                    <span className={cn('truncate text-[12px] leading-4', MONO, TEXTO_SUAVE)}>{bs.template_name}</span>
                                                </span>
                                                <Estado status={bs.status} peq />
                                            </span>
                                            {progreso}
                                            <span className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
                                                {resultado}
                                                <span className={cn('text-[12px] leading-4 tabular-nums', TEXTO_SUAVE)}>
                                                    {bs.created_by_name} · {fechaHora(bs.created_at, lng)}
                                                </span>
                                            </span>
                                        </span>
                                    </button>
                                    {hasMatches && (
                                        <div className={cn('flex flex-col gap-2.5 bg-[#f7f8fb] pt-3 pb-4 dark:bg-white/[0.02]', SANGRIA)}>
                                            <p className={cn('flex items-center gap-[7px] text-[12.5px] leading-4 font-semibold', TEXTO_NAVY)}>
                                                <Eye className="size-3.5" strokeWidth={2} aria-hidden="true" />
                                                {t('bulkSends.recipientsFound', { count: bs.matching_recipients!.length })}
                                            </p>
                                            <div className="grid gap-2.5 @2xl/hoja:grid-cols-2 @5xl/hoja:grid-cols-3">
                                                {bs.matching_recipients!.map((recipient) => (
                                                    <button
                                                        key={recipient.id}
                                                        type="button"
                                                        onClick={() => router.visit(`/admin/bulk-sends/${bs.id}`)}
                                                        className={cn(
                                                            'flex min-w-0 cursor-pointer flex-col gap-1.5 rounded-[10px] bg-white px-3 py-2.5 text-left shadow-[inset_0_0_0_1px_rgba(46,63,132,0.12)] transition-shadow hover:shadow-[inset_0_0_0_1px_rgba(46,63,132,0.3)] dark:bg-white/[0.03] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]',
                                                            FOCO
                                                        )}
                                                    >
                                                        <span className="flex items-start justify-between gap-2">
                                                            <span className="flex min-w-0 flex-col gap-px">
                                                                <span className={cn('truncate text-[13px] leading-[18px] font-semibold', TEXTO_NAVY)}>{recipient.contact_name ? nombrePropio(recipient.contact_name) : t('bulkSends.unnamed')}</span>
                                                                <span className={cn('text-[12px] leading-4 tabular-nums', MONO, TEXTO_SUAVE)}>{recipient.phone_number}</span>
                                                            </span>
                                                            <Estado status={recipient.status} peq className="text-[12px]" />
                                                        </span>
                                                        {recipient.error ? (
                                                            <span className="line-clamp-2 text-[12px] leading-4 text-red-700 dark:text-red-400" title={recipient.error}>
                                                                {recipient.error}
                                                            </span>
                                                        ) : (
                                                            <span className={cn('truncate text-[12px] leading-4 tabular-nums', TEXTO_SUAVE)}>
                                                                {t('bulkSends.noErrorRecorded', { sentAt: recipient.sent_at ? fechaHora(recipient.sent_at, lng) : t('bulkSends.noSentDate') })}
                                                            </span>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}
        </section>
    );

    /* ── Pestaña Plantillas de Meta ── */
    const seccionPlantillas = (
        <section aria-labelledby="catalogo-plantillas">
            <Banda
                id="catalogo-plantillas"
                icon={MessageSquareText}
                titulo={t('bulkSends.templateCatalog')}
                cuenta={miles(allTemplates.length, lng)}
                texto={t('bulkSends.templateCatalogSubtitle')}
                className="rounded-t-2xl"
                acciones={
                    <>
                        <button type="button" onClick={handleSyncTemplates} disabled={isSyncing} className={BOTON_SECUNDARIO}>
                            <RefreshCw className={cn(isSyncing && 'animate-spin motion-reduce:animate-none')} strokeWidth={1.9} aria-hidden="true" />
                            {isSyncing ? t('bulkSends.syncing') : t('bulkSends.syncWithMeta')}
                        </button>
                        <button type="button" onClick={() => setShowCreateModal(true)} aria-haspopup="dialog" className={BOTON_PRIMARIO}>
                            <FilePlus2 strokeWidth={2} aria-hidden="true" />
                            {t('bulkSends.createTemplate')}
                        </button>
                    </>
                }
            />
            {allTemplates.length === 0 ? (
                <div className="px-4 py-8 @3xl/hoja:px-5">
                    <div className="flex flex-col items-center gap-2 rounded-xl border-[1.5px] border-dashed border-[#2e3f84]/26 bg-[#2e3f84]/[0.035] px-5 py-7 text-center dark:border-white/20 dark:bg-white/[0.03]">
                        <span className={cn('flex size-10 items-center justify-center rounded-xl bg-white shadow-[inset_0_0_0_1px_rgba(46,63,132,0.12)] dark:bg-white/5 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]', TEXTO_SUAVE)}>
                            <MessageSquareText className="size-[19px]" strokeWidth={1.9} aria-hidden="true" />
                        </span>
                        <p className={cn('text-[13.5px] leading-[18px] font-semibold', TEXTO_NAVY)}>{t('bulkSends.noRegisteredTemplates')}</p>
                        <p className={cn('text-[12.5px] leading-[18px]', TEXTO_SUAVE)}>{t('bulkSends.noRegisteredTemplatesHelp')}</p>
                    </div>
                </div>
            ) : (
                <>
                    <div aria-hidden="true" className={cn('hidden h-9 items-center border-b bg-[#2e3f84]/[0.028] @5xl/hoja:grid dark:bg-white/[0.03]', COLUMNAS_TPL, 'pr-5 pl-16', FILETE)}>
                        {[t('bulkSends.colTemplate'), t('bulkSends.colCategory'), t('bulkSends.colLanguage'), t('bulkSends.colMetaStatus'), t('bulkSends.colPreview'), t('bulkSends.colCreated')].map((h) => (
                            <span key={h} className={cn('truncate text-[11px] leading-4 font-semibold tracking-[0.07em] uppercase', TEXTO_SUAVE)}>
                                {h}
                            </span>
                        ))}
                        <span />
                    </div>
                    <ul aria-label={t('bulkSends.templateCatalog')}>
                        {allTemplates.map((tpl) => {
                            const [IconoCat, claveCat] = CATEGORIAS[tpl.category] ?? [MessageSquareText, ''];
                            const categoriaTxt = claveCat ? t(claveCat) : tpl.category;
                            const borrar = (
                                <button
                                    type="button"
                                    onClick={() => handleDeleteTemplate(tpl.id, tpl.name)}
                                    aria-haspopup="dialog"
                                    aria-label={t('bulkSends.deleteTemplateAria', { name: tpl.name })}
                                    title={t('bulkSends.deleteTemplateHint')}
                                    className={cn(BOTON_ICONO, 'hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-500/10 dark:hover:text-red-400')}
                                >
                                    <Trash2 className="size-4" strokeWidth={2} aria-hidden="true" />
                                </button>
                            );
                            return (
                                <li key={tpl.id} className={cn('border-b last:rounded-b-2xl last:border-b-0', FILETE)}>
                                    <div className={cn('hidden min-h-[54px] items-center py-2 pr-5 pl-16 @5xl/hoja:grid', COLUMNAS_TPL)}>
                                        <div className="flex min-w-0 flex-col gap-0.5">
                                            <span className={cn('truncate text-[13.5px] leading-[18px] font-semibold', TEXTO_NAVY)} title={tpl.name}>
                                                {tpl.name}
                                            </span>
                                            <span className={cn('truncate text-[12px] leading-4', MONO, TEXTO_SUAVE)}>{tpl.meta_template_name}</span>
                                        </div>
                                        <span className={cn('inline-flex min-w-0 items-center gap-1.5 text-[12.5px] leading-4 font-medium whitespace-nowrap', TEXTO_NAVY)}>
                                            <IconoCat className={cn('size-3.5 shrink-0', TEXTO_SUAVE)} strokeWidth={1.9} aria-hidden="true" />
                                            {categoriaTxt}
                                        </span>
                                        <span className={cn('inline-flex items-center gap-1.5 text-[12.5px] leading-4 font-medium whitespace-nowrap', TEXTO_NAVY)} title={idiomaTexto(tpl.language)}>
                                            <Globe className={cn('size-3.5 shrink-0', TEXTO_SUAVE)} strokeWidth={1.9} aria-hidden="true" />
                                            {tpl.language}
                                        </span>
                                        <Estado status={tpl.status} tipo="plantilla" peq />
                                        <span className={cn('truncate text-[12.5px] leading-4', TEXTO_SUAVE)} title={tpl.preview_text || undefined}>
                                            {tpl.preview_text || '—'}
                                        </span>
                                        <span className={cn('text-[12.5px] leading-4 whitespace-nowrap tabular-nums', TEXTO_SUAVE)} title={tpl.created_at || undefined}>
                                            {tpl.created_at ? fechaHora(tpl.created_at.slice(0, 10), lng) : '—'}
                                        </span>
                                        {borrar}
                                    </div>
                                    <div className="flex items-start gap-3 px-4 py-3.5 @5xl/hoja:hidden">
                                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                                            <span className="flex min-w-0 flex-col gap-0.5">
                                                <span className={cn('truncate text-[13.5px] leading-[18px] font-semibold', TEXTO_NAVY)}>{tpl.name}</span>
                                                <span className={cn('truncate text-[12px] leading-4', MONO, TEXTO_SUAVE)}>{tpl.meta_template_name}</span>
                                            </span>
                                            <span className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] leading-4', TEXTO_SUAVE)}>
                                                <Estado status={tpl.status} tipo="plantilla" peq />
                                                <span className="inline-flex items-center gap-1">
                                                    <IconoCat className="size-3" strokeWidth={1.9} aria-hidden="true" />
                                                    {categoriaTxt}
                                                </span>
                                                <span>{tpl.language}</span>
                                                {tpl.created_at && <span className="tabular-nums">{fechaHora(tpl.created_at.slice(0, 10), lng)}</span>}
                                            </span>
                                            {tpl.preview_text && <span className={cn('line-clamp-2 text-[12px] leading-4', TEXTO_SUAVE)}>{tpl.preview_text}</span>}
                                        </div>
                                        {borrar}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}
        </section>
    );

    const cifrasEnvio = [
        <Cifra
            key="c"
            marca={<Send className={cn('size-3.5 shrink-0', TEXTO_NAVY)} strokeWidth={2} aria-hidden="true" />}
            etiqueta={t('bulkSends.metricCampaigns')}
            valor={miles(sendMetrics.totalSends, lng)}
            detalle={<span className="truncate">{t('bulkSends.metricCampaignsDetail', { completed: miles(sendMetrics.completedSends, lng), processing: miles(sendMetrics.processingSends, lng) })}</span>}
        />,
        <Cifra
            key="d"
            marca={<Phone className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={2} aria-hidden="true" />}
            etiqueta={t('bulkSends.metricRecipients')}
            valor={miles(sendMetrics.totalRecipients, lng)}
            detalle={<span className="truncate">{t('bulkSends.metricRecipientsDetail', { sent: miles(sendMetrics.sentRecipients, lng), pending: miles(sendMetrics.pendingRecipients, lng) })}</span>}
        />,
        <Cifra
            key="e"
            marca={<CircleAlert className="size-3.5 shrink-0 text-red-600 dark:text-red-400" strokeWidth={2} aria-hidden="true" />}
            etiqueta={t('bulkSends.metricErrors')}
            valor={miles(sendMetrics.failedRecipients, lng)}
            detalle={<span className="truncate">{t('bulkSends.metricErrorsDetail', { count: sendMetrics.blockedSends })}</span>}
        />,
        <Cifra
            key="p"
            marca={<MessageSquareText className="size-3.5 shrink-0 text-sky-600 dark:text-sky-400" strokeWidth={2} aria-hidden="true" />}
            etiqueta={t('bulkSends.metricUsableTemplates')}
            valor={miles(templateMetrics.usable, lng)}
            detalle={
                <>
                    {templateMetrics.pending > 0 && <span className="size-[7px] shrink-0 rounded-full bg-amber-600 dark:bg-amber-400" aria-hidden="true" />}
                    <span className="truncate">
                        <Trans
                            i18nKey="bulkSends.metricUsableTemplatesDetail"
                            values={{ pending: templateMetrics.pending, rejected: templateMetrics.rejected }}
                            components={{ warn: <span className={templateMetrics.pending > 0 ? 'font-medium text-amber-700 dark:text-amber-400' : undefined} /> }}
                        />
                    </span>
                </>
            }
        />,
    ];
    const cifrasPlantillas = [
        <Cifra
            key="r"
            marca={<MessageSquareText className={cn('size-3.5 shrink-0', TEXTO_NAVY)} strokeWidth={2} aria-hidden="true" />}
            etiqueta={t('bulkSends.tplRegistered')}
            valor={miles(allTemplates.length, lng)}
            detalle={<span className="truncate">{t('bulkSends.tplRegisteredDetail', { rejected: templateMetrics.rejected, paused: templateMetrics.paused, disabled: templateMetrics.disabled })}</span>}
        />,
        <Cifra
            key="a"
            marca={<CircleCheck className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={2} aria-hidden="true" />}
            etiqueta={t('bulkSends.tplApproved')}
            valor={miles(templateMetrics.approved, lng)}
            detalle={<span className="truncate">{t('bulkSends.tplApprovedDetail')}</span>}
        />,
        <Cifra
            key="v"
            marca={<Clock className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" strokeWidth={2} aria-hidden="true" />}
            etiqueta={t('bulkSends.tplUnderReview')}
            valor={miles(templateMetrics.pending, lng)}
            detalle={
                templateMetrics.pending > 0 ? (
                    <>
                        <span className="size-[7px] shrink-0 rounded-full bg-amber-600 dark:bg-amber-400" aria-hidden="true" />
                        <span className="truncate font-medium text-amber-700 dark:text-amber-400">{t('bulkSends.tplUnderReviewDetail')}</span>
                    </>
                ) : (
                    <span className="truncate">{t('bulkSends.tplUnderReviewDetail')}</span>
                )
            }
        />,
        <Cifra
            key="u"
            marca={<Send className="size-3.5 shrink-0 text-sky-600 dark:text-sky-400" strokeWidth={2} aria-hidden="true" />}
            etiqueta={t('bulkSends.tplUsableInSend')}
            valor={miles(templateMetrics.usable, lng)}
            detalle={<span className="truncate">{t('bulkSends.tplUsableDetail')}</span>}
        />,
    ];

    const pestanas = [
        { value: 'send' as const, label: t('bulkSends.tabSend'), icon: Send },
        { value: 'templates' as const, label: t('bulkSends.tabTemplates'), icon: MessageSquareText, count: allTemplates.length },
    ];

    return (
        <AdminLayout>
            <Head title={t('bulkSends.pageTitle')} />

            <div className="min-h-screen bg-background px-4 pt-5 pb-8 md:px-7 md:pt-7">
                <div className="@container/pagina mx-auto flex max-w-7xl flex-col gap-6">
                    {/* ── Cabecera: título + pestañas ── */}
                    <header className="flex min-w-0 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-x-[18px] gap-y-2">
                            <h1 className={H1}>{t('bulkSends.heading')}</h1>
                            <div role="tablist" aria-label={t('bulkSends.tabsLabel')} className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-[11px] bg-[#2e3f84]/[0.055] p-[3px] dark:bg-white/5">
                                {pestanas.map((p) => {
                                    const on = activeTab === p.value;
                                    return (
                                        <button
                                            key={p.value}
                                            type="button"
                                            role="tab"
                                            id={`pestana-${p.value}`}
                                            aria-selected={on}
                                            aria-controls={`panel-${p.value}`}
                                            onClick={() => setActiveTab(p.value)}
                                            className={cn(
                                                'flex h-[30px] shrink-0 cursor-pointer items-center gap-[7px] rounded-lg px-3 text-[13px] leading-4 font-semibold whitespace-nowrap transition-colors',
                                                FOCO,
                                                on
                                                    ? 'bg-white text-[#2e3f84] shadow-[0_0_0_1px_rgba(46,63,132,0.08),0_1px_2px_rgba(46,63,132,0.12),0_2px_6px_-2px_rgba(46,63,132,0.12)] dark:bg-white/12 dark:text-neutral-100 dark:shadow-none'
                                                    : cn(TEXTO_SUAVE, 'hover:text-[#2e3f84] dark:hover:text-neutral-100')
                                            )}
                                        >
                                            {p.label}
                                            {p.count !== undefined && <span className={cn('text-[12px] font-semibold tabular-nums', TEXTO_SUAVE)}>{miles(p.count, lng)}</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <p className="text-[14px] leading-5 text-muted-foreground dark:text-neutral-400">{t('bulkSends.headingSubtitle')}</p>
                    </header>

                    {/* ── Franja de cifras: cambia con la pestaña ── */}
                    <Franja
                        etiqueta={activeTab === 'send' ? t('bulkSends.summaryLabel') : t('bulkSends.templatesSummaryLabel')}
                        cifras={activeTab === 'send' ? cifrasEnvio : cifrasPlantillas}
                    />

                    {/* ── Avisos de resultado (éxito y error de cualquier acción), arriba de la hoja ── */}
                    {((error && !errorNumero) || success) && (
                        <div className="-mb-2 flex flex-col gap-2" aria-live="polite">
                            {error && !errorNumero && <AvisoAccion tipo="error" texto={error} onCerrar={() => setError('')} />}
                            {success && <AvisoAccion tipo="ok" texto={success} onCerrar={() => setSuccess('')} />}
                        </div>
                    )}

                    {activeTab === 'send' && (
                        <div id="panel-send" role="tabpanel" aria-labelledby="pestana-send" className={HOJA}>
                            {/* Mientras sale un envío el formulario se oculta (solo puede haber uno a la vez). */}
                            {isProcessing ? seccionEnCurso : seccionPreparar}
                            {seccionHistorial}
                        </div>
                    )}

                    {activeTab === 'templates' && (
                        <div id="panel-templates" role="tabpanel" aria-labelledby="pestana-templates" className={HOJA}>
                            {seccionPlantillas}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Detener el envío en curso: la MISMA llamada de siempre, solo tras "Sí, detener el envío" ── */}
            <ConfirmarDetener
                abierto={confirmarDetener && !!activeProgress}
                onSeguir={() => setConfirmarDetener(false)}
                onDetener={() => {
                    setConfirmarDetener(false);
                    if (activeProgress) handleCancel(activeProgress.id);
                }}
                pendientes={activeProgress?.pending}
                procesados={activeProgress ? activeProgress.sent + activeProgress.failed : null}
            />

            {/* ── Confirmación de envío: obliga a ver el mensaje final antes de disparar ── */}
            <Dialogo
                abierto={showConfirmSend && !!selectedTemplate}
                onCerrar={() => setShowConfirmSend(false)}
                icono={Send}
                titulo={t('bulkSends.confirmBulkSend')}
                cerrarConX
                ancho="max-w-[620px]"
                enfoqueInicial={seguroEnvio}
                pie={
                    <>
                        <DialogPrimitive.Close asChild>
                            <button ref={seguroEnvio} type="button" className={BOTON_SECUNDARIO}>
                                <X strokeWidth={1.9} aria-hidden="true" />
                                {t('common.cancel')}
                            </button>
                        </DialogPrimitive.Close>
                        <button type="button" onClick={executeSend} disabled={!confirmChecked || isSending} title={!confirmChecked ? t('bulkSends.confirmNeedsCheck') : undefined} className={BOTON_PRIMARIO}>
                            {isSending ? (
                                <>
                                    <LoaderCircle className="animate-spin motion-reduce:animate-none" strokeWidth={2} aria-hidden="true" />
                                    {t('bulkSends.sending')}
                                </>
                            ) : (
                                <>
                                    <Send strokeWidth={2} aria-hidden="true" />
                                    {t('bulkSends.confirmAndSend', { value: miles(recipients.length, lng) })}
                                </>
                            )}
                        </button>
                    </>
                }
            >
                {selectedTemplate && (
                    <>
                        <div className="flex flex-wrap gap-2">
                            <span className={cn('inline-flex h-7 items-center gap-[7px] rounded-lg bg-[#2e3f84]/6 pr-[11px] pl-[9px] text-[13px] leading-[18px] font-semibold tabular-nums dark:bg-white/8', TEXTO_NAVY)}>
                                <Phone className="size-3.5" strokeWidth={2} aria-hidden="true" />
                                {t('bulkSends.recipientsCount', { value: miles(recipients.length, lng) })}
                            </span>
                            <span className={cn('inline-flex h-7 max-w-full items-center gap-[7px] rounded-lg bg-[#2e3f84]/6 pr-[11px] pl-[9px] text-[13px] leading-[18px] font-semibold dark:bg-white/8', TEXTO_NAVY)}>
                                <MessageSquareText className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                                <span className="truncate">{selectedTemplate.name}</span>
                            </span>
                        </div>
                        <div className="flex flex-col gap-2">
                            <span className={cn('text-[12.5px] leading-4 font-medium', TEXTO_SUAVE)}>
                                <Trans
                                    i18nKey="bulkSends.previewToRecipient"
                                    values={{ recipient: destinatarioVista }}
                                    components={{ strong: <span className={cn('font-semibold', TEXTO_NAVY)} /> }}
                                />
                            </span>
                            <Burbuja>
                                {medioAdjunto(selectedTemplate.header_format)}
                                {vistaPrevia}
                            </Burbuja>
                        </div>
                        {validationIssues.errors.length > 0 && (
                            <Nota tipo="mal" titulo={t('bulkSends.possibleCrossedData')}>
                                {validationIssues.errors.map((msg, i) => (
                                    <span key={i}>{msg}</span>
                                ))}
                            </Nota>
                        )}
                        {validationIssues.warnings.length > 0 && (
                            <Nota tipo="aviso">
                                {validationIssues.warnings.map((msg, i) => (
                                    <span key={i}>{msg}</span>
                                ))}
                            </Nota>
                        )}
                        <label className="flex cursor-pointer items-start gap-[11px] rounded-[10px] bg-[#2e3f84]/[0.035] px-3.5 py-3 shadow-[inset_0_0_0_1px_rgba(46,63,132,0.12)] select-none has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-[#2e3f84]/40 dark:bg-white/[0.03] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]">
                            <input
                                type="checkbox"
                                checked={confirmChecked}
                                onChange={(e) => setConfirmChecked(e.target.checked)}
                                className="mt-px size-[18px] shrink-0 cursor-pointer accent-[#2e3f84] dark:accent-[#8b9ae0]"
                            />
                            <span className={cn('text-[13.5px] leading-5', TEXTO_NAVY)}>
                                <Trans i18nKey="bulkSends.confirmCheckboxText" components={{ strong: <strong className="font-semibold" /> }} />
                            </span>
                        </label>
                    </>
                )}
            </Dialogo>

            {/* ── Eliminar una plantilla de META: es permanente y deja de poder usarse en los envíos ── */}
            <Dialogo
                abierto={!!templateToDelete}
                onCerrar={() => setTemplateToDelete(null)}
                icono={Trash2}
                peligro
                titulo={t('bulkSends.deleteTemplateTitle', 'Eliminar plantilla de WhatsApp')}
                ancho="max-w-[400px]"
                enfoqueInicial={seguroBorrar}
                descripcion={<p>{t('bulkSends.deleteTemplateIrreversible', 'Se eliminará de Meta y no podrá usarse en los envíos. Esta acción no se puede deshacer.')}</p>}
                pie={
                    <>
                        <DialogPrimitive.Close asChild>
                            <button ref={seguroBorrar} type="button" className={BOTON_SECUNDARIO}>
                                <X strokeWidth={1.9} aria-hidden="true" />
                                {t('common.cancel')}
                            </button>
                        </DialogPrimitive.Close>
                        <button type="button" onClick={confirmDeleteTemplate} className={BOTON_PELIGRO_LLENO}>
                            <Trash2 strokeWidth={2} aria-hidden="true" />
                            {t('bulkSends.deleteTemplateYes')}
                        </button>
                    </>
                }
            >
                {templateToDelete && (
                    <>
                        <div className="flex flex-col gap-0.5 rounded-[10px] bg-[#2e3f84]/[0.04] px-3 py-2.5 shadow-[inset_0_0_0_1px_rgba(46,63,132,0.1)] dark:bg-white/[0.04] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]">
                            <span className={cn('truncate text-[13.5px] leading-[18px] font-semibold', TEXTO_NAVY)}>{templateToDelete.name}</span>
                            {plantillaABorrar && <span className={cn('truncate text-[12px] leading-4', MONO, TEXTO_SUAVE)}>{plantillaABorrar.meta_template_name}</span>}
                        </div>
                        <Nota tipo="aviso">
                            <span>{t('bulkSends.deleteTemplateWarning', 'Si vuelves a necesitarla tendrás que crearla de nuevo y esperar la aprobación de Meta.')}</span>
                        </Nota>
                    </>
                )}
            </Dialogo>

            {/* ── Crear plantilla en Meta: el formulario de siempre, con la vista previa al lado ── */}
            <Dialogo
                abierto={showCreateModal}
                onCerrar={() => setShowCreateModal(false)}
                icono={FilePlus2}
                titulo={t('bulkSends.createWhatsappTemplate')}
                cerrarConX
                bloquearFuera
                ancho="max-w-[760px]"
                pie={
                    <>
                        <DialogPrimitive.Close asChild>
                            <button type="button" className={BOTON_SECUNDARIO}>
                                <X strokeWidth={1.9} aria-hidden="true" />
                                {t('common.cancel')}
                            </button>
                        </DialogPrimitive.Close>
                        <button
                            type="button"
                            onClick={handleCreateTemplate}
                            disabled={isCreatingTemplate || !newTplName || !newTplBody || !newTplDisplayName}
                            className={BOTON_PRIMARIO}
                        >
                            {isCreatingTemplate ? (
                                <>
                                    <LoaderCircle className="animate-spin motion-reduce:animate-none" strokeWidth={2} aria-hidden="true" />
                                    {t('bulkSends.sendingToMeta')}
                                </>
                            ) : (
                                <>
                                    <Send strokeWidth={2} aria-hidden="true" />
                                    {t('bulkSends.sendForReview')}
                                </>
                            )}
                        </button>
                    </>
                }
            >
                <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-[minmax(0,1fr)_272px] md:items-start">
                    <div className="flex min-w-0 flex-col gap-3.5">
                        <div className="flex flex-col gap-[7px]">
                            <label htmlFor="tpl-display-name" className={ETIQUETA}>
                                {t('bulkSends.displayNameLabel')}
                            </label>
                            <input
                                id="tpl-display-name"
                                type="text"
                                value={newTplDisplayName}
                                onChange={(e) => handleDisplayNameChange(e.target.value)}
                                placeholder={t('bulkSends.displayNamePlaceholder')}
                                aria-describedby="tpl-display-name-help"
                                className={CAMPO}
                            />
                            <span id="tpl-display-name-help" className={AYUDA}>
                                {t('bulkSends.displayNameHelp')}
                            </span>
                        </div>
                        <div className="flex flex-col gap-[7px]">
                            <label htmlFor="tpl-technical-name" className={ETIQUETA}>
                                {t('bulkSends.technicalNameLabel')}
                            </label>
                            <input
                                id="tpl-technical-name"
                                type="text"
                                value={newTplName}
                                onChange={(e) => setNewTplName(e.target.value.replace(/[^a-z0-9_]/g, ''))}
                                placeholder="recordatorio_cita_medica"
                                aria-describedby="tpl-technical-name-help"
                                className={cn(CAMPO, MONO, 'text-[12.5px] placeholder:font-sans')}
                            />
                            <span id="tpl-technical-name-help" className={AYUDA}>
                                {t('bulkSends.technicalNameHelp')}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                            <div className="flex min-w-0 flex-col gap-[7px]">
                                <span id="etq-tpl-categoria" className={ETIQUETA}>
                                    {t('bulkSends.categoryLabel')}
                                </span>
                                <Select value={newTplCategory} onValueChange={(v) => setNewTplCategory(v as 'MARKETING' | 'UTILITY' | 'AUTHENTICATION')}>
                                    <SelectTrigger aria-labelledby="etq-tpl-categoria" className={DISPARADOR}>
                                        <div className="flex min-w-0 flex-1 items-center gap-2 truncate text-left">
                                            <SelectValue />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent className={MENU}>
                                        {(['UTILITY', 'MARKETING', 'AUTHENTICATION'] as const).map((c) => {
                                            const [IconoCat, clave] = CATEGORIAS[c];
                                            return (
                                                <SelectItem key={c} value={c} className={OPCION}>
                                                    <IconoCat className="size-[15px]" strokeWidth={1.75} aria-hidden="true" />
                                                    {t(clave)}
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex min-w-0 flex-col gap-[7px]">
                                <span id="etq-tpl-idioma" className={ETIQUETA}>
                                    {t('bulkSends.languageLabel')}
                                </span>
                                <Select value={newTplLanguage} onValueChange={(v) => setNewTplLanguage(v)}>
                                    <SelectTrigger aria-labelledby="etq-tpl-idioma" className={DISPARADOR}>
                                        <div className="flex min-w-0 flex-1 items-center gap-2 truncate text-left">
                                            <Globe className="size-[15px] shrink-0 text-muted-foreground dark:text-neutral-400" strokeWidth={1.75} aria-hidden="true" />
                                            <SelectValue />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent className={MENU}>
                                        {Object.entries(IDIOMAS).map(([codigo, clave]) => (
                                            <SelectItem key={codigo} value={codigo} className={OPCION}>
                                                {t(clave)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="flex flex-col gap-[7px]">
                            <span id="etq-tpl-encabezado" className={ETIQUETA}>
                                <Trans i18nKey="bulkSends.headerLabel" components={{ opt: <span className={cn('font-normal', TEXTO_SUAVE)} /> }} />
                            </span>
                            <Select
                                value={newTplHeaderFormat}
                                onValueChange={(v) => {
                                    setNewTplHeaderFormat(v as 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT');
                                    setNewTplHeader('');
                                    setNewTplHeaderMediaUrl('');
                                }}
                            >
                                <SelectTrigger aria-labelledby="etq-tpl-encabezado" className={DISPARADOR}>
                                    <div className="flex min-w-0 flex-1 items-center gap-2 truncate text-left">
                                        <SelectValue />
                                    </div>
                                </SelectTrigger>
                                <SelectContent className={MENU}>
                                    {(
                                        [
                                            ['NONE', 'bulkSends.headerNone', CircleSlash],
                                            ['TEXT', 'bulkSends.headerText', Type],
                                            ['IMAGE', 'bulkSends.headerImage', Image],
                                            ['VIDEO', 'bulkSends.headerVideo', Video],
                                            ['DOCUMENT', 'bulkSends.headerDocument', FileText],
                                        ] as const
                                    ).map(([valor, clave, IconoEnc]) => (
                                        <SelectItem key={valor} value={valor} className={OPCION}>
                                            <IconoEnc className="size-[15px]" strokeWidth={1.75} aria-hidden="true" />
                                            {t(clave)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {newTplHeaderFormat === 'NONE' && <span className={AYUDA}>{t('bulkSends.headerHelp')}</span>}
                            {newTplHeaderFormat === 'TEXT' && (
                                <input
                                    type="text"
                                    value={newTplHeader}
                                    onChange={(e) => setNewTplHeader(e.target.value)}
                                    placeholder={t('bulkSends.headerTextPlaceholder')}
                                    aria-label={t('bulkSends.headerText')}
                                    maxLength={60}
                                    className={CAMPO}
                                />
                            )}
                            {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(newTplHeaderFormat) && (
                                <>
                                    <input
                                        type="url"
                                        value={newTplHeaderMediaUrl}
                                        onChange={(e) => setNewTplHeaderMediaUrl(e.target.value)}
                                        aria-label={
                                            newTplHeaderFormat === 'IMAGE' ? t('bulkSends.headerImage') : newTplHeaderFormat === 'VIDEO' ? t('bulkSends.headerVideo') : t('bulkSends.headerDocument')
                                        }
                                        placeholder={
                                            newTplHeaderFormat === 'IMAGE' ? t('bulkSends.imageUrlPlaceholder') :
                                            newTplHeaderFormat === 'VIDEO' ? t('bulkSends.videoUrlPlaceholder') :
                                            t('bulkSends.documentUrlPlaceholder')
                                        }
                                        className={CAMPO}
                                    />
                                    <span className={AYUDA}>
                                        {newTplHeaderFormat === 'IMAGE' && t('bulkSends.imageFormatHelp')}
                                        {newTplHeaderFormat === 'VIDEO' && t('bulkSends.videoFormatHelp')}
                                        {newTplHeaderFormat === 'DOCUMENT' && t('bulkSends.documentFormatHelp')}
                                    </span>
                                </>
                            )}
                        </div>
                        <div className="flex flex-col gap-[7px]">
                            <label htmlFor="tpl-body" className={ETIQUETA}>
                                {t('bulkSends.bodyLabel')}
                            </label>
                            <textarea
                                id="tpl-body"
                                value={newTplBody}
                                onChange={(e) => setNewTplBody(e.target.value)}
                                placeholder={t('bulkSends.bodyPlaceholder')}
                                maxLength={1024}
                                rows={5}
                                aria-describedby="tpl-body-help"
                                className={cn(CAMPO, 'h-auto min-h-[112px] resize-y py-2.5 leading-5')}
                            />
                            <div id="tpl-body-help" className={cn('flex justify-between gap-3 tabular-nums', AYUDA)}>
                                <span>{t('bulkSends.bodyHelp')}</span>
                                <span className="shrink-0">{newTplBody.length}/1024</span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-[7px]">
                            <label htmlFor="tpl-footer" className={ETIQUETA}>
                                <Trans i18nKey="bulkSends.footerLabel" components={{ opt: <span className={cn('font-normal', TEXTO_SUAVE)} /> }} />
                            </label>
                            <input
                                id="tpl-footer"
                                type="text"
                                value={newTplFooter}
                                onChange={(e) => setNewTplFooter(e.target.value)}
                                placeholder={t('bulkSends.footerPlaceholder')}
                                maxLength={60}
                                className={CAMPO}
                            />
                        </div>
                    </div>

                    <div className="flex min-w-0 flex-col gap-2.5 md:sticky md:top-0">
                        <Rotulo as="h3" titulo={t('bulkSends.preview')} />
                        <Burbuja>
                            {newTplBody ? (
                                <div className="flex flex-col gap-1.5">
                                    {newTplHeaderFormat === 'TEXT' && newTplHeader && <p className="font-bold">{newTplHeader}</p>}
                                    {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(newTplHeaderFormat) && (
                                        <span className="flex flex-col items-center justify-center gap-1 rounded-lg bg-black/5 px-3 py-5 text-[12px] leading-4 text-slate-600 dark:bg-white/8 dark:text-neutral-300">
                                            {newTplHeaderFormat === 'IMAGE' && <Image className="size-7" strokeWidth={1.5} aria-hidden="true" />}
                                            {newTplHeaderFormat === 'VIDEO' && <Video className="size-7" strokeWidth={1.5} aria-hidden="true" />}
                                            {newTplHeaderFormat === 'DOCUMENT' && <FileText className="size-7" strokeWidth={1.5} aria-hidden="true" />}
                                            {newTplHeaderFormat === 'IMAGE' ? t('bulkSends.headerImage') : newTplHeaderFormat === 'VIDEO' ? t('bulkSends.headerVideo') : t('bulkSends.headerDocument')}
                                        </span>
                                    )}
                                    <p className="whitespace-pre-wrap">{newTplBody}</p>
                                    {newTplFooter && <p className="text-[12px] leading-4 text-[#54656f] dark:text-[#8696a0]">{newTplFooter}</p>}
                                </div>
                            ) : (
                                <p className="text-slate-600 dark:text-neutral-300">{t('bulkSends.previewEmptyBody')}</p>
                            )}
                        </Burbuja>
                        <Nota tipo="info">
                            <span>
                                <Trans i18nKey="bulkSends.createTemplateNote" components={{ b: <strong className="font-semibold" /> }} />
                            </span>
                        </Nota>
                    </div>
                </div>
            </Dialogo>
        </AdminLayout>
    );
}

