import { Head, router, useForm, usePage } from '@inertiajs/react';
import { AnimatePresence, motion } from 'framer-motion';
import AdminLayout from '@/layouts/admin-layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ChatMessagesSkeleton, ConversationListSkeleton } from '@/components/chat-skeletons';
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
    PanelRight,
    Clock,
    MapPin,
    User,
    FileAudio,
    Smile,
    ArrowDown,
    UserPlus,
    Trash2,
    Eraser,
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
    ShieldBan,
    Reply,
    SmilePlus,
    Copy,
    ArrowLeft,
    Image as ImageIcon,
} from 'lucide-react';
import { FormEvent, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { autoCorrectText, type CorrectionEvent } from '@/hooks/use-autocorrect';

// CSRF: las mutaciones van por axios para usar el token VIVO de la cookie XSRF-TOKEN
// (withXSRFToken global). El <meta name="csrf-token"> queda obsoleto tras un login por
// Inertia (la sesión se regenera) => 419 + HTML. validateStatus deja pasar cualquier
// estado salvo 419 para que el interceptor global de app.tsx reintente, replicando que
// fetch nunca lanza por código HTTP (la UI sigue leyendo data.success / data.error).
const csrfPost = (url: string, body?: unknown) =>
    axios.post(url, body, { validateStatus: (s: number) => s !== 419 });
const csrfPut = (url: string, body?: unknown) =>
    axios.put(url, body, { validateStatus: (s: number) => s !== 419 });
const csrfDelete = (url: string) =>
    axios.delete(url, { validateStatus: (s: number) => s !== 419 });

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
    whatsapp_message_id?: string | null;
    reply_to_id?: number | null;
    reply_to?: {
        id: number;
        content: string;
        message_type: string;
        media_url?: string | null;
        is_from_user: boolean;
        sender?: { name: string };
    } | null;
    sender?: {
        name: string;
    };
    reactions?: { id: number; emoji: string; from_user: boolean }[];
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
    last_visible_message?: {
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
    is_blocked?: boolean;
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
    category?: string | null;
    header_text?: string | null;
    header_format?: string | null;
    header_media_url?: string | null;
    footer_text?: string | null;
    default_params?: string[] | null;
}

type ChatFilterKey = 'all' | 'unanswered' | 'pending_response' | 'resolved' | 'scheduled' | 'oncology' | 'blocked';

type FilterCounts = Record<ChatFilterKey, number>;

const DEFAULT_FILTER_COUNTS: FilterCounts = {
    all: 0,
    unanswered: 0,
    pending_response: 0,
    resolved: 0,
    scheduled: 0,
    oncology: 0,
    blocked: 0,
};

interface ConversationsIndexProps {
    conversations: Conversation[];
    hasMore?: boolean;
    selectedConversation?: Conversation;
    unreadOnOpen?: number;
    users: User[];
    allTags?: TagItem[];
    allSpecialties?: { name: string; count: number }[];
    filters: {
        search?: string;
        status?: string;
        assigned?: string;
        tag?: string;
        specialty?: string;
    };
    filterCounts?: Partial<FilterCounts>;
    advisorCounts?: Record<number, number>;
    templates?: Template[];
    whatsappTemplates?: WhatsappTemplate[];
}

/**
 * Convierte URLs, correos y teléfonos dentro del texto de un mensaje en enlaces
 * clicables, conservando los saltos de línea. Devuelve nodos de React.
 */
const RICH_TEXT_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+|[\w.+-]+@[\w-]+\.[\w.-]+|(?:\+?57[\s-]?)?3\d{2}[\s-]?\d{3}[\s-]?\d{4})/g;

function renderRichText(text: string) {
    if (!text) return text;
    const parts = text.split(RICH_TEXT_REGEX);
    return parts.map((part, i) => {
        if (!part) return null;
        if (/^https?:\/\//i.test(part) || /^www\./i.test(part)) {
            const href = part.startsWith('http') ? part : `https://${part}`;
            return (
                <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="underline decoration-1 underline-offset-2 text-[#1f7aad] dark:text-[#53bdeb] break-all">{part}</a>
            );
        }
        if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(part)) {
            return <a key={i} href={`mailto:${part}`} className="underline decoration-1 underline-offset-2 text-[#1f7aad] dark:text-[#53bdeb]">{part}</a>;
        }
        if (/^(?:\+?57[\s-]?)?3\d{2}[\s-]?\d{3}[\s-]?\d{4}$/.test(part)) {
            const tel = part.replace(/[\s-]/g, '');
            return <a key={i} href={`tel:${tel}`} className="underline decoration-1 underline-offset-2 text-[#1f7aad] dark:text-[#53bdeb]">{part}</a>;
        }
        return part;
    });
}

/** Fecha y hora completas para el tooltip de la marca de tiempo de un mensaje. */
function formatFullDateTime(iso: string) {
    try {
        return new Date(iso).toLocaleString('es-CO', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
        });
    } catch {
        return '';
    }
}

// Emojis frecuentes para el picker del composer (sin dependencias pesadas)
const COMPOSER_EMOJIS = ['😀', '😅', '😂', '🙂', '😉', '😍', '😘', '😊', '👍', '🙏', '👏', '🙌', '👌', '💪', '🎉', '❤️', '🔥', '✅', '⚠️', '❌', '📅', '🕐', '📍', '📎'];

/**
 * Imagen de mensaje con fallback si la URL falla (medios de WhatsApp/Meta que expiran
 * o un corte momentáneo de LAN). Evita el ícono de imagen rota del navegador.
 */
function ChatImage({ src, alt, className, layoutId }: { src: string; alt?: string; className?: string; layoutId?: string }) {
    const [errored, setErrored] = useState(false);
    if (errored) {
        return (
            <div className={`flex flex-col items-center justify-center gap-1 bg-black/5 dark:bg-white/5 text-[#667781] dark:text-neutral-400 rounded-xl p-6 min-w-[140px] ${className || ''}`}>
                <ImageIcon className="w-7 h-7 opacity-60" />
                <span className="text-xs">No se pudo cargar</span>
            </div>
        );
    }
    return (
        <motion.img
            layoutId={layoutId}
            src={src}
            alt={alt}
            className={className}
            loading="lazy"
            onError={() => setErrored(true)}
        />
    );
}

/**
 * Selector de plantilla de WhatsApp personalizado al estilo de la app.
 * Reemplaza el <select> nativo por el dropdown de shadcn con cada plantilla
 * mostrando su nombre, ícono de adjunto (documentos) y una etiqueta de categoría.
 */
function WaTemplateSelect({
    templates,
    value,
    onChange,
    placeholder = 'Seleccionar plantilla...',
}: {
    templates: WhatsappTemplate[];
    value: number | null;
    onChange: (id: number | null) => void;
    placeholder?: string;
}) {
    return (
        <Select
            value={value ? String(value) : undefined}
            onValueChange={(val) => onChange(val ? Number(val) : null)}
        >
            <SelectTrigger className="w-full !h-11 settings-input rounded-xl data-[placeholder]:text-muted-foreground">
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent className="rounded-xl border border-[#e9edef] dark:border-neutral-700 max-h-[320px]">
                {templates.map((tpl) => {
                    const isMarketing = tpl.category === 'MARKETING';
                    const categoryLabel = isMarketing
                        ? 'Marketing'
                        : tpl.category === 'UTILITY'
                            ? 'Utilidad'
                            : tpl.category || 'Sin categoría';
                    return (
                        <SelectItem
                            key={tpl.id}
                            value={String(tpl.id)}
                            className="rounded-lg cursor-pointer py-2.5 pr-8"
                        >
                            <span className="flex items-center gap-2">
                                {tpl.header_format === 'DOCUMENT' && (
                                    <Paperclip className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                                )}
                                <span className="font-medium text-foreground truncate">{tpl.name}</span>
                                <span
                                    className={cn(
                                        'shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                                        isMarketing
                                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                            : 'bg-[#2e3f84]/10 text-[#2e3f84] dark:bg-[hsl(231,55%,70%)]/15 dark:text-[hsl(231,55%,75%)]',
                                    )}
                                >
                                    {categoryLabel}
                                </span>
                            </span>
                        </SelectItem>
                    );
                })}
            </SelectContent>
        </Select>
    );
}

