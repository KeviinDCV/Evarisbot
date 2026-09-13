import { router, useForm } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BOTON_PELIGRO_LLENO, BOTON_PRIMARIO, BOTON_SECUNDARIO, FILETE, FOCO, HOJA, MONO, TEXTO_NAVY, TEXTO_SUAVE } from '@/components/appointments/piezas-citas';
import { Banda, Nota, Rotulo, miles } from '@/components/bulk-sends/piezas-envio';
import {
    AREA,
    AYUDA,
    BOTON_ICONO,
    BOTON_TEXTO_NAVY,
    BOTON_TEXTO_ROJO,
    BurbujaEntra,
    CAMPO,
    Chip,
    DISPARADOR,
    DialogoPlantilla,
    ERROR_CAMPO,
    ETIQUETA,
    EstadoPunto,
    Interruptor,
    MENU,
    OPCION,
    QueSeBorra,
    fechaDia,
} from '@/components/templates/piezas-plantillas';
import { cn } from '@/lib/utils';
import {
    ArrowRight,
    Bot,
    ChevronDown,
    CircleDot,
    CornerDownRight,
    Edit3,
    Flag,
    Info,
    Keyboard,
    List,
    MessageSquare,
    MousePointerClick,
    Plus,
    Save,
    Trash2,
    Workflow,
    X,
    type LucideIcon,
} from 'lucide-react';
import { useRef, useState, type FormEvent, type ReactNode } from 'react';

interface WelcomeFlowButton {
    id: string;
    title: string;
}

interface WelcomeFlowListRow {
    id: string;
    title: string;
    description?: string | null;
}

interface WelcomeFlowStep {
    id: number | string;
    step_key: string;
    message: string;
    message_type: 'interactive_buttons' | 'interactive_list' | 'wait_response' | 'text' | string;
    buttons?: WelcomeFlowButton[] | null;
    // Lista de WhatsApp (interactive_list): { button_text, sections: [{ title, rows: [{ id, title }] }] }.
    options?: { button_text?: string | null; sections?: { title?: string | null; rows?: WelcomeFlowListRow[] | null }[] | null } | null;
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

/* ── Menú de bienvenida (diseño aprobado, design/vista-plantillas) ─────────────────────────────────
   Cada flujo es una fila con su interruptor (POST /toggle: encender uno apaga los demás, y la pantalla
   lo dice). El flujo abierto muestra sus pasos como burbujas de WhatsApp, tal como los vive el paciente;
   cada botón u opción dice a qué paso lleva. Crear, editar, encender y eliminar hacen las mismas
   llamadas de siempre; eliminar pregunta en un diálogo propio (antes era window.confirm). */

const sendsKeys: Record<string, string> = {
    first_contact: 'welcomeFlow.vista.sendsFirstContact',
    every_new_conversation: 'welcomeFlow.vista.sendsEveryNew',
    always: 'welcomeFlow.vista.sendsAlways',
};

const TIPO_PASO: Record<string, [LucideIcon, string]> = {
    interactive_buttons: [MousePointerClick, 'welcomeFlow.messageTypeButtons'],
    interactive_list: [List, 'welcomeFlow.vista.messageTypeList'],
    wait_response: [Keyboard, 'welcomeFlow.messageTypeWaitResponse'],
    text: [MessageSquare, 'welcomeFlow.messageTypeText'],
};

const FIN = '__complete__';

export default function WelcomeFlowSection({ welcomeFlows }: WelcomeFlowSectionProps) {
    const { t, i18n } = useTranslation();
    const lng = i18n.language;
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingFlow, setEditingFlow] = useState<WelcomeFlow | null>(null);
    // Abierto de salida: el flujo encendido (el que el paciente vive hoy).
    const [expandedFlowId, setExpandedFlowId] = useState<number | null>(() => welcomeFlows.find((flow) => flow.is_active)?.id ?? null);
    const [flowToDelete, setFlowToDelete] = useState<WelcomeFlow | null>(null);
    const seguroBorrar = useRef<HTMLButtonElement>(null);

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

