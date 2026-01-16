import { Head, useForm, Link } from '@inertiajs/react';
import AdminLayout from '@/layouts/admin-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Send, Users, Search, Check } from 'lucide-react';
import { useState } from 'react';

interface Template {
    id: number;
    name: string;
    subject: string | null;
    content: string;
    message_type: string;
}

interface Recipient {
    id: number;
    phone_number: string;
    contact_name: string;
    last_message_at: string | null;
    unread_count: number;
}

interface SendTemplateProps {
    template: Template;
    recipients: Recipient[];
}

export default function SendTemplate({ template, recipients }: SendTemplateProps) {
    const [search, setSearch] = useState('');
    const [sendToAll, setSendToAll] = useState(false);
    const [selectedRecipients, setSelectedRecipients] = useState<number[]>([]);

    const form = useForm({
        send_to_all: false,
        recipient_ids: [] as number[],
    });

    const filteredRecipients = recipients.filter(r =>
        r.phone_number.includes(search) ||
        r.contact_name.toLowerCase().includes(search.toLowerCase())
    );

    const toggleRecipient = (id: number) => {
        if (sendToAll) return; // No permitir selección individual si "todos" está activo
        
        setSelectedRecipients(prev =>
            prev.includes(id)
                ? prev.filter(recipientId => recipientId !== id)
                : [...prev, id]
        );
    };

    const toggleAll = () => {
        setSendToAll(!sendToAll);
        if (!sendToAll) {
            setSelectedRecipients([]);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        form.setData({
            send_to_all: sendToAll,
            recipient_ids: sendToAll ? [] : selectedRecipients,
        });

        form.post(`/admin/templates/${template.id}/send`, {
            onSuccess: () => {
                // Redirigir a la lista de plantillas
            },
        });
    };

    const canSend = sendToAll || selectedRecipients.length > 0;
    const totalSelected = sendToAll ? recipients.length : selectedRecipients.length;

    return (
        <AdminLayout>
            <Head title={`Enviar: ${template.name}`} />

            <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
                <div className="max-w-6xl mx-auto">
                    {/* Header */}
                    <div className="mb-6" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                            <Link href="/admin/templates">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="transition-all duration-200"
                                    style={{
                                        backgroundColor: 'var(--layer-deep)',
                                        boxShadow: 'var(--shadow-sm)',
                                    }}
                                >
                                    <ArrowLeft className="w-4 h-4 mr-2" />
                                    Volver
                                </Button>
                            </Link>
                            <div>
                                <h1 className="font-bold" style={{ fontSize: 'var(--text-3xl)', color: 'var(--primary-base)' }}>
                                    Envío Masivo
                                </h1>
                                <p className="text-muted-foreground" style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-xs)' }}>
                                    Selecciona los destinatarios para: <span className="font-semibold">{template.name}</span>
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3" style={{ gap: 'var(--space-lg)' }}>
                        {/* Lista de Destinatarios */}
                        <div 
                            className="card-gradient rounded-none p-6 lg:col-span-2 shadow-[0_1px_3px_rgba(46,63,132,0.06),0_2px_6px_rgba(46,63,132,0.08),0_6px_16px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.8)]"
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 'var(--space-lg)',
                            }}
                        >
                            <div>
                                <h2 className="font-bold mb-2" style={{ fontSize: 'var(--text-xl)', color: 'var(--primary-base)' }}>
                                    Destinatarios Disponibles
                                </h2>
                                <p className="text-muted-foreground" style={{ fontSize: 'var(--text-sm)' }}>
                                    {recipients.length} contactos disponibles
                                </p>
                            </div>

                            {/* Enviar a Todos */}
                            <div 
                                onClick={toggleAll}
                                className="rounded-none p-4 cursor-pointer transition-all duration-200"
                                style={{
                                    backgroundColor: sendToAll ? 'var(--primary-base)' : 'var(--layer-base)',
                                    color: sendToAll ? 'white' : 'var(--primary-base)',
                                    boxShadow: sendToAll ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--space-md)',
                                }}
                            >
                                <div 
                                    className="rounded-none flex items-center justify-center"
                                    style={{
                                        width: '24px',
                                        height: '24px',
                                        backgroundColor: sendToAll ? 'white' : 'var(--layer-deep)',
                                        color: sendToAll ? 'var(--primary-base)' : 'transparent',
                                    }}
                                >
                                    {sendToAll && <Check className="w-4 h-4" />}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <p className="font-bold" style={{ fontSize: 'var(--text-base)' }}>
                                        <Users className="inline w-5 h-5 mr-2" />
                                        Enviar a TODOS los contactos
                                    </p>
                                    <p style={{ fontSize: 'var(--text-xs)', opacity: 0.8 }}>
                                        Se enviará a {recipients.length} destinatarios
                                    </p>
                                </div>
                            </div>

                            {/* Búsqueda */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Buscar por nombre o teléfono..."
                                    disabled={sendToAll}
                                    className="pl-10 border-0 rounded-none transition-all duration-200"
                                    style={{
                                        backgroundColor: 'var(--layer-base)',
                                        boxShadow: 'var(--shadow-inset-sm)',
                                        height: 'clamp(2.25rem, 2.25rem + 0.15vw, 2.5rem)',
                                        fontSize: 'var(--text-sm)',
                                    }}
                                />
                            </div>

                            {/* Lista */}
                            <div 
                                style={{
                                    maxHeight: '400px',
                                    overflowY: 'auto',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 'var(--space-sm)',
                                }}
                            >
                                {filteredRecipients.map((recipient) => {
                                    const isSelected = selectedRecipients.includes(recipient.id);
                                    
                                    return (
                                        <div
                                            key={recipient.id}
                                            onClick={() => toggleRecipient(recipient.id)}
                                            className="rounded-none p-3 cursor-pointer transition-all duration-200"
                                            style={{
                                                backgroundColor: isSelected ? 'var(--primary-base)' : 'var(--layer-base)',
                                                color: isSelected ? 'white' : 'var(--primary-base)',
                                                boxShadow: isSelected ? 'var(--shadow-sm)' : 'none',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 'var(--space-sm)',
                                                opacity: sendToAll ? 0.5 : 1,
                                                pointerEvents: sendToAll ? 'none' : 'auto',
                                            }}
                                        >
                                            <div 
                                                className="rounded flex items-center justify-center flex-shrink-0"
                                                style={{
                                                    width: '20px',
                                                    height: '20px',
                                                    backgroundColor: isSelected ? 'white' : 'var(--layer-deep)',
                                                    color: isSelected ? 'var(--primary-base)' : 'transparent',
                                                }}
                                            >
                                                {isSelected && <Check className="w-3 h-3" />}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p className="font-semibold truncate" style={{ fontSize: 'var(--text-sm)' }}>
                                                    {recipient.contact_name}
                                                </p>
                                                <p className="truncate" style={{ fontSize: 'var(--text-xs)', opacity: 0.8 }}>
                                                    {recipient.phone_number}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}

                                {filteredRecipients.length === 0 && (
                                    <div className="text-center py-8">
                                        <p className="text-muted-foreground" style={{ fontSize: 'var(--text-sm)' }}>
                                            No se encontraron contactos
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Panel de Resumen y Envío */}
                        <div 
                            className="card-gradient rounded-none p-6 lg:col-span-1 shadow-[0_1px_3px_rgba(46,63,132,0.06),0_2px_6px_rgba(46,63,132,0.08),0_6px_16px_rgba(46,63,132,0.12),inset_0_1px_0_rgba(255,255,255,0.8)]"
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 'var(--space-lg)',
                                height: 'fit-content',
                            }}
                        >
                            <div>
                                <h2 className="font-bold mb-2" style={{ fontSize: 'var(--text-xl)', color: 'var(--primary-base)' }}>
                                    Resumen
                                </h2>
                            </div>

                            {/* Vista Previa */}
                            <div 
                                className="rounded-none p-4"
                                style={{
                                    backgroundColor: 'var(--layer-base)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 'var(--space-sm)',
                                }}
                            >
                                <div>
                                    <p className="text-muted-foreground" style={{ fontSize: 'var(--text-xs)' }}>Plantilla</p>
                                    <p className="font-bold" style={{ fontSize: 'var(--text-sm)', color: 'var(--primary-base)' }}>
                                        {template.name}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground" style={{ fontSize: 'var(--text-xs)' }}>Tipo</p>
                                    <p className="font-semibold" style={{ fontSize: 'var(--text-sm)', color: 'var(--primary-base)' }}>
                                        {template.message_type === 'text' && 'Texto'}
                                        {template.message_type === 'image' && 'Imagen'}
                                        {template.message_type === 'document' && 'Documento'}
                                    </p>
                                </div>
                            </div>

                            {/* Estadísticas */}
                            <div 
                                className="rounded-none p-4"
                                style={{
                                    backgroundColor: 'var(--layer-base)',
                                }}
                            >
                                <p className="text-muted-foreground mb-2" style={{ fontSize: 'var(--text-xs)' }}>Total de Destinatarios</p>
                                <p className="font-bold" style={{ fontSize: 'var(--text-3xl)', color: 'var(--primary-base)' }}>
                                    {totalSelected}
                                </p>
                            </div>

                            {/* Mensaje de Advertencia */}
                            {canSend && (
                                <div 
                                    className="rounded-none p-3"
                                    style={{
                                        backgroundColor: 'rgba(234, 179, 8, 0.1)',
                                        border: '1px solid rgba(234, 179, 8, 0.3)',
                                    }}
                                >
                                    <p className="text-yellow-700" style={{ fontSize: 'var(--text-xs)' }}>
                                        ⚠️ El envío se procesará en segundo plano. Recibirás una notificación cuando se complete.
                                    </p>
                                </div>
                            )}

                            {/* Botón de Envío */}
                            <form onSubmit={handleSubmit}>
                                <Button
                                    type="submit"
                                    disabled={!canSend || form.processing}
                                    className="w-full font-semibold text-white transition-all duration-200 border-0 relative overflow-hidden"
                                    style={{
                                        backgroundColor: canSend ? 'var(--primary-base)' : 'gray',
                                        boxShadow: canSend ? 'var(--shadow-md)' : 'none',
                                        backgroundImage: canSend ? 'var(--gradient-shine)' : 'none',
                                        height: 'clamp(2.5rem, 2.5rem + 0.15vw, 2.75rem)',
                                        fontSize: 'var(--text-base)',
                                        opacity: canSend ? 1 : 0.5,
                                        cursor: canSend ? 'pointer' : 'not-allowed',
                                    }}
                                >
                                    <Send className="w-4 h-4 mr-2" />
                                    {form.processing ? 'Enviando...' : `Enviar a ${totalSelected} contactos`}
                                </Button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
