import { router, useForm } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Bot,
    Plus,
    Trash2,
    Power,
    PowerOff,
    Edit,
    MessageSquare,
    Sparkles,
    MousePointerClick,
    ChevronDown,
    ChevronUp,
    Save,
} from 'lucide-react';
import { useState } from 'react';

interface WelcomeFlowButton {
    id: string;
    title: string;
}

interface WelcomeFlow {
    id: number;
    name: string;
    message: string;
    buttons: WelcomeFlowButton[] | null;
    responses: Record<string, string> | null;
    is_active: boolean;
    trigger_type: 'first_contact' | 'every_new_conversation' | 'always';
    created_by: number | null;
    updated_by: number | null;
    creator?: { name: string } | null;
    updater?: { name: string } | null;
    created_at: string;
    updated_at: string;
}

interface WelcomeFlowSectionProps {
    welcomeFlows: WelcomeFlow[];
}

export default function WelcomeFlowSection({ welcomeFlows }: WelcomeFlowSectionProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingFlow, setEditingFlow] = useState<WelcomeFlow | null>(null);
    const [expandedFlowId, setExpandedFlowId] = useState<number | null>(null);

    const { data, setData, post, put, processing, errors, reset } = useForm<{
        name: string;
        message: string;
        buttons: WelcomeFlowButton[];
        responses: Record<string, string>;
        is_active: boolean;
        trigger_type: string;
    }>({
        name: '',
        message: '',
        buttons: [],
        responses: {},
        is_active: false,
        trigger_type: 'first_contact',
    });

    const openCreateModal = () => {
        reset();
        setData({
            name: '',
            message: '',
            buttons: [],
            responses: {},
            is_active: false,
            trigger_type: 'first_contact',
        });
        setEditingFlow(null);
        setIsModalOpen(true);
    };

    const openEditModal = (flow: WelcomeFlow) => {
        setEditingFlow(flow);
        setData({
            name: flow.name,
            message: flow.message,
            buttons: flow.buttons || [],
            responses: flow.responses || {},
            is_active: flow.is_active,
            trigger_type: flow.trigger_type,
        });
        setIsModalOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (editingFlow) {
            put(`/admin/welcome-flows/${editingFlow.id}`, {
                preserveScroll: true,
                onSuccess: () => {
                    setIsModalOpen(false);
                    setEditingFlow(null);
                    reset();
                },
            });
        } else {
            post('/admin/welcome-flows', {
                preserveScroll: true,
                onSuccess: () => {
                    setIsModalOpen(false);
                    reset();
                },
            });
        }
    };

    const addButton = () => {
        if (data.buttons.length >= 3) return; // WhatsApp limit
        const newId = `btn_${Date.now()}`;
        setData('buttons', [...data.buttons, { id: newId, title: '' }]);
    };

    const removeButton = (index: number) => {
        const buttonId = data.buttons[index].id;
        const newButtons = data.buttons.filter((_, i) => i !== index);
        const newResponses = { ...data.responses };
        delete newResponses[buttonId];
        setData((prev) => ({
            ...prev,
            buttons: newButtons,
            responses: newResponses,
        }));
    };

    const updateButton = (index: number, field: 'id' | 'title', value: string) => {
        const newButtons = [...data.buttons];
        if (field === 'title') {
            newButtons[index] = { ...newButtons[index], title: value.slice(0, 20) };
        } else {
            // If changing id, update responses key as well
            const oldId = newButtons[index].id;
            newButtons[index] = { ...newButtons[index], id: value };
            const newResponses = { ...data.responses };
            if (newResponses[oldId]) {
                newResponses[value] = newResponses[oldId];
                delete newResponses[oldId];
            }
            setData((prev) => ({ ...prev, buttons: newButtons, responses: newResponses }));
            return;
        }
        setData('buttons', newButtons);
    };

    const updateResponse = (buttonId: string, value: string) => {
        setData('responses', { ...data.responses, [buttonId]: value });
    };

    const toggleFlowStatus = (flowId: number) => {
        router.post(`/admin/welcome-flows/${flowId}/toggle`, {}, { preserveScroll: true });
    };

    const deleteFlow = (flowId: number) => {
        if (confirm('¿Estás seguro de eliminar este flujo de bienvenida?')) {
            router.delete(`/admin/welcome-flows/${flowId}`, { preserveScroll: true });
        }
    };

    const triggerTypeLabels: Record<string, string> = {
        first_contact: 'Primer contacto',
        every_new_conversation: 'Cada conversación nueva',
        always: 'Siempre',
    };

    return (
        <>
            {/* Sección Menú de Bienvenida */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div
                            className="p-2.5 rounded-xl"
                            style={{
                                background: 'linear-gradient(135deg, var(--primary-base), var(--primary-darker))',
                                boxShadow: '0 4px 12px rgba(46, 63, 132, 0.3)',
                            }}
                        >
                            <Bot className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2
                                className="font-bold settings-title"
                                style={{ fontSize: 'var(--text-lg)' }}
                            >
                                Menú de Bienvenida
                            </h2>
                            <p className="settings-subtitle" style={{ fontSize: 'var(--text-xs)' }}>
                                Respuesta automática cuando un contacto nuevo escribe por WhatsApp
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={openCreateModal}
                        className="font-semibold text-white transition-all duration-200 border-0 relative overflow-hidden rounded-xl"
                        style={{
                            backgroundColor: 'var(--primary-base)',
                            boxShadow: 'var(--shadow-md)',
                            backgroundImage: 'var(--gradient-shine)',
                            height: 'clamp(2.25rem, 2.25rem + 0.15vw, 2.5rem)',
                            padding: '0 var(--space-lg)',
                            fontSize: 'var(--text-sm)',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--primary-darker)';
                            e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--primary-base)';
                            e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Nuevo flujo
                    </Button>
                </div>

                {welcomeFlows.length === 0 ? (
                    <div className="card-gradient rounded-2xl border border-white/40 dark:border-white/10 shadow-lg shadow-[#2e3f84]/5 p-8 text-center">
                        <Sparkles className="w-12 h-12 mx-auto mb-4 settings-subtitle opacity-40" />
                        <h3
                            className="font-bold mb-2 settings-title"
                            style={{ fontSize: 'var(--text-lg)' }}
                        >
                            Sin flujos de bienvenida
                        </h3>
                        <p className="settings-subtitle mb-4" style={{ fontSize: 'var(--text-sm)' }}>
                            Crea un menú de bienvenida para responder automáticamente a los nuevos contactos.
                        </p>
                        <Button
                            onClick={openCreateModal}
                            style={{ backgroundColor: 'var(--primary-base)', color: 'white' }}
                            className="rounded-xl"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Crear flujo de bienvenida
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {welcomeFlows.map((flow) => (
                            <div
                                key={flow.id}
                                className="card-gradient rounded-2xl border border-white/40 dark:border-white/10 shadow-lg shadow-[#2e3f84]/5 overflow-hidden transition-all duration-300"
                            >
                                {/* Header del flujo */}
                                <div className="p-4 md:p-5 flex items-center justify-between">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div
                                            className={`p-2 rounded-lg transition-colors ${flow.is_active
                                                ? 'bg-green-100 dark:bg-green-900/30'
                                                : 'bg-gray-100 dark:bg-gray-800/50'
                                                }`}
                                        >
                                            <MessageSquare
                                                className={`w-4 h-4 ${flow.is_active
                                                    ? 'text-green-600 dark:text-green-400'
                                                    : 'text-gray-400 dark:text-gray-500'
                                                    }`}
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3
                                                    className="font-semibold settings-title truncate"
                                                    style={{ fontSize: 'var(--text-base)' }}
                                                >
                                                    {flow.name}
                                                </h3>
                                                <span
                                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${flow.is_active
                                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                        : 'bg-gray-100 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400'
                                                        }`}
                                                >
                                                    {flow.is_active ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </div>
                                            <p
                                                className="settings-subtitle truncate mt-0.5"
                                                style={{ fontSize: 'var(--text-xs)' }}
                                            >
                                                {triggerTypeLabels[flow.trigger_type]}
                                                {(flow as any).steps?.length > 0
                                                    ? ` · ${(flow as any).steps.length} paso(s)`
                                                    : ` · ${flow.buttons?.length || 0} botón(es)`}
                                                {flow.creator &&
                                                    ` · Creado por ${flow.creator.name}`}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 ml-4">
                                        <button
                                            onClick={() =>
                                                setExpandedFlowId(
                                                    expandedFlowId === flow.id ? null : flow.id,
                                                )
                                            }
                                            className="p-2 rounded-lg hover:bg-accent transition-colors settings-subtitle"
                                            title="Ver detalles"
                                        >
                                            {expandedFlowId === flow.id ? (
                                                <ChevronUp className="w-4 h-4" />
                                            ) : (
                                                <ChevronDown className="w-4 h-4" />
                                            )}
                                        </button>
                                        <button
                                            onClick={() => toggleFlowStatus(flow.id)}
                                            className={`p-2 rounded-lg transition-colors ${flow.is_active
                                                ? 'hover:bg-red-50 dark:hover:bg-red-900/20 text-green-600 dark:text-green-400'
                                                : 'hover:bg-green-50 dark:hover:bg-green-900/20 text-gray-400 dark:text-gray-500'
                                                }`}
                                            title={flow.is_active ? 'Desactivar' : 'Activar'}
                                        >
                                            {flow.is_active ? (
                                                <Power className="w-4 h-4" />
                                            ) : (
                                                <PowerOff className="w-4 h-4" />
                                            )}
                                        </button>
                                        <button
                                            onClick={() => openEditModal(flow)}
                                            className="p-2 rounded-lg hover:bg-accent transition-colors settings-subtitle"
                                            title="Editar"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => deleteFlow(flow.id)}
                                            className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors"
                                            title="Eliminar"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Detalle expandido */}
                                {expandedFlowId === flow.id && (
                                    <div className="border-t border-border dark:border-[hsl(231,20%,20%)] p-4 md:p-5 animate-in fade-in slide-in-from-top-1 duration-200">
                                        {/* Si tiene steps, mostrar flujo multi-paso */}
                                        {(flow as any).steps && (flow as any).steps.length > 0 ? (
                                            <div className="space-y-4">
                                                <Label className="settings-label mb-2 block font-semibold" style={{ fontSize: 'var(--text-xs)' }}>
                                                    Flujo conversacional ({(flow as any).steps.length} pasos)
                                                </Label>
                                                {(flow as any).steps.map((step: any, stepIdx: number) => (
                                                    <div key={step.id}>
                                                        {/* Step card */}
                                                        <div className="relative p-4 rounded-xl border border-border dark:border-[hsl(231,20%,20%)] bg-background/50">
                                                            {/* Step header */}
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <div
                                                                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${step.is_entry_point
                                                                        ? 'bg-green-500'
                                                                        : step.step_key === 'rejected' || step.step_key === '__complete__'
                                                                            ? 'bg-red-400'
                                                                            : 'bg-[var(--primary-base)]'
                                                                        }`}
                                                                    style={
                                                                        !step.is_entry_point && step.step_key !== 'rejected'
                                                                            ? { backgroundColor: 'var(--primary-base)' }
                                                                            : {}
                                                                    }
                                                                >
                                                                    {stepIdx + 1}
                                                                </div>
                                                                <div className="flex-1">
                                                                    <span className="text-sm font-semibold settings-title">
                                                                        {step.step_key}
                                                                    </span>
                                                                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-accent settings-subtitle">
                                                                        {step.message_type === 'interactive_buttons'
                                                                            ? '🔘 Botones'
                                                                            : step.message_type === 'wait_response'
                                                                                ? '⌨️ Espera texto'
                                                                                : '💬 Texto'}
                                                                    </span>
                                                                    {step.is_entry_point && (
                                                                        <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                                                            Punto de entrada
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Message bubble */}
                                                            <div className="bg-[#e7f8d4] dark:bg-[#1b3a1a] p-3 rounded-2xl rounded-tl-none max-w-lg shadow-sm mb-3">
                                                                <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                                                                    {step.message.length > 200
                                                                        ? step.message.slice(0, 200) + '...'
                                                                        : step.message}
                                                                </p>
                                                            </div>

                                                            {/* Buttons preview */}
                                                            {step.buttons && step.buttons.length > 0 && (
                                                                <div className="flex gap-2 flex-wrap mb-2">
                                                                    {step.buttons.map((btn: any) => (
                                                                        <div
                                                                            key={btn.id}
                                                                            className="px-3 py-1.5 rounded-lg border border-[#25D366]/30 bg-white dark:bg-gray-800 font-medium text-xs flex items-center gap-1.5"
                                                                        >
                                                                            <MousePointerClick className="w-3 h-3 text-[#25D366]" />
                                                                            {btn.title}
                                                                            {step.next_steps?.[btn.id] && (
                                                                                <span className="text-[9px] text-muted-foreground ml-1">
                                                                                    → {step.next_steps[btn.id]}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {/* Wait response indicator */}
                                                            {step.message_type === 'wait_response' && (
                                                                <div className="flex items-center gap-2 text-xs settings-subtitle italic">
                                                                    <span>⏳ Esperando respuesta de texto del usuario</span>
                                                                    {step.next_step_on_text && (
                                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent">
                                                                            → {step.next_step_on_text === '__complete__' ? '✅ Fin' : step.next_step_on_text}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Connection arrow */}
                                                        {stepIdx < (flow as any).steps.length - 1 && (
                                                            <div className="flex justify-center py-1">
                                                                <div className="w-px h-4 bg-border dark:bg-[hsl(231,20%,25%)]" />
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            /* Fallback: flujo simple sin steps */
                                            <>
                                                <div className="mb-4">
                                                    <Label className="settings-label mb-2 block font-semibold" style={{ fontSize: 'var(--text-xs)' }}>
                                                        Mensaje de bienvenida
                                                    </Label>
                                                    <div className="bg-[#e7f8d4] dark:bg-[#1b3a1a] p-4 rounded-2xl rounded-tl-none max-w-lg shadow-sm">
                                                        <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                                                            {flow.message}
                                                        </p>
                                                    </div>
                                                </div>
                                                {flow.buttons && flow.buttons.length > 0 && (
                                                    <div className="mb-4">
                                                        <Label className="settings-label mb-2 block font-semibold" style={{ fontSize: 'var(--text-xs)' }}>
                                                            Botones interactivos
                                                        </Label>
                                                        <div className="flex gap-2 flex-wrap">
                                                            {flow.buttons.map((btn) => (
                                                                <div
                                                                    key={btn.id}
                                                                    className="px-4 py-2 rounded-xl border-2 border-[#25D366]/30 bg-white dark:bg-gray-800 font-medium text-sm flex items-center gap-2"
                                                                >
                                                                    <MousePointerClick className="w-3.5 h-3.5 text-[#25D366]" />
                                                                    {btn.title}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal Crear/Editar Flujo */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="card-gradient sm:max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar border border-white/40 dark:border-white/10">
                    <DialogHeader>
                        <DialogTitle className="settings-title flex items-center gap-2" style={{ fontSize: 'var(--text-xl)' }}>
                            <Bot className="w-5 h-5" />
                            {editingFlow ? 'Editar flujo de bienvenida' : 'Nuevo flujo de bienvenida'}
                        </DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-5 mt-2">
                        {/* Nombre del flujo */}
                        <div>
                            <Label htmlFor="flow-name" className="settings-label font-semibold" style={{ fontSize: 'var(--text-sm)' }}>
                                Nombre del flujo
                            </Label>
                            <Input
                                id="flow-name"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                placeholder="Ej: Menú de Bienvenida HUV"
                                className="mt-1.5 settings-input rounded-xl"
                                required
                            />
                            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                        </div>

                        {/* Tipo de activación */}
                        <div>
                            <Label htmlFor="flow-trigger" className="settings-label font-semibold" style={{ fontSize: 'var(--text-sm)' }}>
                                ¿Cuándo se envía?
                            </Label>
                            <select
                                id="flow-trigger"
                                value={data.trigger_type}
                                onChange={(e) => setData('trigger_type', e.target.value)}
                                className="mt-1.5 w-full settings-input rounded-xl border-gray-200 dark:border-gray-800 transition-all duration-200 cursor-pointer"
                                style={{
                                    height: 'clamp(2.25rem, 2.25rem + 0.15vw, 2.5rem)',
                                    fontSize: 'var(--text-sm)',
                                    padding: '0 2.5rem 0 var(--space-base)',
                                    appearance: 'none',
                                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: 'right 0.75rem center',
                                    backgroundSize: '1rem',
                                }}
                            >
                                <option value="first_contact">Solo primer contacto (contacto nuevo)</option>
                                <option value="every_new_conversation">Cada conversación nueva</option>
                                <option value="always">Siempre (cada mensaje)</option>
                            </select>
                        </div>

                        {/* Mensaje de bienvenida */}
                        <div>
                            <Label htmlFor="flow-message" className="settings-label font-semibold" style={{ fontSize: 'var(--text-sm)' }}>
                                Mensaje de bienvenida
                            </Label>
                            <Textarea
                                id="flow-message"
                                value={data.message}
                                onChange={(e) => setData('message', e.target.value)}
                                placeholder="Escribe el mensaje que recibirá el usuario al escribir por primera vez..."
                                className="mt-1.5 settings-input rounded-xl min-h-[150px]"
                                required
                            />
                            <p className="text-xs settings-subtitle mt-1">
                                Puedes usar emojis y formateo de WhatsApp: *negrita*, _cursiva_, ~tachado~
                            </p>
                            {errors.message && <p className="text-red-500 text-xs mt-1">{errors.message}</p>}
                        </div>

                        {/* Botones interactivos */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <Label className="settings-label font-semibold" style={{ fontSize: 'var(--text-sm)' }}>
                                    Botones interactivos (máx. 3)
                                </Label>
                                {data.buttons.length < 3 && (
                                    <button
                                        type="button"
                                        onClick={addButton}
                                        className="text-xs font-semibold flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-accent transition-colors"
                                        style={{ color: 'var(--primary-base)' }}
                                    >
                                        <Plus className="w-3 h-3" />
                                        Añadir botón
                                    </button>
                                )}
                            </div>

                            {data.buttons.length === 0 && (
                                <p className="text-xs settings-subtitle italic">
                                    Sin botones. Se enviará como texto plano.
                                </p>
                            )}

                            <div className="space-y-3">
                                {data.buttons.map((button, index) => (
                                    <div
                                        key={index}
                                        className="p-4 rounded-xl border border-border dark:border-[hsl(231,20%,20%)] bg-background/50"
                                    >
                                        <div className="flex items-center gap-2 mb-3">
                                            <MousePointerClick className="w-4 h-4 text-[#25D366]" />
                                            <span className="text-sm font-semibold settings-title">
                                                Botón {index + 1}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => removeButton(index)}
                                                className="ml-auto p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 mb-3">
                                            <div>
                                                <Label className="settings-subtitle mb-1 block" style={{ fontSize: 'var(--text-xs)' }}>
                                                    Texto del botón (máx. 20 chars)
                                                </Label>
                                                <Input
                                                    value={button.title}
                                                    onChange={(e) =>
                                                        updateButton(index, 'title', e.target.value)
                                                    }
                                                    placeholder="Ej: ✅ Acepto"
                                                    maxLength={20}
                                                    className="settings-input rounded-xl"
                                                    required
                                                />
                                                <span className="text-[10px] settings-subtitle">{button.title.length}/20</span>
                                            </div>
                                            <div>
                                                <Label className="settings-subtitle mb-1 block" style={{ fontSize: 'var(--text-xs)' }}>
                                                    ID del botón
                                                </Label>
                                                <Input
                                                    value={button.id}
                                                    onChange={(e) =>
                                                        updateButton(index, 'id', e.target.value)
                                                    }
                                                    placeholder="Ej: accept"
                                                    className="settings-input rounded-xl"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        {/* Respuesta automática para este botón */}
                                        <div>
                                            <Label className="settings-subtitle mb-1 block" style={{ fontSize: 'var(--text-xs)' }}>
                                                Respuesta automática al presionar este botón
                                            </Label>
                                            <Textarea
                                                value={data.responses[button.id] || ''}
                                                onChange={(e) =>
                                                    updateResponse(button.id, e.target.value)
                                                }
                                                placeholder="Mensaje que se enviará al usuario cuando presione este botón..."
                                                className="settings-input rounded-xl min-h-[80px]"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Toggle activo */}
                        <div className="flex items-center justify-between p-4 rounded-xl border border-border dark:border-[hsl(231,20%,20%)] bg-background/50">
                            <div>
                                <p className="font-semibold settings-title" style={{ fontSize: 'var(--text-sm)' }}>
                                    Activar flujo
                                </p>
                                <p className="settings-subtitle" style={{ fontSize: 'var(--text-xs)' }}>
                                    Solo puede haber un flujo activo a la vez
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setData('is_active', !data.is_active)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${data.is_active ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                                    }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${data.is_active ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                />
                            </button>
                        </div>

                        {/* Acciones */}
                        <div className="flex justify-end gap-3 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setIsModalOpen(false);
                                    setEditingFlow(null);
                                    reset();
                                }}
                                className="rounded-xl"
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={processing}
                                className="font-semibold text-white rounded-xl transition-all duration-200"
                                style={{
                                    backgroundColor: 'var(--primary-base)',
                                    boxShadow: 'var(--shadow-md)',
                                }}
                            >
                                <Save className="w-4 h-4 mr-2" />
                                {processing
                                    ? 'Guardando...'
                                    : editingFlow
                                        ? 'Actualizar'
                                        : 'Crear flujo'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