    /** Eliminar pasa por su diálogo; al confirmar, la MISMA llamada de antes. */
    const deleteFlow = (flowId: number) => {
        router.delete(`/admin/welcome-flows/${flowId}`, {
            preserveScroll: true,
            onSuccess: () => toast.success(t('welcomeFlow.deleted')),
            onError: () => toast.error(t('welcomeFlow.deleteError')),
        });
    };

    const confirmDeleteFlow = () => {
        if (!flowToDelete) return;
        const id = flowToDelete.id;
        setFlowToDelete(null);
        deleteFlow(id);
    };

    const activeFlow = welcomeFlows.find((flow) => flow.is_active) ?? null;
    const inactivos = welcomeFlows.filter((flow) => !flow.is_active);

    /** "6 pasos" · "mensaje con 2 botones" · "solo mensaje". */
    const resumenFlujo = (flow: WelcomeFlow) => {
        const steps = flow.steps || [];
        const buttons = flow.buttons || [];
        if (steps.length > 0) return t('welcomeFlow.stepsCount', { count: steps.length });
        if (buttons.length > 0) return t('welcomeFlow.vista.buttonsMessage', { count: buttons.length });
        return t('welcomeFlow.vista.onlyMessage');
    };

    /** A qué paso lleva: el step_key en mono o "Fin". */
    const destino = (clave?: string | null) => {
        if (!clave) return null;
        if (clave === FIN)
            return (
                <span className={cn('inline-flex items-center gap-[5px] text-[12px] leading-4 font-semibold whitespace-nowrap', TEXTO_SUAVE)}>
                    <Flag className="size-3" strokeWidth={2} aria-hidden="true" />
                    {t('welcomeFlow.flowEnd')}
                </span>
            );
        return <span className={cn('text-[12px] leading-4 font-semibold whitespace-nowrap', MONO, TEXTO_NAVY)}>{clave}</span>;
    };

    const salida = (Icono: LucideIcon, texto: ReactNode, clave?: string | null, key?: string | number) => (
        <div key={key} className={cn('flex min-h-[30px] items-center gap-2 border-t py-1', FILETE)}>
            <Icono className={cn('size-[13px] shrink-0', TEXTO_SUAVE)} strokeWidth={2} aria-hidden="true" />
            <span className={cn('min-w-0 flex-1 truncate text-[12.5px] leading-4 font-medium', TEXTO_NAVY)}>{texto}</span>
            {clave && (
                <>
                    <ArrowRight className={cn('size-[13px] shrink-0', TEXTO_SUAVE)} strokeWidth={2} aria-hidden="true" />
                    <span className="sr-only">{t('welcomeFlow.vista.goesTo')}</span>
                    {destino(clave)}
                </>
            )}
        </div>
    );

    const tarjeta = (cabeza: ReactNode, cuerpo: ReactNode, pie: ReactNode, key: string | number) => (
        <li
            key={key}
            className="flex min-w-0 flex-col gap-2.5 rounded-xl bg-white px-3.5 pt-3 pb-2 shadow-[inset_0_0_0_1px_rgba(46,63,132,0.12)] dark:bg-white/[0.03] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
        >
            <div className="flex min-w-0 flex-wrap items-center gap-2">{cabeza}</div>
            {cuerpo}
            {pie ? <div className="flex flex-col">{pie}</div> : <div className="h-1" />}
        </li>
    );

