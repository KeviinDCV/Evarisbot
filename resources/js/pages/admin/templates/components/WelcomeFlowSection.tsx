import { router, useForm } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
    ArrowRight,
    Bot,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    CircleDot,
    Edit3,
    Keyboard,
    MessageSquare,
    MousePointerClick,
    Plus,
    Power,
    PowerOff,
    Save,
    Trash2,
    Workflow,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';

interface WelcomeFlowButton {
    id: string;
    title: string;
}

interface WelcomeFlowStep {
    id: number | string;
    step_key: string;
    message: string;
    message_type: 'interactive_buttons' | 'wait_response' | 'text' | string;
    buttons?: WelcomeFlowButton[] | null;
    next_steps?: Record<string, string> | null;
    next_step_on_text?: string | null;
    is_entry_point?: boolean;
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
    steps?: WelcomeFlowStep[] | null;
    created_at: string;
    updated_at: string;
}

interface WelcomeFlowSectionProps {
    welcomeFlows: WelcomeFlow[];
}

const triggerTypeLabelKeys: Record<string, string> = {
    first_contact: 'welcomeFlow.triggerFirstContact',
    every_new_conversation: 'welcomeFlow.triggerEveryNewConversation',
    always: 'welcomeFlow.triggerAlways',
};

const messageTypeLabelKeys: Record<string, string> = {
    interactive_buttons: 'welcomeFlow.messageTypeButtons',
    wait_response: 'welcomeFlow.messageTypeWaitResponse',
    text: 'welcomeFlow.messageTypeText',
};

function FlowStatusPill({ active }: { active: boolean }) {
    const { t } = useTranslation();
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold',
                active
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
                    : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-300'
            )}
        >
            <span className={cn('h-2 w-2 rounded-full', active ? 'bg-emerald-500' : 'bg-slate-400')} />
            {active ? t('welcomeFlow.statusActive') : t('welcomeFlow.statusInactive')}
        </span>
    );
}

function MessagePreview({ children }: { children: string }) {
    return (
        <div className="max-w-2xl rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-sm leading-6 text-slate-700 shadow-sm dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-neutral-200">
            <p className="line-clamp-4 whitespace-pre-wrap [overflow-wrap:anywhere]">{children}</p>
        </div>
    );
}

function StepIcon({ type }: { type: string }) {
    if (type === 'interactive_buttons') return <MousePointerClick className="h-3.5 w-3.5" />;
    if (type === 'wait_response') return <Keyboard className="h-3.5 w-3.5" />;
    return <MessageSquare className="h-3.5 w-3.5" />;
}

