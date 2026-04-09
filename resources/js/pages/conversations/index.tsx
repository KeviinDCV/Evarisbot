import { Head, router, useForm, usePage } from '@inertiajs/react';
import AdminLayout from '@/layouts/admin-layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    Search,
    MessageSquare,
    Send,
    MoreVertical,
    Phone,
    Paperclip,
    Check,
    CheckCheck,
    X,
    PanelLeftClose,
    PanelLeftOpen,
    Clock,
    MapPin,
    User,
    FileAudio,
    Smile,
    ArrowDown,
    UserPlus,
    Trash2,
    Plus,
    AlertCircle,
    Filter,
    Users,
    ZoomIn,
    ZoomOut,
    RotateCcw,
    Download,
    Expand,
    CornerDownRight,
    CornerDownLeft,
    CheckSquare,
    Square,
    ListFilter,
    Tag,
    Pencil,
    SlidersHorizontal,
    ChevronDown,
    ChevronUp,
    Pin,
    ClipboardList,
    StickyNote,
    History,
    Eye,
    CalendarCheck,
    Stethoscope,
    FileText,
    Loader2,
} from 'lucide-react';
import { FormEvent, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { autoCorrectText, type CorrectionEvent } from '@/hooks/use-autocorrect';

interface Message {
    id: number;
    content: string;
    message_type: string;
    media_url?: string | null;
    transcription?: string | null;
    is_from_user: boolean;
    status: string;
    error_message?: string | null;
    created_at: string;
    sender?: {
        name: string;
    };
}

interface OptimisticMessage {
    tempId: string;
    content: string;
    message_type: string;
    media_url?: string | null;
    is_from_user: boolean;
    status: 'sending' | 'error';
    created_at: string;
    sender?: {
        name: string;
    };
}

interface Conversation {
    id: number;
    phone_number: string;
    contact_name: string | null;
    status: string;
    unread_count: number;
    assigned_to: number | null;
    assigned_user?: {
        name: string;
    };
    resolved_by?: number | null;
    resolved_at?: string | null;
    resolved_by_user?: {
        id: number;
        name: string;
    } | null;
    is_pinned?: boolean;
    pinned_at?: string | null;
    last_message_at: string | null;
    last_message: {
        content: string;
        created_at: string;
        is_from_user: boolean;
        status?: string;
        error_message?: string | null;
    } | null;
    messages?: Message[];
    tags?: TagItem[];
    notes?: string | null;
    specialty?: string | null;
    welcome_flow_data?: Record<string, { text?: string; button_id?: string; timestamp?: string }> | null;
}

interface Activity {
    id: number;
    type: string;
    user?: { id: number; name: string } | null;
    metadata?: Record<string, any> | null;
    created_at: string;
}

interface TagItem {
    id: number;
    name: string;
    color: string;
    conversations_count?: number;
}

interface User {
    id: number;
    name: string;
    role: string;
}

interface MediaFile {
    url: string;
    filename: string;
    type: 'image' | 'video' | 'document';
}

interface Template {
    id: number;
    name: string;
    content: string;
    message_type: string;
    media_url?: string | null;
    media_filename?: string | null;
    media_files?: MediaFile[];
}

interface WhatsappTemplate {
    id: number;
    name: string;
    meta_template_name: string;
    preview_text: string;
    language: string;
    header_text?: string | null;
    header_format?: string | null;
    header_media_url?: string | null;
    footer_text?: string | null;
    default_params?: string[] | null;
}

interface ConversationsIndexProps {
    conversations: Conversation[];
    hasMore?: boolean;
    selectedConversation?: Conversation;
    users: User[];
    allTags?: TagItem[];
    filters: {
        search?: string;
        status?: string;
        assigned?: string;
        tag?: string;
    };
    templates?: Template[];
    whatsappTemplates?: WhatsappTemplate[];
}

export default function ConversationsIndex({ conversations: initialConversations, hasMore: initialHasMore = false, selectedConversation, users, allTags: initialAllTags = [], filters, templates = [], whatsappTemplates = [] }: ConversationsIndexProps) {
    const { t } = useTranslation();
    const { auth } = usePage().props as any;
    const isAdmin = auth.user.role === 'admin';

    const [search, setSearch] = useState(filters.search || '');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSidebarVisible, setIsSidebarVisible] = useState(true);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [templateMediaFiles, setTemplateMediaFiles] = useState<MediaFile[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
    const [contextMenu, setContextMenu] = useState<{ conversationId: number; x: number; y: number } | null>(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [newChatData, setNewChatData] = useState({ phone_number: '', assigned_to: null as number | null, whatsapp_template_id: null as number | null, template_params: [] as string[] });
    const [newChatError, setNewChatError] = useState('');
    const [isCreatingChat, setIsCreatingChat] = useState(false);
    const [advisorSearchQuery, setAdvisorSearchQuery] = useState('');
    const [filterByAdvisor, setFilterByAdvisor] = useState<number | null>(
        filters.assigned && !isNaN(Number(filters.assigned)) ? Number(filters.assigned) : null
    );
    const [showAdvisorFilter, setShowAdvisorFilter] = useState(false);
    const [selectedConversations, setSelectedConversations] = useState<number[]>([]);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [isDragSelecting, setIsDragSelecting] = useState(false);
    const dragSelectionActionRef = useRef<'select' | 'deselect'>('select');
    const dragDidMoveRef = useRef(false);
    const [statusFilter, setStatusFilter] = useState<string>(filters.status || 'all');
    const [showStatusFilter, setShowStatusFilter] = useState(false);
    const [showBulkAssignMenu, setShowBulkAssignMenu] = useState(false);
    const [bulkAssignSearchQuery, setBulkAssignSearchQuery] = useState('');
    const [mediaViewer, setMediaViewer] = useState<{ url: string; type: 'image' | 'video'; caption?: string } | null>(null);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [imageRotation, setImageRotation] = useState(0);
    const [showPatientData, setShowPatientData] = useState(false);
    const [showNotes, setShowNotes] = useState(false);
    const [notesText, setNotesText] = useState(selectedConversation?.notes || '');
    const [savingNotes, setSavingNotes] = useState(false);
    const notesTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [showActivity, setShowActivity] = useState(false);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [typingUsers, setTypingUsers] = useState<Array<{ id: number; name: string }>>([]);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [viewingUsers, setViewingUsers] = useState<Array<{ id: number; name: string }>>([]);
    const viewingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const imageRef = useRef<HTMLImageElement>(null);
    const lastMessageIdRef = useRef<number>(0);

    // Estados para el modal de advertencia de 24 horas
    const [show24HourWarning, setShow24HourWarning] = useState(false);
    const [lastUserMessageInfo, setLastUserMessageInfo] = useState<{ date: string; hoursAgo: number } | null>(null);
    // Estado para modal de enviar plantilla WhatsApp
    const [showWaTemplateModal, setShowWaTemplateModal] = useState(false);
    const [waTemplateId, setWaTemplateId] = useState<number | null>(null);
    const [waTemplateParams, setWaTemplateParams] = useState<string[]>([]);
    const [isSendingWaTemplate, setIsSendingWaTemplate] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const conversationsListRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    // Ref para pausar polling mientras el usuario hace scroll en la lista de chats
    const isScrollingChatsRef = useRef(false);
    const scrollingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const savedScrollTopRef = useRef<number | null>(null);
    const advisorFilterButtonRef = useRef<HTMLButtonElement>(null);
    const filterPillsRef = useRef<HTMLDivElement>(null);
    const [advisorDropdownPosition, setAdvisorDropdownPosition] = useState({ top: 0, right: 0 });

    // Estados para plantillas
    const [showTemplates, setShowTemplates] = useState(false);
    const [templateFilter, setTemplateFilter] = useState('');
    const [selectedTemplateIndex, setSelectedTemplateIndex] = useState(0);

    // Estados para etiquetas
    const [allTags, setAllTags] = useState<TagItem[]>(initialAllTags);
    const [showTagSubmenu, setShowTagSubmenu] = useState(false);
    const [showSpecialtyInput, setShowSpecialtyInput] = useState(false);
    const [specialtyName, setSpecialtyName] = useState('');
    const [tagSearch, setTagSearch] = useState('');
    const [newTagName, setNewTagName] = useState('');
    const [newTagColor, setNewTagColor] = useState('#6366f1');
    const [tagFilterId, setTagFilterId] = useState<number | null>(
        filters.tag && !isNaN(Number(filters.tag)) ? Number(filters.tag) : null
    );
    const [showTagFilter, setShowTagFilter] = useState(false);
    const [tagDropdownPosition, setTagDropdownPosition] = useState({ top: 0, right: 0 });
    const tagFilterButtonRef = useRef<HTMLButtonElement>(null);
    const [editingTag, setEditingTag] = useState<{ id: number; name: string; color: string } | null>(null);

    // Autocorrección
    const [lastCorrection, setLastCorrection] = useState<CorrectionEvent | null>(null);
    const [previousTextRef] = useState({ current: '' });
    const correctionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Panel unificado de filtros
    const [showFiltersPanel, setShowFiltersPanel] = useState(false);
    const [expandedFilterSection, setExpandedFilterSection] = useState<string | null>(null);
    const filtersPanelRef = useRef<HTMLDivElement>(null);

    const TAG_COLORS = ['#6366f1', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6'];

    // Funciones de etiquetas
    const createTag = async (name: string, color: string) => {
        try {
            // Check if tag already exists locally
            const existing = allTags.find(t => t.name.toLowerCase() === name.toLowerCase());
            if (existing) return existing;

            const res = await fetch('/admin/tags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '' },
                body: JSON.stringify({ name, color }),
            });
            if (res.ok) {
                const tag = await res.json();
                setAllTags(prev => [...prev, { ...tag, conversations_count: 0 }].sort((a, b) => a.name.localeCompare(b.name)));
                return tag;
            }
            // If 422 (duplicate), try to find it from server
            if (res.status === 422) {
                const tagsRes = await fetch('/admin/tags');
                if (tagsRes.ok) {
                    const tags = await tagsRes.json();
                    const found = tags.find((t: any) => t.name.toLowerCase() === name.toLowerCase());
                    if (found) {
                        setAllTags(tags.sort((a: any, b: any) => a.name.localeCompare(b.name)));
                        return found;
                    }
                }
            }
        } catch { }
        return null;
    };

    const attachTag = async (conversationId: number, tagId: number) => {
        try {
            await fetch(`/admin/tags/conversation/${conversationId}/attach`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '' },
                body: JSON.stringify({ tag_id: tagId }),
            });
            router.reload({ only: ['conversations', 'selectedConversation', 'allTags'] });
        } catch { }
    };

    const detachTag = async (conversationId: number, tagId: number) => {
        try {
            await fetch(`/admin/tags/conversation/${conversationId}/detach/${tagId}`, {
                method: 'DELETE',
                headers: { 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '' },
            });
            router.reload({ only: ['conversations', 'selectedConversation', 'allTags'] });
        } catch { }
    };

    const deleteTag = async (tagId: number) => {
        if (!confirm('¿Eliminar esta etiqueta? Se quitará de todas las conversaciones.')) return;
        try {
            await fetch(`/admin/tags/${tagId}`, {
                method: 'DELETE',
                headers: { 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '' },
            });
            setAllTags(prev => prev.filter(t => t.id !== tagId));
            if (tagFilterId === tagId) {
                setTagFilterId(null);
                applyFiltersWithTag(statusFilter, filterByAdvisor, null);
            }
            setEditingTag(null);
            router.reload({ only: ['conversations', 'selectedConversation'] });
        } catch { }
    };

    const updateTag = async (tagId: number, name: string, color: string) => {
        try {
            const res = await fetch(`/admin/tags/${tagId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({ name, color }),
            });
            if (res.ok) {
                const updated = await res.json();
                setAllTags(prev => prev.map(t => t.id === tagId ? { ...t, name: updated.name, color: updated.color } : t));
                setEditingTag(null);
                router.reload({ only: ['conversations', 'selectedConversation'] });
            }
        } catch { }
    };

    // Filtrar plantillas basadas en el texto después de /
    const filteredTemplates = templates.filter(template =>
        template.name.toLowerCase().includes(templateFilter.toLowerCase())
    );

    // Manejar cambios en el input de mensaje
    const handleMessageChange = (value: string) => {
        // Aplicar autocorrección
        const { correctedText, wasChanged, original, corrected } = autoCorrectText(value, previousTextRef.current);
        const finalValue = wasChanged ? correctedText : value;
        previousTextRef.current = finalValue;

        if (wasChanged) {
            // Mostrar notificación sutil de corrección
            setLastCorrection({ original, corrected, timestamp: Date.now() });
            if (correctionTimeoutRef.current) clearTimeout(correctionTimeoutRef.current);
            correctionTimeoutRef.current = setTimeout(() => setLastCorrection(null), 2500);
        }

        setData('content', finalValue);

        // Detectar el comando /
        const cursorPosition = finalValue.length;
        const lastSlashIndex = finalValue.lastIndexOf('/');

        if (lastSlashIndex !== -1) {
            // Verificar si / está al inicio o después de un espacio
            const beforeSlash = finalValue[lastSlashIndex - 1];
            const isValidSlash = lastSlashIndex === 0 || beforeSlash === ' ';

            if (isValidSlash) {
                const textAfterSlash = finalValue.substring(lastSlashIndex + 1);
                const hasSpaceAfterSlash = textAfterSlash.includes(' ');

                if (!hasSpaceAfterSlash) {
                    setShowTemplates(true);
                    setTemplateFilter(textAfterSlash);
                    setSelectedTemplateIndex(0);
                } else {
                    setShowTemplates(false);
                    setTemplateFilter('');
                }
            } else {
                setShowTemplates(false);
                setTemplateFilter('');
            }
        } else {
            setShowTemplates(false);
            setTemplateFilter('');
        }

        // Emit typing indicator
        emitTyping();
    };

    // Seleccionar una plantilla
    const selectTemplate = (template: Template) => {
        const currentValue = data.content;
        const lastSlashIndex = currentValue.lastIndexOf('/');
        const beforeSlash = currentValue.substring(0, lastSlashIndex);

        // Insertar el contenido de la plantilla
        setData('content', beforeSlash + template.content);

        // Guardar el ID de la plantilla para incrementar el contador al enviar
        setSelectedTemplateId(template.id);

        // Si la plantilla tiene archivos multimedia, guardarlos para enviar
        const mediaFiles = template.media_files || [];
        // Fallback al formato antiguo si no hay media_files
        if (mediaFiles.length === 0 && template.media_url) {
            mediaFiles.push({
                url: template.media_url,
                filename: template.media_filename || 'archivo',
                type: (template.message_type as 'image' | 'video' | 'document') || 'document',
            });
        }

        if (mediaFiles.length > 0) {
            setTemplateMediaFiles(mediaFiles);
            // Limpiar archivo seleccionado manualmente (la plantilla tiene prioridad)
            setSelectedFile(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        } else {
            setTemplateMediaFiles([]);
        }

        setShowTemplates(false);
        setTemplateFilter('');
        setSelectedTemplateIndex(0);
    };

    // Manejar teclas de navegación para plantillas
    const handleTemplateKeyDown = (e: React.KeyboardEvent) => {
        if (!showTemplates || filteredTemplates.length === 0) {
            if (e.key === 'Enter' && !e.shiftKey) {
                handleSubmit(e);
            }
            return;
        }

        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                setSelectedTemplateIndex(prev =>
                    prev === 0 ? filteredTemplates.length - 1 : prev - 1
                );
                break;
            case 'ArrowDown':
                e.preventDefault();
                setSelectedTemplateIndex(prev =>
                    prev === filteredTemplates.length - 1 ? 0 : prev + 1
                );
                break;
            case 'Enter':
                e.preventDefault();
                if (filteredTemplates[selectedTemplateIndex]) {
                    selectTemplate(filteredTemplates[selectedTemplateIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                setShowTemplates(false);
                setTemplateFilter('');
                setSelectedTemplateIndex(0);
                break;
            default:
                if (e.key === 'Enter' && !e.shiftKey && !showTemplates) {
                    handleSubmit(e);
                }
        }
    };

    // Estados para scroll infinito de conversaciones
    const [localConversations, setLocalConversations] = useState<Conversation[]>(initialConversations);
    const [hasMore, setHasMore] = useState(initialHasMore);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    // Ref para trackear si se cargaron páginas adicionales (para no resetear hasMore)
    const hasLoadedExtraPagesRef = useRef(false);

    // Estados para control de scroll inteligente
    const [isAtBottom, setIsAtBottom] = useState(true);
    const [newMessagesCount, setNewMessagesCount] = useState(0);
    const lastMessageCountRef = useRef(0);

    // Local messages state — initialized from server, incrementally updated by lightweight poll
    const [localMessages, setLocalMessages] = useState<Message[]>(selectedConversation?.messages || []);

    // Estados para mensajes optimistas (actualización instantánea)
    const [optimisticMessages, setOptimisticMessages] = useState<OptimisticMessage[]>([]);
    const messageCountBeforeSendRef = useRef<number>(0);

    const { data, setData, post, reset, processing } = useForm({
        content: '',
        media_file: null as File | null,
    });

    // Función para verificar si el usuario está cerca del final
    const checkIfAtBottom = useCallback(() => {
        const container = messagesContainerRef.current;
        if (!container) return true;

        const threshold = 100; // Píxeles de tolerancia
        const isBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
        return isBottom;
    }, []);

    // Función para ir al final del chat
    const scrollToBottom = useCallback((smooth = true) => {
        messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
        setIsAtBottom(true);
        setNewMessagesCount(0);
    }, []);

    // Scroll horizontal con rueda del mouse en filtros
    useEffect(() => {
        const el = filterPillsRef.current;
        if (!el) return;
        const handler = (e: WheelEvent) => {
            if (e.deltaY !== 0) {
                el.scrollLeft += e.deltaY;
                e.preventDefault();
            }
        };
        el.addEventListener('wheel', handler, { passive: false });
        return () => el.removeEventListener('wheel', handler);
    }, []);

    // Detectar scroll del usuario
    useEffect(() => {
        const container = messagesContainerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const atBottom = checkIfAtBottom();
            setIsAtBottom(atBottom);

            // Si el usuario llegó al final, limpiar contador de nuevos mensajes
            if (atBottom) {
                setNewMessagesCount(0);
            }
        };

        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, [checkIfAtBottom, selectedConversation?.id]);

    // Scroll automático al final SOLO si el usuario ya estaba al final
    useEffect(() => {
        if (localMessages.length === 0) return;

        const currentCount = localMessages.length;
        const previousCount = lastMessageCountRef.current;

        // Si es una nueva conversación, ir al final inmediatamente
        if (previousCount === 0 && currentCount > 0) {
            scrollToBottom(false);
            lastMessageCountRef.current = currentCount;
            return;
        }

        // Si hay nuevos mensajes
        if (currentCount > previousCount) {
            const newCount = currentCount - previousCount;

            if (isAtBottom) {
                // Si el usuario está al final, hacer scroll automático
                scrollToBottom();
            } else {
                // Si el usuario está leyendo arriba, mostrar indicador de nuevos mensajes
                setNewMessagesCount(prev => prev + newCount);
            }
        }

        lastMessageCountRef.current = currentCount;
    }, [localMessages, isAtBottom, scrollToBottom]);

    // Resetear cuando cambia la conversación
    useEffect(() => {
        lastMessageCountRef.current = 0;
        setNewMessagesCount(0);
        setIsAtBottom(true);
        setOptimisticMessages([]); // Limpiar mensajes optimistas al cambiar de conversación
        // Initialize local messages from server prop
        const msgs = selectedConversation?.messages || [];
        setLocalMessages(msgs);
        lastMessageIdRef.current = msgs.length > 0 ? Math.max(...msgs.map(m => m.id)) : 0;
        // Sync notes
        setNotesText(selectedConversation?.notes || '');
        setShowNotes(false);
        setShowActivity(false);
        setActivities([]);
    }, [selectedConversation?.id]);


    // Limpiar mensajes optimistas cuando llegan los mensajes reales (del poll o del servidor)
    useEffect(() => {
        if (optimisticMessages.length > 0 && localMessages.length > 0) {
            // Si local messages grew since we sent, clear optimistic
            if (localMessages.length > messageCountBeforeSendRef.current) {
                setOptimisticMessages([]);
            }
        }
    }, [localMessages.length, optimisticMessages.length]);

    // Ref para trackear el último filtro de búsqueda aplicado
    const lastSearchFilterRef = useRef<string>(filters.search || '');
    // Ref para trackear los últimos filtros de status y assigned
    const lastStatusFilterRef = useRef<string>(filters.status || 'all');
    const lastAssignedFilterRef = useRef<string>(filters.assigned || '');
    const lastTagFilterRef = useRef<string>(filters.tag || '');
    // Ref para trackear si había conversación seleccionada
    const lastSelectedConversationRef = useRef<number | null>(selectedConversation?.id || null);

    // Sincronizar conversaciones cuando cambian desde el servidor
    useEffect(() => {
        const currentSearchFilter = filters.search || '';
        const currentStatusFilter = filters.status || 'all';
        const currentAssignedFilter = filters.assigned || '';
        const currentTagFilter = filters.tag || '';

        const searchChanged = currentSearchFilter !== lastSearchFilterRef.current;
        const statusChanged = currentStatusFilter !== lastStatusFilterRef.current;
        const assignedChanged = currentAssignedFilter !== lastAssignedFilterRef.current;
        const tagChanged = currentTagFilter !== lastTagFilterRef.current;
        const selectedChanged = (selectedConversation?.id || null) !== lastSelectedConversationRef.current;

        // Actualizar refs
        lastSearchFilterRef.current = currentSearchFilter;
        lastStatusFilterRef.current = currentStatusFilter;
        lastAssignedFilterRef.current = currentAssignedFilter;
        lastTagFilterRef.current = currentTagFilter;
        lastSelectedConversationRef.current = selectedConversation?.id || null;

        // Si cambió algún filtro, resetear completamente
        if (searchChanged || statusChanged || assignedChanged || tagChanged) {
            setLocalConversations(initialConversations);
            setHasMore(initialHasMore);
            setCurrentPage(1);
            setNextCursor(null);
            hasLoadedExtraPagesRef.current = false;
            // Resetear scroll al inicio cuando cambian los filtros
            if (conversationsListRef.current) {
                conversationsListRef.current.scrollTop = 0;
            }
            return;
        }

        // Si solo cambió la selección (navegación), NO resetear las conversaciones cargadas
        // Solo actualizar los datos frescos de las conversaciones de la primera página
        setLocalConversations(prev => {
            // Si es la primera carga (prev vacío), usar initialConversations
            if (prev.length === 0) {
                return initialConversations;
            }

            // Crear mapa de datos frescos del servidor (primera página)
            const serverMap = new Map(initialConversations.map(c => [c.id, c]));

            // Actualizar in-place: mantener el mismo orden, solo actualizar datos
            let hasChanges = false;
            const updated = prev.map(conv => {
                const freshConv = serverMap.get(conv.id);
                if (freshConv) {
                    // Verificar si realmente cambió algo relevante
                    if (freshConv.unread_count !== conv.unread_count ||
                        freshConv.status !== conv.status ||
                        freshConv.last_message_at !== conv.last_message_at ||
                        freshConv.assigned_to !== conv.assigned_to ||
                        freshConv.contact_name !== conv.contact_name ||
                        freshConv.resolved_by !== conv.resolved_by ||
                        freshConv.is_pinned !== conv.is_pinned ||
                        freshConv.last_message?.status !== conv.last_message?.status ||
                        freshConv.last_message?.content !== conv.last_message?.content) {
                        hasChanges = true;
                        // El servidor ya devuelve is_pinned/pinned_at por usuario — confiar en él
                        return {
                            ...freshConv,
                            is_pinned: freshConv.is_pinned ?? false,
                            pinned_at: freshConv.pinned_at ?? null,
                        };
                    }
                    return conv; // Sin cambios, mantener referencia original
                }
                return conv; // No está en primera página, mantener
            }).filter(conv => {
                // Ocultar conversaciones resueltas/cerradas/agendadas de "Todos"
                // EXCEPTO si el filtro activo corresponde o hay filtro de etiqueta
                if (!filters.tag && filters.status !== 'oncology' && filters.status !== 'scheduled') {
                    if ((conv.status === 'resolved' || conv.status === 'closed') && filters.status !== 'resolved') return false;
                    if (conv.status === 'scheduled' && filters.status !== 'scheduled') return false;
                }
                return true;
            });

            // Detectar nuevas conversaciones que no existían
            const existingIds = new Set(prev.map(c => c.id));
            const newConvs = initialConversations.filter(c => !existingIds.has(c.id)).filter(conv => {
                if (!filters.tag && filters.status !== 'oncology' && filters.status !== 'scheduled') {
                    if ((conv.status === 'resolved' || conv.status === 'closed') && filters.status !== 'resolved') return false;
                    if (conv.status === 'scheduled' && filters.status !== 'scheduled') return false;
                }
                return true;
            });

            if (newConvs.length > 0) {
                hasChanges = true;
                // Insertar nuevas al inicio (son las más recientes)
                const result = [...newConvs, ...updated];
                return result;
            }

            // Si hubo cambios de datos o el filtro eliminó items, reordenar
            if (hasChanges || updated.length !== prev.length) {
                return updated.sort((a, b) => {
                    if (a.is_pinned && !b.is_pinned) return -1;
                    if (!a.is_pinned && b.is_pinned) return 1;
                    return new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime();
                });
            }

            // Sin cambios reales, devolver la misma referencia para evitar re-render
            return prev;
        });
    }, [initialConversations, filters.search, filters.status, filters.assigned, initialHasMore, selectedConversation?.id]);

    // Sincronizar allTags con props de Inertia
    useEffect(() => {
        setAllTags(initialAllTags);
    }, [initialAllTags]);

    // Función para cargar más conversaciones (scroll infinito)
    const loadMoreConversations = useCallback(async () => {
        if (isLoadingMore || !hasMore) return;

        setIsLoadingMore(true);
        const nextPage = currentPage + 1;

        try {
            // Construir URL con filtros activos
            const params = new URLSearchParams();
            params.set('page', String(nextPage));
            if (search) params.set('search', search);
            if (statusFilter !== 'all') params.set('status', statusFilter);
            if (filterByAdvisor !== null) params.set('assigned', String(filterByAdvisor));

            // Usar cursor-based pagination para evitar duplicados
            // Calcular cursor del último elemento cargado
            const lastConv = localConversations[localConversations.length - 1];
            if (lastConv?.last_message_at) {
                params.set('cursor', lastConv.last_message_at);
            } else if (nextCursor) {
                params.set('cursor', nextCursor);
            }

            const response = await fetch(`/admin/chat?${params.toString()}`, {
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
            });

            if (response.ok) {
                const data = await response.json();
                setLocalConversations(prev => {
                    // Deduplicar: solo agregar conversaciones que no existan ya
                    const existingIds = new Set(prev.map(c => c.id));
                    const newConvs = data.conversations.filter((c: Conversation) => !existingIds.has(c.id));
                    return [...prev, ...newConvs];
                });
                setHasMore(data.hasMore);
                setCurrentPage(nextPage);
                setNextCursor(data.nextCursor || null);
                // Marcar que se cargaron páginas adicionales
                hasLoadedExtraPagesRef.current = true;
            }
        } catch (error) {
            console.error('Error cargando más conversaciones:', error);
        } finally {
            setIsLoadingMore(false);
        }
    }, [isLoadingMore, hasMore, currentPage, search, statusFilter, filterByAdvisor, localConversations, nextCursor]);

    // Detectar scroll al final de la lista de conversaciones + trackear si está scrolleando
    useEffect(() => {
        const container = conversationsListRef.current;
        if (!container) return;

        const handleScroll = () => {
            // Marcar que el usuario está haciendo scroll (pausa el polling)
            isScrollingChatsRef.current = true;
            if (scrollingTimeoutRef.current) {
                clearTimeout(scrollingTimeoutRef.current);
            }
            // Desmarcar después de 3 segundos sin scroll
            scrollingTimeoutRef.current = setTimeout(() => {
                isScrollingChatsRef.current = false;
            }, 3000);

            const { scrollTop, scrollHeight, clientHeight } = container;
            // Si llegamos al 80% del scroll, cargar más
            if (scrollTop + clientHeight >= scrollHeight * 0.8 && hasMore && !isLoadingMore) {
                loadMoreConversations();
            }
        };

        container.addEventListener('scroll', handleScroll);
        return () => {
            container.removeEventListener('scroll', handleScroll);
            if (scrollingTimeoutRef.current) {
                clearTimeout(scrollingTimeoutRef.current);
            }
        };
    }, [hasMore, isLoadingMore, loadMoreConversations]);

    // Detectar tecla Escape para cerrar el chat
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && selectedConversation) {
                handleCloseChat();
            }
        };

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [selectedConversation]);

    // Cerrar menú contextual al hacer click fuera
    useEffect(() => {
        const handleClickOutside = () => {
            setContextMenu(null);
            setShowTagSubmenu(false);
            setNewTagName('');
            setShowSpecialtyInput(false);
            setSpecialtyName('');
            setTagSearch('');
        };

        if (contextMenu) {
            window.addEventListener('click', handleClickOutside);
            return () => window.removeEventListener('click', handleClickOutside);
        }
    }, [contextMenu]);

    // Polling para actualizar la lista de conversaciones (siempre activo)
    // Usa endpoint liviano JSON en lugar de Inertia reload completo
    useEffect(() => {
        let isActive = true;

        const conversationsInterval = setInterval(async () => {
            if (!isActive) return;
            // NO recargar si el usuario está haciendo scroll (evita saltos)
            if (isScrollingChatsRef.current) return;

            try {
                const params = new URLSearchParams();
                if (filters.status && filters.status !== 'all') params.set('status', filters.status);
                if (filters.assigned) params.set('assigned', filters.assigned);
                if (filters.search) params.set('search', filters.search);
                if (filters.tag) params.set('tag', filters.tag);

                const res = await axios.get(`/admin/chat/poll-list?${params.toString()}`);
                if (!isActive) return;

                const freshConversations: Conversation[] = res.data.conversations;

                setLocalConversations(prev => {
                    if (prev.length === 0) return freshConversations;

                    const serverMap = new Map(freshConversations.map(c => [c.id, c]));
                    let hasChanges = false;

                    const updated = prev.map(conv => {
                        const fresh = serverMap.get(conv.id);
                        if (fresh) {
                            if (fresh.unread_count !== conv.unread_count ||
                                fresh.status !== conv.status ||
                                fresh.last_message_at !== conv.last_message_at ||
                                fresh.assigned_to !== conv.assigned_to ||
                                fresh.last_message?.content !== conv.last_message?.content ||
                                fresh.last_message?.status !== conv.last_message?.status) {
                                hasChanges = true;
                                return { ...fresh, messages: conv.messages };
                            }
                            return conv;
                        }
                        return conv;
                    }).filter(conv => {
                        if (!filters.tag && filters.status !== 'oncology' && filters.status !== 'scheduled') {
                            if ((conv.status === 'resolved' || conv.status === 'closed') && filters.status !== 'resolved') return false;
                            if (conv.status === 'scheduled' && filters.status !== 'scheduled') return false;
                        }
                        return true;
                    });

                    // Detect new conversations
                    const existingIds = new Set(prev.map(c => c.id));
                    const newConvs = freshConversations.filter(c => !existingIds.has(c.id)).filter(conv => {
                        if (!filters.tag && filters.status !== 'oncology' && filters.status !== 'scheduled') {
                            if ((conv.status === 'resolved' || conv.status === 'closed') && filters.status !== 'resolved') return false;
                            if (conv.status === 'scheduled' && filters.status !== 'scheduled') return false;
                        }
                        return true;
                    });

                    if (newConvs.length > 0) {
                        const result = [...newConvs, ...updated];
                        return result.sort((a, b) => {
                            if (a.is_pinned && !b.is_pinned) return -1;
                            if (!a.is_pinned && b.is_pinned) return 1;
                            return new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime();
                        });
                    }

                    if (hasChanges || updated.length !== prev.length) {
                        return updated.sort((a, b) => {
                            if (a.is_pinned && !b.is_pinned) return -1;
                            if (!a.is_pinned && b.is_pinned) return 1;
                            return new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime();
                        });
                    }

                    return prev;
                });
            } catch {
                // Silenciar errores de polling
            }
        }, 10000); // 10 segundos — endpoint liviano, no Inertia reload

        return () => {
            isActive = false;
            clearInterval(conversationsInterval);
        };
    }, [filters.status, filters.assigned, filters.search, filters.tag, isAdmin]);

    // Escuchar evento en tiempo real cuando un chat es tomado por un asesor
    // Así los demás asesores lo ven desaparecer de su bandeja inmediatamente sin esperar el polling
    useEffect(() => {
        const channel = (window as any).Echo?.channel('conversations');
        if (!channel) return;

        channel.listen('.conversation.assigned', (data: { conversation_id: number; assigned_to: number; status: string }) => {
            if (!isAdmin) {
                // Para asesores: quitar de la lista si fue asignado a otro asesor
                setLocalConversations(prev =>
                    prev.filter(c => {
                        if (c.id !== data.conversation_id) return true;
                        // Mantener si soy yo el asignado
                        return data.assigned_to === auth.user.id;
                    })
                );
            }
        });

        return () => {
            channel.stopListening('.conversation.assigned');
        };
    }, [isAdmin, auth.user.id]);

    // Cerrar dropdowns de filtro cuando se hace clic fuera
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (showAdvisorFilter) {
                setShowAdvisorFilter(false);
            }
            if (showStatusFilter) {
                setShowStatusFilter(false);
            }
            if (showBulkAssignMenu) {
                setShowBulkAssignMenu(false);
                setBulkAssignSearchQuery('');
            }
            if (showTagFilter) {
                setShowTagFilter(false);
                setEditingTag(null);
            }
            if (showFiltersPanel && filtersPanelRef.current && !filtersPanelRef.current.contains(e.target as Node)) {
                setShowFiltersPanel(false);
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [showAdvisorFilter, showStatusFilter, showBulkAssignMenu, showTagFilter, showFiltersPanel]);

    // Cerrar visor de medios con Escape y manejar wheel zoom
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && mediaViewer) {
                setMediaViewer(null);
                setImageRotation(0);
            }
        };

        const handleWheel = (e: WheelEvent) => {
            if (mediaViewer && mediaViewer.type === 'image' && imageRef.current) {
                e.preventDefault();
                if (e.deltaY < 0) {
                    setZoomLevel(prev => Math.min(4, prev + 0.1));
                } else {
                    setZoomLevel(prev => Math.max(0.5, prev - 0.1));
                }
            }
        };

        document.addEventListener('keydown', handleEscape);
        if (mediaViewer && mediaViewer.type === 'image') {
            document.addEventListener('wheel', handleWheel, { passive: false });
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.removeEventListener('wheel', handleWheel);
        };
    }, [mediaViewer]);

    // Resetear posición, zoom y rotación cuando cambia el visor
    useEffect(() => {
        if (mediaViewer) {
            setZoomLevel(1);
            setImagePosition({ x: 0, y: 0 });
            setImageRotation(0);
        }
    }, [mediaViewer?.url]);

    // Polling para actualización de mensajes en conversación seleccionada
    // Usa endpoint liviano que solo devuelve mensajes nuevos después del último ID
    useEffect(() => {
        if (!selectedConversation) return;

        let isActive = true;

        const messagesInterval = setInterval(async () => {
            if (!isActive) return;

            try {
                const res = await axios.get(`/admin/chat/${selectedConversation.id}/poll-messages?after=${lastMessageIdRef.current}`);
                if (!isActive) return;

                const newMessages: Message[] = res.data.messages;
                const updatedStatuses: Array<{ id: number; status: string; error_message?: string }> = res.data.updatedStatuses || [];

                if (newMessages.length > 0) {
                    setLocalMessages(prev => {
                        const existingIds = new Set(prev.map(m => m.id));
                        const truly = newMessages.filter(m => !existingIds.has(m.id));
                        if (truly.length === 0) return prev;
                        return [...prev, ...truly];
                    });
                    const maxId = Math.max(...newMessages.map(m => m.id));
                    if (maxId > lastMessageIdRef.current) {
                        lastMessageIdRef.current = maxId;
                    }
                }

                // Update statuses of existing messages (delivered/read/failed)
                if (updatedStatuses.length > 0) {
                    setLocalMessages(prev => {
                        const statusMap = new Map(updatedStatuses.map(s => [s.id, s]));
                        let changed = false;
                        const updated = prev.map(m => {
                            const s = statusMap.get(m.id);
                            if (s && s.status !== m.status) {
                                changed = true;
                                return { ...m, status: s.status, error_message: s.error_message || m.error_message };
                            }
                            return m;
                        });
                        return changed ? updated : prev;
                    });
                }

                // Update unread count in conversation list
                if (res.data.unread_count !== undefined) {
                    setLocalConversations(prev =>
                        prev.map(c => c.id === selectedConversation.id
                            ? { ...c, unread_count: res.data.unread_count }
                            : c
                        )
                    );
                }

                // Update typing and viewing indicators
                setTypingUsers(res.data.typing || []);
                setViewingUsers(res.data.viewing || []);
            } catch {
                // Silenciar errores de polling
            }
        }, 5000);

        return () => {
            isActive = false;
            clearInterval(messagesInterval);
        };
    }, [selectedConversation?.id]);

    // Heartbeat de presencia: señalar que estamos viendo esta conversación
    useEffect(() => {
        if (!selectedConversation) {
            setViewingUsers([]);
            return;
        }

        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
        const sendViewing = () => {
            fetch(`/admin/chat/${selectedConversation.id}/viewing`, {
                method: 'POST',
                headers: { 'X-CSRF-TOKEN': csrfToken },
            }).catch(() => {});
        };

        // Enviar inmediatamente al abrir y luego cada 10s
        sendViewing();
        const viewingInterval = setInterval(sendViewing, 10000);

        return () => clearInterval(viewingInterval);
    }, [selectedConversation?.id]);

    // Debounce para la búsqueda
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleSearch = (value: string) => {
        setSearch(value);

        // Resetear scroll de la lista al inicio para evitar conflictos con scroll infinito
        if (conversationsListRef.current) {
            conversationsListRef.current.scrollTop = 0;
        }

        // Cancelar búsqueda anterior si existe
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        // Esperar 400ms antes de buscar (debounce)
        searchTimeoutRef.current = setTimeout(() => {
            // Resetear página y conversaciones locales para nueva búsqueda
            setCurrentPage(1);
            hasLoadedExtraPagesRef.current = false;

            // Construir parámetros incluyendo filtros activos
            const params: Record<string, string> = {};
            if (value) params.search = value;
            if (statusFilter !== 'all') params.status = statusFilter;
            if (filterByAdvisor !== null) params.assigned = String(filterByAdvisor);

            // Si hay una conversación seleccionada, mantenerla abierta
            const url = selectedConversation
                ? `/admin/chat/${selectedConversation.id}`
                : '/admin/chat';

            router.get(url, params, {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ['conversations', 'hasMore', 'filters'],
            });
        }, 400);
    };

    // Limpiar timeout al desmontar
    useEffect(() => {
        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, []);

    const formatTime = (date: string | null) => {
        if (!date) return '';
        const d = new Date(date);
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        const time = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true });

        if (isToday) {
            return time;
        }

        const dateStr = d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
        return `${dateStr} ${time}`;
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active':
                return 'bg-green-500';
            case 'pending':
                return 'bg-yellow-500';
            case 'resolved':
                return 'bg-gray-400';
            case 'scheduled':
                return 'bg-indigo-500';
            default:
                return 'bg-gray-300';
        }
    };

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            active: t('conversations.statusLabels.active'),
            pending: 'Pendiente',
            resolved: t('conversations.statusLabels.resolved'),
            scheduled: 'Agendado',
        };
        return labels[status] || status;
    };

    // Mapeo de button_id del flujo de bienvenida a etiquetas legibles
    const flowDataLabels: Record<string, string> = {
        // Tipo de documento
        doc_cc: 'Cédula de ciudadanía',
        doc_ti: 'Tarjeta de identidad',
        doc_other: 'Otro documento',
        // EPS
        eps_nueva_eps: 'Nueva EPS',
        eps_coosalud: 'Coosalud',
        eps_mutual_ser: 'Mutual Ser',
        eps_emssanar: 'Emssanar',
        eps_salud_total: 'Salud Total',
        eps_sanitas: 'Sanitas',
        eps_sura: 'Sura',
        eps_famisanar: 'Famisanar',
        eps_compensar: 'Compensar',
        eps_otro: 'Otra EPS',
        // Régimen
        regimen_subsidiado: 'Subsidiado',
        regimen_contributivo: 'Contributivo',
        // Servicio
        svc_agendamiento: 'Agendamiento de cita',
        svc_cancelacion: 'Cancelación de cita',
        svc_informacion: 'Información',
        svc_asesor: 'Hablar con asesor',
        // Agendamiento
        agenda_especializada: 'Medicina especializada',
        agenda_general: 'Medicina general',
        agenda_odontologia: 'Odontología',
        agenda_laboratorio: 'Laboratorio',
        agenda_imagenes: 'Imágenes diagnósticas',
        agenda_procedimientos: 'Procedimientos',
        agenda_otra: 'Otra especialidad',
        agenda_cancelacion: 'Cancelar cita existente',
        // Información
        info_recordatorio: 'Recordatorio de cita',
        info_resultados: 'Resultados médicos',
        info_general: 'Información general',
        // Privacidad
        accept_privacy: 'Aceptó',
        reject_privacy: 'Rechazó',
    };

    const getFlowDataLabel = (key: string, value: { text?: string; button_id?: string }) => {
        if (value.text) return value.text;
        if (value.button_id) return flowDataLabels[value.button_id] || value.button_id;
        return '-';
    };

    const flowFieldNames: Record<string, string> = {
        welcome: 'Política de privacidad',
        document_type: 'Tipo de documento',
        document_type_other: 'Tipo de documento (otro)',
        document_number: 'Número de documento',
        full_name: 'Nombre completo',
        phone_number: 'Teléfono',
        email: 'Correo electrónico',
        eps_selection: 'EPS',
        eps_other: 'EPS (otra)',
        regimen: 'Régimen',
        service_menu: 'Servicio solicitado',
        agendamiento_info: 'Info agendamiento',
        agendamiento_submenu: 'Tipo de cita',
        cancelacion_info: 'Info cancelación',
        informacion_menu: 'Tipo de información',
        asesor_cedula: 'Cédula (asesor)',
    };

    // Colores determinísticos por usuario para badges de "resuelto por"
    const userBadgeColors = [
        { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800', banner: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800', bannerText: 'text-blue-700 dark:text-blue-300', bannerIcon: 'text-blue-600 dark:text-blue-400' },
        { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800', banner: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800', bannerText: 'text-purple-700 dark:text-purple-300', bannerIcon: 'text-purple-600 dark:text-purple-400' },
        { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-700 dark:text-teal-300', border: 'border-teal-200 dark:border-teal-800', banner: 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800', bannerText: 'text-teal-700 dark:text-teal-300', bannerIcon: 'text-teal-600 dark:text-teal-400' },
        { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800', banner: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800', bannerText: 'text-orange-700 dark:text-orange-300', bannerIcon: 'text-orange-600 dark:text-orange-400' },
        { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-700 dark:text-pink-300', border: 'border-pink-200 dark:border-pink-800', banner: 'bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800', bannerText: 'text-pink-700 dark:text-pink-300', bannerIcon: 'text-pink-600 dark:text-pink-400' },
        { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-cyan-200 dark:border-cyan-800', banner: 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800', bannerText: 'text-cyan-700 dark:text-cyan-300', bannerIcon: 'text-cyan-600 dark:text-cyan-400' },
        { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800', banner: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800', bannerText: 'text-amber-700 dark:text-amber-300', bannerIcon: 'text-amber-600 dark:text-amber-400' },
        { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-800', banner: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800', bannerText: 'text-indigo-700 dark:text-indigo-300', bannerIcon: 'text-indigo-600 dark:text-indigo-400' },
    ];

    const getUserBadgeColor = (userId: number) => {
        return userBadgeColors[userId % userBadgeColors.length];
    };

    // Función para verificar si han pasado 24 horas desde el último mensaje del usuario
    const getLastUserMessageInfo = useCallback(() => {
        if (localMessages.length === 0) {
            return null;
        }

        // Buscar el último mensaje del usuario (is_from_user = true)
        const userMessages = localMessages.filter(msg => msg.is_from_user);

        if (userMessages.length === 0) {
            return null;
        }

        // Ordenar por fecha descendente y obtener el más reciente
        const sortedUserMessages = [...userMessages].sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        const lastUserMessage = sortedUserMessages[0];
        const lastMessageDate = new Date(lastUserMessage.created_at);
        const now = new Date();
        const diffMs = now.getTime() - lastMessageDate.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        return {
            date: lastMessageDate.toLocaleString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            }),
            hoursAgo: Math.floor(diffHours),
            isExpired: diffHours >= 24
        };
    }, [localMessages]);

    // Obtener todos los asesores disponibles para filtrar
    const availableAdvisors = users;

    // Contar filtros activos para mostrar badge en el botón unificado
    const activeFilterCount = [
        statusFilter !== 'all',
        tagFilterId !== null,
        filterByAdvisor !== null,
    ].filter(Boolean).length;

    // Filtrar asesores por búsqueda
    const filteredAdvisors = users.filter(user =>
        user.name.toLowerCase().includes(advisorSearchQuery.toLowerCase())
    );

    // Filtrar asesores por búsqueda en menú de asignación masiva
    const filteredBulkAdvisors = users.filter(user =>
        user.name.toLowerCase().includes(bulkAssignSearchQuery.toLowerCase())
    );

    // Función para aplicar filtros al backend
    const applyFilters = useCallback((newStatus: string, newAdvisor: number | null) => {
        // Resetear página y conversaciones para nueva búsqueda con filtros
        setCurrentPage(1);
        hasLoadedExtraPagesRef.current = false;

        // Construir parámetros de filtro
        const params: Record<string, string> = {};
        if (search) params.search = search;
        if (newStatus !== 'all') params.status = newStatus;
        if (newAdvisor !== null) params.assigned = String(newAdvisor);
        if (tagFilterId !== null) params.tag = String(tagFilterId);

        // Si hay una conversación seleccionada, mantenerla abierta
        const url = selectedConversation
            ? `/admin/chat/${selectedConversation.id}`
            : '/admin/chat';

        router.get(url, params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            only: ['conversations', 'hasMore', 'filters'],
        });
    }, [search, selectedConversation, tagFilterId]);

    // Función para aplicar filtros incluyendo tag
    const applyFiltersWithTag = useCallback((newStatus: string, newAdvisor: number | null, newTagId: number | null) => {
        setCurrentPage(1);
        hasLoadedExtraPagesRef.current = false;

        const params: Record<string, string> = {};
        if (search) params.search = search;
        if (newStatus !== 'all') params.status = newStatus;
        if (newAdvisor !== null) params.assigned = String(newAdvisor);
        if (newTagId !== null) params.tag = String(newTagId);

        const url = selectedConversation
            ? `/admin/chat/${selectedConversation.id}`
            : '/admin/chat';

        router.get(url, params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            only: ['conversations', 'hasMore', 'filters', 'allTags'],
        });
    }, [search, selectedConversation]);

    // Las conversaciones ya vienen filtradas del backend
    const displayedConversations = localConversations;

    // Función para manejar selección de conversación
    const handleConversationSelect = (conversationId: number, event: React.MouseEvent) => {
        // Si se acaba de hacer drag-select, ignorar el click para no duplicar toggle
        if (dragDidMoveRef.current || isDragSelecting) {
            event.preventDefault();
            return;
        }
        if (isSelectionMode || event.ctrlKey || event.metaKey) {
            event.preventDefault();
            setSelectedConversations(prev => {
                if (prev.includes(conversationId)) {
                    return prev.filter(id => id !== conversationId);
                } else {
                    return [...prev, conversationId];
                }
            });
            if (!isSelectionMode) setIsSelectionMode(true);
        } else {
            const params: Record<string, string> = {};
            if (search) params.search = search;
            if (statusFilter !== 'all') params.status = statusFilter;
            if (filterByAdvisor !== null) params.assigned = String(filterByAdvisor);
            if (tagFilterId !== null) params.tag = String(tagFilterId);

            router.get(`/admin/chat/${conversationId}`, params, {
                preserveScroll: true,
                preserveState: true
            });
        }
    };

    // Función para asignar múltiples conversaciones
    const handleBulkAssign = (userId: number | null) => {
        if (selectedConversations.length === 0) return;

        router.post('/admin/chat/bulk-assign', {
            ids: selectedConversations,
            user_id: userId
        }, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                setSelectedConversations([]);
                setIsSelectionMode(false);
            },
            onError: (errors) => {
                console.error('Error al asignar conversaciones:', errors);
            }
        });
    };

    // Función para cambiar estado de múltiples conversaciones
    const handleBulkStatusChange = (status: string) => {
        if (selectedConversations.length === 0) return;

        const idsToUpdate = [...selectedConversations];

        if (status === 'resolved') {
            // Quitar inmediatamente del listado local para respuesta instantánea
            setLocalConversations(prev => prev.filter(c => !idsToUpdate.includes(c.id)));
        }

        router.post('/admin/chat/bulk-status', {
            ids: idsToUpdate,
            status: status
        }, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                setSelectedConversations([]);
                setIsSelectionMode(false);

                // Si no era resolved, actualizar estado local (si era resolved ya los quitamos)
                if (status !== 'resolved') {
                    setLocalConversations(prev =>
                        prev.map(c => idsToUpdate.includes(c.id)
                            ? { ...c, status, resolved_by_user: null, resolved_at: null }
                            : c
                        )
                    );
                }
            },
            onError: (errors) => {
                console.error('Error al cambiar estado de conversaciones:', errors);
                // Si hubo error en resolved, tal vez deberíamos restaurarlos... 
                // pero por complejidad dejémoslo así por ahora o recargar la página.
            }
        });
    };

    // Limpiar selección
    const clearSelection = () => {
        setSelectedConversations([]);
        setIsSelectionMode(false);
    };

    // --- Drag-to-select handlers ---
    const handleDragSelectStart = (conversationId: number) => {
        if (!isSelectionMode) return;
        setIsDragSelecting(true);
        dragDidMoveRef.current = false;
        // Si el chat ya está seleccionado, arrastrar para deseleccionar; sino, para seleccionar
        const isAlreadySelected = selectedConversations.includes(conversationId);
        dragSelectionActionRef.current = isAlreadySelected ? 'deselect' : 'select';
        setSelectedConversations(prev =>
            isAlreadySelected ? prev.filter(id => id !== conversationId) : [...prev, conversationId]
        );
    };

    const handleDragSelectEnter = (conversationId: number) => {
        if (!isDragSelecting || !isSelectionMode) return;
        dragDidMoveRef.current = true;
        setSelectedConversations(prev => {
            if (dragSelectionActionRef.current === 'select') {
                return prev.includes(conversationId) ? prev : [...prev, conversationId];
            } else {
                return prev.filter(id => id !== conversationId);
            }
        });
    };

    const handleDragSelectEnd = () => {
        setIsDragSelecting(false);
    };

    // Auto-scroll when dragging near edges of the conversation list
    const autoScrollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const currentScrollSpeedRef = useRef(0);

    const startAutoScroll = (clientY: number) => {
        const container = conversationsListRef.current;
        if (!container || !isDragSelecting) return;

        const rect = container.getBoundingClientRect();
        const edgeZone = 120; // Aumentado para mayor rango de control
        const maxSpeed = 60; // Mucho más rápido (antes 12)

        let speed = 0;
        if (clientY < rect.top + edgeZone) {
            // Near top — scroll up
            speed = -maxSpeed * (1 - (clientY - rect.top) / edgeZone);
            // Asegurar velocidad mínima si está en la zona
            if (speed > -5) speed = -5;
        } else if (clientY > rect.bottom - edgeZone) {
            // Near bottom — scroll down
            speed = maxSpeed * (1 - (rect.bottom - clientY) / edgeZone);
            if (speed < 5) speed = 5;
        }

        currentScrollSpeedRef.current = speed;

        if (speed !== 0) {
            if (!autoScrollIntervalRef.current) {
                autoScrollIntervalRef.current = setInterval(() => {
                    if (conversationsListRef.current) {
                        conversationsListRef.current.scrollTop += currentScrollSpeedRef.current;
                    }
                }, 16);
            }
        } else {
            if (autoScrollIntervalRef.current) {
                clearInterval(autoScrollIntervalRef.current);
                autoScrollIntervalRef.current = null;
            }
        }
    };

    const stopAutoScroll = () => {
        if (autoScrollIntervalRef.current) {
            clearInterval(autoScrollIntervalRef.current);
            autoScrollIntervalRef.current = null;
        }
    };

    // Track mouse position during drag for auto-scroll
    useEffect(() => {
        if (!isDragSelecting) {
            stopAutoScroll();
            return;
        }

        const onMouseMove = (e: MouseEvent) => {
            startAutoScroll(e.clientY);
        };

        window.addEventListener('mousemove', onMouseMove);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            stopAutoScroll();
        };
    }, [isDragSelecting]);

    // Global keyboard listener for Escape to cancel selection mode
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (isSelectionMode) {
                    clearSelection();
                }
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isSelectionMode]);

    // Global mouseup to stop drag-select even if mouse leaves the list
    useEffect(() => {
        const onMouseUp = () => setIsDragSelecting(false);
        window.addEventListener('mouseup', onMouseUp);
        return () => window.removeEventListener('mouseup', onMouseUp);
    }, []);

    const friendlyError = (msg?: string | null): string => {
        if (!msg) return 'No se pudo enviar el mensaje.';
        const lower = msg.toLowerCase();
        if (lower.includes('24 hora') || lower.includes('re-engage') || lower.includes('131047') || lower.includes('window'))
            return 'Han pasado más de 24 horas desde el último mensaje del paciente. Para volver a escribirle, debe usar una plantilla de mensaje aprobada.';
        if (lower.includes('rate limit') || lower.includes('throttl') || lower.includes('80007'))
            return 'Se ha superado el límite de mensajes. Intente de nuevo en unos minutos.';
        if (lower.includes('media') && (lower.includes('download') || lower.includes('upload') || lower.includes('size')))
            return 'No se pudo enviar el archivo multimedia. Verifique que el archivo no sea muy grande y que el formato sea compatible.';
        if (lower.includes('recipient') || lower.includes('phone') || lower.includes('131026'))
            return 'El número de teléfono del destinatario no es válido o no tiene WhatsApp.';
        if (lower.includes('template'))
            return 'Error con la plantilla de mensaje. Verifique que la plantilla esté aprobada y los parámetros sean correctos.';
        return msg;
    };

    const getStatusIcon = (status: string, errorMessage?: string | null) => {
        switch (status) {
            case 'pending':
                return (
                    <span title={t('conversations.status.sending')}>
                        <Clock className="w-4 h-4 text-muted-foreground animate-pulse" />
                    </span>
                );
            case 'sent':
                return (
                    <span title={t('conversations.status.sent')}>
                        <Check className="w-4 h-4 text-muted-foreground" />
                    </span>
                );
            case 'delivered':
                return (
                    <span title={t('conversations.status.delivered')}>
                        <CheckCheck className="w-4 h-4 text-muted-foreground" />
                    </span>
                );
            case 'read':
                return (
                    <span title={t('conversations.status.read')}>
                        <CheckCheck className="w-4 h-4 text-blue-500" />
                    </span>
                );
            case 'failed': {
                const friendly = friendlyError(errorMessage);
                return (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="cursor-help">
                                <X className="w-4 h-4 text-red-500" />
                            </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs bg-red-600 text-white text-xs px-3 py-2 rounded-lg shadow-lg">
                            <p className="font-semibold mb-0.5">Error al enviar</p>
                            <p>{friendly}</p>
                        </TooltipContent>
                    </Tooltip>
                );
            }
            default:
                return null;
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setData('media_file', file);
        }
    };

    // Manejar pegado de imágenes desde el portapapeles (Ctrl+V)
    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            // Verificar si es un archivo (imagen, etc.)
            if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file) {
                    e.preventDefault();
                    setSelectedFile(file);
                    setData('media_file', file);
                    break;
                }
            }
        }
    };

    const handleRemoveFile = () => {
        setSelectedFile(null);
        setData('media_file', null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Determinar si el chat actual está bloqueado (asignado a otro asesor)
    // Usar localConversations como fuente de verdad (se actualiza via polling)
    const currentAssignedTo = useMemo(() => {
        if (!selectedConversation) return null;
        const local = localConversations.find(c => c.id === selectedConversation.id);
        return local?.assigned_to ?? selectedConversation.assigned_to;
    }, [selectedConversation?.id, localConversations]);

    const currentAssignedUserName = useMemo(() => {
        if (!selectedConversation) return null;
        const local = localConversations.find(c => c.id === selectedConversation.id);
        return local?.assigned_user?.name ?? selectedConversation.assigned_user?.name ?? 'otro asesor';
    }, [selectedConversation?.id, localConversations]);

    const isLockedByOther = useMemo(() => {
        if (!selectedConversation) return false;
        if (isAdmin) return false;
        return currentAssignedTo !== null && currentAssignedTo !== auth.user.id;
    }, [currentAssignedTo, auth.user.id, isAdmin, selectedConversation]);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();

        // Protección contra doble envío
        if (isSubmitting || isLockedByOther) {
            return;
        }

        const hasContent = data.content && data.content.trim().length > 0;
        const hasFile = selectedFile !== null;

        if ((!hasContent && !hasFile) || !selectedConversation) {
            return;
        }

        setIsSubmitting(true);

        // Guardar conteo de mensajes actual para detectar cuando llegue el real
        messageCountBeforeSendRef.current = localMessages.length;

        // Crear mensaje optimista (aparece inmediatamente)
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const optimisticMessage: OptimisticMessage = {
            tempId,
            content: data.content || (selectedFile ? `📎 ${selectedFile.name}` : ''),
            message_type: hasFile ? 'document' : 'text',
            media_url: selectedFile ? URL.createObjectURL(selectedFile) : null,
            is_from_user: false,
            status: 'sending',
            created_at: new Date().toISOString(),
            sender: auth?.user ? { name: auth.user.name } : undefined,
        };

        // Agregar mensaje optimista al estado
        setOptimisticMessages(prev => [...prev, optimisticMessage]);

        // Guardar contenido para posible reintento
        const messageContent = data.content;
        const messageFile = selectedFile;
        const messageTemplateMediaFiles = templateMediaFiles;
        const messageTemplateId = selectedTemplateId;

        // Limpiar formulario inmediatamente (mejor UX)
        reset();
        setSelectedFile(null);
        setTemplateMediaFiles([]);
        setSelectedTemplateId(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }

        // Scroll al final para ver el nuevo mensaje
        setTimeout(() => scrollToBottom(), 50);

        // Enviar al servidor en background usando fetch
        const formData = new FormData();
        formData.append('content', messageContent);
        if (messageFile) {
            formData.append('media_file', messageFile);
        }
        // Si hay archivos de plantilla, enviarlos al backend
        if (messageTemplateMediaFiles.length > 0) {
            formData.append('template_media_files', JSON.stringify(messageTemplateMediaFiles));
        }
        // Si se usó una plantilla, enviar su ID para incrementar el contador
        if (messageTemplateId) {
            formData.append('template_id', messageTemplateId.toString());
        }

        // Obtener token CSRF del meta tag
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

        fetch(`/admin/chat/${selectedConversation.id}/send`, {
            method: 'POST',
            headers: {
                'X-CSRF-TOKEN': csrfToken,
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'same-origin',
            body: formData,
        })
            .then(response => {
                if (!response.ok) {
                    if (response.status === 419) {
                        throw new Error('Sesión expirada. Por favor recarga la página.');
                    }
                    if (response.status === 423) {
                        return response.json().then(data => {
                            throw new Error(data.error || 'Esta conversación está siendo atendida por otro asesor.');
                        });
                    }
                    throw new Error('Error al enviar mensaje');
                }
                return response.json();
            })
            .then((data) => {
                const serverMessage = data?.message;
                if (serverMessage && serverMessage.status === 'failed') {
                    // El servidor envió pero WhatsApp rechazó: marcar como error
                    setOptimisticMessages(prev =>
                        prev.map(m => m.tempId === tempId ? { ...m, status: 'error' as const } : m)
                    );
                    // Actualizar last_message en la lista de conversaciones
                    setLocalConversations(prev =>
                        prev.map(c => c.id === selectedConversation.id
                            ? { ...c, last_message: { content: serverMessage.content, created_at: serverMessage.created_at, is_from_user: false, status: 'failed', error_message: serverMessage.error_message } }
                            : c
                        )
                    );
                } else {
                    // Marcar como enviado - se eliminará cuando llegue el mensaje real del servidor
                    setOptimisticMessages(prev =>
                        prev.map(m => m.tempId === tempId ? { ...m, status: 'sending' as const } : m)
                    );
                }
                setIsSubmitting(false);
            })
            .catch((error) => {
                console.error('Error sending message:', error);
                toast.error(error.message || 'Error al enviar el mensaje');
                // Marcar mensaje como error
                setOptimisticMessages(prev =>
                    prev.map(m => m.tempId === tempId ? { ...m, status: 'error' as const } : m)
                );
                // Actualizar last_message en la lista de conversaciones
                setLocalConversations(prev =>
                    prev.map(c => c.id === selectedConversation.id
                        ? { ...c, last_message: { ...c.last_message!, status: 'failed' } }
                        : c
                    )
                );
                setIsSubmitting(false);
            });
    };

    const handleContextMenu = (e: React.MouseEvent, conversationId: number) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ conversationId, x: e.clientX, y: e.clientY });
    };

    const handleTogglePin = (conversationId: number) => {
        setContextMenu(null);
        const isPinned = localConversations.find(c => c.id === conversationId)?.is_pinned;
        // Optimistic update
        setLocalConversations(prev => {
            const updated = prev.map(c =>
                c.id === conversationId
                    ? { ...c, is_pinned: !c.is_pinned, pinned_at: !c.is_pinned ? new Date().toISOString() : null }
                    : c
            );
            // Re-sort: pinned first, then by last_message_at
            return updated.sort((a, b) => {
                if (a.is_pinned && !b.is_pinned) return -1;
                if (!a.is_pinned && b.is_pinned) return 1;
                if (a.is_pinned && b.is_pinned) {
                    return new Date(b.pinned_at || 0).getTime() - new Date(a.pinned_at || 0).getTime();
                }
                return new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime();
            });
        });
        // Use fetch instead of router.post to avoid Inertia page reload
        fetch(`/admin/chat/${conversationId}/pin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
            },
        }).then(() => {
            toast.success(isPinned ? 'Chat desfijado' : 'Chat fijado');
        }).catch(err => {
            console.error('Error toggling pin:', err);
            toast.error('Error al fijar/desfijar el chat');
        });
    };

    const handleSaveNotes = (text: string) => {
        if (!selectedConversation) return;
        setNotesText(text);
        // Debounce: guardar después de 800ms sin escribir
        if (notesTimeoutRef.current) clearTimeout(notesTimeoutRef.current);
        notesTimeoutRef.current = setTimeout(() => {
            setSavingNotes(true);
            fetch(`/admin/chat/${selectedConversation.id}/notes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({ notes: text }),
            }).then(() => {
                setSavingNotes(false);
            }).catch(() => {
                setSavingNotes(false);
                toast.error('Error al guardar las notas');
            });
        }, 800);
    };

    const fetchActivities = async () => {
        if (!selectedConversation) return;
        setLoadingActivities(true);
        try {
            const res = await axios.get(`/admin/chat/${selectedConversation.id}/activities`);
            setActivities(res.data.activities || []);
        } catch {
            toast.error('Error al cargar el historial');
        } finally {
            setLoadingActivities(false);
        }
    };

    const toggleActivityPanel = () => {
        const next = !showActivity;
        setShowActivity(next);
        if (next) fetchActivities();
    };

    const getActivityLabel = (activity: Activity): string => {
        const name = activity.user?.name || 'Sistema';
        const meta = activity.metadata || {};
        switch (activity.type) {
            case 'assigned':
                return `${name} asignó el chat a ${meta.assigned_to_name || 'un asesor'}`;
            case 'unassigned':
                return `${name} removió la asignación`;
            case 'auto_assigned':
                return `${meta.assigned_to_name || name} tomó el chat automáticamente`;
            case 'resolved':
                return `${name} marcó como resuelto`;
            case 'reopened':
                return `${name} reabrió la conversación`;
            case 'status_changed':
                return `${name} cambió estado a ${meta.new_status === 'active' ? 'activo' : meta.new_status === 'pending' ? 'pendiente' : meta.new_status === 'scheduled' ? 'agendado' : meta.new_status}`;
            case 'created':
                return `${name} creó la conversación`;
            default:
                return `${name}: ${activity.type}`;
        }
    };

    const getActivityColor = (type: string): string => {
        switch (type) {
            case 'assigned': case 'auto_assigned': return 'bg-blue-400';
            case 'unassigned': return 'bg-gray-400';
            case 'resolved': return 'bg-green-400';
            case 'reopened': return 'bg-amber-400';
            case 'status_changed': return 'bg-purple-400';
            case 'created': return 'bg-sky-400';
            default: return 'bg-gray-400';
        }
    };

    const emitTyping = () => {
        if (!selectedConversation) return;
        if (typingTimeoutRef.current) return; // Already sent recently
        fetch(`/admin/chat/${selectedConversation.id}/typing`, {
            method: 'POST',
            headers: {
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
            },
        }).catch(() => {});
        typingTimeoutRef.current = setTimeout(() => {
            typingTimeoutRef.current = null;
        }, 4000);
    };

    const handleAssign = (userId?: number | null) => {
        if (!selectedConversation) return;
        const assignedName = userId ? users.find(u => u.id === userId)?.name : null;
        router.post(`/admin/chat/${selectedConversation.id}/assign`, { user_id: userId ?? null }, {
            preserveScroll: true,
            onSuccess: () => toast.success(assignedName ? `Chat asignado a ${assignedName}` : 'Asignación removida'),
            onError: () => toast.error('Error al asignar el chat'),
        });
    };

    const handleAssignFromContext = (conversationId: number, userId?: number | null) => {
        setContextMenu(null);
        const assignedName = userId ? users.find(u => u.id === userId)?.name : null;
        router.post(`/admin/chat/${conversationId}/assign`, { user_id: userId ?? null }, {
            preserveScroll: true,
            onSuccess: () => toast.success(assignedName ? `Chat asignado a ${assignedName}` : 'Asignación removida'),
            onError: () => toast.error('Error al asignar el chat'),
        });
    };

    const handleStatusChange = (status: string) => {
        if (!selectedConversation) return;
        const convId = selectedConversation.id;

        if (status === 'resolved') {
            // Quitar inmediatamente del listado local para que desaparezca
            setLocalConversations(prev => prev.filter(c => c.id !== convId));

            // Construir params de filtro para preservar estado
            const params: Record<string, string> = {};
            if (search) params.search = search;
            if (statusFilter !== 'all') params.status = statusFilter;
            if (filterByAdvisor !== null) params.assigned = String(filterByAdvisor);
            if (tagFilterId !== null) params.tag = String(tagFilterId);

            router.post(`/admin/chat/${convId}/status`, { status }, {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Chat marcado como resuelto');
                    router.get('/admin/chat', params, { preserveState: true, replace: true });
                },
                onError: () => toast.error('Error al cambiar el estado'),
            });
            return;
        }

        router.post(`/admin/chat/${convId}/status`, { status }, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                toast.success('Estado actualizado');
                // Actualizar estado localmente sin recargar ni navegar
                setLocalConversations(prev =>
                    prev.map(c => c.id === convId ? { ...c, status, resolved_by_user: null, resolved_at: null } : c)
                );
            },
            onError: () => toast.error('Error al cambiar el estado'),
        });
    };

    const handleStatusChangeFromContext = (conversationId: number, status: string) => {
        setContextMenu(null);

        if (status === 'resolved') {
            // Quitar inmediatamente del listado local para que desaparezca
            setLocalConversations(prev => prev.filter(c => c.id !== conversationId));

            // Construir params de filtro para preservar estado
            const params: Record<string, string> = {};
            if (search) params.search = search;
            if (statusFilter !== 'all') params.status = statusFilter;
            if (filterByAdvisor !== null) params.assigned = String(filterByAdvisor);
            if (tagFilterId !== null) params.tag = String(tagFilterId);

            router.post(`/admin/chat/${conversationId}/status`, { status }, {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Chat marcado como resuelto');
                    router.get('/admin/chat', params, { preserveState: true, replace: true });
                },
                onError: () => toast.error('Error al cambiar el estado'),
            });
            return;
        }

        router.post(`/admin/chat/${conversationId}/status`, { status }, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                toast.success('Estado actualizado');
                setLocalConversations(prev =>
                    prev.map(c => c.id === conversationId ? { ...c, status, resolved_by_user: null, resolved_at: null } : c)
                );
            },
            onError: () => toast.error('Error al cambiar el estado'),
        });
    };

    const handleHideChat = () => {
        if (!selectedConversation) return;
        setShowDeleteDialog(true);
    };

    const confirmHideChat = () => {
        if (!selectedConversation) return;
        setShowDeleteDialog(false);
        router.delete(`/admin/chat/${selectedConversation.id}/hide`, {
            preserveScroll: false,
            onSuccess: () => toast.success('Chat ocultado'),
            onError: () => toast.error('Error al ocultar el chat'),
        });
    };

    const handleCloseChat = () => {
        const params: Record<string, string> = {};
        if (search) params.search = search;
        if (statusFilter !== 'all') params.status = statusFilter;
        if (filterByAdvisor !== null) params.assigned = String(filterByAdvisor);
        if (tagFilterId !== null) params.tag = String(tagFilterId);

        router.get('/admin/chat', params, {
            preserveState: true,
        });
    };

    return (
        <AdminLayout>
            <Head title={t('conversations.title')} />

            <div className="h-[calc(100vh-0px)] flex bg-background overflow-hidden">
                {/* Lista de Conversaciones - Izquierda */}
                {/* Mobile: oculta cuando hay chat | Desktop: siempre visible con toggle */}
                <div className={`bg-background dark:bg-neutral-900 flex-col transition-all duration-300 flex-shrink-0 border-r border-border dark:border-neutral-700/50 ${selectedConversation ? 'hidden md:flex' : 'flex'
                    } ${isSidebarVisible ? 'w-full md:w-80 lg:w-96' : 'hidden md:w-0 md:overflow-hidden'
                    }`}>
                    {/* Header */}
                    <div className="px-4 pt-4 pb-2">
                        <div className="flex items-center justify-between mb-3">
                            <h1 className="text-2xl font-extrabold text-[#16235e] dark:text-blue-200 tracking-tight">{t('conversations.title')}</h1>

                            <div className="flex items-center gap-2 flex-shrink-0">
                                {/* Botón para nueva conversación */}
                                <button
                                    onClick={() => setShowNewChatModal(true)}
                                    className="w-9 h-9 rounded-full bg-gradient-to-br from-[#16235e] to-[#2e3a75] text-white flex items-center justify-center shadow-lg hover:shadow-xl active:scale-95 transition-all"
                                    title={t('conversations.newConversation')}
                                >
                                    <Plus className="w-4 h-4" />
                                </button>

                                {/* Botón modo de selección - Solo Admin */}
                                {isAdmin && (
                                    <button
                                        onClick={() => {
                                            if (isSelectionMode) {
                                                clearSelection();
                                            } else {
                                                setIsSelectionMode(true);
                                            }
                                        }}
                                        className={`w-9 h-9 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl active:scale-95 transition-all ${isSelectionMode
                                            ? 'bg-gradient-to-br from-[#22c55e] to-[#16a34a] text-white'
                                            : 'bg-gradient-to-br from-[#16235e] to-[#2e3a75] text-white'
                                            }`}
                                        title={isSelectionMode ? "Cancelar selección" : "Seleccionar múltiples"}
                                    >
                                        <CheckSquare className="w-4 h-4" />
                                    </button>
                                )}

                                {/* Botón unificado de filtros */}
                                <div className="relative" ref={filtersPanelRef} onClick={(e) => e.stopPropagation()}>
                                    <button
                                        onClick={() => setShowFiltersPanel(!showFiltersPanel)}
                                        className={`w-9 h-9 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl active:scale-95 transition-all relative ${activeFilterCount > 0
                                            ? 'bg-gradient-to-br from-[#f59e0b] to-[#d97706] text-white'
                                            : 'bg-gradient-to-br from-[#16235e] to-[#2e3a75] text-white'
                                            }`}
                                        title="Filtros"
                                    >
                                        <SlidersHorizontal className="w-4 h-4" />
                                        {activeFilterCount > 0 && (
                                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                                {activeFilterCount}
                                            </span>
                                        )}
                                    </button>

                                    {/* Panel unificado de filtros */}
                                    {showFiltersPanel && (
                                        <div className="absolute right-0 top-full mt-1 card-gradient rounded-xl shadow-xl border border-border py-1 z-[100] w-64 max-h-[70vh] overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 data-[side=bottom]:slide-in-from-top-2 duration-200">
                                            {/* Sección: Estado */}
                                            <div>
                                                <button
                                                    onClick={() => setExpandedFilterSection(expandedFilterSection === 'status' ? null : 'status')}
                                                    className="w-full px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase flex items-center justify-between hover:bg-accent"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <ListFilter className="w-3.5 h-3.5" />
                                                        <span>Estado</span>
                                                        {statusFilter !== 'all' && (
                                                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 rounded">
                                                                {statusFilter === 'unanswered' ? 'Sin contestar' : statusFilter === 'active' ? 'Activo' : statusFilter === 'pending' ? 'Pendiente' : statusFilter === 'scheduled' ? 'Agendado' : 'Resuelto'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {expandedFilterSection === 'status' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                </button>
                                                {expandedFilterSection === 'status' && (
                                                    <div className="pb-1">
                                                        {[
                                                            { value: 'all', label: 'Todos', color: '' },
                                                            { value: 'active', label: 'Activo', color: 'bg-green-500' },
                                                            { value: 'pending', label: 'Pendiente', color: 'bg-yellow-500' },
                                                            { value: 'resolved', label: 'Resuelto', color: 'bg-gray-400' },
                                                            { value: 'unanswered', label: 'Sin contestar', color: 'bg-red-500' },
                                                        ].map((option) => (
                                                            <button
                                                                key={option.value}
                                                                onClick={() => {
                                                                    setStatusFilter(option.value);
                                                                    applyFilters(option.value, filterByAdvisor);
                                                                }}
                                                                className={`w-full px-4 py-1.5 text-left text-sm hover:bg-accent flex items-center justify-between ${statusFilter === option.value ? 'font-bold text-primary dark:text-primary bg-muted' : ''}`}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    {option.color && <span className={`w-2 h-2 rounded-full ${option.color}`}></span>}
                                                                    <span>{option.label}</span>
                                                                </div>
                                                                {statusFilter === option.value && <Check className="w-3.5 h-3.5 text-primary dark:text-primary" />}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="border-t border-border my-0.5"></div>

                                            {/* Sección: Etiquetas */}
                                            <div>
                                                <button
                                                    onClick={() => setExpandedFilterSection(expandedFilterSection === 'tags' ? null : 'tags')}
                                                    className="w-full px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase flex items-center justify-between hover:bg-accent"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <Tag className="w-3.5 h-3.5" />
                                                        <span>Etiquetas</span>
                                                        {tagFilterId !== null && (
                                                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded">
                                                                {allTags.find(t => t.id === tagFilterId)?.name || ''}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {expandedFilterSection === 'tags' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                </button>
                                                {expandedFilterSection === 'tags' && (
                                                    <div className="pb-1">
                                                        {/* Opción "Todas" para quitar filtro */}
                                                        <button
                                                            onClick={() => {
                                                                setTagFilterId(null);
                                                                setEditingTag(null);
                                                                applyFiltersWithTag(statusFilter, filterByAdvisor, null);
                                                            }}
                                                            className={`w-full px-4 py-1.5 text-left text-sm hover:bg-accent flex items-center justify-between ${tagFilterId === null ? 'font-bold text-primary dark:text-primary bg-muted' : ''}`}
                                                        >
                                                            <span>Todas</span>
                                                            {tagFilterId === null && <Check className="w-3.5 h-3.5 text-primary" />}
                                                        </button>

                                                        {/* Lista de etiquetas */}
                                                        {allTags.map((tag) => (
                                                            <div key={tag.id}>
                                                                {editingTag?.id === tag.id ? (
                                                                    <div className="px-4 py-2 space-y-2">
                                                                        <input
                                                                            type="text"
                                                                            value={editingTag.name}
                                                                            onChange={(e) => setEditingTag({ ...editingTag, name: e.target.value })}
                                                                            className="w-full px-2 py-1 text-sm border border-border rounded bg-muted focus:outline-none focus:border-primary"
                                                                            autoFocus
                                                                            onKeyDown={(e) => {
                                                                                if (e.key === 'Enter' && editingTag.name.trim()) {
                                                                                    updateTag(tag.id, editingTag.name.trim(), editingTag.color);
                                                                                }
                                                                                if (e.key === 'Escape') setEditingTag(null);
                                                                            }}
                                                                        />
                                                                        <div className="flex gap-1 flex-wrap">
                                                                            {TAG_COLORS.map((c) => (
                                                                                <button
                                                                                    key={c}
                                                                                    onClick={() => setEditingTag({ ...editingTag, color: c })}
                                                                                    className={`w-5 h-5 rounded-full border-2 transition-all ${editingTag.color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                                                                                    style={{ backgroundColor: c }}
                                                                                />
                                                                            ))}
                                                                        </div>
                                                                        <div className="flex gap-1">
                                                                            <button
                                                                                onClick={() => {
                                                                                    if (editingTag.name.trim()) {
                                                                                        updateTag(tag.id, editingTag.name.trim(), editingTag.color);
                                                                                    }
                                                                                }}
                                                                                className="flex-1 px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:opacity-90"
                                                                            >
                                                                                Guardar
                                                                            </button>
                                                                            <button
                                                                                onClick={() => setEditingTag(null)}
                                                                                className="flex-1 px-2 py-1 text-xs bg-muted text-muted-foreground rounded hover:bg-accent"
                                                                            >
                                                                                Cancelar
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className={`flex items-center group hover:bg-accent ${tagFilterId === tag.id ? 'bg-muted' : ''}`}>
                                                                        <button
                                                                            onClick={() => {
                                                                                setTagFilterId(tag.id);
                                                                                setEditingTag(null);
                                                                                applyFiltersWithTag(statusFilter, filterByAdvisor, tag.id);
                                                                            }}
                                                                            className="flex-1 px-4 py-1.5 text-left text-sm flex items-center gap-2 min-w-0"
                                                                        >
                                                                            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }}></span>
                                                                            <span className="truncate">{tag.name}</span>
                                                                            <span className="text-xs text-muted-foreground flex-shrink-0">({tag.conversations_count ?? 0})</span>
                                                                        </button>
                                                                        <div className="flex items-center gap-0.5 pr-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setEditingTag({ id: tag.id, name: tag.name, color: tag.color });
                                                                                }}
                                                                                className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-muted-foreground hover:text-blue-600"
                                                                                title="Editar etiqueta"
                                                                            >
                                                                                <Pencil className="w-3.5 h-3.5" />
                                                                            </button>
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    deleteTag(tag.id);
                                                                                }}
                                                                                className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-muted-foreground hover:text-red-600"
                                                                                title="Eliminar etiqueta"
                                                                            >
                                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}

                                                        {allTags.length === 0 && (
                                                            <div className="px-4 py-2 text-xs text-muted-foreground text-center">
                                                                Sin etiquetas. Clic derecho en un chat para crear una.
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Sección: Asesor (solo admin) */}
                                            {isAdmin && availableAdvisors.length > 0 && (
                                                <>
                                                    <div className="border-t border-border my-0.5"></div>
                                                    <div>
                                                        <button
                                                            onClick={() => setExpandedFilterSection(expandedFilterSection === 'advisor' ? null : 'advisor')}
                                                            className="w-full px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase flex items-center justify-between hover:bg-accent"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <Users className="w-3.5 h-3.5" />
                                                                <span>Asesor</span>
                                                                {filterByAdvisor !== null && (
                                                                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded truncate max-w-[100px]">
                                                                        {availableAdvisors.find(u => u.id === filterByAdvisor)?.name || ''}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {expandedFilterSection === 'advisor' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                        </button>
                                                        {expandedFilterSection === 'advisor' && (
                                                            <div className="pb-1">
                                                                {/* Buscador de asesores */}
                                                                <div className="px-3 py-2 border-b border-border">
                                                                    <div className="relative">
                                                                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                                                        <input
                                                                            type="text"
                                                                            placeholder="Buscar asesor..."
                                                                            className="w-full pl-7 pr-2 py-1 text-xs border border-border rounded bg-muted focus:outline-none focus:border-primary"
                                                                            value={advisorSearchQuery}
                                                                            onChange={(e) => setAdvisorSearchQuery(e.target.value)}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                                                                    <button
                                                                        onClick={() => {
                                                                            setFilterByAdvisor(null);
                                                                            applyFilters(statusFilter, null);
                                                                        }}
                                                                        className={`w-full px-4 py-1.5 text-left text-sm hover:bg-accent flex items-center justify-between ${!filterByAdvisor ? 'font-bold text-primary dark:text-primary bg-muted' : ''}`}
                                                                    >
                                                                        <span>{t('common.all')}</span>
                                                                        {!filterByAdvisor && <Check className="w-3.5 h-3.5 text-primary dark:text-primary" />}
                                                                    </button>
                                                                    <div className="border-t border-border my-0.5"></div>
                                                                    {filteredAdvisors.length > 0 ? (
                                                                        filteredAdvisors.map((user) => (
                                                                            <button
                                                                                key={user.id}
                                                                                onClick={() => {
                                                                                    setFilterByAdvisor(user.id);
                                                                                    applyFilters(statusFilter, user.id);
                                                                                }}
                                                                                className={`w-full px-4 py-1.5 text-left text-sm hover:bg-accent flex items-center justify-between ${filterByAdvisor === user.id ? 'font-bold text-primary dark:text-primary bg-muted' : ''}`}
                                                                            >
                                                                                <span className="truncate">{user.name}</span>
                                                                                {filterByAdvisor === user.id && <Check className="w-3.5 h-3.5 text-primary dark:text-primary" />}
                                                                            </button>
                                                                        ))
                                                                    ) : (
                                                                        <div className="px-4 py-2 text-xs text-muted-foreground text-center">
                                                                            No se encontraron asesores
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </>
                                            )}

                                            {/* Limpiar todos los filtros */}
                                            {activeFilterCount > 0 && (
                                                <>
                                                    <div className="border-t border-border my-0.5"></div>
                                                    <button
                                                        onClick={() => {
                                                            setStatusFilter('all');
                                                            setTagFilterId(null);
                                                            setFilterByAdvisor(null);
                                                            setEditingTag(null);
                                                            setShowFiltersPanel(false);
                                                            setExpandedFilterSection(null);
                                                            applyFiltersWithTag('all', null, null);
                                                        }}
                                                        className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                        <span>Limpiar todos los filtros</span>
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Búsqueda */}
                        <div className="relative group">
                            <label htmlFor="conversation-search" className="sr-only">{t('conversations.searchPlaceholder')}</label>
                            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#767681] w-4 h-4" />
                            <input
                                id="conversation-search"
                                name="conversation-search"
                                type="text"
                                placeholder={t('conversations.searchPlaceholder')}
                                value={search}
                                onChange={(e) => handleSearch(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                    }
                                }}
                                className="w-full pl-11 pr-4 py-2.5 bg-muted dark:bg-neutral-800 border-none rounded-full text-sm focus:ring-2 focus:ring-[#16235e]/10 transition-all placeholder:text-[#767681]"
                            />
                        </div>

                        {/* WhatsApp-style quick filter pills */}
                        <div
                            ref={filterPillsRef}
                            className="flex items-center gap-1.5 px-1 pt-2 pb-0.5 overflow-x-auto scrollbar-none"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                        >
                            {[
                                { value: 'all', label: 'Todos' },
                                { value: 'unanswered', label: 'No leídos' },
                                { value: 'pending_response', label: 'En espera' },
                                { value: 'resolved', label: 'Resueltos' },
                                { value: 'scheduled', label: 'Agendados' },
                                { value: 'oncology', label: 'Oncología' },
                            ].map((pill) => (
                                <button
                                    key={pill.value}
                                    onClick={() => {
                                        setStatusFilter(pill.value);
                                        applyFilters(pill.value, filterByAdvisor);
                                    }}
                                    className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                                        statusFilter === pill.value
                                            ? 'bg-[#dee1ff] dark:bg-blue-900/30 text-[#16235e] dark:text-blue-300 font-semibold'
                                            : 'bg-muted dark:bg-neutral-800 text-[#5f5e5e] dark:text-neutral-400 hover:bg-muted/80 dark:hover:bg-neutral-700'
                                    }`}
                                >
                                    {pill.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Lista de Conversaciones */}
                    <div
                        ref={conversationsListRef}
                        className="flex-1 overflow-y-auto overflow-x-hidden px-2 pb-6 custom-scrollbar-light"
                    >
                        {localConversations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-[#767681] p-8">
                                <MessageSquare className="w-16 h-16 mb-4 text-[#767681]/50" />
                                <p className="text-center text-sm">
                                    {t('conversations.noConversations')}
                                </p>
                                <p className="text-center text-xs text-[#767681] mt-2">
                                    {t('conversations.noConversationsSubtitle')}
                                </p>
                            </div>
                        ) : displayedConversations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-[#767681] p-8">
                                <Filter className="w-12 h-12 mb-4 text-[#767681]/50" />
                                <p className="text-center text-sm">
                                    No hay conversaciones con este filtro
                                </p>
                                <p className="text-center text-xs text-[#767681] mt-2">
                                    Intenta cambiar los filtros activos
                                </p>
                            </div>
                        ) : (
                            <>
                                {displayedConversations.map((conversation: Conversation) => (
                                    <button
                                        key={conversation.id}
                                        onClick={(e) => handleConversationSelect(conversation.id, e)}
                                        onContextMenu={(e) => handleContextMenu(e, conversation.id)}
                                        onMouseDown={() => handleDragSelectStart(conversation.id)}
                                        onMouseEnter={() => handleDragSelectEnter(conversation.id)}
                                        onMouseUp={handleDragSelectEnd}
                                        className={`w-full flex items-center gap-4 p-4 mb-1.5 rounded-xl transition-all text-left select-none group ${selectedConversations.includes(conversation.id)
                                                ? 'bg-green-50/80 dark:bg-green-900/20 border-l-4 border-green-500 shadow-sm'
                                                : selectedConversation?.id === conversation.id
                                                    ? 'bg-[#dee1ff] dark:bg-blue-900/30 border-l-4 border-[#16235e] dark:border-blue-400 shadow-sm'
                                                    : 'bg-card dark:bg-neutral-800/60 hover:bg-muted/60 dark:hover:bg-neutral-800/80 border-l-4 border-transparent shadow-[0_1px_3px_rgba(0,0,0,0.06)]'
                                            }`}
                                    >
                                        {/* Avatar / Checkbox en modo selección */}
                                        <div className="relative flex-shrink-0">
                                            {isSelectionMode ? (
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${selectedConversations.includes(conversation.id)
                                                        ? 'bg-green-500 text-white'
                                                        : 'bg-muted dark:bg-neutral-800 border-2 border-border dark:border-neutral-700'
                                                    }`}>
                                                    {selectedConversations.includes(conversation.id) ? (
                                                        <CheckSquare className="w-5 h-5 text-white" />
                                                    ) : (
                                                        <Square className="w-5 h-5 text-[#767681]" />
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#4e5fa4] to-[#3e4f94] flex items-center justify-center text-white text-[15px] font-bold">
                                                    {[...(conversation.contact_name || '')][0]?.toUpperCase() || '?'}
                                                </div>
                                            )}
                                            {!isSelectionMode && conversation.unread_count > 0 && (
                                                <div className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 bg-green-500 rounded-full flex items-center justify-center text-white text-[11px] font-bold shadow-sm border-2 border-[#f3f3f3] dark:border-neutral-900">
                                                    {conversation.unread_count}
                                                </div>
                                            )}
                                        </div>

                                        {/* Información */}
                                        <div className="flex-grow min-w-0">
                                            <div className="flex justify-between items-baseline mb-0.5">
                                                <div className="flex-1 min-w-0 flex items-center gap-1.5">
                                                    <h3 className="font-bold text-[#1a1c1c] dark:text-neutral-200 truncate text-[15px]">
                                                        {conversation.contact_name || 'Sin nombre'}
                                                    </h3>
                                                    {conversation.is_pinned && (
                                                        <Pin className="w-3.5 h-3.5 text-[#16235e] dark:text-blue-400 flex-shrink-0 rotate-45" />
                                                    )}
                                                </div>
                                                <span className={`text-[10px] font-medium flex-shrink-0 ml-2 ${conversation.unread_count > 0 ? 'text-[#16235e] dark:text-blue-400' : 'text-[#5f5e5e] dark:text-neutral-500'
                                                    }`}>
                                                    {formatTime(conversation.last_message_at)}
                                                </span>
                                            </div>
                                            <p className={`text-sm truncate flex items-center gap-1 ${conversation.unread_count > 0 ? 'text-[#1a1c1c] dark:text-neutral-200 font-medium' : 'text-[#5f5e5e] dark:text-neutral-400'}`}>
                                                {conversation.last_message && (
                                                    conversation.last_message.is_from_user ? (
                                                        <span title="Mensaje del cliente">
                                                            <CornerDownLeft className="w-3 h-3 text-[#767681] flex-shrink-0" />
                                                        </span>
                                                    ) : conversation.last_message.status === 'failed' ? (
                                                        <span title={conversation.last_message.error_message ? `Error: ${conversation.last_message.error_message}` : 'Error al enviar'}>
                                                            <X className="w-3 h-3 text-red-500 flex-shrink-0" />
                                                        </span>
                                                    ) : (
                                                        <span title="Mensaje enviado">
                                                            <CornerDownRight className="w-3 h-3 text-[#16235e] dark:text-blue-400 flex-shrink-0" />
                                                        </span>
                                                    )
                                                )}
                                                <span className="truncate">
                                                    {conversation.last_message?.content || t('conversations.noMessages')}
                                                </span>
                                            </p>
                                            <div className="flex items-center justify-between mt-1.5">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`w-2 h-2 rounded-full ${getStatusColor(conversation.status)}`}></span>
                                                    <span className="text-[11px] font-medium text-[#5f5e5e] dark:text-neutral-400">{getStatusLabel(conversation.status)}</span>
                                                </div>
                                                {/* Mostrar quién resolvió la conversación */}
                                                {conversation.status === 'resolved' && conversation.resolved_by_user && (() => {
                                                    const colors = getUserBadgeColor(conversation.resolved_by_user!.id);
                                                    return (
                                                        <span className={`text-[10px] ${colors.text} ${colors.bg} border ${colors.border} px-2 py-0.5 rounded-full truncate max-w-[130px] font-medium shadow-sm transition-all`} title={`Resuelto por ${conversation.resolved_by_user!.name}`}>
                                                            <CheckCheck className="w-3 h-3 inline mr-1" />
                                                            {conversation.resolved_by_user!.name.split(' ')[0]}
                                                        </span>
                                                    );
                                                })()}
                                                {/* Mostrar asesor asignado (solo si no está resuelta) */}
                                                {conversation.assigned_user && conversation.status !== 'resolved' && (
                                                    <span className="text-[10px] font-medium text-slate-600 dark:text-neutral-300 bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 px-2 py-0.5 rounded-full truncate max-w-[90px]" title={conversation.assigned_user.name}>
                                                        {conversation.assigned_user.name.split(' ')[0]}
                                                    </span>
                                                )}
                                            </div>
                                            {/* Etiquetas de la conversación */}
                                            {conversation.tags && conversation.tags.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {conversation.tags.slice(0, 3).map((tag) => (
                                                        <span
                                                            key={tag.id}
                                                            className="text-[10px] text-white px-1.5 py-0.5 rounded-sm truncate max-w-[70px]"
                                                            style={{ backgroundColor: tag.color }}
                                                            title={tag.name}
                                                        >
                                                            {tag.name}
                                                        </span>
                                                    ))}
                                                    {conversation.tags.length > 3 && (
                                                        <span className="text-[10px] text-muted-foreground px-1">
                                                            +{conversation.tags.length - 3}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            {/* Especialidad */}
                                            {conversation.specialty && (
                                                <div className="flex items-center gap-1 mt-1">
                                                    <span className="text-[10px] font-medium text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-800 px-1.5 py-0.5 rounded-full truncate max-w-[150px] flex items-center gap-1" title={`Especialidad: ${conversation.specialty}`}>
                                                        <Stethoscope className="w-2.5 h-2.5 flex-shrink-0" />
                                                        {conversation.specialty}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                ))}

                                {/* Indicador de carga de más conversaciones */}
                                {isLoadingMore && (
                                    <div className="py-4 text-center">
                                        <div className="inline-block w-5 h-5 border-2 border-[#16235e] border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                )}

                                {/* Indicador de más conversaciones */}
                                {hasMore && !isLoadingMore && (
                                    <div className="py-2 text-center text-xs text-[#767681]">
                                        Desplaza para cargar más...
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Barra de acciones para selección múltiple */}
                    {selectedConversations.length > 0 && (
                        <div className="p-3 bg-gradient-to-br from-[#16235e] to-[#2e3a75] border-t border-[#16235e]/30">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-white text-sm font-medium">
                                    {selectedConversations.length} seleccionada{selectedConversations.length > 1 ? 's' : ''}
                                </span>
                                <button
                                    onClick={clearSelection}
                                    className="text-white/70 hover:text-white text-xs"
                                >
                                    Cancelar
                                </button>
                            </div>

                            {/* Botón y menú para asignar - Solo Admin */}
                            {isAdmin && (
                                <div className="relative" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        onClick={() => setShowBulkAssignMenu(!showBulkAssignMenu)}
                                        className="w-full py-2 px-3 bg-card/10 hover:bg-card/20 text-white text-sm rounded-lg flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <UserPlus className="w-4 h-4" />
                                        Asignar a asesor
                                    </button>

                                    {showBulkAssignMenu && (
                                        <div className="absolute bottom-full left-0 right-0 mb-1 bg-card rounded-xl shadow-xl border border-border py-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                            <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase">
                                                Asignar a
                                            </div>

                                            {/* Buscador */}
                                            <div className="px-2 py-1.5">
                                                <div className="relative">
                                                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground w-3.5 h-3.5" />
                                                    <input
                                                        type="text"
                                                        placeholder={t('conversations.searchAdvisor')}
                                                        value={bulkAssignSearchQuery}
                                                        onChange={(e) => setBulkAssignSearchQuery(e.target.value)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="w-full pl-7 pr-2 py-1.5 text-sm border border-border rounded focus:outline-none focus:border-primary bg-muted"
                                                    />
                                                </div>
                                            </div>

                                            {/* Opción para quitar asignación */}
                                            <button
                                                onClick={() => {
                                                    handleBulkAssign(null);
                                                    setShowBulkAssignMenu(false);
                                                    setBulkAssignSearchQuery('');
                                                }}
                                                className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2 border-b border-gray-100"
                                            >
                                                <X className="w-4 h-4" />
                                                Sin asignar
                                            </button>

                                            {/* Lista de asesores con scroll */}
                                            <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                                                {filteredBulkAdvisors.length === 0 ? (
                                                    <div className="px-3 py-2 text-sm text-muted-foreground text-center">
                                                        {t('conversations.noAdvisorsFound')}
                                                    </div>
                                                ) : (
                                                    filteredBulkAdvisors.map((user) => (
                                                        <button
                                                            key={user.id}
                                                            onClick={() => {
                                                                handleBulkAssign(user.id);
                                                                setShowBulkAssignMenu(false);
                                                                setBulkAssignSearchQuery('');
                                                            }}
                                                            className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center justify-between"
                                                        >
                                                            <span>
                                                                {user.name}
                                                                <span className="text-xs text-muted-foreground ml-1">
                                                                    ({user.role === 'admin' ? t('users.roleAdmin') : t('users.roleAdvisor')})
                                                                </span>
                                                            </span>
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Botones de cambiar estado */}
                            <div className="flex gap-2 mt-2">
                                <button
                                    onClick={() => handleBulkStatusChange('active')}
                                    className="flex-1 py-2 px-3 bg-card/10 hover:bg-blue-500/30 text-white text-xs rounded-lg flex items-center justify-center gap-1 transition-colors"
                                >
                                    <Check className="w-3 h-3" />
                                    Activo
                                </button>
                                <button
                                    onClick={() => handleBulkStatusChange('pending')}
                                    className="flex-1 py-2 px-3 bg-card/10 hover:bg-yellow-500/30 text-white text-xs rounded-lg flex items-center justify-center gap-1 transition-colors"
                                >
                                    <Clock className="w-3 h-3" />
                                    Pendiente
                                </button>
                                <button
                                    onClick={() => handleBulkStatusChange('resolved')}
                                    className="flex-1 py-2 px-3 bg-card/10 hover:bg-green-500/30 text-white text-xs rounded-lg flex items-center justify-center gap-1 transition-colors"
                                >
                                    <CheckCheck className="w-3 h-3" />
                                    Resuelto
                                </button>
                                <button
                                    onClick={() => handleBulkStatusChange('scheduled')}
                                    className="flex-1 py-2 px-3 bg-card/10 hover:bg-indigo-500/30 text-white text-xs rounded-lg flex items-center justify-center gap-1 transition-colors"
                                >
                                    <CalendarCheck className="w-3 h-3" />
                                    Agendado
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Menú Contextual */}
                    {contextMenu && (() => {
                        const conversation = localConversations.find((c: Conversation) => c.id === contextMenu.conversationId);
                        if (!conversation) return null;

                        // Lógica de posicionamiento inteligente para evitar desbordamiento
                        const windowHeight = window.innerHeight;
                        const windowWidth = window.innerWidth;
                        const spaceBelow = windowHeight - contextMenu.y;
                        const minSpaceResult = 450; // Aumento margen requerido hacia abajo

                        // Si hay poco espacio abajo, mostrar hacia arriba
                        const showUpwards = spaceBelow < minSpaceResult && contextMenu.y > minSpaceResult;

                        // Ajustar si se sale a la derecha
                        const menuWidth = 240;
                        const spaceRight = windowWidth - contextMenu.x;
                        const adjustedX = spaceRight < menuWidth ? windowWidth - menuWidth - 20 : contextMenu.x;

                        return (
                            <div
                                className="fixed card-gradient rounded-xl shadow-xl border border-border py-2 z-50 min-w-[240px] overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-200"
                                style={{
                                    left: `${adjustedX}px`,
                                    top: showUpwards ? 'auto' : `${contextMenu.y}px`,
                                    bottom: showUpwards ? `${windowHeight - contextMenu.y}px` : 'auto',
                                    maxHeight: 'min(calc(100vh - 40px), 480px)' // Altura máxima adaptativa y no tan grande
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Asignar conversación - Solo Admin */}
                                {isAdmin && (
                                    <>
                                        <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase">
                                            {t('conversations.assignConversation')}
                                        </div>

                                        {/* Buscador de asesores */}
                                        <div className="px-2 py-1.5">
                                            <div className="relative">
                                                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground w-3.5 h-3.5" />
                                                <input
                                                    type="text"
                                                    placeholder={t('conversations.searchAdvisor')}
                                                    value={advisorSearchQuery}
                                                    onChange={(e) => setAdvisorSearchQuery(e.target.value)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="w-full pl-7 pr-2 py-1.5 text-sm border border-border rounded focus:outline-none focus:border-primary bg-muted"
                                                />
                                            </div>
                                        </div>

                                        {/* Opción para quitar asignación */}
                                        {conversation.assigned_to && (
                                            <button
                                                onClick={() => {
                                                    handleAssignFromContext(conversation.id, undefined);
                                                    setAdvisorSearchQuery('');
                                                }}
                                                className="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2 border-b border-gray-100"
                                            >
                                                <X className="w-4 h-4" />
                                                Quitar asignación
                                            </button>
                                        )}

                                        {/* Lista de asesores con scroll */}
                                        <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                                            {filteredAdvisors.length === 0 ? (
                                                <div className="px-3 py-2 text-sm text-muted-foreground text-center">
                                                    {t('conversations.noAdvisorsFound')}
                                                </div>
                                            ) : (
                                                filteredAdvisors.map((user) => (
                                                    <button
                                                        key={user.id}
                                                        onClick={() => {
                                                            handleAssignFromContext(conversation.id, user.id);
                                                            setAdvisorSearchQuery('');
                                                        }}
                                                        className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center justify-between"
                                                    >
                                                        <span className={conversation.assigned_to === user.id ? 'font-bold text-primary dark:text-primary' : ''}>
                                                            {user.name}
                                                            <span className="text-xs text-muted-foreground ml-1">
                                                                ({user.role === 'admin' ? t('users.roleAdmin') : t('users.roleAdvisor')})
                                                            </span>
                                                        </span>
                                                        {conversation.assigned_to === user.id && (
                                                            <Check className="w-4 h-4 text-primary dark:text-primary flex-shrink-0" />
                                                        )}
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                        <div className="border-t border-border my-1"></div>
                                    </>
                                )}

                                {/* Fijar / Desfijar chat */}
                                <button
                                    onClick={() => handleTogglePin(conversation.id)}
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
                                >
                                    <Pin className={`w-4 h-4 ${conversation.is_pinned ? 'text-primary rotate-45' : 'text-muted-foreground'}`} />
                                    {conversation.is_pinned ? 'Desfijar chat' : 'Fijar chat'}
                                </button>

                                {/* Sección de Etiquetas */}
                                <div className="border-t border-border my-1"></div>
                                <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                                    <Tag className="w-3 h-3" />
                                    Etiquetas
                                </div>

                                {/* Etiquetas actuales de esta conversación */}
                                {conversation.tags && conversation.tags.length > 0 && (
                                    <div className="px-3 py-1 flex flex-wrap gap-1">
                                        {conversation.tags.map((tag) => (
                                            <span
                                                key={tag.id}
                                                className="inline-flex items-center gap-1 text-[11px] text-white px-2 py-0.5 rounded-sm cursor-pointer hover:opacity-80"
                                                style={{ backgroundColor: tag.color }}
                                                title={`Clic para quitar "${tag.name}"`}
                                                onClick={() => {
                                                    detachTag(conversation.id, tag.id);
                                                    setContextMenu(null);
                                                }}
                                            >
                                                {tag.name}
                                                <X className="w-3 h-3" />
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Agregar etiqueta existente */}
                                {allTags.filter(t => !(conversation.tags || []).some(ct => ct.id === t.id)).length > 0 && (
                                    <>
                                    <div className="px-3 py-1" onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="text"
                                            value={tagSearch}
                                            onChange={(e) => setTagSearch(e.target.value)}
                                            placeholder="Buscar etiqueta..."
                                            className="w-full px-2 py-1 text-xs border border-border rounded focus:outline-none focus:border-primary bg-muted"
                                        />
                                    </div>
                                    <div className="max-h-[120px] overflow-y-auto">
                                        {allTags.filter(t => !(conversation.tags || []).some(ct => ct.id === t.id)).filter(t => !tagSearch || t.name.toLowerCase().includes(tagSearch.toLowerCase())).map((tag) => (
                                            <button
                                                key={tag.id}
                                                onClick={() => {
                                                    attachTag(conversation.id, tag.id);
                                                    setContextMenu(null);
                                                }}
                                                className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent flex items-center gap-2"
                                            >
                                                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }}></span>
                                                <span className="truncate">{tag.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                    </>
                                )}

                                {/* Crear nueva etiqueta */}
                                {!showTagSubmenu ? (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setShowTagSubmenu(true); }}
                                        className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent text-primary flex items-center gap-2"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        Nueva etiqueta...
                                    </button>
                                ) : (
                                    <div className="px-3 py-2 space-y-2" onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="text"
                                            value={newTagName}
                                            onChange={(e) => setNewTagName(e.target.value)}
                                            placeholder="Nombre de etiqueta"
                                            className="w-full px-2 py-1.5 text-sm border border-border rounded focus:outline-none focus:border-primary bg-muted"
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && newTagName.trim()) {
                                                    createTag(newTagName.trim(), newTagColor).then((tag) => {
                                                        if (tag) {
                                                            attachTag(conversation.id, tag.id);
                                                            setNewTagName('');
                                                            setShowTagSubmenu(false);
                                                            setContextMenu(null);
                                                        }
                                                    });
                                                }
                                                if (e.key === 'Escape') {
                                                    setShowTagSubmenu(false);
                                                    setNewTagName('');
                                                }
                                            }}
                                        />
                                        <div className="flex gap-1">
                                            {TAG_COLORS.map((c) => (
                                                <button
                                                    key={c}
                                                    onClick={() => setNewTagColor(c)}
                                                    className={`w-5 h-5 rounded-full flex-shrink-0 ${newTagColor === c ? 'ring-2 ring-offset-1 ring-primary' : ''}`}
                                                    style={{ backgroundColor: c }}
                                                />
                                            ))}
                                        </div>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => {
                                                    if (newTagName.trim()) {
                                                        createTag(newTagName.trim(), newTagColor).then((tag) => {
                                                            if (tag) {
                                                                attachTag(conversation.id, tag.id);
                                                                setNewTagName('');
                                                                setShowTagSubmenu(false);
                                                                setContextMenu(null);
                                                            }
                                                        });
                                                    }
                                                }}
                                                className="flex-1 py-1 text-xs bg-primary text-white rounded hover:bg-primary/90"
                                            >
                                                Crear
                                            </button>
                                            <button
                                                onClick={() => { setShowTagSubmenu(false); setNewTagName(''); }}
                                                className="flex-1 py-1 text-xs bg-muted text-foreground rounded hover:bg-muted/80"
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Especialidad */}
                                <div className="border-t border-border my-1"></div>
                                {!showSpecialtyInput ? (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setShowSpecialtyInput(true); }}
                                        className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent flex items-center gap-2"
                                    >
                                        <Stethoscope className="w-3.5 h-3.5" />
                                        Especialidad
                                    </button>
                                ) : (
                                    <div className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="text"
                                            value={specialtyName}
                                            onChange={(e) => setSpecialtyName(e.target.value)}
                                            placeholder="Nombre de especialidad"
                                            className="w-full px-2 py-1.5 text-sm border border-border rounded focus:outline-none focus:border-primary bg-muted"
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && specialtyName.trim()) {
                                                    const name = specialtyName.trim();
                                                    fetch(`/admin/chat/${conversation.id}/specialty`, {
                                                        method: 'POST',
                                                        headers: {
                                                            'Content-Type': 'application/json',
                                                            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                                                        },
                                                        body: JSON.stringify({ specialty: name }),
                                                    }).then(() => {
                                                        setLocalConversations(prev => prev.map(c =>
                                                            c.id === conversation.id ? { ...c, specialty: name } : c
                                                        ));
                                                        toast.success(`Especialidad "${name}" guardada`);
                                                    }).catch(() => {
                                                        toast.error('Error al guardar la especialidad');
                                                    });
                                                    setSpecialtyName('');
                                                    setShowSpecialtyInput(false);
                                                    setContextMenu(null);
                                                }
                                                if (e.key === 'Escape') {
                                                    setShowSpecialtyInput(false);
                                                    setSpecialtyName('');
                                                }
                                            }}
                                        />
                                    </div>
                                )}

                                {/* Cambiar estado */}
                                <div className="border-t border-border my-1"></div>
                                <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase">
                                    Cambiar estado
                                </div>

                                {conversation.status !== 'active' && (
                                    <button
                                        onClick={() => handleStatusChangeFromContext(conversation.id, 'active')}
                                        className="w-full px-3 py-2 text-left text-sm hover:bg-accent text-blue-600 flex items-center gap-2"
                                    >
                                        <Check className="w-4 h-4" />
                                        Marcar como Activo
                                    </button>
                                )}

                                {conversation.status !== 'pending' && (
                                    <button
                                        onClick={() => handleStatusChangeFromContext(conversation.id, 'pending')}
                                        className="w-full px-3 py-2 text-left text-sm hover:bg-accent text-yellow-600 flex items-center gap-2"
                                    >
                                        <Clock className="w-4 h-4" />
                                        Marcar como Pendiente
                                    </button>
                                )}

                                {conversation.status !== 'resolved' && (
                                    <button
                                        onClick={() => handleStatusChangeFromContext(conversation.id, 'resolved')}
                                        className="w-full px-3 py-2 text-left text-sm hover:bg-accent text-green-600 flex items-center gap-2"
                                    >
                                        <CheckCheck className="w-4 h-4" />
                                        {t('conversations.markAsResolved')}
                                    </button>
                                )}

                                {conversation.status !== 'scheduled' && (
                                    <button
                                        onClick={() => handleStatusChangeFromContext(conversation.id, 'scheduled')}
                                        className="w-full px-3 py-2 text-left text-sm hover:bg-accent text-indigo-600 flex items-center gap-2"
                                    >
                                        <CalendarCheck className="w-4 h-4" />
                                        Marcar como Agendado
                                    </button>
                                )}
                            </div>
                        );
                    })()}
                </div>

                {/* Área de Chat - Derecha */}
                {/* En mobile: muestra solo cuando hay selección | En desktop: siempre visible */}
                {!selectedConversation ? (
                    <div className="hidden md:flex flex-1 items-center justify-center bg-background dark:bg-neutral-900">
                        <div className="text-center p-8 md:p-12">
                            <MessageSquare className="w-24 h-24 mx-auto mb-4 text-[#767681]/40" />
                            <h3 className="text-xl font-semibold text-[#16235e] dark:text-neutral-300 mb-2">
                                {t('conversations.selectConversation')}
                            </h3>
                            <p className="text-sm text-[#767681]">
                                {t('conversations.selectConversationHint')}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col bg-background dark:bg-neutral-900 w-full md:w-auto">
                        {/* Header del Chat */}
                        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 bg-card/80 dark:bg-neutral-900/80 backdrop-blur-md shadow-sm">
                            <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
                                {/* Botón volver (mobile) / toggle sidebar (desktop) */}
                                <button
                                    onClick={() => {
                                        // En mobile: volver a lista | En desktop: toggle sidebar
                                        if (window.innerWidth < 768) {
                                            handleCloseChat();
                                        } else {
                                            setIsSidebarVisible(!isSidebarVisible);
                                        }
                                    }}
                                    className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted dark:hover:bg-neutral-800 transition-colors flex-shrink-0"
                                    title={isSidebarVisible ? t('conversations.hideList') : t('conversations.showList')}
                                >
                                    {isSidebarVisible ? (
                                        <PanelLeftClose className="w-5 h-5 text-[#16235e] dark:text-neutral-300" />
                                    ) : (
                                        <PanelLeftOpen className="w-5 h-5 text-[#16235e] dark:text-neutral-300" />
                                    )}
                                </button>
                                {/* Avatar e Información */}
                                <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-[#16235e] to-[#2e3a75] flex items-center justify-center text-white text-sm md:text-base font-bold flex-shrink-0">
                                        {[...(selectedConversation.contact_name || '')][0]?.toUpperCase() || '?'}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h2 className="font-bold text-[#16235e] dark:text-neutral-200 text-sm md:text-base truncate">
                                            {selectedConversation.contact_name || 'Sin nombre'}
                                        </h2>
                                        <div className="flex items-center gap-2 text-xs md:text-sm text-[#5f5e5e] dark:text-neutral-400">
                                            <Phone className="w-3 h-3" />
                                            <span>{selectedConversation.phone_number}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Estado */}
                                <div className="hidden lg:flex items-center gap-2 ml-4 px-3 py-1 rounded-full bg-[#dee1ff]/60 dark:bg-neutral-800">
                                    <span className={`w-2 h-2 rounded-full ${getStatusColor(selectedConversation.status)}`}></span>
                                    <span className="text-sm text-[#16235e] dark:text-neutral-300 font-medium">{getStatusLabel(selectedConversation.status)}</span>
                                </div>

                                {/* Asignación */}
                                {selectedConversation.assigned_user && (
                                    <div className="hidden xl:block text-sm text-[#5f5e5e] dark:text-neutral-400 ml-2">
                                        {t('conversations.assignedTo')}: <span className="font-medium text-[#16235e] dark:text-neutral-300">{selectedConversation.assigned_user.name}</span>
                                    </div>
                                )}
                            </div>

                            {/* Acciones y Cerrar */}
                            <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                                {/* Botón Asignar - Solo Admin */}
                                {isAdmin && (
                                    <button
                                        onClick={() => setShowAssignModal(true)}
                                        className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted dark:hover:bg-neutral-800 transition-colors text-[#16235e] dark:text-neutral-300"
                                        title={t('conversations.assignConversation')}
                                    >
                                        <UserPlus className="w-5 h-5" />
                                    </button>
                                )}

                                {/* Menú de Tres Puntos */}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted dark:hover:bg-neutral-800 transition-colors text-[#16235e] dark:text-neutral-300">
                                            <MoreVertical className="w-5 h-5" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-56 bg-card">
                                        {/* Marcar como Activo */}
                                        {selectedConversation.status !== 'active' && (
                                            <DropdownMenuItem
                                                onClick={() => handleStatusChange('active')}
                                                className="cursor-pointer hover:bg-accent text-blue-600"
                                            >
                                                <Check className="w-4 h-4 mr-2" />
                                                Marcar como Activo
                                            </DropdownMenuItem>
                                        )}

                                        {/* Marcar como Pendiente */}
                                        {selectedConversation.status !== 'pending' && (
                                            <DropdownMenuItem
                                                onClick={() => handleStatusChange('pending')}
                                                className="cursor-pointer hover:bg-accent text-yellow-600"
                                            >
                                                <Clock className="w-4 h-4 mr-2" />
                                                Marcar como Pendiente
                                            </DropdownMenuItem>
                                        )}

                                        {/* Marcar como Resuelta */}
                                        {selectedConversation.status !== 'resolved' && (
                                            <DropdownMenuItem
                                                onClick={() => handleStatusChange('resolved')}
                                                className="cursor-pointer hover:bg-accent text-green-600"
                                            >
                                                <CheckCheck className="w-4 h-4 mr-2" />
                                                {t('conversations.markAsResolved')}
                                            </DropdownMenuItem>
                                        )}

                                        {/* Marcar como Agendado */}
                                        {selectedConversation.status !== 'scheduled' && (
                                            <DropdownMenuItem
                                                onClick={() => handleStatusChange('scheduled')}
                                                className="cursor-pointer hover:bg-accent text-indigo-600"
                                            >
                                                <CalendarCheck className="w-4 h-4 mr-2" />
                                                Marcar como Agendado
                                            </DropdownMenuItem>
                                        )}

                                        {/* Eliminar chat - Solo administradores */}
                                        {isAdmin && (
                                            <>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onClick={() => {
                                                        window.open(`/admin/chat/${selectedConversation.id}/export-pdf`, '_blank');
                                                    }}
                                                    className="cursor-pointer hover:bg-accent text-[#16235e] dark:text-neutral-300"
                                                >
                                                    <Download className="w-4 h-4 mr-2" />
                                                    Exportar a PDF
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onClick={handleHideChat}
                                                    className="cursor-pointer hover:bg-red-50 text-red-600"
                                                >
                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                    {t('conversations.deleteChat')}
                                                </DropdownMenuItem>
                                            </>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                {/* Botón Datos del Paciente */}
                                {selectedConversation.welcome_flow_data && Object.keys(selectedConversation.welcome_flow_data).filter(k => !k.startsWith('_')).length > 0 && (
                                    <button
                                        onClick={() => setShowPatientData(!showPatientData)}
                                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${showPatientData ? 'bg-[#16235e] text-white' : 'hover:bg-muted dark:hover:bg-neutral-800 text-[#16235e] dark:text-neutral-300'}`}
                                        title="Datos del paciente"
                                    >
                                        <ClipboardList className="w-5 h-5" />
                                    </button>
                                )}

                                {/* Botón Notas Internas */}
                                <button
                                    onClick={() => setShowNotes(!showNotes)}
                                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors relative ${showNotes ? 'bg-[#16235e] text-white' : 'hover:bg-muted dark:hover:bg-neutral-800 text-[#16235e] dark:text-neutral-300'}`}
                                    title="Notas internas"
                                >
                                    <StickyNote className="w-5 h-5" />
                                    {selectedConversation.notes && !showNotes && (
                                        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-400 rounded-full border-2 border-white dark:border-neutral-900" />
                                    )}
                                </button>

                                {/* Botón Historial de Actividad */}
                                <button
                                    onClick={toggleActivityPanel}
                                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${showActivity ? 'bg-[#16235e] text-white' : 'hover:bg-muted dark:hover:bg-neutral-800 text-[#16235e] dark:text-neutral-300'}`}
                                    title="Historial de actividad"
                                >
                                    <History className="w-5 h-5" />
                                </button>

                                {/* Botón Cerrar Chat */}
                                <button
                                    onClick={handleCloseChat}
                                    className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted dark:hover:bg-neutral-800 transition-colors text-[#16235e] dark:text-neutral-300"
                                    title={t('conversations.closeChatHint')}
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Indicador de otros asesores viendo esta conversación */}
                        {viewingUsers.length > 0 && (
                            <div className="px-4 py-2 bg-amber-50/80 dark:bg-amber-950/30 border-b border-amber-200/60 dark:border-amber-800/40 flex items-center gap-2">
                                <Eye className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                                <span className="text-xs text-amber-700 dark:text-amber-300">
                                    {viewingUsers.length === 1
                                        ? <><strong>{viewingUsers[0].name}</strong> también está viendo esta conversación</>
                                        : <><strong>{viewingUsers.map(u => u.name).join(', ')}</strong> también están viendo esta conversación</>
                                    }
                                </span>
                            </div>
                        )}

                        {/* Panel de datos del paciente */}
                        {showPatientData && selectedConversation.welcome_flow_data && (
                            <div className="border-b border-border bg-blue-50/50 dark:bg-blue-950/20 px-4 py-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <ClipboardList className="w-4 h-4 text-primary" />
                                    <span className="text-sm font-semibold text-primary">Datos del paciente</span>
                                </div>
                                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-1.5">
                                    {Object.entries(selectedConversation.welcome_flow_data)
                                        .filter(([key]) => !key.startsWith('_'))
                                        .map(([key, value]) => (
                                            <div key={key} className="min-w-0">
                                                <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
                                                    {flowFieldNames[key] || key}
                                                </span>
                                                <p className="text-sm text-foreground font-medium truncate" title={getFlowDataLabel(key, value)}>
                                                    {getFlowDataLabel(key, value)}
                                                </p>
                                            </div>
                                        ))
                                    }
                                </div>
                            </div>
                        )}

                        {/* Panel de notas internas */}
                        {showNotes && (
                            <div className="border-b border-border bg-amber-50/50 dark:bg-amber-950/10 px-4 py-3">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <StickyNote className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                        <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">Notas internas</span>
                                    </div>
                                    {savingNotes && (
                                        <span className="text-xs text-muted-foreground">Guardando...</span>
                                    )}
                                    {!savingNotes && notesText && (
                                        <span className="text-xs text-green-600 dark:text-green-400">Guardado</span>
                                    )}
                                </div>
                                <textarea
                                    value={notesText}
                                    onChange={(e) => handleSaveNotes(e.target.value)}
                                    placeholder="Escribe notas internas sobre esta conversación... (solo visible para asesores)"
                                    className="w-full min-h-[80px] max-h-[160px] resize-y rounded-lg border border-amber-200 dark:border-amber-800/30 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                                />
                            </div>
                        )}

                        {/* Panel de historial de actividad */}
                        {showActivity && (
                            <div className="border-b border-border bg-slate-50/50 dark:bg-slate-950/20 px-4 py-3 max-h-[200px] overflow-y-auto custom-scrollbar">
                                <div className="flex items-center gap-2 mb-3">
                                    <History className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-300">Historial de actividad</span>
                                </div>
                                {loadingActivities ? (
                                    <p className="text-xs text-muted-foreground">Cargando...</p>
                                ) : activities.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">No hay actividad registrada aún.</p>
                                ) : (
                                    <div className="relative pl-4">
                                        <div className="absolute left-[7px] top-1.5 bottom-1.5 w-px bg-slate-200 dark:bg-slate-700" />
                                        {activities.map((act) => (
                                            <div key={act.id} className="relative flex items-start gap-3 pb-3 last:pb-0">
                                                <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${getActivityColor(act.type)} ring-2 ring-white dark:ring-slate-900`} />
                                                <div className="min-w-0">
                                                    <p className="text-xs text-foreground leading-snug">{getActivityLabel(act)}</p>
                                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                                        {new Date(act.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Banner de conversación resuelta */}
                        {selectedConversation.status === 'resolved' && selectedConversation.resolved_by_user && (() => {
                            const colors = getUserBadgeColor(selectedConversation.resolved_by_user!.id);
                            return (
                                <div className={`flex items-center gap-2 px-4 py-2 ${colors.banner} border-b`}>
                                    <CheckCheck className={`w-4 h-4 ${colors.bannerIcon} flex-shrink-0`} />
                                    <span className={`text-sm ${colors.bannerText}`}>
                                        Conversación resuelta por <strong>{selectedConversation.resolved_by_user!.name}</strong>
                                        {selectedConversation.resolved_at && (
                                            <> el {new Date(selectedConversation.resolved_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</>
                                        )}
                                    </span>
                                    {isAdmin && (
                                        <button
                                            className="ml-auto text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 h-7 px-3 rounded-md font-medium transition-colors"
                                            onClick={() => handleStatusChange('active')}
                                        >
                                            Reabrir
                                        </button>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Área de Mensajes */}
                        <div
                            ref={messagesContainerRef}
                            className="flex-1 overflow-y-auto px-3 md:px-6 py-3 md:py-4 relative custom-scrollbar"

                        >
                            {localMessages.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-[#767681]">
                                    <p>{t('conversations.noMessagesInConversation')}</p>
                                </div>
                            ) : (
                                <div className="space-y-3 md:space-y-4">
                                    {localMessages.map((message) => (
                                        <div
                                            key={message.id}
                                            className={`flex ${message.is_from_user ? 'justify-start' : 'justify-end'}`}
                                        >
                                          <div className={`flex flex-col max-w-[85%] md:max-w-[70%] ${message.is_from_user ? 'items-start' : 'items-end'}`}>
                                            <div
                                                className={`px-3 pt-2 pb-2 flex flex-col relative ${message.is_from_user
                                                    ? 'rounded-xl rounded-bl-sm bg-white dark:bg-neutral-800 text-[#1a1c1c] dark:text-neutral-200 shadow-sm ring-1 ring-black/5'
                                                    : 'rounded-xl rounded-br-sm bg-[#2e3a75] text-white shadow-md'
                                                    }`}
                                            >
                                                {/* Remitente (si es asesor) */}
                                                {!message.is_from_user && message.sender && (
                                                    <p className="text-[11px] font-bold text-[#dee1ff]/90 tracking-wide mb-1 flex items-center gap-1">
                                                        {message.sender.name}
                                                    </p>
                                                )}

                                                {/* Contenido del mensaje */}
                                                {message.message_type === 'image' && message.media_url ? (
                                                    <div className="space-y-2">
                                                        <div
                                                            className="relative cursor-pointer group"
                                                            onClick={() => {
                                                                setMediaViewer({
                                                                    url: message.media_url!,
                                                                    type: 'image',
                                                                    caption: message.content !== 'Imagen' ? message.content : undefined
                                                                });
                                                                setZoomLevel(1);
                                                            }}
                                                        >
                                                            <img
                                                                src={message.media_url}
                                                                alt={message.content}
                                                                className="max-w-full max-h-96 rounded-xl object-cover"
                                                                loading="lazy"
                                                            />
                                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 flex items-center justify-center">
                                                                <Expand className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 drop-shadow-lg" />
                                                            </div>
                                                        </div>
                                                        {message.content && message.content !== 'Imagen' && (
                                                            <p className="text-sm whitespace-pre-wrap break-words">
                                                                {message.content}
                                                            </p>
                                                        )}
                                                    </div>
                                                ) : message.message_type === 'video' && message.media_url ? (
                                                    <div className="space-y-2">
                                                        <div
                                                            className="relative cursor-pointer group"
                                                            onClick={() => {
                                                                setMediaViewer({
                                                                    url: message.media_url!,
                                                                    type: 'video',
                                                                    caption: message.content !== 'Video' ? message.content : undefined
                                                                });
                                                            }}
                                                        >
                                                            <video
                                                                src={message.media_url}
                                                                className="max-w-full max-h-96 rounded-xl"
                                                                preload="metadata"
                                                            >
                                                                Your browser does not support video playback.
                                                            </video>
                                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 flex items-center justify-center">
                                                                <Expand className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 drop-shadow-lg" />
                                                            </div>
                                                        </div>
                                                        {message.content && message.content !== 'Video' && (
                                                            <p className="text-sm whitespace-pre-wrap break-words">
                                                                {message.content}
                                                            </p>
                                                        )}
                                                    </div>
                                                ) : message.message_type === 'audio' && message.media_url ? (
                                                    <div className="space-y-2">
                                                        <div className="flex items-center gap-2">
                                                            <FileAudio className="w-5 h-5" />
                                                            <audio
                                                                src={message.media_url}
                                                                controls
                                                                className="max-w-full"
                                                                preload="metadata"
                                                            >
                                                                Your browser does not support audio playback.
                                                            </audio>
                                                        </div>
                                                        {message.transcription && (
                                                            <div className="mt-2 p-2 bg-gradient-to-b from-blue-50 to-blue-100/50 dark:from-blue-900/30 dark:to-blue-900/20 rounded text-sm">
                                                                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">📝 Transcripción:</p>
                                                                <p className="text-foreground italic">{message.transcription}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : message.message_type === 'sticker' && message.media_url ? (
                                                    <div className="space-y-2">
                                                        <img
                                                            src={message.media_url}
                                                            alt="Sticker"
                                                            className="w-32 h-32 object-contain"
                                                            loading="lazy"
                                                        />
                                                    </div>
                                                ) : message.message_type === 'document' && message.media_url ? (
                                                    <div className="space-y-2">
                                                        <a
                                                            href={message.media_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-2 text-sm hover:underline"
                                                        >
                                                            <Paperclip className="w-4 h-4" />
                                                            {message.content}
                                                        </a>
                                                    </div>
                                                ) : message.message_type === 'location' && message.media_url ? (
                                                    <div className="space-y-2">
                                                        <a
                                                            href={message.media_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-2 text-sm hover:underline"
                                                        >
                                                            <MapPin className="w-5 h-5" />
                                                            <div>
                                                                <p className="font-semibold">Location</p>
                                                                <p className="text-xs opacity-80 whitespace-pre-wrap">{message.content}</p>
                                                            </div>
                                                        </a>
                                                    </div>
                                                ) : message.message_type === 'contact' ? (
                                                    <div className="flex items-start gap-2 text-[15px] leading-snug pr-4">
                                                        <User className="w-5 h-5 flex-shrink-0 mt-0.5 opacity-80" />
                                                        <p className="whitespace-pre-wrap break-words">{message.content}</p>
                                                    </div>
                                                ) : message.content?.startsWith('[Envío masivo:') ? (
                                                    (() => {
                                                        const lines = message.content.split('\n');
                                                        const label = lines[0];
                                                        const templateText = lines.slice(1).join('\n').trim();
                                                        return (
                                                            <div className="space-y-1.5 pr-3">
                                                                <div className="flex items-center gap-1.5 text-xs font-semibold opacity-80">
                                                                    <Send className="w-3 h-3" />
                                                                    <span>{label}</span>
                                                                </div>
                                                                {templateText && (
                                                                    <p className="text-[15px] leading-snug whitespace-pre-wrap break-words">
                                                                        {templateText}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        );
                                                    })()
                                                ) : (
                                                    <p className="text-[15px] leading-snug whitespace-pre-wrap break-words inline-block relative pr-3">
                                                        {message.content}
                                                    </p>
                                                )}

                                            </div>
                                            {/* Hora y Estado - fuera de la burbuja */}
                                            <div className={`flex items-center gap-1 mt-1 ${message.is_from_user ? 'ml-1' : 'mr-1'}`}>
                                                <span className="text-[10px] text-[#5f5e5e] dark:text-neutral-500">{formatTime(message.created_at)}</span>
                                                {!message.is_from_user && getStatusIcon(message.status, message.error_message)}
                                            </div>
                                          </div>
                                        </div>
                                    ))}

                                    {/* Mensajes optimistas (enviándose) */}
                                    {optimisticMessages.map((message) => (
                                        <div
                                            key={message.tempId}
                                            className="flex justify-end"
                                        >
                                          <div className="flex flex-col items-end max-w-[85%] md:max-w-[70%]">
                                            <div
                                                className={`px-3 pt-2 pb-2 flex flex-col relative rounded-xl rounded-br-sm text-white ${message.status === 'error'
                                                    ? 'bg-red-500 shadow-md'
                                                    : 'bg-[#2e3a75] shadow-md opacity-70'
                                                    }`}
                                            >
                                                {/* Remitente */}
                                                {message.sender && (
                                                    <p className="text-xs opacity-70 mb-1">
                                                        {message.sender.name}
                                                    </p>
                                                )}

                                                {/* Contenido */}
                                                <p className="text-sm whitespace-pre-wrap break-words">
                                                    {message.content}
                                                </p>

                                            </div>
                                            {/* Estado del mensaje - fuera de la burbuja */}
                                            <div className="flex items-center gap-1 mt-1 mr-1">
                                                <span className="text-[10px] text-[#5f5e5e] dark:text-neutral-500">{formatTime(message.created_at)}</span>
                                                {message.status === 'sending' ? (
                                                    <Clock className="w-3 h-3 text-[#5f5e5e] animate-pulse" />
                                                ) : (
                                                    <span className="text-[10px] text-red-500">Error</span>
                                                )}
                                            </div>
                                          </div>
                                        </div>
                                    ))}

                                    {/* Indicador de "escribiendo..." - Se mostrará cuando se implemente en backend */}
                                    {/* Ejemplo de cómo se vería: */}
                                    {/* <div className="flex justify-start">
                                        <div className="card-gradient shadow-[0_1px_3px_rgba(46,63,132,0.06),0_3px_8px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.9)] rounded-2xl px-4 py-3">
                                            <div className="flex items-center gap-1">
                                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                            </div>
                                        </div>
                                    </div> */}

                                    <div ref={messagesEndRef} />
                                </div>
                            )}

                            {/* Botón flotante para ir al final + indicador de nuevos mensajes */}
                            <button
                                onClick={() => scrollToBottom()}
                                className={`sticky bottom-4 left-full -translate-x-8 flex items-center gap-2 bg-white dark:bg-neutral-800 text-[#16235e] dark:text-neutral-300 px-3 py-2 rounded-full shadow-lg hover:shadow-xl z-10 transition-all duration-300 ${isAtBottom
                                    ? 'opacity-0 translate-y-4 pointer-events-none'
                                    : 'opacity-100 translate-y-0'
                                    }`}
                            >
                                {newMessagesCount > 0 && (
                                    <span className="bg-gradient-to-b from-[#22c55e] to-[#16a34a] text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                                        {newMessagesCount > 99 ? '99+' : newMessagesCount}
                                    </span>
                                )}
                                <ArrowDown className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Área de Entrada de Mensaje */}
                        {isLockedByOther ? (
                            <div className="px-3 md:px-6 py-4 bg-amber-50/80 dark:bg-amber-950/30 backdrop-blur-md border-t border-amber-200 dark:border-amber-800/50">
                                <div className="flex items-center gap-3 justify-center">
                                    <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                                    <p className="text-sm text-amber-700 dark:text-amber-300">
                                        Esta conversación está siendo atendida por <strong>{currentAssignedUserName}</strong>. No puedes enviar mensajes hasta que sea liberada o reasignada.
                                    </p>
                                </div>
                            </div>
                        ) : (
                        <>
                        {/* Indicador de escribiendo */}
                        {typingUsers.length > 0 && (
                            <div className="px-4 md:px-6 py-1.5 text-xs text-muted-foreground italic animate-pulse">
                                {typingUsers.length === 1
                                    ? `${typingUsers[0].name} está escribiendo...`
                                    : `${typingUsers.map(u => u.name).join(', ')} están escribiendo...`
                                }
                            </div>
                        )}
                        <form onSubmit={handleSubmit} className="px-3 md:px-6 py-3 md:py-4 bg-card/80 dark:bg-neutral-900/80 backdrop-blur-md">
                            {/* Preview del archivo seleccionado */}
                            {selectedFile && (
                                <div className="mb-2 flex items-center gap-2 p-2 bg-[#dee1ff]/40 dark:bg-blue-900/20 rounded-lg">
                                    <Paperclip className="w-4 h-4 text-[#16235e] dark:text-neutral-300" />
                                    <span className="text-sm text-[#16235e] dark:text-neutral-300 flex-1 truncate">{selectedFile.name}</span>
                                    <button
                                        type="button"
                                        onClick={handleRemoveFile}
                                        className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-100 dark:hover:bg-red-900/20"
                                    >
                                        <X className="w-4 h-4 text-red-600" />
                                    </button>
                                </div>
                            )}

                            {/* Preview de archivos de plantilla (múltiples) */}
                            {templateMediaFiles.length > 0 && !selectedFile && (
                                <div className="mb-2 p-2 bg-gradient-to-b from-green-50 to-green-100/50 rounded-lg">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm text-green-800 font-medium">
                                            📎 {templateMediaFiles.length} archivo{templateMediaFiles.length !== 1 ? 's' : ''} de plantilla
                                        </span>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setTemplateMediaFiles([])}
                                            className="h-6 w-6 p-0 hover:bg-red-100"
                                        >
                                            <X className="w-4 h-4 text-red-600" />
                                        </Button>
                                    </div>
                                    <div className="flex gap-2 overflow-x-auto">
                                        {templateMediaFiles.map((file, index) => (
                                            <div key={index} className="flex-shrink-0">
                                                {file.type === 'image' ? (
                                                    <img
                                                        src={file.url}
                                                        alt={file.filename}
                                                        className="w-10 h-10 object-cover rounded"
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center text-xs text-muted-foreground">
                                                        {file.type === 'video' ? '🎬' : '📄'}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex items-end gap-2 md:gap-3 relative">
                                {/* Input de archivo oculto */}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />

                                <div className="relative flex-1 flex items-end bg-muted dark:bg-neutral-800 ring-1 ring-black/5 dark:ring-white/5 rounded-full focus-within:ring-2 focus-within:ring-[#16235e]/30 transition-all duration-200 overflow-visible">

                                    {/* Botón de adjuntar - Ahora integrado dentro de la burbuja */}
                                    <button
                                        type="button"
                                        className="flex-shrink-0 h-[44px] w-12 p-0 rounded-l-full self-end text-[#767681] hover:text-[#16235e] dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors flex items-center justify-center"
                                        onClick={() => fileInputRef.current?.click()}
                                        title="Adjuntar archivo"
                                    >
                                        <Paperclip className="w-[22px] h-[22px]" />
                                    </button>

                                    {/* Botón enviar plantilla WhatsApp */}
                                    <button
                                        type="button"
                                        className="flex-shrink-0 h-[44px] w-10 p-0 self-end text-[#767681] hover:text-[#16235e] dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors flex items-center justify-center"
                                        onClick={() => setShowWaTemplateModal(true)}
                                        title="Enviar plantilla de WhatsApp"
                                    >
                                        <FileText className="w-[20px] h-[20px]" />
                                    </button>

                                    {/* Campo de texto */}
                                    <div className="relative flex-1">
                                        <Textarea
                                            value={data.content}
                                            onChange={(e) => handleMessageChange(e.target.value)}
                                            placeholder={t('conversations.messagePlaceholder')}
                                            className="flex-1 min-h-[44px] max-h-[120px] py-[10px] pr-4 pl-0 text-sm md:text-base resize-none border-0 bg-transparent focus-visible:ring-0 shadow-none rounded-none placeholder:text-[#767681]"
                                            onKeyDown={handleTemplateKeyDown}
                                            onPaste={handlePaste}
                                            spellCheck={true}
                                            lang="es"
                                            autoCorrect="on"
                                        />

                                        {/* Dropdown de plantillas */}
                                        {showTemplates && filteredTemplates.length > 0 && (
                                            <div className="absolute bottom-full -left-12 right-0 mb-3 bg-card border border-border/80 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                                {filteredTemplates.map((template, index) => (
                                                    <div
                                                        key={template.id}
                                                        className={`px-4 py-3 cursor-pointer transition-colors ${index === selectedTemplateIndex
                                                            ? 'bg-primary/5 text-primary'
                                                            : 'hover:bg-accent'
                                                            }`}
                                                        onClick={() => selectTemplate(template)}
                                                    >
                                                        <div className="font-medium text-sm">{template.name}</div>
                                                        <div className="text-xs text-muted-foreground truncate mt-1">
                                                            {template.content}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Indicador de autocorrección */}
                                        {lastCorrection && (
                                            <div className="absolute bottom-full left-0 mb-3 animate-in fade-in slide-in-from-bottom-1 duration-200">
                                                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-background/95 backdrop-blur border border-border rounded-full shadow-lg">
                                                    <Check className="w-3.5 h-3.5 text-green-500" />
                                                    <span className="text-[11px] md:text-xs">
                                                        <span className="line-through text-muted-foreground mr-1">{lastCorrection.original}</span>
                                                        <span className="font-semibold text-foreground">{lastCorrection.corrected}</span>
                                                    </span>
                                                    <div className="w-px h-3 bg-border mx-0.5"></div>
                                                    <button
                                                        type="button"
                                                        className="ml-0.5 text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded-sm hover:bg-accent"
                                                        onClick={() => {
                                                            // Deshacer la corrección
                                                            const currentContent = data.content;
                                                            const undone = currentContent.replace(lastCorrection.corrected, lastCorrection.original);
                                                            setData('content', undone);
                                                            previousTextRef.current = undone;
                                                            setLastCorrection(null);
                                                        }}
                                                        title="Deshacer corrección"
                                                    >
                                                        <RotateCcw className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Botón de enviar */}
                                <button
                                    type="submit"
                                    disabled={(!(data.content?.trim()) && !selectedFile) || processing || isSubmitting}
                                    className="flex-shrink-0 bg-gradient-to-br from-[#16235e] to-[#2e3a75] hover:from-[#1a2a6e] hover:to-[#364588] text-white w-12 h-12 md:w-[50px] md:h-[50px] rounded-full shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed p-0 flex items-center justify-center"
                                >
                                    <Send className="w-5 h-5 ml-[2px]" />
                                </button>
                            </div>
                            <p className="hidden md:block text-xs text-[#767681] mt-2">
                                {t('conversations.sendHint')}
                            </p>
                        </form>
                        </>
                        )}
                    </div>
                )}
            </div>

            {/* Dialog de confirmación de eliminación */}
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent className="sm:max-w-md card-gradient border-2 border-border dark:border-[hsl(231,20%,22%)]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-primary dark:text-[hsl(231,15%,92%)] flex items-center gap-2">
                            <X className="w-6 h-6 text-red-500" />
                            Eliminar conversación
                        </DialogTitle>
                        <div className="text-muted-foreground space-y-3 pt-4">
                            <DialogDescription className="text-sm leading-relaxed">
                                Esta acción <strong>eliminará temporalmente la conversación de tu vista</strong>, pero no te preocupes:
                            </DialogDescription>
                            <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 dark:border-blue-500 p-3 rounded-r space-y-1">
                                <div className="text-sm text-blue-900 dark:text-blue-300">
                                    ✓ <strong>Todos los mensajes se conservarán</strong>
                                </div>
                                <div className="text-sm text-blue-900 dark:text-blue-300">
                                    ✓ <strong>Si el cliente vuelve a escribir</strong>, la conversación reaparecerá automáticamente con todo el historial
                                </div>
                            </div>
                            <div className="text-xs text-muted-foreground italic">
                                Es temporal. La conversación volverá cuando el cliente te escriba de nuevo.
                            </div>
                        </div>
                    </DialogHeader>
                    <DialogFooter className="gap-3 sm:gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowDeleteDialog(false)}
                            className="settings-btn-secondary"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            onClick={confirmHideChat}
                            className="bg-gradient-to-b from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-[0_2px_4px_rgba(239,68,68,0.3)]"
                        >
                            Sí, eliminar conversación
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal de Advertencia de 24 Horas */}
            <Dialog open={show24HourWarning} onOpenChange={setShow24HourWarning}>
                <DialogContent className="sm:max-w-lg card-gradient border-2 border-amber-400 dark:border-amber-500">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2">
                            <Clock className="w-6 h-6" />
                            Ventana de 24 horas expirada
                        </DialogTitle>
                        <div className="text-muted-foreground space-y-4 pt-4">
                            <DialogDescription className="text-sm leading-relaxed text-foreground">
                                <strong>No se puede enviar el mensaje.</strong> Ha pasado más de 24 horas desde el último mensaje del usuario.
                            </DialogDescription>

                            {lastUserMessageInfo && (
                                <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400 dark:border-amber-500 p-3 rounded-r">
                                    <div className="text-sm text-amber-900 dark:text-amber-300">
                                        <strong>Último mensaje del usuario:</strong>
                                        <br />
                                        📅 {lastUserMessageInfo.date}
                                        <br />
                                        ⏱️ Hace aproximadamente <strong>{lastUserMessageInfo.hoursAgo}</strong> horas
                                    </div>
                                </div>
                            )}

                            <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 dark:border-blue-500 p-3 rounded-r space-y-2">
                                <div className="text-sm font-medium text-blue-900 dark:text-blue-300">
                                    ¿Qué puedes hacer?
                                </div>
                                <div className="text-sm text-blue-800 dark:text-blue-400">
                                    <strong>1.</strong> Usa el botón <strong>📄 (plantilla)</strong> en la barra de mensajes para enviar una plantilla aprobada por Meta.
                                </div>
                                <div className="text-sm text-blue-800 dark:text-blue-400">
                                    <strong>2.</strong> Espera a que el usuario te envíe un nuevo mensaje para poder responder.
                                </div>
                            </div>

                            <div className="text-xs text-muted-foreground italic border-t border-border pt-3">
                                <strong>¿Por qué ocurre esto?</strong> Meta/WhatsApp solo permite responder a usuarios dentro de las 24 horas posteriores a su último mensaje. Esta es una política de WhatsApp Business API para proteger a los usuarios del spam.
                            </div>
                        </div>
                    </DialogHeader>
                    <DialogFooter className="gap-3 sm:gap-2">
                        <Button
                            type="button"
                            onClick={() => setShow24HourWarning(false)}
                            className="w-full settings-btn-primary"
                        >
                            Entendido
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal de Enviar Plantilla WhatsApp */}
            <Dialog open={showWaTemplateModal} onOpenChange={(open) => {
                setShowWaTemplateModal(open);
                if (!open) {
                    setWaTemplateId(null);
                    setWaTemplateParams([]);
                }
            }}>
                <DialogContent className="sm:max-w-lg card-gradient border-0 shadow-[0_4px_12px_rgba(46,63,132,0.15),0_8px_24px_rgba(46,63,132,0.2)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.3),0_8px_24px_rgba(0,0,0,0.4)]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-primary dark:text-[hsl(231,15%,92%)] flex items-center gap-2">
                            <FileText className="w-6 h-6 text-primary dark:text-[hsl(231,55%,70%)]" />
                            Enviar plantilla de WhatsApp
                        </DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground">
                            Selecciona una plantilla aprobada y completa las variables para enviar.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-primary dark:text-[hsl(231,15%,92%)]">
                                Plantilla *
                            </label>
                            <select
                                value={waTemplateId || ''}
                                onChange={(e) => {
                                    const templateId = e.target.value ? Number(e.target.value) : null;
                                    const selectedTpl = whatsappTemplates.find(t => t.id === templateId);
                                    setWaTemplateId(templateId);
                                    setWaTemplateParams(selectedTpl?.default_params ? selectedTpl.default_params.map(() => '') : []);
                                }}
                                className="w-full h-10 px-3 settings-input rounded-xl"
                            >
                                <option value="">Seleccionar plantilla...</option>
                                {whatsappTemplates.map((tpl) => (
                                    <option key={tpl.id} value={tpl.id}>
                                        {tpl.name} ({tpl.meta_template_name})
                                    </option>
                                ))}
                            </select>
                            {whatsappTemplates.length === 0 && (
                                <p className="text-xs text-amber-600 dark:text-amber-400">
                                    No hay plantillas aprobadas. Créelas desde Envíos Masivos.
                                </p>
                            )}
                        </div>

                        {/* Parámetros */}
                        {(() => {
                            const selectedTpl = whatsappTemplates.find(t => t.id === waTemplateId);
                            if (!selectedTpl?.default_params || selectedTpl.default_params.length === 0) return null;
                            return (
                                <div className="space-y-3">
                                    <label className="text-sm font-semibold text-primary dark:text-[hsl(231,15%,92%)]">
                                        Variables de la plantilla
                                    </label>
                                    {selectedTpl.default_params.map((_, idx) => (
                                        <div key={idx} className="space-y-1">
                                            <span className="text-xs text-muted-foreground">{`{{${idx + 1}}}`}</span>
                                            <Input
                                                type="text"
                                                placeholder={`Valor para {{${idx + 1}}}`}
                                                value={waTemplateParams[idx] || ''}
                                                onChange={(e) => {
                                                    const params = [...waTemplateParams];
                                                    params[idx] = e.target.value;
                                                    setWaTemplateParams(params);
                                                }}
                                                className="settings-input rounded-xl"
                                            />
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}

                        {/* Vista previa */}
                        {(() => {
                            const selectedTpl = whatsappTemplates.find(t => t.id === waTemplateId);
                            if (!selectedTpl) return null;
                            let previewBody = selectedTpl.preview_text;
                            waTemplateParams.forEach((val, idx) => {
                                if (val) previewBody = previewBody.replace(`{{${idx + 1}}}`, val);
                            });
                            return (
                                <div className="border border-border/60 rounded-xl overflow-hidden">
                                    <div className="px-3 py-2 bg-muted/40 border-b border-border/40">
                                        <span className="flex items-center gap-2 text-xs font-medium text-foreground/80">
                                            <Eye className="w-3.5 h-3.5" />
                                            Vista previa
                                        </span>
                                    </div>
                                    <div className="p-3 bg-green-50/60 dark:bg-green-950/20">
                                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border border-green-200/60 dark:border-green-800/40 text-sm">
                                            {selectedTpl.header_text && (
                                                <p className="font-bold text-foreground mb-1">{selectedTpl.header_text}</p>
                                            )}
                                            <p className="text-foreground leading-relaxed whitespace-pre-wrap">{previewBody}</p>
                                            {selectedTpl.footer_text && (
                                                <p className="text-xs text-muted-foreground mt-2">{selectedTpl.footer_text}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    <DialogFooter className="gap-2 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowWaTemplateModal(false)}
                            className="settings-btn-secondary"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            disabled={!waTemplateId || isSendingWaTemplate}
                            className="settings-btn-primary"
                            onClick={async () => {
                                if (!waTemplateId || !selectedConversation) return;
                                setIsSendingWaTemplate(true);
                                try {
                                    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
                                    const response = await fetch(`/admin/chat/${selectedConversation.id}/send-template`, {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'X-CSRF-TOKEN': csrfToken,
                                            'Accept': 'application/json',
                                        },
                                        body: JSON.stringify({
                                            whatsapp_template_id: waTemplateId,
                                            template_params: waTemplateParams,
                                        }),
                                    });
                                    const result = await response.json();
                                    if (result.success) {
                                        toast.success('Plantilla enviada exitosamente');
                                        setShowWaTemplateModal(false);
                                        setWaTemplateId(null);
                                        setWaTemplateParams([]);
                                        // Agregar mensaje al chat
                                        if (result.message) {
                                            setLocalMessages(prev => [...prev, result.message]);
                                            setTimeout(() => scrollToBottom(), 100);
                                        }
                                    } else {
                                        toast.error(result.error || 'Error al enviar la plantilla');
                                    }
                                } catch {
                                    toast.error('Error al enviar la plantilla');
                                } finally {
                                    setIsSendingWaTemplate(false);
                                }
                            }}
                        >
                            {isSendingWaTemplate ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Enviando...
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4 mr-2" />
                                    Enviar plantilla
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal de Asignación */}
            <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
                <DialogContent className="sm:max-w-md card-gradient border-0 shadow-[0_4px_12px_rgba(46,63,132,0.15),0_8px_24px_rgba(46,63,132,0.2)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.3),0_8px_24px_rgba(0,0,0,0.4)]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-primary dark:text-[hsl(231,15%,92%)] flex items-center gap-2">
                            <UserPlus className="w-6 h-6 text-primary dark:text-[hsl(231,55%,70%)]" />
                            {t('conversations.assignConversation')}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground">
                            Selecciona un asesor para asignar esta conversación
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-2 max-h-[300px] overflow-y-auto">
                        {/* Opción para quitar asignación */}
                        {selectedConversation?.assigned_to && (
                            <button
                                onClick={() => {
                                    handleAssign(undefined);
                                    setShowAssignModal(false);
                                }}
                                className="w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 bg-gradient-to-b from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-900/20 hover:from-red-100 hover:to-red-150 dark:hover:from-red-900/40 dark:hover:to-red-900/30 text-red-600 dark:text-red-400 border-b border-red-200 dark:border-red-800 mb-2"
                            >
                                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-red-500 text-white">
                                    <X className="w-5 h-5" />
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="font-semibold">Quitar asignación</p>
                                    <p className="text-xs text-red-500 dark:text-red-400">
                                        Dejar sin asesor asignado
                                    </p>
                                </div>
                            </button>
                        )}

                        {users.map((user) => (
                            <button
                                key={user.id}
                                onClick={() => {
                                    handleAssign(user.id);
                                    setShowAssignModal(false);
                                }}
                                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${selectedConversation?.assigned_to === user.id
                                    ? 'chat-message-sent text-white shadow-[0_2px_8px_rgba(46,63,132,0.3)]'
                                    : 'bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] dark:from-[hsl(231,25%,16%)] dark:to-[hsl(231,25%,14%)] hover:from-[#e8ebf5] hover:to-[#e0e4f0] dark:hover:from-[hsl(231,25%,18%)] dark:hover:to-[hsl(231,25%,16%)] text-primary dark:text-[hsl(231,15%,92%)]'
                                    }`}
                            >
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${selectedConversation?.assigned_to === user.id
                                    ? 'bg-card/20 text-white'
                                    : 'bg-primary text-white'
                                    }`}>
                                    {user.name[0]?.toUpperCase()}
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="font-semibold">{user.name}</p>
                                    <p className={`text-xs ${selectedConversation?.assigned_to === user.id ? 'text-white/70' : 'text-muted-foreground'}`}>
                                        {user.role === 'admin' ? t('users.roleAdmin') : t('users.roleAdvisor')}
                                    </p>
                                </div>
                                {selectedConversation?.assigned_to === user.id && (
                                    <Check className="w-5 h-5" />
                                )}
                            </button>
                        ))}
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowAssignModal(false)}
                            className="w-full settings-btn-secondary"
                        >
                            Cerrar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal de Nueva Conversación */}
            <Dialog open={showNewChatModal} onOpenChange={(open) => {
                setShowNewChatModal(open);
                if (!open) {
                    setNewChatData({ phone_number: '', assigned_to: null, whatsapp_template_id: null, template_params: [] });
                    setNewChatError('');
                }
            }}>
                <DialogContent className="sm:max-w-lg card-gradient border-0 shadow-[0_4px_12px_rgba(46,63,132,0.15),0_8px_24px_rgba(46,63,132,0.2)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.3),0_8px_24px_rgba(0,0,0,0.4)]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-primary dark:text-[hsl(231,15%,92%)] flex items-center gap-2">
                            <Plus className="w-6 h-6 text-primary dark:text-[hsl(231,55%,70%)]" />
                            {t('conversations.newConversation')}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground">
                            {t('conversations.newConversationDescription')}
                        </DialogDescription>
                    </DialogHeader>


                    <form onSubmit={(e) => {
                        e.preventDefault();
                        setNewChatError('');

                        if (!newChatData.phone_number.trim()) {
                            setNewChatError('El número de teléfono es requerido');
                            return;
                        }

                        if (!newChatData.whatsapp_template_id) {
                            setNewChatError('Debe seleccionar una plantilla aprobada');
                            return;
                        }

                        setIsCreatingChat(true);
                        router.post('/admin/chat/create', {
                            phone_number: newChatData.phone_number,
                            assigned_to: newChatData.assigned_to,
                            whatsapp_template_id: newChatData.whatsapp_template_id,
                            template_params: newChatData.template_params,
                        }, {
                            onSuccess: () => {
                                setShowNewChatModal(false);
                                setNewChatData({ phone_number: '', assigned_to: null, whatsapp_template_id: null, template_params: [] });
                                setIsCreatingChat(false);
                                toast.success('Conversación creada exitosamente');
                            },
                            onError: (errors) => {
                                setNewChatError(errors.message || errors.phone_number || 'Error al crear la conversación');
                                setIsCreatingChat(false);
                            },
                        });
                    }} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-primary dark:text-[hsl(231,15%,92%)]">
                                {t('conversations.phoneNumber')} *
                            </label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                                <Input
                                    type="tel"
                                    placeholder="3001234567 o +573001234567"
                                    value={newChatData.phone_number}
                                    onChange={(e) => setNewChatData({ ...newChatData, phone_number: e.target.value })}
                                    className="pl-10 settings-input rounded-xl"
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Ingresa el número con o sin código de país. Si no incluyes código, se asumirá +57 (Colombia).
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-primary dark:text-[hsl(231,15%,92%)]">
                                Plantilla de WhatsApp *
                            </label>
                            <select
                                value={newChatData.whatsapp_template_id || ''}
                                onChange={(e) => {
                                    const templateId = e.target.value ? Number(e.target.value) : null;
                                    const selectedTpl = whatsappTemplates.find(t => t.id === templateId);
                                    setNewChatData({
                                        ...newChatData,
                                        whatsapp_template_id: templateId,
                                        template_params: selectedTpl?.default_params ? selectedTpl.default_params.map(() => '') : [],
                                    });
                                }}
                                className="w-full h-10 px-3 settings-input rounded-xl"
                            >
                                <option value="">Seleccionar plantilla...</option>
                                {whatsappTemplates.map((tpl) => (
                                    <option key={tpl.id} value={tpl.id}>
                                        {tpl.name} ({tpl.meta_template_name})
                                    </option>
                                ))}
                            </select>
                            {whatsappTemplates.length === 0 && (
                                <p className="text-xs text-amber-600 dark:text-amber-400">
                                    No hay plantillas aprobadas disponibles. Cree y apruebe plantillas desde Envíos Masivos.
                                </p>
                            )}
                        </div>

                        {/* Template params */}
                        {(() => {
                            const selectedTpl = whatsappTemplates.find(t => t.id === newChatData.whatsapp_template_id);
                            if (!selectedTpl?.default_params || selectedTpl.default_params.length === 0) return null;
                            return (
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-primary dark:text-[hsl(231,15%,92%)]">
                                        Parámetros de la plantilla
                                    </label>
                                    {selectedTpl.default_params.map((_, idx) => (
                                        <Input
                                            key={idx}
                                            type="text"
                                            placeholder={`Valor para {{${idx + 1}}}`}
                                            value={newChatData.template_params[idx] || ''}
                                            onChange={(e) => {
                                                const params = [...newChatData.template_params];
                                                params[idx] = e.target.value;
                                                setNewChatData({ ...newChatData, template_params: params });
                                            }}
                                            className="settings-input rounded-xl"
                                        />
                                    ))}
                                </div>
                            );
                        })()}

                        {/* Template preview */}
                        {(() => {
                            const selectedTpl = whatsappTemplates.find(t => t.id === newChatData.whatsapp_template_id);
                            if (!selectedTpl) return null;
                            let previewBody = selectedTpl.preview_text;
                            newChatData.template_params.forEach((val, idx) => {
                                if (val) previewBody = previewBody.replace(`{{${idx + 1}}}`, val);
                            });
                            return (
                                <div className="border border-border/60 rounded-xl overflow-hidden">
                                    <div className="px-3 py-2 bg-muted/40 border-b border-border/40">
                                        <span className="text-xs font-medium text-foreground/80">Vista previa</span>
                                    </div>
                                    <div className="p-3 bg-green-50/60 dark:bg-green-950/20">
                                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border border-green-200/60 dark:border-green-800/40 max-w-sm text-sm">
                                            {selectedTpl.header_text && (
                                                <p className="font-bold text-foreground mb-1">{selectedTpl.header_text}</p>
                                            )}
                                            <p className="text-foreground leading-relaxed whitespace-pre-wrap">{previewBody}</p>
                                            {selectedTpl.footer_text && (
                                                <p className="text-xs text-muted-foreground mt-2">{selectedTpl.footer_text}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-primary dark:text-[hsl(231,15%,92%)]">
                                Asignar a asesor (opcional)
                            </label>
                            <select
                                value={newChatData.assigned_to || ''}
                                onChange={(e) => setNewChatData({ ...newChatData, assigned_to: e.target.value ? Number(e.target.value) : null })}
                                className="w-full h-10 px-3 settings-input rounded-xl"
                            >
                                <option value="">Yo mismo (Admin)</option>
                                {users.filter(user => user.id !== auth.user.id).map((user) => (
                                    <option key={user.id} value={user.id}>
                                        {user.name} {user.role === 'admin' ? '(Admin)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {newChatError && (
                            <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 dark:border-red-500 p-3 rounded-lg">
                                <p className="text-sm text-red-800 dark:text-red-300">{newChatError}</p>
                            </div>
                        )}

                        <DialogFooter className="gap-2 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setShowNewChatModal(false)}
                                className="settings-btn-secondary"
                            >
                                {t('common.cancel')}
                            </Button>
                            <Button
                                type="submit"
                                disabled={isCreatingChat}
                                className="settings-btn-primary"
                            >
                                {isCreatingChat ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                        Enviando...
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4 mr-2" />
                                        {t('conversations.startConversation')}
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Visor de medios fullscreen - estilo WhatsApp Web */}
            {mediaViewer && (
                <div
                    className="fixed inset-0 z-[100] bg-black/95 flex flex-col"
                    onClick={() => setMediaViewer(null)}
                >
                    {/* Header con controles */}
                    <div
                        className="flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/50 to-transparent"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-4">
                            {mediaViewer.caption && (
                                <p className="text-white text-sm max-w-md truncate">
                                    {mediaViewer.caption}
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Controles de zoom solo para imágenes */}
                            {mediaViewer.type === 'image' && (
                                <>
                                    <button
                                        onClick={() => setImageRotation(prev => prev - 90)}
                                        className="p-2 text-white/70 hover:text-white hover:bg-card/10 rounded-full transition-colors"
                                        title="Rotar"
                                    >
                                        <RotateCcw className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.25))}
                                        className="p-2 text-white/70 hover:text-white hover:bg-card/10 rounded-full transition-colors"
                                        title="Alejar"
                                    >
                                        <ZoomOut className="w-5 h-5" />
                                    </button>
                                    <span className="text-white/70 text-sm min-w-[50px] text-center">
                                        {Math.round(zoomLevel * 100)}%
                                    </span>
                                    <button
                                        onClick={() => setZoomLevel(Math.min(4, zoomLevel + 0.25))}
                                        className="p-2 text-white/70 hover:text-white hover:bg-card/10 rounded-full transition-colors"
                                        title="Acercar"
                                    >
                                        <ZoomIn className="w-5 h-5" />
                                    </button>
                                </>
                            )}

                            {/* Botón descargar */}
                            <a
                                href={mediaViewer.url}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-2 text-white/70 hover:text-white hover:bg-card/10 rounded-full transition-colors"
                                title="Descargar"
                            >
                                <Download className="w-5 h-5" />
                            </a>

                            {/* Botón cerrar */}
                            <button
                                onClick={() => setMediaViewer(null)}
                                className="p-2 text-white/70 hover:text-white hover:bg-card/10 rounded-full transition-colors ml-2"
                                title="Cerrar (Esc)"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                    {/* Contenido del visor */}
                    <div
                        className="flex-1 flex items-center justify-center overflow-hidden p-4"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (!isDragging) {
                                setMediaViewer(null);
                            }
                        }}
                        onMouseMove={(e) => {
                            if (isDragging && zoomLevel > 1) {
                                const dx = e.clientX - dragStart.x;
                                const dy = e.clientY - dragStart.y;
                                setImagePosition(prev => ({
                                    x: prev.x + dx,
                                    y: prev.y + dy
                                }));
                                setDragStart({ x: e.clientX, y: e.clientY });
                            }
                        }}
                        onMouseUp={() => setIsDragging(false)}
                        onMouseLeave={() => setIsDragging(false)}
                    >
                        {mediaViewer.type === 'image' ? (
                            <img
                                ref={imageRef}
                                src={mediaViewer.url}
                                alt={mediaViewer.caption || 'Imagen'}
                                className={`max-w-full max-h-full object-contain select-none ${zoomLevel > 1 ? 'cursor-grab' : 'cursor-zoom-in'
                                    } ${isDragging ? 'cursor-grabbing' : ''}`}
                                style={{
                                    transform: `scale(${zoomLevel}) rotate(${imageRotation}deg) translate(${imagePosition.x / zoomLevel}px, ${imagePosition.y / zoomLevel}px)`,
                                    transformOrigin: 'center center',
                                    transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                                }}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (zoomLevel > 1) {
                                        setIsDragging(true);
                                        setDragStart({ x: e.clientX, y: e.clientY });
                                    } else {
                                        // Si no hay zoom, hacer zoom in
                                        setZoomLevel(2);
                                    }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                draggable={false}
                            />
                        ) : (
                            <video
                                src={mediaViewer.url}
                                controls
                                autoPlay
                                className="max-w-full max-h-full"
                                onClick={(e) => e.stopPropagation()}
                            >
                                Tu navegador no soporta la reproducción de video.
                            </video>
                        )}
                    </div>

                    {/* Footer con caption completo si es largo */}
                    {mediaViewer.caption && mediaViewer.caption.length > 50 && (
                        <div
                            className="px-4 py-3 bg-gradient-to-t from-black/50 to-transparent"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <p className="text-white text-sm text-center max-w-2xl mx-auto">
                                {mediaViewer.caption}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </AdminLayout>
    );
}
