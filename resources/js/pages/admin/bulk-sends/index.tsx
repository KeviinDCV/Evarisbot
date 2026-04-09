import AdminLayout from '@/layouts/admin-layout';
import { Head, router } from '@inertiajs/react';
import { Upload, FileSpreadsheet, Send, X, AlertCircle, CheckCircle2, XCircle, Clock, Trash2, StopCircle, Plus, Phone, ChevronDown, MessageSquareText, Eye, Search, Loader2, RefreshCw, FilePlus2, Shield, Megaphone, Key, Globe, Image, Video, FileText } from 'lucide-react';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from 'react-i18next';

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
    const [historySearch, setHistorySearch] = useState('');
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
        } else {
            setSelectedTemplate(null);
            setTemplateName('');
            setTemplateParams([]);
        }
    };

    // Polling para progreso activo
    useEffect(() => {
        if (!isProcessing) return;

        let shouldStop = false;
        let intervalId: NodeJS.Timeout | null = null;

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
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutos

            const response = await fetch('/admin/bulk-sends/upload', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': csrfToken,
                    'Accept': 'application/json',
                },
                body: formData,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            // Si el servidor devuelve error HTTP sin JSON (ej: 413 nginx, 500 HTML)
            if (!response.ok) {
                const text = await response.text();
                try {
                    const data = JSON.parse(text);
                    if (data.errors) {
                        const firstError = Object.values(data.errors).flat()[0] as string;
                        setError(firstError || 'Error de validación');
                    } else {
                        setError(data.message || `Error del servidor (${response.status})`);
                    }
                } catch {
                    setError(`Error del servidor (${response.status}): ${text.substring(0, 200)}`);
                }
                return;
            }

            const data = await response.json();

            if (data.success) {
                setRecipients(data.recipients);
                setUploadedFileName(data.filename);
                if (data.extra_columns?.length > 0) {
                    setExtraColumns(data.extra_columns);
                }
                setSuccess(`Se cargaron ${data.total} números del archivo ${data.filename}`);
                setTimeout(() => setSuccess(''), 5000);
            } else {
                setError(data.message || 'Error al procesar el archivo');
            }
        } catch (err: any) {
            if (err?.name === 'AbortError') {
                setError('El archivo es muy grande y tardó demasiado en procesarse. Intente con un archivo más pequeño.');
            } else {
                setError('Error al subir el archivo. Verifique que el formato sea correcto.');
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
            setError('Este número ya está en la lista');
            setTimeout(() => setError(''), 3000);
            return;
        }

        if (cleanPhone.length < 10) {
            setError('El número debe tener al menos 10 dígitos');
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

    const handleStartSend = async () => {
        if (!selectedTemplate) {
            setError('Seleccione una plantilla de WhatsApp');
            return;
        }
        if (recipients.length === 0) {
            setError('Agregue al menos un destinatario');
            return;
        }

        setIsSending(true);
        setError('');

        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            const response = await fetch('/admin/bulk-sends/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    template_name: templateName,
                    template_params: templateParams.length > 0 ? templateParams : null,
                    name: sendName || null,
                    recipients: recipients.map(r => ({
                        phone: r.phone,
                        name: r.name,
                        params: r.params || null,
                    })),
                }),
            });

            const data = await response.json();

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
                setTimeout(() => setSuccess(''), 5000);
            } else {
                setError(data.message || 'Error al iniciar el envío');
            }
        } catch (err) {
            setError('Error al iniciar el envío masivo');
        } finally {
            setIsSending(false);
        }
    };

    const handleCancel = async (id: number) => {
        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            const response = await fetch(`/admin/bulk-sends/${id}/cancel`, {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': csrfToken,
                    'Accept': 'application/json',
                },
            });

            const data = await response.json();
            if (data.success) {
                setIsProcessing(false);
                setActiveProgress(null);
                router.reload();
            } else {
                setError(data.message);
            }
        } catch (err) {
            setError('Error al cancelar el envío');
        }
    };

    const statusLabel = (status: string) => {
        const labels: Record<string, { text: string; color: string }> = {
            draft: { text: 'Borrador', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
            processing: { text: 'Procesando', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
            completed: { text: 'Completado', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
            sent: { text: 'Enviado', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
            failed: { text: 'Fallido', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
            cancelled: { text: 'Cancelado', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
            pending: { text: 'Pendiente', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
        };
        return labels[status] || { text: status, color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' };
    };

    const templateStatusLabel = (status: string) => {
        const labels: Record<string, { text: string; color: string; icon: string }> = {
            APPROVED: { text: 'Aprobada', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: '✓' },
            PENDING: { text: 'En revisión', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: '⏳' },
            REJECTED: { text: 'Rechazada', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: '✗' },
            PAUSED: { text: 'Pausada', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', icon: '⏸' },
            DISABLED: { text: 'Deshabilitada', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300', icon: '⊘' },
        };
        return labels[status] || { text: status, color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300', icon: '?' };
    };

    const categoryLabel = (cat: string) => {
        const labels: Record<string, { text: string; icon: React.ReactNode }> = {
            MARKETING: { text: 'Marketing', icon: <Megaphone className="w-3.5 h-3.5" /> },
            UTILITY: { text: 'Utilidad', icon: <Shield className="w-3.5 h-3.5" /> },
            AUTHENTICATION: { text: 'Autenticación', icon: <Key className="w-3.5 h-3.5" /> },
        };
        return labels[cat] || { text: cat, icon: null };
    };

    const handleCreateTemplate = async () => {
        if (!newTplName || !newTplBody || !newTplDisplayName) {
            setError('Complete los campos obligatorios: nombre técnico, nombre visible y cuerpo del mensaje.');
            return;
        }
        setIsCreatingTemplate(true);
        setError('');
        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            const response = await fetch('/admin/bulk-sends/templates/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    name: newTplName,
                    display_name: newTplDisplayName,
                    category: newTplCategory,
                    language: newTplLanguage,
                    header_format: newTplHeaderFormat !== 'NONE' ? newTplHeaderFormat : null,
                    header_text: newTplHeaderFormat === 'TEXT' ? newTplHeader || null : null,
                    header_media_url: ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(newTplHeaderFormat) ? newTplHeaderMediaUrl || null : null,
                    body_text: newTplBody,
                    footer_text: newTplFooter || null,
                }),
            });
            const data = await response.json();
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
                setError(data.message || 'Error al crear la plantilla');
            }
        } catch {
            setError('Error al enviar la plantilla a Meta');
        } finally {
            setIsCreatingTemplate(false);
        }
    };

    const handleSyncTemplates = async () => {
        setIsSyncing(true);
        setError('');
        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            const response = await fetch('/admin/bulk-sends/templates/sync', {
                method: 'POST',
                headers: { 'X-CSRF-TOKEN': csrfToken, 'Accept': 'application/json' },
            });
            const data = await response.json();
            if (data.success) {
                setSuccess(data.message);
                setTimeout(() => setSuccess(''), 5000);
                router.reload();
            } else {
                setError(data.message || 'Error al sincronizar');
            }
        } catch {
            setError('Error al sincronizar plantillas');
        } finally {
            setIsSyncing(false);
        }
    };

    const handleDeleteTemplate = async (id: number, name: string) => {
        if (!confirm(`¿Eliminar la plantilla "${name}"? Esto también la eliminará de Meta.`)) return;
        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            const response = await fetch(`/admin/bulk-sends/templates/${id}`, {
                method: 'DELETE',
                headers: { 'X-CSRF-TOKEN': csrfToken, 'Accept': 'application/json' },
            });
            const data = await response.json();
            if (data.success) {
                setSuccess(data.message);
                setTimeout(() => setSuccess(''), 5000);
                router.reload();
            } else {
                setError(data.message || 'Error al eliminar');
            }
        } catch {
            setError('Error al eliminar la plantilla');
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
            <Head title="Envío Masivo" />

            <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
                <div className="max-w-7xl mx-auto">
                    {/* Header + Tabs */}
                    <div className="mb-6 flex flex-col gap-[var(--space-md)]">
                        <div>
                            <h1 className="font-bold settings-title" style={{ fontSize: 'var(--text-3xl)' }}>
                                Envío Masivo
                            </h1>
                            <p className="settings-subtitle" style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-xs)' }}>
                                Envía mensajes de WhatsApp a múltiples números usando templates aprobados
                            </p>
                        </div>
                        <div className="flex gap-1 bg-muted/50 p-1 rounded-xl w-fit">
                            <button
                                onClick={() => setActiveTab('send')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                    activeTab === 'send'
                                        ? 'bg-white dark:bg-gray-800 shadow-sm text-foreground'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <Send className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
                                Enviar
                            </button>
                            <button
                                onClick={() => setActiveTab('templates')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                                    activeTab === 'templates'
                                        ? 'bg-white dark:bg-gray-800 shadow-sm text-foreground'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <MessageSquareText className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
                                Plantillas ({allTemplates.length})
                            </button>
                        </div>
                    </div>

                    {/* Alertas */}
                    <div className="mb-6 space-y-4">
                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                                <p className="text-sm text-red-700">{error}</p>
                                <button onClick={() => setError('')} className="ml-auto">
                                    <X className="w-4 h-4 text-red-500" />
                                </button>
                            </div>
                        )}

                        {success && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                                <p className="text-sm text-green-700">{success}</p>
                                <button onClick={() => setSuccess('')} className="ml-auto">
                                    <X className="w-4 h-4 text-green-500" />
                                </button>
                            </div>
                        )}
                    </div>

                    {activeTab === 'send' && (<>
                    {/* Progreso activo */}
                    {isProcessing && activeProgress && (
                        <div className="card-gradient rounded-2xl border border-white/40 dark:border-white/10 p-5 shadow-lg shadow-[#2e3f84]/5 mb-6 transition-all duration-300">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                    <h3 className="font-semibold settings-title" style={{ fontSize: 'var(--text-lg)' }}>
                                        Envío en progreso: {activeProgress.name}
                                    </h3>
                                </div>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleCancel(activeProgress.id)}
                                    className="rounded-xl"
                                >
                                    <StopCircle className="w-4 h-4 mr-1" />
                                    Cancelar
                                </Button>
                            </div>

                            <div className="space-y-2">
                                <div className="w-full bg-blue-200 rounded-full h-3">
                                    <div
                                        className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                                        style={{ width: `${activeProgress.percentage}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-sm text-blue-800 font-medium">
                                    <span>Template: {activeProgress.template_name}</span>
                                    <span>{activeProgress.percentage}%</span>
                                </div>
                                <div className="grid grid-cols-4 gap-3 mt-4">
                                    <div className="text-center p-3 bg-blue-50/50 rounded">
                                        <div className="text-xl font-bold text-blue-900">{activeProgress.total}</div>
                                        <div className="text-xs text-blue-700 uppercase tracking-wide">Total</div>
                                    </div>
                                    <div className="text-center p-3 bg-green-50/50 rounded">
                                        <div className="text-xl font-bold text-green-700">{activeProgress.sent}</div>
                                        <div className="text-xs text-green-600 uppercase tracking-wide">Enviados</div>
                                    </div>
                                    <div className="text-center p-3 bg-red-50/50 rounded">
                                        <div className="text-xl font-bold text-red-700">{activeProgress.failed}</div>
                                        <div className="text-xs text-red-600 uppercase tracking-wide">Fallidos</div>
                                    </div>
                                    <div className="text-center p-3 bg-yellow-50/50 rounded">
                                        <div className="text-xl font-bold text-yellow-700">{activeProgress.pending}</div>
                                        <div className="text-xs text-yellow-600 uppercase tracking-wide">Pendientes</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Formulario de envío */}
                    {!isProcessing && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[var(--space-lg)] mb-8">

                            {/* Columna izquierda: Template y destinatarios */}
                            <div className="space-y-[var(--space-lg)]">
                                {/* Seleccionar Template */}
                                <div className="card-gradient rounded-2xl border border-white/40 dark:border-white/10 p-5 shadow-lg shadow-[#2e3f84]/5 transition-all duration-300 hover:shadow-xl hover:shadow-[#2e3f84]/10">
                                    <h2 className="font-semibold flex items-center gap-2 mb-4 settings-title" style={{ fontSize: 'var(--text-lg)' }}>
                                        <MessageSquareText className="w-5 h-5" />
                                        Seleccionar Plantilla
                                    </h2>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block font-semibold mb-2 settings-label" style={{ fontSize: 'var(--text-sm)' }}>
                                                Nombre descriptivo del envío (opcional)
                                            </label>
                                            <input
                                                type="text"
                                                value={sendName}
                                                onChange={(e) => setSendName(e.target.value)}
                                                placeholder="Ej: Aviso contrato policía - Feb 2026"
                                                className="w-full settings-input rounded-xl border-gray-200 dark:border-gray-800 transition-all duration-200 focus:ring-2 focus:ring-[#2e3f84]/30"
                                                style={{ height: 'clamp(2.25rem, 2.25rem + 0.15vw, 2.5rem)', fontSize: 'var(--text-sm)' }}
                                            />
                                        </div>

                                        <div>
                                            <label className="block font-semibold mb-2 settings-label" style={{ fontSize: 'var(--text-sm)' }}>
                                                Plantilla de WhatsApp *
                                            </label>
                                            {whatsappTemplates.length > 0 ? (
                                                <div className="space-y-3">
                                                    <div className="relative">
                                                        <select
                                                            value={selectedTemplate?.id || ''}
                                                            onChange={(e) => handleSelectTemplate(e.target.value)}
                                                            className="w-full settings-input rounded-xl border-gray-200 dark:border-gray-800 transition-all duration-200 appearance-none pr-10 cursor-pointer focus:ring-2 focus:ring-[#2e3f84]/30"
                                                            style={{ height: 'clamp(2.25rem, 2.25rem + 0.15vw, 2.5rem)', fontSize: 'var(--text-sm)' }}
                                                        >
                                                            <option value="">— Seleccione una plantilla —</option>
                                                            {whatsappTemplates.map((t) => (
                                                                <option key={t.id} value={t.id}>
                                                                    {t.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                                                    </div>

                                                    {/* Preview del template seleccionado */}
                                                    {selectedTemplate && (
                                                        <div className="border border-border/60 rounded-lg overflow-hidden">
                                                            <button
                                                                onClick={() => setShowPreview(!showPreview)}
                                                                className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
                                                            >
                                                                <span className="flex items-center gap-2 text-sm font-medium text-foreground/80">
                                                                    <Eye className="w-4 h-4" />
                                                                    Vista previa del mensaje
                                                                </span>
                                                                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${showPreview ? 'rotate-180' : ''}`} />
                                                            </button>
                                                            {showPreview && (
                                                                <div className="px-4 py-3 bg-green-50/60 dark:bg-green-950/20 border-t border-border/40">
                                                                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border border-green-200/60 dark:border-green-800/40 max-w-sm">
                                                                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                                                                            {selectedTemplate.preview_text || 'Sin texto de previsualización disponible.'}
                                                                        </p>
                                                                    </div>
                                                                    <p className="text-xs text-muted-foreground mt-2">
                                                                        Template Meta: <span className="font-mono font-medium">{selectedTemplate.meta_template_name}</span> · Idioma: {selectedTemplate.language}
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="text-center py-6 border-2 border-dashed border-border/50 rounded-lg">
                                                    <MessageSquareText className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                                                    <p className="text-sm text-muted-foreground">
                                                        No hay plantillas configuradas.
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        Primero apruebe el template en Meta Business y luego agreguelo en la base de datos.
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Parámetros del template (solo si hay template seleccionado y tiene params) */}
                                        {selectedTemplate && (
                                            <div>
                                                <label className="block font-semibold mb-2 settings-label" style={{ fontSize: 'var(--text-sm)' }}>
                                                    Parámetros del Template (opcionales)
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
                                                            placeholder={`Valor para {{${templateParams.length + 1}}}`}
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
                                <div className="card-gradient rounded-2xl border border-white/40 dark:border-white/10 p-5 shadow-lg shadow-[#2e3f84]/5 transition-all duration-300 hover:shadow-xl hover:shadow-[#2e3f84]/10">
                                    <h2 className="font-semibold flex items-center gap-2 mb-4 settings-title" style={{ fontSize: 'var(--text-lg)' }}>
                                        <Upload className="w-5 h-5" />
                                        Cargar destinatarios
                                    </h2>

                                    <div
                                        onDrop={handleDrop}
                                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                                        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors space-y-3 ${isDragging
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                                                : 'border-gray-300 hover:border-gray-400 dark:border-gray-600'
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
                                                <p className="text-sm text-muted-foreground">Procesando archivo...</p>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex justify-center">
                                                    <FileSpreadsheet className="w-10 h-10 text-muted-foreground" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-foreground">
                                                        Arrastra un archivo Excel aquí
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        .xlsx, .xls, .csv · Columnas: teléfono, nombre, y parámetros extra (fecha, hora, etc.)
                                                    </p>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    {uploadedFileName && (
                                        <div className="mt-3 space-y-1">
                                            <p className="text-sm text-green-600 flex items-center gap-1 font-medium">
                                                <CheckCircle2 className="w-4 h-4" />
                                                Archivo cargado: {uploadedFileName}
                                            </p>
                                            {extraColumns.length > 0 && (
                                                <p className="text-xs text-blue-600 font-medium">
                                                    Columnas extra detectadas: {extraColumns.join(', ')} — se enviarán como parámetros por destinatario
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Agregar manual */}
                                <div className="card-gradient rounded-2xl border border-white/40 dark:border-white/10 p-5 shadow-lg shadow-[#2e3f84]/5 transition-all duration-300 hover:shadow-xl hover:shadow-[#2e3f84]/10">
                                    <h2 className="font-semibold flex items-center gap-2 mb-4 settings-title" style={{ fontSize: 'var(--text-lg)' }}>
                                        <Phone className="w-5 h-5" />
                                        Agregar número
                                    </h2>

                                    <div className="flex gap-2">
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
                                            placeholder="Nombre (opc)"
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
                            <div className="space-y-[var(--space-lg)]">
                                <div className="card-gradient rounded-2xl border border-white/40 dark:border-white/10 p-5 shadow-lg shadow-[#2e3f84]/5 h-full flex flex-col transition-all duration-300 hover:shadow-xl hover:shadow-[#2e3f84]/10">
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="font-semibold settings-title" style={{ fontSize: 'var(--text-lg)' }}>
                                            Destinatarios ({recipients.length})
                                        </h2>
                                        {recipients.length > 0 && (
                                            <Button variant="ghost" size="sm" onClick={clearRecipients} className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl">
                                                <Trash2 className="w-4 h-4 mr-1" />
                                                Limpiar
                                            </Button>
                                        )}
                                    </div>

                                    {recipients.length === 0 ? (
                                        <div className="text-center py-12 text-muted-foreground flex-1 flex flex-col items-center justify-center">
                                            <Send className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                            <p className="text-sm">No hay destinatarios aún</p>
                                        </div>
                                    ) : (
                                        <div className="flex-1 max-h-[500px] overflow-y-auto mb-4 border border-gray-200 dark:border-gray-800 rounded-xl bg-background/50">
                                            {recipients.map((r, index) => (
                                                <div
                                                    key={index}
                                                    className="flex items-center justify-between py-2 px-3 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-muted/50 text-sm"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xs text-muted-foreground w-6 text-right">
                                                            {index + 1}
                                                        </span>
                                                        <span className="font-mono font-medium">{r.phone}</span>
                                                        {r.name && (
                                                            <span className="text-muted-foreground">— {r.name}</span>
                                                        )}
                                                        {r.params && Object.keys(r.params).length > 0 && (
                                                            <span className="text-xs text-blue-500 ml-1">
                                                                ({Object.values(r.params).join(', ')})
                                                            </span>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={() => removeRecipient(index)}
                                                        className="text-red-400 hover:text-red-600 p-1"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Botón de enviar con estilo personalizado */}
                                    {recipients.length > 0 && (
                                        <div className="pt-4 mt-auto">
                                            <Button
                                                onClick={handleStartSend}
                                                disabled={isSending || !selectedTemplate}
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
                                                        Iniciando envío...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Send className="w-5 h-5 mr-2" />
                                                        Enviar a {recipients.length} destinatarios
                                                    </>
                                                )}
                                            </Button>
                                            {!selectedTemplate && (
                                                <p className="text-xs text-red-500 mt-2 text-center font-medium">
                                                    Seleccione una plantilla antes de enviar
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Historial de envíos - Estilo Card Gradient */}
                    <div className="card-gradient rounded-2xl border border-white/40 dark:border-white/10 p-5 shadow-lg shadow-[#2e3f84]/5 transition-all duration-300 hover:shadow-xl hover:shadow-[#2e3f84]/10">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                            <h2 className="font-semibold flex items-center gap-2 settings-title" style={{ fontSize: 'var(--text-lg)' }}>
                                <Clock className="w-5 h-5" />
                                Historial de envíos ({filteredBulkSends.length})
                            </h2>
                            <div className="relative">
                                {isSearching ? (
                                    <Loader2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-primary animate-spin" />
                                ) : (
                                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                )}
                                <Input
                                    value={historySearch}
                                    onChange={(e) => setHistorySearch(e.target.value)}
                                    placeholder="Buscar por nombre, teléfono, template, destinatario..."
                                    className="pl-9 h-9 text-sm rounded-xl w-full sm:w-80"
                                />
                            </div>
                        </div>

                        {filteredBulkSends.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-6">
                                {isSearching ? 'Buscando...' : historySearch.trim() ? 'No se encontraron resultados' : 'No hay envíos masivos registrados'}
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border/50">
                                            <th className="text-left py-3 px-3 font-semibold text-foreground/70">Nombre</th>
                                            <th className="text-left py-3 px-3 font-semibold text-foreground/70">Template</th>
                                            <th className="text-center py-3 px-3 font-semibold text-foreground/70">Estado</th>
                                            <th className="text-center py-3 px-3 font-semibold text-foreground/70">Total</th>
                                            <th className="text-center py-3 px-3 font-semibold text-foreground/70">Enviados</th>
                                            <th className="text-center py-3 px-3 font-semibold text-foreground/70">Fallidos</th>
                                            <th className="text-left py-3 px-3 font-semibold text-foreground/70">Creado por</th>
                                            <th className="text-left py-3 px-3 font-semibold text-foreground/70">Fecha</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredBulkSends.map((bs) => {
                                            const status = statusLabel(bs.status);
                                            const hasMatches = bs.matching_recipients && bs.matching_recipients.length > 0;
                                            return (
                                                <React.Fragment key={bs.id}>
                                                    <tr
                                                        className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                                                        onClick={() => router.visit(`/admin/bulk-sends/${bs.id}`)}
                                                    >
                                                        <td className="py-3 px-3 font-medium text-primary hover:underline">{bs.name || '—'}</td>
                                                        <td className="py-3 px-3 font-mono text-xs text-muted-foreground">{bs.template_name}</td>
                                                        <td className="py-3 px-3 text-center">
                                                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${status.color}`}>
                                                                {status.text}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-3 text-center font-medium">{bs.total_recipients}</td>
                                                        <td className="py-3 px-3 text-center text-green-600 font-bold">{bs.sent_count}</td>
                                                        <td className="py-3 px-3 text-center text-red-600 font-bold">{bs.failed_count}</td>
                                                        <td className="py-3 px-3 text-muted-foreground">{bs.created_by_name}</td>
                                                        <td className="py-3 px-3 text-muted-foreground text-xs">{bs.created_at}</td>
                                                    </tr>
                                                    {hasMatches && (
                                                        <tr key={`${bs.id}-matches`}>
                                                            <td colSpan={8} className="p-0">
                                                                <div className="bg-muted/40 dark:bg-muted/20 border-b border-border/50 px-4 py-3">
                                                                    <p className="text-xs font-semibold text-primary/80 mb-2 flex items-center gap-1.5">
                                                                        <Eye className="w-3.5 h-3.5" />
                                                                        {bs.matching_recipients!.length} destinatario{bs.matching_recipients!.length !== 1 ? 's' : ''} encontrado{bs.matching_recipients!.length !== 1 ? 's' : ''}
                                                                    </p>
                                                                    <table className="w-full text-xs">
                                                                        <thead>
                                                                            <tr className="text-muted-foreground">
                                                                                <th className="text-left py-1 px-2 font-medium">Nombre</th>
                                                                                <th className="text-left py-1 px-2 font-medium">Teléfono</th>
                                                                                <th className="text-center py-1 px-2 font-medium">Estado</th>
                                                                                <th className="text-left py-1 px-2 font-medium">Enviado</th>
                                                                                <th className="text-left py-1 px-2 font-medium">Error</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {bs.matching_recipients!.map((r) => {
                                                                                const rStatus = statusLabel(r.status);
                                                                                return (
                                                                                    <tr key={r.id} className="border-t border-border/30">
                                                                                        <td className="py-1.5 px-2 text-foreground">{r.contact_name || '—'}</td>
                                                                                        <td className="py-1.5 px-2 font-mono text-foreground font-medium">{r.phone_number}</td>
                                                                                        <td className="py-1.5 px-2 text-center">
                                                                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${rStatus.color}`}>
                                                                                                {rStatus.text}
                                                                                            </span>
                                                                                        </td>
                                                                                        <td className="py-1.5 px-2 text-muted-foreground">{r.sent_at || '—'}</td>
                                                                                        <td className="py-1.5 px-2 text-red-500 max-w-[200px] truncate">{r.error || '—'}</td>
                                                                                    </tr>
                                                                                );
                                                                            })}
                                                                        </tbody>
                                                                    </table>
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
                        <div className="space-y-6">
                            {/* Actions bar */}
                            <div className="flex flex-wrap items-center gap-3">
                                <Button
                                    onClick={() => setShowCreateModal(true)}
                                    className="font-semibold text-white transition-all duration-200 border-0 rounded-xl"
                                    style={{
                                        backgroundColor: 'var(--primary-base)',
                                        backgroundImage: 'var(--gradient-shine)',
                                    }}
                                >
                                    <FilePlus2 className="w-4 h-4 mr-2" />
                                    Crear Plantilla
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={handleSyncTemplates}
                                    disabled={isSyncing}
                                    className="rounded-xl"
                                >
                                    <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                                    {isSyncing ? 'Sincronizando...' : 'Sincronizar con Meta'}
                                </Button>
                            </div>

                            {/* Templates list */}
                            <div className="card-gradient rounded-2xl border border-white/40 dark:border-white/10 p-5 shadow-lg shadow-[#2e3f84]/5 transition-all duration-300">
                                <h2 className="font-semibold flex items-center gap-2 mb-4 settings-title" style={{ fontSize: 'var(--text-lg)' }}>
                                    <MessageSquareText className="w-5 h-5" />
                                    Plantillas de WhatsApp ({allTemplates.length})
                                </h2>

                                {allTemplates.length === 0 ? (
                                    <div className="text-center py-12">
                                        <MessageSquareText className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                                        <p className="text-sm text-muted-foreground">No hay plantillas registradas.</p>
                                        <p className="text-xs text-muted-foreground mt-1">Cree una nueva plantilla para enviarla a revisión en Meta.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-border/50">
                                                    <th className="text-left py-3 px-3 font-semibold text-foreground/70">Nombre</th>
                                                    <th className="text-left py-3 px-3 font-semibold text-foreground/70">Nombre Meta</th>
                                                    <th className="text-center py-3 px-3 font-semibold text-foreground/70">Categoría</th>
                                                    <th className="text-center py-3 px-3 font-semibold text-foreground/70">Idioma</th>
                                                    <th className="text-center py-3 px-3 font-semibold text-foreground/70">Estado</th>
                                                    <th className="text-left py-3 px-3 font-semibold text-foreground/70">Preview</th>
                                                    <th className="text-left py-3 px-3 font-semibold text-foreground/70">Creada</th>
                                                    <th className="text-center py-3 px-3 font-semibold text-foreground/70">Acciones</th>
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
                                                                    title="Eliminar plantilla"
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
                    {showCreateModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                            <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
                                <div className="flex items-center justify-between p-5 border-b border-border">
                                    <h2 className="font-bold text-lg settings-title flex items-center gap-2">
                                        <FilePlus2 className="w-5 h-5" />
                                        Crear Plantilla de WhatsApp
                                    </h2>
                                    <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground p-1">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="p-5 space-y-4">
                                    {/* Display Name */}
                                    <div>
                                        <label className="block font-semibold mb-1.5 settings-label text-sm">
                                            Nombre visible *
                                        </label>
                                        <input
                                            type="text"
                                            value={newTplDisplayName}
                                            onChange={(e) => handleDisplayNameChange(e.target.value)}
                                            placeholder="Ej: Recordatorio de cita médica"
                                            className="w-full settings-input rounded-xl border-gray-200 dark:border-gray-800 h-10 text-sm"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">Nombre que se mostrará en la aplicación.</p>
                                    </div>

                                    {/* Technical Name */}
                                    <div>
                                        <label className="block font-semibold mb-1.5 settings-label text-sm">
                                            Nombre técnico (Meta) *
                                        </label>
                                        <input
                                            type="text"
                                            value={newTplName}
                                            onChange={(e) => setNewTplName(e.target.value.replace(/[^a-z0-9_]/g, ''))}
                                            placeholder="recordatorio_cita_medica"
                                            className="w-full settings-input rounded-xl border-gray-200 dark:border-gray-800 h-10 text-sm font-mono"
                                        />
                                        <p className="text-xs text-muted-foreground mt-1">Solo letras minúsculas, números y guiones bajos. Se genera automáticamente.</p>
                                    </div>

                                    {/* Category + Language row */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block font-semibold mb-1.5 settings-label text-sm">
                                                Categoría *
                                            </label>
                                            <div className="relative">
                                                <select
                                                    value={newTplCategory}
                                                    onChange={(e) => setNewTplCategory(e.target.value as 'MARKETING' | 'UTILITY' | 'AUTHENTICATION')}
                                                    className="w-full settings-input rounded-xl border-gray-200 dark:border-gray-800 h-10 text-sm appearance-none pr-10 cursor-pointer"
                                                >
                                                    <option value="UTILITY">Utilidad</option>
                                                    <option value="MARKETING">Marketing</option>
                                                    <option value="AUTHENTICATION">Autenticación</option>
                                                </select>
                                                <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block font-semibold mb-1.5 settings-label text-sm">
                                                Idioma *
                                            </label>
                                            <div className="relative">
                                                <select
                                                    value={newTplLanguage}
                                                    onChange={(e) => setNewTplLanguage(e.target.value)}
                                                    className="w-full settings-input rounded-xl border-gray-200 dark:border-gray-800 h-10 text-sm appearance-none pr-10 cursor-pointer"
                                                >
                                                    <option value="es">Español</option>
                                                    <option value="es_CO">Español (Colombia)</option>
                                                    <option value="es_MX">Español (México)</option>
                                                    <option value="es_AR">Español (Argentina)</option>
                                                    <option value="en">Inglés</option>
                                                    <option value="en_US">Inglés (US)</option>
                                                    <option value="pt_BR">Portugués (Brasil)</option>
                                                </select>
                                                <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Header (optional) */}
                                    <div>
                                        <label className="block font-semibold mb-1.5 settings-label text-sm">
                                            Encabezado <span className="font-normal text-muted-foreground">(opcional)</span>
                                        </label>
                                        <div className="relative mb-2">
                                            <select
                                                value={newTplHeaderFormat}
                                                onChange={(e) => {
                                                    setNewTplHeaderFormat(e.target.value as 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT');
                                                    setNewTplHeader('');
                                                    setNewTplHeaderMediaUrl('');
                                                }}
                                                className="w-full settings-input rounded-xl border-gray-200 dark:border-gray-800 h-10 text-sm appearance-none pr-10 cursor-pointer"
                                            >
                                                <option value="NONE">Sin encabezado</option>
                                                <option value="TEXT">Texto</option>
                                                <option value="IMAGE">Imagen</option>
                                                <option value="VIDEO">Video</option>
                                                <option value="DOCUMENT">Documento</option>
                                            </select>
                                            <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                                        </div>
                                        {newTplHeaderFormat === 'TEXT' && (
                                            <input
                                                type="text"
                                                value={newTplHeader}
                                                onChange={(e) => setNewTplHeader(e.target.value)}
                                                placeholder="Ej: Hospital Universitario del Valle"
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
                                                        newTplHeaderFormat === 'IMAGE' ? 'https://ejemplo.com/imagen.jpg' :
                                                        newTplHeaderFormat === 'VIDEO' ? 'https://ejemplo.com/video.mp4' :
                                                        'https://ejemplo.com/documento.pdf'
                                                    }
                                                    className="w-full settings-input rounded-xl border-gray-200 dark:border-gray-800 h-10 text-sm"
                                                />
                                                <p className="text-xs text-muted-foreground">
                                                    {newTplHeaderFormat === 'IMAGE' && 'Formatos: JPG, PNG. Máx. 5 MB. URL pública accesible.'}
                                                    {newTplHeaderFormat === 'VIDEO' && 'Formatos: MP4. Máx. 16 MB. URL pública accesible.'}
                                                    {newTplHeaderFormat === 'DOCUMENT' && 'Formatos: PDF. Máx. 100 MB. URL pública accesible.'}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Body */}
                                    <div>
                                        <label className="block font-semibold mb-1.5 settings-label text-sm">
                                            Cuerpo del mensaje *
                                        </label>
                                        <textarea
                                            value={newTplBody}
                                            onChange={(e) => setNewTplBody(e.target.value)}
                                            placeholder={"Hola {{1}}, le recordamos su cita el {{2}} a las {{3}}.\n\nUse {{1}}, {{2}}, etc. para parámetros variables."}
                                            maxLength={1024}
                                            rows={5}
                                            className="w-full settings-input rounded-xl border-gray-200 dark:border-gray-800 text-sm resize-none p-3"
                                        />
                                        <div className="flex justify-between mt-1">
                                            <p className="text-xs text-muted-foreground">
                                                Use {'{{1}}'}, {'{{2}}'}, etc. para parámetros que cambian por destinatario.
                                            </p>
                                            <span className="text-xs text-muted-foreground">{newTplBody.length}/1024</span>
                                        </div>
                                    </div>

                                    {/* Footer (optional) */}
                                    <div>
                                        <label className="block font-semibold mb-1.5 settings-label text-sm">
                                            Pie de mensaje <span className="font-normal text-muted-foreground">(opcional, máx. 60 car.)</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={newTplFooter}
                                            onChange={(e) => setNewTplFooter(e.target.value)}
                                            placeholder="Ej: No responder a este mensaje"
                                            maxLength={60}
                                            className="w-full settings-input rounded-xl border-gray-200 dark:border-gray-800 h-10 text-sm"
                                        />
                                    </div>

                                    {/* Preview */}
                                    {newTplBody && (
                                        <div className="border border-border/60 rounded-xl overflow-hidden">
                                            <div className="px-4 py-2.5 bg-muted/40 border-b border-border/40">
                                                <span className="flex items-center gap-2 text-sm font-medium text-foreground/80">
                                                    <Eye className="w-4 h-4" />
                                                    Vista previa
                                                </span>
                                            </div>
                                            <div className="p-4 bg-green-50/60 dark:bg-green-950/20">
                                                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border border-green-200/60 dark:border-green-800/40 max-w-sm">
                                                    {newTplHeaderFormat === 'TEXT' && newTplHeader && (
                                                        <p className="text-sm font-bold text-foreground mb-1">{newTplHeader}</p>
                                                    )}
                                                    {newTplHeaderFormat === 'IMAGE' && (
                                                        <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-6 mb-2 flex flex-col items-center justify-center gap-1">
                                                            <Image className="w-8 h-8 text-muted-foreground" />
                                                            <span className="text-xs text-muted-foreground">Imagen</span>
                                                        </div>
                                                    )}
                                                    {newTplHeaderFormat === 'VIDEO' && (
                                                        <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-6 mb-2 flex flex-col items-center justify-center gap-1">
                                                            <Video className="w-8 h-8 text-muted-foreground" />
                                                            <span className="text-xs text-muted-foreground">Video</span>
                                                        </div>
                                                    )}
                                                    {newTplHeaderFormat === 'DOCUMENT' && (
                                                        <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-6 mb-2 flex flex-col items-center justify-center gap-1">
                                                            <FileText className="w-8 h-8 text-muted-foreground" />
                                                            <span className="text-xs text-muted-foreground">Documento</span>
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
                                            <strong>Nota:</strong> La plantilla será enviada a Meta para revisión. El proceso de aprobación puede tardar desde minutos hasta 24 horas.
                                            Una vez aprobada, use "Sincronizar con Meta" para actualizar el estado y poder usarla en envíos masivos.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 p-5 border-t border-border">
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowCreateModal(false)}
                                        className="rounded-xl"
                                    >
                                        Cancelar
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
                                                Enviando a Meta...
                                            </>
                                        ) : (
                                            <>
                                                <Send className="w-4 h-4 mr-2" />
                                                Enviar a revisión
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
