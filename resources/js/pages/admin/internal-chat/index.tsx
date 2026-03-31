import AdminLayout from '@/layouts/admin-layout';
import { Head } from '@inertiajs/react';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    Send,
    Paperclip,
    Search,
    MoreVertical,
    FileText,
    Image as ImageIcon,
    Music,
    MessageSquare,
    PanelLeftClose,
    PanelLeftOpen,
    Download,
    Plus,
    Users,
    X,
    Check,
    Trash2,
    Pencil,
    LogOut,
    Expand,
    ZoomIn,
    ZoomOut,
    RotateCcw,
    UserPlus,
    UserMinus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

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

interface MessageItem {
    id: number;
    body: string;
    type: 'text' | 'image' | 'video' | 'audio' | 'document';
    file_url: string | null;
    file_name: string | null;
    file_mime: string | null;
    file_size_human: string | null;
    user: { id: number; name: string };
    is_mine: boolean;
    created_at: string;
    created_at_full: string;
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

export default function InternalChat({ auth, chats: serverChats, users: serverUsers }: Props) {
    const [chats, setChats] = useState<ChatItem[]>(serverChats || []);
    const [availableUsers] = useState<UserInfo[]>(serverUsers || []);
    const [activeChat, setActiveChat] = useState<ChatItem | null>(null);
    const [activeChatInfo, setActiveChatInfo] = useState<{ name: string; type: string; participants: UserInfo[] } | null>(null);
    const [messages, setMessages] = useState<MessageItem[]>([]);
    const [inputText, setInputText] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [isSidebarVisible, setIsSidebarVisible] = useState(true);

    // Read receipts: who has read the chat
    const [readReceipts, setReadReceipts] = useState<ReadReceipt[]>([]);
    const readReceiptsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        return chats.filter(chat =>
            chat.name?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [chats, searchQuery]);

    const filteredUsers = useMemo(() => {
        return availableUsers.filter(u =>
            u.name.toLowerCase().includes(userSearchQuery.toLowerCase())
        );
    }, [availableUsers, userSearchQuery]);

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
        if (!chat.latest_message) return 'Nuevo chat';
        const prefix = chat.latest_message.user_name ? `${chat.latest_message.user_name}: ` : '';
        const { type, body } = chat.latest_message;
        if (type === 'image') return `${prefix}📷 Foto`;
        if (type === 'video') return `${prefix}🎥 Video`;
        if (type === 'audio') return `${prefix}🎵 Audio`;
        if (type === 'document' || type === 'file') return `${prefix}📎 Archivo`;
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
        const interval = setInterval(pollChats, 5000);
        return () => clearInterval(interval);
    }, [activeChat?.id]);

    // Polling for messages in active chat - using last message ID for reliability
    useEffect(() => {
        if (!activeChat) return;

        const pollMessages = async () => {
            try {
                const res = await axios.get(`/admin/internal-chat/${activeChat.id}/poll?since=${lastMessageIdRef.current > 0 ? encodeURIComponent(new Date(Date.now() - 10000).toISOString()) : ''}`);
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

        const interval = setInterval(pollMessages, 3000);
        return () => clearInterval(interval);
    }, [activeChat?.id]);

    // Fetch messages when active chat changes
    useEffect(() => {
        if (activeChat) {
            // Reset tracking for new chat
            lastMessageIdRef.current = 0;
            isAtBottomRef.current = true; // Reset scroll tracking

            axios.get(`/admin/internal-chat/${activeChat.id}/messages`)
                .then(res => {
                    if (res.data?.messages) {
                        const msgs: MessageItem[] = res.data.messages;
                        setMessages(msgs);
                        lastMessageIdRef.current = msgs.length > 0 ? msgs[msgs.length - 1].id : 0;
                        setActiveChatInfo(res.data.chat || null);
                    }
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

    // Poll read receipts every 4 seconds while a chat is active
    useEffect(() => {
        if (!activeChat) {
            setReadReceipts([]);
            return;
        }

        const fetchReceipts = async () => {
            try {
                const res = await axios.get(`/admin/internal-chat/${activeChat.id}/read-receipts`);
                if (res.data?.receipts) {
                    setReadReceipts(res.data.receipts);
                }
            } catch {
                // silently ignore
            }
        };

        fetchReceipts();
        const id = setInterval(fetchReceipts, 4000);
        readReceiptsIntervalRef.current = id;
        return () => clearInterval(id);
    }, [activeChat?.id]);

    // Close media viewer or active chat with Escape key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (mediaViewer) {
                    setMediaViewer(null);
                    setZoomLevel(1);
                    setImagePosition({ x: 0, y: 0 });
                    setImageRotation(0);
                } else if (showParticipantsModal) {
                    setShowParticipantsModal(false);
                } else if (showRenameModal) {
                    setShowRenameModal(false);
                } else if (showCreateGroup) {
                    setShowCreateGroup(false);
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
    }, [mediaViewer, showParticipantsModal, showRenameModal, showCreateGroup, activeChat]);

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
        setActiveChat(chat);
    };

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if ((!inputText.trim() && !isUploading) || !activeChat) return;

        const originalText = inputText;
        setInputText('');

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
            created_at: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false }),
            created_at_full: new Date().toISOString().slice(0, 16).replace('T', ' '),
        };
        setMessages(prev => [...prev, optimisticMsg]);
        setTimeout(() => scrollToBottom(true), 50);

        try {
            const sendRes = await axios.post(`/admin/internal-chat/${activeChat.id}/send`, {
                body: originalText,
                type: 'text'
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
                                body: realMsg.body || (realMsg.type === 'image' ? 'Foto' : realMsg.type === 'video' ? 'Video' : realMsg.type === 'audio' ? 'Audio' : 'Archivo'),
                                type: realMsg.type,
                                user_name: auth.user.name,
                                created_at: 'ahora',
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
        } catch (error) {
            console.error(error);
            // Remove optimistic message and restore input on error
            setMessages(prev => prev.filter(m => m.id !== tempId));
            setInputText(originalText);
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

        const formData = new FormData();
        formData.append('file', file);

        let type = 'file';
        if (file.type.startsWith('image/')) type = 'image';
        else if (file.type.startsWith('audio/')) type = 'audio';
        else if (file.type.startsWith('video/')) type = 'video';
        else type = 'document';
        formData.append('type', type);

        const tempId = Date.now();
        const optimisticMsg: MessageItem = {
            id: tempId,
            body: `📎 Enviando ${file.name}...`,
            type: type as MessageItem['type'],
            file_url: null,
            file_name: file.name,
            file_mime: file.type,
            file_size_human: `${(file.size / 1024).toFixed(0)} KB`,
            user: { id: auth.user.id, name: auth.user.name },
            is_mine: true,
            created_at: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false }),
            created_at_full: new Date().toISOString().slice(0, 16).replace('T', ' '),
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

                const typeLabel = realMsg.type === 'image' ? '📷 Foto' : realMsg.type === 'video' ? '🎥 Video' : realMsg.type === 'audio' ? '🎵 Audio' : '📎 Archivo';
                setChats(prev => {
                    const updated = prev.map(c => {
                        if (c.id !== activeChat.id) return c;
                        return { ...c, latest_message: { body: realMsg.body || typeLabel, type: realMsg.type, user_name: auth.user.name, created_at: 'ahora' }, unread: 0 };
                    });
                    const active = updated.find(c => c.id === activeChat.id);
                    const rest = updated.filter(c => c.id !== activeChat.id);
                    return active ? [active, ...rest] : updated;
                });
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
                name: isGroup ? (groupName || 'Nuevo grupo') : null,
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
                toast.success(res.data?.chat_id ? 'Chat creado' : 'Chat listo');
            }
        } catch (error) {
            console.error('Error creating chat:', error);
            toast.error('Error al crear el chat');
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

    return (
        <AdminLayout>
            <Head title="Chat Interno" />

            <div className="h-[calc(100vh-0px)] flex bg-background overflow-hidden">
                {/* Lista de Chats - Izquierda */}
                <div className={cn(
                    "bg-background dark:bg-neutral-900 flex-col transition-all duration-300 flex-shrink-0 border-r border-border dark:border-neutral-700/50",
                    activeChat ? 'hidden md:flex' : 'flex',
                    isSidebarVisible ? 'w-full md:w-80 lg:w-96' : 'hidden md:w-0 md:overflow-hidden'
                )}>
                    {/* Header */}
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h1 className="text-2xl font-extrabold text-[#16235e] dark:text-blue-200 tracking-tight">Mensajes</h1>

                            <div className="flex items-center gap-2 flex-shrink-0">
                                <button
                                    onClick={() => setShowCreateGroup(true)}
                                    className="w-10 h-10 rounded-full bg-gradient-to-br from-[#16235e] to-[#2e3a75] text-white flex items-center justify-center shadow-lg hover:shadow-xl active:scale-95 transition-all"
                                    title="Nuevo chat o grupo"
                                >
                                    <Plus className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Búsqueda */}
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#767681] w-4 h-4" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 bg-muted dark:bg-neutral-800 border-none rounded-full text-sm focus:ring-2 focus:ring-[#16235e]/10 transition-all placeholder:text-[#767681]"
                                placeholder="Buscar conversaciones"
                            />
                        </div>
                    </div>

                    {/* Lista de Chats */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 pb-6 custom-scrollbar-light">
                        {filteredChats.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-[#767681] p-8">
                                <MessageSquare className="w-16 h-16 mb-4 text-[#767681]/50" />
                                <p className="text-center text-sm">No hay conversaciones</p>
                                <p className="text-center text-xs text-[#767681] mt-2">
                                    Crea una nueva conversación o grupo
                                </p>
                            </div>
                        ) : (
                            filteredChats.map(chat => {
                                const isActive = activeChat?.id === chat.id;

                                return (
                                    <button
                                        key={chat.id}
                                        onClick={() => handleChatSelect(chat)}
                                        className={`w-full flex items-center gap-4 p-4 mb-1 rounded-xl transition-all text-left select-none ${isActive
                                                ? 'bg-[#dee1ff] dark:bg-blue-900/30 border-l-4 border-[#16235e] dark:border-blue-400'
                                                : 'hover:bg-muted/60 dark:hover:bg-neutral-800/50 border-l-4 border-transparent'
                                            }`}
                                    >
                                        {/* Avatar */}
                                        <div className="relative flex-shrink-0">
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-[15px] font-bold tracking-wide ${chat.type === 'group' ? 'bg-[#2e3a75]' : 'bg-gradient-to-br from-[#4e5fa4] to-[#3e4f94]'
                                                }`}>
                                                {chat.type === 'group' ? (
                                                    <Users className="w-5 h-5" />
                                                ) : (
                                                    <span>{getInitials(chat.name)}</span>
                                                )}
                                            </div>
                                            {chat.unread > 0 && (
                                                <div className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 bg-green-500 rounded-full flex items-center justify-center text-white text-[11px] font-bold shadow-sm border-2 border-[#f3f3f3] dark:border-neutral-900">
                                                    {chat.unread}
                                                </div>
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-grow min-w-0">
                                            <div className="flex justify-between items-baseline mb-0.5">
                                                <h3 className="font-bold text-[#1a1c1c] dark:text-neutral-200 truncate text-[15px]">
                                                    {chat.name}
                                                </h3>
                                                <span className={`text-[10px] font-medium flex-shrink-0 ml-2 ${chat.unread > 0 ? 'text-[#16235e] dark:text-blue-400' : 'text-[#5f5e5e] dark:text-neutral-500'
                                                    }`}>
                                                    {chat.latest_message?.created_at || ''}
                                                </span>
                                            </div>
                                            <p className={`text-sm truncate ${chat.unread > 0 ? 'text-[#1a1c1c] dark:text-neutral-200 font-medium' : 'text-[#5f5e5e] dark:text-neutral-400'}`}>
                                                {getLastMessagePreview(chat)}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Área de Chat - Derecha */}
                {!activeChat ? (
                    <div className="hidden md:flex flex-1 items-center justify-center bg-background dark:bg-neutral-950">
                        <div className="text-center p-8 md:p-12">
                            <MessageSquare className="w-24 h-24 mx-auto mb-4 text-[#c6c5d1]" />
                            <h3 className="text-xl font-bold text-[#1a1c1c]/60 dark:text-neutral-400 mb-2">
                                Bienvenido al Chat Interno
                            </h3>
                            <p className="text-sm text-[#5f5e5e]">
                                Selecciona una conversación o crea un nuevo grupo para comenzar.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col bg-background dark:bg-neutral-950 w-full md:w-auto relative">
                        {/* Header del Chat */}
                        <header className="flex items-center justify-between w-full px-6 py-4 bg-card/80 dark:bg-neutral-900/80 backdrop-blur-md shadow-sm z-10">
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                {/* Botón volver (mobile) / toggle sidebar (desktop) */}
                                <button
                                    onClick={() => {
                                        if (window.innerWidth < 768) {
                                            setActiveChat(null);
                                        } else {
                                            setIsSidebarVisible(!isSidebarVisible);
                                        }
                                    }}
                                    className="p-2 rounded-full hover:bg-muted dark:hover:bg-neutral-800 transition-colors text-[#16235e] dark:text-blue-300 flex-shrink-0"
                                    title={isSidebarVisible ? 'Ocultar lista' : 'Mostrar lista'}
                                >
                                    {isSidebarVisible ? (
                                        <PanelLeftClose className="w-5 h-5" />
                                    ) : (
                                        <PanelLeftOpen className="w-5 h-5" />
                                    )}
                                </button>

                                {/* Avatar e Info */}
                                <div className="relative flex-shrink-0">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-[14px] font-bold ${activeChat.type === 'group' ? 'bg-[#2e3a75]' : 'bg-gradient-to-br from-[#4e5fa4] to-[#3e4f94]'}`}>
                                        {activeChat.type === 'group' ? (
                                            <Users className="w-5 h-5" />
                                        ) : (
                                            <span>{getInitials(activeChat.name)}</span>
                                        )}
                                    </div>
                                    {activeChat.type === 'direct' && activeChatInfo?.participants?.find(p => p.id !== auth.user.id)?.is_online && (
                                        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-neutral-900 rounded-full"></div>
                                    )}
                                </div>
                                <div className="min-w-0 flex-1 overflow-hidden">
                                    <h2 className="font-semibold text-md text-[#16235e] dark:text-blue-200 leading-tight truncate">
                                        {activeChat.name}
                                    </h2>
                                    <p className="text-xs text-[#5f5e5e] dark:text-neutral-400 truncate">
                                        {activeChat.type === 'group'
                                            ? `${activeChat.participants.length} participantes`
                                            : (activeChatInfo?.participants?.find(p => p.id !== auth.user.id)?.is_online
                                                ? <span className="text-green-600 font-medium">En línea</span>
                                                : 'Sin conexión')
                                        }
                                    </p>
                                </div>
                            </div>

                            {/* Acciones del header */}
                            <div className="flex items-center gap-1">
                                <div className="w-px h-6 bg-border/30 mx-1"></div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button className="p-2.5 rounded-full hover:bg-muted dark:hover:bg-neutral-800 transition-colors text-[#16235e] dark:text-blue-300 opacity-80 hover:opacity-100">
                                            <MoreVertical className="w-5 h-5" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48">
                                        {activeChat.type === 'group' && (
                                            <DropdownMenuItem
                                                onClick={() => {
                                                    setRenameValue(activeChat.name);
                                                    setShowRenameModal(true);
                                                }}
                                                className="cursor-pointer"
                                            >
                                                <Pencil className="w-4 h-4 mr-2" />
                                                Renombrar grupo
                                            </DropdownMenuItem>
                                        )}
                                        {activeChat.type === 'group' && (
                                            <DropdownMenuItem
                                                className="cursor-pointer"
                                                onClick={() => setShowParticipantsModal(true)}
                                            >
                                                <Users className="w-4 h-4 mr-2" />
                                                Ver participantes ({activeChat.participants.length})
                                            </DropdownMenuItem>
                                        )}
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/30"
                                            onClick={async () => {
                                                const label = activeChat.type === 'group'
                                                    ? (activeChat.participants.some(p => p.id === auth.user.id) ? 'Eliminar grupo' : 'Salir del grupo')
                                                    : 'Eliminar chat';
                                                if (!confirm(`¿${label}? Esta acción no se puede deshacer.`)) return;
                                                try {
                                                    const deletedId = activeChat.id;
                                                    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
                                                    await axios.delete(`/admin/internal-chat/${deletedId}`, {
                                                        headers: { 'X-CSRF-TOKEN': csrfToken }
                                                    });
                                                    // Immediately clean up local state to stop polling
                                                    lastMessageIdRef.current = 0;
                                                    lastChatPollRef.current = '';
                                                    setMessages([]);
                                                    setActiveChat(null);
                                                    // Remove from local list immediately (optimistic)
                                                    setChats(prev => prev.filter(c => c.id !== deletedId));
                                                    toast.success('Chat eliminado');
                                                } catch (err) {
                                                    console.error('Error eliminando chat:', err);
                                                    toast.error('Error al eliminar el chat');
                                                }
                                            }}
                                        >
                                            <Trash2 className="w-4 h-4 mr-2" />
                                            {activeChat.type === 'group' ? 'Eliminar grupo' : 'Eliminar chat'}
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </header>

                        {/* Mensajes */}
                        <div
                            ref={messagesContainerRef}
                            onScroll={handleMessagesScroll}
                            className="flex-1 overflow-y-auto p-8 flex flex-col gap-6 custom-scrollbar-light"

                        >
                            {messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-[#5f5e5e]">
                                    <MessageSquare className="w-16 h-16 mb-4 text-[#c6c5d1]" />
                                    <p className="text-sm">No hay mensajes aún. ¡Envía el primero!</p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-6">
                                    {messages.map((msg, idx) => {
                                        // Build a map: for each reader, find the index of the last message they've read
                                        // A reader has read msg if their last_read_at >= msg.created_at_full
                                        const readersHere: ReadReceipt[] = [];
                                        for (const r of readReceipts) {
                                            const readAt = new Date(r.last_read_at).getTime();
                                            const msgAt = new Date(msg.created_at_full).getTime();
                                            // Reader must have read at least this message
                                            if (readAt < msgAt) continue;
                                            // Check if the next message is ALSO read by this reader
                                            const nextMsg = messages[idx + 1];
                                            if (nextMsg) {
                                                const nextMsgAt = new Date(nextMsg.created_at_full).getTime();
                                                if (readAt >= nextMsgAt) continue; // reader read further, skip this msg
                                            }
                                            readersHere.push(r);
                                        }

                                        return (
                                            <div
                                                key={msg.id}
                                                className={`flex flex-col ${msg.is_mine ? 'items-end self-end' : 'items-start'} max-w-[75%]`}
                                            >
                                                <div
                                                    className={`${msg.is_mine
                                                        ? 'bg-[#2e3a75] text-white px-5 py-3.5 rounded-xl rounded-br-sm shadow-md'
                                                        : 'bg-white dark:bg-neutral-800 text-[#1a1c1c] dark:text-neutral-100 px-5 py-3.5 rounded-xl rounded-bl-sm shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                                                        }`}
                                                >
                                                        {/* Sender name (in groups show for all; in direct only for others) */}
                                                        {msg.user && (activeChat?.type === 'group' || !msg.is_mine) && (
                                                            <p className={`text-[11px] mb-1 font-bold ${msg.is_mine ? 'text-blue-200' : 'text-[#16235e] dark:text-blue-400'}`}>
                                                                {msg.is_mine ? 'Tú' : msg.user.name}
                                                            </p>
                                                        )}

                                                        {/* Image */}
                                                        {msg.type === 'image' && msg.file_url && (
                                                            <div className="mb-2">
                                                                <div
                                                                    className="relative cursor-pointer group"
                                                                    onClick={() => {
                                                                        setMediaViewer({
                                                                            url: msg.file_url!,
                                                                            type: 'image',
                                                                            caption: msg.body && msg.body !== 'Imagen' ? msg.body : undefined
                                                                        });
                                                                        setZoomLevel(1);
                                                                        setImagePosition({ x: 0, y: 0 });
                                                                    }}
                                                                >
                                                                    <img
                                                                        src={msg.file_url}
                                                                        alt="Imagen"
                                                                        className="max-w-full max-h-96 rounded-xl object-cover"
                                                                        loading="lazy"
                                                                    />
                                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 rounded-xl flex items-center justify-center">
                                                                        <Expand className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 drop-shadow-lg" />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Video */}
                                                        {msg.type === 'video' && msg.file_url && (
                                                            <div className="mb-2">
                                                                <div
                                                                    className="relative cursor-pointer group"
                                                                    onClick={() => {
                                                                        setMediaViewer({
                                                                            url: msg.file_url!,
                                                                            type: 'video',
                                                                            caption: msg.body && msg.body !== 'Video' ? msg.body : undefined
                                                                        });
                                                                    }}
                                                                >
                                                                    <video
                                                                        src={msg.file_url}
                                                                        className="max-w-full max-h-96 rounded-xl"
                                                                        preload="metadata"
                                                                    />
                                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 rounded-xl flex items-center justify-center">
                                                                        <Expand className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 drop-shadow-lg" />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* File / Document */}
                                                        {(msg.type === 'document') && msg.file_url && (
                                                            <div className="flex items-center gap-4 bg-background dark:bg-neutral-700/50 p-4 rounded-lg border border-border/20 dark:border-neutral-600/30 mb-2">
                                                                <div className="w-12 h-12 bg-[#16235e]/10 dark:bg-blue-500/20 rounded flex items-center justify-center text-[#16235e] dark:text-blue-300">
                                                                    <FileText className="w-6 h-6" />
                                                                </div>
                                                                <div className="flex flex-col overflow-hidden flex-1">
                                                                    <span className="text-sm font-bold truncate">{msg.file_name || 'Archivo'}</span>
                                                                    {msg.file_size_human && (
                                                                        <span className="text-xs text-[#5f5e5e] dark:text-neutral-400 font-normal">{msg.file_size_human}</span>
                                                                    )}
                                                                </div>
                                                                <a href={msg.file_url} download target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-muted dark:hover:bg-neutral-600 rounded-full transition-colors">
                                                                    <Download className="w-5 h-5 text-[#5f5e5e] dark:text-neutral-300" />
                                                                </a>
                                                            </div>
                                                        )}

                                                        {/* Audio */}
                                                        {msg.type === 'audio' && msg.file_url && (
                                                            <div className="mb-2">
                                                                <audio
                                                                    src={msg.file_url}
                                                                    controls
                                                                    className="max-w-full"
                                                                    preload="metadata"
                                                                />
                                                            </div>
                                                        )}

                                                        {/* Text Content (with @mention highlighting) */}
                                                        {msg.body && (
                                                            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                                                                {(() => {
                                                                    const allParticipants = activeChat?.type === 'group' ? activeChat.participants : availableUsers;
                                                                    const names = allParticipants.map(u => u.name).sort((a, b) => b.length - a.length);
                                                                    // Build regex matching @Name for all known users
                                                                    if (names.length === 0) return msg.body;
                                                                    const escaped = names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                                                                    const regex = new RegExp(`(@(?:${escaped.join('|')}))`, 'g');
                                                                    const parts = msg.body.split(regex);
                                                                    return parts.map((part: string, pi: number) => {
                                                                        if (part.startsWith('@')) {
                                                                            const name = part.slice(1);
                                                                            const mentioned = allParticipants.find(u => u.name === name);
                                                                            if (mentioned) {
                                                                                const isMe = mentioned.id === auth.user.id;
                                                                                return (
                                                                                    <span
                                                                                        key={pi}
                                                                                        className={cn(
                                                                                            'font-semibold rounded px-0.5',
                                                                                            msg.is_mine
                                                                                                ? 'text-white underline decoration-white/50'
                                                                                                : isMe
                                                                                                    ? 'text-primary bg-primary/10'
                                                                                                    : 'text-primary'
                                                                                        )}
                                                                                    >
                                                                                        @{name}
                                                                                    </span>
                                                                                );
                                                                            }
                                                                        }
                                                                        return part;
                                                                    });
                                                                })()}
                                                            </p>
                                                        )}
                                                    </div>
                                                {/* Timestamp - outside bubble */}
                                                <div className={`flex items-center gap-1 mt-1.5 ${msg.is_mine ? 'mr-1' : 'ml-1'}`}>
                                                    <span className="text-[10px] text-[#5f5e5e] dark:text-neutral-500">{msg.created_at}</span>
                                                    {msg.is_mine && (
                                                        <Check className="w-3 h-3 text-[#16235e] dark:text-blue-400" style={{ fontSize: '14px' }} />
                                                    )}
                                                </div>
                                                {/* Read receipts */}
                                                {readersHere.length > 0 && (
                                                    <div className={`flex items-center gap-1 mt-1.5 px-1 ${msg.is_mine ? 'justify-end mr-1' : 'justify-start ml-1'}`}>
                                                        <Check className="w-3.5 h-3.5 text-[#16235e] dark:text-blue-400 opacity-80 flex-shrink-0" />
                                                        <span className="text-[10px] font-medium text-[#5f5e5e] dark:text-neutral-400 leading-none">
                                                            Visto por {readersHere.map(r => r.user_name).join(', ')}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    <div ref={messagesEndRef} />
                                </div>
                            )}
                        </div>

                        {/* Input Area */}
                        <form onSubmit={handleSendMessage} className="p-6 bg-card/80 dark:bg-neutral-900/80 backdrop-blur-md">
                            <div className="flex items-center gap-3 bg-muted dark:bg-neutral-800 px-4 py-2 rounded-full ring-1 ring-black/5 dark:ring-white/10 focus-within:ring-[#16235e]/20 transition-all relative">
                                {/* Hidden file input */}
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    onChange={handleFileUpload}
                                />

                                <button
                                    type="button"
                                    className="p-2 text-[#5f5e5e] dark:text-neutral-400 hover:text-[#16235e] dark:hover:text-blue-300 transition-colors flex-shrink-0"
                                    onClick={() => fileInputRef.current?.click()}
                                    title="Adjuntar archivo"
                                    disabled={isUploading}
                                >
                                    <Paperclip className="w-5 h-5" />
                                </button>

                                {/* Text input */}
                                <div className="relative flex-1">
                                    {/* @Mentions dropdown */}
                                    {showMentions && mentionUsers.length > 0 && (
                                        <div className="absolute bottom-full left-0 right-0 mb-3 bg-card dark:bg-neutral-800 border border-border dark:border-neutral-700 rounded-xl shadow-xl z-50 max-h-52 overflow-y-auto custom-scrollbar">
                                            {mentionUsers.map((user, i) => (
                                                <button
                                                    key={user.id}
                                                    type="button"
                                                    className={cn(
                                                        'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors',
                                                        i === mentionIndex ? 'bg-[#dee1ff] dark:bg-blue-900/30 text-[#16235e] dark:text-blue-300' : 'hover:bg-muted/60 dark:hover:bg-neutral-700'
                                                    )}
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        insertMention(user);
                                                    }}
                                                    onMouseEnter={() => setMentionIndex(i)}
                                                >
                                                    <div className="w-7 h-7 rounded-full bg-[#16235e]/10 dark:bg-blue-500/20 text-[#16235e] dark:text-blue-300 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                                                        {getInitials(user.name)}
                                                    </div>
                                                    <span className="font-medium truncate">{user.name}</span>
                                                    <span className="text-xs text-[#5f5e5e] dark:text-neutral-400 ml-auto capitalize">{user.role}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    <Textarea
                                        ref={textareaRef}
                                        value={inputText}
                                        onChange={handleInputChange}
                                        placeholder="Escribe un mensaje... (@para mencionar)"
                                        className="flex-1 min-h-[40px] max-h-[120px] py-2 pr-4 pl-0 text-sm resize-none border-0 bg-transparent focus-visible:ring-0 shadow-none rounded-none placeholder:text-[#767681]"
                                        onKeyDown={handleKeyDown}
                                        onPaste={handlePaste}
                                    />
                                </div>

                                {/* Send button */}
                                <button
                                    type="submit"
                                    disabled={(!inputText.trim() && !isUploading) || isUploading}
                                    className="w-10 h-10 rounded-full bg-gradient-to-br from-[#16235e] to-[#2e3a75] flex items-center justify-center text-white shadow-lg hover:shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                                >
                                    {isUploading ? (
                                        <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <Send className="w-4 h-4 ml-0.5" />
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>

            {/* Modal: Crear nuevo chat o grupo */}
            <Dialog open={showCreateGroup} onOpenChange={setShowCreateGroup}>
                <DialogContent className="sm:max-w-md card-gradient border-2 border-border dark:border-[hsl(231,20%,22%)] max-h-[95vh] overflow-y-auto custom-scrollbar-light">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold text-primary dark:text-[hsl(231,15%,92%)] flex items-center gap-2">
                            <Users className="w-6 h-6" />
                            Nuevo Chat
                        </DialogTitle>
                        <DialogDescription className="sr-only">
                            Selecciona usuarios para crear un chat directo o un grupo
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 pt-2">
                        {/* Group name (only shows when multiple selected) */}
                        {selectedUserIds.length > 1 && (
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-primary dark:text-[hsl(231,15%,92%)]">
                                    Nombre del grupo
                                </label>
                                <Input
                                    type="text"
                                    placeholder="Ej: Equipo de ventas"
                                    value={groupName}
                                    onChange={(e) => setGroupName(e.target.value)}
                                    className="settings-input rounded-xl"
                                />
                            </div>
                        )}

                        {/* User search */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-primary dark:text-[hsl(231,15%,92%)]">
                                {selectedUserIds.length > 1 ? 'Participantes' : 'Seleccionar usuario'}
                            </label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                                <Input
                                    type="text"
                                    placeholder="Buscar usuarios..."
                                    value={userSearchQuery}
                                    onChange={(e) => setUserSearchQuery(e.target.value)}
                                    className="pl-10 settings-input rounded-xl"
                                />
                            </div>
                        </div>

                        {/* Selected users chips */}
                        {selectedUserIds.length > 0 && (
                            <div className="flex flex-wrap gap-2 max-h-[100px] overflow-y-auto custom-scrollbar-light p-1">
                                {selectedUserIds.map(uid => {
                                    const user = availableUsers.find(u => u.id === uid);
                                    if (!user) return null;
                                    return (
                                        <span
                                            key={uid}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 chat-message-sent text-white text-xs font-medium rounded-full"
                                        >
                                            {user.name}
                                            <button
                                                onClick={() => toggleUserSelection(uid)}
                                                className="hover:bg-white/20 rounded-full p-0.5"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </span>
                                    );
                                })}
                            </div>
                        )}

                        {/* User list */}
                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar-light border border-border rounded-xl">
                            {filteredUsers.length === 0 ? (
                                <div className="p-4 text-center text-sm text-muted-foreground">
                                    No se encontraron usuarios
                                </div>
                            ) : (
                                filteredUsers.map(user => {
                                    const isSelected = selectedUserIds.includes(user.id);
                                    return (
                                        <button
                                            key={user.id}
                                            onClick={() => toggleUserSelection(user.id)}
                                            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${isSelected
                                                ? 'bg-gradient-to-b from-[#d8dcef] to-[#d2d7ec] dark:from-[hsl(231,30%,22%)] dark:to-[hsl(231,30%,18%)]'
                                                : 'hover:bg-accent'
                                                }`}
                                        >
                                            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                                                {getInitials(user.name)}
                                            </div>
                                            <div className="flex-1 min-w-0 text-left">
                                                <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {user.role === 'admin' ? 'Administrador' : user.role === 'advisor' ? 'Asesor' : user.role}
                                                    {user.is_online && <span className="ml-1.5 text-green-500">● En línea</span>}
                                                </p>
                                            </div>
                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected
                                                ? 'bg-primary border-primary text-white'
                                                : 'border-border'
                                                }`}>
                                                {isSelected && <Check className="w-3 h-3" />}
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        {/* Hint text */}
                        <p className="text-xs text-muted-foreground">
                            {selectedUserIds.length === 0
                                ? 'Selecciona uno o más usuarios. Si seleccionas varios, se creará un grupo.'
                                : selectedUserIds.length === 1
                                    ? 'Chat directo. Selecciona más usuarios para crear un grupo.'
                                    : `Grupo con ${selectedUserIds.length} participantes.`
                            }
                        </p>

                        {/* Actions */}
                        <div className="flex justify-end gap-2 pt-2">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setShowCreateGroup(false);
                                    setGroupName('');
                                    setSelectedUserIds([]);
                                    setUserSearchQuery('');
                                }}
                                className="rounded-lg"
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleCreateGroup}
                                disabled={selectedUserIds.length === 0 || isCreatingGroup}
                                className="chat-message-sent text-white rounded-lg shadow-[0_2px_4px_rgba(46,63,132,0.2),0_4px_12px_rgba(46,63,132,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] disabled:opacity-50"
                            >
                                {isCreatingGroup ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                ) : null}
                                {selectedUserIds.length > 1 ? 'Crear grupo' : 'Iniciar chat'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal: Ver participantes */}
            <Dialog open={showParticipantsModal} onOpenChange={(open) => {
                setShowParticipantsModal(open);
                if (!open) {
                    setShowAddParticipants(false);
                    setAddParticipantSearch('');
                    setAddParticipantIds([]);
                }
            }}>
                <DialogContent className="sm:max-w-md card-gradient border-2 border-border dark:border-[hsl(231,20%,22%)]">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-primary dark:text-[hsl(231,15%,92%)] flex items-center gap-2">
                            <Users className="w-5 h-5" />
                            Participantes ({activeChat?.participants.length ?? 0})
                        </DialogTitle>
                        <DialogDescription className="sr-only">Gestionar participantes del grupo</DialogDescription>
                    </DialogHeader>

                    {/* Lista de participantes actuales */}
                    {!showAddParticipants && (
                        <>
                            <div className="mt-2 space-y-1 max-h-[50vh] overflow-y-auto custom-scrollbar-light pr-1">
                                {(activeChat?.participants ?? []).map(p => {
                                    const isCreator = activeChat && p.id === (activeChat as any).created_by;
                                    const canRemove = activeChat?.type === 'group' && p.id !== auth.user.id && !isCreator;
                                    return (
                                        <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-accent transition-colors group">
                                            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                                                {p.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-foreground truncate">
                                                    {p.name}
                                                    {p.id === auth.user.id && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(tú)</span>}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {p.role === 'admin' ? 'Administrador' : p.role === 'advisor' ? 'Asesor' : p.role}
                                                    {p.is_online && <span className="ml-1.5 text-green-500">● En línea</span>}
                                                </p>
                                            </div>
                                            {canRemove && (
                                                <button
                                                    onClick={async () => {
                                                        if (!confirm(`¿Eliminar a ${p.name} del grupo?`)) return;
                                                        try {
                                                            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
                                                            const res = await axios.delete(`/admin/internal-chat/${activeChat!.id}/participants/${p.id}`, {
                                                                headers: { 'X-CSRF-TOKEN': csrfToken }
                                                            });
                                                            if (res.data.success) {
                                                                // Actualizar participantes localmente
                                                                setActiveChat(prev => prev ? { ...prev, participants: res.data.participants } : null);
                                                                setChats(prev => prev.map(c => c.id === activeChat!.id ? { ...c, participants: res.data.participants } : c));
                                                                toast.success(res.data.message);
                                                            }
                                                        } catch (err: any) {
                                                            toast.error(err.response?.data?.error || 'Error al eliminar participante');
                                                        }
                                                    }}
                                                    className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 opacity-0 group-hover:opacity-100 transition-all"
                                                    title="Eliminar del grupo"
                                                >
                                                    <UserMinus className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="flex justify-between pt-2">
                                {activeChat?.type === 'group' && (
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowAddParticipants(true)}
                                        className="rounded-lg gap-2"
                                    >
                                        <UserPlus className="w-4 h-4" />
                                        Agregar
                                    </Button>
                                )}
                                <Button variant="outline" onClick={() => setShowParticipantsModal(false)} className="rounded-lg ml-auto">Cerrar</Button>
                            </div>
                        </>
                    )}

                    {/* Vista de agregar participantes */}
                    {showAddParticipants && (
                        <>
                            <div className="mt-2">
                                <Input
                                    placeholder="Buscar usuario..."
                                    value={addParticipantSearch}
                                    onChange={(e) => setAddParticipantSearch(e.target.value)}
                                    className="rounded-lg"
                                    autoFocus
                                />
                            </div>
                            <div className="space-y-1 max-h-[40vh] overflow-y-auto custom-scrollbar-light pr-1">
                                {availableUsers
                                    .filter(u => !(activeChat?.participants ?? []).some(p => p.id === u.id))
                                    .filter(u => !addParticipantSearch || u.name.toLowerCase().includes(addParticipantSearch.toLowerCase()))
                                    .map(u => {
                                        const selected = addParticipantIds.includes(u.id);
                                        return (
                                            <div
                                                key={u.id}
                                                onClick={() => setAddParticipantIds(prev => selected ? prev.filter(id => id !== u.id) : [...prev, u.id])}
                                                className={cn(
                                                    'flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors',
                                                    selected ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-800' : 'hover:bg-accent'
                                                )}
                                            >
                                                <div className={cn(
                                                    'w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0',
                                                    selected ? 'bg-blue-500 text-white' : 'bg-primary text-white'
                                                )}>
                                                    {selected ? <Check className="w-4 h-4" /> : u.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-foreground truncate">{u.name}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {u.role === 'admin' ? 'Administrador' : u.role === 'advisor' ? 'Asesor' : u.role}
                                                        {u.is_online && <span className="ml-1.5 text-green-500">● En línea</span>}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                            <div className="flex justify-between pt-2 gap-2">
                                <Button variant="outline" onClick={() => { setShowAddParticipants(false); setAddParticipantSearch(''); setAddParticipantIds([]); }} className="rounded-lg">
                                    Volver
                                </Button>
                                <Button
                                    disabled={addParticipantIds.length === 0 || isAddingParticipants}
                                    onClick={async () => {
                                        if (!activeChat || addParticipantIds.length === 0) return;
                                        setIsAddingParticipants(true);
                                        try {
                                            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
                                            const res = await axios.post(`/admin/internal-chat/${activeChat.id}/participants`, {
                                                user_ids: addParticipantIds,
                                            }, {
                                                headers: { 'X-CSRF-TOKEN': csrfToken }
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
                                            toast.error(err.response?.data?.error || 'Error al agregar participantes');
                                        } finally {
                                            setIsAddingParticipants(false);
                                        }
                                    }}
                                    className="rounded-lg gap-2"
                                    style={{ backgroundColor: 'var(--primary-base)' }}
                                >
                                    <UserPlus className="w-4 h-4" />
                                    Agregar ({addParticipantIds.length})
                                </Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Modal: Renombrar grupo */}
            <Dialog open={showRenameModal} onOpenChange={setShowRenameModal}>
                <DialogContent className="sm:max-w-sm card-gradient border-2 border-border dark:border-[hsl(231,20%,22%)]">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-primary dark:text-[hsl(231,15%,92%)] flex items-center gap-2">
                            <Pencil className="w-5 h-5" />
                            Renombrar grupo
                        </DialogTitle>
                        <DialogDescription className="sr-only">
                            Cambia el nombre del grupo
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 pt-2">
                        <Input
                            type="text"
                            placeholder="Nombre del grupo"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            className="settings-input rounded-xl"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && renameValue.trim()) {
                                    e.preventDefault();
                                    // trigger rename
                                    (async () => {
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
                                    })();
                                }
                            }}
                            autoFocus
                        />

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setShowRenameModal(false)} className="rounded-lg">
                                Cancelar
                            </Button>
                            <Button
                                onClick={async () => {
                                    if (!activeChat || !renameValue.trim()) return;
                                    try {
                                        await axios.put(`/admin/internal-chat/${activeChat.id}/rename`, { name: renameValue.trim() });
                                        setActiveChat({ ...activeChat, name: renameValue.trim() });
                                        setChats(prev => prev.map(c => c.id === activeChat.id ? { ...c, name: renameValue.trim() } : c));
                                        setShowRenameModal(false);
                                    } catch (err) {
                                        console.error('Error renombrando grupo:', err);
                                    }
                                }}
                                disabled={!renameValue.trim()}
                                className="chat-message-sent text-white rounded-lg shadow-[0_2px_4px_rgba(46,63,132,0.2),0_4px_12px_rgba(46,63,132,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] disabled:opacity-50"
                            >
                                Guardar
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

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
                                        className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                                        title="Rotar"
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
                                onClick={() => {
                                    setMediaViewer(null);
                                    setZoomLevel(1);
                                    setImagePosition({ x: 0, y: 0 });
                                    setImageRotation(0);
                                }}
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
                                alt={mediaViewer.caption || 'Imagen'}
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