export default function ConversationsIndex({ conversations: initialConversations, hasMore: initialHasMore = false, selectedConversation, unreadOnOpen = 0, users, allTags: initialAllTags = [], allSpecialties: initialAllSpecialties = [], filters, filterCounts = DEFAULT_FILTER_COUNTS, advisorCounts = {}, templates = [], whatsappTemplates = [] }: ConversationsIndexProps) {
    const { t } = useTranslation();
    const { auth } = usePage().props as any;
    const isAdmin = auth.user.role === 'admin';

    // Helper: detectar cantidad de variables {{N}} en el texto de una plantilla
    const getTemplateParamCount = (tpl: WhatsappTemplate): number => {
        if (tpl.default_params && tpl.default_params.length > 0) return tpl.default_params.length;
        const matches = tpl.preview_text.match(/\{\{(\d+)\}\}/g);
        return matches ? matches.length : 0;
    };

    const [search, setSearch] = useState(filters.search || '');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const inputValueRef = useRef(''); // Ref for message input (zero re-renders while typing)
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [hasInputText, setHasInputText] = useState(false); // Only updates on empty↔non-empty transitions
    const [isSidebarVisible, setIsSidebarVisible] = useState(true);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
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
    // Menú contextual (clic derecho) sobre un asesor en el filtro + confirmación de "Limpiar"
    const [advisorMenu, setAdvisorMenu] = useState<{ id: number; name: string; count: number; x: number; y: number } | null>(null);
    const [advisorToClear, setAdvisorToClear] = useState<{ id: number; name: string; count: number } | null>(null);
    const [clearingAdvisor, setClearingAdvisor] = useState(false);
    const [selectedConversations, setSelectedConversations] = useState<number[]>([]);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [isDragSelecting, setIsDragSelecting] = useState(false);
    const dragSelectionActionRef = useRef<'select' | 'deselect'>('select');
    const dragDidMoveRef = useRef(false);
    const dragStartIdRef = useRef<number | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>(filters.status || 'all');
    const [showStatusFilter, setShowStatusFilter] = useState(false);
    const [showBulkAssignMenu, setShowBulkAssignMenu] = useState(false);
    const [bulkAssignSearchQuery, setBulkAssignSearchQuery] = useState('');
    const [mediaViewer, setMediaViewer] = useState<{ url: string; type: 'image' | 'video'; caption?: string; id?: number } | null>(null);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [imageRotation, setImageRotation] = useState(0);
    const [showPatientData, setShowPatientData] = useState(false);
    // Panel derecho de detalles del contacto (fijo en escritorio, overlay en móvil)
    const [showDetails, setShowDetails] = useState(true);
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
    // Gestos táctiles del visor de imágenes (pinch-zoom y pan en tablets)
    const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);
    const gestureMovedRef = useRef(false);
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
    // Ref para trackear mensajes ya renderizados (evitar re-animación)
    const renderedMessageIdsRef = useRef<Set<number>>(new Set());
    // Refs para throttle de scroll con RAF
    const msgScrollRafRef = useRef<number | null>(null);
    const convScrollRafRef = useRef<number | null>(null);
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
    const [localFilterCounts, setLocalFilterCounts] = useState<FilterCounts>({ ...DEFAULT_FILTER_COUNTS, ...filterCounts });
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

    // Filtro por especialidad (texto exacto)
    const [allSpecialties] = useState<{ name: string; count: number }[]>(initialAllSpecialties);
    const [specialtyFilter, setSpecialtyFilter] = useState<string | null>(filters.specialty ?? null);
    const [specialtySearchQuery, setSpecialtySearchQuery] = useState('');

    // Reacciones (emojis) a mensajes
    const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
    const REACTION_LABELS: Record<string, string> = {
        '👍': 'Me gusta', '❤️': 'Me encanta', '😂': 'Me divierte',
        '😮': 'Me asombra', '😢': 'Me entristece', '🙏': 'Gracias',
    };
    const [reactionPickerFor, setReactionPickerFor] = useState<number | null>(null);

    const handleReact = async (message: Message, emoji: string) => {
        if (!selectedConversation) return;
        const mine = message.reactions?.find(r => !r.from_user);
        const newEmoji = mine && mine.emoji === emoji ? '' : emoji; // toggle: si repito mi emoji, lo quito
        setReactionPickerFor(null);

        // Actualización optimista (la del lado del negocio: from_user = false)
        setLocalMessages(prev => prev.map(m => {
            if (m.id !== message.id) return m;
            const others = (m.reactions || []).filter(r => r.from_user);
            return {
                ...m,
                reactions: newEmoji ? [...others, { id: -1, emoji: newEmoji, from_user: false }] : others,
            };
        }));

        try {
            await axios.post(`/admin/chat/${selectedConversation.id}/react`, {
                message_id: message.id,
                emoji: newEmoji,
            });
        } catch {
            // Si falla, el polling/Reverb reconciliará el estado real desde el servidor
        }
    };

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

            const res = await csrfPost('/admin/tags', { name, color });
            if (res.status >= 200 && res.status < 300) {
                const tag = res.data;
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
        const tag = allTags.find(t => t.id === tagId);
        if (!tag) return;
        // Actualización optimista LOCAL (sin router.reload — eso reseteaba la lista al inicio y cerraba el chat)
        setLocalConversations(prev => prev.map(c =>
            c.id === conversationId && !(c.tags || []).some(t => t.id === tagId)
                ? { ...c, tags: [...(c.tags || []), tag] }
                : c
        ));
        try {
            await csrfPost(`/admin/tags/conversation/${conversationId}/attach`, { tag_id: tagId });
        } catch {
            // Rollback si falla el guardado en el servidor
            setLocalConversations(prev => prev.map(c =>
                c.id === conversationId ? { ...c, tags: (c.tags || []).filter(t => t.id !== tagId) } : c
            ));
        }
    };

    const detachTag = async (conversationId: number, tagId: number) => {
        const removed = allTags.find(t => t.id === tagId);
        // Actualización optimista LOCAL (sin recargar)
        setLocalConversations(prev => prev.map(c =>
            c.id === conversationId ? { ...c, tags: (c.tags || []).filter(t => t.id !== tagId) } : c
        ));
        try {
            await csrfDelete(`/admin/tags/conversation/${conversationId}/detach/${tagId}`);
        } catch {
            // Rollback si falla
            if (removed) setLocalConversations(prev => prev.map(c =>
                c.id === conversationId && !(c.tags || []).some(t => t.id === tagId)
                    ? { ...c, tags: [...(c.tags || []), removed] } : c
            ));
        }
    };

    const deleteTag = async (tagId: number) => {
        if (!confirm('¿Eliminar esta etiqueta? Se quitará de todas las conversaciones.')) return;
        try {
            await csrfDelete(`/admin/tags/${tagId}`);
            setAllTags(prev => prev.filter(t => t.id !== tagId));
            if (tagFilterId === tagId) {
                setTagFilterId(null);
                applyFiltersWithTag(statusFilter, filterByAdvisor, null);
            }
            setEditingTag(null);
            router.reload({ only: ['conversations', 'selectedConversation', 'filterCounts'] });
        } catch { }
    };

    const updateTag = async (tagId: number, name: string, color: string) => {
        try {
            const res = await csrfPut(`/admin/tags/${tagId}`, { name, color });
            if (res.status >= 200 && res.status < 300) {
                const updated = res.data;
                setAllTags(prev => prev.map(t => t.id === tagId ? { ...t, name: updated.name, color: updated.color } : t));
                setEditingTag(null);
                router.reload({ only: ['conversations', 'selectedConversation', 'filterCounts'] });
            }
        } catch { }
    };

    // Filtrar plantillas basadas en el texto después de /
    const filteredTemplates = useMemo(() => templates.filter(template =>
        template.name.toLowerCase().includes(templateFilter.toLowerCase())
    ), [templates, templateFilter]);

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
            // Update textarea DOM with corrected value
            if (textareaRef.current) textareaRef.current.value = finalValue;
        }

        // Store in ref (no re-render)
        inputValueRef.current = finalValue;

        // Only trigger re-render on empty↔non-empty transition (for send button)
        const hasText = finalValue.trim().length > 0;
        if (hasText !== hasInputText) setHasInputText(hasText);

        // Detectar el comando /
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

        // Fallback de auto-crecimiento del textarea para navegadores sin field-sizing-content
        // (Firefox / Safari < 18.4). En navegadores modernos coincide con field-sizing, así que es inocuo.
        const ta = textareaRef.current;
        if (ta) {
            ta.style.height = 'auto';
            ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
        }

        // Emit typing indicator
        emitTyping();
    };

    // Insertar un emoji en la posición del cursor del composer
    const insertEmoji = (emoji: string) => {
        const ta = textareaRef.current;
        if (!ta) return;
        const start = ta.selectionStart ?? ta.value.length;
        const end = ta.selectionEnd ?? ta.value.length;
        const newValue = ta.value.slice(0, start) + emoji + ta.value.slice(end);
        ta.value = newValue;
        handleMessageChange(newValue);
        requestAnimationFrame(() => {
            ta.focus();
            const pos = start + emoji.length;
            ta.setSelectionRange(pos, pos);
        });
    };

    // Seleccionar una plantilla
    const selectTemplate = (template: Template) => {
        const currentValue = inputValueRef.current;
        const lastSlashIndex = currentValue.lastIndexOf('/');
        const beforeSlash = currentValue.substring(0, lastSlashIndex);

        // Insertar el contenido de la plantilla
        const newValue = beforeSlash + template.content;
        inputValueRef.current = newValue;
        if (textareaRef.current) textareaRef.current.value = newValue;
        setHasInputText(newValue.trim().length > 0);

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
            // En pantallas táctiles (sin Shift) Enter inserta salto de línea; se envía con el botón.
            if (e.key === 'Enter' && !e.shiftKey && !window.matchMedia?.('(pointer: coarse)')?.matches) {
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
                if (e.key === 'Enter' && !e.shiftKey && !showTemplates && !window.matchMedia?.('(pointer: coarse)')?.matches) {
                    handleSubmit(e);
                }
        }
    };

    // Estados para scroll infinito de conversaciones
    const [localConversations, setLocalConversations] = useState<Conversation[]>(initialConversations);
    const [hasMore, setHasMore] = useState(initialHasMore);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    // Skeletons de carga: al abrir un chat (visita Inertia) y al recargar la lista (filtros/búsqueda)
    const [openingChat, setOpeningChat] = useState(false);
    const [listLoading, setListLoading] = useState(false);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    // Ref para trackear si se cargaron páginas adicionales (para no resetear hasMore)
    const hasLoadedExtraPagesRef = useRef(false);

    // Estados para control de scroll inteligente
    const [isAtBottom, setIsAtBottom] = useState(true);
    const [newMessagesCount, setNewMessagesCount] = useState(0);
    // Indicador de conexión inestable (fallos consecutivos de polling / navegador offline)
    const [connectionStale, setConnectionStale] = useState(false);
    const pollFailuresRef = useRef(0);
    // Picker de emojis del composer y arrastrar-soltar archivos
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [isFileDragging, setIsFileDragging] = useState(false);
    // Búsqueda dentro de la conversación abierta
    const [showInChatSearch, setShowInChatSearch] = useState(false);
    const [inChatQuery, setInChatQuery] = useState('');
    const [inChatMatchIndex, setInChatMatchIndex] = useState(0);
    // Divisor "Mensajes nuevos" (tipo WhatsApp): ancla y visibilidad (se auto-oculta)
    const [newMsgAnchorId, setNewMsgAnchorId] = useState<number | null>(null);
    const [showNewDivider, setShowNewDivider] = useState(false);
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

    // Detectar scroll del usuario (throttled con RAF)
    useEffect(() => {
        const container = messagesContainerRef.current;
        if (!container) return;

        const handleScroll = () => {
            if (msgScrollRafRef.current) return;
            msgScrollRafRef.current = requestAnimationFrame(() => {
                const atBottom = checkIfAtBottom();
                setIsAtBottom(atBottom);
                if (atBottom) {
                    setNewMessagesCount(0);
                }
                msgScrollRafRef.current = null;
            });
        };

        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            container.removeEventListener('scroll', handleScroll);
            if (msgScrollRafRef.current) {
                cancelAnimationFrame(msgScrollRafRef.current);
                msgScrollRafRef.current = null;
            }
        };
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
        setReplyingTo(null); // Limpiar respuesta al cambiar de conversación
        inputValueRef.current = ''; // Limpiar input de mensaje
        if (textareaRef.current) textareaRef.current.value = '';
        setHasInputText(false);
        previousTextRef.current = '';
        // Initialize local messages from server prop
        const msgs = selectedConversation?.messages || [];
        setLocalMessages(msgs);
        lastMessageIdRef.current = msgs.length > 0 ? Math.max(...msgs.map(m => m.id)) : 0;
        // Marcar todos los mensajes iniciales como ya renderizados (sin animación)
        renderedMessageIdsRef.current = new Set(msgs.map(m => m.id));

        // Divisor "Mensajes nuevos": ancla en el primer mensaje entrante sin leer al abrir.
        let dividerTimer: ReturnType<typeof setTimeout> | undefined;
        if (unreadOnOpen > 0 && msgs.length > 0) {
            const incoming = msgs.filter(m => m.is_from_user);
            const anchor = incoming.length >= unreadOnOpen ? incoming[incoming.length - unreadOnOpen] : incoming[0];
            if (anchor) {
                setNewMsgAnchorId(anchor.id);
                setShowNewDivider(true);
                // Se auto-oculta a los 8s (se desvanece y el chat queda normal)
                dividerTimer = setTimeout(() => setShowNewDivider(false), 8000);
            } else {
                setNewMsgAnchorId(null);
                setShowNewDivider(false);
            }
        } else {
            setNewMsgAnchorId(null);
            setShowNewDivider(false);
        }

        // Sync notes
        setNotesText(selectedConversation?.notes || '');
        setShowNotes(false);
        setShowActivity(false);
        setActivities([]);

        return () => {
            if (dividerTimer) clearTimeout(dividerTimer);
        };
    }, [selectedConversation?.id]);

    // Marcar mensajes como renderizados después de cada render (para que la siguiente vez no animen)
    useEffect(() => {
        localMessages.forEach(m => renderedMessageIdsRef.current.add(m.id));
    }, [localMessages]);

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
    const lastSpecialtyFilterRef = useRef<string>(filters.specialty || '');
    // Ref para trackear si había conversación seleccionada
    const lastSelectedConversationRef = useRef<number | null>(selectedConversation?.id || null);

    // Sincronizar conversaciones cuando cambian desde el servidor
    useEffect(() => {
        const currentSearchFilter = filters.search || '';
        const currentStatusFilter = filters.status || 'all';
        const currentAssignedFilter = filters.assigned || '';
        const currentTagFilter = filters.tag || '';
        const currentSpecialtyFilter = filters.specialty || '';

        const searchChanged = currentSearchFilter !== lastSearchFilterRef.current;
        const statusChanged = currentStatusFilter !== lastStatusFilterRef.current;
        const assignedChanged = currentAssignedFilter !== lastAssignedFilterRef.current;
        const tagChanged = currentTagFilter !== lastTagFilterRef.current;
        const specialtyChanged = currentSpecialtyFilter !== lastSpecialtyFilterRef.current;
        const selectedChanged = (selectedConversation?.id || null) !== lastSelectedConversationRef.current;

        // Actualizar refs
        lastSearchFilterRef.current = currentSearchFilter;
        lastStatusFilterRef.current = currentStatusFilter;
        lastAssignedFilterRef.current = currentAssignedFilter;
        lastTagFilterRef.current = currentTagFilter;
        lastSpecialtyFilterRef.current = currentSpecialtyFilter;
        lastSelectedConversationRef.current = selectedConversation?.id || null;

        // Si cambió algún filtro, resetear completamente
        if (searchChanged || statusChanged || assignedChanged || tagChanged || specialtyChanged) {
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
                // Si hay búsqueda activa, no filtrar por estado/bloqueo (el backend ya respeta search)
                if (filters.search && filters.search.trim() !== '') return true;
                // Ocultar conversaciones resueltas/cerradas/agendadas de "Todos"
                // EXCEPTO si el filtro activo corresponde o hay filtro de etiqueta/especialidad
                if (!filters.tag && !filters.specialty && filters.status !== 'oncology' && filters.status !== 'scheduled') {
                    if ((conv.status === 'resolved' || conv.status === 'closed') && filters.status !== 'resolved') return false;
                    if (conv.status === 'scheduled' && filters.status !== 'scheduled') return false;
                }
                return true;
            });

            // Detectar nuevas conversaciones que no existían
            const existingIds = new Set(prev.map(c => c.id));
            const newConvs = initialConversations.filter(c => !existingIds.has(c.id)).filter(conv => {
                if (filters.search && filters.search.trim() !== '') return true;
                if (!filters.tag && !filters.specialty && filters.status !== 'oncology' && filters.status !== 'scheduled') {
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

    useEffect(() => {
        setLocalFilterCounts({ ...DEFAULT_FILTER_COUNTS, ...filterCounts });
    }, [filterCounts]);

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

            // Throttle la verificación de scroll position con RAF
            if (!convScrollRafRef.current) {
                convScrollRafRef.current = requestAnimationFrame(() => {
                    const { scrollTop, scrollHeight, clientHeight } = container;
                    // Si llegamos al 80% del scroll, cargar más
                    if (scrollTop + clientHeight >= scrollHeight * 0.8 && hasMore && !isLoadingMore) {
                        loadMoreConversations();
                    }
                    convScrollRafRef.current = null;
                });
            }
        };

        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            container.removeEventListener('scroll', handleScroll);
            if (scrollingTimeoutRef.current) {
                clearTimeout(scrollingTimeoutRef.current);
            }
            if (convScrollRafRef.current) {
                cancelAnimationFrame(convScrollRafRef.current);
                convScrollRafRef.current = null;
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
                if (res.data.filterCounts) {
                    setLocalFilterCounts({ ...DEFAULT_FILTER_COUNTS, ...res.data.filterCounts });
                }

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
                        // Si hay búsqueda activa, no filtrar por estado/bloqueo (el backend ya respeta search)
                        if (filters.search && filters.search.trim() !== '') return true;
                        if (!filters.tag && !filters.specialty && filters.status !== 'oncology' && filters.status !== 'scheduled' && filters.status !== 'blocked') {
                            if ((conv.status === 'resolved' || conv.status === 'closed') && filters.status !== 'resolved') return false;
                            if (conv.status === 'scheduled' && filters.status !== 'scheduled') return false;
                            if (conv.is_blocked && filters.status !== 'blocked') return false;
                        }
                        return true;
                    });

                    // Detect new conversations
                    const existingIds = new Set(prev.map(c => c.id));
                    const newConvs = freshConversations.filter(c => !existingIds.has(c.id)).filter(conv => {
                        if (filters.search && filters.search.trim() !== '') return true;
                        if (!filters.tag && !filters.specialty && filters.status !== 'oncology' && filters.status !== 'scheduled' && filters.status !== 'blocked') {
                            if ((conv.status === 'resolved' || conv.status === 'closed') && filters.status !== 'resolved') return false;
                            if (conv.status === 'scheduled' && filters.status !== 'scheduled') return false;
                            if (conv.is_blocked && filters.status !== 'blocked') return false;
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

    // Escuchar reacciones (emojis) en tiempo real para la conversación abierta
    useEffect(() => {
        const channel = (window as any).Echo?.channel('conversations');
        if (!channel) return;

        channel.listen('.message.reaction', (data: { conversation_id: number; message_id: number; emoji: string | null; from_user: boolean; removed: boolean }) => {
            if (!selectedConversation || data.conversation_id !== selectedConversation.id) return;
            setLocalMessages(prev => prev.map(m => {
                if (m.id !== data.message_id) return m;
                // Reemplazar la reacción del mismo lado (paciente o negocio)
                const others = (m.reactions || []).filter(r => r.from_user !== data.from_user);
                if (data.removed || !data.emoji) return { ...m, reactions: others };
                return { ...m, reactions: [...others, { id: -1, emoji: data.emoji, from_user: data.from_user }] };
            }));
        });

        return () => {
            channel.stopListening('.message.reaction');
        };
    }, [selectedConversation?.id]);

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

                // Reconciliar reacciones (fallback del broadcast en tiempo real)
                const reactionUpdates: Array<{ message_id: number; reactions: { id: number; emoji: string; from_user: boolean }[] }> = res.data.reactionUpdates || [];
                if (reactionUpdates.length > 0) {
                    setLocalMessages(prev => {
                        const map = new Map(reactionUpdates.map(r => [r.message_id, r.reactions]));
                        return prev.map(m => map.has(m.id) ? { ...m, reactions: map.get(m.id) } : m);
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

                // Polling exitoso: la conexión está sana de nuevo.
                pollFailuresRef.current = 0;
                setConnectionStale(false);
            } catch {
                // Tras 2 fallos consecutivos, avisar que la conexión quedó inestable
                // (servidor reiniciado, caída de LAN, etc.) en vez de silenciar siempre.
                pollFailuresRef.current += 1;
                if (pollFailuresRef.current >= 2) setConnectionStale(true);
            }
        }, 5000);

        return () => {
            isActive = false;
            clearInterval(messagesInterval);
        };
    }, [selectedConversation?.id]);

    // Avisar al instante cuando el navegador pierde/recupera la conexión.
    useEffect(() => {
        const goOffline = () => setConnectionStale(true);
        const goOnline = () => { pollFailuresRef.current = 0; setConnectionStale(false); };
        window.addEventListener('offline', goOffline);
        window.addEventListener('online', goOnline);
        return () => {
            window.removeEventListener('offline', goOffline);
            window.removeEventListener('online', goOnline);
        };
    }, []);

    // Heartbeat de presencia: señalar que estamos viendo esta conversación
    useEffect(() => {
        if (!selectedConversation) {
            setViewingUsers([]);
            return;
        }

        const sendViewing = () => {
            csrfPost(`/admin/chat/${selectedConversation.id}/viewing`).catch(() => {});
        };

        // Enviar inmediatamente al abrir y luego cada 10s
        sendViewing();
        const viewingInterval = setInterval(sendViewing, 10000);

        return () => clearInterval(viewingInterval);
    }, [selectedConversation?.id]);

    // Enfocar el composer al abrir una conversación (flujo de teclado del asesor en desktop).
    // No roba el foco en táctil (evita abrir el teclado en pantalla); si el chat está
    // bloqueado el composer no se renderiza, así que textareaRef.current es null y no hace nada.
    useEffect(() => {
        if (!selectedConversation?.id) return;
        if (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches) return;
        const focusId = window.setTimeout(() => textareaRef.current?.focus(), 80);
        return () => window.clearTimeout(focusId);
    }, [selectedConversation?.id]);

    // ── Búsqueda dentro de la conversación abierta ──────────────────────────
    // Reutiliza el mismo mecanismo de resaltado/scroll que el salto de citas.
    const inChatMatches = useMemo(() => {
        const q = inChatQuery.trim().toLowerCase();
        if (!q) return [];
        return localMessages.filter(m => (m.content || '').toLowerCase().includes(q)).map(m => m.id);
    }, [inChatQuery, localMessages]);

    const highlightMessage = (id: number) => {
        const el = document.getElementById(`msg-${id}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('ring-2', 'ring-[#06cf9c]/50');
            setTimeout(() => el.classList.remove('ring-2', 'ring-[#06cf9c]/50'), 2000);
        }
    };

    const goToMatch = (index: number) => {
        if (inChatMatches.length === 0) return;
        const wrapped = (index + inChatMatches.length) % inChatMatches.length;
        setInChatMatchIndex(wrapped);
        highlightMessage(inChatMatches[wrapped]);
    };

    const closeInChatSearch = () => {
        setShowInChatSearch(false);
        setInChatQuery('');
        setInChatMatchIndex(0);
    };

    // Al cambiar la consulta, saltar a la coincidencia más reciente (la última del hilo).
    useEffect(() => {
        if (!showInChatSearch || inChatMatches.length === 0) { setInChatMatchIndex(0); return; }
        const lastIdx = inChatMatches.length - 1;
        setInChatMatchIndex(lastIdx);
        highlightMessage(inChatMatches[lastIdx]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inChatQuery]);

    // Cerrar la búsqueda al cambiar de conversación.
    useEffect(() => {
        setShowInChatSearch(false);
        setInChatQuery('');
        setInChatMatchIndex(0);
    }, [selectedConversation?.id]);

    // Mantener el índice dentro de rango si las coincidencias cambian (p. ej. tras un poll).
    useEffect(() => {
        setInChatMatchIndex(i => Math.min(i, Math.max(0, inChatMatches.length - 1)));
    }, [inChatMatches.length]);

    // Debounce para la búsqueda
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
                only: ['conversations', 'hasMore', 'filters', 'filterCounts'],
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

    // Skeletons: detectar navegación de Inertia para mostrar el estado de carga.
    // - Abrir un chat: visita completa a /admin/chat/{id} (sin `only`).
    // - Recargar la lista: partial reload con only:['conversations'] (búsqueda/filtros).
    useEffect(() => {
        const offStart = router.on('start', (event) => {
            const { url, only } = event.detail.visit;
            if (only.includes('conversations')) {
                setListLoading(true);
            } else if (/\/admin\/chat\/\d+/.test(url.pathname)) {
                setOpeningChat(true);
            }
        });
        const offFinish = router.on('finish', () => {
            setOpeningChat(false);
            setListLoading(false);
        });
        return () => { offStart(); offFinish(); };
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

    const formatDateLabel = (date: string) => {
        const d = new Date(date);
        const now = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        if (d.toDateString() === now.toDateString()) return 'Hoy';
        if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
        return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    const getStatusColor = (status: string, isBlocked?: boolean) => {
        if (isBlocked) return 'bg-red-600';
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

    const getStatusLabel = (status: string, isBlocked?: boolean) => {
        if (isBlocked) return 'Bloqueado';
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
        specialtyFilter !== null,
    ].filter(Boolean).length;

    // Filtrar asesores por búsqueda
    const filteredAdvisors = useMemo(() => users.filter(user =>
        user.name.toLowerCase().includes(advisorSearchQuery.toLowerCase())
    ), [users, advisorSearchQuery]);

    // "Limpiar": quitar el asesor de TODAS sus conversaciones activas (vuelven al pool)
    const handleClearAdvisor = useCallback(async () => {
        if (!advisorToClear) return;
        setClearingAdvisor(true);
        try {
            // axios envía el token vivo (cookie XSRF-TOKEN vía withXSRFToken). NO fijar X-CSRF-TOKEN
            // manual del <meta>, que queda obsoleto tras iniciar sesión y provoca el 419.
            const res = await axios.post(`/admin/chat/clear-advisor/${advisorToClear.id}`, {});
            toast.success(res.data?.message || `Se limpiaron las conversaciones de ${advisorToClear.name}.`);
            setAdvisorToClear(null);
            router.reload({ only: ['conversations', 'hasMore', 'filters', 'filterCounts', 'advisorCounts'] });
        } catch {
            toast.error('No se pudo limpiar las conversaciones del asesor.');
        } finally {
            setClearingAdvisor(false);
        }
    }, [advisorToClear]);

    // Filtrar asesores por búsqueda en menú de asignación masiva
    const filteredBulkAdvisors = useMemo(() => users.filter(user =>
        user.name.toLowerCase().includes(bulkAssignSearchQuery.toLowerCase())
    ), [users, bulkAssignSearchQuery]);

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
        if (specialtyFilter !== null) params.specialty = specialtyFilter;

        // Si hay una conversación seleccionada, mantenerla abierta
        const url = selectedConversation
            ? `/admin/chat/${selectedConversation.id}`
            : '/admin/chat';

        router.get(url, params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            only: ['conversations', 'hasMore', 'filters', 'filterCounts'],
        });
    }, [search, selectedConversation, tagFilterId, specialtyFilter]);

    // Función para aplicar filtros incluyendo tag
    const applyFiltersWithTag = useCallback((newStatus: string, newAdvisor: number | null, newTagId: number | null) => {
        setCurrentPage(1);
        hasLoadedExtraPagesRef.current = false;

        const params: Record<string, string> = {};
        if (search) params.search = search;
        if (newStatus !== 'all') params.status = newStatus;
        if (newAdvisor !== null) params.assigned = String(newAdvisor);
        if (newTagId !== null) params.tag = String(newTagId);
        if (specialtyFilter !== null) params.specialty = specialtyFilter;

        const url = selectedConversation
            ? `/admin/chat/${selectedConversation.id}`
            : '/admin/chat';

        router.get(url, params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            only: ['conversations', 'hasMore', 'filters', 'allTags', 'filterCounts'],
        });
    }, [search, selectedConversation, specialtyFilter]);

    // Aplicar filtros incluyendo especialidad (texto exacto). Pasa null para limpiar.
    const applyFiltersWithSpecialty = useCallback((newSpecialty: string | null) => {
        setCurrentPage(1);
        hasLoadedExtraPagesRef.current = false;

        const params: Record<string, string> = {};
        if (search) params.search = search;
        if (statusFilter !== 'all') params.status = statusFilter;
        if (filterByAdvisor !== null) params.assigned = String(filterByAdvisor);
        if (tagFilterId !== null) params.tag = String(tagFilterId);
        if (newSpecialty !== null) params.specialty = newSpecialty;

        const url = selectedConversation
            ? `/admin/chat/${selectedConversation.id}`
            : '/admin/chat';

        router.get(url, params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            only: ['conversations', 'hasMore', 'filters', 'filterCounts'],
        });
    }, [search, statusFilter, filterByAdvisor, tagFilterId, selectedConversation]);

    // Las conversaciones ya vienen filtradas del backend
    const displayedConversations = localConversations;

    // Etiquetas de la conversación abierta: leer del estado LOCAL (mutable) para que al agregar/quitar
    // una etiqueta el panel derecho se actualice sin recargar (no resetea la lista ni cierra el chat).
    const selectedConvTags = useMemo(() => {
        if (!selectedConversation) return [];
        const local = localConversations.find(c => c.id === selectedConversation.id);
        return local?.tags ?? selectedConversation.tags ?? [];
    }, [localConversations, selectedConversation]);

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
    // IMPORTANTE: mousedown NO toca la selección — solo arma el drag.
    // - Si el usuario suelta sin mover → dispara click → handleConversationSelect hace el toggle.
    // - Si el usuario mueve → handleDragSelectEnter aplica la acción al ancla y a los siguientes,
    //   y el click posterior se ignora (dragDidMoveRef = true).
    const handleDragSelectStart = (conversationId: number) => {
        if (!isSelectionMode) return;
        setIsDragSelecting(true);
        dragDidMoveRef.current = false;
        dragStartIdRef.current = conversationId;
        // Decidir acción según el estado actual del ancla
        const isAlreadySelected = selectedConversations.includes(conversationId);
        dragSelectionActionRef.current = isAlreadySelected ? 'deselect' : 'select';
    };

    const handleDragSelectEnter = (conversationId: number) => {
        if (!isDragSelecting || !isSelectionMode) return;
        // Ignorar si seguimos sobre el ancla (no es movimiento real)
        if (dragStartIdRef.current === conversationId && !dragDidMoveRef.current) return;
        const firstMove = !dragDidMoveRef.current;
        dragDidMoveRef.current = true;
        setSelectedConversations(prev => {
            let next = prev;
            // En el primer movimiento, aplicar la acción también al ancla
            if (firstMove && dragStartIdRef.current !== null) {
                const startId = dragStartIdRef.current;
                if (dragSelectionActionRef.current === 'select') {
                    if (!next.includes(startId)) next = [...next, startId];
                } else {
                    next = next.filter(id => id !== startId);
                }
            }
            if (dragSelectionActionRef.current === 'select') {
                return next.includes(conversationId) ? next : [...next, conversationId];
            } else {
                return next.filter(id => id !== conversationId);
            }
        });
    };

    const handleDragSelectEnd = () => {
        setIsDragSelecting(false);
        dragStartIdRef.current = null;
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
        if (lower.includes('131049') || lower.includes('healthy ecosystem'))
            return 'Meta bloqueó la entrega de esta plantilla para este usuario. Esto ocurre cuando la plantilla es clasificada como Marketing y el destinatario ya alcanzó su límite de mensajes de marketing, o nunca ha interactuado con este número. Recomendación: usar una plantilla de categoría "Utilidad" con contenido transaccional (citas, confirmaciones, etc.).';
        if (lower.includes('24 hora') || lower.includes('re-engage') || lower.includes('131047') || lower.includes('window'))
            return 'Han pasado más de 24 horas desde el último mensaje del paciente. Para volver a escribirle, debe usar una plantilla de mensaje aprobada.';
        if (lower.includes('131030'))
            return 'El destinatario no aceptó recibir mensajes de marketing. Solo se pueden enviar plantillas de categoría "Utilidad" o "Autenticación" a este número.';
        if (lower.includes('132015') || lower.includes('parameter'))
            return 'Los parámetros de la plantilla no coinciden con lo esperado. Verifique que llenó todos los campos requeridos.';
        if (lower.includes('132012') || lower.includes('paused'))
            return 'Esta plantilla fue pausada por Meta debido a baja calidad. Debe ir a la configuración de plantillas y corregirla.';
        if (lower.includes('132016') || lower.includes('disabled'))
            return 'Esta plantilla fue desactivada por Meta por violar las políticas de contenido. Debe crear una nueva plantilla.';
        if (lower.includes('rate limit') || lower.includes('throttl') || lower.includes('80007'))
            return 'Se ha superado el límite de mensajes. Intente de nuevo en unos minutos.';
        if (lower.includes('media') && (lower.includes('download') || lower.includes('upload') || lower.includes('size')))
            return 'No se pudo enviar el archivo multimedia. Verifique que el archivo no sea muy grande y que el formato sea compatible.';
        if (lower.includes('recipient') || lower.includes('phone') || lower.includes('131026'))
            return 'El número de teléfono del destinatario no es válido o no tiene WhatsApp.';
        if (lower.includes('132001') || lower.includes('not exist') || lower.includes('not found'))
            return 'La plantilla no existe en Meta o fue eliminada. Sincronice las plantillas desde "Envíos Masivos".';
        if (lower.includes('template'))
            return 'Error con la plantilla de mensaje. Verifique que la plantilla esté aprobada y los parámetros sean correctos.';
        return msg;
    };

    const getStatusIcon = (status: string, errorMessage?: string | null) => {
        switch (status) {
            case 'pending':
                return (
                    <span title={t('conversations.status.sending')}>
                        <Clock className="w-3 h-3 text-[#667781] dark:text-[#8696a0] animate-pulse" />
                    </span>
                );
            case 'sent':
                return (
                    <span title={t('conversations.status.sent')}>
                        <Check className="w-3 h-3 text-[#667781] dark:text-[#8696a0]" />
                    </span>
                );
            case 'delivered':
                return (
                    <span title={t('conversations.status.delivered')}>
                        <CheckCheck className="w-3 h-3 text-[#667781] dark:text-[#8696a0]" />
                    </span>
                );
            case 'read':
                return (
                    <span title={t('conversations.status.read')}>
                        <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
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

        const currentInput = inputValueRef.current;
        const hasContent = currentInput && currentInput.trim().length > 0;
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
            content: currentInput || (selectedFile ? `📎 ${selectedFile.name}` : ''),
            message_type: hasFile ? 'document' : 'text',
            media_url: null, // el preview optimista solo muestra el texto/nombre; evitamos fugas de blob URL
            is_from_user: false,
            status: 'sending',
            created_at: new Date().toISOString(),
            sender: auth?.user ? { name: auth.user.name } : undefined,
        };

        // Agregar mensaje optimista al estado
        setOptimisticMessages(prev => [...prev, optimisticMessage]);

        // Guardar contenido para posible reintento
        const messageContent = currentInput;
        const messageFile = selectedFile;
        const messageTemplateMediaFiles = templateMediaFiles;
        const messageTemplateId = selectedTemplateId;
        const messageReplyToId = replyingTo?.id ?? null;

        // Limpiar formulario inmediatamente (mejor UX)
        inputValueRef.current = '';
        if (textareaRef.current) textareaRef.current.value = '';
        setHasInputText(false);
        previousTextRef.current = '';
        reset();
        setSelectedFile(null);
        setReplyingTo(null);
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
        // Si se está respondiendo a un mensaje, enviar su ID
        if (messageReplyToId) {
            formData.append('reply_to_id', messageReplyToId.toString());
        }

        csrfPost(`/admin/chat/${selectedConversation.id}/send`, formData)
            .then(response => {
                if (!(response.status >= 200 && response.status < 300)) {
                    if (response.status === 419) {
                        throw new Error('Sesión expirada. Por favor recarga la página.');
                    }
                    if (response.status === 423) {
                        throw new Error(response.data?.error || 'Esta conversación está siendo atendida por otro asesor.');
                    }
                    throw new Error('Error al enviar mensaje');
                }
                return response.data;
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
                    // El mensaje real llegará por polling/Reverb. Lo marcamos como "ya animado"
                    // para que reemplace al optimista SIN re-animar: transición fluida, sin doble pop.
                    if (serverMessage?.id) {
                        renderedMessageIdsRef.current.add(serverMessage.id);
                    }
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
        csrfPost(`/admin/chat/${conversationId}/pin`).then(() => {
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
            csrfPost(`/admin/chat/${selectedConversation.id}/notes`, { notes: text }).then(() => {
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
        csrfPost(`/admin/chat/${selectedConversation.id}/typing`).catch(() => {});
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
            if (specialtyFilter !== null) params.specialty = specialtyFilter;

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

        // Cambio de estado SIN recargar la lista (evita el salto al inicio y que se cierre el chat).
        // Actualización optimista local + refrescar SOLO la conversación abierta (encabezado).
        setLocalConversations(prev =>
            prev.map(c => c.id === convId ? { ...c, status, resolved_by_user: null, resolved_at: null } : c)
        );
        csrfPost(`/admin/chat/${convId}/status`, { status }).then(() => {
            toast.success('Estado actualizado');
            router.reload({ only: ['selectedConversation'] });
        }).catch(() => toast.error('Error al cambiar el estado'));
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

        // Cambio de estado SIN recargar la lista (evita el salto al inicio y que se cierre el chat).
        setLocalConversations(prev =>
            prev.map(c => c.id === conversationId ? { ...c, status, resolved_by_user: null, resolved_at: null } : c)
        );
        csrfPost(`/admin/chat/${conversationId}/status`, { status }).then(() => {
            toast.success('Estado actualizado');
            if (selectedConversation?.id === conversationId) {
                router.reload({ only: ['selectedConversation'] });
            }
        }).catch(() => toast.error('Error al cambiar el estado'));
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
        if (specialtyFilter !== null) params.specialty = specialtyFilter;

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
                    } ${isSidebarVisible ? 'w-full md:w-80 lg:w-[340px] xl:w-[360px]' : 'hidden md:w-0 md:overflow-hidden'
                    }`}>
                    {/* Header */}
                    <div className="px-4 pt-4 pb-2">
                        <div className="flex items-center justify-between mb-3">
                            <h1 className="text-2xl font-extrabold text-[#2e3f84] dark:text-blue-200 tracking-tight">{t('conversations.title')}</h1>

                            <div className="flex items-center gap-2 flex-shrink-0">
                                {/* Botón para nueva conversación */}
                                <button
                                    onClick={() => setShowNewChatModal(true)}
                                    className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2e3f84] to-[#2e3a75] text-white flex items-center justify-center shadow-lg hover:shadow-xl active:scale-95 transition-all"
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
                                            : 'bg-gradient-to-br from-[#2e3f84] to-[#2e3a75] text-white'
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
                                            : 'bg-gradient-to-br from-[#2e3f84] to-[#2e3a75] text-white'
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

                                            <div className="border-t border-border my-0.5"></div>

                                            {/* Sección: Especialidades (filtra por texto exacto de la columna specialty) */}
                                            <div>
                                                <button
                                                    onClick={() => setExpandedFilterSection(expandedFilterSection === 'specialties' ? null : 'specialties')}
                                                    className="w-full px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase flex items-center justify-between hover:bg-accent"
                                                >
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <Tag className="w-3.5 h-3.5" />
                                                        <span>Especialidades</span>
                                                        {specialtyFilter !== null && (
                                                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 rounded truncate max-w-[140px]" title={specialtyFilter}>
                                                                {specialtyFilter}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {expandedFilterSection === 'specialties' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                </button>
                                                {expandedFilterSection === 'specialties' && (
                                                    <div className="pb-1">
                                                        <div className="px-3 py-2 border-b border-border">
                                                            <div className="relative">
                                                                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                                                <input
                                                                    type="text"
                                                                    placeholder="Buscar especialidad..."
                                                                    className="w-full pl-7 pr-2 py-1 text-xs border border-border rounded bg-muted focus:outline-none focus:border-primary"
                                                                    value={specialtySearchQuery}
                                                                    onChange={(e) => setSpecialtySearchQuery(e.target.value)}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="max-h-[240px] overflow-y-auto custom-scrollbar">
                                                            <button
                                                                onClick={() => {
                                                                    setSpecialtyFilter(null);
                                                                    setSpecialtySearchQuery('');
                                                                    applyFiltersWithSpecialty(null);
                                                                }}
                                                                className={`w-full px-4 py-1.5 text-left text-sm hover:bg-accent flex items-center justify-between ${specialtyFilter === null ? 'font-bold text-primary dark:text-primary bg-muted' : ''}`}
                                                            >
                                                                <span>Todas</span>
                                                                {specialtyFilter === null && <Check className="w-3.5 h-3.5 text-primary" />}
                                                            </button>
                                                            <div className="border-t border-border my-0.5"></div>
                                                            {allSpecialties
                                                                .filter(s => s.name.toLowerCase().includes(specialtySearchQuery.toLowerCase()))
                                                                .map((s) => (
                                                                    <button
                                                                        key={s.name}
                                                                        onClick={() => {
                                                                            setSpecialtyFilter(s.name);
                                                                            applyFiltersWithSpecialty(s.name);
                                                                        }}
                                                                        className={`w-full px-4 py-1.5 text-left text-sm hover:bg-accent flex items-center justify-between gap-2 ${specialtyFilter === s.name ? 'font-bold text-primary dark:text-primary bg-muted' : ''}`}
                                                                        title={s.name}
                                                                    >
                                                                        <span className="truncate flex items-center gap-2 min-w-0">
                                                                            <span className="w-3 h-3 rounded-full flex-shrink-0 bg-teal-500"></span>
                                                                            <span className="truncate">{s.name}</span>
                                                                        </span>
                                                                        <span className="text-xs text-muted-foreground flex-shrink-0">({s.count})</span>
                                                                    </button>
                                                                ))}
                                                            {allSpecialties.length === 0 && (
                                                                <div className="px-4 py-2 text-xs text-muted-foreground text-center">
                                                                    Sin especialidades asignadas todavía.
                                                                </div>
                                                            )}
                                                            {allSpecialties.length > 0 && allSpecialties.filter(s => s.name.toLowerCase().includes(specialtySearchQuery.toLowerCase())).length === 0 && (
                                                                <div className="px-4 py-2 text-xs text-muted-foreground text-center">
                                                                    No se encontraron especialidades.
                                                                </div>
                                                            )}
                                                        </div>
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
                                                                                onContextMenu={(e) => {
                                                                                    e.preventDefault();
                                                                                    e.stopPropagation();
                                                                                    setAdvisorMenu({ id: user.id, name: user.name, count: advisorCounts[user.id] ?? 0, x: e.clientX, y: e.clientY });
                                                                                }}
                                                                                className={`w-full px-4 py-1.5 text-left text-sm hover:bg-accent flex items-center justify-between gap-2 ${filterByAdvisor === user.id ? 'font-bold text-primary dark:text-primary bg-muted' : ''}`}
                                                                            >
                                                                                <span className="truncate">{user.name}</span>
                                                                                <span className="flex shrink-0 items-center gap-1.5">
                                                                                    <span
                                                                                        title="Conversaciones activas asignadas"
                                                                                        className={`min-w-[22px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold ${(advisorCounts[user.id] ?? 0) > 0 ? 'bg-[#2e3f84]/10 text-[#2e3f84] dark:bg-blue-500/20 dark:text-blue-300' : 'bg-muted text-muted-foreground'}`}
                                                                                    >
                                                                                        {advisorCounts[user.id] ?? 0}
                                                                                    </span>
                                                                                    {filterByAdvisor === user.id && <Check className="w-3.5 h-3.5 text-primary dark:text-primary" />}
                                                                                </span>
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
                                                            setSpecialtyFilter(null);
                                                            setSpecialtySearchQuery('');
                                                            setEditingTag(null);
                                                            setShowFiltersPanel(false);
                                                            setExpandedFilterSection(null);
                                                            setCurrentPage(1);
                                                            hasLoadedExtraPagesRef.current = false;
                                                            const params: Record<string, string> = {};
                                                            if (search) params.search = search;
                                                            const url = selectedConversation
                                                                ? `/admin/chat/${selectedConversation.id}`
                                                                : '/admin/chat';
                                                            router.get(url, params, {
                                                                preserveState: true,
                                                                preserveScroll: true,
                                                                replace: true,
                                                                only: ['conversations', 'hasMore', 'filters', 'allTags', 'filterCounts'],
                                                            });
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
                                className="w-full pl-11 pr-4 py-2.5 bg-muted dark:bg-neutral-800 border-none rounded-full text-sm focus:ring-2 focus:ring-[#2e3f84]/10 transition-all placeholder:text-[#767681]"
                            />
                        </div>

                        {/* WhatsApp-style quick filter pills */}
                        <div
                            ref={filterPillsRef}
                            className="filter-pills-scroll flex items-center gap-1.5 px-1 pt-2 pb-2 overflow-x-auto"
                        >
                            {[
                                { value: 'all', label: 'Todos' },
                                { value: 'unanswered', label: 'No leídos' },
                                { value: 'pending_response', label: 'En espera' },
                                { value: 'resolved', label: 'Resueltos' },
                                { value: 'scheduled', label: 'Agendados' },
                                { value: 'oncology', label: 'Oncología' },
                                { value: 'blocked', label: 'Bloqueados' },
                            ].map((pill) => (
                                <button
                                    key={pill.value}
                                    aria-pressed={statusFilter === pill.value}
                                    onClick={() => {
                                        setStatusFilter(pill.value);
                                        applyFilters(pill.value, filterByAdvisor);
                                    }}
                                    className={`flex-shrink-0 inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                                        statusFilter === pill.value
                                            ? 'bg-[#dee1ff] dark:bg-blue-900/30 text-[#2e3f84] dark:text-blue-300 font-semibold'
                                            : 'bg-muted dark:bg-neutral-800 text-[#5f5e5e] dark:text-neutral-400 hover:bg-muted/80 dark:hover:bg-neutral-700'
                                    }`}
                                >
                                    <span>{pill.label}</span>
                                    {(pill.value === 'unanswered' || pill.value === 'pending_response') && (
                                        <span className={`ml-1.5 inline-flex min-w-5 h-5 px-1.5 items-center justify-center rounded-full text-[11px] font-bold ${
                                            statusFilter === pill.value
                                                ? 'bg-white/70 dark:bg-blue-950/70 text-[#2e3f84] dark:text-blue-200'
                                                : 'bg-background/80 dark:bg-neutral-900 text-[#5f5e5e] dark:text-neutral-300'
                                        }`}>
                                            {localFilterCounts[pill.value as 'unanswered' | 'pending_response'] ?? 0}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Lista de Conversaciones */}
                    <div
                        ref={conversationsListRef}
                        className="flex-1 overflow-y-auto overflow-x-hidden pb-6 custom-scrollbar-light"
                    >
                        {listLoading ? (
                            <ConversationListSkeleton />
                        ) : localConversations.length === 0 ? (
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
                                        aria-current={selectedConversation?.id === conversation.id ? 'true' : undefined}
                                        className={`conv-list-item w-full flex items-center gap-3 pl-3 transition-colors text-left select-none group ${selectedConversations.includes(conversation.id)
                                                ? 'bg-green-50/80 dark:bg-green-900/20'
                                                : selectedConversation?.id === conversation.id
                                                    ? 'bg-[#e9ebf5] dark:bg-neutral-800'
                                                    : 'hover:bg-[#f5f6fa] dark:hover:bg-white/[0.04]'
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
                                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#4e5fa4] to-[#3e4f94] flex items-center justify-center text-white text-[16px] font-semibold">
                                                    {[...(conversation.contact_name || '')][0]?.toUpperCase() || '?'}
                                                </div>
                                            )}
                                        </div>

                                        {/* Información (divisor inset estilo WhatsApp: empieza después del avatar) */}
                                        <div className="flex-grow min-w-0 py-2.5 pr-3 border-b border-[#ececf3] dark:border-white/[0.06]">
                                            <div className="flex justify-between items-center mb-0.5">
                                                <div className="flex-1 min-w-0 flex items-center gap-1.5">
                                                    <h3 className="font-bold text-[#1a1c1c] dark:text-neutral-200 truncate text-[15px]">
                                                        {conversation.contact_name || 'Sin nombre'}
                                                    </h3>
                                                    {conversation.is_pinned && (
                                                        <Pin className="w-3.5 h-3.5 text-[#2e3f84] dark:text-blue-400 flex-shrink-0 rotate-45" />
                                                    )}
                                                    {isSelectionMode && conversation.unread_count > 0 && (
                                                        <span
                                                            className="flex-shrink-0 inline-flex items-center gap-0.5 px-1.5 h-[18px] rounded-full bg-green-500 text-white text-[10px] font-bold shadow-sm"
                                                            title={`${conversation.unread_count} mensaje(s) sin leer`}
                                                        >
                                                            <MessageSquare className="w-2.5 h-2.5" />
                                                            {conversation.unread_count}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className={`text-[11px] font-medium flex-shrink-0 ml-2 ${conversation.unread_count > 0 ? 'text-[#5b6bb5] dark:text-blue-400/80' : 'text-[#5f5e5e] dark:text-neutral-500'
                                                    }`}>
                                                    {formatTime(
                                                        // Fecha coherente con el texto de preview: usar el created_at del
                                                        // MISMO mensaje mostrado (pm), no last_message_at, que puede quedar
                                                        // adelantado por eventos sin mensaje visible en el hilo (p. ej. un
                                                        // mensaje saliente borrado). Fallback a last_message_at si no hay mensaje.
                                                        (conversation.unread_count > 0
                                                            ? (conversation.last_visible_message ?? conversation.last_message)
                                                            : conversation.last_message
                                                        )?.created_at ?? conversation.last_message_at
                                                    )}
                                                </span>
                                            </div>
                                            {(() => {
                                                // Preview: si hay no-leídos, mostrar el último mensaje REAL del paciente
                                                // (no la confirmación de cita del sistema); si no, el último tal cual.
                                                const pm = conversation.unread_count > 0
                                                    ? (conversation.last_visible_message ?? conversation.last_message)
                                                    : conversation.last_message;
                                                return (
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className={`text-sm truncate flex items-center gap-1 flex-1 min-w-0 ${conversation.unread_count > 0 ? 'text-[#1a1c1c] dark:text-neutral-200 font-medium' : 'text-[#5f5e5e] dark:text-neutral-400'}`}>
                                                            {pm && (
                                                                pm.is_from_user ? (
                                                                    <span title="Mensaje del cliente">
                                                                        <CornerDownLeft className="w-3 h-3 text-[#767681] flex-shrink-0" />
                                                                    </span>
                                                                ) : pm.status === 'failed' ? (
                                                                    <span title={pm.error_message ? `Error: ${pm.error_message}` : 'Error al enviar'}>
                                                                        <X className="w-3 h-3 text-red-500 flex-shrink-0" />
                                                                    </span>
                                                                ) : (
                                                                    <span title="Mensaje enviado">
                                                                        <CornerDownRight className="w-3 h-3 text-[#2e3f84] dark:text-blue-400 flex-shrink-0" />
                                                                    </span>
                                                                )
                                                            )}
                                                            <span className="truncate">
                                                                {pm?.content || t('conversations.noMessages')}
                                                            </span>
                                                        </p>
                                                        {/* Badge de no-leídos a la derecha (estilo WhatsApp) */}
                                                        {!isSelectionMode && conversation.unread_count > 0 && (
                                                            <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 bg-green-500 rounded-full flex items-center justify-center text-white text-[11px] font-bold">
                                                                {conversation.unread_count}
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                            <div className="flex items-center justify-between mt-1">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`w-2 h-2 rounded-full ${getStatusColor(conversation.status, conversation.is_blocked)}`}></span>
                                                    <span className="text-[11px] font-medium text-[#5f5e5e] dark:text-neutral-400">{getStatusLabel(conversation.status, conversation.is_blocked)}</span>
                                                </div>
                                                {/* Mostrar quién resolvió la conversación */}
                                                {conversation.status === 'resolved' && conversation.resolved_by_user && (() => {
                                                    const colors = getUserBadgeColor(conversation.resolved_by_user!.id);
                                                    return (
                                                        <span className={`text-[10px] ${colors.text} ${colors.bg} border ${colors.border} px-2 py-0.5 rounded-full truncate max-w-[130px] font-medium`} title={`Resuelto por ${conversation.resolved_by_user!.name}`}>
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
                                        <div className="inline-block w-5 h-5 border-2 border-[#2e3f84] border-t-transparent rounded-full animate-spin"></div>
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
                        <div className="p-3 bg-gradient-to-br from-[#2e3f84] to-[#2e3a75] border-t border-[#2e3f84]/30">
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
                                    <>
                                        {conversation.specialty ? (
                                            <div className="px-3 py-1.5">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Stethoscope className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 flex-shrink-0" />
                                                    <span className="text-sm font-medium text-teal-700 dark:text-teal-300 truncate">{conversation.specialty}</span>
                                                </div>
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setSpecialtyName(conversation.specialty || ''); setShowSpecialtyInput(true); }}
                                                        className="flex-1 py-1 text-xs hover:bg-accent rounded flex items-center justify-center gap-1"
                                                    >
                                                        <Pencil className="w-3 h-3" />
                                                        Editar
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            csrfPost(`/admin/chat/${conversation.id}/specialty`, { specialty: null }).then(() => {
                                                                setLocalConversations(prev => prev.map(c =>
                                                                    c.id === conversation.id ? { ...c, specialty: null } : c
                                                                ));
                                                                toast.success('Especialidad eliminada');
                                                            }).catch(() => {
                                                                toast.error('Error al eliminar la especialidad');
                                                            });
                                                            setContextMenu(null);
                                                        }}
                                                        className="flex-1 py-1 text-xs hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded flex items-center justify-center gap-1"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                        Eliminar
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setShowSpecialtyInput(true); }}
                                                className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent flex items-center gap-2"
                                            >
                                                <Stethoscope className="w-3.5 h-3.5" />
                                                Especialidad
                                            </button>
                                        )}
                                    </>
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
                                                    csrfPost(`/admin/chat/${conversation.id}/specialty`, { specialty: name }).then(() => {
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

                                {/* Bloquear / Desbloquear */}
                                <div className="border-t border-border my-1"></div>
                                <button
                                    onClick={() => {
                                        csrfPost(`/admin/chat/${conversation.id}/block`).then(res => res.data).then(data => {
                                            if (data.success) {
                                                setLocalConversations(prev => prev.map(c =>
                                                    c.id === conversation.id ? { ...c, is_blocked: data.is_blocked } : c
                                                ));
                                                if (selectedConversation?.id === conversation.id) {
                                                    router.reload({ only: ['selectedConversation'] });
                                                }
                                                if (data.meta_synced === false) {
                                                    toast.warning(
                                                        `${data.is_blocked ? 'Bloqueado' : 'Desbloqueado'} localmente, pero WhatsApp no lo confirmó: ${data.meta_error ?? 'sin detalle'}`
                                                    );
                                                } else {
                                                    toast.success(data.is_blocked ? 'Contacto bloqueado' : 'Contacto desbloqueado');
                                                }
                                            }
                                        }).catch(() => {
                                            toast.error('Error al cambiar estado de bloqueo');
                                        });
                                        setContextMenu(null);
                                    }}
                                    className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                                        conversation.is_blocked
                                            ? 'hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 dark:text-green-400'
                                            : 'hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400'
                                    }`}
                                >
                                    <ShieldBan className="w-4 h-4" />
                                    {conversation.is_blocked ? 'Desbloquear' : 'Bloquear'}
                                </button>
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
                            <h3 className="text-xl font-semibold text-[#2e3f84] dark:text-neutral-300 mb-2">
                                {t('conversations.selectConversation')}
                            </h3>
                            <p className="text-sm text-[#767681]">
                                {t('conversations.selectConversationHint')}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex min-w-0 w-full md:w-auto relative">
                    <div className="flex-1 flex flex-col min-w-0 bg-background dark:bg-neutral-900">
                        {/* Header del Chat */}
                        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 bg-card/80 dark:bg-neutral-900/80 backdrop-blur-md shadow-sm">
                            <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
                                {/* Botón volver (mobile) / toggle sidebar (desktop) */}
                                {/* Móvil: volver a la lista (flecha atrás, estilo WhatsApp) */}
                                <button
                                    onClick={handleCloseChat}
                                    aria-label="Volver a la lista"
                                    title="Volver"
                                    className="md:hidden w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted dark:hover:bg-neutral-800 transition-colors flex-shrink-0"
                                >
                                    <ArrowLeft className="w-5 h-5 text-[#2e3f84] dark:text-neutral-300" />
                                </button>
                                {/* Desktop: mostrar/ocultar la lista de conversaciones */}
                                <button
                                    onClick={() => setIsSidebarVisible(!isSidebarVisible)}
                                    aria-label={isSidebarVisible ? t('conversations.hideList') : t('conversations.showList')}
                                    className="hidden md:flex w-9 h-9 rounded-full items-center justify-center hover:bg-muted dark:hover:bg-neutral-800 transition-colors flex-shrink-0"
                                    title={isSidebarVisible ? t('conversations.hideList') : t('conversations.showList')}
                                >
                                    {isSidebarVisible ? (
                                        <PanelLeftClose className="w-5 h-5 text-[#2e3f84] dark:text-neutral-300" />
                                    ) : (
                                        <PanelLeftOpen className="w-5 h-5 text-[#2e3f84] dark:text-neutral-300" />
                                    )}
                                </button>
                                {/* Avatar e Información */}
                                <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-[#2e3f84] to-[#2e3a75] flex items-center justify-center text-white text-sm md:text-base font-bold flex-shrink-0">
                                        {[...(selectedConversation.contact_name || '')][0]?.toUpperCase() || '?'}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h2 className="font-bold text-[#2e3f84] dark:text-neutral-200 text-sm md:text-base truncate">
                                            {selectedConversation.contact_name || 'Sin nombre'}
                                        </h2>
                                        <div className="flex items-center gap-2 text-xs md:text-sm text-[#5f5e5e] dark:text-neutral-400">
                                            <Phone className="w-3 h-3" />
                                            <span>{selectedConversation.phone_number}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Estado (indicador mínimo; el detalle vive en el panel derecho).
                                    min-w-0 + truncate: si falta espacio se corta con "…" en vez de
                                    quedar por debajo de los botones de acción. */}
                                <span className="hidden sm:inline-flex items-center gap-1.5 ml-2 mr-1 text-xs text-[#5f5e5e] dark:text-neutral-400 min-w-0">
                                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusColor(selectedConversation.status, selectedConversation.is_blocked)} ${selectedConversation.status === 'active' && !selectedConversation.is_blocked ? 'status-pulse' : ''}`}></span>
                                    <span className="truncate">{getStatusLabel(selectedConversation.status, selectedConversation.is_blocked)}</span>
                                </span>
                            </div>

                            {/* Acciones y Cerrar */}
                            <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                                {/* Buscar en la conversación */}
                                <button
                                    onClick={() => setShowInChatSearch(v => !v)}
                                    aria-label="Buscar en la conversación"
                                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${showInChatSearch ? 'bg-[#2e3f84] text-white' : 'hover:bg-muted dark:hover:bg-neutral-800 text-[#2e3f84] dark:text-neutral-300'}`}
                                    title="Buscar en la conversación"
                                >
                                    <Search className="w-5 h-5" />
                                </button>
                                {/* Toggle del panel de detalles del contacto */}
                                <button
                                    onClick={() => setShowDetails(v => !v)}
                                    aria-label="Detalles del contacto"
                                    title="Detalles del contacto"
                                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${showDetails ? 'bg-[#2e3f84] text-white' : 'hover:bg-muted dark:hover:bg-neutral-800 text-[#2e3f84] dark:text-neutral-300'}`}
                                >
                                    <PanelRight className="w-5 h-5" />
                                </button>

                                {/* El menú de acciones (cambiar estado, bloquear, exportar, eliminar) se movió al panel derecho */}

                                {/* Datos del paciente, Notas y Actividad se movieron al panel derecho de detalles */}

                                {/* Botón Cerrar Chat */}
                                <button
                                    onClick={handleCloseChat}
                                    className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted dark:hover:bg-neutral-800 transition-colors text-[#2e3f84] dark:text-neutral-300"
                                    aria-label="Cerrar conversación"
                                    title={t('conversations.closeChatHint')}
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Barra de búsqueda dentro de la conversación */}
                        {showInChatSearch && (
                            <div className="flex items-center gap-2 px-4 md:px-6 py-2 bg-card/80 dark:bg-neutral-900/80 backdrop-blur-md border-b border-border/60">
                                <Search className="w-4 h-4 text-[#767681] flex-shrink-0" />
                                <input
                                    autoFocus
                                    value={inChatQuery}
                                    onChange={(e) => setInChatQuery(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') { e.preventDefault(); goToMatch(e.shiftKey ? inChatMatchIndex - 1 : inChatMatchIndex + 1); }
                                        if (e.key === 'Escape') { e.preventDefault(); closeInChatSearch(); }
                                    }}
                                    placeholder="Buscar en esta conversación..."
                                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-[#767681]"
                                />
                                <span className="text-xs text-[#767681] tabular-nums flex-shrink-0">
                                    {inChatMatches.length > 0 ? `${Math.min(inChatMatchIndex + 1, inChatMatches.length)}/${inChatMatches.length}` : (inChatQuery.trim() ? '0/0' : '')}
                                </span>
                                <button onClick={() => goToMatch(inChatMatchIndex - 1)} disabled={inChatMatches.length === 0} aria-label="Coincidencia anterior" className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-muted dark:hover:bg-neutral-800 disabled:opacity-40 text-[#2e3f84] dark:text-neutral-300">
                                    <ChevronUp className="w-4 h-4" />
                                </button>
                                <button onClick={() => goToMatch(inChatMatchIndex + 1)} disabled={inChatMatches.length === 0} aria-label="Coincidencia siguiente" className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-muted dark:hover:bg-neutral-800 disabled:opacity-40 text-[#2e3f84] dark:text-neutral-300">
                                    <ChevronDown className="w-4 h-4" />
                                </button>
                                <button onClick={closeInChatSearch} aria-label="Cerrar búsqueda" className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-muted dark:hover:bg-neutral-800 text-[#2e3f84] dark:text-neutral-300">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        )}

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

                        {/* Datos del paciente, Notas y Actividad ahora viven en el panel derecho de detalles (aside, abajo) */}

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

                        {/* Banner de conexión inestable (solo aparece ante fallos reales) */}
                        {connectionStale && (
                            <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-amber-50/90 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-300 text-xs font-medium">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Sin conexión — reintentando...
                            </div>
                        )}

                        {/* Área de Mensajes */}
                        <div
                            ref={messagesContainerRef}
                            onDragOver={(e) => { e.preventDefault(); if (!isFileDragging) setIsFileDragging(true); }}
                            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsFileDragging(false); }}
                            onDrop={(e) => {
                                e.preventDefault();
                                setIsFileDragging(false);
                                const f = e.dataTransfer.files?.[0];
                                if (f) setSelectedFile(f);
                            }}
                            className="flex-1 overflow-y-auto px-3 md:px-5 py-3 md:py-4 relative custom-scrollbar chat-bg-pattern chat-messages-scroll"
                        >
                            {/* Overlay al arrastrar un archivo encima */}
                            {isFileDragging && (
                                <div className="absolute inset-2 z-30 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#2e3f84] bg-[#dee1ff]/70 dark:bg-blue-900/40 backdrop-blur-sm pointer-events-none">
                                    <Paperclip className="w-8 h-8 text-[#2e3f84] dark:text-blue-300" />
                                    <span className="text-sm font-semibold text-[#2e3f84] dark:text-blue-200">Suelta el archivo aquí</span>
                                </div>
                            )}
                            {openingChat ? (
                                <ChatMessagesSkeleton />
                            ) : localMessages.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-[#767681]">
                                    <div className="text-center">
                                        <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-white/60 dark:bg-neutral-800/60 flex items-center justify-center">
                                            <MessageSquare className="w-8 h-8 text-[#767681]/50" />
                                        </div>
                                        <p className="font-medium">{t('conversations.noMessagesInConversation')}</p>
                                        <p className="text-xs mt-1 text-[#767681]/70">Envía el primer mensaje para iniciar</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2" role="log" aria-live="polite" aria-relevant="additions" aria-label="Mensajes de la conversación">
                                    {localMessages.map((message, index) => {
                                        // Date separator logic
                                        const msgDate = new Date(message.created_at).toDateString();
                                        const prevDate = index > 0 ? new Date(localMessages[index - 1].created_at).toDateString() : null;
                                        const showDateSeparator = index === 0 || msgDate !== prevDate;

                                        // Primer mensaje de un grupo (cambia el remitente o hay separador de
                                        // fecha) → lleva la "colita" de burbuja estilo WhatsApp.
                                        const isFirstOfGroup = showDateSeparator
                                            || index === 0
                                            || localMessages[index - 1].is_from_user !== message.is_from_user;

                                        return (
                                            <div key={message.id}>
                                                <AnimatePresence>
                                                    {showNewDivider && message.id === newMsgAnchorId && (
                                                        <motion.div
                                                            key="new-messages-divider"
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: 'auto' }}
                                                            exit={{ opacity: 0, height: 0 }}
                                                            transition={{ duration: 0.35, ease: 'easeInOut' }}
                                                            className="overflow-hidden"
                                                        >
                                                            <div className="flex items-center gap-3 px-2 py-2">
                                                                <div className="h-px flex-1 bg-[#2e3f84]/20 dark:bg-blue-400/20" />
                                                                <span className="rounded-full bg-[#2e3f84] px-3 py-1 text-[11px] font-bold text-white shadow-sm dark:bg-blue-600">
                                                                    Mensajes nuevos
                                                                </span>
                                                                <div className="h-px flex-1 bg-[#2e3f84]/20 dark:bg-blue-400/20" />
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                                {showDateSeparator && (
                                                    <div className="chat-date-separator">
                                                        <span>{formatDateLabel(message.created_at)}</span>
                                                    </div>
                                                )}
                                                <div
                                                    className={`flex ${message.is_from_user ? 'justify-start' : 'justify-end'} ${!renderedMessageIdsRef.current.has(message.id) ? (message.is_from_user ? 'msg-animate-left' : 'msg-animate-right') : ''}`}
                                                >
                                          <div className={`group/msg relative flex ${message.is_from_user ? 'flex-row' : 'flex-row-reverse'} items-start gap-1 max-w-[85%] md:max-w-[56%]`}>
                                            {/* Acciones (responder, copiar, reaccionar): flotan al lado en hover SIN reservar espacio */}
                                            {!isLockedByOther && (
                                            <div className={`absolute top-1/2 -translate-y-1/2 z-10 flex items-center gap-0.5 px-1 transition-opacity duration-150 ${message.is_from_user ? 'left-full' : 'right-full'} ${reactionPickerFor === message.id ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none group-hover/msg:opacity-100 group-hover/msg:pointer-events-auto group-focus-within/msg:opacity-100 group-focus-within/msg:pointer-events-auto'}`}>
                                                <button
                                                    onClick={() => {
                                                        setReplyingTo(message);
                                                        textareaRef.current?.focus();
                                                    }}
                                                    className="p-1.5 rounded-full hover:bg-muted dark:hover:bg-neutral-700 text-[#667781] dark:text-neutral-400 hover:text-[#2e3f84] dark:hover:text-blue-300"
                                                    aria-label="Responder" title="Responder"
                                                >
                                                    <Reply className="w-4 h-4" />
                                                </button>
                                                {message.content && (
                                                <button
                                                    onClick={() => { navigator.clipboard?.writeText(message.content || ''); toast.success('Mensaje copiado'); }}
                                                    aria-label="Copiar mensaje" title="Copiar"
                                                    className="p-1.5 rounded-full hover:bg-muted dark:hover:bg-neutral-700 text-[#667781] dark:text-neutral-400 hover:text-[#2e3f84] dark:hover:text-blue-300"
                                                >
                                                    <Copy className="w-4 h-4" />
                                                </button>
                                                )}
                                                <div className="relative">
                                                    <button
                                                        onClick={() => setReactionPickerFor(reactionPickerFor === message.id ? null : message.id)}
                                                        className="p-1.5 rounded-full hover:bg-muted dark:hover:bg-neutral-700 text-[#667781] dark:text-neutral-400 hover:text-[#2e3f84] dark:hover:text-blue-300"
                                                        aria-label="Reaccionar" title="Reaccionar"
                                                    >
                                                        <SmilePlus className="w-4 h-4" />
                                                    </button>
                                                    {/* Backdrop invisible: clic afuera cierra el picker (igual que se abre). */}
                                                    {reactionPickerFor === message.id && (
                                                        <div className="fixed inset-0 z-20" onClick={() => setReactionPickerFor(null)} />
                                                    )}
                                                    <AnimatePresence>
                                                    {reactionPickerFor === message.id && (
                                                        <motion.div
                                                            key="reaction-picker"
                                                            initial={{ opacity: 0, scale: 0.6, y: 12 }}
                                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                                            exit={{ opacity: 0, scale: 0.8, y: 8 }}
                                                            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                                                            style={{ transformOrigin: 'bottom center' }}
                                                            className={`absolute z-30 bottom-full mb-2 flex items-center gap-0.5 rounded-full bg-white dark:bg-neutral-800 border border-[#e9edef] dark:border-neutral-700 shadow-xl px-2 py-1.5 ${message.is_from_user ? 'left-0' : 'right-0'}`}
                                                        >
                                                            {QUICK_REACTIONS.map((emoji, i) => (
                                                                <motion.button
                                                                    key={emoji}
                                                                    initial={{ opacity: 0, scale: 0, y: 10 }}
                                                                    animate={{ opacity: 1, scale: 1, y: 0, transition: { delay: 0.04 + i * 0.035, type: 'spring', stiffness: 600, damping: 18 } }}
                                                                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                                                                    whileHover={{ scale: 1.35, y: -14, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] } }}
                                                                    whileTap={{ scale: 0.9, transition: { duration: 0.12, ease: [0.22, 1, 0.36, 1] } }}
                                                                    onClick={() => handleReact(message, emoji)}
                                                                    aria-label={REACTION_LABELS[emoji]}
                                                                    className="group relative flex items-center justify-center cursor-pointer rounded-full px-1 py-1 text-[26px] leading-none"
                                                                >
                                                                    <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/85 px-1.5 py-0.5 text-[10px] font-semibold text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:bg-white dark:text-black">
                                                                        {REACTION_LABELS[emoji]}
                                                                    </span>
                                                                    {emoji}
                                                                </motion.button>
                                                            ))}
                                                        </motion.div>
                                                    )}
                                                    </AnimatePresence>
                                                </div>
                                            </div>
                                            )}
                                            <div className={`flex flex-col ${message.is_from_user ? 'items-start' : 'items-end'}`}>
                                            <div
                                                id={`msg-${message.id}`}
                                                className={`px-3 pt-2 flex flex-col relative ${message.reactions && message.reactions.length ? 'pb-4 mb-2.5' : 'pb-1'} ${message.is_from_user
                                                    ? `rounded-xl rounded-bl-sm bg-white dark:bg-neutral-800 text-[#1a1c1c] dark:text-neutral-200 shadow-sm ${isFirstOfGroup ? 'bubble-tail-in rounded-tl-none' : ''}`
                                                    : `rounded-xl rounded-br-sm bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111b21] dark:text-[#e9edef] shadow-sm ${isFirstOfGroup ? 'bubble-tail-out rounded-tr-none' : ''}`
                                                    }`}
                                            >
                                                {/* Reply quote bubble */}
                                                {message.reply_to && (
                                                    <div
                                                        className={`mb-2 px-3 py-2 rounded-lg border-l-3 cursor-pointer transition-colors text-xs ${message.is_from_user
                                                            ? 'bg-[#f0f0f0] dark:bg-neutral-700 border-[#06cf9c] hover:bg-[#e5e5e5] dark:hover:bg-neutral-600'
                                                            : 'bg-[#c5efc0] dark:bg-[#025144] border-[#06cf9c] hover:bg-[#b5dfb0] dark:hover:bg-[#024a3d]'
                                                        }`}
                                                        onClick={() => {
                                                            const el = document.getElementById(`msg-${message.reply_to!.id}`);
                                                            if (el) {
                                                                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                el.classList.add('ring-2', 'ring-[#06cf9c]/50');
                                                                setTimeout(() => el.classList.remove('ring-2', 'ring-[#06cf9c]/50'), 2000);
                                                            }
                                                        }}
                                                    >
                                                        <p className="font-bold text-[#06cf9c] mb-0.5">
                                                            {message.reply_to.is_from_user ? (selectedConversation?.contact_name || 'Cliente') : (message.reply_to.sender?.name || 'Asesor')}
                                                        </p>
                                                        <p className={`truncate max-w-[250px] ${message.is_from_user ? 'text-[#667781] dark:text-neutral-400' : 'text-[#557d6b] dark:text-white/55'}`}>
                                                            {message.reply_to.message_type === 'image' ? '📷 Foto'
                                                                : message.reply_to.message_type === 'video' ? '🎥 Video'
                                                                : message.reply_to.message_type === 'audio' ? '🎵 Audio'
                                                                : message.reply_to.message_type === 'document' ? '📎 Documento'
                                                                : message.reply_to.content || ''}
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Remitente (si es asesor) */}
                                                {!message.is_from_user && message.sender && (
                                                    <p className="text-[11px] font-bold text-[#1f7aad] dark:text-[#53bdeb] tracking-wide mb-1 flex items-center gap-1">
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
                                                                    caption: message.content !== 'Imagen' ? message.content : undefined,
                                                                    id: message.id
                                                                });
                                                                setZoomLevel(1);
                                                            }}
                                                        >
                                                            <ChatImage
                                                                layoutId={`media-${message.id}`}
                                                                src={message.media_url}
                                                                alt={message.content}
                                                                className="max-w-full max-h-96 rounded-xl object-cover"
                                                            />
                                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 flex items-center justify-center">
                                                                <Expand className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 drop-shadow-lg" />
                                                            </div>
                                                        </div>
                                                        {message.content && message.content !== 'Imagen' && (
                                                            <p className="text-sm whitespace-pre-wrap break-words">
                                                                {renderRichText(message.content)}
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
                                                                {renderRichText(message.content)}
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
                                                        <ChatImage
                                                            src={message.media_url}
                                                            alt="Sticker"
                                                            className="w-32 h-32 object-contain"
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
                                                    <p className="text-[15px] leading-snug whitespace-pre-wrap break-words inline-block relative">
                                                        {renderRichText(message.content)}
                                                    </p>
                                                )}

                                                {/* Hora y Estado - dentro de la burbuja */}
                                                <div className={`flex items-center gap-1 justify-end mt-1 -mb-0.5 ${message.is_from_user ? '' : ''}`}>
                                                    <span title={formatFullDateTime(message.created_at)} className={`text-[10px] ${message.is_from_user ? 'text-[#667781] dark:text-neutral-500' : 'text-[#557d6b] dark:text-white/55'}`}>{formatTime(message.created_at)}</span>
                                                    {!message.is_from_user && getStatusIcon(message.status, message.error_message)}
                                                </div>
                                                {message.reactions && message.reactions.length > 0 && (
                                                    <div className="absolute left-2 -bottom-2.5 z-10 flex gap-1">
                                                        {message.reactions.map(r => (
                                                            <span
                                                                key={`${r.from_user}-${r.id}-${r.emoji}`}
                                                                className="inline-flex items-center rounded-full bg-white dark:bg-neutral-800 px-1.5 py-0.5 text-[13px] leading-none shadow-md ring-1 ring-black/5 dark:ring-white/10"
                                                                title={r.from_user ? (selectedConversation?.contact_name || 'Cliente') : 'Asesor'}
                                                            >
                                                                {r.emoji}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            </div>
                                          </div>
                                        </div>
                                            </div>
                                        );
                                    })}

                                    {/* Mensajes optimistas (enviándose) */}
                                    {optimisticMessages.map((message) => (
                                        <div
                                            key={message.tempId}
                                            className="flex justify-end"
                                        >
                                          <motion.div
                                            initial={{ opacity: 0, scale: 0.8, y: 14 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            transition={{ type: 'spring', stiffness: 500, damping: 28, mass: 0.8 }}
                                            style={{ transformOrigin: 'bottom right' }}
                                            className="flex flex-col items-end max-w-[85%] md:max-w-[56%]">
                                            <div
                                                className={`px-3 pt-2 pb-1 flex flex-col relative rounded-xl rounded-br-sm ${message.status === 'error'
                                                    ? 'bg-red-500 text-white shadow-md'
                                                    : 'bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111b21] dark:text-[#e9edef] shadow-sm opacity-70'
                                                    }`}
                                            >
                                                {/* Remitente */}
                                                {message.sender && (
                                                    <p className="text-[11px] font-bold text-[#1f7aad] dark:text-[#53bdeb] mb-1">
                                                        {message.sender.name}
                                                    </p>
                                                )}

                                                {/* Contenido */}
                                                <p className="text-[15px] leading-snug whitespace-pre-wrap break-words">
                                                    {message.content}
                                                </p>

                                                {/* Estado del mensaje - dentro de la burbuja */}
                                                <div className="flex items-center gap-1 justify-end mt-1 -mb-0.5">
                                                    <span title={formatFullDateTime(message.created_at)} className={`text-[10px] ${message.status === 'error' ? 'text-white/70' : 'text-[#557d6b] dark:text-white/55'}`}>{formatTime(message.created_at)}</span>
                                                    {message.status === 'sending' ? (
                                                        <Clock className="w-3 h-3 text-[#667781] animate-pulse" />
                                                    ) : message.message_type === 'text' ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                // Reintentar: devolver el texto al composer para reenviarlo
                                                                // (no tocamos el flujo de envío; el asesor presiona Enviar).
                                                                if (textareaRef.current) {
                                                                    textareaRef.current.value = message.content;
                                                                    handleMessageChange(message.content);
                                                                    textareaRef.current.focus();
                                                                }
                                                                setOptimisticMessages(prev => prev.filter(m => m.tempId !== message.tempId));
                                                            }}
                                                            aria-label="Reintentar envío"
                                                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-white/90 hover:text-white underline-offset-2 hover:underline"
                                                        >
                                                            <RotateCcw className="w-3 h-3" /> Error · Reintentar
                                                        </button>
                                                    ) : (
                                                        <span className="text-[10px] font-semibold text-white/90">Error al enviar</span>
                                                    )}
                                                </div>
                                            </div>
                                          </motion.div>
                                        </div>
                                    ))}

                                    {/* Indicador de "escribiendo..." (estilo WhatsApp, animado, dentro del hilo) */}
                                    <AnimatePresence>
                                        {typingUsers.length > 0 && (
                                            <motion.div
                                                key="typing-indicator"
                                                initial={{ opacity: 0, y: 8, scale: 0.9 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: 8, scale: 0.9 }}
                                                transition={{ duration: 0.18 }}
                                                className="flex justify-start"
                                            >
                                                <div className="bg-white dark:bg-[#202c33] shadow-sm rounded-xl rounded-bl-sm px-3.5 py-2.5">
                                                    <p className="text-[11px] font-semibold text-[#1f7aad] dark:text-[#53bdeb] mb-1">
                                                        {typingUsers.length === 1
                                                            ? `${typingUsers[0].name} está escribiendo`
                                                            : `${typingUsers.map(u => u.name).join(', ')} están escribiendo`}
                                                    </p>
                                                    <div className="flex items-center gap-1">
                                                        <span className="w-2 h-2 bg-gray-400 dark:bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                        <span className="w-2 h-2 bg-gray-400 dark:bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                        <span className="w-2 h-2 bg-gray-400 dark:bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <div ref={messagesEndRef} />
                                </div>
                            )}

                            {/* Botón flotante para ir al final + indicador de nuevos mensajes */}
                            <button
                                onClick={() => scrollToBottom()}
                                aria-label="Ir al último mensaje"
                                className={`sticky bottom-4 left-full -translate-x-8 flex items-center gap-2 bg-white dark:bg-neutral-800 text-[#2e3f84] dark:text-neutral-300 px-3 py-2 rounded-full shadow-lg hover:shadow-xl active:scale-95 z-10 transition-all duration-300 ${isAtBottom
                                    ? 'opacity-0 translate-y-4 pointer-events-none'
                                    : 'opacity-100 translate-y-0'
                                    }`}
                            >
                                {newMessagesCount > 0 && (
                                    <motion.span
                                        key={newMessagesCount}
                                        initial={{ scale: 1.4 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                                        className="bg-gradient-to-b from-[#22c55e] to-[#16a34a] text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center"
                                    >
                                        {newMessagesCount > 99 ? '99+' : newMessagesCount}
                                    </motion.span>
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
                        {/* (El indicador de "escribiendo" ahora se muestra animado dentro del hilo de mensajes) */}
                        {selectedConversation.is_blocked ? (
                            <div className="px-3 md:px-6 py-4 bg-red-50/80 dark:bg-red-950/20 backdrop-blur-md border-t border-red-200 dark:border-red-800/30">
                                <div className="flex items-center justify-center gap-3">
                                    <ShieldBan className="w-5 h-5 text-red-500" />
                                    <span className="text-sm font-medium text-red-600 dark:text-red-400">Este contacto está bloqueado</span>
                                    <button
                                        onClick={() => {
                                            csrfPost(`/admin/chat/${selectedConversation.id}/block`).then(res => res.data).then(data => {
                                                if (data.success) {
                                                    setLocalConversations(prev => prev.map(c =>
                                                        c.id === selectedConversation.id ? { ...c, is_blocked: data.is_blocked } : c
                                                    ));
                                                    router.reload({ only: ['selectedConversation'] });
                                                    if (data.meta_synced === false) {
                                                        toast.warning(`Desbloqueado localmente, pero WhatsApp no lo confirmó: ${data.meta_error ?? 'sin detalle'}`);
                                                    } else {
                                                        toast.success('Contacto desbloqueado');
                                                    }
                                                }
                                            }).catch(() => {
                                                toast.error('Error al desbloquear');
                                            });
                                        }}
                                        className="px-3 py-1 text-xs font-medium bg-white dark:bg-neutral-800 border border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                    >
                                        Desbloquear
                                    </button>
                                </div>
                            </div>
                        ) : (
                        <form onSubmit={handleSubmit} className="px-3 md:px-6 py-3 md:py-4 bg-[#f0f2f5] dark:bg-[hsl(30,4%,10%)]">
                            {/* Reply preview bar */}
                            {replyingTo && (
                                <div className="mb-2 flex items-center gap-3 px-4 py-2.5 bg-muted dark:bg-neutral-800 rounded-xl border-l-3 border-[#06cf9c]">
                                    <Reply className="w-4 h-4 text-[#06cf9c] flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-[#06cf9c]">
                                            {replyingTo.is_from_user ? (selectedConversation?.contact_name || 'Cliente') : (replyingTo.sender?.name || 'Tú')}
                                        </p>
                                        <p className="text-xs text-[#667781] dark:text-neutral-400 truncate">
                                            {replyingTo.message_type === 'image' ? '📷 Foto'
                                                : replyingTo.message_type === 'video' ? '🎥 Video'
                                                : replyingTo.message_type === 'audio' ? '🎵 Audio'
                                                : replyingTo.message_type === 'document' ? '📎 Documento'
                                                : replyingTo.content || ''}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setReplyingTo(null)}
                                        className="p-1 rounded-full hover:bg-background dark:hover:bg-neutral-700 text-[#667781] dark:text-neutral-400 transition-colors flex-shrink-0"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            )}

                            {/* Preview del archivo seleccionado */}
                            {selectedFile && (
                                <div className="mb-2 flex items-center gap-2 p-2 bg-[#dee1ff]/40 dark:bg-blue-900/20 rounded-lg">
                                    <Paperclip className="w-4 h-4 text-[#2e3f84] dark:text-neutral-300" />
                                    <span className="text-sm text-[#2e3f84] dark:text-neutral-300 flex-1 truncate">{selectedFile.name}</span>
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

                                <div className="relative flex-1 flex items-end bg-white dark:bg-[hsl(30,4%,18%)] ring-1 ring-black/5 dark:ring-white/[0.04] rounded-full focus-within:ring-2 focus-within:ring-[#2e3f84]/30 transition-all duration-200 overflow-visible">

                                    {/* Botón de emojis (primero, como WhatsApp) */}
                                    <div className="relative flex-shrink-0 self-end">
                                        <button
                                            type="button"
                                            aria-label="Insertar emoji"
                                            title="Emoji"
                                            onClick={() => setShowEmojiPicker(v => !v)}
                                            className="h-[44px] w-12 p-0 rounded-l-full text-[#767681] hover:text-[#2e3f84] dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors flex items-center justify-center"
                                        >
                                            <Smile className="w-[22px] h-[22px]" />
                                        </button>
                                        {showEmojiPicker && (
                                            <div className="fixed inset-0 z-40" onClick={() => setShowEmojiPicker(false)} />
                                        )}
                                        <AnimatePresence>
                                            {showEmojiPicker && (
                                                <motion.div
                                                    key="emoji-pop"
                                                    initial={{ opacity: 0, scale: 0.9, y: 8 }}
                                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.9, y: 8 }}
                                                    transition={{ duration: 0.14 }}
                                                    className="absolute bottom-full left-0 mb-2 z-50 grid grid-cols-6 gap-1 p-2 rounded-2xl bg-white dark:bg-neutral-800 border border-[#e9edef] dark:border-neutral-700 shadow-xl w-[252px]"
                                                >
                                                    {COMPOSER_EMOJIS.map((emoji) => (
                                                        <button
                                                            key={emoji}
                                                            type="button"
                                                            aria-label={`Insertar ${emoji}`}
                                                            onClick={() => insertEmoji(emoji)}
                                                            className="text-[22px] leading-none rounded-lg p-1 hover:bg-muted dark:hover:bg-neutral-700 transition-colors"
                                                        >
                                                            {emoji}
                                                        </button>
                                                    ))}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    {/* Botón de adjuntar */}
                                    <button
                                        type="button"
                                        aria-label="Adjuntar archivo"
                                        className="flex-shrink-0 h-[44px] w-10 p-0 self-end text-[#767681] hover:text-[#2e3f84] dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors flex items-center justify-center"
                                        onClick={() => fileInputRef.current?.click()}
                                        title="Adjuntar archivo"
                                    >
                                        <Paperclip className="w-[22px] h-[22px]" />
                                    </button>

                                    {/* Botón enviar plantilla WhatsApp */}
                                    <button
                                        type="button"
                                        className="flex-shrink-0 h-[44px] w-10 p-0 self-end text-[#767681] hover:text-[#2e3f84] dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors flex items-center justify-center"
                                        onClick={() => setShowWaTemplateModal(true)}
                                        title="Enviar plantilla de WhatsApp"
                                    >
                                        <FileText className="w-[20px] h-[20px]" />
                                    </button>

                                    {/* Campo de texto */}
                                    <div className="relative flex-1">
                                        <Textarea
                                            ref={textareaRef}
                                            defaultValue=""
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
                                                            const currentContent = inputValueRef.current;
                                                            const undone = currentContent.replace(lastCorrection.corrected, lastCorrection.original);
                                                            inputValueRef.current = undone;
                                                            if (textareaRef.current) textareaRef.current.value = undone;
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
                                    disabled={(!hasInputText && !selectedFile) || processing || isSubmitting}
                                    aria-label="Enviar mensaje"
                                    className="flex-shrink-0 bg-gradient-to-br from-[#2e3f84] to-[#2e3a75] hover:from-[#1a2a6e] hover:to-[#364588] text-white w-12 h-12 md:w-[50px] md:h-[50px] rounded-full shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:scale-90 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed p-0 flex items-center justify-center"
                                >
                                    {(processing || isSubmitting) ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <Send className="w-5 h-5 ml-[2px]" />
                                    )}
                                </button>
                            </div>
                            <p className="hidden md:block text-xs text-[#767681] mt-2">
                                {t('conversations.sendHint')}
                            </p>
                        </form>
                        )}
                        </>
                        )}
                    </div>

                    {/* ===== Panel derecho de detalles (fijo en escritorio, overlay en móvil) ===== */}
                    {showDetails && (
                        <>
                            <div className="md:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setShowDetails(false)} />
                            <aside className="fixed inset-y-0 right-0 z-50 w-[88%] max-w-sm md:static md:z-auto md:w-[290px] md:max-w-none flex-shrink-0 flex flex-col border-l border-border bg-card dark:bg-neutral-900 overflow-y-auto custom-scrollbar">
                                {/* Encabezado del panel (cerrar en móvil) */}
                                <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border">
                                    <span className="font-semibold text-sm text-[#2e3f84] dark:text-neutral-200">Detalles</span>
                                    <button onClick={() => setShowDetails(false)} aria-label="Cerrar detalles" className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted dark:hover:bg-neutral-800">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Contacto */}
                                <div className="flex flex-col items-center gap-2 px-4 py-5 border-b border-border">
                                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#2e3f84] to-[#2e3a75] flex items-center justify-center text-white text-xl font-bold">
                                        {[...(selectedConversation.contact_name || '')][0]?.toUpperCase() || '?'}
                                    </div>
                                    <h3 className="font-bold text-[#1a1c1c] dark:text-neutral-200 text-base text-center">{selectedConversation.contact_name || 'Sin nombre'}</h3>
                                    <div className="flex items-center gap-1.5 text-sm text-[#5f5e5e] dark:text-neutral-400"><Phone className="w-3.5 h-3.5" />{selectedConversation.phone_number}</div>
                                    <span className="inline-flex items-center gap-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-[11px] font-medium px-2.5 py-1 rounded-full">WhatsApp</span>
                                </div>

                                {/* Estado y asignación */}
                                <div className="px-4 py-3 border-b border-border space-y-2">
                                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Estado y asignación</p>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="flex items-center gap-2 min-w-0">
                                            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${getStatusColor(selectedConversation.status, selectedConversation.is_blocked)}`} />
                                            <span className="text-sm font-medium text-foreground truncate">{getStatusLabel(selectedConversation.status, selectedConversation.is_blocked)}</span>
                                        </span>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button className="text-xs text-[#2e3f84] dark:text-blue-400 hover:underline flex items-center gap-0.5 flex-shrink-0">Cambiar <ChevronDown className="w-3.5 h-3.5" /></button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-52 bg-card">
                                                {selectedConversation.status !== 'active' && (
                                                    <DropdownMenuItem onClick={() => handleStatusChange('active')} className="cursor-pointer hover:bg-accent text-blue-600"><Check className="w-4 h-4 mr-2" /> Marcar como Activo</DropdownMenuItem>
                                                )}
                                                {selectedConversation.status !== 'pending' && (
                                                    <DropdownMenuItem onClick={() => handleStatusChange('pending')} className="cursor-pointer hover:bg-accent text-yellow-600"><Clock className="w-4 h-4 mr-2" /> Marcar como Pendiente</DropdownMenuItem>
                                                )}
                                                {selectedConversation.status !== 'resolved' && (
                                                    <DropdownMenuItem onClick={() => handleStatusChange('resolved')} className="cursor-pointer hover:bg-accent text-green-600"><CheckCheck className="w-4 h-4 mr-2" /> {t('conversations.markAsResolved')}</DropdownMenuItem>
                                                )}
                                                {selectedConversation.status !== 'scheduled' && (
                                                    <DropdownMenuItem onClick={() => handleStatusChange('scheduled')} className="cursor-pointer hover:bg-accent text-indigo-600"><CalendarCheck className="w-4 h-4 mr-2" /> Marcar como Agendado</DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-sm text-[#5f5e5e] dark:text-neutral-400 flex items-center gap-1.5 min-w-0">
                                            <User className="w-3.5 h-3.5 flex-shrink-0" />
                                            <span className="truncate">{selectedConversation.assigned_user?.name || 'Sin asignar'}</span>
                                        </span>
                                        {isAdmin && (
                                            <button onClick={() => setShowAssignModal(true)} className="text-xs text-[#2e3f84] dark:text-blue-400 hover:underline flex-shrink-0">Reasignar</button>
                                        )}
                                    </div>
                                </div>

                                {/* Etiquetas (gestión completa: ver, quitar, agregar, crear) */}
                                <div className="px-4 py-3 border-b border-border">
                                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1"><Tag className="w-3 h-3" /> Etiquetas</p>
                                    {selectedConvTags.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mb-2">
                                            {selectedConvTags.map(tag => (
                                                <span key={tag.id} onClick={() => detachTag(selectedConversation.id, tag.id)} title={`Quitar "${tag.name}"`} className="inline-flex items-center gap-1 text-[11px] text-white px-2 py-0.5 rounded-full cursor-pointer hover:opacity-80" style={{ backgroundColor: tag.color }}>
                                                    {tag.name}<X className="w-3 h-3" />
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    {allTags.filter(t => !selectedConvTags.some(ct => ct.id === t.id)).length > 0 && (
                                        <>
                                            <input type="text" value={tagSearch} onChange={(e) => setTagSearch(e.target.value)} placeholder="Buscar etiqueta..." className="w-full px-2 py-1 text-xs border border-border rounded-lg focus:outline-none focus:border-primary bg-muted mb-1" />
                                            <div className="max-h-[120px] overflow-y-auto custom-scrollbar">
                                                {allTags.filter(t => !selectedConvTags.some(ct => ct.id === t.id)).filter(t => !tagSearch || t.name.toLowerCase().includes(tagSearch.toLowerCase())).map(tag => (
                                                    <button key={tag.id} onClick={() => attachTag(selectedConversation.id, tag.id)} className="w-full px-1 py-1.5 text-left text-sm hover:bg-accent rounded-lg flex items-center gap-2">
                                                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                                                        <span className="truncate">{tag.name}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                    {!showTagSubmenu ? (
                                        <button onClick={() => setShowTagSubmenu(true)} className="w-full px-1 py-1.5 mt-1 text-left text-sm hover:bg-accent rounded-lg text-primary flex items-center gap-2"><Plus className="w-3.5 h-3.5" /> Nueva etiqueta...</button>
                                    ) : (
                                        <div className="py-2 space-y-2">
                                            <input type="text" value={newTagName} autoFocus onChange={(e) => setNewTagName(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && newTagName.trim()) { createTag(newTagName.trim(), newTagColor).then((tag) => { if (tag) { attachTag(selectedConversation.id, tag.id); setNewTagName(''); setShowTagSubmenu(false); } }); }
                                                    if (e.key === 'Escape') { setShowTagSubmenu(false); setNewTagName(''); }
                                                }}
                                                placeholder="Nombre de etiqueta" className="w-full px-2 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:border-primary bg-muted" />
                                            <div className="flex gap-1 flex-wrap">
                                                {TAG_COLORS.map((c) => (
                                                    <button key={c} onClick={() => setNewTagColor(c)} className={`w-5 h-5 rounded-full flex-shrink-0 ${newTagColor === c ? 'ring-2 ring-offset-1 ring-primary' : ''}`} style={{ backgroundColor: c }} />
                                                ))}
                                            </div>
                                            <div className="flex gap-1">
                                                <button onClick={() => { if (newTagName.trim()) { createTag(newTagName.trim(), newTagColor).then((tag) => { if (tag) { attachTag(selectedConversation.id, tag.id); setNewTagName(''); setShowTagSubmenu(false); } }); } }} className="flex-1 px-2 py-1.5 text-xs bg-primary text-white rounded-lg">Crear</button>
                                                <button onClick={() => { setShowTagSubmenu(false); setNewTagName(''); }} className="px-3 py-1.5 text-xs border border-border rounded-lg">Cancelar</button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Especialidad (editable) */}
                                <div className="px-4 py-3 border-b border-border">
                                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-2">Especialidad</p>
                                    {showSpecialtyInput ? (
                                        <input
                                            type="text"
                                            value={specialtyName}
                                            autoFocus
                                            onChange={(e) => setSpecialtyName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    const name = specialtyName.trim();
                                                    csrfPost(`/admin/chat/${selectedConversation.id}/specialty`, { specialty: name }).then(() => {
                                                        setLocalConversations(prev => prev.map(c => c.id === selectedConversation.id ? { ...c, specialty: name } : c));
                                                        router.reload({ only: ['selectedConversation'] });
                                                        toast.success(name ? `Especialidad "${name}" guardada` : 'Especialidad quitada');
                                                    }).catch(() => toast.error('Error al guardar la especialidad'));
                                                    setShowSpecialtyInput(false);
                                                }
                                                if (e.key === 'Escape') { setShowSpecialtyInput(false); }
                                            }}
                                            placeholder="Especialidad (Enter para guardar)"
                                            className="w-full px-2 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:border-primary bg-muted"
                                        />
                                    ) : (
                                        <button onClick={() => { setSpecialtyName(selectedConversation.specialty || ''); setShowSpecialtyInput(true); }} className="w-full flex items-center justify-between gap-2 text-sm text-foreground hover:bg-muted/40 rounded-lg px-1 py-1 transition-colors">
                                            <span className="flex items-center gap-2 min-w-0">
                                                <Stethoscope className="w-4 h-4 text-teal-600 dark:text-teal-400 flex-shrink-0" />
                                                <span className="truncate">{selectedConversation.specialty || 'Sin especialidad'}</span>
                                            </span>
                                            <Pencil className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                        </button>
                                    )}
                                </div>

                                {/* Datos del paciente (colapsable) */}
                                {selectedConversation.welcome_flow_data && Object.keys(selectedConversation.welcome_flow_data).filter(k => !k.startsWith('_')).length > 0 && (
                                    <div className="border-b border-border">
                                        <button onClick={() => setShowPatientData(!showPatientData)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors">
                                            <span className="flex items-center gap-2 text-sm font-medium text-foreground"><ClipboardList className="w-4 h-4 text-primary" /> Datos del paciente</span>
                                            {showPatientData ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                                        </button>
                                        {showPatientData && (
                                            <div className="px-4 pb-3 grid grid-cols-2 gap-x-3 gap-y-2">
                                                {Object.entries(selectedConversation.welcome_flow_data).filter(([key]) => !key.startsWith('_')).map(([key, value]) => (
                                                    <div key={key} className="min-w-0">
                                                        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{flowFieldNames[key] || key}</span>
                                                        <p className="text-sm text-foreground font-medium truncate" title={getFlowDataLabel(key, value)}>{getFlowDataLabel(key, value)}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Notas internas (colapsable) */}
                                <div className="border-b border-border">
                                    <button onClick={() => setShowNotes(!showNotes)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors">
                                        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                                            <StickyNote className="w-4 h-4 text-amber-600 dark:text-amber-400" /> Notas internas
                                            {selectedConversation.notes && !showNotes && <span className="w-2 h-2 bg-amber-400 rounded-full" />}
                                        </span>
                                        {showNotes ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                                    </button>
                                    {showNotes && (
                                        <div className="px-4 pb-3">
                                            <textarea
                                                value={notesText}
                                                onChange={(e) => handleSaveNotes(e.target.value)}
                                                placeholder="Notas internas (solo visible para asesores)..."
                                                className="w-full min-h-[80px] max-h-[160px] resize-y rounded-lg border border-amber-200 dark:border-amber-800/30 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                                            />
                                            {savingNotes && <span className="text-xs text-muted-foreground">Guardando...</span>}
                                        </div>
                                    )}
                                </div>

                                {/* Historial de actividad (colapsable) */}
                                <div className="border-b border-border">
                                    <button onClick={toggleActivityPanel} className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors">
                                        <span className="flex items-center gap-2 text-sm font-medium text-foreground"><History className="w-4 h-4 text-slate-600 dark:text-slate-400" /> Historial de actividad</span>
                                        {showActivity ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                                    </button>
                                    {showActivity && (
                                        <div className="px-4 pb-3 max-h-[260px] overflow-y-auto custom-scrollbar">
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
                                                                <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(act.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Acciones */}
                                <div className="px-4 py-3">
                                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1.5">Acciones</p>
                                    <button
                                        onClick={() => handleTogglePin(selectedConversation.id)}
                                        className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
                                    >
                                        <Pin className={`w-4 h-4 ${selectedConversation.is_pinned ? 'text-primary rotate-45' : 'text-muted-foreground'}`} /> {selectedConversation.is_pinned ? 'Desfijar chat' : 'Fijar chat'}
                                    </button>
                                    <button
                                        onClick={() => {
                                            csrfPost(`/admin/chat/${selectedConversation.id}/block`).then(res => res.data).then(data => {
                                                if (data.success) {
                                                    setLocalConversations(prev => prev.map(c => c.id === selectedConversation.id ? { ...c, is_blocked: data.is_blocked } : c));
                                                    router.reload({ only: ['selectedConversation'] });
                                                    if (data.meta_synced === false) {
                                                        toast.warning(`${data.is_blocked ? 'Bloqueado' : 'Desbloqueado'} localmente, pero WhatsApp no lo confirmó: ${data.meta_error ?? 'sin detalle'}`);
                                                    } else {
                                                        toast.success(data.is_blocked ? 'Contacto bloqueado' : 'Contacto desbloqueado');
                                                    }
                                                }
                                            }).catch(() => toast.error('Error al cambiar estado de bloqueo'));
                                        }}
                                        className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-colors ${selectedConversation.is_blocked ? 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20' : 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'}`}
                                    >
                                        <ShieldBan className="w-4 h-4" /> {selectedConversation.is_blocked ? 'Desbloquear' : 'Bloquear'}
                                    </button>
                                    {isAdmin && (
                                        <button onClick={() => window.open(`/admin/chat/${selectedConversation.id}/export-pdf`, '_blank')} className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-[#2e3f84] dark:text-neutral-300 hover:bg-muted transition-colors">
                                            <Download className="w-4 h-4" /> Exportar a PDF
                                        </button>
                                    )}
                                    {isAdmin && (
                                        <button onClick={handleHideChat} className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                            <Trash2 className="w-4 h-4" /> {t('conversations.deleteChat')}
                                        </button>
                                    )}
                                </div>
                            </aside>
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
                            <WaTemplateSelect
                                templates={whatsappTemplates}
                                value={waTemplateId}
                                onChange={(templateId) => {
                                    const selectedTpl = whatsappTemplates.find(t => t.id === templateId);
                                    setWaTemplateId(templateId);
                                    setWaTemplateParams(selectedTpl ? Array(getTemplateParamCount(selectedTpl)).fill('') : []);
                                }}
                            />
                            {whatsappTemplates.length === 0 && (
                                <p className="text-xs text-amber-600 dark:text-amber-400">
                                    No hay plantillas aprobadas. Créelas desde Envíos Masivos.
                                </p>
                            )}
                            {(() => {
                                const sel = whatsappTemplates.find(t => t.id === waTemplateId);
                                if (sel?.category === 'MARKETING') return (
                                    <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg">
                                        ⚠️ Esta plantilla es de tipo <strong>Marketing</strong>. Meta puede bloquear su entrega a usuarios que no han interactuado antes o que alcanzaron su límite de marketing. Use plantillas de <strong>Utilidad</strong> para mayor confiabilidad.
                                    </p>
                                );
                                return null;
                            })()}
                        </div>

                        {/* Parámetros */}
                        {(() => {
                            const selectedTpl = whatsappTemplates.find(t => t.id === waTemplateId);
                            const paramCount = selectedTpl ? getTemplateParamCount(selectedTpl) : 0;
                            if (!selectedTpl || paramCount === 0) return null;
                            return (
                                <div className="space-y-3">
                                    <label className="text-sm font-semibold text-primary dark:text-[hsl(231,15%,92%)]">
                                        Variables de la plantilla
                                    </label>
                                    {Array.from({ length: paramCount }).map((_, idx) => (
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
                                            {selectedTpl.header_format === 'DOCUMENT' && selectedTpl.header_media_url && (
                                                <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200/60 dark:border-blue-800/40">
                                                    <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                                                    <span className="text-xs font-medium text-blue-700 dark:text-blue-300">📎 {selectedTpl.header_media_url.split('/').pop()}</span>
                                                </div>
                                            )}
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
                                    const response = await csrfPost(`/admin/chat/${selectedConversation.id}/send-template`, {
                                        whatsapp_template_id: waTemplateId,
                                        template_params: waTemplateParams,
                                    });
                                    const result = response.data;
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
                <DialogContent className="sm:max-w-lg card-gradient border-0 shadow-[0_4px_12px_rgba(46,63,132,0.15),0_8px_24px_rgba(46,63,132,0.2)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.3),0_8px_24px_rgba(0,0,0,0.4)] max-h-[85vh] flex flex-col">
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
                        // Crear con fetch (NO Inertia): no navega ni recarga la lista, así el asesor
                        // NO pierde su posición/scroll. La conversación nueva aparece sola por el polling.
                        csrfPost('/admin/chat/create', {
                            phone_number: newChatData.phone_number,
                            assigned_to: newChatData.assigned_to,
                            whatsapp_template_id: newChatData.whatsapp_template_id,
                            template_params: newChatData.template_params,
                        }).then((res) => {
                            const data = res.data || {};
                            if (res.status >= 200 && res.status < 300 && data.success) {
                                setShowNewChatModal(false);
                                setNewChatData({ phone_number: '', assigned_to: null, whatsapp_template_id: null, template_params: [] });
                                toast.success('Conversación creada exitosamente');
                            } else {
                                setNewChatError(data.message || 'Error al crear la conversación');
                            }
                            setIsCreatingChat(false);
                        }).catch(() => {
                            setNewChatError('Error al crear la conversación');
                            setIsCreatingChat(false);
                        });
                    }} className="space-y-4 py-4 overflow-y-auto custom-scrollbar flex-1 min-h-0">
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
                            <WaTemplateSelect
                                templates={whatsappTemplates}
                                value={newChatData.whatsapp_template_id}
                                onChange={(templateId) => {
                                    const selectedTpl = whatsappTemplates.find(t => t.id === templateId);
                                    setNewChatData({
                                        ...newChatData,
                                        whatsapp_template_id: templateId,
                                        template_params: selectedTpl ? Array(getTemplateParamCount(selectedTpl)).fill('') : [],
                                    });
                                }}
                            />
                            {whatsappTemplates.length === 0 && (
                                <p className="text-xs text-amber-600 dark:text-amber-400">
                                    No hay plantillas aprobadas disponibles. Cree y apruebe plantillas desde Envíos Masivos.
                                </p>
                            )}
                            {(() => {
                                const sel = whatsappTemplates.find(t => t.id === newChatData.whatsapp_template_id);
                                if (sel?.category === 'MARKETING') return (
                                    <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg">
                                        ⚠️ Esta plantilla es de tipo <strong>Marketing</strong>. Meta puede bloquear su entrega a usuarios que no han interactuado antes o que alcanzaron su límite de marketing. Use plantillas de <strong>Utilidad</strong> para mayor confiabilidad.
                                    </p>
                                );
                                return null;
                            })()}
                        </div>

                        {/* Template params */}
                        {(() => {
                            const selectedTpl = whatsappTemplates.find(t => t.id === newChatData.whatsapp_template_id);
                            const paramCount = selectedTpl ? getTemplateParamCount(selectedTpl) : 0;
                            if (!selectedTpl || paramCount === 0) return null;
                            return (
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-primary dark:text-[hsl(231,15%,92%)]">
                                        Parámetros de la plantilla
                                    </label>
                                    {Array.from({ length: paramCount }).map((_, idx) => (
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
                            <Select
                                value={newChatData.assigned_to ? String(newChatData.assigned_to) : '__self__'}
                                onValueChange={(v) => setNewChatData({ ...newChatData, assigned_to: v === '__self__' ? null : Number(v) })}
                            >
                                <SelectTrigger className="w-full h-10 settings-input rounded-xl">
                                    <SelectValue placeholder="Yo mismo (Admin)" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border border-[#e9edef] dark:border-neutral-700 max-h-[320px]">
                                    <SelectItem value="__self__" className="rounded-lg cursor-pointer">Yo mismo (Admin)</SelectItem>
                                    {users.filter(user => user.id !== auth.user.id).map((user) => (
                                        <SelectItem key={user.id} value={String(user.id)} className="rounded-lg cursor-pointer">
                                            {user.name} {user.role === 'admin' ? '(Admin)' : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
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
            <AnimatePresence>
            {mediaViewer && (
                <motion.div
                    key="media-viewer"
                    role="dialog"
                    aria-modal="true"
                    aria-label={mediaViewer.caption || 'Visor de medios'}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
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
                            // No cerrar si el clic proviene de un gesto táctil (pinch/pan)
                            if (gestureMovedRef.current) { gestureMovedRef.current = false; return; }
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
                        onTouchMove={(e) => {
                            if (e.touches.length === 2 && pinchRef.current) {
                                // Pinch-zoom con dos dedos
                                gestureMovedRef.current = true;
                                const dx = e.touches[0].clientX - e.touches[1].clientX;
                                const dy = e.touches[0].clientY - e.touches[1].clientY;
                                const dist = Math.hypot(dx, dy);
                                const ratio = dist / pinchRef.current.dist;
                                setZoomLevel(Math.min(4, Math.max(0.5, pinchRef.current.zoom * ratio)));
                            } else if (e.touches.length === 1 && isDragging && zoomLevel > 1) {
                                // Pan con un dedo cuando hay zoom
                                gestureMovedRef.current = true;
                                const t = e.touches[0];
                                const dx = t.clientX - dragStart.x;
                                const dy = t.clientY - dragStart.y;
                                setImagePosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
                                setDragStart({ x: t.clientX, y: t.clientY });
                            }
                        }}
                        onTouchEnd={() => {
                            setIsDragging(false);
                            pinchRef.current = null;
                            // Limpiar el flag tras el posible click sintético, para que el próximo tap sí cierre.
                            setTimeout(() => { gestureMovedRef.current = false; }, 0);
                        }}
                    >
                        {mediaViewer.type === 'image' ? (
                            <motion.div
                                layoutId={mediaViewer.id ? `media-${mediaViewer.id}` : undefined}
                                className="flex items-center justify-center w-full h-full"
                            >
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
                                onTouchStart={(e) => {
                                    e.stopPropagation();
                                    gestureMovedRef.current = false;
                                    if (e.touches.length === 2) {
                                        const dx = e.touches[0].clientX - e.touches[1].clientX;
                                        const dy = e.touches[0].clientY - e.touches[1].clientY;
                                        pinchRef.current = { dist: Math.hypot(dx, dy), zoom: zoomLevel };
                                    } else if (e.touches.length === 1 && zoomLevel > 1) {
                                        setIsDragging(true);
                                        setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
                                    }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                draggable={false}
                            />
                            </motion.div>
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
                </motion.div>
            )}
            </AnimatePresence>

            {/* Menú contextual (clic derecho) sobre un asesor en el filtro.
                Se renderiza con Portal a document.body para que no quede atrapado
                detrás del panel de filtros (problema de z-index/stacking). */}
            {advisorMenu && createPortal(
                <>
                    <div
                        className="fixed inset-0"
                        style={{ zIndex: 2147483646 }}
                        onClick={() => setAdvisorMenu(null)}
                        onContextMenu={(e) => { e.preventDefault(); setAdvisorMenu(null); }}
                    />
                    <div
                        className="fixed w-[232px] overflow-hidden rounded-xl border border-border bg-card py-1.5 shadow-xl dark:bg-neutral-800"
                        style={{ zIndex: 2147483647, top: Math.max(8, Math.min(advisorMenu.y, window.innerHeight - 116)), left: Math.max(8, Math.min(advisorMenu.x, window.innerWidth - 240)) }}
                    >
                        <div className="px-3 pb-1.5 pt-1">
                            <p className="truncate text-xs font-bold text-foreground">{advisorMenu.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                                {advisorMenu.count} {advisorMenu.count === 1 ? 'conversación activa' : 'conversaciones activas'}
                            </p>
                        </div>
                        <div className="border-t border-border" />
                        <button
                            onClick={() => {
                                setAdvisorToClear({ id: advisorMenu.id, name: advisorMenu.name, count: advisorMenu.count });
                                setAdvisorMenu(null);
                            }}
                            disabled={advisorMenu.count === 0}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-300 dark:hover:bg-red-900/20"
                        >
                            <Eraser className="h-4 w-4" />
                            Limpiar
                        </button>
                    </div>
                </>,
                document.body
            )}

            {/* Confirmación de "Limpiar" (acción destructiva, reversible) */}
            <Dialog open={!!advisorToClear} onOpenChange={(open) => !open && setAdvisorToClear(null)}>
                <DialogContent className="card-gradient rounded-2xl border border-white/40 shadow-2xl dark:border-white/10 sm:rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Eraser className="h-5 w-5 text-red-600 dark:text-red-300" />
                            ¿Limpiar las conversaciones de {advisorToClear?.name}?
                        </DialogTitle>
                        <DialogDescription>
                            Se le quitará la asignación a sus <strong>{advisorToClear?.count}</strong> {advisorToClear?.count === 1 ? 'conversación activa' : 'conversaciones activas'}. Quedarán <strong>sin asignar</strong> y volverán al pool compartido de asesores de turno.
                            <span className="mt-2 block text-xs opacity-80">La acción queda registrada y es reversible.</span>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAdvisorToClear(null)} className="rounded-xl">
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleClearAdvisor}
                            disabled={clearingAdvisor}
                            className="rounded-xl border-0 bg-gradient-to-b from-red-500 to-red-600 font-medium text-white shadow-md hover:from-red-600 hover:to-red-700 disabled:opacity-50"
                        >
                            {clearingAdvisor ? 'Limpiando…' : 'Sí, limpiar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AdminLayout>
    );
}
