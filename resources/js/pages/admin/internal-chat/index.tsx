import AdminLayout from '@/layouts/admin-layout';
import { Head } from '@inertiajs/react';
import { useState, useEffect, useRef, useMemo, useCallback, type MouseEvent } from 'react';
import {
    ArrowLeft,
    Check,
    Download,
    Ellipsis,
    Expand,
    Image as ImageIcon,
    Inbox,
    LogOut,
    MessageSquare,
    MessagesSquare,
    Music,
    PanelLeftClose,
    PanelLeftOpen,
    Paperclip,
    Pencil,
    Play,
    Plus,
    Reply,
    RotateCcw,
    Search,
    SearchX,
    Send,
    SmilePlus,
    Trash2,
    UserMinus,
    Users,
    Video,
    X,
    ZoomIn,
    ZoomOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import axios from 'axios';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { toast } from '@/lib/toast';
import { Trans, useTranslation } from 'react-i18next';
import { BOTON_PELIGRO_LLENO, BOTON_PRIMARIO, BOTON_SECUNDARIO, FOCO, TEXTO_NAVY, fechaLarga } from '@/components/appointments/piezas-citas';
import { AYUDA, CAMPO, DialogoPlantilla, ETIQUETA } from '@/components/templates/piezas-plantillas';
import {
    ACENTO,
    AdjuntoDocumento,
    AdjuntoSubiendo,
    ArchivoNoDisponible,
    AvatarGrupo,
    AvatarPersona,
    AyudaTeclas,
    BOTON_ICONO_CHAT,
    Burbuja,
    CajaCitada,
    ConIcono,
    FONDO_CHAT,
    FilaChat,
    FranjaCompositor,
    FranjaInfo,
    GRIS,
    HOJA_CHAT,
    MenuFlotante,
    MetaMensaje,
    NombreAutor,
    OpcionMenu,
    Reacciones,
    SOMBRA_FLOTA,
    Segmentos,
    SeparadorDia,
    SeparadorMenu,
    TINTA,
    Vacio,
    Visto,
    listaNombres,
    nombreCorto,
    nombreVisible,
} from '@/components/internal-chat/piezas-chat';
import { TextoMensaje } from '@/components/internal-chat/texto-mensaje';
import { PanelDetalles, type TextosDetalles } from '@/components/internal-chat/panel-detalles';

// --- Interfaces matching backend API ---

interface UserInfo {
    id: number;
    name: string;
    role: string;
    is_online: boolean;
}

interface LatestMessage {
    body: string;
    type: string;
    user_name: string;
    created_at: string;
}

interface ChatItem {
    id: number;
    name: string;
    type: 'direct' | 'group';
    created_by?: number;
    unread: number;
    participants: UserInfo[];
    latest_message: LatestMessage | null;
}

interface ReplyTo {
    id: number;
    body: string | null;
    type: string;
    file_name: string | null;
    user_name: string;
}

interface MessageItem {
    id: number;
    body: string;
    type: 'text' | 'image' | 'video' | 'audio' | 'document';
    file_url: string | null;
    file_name: string | null;
    file_mime: string | null;
    file_size_human: string | null;
    file_missing?: boolean;
    user: { id: number; name: string };
    is_mine: boolean;
    created_at: string;
    created_at_full: string;
    edited?: boolean;
    reactions?: { emoji: string; count: number; users: string[]; mine: boolean }[];
    reply_to?: ReplyTo | null;
}

interface ReadReceipt {
    user_id: number;
    user_name: string;
    last_read_at: string; // ISO string
}

interface Props {
    auth: { user: { id: number; name: string; role?: string } };
    chats: ChatItem[];
    users: UserInfo[];
}

type ChatFilter = 'all' | 'unread' | 'groups' | 'directs';

export default function InternalChat({ auth, chats: serverChats, users: serverUsers }: Props) {
    const { t, i18n } = useTranslation();
    const [chats, setChats] = useState<ChatItem[]>(serverChats || []);
    const [availableUsers] = useState<UserInfo[]>(serverUsers || []);
    const [activeChat, setActiveChat] = useState<ChatItem | null>(null);
    const [chatContextMenu, setChatContextMenu] = useState<{ chatId: number; x: number; y: number } | null>(null);
    // Menú de un mensaje (clic derecho / mantener pulsado): mismas acciones que la barra al pasar el ratón.
    const [msgMenu, setMsgMenu] = useState<{ msg: MessageItem; x: number; y: number } | null>(null);
    const pulsacionRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Confirmación propia (en lugar de window.confirm): eliminar chat/grupo, salir del grupo, quitar a alguien.
    const [confirmacion, setConfirmacion] = useState<{ tipo: 'chat' | 'grupo' | 'salir' | 'quitar'; chat: ChatItem; persona?: UserInfo } | null>(null);
    const cancelarConfirmRef = useRef<HTMLButtonElement>(null);
    const [activeChatInfo, setActiveChatInfo] = useState<{ name: string; type: string; participants: UserInfo[] } | null>(null);
    const [messages, setMessages] = useState<MessageItem[]>([]);
    const [inputText, setInputText] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [chatFilter, setChatFilter] = useState<ChatFilter>('all');
    const [isUploading, setIsUploading] = useState(false);
    const [isSidebarVisible, setIsSidebarVisible] = useState(true);
    const [replyingTo, setReplyingTo] = useState<MessageItem | null>(null);

    // IA local (LM Studio): indicador "escribiendo…" mientras el chatbot genera su respuesta
    const [aiTyping, setAiTyping] = useState(false);

    // Reacciones (emoji) a mensajes
    const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
    const REACTION_LABELS: Record<string, string> = {
        '👍': t('internalChat.reactionLike'), '❤️': t('internalChat.reactionLove'), '😂': t('internalChat.reactionHaha'),
        '😮': t('internalChat.reactionWow'), '😢': t('internalChat.reactionSad'), '🙏': t('internalChat.reactionThanks'),
    };
    const [reactionPickerFor, setReactionPickerFor] = useState<number | null>(null);
    // El selector de reacciones se cierra al pulsar fuera de él o con Esc. No sirve una capa
    // `fixed inset-0`: la barra que lo contiene lleva `-translate-y-1/2`, y un transform hace de esa
    // barra el contenedor de sus hijos `position: fixed` (la capa solo cubría la barra y el clic fuera
    // no cerraba nada). Esc se atiende en captura y no sigue: si no, además cerraría el chat.
    useEffect(() => {
        if (reactionPickerFor === null) return;
        const alPulsar = (e: PointerEvent) => {
            if ((e.target as HTMLElement | null)?.closest('[data-selector-reacciones]')) return;
            setReactionPickerFor(null);
        };
        const alTeclear = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            e.stopPropagation();
            setReactionPickerFor(null);
        };
        document.addEventListener('pointerdown', alPulsar, true);
        document.addEventListener('keydown', alTeclear, true);
        return () => {
            document.removeEventListener('pointerdown', alPulsar, true);
            document.removeEventListener('keydown', alTeclear, true);
        };
    }, [reactionPickerFor]);

    // Edición de mensajes
    const [editingMessage, setEditingMessage] = useState<MessageItem | null>(null);

    // Read receipts: who has read the chat
    const [readReceipts, setReadReceipts] = useState<ReadReceipt[]>([]);

    // Group creation modal
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);

    // Rename modal
    const [showRenameModal, setShowRenameModal] = useState(false);
    const [renameValue, setRenameValue] = useState('');

    // Participants modal
    const [showParticipantsModal, setShowParticipantsModal] = useState(false);
    const [showAddParticipants, setShowAddParticipants] = useState(false);
    const [addParticipantSearch, setAddParticipantSearch] = useState('');
    const [addParticipantIds, setAddParticipantIds] = useState<number[]>([]);
    const [isAddingParticipants, setIsAddingParticipants] = useState(false);

    // Mentions
    const [showMentions, setShowMentions] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionIndex, setMentionIndex] = useState(0);
    const [mentionStartPos, setMentionStartPos] = useState<number | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Media viewer (fullscreen)
    const [mediaViewer, setMediaViewer] = useState<{ url: string; type: 'image' | 'video'; caption?: string } | null>(null);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [imageRotation, setImageRotation] = useState(0);
    const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
    const [isDraggingImage, setIsDraggingImage] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const imageRef = useRef<HTMLImageElement>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isAtBottomRef = useRef(true);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const lastMessageIdRef = useRef<number>(0);
    const lastChatPollRef = useRef<string>('');

    // --- Derived State ---

    const filteredChats = useMemo(() => {
        const searchTerm = searchQuery.trim().toLowerCase();

        return chats.filter(chat => {
            const matchesSearch = !searchTerm || chat.name?.toLowerCase().includes(searchTerm);
            const matchesFilter = chatFilter === 'all'
                || (chatFilter === 'unread' && chat.unread > 0)
                || (chatFilter === 'groups' && chat.type === 'group')
                || (chatFilter === 'directs' && chat.type === 'direct');

            return matchesSearch && matchesFilter;
        });
    }, [chatFilter, chats, searchQuery]);

    const filteredUsers = useMemo(() => {
        return availableUsers.filter(u =>
            u.name.toLowerCase().includes(userSearchQuery.toLowerCase())
        );
    }, [availableUsers, userSearchQuery]);

    const chatSummary = useMemo(() => {
        const unreadChats = chats.filter(chat => chat.unread > 0).length;
        const groupChats = chats.filter(chat => chat.type === 'group').length;
        const directChats = chats.filter(chat => chat.type === 'direct').length;
        const onlineUsers = availableUsers.filter(user => user.is_online && user.id !== auth.user.id).length;

        return { unreadChats, groupChats, directChats, onlineUsers };
    }, [availableUsers, auth.user.id, chats]);

    const quickChatFilters = useMemo<{ value: ChatFilter; label: string; count: number }[]>(() => [
        { value: 'all', label: t('internalChat.filterAll'), count: chats.length },
        { value: 'unread', label: t('internalChat.filterUnread'), count: chatSummary.unreadChats },
        { value: 'groups', label: t('internalChat.filterGroups'), count: chatSummary.groupChats },
        { value: 'directs', label: t('internalChat.filterDirects'), count: chatSummary.directChats },
    ], [t, chatSummary.directChats, chatSummary.groupChats, chatSummary.unreadChats, chats.length]);

    // Users available for @mention in the active chat
    const mentionUsers = useMemo(() => {
        if (!activeChat || !showMentions) return [];
        const participants = activeChat.type === 'group'
            ? activeChat.participants.filter(p => p.id !== auth.user.id)
            : availableUsers.filter(u => u.id !== auth.user.id);
        if (!mentionQuery) return participants.slice(0, 8);
        return participants
            .filter(u => u.name.toLowerCase().includes(mentionQuery.toLowerCase()))
            .slice(0, 8);
    }, [activeChat, showMentions, mentionQuery, availableUsers, auth.user.id]);

    // --- Helpers ---

    function getInitials(name: string) {
        return [...name]
            .filter((_, i, arr) => i === 0 || arr[i - 1] === ' ')
            .join('')
            .toUpperCase()
            .slice(0, 2);
    }

    function scrollToBottom(force = false) {
        const container = messagesContainerRef.current;
        if (!container) return;
        if (force || isAtBottomRef.current) {
            // Use instant scroll on force (chat open), smooth on new messages
            container.scrollTo({
                top: container.scrollHeight,
                behavior: force ? 'instant' : 'smooth',
            });
        }
    }

    // Track scroll position to know if user is at bottom
    const handleMessagesScroll = () => {
        const el = messagesContainerRef.current;
        if (!el) return;
        const threshold = 80;
        isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    };

    function getChatIcon(chat: ChatItem) {
        if (chat.type === 'group') return null;
        return null; // no profile photos in internal chat
    }

    function getLastMessagePreview(chat: ChatItem) {
        if (!chat.latest_message) return t('internalChat.newChat');
        const prefix = chat.latest_message.user_name ? `${chat.latest_message.user_name}: ` : '';
        const { type, body } = chat.latest_message;
        if (type === 'image') return `${prefix}${t('internalChat.previewPhoto')}`;
        if (type === 'video') return `${prefix}${t('internalChat.previewVideo')}`;
        if (type === 'audio') return `${prefix}${t('internalChat.previewAudio')}`;
        if (type === 'document' || type === 'file') return `${prefix}${t('internalChat.previewFile')}`;
        return `${prefix}${body || ''}`;
    }

    // --- Effects ---

    // Polling for chat list - optimized with fingerprint comparison
    useEffect(() => {
        const pollChats = async () => {
            try {
                const res = await axios.get('/admin/internal-chat/list');

                if (res.data?.chats) {
                    const newChats: ChatItem[] = res.data.chats;
                    // Build a fingerprint to avoid unnecessary re-renders
                    const fingerprint = JSON.stringify(newChats.map(c => ({
                        id: c.id, u: c.unread, lm: c.latest_message?.body, lmt: c.latest_message?.created_at
                    })));

                    if (fingerprint !== lastChatPollRef.current) {
                        lastChatPollRef.current = fingerprint;
                        setChats(newChats);

                        // Update active chat data if it changed (name, participants, unread)
                        if (activeChat) {
                            const updated = newChats.find(c => c.id === activeChat.id);
                            if (!updated) {
                                // Chat was deleted, clear active
                                setActiveChat(null);
                                setMessages([]);
                                lastMessageIdRef.current = 0;
                            } else if (updated.name !== activeChat.name || updated.participants.length !== activeChat.participants.length) {
                                setActiveChat(updated);
                            }
                        }
                    }
                }
            } catch {
                // Silent fail
            }
        };

        // Immediate first poll
        pollChats();
        // Gating por visibilidad: no pollear con la pestaña oculta; refrescar al volver.
        const interval = setInterval(() => { if (!document.hidden) pollChats(); }, 5000);
        const onVisible = () => { if (!document.hidden) pollChats(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [activeChat?.id]);

    // Polling for messages in active chat - using last message ID for reliability
    useEffect(() => {
        if (!activeChat) return;

        const pollMessages = async () => {
            try {
                const res = await axios.get(`/admin/internal-chat/${activeChat.id}/poll?since=${lastMessageIdRef.current > 0 ? encodeURIComponent(new Date(Date.now() - 10000).toISOString()) : ''}`);
                // La IA reinició la conversación por inactividad: limpiar la vista
                if (res.data?.reset) {
                    setMessages([]);
                    lastMessageIdRef.current = 0;
                    setReadReceipts([]);
                    return;
                }
                if (res.data?.messages && Array.isArray(res.data.messages)) {
                    const newMessages: MessageItem[] = res.data.messages;

                    if (newMessages.length > 0) {
                        const newLastId = newMessages[newMessages.length - 1].id;

                        if (newLastId > lastMessageIdRef.current) {
                            lastMessageIdRef.current = newLastId;
                            // Append only truly new messages
                            setMessages(prev => {
                                const existingIds = new Set(prev.map(m => m.id));
                                const truly = newMessages.filter(m => !existingIds.has(m.id));
                                if (truly.length === 0) return prev;
                                return [...prev, ...truly];
                            });
                            setTimeout(() => scrollToBottom(), 50);
                        }
                    }
                }

                // Aplicar cambios en mensajes existentes (reacciones / ediciones)
                if (Array.isArray(res.data?.updates) && res.data.updates.length > 0) {
                    type Cambio = { id: number; body: string; edited: boolean; reactions: MessageItem['reactions'] };
                    const upd = new Map<number, Cambio>(res.data.updates.map((u: Cambio) => [u.id, u]));
                    setMessages(prev => {
                        let changed = false;
                        const next = prev.map(m => {
                            const u = upd.get(m.id);
                            if (!u) return m;
                            if (m.body === u.body && !!m.edited === !!u.edited && JSON.stringify(m.reactions || []) === JSON.stringify(u.reactions || [])) return m;
                            changed = true;
                            return { ...m, body: u.body, edited: u.edited, reactions: u.reactions };
                        });
                        return changed ? next : prev;
                    });
                }

                // Vistos: llegan con este mismo sondeo, así no hace falta un intervalo aparte.
                if (Array.isArray(res.data?.receipts)) {
                    setReadReceipts(res.data.receipts);
                }
            } catch (e: any) {
                // If chat was deleted (404), stop polling and clear
                if (e?.response?.status === 404) {
                    setActiveChat(null);
                    setMessages([]);
                    lastMessageIdRef.current = 0;
                    return;
                }
            }
        };

        const interval = setInterval(() => { if (!document.hidden) pollMessages(); }, 3000);
        const onVisible = () => { if (!document.hidden) pollMessages(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [activeChat?.id]);

    // Fetch messages when active chat changes
    useEffect(() => {
        if (activeChat) {
            // Reset tracking for new chat
            lastMessageIdRef.current = 0;
            isAtBottomRef.current = true; // Reset scroll tracking
            setEditingMessage(null);
            setReactionPickerFor(null);

            axios.get(`/admin/internal-chat/${activeChat.id}/messages`)
                .then(res => {
                    if (res.data?.messages) {
                        const msgs: MessageItem[] = res.data.messages;
                        setMessages(msgs);
                        lastMessageIdRef.current = msgs.length > 0 ? msgs[msgs.length - 1].id : 0;
                        setActiveChatInfo(res.data.chat || null);
                    }
                    // Vistos ya vienen en la carga inicial.
                    setReadReceipts(Array.isArray(res.data?.receipts) ? res.data.receipts : []);
                })
                .catch(console.error);

            // Mark as read
            axios.post(`/admin/internal-chat/${activeChat.id}/read`).catch(() => { });
        }
    }, [activeChat?.id]);

    // Force scroll to bottom whenever messages change and there's an active chat
    // This catches initial load, chat switch, and any other state update
    useEffect(() => {
        if (activeChat && messages.length > 0) {
            // Use multiple attempts to handle images/media loading that change container height
            const t1 = setTimeout(() => scrollToBottom(true), 100);
            const t2 = setTimeout(() => scrollToBottom(true), 300);
            const t3 = setTimeout(() => scrollToBottom(true), 600);
            return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
        }
    }, [activeChat?.id, messages.length]);

    // Los vistos ya no tienen sondeo propio: llegan con la carga inicial y con el sondeo de
    // mensajes (cada 3 s). Eran una tercera petición por usuario cada 4 s sólo para esto.
    // Aquí sólo queda limpiarlos al salir del chat.
    useEffect(() => {
        if (!activeChat) setReadReceipts([]);
    }, [activeChat?.id]);

    /**
     * A qué mensaje le corresponde el visto de cada persona.
     *
     * El backend guarda un puntero por participante (hasta cuándo leyó), no una marca por
     * mensaje. Antes el visto sólo se pintaba en el ÚLTIMO mensaje del chat: si alguien
     * había leído hasta el mensaje 5 de 7, su visto no aparecía en ninguna parte (medido:
     * le pasaba al 37,9% de los participantes con lectura registrada).
     *
     * Ahora cada persona se ancla al último mensaje MÍO que alcanzó a leer, como en WhatsApp:
     * el visto es sobre lo que tú escribiste, no bajo mensajes ajenos.
     */
    const receiptsByMessageId = useMemo(() => {
        const mapa = new Map<number, ReadReceipt[]>();
        if (readReceipts.length === 0) return mapa;

        // messages viene en orden cronológico ascendente.
        const mios = messages.filter(m => m.is_mine);
        if (mios.length === 0) return mapa;

        for (const r of readReceipts) {
            const leidoHasta = new Date(r.last_read_at).getTime();

            let destino: MessageItem | null = null;
            for (const m of mios) {
                if (new Date(m.created_at_full).getTime() <= leidoHasta) destino = m;
                else break; // ordenados: a partir de aquí ya son posteriores a su lectura
            }

            if (destino) {
                const lista = mapa.get(destino.id);
                if (lista) lista.push(r);
                else mapa.set(destino.id, [r]);
            }
        }

        return mapa;
    }, [messages, readReceipts]);

    // Close media viewer or active chat with Escape key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (chatContextMenu) {
                    setChatContextMenu(null);
                } else if (msgMenu) {
                    setMsgMenu(null);
                } else if (confirmacion) {
                    // Esc = Cancelar: cierra la confirmación sin llamar a nada.
                    setConfirmacion(null);
                } else if (mediaViewer) {
                    setMediaViewer(null);
                    setZoomLevel(1);
                    setImagePosition({ x: 0, y: 0 });
                    setImageRotation(0);
                } else if (showRenameModal) {
                    // Renombrar puede abrirse desde Detalles: Esc cierra primero la ventana de encima.
                    setShowRenameModal(false);
                } else if (showCreateGroup) {
                    setShowCreateGroup(false);
                } else if (showParticipantsModal) {
                    setShowParticipantsModal(false);
                } else if (replyingTo) {
                    setReplyingTo(null);
                } else if (activeChat) {
                    setActiveChat(null);
                    setMessages([]);
                    setReadReceipts([]);
                    lastMessageIdRef.current = 0;
                }
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [chatContextMenu, msgMenu, confirmacion, mediaViewer, showParticipantsModal, showRenameModal, showCreateGroup, replyingTo, activeChat]);

    // El menú de un mensaje se cierra como el de la lista: clic fuera, cambio de tamaño o scroll.
    useEffect(() => {
        if (!msgMenu) return;

        const cerrar = () => setMsgMenu(null);
        window.addEventListener('click', cerrar);
        window.addEventListener('resize', cerrar);
        window.addEventListener('scroll', cerrar, true);

        return () => {
            window.removeEventListener('click', cerrar);
            window.removeEventListener('resize', cerrar);
            window.removeEventListener('scroll', cerrar, true);
        };
    }, [msgMenu]);

    // Al cerrar Detalles (por la X o con Esc), se descarta lo que se estaba añadiendo, como al cerrar la ventana de antes.
    useEffect(() => {
        if (!showParticipantsModal) {
            setShowAddParticipants(false);
            setAddParticipantSearch('');
            setAddParticipantIds([]);
        }
    }, [showParticipantsModal]);

    // Si cambia el chat abierto, el menú de un mensaje ya no aplica.
    useEffect(() => {
        setMsgMenu(null);
    }, [activeChat?.id]);

    useEffect(() => {
        if (!chatContextMenu) return;

        const closeContextMenu = () => setChatContextMenu(null);
        window.addEventListener('click', closeContextMenu);
        window.addEventListener('resize', closeContextMenu);
        window.addEventListener('scroll', closeContextMenu, true);

        return () => {
            window.removeEventListener('click', closeContextMenu);
            window.removeEventListener('resize', closeContextMenu);
            window.removeEventListener('scroll', closeContextMenu, true);
        };
    }, [chatContextMenu]);

    // Handle scroll wheel zoom in media viewer
    useEffect(() => {
        if (!mediaViewer || mediaViewer.type !== 'image') return;
        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            setZoomLevel(prev => {
                const delta = e.deltaY > 0 ? -0.15 : 0.15;
                return Math.min(4, Math.max(0.5, prev + delta));
            });
        };
        window.addEventListener('wheel', handleWheel, { passive: false });
        return () => window.removeEventListener('wheel', handleWheel);
    }, [mediaViewer]);

    // --- Handlers ---

    const handleChatSelect = (chat: ChatItem) => {
        setChatContextMenu(null);
        setActiveChat(chat);
        setReplyingTo(null);
    };

    const handleChatContextMenu = (e: MouseEvent<HTMLButtonElement>, chatId: number) => {
        e.preventDefault();
        e.stopPropagation();
        setChatContextMenu({ chatId, x: e.clientX, y: e.clientY });
    };

    const handleRenameChat = (chat: ChatItem) => {
        setChatContextMenu(null);
        setActiveChat(chat);
        setReplyingTo(null);
        setRenameValue(chat.name);
        setShowRenameModal(true);
    };

    const handleShowParticipants = (chat: ChatItem) => {
        setChatContextMenu(null);
        setActiveChat(chat);
        setReplyingTo(null);
        setShowParticipantsModal(true);
    };

    // Lo decide quién CREÓ el grupo (es lo que hace InternalChatController::destroy): el creador lo
    // elimina para todos; los demás solo salen. Antes se miraba si eras participante y a todos les decía
    // «Eliminar grupo».
    const getDeleteChatLabel = (chat: ChatItem) => chat.type === 'group'
        ? (chat.created_by === auth.user.id ? t('internalChat.deleteGroup') : t('internalChat.leaveGroup'))
        : t('internalChat.deleteChat');

    // Primero pregunta (diálogo propio); al confirmar, la MISMA llamada de siempre.
    const handleDeleteChat = (chat: ChatItem) => {
        setChatContextMenu(null);
        setConfirmacion({ tipo: chat.type === 'group' ? (chat.created_by === auth.user.id ? 'grupo' : 'salir') : 'chat', chat });
    };

    const ejecutarEliminarChat = async (chat: ChatItem) => {
        try {
            const deletedId = chat.id;
            await axios.delete(`/admin/internal-chat/${deletedId}`);

            lastChatPollRef.current = '';
            if (activeChat?.id === deletedId) {
                lastMessageIdRef.current = 0;
                setMessages([]);
                setActiveChat(null);
            }
            setChats(prev => prev.filter(c => c.id !== deletedId));
            toast.success(t('internalChat.chatDeleted'));
        } catch (err) {
            console.error('Error eliminando chat:', err);
            toast.error(t('internalChat.chatDeleteError'));
        }
    };

    // ¿Es un chat directo con el usuario de IA local ("IA - Prueba", role='ai')?
    const isAiChat = (chat: ChatItem | null | undefined): boolean =>
        !!chat && chat.type === 'direct' && chat.participants.some(p => p.role === 'ai');

    // Pedir al backend la respuesta del chatbot de IA local y agregarla al chat
    const triggerAiReply = async (chat: ChatItem) => {
        setAiTyping(true);
        try {
            const res = await axios.post(`/admin/internal-chat/${chat.id}/ai-reply`);
            const aiMsg: MessageItem | undefined = res.data?.message;
            if (aiMsg) {
                lastMessageIdRef.current = Math.max(lastMessageIdRef.current, aiMsg.id);
                setMessages(prev => (prev.some(m => m.id === aiMsg.id) ? prev : [...prev, aiMsg]));
                setChats(prev => prev.map(c => c.id === chat.id ? {
                    ...c,
                    latest_message: {
                        body: aiMsg.body || t('internalChat.messageFallback'),
                        type: aiMsg.type,
                        user_name: aiMsg.user.name,
                        created_at: t('internalChat.now'),
                    },
                } : c));
                setTimeout(() => scrollToBottom(true), 50);
            }
        } catch (e) {
            console.error('AI reply error', e);
            toast.error(t('internalChat.aiNoResponse'));
        } finally {
            setAiTyping(false);
        }
    };

    // Reaccionar a un mensaje (alterna mi emoji). El servidor devuelve el estado real.
    const handleReact = async (msg: MessageItem, emoji: string) => {
        if (!activeChat) return;
        setReactionPickerFor(null);
        setMessages(prev => prev.map(m => {
            if (m.id !== msg.id) return m;
            let reactions = (m.reactions || []).map(r => ({ ...r }));
            const myCurrent = reactions.find(r => r.mine);
            const removingSame = !!myCurrent && myCurrent.emoji === emoji;
            if (myCurrent) {
                myCurrent.count -= 1;
                myCurrent.mine = false;
                reactions = reactions.filter(r => r.count > 0);
            }
            if (!removingSame) {
                const target = reactions.find(r => r.emoji === emoji);
                if (target) { target.count += 1; target.mine = true; }
                else reactions.push({ emoji, count: 1, users: [t('common.you')], mine: true });
            }
            return { ...m, reactions };
        }));
        try {
            const res = await axios.post(`/admin/internal-chat/${activeChat.id}/react`, { message_id: msg.id, emoji });
            if (res.data?.reactions) {
                setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, reactions: res.data.reactions } : m));
            }
        } catch { /* el polling reconciliará el estado real */ }
    };

    // Iniciar la edición de un mensaje propio de texto (se carga en el input)
    const startEdit = (msg: MessageItem) => {
        if (!msg.is_mine || msg.type !== 'text') return;
        setReplyingTo(null);
        setEditingMessage(msg);
        setInputText(msg.body);
        setTimeout(() => textareaRef.current?.focus(), 0);
    };
    const cancelEdit = () => {
        setEditingMessage(null);
        setInputText('');
    };

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();

        // Modo edición: guardar cambios en el mensaje en vez de enviar uno nuevo
        if (editingMessage) {
            const newBody = inputText.trim();
            const target = editingMessage;
            if (!newBody || !activeChat) { cancelEdit(); return; }
            if (newBody === target.body) { cancelEdit(); return; }
            setMessages(prev => prev.map(m => m.id === target.id ? { ...m, body: newBody, edited: true } : m));
            setEditingMessage(null);
            setInputText('');
            try {
                const res = await axios.post(`/admin/internal-chat/${activeChat.id}/edit`, { message_id: target.id, body: newBody });
                if (res.data?.message) {
                    setMessages(prev => prev.map(m => m.id === target.id ? res.data.message : m));
                }
            } catch (err) {
                console.error('Edit error', err);
                toast.error(t('internalChat.editMessageError'));
            }
            return;
        }

        if ((!inputText.trim() && !isUploading) || !activeChat) return;

        const originalText = inputText;
        const replyMsg = replyingTo;
        setInputText('');
        setReplyingTo(null);

        // Optimistic: add message locally before server confirms
        const tempId = Date.now();
        const optimisticMsg: MessageItem = {
            id: tempId,
            body: originalText,
            type: 'text',
            file_url: null,
            file_name: null,
            file_mime: null,
            file_size_human: null,
            user: { id: auth.user.id, name: auth.user.name },
            is_mine: true,
            created_at: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
            created_at_full: new Date().toISOString().slice(0, 16).replace('T', ' '),
            reply_to: replyMsg ? {
                id: replyMsg.id,
                body: replyMsg.body,
                type: replyMsg.type,
                file_name: replyMsg.file_name,
                user_name: replyMsg.is_mine ? auth.user.name : replyMsg.user.name,
            } : null,
        };
        setMessages(prev => [...prev, optimisticMsg]);
        setTimeout(() => scrollToBottom(true), 50);

        try {
            const sendRes = await axios.post(`/admin/internal-chat/${activeChat.id}/send`, {
                body: originalText,
                type: 'text',
                ...(replyMsg ? { reply_to_id: replyMsg.id } : {}),
            });

            // Replace optimistic message with real one from server
            if (sendRes.data?.message) {
                const realMsg = sendRes.data.message;
                lastMessageIdRef.current = realMsg.id;
                setMessages(prev => prev.map(m => m.id === tempId ? realMsg : m));

                // Optimistically update sidebar to reflect the sent message
                setChats(prev => {
                    const updated = prev.map(c => {
                        if (c.id !== activeChat.id) return c;
                        return {
                            ...c,
                            latest_message: {
                                body: realMsg.body || (realMsg.type === 'image' ? t('internalChat.photo') : realMsg.type === 'video' ? t('internalChat.video') : realMsg.type === 'audio' ? t('internalChat.audio') : t('internalChat.file')),
                                type: realMsg.type,
                                user_name: auth.user.name,
                                created_at: t('internalChat.now'),
                            },
                            unread: 0,
                        };
                    });
                    // Move active chat to the top
                    const active = updated.find(c => c.id === activeChat.id);
                    const rest = updated.filter(c => c.id !== activeChat.id);
                    return active ? [active, ...rest] : updated;
                });
            }

            // Si este chat es con la IA local, pedir su respuesta automática
            if (isAiChat(activeChat)) {
                void triggerAiReply(activeChat);
            }
        } catch (error) {
            console.error(error);
            // Remove optimistic message and restore input on error
            setMessages(prev => prev.filter(m => m.id !== tempId));
            setInputText(originalText);
            if (replyMsg) setReplyingTo(replyMsg);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !activeChat) return;
        await sendFileDirectly(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Insert a mention into the textarea replacing the @query
    const insertMention = (user: UserInfo) => {
        if (mentionStartPos === null) return;
        const before = inputText.slice(0, mentionStartPos);
        const after = inputText.slice(mentionStartPos + mentionQuery.length + 1); // +1 for @
        const newText = `${before}@${user.name} ${after}`;
        setInputText(newText);
        setShowMentions(false);
        setMentionQuery('');
        setMentionStartPos(null);
        setMentionIndex(0);
        // Focus back on textarea
        setTimeout(() => textareaRef.current?.focus(), 0);
    };

    // Handle input change to detect @mentions
    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setInputText(value);

        const cursorPos = e.target.selectionStart ?? value.length;
        // Find the last @ before cursor that starts a mention
        const textBeforeCursor = value.slice(0, cursorPos);
        const lastAt = textBeforeCursor.lastIndexOf('@');

        if (lastAt >= 0) {
            // Check there's no space before @ (except at start) — actually allow it if at start or after space/newline
            const charBefore = lastAt > 0 ? textBeforeCursor[lastAt - 1] : ' ';
            if (charBefore === ' ' || charBefore === '\n' || lastAt === 0) {
                const query = textBeforeCursor.slice(lastAt + 1);
                // Only show if query doesn't contain newlines and is short
                if (!query.includes('\n') && query.length <= 30) {
                    setMentionStartPos(lastAt);
                    setMentionQuery(query);
                    setShowMentions(true);
                    setMentionIndex(0);
                    return;
                }
            }
        }
        setShowMentions(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Handle mention dropdown navigation
        if (showMentions && mentionUsers.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setMentionIndex(prev => (prev + 1) % mentionUsers.length);
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setMentionIndex(prev => (prev - 1 + mentionUsers.length) % mentionUsers.length);
                return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                insertMention(mentionUsers[mentionIndex]);
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setShowMentions(false);
                return;
            }
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    // Send a file directly (used by paste and file input)
    const sendFileDirectly = async (file: File) => {
        if (!activeChat) return;

        const replyMsg = replyingTo;
        setReplyingTo(null);

        const formData = new FormData();
        formData.append('file', file);

        let type = 'file';
        if (file.type.startsWith('image/')) type = 'image';
        else if (file.type.startsWith('audio/')) type = 'audio';
        else if (file.type.startsWith('video/')) type = 'video';
        else type = 'document';
        formData.append('type', type);
        if (replyMsg) formData.append('reply_to_id', String(replyMsg.id));

        const tempId = Date.now();
        const optimisticMsg: MessageItem = {
            id: tempId,
            body: t('internalChat.sendingFile', { fileName: file.name }),
            type: type as MessageItem['type'],
            file_url: null,
            file_name: file.name,
            file_mime: file.type,
            file_size_human: `${(file.size / 1024).toFixed(0)} KB`,
            user: { id: auth.user.id, name: auth.user.name },
            is_mine: true,
            created_at: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
            created_at_full: new Date().toISOString().slice(0, 16).replace('T', ' '),
            reply_to: replyMsg ? {
                id: replyMsg.id,
                body: replyMsg.body,
                type: replyMsg.type,
                file_name: replyMsg.file_name,
                user_name: replyMsg.is_mine ? auth.user.name : replyMsg.user.name,
            } : null,
        };
        setMessages(prev => [...prev, optimisticMsg]);
        setTimeout(() => scrollToBottom(true), 50);

        setIsUploading(true);
        try {
            const sendRes = await axios.post(`/admin/internal-chat/${activeChat.id}/send`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (sendRes.data?.message) {
                const realMsg = sendRes.data.message;
                lastMessageIdRef.current = realMsg.id;
                setMessages(prev => prev.map(m => m.id === tempId ? realMsg : m));

                const typeLabel = realMsg.type === 'image' ? t('internalChat.previewPhoto') : realMsg.type === 'video' ? t('internalChat.previewVideo') : realMsg.type === 'audio' ? t('internalChat.previewAudio') : t('internalChat.previewFile');
                setChats(prev => {
                    const updated = prev.map(c => {
                        if (c.id !== activeChat.id) return c;
                        return { ...c, latest_message: { body: realMsg.body || typeLabel, type: realMsg.type, user_name: auth.user.name, created_at: t('internalChat.now') }, unread: 0 };
                    });
                    const active = updated.find(c => c.id === activeChat.id);
                    const rest = updated.filter(c => c.id !== activeChat.id);
                    return active ? [active, ...rest] : updated;
                });
            }

            // Si este chat es con la IA local, pedir su respuesta automática
            if (isAiChat(activeChat)) {
                void triggerAiReply(activeChat);
            }
        } catch (error) {
            console.error('Upload error', error);
            setMessages(prev => prev.filter(m => m.id !== tempId));
        } finally {
            setIsUploading(false);
        }
    };

    // Handle paste images from clipboard (Ctrl+V)
    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file) {
                    e.preventDefault();
                    sendFileDirectly(file);
                    break;
                }
            }
        }
    };

    const handleCreateGroup = async () => {
        if (selectedUserIds.length === 0) return;
        setIsCreatingGroup(true);

        try {
            const isGroup = selectedUserIds.length > 1;
            const res = await axios.post('/admin/internal-chat/create', {
                type: isGroup ? 'group' : 'direct',
                name: isGroup ? (groupName || t('internalChat.newGroupDefault')) : null,
                user_ids: selectedUserIds,
            });

            if (res.data?.success) {
                // Refresh chat list
                const listRes = await axios.get('/admin/internal-chat/list');
                if (listRes.data?.chats) {
                    setChats(listRes.data.chats);
                    // Select the new/existing chat
                    const newChat = listRes.data.chats.find((c: ChatItem) => c.id === res.data.chat_id);
                    if (newChat) setActiveChat(newChat);
                }
                setShowCreateGroup(false);
                setGroupName('');
                setSelectedUserIds([]);
                setUserSearchQuery('');
                toast.success(res.data?.chat_id ? t('internalChat.chatCreated') : t('internalChat.chatReady'));
            }
        } catch (error) {
            console.error('Error creating chat:', error);
            toast.error(t('internalChat.chatCreateError'));
        } finally {
            setIsCreatingGroup(false);
        }
    };

    const toggleUserSelection = (userId: number) => {
        setSelectedUserIds(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    // Renombrar (Enter en el campo o «Guardar»): la misma llamada de siempre.
    const guardarNombre = async () => {
        if (!activeChat || !renameValue.trim()) return;
        try {
            await axios.put(`/admin/internal-chat/${activeChat.id}/rename`, { name: renameValue.trim() });
            // Update local state
            setActiveChat({ ...activeChat, name: renameValue.trim() });
            setChats(prev => prev.map(c => c.id === activeChat.id ? { ...c, name: renameValue.trim() } : c));
            setShowRenameModal(false);
        } catch (err) {
            console.error('Error renombrando grupo:', err);
        }
    };

    // Quitar a una persona del grupo (tras confirmar): la misma llamada de siempre.
    const quitarParticipante = async (p: UserInfo) => {
        try {
            const res = await axios.delete(`/admin/internal-chat/${activeChat!.id}/participants/${p.id}`);
            if (res.data.success) {
                // Actualizar participantes localmente
                setActiveChat(prev => prev ? { ...prev, participants: res.data.participants } : null);
                setChats(prev => prev.map(c => c.id === activeChat!.id ? { ...c, participants: res.data.participants } : c));
                toast.success(res.data.message);
            }
        } catch (err: any) {
            toast.error(err.response?.data?.error || t('internalChat.removeParticipantError'));
        }
    };

    // Añadir personas al grupo: la misma llamada de siempre.
    const anadirParticipantes = async () => {
        if (!activeChat || addParticipantIds.length === 0) return;
        setIsAddingParticipants(true);
        try {
            const res = await axios.post(`/admin/internal-chat/${activeChat.id}/participants`, {
                user_ids: addParticipantIds,
            });
            if (res.data.success) {
                setActiveChat(prev => prev ? { ...prev, participants: res.data.participants } : null);
                setChats(prev => prev.map(c => c.id === activeChat.id ? { ...c, participants: res.data.participants } : c));
                toast.success(res.data.message);
                setShowAddParticipants(false);
                setAddParticipantSearch('');
                setAddParticipantIds([]);
            }
        } catch (err: any) {
            toast.error(err.response?.data?.error || t('internalChat.addParticipantsError'));
        } finally {
            setIsAddingParticipants(false);
        }
    };

    // «Sí» en el diálogo de confirmación.
    const confirmarAccion = () => {
        const c = confirmacion;
        setConfirmacion(null);
        if (!c) return;
        if (c.tipo === 'quitar') {
            if (c.persona) void quitarParticipante(c.persona);
            return;
        }
        void ejecutarEliminarChat(c.chat);
    };

    // --- Presentación (solo pinta: no hace llamadas) ---

    const soyCreador = (chat: ChatItem | null | undefined) => !!chat && chat.type === 'group' && chat.created_by === auth.user.id;

    const rolTexto = (rol: string) =>
        rol === 'admin' ? t('internalChat.roleAdmin') : rol === 'advisor' ? t('internalChat.roleAdvisor') : rol === 'ai' ? t('internalChat.vista.roleBot') : rol;

    const nombreChat = (chat: ChatItem) => (chat.type === 'direct' ? nombreVisible(chat.name) : chat.name);

    function previaChat(chat: ChatItem) {
        if (!chat.latest_message) return t('internalChat.vista.noMessagesYet');
        const { type, body, user_name } = chat.latest_message;
        const mio = !!user_name && user_name === auth.user.name;
        const quien = mio ? `${t('common.you')}: ` : chat.type === 'group' && user_name ? `${nombreCorto(user_name)}: ` : '';
        const cuerpo =
            type === 'image' ? <ConIcono icono={ImageIcon}>{t('internalChat.photo')}</ConIcono>
            : type === 'video' ? <ConIcono icono={Video}>{t('internalChat.video')}</ConIcono>
            : type === 'audio' ? <ConIcono icono={Music}>{t('internalChat.audio')}</ConIcono>
            : type === 'document' || type === 'file' ? <ConIcono icono={Paperclip}>{t('internalChat.file')}</ConIcono>
            : body || '';
        return (
            <>
                {quien && <span className={cn(chat.unread > 0 ? cn('font-semibold', ACENTO) : 'font-medium')}>{quien}</span>}
                {cuerpo}
            </>
        );
    }

    /** Resumen de un mensaje citado o que se responde: icono + texto. */
    const resumenCita = (m: { type: string; body: string | null; file_name: string | null }): { texto: string; icono?: typeof ImageIcon } =>
        m.type === 'image' ? { texto: t('internalChat.photo'), icono: ImageIcon }
        : m.type === 'video' ? { texto: t('internalChat.video'), icono: Video }
        : m.type === 'audio' ? { texto: t('internalChat.audio'), icono: Music }
        : m.type === 'document' ? { texto: m.file_name || t('internalChat.file'), icono: Paperclip }
        : { texto: m.body || '' };

    const tipoDocumento = (nombre: string | null) => {
        const ext = (nombre?.split('.').pop() ?? '').toLowerCase();
        if (ext === 'pdf') return t('internalChat.vista.docPdf');
        if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return t('internalChat.vista.docSheet');
        if (['doc', 'docx', 'odt', 'rtf'].includes(ext)) return t('internalChat.vista.docText');
        if (['ppt', 'pptx', 'odp'].includes(ext)) return t('internalChat.vista.docSlides');
        if (['zip', 'rar', '7z'].includes(ext)) return t('internalChat.vista.docZip');
        return t('internalChat.file');
    };

    /** created_at_full → Date. El optimista llega como "2026-09-13 15:04" (UTC sin zona): se lee como UTC. */
    const fechaDe = (m: MessageItem): Date | null => {
        const s = m.created_at_full;
        if (!s) return null;
        const d = new Date(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s) ? `${s.replace(' ', 'T')}:00Z` : s);
        return Number.isNaN(d.getTime()) ? null : d;
    };
    const claveDia = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const textoDia = (d: Date) => {
        const hoy = new Date();
        const ayer = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1);
        if (claveDia(d) === claveDia(hoy)) return t('common.today');
        if (claveDia(d) === claveDia(ayer)) return t('common.yesterday');
        const larga = fechaLarga(d, i18n.language);
        const conAnio = d.getFullYear() !== hoy.getFullYear() ? `${larga} ${d.getFullYear()}` : larga;
        return conAnio.charAt(0).toLocaleUpperCase() + conAnio.slice(1);
    };

    // Mensaje optimista (id temporal = Date.now()): los reales son ids pequeños de la base de datos.
    const esPendiente = (m: MessageItem) => m.id > 1_000_000_000_000;

    const abrirMenuMensaje = (msg: MessageItem, x: number, y: number) => {
        setChatContextMenu(null);
        setMsgMenu({ msg, x, y });
    };
    const alPulsarLargo = (msg: MessageItem) => (e: React.TouchEvent) => {
        const toque = e.touches[0];
        if (!toque) return;
        const { clientX, clientY } = toque;
        if (pulsacionRef.current) clearTimeout(pulsacionRef.current);
        pulsacionRef.current = setTimeout(() => abrirMenuMensaje(msg, clientX, clientY), 500);
    };
    const cancelarPulsacion = () => {
        if (pulsacionRef.current) {
            clearTimeout(pulsacionRef.current);
            pulsacionRef.current = null;
        }
    };

    const abrirVisor = (msg: MessageItem) => {
        if (!msg.file_url) return;
        if (msg.type === 'image') {
            // Igual que al pulsar la imagen: no abrir si no se pudo cargar.
            if (document.getElementById(`msg-${msg.id}`)?.querySelector('[data-unavailable="1"]')) return;
            setMediaViewer({ url: msg.file_url, type: 'image', caption: msg.body && msg.body !== t('internalChat.image') ? msg.body : undefined });
            setZoomLevel(1);
            setImagePosition({ x: 0, y: 0 });
        } else if (msg.type === 'video') {
            setMediaViewer({ url: msg.file_url, type: 'video', caption: msg.body && msg.body !== t('internalChat.video') ? msg.body : undefined });
        }
    };

    const irAlMensaje = (id: number) => {
        const el = document.getElementById(`msg-${id}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('ring-2', 'ring-[#2e3f84]/40', 'dark:ring-blue-400/40', 'rounded-xl');
            setTimeout(() => el.classList.remove('ring-2', 'ring-[#2e3f84]/40', 'dark:ring-blue-400/40', 'rounded-xl'), 2000);
        }
    };

    const participantesActivos = activeChat?.participants ?? [];
    const enLineaGrupo = participantesActivos.filter((p) => p.is_online && p.id !== auth.user.id).length;
    const otroDirecto = activeChatInfo?.participants?.find((p) => p.id !== auth.user.id);
    const personasMencionables = activeChat?.type === 'group' ? activeChat.participants : availableUsers;
    const esChatIa = isAiChat(activeChat);
    const creadorActivo = soyCreador(activeChat);

    const TECLAS = [
        { tecla: 'Enter', que: t('internalChat.vista.keySend') },
        { tecla: 'Shift + Enter', que: t('internalChat.vista.keyNewLine') },
        { tecla: '@', que: t('internalChat.vista.keyMention') },
        { tecla: 'Ctrl + V', que: t('internalChat.vista.keyPaste') },
    ];

    const textosDetalles: TextosDetalles = {
        titulo: t('internalChat.vista.detailsTitle'),
        tituloAnadir: t('internalChat.vista.addPeopleTitle'),
        cerrar: t('internalChat.closeEsc'),
        volver: t('common.back'),
        renombrar: t('internalChat.renameGroup'),
        resumen: t('internalChat.vista.groupSummary', { count: participantesActivos.length, online: enLineaGrupo }),
        rotuloParticipantes: t('internalChat.vista.participantsLabel', { count: participantesActivos.length }),
        anadir: t('internalChat.vista.add'),
        anadirTitulo: t('internalChat.vista.addHint'),
        tu: t('internalChat.youParenthesis'),
        creador: t('internalChat.vista.creatorChip'),
        enLinea: t('internalChat.online'),
        quitar: (nombre) => t('internalChat.vista.removeHint', { name: nombre }),
        rol: rolTexto,
        eliminarGrupo: t('internalChat.vista.deleteGroupEllipsis'),
        eliminarNota: t('internalChat.vista.deleteGroupNote'),
        salirGrupo: t('internalChat.vista.leaveGroupEllipsis'),
        salirNota: t('internalChat.vista.leaveGroupNote'),
        buscar: t('internalChat.searchUserPlaceholder'),
        soloFuera: t('internalChat.vista.onlyOutside'),
        sinResultados: t('internalChat.noUsersFound'),
        anadirN: t('internalChat.vista.addPeople', { count: addParticipantIds.length }),
    };

    const candidatosAnadir = availableUsers
        .filter(u => !(activeChat?.participants ?? []).some(p => p.id === u.id))
        .filter(u => !addParticipantSearch || u.name.toLowerCase().includes(addParticipantSearch.toLowerCase()));

    const filtroActivo = quickChatFilters.find((f) => f.value === chatFilter);

    // Confirmación en curso: textos y acción (la MISMA llamada de siempre).
    const confirmarTextos = (() => {
        if (!confirmacion) return null;
        const { tipo, chat, persona } = confirmacion;
        if (tipo === 'quitar' && persona) {
            return {
                icono: UserMinus,
                titulo: t('internalChat.vista.confirmRemoveTitle', { name: nombreCorto(persona.name) }),
                clave: 'internalChat.vista.confirmRemoveText',
                valores: { name: nombreVisible(persona.name) },
                boton: t('internalChat.vista.confirmRemoveButton'),
            };
        }
        if (tipo === 'grupo') {
            return { icono: Trash2, titulo: t('internalChat.vista.confirmDeleteGroupTitle'), clave: 'internalChat.vista.confirmDeleteGroupText', valores: { name: chat.name, count: chat.participants.length }, boton: t('internalChat.deleteGroup') };
        }
        if (tipo === 'salir') {
            return { icono: LogOut, titulo: t('internalChat.vista.confirmLeaveTitle'), clave: 'internalChat.vista.confirmLeaveText', valores: { name: chat.name }, boton: t('internalChat.vista.confirmLeaveButton') };
        }
        return { icono: Trash2, titulo: t('internalChat.vista.confirmDeleteChatTitle'), clave: 'internalChat.vista.confirmDeleteChatText', valores: { name: nombreChat(chat) }, boton: t('internalChat.deleteChat') };
    })();

    return (
        <AdminLayout>
            <Head title={t('internalChat.pageTitle')} />

            <div className={cn('h-[calc(100vh-0px)] max-lg:h-[calc(100dvh-4rem)] flex overflow-hidden', FONDO_CHAT)}>
                {/* ══ Lista de chats ══ */}
                <section
                    aria-label={t('internalChat.title')}
                    className={cn(
                        'relative z-[2] flex-col flex-shrink-0 shadow-[1px_0_0_rgba(46,63,132,0.08)] dark:shadow-[1px_0_0_rgba(255,255,255,0.08)]',
                        HOJA_CHAT,
                        activeChat ? 'hidden md:flex' : 'flex',
                        isSidebarVisible ? 'w-full md:w-[320px] xl:w-[340px]' : 'hidden md:w-0 md:overflow-hidden'
                    )}
                >
                    <div className="flex flex-col gap-3 px-4 pt-3.5 pb-3 md:px-[18px] md:pt-5">
                        <div className="flex items-center gap-2.5">
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <h1 className={cn('truncate text-[20px] leading-[26px] font-semibold tracking-[-0.02em]', TEXTO_NAVY)}>{t('internalChat.title')}</h1>
                                <p className={cn('truncate text-[12.5px] leading-4 tabular-nums', GRIS)}>
                                    {t('internalChat.vista.conversationsCount', { count: chats.length })}
                                    {' · '}
                                    <span className="font-medium text-emerald-700 dark:text-emerald-400">{t('internalChat.vista.onlineCount', { count: chatSummary.onlineUsers })}</span>
                                </p>
                            </div>
                            <button type="button" onClick={() => setShowCreateGroup(true)} title={t('internalChat.vista.newHint')} className={cn(BOTON_PRIMARIO, 'h-[34px] pr-3.5 pl-3')}>
                                <Plus aria-hidden="true" />
                                {t('internalChat.vista.new')}
                            </button>
                        </div>

                        <div className="relative min-w-0">
                            <Search className={cn('pointer-events-none absolute top-1/2 left-[11px] size-4 -translate-y-1/2', GRIS)} strokeWidth={1.75} aria-hidden="true" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                aria-label={t('internalChat.searchPlaceholder')}
                                placeholder={t('internalChat.searchPlaceholder')}
                                className={cn(
                                    'h-9 w-full rounded-[10px] bg-[#2e3f84]/[0.035] pr-3 pl-9 text-[13px] leading-[18px] text-[#2e3f84] shadow-[inset_0_0_0_1px_rgba(46,63,132,0.1)] outline-none placeholder:text-[#5c6485] focus:shadow-[inset_0_0_0_1px_#2e3f84,0_0_0_3px_rgba(46,63,132,0.14)]',
                                    'dark:bg-white/[0.04] dark:text-neutral-100 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] dark:placeholder:text-neutral-400 dark:focus:shadow-[inset_0_0_0_1px_#8b9ae0,0_0_0_3px_rgba(139,154,224,0.3)]'
                                )}
                            />
                        </div>

                        <Segmentos opciones={quickChatFilters} valor={chatFilter} onCambio={setChatFilter} etiqueta={t('internalChat.vista.filtersLabel')} />
                    </div>

                    <div className="custom-scrollbar-light flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto pb-2">
                        {filteredChats.length === 0 ? (
                            chats.length === 0 ? (
                                <Vacio
                                    icono={Inbox}
                                    titulo={t('internalChat.vista.emptyTitle')}
                                    texto={t('internalChat.vista.emptyText')}
                                    className="flex-1"
                                    accion={
                                        <button type="button" onClick={() => setShowCreateGroup(true)} className={BOTON_PRIMARIO}>
                                            <Plus aria-hidden="true" />
                                            {t('internalChat.newChatOrGroup')}
                                        </button>
                                    }
                                />
                            ) : (
                                <Vacio
                                    icono={SearchX}
                                    titulo={
                                        searchQuery.trim()
                                            ? t('internalChat.vista.noResultsQuery', { query: searchQuery.trim(), filter: filtroActivo?.label ?? '' })
                                            : t('internalChat.vista.noResultsFilter', { filter: filtroActivo?.label ?? '' })
                                    }
                                    texto={t('internalChat.vista.noResultsText')}
                                    className="flex-1"
                                    accion={
                                        <button type="button" onClick={() => { setSearchQuery(''); setChatFilter('all'); }} className={BOTON_SECUNDARIO}>
                                            <X aria-hidden="true" />
                                            {t('internalChat.vista.clearFilters')}
                                        </button>
                                    }
                                />
                            )
                        ) : (
                            filteredChats.map((chat, k) => {
                                const isActive = activeChat?.id === chat.id;
                                const otro = chat.type === 'direct' ? chat.participants.find(p => p.id !== auth.user.id) : undefined;
                                const bot = chat.type === 'direct' && otro?.role === 'ai';
                                return (
                                    <FilaChat
                                        key={chat.id}
                                        datosId={chat.id}
                                        activo={isActive}
                                        ultima={k === filteredChats.length - 1 || filteredChats[k + 1]?.id === activeChat?.id}
                                        titulo={t('internalChat.vista.rowHint')}
                                        onClick={() => handleChatSelect(chat)}
                                        onContextMenu={(e) => handleChatContextMenu(e, chat.id)}
                                        avatar={
                                            chat.type === 'group'
                                                ? <AvatarGrupo tam={38} />
                                                : <AvatarPersona nombre={otro?.name ?? chat.name} rol={otro?.role} enLinea={!!otro?.is_online} tam={38} anillo={isActive ? 'ring-[#eef0f7] dark:ring-[#2e2d2c]' : 'ring-white dark:ring-card'} />
                                        }
                                        nombre={nombreChat(chat)}
                                        extra={
                                            chat.type === 'group' ? (
                                                <span title={t('internalChat.participantsCount', { count: chat.participants.length })} className={cn('inline-flex shrink-0 items-center gap-[3px] text-[12px] leading-4 font-medium tabular-nums', GRIS)}>
                                                    <Users className="size-3" strokeWidth={2} aria-hidden="true" />
                                                    {chat.participants.length}
                                                </span>
                                            ) : bot ? (
                                                <span className="inline-flex h-[18px] shrink-0 items-center rounded-[5px] bg-sky-50 px-1.5 text-[11px] leading-3 font-semibold whitespace-nowrap text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
                                                    {t('internalChat.vista.testChip')}
                                                </span>
                                            ) : null
                                        }
                                        hora={chat.latest_message?.created_at || ''}
                                        previa={previaChat(chat)}
                                        noLeidos={chat.unread}
                                        tituloNoLeidos={t('internalChat.vista.unreadCount', { count: chat.unread })}
                                    />
                                );
                            })
                        )}
                    </div>
                </section>

                {/* Menú de clic derecho de la lista */}
                {chatContextMenu && (() => {
                    const chat = chats.find(c => c.id === chatContextMenu.chatId);
                    if (!chat) return null;
                    const creador = soyCreador(chat);
                    const alto = chat.type === 'group' ? (creador ? 138 : 102) : 48;
                    return (
                        <MenuFlotante x={chatContextMenu.x} y={chatContextMenu.y} alto={alto} etiqueta={nombreChat(chat)}>
                            {chat.type === 'group' && (
                                <>
                                    {creador && (
                                        <OpcionMenu icono={Pencil} onClick={() => handleRenameChat(chat)}>
                                            {t('internalChat.renameGroup')}
                                        </OpcionMenu>
                                    )}
                                    <OpcionMenu icono={Users} onClick={() => handleShowParticipants(chat)}>
                                        {t('internalChat.viewParticipants', { count: chat.participants.length })}
                                    </OpcionMenu>
                                    <SeparadorMenu />
                                </>
                            )}
                            <OpcionMenu icono={chat.type === 'group' && !creador ? LogOut : Trash2} peligro onClick={() => handleDeleteChat(chat)}>
                                {getDeleteChatLabel(chat)}…
                            </OpcionMenu>
                        </MenuFlotante>
                    );
                })()}

                {/* ══ Conversación ══ */}
                {!activeChat ? (
                    <div className={cn('hidden flex-1 items-center justify-center md:flex', FONDO_CHAT)}>
                        <Vacio
                            icono={MessagesSquare}
                            titulo={t('internalChat.vista.pickTitle')}
                            texto={t('internalChat.vista.pickText')}
                            accion={
                                <button type="button" onClick={() => setShowCreateGroup(true)} className={BOTON_SECUNDARIO}>
                                    <Plus aria-hidden="true" />
                                    {t('internalChat.newChatOrGroup')}
                                </button>
                            }
                        />
                    </div>
                ) : (
                    <div className={cn('relative flex w-full min-w-0 flex-1 flex-col md:w-auto', FONDO_CHAT)}>
                        {/* Cabecera */}
                        <header className={cn('relative z-[3] flex h-[60px] shrink-0 items-center gap-2.5 pr-3 pl-3 shadow-[0_1px_0_rgba(46,63,132,0.08)] md:h-16 md:pr-4 dark:shadow-[0_1px_0_rgba(255,255,255,0.08)]', HOJA_CHAT)}>
                            <button
                                type="button"
                                onClick={() => {
                                    if (window.innerWidth < 768) {
                                        setActiveChat(null);
                                    } else {
                                        setIsSidebarVisible(!isSidebarVisible);
                                    }
                                }}
                                className={cn(BOTON_ICONO_CHAT, 'size-9 max-md:-ml-1.5 max-md:text-[#2e3f84] md:size-[34px] dark:max-md:text-neutral-100')}
                                title={isSidebarVisible ? t('internalChat.hideList') : t('internalChat.showList')}
                                aria-label={isSidebarVisible ? t('internalChat.hideList') : t('internalChat.showList')}
                            >
                                <ArrowLeft className="size-[18px] md:hidden" strokeWidth={1.9} aria-hidden="true" />
                                {isSidebarVisible ? (
                                    <PanelLeftClose className="hidden size-[18px] md:block" strokeWidth={1.9} aria-hidden="true" />
                                ) : (
                                    <PanelLeftOpen className="hidden size-[18px] md:block" strokeWidth={1.9} aria-hidden="true" />
                                )}
                            </button>

                            {activeChat.type === 'group'
                                ? <AvatarGrupo tam={38} />
                                : <AvatarPersona nombre={otroDirecto?.name ?? activeChat.name} rol={activeChat.participants.find(p => p.id !== auth.user.id)?.role} enLinea={!!otroDirecto?.is_online} tam={38} />}

                            <div className="ml-0.5 flex min-w-0 flex-1 flex-col gap-0.5">
                                <h2 className={cn('truncate text-[15px] leading-5 font-semibold tracking-[-0.01em]', TEXTO_NAVY)}>{nombreChat(activeChat)}</h2>
                                <p className={cn('flex min-w-0 items-center gap-1.5 truncate text-[12.5px] leading-4 whitespace-nowrap tabular-nums', GRIS)}>
                                    {activeChat.type === 'group' ? (
                                        <>
                                            <span className="truncate">{t('internalChat.vista.groupHeader', { count: activeChat.participants.length })}</span>
                                            <span className="text-[#2e3f84]/30 dark:text-white/30" aria-hidden="true">·</span>
                                            <span className="inline-flex shrink-0 items-center gap-[5px] font-medium text-emerald-700 dark:text-emerald-400">
                                                <span className="size-[7px] rounded-full bg-emerald-500" aria-hidden="true" />
                                                {t('internalChat.vista.onlineCount', { count: enLineaGrupo })}
                                            </span>
                                        </>
                                    ) : otroDirecto?.is_online ? (
                                        <>
                                            <span className="inline-flex shrink-0 items-center gap-[5px] font-medium text-emerald-700 dark:text-emerald-400">
                                                <span className="size-[7px] rounded-full bg-emerald-500" aria-hidden="true" />
                                                {t('internalChat.online')}
                                            </span>
                                            <span className="text-[#2e3f84]/30 dark:text-white/30" aria-hidden="true">·</span>
                                            <span className="truncate">{esChatIa ? t('internalChat.vista.botSubtitle') : t('internalChat.direct')}</span>
                                        </>
                                    ) : (
                                        <span className="truncate">{esChatIa ? t('internalChat.vista.botSubtitle') : `${t('internalChat.offline')} · ${t('internalChat.direct')}`}</span>
                                    )}
                                </p>
                            </div>

                            <div className="flex shrink-0 items-center gap-1.5">
                                {activeChat.type === 'group' && (
                                    <button type="button" onClick={() => handleShowParticipants(activeChat)} title={t('internalChat.vista.detailsHint')} className={cn(BOTON_SECUNDARIO, 'hidden h-[34px] pr-3.5 pl-3 sm:inline-flex')}>
                                        <Users aria-hidden="true" />
                                        {t('internalChat.vista.details')}
                                    </button>
                                )}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button type="button" className={cn(BOTON_ICONO_CHAT, 'size-[34px]', TEXTO_NAVY)} title={t('internalChat.vista.more')} aria-label={t('internalChat.vista.more')}>
                                            <Ellipsis className="size-[18px]" strokeWidth={1.9} aria-hidden="true" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className={cn('w-56 rounded-xl border-0 p-1.5', SOMBRA_FLOTA)}>
                                        {activeChat.type === 'group' && creadorActivo && (
                                            <DropdownMenuItem onClick={() => handleRenameChat(activeChat)} className={cn('h-9 cursor-pointer gap-2.5 rounded-lg px-2.5 text-[13px] font-medium', TEXTO_NAVY)}>
                                                <Pencil className="size-4" strokeWidth={1.9} />
                                                {t('internalChat.renameGroup')}
                                            </DropdownMenuItem>
                                        )}
                                        {activeChat.type === 'group' && (
                                            <DropdownMenuItem onClick={() => handleShowParticipants(activeChat)} className={cn('h-9 cursor-pointer gap-2.5 rounded-lg px-2.5 text-[13px] font-medium', TEXTO_NAVY)}>
                                                <Users className="size-4" strokeWidth={1.9} />
                                                {t('internalChat.viewParticipants', { count: activeChat.participants.length })}
                                            </DropdownMenuItem>
                                        )}
                                        {activeChat.type === 'group' && <DropdownMenuSeparator />}
                                        <DropdownMenuItem
                                            onClick={() => handleDeleteChat(activeChat)}
                                            className="h-9 cursor-pointer gap-2.5 rounded-lg px-2.5 text-[13px] font-medium text-red-700 focus:bg-red-50 focus:text-red-700 dark:text-red-300 dark:focus:bg-red-500/10 dark:focus:text-red-300"
                                        >
                                            {activeChat.type === 'group' && !creadorActivo ? <LogOut className="size-4 text-current" strokeWidth={1.9} /> : <Trash2 className="size-4 text-current" strokeWidth={1.9} />}
                                            {getDeleteChatLabel(activeChat)}…
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </header>

                        {esChatIa && (
                            <FranjaInfo titulo={t('internalChat.vista.aiBannerTitle')}>
                                {t('internalChat.vista.aiBannerText', { name: otroDirecto?.name ?? activeChat.name })}
                            </FranjaInfo>
                        )}

                        {/* Mensajes */}
                        <div
                            ref={messagesContainerRef}
                            onScroll={handleMessagesScroll}
                            className="custom-scrollbar chat-messages-scroll relative min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-3 pb-4 md:px-7"
                        >
                            {messages.length === 0 ? (
                                <Vacio icono={MessageSquare} titulo={t('internalChat.vista.noMessagesTitle')} texto={t('internalChat.vista.noMessagesText')} className="h-full" />
                            ) : (
                                <div className="flex min-h-full flex-col justify-end">
                                    {messages.map((msg, idx) => {
                                        // Primer mensaje de un grupo (cambia el remitente) → lleva nombre, cara y la esquina «colita».
                                        const fecha = fechaDe(msg);
                                        const fechaPrevia = idx > 0 ? fechaDe(messages[idx - 1]) : null;
                                        const cambiaDia = !!fecha && (idx === 0 || !fechaPrevia || claveDia(fecha) !== claveDia(fechaPrevia));
                                        const isFirstOfGroup = idx === 0 || cambiaDia || messages[idx - 1].user?.id !== msg.user?.id;
                                        // Quién llegó a leer hasta aquí (ver receiptsByMessageId).
                                        const readersHere = receiptsByMessageId.get(msg.id) ?? [];
                                        const propia = msg.is_mine;
                                        const conCara = !propia && (activeChat.type === 'group' || esChatIa);
                                        const autor = availableUsers.find(u => u.id === msg.user?.id) ?? activeChat.participants.find(p => p.id === msg.user?.id);
                                        const pendiente = esPendiente(msg);
                                        const tieneAdjunto = msg.type !== 'text' && (!!msg.file_url || !!msg.file_missing || pendiente);
                                        const mostrarTexto = !!msg.body && !(pendiente && msg.type !== 'text');
                                        const huecoHora = Math.round((msg.edited ? 58 : 0) + 52 + (propia ? 16 : 0));
                                        const meta = (
                                            <MetaMensaje hora={msg.created_at} editado={msg.edited} textoEditado={t('internalChat.edited')} propia={propia} textoEnviado={t('internalChat.vista.sent')} />
                                        );

                                        return (
                                            <div key={msg.id}>
                                                {cambiaDia && fecha && <SeparadorDia texto={textoDia(fecha)} />}
                                                <div className={cn('flex items-start gap-2', propia ? 'justify-end' : 'justify-start', isFirstOfGroup ? 'mt-2.5' : 'mt-[3px]')}>
                                                    {conCara && (isFirstOfGroup
                                                        ? <AvatarPersona nombre={msg.user?.name ?? ''} rol={autor?.role} enLinea={!!autor?.is_online} tam={30} anillo="ring-[#f4f5f9] dark:ring-background" />
                                                        : <span className="w-[30px] shrink-0" aria-hidden="true" />)}
                                                    <div
                                                        id={`msg-${msg.id}`}
                                                        className={cn('group/msg flex min-w-0 flex-col', propia ? 'items-end' : 'items-start', 'max-w-[85%] md:max-w-[min(560px,72%)]')}
                                                    >
                                                        <div className="relative max-w-full">
                                                            <Burbuja
                                                                propia={propia}
                                                                primero={isFirstOfGroup}
                                                                onContextMenu={(e) => { e.preventDefault(); abrirMenuMensaje(msg, e.clientX, e.clientY); }}
                                                                onTouchStart={alPulsarLargo(msg)}
                                                                onTouchEnd={cancelarPulsacion}
                                                                onTouchMove={cancelarPulsacion}
                                                                className={cn(msgMenu?.msg.id === msg.id && 'outline-2 outline-offset-1 outline-[#2e3f84]/15 dark:outline-white/20')}
                                                            >
                                                                {conCara && isFirstOfGroup && activeChat.type === 'group' && msg.user && (
                                                                    <NombreAutor nombre={msg.user.name} etiqueta={autor?.role === 'admin' ? t('internalChat.roleAdmin') : undefined} />
                                                                )}

                                                                {msg.reply_to && (() => {
                                                                    const r = resumenCita(msg.reply_to);
                                                                    return <CajaCitada autor={msg.reply_to.user_name} texto={r.texto} icono={r.icono} propia={propia} titulo={t('internalChat.vista.goToOriginal')} onClick={() => irAlMensaje(msg.reply_to!.id)} />;
                                                                })()}

                                                                {/* Imagen */}
                                                                {msg.type === 'image' && msg.file_url && (
                                                                    <div className="-mx-[5px] mt-px mb-[7px]">
                                                                        <div
                                                                            className="group relative cursor-pointer overflow-hidden rounded-lg shadow-[inset_0_0_0_1px_rgba(46,63,132,0.12)]"
                                                                            title={t('internalChat.vista.openLarge')}
                                                                            onClick={(e) => {
                                                                                // No abrir visor si la imagen no se cargó
                                                                                if ((e.currentTarget as HTMLElement).dataset.unavailable === '1') return;
                                                                                setMediaViewer({
                                                                                    url: msg.file_url!,
                                                                                    type: 'image',
                                                                                    caption: msg.body && msg.body !== t('internalChat.image') ? msg.body : undefined
                                                                                });
                                                                                setZoomLevel(1);
                                                                                setImagePosition({ x: 0, y: 0 });
                                                                            }}
                                                                        >
                                                                            <img
                                                                                src={msg.file_url}
                                                                                alt={msg.file_name || t('internalChat.image')}
                                                                                className="block max-h-72 w-auto max-w-[260px] sm:max-w-[320px] object-cover"
                                                                                loading="lazy"
                                                                                onError={(e) => {
                                                                                    const img = e.currentTarget;
                                                                                    img.onerror = null;
                                                                                    // Placeholder SVG: imagen no disponible
                                                                                    img.src = `data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 220' width='320' height='220'%3E%3Crect width='320' height='220' fill='%23e5e7eb'/%3E%3Cg fill='%239ca3af'%3E%3Cpath d='M120 80h80v60h-80z' fill='none' stroke='%239ca3af' stroke-width='3'/%3E%3Ccircle cx='140' cy='100' r='6'/%3E%3Cpath d='M125 135l20-20 20 15 15-25 25 30v5h-80z'/%3E%3C/g%3E%3Ctext x='160' y='175' text-anchor='middle' font-family='Arial, sans-serif' font-size='14' fill='%236b7280'%3E${encodeURIComponent(t('internalChat.imageUnavailable'))}%3C/text%3E%3Ctext x='160' y='195' text-anchor='middle' font-family='Arial, sans-serif' font-size='11' fill='%239ca3af'%3E${encodeURIComponent(t('internalChat.filePreMigration'))}%3C/text%3E%3C/svg%3E`;
                                                                                    img.classList.add('opacity-80');
                                                                                    const wrapper = img.closest('.group') as HTMLElement | null;
                                                                                    if (wrapper) {
                                                                                        wrapper.dataset.unavailable = '1';
                                                                                        wrapper.classList.remove('cursor-pointer');
                                                                                        wrapper.classList.add('cursor-not-allowed');
                                                                                    }
                                                                                }}
                                                                            />
                                                                            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-200 group-hover:bg-black/20">
                                                                                <Expand className="size-7 text-white opacity-0 drop-shadow-lg transition-opacity duration-200 group-hover:opacity-100" aria-hidden="true" />
                                                                            </div>
                                                                            {msg.file_name && (
                                                                                <span className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate rounded-[5px] bg-[rgba(28,34,56,0.72)] px-[7px] py-0.5 font-mono text-[11px] leading-[14px] text-white">
                                                                                    {msg.file_name}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Video */}
                                                                {msg.type === 'video' && msg.file_url && (
                                                                    <div className="-mx-[5px] mt-px mb-[7px]">
                                                                        <div
                                                                            className="group relative cursor-pointer overflow-hidden rounded-lg"
                                                                            title={t('internalChat.vista.openLarge')}
                                                                            onClick={() => {
                                                                                setMediaViewer({
                                                                                    url: msg.file_url!,
                                                                                    type: 'video',
                                                                                    caption: msg.body && msg.body !== t('internalChat.video') ? msg.body : undefined
                                                                                });
                                                                            }}
                                                                        >
                                                                            <video src={msg.file_url} className="block max-h-72 max-w-[260px] sm:max-w-[320px]" preload="metadata" />
                                                                            <div className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors duration-200 group-hover:bg-black/25">
                                                                                <span className="flex size-11 items-center justify-center rounded-full bg-[rgba(17,27,33,0.55)] text-white">
                                                                                    <Play className="size-5" strokeWidth={2} aria-hidden="true" />
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Documento */}
                                                                {msg.type === 'document' && msg.file_url && (
                                                                    <AdjuntoDocumento nombre={msg.file_name || t('internalChat.file')} tipo={tipoDocumento(msg.file_name)} peso={msg.file_size_human} url={msg.file_url} propia={propia} textoDescargar={t('common.download')} />
                                                                )}

                                                                {/* Audio */}
                                                                {msg.type === 'audio' && msg.file_url && (
                                                                    <div className="mt-px mb-1.5">
                                                                        <audio src={msg.file_url} controls className="h-10 max-w-full" preload="metadata" />
                                                                    </div>
                                                                )}

                                                                {/* Archivo no disponible (perdido en migración) */}
                                                                {msg.file_missing && msg.type !== 'text' && (
                                                                    <ArchivoNoDisponible titulo={t('internalChat.fileUnavailable')} nombre={msg.file_name || t('internalChat.filePreMigrationName')} />
                                                                )}

                                                                {/* Subiendo (mensaje optimista con archivo) */}
                                                                {pendiente && msg.type !== 'text' && !msg.file_url && (
                                                                    <AdjuntoSubiendo nombre={msg.file_name || t('internalChat.file')} peso={msg.file_size_human} texto={t('common.sending')} />
                                                                )}

                                                                {/* Texto (con @menciones y *negrita*) */}
                                                                {mostrarTexto && (
                                                                    <TextoMensaje texto={msg.body} personas={personasMencionables} miId={auth.user.id} propia={propia} hueco={tieneAdjunto ? 0 : huecoHora} />
                                                                )}

                                                                {tieneAdjunto || !mostrarTexto
                                                                    ? <div className="mt-0.5 flex justify-end">{meta}</div>
                                                                    : <span className="absolute right-2.5 bottom-[5px]">{meta}</span>}
                                                            </Burbuja>

                                                            {/* Acciones al pasar el ratón: reaccionar, responder, editar. La franja exterior es transparente,
                                                                ocupa todo el alto de la burbuja y cubre el hueco de 8 px hasta la barra: al llevar el ratón a los
                                                                botones nunca se sale del mensaje, así que la barra no desaparece por el camino. */}
                                                            <div
                                                                className={cn(
                                                                    'absolute inset-y-0 z-10 flex items-center transition-opacity duration-150 max-md:hidden',
                                                                    propia ? 'right-full pr-2' : 'left-full pl-2',
                                                                    reactionPickerFor === msg.id ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none group-hover/msg:opacity-100 group-hover/msg:pointer-events-auto group-focus-within/msg:opacity-100 group-focus-within/msg:pointer-events-auto'
                                                                )}
                                                            >
                                                                <div className={cn('flex h-[34px] items-center gap-px rounded-[10px] bg-white px-[3px] dark:bg-neutral-900', SOMBRA_FLOTA)}>
                                                                    <div className="relative" data-selector-reacciones>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setReactionPickerFor(reactionPickerFor === msg.id ? null : msg.id)}
                                                                            className={cn(BOTON_ICONO_CHAT, 'size-7')}
                                                                            title={t('internalChat.react')}
                                                                            aria-label={t('internalChat.react')}
                                                                        >
                                                                            <SmilePlus className="size-4" strokeWidth={1.9} aria-hidden="true" />
                                                                        </button>
                                                                        {reactionPickerFor === msg.id && (
                                                                            <>
                                                                                <motion.div
                                                                                    initial={{ opacity: 0, scale: 0.6, y: 12 }}
                                                                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                                                                    transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                                                                                    style={{ transformOrigin: 'bottom center' }}
                                                                                    className={cn(
                                                                                        'absolute bottom-full z-30 mb-2 flex h-[46px] items-center gap-0.5 rounded-full bg-white px-1.5 dark:bg-neutral-900',
                                                                                        SOMBRA_FLOTA,
                                                                                        propia ? 'right-0' : 'left-0'
                                                                                    )}
                                                                                >
                                                                                    {QUICK_REACTIONS.map((emoji, i) => (
                                                                                        <motion.button
                                                                                            key={emoji}
                                                                                            initial={{ opacity: 0, scale: 0, y: 10 }}
                                                                                            animate={{ opacity: 1, scale: 1, y: 0, transition: { delay: 0.04 + i * 0.035, type: 'spring', stiffness: 600, damping: 18 } }}
                                                                                            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                                                                                            whileHover={{ scale: 1.35, y: -14, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] } }}
                                                                                            whileTap={{ scale: 0.9, transition: { duration: 0.12, ease: [0.22, 1, 0.36, 1] } }}
                                                                                            // Reaccionar al PRESIONAR (pointerdown), no al click: whileHover/whileTap
                                                                                            // desplazan y encogen el emoji, así que al soltar el puntero ya no está
                                                                                            // encima y el navegador nunca dispara "click" → la reacción se perdía.
                                                                                            onPointerDown={(e) => { if (e.button === 0) handleReact(msg, emoji); }}
                                                                                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleReact(msg, emoji); } }}
                                                                                            aria-label={REACTION_LABELS[emoji]}
                                                                                            className="group relative flex size-[38px] cursor-pointer items-center justify-center rounded-full text-[24px] leading-none hover:bg-[#2e3f84]/7 dark:hover:bg-white/8"
                                                                                        >
                                                                                            <span className="pointer-events-none absolute -top-[26px] left-1/2 flex h-5 -translate-x-1/2 items-center rounded-md bg-[#1c2238] px-[7px] text-[11px] leading-[14px] font-semibold whitespace-nowrap text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:bg-white dark:text-[#1c2238]">
                                                                                                {REACTION_LABELS[emoji]}
                                                                                            </span>
                                                                                            {emoji}
                                                                                        </motion.button>
                                                                                    ))}
                                                                                </motion.div>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => { setReplyingTo(msg); textareaRef.current?.focus(); }}
                                                                        className={cn(BOTON_ICONO_CHAT, 'size-7')}
                                                                        title={t('internalChat.reply')}
                                                                        aria-label={t('internalChat.reply')}
                                                                    >
                                                                        <Reply className="size-4" strokeWidth={1.9} aria-hidden="true" />
                                                                    </button>
                                                                    {msg.is_mine && msg.type === 'text' && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => startEdit(msg)}
                                                                            className={cn(BOTON_ICONO_CHAT, 'size-7')}
                                                                            title={t('common.edit')}
                                                                            aria-label={t('common.edit')}
                                                                        >
                                                                            <Pencil className="size-[15px]" strokeWidth={1.9} aria-hidden="true" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Reacciones */}
                                                        {msg.reactions && msg.reactions.length > 0 && (
                                                            <Reacciones reacciones={msg.reactions} propia={propia} onReaccionar={(emoji) => handleReact(msg, emoji)} tituloQuitar={t('internalChat.vista.removeYours')} />
                                                        )}

                                                        {/* Vistos */}
                                                        {readersHere.length > 0 && (
                                                            <Visto
                                                                conReacciones={!!msg.reactions?.length}
                                                                titulo={readersHere.map(r => nombreVisible(r.user_name)).join(', ')}
                                                                texto={activeChat.type === 'group'
                                                                    ? t('internalChat.seenBy', { names: listaNombres(readersHere.map(r => nombreCorto(r.user_name)), t('internalChat.vista.and')) })
                                                                    : t('internalChat.vista.seen')}
                                                            />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {aiTyping && (
                                        <div className="mt-2.5 flex items-start gap-2" role="status">
                                            <AvatarPersona nombre={otroDirecto?.name ?? activeChat.name} rol="ai" enLinea tam={30} anillo="ring-[#f4f5f9] dark:ring-background" />
                                            <div className="flex h-9 items-center gap-2 rounded-xl rounded-tl-[4px] bg-white px-3 shadow-[0_0_0_1px_rgba(46,63,132,0.07),0_1px_2px_rgba(46,63,132,0.06)] dark:bg-neutral-800 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07)]">
                                                <span className={cn('text-[12.5px] leading-4 font-medium whitespace-nowrap', GRIS)}>{t('internalChat.aiTyping')}</span>
                                                <span className="flex gap-[3px]" aria-hidden="true">
                                                    <span className="size-1.5 animate-bounce rounded-full bg-[#2e3f84]/70 dark:bg-[#b4bff0]/80" style={{ animationDelay: '0ms' }} />
                                                    <span className="size-1.5 animate-bounce rounded-full bg-[#2e3f84]/45 dark:bg-[#b4bff0]/55" style={{ animationDelay: '150ms' }} />
                                                    <span className="size-1.5 animate-bounce rounded-full bg-[#2e3f84]/25 dark:bg-[#b4bff0]/35" style={{ animationDelay: '300ms' }} />
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>
                            )}
                        </div>

                        {/* Compositor */}
                        <form onSubmit={handleSendMessage} className={cn('relative z-[3] flex shrink-0 flex-col gap-2 px-2.5 pt-2 pb-2.5 shadow-[0_-1px_0_rgba(46,63,132,0.08)] md:px-5 md:pt-2.5 md:pb-3 dark:shadow-[0_-1px_0_rgba(255,255,255,0.08)]', HOJA_CHAT)}>
                            {/* @Mentions dropdown */}
                            {showMentions && mentionUsers.length > 0 && (
                                <div className={cn('absolute bottom-full left-2.5 z-50 mb-2 flex max-h-64 w-[calc(100%-1.25rem)] max-w-[540px] flex-col rounded-xl bg-white p-1.5 md:left-14 dark:bg-neutral-900', SOMBRA_FLOTA)} role="listbox" aria-label={t('internalChat.vista.mentionTitle')}>
                                    <div className={cn('flex items-center justify-between gap-3 px-2.5 pt-1 pb-1.5 text-[11.5px] leading-4 font-medium', GRIS)}>
                                        <span className="truncate">{activeChat.type === 'group' ? t('internalChat.vista.mentionTitle') : t('internalChat.vista.mentionTitleAll')}</span>
                                        <span className="hidden shrink-0 sm:inline">{t('internalChat.vista.mentionKeys')}</span>
                                    </div>
                                    <div className="custom-scrollbar-light min-h-0 overflow-y-auto">
                                        {mentionUsers.map((user, i) => (
                                            <button
                                                key={user.id}
                                                type="button"
                                                role="option"
                                                aria-selected={i === mentionIndex}
                                                className={cn(
                                                    'flex h-[42px] w-full items-center gap-2.5 rounded-lg px-2.5 text-left transition-colors',
                                                    i === mentionIndex ? 'bg-[#e5e9f6] dark:bg-white/10' : 'hover:bg-[#2e3f84]/[0.04] dark:hover:bg-white/[0.05]'
                                                )}
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    insertMention(user);
                                                }}
                                                onMouseEnter={() => setMentionIndex(i)}
                                            >
                                                <AvatarPersona nombre={user.name} rol={user.role} enLinea={user.is_online} tam={26} anillo={i === mentionIndex ? 'ring-[#e5e9f6] dark:ring-neutral-800' : 'ring-white dark:ring-neutral-900'} />
                                                <span className={cn('min-w-0 flex-1 truncate text-[13px] leading-[18px]', i === mentionIndex ? 'font-semibold' : 'font-medium', TEXTO_NAVY)}>{nombreVisible(user.name)}</span>
                                                <span className={cn('shrink-0 text-[12px] leading-4', GRIS)}>{rolTexto(user.role)}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {replyingTo && (() => {
                                const r = resumenCita(replyingTo);
                                return (
                                    <FranjaCompositor
                                        tipo="responder"
                                        titulo={t('internalChat.vista.replyingTo', { name: replyingTo.is_mine ? t('common.you') : nombreVisible(replyingTo.user.name) })}
                                        texto={r.texto}
                                        icono={r.icono}
                                        tituloCerrar={t('internalChat.vista.removeReply')}
                                        onCerrar={() => setReplyingTo(null)}
                                    />
                                );
                            })()}
                            {editingMessage && (
                                <FranjaCompositor tipo="editar" titulo={t('internalChat.vista.editingYours')} texto={editingMessage.body} tituloCerrar={t('internalChat.cancelEdit')} onCerrar={cancelEdit} />
                            )}
                            <div
                                className={cn(
                                    'relative flex items-end gap-1.5 rounded-xl bg-white p-1 transition-shadow dark:bg-white/[0.04]',
                                    'shadow-[inset_0_0_0_1px_rgba(46,63,132,0.22)] focus-within:shadow-[inset_0_0_0_1px_#2e3f84,0_0_0_3px_rgba(46,63,132,0.1)]',
                                    'dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)] dark:focus-within:shadow-[inset_0_0_0_1px_#8b9ae0,0_0_0_3px_rgba(139,154,224,0.25)]'
                                )}
                            >
                                {/* Hidden file input */}
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    onChange={handleFileUpload}
                                />

                                <button
                                    type="button"
                                    className={cn(BOTON_ICONO_CHAT, 'size-9')}
                                    onClick={() => fileInputRef.current?.click()}
                                    title={t('internalChat.vista.attachHint')}
                                    aria-label={t('internalChat.attachFile')}
                                    disabled={isUploading}
                                >
                                    <Paperclip className="size-[18px]" strokeWidth={1.9} aria-hidden="true" />
                                </button>

                                {/* Text input */}
                                <div className="relative min-w-0 flex-1">
                                    <Textarea
                                        ref={textareaRef}
                                        value={inputText}
                                        onChange={handleInputChange}
                                        placeholder={t('internalChat.vista.messagePlaceholder')}
                                        aria-label={t('internalChat.vista.messageLabel')}
                                        className={cn(
                                            'custom-scrollbar-light max-h-[120px] min-h-9 w-full resize-none rounded-none border-0 bg-transparent px-1 py-2 text-[14px] leading-5 shadow-none placeholder:text-[#5c6485] focus-visible:ring-0 md:text-[14px] dark:bg-transparent dark:placeholder:text-neutral-400',
                                            TINTA
                                        )}
                                        onKeyDown={handleKeyDown}
                                        onPaste={handlePaste}
                                    />
                                </div>

                                {/* Send button */}
                                <button
                                    type="submit"
                                    disabled={(!inputText.trim() && !isUploading) || isUploading}
                                    title={editingMessage ? t('internalChat.vista.saveEnter') : t('internalChat.vista.sendEnter')}
                                    aria-label={editingMessage ? t('internalChat.vista.saveEnter') : t('internalChat.vista.sendEnter')}
                                    className={cn(
                                        'flex size-9 shrink-0 items-center justify-center rounded-[9px] transition-colors',
                                        FOCO,
                                        'bg-[#2e3f84] text-white shadow-[0_1px_2px_rgba(46,63,132,0.3),inset_0_1px_0_rgba(255,255,255,0.14)] hover:bg-[#27366f] dark:bg-[#4e5fa4] dark:hover:bg-[#5a6bb2]',
                                        'disabled:cursor-not-allowed disabled:bg-[#2e3f84]/10 disabled:text-[#2e3f84]/45 disabled:shadow-none dark:disabled:bg-white/8 dark:disabled:text-white/40',
                                        isUploading && 'disabled:bg-[#2e3f84] disabled:text-white dark:disabled:bg-[#4e5fa4] dark:disabled:text-white'
                                    )}
                                >
                                    {isUploading ? (
                                        <span className="size-[18px] animate-spin rounded-full border-2 border-white/50 border-t-white" aria-hidden="true" />
                                    ) : editingMessage ? (
                                        <Check className="size-[17px]" strokeWidth={2.2} aria-hidden="true" />
                                    ) : (
                                        <Send className="size-4" strokeWidth={2} aria-hidden="true" />
                                    )}
                                </button>
                            </div>
                            <AyudaTeclas teclas={TECLAS} derecha={t('internalChat.vista.maxSize')} />
                        </form>

                        {/* Detalles del grupo */}
                        {showParticipantsModal && activeChat.type === 'group' && (
                            <PanelDetalles
                                nombreGrupo={activeChat.name}
                                participantes={activeChat.participants}
                                miId={auth.user.id}
                                creadorId={activeChat.created_by}
                                soyCreador={creadorActivo}
                                vista={showAddParticipants && creadorActivo ? 'anadir' : 'personas'}
                                t={textosDetalles}
                                onCerrar={() => setShowParticipantsModal(false)}
                                onRenombrar={() => handleRenameChat(activeChat)}
                                onVerAnadir={() => setShowAddParticipants(true)}
                                onVolver={() => { setShowAddParticipants(false); setAddParticipantSearch(''); setAddParticipantIds([]); }}
                                onQuitar={(p) => setConfirmacion({ tipo: 'quitar', chat: activeChat, persona: p })}
                                onEliminarOSalir={() => handleDeleteChat(activeChat)}
                                busqueda={addParticipantSearch}
                                onBusqueda={setAddParticipantSearch}
                                candidatos={candidatosAnadir}
                                elegidos={addParticipantIds}
                                onMarcar={(id) => setAddParticipantIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                                anadiendo={isAddingParticipants}
                                onAnadir={anadirParticipantes}
                            />
                        )}
                    </div>
                )}
            </div>

            {/* Menú de un mensaje (clic derecho; en el celular, mantener pulsado): las mismas acciones de siempre */}
            {msgMenu && (() => {
                const m = msgMenu.msg;
                const editable = m.is_mine && m.type === 'text';
                const verGrande = (m.type === 'image' || m.type === 'video') && !!m.file_url;
                const descargable = m.type !== 'text' && !!m.file_url;
                const alto = 12 + 36 * (2 + (editable ? 1 : 0) + (verGrande ? 1 : 0) + (descargable ? 1 : 0)) + (verGrande || descargable ? 11 : 0);
                return (
                    <MenuFlotante x={msgMenu.x} y={msgMenu.y} ancho={236} alto={alto} etiqueta={t('internalChat.vista.messageActions')}>
                        <OpcionMenu icono={SmilePlus} onClick={() => { setMsgMenu(null); setReactionPickerFor(m.id); }}>
                            {t('internalChat.react')}
                        </OpcionMenu>
                        <OpcionMenu icono={Reply} onClick={() => { setMsgMenu(null); setReplyingTo(m); textareaRef.current?.focus(); }}>
                            {t('internalChat.reply')}
                        </OpcionMenu>
                        {editable && (
                            <OpcionMenu icono={Pencil} onClick={() => { setMsgMenu(null); startEdit(m); }}>
                                {t('common.edit')}
                            </OpcionMenu>
                        )}
                        {(verGrande || descargable) && <SeparadorMenu />}
                        {verGrande && (
                            <OpcionMenu icono={Expand} onClick={() => { setMsgMenu(null); abrirVisor(m); }}>
                                {t('internalChat.vista.viewLarge')}
                            </OpcionMenu>
                        )}
                        {descargable && (
                            <a
                                href={m.file_url!}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                role="menuitem"
                                onClick={() => setMsgMenu(null)}
                                className={cn('flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] leading-[18px] font-medium whitespace-nowrap transition-colors hover:bg-[#2e3f84]/[0.055] dark:hover:bg-white/8', FOCO, TEXTO_NAVY)}
                            >
                                <Download className="size-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
                                {t('common.download')}
                            </a>
                        )}
                    </MenuFlotante>
                );
            })()}

            {/* Nuevo chat o grupo */}
            <DialogoPlantilla
                abierto={showCreateGroup}
                onCerrar={() => setShowCreateGroup(false)}
                icono={Plus}
                titulo={t('internalChat.newChatOrGroup')}
                sub={t('internalChat.vista.newSub')}
                cerrarConX
                ancho="max-w-[470px]"
                pie={
                    <>
                        <button
                            type="button"
                            onClick={() => {
                                setShowCreateGroup(false);
                                setGroupName('');
                                setSelectedUserIds([]);
                                setUserSearchQuery('');
                            }}
                            className={BOTON_SECUNDARIO}
                        >
                            {t('common.cancel')}
                        </button>
                        <button type="button" onClick={handleCreateGroup} disabled={selectedUserIds.length === 0 || isCreatingGroup} className={BOTON_PRIMARIO}>
                            {isCreatingGroup
                                ? <span className="size-4 animate-spin rounded-full border-2 border-white/50 border-t-white" aria-hidden="true" />
                                : selectedUserIds.length > 1 ? <Users aria-hidden="true" /> : <MessageSquare aria-hidden="true" />}
                            {selectedUserIds.length > 1 ? t('internalChat.createGroup') : t('internalChat.startChat')}
                        </button>
                    </>
                }
            >
                {/* Nombre del grupo (solo con varias personas) */}
                {selectedUserIds.length > 1 && (
                    <div className="flex flex-col gap-[7px]">
                        <label htmlFor="nuevo-grupo-nombre" className={ETIQUETA}>
                            {t('internalChat.groupNameLabel')} <span className={cn('font-normal', GRIS)}>{t('internalChat.vista.groupNameOptional')}</span>
                        </label>
                        <input
                            id="nuevo-grupo-nombre"
                            type="text"
                            placeholder={t('internalChat.groupNamePlaceholder')}
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            className={CAMPO}
                        />
                    </div>
                )}

                <div className="flex flex-col gap-[7px]">
                    <div className="flex items-baseline justify-between gap-3">
                        <label htmlFor="nuevo-chat-buscar" className={ETIQUETA}>{t('internalChat.vista.people')}</label>
                        {selectedUserIds.length > 0 && <span className={cn('text-[12px] leading-4 tabular-nums', GRIS)}>{t('internalChat.vista.chosen', { count: selectedUserIds.length })}</span>}
                    </div>
                    <div className="relative">
                        <Search className={cn('pointer-events-none absolute top-1/2 left-[11px] size-4 -translate-y-1/2', GRIS)} strokeWidth={1.75} aria-hidden="true" />
                        <input
                            id="nuevo-chat-buscar"
                            type="text"
                            placeholder={t('internalChat.vista.searchByName')}
                            value={userSearchQuery}
                            onChange={(e) => setUserSearchQuery(e.target.value)}
                            className={cn(CAMPO, 'pl-9 font-normal')}
                        />
                    </div>
                    {selectedUserIds.length > 0 && (
                        <div className="custom-scrollbar-light flex max-h-[76px] flex-wrap gap-1.5 overflow-y-auto pt-0.5">
                            {selectedUserIds.map(uid => {
                                const user = availableUsers.find(u => u.id === uid);
                                if (!user) return null;
                                return (
                                    <span key={uid} className={cn('inline-flex h-[26px] items-center gap-1 rounded-full bg-[#e5e9f6] pr-1 pl-2.5 text-[12.5px] leading-4 font-semibold whitespace-nowrap shadow-[inset_0_0_0_1px_rgba(46,63,132,0.16)] dark:bg-white/10 dark:shadow-none', TEXTO_NAVY)}>
                                        {nombreVisible(user.name).split(' ').slice(0, 2).join(' ')}
                                        <button
                                            type="button"
                                            onClick={() => toggleUserSelection(uid)}
                                            title={t('internalChat.vista.unselect', { name: nombreVisible(user.name) })}
                                            aria-label={t('internalChat.vista.unselect', { name: nombreVisible(user.name) })}
                                            className={cn(BOTON_ICONO_CHAT, 'size-5 rounded-full')}
                                        >
                                            <X className="size-[13px]" strokeWidth={2.2} aria-hidden="true" />
                                        </button>
                                    </span>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="custom-scrollbar-light -mx-2 flex max-h-[300px] flex-col overflow-x-hidden overflow-y-auto">
                    {filteredUsers.length === 0 ? (
                        <div className={cn('p-4 text-center text-[13px]', GRIS)}>{t('internalChat.noUsersFound')}</div>
                    ) : (
                        filteredUsers.map(user => {
                            const isSelected = selectedUserIds.includes(user.id);
                            return (
                                <button
                                    key={user.id}
                                    type="button"
                                    role="checkbox"
                                    aria-checked={isSelected}
                                    onClick={() => toggleUserSelection(user.id)}
                                    className={cn(
                                        'flex h-[50px] w-full shrink-0 cursor-pointer items-center gap-[11px] rounded-[9px] px-2 text-left transition-colors',
                                        FOCO,
                                        isSelected ? 'bg-[#2e3f84]/5 dark:bg-white/[0.06]' : 'hover:bg-[#2e3f84]/[0.035] dark:hover:bg-white/[0.04]'
                                    )}
                                >
                                    <span
                                        className={cn(
                                            'flex size-[18px] shrink-0 items-center justify-center rounded-[5px]',
                                            isSelected ? 'bg-[#2e3f84] text-white dark:bg-[#8b9ae0] dark:text-neutral-900' : 'bg-white shadow-[inset_0_0_0_1.5px_var(--color-slate-500)] dark:bg-transparent dark:shadow-[inset_0_0_0_1.5px_var(--color-neutral-400)]'
                                        )}
                                        aria-hidden="true"
                                    >
                                        {isSelected && <Check className="size-3" strokeWidth={3} />}
                                    </span>
                                    <AvatarPersona nombre={user.name} rol={user.role} enLinea={user.is_online} tam={32} anillo="ring-white dark:ring-card" />
                                    <span className="flex min-w-0 flex-1 flex-col gap-px">
                                        <span className={cn('truncate text-[13px] leading-[18px]', isSelected ? 'font-semibold' : 'font-medium', TEXTO_NAVY)}>{nombreVisible(user.name)}</span>
                                        <span className={cn('flex items-center gap-1.5 text-[12px] leading-4 whitespace-nowrap', GRIS)}>
                                            {rolTexto(user.role)}
                                            {user.is_online && <span className="font-medium text-emerald-700 dark:text-emerald-400">· {t('internalChat.online')}</span>}
                                        </span>
                                    </span>
                                </button>
                            );
                        })
                    )}
                </div>

                <p className={cn('flex items-start gap-2 text-[12.5px] leading-[18px]', GRIS)}>
                    <Users className={cn('mt-0.5 size-3.5 shrink-0', ACENTO)} strokeWidth={2} aria-hidden="true" />
                    <span>
                        {selectedUserIds.length === 0
                            ? t('internalChat.hintNoSelection')
                            : selectedUserIds.length === 1
                                ? t('internalChat.vista.hintDirect')
                                : t('internalChat.vista.hintGroup', { count: selectedUserIds.length })}
                    </span>
                </p>
            </DialogoPlantilla>

            {/* Renombrar grupo */}
            <DialogoPlantilla
                abierto={showRenameModal}
                onCerrar={() => setShowRenameModal(false)}
                icono={Pencil}
                titulo={t('internalChat.renameGroup')}
                sub={t('internalChat.vista.renameSub')}
                cerrarConX
                ancho="max-w-[400px]"
                pie={
                    <>
                        <button type="button" onClick={() => setShowRenameModal(false)} className={BOTON_SECUNDARIO}>
                            {t('common.cancel')}
                        </button>
                        <button type="button" onClick={guardarNombre} disabled={!renameValue.trim()} className={BOTON_PRIMARIO}>
                            <Check aria-hidden="true" />
                            {t('common.save')}
                        </button>
                    </>
                }
            >
                <div className="flex flex-col gap-[7px]">
                    <label htmlFor="renombrar-grupo" className={ETIQUETA}>{t('internalChat.groupNameLabel')}</label>
                    <input
                        id="renombrar-grupo"
                        type="text"
                        maxLength={100}
                        placeholder={t('internalChat.groupNameLabel')}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        className={CAMPO}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && renameValue.trim()) {
                                e.preventDefault();
                                void guardarNombre();
                            }
                        }}
                    />
                    <span className={AYUDA}>{t('internalChat.vista.renameHelp')}</span>
                </div>
            </DialogoPlantilla>

            {/* Confirmaciones: eliminar chat/grupo, salir del grupo, quitar a una persona. Cancelar a la izquierda y con el foco. */}
            <DialogoPlantilla
                abierto={!!confirmacion}
                onCerrar={() => setConfirmacion(null)}
                icono={confirmarTextos?.icono ?? Trash2}
                peligro
                titulo={confirmarTextos?.titulo ?? ''}
                ancho="max-w-[400px]"
                enfoqueInicial={cancelarConfirmRef}
                pie={
                    <>
                        <button ref={cancelarConfirmRef} type="button" onClick={() => setConfirmacion(null)} className={BOTON_SECUNDARIO}>
                            {t('common.cancel')}
                        </button>
                        <button type="button" onClick={confirmarAccion} className={BOTON_PELIGRO_LLENO}>
                            {confirmarTextos && <confirmarTextos.icono aria-hidden="true" />}
                            {confirmarTextos?.boton}
                        </button>
                    </>
                }
            >
                {confirmarTextos && (
                    <p className={cn('text-[13px] leading-[19px]', GRIS)}>
                        <Trans
                            i18nKey={confirmarTextos.clave}
                            values={confirmarTextos.valores}
                            count={'count' in confirmarTextos.valores ? confirmarTextos.valores.count : undefined}
                            components={{ b: <b className={cn('font-semibold', TINTA)} /> }}
                        />
                    </p>
                )}
            </DialogoPlantilla>

            {/* Visor de medios fullscreen - estilo WhatsApp Web */}
            {mediaViewer && (
                <div
                    className="fixed inset-0 z-[100] bg-black/95 flex flex-col"
                    onClick={() => {
                        setMediaViewer(null);
                        setZoomLevel(1);
                        setImagePosition({ x: 0, y: 0 });
                        setImageRotation(0);
                    }}
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
                                        className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                                        title={t('internalChat.rotate')}
                                        aria-label={t('internalChat.rotate')}
                                    >
                                        <RotateCcw className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.25))}
                                        className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                                        title={t('internalChat.zoomOut')}
                                        aria-label={t('internalChat.zoomOut')}
                                    >
                                        <ZoomOut className="w-5 h-5" />
                                    </button>
                                    <span className="text-white/80 text-sm min-w-[50px] text-center tabular-nums">
                                        {Math.round(zoomLevel * 100)}%
                                    </span>
                                    <button
                                        onClick={() => setZoomLevel(Math.min(4, zoomLevel + 0.25))}
                                        className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                                        title={t('internalChat.zoomIn')}
                                        aria-label={t('internalChat.zoomIn')}
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
                                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                                title={t('common.download')}
                                aria-label={t('common.download')}
                            >
                                <Download className="w-5 h-5" />
                            </a>

                            {/* Botón cerrar */}
                            <button
                                onClick={() => {
                                    setMediaViewer(null);
                                    setZoomLevel(1);
                                    setImagePosition({ x: 0, y: 0 });
                                    setImageRotation(0);
                                }}
                                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors ml-2"
                                title={t('internalChat.closeEsc')}
                                aria-label={t('internalChat.closeEsc')}
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
                            if (!isDraggingImage) {
                                setMediaViewer(null);
                                setZoomLevel(1);
                                setImagePosition({ x: 0, y: 0 });
                                setImageRotation(0);
                            }
                        }}
                        onMouseMove={(e) => {
                            if (isDraggingImage && zoomLevel > 1) {
                                const dx = e.clientX - dragStart.x;
                                const dy = e.clientY - dragStart.y;
                                setImagePosition(prev => ({
                                    x: prev.x + dx,
                                    y: prev.y + dy
                                }));
                                setDragStart({ x: e.clientX, y: e.clientY });
                            }
                        }}
                        onMouseUp={() => setIsDraggingImage(false)}
                        onMouseLeave={() => setIsDraggingImage(false)}
                    >
                        {mediaViewer.type === 'image' ? (
                            <img
                                ref={imageRef}
                                src={mediaViewer.url}
                                alt={mediaViewer.caption || t('internalChat.image')}
                                className={`max-w-full max-h-full object-contain select-none ${zoomLevel > 1 ? 'cursor-grab' : 'cursor-zoom-in'
                                    } ${isDraggingImage ? 'cursor-grabbing' : ''}`}
                                style={{
                                    transform: `scale(${zoomLevel}) rotate(${imageRotation}deg) translate(${imagePosition.x / zoomLevel}px, ${imagePosition.y / zoomLevel}px)`,
                                    transformOrigin: 'center center',
                                    transition: isDraggingImage ? 'none' : 'transform 0.1s ease-out'
                                }}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (zoomLevel > 1) {
                                        setIsDraggingImage(true);
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
                                {t('internalChat.videoNotSupported')}
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