    const tarjetaPaso = (step: WelcomeFlowStep, index: number) => {
        const [IconoTipo, claveTipo] = TIPO_PASO[step.message_type] ?? [MessageSquare, ''];
        const botones = step.buttons || [];
        const filas = (step.options?.sections ?? []).flatMap((s) => s.rows ?? []);
        const siguientes = step.next_steps ?? {};
        let botonesBurbuja: ReactNode[] = [];
        let pie: ReactNode = null;

        if (step.message_type === 'interactive_buttons' || (botones.length > 0 && step.message_type !== 'interactive_list')) {
            botonesBurbuja = botones.map((b) => (
                <span key={b.id} className="flex w-full min-w-0 items-center justify-between gap-2">
                    <span className="min-w-0 truncate">{b.title}</span>
                    {siguientes[b.id] && (
                        <span className={cn('inline-flex shrink-0 items-center gap-[5px]', TEXTO_SUAVE)} title={t('welcomeFlow.vista.goesToStep', { step: siguientes[b.id] })}>
                            <ArrowRight className="size-3" strokeWidth={2} aria-hidden="true" />
                            <span className="sr-only">{t('welcomeFlow.vista.goesTo')}</span>
                            {destino(siguientes[b.id])}
                        </span>
                    )}
                </span>
            ));
        } else if (step.message_type === 'interactive_list') {
            botonesBurbuja = [
                <span key="lista" className="inline-flex items-center gap-1.5">
                    <List className="size-3.5" strokeWidth={2} aria-hidden="true" />
                    {step.options?.button_text || t('welcomeFlow.vista.seeOptions')}
                </span>,
            ];
            pie = filas.map((r, i) => salida(List, r.title, siguientes[r.id], `${r.id}-${i}`));
        }

        if (!pie && step.message_type !== 'interactive_buttons') {
            pie = step.next_step_on_text
                ? salida(Keyboard, t('welcomeFlow.vista.whenPatientWrites'), step.next_step_on_text)
                : (
                      <div className={cn('flex min-h-[30px] items-center gap-2 border-t py-1 text-[12.5px] leading-4', FILETE, TEXTO_SUAVE)}>
                          <CornerDownRight className="size-[13px] shrink-0" strokeWidth={2} aria-hidden="true" />
                          {t('welcomeFlow.vista.pathEnds')}
                      </div>
                  );
        }

        return tarjeta(
            <>
                <span
                    className={cn(
                        'flex size-[22px] shrink-0 items-center justify-center rounded-full text-[11.5px] leading-[14px] font-semibold text-white tabular-nums',
                        step.is_entry_point ? 'bg-emerald-700' : 'bg-[#2e3f84] dark:bg-[#4e5fa4]'
                    )}
                >
                    {index + 1}
                </span>
                <span className={cn('min-w-0 flex-1 truncate text-[12.5px] leading-4 font-semibold', MONO, TEXTO_NAVY)}>{step.step_key}</span>
                {step.is_entry_point && (
                    <Chip icon={CircleDot} tono="ok">
                        {t('welcomeFlow.entryPoint')}
                    </Chip>
                )}
                <Chip icon={IconoTipo}>{claveTipo ? t(claveTipo) : step.message_type}</Chip>
            </>,
            <BurbujaEntra texto={step.message} botones={botonesBurbuja} />,
            pie,
            step.id
        );
    };

