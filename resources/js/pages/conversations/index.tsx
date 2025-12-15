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
    ListFilter
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

interface Message {
    id: number;
    content: string;
    message_type: string;
    media_url?: string | null;
    is_from_user: boolean;
    status: string;
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
    last_message_at: string | null;
    last_message: {
        content: string;
        created_at: string;
        is_from_user: boolean;
    } | null;
    messages?: Message[];
}

interface User {
    id: number;
    name: string;
    role: string;
}

interface ConversationsIndexProps {
    conversations: Conversation[];
    hasMore?: boolean;
    selectedConversation?: Conversation;
    users: User[];
    filters: {
        search?: string;
        status?: string;
        assigned?: string;
    };
}

export default function ConversationsIndex({ conversations: initialConversations, hasMore: initialHasMore = false, selectedConversation, users, filters }: ConversationsIndexProps) {
    const { t } = useTranslation();
    const { auth } = usePage().props as any;
    const isAdmin = auth.user.role === 'admin';
    
    const [search, setSearch] = useState(filters.search || '');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSidebarVisible, setIsSidebarVisible] = useState(true);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [contextMenu, setContextMenu] = useState<{ conversationId: number; x: number; y: number } | null>(null);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showNewChatModal, setShowNewChatModal] = useState(false);
    const [newChatData, setNewChatData] = useState({ phone_number: '', contact_name: '', message: '' });
    const [newChatError, setNewChatError] = useState('');
    const [isCreatingChat, setIsCreatingChat] = useState(false);
    const [advisorSearchQuery, setAdvisorSearchQuery] = useState('');
    const [filterByAdvisor, setFilterByAdvisor] = useState<number | null>(null);
    const [showAdvisorFilter, setShowAdvisorFilter] = useState(false);
    const [selectedConversations, setSelectedConversations] = useState<number[]>([]);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [showStatusFilter, setShowStatusFilter] = useState(false);
    const [showBulkAssignMenu, setShowBulkAssignMenu] = useState(false);
    const [bulkAssignSearchQuery, setBulkAssignSearchQuery] = useState('');
    const [mediaViewer, setMediaViewer] = useState<{ url: string; type: 'image' | 'video'; caption?: string } | null>(null);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const imageRef = useRef<HTMLImageElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const conversationsListRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Estados para scroll infinito de conversaciones
    const [localConversations, setLocalConversations] = useState<Conversation[]>(initialConversations);
    const [hasMore, setHasMore] = useState(initialHasMore);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    
    // Estados para control de scroll inteligente
    const [isAtBottom, setIsAtBottom] = useState(true);
    const [newMessagesCount, setNewMessagesCount] = useState(0);
    const lastMessageCountRef = useRef(0);
    
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
    }, [selectedConversation?.id]);

    // Sincronizar conversaciones cuando cambian desde el servidor
    useEffect(() => {
        setLocalConversations(initialConversations);
        setHasMore(initialHasMore);
        setCurrentPage(1);
    }, [initialConversations, initialHasMore]);

    // Función para cargar más conversaciones (scroll infinito)
    const loadMoreConversations = useCallback(async () => {
        if (isLoadingMore || !hasMore) return;
        
        setIsLoadingMore(true);
        const nextPage = currentPage + 1;
        
        try {
            const response = await fetch(`/admin/chat?page=${nextPage}`, {
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
            });
            
            if (response.ok) {
                const data = await response.json();
                setLocalConversations(prev => [...prev, ...data.conversations]);
                setHasMore(data.hasMore);
                setCurrentPage(nextPage);
            }
        } catch (error) {
            console.error('Error cargando más conversaciones:', error);
        } finally {
            setIsLoadingMore(false);
        }
    }, [isLoadingMore, hasMore, currentPage]);

    // Detectar scroll al final de la lista de conversaciones
    useEffect(() => {
        const container = conversationsListRef.current;
        if (!container) return;

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            // Si llegamos al 80% del scroll, cargar más
            if (scrollTop + clientHeight >= scrollHeight * 0.8 && hasMore && !isLoadingMore) {
                loadMoreConversations();
            }
        };

        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
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
        const handleClickOutside = () => setContextMenu(null);
        
        if (contextMenu) {
            window.addEventListener('click', handleClickOutside);
            return () => window.removeEventListener('click', handleClickOutside);
        }
    }, [contextMenu]);

    // Polling para actualizar la lista de conversaciones (siempre activo)
    useEffect(() => {
        let isActive = true;
        
        // Actualizar lista de conversaciones cada 5 segundos
        const conversationsInterval = setInterval(() => {
            if (!isActive) return;
            
            router.reload({ 
                only: ['conversations'],
                onError: () => {
                    // Silenciar errores de conflicto para evitar spam en consola
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
        const handleClickOutside = () => {
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
        };
        
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [showAdvisorFilter, showStatusFilter, showBulkAssignMenu]);

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
        
        // Cancelar búsqueda anterior si existe
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }
        
        // Esperar 400ms antes de buscar (debounce)
        searchTimeoutRef.current = setTimeout(() => {
            // Resetear página y conversaciones locales para nueva búsqueda
            setCurrentPage(1);
            
            // Si hay una conversación seleccionada, mantenerla abierta
            const url = selectedConversation 
                ? `/admin/chat/${selectedConversation.id}`
                : '/admin/chat';
            
            router.get(url, { search: value }, {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ['conversations', 'hasMore'],
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
        const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true });
        } else if (diffDays === 1) {
            return t('conversations.yesterday');
        } else if (diffDays < 7) {
            return d.toLocaleDateString('es-ES', { weekday: 'short' });
        } else {
            return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
        }
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

    // Obtener asesores que tienen chats activos asignados
    const advisorsWithActiveChats = users.filter(user => 
        localConversations.some(conv => 
            conv.assigned_to === user.id && conv.status !== 'resolved'
        )
    );

    // Filtrar asesores por búsqueda
    const filteredAdvisors = users.filter(user => 
        user.name.toLowerCase().includes(advisorSearchQuery.toLowerCase())
    );

    // Filtrar asesores por búsqueda en menú de asignación masiva
    const filteredBulkAdvisors = users.filter(user => 
        user.name.toLowerCase().includes(bulkAssignSearchQuery.toLowerCase())
    );

    // Conversaciones filtradas por asesor y estado
    const displayedConversations = localConversations.filter(conv => {
        // Filtro por asesor
        if (filterByAdvisor && conv.assigned_to !== filterByAdvisor) return false;
        // Filtro por estado
        if (statusFilter !== 'all' && conv.status !== statusFilter) return false;
        return true;
    });

    // Función para manejar selección de conversación
    const handleConversationSelect = (conversationId: number, event: React.MouseEvent) => {
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
            router.get(`/admin/chat/${conversationId}`, {}, { preserveScroll: true, preserveState: true });
        }
    };

    // Función para asignar múltiples conversaciones
    const handleBulkAssign = async (userId: number | null) => {
        if (selectedConversations.length === 0) return;
        
        try {
            await Promise.all(
                selectedConversations.map(convId => 
                    router.post(`/admin/chat/${convId}/assign`, { user_id: userId }, { preserveScroll: true, preserveState: true })
                )
            );
            setSelectedConversations([]);
            setIsSelectionMode(false);
        } catch (error) {
            console.error('Error al asignar conversaciones:', error);
        }
    };

    // Función para cambiar estado de múltiples conversaciones
    const handleBulkStatusChange = async (status: string) => {
        if (selectedConversations.length === 0) return;
        
        try {
            await Promise.all(
                selectedConversations.map(convId => 
                    router.post(`/admin/chat/${convId}/status`, { status }, { preserveScroll: true, preserveState: true })
                )
            );
            setSelectedConversations([]);
            setIsSelectionMode(false);
        } catch (error) {
            console.error('Error al cambiar estado de conversaciones:', error);
        }
    };

    // Limpiar selección
    const clearSelection = () => {
        setSelectedConversations([]);
        setIsSelectionMode(false);
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending':
                return (
                    <span title={t('conversations.status.sending')}>
                        <Clock className="w-4 h-4 text-gray-400 animate-pulse" />
                    </span>
                );
            case 'sent':
                return (
                    <span title={t('conversations.status.sent')}>
                        <Check className="w-4 h-4 text-gray-400" />
                    </span>
                );
            case 'delivered':
                return (
                    <span title={t('conversations.status.delivered')}>
                        <CheckCheck className="w-4 h-4 text-gray-400" />
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
                    <span title={t('conversations.status.failed')}>
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

    const handleRemoveFile = () => {
        setSelectedFile(null);
        setData('media_file', null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        
        console.log('Submit attempt:', { 
            content: data.content, 
            selectedFile, 
            selectedConversation: selectedConversation?.id 
        });
        
        const hasContent = data.content && data.content.trim().length > 0;
        const hasFile = selectedFile !== null;
        
        if ((!hasContent && !hasFile) || !selectedConversation) {
            console.log('Validation failed:', { hasContent, hasFile, hasConversation: !!selectedConversation });
            return;
        }

        console.log('Sending message...');
        setIsSubmitting(true);
        post(`/admin/chat/${selectedConversation.id}/send`, {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                reset();
                setSelectedFile(null);
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
                setIsSubmitting(false);
            },
            onError: () => {
                setIsSubmitting(false);
            },
        });
    };

    const handleContextMenu = (e: React.MouseEvent, conversationId: number) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ conversationId, x: e.clientX, y: e.clientY });
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
        router.post(`/admin/chat/${selectedConversation.id}/status`, { status }, {
            preserveScroll: true,
        });
    };

    const handleStatusChangeFromContext = (conversationId: number, status: string) => {
        setContextMenu(null);
        router.post(`/admin/chat/${conversationId}/status`, { status }, {
            preserveScroll: true,
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

            <div className="h-[calc(100vh-0px)] flex bg-[#f0f2f8] overflow-hidden">
                {/* Lista de Conversaciones - Izquierda */}
                {/* Mobile: oculta cuando hay chat | Desktop: siempre visible con toggle */}
                <div className={`bg-[#e8ebf5] flex-col transition-all duration-300 flex-shrink-0 ${
                    selectedConversation ? 'hidden md:flex' : 'flex'
                } ${
                    isSidebarVisible ? 'w-full md:w-64 lg:w-72 xl:w-80' : 'hidden md:w-0 md:overflow-hidden'
                }`}>
                    {/* Header */}
                    <div className="p-3 md:p-4 bg-[#dde1f0]">
                        <div className="flex items-center justify-between mb-2 md:mb-3">
                            <h2 className="text-lg md:text-xl font-bold text-[#2e3f84]">{t('conversations.title')}</h2>
                            {/* Botón para nueva conversación - DESHABILITADO TEMPORALMENTE
                               Requiere plantillas aprobadas de Meta para funcionar correctamente.
                               TODO: Implementar selección de plantillas antes de rehabilitar.
                            {isAdmin && (
                                <button
                                    onClick={() => setShowNewChatModal(true)}
                                    className="p-2 bg-gradient-to-b from-[#3e4f94] to-[#2e3f84] text-white rounded-none shadow-[0_1px_2px_rgba(46,63,132,0.2),0_2px_4px_rgba(46,63,132,0.15)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.25),0_4px_8px_rgba(46,63,132,0.2)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                                    title={t('conversations.newConversation')}
                                >
                                    <Plus className="w-5 h-5" />
                                </button>
                            )}
                            */}
                            
                            <div className="flex items-center gap-2">
                                {/* Botón de filtro por estado */}
                                <div className="relative" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        onClick={() => setShowStatusFilter(!showStatusFilter)}
                                        className={`p-2 rounded-none shadow-[0_1px_2px_rgba(46,63,132,0.2),0_2px_4px_rgba(46,63,132,0.15)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.25),0_4px_8px_rgba(46,63,132,0.2)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 ${
                                            statusFilter !== 'all'
                                                ? 'bg-gradient-to-b from-[#f59e0b] to-[#d97706] text-white' 
                                                : 'bg-gradient-to-b from-[#3e4f94] to-[#2e3f84] text-white'
                                        }`}
                                        title="Filtrar por estado"
                                    >
                                        <ListFilter className="w-5 h-5" />
                                    </button>
                                    
                                    {/* Dropdown de filtro por estado */}
                                    {showStatusFilter && (
                                        <div className="absolute right-0 top-full mt-1 bg-white rounded-none shadow-xl border border-gray-200 py-2 z-50 min-w-[150px]">
                                            <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase">
                                                Filtrar por estado
                                            </div>
                                            
                                            {[
                                                { value: 'all', label: 'Todos', color: '' },
                                                { value: 'active', label: 'Activo', color: 'bg-green-500' },
                                                { value: 'pending', label: 'Pendiente', color: 'bg-yellow-500' },
                                                { value: 'resolved', label: 'Resuelto', color: 'bg-gray-400' },
                                            ].map((option) => (
                                                <button
                                                    key={option.value}
                                                    onClick={() => {
                                                        setStatusFilter(option.value);
                                                        setShowStatusFilter(false);
                                                    }}
                                                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center justify-between ${
                                                        statusFilter === option.value ? 'font-bold text-[#2e3f84] bg-gray-50' : ''
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        {option.color && <span className={`w-2 h-2 rounded-full ${option.color}`}></span>}
                                                        <span>{option.label}</span>
                                                    </div>
                                                    {statusFilter === option.value && <Check className="w-4 h-4 text-[#2e3f84]" />}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Botón modo de selección */}
                                {isAdmin && (
                                    <button
                                        onClick={() => {
                                            if (isSelectionMode) {
                                                clearSelection();
                                            } else {
                                                setIsSelectionMode(true);
                                            }
                                        }}
                                        className={`p-2 rounded-none shadow-[0_1px_2px_rgba(46,63,132,0.2),0_2px_4px_rgba(46,63,132,0.15)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.25),0_4px_8px_rgba(46,63,132,0.2)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 ${
                                            isSelectionMode
                                                ? 'bg-gradient-to-b from-[#22c55e] to-[#16a34a] text-white' 
                                                : 'bg-gradient-to-b from-[#3e4f94] to-[#2e3f84] text-white'
                                        }`}
                                        title={isSelectionMode ? "Cancelar selección" : "Seleccionar múltiples"}
                                    >
                                        <CheckSquare className="w-5 h-5" />
                                    </button>
                                )}

                                {/* Botón de filtro por asesor - Solo Admin */}
                                {isAdmin && advisorsWithActiveChats.length > 0 && (
                                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            onClick={() => setShowAdvisorFilter(!showAdvisorFilter)}
                                            className={`p-2 rounded-none shadow-[0_1px_2px_rgba(46,63,132,0.2),0_2px_4px_rgba(46,63,132,0.15)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.25),0_4px_8px_rgba(46,63,132,0.2)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 ${
                                                filterByAdvisor 
                                                    ? 'bg-gradient-to-b from-[#22c55e] to-[#16a34a] text-white' 
                                                    : 'bg-gradient-to-b from-[#3e4f94] to-[#2e3f84] text-white'
                                            }`}
                                            title={t('conversations.filterByAdvisor')}
                                        >
                                            <Filter className="w-5 h-5" />
                                        </button>
                                    
                                    {/* Dropdown de filtro por asesor */}
                                    {showAdvisorFilter && (
                                        <div className="absolute right-0 top-full mt-1 bg-white rounded-none shadow-xl border border-gray-200 py-2 z-50 min-w-[200px] max-h-[300px] overflow-y-auto custom-scrollbar">
                                            <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase">
                                                {t('conversations.filterByAdvisor')}
                                            </div>
                                            
                                            {/* Opción para mostrar todos */}
                                            <button
                                                onClick={() => {
                                                    setFilterByAdvisor(null);
                                                    setShowAdvisorFilter(false);
                                                }}
                                                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center justify-between ${
                                                    !filterByAdvisor ? 'font-bold text-[#2e3f84] bg-gray-50' : ''
                                                }`}
                                            >
                                                <span>{t('common.all')}</span>
                                                {!filterByAdvisor && <Check className="w-4 h-4 text-[#2e3f84]" />}
                                            </button>
                                            
                                            <div className="border-t border-gray-200 my-1"></div>
                                            
                                            {/* Lista de asesores con chats activos */}
                                            {advisorsWithActiveChats.map((user) => {
                                                const chatCount = localConversations.filter(c => c.assigned_to === user.id && c.status !== 'resolved').length;
                                                return (
                                                    <button
                                                        key={user.id}
                                                        onClick={() => {
                                                            setFilterByAdvisor(user.id);
                                                            setShowAdvisorFilter(false);
                                                        }}
                                                        className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center justify-between ${
                                                            filterByAdvisor === user.id ? 'font-bold text-[#2e3f84] bg-gray-50' : ''
                                                        }`}
                                                    >
                                                        <span className="truncate">{user.name}</span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs text-gray-400">{chatCount}</span>
                                                            {filterByAdvisor === user.id && <Check className="w-4 h-4 text-[#2e3f84]" />}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        {/* Búsqueda */}
                        <div className="relative">
                            <label htmlFor="conversation-search" className="sr-only">{t('conversations.searchPlaceholder')}</label>
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#6b7494] w-4 h-4" />
                            <Input
                                id="conversation-search"
                                name="conversation-search"
                                type="text"
                                placeholder={t('conversations.searchPlaceholder')}
                                value={search}
                                onChange={(e) => handleSearch(e.target.value)}
                                className="pl-10 border-0 bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] focus:from-white focus:to-[#fafbfc] shadow-[0_1px_2px_rgba(46,63,132,0.04),inset_0_1px_0_rgba(255,255,255,0.5)] focus:shadow-[0_2px_4px_rgba(46,63,132,0.08),0_3px_8px_rgba(46,63,132,0.1),inset_0_1px_0_rgba(255,255,255,0.9)] rounded-none transition-all duration-200"
                            />
                        </div>
                    </div>

                    {/* Lista de Conversaciones */}
                    <div 
                        ref={conversationsListRef}
                        className="flex-1 overflow-y-auto overflow-x-hidden px-2 md:px-2 pt-4 custom-scrollbar-light"
                    >
                        {localConversations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-[#6b7494] p-8">
                                <MessageSquare className="w-16 h-16 mb-4 text-[#9fa5c0]" />
                                <p className="text-center text-sm">
                                    {t('conversations.noConversations')}
                                </p>
                                <p className="text-center text-xs text-[#9fa5c0] mt-2">
                                    {t('conversations.noConversationsSubtitle')}
                                </p>
                            </div>
                        ) : displayedConversations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-[#6b7494] p-8">
                                <Filter className="w-12 h-12 mb-4 text-[#9fa5c0]" />
                                <p className="text-center text-sm">
                                    No hay conversaciones con este filtro
                                </p>
                                <p className="text-center text-xs text-[#9fa5c0] mt-2">
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
                                    className={`w-full p-3 md:p-4 mb-2 transition-all duration-200 flex items-start gap-3 text-left rounded-none ${
                                        selectedConversations.includes(conversation.id)
                                            ? 'bg-gradient-to-b from-[#bbf7d0] to-[#86efac] shadow-[0_1px_3px_rgba(34,197,94,0.15),0_4px_12px_rgba(34,197,94,0.2)] ring-2 ring-green-400'
                                            : selectedConversation?.id === conversation.id 
                                                ? 'bg-gradient-to-b from-[#d8dcef] to-[#d2d7ec] shadow-[0_1px_3px_rgba(46,63,132,0.08),0_4px_12px_rgba(46,63,132,0.12)]' 
                                                : 'bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] shadow-[0_1px_2px_rgba(46,63,132,0.04)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.06),0_4px_8px_rgba(46,63,132,0.08)]'
                                    }`}
                                >
                                    {/* Avatar / Checkbox en modo selección */}
                                    <div className="relative flex-shrink-0">
                                        {isSelectionMode ? (
                                            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center ${
                                                selectedConversations.includes(conversation.id)
                                                    ? 'bg-gradient-to-b from-[#22c55e] to-[#16a34a]'
                                                    : 'bg-gradient-to-b from-[#e5e7eb] to-[#d1d5db]'
                                            } shadow-[0_2px_4px_rgba(46,63,132,0.15)]`}>
                                                {selectedConversations.includes(conversation.id) ? (
                                                    <CheckSquare className="w-5 h-5 text-white" />
                                                ) : (
                                                    <Square className="w-5 h-5 text-gray-500" />
                                                )}
                                            </div>
                                        ) : (
                                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-b from-[#3e4f94] to-[#2e3f84] flex items-center justify-center text-white text-sm md:text-base font-medium shadow-[0_2px_4px_rgba(46,63,132,0.15),0_4px_8px_rgba(46,63,132,0.1),inset_0_1px_0_rgba(255,255,255,0.1)]">
                                                {conversation.contact_name?.[0]?.toUpperCase() || '?'}
                                            </div>
                                        )}
                                        {!isSelectionMode && conversation.unread_count > 0 && (
                                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-b from-[#22c55e] to-[#16a34a] rounded-full flex items-center justify-center text-white text-xs font-bold shadow-[0_2px_4px_rgba(22,163,74,0.3),0_1px_2px_rgba(22,163,74,0.2)]">
                                                {conversation.unread_count}
                                            </div>
                                        )}
                                    </div>

                                    {/* Información */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-semibold text-black truncate text-sm">
                                                    {conversation.contact_name || 'Sin nombre'}
                                                </h3>
                                                <p className="text-xs text-gray-500 truncate">
                                                    {conversation.phone_number}
                                                </p>
                                            </div>
                                            <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                                                {formatTime(conversation.last_message_at)}
                                            </span>
                                        </div>
                                        <p className="text-xs md:text-sm text-[#6b7494] truncate flex items-center gap-1">
                                            {conversation.last_message && (
                                                conversation.last_message.is_from_user ? (
                                                    <span title="Mensaje del cliente">
                                                        <CornerDownLeft className="w-3 h-3 text-[#6b7494] flex-shrink-0" />
                                                    </span>
                                                ) : (
                                                    <span title="Mensaje enviado">
                                                        <CornerDownRight className="w-3 h-3 text-[#2e3f84] flex-shrink-0" />
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
                                                <span className="text-xs text-[#6b7494]">{getStatusLabel(conversation.status)}</span>
                                            </div>
                                            {/* Mostrar asesor asignado (solo si no está resuelta) */}
                                            {conversation.assigned_user && conversation.status !== 'resolved' && (
                                                <span className="text-[10px] text-[#6b7494] bg-[#e8ebf5] px-1.5 py-0.5 rounded truncate max-w-[80px]" title={conversation.assigned_user.name}>
                                                    {conversation.assigned_user.name.split(' ')[0]}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            ))}
                            
                            {/* Indicador de carga de más conversaciones */}
                            {isLoadingMore && (
                                <div className="py-4 text-center">
                                    <div className="inline-block w-5 h-5 border-2 border-[#2e3f84] border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            )}
                            
                            {/* Indicador de más conversaciones */}
                            {hasMore && !isLoadingMore && (
                                <div className="py-2 text-center text-xs text-[#6b7494]">
                                    Desplaza para cargar más...
                                </div>
                            )}
                            </>
                        )}
                    </div>

                    {/* Barra de acciones para selección múltiple */}
                    {selectedConversations.length > 0 && (
                        <div className="p-3 bg-gradient-to-b from-[#3e4f94] to-[#2e3f84] border-t border-[#4e5fa4]">
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
                            
                            {/* Botón y menú para asignar */}
                            <div className="relative" onClick={(e) => e.stopPropagation()}>
                                <button 
                                    onClick={() => setShowBulkAssignMenu(!showBulkAssignMenu)}
                                    className="w-full py-2 px-3 bg-white/10 hover:bg-white/20 text-white text-sm rounded-none flex items-center justify-center gap-2 transition-colors"
                                >
                                    <UserPlus className="w-4 h-4" />
                                    Asignar a asesor
                                </button>
                                
                                {showBulkAssignMenu && (
                                    <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-none shadow-xl border border-gray-200 py-2 z-50">
                                        <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase">
                                            Asignar a
                                        </div>
                                        
                                        {/* Buscador */}
                                        <div className="px-2 py-1.5">
                                            <div className="relative">
                                                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                                                <input
                                                    type="text"
                                                    placeholder={t('conversations.searchAdvisor')}
                                                    value={bulkAssignSearchQuery}
                                                    onChange={(e) => setBulkAssignSearchQuery(e.target.value)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-[#2e3f84] bg-gray-50"
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
                                                <div className="px-3 py-2 text-sm text-gray-400 text-center">
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
                                                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center justify-between"
                                                    >
                                                        <span>
                                                            {user.name}
                                                            <span className="text-xs text-gray-400 ml-1">
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
                            
                            {/* Botones de cambiar estado */}
                            <div className="flex gap-2 mt-2">
                                <button
                                    onClick={() => handleBulkStatusChange('active')}
                                    className="flex-1 py-2 px-3 bg-white/10 hover:bg-blue-500/30 text-white text-xs rounded-none flex items-center justify-center gap-1 transition-colors"
                                >
                                    <Check className="w-3 h-3" />
                                    Activo
                                </button>
                                <button
                                    onClick={() => handleBulkStatusChange('pending')}
                                    className="flex-1 py-2 px-3 bg-white/10 hover:bg-yellow-500/30 text-white text-xs rounded-none flex items-center justify-center gap-1 transition-colors"
                                >
                                    <Clock className="w-3 h-3" />
                                    Pendiente
                                </button>
                                <button
                                    onClick={() => handleBulkStatusChange('resolved')}
                                    className="flex-1 py-2 px-3 bg-white/10 hover:bg-green-500/30 text-white text-xs rounded-none flex items-center justify-center gap-1 transition-colors"
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
                        
                        return (
                            <div 
                                className="fixed bg-white rounded-none shadow-xl border border-gray-200 py-2 z-50 min-w-[220px]"
                                style={{ 
                                    top: `${contextMenu.y}px`, 
                                    left: `${contextMenu.x}px`,
                                    maxHeight: '400px'
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Asignar conversación - Solo Admin */}
                                {isAdmin && (
                                    <>
                                        <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase">
                                            {t('conversations.assignConversation')}
                                        </div>
                                        
                                        {/* Buscador de asesores */}
                                        <div className="px-2 py-1.5">
                                            <div className="relative">
                                                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                                                <input
                                                    type="text"
                                                    placeholder={t('conversations.searchAdvisor')}
                                                    value={advisorSearchQuery}
                                                    onChange={(e) => setAdvisorSearchQuery(e.target.value)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-[#2e3f84] bg-gray-50"
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
                                                <div className="px-3 py-2 text-sm text-gray-400 text-center">
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
                                                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center justify-between"
                                                    >
                                                        <span className={conversation.assigned_to === user.id ? 'font-bold text-[#2e3f84]' : ''}>
                                                            {user.name}
                                                            <span className="text-xs text-gray-400 ml-1">
                                                                ({user.role === 'admin' ? t('users.roleAdmin') : t('users.roleAdvisor')})
                                                            </span>
                                                        </span>
                                                        {conversation.assigned_to === user.id && (
                                                            <Check className="w-4 h-4 text-[#2e3f84] flex-shrink-0" />
                                                        )}
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                        <div className="border-t border-gray-200 my-1"></div>
                                    </>
                                )}
                                
                                {/* Cambiar estado */}
                                <div className="border-t border-gray-200 my-1"></div>
                                <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase">
                                    Cambiar estado
                                </div>
                                
                                {conversation.status !== 'active' && (
                                    <button
                                        onClick={() => handleStatusChangeFromContext(conversation.id, 'active')}
                                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 text-blue-600 flex items-center gap-2"
                                    >
                                        <Check className="w-4 h-4" />
                                        Marcar como Activo
                                    </button>
                                )}
                                
                                {conversation.status !== 'pending' && (
                                    <button
                                        onClick={() => handleStatusChangeFromContext(conversation.id, 'pending')}
                                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 text-yellow-600 flex items-center gap-2"
                                    >
                                        <Clock className="w-4 h-4" />
                                        Marcar como Pendiente
                                    </button>
                                )}
                                
                                {conversation.status !== 'resolved' && (
                                    <button
                                        onClick={() => handleStatusChangeFromContext(conversation.id, 'resolved')}
                                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 text-green-600 flex items-center gap-2"
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
                    <div className="hidden md:flex flex-1 items-center justify-center bg-[#f0f2f8]">
                        <div className="text-center text-[#6b7494] bg-gradient-to-b from-white to-[#fafbfc] p-8 md:p-12 rounded-none shadow-[0_4px_8px_rgba(46,63,132,0.06),0_12px_24px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.8)]">
                            <MessageSquare className="w-24 h-24 mx-auto mb-4 text-[#9fa5c0]" />
                            <h3 className="text-xl font-semibold text-[#2e3f84] mb-2">
                                {t('conversations.selectConversation')}
                            </h3>
                            <p className="text-sm">
                                {t('conversations.selectConversationHint')}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col bg-white w-full md:w-auto">
                        {/* Header del Chat */}
                        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 bg-[#f0f2f8]">
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
                                    className="hover:bg-gray-100 flex-shrink-0"
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
                                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-[#2e3f84] flex items-center justify-center text-white text-sm md:text-base font-medium flex-shrink-0">
                                        {selectedConversation.contact_name?.[0]?.toUpperCase() || '?'}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h2 className="font-semibold text-black text-sm md:text-base truncate">
                                            {selectedConversation.contact_name || 'Sin nombre'}
                                        </h2>
                                        <div className="flex items-center gap-2 text-xs md:text-sm text-gray-600">
                                            <Phone className="w-3 h-3" />
                                            <span>{selectedConversation.phone_number}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Estado */}
                                <div className="hidden lg:flex items-center gap-2 ml-4 px-3 py-1 rounded-full bg-gradient-to-b from-white to-[#fafbfc] shadow-[0_1px_3px_rgba(46,63,132,0.08),0_2px_6px_rgba(46,63,132,0.06),inset_0_1px_0_rgba(255,255,255,0.9)]">
                                    <span className={`w-2 h-2 rounded-full ${getStatusColor(selectedConversation.status)}`}></span>
                                    <span className="text-sm text-[#2e3f84] font-medium">{getStatusLabel(selectedConversation.status)}</span>
                                </div>

                                {/* Asignación */}
                                {selectedConversation.assigned_user && (
                                    <div className="hidden xl:block text-sm text-[#6b7494] ml-2">
                                        {t('conversations.assignedTo')}: <span className="font-medium text-[#2e3f84]">{selectedConversation.assigned_user.name}</span>
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
                                        className="hover:bg-[#f0f2f8] text-[#2e3f84]"
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
                                    <DropdownMenuContent align="end" className="w-56 bg-white">
                                        {/* Marcar como resuelta / Reabrir */}
                                        {selectedConversation.status === 'resolved' ? (
                                            <DropdownMenuItem 
                                                onClick={() => handleStatusChange('active')}
                                                className="cursor-pointer hover:bg-gray-100 text-blue-600"
                                            >
                                                <Check className="w-4 h-4 mr-2" />
                                                {t('conversations.reopenConversation')}
                                            </DropdownMenuItem>
                                        ) : (
                                            <DropdownMenuItem 
                                                onClick={() => handleStatusChange('resolved')}
                                                className="cursor-pointer hover:bg-gray-100 text-green-600"
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
                                    className="hover:bg-gray-100"
                                    title={t('conversations.closeChatHint')}
                                >
                                    <X className="w-5 h-5" />
                                </Button>
                            </div>
                        </div>

                        {/* Área de Mensajes */}
                        <div 
                            ref={messagesContainerRef}
                            className="flex-1 overflow-y-auto px-3 md:px-6 py-3 md:py-4 bg-[#f8f9fc] relative custom-scrollbar"
                        >
                            {!selectedConversation.messages || selectedConversation.messages.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-[#6b7494]">
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
                                                className={`max-w-[85%] md:max-w-[70%] rounded-none px-3 md:px-4 py-2 ${
                                                    message.is_from_user
                                                        ? 'bg-gradient-to-b from-white to-[#fafbfc] shadow-[0_1px_3px_rgba(46,63,132,0.06),0_3px_8px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.9)]'
                                                        : 'bg-gradient-to-b from-[#3e4f94] to-[#2e3f84] text-white shadow-[0_2px_4px_rgba(46,63,132,0.2),0_4px_12px_rgba(46,63,132,0.25),inset_0_1px_0_rgba(255,255,255,0.15)]'
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
                                                                className="max-w-full max-h-96 rounded-none object-cover"
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
                                                                className="max-w-full max-h-96 rounded-none"
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
                                                <div className={`flex items-center justify-end gap-1 mt-1 text-xs ${
                                                    message.is_from_user ? 'text-gray-500' : 'text-white opacity-70'
                                                }`}>
                                                    <span>{formatTime(message.created_at)}</span>
                                                    {!message.is_from_user && getStatusIcon(message.status)}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    
                                    {/* Indicador de "escribiendo..." - Se mostrará cuando se implemente en backend */}
                                    {/* Ejemplo de cómo se vería: */}
                                    {/* <div className="flex justify-start">
                                        <div className="bg-gradient-to-b from-white to-[#fafbfc] shadow-[0_1px_3px_rgba(46,63,132,0.06),0_3px_8px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.9)] rounded-none px-4 py-3">
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
                                className={`sticky bottom-4 left-full -translate-x-8 flex items-center gap-2 bg-gradient-to-b from-white to-[#fafbfc] hover:from-[#fafbfc] hover:to-[#f0f2f8] text-[#2e3f84] px-3 py-2 rounded-full shadow-[0_2px_8px_rgba(46,63,132,0.15),0_4px_16px_rgba(46,63,132,0.1)] hover:shadow-[0_4px_12px_rgba(46,63,132,0.2),0_8px_24px_rgba(46,63,132,0.15)] z-10 transition-all duration-300 ${
                                    isAtBottom 
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
                        <form onSubmit={handleSubmit} className="px-3 md:px-6 py-3 md:py-4 bg-[#f0f2f8]">
                            {/* Preview del archivo seleccionado */}
                            {selectedFile && (
                                <div className="mb-2 flex items-center gap-2 p-2 bg-gradient-to-b from-blue-50 to-blue-100/50 rounded-none">
                                    <Paperclip className="w-4 h-4 text-[#2e3f84]" />
                                    <span className="text-sm text-[#2e3f84] flex-1 truncate">{selectedFile.name}</span>
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
                                    className="flex hover:bg-gray-100"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Paperclip className="w-5 h-5 text-[#2e3f84]" />
                                </Button>

                                {/* Campo de texto */}
                                <Textarea
                                    value={data.content}
                                    onChange={(e) => setData('content', e.target.value)}
                                    placeholder={t('conversations.messagePlaceholder')}
                                    className="flex-1 min-h-[40px] md:min-h-[44px] max-h-[100px] md:max-h-[120px] text-sm md:text-base resize-none border-0 bg-gradient-to-b from-white to-[#fafbfc] focus:ring-2 focus:ring-[#2e3f84] shadow-[0_1px_3px_rgba(46,63,132,0.06),0_2px_6px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] focus:shadow-[0_2px_6px_rgba(46,63,132,0.12),0_4px_12px_rgba(46,63,132,0.15),inset_0_1px_0_rgba(255,255,255,0.9)] rounded-none transition-shadow duration-200"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSubmit(e);
                                        }
                                    }}
                                />

                                {/* Botón de enviar */}
                                <Button
                                    type="submit"
                                    disabled={(!(data.content?.trim()) && !selectedFile) || processing || isSubmitting}
                                    className="bg-gradient-to-b from-[#3e4f94] to-[#2e3f84] hover:from-[#4e5fa4] hover:to-[#3e4f94] text-white px-4 md:px-6 shadow-[0_2px_4px_rgba(46,63,132,0.2),0_4px_12px_rgba(46,63,132,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] hover:shadow-[0_4px_8px_rgba(46,63,132,0.25),0_6px_16px_rgba(46,63,132,0.35),inset_0_1px_0_rgba(255,255,255,0.2)] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Send className="w-5 h-5" />
                                </Button>
                            </div>
                            <p className="hidden md:block text-xs text-[#6b7494] mt-2">
                                {t('conversations.sendHint')}
                            </p>
                        </form>
                    </div>
                )}
            </div>

            {/* Dialog de confirmación de eliminación */}
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent className="sm:max-w-md bg-gradient-to-b from-white to-[#fafbfc] border-2 border-[#e0e4f0]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-[#2e3f84] flex items-center gap-2">
                            <X className="w-6 h-6 text-red-500" />
                            Eliminar conversación
                        </DialogTitle>
                        <div className="text-[#6b7494] space-y-3 pt-4">
                            <DialogDescription className="text-sm leading-relaxed">
                                Esta acción <strong>eliminará temporalmente la conversación de tu vista</strong>, pero no te preocupes:
                            </DialogDescription>
                            <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded-r space-y-1">
                                <div className="text-sm text-blue-900">
                                    ✓ <strong>Todos los mensajes se conservarán</strong>
                                </div>
                                <div className="text-sm text-blue-900">
                                    ✓ <strong>Si el cliente vuelve a escribir</strong>, la conversación reaparecerá automáticamente con todo el historial
                                </div>
                            </div>
                            <div className="text-xs text-gray-500 italic">
                                Es temporal. La conversación volverá cuando el cliente te escriba de nuevo.
                            </div>
                        </div>
                    </DialogHeader>
                    <DialogFooter className="gap-3 sm:gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowDeleteDialog(false)}
                            className="border-[#d0d5e8] hover:bg-gray-100"
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

            {/* Modal de Asignación */}
            <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
                <DialogContent className="sm:max-w-md bg-gradient-to-b from-white to-[#fafbfc] border-0 shadow-[0_4px_12px_rgba(46,63,132,0.15),0_8px_24px_rgba(46,63,132,0.2)]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-[#2e3f84] flex items-center gap-2">
                            <UserPlus className="w-6 h-6 text-[#2e3f84]" />
                            {t('conversations.assignConversation')}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-[#6b7494]">
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
                                className="w-full flex items-center gap-3 p-3 rounded-none transition-all duration-200 bg-gradient-to-b from-red-50 to-red-100 hover:from-red-100 hover:to-red-150 text-red-600 border-b border-red-200 mb-2"
                            >
                                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-red-500 text-white">
                                    <X className="w-5 h-5" />
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="font-semibold">Quitar asignación</p>
                                    <p className="text-xs text-red-500">
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
                                className={`w-full flex items-center gap-3 p-3 rounded-none transition-all duration-200 ${
                                    selectedConversation?.assigned_to === user.id
                                        ? 'bg-gradient-to-b from-[#3e4f94] to-[#2e3f84] text-white shadow-[0_2px_8px_rgba(46,63,132,0.3)]'
                                        : 'bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] hover:from-[#e8ebf5] hover:to-[#e0e4f0] text-[#2e3f84]'
                                }`}
                            >
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                                    selectedConversation?.assigned_to === user.id
                                        ? 'bg-white/20 text-white'
                                        : 'bg-[#2e3f84] text-white'
                                }`}>
                                    {user.name[0]?.toUpperCase()}
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="font-semibold">{user.name}</p>
                                    <p className={`text-xs ${selectedConversation?.assigned_to === user.id ? 'text-white/70' : 'text-[#6b7494]'}`}>
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
                            className="w-full border-0 bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] text-[#2e3f84] hover:from-[#e8ebf5] hover:to-[#e0e4f0]"
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
                    setNewChatData({ phone_number: '', contact_name: '', message: '' });
                    setNewChatError('');
                }
            }}>
                <DialogContent className="sm:max-w-lg bg-gradient-to-b from-white to-[#fafbfc] border-0 shadow-[0_4px_12px_rgba(46,63,132,0.15),0_8px_24px_rgba(46,63,132,0.2)]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-[#2e3f84] flex items-center gap-2">
                            <Plus className="w-6 h-6 text-[#2e3f84]" />
                            {t('conversations.newConversation')}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-[#6b7494]">
                            {t('conversations.newConversationDescription')}
                        </DialogDescription>
                    </DialogHeader>
                    
                    {/* Advertencia sobre políticas de Meta */}
                    <div className="bg-amber-50 border-l-4 border-amber-400 p-3 rounded-none">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-amber-800">
                                <strong>Importante:</strong> Según las políticas de WhatsApp Business API, solo puedes iniciar conversaciones si el usuario te ha escrito en las últimas 24 horas, o usando plantillas aprobadas por Meta.
                            </div>
                        </div>
                    </div>

                    <form onSubmit={(e) => {
                        e.preventDefault();
                        setNewChatError('');
                        
                        if (!newChatData.phone_number.trim()) {
                            setNewChatError('El número de teléfono es requerido');
                            return;
                        }
                        if (!newChatData.message.trim()) {
                            setNewChatError('El mensaje es requerido');
                            return;
                        }
                        
                        setIsCreatingChat(true);
                        router.post('/admin/chat/create', newChatData, {
                            onSuccess: () => {
                                setShowNewChatModal(false);
                                setNewChatData({ phone_number: '', contact_name: '', message: '' });
                                setIsCreatingChat(false);
                            },
                            onError: (errors) => {
                                setNewChatError(errors.message || errors.phone_number || 'Error al crear la conversación');
                                setIsCreatingChat(false);
                            },
                        });
                    }} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-[#2e3f84]">
                                {t('conversations.phoneNumber')} *
                            </label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#6b7494] w-4 h-4" />
                                <Input
                                    type="tel"
                                    placeholder="3001234567 o +573001234567"
                                    value={newChatData.phone_number}
                                    onChange={(e) => setNewChatData({ ...newChatData, phone_number: e.target.value })}
                                    className="pl-10 border-0 bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] focus:from-white focus:to-[#fafbfc] shadow-[0_1px_2px_rgba(46,63,132,0.04),inset_0_1px_0_rgba(255,255,255,0.5)] rounded-none"
                                />
                            </div>
                            <p className="text-xs text-[#6b7494]">
                                Ingresa el número con o sin código de país. Si no incluyes código, se asumirá +57 (Colombia).
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-[#2e3f84]">
                                {t('conversations.contactName')} (opcional)
                            </label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#6b7494] w-4 h-4" />
                                <Input
                                    type="text"
                                    placeholder="Nombre del contacto"
                                    value={newChatData.contact_name}
                                    onChange={(e) => setNewChatData({ ...newChatData, contact_name: e.target.value })}
                                    className="pl-10 border-0 bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] focus:from-white focus:to-[#fafbfc] shadow-[0_1px_2px_rgba(46,63,132,0.04),inset_0_1px_0_rgba(255,255,255,0.5)] rounded-none"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-[#2e3f84]">
                                {t('conversations.message')} *
                            </label>
                            <Textarea
                                placeholder="Escribe tu mensaje..."
                                value={newChatData.message}
                                onChange={(e) => setNewChatData({ ...newChatData, message: e.target.value })}
                                rows={4}
                                className="border-0 bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] focus:from-white focus:to-[#fafbfc] shadow-[0_1px_2px_rgba(46,63,132,0.04),inset_0_1px_0_rgba(255,255,255,0.5)] rounded-none resize-none"
                            />
                        </div>

                        {newChatError && (
                            <div className="bg-red-50 border-l-4 border-red-400 p-3 rounded-none">
                                <p className="text-sm text-red-800">{newChatError}</p>
                            </div>
                        )}

                        <DialogFooter className="gap-2 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setShowNewChatModal(false)}
                                className="border-0 bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] text-[#2e3f84] hover:from-[#e8ebf5] hover:to-[#e0e4f0]"
                            >
                                {t('common.cancel')}
                            </Button>
                            <Button
                                type="submit"
                                disabled={isCreatingChat}
                                className="bg-gradient-to-b from-[#3e4f94] to-[#2e3f84] text-white border-0 shadow-[0_2px_4px_rgba(46,63,132,0.2)] hover:shadow-[0_4px_8px_rgba(46,63,132,0.3)]"
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
                                        className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                                        title="Restablecer zoom"
                                    >
                                        <RotateCcw className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.25))}
                                        className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                                        title="Alejar"
                                    >
                                        <ZoomOut className="w-5 h-5" />
                                    </button>
                                    <span className="text-white/70 text-sm min-w-[50px] text-center">
                                        {Math.round(zoomLevel * 100)}%
                                    </span>
                                    <button
                                        onClick={() => setZoomLevel(Math.min(4, zoomLevel + 0.25))}
                                        className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
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
                                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                                title="Descargar"
                            >
                                <Download className="w-5 h-5" />
                            </a>
                            
                            {/* Botón cerrar */}
                            <button
                                onClick={() => setMediaViewer(null)}
                                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors ml-2"
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
                                className={`max-w-full max-h-full object-contain select-none ${
                                    zoomLevel > 1 ? 'cursor-grab' : 'cursor-zoom-in'
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
