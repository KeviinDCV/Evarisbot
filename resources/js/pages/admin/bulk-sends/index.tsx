import AdminLayout from '@/layouts/admin-layout';
import { Head, router } from '@inertiajs/react';
import { Upload, FileSpreadsheet, Send, X, AlertCircle, AlertTriangle, CheckCircle2, XCircle, Clock, Trash2, StopCircle, Plus, Phone, ChevronDown, MessageSquareText, Eye, Search, Loader2, RefreshCw, FilePlus2, Shield, Megaphone, Key, Globe, Image, Video, FileText, ArrowRight, Columns3, type LucideIcon } from 'lucide-react';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

interface MetricCardProps {
    icon: LucideIcon;
    label: string;
    value: string | number;
    detail: string;
    tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
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

const toneClasses: Record<NonNullable<MetricCardProps['tone']>, string> = {
    primary: 'border-[#d4d8e8] bg-[#2e3f84]/10 text-[#2e3f84] dark:border-white/10 dark:bg-white/[0.05] dark:text-neutral-100',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
    warning: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300',
    danger: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300',
    info: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300',
};

function MetricCard({ icon: Icon, label, value, detail, tone = 'primary' }: MetricCardProps) {
    return (
        <div className="card-gradient rounded-2xl p-4 shadow-sm shadow-[#2e3f84]/5">
            <div className="flex items-center gap-3">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${toneClasses[tone]}`}>
                    <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold settings-subtitle">{label}</p>
                    <p className="mt-1 truncate text-lg font-bold leading-tight settings-title">{value}</p>
                    <p className="mt-0.5 truncate text-xs settings-subtitle">{detail}</p>
                </div>
            </div>
        </div>
    );
}

export default function BulkSendsIndex({ bulkSends, activeProgress: initialProgress, whatsappTemplates, allTemplates }: BulkSendsProps) {
    const { t } = useTranslation();
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

        return { approved, pending, rejected, usable: whatsappTemplates.length };
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

    const statusLabel = (status: string) => {
        const labels: Record<string, { text: string; color: string }> = {
            draft: { text: t('bulkSends.statusDraft'), color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
            processing: { text: t('bulkSends.statusProcessing'), color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
            completed: { text: t('bulkSends.statusCompleted'), color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
            sent: { text: t('bulkSends.statusSent'), color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
            failed: { text: t('bulkSends.statusFailed'), color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
            cancelled: { text: t('bulkSends.statusCancelled'), color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
            pending: { text: t('bulkSends.statusPending'), color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
        };
        return labels[status] || { text: status, color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' };
    };

    const templateStatusLabel = (status: string) => {
        const labels: Record<string, { text: string; color: string; icon: string }> = {
            APPROVED: { text: t('bulkSends.tplStatusApproved'), color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: '✓' },
            PENDING: { text: t('bulkSends.tplStatusPending'), color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: '⏳' },
            REJECTED: { text: t('bulkSends.tplStatusRejected'), color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: '✗' },
            PAUSED: { text: t('bulkSends.tplStatusPaused'), color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', icon: '⏸' },
            DISABLED: { text: t('bulkSends.tplStatusDisabled'), color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300', icon: '⊘' },
        };
        return labels[status] || { text: status, color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300', icon: '?' };
    };

    const categoryLabel = (cat: string) => {
        const labels: Record<string, { text: string; icon: React.ReactNode }> = {
            MARKETING: { text: t('bulkSends.categoryMarketing'), icon: <Megaphone className="w-3.5 h-3.5" /> },
            UTILITY: { text: t('bulkSends.categoryUtility'), icon: <Shield className="w-3.5 h-3.5" /> },
            AUTHENTICATION: { text: t('bulkSends.categoryAuthentication'), icon: <Key className="w-3.5 h-3.5" /> },
        };
        return labels[cat] || { text: cat, icon: null };
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

    return (
        <AdminLayout>
            <Head title={t('bulkSends.pageTitle')} />

            <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
                <div className="mx-auto flex max-w-7xl flex-col gap-5">
                    <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start gap-3">
                            <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-[#2e3f84] shadow-sm shadow-[#2e3f84]/5 dark:bg-white/[0.04] dark:text-neutral-100">
                                <Send className="h-5 w-5" />
                            </div>
                            <div>
                                <h1 className="font-bold settings-title" style={{ fontSize: 'var(--text-3xl)' }}>
                                    {t('bulkSends.heading')}
                                </h1>
                                <p className="settings-subtitle" style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-xs)' }}>
                                    {t('bulkSends.headingSubtitle')}
                                </p>
                            </div>
                        </div>

                        <div className="flex w-full gap-1 rounded-xl bg-white/70 p-1 dark:bg-white/[0.04] sm:w-fit">
                            <button
                                onClick={() => setActiveTab('send')}
                                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 sm:flex-none ${
                                    activeTab === 'send'
                                        ? 'bg-[#2e3f84] text-white shadow-sm shadow-[#2e3f84]/20'
                                        : 'settings-subtitle hover:bg-[#eef1f8] hover:text-[#2e3f84] dark:hover:bg-white/10 dark:hover:text-neutral-100'
                                }`}
                            >
                                <Send className="h-4 w-4" />
                                {t('bulkSends.tabSend')}
                            </button>
                            <button
                                onClick={() => setActiveTab('templates')}
                                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 sm:flex-none ${
                                    activeTab === 'templates'
                                        ? 'bg-[#2e3f84] text-white shadow-sm shadow-[#2e3f84]/20'
                                        : 'settings-subtitle hover:bg-[#eef1f8] hover:text-[#2e3f84] dark:hover:bg-white/10 dark:hover:text-neutral-100'
                                }`}
                            >
                                <MessageSquareText className="h-4 w-4" />
                                {t('bulkSends.tabTemplates', { count: allTemplates.length })}
                            </button>
                        </div>
                    </header>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <MetricCard
                            icon={Clock}
                            label={t('bulkSends.metricCampaigns')}
                            value={sendMetrics.totalSends.toLocaleString()}
                            detail={t('bulkSends.metricCampaignsDetail', { completed: sendMetrics.completedSends, processing: sendMetrics.processingSends })}
                        />
                        <MetricCard
                            icon={Phone}
                            label={t('bulkSends.metricRecipients')}
                            value={sendMetrics.totalRecipients.toLocaleString()}
                            detail={t('bulkSends.metricRecipientsDetail', { sent: sendMetrics.sentRecipients.toLocaleString(), pending: sendMetrics.pendingRecipients.toLocaleString() })}
                            tone="success"
                        />
                        <MetricCard
                            icon={AlertCircle}
                            label={t('bulkSends.metricErrors')}
                            value={sendMetrics.failedRecipients.toLocaleString()}
                            detail={t('bulkSends.metricErrorsDetail', { count: sendMetrics.blockedSends })}
                            tone="danger"
                        />
                        <MetricCard
                            icon={MessageSquareText}
                            label={t('bulkSends.metricUsableTemplates')}
                            value={templateMetrics.usable.toLocaleString()}
                            detail={t('bulkSends.metricUsableTemplatesDetail', { pending: templateMetrics.pending, rejected: templateMetrics.rejected })}
                            tone="info"
                        />
                    </div>

                    <div className="space-y-2">
                        {error && (
                            <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                <p className="text-sm font-medium">{error}</p>
                                <button onClick={() => setError('')} className="ml-auto rounded-md p-1 hover:bg-red-100 dark:hover:bg-red-900/40">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        )}

                        {success && (
                            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                                <p className="text-sm font-medium">{success}</p>
                                <button onClick={() => setSuccess('')} className="ml-auto rounded-md p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/40">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        )}
                    </div>

                    {activeTab === 'send' && (<>
                    {isProcessing && activeProgress && (
                        <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-4 shadow-sm dark:border-sky-900/60 dark:bg-sky-950/25">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin text-sky-700 dark:text-sky-300" />
                                        <h3 className="truncate text-base font-bold text-sky-950 dark:text-sky-100">
                                            {activeProgress.name || t('bulkSends.sendInProgress')}
                                        </h3>
                                    </div>
                                    <p className="mt-1 truncate text-xs font-medium text-sky-700 dark:text-sky-300">
                                        {t('bulkSends.progressProcessed', { template: activeProgress.template_name, percentage: activeProgress.percentage })}
                                    </p>
                                </div>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleCancel(activeProgress.id)}
                                    className="h-9 rounded-xl"
                                >
                                    <StopCircle className="mr-1.5 h-4 w-4" />
                                    {t('common.cancel')}
                                </Button>
                            </div>

                            <div className="mt-4 space-y-3">
                                <div className="h-2.5 w-full overflow-hidden rounded-full bg-sky-200 dark:bg-sky-900/70">
                                    <div
                                        className="h-full rounded-full bg-sky-600 transition-all duration-500"
                                        style={{ width: `${activeProgress.percentage}%` }}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                                    <div className="rounded-xl bg-white/70 px-3 py-2 dark:bg-background/40">
                                        <div className="text-lg font-bold text-sky-950 dark:text-sky-100">{activeProgress.total.toLocaleString()}</div>
                                        <div className="text-xs font-semibold uppercase text-sky-700 dark:text-sky-300">{t('bulkSends.total')}</div>
                                    </div>
                                    <div className="rounded-xl bg-white/70 px-3 py-2 dark:bg-background/40">
                                        <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{activeProgress.sent.toLocaleString()}</div>
                                        <div className="text-xs font-semibold uppercase text-muted-foreground">{t('bulkSends.sent')}</div>
                                    </div>
                                    <div className="rounded-xl bg-white/70 px-3 py-2 dark:bg-background/40">
                                        <div className="text-lg font-bold text-red-600 dark:text-red-300">{activeProgress.failed.toLocaleString()}</div>
                                        <div className="text-xs font-semibold uppercase text-muted-foreground">{t('bulkSends.failed')}</div>
                                    </div>
                                    <div className="rounded-xl bg-white/70 px-3 py-2 dark:bg-background/40">
                                        <div className="text-lg font-bold text-amber-700 dark:text-amber-300">{activeProgress.pending.toLocaleString()}</div>
                                        <div className="text-xs font-semibold uppercase text-muted-foreground">{t('bulkSends.pending')}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Formulario de envío */}
                    {!isProcessing && (
                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.72fr)]">

                            {/* Columna izquierda: Template y destinatarios */}
                            <div className="space-y-4">
                                {/* Seleccionar Template */}
                                <div className="rounded-2xl bg-card/80 p-4 shadow-sm">
                                    <h2 className="mb-3 flex items-center gap-2 text-base font-bold settings-title">
                                        <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-800/60">
                                            <MessageSquareText className="h-4 w-4" />
                                        </span>
                                        {t('bulkSends.templateAndVariables')}
                                    </h2>

                                    <div className="space-y-3">
                                        <div>
                                            <label className="block font-semibold mb-2 settings-label" style={{ fontSize: 'var(--text-sm)' }}>
                                                {t('bulkSends.sendNameLabel')}
                                            </label>
                                            <input
                                                type="text"
                                                value={sendName}
                                                onChange={(e) => setSendName(e.target.value)}
                                                placeholder={t('bulkSends.sendNamePlaceholder')}
                                                className="w-full settings-input rounded-xl border-gray-200 dark:border-gray-800 transition-all duration-200 focus:ring-2 focus:ring-[#2e3f84]/30"
                                                style={{ height: 'clamp(2.25rem, 2.25rem + 0.15vw, 2.5rem)', fontSize: 'var(--text-sm)' }}
                                            />
                                        </div>

                                        <div>
                                            <label className="block font-semibold mb-2 settings-label" style={{ fontSize: 'var(--text-sm)' }}>
                                                {t('bulkSends.whatsappTemplateLabel')}
                                            </label>
                                            {whatsappTemplates.length > 0 ? (
                                                <div className="space-y-3">
                                                    <Select
                                                        value={selectedTemplate?.id ? String(selectedTemplate.id) : ''}
                                                        onValueChange={(v) => handleSelectTemplate(v)}
                                                    >
                                                        <SelectTrigger className="w-full h-10 settings-input rounded-xl">
                                                            <SelectValue placeholder={t('bulkSends.selectTemplatePlaceholder')} />
                                                        </SelectTrigger>
                                                        <SelectContent className="rounded-xl max-h-[320px]">
                                                            {whatsappTemplates.map((t) => (
                                                                <SelectItem key={t.id} value={String(t.id)} className="rounded-lg cursor-pointer">
                                                                    {t.header_format && ['DOCUMENT', 'IMAGE', 'VIDEO'].includes(t.header_format) ? '📎 ' : ''}{t.name}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>

                                                    {/* Preview del template seleccionado */}
                                                    {selectedTemplate && (
                                                        <div className="rounded-xl overflow-hidden">
                                                            <button
                                                                onClick={() => setShowPreview(!showPreview)}
                                                                className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
                                                            >
                                                                <span className="flex items-center gap-2 text-sm font-medium text-foreground/80">
                                                                    <Eye className="w-4 h-4" />
                                                                    {t('bulkSends.messagePreview')}
                                                                </span>
                                                                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${showPreview ? 'rotate-180' : ''}`} />
                                                            </button>
                                                            {showPreview && (
                                                                <div className="px-4 py-3 bg-green-50/60 dark:bg-green-950/20 border-t border-border/40">
                                                                    <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border border-green-200/60 dark:border-green-800/40 max-w-sm">
                                                                        {selectedTemplate.header_format === 'DOCUMENT' && (
                                                                            <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-3 mb-2 flex items-center gap-2">
                                                                                <FileText className="w-5 h-5 text-red-500" />
                                                                                <span className="text-xs text-muted-foreground">{t('bulkSends.pdfAttached')}</span>
                                                                            </div>
                                                                        )}
                                                                        {selectedTemplate.header_format === 'IMAGE' && (
                                                                            <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-3 mb-2 flex items-center gap-2">
                                                                                <Image className="w-5 h-5 text-blue-500" />
                                                                                <span className="text-xs text-muted-foreground">{t('bulkSends.imageAttached')}</span>
                                                                            </div>
                                                                        )}
                                                                        {selectedTemplate.header_format === 'VIDEO' && (
                                                                            <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-3 mb-2 flex items-center gap-2">
                                                                                <Video className="w-5 h-5 text-purple-500" />
                                                                                <span className="text-xs text-muted-foreground">{t('bulkSends.videoAttached')}</span>
                                                                            </div>
                                                                        )}
                                                                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                                                                            {selectedTemplate.preview_text || t('bulkSends.noPreviewText')}
                                                                        </p>
                                                                    </div>
                                                                    <p className="text-xs text-muted-foreground mt-2">
                                                                        <Trans
                                                                            i18nKey="bulkSends.templateMetaLanguage"
                                                                            values={{ name: selectedTemplate.meta_template_name, language: selectedTemplate.language }}
                                                                            components={{ meta: <span className="font-mono font-medium" /> }}
                                                                        />
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="text-center py-6 border-2 border-dashed border-border/50 rounded-xl">
                                                    <MessageSquareText className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                                                    <p className="text-sm text-muted-foreground">
                                                        {t('bulkSends.noTemplatesConfigured')}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {t('bulkSends.noTemplatesHelp')}
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Plantilla mal construida o sin parámetros: decirlo, no callar */}
                                        {templateHealth && (
                                            <div className={`rounded-xl border p-3.5 ${templateHealth.kind === 'broken'
                                                ? 'border-red-300 dark:border-red-800/60 bg-red-50 dark:bg-red-950/20'
                                                : 'border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/20'
                                            }`}>
                                                <p className={`text-xs font-bold mb-1.5 flex items-center gap-1.5 ${templateHealth.kind === 'broken'
                                                    ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'
                                                }`}>
                                                    <AlertTriangle className="w-3.5 h-3.5" />
                                                    {templateHealth.kind === 'broken'
                                                        ? t('bulkSends.templateBrokenTitle')
                                                        : t('bulkSends.templateNoParamsTitle')}
                                                </p>
                                                <p className={`text-[11px] leading-relaxed ${templateHealth.kind === 'broken'
                                                    ? 'text-red-800/90 dark:text-red-300/85' : 'text-amber-800/90 dark:text-amber-300/85'
                                                }`}>
                                                    {templateHealth.kind === 'broken'
                                                        ? t('bulkSends.templateBrokenHelp', { markers: templateHealth.leftovers.join('  ') })
                                                        : t('bulkSends.templateNoParamsHelp')}
                                                </p>
                                            </div>
                                        )}

                                        {/* Guía: formato de Excel sugerido para la plantilla seleccionada */}
                                        {selectedTemplate && excelGuide && (
                                            <div className="rounded-xl border border-sky-200/60 dark:border-sky-800/40 bg-sky-50/50 dark:bg-sky-950/20 p-3.5">
                                                <p className="text-xs font-bold text-sky-800 dark:text-sky-300 mb-2 flex items-center gap-1.5">
                                                    <FileSpreadsheet className="w-3.5 h-3.5" />
                                                    {t('bulkSends.excelGuideTitle')}
                                                </p>
                                                <div className="overflow-x-auto custom-scrollbar mb-2.5">
                                                    <table className="text-[11px] border-collapse">
                                                        <thead>
                                                            <tr>
                                                                {[t('bulkSends.excelColPhone'), ...excelGuide.map(g => g.header)].map((h, i) => (
                                                                    <th key={i} className="border border-sky-200/80 dark:border-sky-800/60 bg-white dark:bg-neutral-800 px-2.5 py-1 font-mono font-bold text-sky-900 dark:text-sky-200 text-left whitespace-nowrap">
                                                                        {h}
                                                                    </th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            <tr>
                                                                {['3101234567', ...excelGuide.map(g => g.sample)].map((v, i) => (
                                                                    <td key={i} className="border border-sky-200/60 dark:border-sky-800/40 px-2.5 py-1 text-sky-800/80 dark:text-sky-300/70 whitespace-nowrap italic">
                                                                        {v}
                                                                    </td>
                                                                ))}
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </div>
                                                <div className="space-y-1">
                                                    {excelGuide.map(g => (
                                                        <p key={g.idx} className="text-[11px] text-sky-800/80 dark:text-sky-300/80">
                                                            <span className="font-semibold">{g.header}</span>
                                                            <span className="opacity-75">{t('bulkSends.excelUsedIn', { context: g.context })}</span>
                                                        </p>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Mapeo de columnas a parámetros del template */}
                                        {selectedTemplate && templatePlaceholders.length > 0 && (
                                            <div>
                                                <label className="block font-semibold mb-2 settings-label" style={{ fontSize: 'var(--text-sm)' }}>
                                                    <Columns3 className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
                                                    {t('bulkSends.paramMapping')}
                                                </label>
                                                <p className="text-xs text-muted-foreground mb-3">
                                                    {t('bulkSends.paramMappingHelp')}
                                                    {extraColumns.length === 0 && recipients.length === 0 && (
                                                        <span className="block mt-1 text-amber-600 dark:text-amber-400">
                                                            {t('bulkSends.uploadExcelToMap')}
                                                        </span>
                                                    )}
                                                </p>
                                                <div className="space-y-2.5">
                                                    {templatePlaceholders.map((idx) => {
                                                        const mapping = columnMapping[String(idx)];
                                                        const source = mapping?.source || 'unset';
                                                        const columnMissing = source === 'column' && !extraColumns.includes(mapping?.column || '');
                                                        const isUnset = source === 'unset' || columnMissing;
                                                        return (
                                                            <div key={idx} className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2">
                                                                <span className="text-xs font-mono font-semibold text-primary whitespace-nowrap w-10">
                                                                    {`{{${idx}}}`}
                                                                </span>
                                                                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                                                <div className="flex-1">
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
                                                                        <SelectTrigger
                                                                            className={cn(
                                                                                'w-full h-8 settings-input rounded-xl text-sm',
                                                                                isUnset ? 'border-red-400 ring-1 ring-red-300/60 dark:border-red-500/70' : 'border-gray-200 dark:border-gray-800'
                                                                            )}
                                                                        >
                                                                            <SelectValue placeholder={t('bulkSends.selectSourcePlaceholder')} />
                                                                        </SelectTrigger>
                                                                        <SelectContent className="rounded-xl max-h-[320px]">
                                                                            <SelectItem value="__nombre__" className="rounded-lg cursor-pointer">📋 {t('bulkSends.sourceContactName')}</SelectItem>
                                                                            {extraColumns.map((col) => (
                                                                                <SelectItem key={col} value={`__col__${col}`} className="rounded-lg cursor-pointer">
                                                                                    📊 {t('bulkSends.sourceColumn', { col })}
                                                                                </SelectItem>
                                                                            ))}
                                                                            <SelectItem value="__static__" className="rounded-lg cursor-pointer">✏️ {t('bulkSends.sourceStatic')}</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
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
                                                                        className="flex-1 settings-input rounded-xl border-gray-200 dark:border-gray-800 text-sm"
                                                                        style={{ height: '2rem', fontSize: '0.8125rem', minWidth: '120px' }}
                                                                    />
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {/* Preview con valores reales del primer destinatario */}
                                                {selectedTemplate.preview_text && Object.keys(columnMapping).length > 0 && (
                                                    <div className="mt-3 bg-green-50/60 dark:bg-green-950/20 rounded-xl p-3 border border-green-200/40 dark:border-green-800/30">
                                                        <p className="text-xs font-medium text-muted-foreground mb-1.5">
                                                            {recipients[0]
                                                                ? t('bulkSends.previewToRecipient', { recipient: recipients[0].name || recipients[0].phone })
                                                                : t('bulkSends.messagePreviewColon')}
                                                        </p>
                                                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                                                            {renderedPreview}
                                                        </p>
                                                        {!mappingComplete && (
                                                            <p className="mt-2 flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
                                                                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                                                                {t('bulkSends.missingParamsWarning')}
                                                            </p>
                                                        )}
                                                        {validationIssues.errors.map((msg, i) => (
                                                            <p key={`e${i}`} className="mt-2 flex items-start gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
                                                                <XCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                                                                {msg}
                                                            </p>
                                                        ))}
                                                        {validationIssues.warnings.map((msg, i) => (
                                                            <p key={`w${i}`} className="mt-2 flex items-start gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                                                                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                                                                {msg}
                                                            </p>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Parámetros estáticos (solo si template sin placeholders detectados o para retrocompatibilidad) */}
                                        {selectedTemplate && templatePlaceholders.length === 0 && (
                                            <div>
                                                <label className="block font-semibold mb-2 settings-label" style={{ fontSize: 'var(--text-sm)' }}>
                                                    {t('bulkSends.templateParamsLabel')}
                                                </label>
                                                <div className="space-y-2">
                                                    {templateParams.map((param, index) => (
                                                        <div key={index} className="flex items-center gap-2">
                                                            <span className="text-xs text-muted-foreground w-10">
                                                                {`{{${index + 1}}}`}
                                                            </span>
                                                            <span className="flex-1 px-3 py-1.5 bg-muted rounded text-sm">
                                                                {param}
                                                            </span>
                                                            <button
                                                                onClick={() => removeParam(index)}
                                                                className="text-red-500 hover:text-red-700"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="text"
                                                            value={newParamValue}
                                                            onChange={(e) => setNewParamValue(e.target.value)}
                                                            onKeyDown={(e) => e.key === 'Enter' && addParam()}
                                                            placeholder={t('bulkSends.paramValuePlaceholder', { token: `{{${templateParams.length + 1}}}` })}
                                                            className="flex-1 settings-input rounded-xl border-gray-200 dark:border-gray-800 transition-all duration-200 focus:ring-2 focus:ring-[#2e3f84]/30"
                                                            style={{ height: 'clamp(2.25rem, 2.25rem + 0.15vw, 2.5rem)', fontSize: 'var(--text-sm)' }}
                                                        />
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={addParam}
                                                            className="settings-btn-secondary rounded-xl"
                                                        >
                                                            <Plus className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Subir archivo */}
                                <div className="rounded-2xl bg-card/80 p-4 shadow-sm">
                                    <h2 className="mb-3 flex items-center gap-2 text-base font-bold settings-title">
                                        <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:ring-sky-800/60">
                                            <Upload className="h-4 w-4" />
                                        </span>
                                        {t('bulkSends.loadRecipients')}
                                    </h2>

                                    <div
                                        onDrop={handleDrop}
                                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                                        className={`cursor-pointer space-y-3 rounded-xl border border-dashed p-5 text-center transition-colors ${isDragging
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                                            : 'border-border/70 bg-background/40 hover:border-primary/40 hover:bg-muted/30'
                                            }`}
                                        onClick={() => document.getElementById('bulk-file-input')?.click()}
                                    >
                                        <input
                                            id="bulk-file-input"
                                            type="file"
                                            accept=".xlsx,.xls,.csv"
                                            onChange={handleFileInput}
                                            className="hidden"
                                        />
                                        {isUploading ? (
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                                <p className="text-sm text-muted-foreground">{t('bulkSends.processingFile')}</p>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex justify-center">
                                                    <FileSpreadsheet className="h-9 w-9 text-muted-foreground" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-foreground">
                                                        {t('bulkSends.dragExcelHere')}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        {t('bulkSends.fileFormatsHelp')}
                                                    </p>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    {uploadedFileName && (
                                        <div className="mt-3 space-y-1">
                                            <p className="text-sm text-green-600 flex items-center gap-1 font-medium">
                                                <CheckCircle2 className="w-4 h-4" />
                                                {t('bulkSends.fileLoaded', { filename: uploadedFileName })}
                                            </p>
                                            {extraColumns.length > 0 && (
                                                <p className="text-xs text-blue-600 font-medium">
                                                    {t('bulkSends.extraColumnsDetected', { columns: extraColumns.join(', ') })}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Agregar manual */}
                                <div className="rounded-2xl bg-card/80 p-4 shadow-sm">
                                    <h2 className="mb-3 flex items-center gap-2 text-base font-bold settings-title">
                                        <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-800/60">
                                            <Phone className="h-4 w-4" />
                                        </span>
                                        {t('bulkSends.addNumber')}
                                    </h2>

                                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                                        <input
                                            type="text"
                                            value={manualPhone}
                                            onChange={(e) => setManualPhone(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && addManualRecipient()}
                                            placeholder="3001234567"
                                            className="flex-1 settings-input rounded-xl border-gray-200 dark:border-gray-800 transition-all duration-200 focus:ring-2 focus:ring-[#2e3f84]/30"
                                            style={{ height: 'clamp(2.25rem, 2.25rem + 0.15vw, 2.5rem)', fontSize: 'var(--text-sm)' }}
                                        />
                                        <input
                                            type="text"
                                            value={manualName}
                                            onChange={(e) => setManualName(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && addManualRecipient()}
                                            placeholder={t('bulkSends.namePlaceholderShort')}
                                            className="flex-1 settings-input rounded-xl border-gray-200 dark:border-gray-800 transition-all duration-200 focus:ring-2 focus:ring-[#2e3f84]/30"
                                            style={{ height: 'clamp(2.25rem, 2.25rem + 0.15vw, 2.5rem)', fontSize: 'var(--text-sm)' }}
                                        />
                                        <Button
                                            onClick={addManualRecipient}
                                            variant="outline"
                                            className="settings-btn-secondary rounded-xl"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Columna derecha: Vista previa de destinatarios */}
                            <div className="flex flex-col gap-4">
                                <div className="flex min-h-[460px] flex-1 flex-col rounded-2xl bg-card/80 p-4 shadow-sm">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <h2 className="text-base font-bold settings-title">
                                            {t('bulkSends.recipientsTitle', { count: recipients.length })}
                                        </h2>
                                        {recipients.length > 0 && (
                                            <Button variant="ghost" size="sm" onClick={clearRecipients} className="h-8 rounded-xl text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30">
                                                <Trash2 className="mr-1 h-4 w-4" />
                                                {t('bulkSends.clear')}
                                            </Button>
                                        )}
                                    </div>

                                    {recipients.length === 0 ? (
                                        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-background/40 py-12 text-center text-muted-foreground">
                                            <Send className="mx-auto mb-3 h-10 w-10 opacity-20" />
                                            <p className="text-sm">{t('bulkSends.noRecipientsYet')}</p>
                                        </div>
                                    ) : (
                                        <div className="relative mb-4 flex-1 min-h-0">
                                            <div className="absolute inset-0 overflow-y-auto rounded-xl bg-background/50 custom-scrollbar-light">
                                            {/* Sólo se pintan los primeros RECIPIENTS_PREVIEW_LIMIT:
                                                un Excel real llegó a 2.027 destinatarios y pintarlos
                                                todos dejaba el navegador pesado JUSTO antes de enviar.
                                                El envío sigue usando el array completo. */}
                                            {recipients.slice(0, RECIPIENTS_PREVIEW_LIMIT).map((r, index) => (
                                                <div
                                                    key={index}
                                                    className="flex items-center justify-between gap-3 border-b border-border/40 px-3 py-2 text-sm last:border-0 hover:bg-muted/50"
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex min-w-0 items-center gap-2">
                                                            <span className="w-6 text-right text-xs text-muted-foreground">
                                                            {index + 1}
                                                            </span>
                                                            <span className="truncate font-mono font-medium">{r.phone}</span>
                                                        </div>
                                                        {r.name && <p className="ml-8 truncate text-xs text-muted-foreground">{r.name}</p>}
                                                        {r.params && Object.keys(r.params).length > 0 && (
                                                            <p className="ml-8 truncate text-xs text-blue-500">
                                                                ({Object.values(r.params).join(', ')})
                                                            </p>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={() => removeRecipient(index)}
                                                        className="rounded-md p-1 text-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ))}

                                            {recipients.length > RECIPIENTS_PREVIEW_LIMIT && (
                                                <div className="border-t border-border/40 bg-muted/30 px-3 py-2.5 text-center text-xs text-muted-foreground">
                                                    {t('bulkSends.andMoreRecipients', {
                                                        count: recipients.length - RECIPIENTS_PREVIEW_LIMIT,
                                                        defaultValue: '…y {{count}} destinatarios más (se enviará a los {{total}})',
                                                        total: recipients.length,
                                                    })}
                                                </div>
                                            )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Botón de enviar con estilo personalizado */}
                                    {recipients.length > 0 && (
                                        <div className="pt-4 mt-auto">
                                            <Button
                                                onClick={handleStartSend}
                                                disabled={isSending || !selectedTemplate || !mappingComplete}
                                                className="w-full font-semibold text-white transition-all duration-200 border-0 relative overflow-hidden rounded-xl"
                                                style={{
                                                    backgroundColor: 'var(--primary-base)',
                                                    boxShadow: 'var(--shadow-md)',
                                                    backgroundImage: 'var(--gradient-shine)',
                                                    height: '3rem',
                                                    fontSize: 'var(--text-md)',
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.backgroundColor = 'var(--primary-darker)';
                                                    e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.backgroundColor = 'var(--primary-base)';
                                                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                }}
                                            >
                                                {isSending ? (
                                                    <>
                                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                                        {t('bulkSends.startingSend')}
                                                    </>
                                                ) : (
                                                    <>
                                                        <Send className="w-5 h-5 mr-2" />
                                                        {t('bulkSends.sendToRecipients', { count: recipients.length })}
                                                    </>
                                                )}
                                            </Button>
                                            {!selectedTemplate && (
                                                <p className="text-xs text-red-500 mt-2 text-center font-medium">
                                                    {t('bulkSends.selectTemplateBeforeSend')}
                                                </p>
                                            )}
                                            {selectedTemplate && !mappingComplete && (
                                                <p className="text-xs text-red-500 mt-2 text-center font-medium">
                                                    {t('bulkSends.assignSourceBeforeSend')}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="rounded-2xl bg-card/80 p-4 shadow-sm">
                        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                            <div>
                                <h2 className="flex items-center gap-2 text-base font-bold settings-title">
                                    <Clock className="h-4 w-4" />
                                    {t('bulkSends.sendHistory')}
                                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                                        {visibleBulkSends.length.toLocaleString()}
                                    </span>
                                </h2>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {historySearch.trim() ? t('bulkSends.historySearchSubtitle') : t('bulkSends.historyDefaultSubtitle')}
                                </p>
                            </div>
                            <div className="flex flex-col gap-2 md:flex-row md:items-center">
                                <div className="flex flex-wrap gap-1 rounded-xl bg-muted/50 p-1">
                                    {([
                                        { value: 'all' as const, label: t('bulkSends.filterAll'), count: filteredBulkSends.length },
                                        { value: 'processing' as const, label: t('bulkSends.filterQueued'), count: filteredBulkSends.filter((item) => item.status === 'processing').length },
                                        { value: 'completed' as const, label: t('bulkSends.filterCompleted'), count: filteredBulkSends.filter((item) => item.status === 'completed').length },
                                        { value: 'failed' as const, label: t('bulkSends.filterFailed'), count: filteredBulkSends.filter((item) => item.status === 'failed').length },
                                        { value: 'cancelled' as const, label: t('bulkSends.filterCancelled'), count: filteredBulkSends.filter((item) => item.status === 'cancelled').length },
                                    ]).map((filter) => (
                                        <button
                                            key={filter.value}
                                            onClick={() => setHistoryStatusFilter(filter.value)}
                                            className={`rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                                                historyStatusFilter === filter.value
                                                    ? 'bg-white text-foreground shadow-sm dark:bg-gray-800'
                                                    : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                        >
                                            {filter.label} {filter.count > 0 ? filter.count : ''}
                                        </button>
                                    ))}
                                </div>
                                <div className="relative min-w-0 md:w-80">
                                    {isSearching ? (
                                        <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />
                                    ) : (
                                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    )}
                                    <Input
                                        value={historySearch}
                                        onChange={(e) => setHistorySearch(e.target.value)}
                                        placeholder={t('bulkSends.searchPlaceholder')}
                                        className="h-9 w-full rounded-xl pl-9 text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        {visibleBulkSends.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-border/70 bg-background/40 py-10 text-center">
                                <Search className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                                <p className="text-sm font-medium text-muted-foreground">
                                    {isSearching ? t('common.searching') : historySearch.trim() ? t('bulkSends.noSearchResults') : t('bulkSends.noBulkSends')}
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-xl">
                                <table className="w-full min-w-[980px] text-sm">
                                    <thead className="bg-muted/40">
                                        <tr className="border-b border-border/50">
                                            <th className="px-3 py-2.5 text-left text-xs font-bold uppercase text-muted-foreground">{t('bulkSends.colSend')}</th>
                                            <th className="px-3 py-2.5 text-center text-xs font-bold uppercase text-muted-foreground">{t('bulkSends.colStatus')}</th>
                                            <th className="px-3 py-2.5 text-left text-xs font-bold uppercase text-muted-foreground">{t('bulkSends.colProgress')}</th>
                                            <th className="px-3 py-2.5 text-center text-xs font-bold uppercase text-muted-foreground">{t('bulkSends.colResult')}</th>
                                            <th className="px-3 py-2.5 text-left text-xs font-bold uppercase text-muted-foreground">{t('bulkSends.colResponsible')}</th>
                                            <th className="px-3 py-2.5 text-left text-xs font-bold uppercase text-muted-foreground">{t('bulkSends.colDate')}</th>
                                            <th className="px-3 py-2.5 text-right text-xs font-bold uppercase text-muted-foreground">{t('bulkSends.colAction')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visibleBulkSends.map((bs) => {
                                            const status = statusLabel(bs.status);
                                            const progress = getProgress(bs);
                                            const pending = Math.max(0, bs.total_recipients - bs.sent_count - bs.failed_count);
                                            const hasMatches = bs.matching_recipients && bs.matching_recipients.length > 0;
                                            return (
                                                <React.Fragment key={bs.id}>
                                                    <tr
                                                        className="cursor-pointer border-b border-border/50 transition-colors hover:bg-muted/30"
                                                        onClick={() => router.visit(`/admin/bulk-sends/${bs.id}`)}
                                                    >
                                                        <td className="px-3 py-3">
                                                            <p className="max-w-[260px] truncate font-semibold text-primary hover:underline">{bs.name || t('bulkSends.unnamed')}</p>
                                                            <p className="mt-0.5 max-w-[260px] truncate font-mono text-xs text-muted-foreground">{bs.template_name}</p>
                                                        </td>
                                                        <td className="px-3 py-3 text-center">
                                                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${status.color}`}>
                                                                {status.text}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-3">
                                                            <div className="flex items-center justify-between gap-3 text-xs font-semibold text-muted-foreground">
                                                                <span>{progress}%</span>
                                                                <span>{t('bulkSends.totalCount', { total: bs.total_recipients.toLocaleString() })}</span>
                                                            </div>
                                                            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                                                                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-3 text-center">
                                                            <div className="inline-grid grid-cols-3 overflow-hidden rounded-xl border border-border/60 text-xs">
                                                                <span className="bg-emerald-50 px-2 py-1 font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">{bs.sent_count}</span>
                                                                <span className="bg-red-50 px-2 py-1 font-bold text-red-700 dark:bg-red-950/30 dark:text-red-300">{bs.failed_count}</span>
                                                                <span className="bg-amber-50 px-2 py-1 font-bold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">{pending}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-3 text-muted-foreground">{bs.created_by_name}</td>
                                                        <td className="px-3 py-3 text-xs text-muted-foreground">{bs.created_at}</td>
                                                        <td className="px-3 py-3 text-right">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 rounded-xl"
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    router.visit(`/admin/bulk-sends/${bs.id}`);
                                                                }}
                                                            >
                                                                <Eye className="mr-1.5 h-4 w-4" />
                                                                {t('bulkSends.view')}
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                    {hasMatches && (
                                                        <tr key={`${bs.id}-matches`}>
                                                            <td colSpan={7} className="border-b border-border/50 bg-muted/25 p-0">
                                                                <div className="px-4 py-3">
                                                                    <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-primary/80">
                                                                        <Eye className="h-3.5 w-3.5" />
                                                                        {t('bulkSends.recipientsFound', { count: bs.matching_recipients!.length })}
                                                                    </p>
                                                                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                                                                        {bs.matching_recipients!.map((recipient) => {
                                                                            const recipientStatus = statusLabel(recipient.status);
                                                                            return (
                                                                                <button
                                                                                    key={recipient.id}
                                                                                    type="button"
                                                                                    onClick={() => router.visit(`/admin/bulk-sends/${bs.id}`)}
                                                                                    className="rounded-xl border border-border/60 bg-background/70 p-3 text-left transition-colors hover:border-primary/40 hover:bg-background"
                                                                                >
                                                                                    <div className="flex items-start justify-between gap-2">
                                                                                        <div className="min-w-0">
                                                                                            <p className="truncate text-sm font-semibold text-foreground">{recipient.contact_name || t('bulkSends.unnamed')}</p>
                                                                                            <p className="mt-0.5 font-mono text-xs text-muted-foreground">{recipient.phone_number}</p>
                                                                                        </div>
                                                                                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${recipientStatus.color}`}>
                                                                                            {recipientStatus.text}
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="mt-2 rounded-md bg-muted/40 px-2 py-1.5 text-xs">
                                                                                        {recipient.error ? (
                                                                                            <p className="line-clamp-2 text-red-600 dark:text-red-300" title={recipient.error}>{recipient.error}</p>
                                                                                        ) : (
                                                                                            <p className="text-muted-foreground">{t('bulkSends.noErrorRecorded', { sentAt: recipient.sent_at || t('bulkSends.noSentDate') })}</p>
                                                                                        )}
                                                                                    </div>
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                    </>)}

                    {activeTab === 'templates' && (
                        <div className="space-y-4">
                            <div className="grid gap-3 md:grid-cols-4">
                                <div className="rounded-2xl bg-card/80 p-4 shadow-sm">
                                    <p className="text-xs font-semibold uppercase text-muted-foreground">{t('bulkSends.tplRegistered')}</p>
                                    <p className="mt-2 text-2xl font-bold text-foreground">{allTemplates.length.toLocaleString()}</p>
                                </div>
                                <div className="rounded-2xl bg-card/80 p-4 shadow-sm">
                                    <p className="text-xs font-semibold uppercase text-muted-foreground">{t('bulkSends.tplApproved')}</p>
                                    <p className="mt-2 text-2xl font-bold text-emerald-700 dark:text-emerald-300">{templateMetrics.approved.toLocaleString()}</p>
                                </div>
                                <div className="rounded-2xl bg-card/80 p-4 shadow-sm">
                                    <p className="text-xs font-semibold uppercase text-muted-foreground">{t('bulkSends.tplUnderReview')}</p>
                                    <p className="mt-2 text-2xl font-bold text-amber-700 dark:text-amber-300">{templateMetrics.pending.toLocaleString()}</p>
                                </div>
                                <div className="rounded-2xl bg-card/80 p-4 shadow-sm">
                                    <p className="text-xs font-semibold uppercase text-muted-foreground">{t('bulkSends.tplUsableInSend')}</p>
                                    <p className="mt-2 text-2xl font-bold text-foreground">{templateMetrics.usable.toLocaleString()}</p>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card/80 p-4 shadow-sm">
                                <div>
                                    <h2 className="text-base font-bold settings-title">{t('bulkSends.templateCatalog')}</h2>
                                    <p className="mt-1 text-xs text-muted-foreground">{t('bulkSends.templateCatalogSubtitle')}</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    onClick={() => setShowCreateModal(true)}
                                    className="h-9 rounded-xl border-0 font-semibold text-white transition-all duration-200"
                                    style={{
                                        backgroundColor: 'var(--primary-base)',
                                        backgroundImage: 'var(--gradient-shine)',
                                    }}
                                >
                                    <FilePlus2 className="mr-2 h-4 w-4" />
                                    {t('bulkSends.createTemplate')}
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={handleSyncTemplates}
                                    disabled={isSyncing}
                                    className="h-9 rounded-xl"
                                >
                                    <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                                    {isSyncing ? t('bulkSends.syncing') : t('bulkSends.syncWithMeta')}
                                </Button>
                                </div>
                            </div>

                            <div className="rounded-2xl bg-card/80 p-4 shadow-sm">
                                <h2 className="mb-4 flex items-center gap-2 text-base font-bold settings-title">
                                    <MessageSquareText className="h-4 w-4" />
                                    {t('bulkSends.whatsappTemplatesTitle', { count: allTemplates.length })}
                                </h2>

                                {allTemplates.length === 0 ? (
                                    <div className="text-center py-12">
                                        <MessageSquareText className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                                        <p className="text-sm text-muted-foreground">{t('bulkSends.noRegisteredTemplates')}</p>
                                        <p className="text-xs text-muted-foreground mt-1">{t('bulkSends.noRegisteredTemplatesHelp')}</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto rounded-xl">
                                        <table className="w-full min-w-[980px] text-sm">
                                            <thead className="bg-muted/40">
                                                <tr className="border-b border-border/50">
                                                    <th className="px-3 py-2.5 text-left text-xs font-bold uppercase text-muted-foreground">{t('bulkSends.colName')}</th>
                                                    <th className="px-3 py-2.5 text-left text-xs font-bold uppercase text-muted-foreground">{t('bulkSends.colMetaName')}</th>
                                                    <th className="px-3 py-2.5 text-center text-xs font-bold uppercase text-muted-foreground">{t('bulkSends.colCategory')}</th>
                                                    <th className="px-3 py-2.5 text-center text-xs font-bold uppercase text-muted-foreground">{t('bulkSends.colLanguage')}</th>
                                                    <th className="px-3 py-2.5 text-center text-xs font-bold uppercase text-muted-foreground">{t('bulkSends.colStatus')}</th>
                                                    <th className="px-3 py-2.5 text-left text-xs font-bold uppercase text-muted-foreground">{t('bulkSends.colPreview')}</th>
                                                    <th className="px-3 py-2.5 text-left text-xs font-bold uppercase text-muted-foreground">{t('bulkSends.colCreated')}</th>
                                                    <th className="px-3 py-2.5 text-center text-xs font-bold uppercase text-muted-foreground">{t('bulkSends.colActions')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {allTemplates.map((tpl) => {
                                                    const st = templateStatusLabel(tpl.status);
                                                    const cat = categoryLabel(tpl.category);
                                                    return (
                                                        <tr key={tpl.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                                                            <td className="py-3 px-3 font-medium text-foreground">{tpl.name}</td>
                                                            <td className="py-3 px-3 font-mono text-xs text-muted-foreground">{tpl.meta_template_name}</td>
                                                            <td className="py-3 px-3 text-center">
                                                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                                                    {cat.icon} {cat.text}
                                                                </span>
                                                            </td>
                                                            <td className="py-3 px-3 text-center">
                                                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                                                    <Globe className="w-3 h-3" /> {tpl.language}
                                                                </span>
                                                            </td>
                                                            <td className="py-3 px-3 text-center">
                                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${st.color}`}>
                                                                    {st.icon} {st.text}
                                                                </span>
                                                            </td>
                                                            <td className="py-3 px-3 text-xs text-muted-foreground max-w-[200px] truncate">
                                                                {tpl.preview_text || '—'}
                                                            </td>
                                                            <td className="py-3 px-3 text-xs text-muted-foreground">{tpl.created_at || '—'}</td>
                                                            <td className="py-3 px-3 text-center">
                                                                <button
                                                                    onClick={() => handleDeleteTemplate(tpl.id, tpl.name)}
                                                                    className="text-red-400 hover:text-red-600 p-1 transition-colors"
                                                                    title={t('bulkSends.deleteTemplateTooltip')}
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Modal para crear plantilla */}
                    {/* Modal de confirmación de envío: obliga a ver el mensaje final antes de disparar */}
                    {/* Confirmar borrado de una plantilla de META: es permanente y deja de
                        poder usarse en los envíos. Antes era un confirm() gris del navegador. */}
                    {templateToDelete && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                            <div className="card-gradient w-full max-w-md rounded-2xl shadow-2xl">
                                <div className="p-5">
                                    <h2 className="text-lg font-bold settings-title">
                                        {t('bulkSends.deleteTemplateTitle', 'Eliminar plantilla de WhatsApp')}
                                    </h2>
                                    <p className="mt-1 text-sm settings-subtitle">
                                        {t('bulkSends.deleteTemplateIrreversible', 'Se eliminará de Meta y no podrá usarse en los envíos. Esta acción no se puede deshacer.')}
                                    </p>

                                    <div className="mt-4 rounded-xl bg-white/50 p-3 dark:bg-white/[0.04]">
                                        <p className="truncate text-sm font-semibold settings-title">{templateToDelete.name}</p>
                                    </div>

                                    <div className="mt-3 rounded-lg border-l-4 border-amber-400 bg-amber-50 p-3 dark:border-amber-500 dark:bg-amber-900/20">
                                        <p className="text-xs font-medium text-amber-900 dark:text-amber-300">
                                            {t('bulkSends.deleteTemplateWarning', 'Si vuelves a necesitarla tendrás que crearla de nuevo y esperar la aprobación de Meta.')}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
                                    <Button variant="outline" onClick={() => setTemplateToDelete(null)} className="rounded-xl font-medium settings-btn-secondary">
                                        {t('common.cancel')}
                                    </Button>
                                    <Button
                                        onClick={confirmDeleteTemplate}
                                        className="rounded-xl border-0 bg-gradient-to-b from-red-500 to-red-600 font-medium text-white shadow-md transition-all duration-200 hover:from-red-600 hover:to-red-700"
                                    >
                                        {t('common.delete')}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {showConfirmSend && selectedTemplate && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                            <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
                                <div className="flex items-center justify-between p-5 border-b border-border">
                                    <h2 className="font-bold text-lg settings-title flex items-center gap-2">
                                        <Send className="w-5 h-5" />
                                        {t('bulkSends.confirmBulkSend')}
                                    </h2>
                                    <button onClick={() => setShowConfirmSend(false)} className="text-muted-foreground hover:text-foreground p-1">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                <div className="p-5 space-y-4">
                                    <div className="flex flex-wrap gap-2 text-sm">
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 font-medium">
                                            <Phone className="w-3.5 h-3.5" />
                                            {t('bulkSends.recipientsChip', { count: recipients.length })}
                                        </span>
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 font-medium">
                                            <MessageSquareText className="w-3.5 h-3.5" />
                                            {selectedTemplate.name}
                                        </span>
                                    </div>

                                    <div className="rounded-xl border border-green-200/60 dark:border-green-800/40 bg-green-50/60 dark:bg-green-950/20 p-4">
                                        <p className="text-xs font-semibold text-muted-foreground mb-2">
                                            {t('bulkSends.previewToRecipient', { recipient: recipients[0]?.name || recipients[0]?.phone })}
                                        </p>
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{renderedPreview}</p>
                                    </div>

                                    {validationIssues.errors.length > 0 && (
                                        <div className="rounded-xl border border-red-300 dark:border-red-800/60 bg-red-50 dark:bg-red-950/30 p-4 space-y-1.5">
                                            <p className="text-sm font-bold text-red-700 dark:text-red-300 flex items-center gap-1.5">
                                                <XCircle className="w-4 h-4" />
                                                {t('bulkSends.possibleCrossedData')}
                                            </p>
                                            {validationIssues.errors.map((msg, i) => (
                                                <p key={i} className="text-xs text-red-700 dark:text-red-300 ml-5">• {msg}</p>
                                            ))}
                                        </div>
                                    )}
                                    {validationIssues.warnings.length > 0 && (
                                        <div className="rounded-xl border border-amber-300/70 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/20 p-4 space-y-1.5">
                                            {validationIssues.warnings.map((msg, i) => (
                                                <p key={i} className="text-xs text-amber-700 dark:text-amber-300 flex items-start gap-1.5">
                                                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                                    {msg}
                                                </p>
                                            ))}
                                        </div>
                                    )}

                                    <label className="flex items-start gap-2.5 cursor-pointer select-none rounded-xl border border-border bg-muted/40 px-3 py-2.5">
                                        <input
                                            type="checkbox"
                                            checked={confirmChecked}
                                            onChange={(e) => setConfirmChecked(e.target.checked)}
                                            className="mt-0.5 h-4 w-4 accent-[var(--primary-base)]"
                                        />
                                        <span className="text-sm">
                                            <Trans i18nKey="bulkSends.confirmCheckboxText" components={{ strong: <strong /> }} />
                                        </span>
                                    </label>

                                    <div className="flex justify-end gap-2 pt-1">
                                        <Button variant="outline" onClick={() => setShowConfirmSend(false)} className="rounded-xl">
                                            {t('common.cancel')}
                                        </Button>
                                        <Button
                                            onClick={executeSend}
                                            disabled={!confirmChecked || isSending}
                                            className="rounded-xl font-semibold text-white"
                                            style={{ backgroundColor: 'var(--primary-base)', backgroundImage: 'var(--gradient-shine)' }}
                                        >
                                            {isSending ? (
                                                <>
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                                    {t('bulkSends.sending')}
                                                </>
                                            ) : (
                                                <>
                                                    <Send className="w-4 h-4 mr-2" />
                                                    {t('bulkSends.confirmAndSend')}
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {showCreateModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                            <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
                                <div className="flex items-center justify-between p-5 border-b border-border">
                                    <h2 className="font-bold text-lg settings-title flex items-center gap-2">
                                        <FilePlus2 className="w-5 h-5" />
                                        {t('bulkSends.createWhatsappTemplate')}
                                    </h2>
                                    <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground p-1">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="p-5 space-y-4">
                                    {/* Display Name */}
                                    <div>
                                        <label className="block font-semibold mb-1.5 settings-label text-sm">
                                            {t('bulkSends.displayNameLabel')}
                                        </label>
                                        <input
                                            type="text"
                                            value={newTplDisplayName}
                                            onChange={(e) => handleDisplayNameChange(e.target.value)}
                                            placeholder={t('bulkSends.displayNamePlaceholder')}
                                            className="w-full settings-input rounded-xl border-gray-200 dark:border-gray-800 h-10 text-sm"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">{t('bulkSends.displayNameHelp')}</p>
                                    </div>

                                    {/* Technical Name */}
                                    <div>
                                        <label className="block font-semibold mb-1.5 settings-label text-sm">
                                            {t('bulkSends.technicalNameLabel')}
                                        </label>
                                        <input
                                            type="text"
                                            value={newTplName}
                                            onChange={(e) => setNewTplName(e.target.value.replace(/[^a-z0-9_]/g, ''))}
                                            placeholder="recordatorio_cita_medica"
                                            className="w-full settings-input rounded-xl border-gray-200 dark:border-gray-800 h-10 text-sm font-mono"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">{t('bulkSends.technicalNameHelp')}</p>
                                    </div>

                                    {/* Category + Language row */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block font-semibold mb-1.5 settings-label text-sm">
                                                {t('bulkSends.categoryLabel')}
                                            </label>
                                            <Select
                                                value={newTplCategory}
                                                onValueChange={(v) => setNewTplCategory(v as 'MARKETING' | 'UTILITY' | 'AUTHENTICATION')}
                                            >
                                                <SelectTrigger className="w-full h-10 settings-input rounded-xl">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl max-h-[320px]">
                                                    <SelectItem value="UTILITY" className="rounded-lg cursor-pointer">{t('bulkSends.categoryUtility')}</SelectItem>
                                                    <SelectItem value="MARKETING" className="rounded-lg cursor-pointer">{t('bulkSends.categoryMarketing')}</SelectItem>
                                                    <SelectItem value="AUTHENTICATION" className="rounded-lg cursor-pointer">{t('bulkSends.categoryAuthentication')}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <label className="block font-semibold mb-1.5 settings-label text-sm">
                                                {t('bulkSends.languageLabel')}
                                            </label>
                                            <Select
                                                value={newTplLanguage}
                                                onValueChange={(v) => setNewTplLanguage(v)}
                                            >
                                                <SelectTrigger className="w-full h-10 settings-input rounded-xl">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl max-h-[320px]">
                                                    <SelectItem value="es" className="rounded-lg cursor-pointer">{t('bulkSends.langSpanish')}</SelectItem>
                                                    <SelectItem value="es_CO" className="rounded-lg cursor-pointer">{t('bulkSends.langSpanishCO')}</SelectItem>
                                                    <SelectItem value="es_MX" className="rounded-lg cursor-pointer">{t('bulkSends.langSpanishMX')}</SelectItem>
                                                    <SelectItem value="es_AR" className="rounded-lg cursor-pointer">{t('bulkSends.langSpanishAR')}</SelectItem>
                                                    <SelectItem value="en" className="rounded-lg cursor-pointer">{t('bulkSends.langEnglish')}</SelectItem>
                                                    <SelectItem value="en_US" className="rounded-lg cursor-pointer">{t('bulkSends.langEnglishUS')}</SelectItem>
                                                    <SelectItem value="pt_BR" className="rounded-lg cursor-pointer">{t('bulkSends.langPortugueseBR')}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {/* Header (optional) */}
                                    <div>
                                        <label className="block font-semibold mb-1.5 settings-label text-sm">
                                            <Trans i18nKey="bulkSends.headerLabel" components={{ opt: <span className="font-normal text-muted-foreground" /> }} />
                                        </label>
                                        <div className="mb-2">
                                            <Select
                                                value={newTplHeaderFormat}
                                                onValueChange={(v) => {
                                                    setNewTplHeaderFormat(v as 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT');
                                                    setNewTplHeader('');
                                                    setNewTplHeaderMediaUrl('');
                                                }}
                                            >
                                                <SelectTrigger className="w-full h-10 settings-input rounded-xl">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl max-h-[320px]">
                                                    <SelectItem value="NONE" className="rounded-lg cursor-pointer">{t('bulkSends.headerNone')}</SelectItem>
                                                    <SelectItem value="TEXT" className="rounded-lg cursor-pointer">{t('bulkSends.headerText')}</SelectItem>
                                                    <SelectItem value="IMAGE" className="rounded-lg cursor-pointer">{t('bulkSends.headerImage')}</SelectItem>
                                                    <SelectItem value="VIDEO" className="rounded-lg cursor-pointer">{t('bulkSends.headerVideo')}</SelectItem>
                                                    <SelectItem value="DOCUMENT" className="rounded-lg cursor-pointer">{t('bulkSends.headerDocument')}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        {newTplHeaderFormat === 'TEXT' && (
                                            <input
                                                type="text"
                                                value={newTplHeader}
                                                onChange={(e) => setNewTplHeader(e.target.value)}
                                                placeholder={t('bulkSends.headerTextPlaceholder')}
                                                maxLength={60}
                                                className="w-full settings-input rounded-xl border-gray-200 dark:border-gray-800 h-10 text-sm"
                                            />
                                        )}
                                        {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(newTplHeaderFormat) && (
                                            <div className="space-y-2">
                                                <input
                                                    type="url"
                                                    value={newTplHeaderMediaUrl}
                                                    onChange={(e) => setNewTplHeaderMediaUrl(e.target.value)}
                                                    placeholder={
                                                        newTplHeaderFormat === 'IMAGE' ? t('bulkSends.imageUrlPlaceholder') :
                                                        newTplHeaderFormat === 'VIDEO' ? t('bulkSends.videoUrlPlaceholder') :
                                                        t('bulkSends.documentUrlPlaceholder')
                                                    }
                                                    className="w-full settings-input rounded-xl border-gray-200 dark:border-gray-800 h-10 text-sm"
                                                />
                                                <p className="text-xs text-muted-foreground">
                                                    {newTplHeaderFormat === 'IMAGE' && t('bulkSends.imageFormatHelp')}
                                                    {newTplHeaderFormat === 'VIDEO' && t('bulkSends.videoFormatHelp')}
                                                    {newTplHeaderFormat === 'DOCUMENT' && t('bulkSends.documentFormatHelp')}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Body */}
                                    <div>
                                        <label className="block font-semibold mb-1.5 settings-label text-sm">
                                            {t('bulkSends.bodyLabel')}
                                        </label>
                                        <textarea
                                            value={newTplBody}
                                            onChange={(e) => setNewTplBody(e.target.value)}
                                            placeholder={t('bulkSends.bodyPlaceholder')}
                                            maxLength={1024}
                                            rows={5}
                                            className="w-full settings-input rounded-xl border-gray-200 dark:border-gray-800 text-sm resize-none p-3"
                                        />
                                        <div className="flex justify-between mt-1">
                                            <p className="text-xs text-muted-foreground">
                                                {t('bulkSends.bodyHelp')}
                                            </p>
                                            <span className="text-xs text-muted-foreground">{newTplBody.length}/1024</span>
                                        </div>
                                    </div>

                                    {/* Footer (optional) */}
                                    <div>
                                        <label className="block font-semibold mb-1.5 settings-label text-sm">
                                            <Trans i18nKey="bulkSends.footerLabel" components={{ opt: <span className="font-normal text-muted-foreground" /> }} />
                                        </label>
                                        <input
                                            type="text"
                                            value={newTplFooter}
                                            onChange={(e) => setNewTplFooter(e.target.value)}
                                            placeholder={t('bulkSends.footerPlaceholder')}
                                            maxLength={60}
                                            className="w-full settings-input rounded-xl border-gray-200 dark:border-gray-800 h-10 text-sm"
                                        />
                                    </div>

                                    {/* Preview */}
                                    {newTplBody && (
                                        <div className="rounded-xl overflow-hidden">
                                            <div className="px-4 py-2.5 bg-muted/40 border-b border-border/40">
                                                <span className="flex items-center gap-2 text-sm font-medium text-foreground/80">
                                                    <Eye className="w-4 h-4" />
                                                    {t('bulkSends.preview')}
                                                </span>
                                            </div>
                                            <div className="p-4 bg-green-50/60 dark:bg-green-950/20">
                                                <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm border border-green-200/60 dark:border-green-800/40 max-w-sm">
                                                    {newTplHeaderFormat === 'TEXT' && newTplHeader && (
                                                        <p className="text-sm font-bold text-foreground mb-1">{newTplHeader}</p>
                                                    )}
                                                    {newTplHeaderFormat === 'IMAGE' && (
                                                        <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-6 mb-2 flex flex-col items-center justify-center gap-1">
                                                            <Image className="w-8 h-8 text-muted-foreground" />
                                                            <span className="text-xs text-muted-foreground">{t('bulkSends.headerImage')}</span>
                                                        </div>
                                                    )}
                                                    {newTplHeaderFormat === 'VIDEO' && (
                                                        <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-6 mb-2 flex flex-col items-center justify-center gap-1">
                                                            <Video className="w-8 h-8 text-muted-foreground" />
                                                            <span className="text-xs text-muted-foreground">{t('bulkSends.headerVideo')}</span>
                                                        </div>
                                                    )}
                                                    {newTplHeaderFormat === 'DOCUMENT' && (
                                                        <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-6 mb-2 flex flex-col items-center justify-center gap-1">
                                                            <FileText className="w-8 h-8 text-muted-foreground" />
                                                            <span className="text-xs text-muted-foreground">{t('bulkSends.headerDocument')}</span>
                                                        </div>
                                                    )}
                                                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{newTplBody}</p>
                                                    {newTplFooter && (
                                                        <p className="text-xs text-muted-foreground mt-2">{newTplFooter}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Info box */}
                                    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 rounded-xl p-3">
                                        <p className="text-xs text-blue-800 dark:text-blue-300">
                                            <Trans i18nKey="bulkSends.createTemplateNote" components={{ b: <strong /> }} />
                                        </p>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 p-5 border-t border-border">
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowCreateModal(false)}
                                        className="rounded-xl"
                                    >
                                        {t('common.cancel')}
                                    </Button>
                                    <Button
                                        onClick={handleCreateTemplate}
                                        disabled={isCreatingTemplate || !newTplName || !newTplBody || !newTplDisplayName}
                                        className="font-semibold text-white rounded-xl"
                                        style={{
                                            backgroundColor: 'var(--primary-base)',
                                            backgroundImage: 'var(--gradient-shine)',
                                        }}
                                    >
                                        {isCreatingTemplate ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                {t('bulkSends.sendingToMeta')}
                                            </>
                                        ) : (
                                            <>
                                                <Send className="w-4 h-4 mr-2" />
                                                {t('bulkSends.sendForReview')}
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}