export default function WelcomeFlowSection({ welcomeFlows }: WelcomeFlowSectionProps) {
    const { t } = useTranslation();
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

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingFlow(null);
        reset();
    };

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

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();

        if (editingFlow) {
            put(`/admin/welcome-flows/${editingFlow.id}`, {
                preserveScroll: true,
                onSuccess: () => closeModal(),
            });
            return;
        }

        post('/admin/welcome-flows', {
            preserveScroll: true,
            onSuccess: () => closeModal(),
        });
    };

    const addButton = () => {
        if (data.buttons.length >= 3) return;

        const newId = `btn_${Date.now()}`;
        setData('buttons', [...data.buttons, { id: newId, title: '' }]);
    };

    const removeButton = (index: number) => {
        const buttonId = data.buttons[index].id;
        const nextButtons = data.buttons.filter((_, buttonIndex) => buttonIndex !== index);
        const nextResponses = { ...data.responses };
        delete nextResponses[buttonId];

        setData({ ...data, buttons: nextButtons, responses: nextResponses });
    };

    const updateButton = (index: number, field: 'id' | 'title', value: string) => {
        const nextButtons = [...data.buttons];

        if (field === 'title') {
            nextButtons[index] = { ...nextButtons[index], title: value.slice(0, 20) };
            setData('buttons', nextButtons);
            return;
        }

        const oldId = nextButtons[index].id;
        nextButtons[index] = { ...nextButtons[index], id: value };
        const nextResponses = { ...data.responses };

        if (nextResponses[oldId]) {
            nextResponses[value] = nextResponses[oldId];
            delete nextResponses[oldId];
        }

        setData({ ...data, buttons: nextButtons, responses: nextResponses });
    };

    const updateResponse = (buttonId: string, value: string) => {
        setData('responses', { ...data.responses, [buttonId]: value });
    };

    const toggleFlowStatus = (flowId: number) => {
        router.post(
            `/admin/welcome-flows/${flowId}/toggle`,
            {},
            {
                preserveScroll: true,
                onSuccess: () => toast.success(t('welcomeFlow.statusUpdated')),
                onError: () => toast.error(t('welcomeFlow.statusUpdateError')),
            }
        );
    };

    const deleteFlow = (flowId: number) => {
        if (confirm(t('welcomeFlow.deleteConfirm'))) {
            router.delete(`/admin/welcome-flows/${flowId}`, {
                preserveScroll: true,
                onSuccess: () => toast.success(t('welcomeFlow.deleted')),
                onError: () => toast.error(t('welcomeFlow.deleteError')),
            });
        }
    };

    const activeFlows = welcomeFlows.filter((flow) => flow.is_active).length;

    return (
        <>
            <section className="card-gradient rounded-2xl border border-white/40 p-5 shadow-lg shadow-[#2e3f84]/5 dark:border-white/10">
                <div className="mb-4 flex flex-col gap-3 border-b border-[#d4d8e8]/80 pb-4 dark:border-white/10 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#d4d8e8] bg-[#2e3f84]/10 text-[#2e3f84] dark:border-white/10 dark:bg-white/[0.05] dark:text-neutral-100">
                            <Bot className="h-4.5 w-4.5" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-base font-bold leading-tight settings-title">{t('welcomeFlow.sectionTitle')}</h2>
                            <p className="mt-1 text-xs settings-subtitle">
                                {t('welcomeFlow.flowsCount', { count: welcomeFlows.length })} · {t('welcomeFlow.activeCount', { count: activeFlows })}
                            </p>
                        </div>
                    </div>
                    <Button onClick={openCreateModal} className="h-9 rounded-xl settings-btn-primary text-white">
                        <Plus className="h-4 w-4" />
                        {t('welcomeFlow.newFlow')}
                    </Button>
                </div>

                {welcomeFlows.length === 0 ? (
                    <div className="flex min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-[#d4d8e8] p-6 text-center dark:border-white/10">
                        <Workflow className="mb-3 h-10 w-10 settings-subtitle" />
                        <h3 className="text-base font-bold settings-title">{t('welcomeFlow.emptyTitle')}</h3>
                        <p className="mt-2 max-w-lg text-sm settings-subtitle">
                            {t('welcomeFlow.emptyDescription')}
                        </p>
                        <Button onClick={openCreateModal} className="mt-4 rounded-xl settings-btn-primary text-white">
                            <Plus className="h-4 w-4" />
                            {t('welcomeFlow.createFlow')}
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {welcomeFlows.map((flow) => {
                            const steps = flow.steps || [];
                            const buttons = flow.buttons || [];
                            const totalInteractions = steps.length > 0 ? steps.length : buttons.length;
                            const expanded = expandedFlowId === flow.id;

                            return (
                                <article key={flow.id} className="overflow-hidden rounded-xl border border-[#d4d8e8]/80 bg-white/45 dark:border-white/10 dark:bg-white/[0.03]">
                                    <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <div
                                                className={cn(
                                                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border',
                                                    flow.is_active
                                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300'
                                                        : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-300'
                                                )}
                                            >
                                                <MessageSquare className="h-4 w-4" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h3 className="truncate text-sm font-bold settings-title">{flow.name}</h3>
                                                    <FlowStatusPill active={flow.is_active} />
                                                </div>
                                                <p className="mt-1 truncate text-xs settings-subtitle">
                                                    {triggerTypeLabelKeys[flow.trigger_type] ? t(triggerTypeLabelKeys[flow.trigger_type]) : flow.trigger_type} · {t('welcomeFlow.stepsCount', { count: totalInteractions })}
                                                    {flow.creator ? t('welcomeFlow.createdBy', { name: flow.creator.name }) : ''}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-end gap-1.5">
                                            <Button
                                                type="button"
                                                size="icon"
                                                variant="outline"
                                                onClick={() => setExpandedFlowId(expanded ? null : flow.id)}
                                                className="h-8 w-8 rounded-xl settings-btn-secondary"
                                                title={t('welcomeFlow.viewDetails')}
                                            >
                                                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                            </Button>
                                            <Button
                                                type="button"
                                                size="icon"
                                                variant="outline"
                                                onClick={() => toggleFlowStatus(flow.id)}
                                                className={cn(
                                                    'h-8 w-8 rounded-xl',
                                                    flow.is_active
                                                        ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/20 dark:text-emerald-300 dark:hover:bg-emerald-500/10'
                                                        : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:text-neutral-300 dark:hover:bg-white/[0.05]'
                                                )}
                                                title={flow.is_active ? t('welcomeFlow.deactivate') : t('welcomeFlow.activate')}
                                            >
                                                {flow.is_active ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                                            </Button>
                                            <Button
                                                type="button"
                                                size="icon"
                                                variant="outline"
                                                onClick={() => openEditModal(flow)}
                                                className="h-8 w-8 rounded-xl settings-btn-secondary"
                                                title={t('common.edit')}
                                            >
                                                <Edit3 className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                type="button"
                                                size="icon"
                                                variant="outline"
                                                onClick={() => deleteFlow(flow.id)}
                                                className="h-8 w-8 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-500/20 dark:text-red-300 dark:hover:bg-red-500/10"
                                                title={t('common.delete')}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    {expanded && (
                                        <div className="border-t border-[#d4d8e8]/80 p-4 dark:border-white/10">
                                            {steps.length > 0 ? (
                                                <div className="space-y-3">
                                                    <div className="flex items-center gap-2 text-xs font-semibold settings-subtitle">
                                                        <Workflow className="h-4 w-4" />
                                                        {t('welcomeFlow.conversationalFlow', { count: steps.length })}
                                                    </div>
                                                    {steps.map((step, index) => (
                                                        <div key={step.id} className="rounded-xl border border-[#d4d8e8]/80 bg-white/50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                                                            <div className="mb-3 flex flex-wrap items-center gap-2">
                                                                <span
                                                                    className={cn(
                                                                        'inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold text-white',
                                                                        step.is_entry_point ? 'bg-emerald-500' : 'bg-[#2e3f84]'
                                                                    )}
                                                                >
                                                                    {index + 1}
                                                                </span>
                                                                <span className="text-sm font-semibold settings-title">{step.step_key}</span>
                                                                <span className="inline-flex items-center gap-1.5 rounded-md border border-[#d4d8e8] bg-white/60 px-2 py-0.5 text-[11px] font-semibold settings-subtitle dark:border-white/10 dark:bg-white/[0.04]">
                                                                    <StepIcon type={step.message_type} />
                                                                    {messageTypeLabelKeys[step.message_type] ? t(messageTypeLabelKeys[step.message_type]) : step.message_type}
                                                                </span>
                                                                {step.is_entry_point && (
                                                                    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                                                                        <CircleDot className="h-3 w-3" />
                                                                        {t('welcomeFlow.entryPoint')}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <MessagePreview>{step.message}</MessagePreview>

                                                            {step.buttons && step.buttons.length > 0 && (
                                                                <div className="mt-3 flex flex-wrap gap-2">
                                                                    {step.buttons.map((button) => (
                                                                        <span key={button.id} className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-white/70 px-2.5 py-1 text-xs font-semibold settings-title dark:border-emerald-500/20 dark:bg-white/[0.04]">
                                                                            <MousePointerClick className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" />
                                                                            {button.title}
                                                                            {step.next_steps?.[button.id] && (
                                                                                <>
                                                                                    <ArrowRight className="h-3 w-3 settings-subtitle" />
                                                                                    <span className="settings-subtitle">{step.next_steps[button.id]}</span>
                                                                                </>
                                                                            )}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {step.message_type === 'wait_response' && step.next_step_on_text && (
                                                                <div className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-[#d4d8e8] bg-white/60 px-2.5 py-1 text-xs font-semibold settings-subtitle dark:border-white/10 dark:bg-white/[0.04]">
                                                                    <Keyboard className="h-3.5 w-3.5" />
                                                                    {t('welcomeFlow.messageTypeWaitResponse')}
                                                                    <ArrowRight className="h-3 w-3" />
                                                                    {step.next_step_on_text === '__complete__' ? t('welcomeFlow.flowEnd') : step.next_step_on_text}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    <div className="flex items-center gap-2 text-xs font-semibold settings-subtitle">
                                                        <MessageSquare className="h-4 w-4" />
                                                        {t('welcomeFlow.welcomeMessage')}
                                                    </div>
                                                    <MessagePreview>{flow.message}</MessagePreview>
                                                    {buttons.length > 0 && (
                                                        <div className="flex flex-wrap gap-2">
                                                            {buttons.map((button) => (
                                                                <span key={button.id} className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-white/70 px-2.5 py-1 text-xs font-semibold settings-title dark:border-emerald-500/20 dark:bg-white/[0.04]">
                                                                    <MousePointerClick className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" />
                                                                    {button.title}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>

            <Dialog open={isModalOpen} onOpenChange={(open) => (open ? setIsModalOpen(true) : closeModal())}>
                <DialogContent className="card-gradient max-h-[90vh] gap-0 overflow-y-auto rounded-2xl border border-white/40 p-0 shadow-xl dark:border-white/10 sm:max-w-2xl">
                    <DialogHeader className="border-b border-[#d4d8e8]/80 px-6 py-4 dark:border-white/10">
                        <DialogTitle className="flex items-center gap-2 text-lg font-bold settings-title">
                            <Bot className="h-5 w-5 text-[#2e3f84] dark:text-neutral-100" />
                            {editingFlow ? t('welcomeFlow.editFlowTitle') : t('welcomeFlow.newFlowTitle')}
                        </DialogTitle>
                        <DialogDescription className="text-xs settings-subtitle">
                            {t('welcomeFlow.dialogDescription')}
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
                        <div className="space-y-1.5">
                            <Label htmlFor="flow-name" className="text-sm font-semibold settings-label">
                                {t('welcomeFlow.flowNameLabel')}
                            </Label>
                            <Input
                                id="flow-name"
                                value={data.name}
                                onChange={(event) => setData('name', event.target.value)}
                                placeholder={t('welcomeFlow.flowNamePlaceholder')}
                                className="h-9 rounded-xl settings-input"
                                required
                            />
                            {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="flow-trigger" className="text-sm font-semibold settings-label">
                                {t('welcomeFlow.whenSentLabel')}
                            </Label>
                            <Select value={data.trigger_type} onValueChange={(v) => setData('trigger_type', v)}>
                                <SelectTrigger id="flow-trigger" className="w-full h-10 settings-input rounded-xl">
                                    <SelectValue placeholder={t('welcomeFlow.whenSentPlaceholder')} />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border border-[#e9edef] dark:border-neutral-700 max-h-[320px]">
                                    <SelectItem value="first_contact" className="rounded-lg cursor-pointer">{t('welcomeFlow.triggerFirstContactOption')}</SelectItem>
                                    <SelectItem value="every_new_conversation" className="rounded-lg cursor-pointer">{t('welcomeFlow.triggerEveryNewConversation')}</SelectItem>
                                    <SelectItem value="always" className="rounded-lg cursor-pointer">{t('welcomeFlow.triggerAlways')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="flow-message" className="text-sm font-semibold settings-label">
                                {t('welcomeFlow.welcomeMessage')}
                            </Label>
                            <Textarea
                                id="flow-message"
                                value={data.message}
                                onChange={(event) => setData('message', event.target.value)}
                                placeholder={t('welcomeFlow.welcomeMessagePlaceholder')}
                                className="min-h-[132px] rounded-xl settings-input"
                                required
                            />
                            {errors.message && <p className="text-xs text-red-500">{errors.message}</p>}
                        </div>

                        <div className="space-y-3 rounded-xl border border-[#d4d8e8]/80 bg-white/45 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <Label className="text-sm font-semibold settings-label">{t('welcomeFlow.interactiveButtonsLabel')}</Label>
                                    <p className="mt-1 text-xs settings-subtitle">{t('welcomeFlow.buttonsConfigured', { count: data.buttons.length })}</p>
                                </div>
                                <Button type="button" variant="outline" onClick={addButton} disabled={data.buttons.length >= 3} className="h-8 rounded-xl settings-btn-secondary">
                                    <Plus className="h-4 w-4" />
                                    {t('welcomeFlow.add')}
                                </Button>
                            </div>

                            {data.buttons.length === 0 ? (
                                <p className="rounded-xl border border-dashed border-[#d4d8e8] p-3 text-sm settings-subtitle dark:border-white/10">
                                    {t('welcomeFlow.noButtonsConfigured')}
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {data.buttons.map((button, index) => (
                                        <div key={`${button.id}-${index}`} className="rounded-xl border border-[#d4d8e8]/80 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                                            <div className="mb-3 flex items-center gap-2">
                                                <MousePointerClick className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                                                <span className="text-sm font-semibold settings-title">{t('welcomeFlow.buttonNumber', { number: index + 1 })}</span>
                                                <Button
                                                    type="button"
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={() => removeButton(index)}
                                                    className="ml-auto h-7 w-7 rounded-xl text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                                                    title={t('welcomeFlow.removeButton')}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs font-semibold settings-label">{t('welcomeFlow.buttonTextLabel')}</Label>
                                                    <Input
                                                        value={button.title}
                                                        onChange={(event) => updateButton(index, 'title', event.target.value)}
                                                        placeholder={t('welcomeFlow.buttonTextPlaceholder')}
                                                        maxLength={20}
                                                        className="h-9 rounded-xl settings-input"
                                                        required
                                                    />
                                                    <p className="text-[11px] settings-subtitle">{button.title.length}/20</p>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs font-semibold settings-label">{t('welcomeFlow.buttonIdLabel')}</Label>
                                                    <Input
                                                        value={button.id}
                                                        onChange={(event) => updateButton(index, 'id', event.target.value)}
                                                        placeholder={t('welcomeFlow.buttonIdPlaceholder')}
                                                        className="h-9 rounded-xl settings-input"
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            <div className="mt-3 space-y-1.5">
                                                <Label className="text-xs font-semibold settings-label">{t('welcomeFlow.autoResponseLabel')}</Label>
                                                <Textarea
                                                    value={data.responses[button.id] || ''}
                                                    onChange={(event) => updateResponse(button.id, event.target.value)}
                                                    placeholder={t('welcomeFlow.autoResponsePlaceholder')}
                                                    className="min-h-[84px] rounded-xl settings-input"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between gap-4 rounded-xl border border-[#d4d8e8]/80 bg-white/45 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                            <div>
                                <p className="text-sm font-semibold settings-title">{t('welcomeFlow.activateFlow')}</p>
                                <p className="mt-1 text-xs settings-subtitle">{t('welcomeFlow.singleActiveHint')}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setData('is_active', !data.is_active)}
                                className={cn(
                                    'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200',
                                    data.is_active ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'
                                )}
                                title={data.is_active ? t('welcomeFlow.deactivate') : t('welcomeFlow.activate')}
                            >
                                <span
                                    className={cn(
                                        'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200',
                                        data.is_active ? 'translate-x-6' : 'translate-x-1'
                                    )}
                                />
                            </button>
                        </div>

                        <div className="flex justify-end gap-2 border-t border-[#d4d8e8]/80 pt-4 dark:border-white/10">
                            <Button type="button" variant="outline" onClick={closeModal} className="h-9 rounded-xl settings-btn-secondary">
                                {t('common.cancel')}
                            </Button>
                            <Button type="submit" disabled={processing} className="h-9 rounded-xl settings-btn-primary text-white">
                                <Save className="h-4 w-4" />
                                {processing ? t('common.saving') : editingFlow ? t('welcomeFlow.update') : t('welcomeFlow.createFlow')}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}