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
} from 'lucide-react';
import { FormEvent, useEffect, useRef, useState, useCallback } from 'react';
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
import { useTranslation } from 'react-i18next';
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
    } | null;
    messages?: Message[];
    tags?: TagItem[];
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
}

export default function ConversationsIndex({ conversations: initialConversations, hasMore: initialHasMore = false, selectedConversation, users, allTags: initialAllTags = [], filters, templates = [] }: ConversationsIndexProps) {
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
    const [newChatData, setNewChatData] = useState({ phone_number: '', contact_name: '', assigned_to: null as number | null });
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
    const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const imageRef = useRef<HTMLImageElement>(null);

    // Estados para el modal de advertencia de 24 horas
    const [show24HourWarning, setShow24HourWarning] = useState(false);
    const [lastUserMessageInfo, setLastUserMessageInfo] = useState<{ date: string; hoursAgo: number } | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const conversationsListRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    // Ref para pausar polling mientras el usuario hace scroll en la lista de chats
    const isScrollingChatsRef = useRef(false);
    const scrollingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const savedScrollTopRef = useRef<number | null>(null);
    const advisorFilterButtonRef = useRef<HTMLButtonElement>(null);
    const [advisorDropdownPosition, setAdvisorDropdownPosition] = useState({ top: 0, right: 0 });

    // Estados para plantillas
    const [showTemplates, setShowTemplates] = useState(false);
    const [templateFilter, setTemplateFilter] = useState('');
    const [selectedTemplateIndex, setSelectedTemplateIndex] = useState(0);

    // Estados para etiquetas
    const [allTags, setAllTags] = useState<TagItem[]>(initialAllTags);
    const [showTagSubmenu, setShowTagSubmenu] = useState(false);
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
        const messages = selectedConversation?.messages;
        if (!messages) return;

        const currentCount = messages.length;
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
    }, [selectedConversation?.messages, isAtBottom, scrollToBottom]);

    // Resetear cuando cambia la conversación
    useEffect(() => {
        lastMessageCountRef.current = 0;
        setNewMessagesCount(0);
        setIsAtBottom(true);
        setOptimisticMessages([]); // Limpiar mensajes optimistas al cambiar de conversación
    }, [selectedConversation?.id]);


    // Limpiar mensajes optimistas cuando llegan los mensajes reales del servidor
    useEffect(() => {
        if (optimisticMessages.length > 0 && selectedConversation?.messages) {
            const serverMessageCount = selectedConversation.messages.length;
            // Si el servidor tiene más mensajes que cuando enviamos, limpiar optimistas
            if (serverMessageCount > messageCountBeforeSendRef.current) {
                setOptimisticMessages([]);
            }
        }
    }, [selectedConversation?.messages?.length, optimisticMessages.length]);

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
                    // Verificar si realmente cambió algo
                    if (freshConv.unread_count !== conv.unread_count ||
                        freshConv.status !== conv.status ||
                        freshConv.last_message_at !== conv.last_message_at ||
                        freshConv.assigned_to !== conv.assigned_to ||
                        freshConv.contact_name !== conv.contact_name ||
                        freshConv.resolved_by !== conv.resolved_by ||
                        freshConv.is_pinned !== conv.is_pinned) {
                        hasChanges = true;
                        return freshConv;
                    }
                    return conv; // Sin cambios, mantener referencia original
                }
                return conv; // No está en primera página, mantener
            }).filter(conv => conv.status !== 'resolved' || serverMap.has(conv.id));

            // Detectar nuevas conversaciones que no existían
            const existingIds = new Set(prev.map(c => c.id));
            const newConvs = initialConversations.filter(c => !existingIds.has(c.id));

            if (newConvs.length > 0) {
                hasChanges = true;
                // Insertar nuevas al inicio (son las más recientes)
                const result = [...newConvs, ...updated];
                return result;
            }

            // Si hubo cambios de datos, verificar si necesitamos reordenar
            // Solo reordenamos los primeros 50 (primera página) para no mover scroll
            if (hasChanges) {
                return updated;
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
        };

        if (contextMenu) {
            window.addEventListener('click', handleClickOutside);
            return () => window.removeEventListener('click', handleClickOutside);
        }
    }, [contextMenu]);

    // Polling para actualizar la lista de conversaciones (siempre activo)
    // Se pausa automáticamente cuando el usuario está haciendo scroll
    useEffect(() => {
        let isActive = true;

        // Actualizar lista de conversaciones cada 5 segundos
        const conversationsInterval = setInterval(() => {
            if (!isActive) return;
            // NO recargar si el usuario está haciendo scroll (evita saltos)
            if (isScrollingChatsRef.current) return;

            // Guardar posición del scroll antes del reload
            if (conversationsListRef.current) {
                savedScrollTopRef.current = conversationsListRef.current.scrollTop;
            }

            router.reload({
                only: ['conversations'],
                onError: () => {
                    // Silenciar errores de conflicto para evitar spam en consola
                },
                onFinish: () => {
                    // Restaurar posición del scroll después del reload
                    if (savedScrollTopRef.current !== null && conversationsListRef.current) {
                        requestAnimationFrame(() => {
                            if (conversationsListRef.current && savedScrollTopRef.current !== null) {
                                conversationsListRef.current.scrollTop = savedScrollTopRef.current;
                                savedScrollTopRef.current = null;
                            }
                        });
                    }
                },
            });
        }, 5000); // 5 segundos para reducir carga

        // Cleanup: detener polling al desmontar
        return () => {
            isActive = false;
            clearInterval(conversationsInterval);
        };
    }, []);

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

    // Resetear posición y zoom cuando cambia el visor
    useEffect(() => {
        if (mediaViewer) {
            setZoomLevel(1);
            setImagePosition({ x: 0, y: 0 });
        }
    }, [mediaViewer?.url]);

    // Polling para actualización de mensajes en conversación seleccionada
    useEffect(() => {
        // Solo hacer polling si hay una conversación seleccionada
        if (!selectedConversation) return;

        let isActive = true;

        // Consultar cada 5 segundos si hay mensajes nuevos en la conversación actual
        const messagesInterval = setInterval(() => {
            if (!isActive) return;

            router.reload({
                only: ['selectedConversation'],
                onError: () => {
                    // Silenciar errores de conflicto para evitar spam en consola
                },
            });
        }, 5000); // 5 segundos para reducir carga

        // Cleanup: detener polling al desmontar
        return () => {
            isActive = false;
            clearInterval(messagesInterval);
        };
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
            default:
                return 'bg-gray-300';
        }
    };

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            active: t('conversations.statusLabels.active'),
            pending: 'Pendiente',
            resolved: t('conversations.statusLabels.resolved'),
        };
        return labels[status] || status;
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
        if (!selectedConversation?.messages || selectedConversation.messages.length === 0) {
            return null;
        }

        // Buscar el último mensaje del usuario (is_from_user = true)
        const userMessages = selectedConversation.messages.filter(msg => msg.is_from_user);

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
    }, [selectedConversation?.messages]);

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
            router.get(`/admin/chat/${conversationId}`, {}, {
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
            case 'failed':
                return (
                    <span title={errorMessage ? `Error: ${errorMessage}` : t('conversations.status.failed')}>
                        <X className="w-4 h-4 text-red-500" />
                    </span>
                );
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

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();

        // Protección contra doble envío
        if (isSubmitting) {
            return;
        }

        const hasContent = data.content && data.content.trim().length > 0;
        const hasFile = selectedFile !== null;

        if ((!hasContent && !hasFile) || !selectedConversation) {
            return;
        }

        setIsSubmitting(true);

        // Guardar conteo de mensajes actual para detectar cuando llegue el real
        messageCountBeforeSendRef.current = selectedConversation.messages?.length || 0;

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
                    // Si es error 419, la sesión expiró
                    if (response.status === 419) {
                        throw new Error('Sesión expirada. Por favor recarga la página.');
                    }
                    throw new Error('Error al enviar mensaje');
                }
                return response.json();
            })
            .then(() => {
                // Marcar como enviado - se eliminará cuando llegue el mensaje real del servidor
                setOptimisticMessages(prev =>
                    prev.map(m => m.tempId === tempId ? { ...m, status: 'sending' as const } : m)
                );
                setIsSubmitting(false);
            })
            .catch((error) => {
                console.error('Error sending message:', error);
                // Marcar mensaje como error
                setOptimisticMessages(prev =>
                    prev.map(m => m.tempId === tempId ? { ...m, status: 'error' as const } : m)
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
        }).catch(err => console.error('Error toggling pin:', err));
    };

    const handleAssign = (userId?: number | null) => {
        if (!selectedConversation) return;
        router.post(`/admin/chat/${selectedConversation.id}/assign`, { user_id: userId ?? null }, {
            preserveScroll: true,
        });
    };

    const handleAssignFromContext = (conversationId: number, userId?: number | null) => {
        setContextMenu(null);
        router.post(`/admin/chat/${conversationId}/assign`, { user_id: userId ?? null }, {
            preserveScroll: true,
        });
    };

    const handleStatusChange = (status: string) => {
        if (!selectedConversation) return;
        const convId = selectedConversation.id;

        if (status === 'resolved') {
            // Quitar inmediatamente del listado local para que desaparezca
            setLocalConversations(prev => prev.filter(c => c.id !== convId));
            // Backend ya redirige a /admin/chat (index) al resolver.
            router.post(`/admin/chat/${convId}/status`, { status }, {
                preserveScroll: false,
            });
            return;
        }

        router.post(`/admin/chat/${convId}/status`, { status }, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                // Actualizar estado localmente sin recargar ni navegar
                setLocalConversations(prev =>
                    prev.map(c => c.id === convId ? { ...c, status, resolved_by_user: null, resolved_at: null } : c)
                );
            },
        });
    };

    const handleStatusChangeFromContext = (conversationId: number, status: string) => {
        setContextMenu(null);

        if (status === 'resolved') {
            // Quitar inmediatamente del listado local para que desaparezca
            setLocalConversations(prev => prev.filter(c => c.id !== conversationId));
            // Backend ya redirige a /admin/chat (index) al resolver.
            router.post(`/admin/chat/${conversationId}/status`, { status }, {
                preserveScroll: false,
            });
            return;
        }

        router.post(`/admin/chat/${conversationId}/status`, { status }, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                setLocalConversations(prev =>
                    prev.map(c => c.id === conversationId ? { ...c, status, resolved_by_user: null, resolved_at: null } : c)
                );
            },
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
        });
    };

    const handleCloseChat = () => {
        router.get('/admin/chat', {}, {
            preserveState: true,
        });
    };

    return (
        <AdminLayout>
            <Head title={t('conversations.title')} />

            <div className="h-[calc(100vh-0px)] flex bg-background overflow-hidden">
                {/* Lista de Conversaciones - Izquierda */}
                {/* Mobile: oculta cuando hay chat | Desktop: siempre visible con toggle */}
                <div className={`bg-accent dark:bg-accent flex-col transition-all duration-300 flex-shrink-0 conversation-sidebar ${selectedConversation ? 'hidden md:flex' : 'flex'
                    } ${isSidebarVisible ? 'w-full md:w-64 lg:w-72 xl:w-80' : 'hidden md:w-0 md:overflow-hidden'
                    }`}>
                    {/* Header */}
                    <div className="p-3 md:p-4 conversation-header">
                        <div className="flex items-center justify-between mb-2 md:mb-3">
                            <h2 className="text-base md:text-lg font-bold text-primary dark:text-primary whitespace-nowrap">{t('conversations.title')}</h2>

                            <div className="flex items-center gap-1 flex-shrink-0">
                                {/* Botón para nueva conversación */}
                                <button
                                    onClick={() => setShowNewChatModal(true)}
                                    className="p-1.5 chat-message-sent text-white rounded-lg shadow-[0_1px_2px_rgba(46,63,132,0.2),0_2px_4px_rgba(46,63,132,0.15)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.25),0_4px_8px_rgba(46,63,132,0.2)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
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
                                        className={`p-1.5 rounded-lg shadow-[0_1px_2px_rgba(46,63,132,0.2),0_2px_4px_rgba(46,63,132,0.15)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.25),0_4px_8px_rgba(46,63,132,0.2)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 ${isSelectionMode
                                            ? 'bg-gradient-to-b from-[#22c55e] to-[#16a34a] text-white'
                                            : 'chat-message-sent text-white'
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
                                        className={`p-1.5 rounded-lg shadow-[0_1px_2px_rgba(46,63,132,0.2),0_2px_4px_rgba(46,63,132,0.15)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.25),0_4px_8px_rgba(46,63,132,0.2)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 ${activeFilterCount > 0
                                            ? 'bg-gradient-to-b from-[#f59e0b] to-[#d97706] text-white'
                                            : 'chat-message-sent text-white'
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
                                        <div className="absolute right-0 top-full mt-1 card-gradient rounded-xl shadow-xl border border-border py-1 z-[100] w-64 max-h-[70vh] overflow-y-auto custom-scrollbar">
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
                                                                {statusFilter === 'unanswered' ? 'Sin contestar' : statusFilter === 'active' ? 'Activo' : statusFilter === 'pending' ? 'Pendiente' : 'Resuelto'}
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
                        <div className="relative">
                            <label htmlFor="conversation-search" className="sr-only">{t('conversations.searchPlaceholder')}</label>
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                            <Input
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
                                className="pl-10 settings-input rounded-2xl transition-all duration-200"
                            />
                        </div>
                    </div>

                    {/* Lista de Conversaciones */}
                    <div
                        ref={conversationsListRef}
                        className="flex-1 overflow-y-auto overflow-x-hidden px-2 md:px-2 pt-4 custom-scrollbar-light"
                    >
                        {localConversations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
                                <MessageSquare className="w-16 h-16 mb-4 text-muted-foreground" />
                                <p className="text-center text-sm">
                                    {t('conversations.noConversations')}
                                </p>
                                <p className="text-center text-xs text-muted-foreground mt-2">
                                    {t('conversations.noConversationsSubtitle')}
                                </p>
                            </div>
                        ) : displayedConversations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
                                <Filter className="w-12 h-12 mb-4 text-muted-foreground" />
                                <p className="text-center text-sm">
                                    No hay conversaciones con este filtro
                                </p>
                                <p className="text-center text-xs text-muted-foreground mt-2">
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
                                        className={`w-full p-3 md:p-4 mb-2 transition-all duration-200 flex items-start gap-3 text-left rounded-xl select-none ${selectedConversations.includes(conversation.id)
                                            ? 'bg-gradient-to-b from-[#bbf7d0] to-[#86efac] dark:from-[hsl(142,40%,25%)] dark:to-[hsl(142,35%,20%)] shadow-[0_1px_3px_rgba(34,197,94,0.15),0_4px_12px_rgba(34,197,94,0.2)] ring-2 ring-green-400 dark:ring-green-600'
                                            : selectedConversation?.id === conversation.id
                                                ? 'bg-gradient-to-b from-[#d8dcef] to-[#d2d7ec] dark:from-[hsl(231,30%,22%)] dark:to-[hsl(231,30%,18%)] shadow-[0_1px_3px_rgba(46,63,132,0.08),0_4px_12px_rgba(46,63,132,0.12)]'
                                                : 'bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] dark:from-[hsl(231,25%,16%)] dark:to-[hsl(231,25%,14%)] shadow-[0_1px_2px_rgba(46,63,132,0.04)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.06),0_4px_8px_rgba(46,63,132,0.08)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.15)]'
                                            }`}
                                    >
                                        {/* Avatar / Checkbox en modo selección */}
                                        <div className="relative flex-shrink-0">
                                            {isSelectionMode ? (
                                                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center ${selectedConversations.includes(conversation.id)
                                                    ? 'bg-gradient-to-b from-[#22c55e] to-[#16a34a]'
                                                    : 'bg-gradient-to-b from-[#e5e7eb] to-[#d1d5db] dark:from-[hsl(231,25%,30%)] dark:to-[hsl(231,25%,25%)]'
                                                    } shadow-[0_2px_4px_rgba(46,63,132,0.15)]`}>
                                                    {selectedConversations.includes(conversation.id) ? (
                                                        <CheckSquare className="w-5 h-5 text-white" />
                                                    ) : (
                                                        <Square className="w-5 h-5 text-muted-foreground" />
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full chat-message-sent flex items-center justify-center text-white text-sm md:text-base font-medium shadow-[0_2px_4px_rgba(46,63,132,0.15),0_4px_8px_rgba(46,63,132,0.1),inset_0_1px_0_rgba(255,255,255,0.1)]">
                                                    {conversation.contact_name?.[0]?.toUpperCase() || '?'}
                                                </div>
                                            )}
                                            {!isSelectionMode && conversation.unread_count > 0 && (
                                                <div className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-gradient-to-b from-[#22c55e] to-[#16a34a] rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-[0_2px_4px_rgba(22,163,74,0.3),0_1px_2px_rgba(22,163,74,0.2)]">
                                                    {conversation.unread_count}
                                                </div>
                                            )}
                                        </div>

                                        {/* Información */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-semibold text-foreground truncate text-sm flex items-center gap-1">
                                                        {conversation.contact_name || 'Sin nombre'}
                                                        {conversation.is_pinned && (
                                                            <Pin className="w-3 h-3 text-primary flex-shrink-0 rotate-45" />
                                                        )}
                                                    </h3>
                                                    <p className="text-xs text-muted-foreground truncate">
                                                        {conversation.phone_number}
                                                    </p>
                                                </div>
                                                <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                                                    {formatTime(conversation.last_message_at)}
                                                </span>
                                            </div>
                                            <p className={`text-xs md:text-sm truncate flex items-center gap-1 ${conversation.unread_count > 0 ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                                                {conversation.last_message && (
                                                    conversation.last_message.is_from_user ? (
                                                        <span title="Mensaje del cliente">
                                                            <CornerDownLeft className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                                        </span>
                                                    ) : (
                                                        <span title="Mensaje enviado">
                                                            <CornerDownRight className="w-3 h-3 text-primary dark:text-primary flex-shrink-0" />
                                                        </span>
                                                    )
                                                )}
                                                <span className="truncate">
                                                    {conversation.last_message?.content || t('conversations.noMessages')}
                                                </span>
                                            </p>
                                            <div className="flex items-center justify-between mt-1">
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-2 h-2 rounded-full ${getStatusColor(conversation.status)}`}></span>
                                                    <span className="text-xs text-muted-foreground">{getStatusLabel(conversation.status)}</span>
                                                </div>
                                                {/* Mostrar quién resolvió la conversación */}
                                                {conversation.status === 'resolved' && conversation.resolved_by_user && (() => {
                                                    const colors = getUserBadgeColor(conversation.resolved_by_user!.id);
                                                    return (
                                                        <span className={`text-[10px] ${colors.text} ${colors.bg} border ${colors.border} px-1.5 py-0.5 rounded-full truncate max-w-[130px] font-medium`} title={`Resuelto por ${conversation.resolved_by_user!.name}`}>
                                                            <CheckCheck className="w-3 h-3 inline mr-0.5" />
                                                            {conversation.resolved_by_user!.name.split(' ')[0]}
                                                        </span>
                                                    );
                                                })()}
                                                {/* Mostrar asesor asignado (solo si no está resuelta) */}
                                                {conversation.assigned_user && conversation.status !== 'resolved' && (
                                                    <span className="text-[10px] text-muted-foreground bg-accent dark:bg-accent px-1.5 py-0.5 rounded truncate max-w-[80px]" title={conversation.assigned_user.name}>
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
                                        </div>
                                    </button>
                                ))}

                                {/* Indicador de carga de más conversaciones */}
                                {isLoadingMore && (
                                    <div className="py-4 text-center">
                                        <div className="inline-block w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                )}

                                {/* Indicador de más conversaciones */}
                                {hasMore && !isLoadingMore && (
                                    <div className="py-2 text-center text-xs text-muted-foreground">
                                        Desplaza para cargar más...
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Barra de acciones para selección múltiple */}
                    {selectedConversations.length > 0 && (
                        <div className="p-3 chat-message-sent border-t border-[#4e5fa4]">
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
                                        <div className="absolute bottom-full left-0 right-0 mb-1 bg-card rounded-xl shadow-xl border border-border py-2 z-50">
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
                            </div>
                        </div>
                    )}

                    {/* Menú Contextual */}
                    {contextMenu && (() => {
                        const conversation = localConversations.find((c: Conversation) => c.id === contextMenu.conversationId);
                        if (!conversation) return null;

                        // Lógica de posicionamiento inteligente para evitar desbordamiento
                        const windowHeight = window.innerHeight;
                        const spaceBelow = windowHeight - contextMenu.y;
                        const minSpaceResult = 400; // Espacio mínimo deseado

                        // Si hay poco espacio abajo (menos de 400px), mostrar hacia arriba
                        const showUpwards = spaceBelow < minSpaceResult;

                        return (
                            <div
                                className="fixed card-gradient rounded-xl shadow-xl border border-border py-2 z-50 min-w-[240px] overflow-y-auto"
                                style={{
                                    left: `${contextMenu.x}px`,
                                    top: showUpwards ? 'auto' : `${contextMenu.y}px`,
                                    bottom: showUpwards ? `${windowHeight - contextMenu.y}px` : 'auto',
                                    maxHeight: 'calc(100vh - 100px)' // Altura máxima adaptativa
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
                                    <div className="max-h-[120px] overflow-y-auto">
                                        {allTags.filter(t => !(conversation.tags || []).some(ct => ct.id === t.id)).map((tag) => (
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
                            </div>
                        );
                    })()}
                </div>

                {/* Área de Chat - Derecha */}
                {/* En mobile: muestra solo cuando hay selección | En desktop: siempre visible */}
                {!selectedConversation ? (
                    <div className="hidden md:flex flex-1 items-center justify-center bg-background">
                        <div className="text-center text-muted-foreground p-8 md:p-12">
                            <MessageSquare className="w-24 h-24 mx-auto mb-4 text-muted-foreground/40" />
                            <h3 className="text-xl font-semibold text-foreground/60 mb-2">
                                {t('conversations.selectConversation')}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                {t('conversations.selectConversationHint')}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col bg-card w-full md:w-auto">
                        {/* Header del Chat */}
                        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 bg-background/80 backdrop-blur-sm border-b border-border">
                            <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
                                {/* Botón volver (mobile) / toggle sidebar (desktop) */}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        // En mobile: volver a lista | En desktop: toggle sidebar
                                        if (window.innerWidth < 768) {
                                            handleCloseChat();
                                        } else {
                                            setIsSidebarVisible(!isSidebarVisible);
                                        }
                                    }}
                                    className="hover:bg-accent flex-shrink-0"
                                    title={isSidebarVisible ? t('conversations.hideList') : t('conversations.showList')}
                                >
                                    {isSidebarVisible ? (
                                        <PanelLeftClose className="w-5 h-5" />
                                    ) : (
                                        <PanelLeftOpen className="w-5 h-5" />
                                    )}
                                </Button>
                                {/* Avatar e Información */}
                                <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary flex items-center justify-center text-white text-sm md:text-base font-medium flex-shrink-0">
                                        {selectedConversation.contact_name?.[0]?.toUpperCase() || '?'}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h2 className="font-semibold text-foreground text-sm md:text-base truncate">
                                            {selectedConversation.contact_name || 'Sin nombre'}
                                        </h2>
                                        <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
                                            <Phone className="w-3 h-3" />
                                            <span>{selectedConversation.phone_number}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Estado */}
                                <div className="hidden lg:flex items-center gap-2 ml-4 px-3 py-1 rounded-full card-gradient shadow-[0_1px_3px_rgba(46,63,132,0.08),0_2px_6px_rgba(46,63,132,0.06),inset_0_1px_0_rgba(255,255,255,0.9)]">
                                    <span className={`w-2 h-2 rounded-full ${getStatusColor(selectedConversation.status)}`}></span>
                                    <span className="text-sm text-primary dark:text-primary font-medium">{getStatusLabel(selectedConversation.status)}</span>
                                </div>

                                {/* Asignación */}
                                {selectedConversation.assigned_user && (
                                    <div className="hidden xl:block text-sm text-muted-foreground ml-2">
                                        {t('conversations.assignedTo')}: <span className="font-medium text-primary dark:text-primary">{selectedConversation.assigned_user.name}</span>
                                    </div>
                                )}
                            </div>

                            {/* Acciones y Cerrar */}
                            <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                                {/* Botón Asignar - Solo Admin */}
                                {isAdmin && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowAssignModal(true)}
                                        className="hover:bg-background text-primary dark:text-primary"
                                        title={t('conversations.assignConversation')}
                                    >
                                        <UserPlus className="w-5 h-5" />
                                    </Button>
                                )}

                                {/* Menú de Tres Puntos */}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm">
                                            <MoreVertical className="w-5 h-5" />
                                        </Button>
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

                                        {/* Eliminar chat - Solo administradores */}
                                        {isAdmin && (
                                            <>
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

                                {/* Botón Cerrar Chat */}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleCloseChat}
                                    className="hover:bg-accent"
                                    title={t('conversations.closeChatHint')}
                                >
                                    <X className="w-5 h-5" />
                                </Button>
                            </div>
                        </div>

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
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="ml-auto text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 h-7"
                                            onClick={() => handleStatusChange('active')}
                                        >
                                            Reabrir
                                        </Button>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Área de Mensajes */}
                        <div
                            ref={messagesContainerRef}
                            className="flex-1 overflow-y-auto px-3 md:px-6 py-3 md:py-4 messages-area relative custom-scrollbar"
                        >
                            {!selectedConversation.messages || selectedConversation.messages.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-muted-foreground">
                                    <p>{t('conversations.noMessagesInConversation')}</p>
                                </div>
                            ) : (
                                <div className="space-y-3 md:space-y-4">
                                    {selectedConversation.messages.map((message) => (
                                        <div
                                            key={message.id}
                                            className={`flex ${message.is_from_user ? 'justify-start' : 'justify-end'}`}
                                        >
                                            <div
                                                className={`max-w-[85%] md:max-w-[70%] px-3 md:px-4 py-2 ${message.is_from_user
                                                    ? 'rounded-[18px_18px_18px_4px] card-gradient shadow-[0_1px_3px_rgba(46,63,132,0.06),0_3px_8px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.9)]'
                                                    : 'rounded-[18px_18px_4px_18px] chat-message-sent text-white shadow-[0_2px_4px_rgba(46,63,132,0.2),0_4px_12px_rgba(46,63,132,0.25),inset_0_1px_0_rgba(255,255,255,0.15)]'
                                                    }`}
                                            >
                                                {/* Remitente (si es asesor) */}
                                                {!message.is_from_user && message.sender && (
                                                    <p className="text-xs opacity-70 mb-1">
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
                                                    <div className="flex items-start gap-2 text-sm">
                                                        <User className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                                        <p className="whitespace-pre-wrap break-words">{message.content}</p>
                                                    </div>
                                                ) : (
                                                    <p className="text-sm whitespace-pre-wrap break-words">
                                                        {message.content}
                                                    </p>
                                                )}

                                                {/* Hora y Estado */}
                                                <div className={`flex items-center justify-end gap-1 mt-1 text-xs ${message.is_from_user ? 'text-muted-foreground' : 'text-white opacity-70'
                                                    }`}>
                                                    <span>{formatTime(message.created_at)}</span>
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
                                            <div
                                                className={`max-w-[85%] md:max-w-[70%] rounded-[18px_18px_4px_18px] px-3 md:px-4 py-2 ${message.status === 'error'
                                                    ? 'bg-gradient-to-b from-red-400 to-red-500 text-white shadow-[0_2px_4px_rgba(239,68,68,0.2),0_4px_12px_rgba(239,68,68,0.25)]'
                                                    : 'chat-message-sent text-white shadow-[0_2px_4px_rgba(46,63,132,0.2),0_4px_12px_rgba(46,63,132,0.25),inset_0_1px_0_rgba(255,255,255,0.15)] opacity-80'
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

                                                {/* Estado del mensaje */}
                                                <div className="flex items-center justify-end gap-1 mt-1 text-xs text-white opacity-70">
                                                    <span>{formatTime(message.created_at)}</span>
                                                    {message.status === 'sending' ? (
                                                        <Clock className="w-3 h-3 animate-pulse" />
                                                    ) : (
                                                        <span className="text-red-200 text-xs">Error al enviar</span>
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
                                className={`sticky bottom-4 left-full -translate-x-8 flex items-center gap-2 card-gradient hover:from-[#fafbfc] hover:to-[#f0f2f8] text-primary dark:text-primary px-3 py-2 rounded-full shadow-[0_2px_8px_rgba(46,63,132,0.15),0_4px_16px_rgba(46,63,132,0.1)] hover:shadow-[0_4px_12px_rgba(46,63,132,0.2),0_8px_24px_rgba(46,63,132,0.15)] z-10 transition-all duration-300 ${isAtBottom
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
                        <form onSubmit={handleSubmit} className="px-3 md:px-6 py-3 md:py-4 bg-background">
                            {/* Preview del archivo seleccionado */}
                            {selectedFile && (
                                <div className="mb-2 flex items-center gap-2 p-2 bg-gradient-to-b from-blue-50 to-blue-100/50 rounded-lg">
                                    <Paperclip className="w-4 h-4 text-primary dark:text-primary" />
                                    <span className="text-sm text-primary dark:text-primary flex-1 truncate">{selectedFile.name}</span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleRemoveFile}
                                        className="h-6 w-6 p-0 hover:bg-red-100"
                                    >
                                        <X className="w-4 h-4 text-red-600" />
                                    </Button>
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

                            <div className="flex items-end gap-2 md:gap-3">
                                {/* Input de archivo oculto */}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />

                                {/* Botón de adjuntar */}
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="flex hover:bg-accent"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Paperclip className="w-5 h-5 text-primary dark:text-primary" />
                                </Button>

                                {/* Campo de texto */}
                                <div className="relative flex-1">
                                    <Textarea
                                        value={data.content}
                                        onChange={(e) => handleMessageChange(e.target.value)}
                                        placeholder={t('conversations.messagePlaceholder')}
                                        className="flex-1 min-h-[40px] md:min-h-[44px] max-h-[100px] md:max-h-[120px] text-sm md:text-base resize-none border-0 card-gradient focus:ring-2 focus:ring-primary shadow-[0_1px_3px_rgba(46,63,132,0.06),0_2px_6px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] focus:shadow-[0_2px_6px_rgba(46,63,132,0.12),0_4px_12px_rgba(46,63,132,0.15),inset_0_1px_0_rgba(255,255,255,0.9)] rounded-3xl transition-shadow duration-200"
                                        onKeyDown={handleTemplateKeyDown}
                                        onPaste={handlePaste}
                                        spellCheck={true}
                                        lang="es"
                                        autoCorrect="on"
                                    />

                                    {/* Dropdown de plantillas */}
                                    {showTemplates && filteredTemplates.length > 0 && (
                                        <div className="absolute bottom-full left-0 right-0 mb-2 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto z-50">
                                            {filteredTemplates.map((template, index) => (
                                                <div
                                                    key={template.id}
                                                    className={`px-4 py-3 cursor-pointer transition-colors ${index === selectedTemplateIndex
                                                        ? 'bg-blue-50 text-blue-700'
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
                                        <div className="absolute bottom-full left-2 mb-1 animate-in fade-in slide-in-from-bottom-1 duration-200">
                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-full shadow-sm">
                                                <Check className="w-3 h-3 text-blue-500" />
                                                <span className="text-[11px] text-blue-600 dark:text-blue-400">
                                                    <span className="line-through opacity-60">{lastCorrection.original}</span>
                                                    {' → '}
                                                    <span className="font-medium">{lastCorrection.corrected}</span>
                                                </span>
                                                <button
                                                    type="button"
                                                    className="ml-0.5 text-blue-400 hover:text-blue-600 dark:hover:text-blue-300"
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
                                                    <RotateCcw className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Botón de enviar */}
                                <Button
                                    type="submit"
                                    disabled={(!(data.content?.trim()) && !selectedFile) || processing || isSubmitting}
                                    className="chat-message-sent hover:from-[#4e5fa4] hover:to-[#3e4f94] text-white w-11 h-11 rounded-full shadow-[0_2px_4px_rgba(46,63,132,0.2),0_4px_12px_rgba(46,63,132,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] hover:shadow-[0_4px_8px_rgba(46,63,132,0.25),0_6px_16px_rgba(46,63,132,0.35),inset_0_1px_0_rgba(255,255,255,0.2)] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed p-0 flex items-center justify-center"
                                >
                                    <Send className="w-5 h-5" />
                                </Button>
                            </div>
                            <p className="hidden md:block text-xs text-muted-foreground mt-2">
                                {t('conversations.sendHint')}
                            </p>
                        </form>
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
                                    <strong>1.</strong> Utiliza el botón <strong>"Nueva conversación"</strong> en los filtros para iniciar una conversación con una plantilla aprobada por Meta.
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
                    setNewChatData({ phone_number: '', contact_name: '', assigned_to: null });
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

                        setIsCreatingChat(true);
                        router.post('/admin/chat/create', {
                            phone_number: newChatData.phone_number,
                            contact_name: newChatData.contact_name,
                            assigned_to: newChatData.assigned_to,
                            message: 'saludo' // Se usa plantilla de saludo automáticamente
                        }, {
                            onSuccess: () => {
                                setShowNewChatModal(false);
                                setNewChatData({ phone_number: '', contact_name: '', assigned_to: null });
                                setIsCreatingChat(false);
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
                                {t('conversations.contactName')} (opcional)
                            </label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                                <Input
                                    type="text"
                                    placeholder="Nombre del contacto"
                                    value={newChatData.contact_name}
                                    onChange={(e) => setNewChatData({ ...newChatData, contact_name: e.target.value })}
                                    className="pl-10 settings-input rounded-xl"
                                />
                            </div>
                        </div>

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

                        <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 dark:border-blue-500 p-3">
                            <div className="text-sm text-blue-800 dark:text-blue-300">
                                <strong>Mensaje automático:</strong> Se enviará el saludo de presentación usando la plantilla aprobada por Meta con el nombre del asesor asignado.
                            </div>
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
                                        onClick={() => {
                                            setZoomLevel(1);
                                            setImagePosition({ x: 0, y: 0 });
                                        }}
                                        className="p-2 text-white/70 hover:text-white hover:bg-card/10 rounded-full transition-colors"
                                        title="Restablecer zoom"
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
                                    transform: `scale(${zoomLevel}) translate(${imagePosition.x / zoomLevel}px, ${imagePosition.y / zoomLevel}px)`,
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
