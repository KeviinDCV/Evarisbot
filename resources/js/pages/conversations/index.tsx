import { Head, router } from '@inertiajs/react';
import AdminLayout from '@/layouts/admin-layout';
import { Input } from '@/components/ui/input';
import { Search, MessageSquare } from 'lucide-react';
import { useState } from 'react';

interface Conversation {
    id: number;
    phone_number: string;
    contact_name: string | null;
    status: string;
    unread_count: number;
    last_message_at: string | null;
    last_message: {
        content: string;
        created_at: string;
    } | null;
}

interface ConversationsIndexProps {
    conversations: Conversation[];
    filters: {
        search?: string;
        status?: string;
        assigned?: string;
    };
}

export default function ConversationsIndex({ conversations, filters }: ConversationsIndexProps) {
    const [search, setSearch] = useState(filters.search || '');

    const handleSearch = (value: string) => {
        setSearch(value);
        router.get('/admin/chat', { search: value }, {
            preserveState: true,
            replace: true,
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

    return (
        <AdminLayout>
            <Head title="Conversaciones" />

            <div className="h-[calc(100vh-0px)] flex bg-gray-50">
                {/* Lista de Conversaciones - Izquierda */}
                <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
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
                                    onClick={() => router.visit(`/admin/chat/${conversation.id}`)}
                                    className="w-full p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors flex items-start gap-3 text-left"
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
            </div>
        </AdminLayout>
    );
}
