import { Head, router, useForm } from '@inertiajs/react';
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
    PanelLeftOpen
} from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface Message {
    id: number;
    content: string;
    message_type: string;
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
    } | null;
    messages?: Message[];
}

interface ConversationsIndexProps {
    conversations: Conversation[];
    selectedConversation?: Conversation;
    filters: {
        search?: string;
        status?: string;
        assigned?: string;
    };
}

export default function ConversationsIndex({ conversations, selectedConversation, filters }: ConversationsIndexProps) {
    const [search, setSearch] = useState(filters.search || '');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSidebarVisible, setIsSidebarVisible] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    
    const { data, setData, post, reset, processing } = useForm({
        content: '',
    });

    // Scroll automático al final cuando hay nuevos mensajes
    useEffect(() => {
        if (selectedConversation?.messages) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [selectedConversation?.messages]);

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

    const handleSearch = (value: string) => {
        setSearch(value);
        
        // Si hay una conversación seleccionada, mantenerla abierta
        const url = selectedConversation 
            ? `/admin/chat/${selectedConversation.id}`
            : '/admin/chat';
        
        router.get(url, { search: value }, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            only: ['conversations'], // Solo actualizar la lista de conversaciones
        });
    };

    const formatTime = (date: string | null) => {
        if (!date) return '';
        const d = new Date(date);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays === 1) {
            return 'Ayer';
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
            case 'in_progress':
                return 'bg-blue-500';
            case 'resolved':
                return 'bg-gray-400';
            default:
                return 'bg-gray-300';
        }
    };

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            active: 'Activa',
            pending: 'Pendiente',
            in_progress: 'En progreso',
            resolved: 'Resuelta',
            closed: 'Cerrada',
        };
        return labels[status] || status;
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'sent':
                return <Check className="w-4 h-4 text-gray-400" />;
            case 'delivered':
                return <CheckCheck className="w-4 h-4 text-gray-400" />;
            case 'read':
                return <CheckCheck className="w-4 h-4 text-blue-500" />;
            default:
                return null;
        }
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!data.content.trim() || !selectedConversation) return;

        setIsSubmitting(true);
        post(`/admin/chat/${selectedConversation.id}/send`, {
            preserveScroll: true,
            onSuccess: () => {
                reset();
                setIsSubmitting(false);
            },
            onError: () => {
                setIsSubmitting(false);
            },
        });
    };

    const handleAssign = () => {
        if (!selectedConversation) return;
        router.post(`/admin/chat/${selectedConversation.id}/assign`, {}, {
            preserveScroll: true,
        });
    };

    const handleStatusChange = (status: string) => {
        if (!selectedConversation) return;
        router.post(`/admin/chat/${selectedConversation.id}/status`, { status }, {
            preserveScroll: true,
        });
    };

    const handleCloseChat = () => {
        router.get('/admin/chat', {}, {
            preserveState: true,
        });
    };

    return (
        <AdminLayout>
            <Head title="Conversaciones" />

            <div className="h-[calc(100vh-0px)] flex bg-gray-50">
                {/* Lista de Conversaciones - Izquierda */}
                <div className={`bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ${
                    isSidebarVisible ? 'w-96' : 'w-0 overflow-hidden'
                }`}>
                    {/* Header */}
                    <div className="p-4 border-b border-gray-200">
                        <h2 className="text-xl font-bold text-black mb-3">Conversaciones</h2>
                        
                        {/* Búsqueda */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <Input
                                type="text"
                                placeholder="Buscar conversación..."
                                value={search}
                                onChange={(e) => handleSearch(e.target.value)}
                                className="pl-10 border-0 bg-gray-100 focus:bg-gray-150 shadow-none"
                            />
                        </div>
                    </div>

                    {/* Lista de Conversaciones */}
                    <div className="flex-1 overflow-y-auto">
                        {conversations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
                                <MessageSquare className="w-16 h-16 mb-4 text-gray-300" />
                                <p className="text-center text-sm">
                                    No hay conversaciones disponibles
                                </p>
                                <p className="text-center text-xs text-gray-400 mt-2">
                                    Las conversaciones aparecerán aquí cuando los clientes escriban
                                </p>
                            </div>
                        ) : (
                            conversations.map((conversation) => (
                                <button
                                    key={conversation.id}
                                    onClick={() => router.get(`/admin/chat/${conversation.id}`, {}, { preserveScroll: true, preserveState: true })}
                                    className={`w-full p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors flex items-start gap-3 text-left ${
                                        selectedConversation?.id === conversation.id ? 'bg-gray-100' : ''
                                    }`}
                                >
                                    {/* Avatar */}
                                    <div className="relative">
                                        <div className="w-12 h-12 rounded-full bg-[#2e3f84] flex items-center justify-center text-white font-medium">
                                            {conversation.contact_name?.[0]?.toUpperCase() || '?'}
                                        </div>
                                        {conversation.unread_count > 0 && (
                                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                                {conversation.unread_count}
                                            </div>
                                        )}
                                    </div>

                                    {/* Información */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <h3 className="font-semibold text-black truncate">
                                                {conversation.contact_name || conversation.phone_number}
                                            </h3>
                                            <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                                                {formatTime(conversation.last_message_at)}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600 truncate">
                                            {conversation.last_message?.content || 'Sin mensajes'}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`w-2 h-2 rounded-full ${getStatusColor(conversation.status)}`}></span>
                                            <span className="text-xs text-gray-500 capitalize">{conversation.status}</span>
                                        </div>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Área de Chat - Derecha */}
                {!selectedConversation ? (
                    <div className="flex-1 flex items-center justify-center bg-gray-50">
                        <div className="text-center text-gray-500">
                            <MessageSquare className="w-24 h-24 mx-auto mb-4 text-gray-300" />
                            <h3 className="text-xl font-semibold text-black mb-2">
                                Selecciona una conversación
                            </h3>
                            <p className="text-sm">
                                Elige una conversación de la izquierda para ver los mensajes
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col bg-white">
                        {/* Header del Chat */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
                            <div className="flex items-center gap-4">
                                {/* Botón toggle sidebar */}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsSidebarVisible(!isSidebarVisible)}
                                    className="hover:bg-gray-100"
                                    title={isSidebarVisible ? "Ocultar conversaciones" : "Mostrar conversaciones"}
                                >
                                    {isSidebarVisible ? (
                                        <PanelLeftClose className="w-5 h-5" />
                                    ) : (
                                        <PanelLeftOpen className="w-5 h-5" />
                                    )}
                                </Button>
                                {/* Avatar e Información */}
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-[#2e3f84] flex items-center justify-center text-white font-medium">
                                        {selectedConversation.contact_name?.[0]?.toUpperCase() || '?'}
                                    </div>
                                    <div>
                                        <h2 className="font-semibold text-black">
                                            {selectedConversation.contact_name || 'Sin nombre'}
                                        </h2>
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <Phone className="w-3 h-3" />
                                            <span>{selectedConversation.phone_number}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Estado */}
                                <div className="flex items-center gap-2 ml-4 px-3 py-1 rounded-full bg-gray-100">
                                    <span className={`w-2 h-2 rounded-full ${getStatusColor(selectedConversation.status)}`}></span>
                                    <span className="text-sm text-gray-700">{getStatusLabel(selectedConversation.status)}</span>
                                </div>

                                {/* Asignación */}
                                {selectedConversation.assigned_user && (
                                    <div className="text-sm text-gray-600 ml-2">
                                        Asignado a: <span className="font-medium text-black">{selectedConversation.assigned_user.name}</span>
                                    </div>
                                )}
                            </div>

                            {/* Menú de Acciones y Cerrar */}
                            <div className="flex items-center gap-2">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm">
                                            <MoreVertical className="w-5 h-5" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48 bg-white">
                                        <DropdownMenuItem onClick={handleAssign} className="cursor-pointer hover:bg-gray-100">
                                            {selectedConversation.assigned_to ? 'Reasignar a mí' : 'Asignarme esta conversación'}
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem 
                                            onClick={() => handleStatusChange('in_progress')}
                                            className="cursor-pointer hover:bg-gray-100"
                                        >
                                            Marcar como en progreso
                                        </DropdownMenuItem>
                                        <DropdownMenuItem 
                                            onClick={() => handleStatusChange('resolved')}
                                            className="cursor-pointer hover:bg-gray-100"
                                        >
                                            Marcar como resuelta
                                        </DropdownMenuItem>
                                        <DropdownMenuItem 
                                            onClick={() => handleStatusChange('closed')}
                                            className="cursor-pointer hover:bg-gray-100"
                                        >
                                            Cerrar conversación
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                {/* Botón Cerrar Chat */}
                                <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={handleCloseChat}
                                    className="hover:bg-gray-100"
                                    title="Cerrar chat (Esc)"
                                >
                                    <X className="w-5 h-5" />
                                </Button>
                            </div>
                        </div>

                        {/* Área de Mensajes */}
                        <div className="flex-1 overflow-y-auto px-6 py-4 bg-gray-50">
                            {!selectedConversation.messages || selectedConversation.messages.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-gray-500">
                                    <p>No hay mensajes en esta conversación</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {selectedConversation.messages.map((message) => (
                                        <div
                                            key={message.id}
                                            className={`flex ${message.is_from_user ? 'justify-start' : 'justify-end'}`}
                                        >
                                            <div
                                                className={`max-w-[70%] rounded-lg px-4 py-2 ${
                                                    message.is_from_user
                                                        ? 'bg-white border border-gray-200'
                                                        : 'bg-[#2e3f84] text-white'
                                                }`}
                                            >
                                                {/* Remitente (si es asesor) */}
                                                {!message.is_from_user && message.sender && (
                                                    <p className="text-xs opacity-70 mb-1">
                                                        {message.sender.name}
                                                    </p>
                                                )}
                                                
                                                {/* Contenido del mensaje */}
                                                <p className="text-sm whitespace-pre-wrap break-words">
                                                    {message.content}
                                                </p>

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
                                    <div ref={messagesEndRef} />
                                </div>
                            )}
                        </div>

                        {/* Área de Entrada de Mensaje */}
                        <form onSubmit={handleSubmit} className="px-6 py-4 bg-white border-t border-gray-200">
                            <div className="flex items-end gap-3">
                                {/* Botón de adjuntar (futuro) */}
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="hover:bg-gray-100"
                                    disabled
                                >
                                    <Paperclip className="w-5 h-5 text-gray-400" />
                                </Button>

                                {/* Campo de texto */}
                                <Textarea
                                    value={data.content}
                                    onChange={(e) => setData('content', e.target.value)}
                                    placeholder="Escribe un mensaje..."
                                    className="flex-1 min-h-[44px] max-h-[120px] resize-none border-gray-300 focus:border-[#2e3f84] focus:ring-[#2e3f84] shadow-none"
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
                                    disabled={!data.content.trim() || processing || isSubmitting}
                                    className="bg-[#2e3f84] hover:bg-[#1e2f74] text-white px-6"
                                >
                                    <Send className="w-5 h-5" />
                                </Button>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                Presiona Enter para enviar, Shift + Enter para nueva línea
                            </p>
                        </form>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
