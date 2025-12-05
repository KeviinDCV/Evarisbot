import { Head, router, useForm } from '@inertiajs/react';
import AdminLayout from '@/layouts/admin-layout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
    ArrowLeft, 
    Send, 
    MoreVertical, 
    Phone,
    Paperclip,
    Check,
    CheckCheck,
    Clock,
    X
} from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useTranslation } from 'react-i18next';

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
    messages: Message[];
}

interface ConversationShowProps {
    conversation: Conversation;
}

export default function ConversationShow({ conversation }: ConversationShowProps) {
    const { t } = useTranslation();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const { data, setData, post, reset, processing } = useForm({
        content: '',
    });

    // Scroll automático al final cuando hay nuevos mensajes
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [conversation.messages]);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!data.content.trim()) return;

        setIsSubmitting(true);
        post(`/admin/chat/${conversation.id}/send`, {
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
        router.post(`/admin/chat/${conversation.id}/assign`, {}, {
            preserveScroll: true,
        });
    };

    const handleStatusChange = (status: string) => {
        router.post(`/admin/chat/${conversation.id}/status`, { status }, {
            preserveScroll: true,
        });
    };

    const formatTime = (date: string) => {
        return new Date(date).toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
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
            case 'closed':
                return 'bg-gray-300';
            default:
                return 'bg-gray-300';
        }
    };

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            active: t('conversations.statusLabels.active'),
            pending: t('conversations.statusLabels.pending'),
            in_progress: t('conversations.statusLabels.inProgress'),
            resolved: t('conversations.statusLabels.resolved'),
            closed: t('conversations.statusLabels.closed'),
        };
        return labels[status] || status;
    };

    return (
        <AdminLayout>
            <Head title={`Chat - ${conversation.contact_name || conversation.phone_number}`} />

            <div className="h-[calc(100vh-0px)] flex flex-col bg-white">
                {/* Header del Chat */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.visit('/admin/chat')}
                            className="hover:bg-gray-100"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Button>

                        {/* Avatar e Información */}
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#2e3f84] flex items-center justify-center text-white font-medium">
                                {conversation.contact_name?.[0]?.toUpperCase() || '?'}
                            </div>
                            <div>
                                <h2 className="font-semibold text-black">
                                    {conversation.contact_name || t('conversations.noName')}
                                </h2>
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <Phone className="w-3 h-3" />
                                    <span>{conversation.phone_number}</span>
                                </div>
                            </div>
                        </div>

                        {/* Estado */}
                        <div className="flex items-center gap-2 ml-4 px-3 py-1 rounded-full bg-gray-100">
                            <span className={`w-2 h-2 rounded-full ${getStatusColor(conversation.status)}`}></span>
                            <span className="text-sm text-gray-700">{getStatusLabel(conversation.status)}</span>
                        </div>

                        {/* Asignación */}
                        {conversation.assigned_user && (
                            <div className="text-sm text-gray-600 ml-2">
                                {t('conversations.assignedToLabel')} <span className="font-medium text-black">{conversation.assigned_user.name}</span>
                            </div>
                        )}
                    </div>

                    {/* Menú de Acciones */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                                <MoreVertical className="w-5 h-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 bg-white">
                            <DropdownMenuItem onClick={handleAssign} className="cursor-pointer hover:bg-gray-100">
                                {conversation.assigned_to ? t('conversations.reassignToMe') : t('conversations.assignToMe')}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onClick={() => handleStatusChange('in_progress')}
                                className="cursor-pointer hover:bg-gray-100"
                            >
                                {t('conversations.markAsInProgress')}
                            </DropdownMenuItem>

                            {/* Marcar como resuelta / Reabrir */}
                            {conversation.status === 'resolved' ? (
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

                            <DropdownMenuItem
                                onClick={() => handleStatusChange('closed')}
                                className="cursor-pointer hover:bg-gray-100"
                            >
                                {t('conversations.closeConversation')}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Área de Mensajes */}
                <div className="flex-1 overflow-y-auto px-6 py-4 bg-gray-50">
                    {conversation.messages.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-gray-500">
                            <p>{t('conversations.noMessagesInConversation')}</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {conversation.messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={`flex ${message.is_from_user ? 'justify-start' : 'justify-end'}`}
                                >
                                    <div
                                        className={`max-w-[70%] rounded-none px-4 py-2 ${
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
                            placeholder={t('conversations.typeMessage')}
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
                        {t('conversations.inputHint')}
                    </p>
                </form>
            </div>
        </AdminLayout>
    );
}
