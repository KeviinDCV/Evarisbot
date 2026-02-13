import AdminLayout from '@/layouts/admin-layout';
import { Head } from '@inertiajs/react';
import { useState, useEffect, useRef, useMemo } from 'react';
import {
    Send,
    Paperclip,
    Search,
    MoreVertical,
    Phone,
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

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

    // Group creation modal
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isAdmin = auth.user.role === 'admin';

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

    // --- Helpers ---

    function getInitials(name: string) {
        return [...name]
            .filter((_, i, arr) => i === 0 || arr[i - 1] === ' ')
            .join('')
            .toUpperCase()
            .slice(0, 2);
    }

    function scrollToBottom() {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }

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

    // Polling for chat list
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const res = await axios.get('/admin/internal-chat', {
                    headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' }
                });

                if (res.data?.props?.chats) {
                    setChats(res.data.props.chats);
                }
            } catch {
                // Silent fail
            }
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    // Polling for messages in active chat
    useEffect(() => {
        if (!activeChat) return;

        const interval = setInterval(async () => {
            try {
                const res = await axios.get(`/admin/internal-chat/${activeChat.id}/messages`);
                if (res.data?.messages && Array.isArray(res.data.messages)) {
                    if (res.data.messages.length !== messages.length) {
                        setMessages(res.data.messages);
                        scrollToBottom();
                    }
                }
            } catch (e) {
                console.error(e);
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [activeChat, messages.length]);

    // Fetch messages when active chat changes
    useEffect(() => {
        if (activeChat) {
            axios.get(`/admin/internal-chat/${activeChat.id}/messages`)
                .then(res => {
                    if (res.data?.messages) {
                        setMessages(res.data.messages);
                        setActiveChatInfo(res.data.chat || null);
                    }
                    setTimeout(scrollToBottom, 100);
                })
                .catch(console.error);

            // Mark as read
            axios.post(`/admin/internal-chat/${activeChat.id}/read`).catch(() => {});
        }
    }, [activeChat?.id]);

    // --- Handlers ---

    const handleChatSelect = (chat: ChatItem) => {
        setActiveChat(chat);
    };

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if ((!inputText.trim() && !isUploading) || !activeChat) return;

        const originalText = inputText;
        setInputText('');

        try {
            await axios.post(`/admin/internal-chat/${activeChat.id}/send`, {
                content: originalText,
                type: 'text'
            });
            const res = await axios.get(`/admin/internal-chat/${activeChat.id}/messages`);
            if (res.data?.messages) {
                setMessages(res.data.messages);
            }
            scrollToBottom();
        } catch (error) {
            console.error(error);
            setInputText(originalText);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !activeChat) return;

        const formData = new FormData();
        formData.append('file', file);

        let type = 'file';
        if (file.type.startsWith('image/')) type = 'image';
        else if (file.type.startsWith('audio/')) type = 'audio';
        else if (file.type.startsWith('video/')) type = 'video';
        formData.append('type', type);

        setIsUploading(true);
        try {
            await axios.post(`/admin/internal-chat/${activeChat.id}/send`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const res = await axios.get(`/admin/internal-chat/${activeChat.id}/messages`);
            if (res.data?.messages) {
                setMessages(res.data.messages);
            }
            scrollToBottom();
        } catch (error) {
            console.error("Upload error", error);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
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
                const listRes = await axios.get('/admin/internal-chat', {
                    headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' }
                });
                if (listRes.data?.props?.chats) {
                    setChats(listRes.data.props.chats);
                    // Select the new/existing chat
                    const newChat = listRes.data.props.chats.find((c: ChatItem) => c.id === res.data.chat_id);
                    if (newChat) setActiveChat(newChat);
                }
                setShowCreateGroup(false);
                setGroupName('');
                setSelectedUserIds([]);
                setUserSearchQuery('');
            }
        } catch (error) {
            console.error('Error creating chat:', error);
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
                    "bg-accent dark:bg-accent flex-col transition-all duration-300 flex-shrink-0 conversation-sidebar",
                    activeChat ? 'hidden md:flex' : 'flex',
                    isSidebarVisible ? 'w-full md:w-64 lg:w-72 xl:w-80' : 'hidden md:w-0 md:overflow-hidden'
                )}>
                    {/* Header */}
                    <div className="p-3 md:p-4 conversation-header">
                        <div className="flex items-center justify-between mb-2 md:mb-3">
                            <h2 className="text-base md:text-lg font-bold text-primary dark:text-primary whitespace-nowrap">Chat Interno</h2>

                            <div className="flex items-center gap-1 flex-shrink-0">
                                {/* Botón para nuevo chat/grupo */}
                                <button
                                    onClick={() => setShowCreateGroup(true)}
                                    className="p-1.5 chat-message-sent text-white rounded-lg shadow-[0_1px_2px_rgba(46,63,132,0.2),0_2px_4px_rgba(46,63,132,0.15)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.25),0_4px_8px_rgba(46,63,132,0.2)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                                    title="Nuevo chat o grupo"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Búsqueda */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                            <Input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="pl-10 settings-input rounded-2xl transition-all duration-200"
                                placeholder="Buscar chats..."
                            />
                        </div>
                    </div>

                    {/* Lista de Chats */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 md:px-2 pt-4 custom-scrollbar-light">
                        {filteredChats.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
                                <MessageSquare className="w-16 h-16 mb-4 text-muted-foreground" />
                                <p className="text-center text-sm">No hay conversaciones</p>
                                <p className="text-center text-xs text-muted-foreground mt-2">
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
                                        className={`w-full p-3 md:p-4 mb-2 transition-all duration-200 flex items-start gap-3 text-left rounded-xl ${
                                            isActive
                                                ? 'bg-gradient-to-b from-[#d8dcef] to-[#d2d7ec] dark:from-[hsl(231,30%,22%)] dark:to-[hsl(231,30%,18%)] shadow-[0_1px_3px_rgba(46,63,132,0.08),0_4px_12px_rgba(46,63,132,0.12)]'
                                                : 'bg-gradient-to-b from-[#f4f5f9] to-[#f0f2f8] dark:from-[hsl(231,25%,16%)] dark:to-[hsl(231,25%,14%)] shadow-[0_1px_2px_rgba(46,63,132,0.04)] hover:shadow-[0_2px_4px_rgba(46,63,132,0.06),0_4px_8px_rgba(46,63,132,0.08)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.15)]'
                                        }`}
                                    >
                                        {/* Avatar */}
                                        <div className="relative flex-shrink-0">
                                            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center text-white text-sm md:text-base font-medium shadow-[0_2px_4px_rgba(46,63,132,0.15),0_4px_8px_rgba(46,63,132,0.1),inset_0_1px_0_rgba(255,255,255,0.1)] overflow-hidden ${
                                                chat.type === 'group' ? 'bg-gradient-to-b from-[#4e5fa4] to-[#3e4f94]' : 'chat-message-sent'
                                            }`}>
                                                {chat.type === 'group' ? (
                                                    <Users className="w-5 h-5" />
                                                ) : (
                                                    <span>{getInitials(chat.name)}</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0 overflow-hidden">
                                            <div className="flex items-center justify-between gap-2 mb-0.5">
                                                <span className="font-semibold text-sm text-foreground truncate flex items-center gap-1.5">
                                                    {chat.type === 'group' && <Users className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                                                    {chat.name}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground flex-shrink-0">
                                                    {chat.latest_message?.created_at || ''}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between gap-2">
                                                <span className={`text-xs truncate flex-1 ${chat.unread > 0 ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                                                    {getLastMessagePreview(chat)}
                                                </span>
                                                {chat.unread > 0 && (
                                                    <span className="flex-shrink-0 min-w-5 h-5 px-1.5 chat-message-sent text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-[0_1px_3px_rgba(46,63,132,0.3)]">
                                                        {chat.unread}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Área de Chat - Derecha */}
                {!activeChat ? (
                    <div className="hidden md:flex flex-1 items-center justify-center bg-background">
                        <div className="text-center text-muted-foreground p-8 md:p-12">
                            <MessageSquare className="w-24 h-24 mx-auto mb-4 text-muted-foreground/40" />
                            <h3 className="text-xl font-semibold text-foreground/60 mb-2">
                                Bienvenido al Chat Interno
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                Selecciona una conversación o crea un nuevo grupo para comenzar.
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
                                        if (window.innerWidth < 768) {
                                            setActiveChat(null);
                                        } else {
                                            setIsSidebarVisible(!isSidebarVisible);
                                        }
                                    }}
                                    className="hover:bg-accent flex-shrink-0"
                                    title={isSidebarVisible ? 'Ocultar lista' : 'Mostrar lista'}
                                >
                                    {isSidebarVisible ? (
                                        <PanelLeftClose className="w-5 h-5" />
                                    ) : (
                                        <PanelLeftOpen className="w-5 h-5" />
                                    )}
                                </Button>

                                {/* Avatar e Info */}
                                <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                                    <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-white text-sm md:text-base font-medium flex-shrink-0 overflow-hidden ${
                                        activeChat.type === 'group' ? 'bg-gradient-to-b from-[#4e5fa4] to-[#3e4f94]' : 'bg-primary'
                                    }`}>
                                        {activeChat.type === 'group' ? (
                                            <Users className="w-4 h-4" />
                                        ) : (
                                            <span>{getInitials(activeChat.name)}</span>
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="font-semibold text-sm md:text-base text-foreground truncate">
                                            {activeChat.name}
                                        </h3>
                                        <p className="text-xs text-muted-foreground truncate">
                                            {activeChat.type === 'group'
                                                ? `${activeChat.participants.length} participantes`
                                                : (activeChatInfo?.participants?.find(p => p.id !== auth.user.id)?.is_online
                                                    ? <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full inline-block"></span> En línea</span>
                                                    : 'Sin conexión')
                                            }
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Acciones del header */}
                            <div className="flex items-center gap-1">
                                <Button variant="ghost" size="sm" className="hover:bg-accent">
                                    <Phone className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="sm" className="hover:bg-accent">
                                    <MoreVertical className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Mensajes */}
                        <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar-light bg-card">
                            {messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                    <MessageSquare className="w-16 h-16 mb-4 text-muted-foreground/40" />
                                    <p className="text-sm">No hay mensajes aún. ¡Envía el primero!</p>
                                </div>
                            ) : (
                                <div className="space-y-3 md:space-y-4">
                                    {messages.map((msg) => (
                                        <div
                                            key={msg.id}
                                            className={`flex ${msg.is_mine ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div
                                                className={`max-w-[85%] md:max-w-[70%] px-3 md:px-4 py-2 ${msg.is_mine
                                                    ? 'rounded-[18px_18px_4px_18px] chat-message-sent text-white shadow-[0_2px_4px_rgba(46,63,132,0.2),0_4px_12px_rgba(46,63,132,0.25),inset_0_1px_0_rgba(255,255,255,0.15)]'
                                                    : 'rounded-[18px_18px_18px_4px] card-gradient shadow-[0_1px_3px_rgba(46,63,132,0.06),0_3px_8px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.9)]'
                                                }`}
                                            >
                                                {/* Sender name */}
                                                {!msg.is_mine && msg.user && (
                                                    <p className="text-xs text-primary dark:text-primary opacity-70 mb-1 font-normal">
                                                        {msg.user.name}
                                                    </p>
                                                )}

                                                {/* Image */}
                                                {msg.type === 'image' && msg.file_url && (
                                                    <div className="mb-2">
                                                        <img
                                                            src={msg.file_url}
                                                            alt="Imagen"
                                                            className="max-w-full max-h-96 rounded-xl object-cover"
                                                            loading="lazy"
                                                        />
                                                    </div>
                                                )}

                                                {/* Video */}
                                                {msg.type === 'video' && msg.file_url && (
                                                    <div className="mb-2">
                                                        <video
                                                            src={msg.file_url}
                                                            controls
                                                            className="max-w-full max-h-96 rounded-xl"
                                                            preload="metadata"
                                                        />
                                                    </div>
                                                )}

                                                {/* File / Document */}
                                                {(msg.type === 'document') && msg.file_url && (
                                                    <div className="flex items-center gap-3 p-2 bg-accent/50 dark:bg-accent/30 rounded-lg mb-2">
                                                        <div className="p-2 bg-primary/10 dark:bg-primary/20 rounded-full">
                                                            <FileText className="w-5 h-5 text-primary dark:text-primary" />
                                                        </div>
                                                        <div className="flex flex-col overflow-hidden flex-1">
                                                            <span className="text-xs font-semibold truncate">{msg.file_name || 'Archivo'}</span>
                                                            {msg.file_size_human && (
                                                                <span className="text-[10px] text-muted-foreground font-normal">{msg.file_size_human}</span>
                                                            )}
                                                        </div>
                                                        <a href={msg.file_url} download target="_blank" rel="noopener noreferrer">
                                                            <Download className="w-4 h-4 text-muted-foreground hover:text-foreground" />
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

                                                {/* Text Content */}
                                                {msg.body && (
                                                    <p className="text-sm whitespace-pre-wrap break-words">
                                                        {msg.body}
                                                    </p>
                                                )}

                                                {/* Timestamp */}
                                                <div className={`flex items-center justify-end gap-1 mt-1 text-xs ${msg.is_mine ? 'text-white opacity-70' : 'text-muted-foreground font-normal'}`}>
                                                    <span>{msg.created_at}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} />
                                </div>
                            )}
                        </div>

                        {/* Input Area */}
                        <form onSubmit={handleSendMessage} className="p-3 md:p-4 bg-card border-t border-border">
                            <div className="flex items-end gap-2 md:gap-3">
                                {/* Hidden file input */}
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    onChange={handleFileUpload}
                                />

                                {/* Attach button */}
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="flex hover:bg-accent"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Paperclip className="w-5 h-5 text-primary dark:text-primary" />
                                </Button>

                                {/* Text input */}
                                <div className="relative flex-1">
                                    <Textarea
                                        value={inputText}
                                        onChange={e => setInputText(e.target.value)}
                                        placeholder="Escribe un mensaje..."
                                        className="flex-1 min-h-[40px] md:min-h-[44px] max-h-[100px] md:max-h-[120px] text-sm md:text-base resize-none border-0 card-gradient focus:ring-2 focus:ring-primary shadow-[0_1px_3px_rgba(46,63,132,0.06),0_2px_6px_rgba(46,63,132,0.08),inset_0_1px_0_rgba(255,255,255,0.8)] focus:shadow-[0_2px_6px_rgba(46,63,132,0.12),0_4px_12px_rgba(46,63,132,0.15),inset_0_1px_0_rgba(255,255,255,0.9)] rounded-3xl transition-shadow duration-200"
                                        onKeyDown={handleKeyDown}
                                    />
                                </div>

                                {/* Send button */}
                                <Button
                                    type="submit"
                                    disabled={!inputText.trim() && !isUploading}
                                    className="chat-message-sent hover:from-[#4e5fa4] hover:to-[#3e4f94] text-white w-11 h-11 rounded-full shadow-[0_2px_4px_rgba(46,63,132,0.2),0_4px_12px_rgba(46,63,132,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] hover:shadow-[0_4px_8px_rgba(46,63,132,0.25),0_6px_16px_rgba(46,63,132,0.35),inset_0_1px_0_rgba(255,255,255,0.2)] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed p-0 flex items-center justify-center"
                                >
                                    {isUploading ? (
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <Send className="w-5 h-5" />
                                    )}
                                </Button>
                            </div>
                        </form>
                    </div>
                )}
            </div>

            {/* Modal: Crear nuevo chat o grupo */}
            <Dialog open={showCreateGroup} onOpenChange={setShowCreateGroup}>
                <DialogContent className="sm:max-w-md card-gradient border-2 border-border dark:border-[hsl(231,20%,22%)]">
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
                            <div className="flex flex-wrap gap-2">
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
                                            className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${
                                                isSelected
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
                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                                isSelected
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
        </AdminLayout>
    );
}