    /** Flujo sin pasos: el mensaje con sus botones y, por cada botón, su respuesta automática. */
    const tarjetasMensaje = (flow: WelcomeFlow) => {
        const buttons = flow.buttons || [];
        const responses = flow.responses || {};
        return [
            tarjeta(
                <>
                    <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-emerald-700 text-[11.5px] leading-[14px] font-semibold text-white">1</span>
                    <span className={cn('min-w-0 flex-1 truncate text-[12.5px] leading-4 font-semibold', TEXTO_NAVY)}>{t('welcomeFlow.welcomeMessage')}</span>
                    <Chip icon={CircleDot} tono="ok">
                        {t('welcomeFlow.entryPoint')}
                    </Chip>
                </>,
                <BurbujaEntra texto={flow.message} botones={buttons.map((b) => b.title)} />,
                null,
                'mensaje'
            ),
            ...buttons.map((b, i) =>
                tarjeta(
                    <>
                        <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-[#2e3f84] text-[11.5px] leading-[14px] font-semibold text-white tabular-nums dark:bg-[#4e5fa4]">{i + 2}</span>
                        <span className={cn('min-w-0 flex-1 truncate text-[12.5px] leading-4 font-semibold', TEXTO_NAVY)}>{t('welcomeFlow.vista.ifPresses', { button: b.title })}</span>
                    </>,
                    responses[b.id] ? (
                        <BurbujaEntra texto={responses[b.id]} />
                    ) : (
                        <p className={cn('flex items-center gap-2 text-[12.5px] leading-4', TEXTO_SUAVE)}>
                            <CornerDownRight className="size-[13px] shrink-0" strokeWidth={2} aria-hidden="true" />
                            {t('welcomeFlow.vista.noAutoResponse')}
                        </p>
                    ),
                    null,
                    `r-${b.id}-${i}`
                )
            ),
        ];
    };

    /* ── Formulario: preview del paciente, aviso de pasos e interruptor ── */
    const editingSteps = editingFlow?.steps?.length ?? 0;
    const otroEncendido = activeFlow && activeFlow.id !== editingFlow?.id ? activeFlow : null;
    const flowToDeleteSteps = flowToDelete ? resumenFlujo(flowToDelete) : '';

    return (
        <>
            <section id="menu-bienvenida" aria-labelledby="menu-bienvenida-titulo" className={cn(HOJA, 'scroll-mt-4')}>
                <Banda
                    id="menu-bienvenida-titulo"
                    icon={Bot}
                    titulo={t('welcomeFlow.sectionTitle')}
                    cuenta={miles(welcomeFlows.length, lng)}
                    texto={t('welcomeFlow.vista.sectionText')}
                    className={cn('rounded-t-2xl', welcomeFlows.length === 0 && 'border-b-0')}
                    acciones={
                        <button type="button" onClick={openCreateModal} aria-haspopup="dialog" className={BOTON_PRIMARIO}>
                            <Plus strokeWidth={2} aria-hidden="true" />
                            {t('welcomeFlow.newFlow')}
                        </button>
                    }
                />

                {welcomeFlows.length === 0 ? (
                    <div className="px-4 pb-6 @3xl/hoja:px-5">
                        <div className="flex flex-col items-center gap-2 rounded-xl border-[1.5px] border-dashed border-[#2e3f84]/26 bg-[#2e3f84]/[0.035] px-5 py-7 text-center dark:border-white/20 dark:bg-white/[0.03]">
                            <span className={cn('flex size-10 items-center justify-center rounded-xl bg-white shadow-[inset_0_0_0_1px_rgba(46,63,132,0.12)] dark:bg-white/5 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]', TEXTO_SUAVE)}>
                                <Workflow className="size-[19px]" strokeWidth={1.9} aria-hidden="true" />
                            </span>
                            <p className={cn('text-[13.5px] leading-[18px] font-semibold', TEXTO_NAVY)}>{t('welcomeFlow.emptyTitle')}</p>
                            <p className={cn('max-w-lg text-[12.5px] leading-[18px]', TEXTO_SUAVE)}>{t('welcomeFlow.emptyDescription')}</p>
                            <button type="button" onClick={openCreateModal} className={cn(BOTON_PRIMARIO, 'mt-2')}>
                                <Plus strokeWidth={2} aria-hidden="true" />
                                {t('welcomeFlow.createFlow')}
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <ul aria-labelledby="menu-bienvenida-titulo">
                            {welcomeFlows.map((flow) => {
                                const steps = flow.steps || [];
                                const expanded = expandedFlowId === flow.id;
                                const otro = activeFlow && activeFlow.id !== flow.id ? activeFlow : null;
                                const detalle = [
                                    sendsKeys[flow.trigger_type] ? t(sendsKeys[flow.trigger_type]) : flow.trigger_type,
                                    resumenFlujo(flow),
                                    flow.creator ? t('welcomeFlow.vista.createdBy', { name: flow.creator.name }) : null,
                                    flow.updated_at ? t('welcomeFlow.vista.updatedOn', { date: fechaDia(flow.updated_at, lng) }) : null,
                                ]
                                    .filter(Boolean)
                                    .join(' · ');
                                const tituloInterruptor = flow.is_active
                                    ? t('welcomeFlow.vista.switchOnHint')
                                    : otro
                                      ? t('welcomeFlow.vista.switchOffHintOther', { name: otro.name })
                                      : t('welcomeFlow.vista.switchOffHint');

                                return (
                                    <li key={flow.id} className={cn('border-b', FILETE)}>
                                        <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 @3xl/hoja:min-h-[68px] @3xl/hoja:px-5', expanded && 'bg-[#2e3f84]/6 dark:bg-white/[0.05]')}>
                                            <span className="flex w-8 shrink-0 justify-center">
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedFlowId(expanded ? null : flow.id)}
                                                    aria-expanded={expanded}
                                                    aria-controls={`flujo-${flow.id}-pasos`}
                                                    aria-label={`${expanded ? t('welcomeFlow.vista.hideSteps') : t('welcomeFlow.vista.showSteps')}: ${flow.name}`}
                                                    title={expanded ? t('welcomeFlow.vista.hideSteps') : t('welcomeFlow.vista.showSteps')}
                                                    className={cn(BOTON_ICONO, TEXTO_NAVY)}
                                                >
                                                    <ChevronDown className={cn('size-4 transition-transform', expanded && 'rotate-180')} strokeWidth={2} aria-hidden="true" />
                                                </button>
                                            </span>
                                            <div className="flex min-w-0 flex-[1_1_16rem] flex-col gap-[3px]">
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                                    <h3 className={cn('text-[14px] leading-5 font-semibold', flow.is_active ? TEXTO_NAVY : TEXTO_SUAVE)}>{flow.name}</h3>
                                                    <EstadoPunto on={flow.is_active}>{flow.is_active ? t('welcomeFlow.statusActive') : t('welcomeFlow.statusInactive')}</EstadoPunto>
                                                </div>
                                                <p className={cn('text-[12.5px] leading-4 tabular-nums', TEXTO_SUAVE)}>{detalle}</p>
                                            </div>
                                            <div className="-mr-2 ml-auto flex flex-wrap items-center gap-1">
                                                <button
                                                    type="button"
                                                    role="switch"
                                                    aria-checked={flow.is_active}
                                                    aria-label={t('welcomeFlow.vista.switchLabel', { name: flow.name })}
                                                    onClick={() => toggleFlowStatus(flow.id)}
                                                    title={tituloInterruptor}
                                                    className={cn(
                                                        'inline-flex h-[30px] cursor-pointer items-center gap-2 rounded-lg pr-2.5 pl-1 text-[12.5px] leading-4 font-semibold whitespace-nowrap transition-colors hover:bg-[#2e3f84]/5 dark:hover:bg-white/5',
                                                        flow.is_active ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-neutral-300',
                                                        FOCO
                                                    )}
                                                >
                                                    <Interruptor on={flow.is_active} />
                                                    {flow.is_active ? t('welcomeFlow.vista.switchOn') : t('welcomeFlow.vista.switchOff')}
                                                </button>
                                                <button type="button" onClick={() => openEditModal(flow)} aria-haspopup="dialog" className={BOTON_TEXTO_NAVY}>
                                                    <Edit3 strokeWidth={2} aria-hidden="true" />
                                                    {t('common.edit')}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setFlowToDelete(flow)}
                                                    aria-haspopup="dialog"
                                                    title={t('templates.vista.asksConfirmation')}
                                                    className={BOTON_TEXTO_ROJO}
                                                >
                                                    <Trash2 strokeWidth={2} aria-hidden="true" />
                                                    {t('templates.vista.deleteEllipsis')}
                                                </button>
                                            </div>
                                        </div>

                                        {expanded && (
                                            <div id={`flujo-${flow.id}-pasos`} className={cn('flex flex-col gap-3 border-t bg-[#f7f8fb] px-4 pt-4 pb-5 @3xl/hoja:pr-5 @3xl/hoja:pl-16 dark:bg-white/[0.02]', FILETE)}>
                                                <Rotulo
                                                    as="h4"
                                                    titulo={t('welcomeFlow.vista.patientView')}
                                                    apoyo={steps.length > 0 ? t('welcomeFlow.vista.patientViewSteps', { count: steps.length }) : t('welcomeFlow.vista.patientViewMessage')}
                                                />
                                                <ul className="grid grid-cols-1 items-start gap-3.5 @2xl/hoja:grid-cols-2 @5xl/hoja:grid-cols-3">
                                                    {steps.length > 0 ? steps.map((step, index) => tarjetaPaso(step, index)) : tarjetasMensaje(flow)}
                                                </ul>
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                        {/* Solo puede haber uno encendido: se dice qué pasa al encender otro. */}
                        <p className={cn('flex min-h-11 items-center gap-2 rounded-b-2xl px-4 py-2.5 text-[12.5px] leading-4 @3xl/hoja:pr-5 @3xl/hoja:pl-16', TEXTO_SUAVE)}>
                            <Info className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                            {activeFlow
                                ? inactivos.length === 1
                                    ? t('welcomeFlow.vista.infoOneOn', { other: inactivos[0].name, active: activeFlow.name })
                                    : inactivos.length > 1
                                      ? t('welcomeFlow.vista.infoManyOn', { active: activeFlow.name })
                                      : t('welcomeFlow.vista.infoOnlyOne')
                                : t('welcomeFlow.vista.infoNoneOn')}
                        </p>
                    </>
                )}
            </section>

            {/* ── Crear / editar flujo ── */}
            <DialogoPlantilla
                abierto={isModalOpen}
                onCerrar={closeModal}
                icono={Bot}
                titulo={editingFlow ? t('welcomeFlow.editFlowTitle') : t('welcomeFlow.newFlowTitle')}
                sub={t('welcomeFlow.vista.formSub')}
                cerrarConX
                ancho="max-w-[752px]"
                pie={
                    <>
                        <button type="button" onClick={closeModal} className={BOTON_SECUNDARIO}>
                            <X strokeWidth={1.9} aria-hidden="true" />
                            {t('common.cancel')}
                        </button>
                        <button type="submit" form="welcome-flow-form" disabled={processing} className={BOTON_PRIMARIO}>
                            <Save strokeWidth={2} aria-hidden="true" />
                            {processing ? t('common.saving') : editingFlow ? t('welcomeFlow.vista.saveFlow') : t('welcomeFlow.createFlow')}
                        </button>
                    </>
                }
            >
                <form id="welcome-flow-form" onSubmit={handleSubmit} className="flex flex-col gap-3.5">
                    {editingSteps > 0 && <Nota tipo="aviso">{t('welcomeFlow.vista.stepsWarning', { count: editingSteps })}</Nota>}
                    <div className="grid grid-cols-1 items-start gap-x-[22px] gap-y-5 md:grid-cols-[minmax(0,1fr)_262px]">
                        <div className="flex min-w-0 flex-col gap-3.5">
                            <div className="grid grid-cols-1 gap-x-3 gap-y-3.5 sm:grid-cols-[minmax(0,1fr)_200px]">
                                <div className="flex min-w-0 flex-col gap-[7px]">
                                    <label htmlFor="flow-name" className={ETIQUETA}>
                                        {t('welcomeFlow.flowNameLabel')}
                                    </label>
                                    <input
                                        id="flow-name"
                                        value={data.name}
                                        onChange={(event) => setData('name', event.target.value)}
                                        placeholder={t('welcomeFlow.flowNamePlaceholder')}
                                        aria-invalid={errors.name ? true : undefined}
                                        className={CAMPO}
                                        required
                                    />
                                    {errors.name && <span className={ERROR_CAMPO}>{errors.name}</span>}
                                </div>
                                <div className="flex min-w-0 flex-col gap-[7px]">
                                    <label htmlFor="flow-trigger" className={ETIQUETA}>
                                        {t('welcomeFlow.whenSentLabel')}
                                    </label>
                                    <Select value={data.trigger_type} onValueChange={(v) => setData('trigger_type', v)}>
                                        <SelectTrigger id="flow-trigger" className={DISPARADOR}>
                                            <SelectValue placeholder={t('welcomeFlow.whenSentPlaceholder')} />
                                        </SelectTrigger>
                                        <SelectContent className={MENU}>
                                            <SelectItem value="first_contact" className={OPCION}>
                                                {t('welcomeFlow.triggerFirstContactOption')}
                                            </SelectItem>
                                            <SelectItem value="every_new_conversation" className={OPCION}>
                                                {t('welcomeFlow.triggerEveryNewConversation')}
                                            </SelectItem>
                                            <SelectItem value="always" className={OPCION}>
                                                {t('welcomeFlow.triggerAlways')}
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <span className={cn(AYUDA, '-mt-1.5')}>{t('welcomeFlow.vista.whenHelp')}</span>

                            <div className="flex flex-col gap-[7px]">
                                <label htmlFor="flow-message" className={ETIQUETA}>
                                    {t('welcomeFlow.welcomeMessage')}
                                </label>
                                <textarea
                                    id="flow-message"
                                    value={data.message}
                                    onChange={(event) => setData('message', event.target.value)}
                                    placeholder={t('welcomeFlow.welcomeMessagePlaceholder')}
                                    aria-invalid={errors.message ? true : undefined}
                                    className={cn(AREA, 'min-h-[96px]')}
                                    required
                                />
                                {errors.message && <span className={ERROR_CAMPO}>{errors.message}</span>}
                            </div>

                            <div className="flex flex-col gap-2">
                                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                                    <span className="flex flex-wrap items-baseline gap-x-2">
                                        <span id="flow-buttons-label" className={ETIQUETA}>
                                            {t('welcomeFlow.vista.buttonsLabel')}
                                        </span>
                                        <span className={cn(AYUDA, 'tabular-nums')}>{t('welcomeFlow.vista.buttonsOf', { count: data.buttons.length })}</span>
                                    </span>
                                    <button type="button" onClick={addButton} disabled={data.buttons.length >= 3} className={cn(BOTON_TEXTO_NAVY, '-mr-2')}>
                                        <Plus strokeWidth={2} aria-hidden="true" />
                                        {t('welcomeFlow.vista.addButton')}
                                    </button>
                                </div>

                                {data.buttons.length === 0 ? (
                                    <p className={cn('rounded-[10px] border-[1.5px] border-dashed border-[#2e3f84]/26 px-3 py-2.5 text-[12.5px] leading-[18px] dark:border-white/20', TEXTO_SUAVE)}>
                                        {t('welcomeFlow.noButtonsConfigured')}
                                    </p>
                                ) : (
                                    <ul aria-labelledby="flow-buttons-label" className="flex flex-col gap-2.5">
                                        {data.buttons.map((button, index) => (
                                            <li
                                                key={`${button.id}-${index}`}
                                                className="flex flex-col gap-2.5 rounded-[10px] bg-white p-3 shadow-[inset_0_0_0_1px_rgba(46,63,132,0.14)] dark:bg-white/[0.03] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <MousePointerClick className={cn('size-3.5', TEXTO_NAVY)} strokeWidth={2} aria-hidden="true" />
                                                    <span className={cn('flex-1 text-[13px] leading-[18px] font-semibold', TEXTO_NAVY)}>{t('welcomeFlow.buttonNumber', { number: index + 1 })}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeButton(index)}
                                                        aria-label={`${t('welcomeFlow.removeButton')} ${index + 1}`}
                                                        title={t('welcomeFlow.vista.removeButtonHint')}
                                                        className={cn(BOTON_ICONO, 'text-red-700 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10 dark:hover:text-red-300')}
                                                    >
                                                        <Trash2 className="size-4" strokeWidth={2} aria-hidden="true" />
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                                                    <div className="flex min-w-0 flex-col gap-[7px]">
                                                        <label htmlFor={`flow-btn-${index}-title`} className={ETIQUETA}>
                                                            {t('welcomeFlow.buttonTextLabel')} <span className={cn('font-normal tabular-nums', TEXTO_SUAVE)}>({button.title.length}/20)</span>
                                                        </label>
                                                        <input
                                                            id={`flow-btn-${index}-title`}
                                                            value={button.title}
                                                            onChange={(event) => updateButton(index, 'title', event.target.value)}
                                                            placeholder={t('welcomeFlow.buttonTextPlaceholder')}
                                                            maxLength={20}
                                                            className={cn(CAMPO, 'h-[34px]')}
                                                            required
                                                        />
                                                    </div>
                                                    <div className="flex min-w-0 flex-col gap-[7px]">
                                                        <label htmlFor={`flow-btn-${index}-id`} className={ETIQUETA}>
                                                            {t('welcomeFlow.buttonIdLabel')}
                                                        </label>
                                                        <input
                                                            id={`flow-btn-${index}-id`}
                                                            value={button.id}
                                                            onChange={(event) => updateButton(index, 'id', event.target.value)}
                                                            placeholder={t('welcomeFlow.buttonIdPlaceholder')}
                                                            className={cn(CAMPO, 'h-[34px] text-[12.5px]', MONO)}
                                                            required
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-[7px]">
                                                    <label htmlFor={`flow-btn-${index}-resp`} className={ETIQUETA}>
                                                        {t('welcomeFlow.autoResponseLabel')}
                                                    </label>
                                                    <textarea
                                                        id={`flow-btn-${index}-resp`}
                                                        value={data.responses[button.id] || ''}
                                                        onChange={(event) => updateResponse(button.id, event.target.value)}
                                                        placeholder={t('welcomeFlow.autoResponsePlaceholder')}
                                                        rows={2}
                                                        className={cn(AREA, 'min-h-[60px]')}
                                                    />
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>

                        <div className="flex min-w-0 flex-col gap-2.5 md:sticky md:top-0">
                            <Rotulo titulo={editingSteps > 0 ? t('welcomeFlow.vista.previewFormLabel') : t('welcomeFlow.vista.receivesLabel')} />
                            <BurbujaEntra texto={data.message} botones={data.buttons.filter((b) => b.title.trim()).map((b) => b.title)} vacio={t('welcomeFlow.vista.previewEmpty')} />
                            <button
                                type="button"
                                role="switch"
                                aria-checked={data.is_active}
                                aria-label={t('welcomeFlow.vista.turnOnLabel')}
                                onClick={() => setData('is_active', !data.is_active)}
                                className={cn(
                                    'flex w-full cursor-pointer items-center justify-between gap-3 rounded-[10px] px-3.5 py-3 text-left transition-colors',
                                    data.is_active
                                        ? 'bg-emerald-50 text-emerald-800 shadow-[inset_0_0_0_1px_var(--color-emerald-200)] dark:bg-emerald-500/10 dark:text-emerald-200 dark:shadow-[inset_0_0_0_1px_rgba(16,185,129,0.25)]'
                                        : 'bg-white shadow-[inset_0_0_0_1px_rgba(46,63,132,0.14)] dark:bg-white/[0.03] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]',
                                    FOCO
                                )}
                            >
                                <span className="flex min-w-0 flex-col gap-0.5">
                                    <span className={cn('text-[13px] leading-[18px] font-semibold', !data.is_active && TEXTO_NAVY)}>{t('welcomeFlow.vista.turnOnLabel')}</span>
                                    <span className={cn('text-[12px] leading-4', !data.is_active && TEXTO_SUAVE)}>{t('welcomeFlow.vista.turnOnText')}</span>
                                </span>
                                <Interruptor on={data.is_active} />
                            </button>
                            {otroEncendido && <Nota tipo="info">{t('welcomeFlow.vista.turnOnInfo', { name: otroEncendido.name })}</Nota>}
                        </div>
                    </div>
                </form>
            </DialogoPlantilla>

            {/* ── Eliminar flujo: diálogo propio (antes window.confirm). Cancelar a la izquierda con el foco; Esc cancela ── */}
            <DialogoPlantilla
                abierto={flowToDelete !== null}
                onCerrar={() => setFlowToDelete(null)}
                icono={Trash2}
                peligro
                titulo={t('welcomeFlow.vista.deleteTitle')}
                ancho="max-w-[400px]"
                enfoqueInicial={seguroBorrar}
                pie={
                    <>
                        <button ref={seguroBorrar} type="button" onClick={() => setFlowToDelete(null)} className={BOTON_SECUNDARIO}>
                            <X strokeWidth={1.9} aria-hidden="true" />
                            {t('common.cancel')}
                        </button>
                        <button type="button" onClick={confirmDeleteFlow} className={BOTON_PELIGRO_LLENO}>
                            <Trash2 strokeWidth={2} aria-hidden="true" />
                            {t('templates.vista.deleteYes')}
                        </button>
                    </>
                }
            >
                {flowToDelete && (
                    <>
                        <p className={cn('text-[13.5px] leading-5', TEXTO_SUAVE)}>{t('welcomeFlow.vista.deleteText')}</p>
                        <QueSeBorra
                            nombre={flowToDelete.name}
                            detalle={`${flowToDeleteSteps} · ${flowToDelete.is_active ? t('welcomeFlow.vista.stateOn') : t('welcomeFlow.vista.stateOff')}`}
                        />
                        {flowToDelete.is_active && <Nota tipo="aviso">{t('welcomeFlow.vista.deleteActiveWarning')}</Nota>}
                    </>
                )}
            </DialogoPlantilla>
        </>
    );
}
