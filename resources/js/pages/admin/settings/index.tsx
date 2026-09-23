import { Head, router, useForm } from '@inertiajs/react';
import AdminLayout from '@/layouts/admin-layout';
import { Button } from '@/components/ui/button';
import InputError from '@/components/input-error';
import { cn } from '@/lib/utils';
import {
    AudioLines,
    BadgeCheck,
    Building2,
    Check,
    CircleAlert,
    CircleCheck,
    KeyRound,
    Loader2,
    Lock,
    MessageCircle,
    Phone,
    PlugZap,
    Search,
    ShieldCheck,
    Users,
    Webhook,
    X,
    type LucideIcon,
} from 'lucide-react';
import { useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { toast } from '@/lib/toast';
import axios from 'axios';

interface Settings {
    whatsapp: {
        token: string | null;
        phone_id: string | null;
        business_account_id: string | null;
        verify_token: string | null;
        webhook_url: string | null;
        is_configured: boolean;
    };
    groq: {
        api_key: string | null;
        is_configured: boolean;
    };
}

interface Advisor {
    id: number;
    name: string;
    email: string;
    is_on_duty: boolean;
}

interface SettingsIndexProps {
    settings: Settings;
    advisors: Advisor[];
}

interface BusinessProfile {
    business_name: string;
    phone_number: string;
    phone_number_id: string;
    verified: boolean;
    quality_rating: string;
    messaging_limit: string;
}

/* ── Tintas de la vista (design/vista-configuracion/gen_config.mjs) ────────────────────────────────
   Mismo lenguaje que Usuarios: navy #2e3f84 con alfa sobre la hoja blanca; en oscuro, blanco con alfa
   sobre bg-card. */
const FILETE = 'border-[#2e3f84]/8 dark:border-white/8';
const TEXTO_NAVY = 'text-[#2e3f84] dark:text-neutral-100';
// Ayudas y notas: en oscuro el muted-foreground no llega a 4,5:1 sobre la banda tintada (4,45:1),
// así que sube a neutral-400 (5,85:1). En claro, #5c6485 da 5,7:1 sobre la banda y 5,9:1 sobre la hoja.
const TEXTO_SUAVE = 'text-muted-foreground dark:text-neutral-400';
const FOCO = 'outline-none focus-visible:ring-2 focus-visible:ring-[#2e3f84]/40 dark:focus-visible:ring-[#8b9ae0]/60';
// Monoespaciada del diseño (Cascadia Mono en Windows 11; Consolas si no está).
const MONO = "[font-family:ui-monospace,'Cascadia_Mono','SF_Mono',Consolas,monospace]";
const BANDA = 'bg-[#2e3f84]/[0.028] dark:bg-white/[0.03]';

// Rejilla de las filas de ajuste: etiqueta + ayuda a la izquierda, campo a la derecha. En hojas
// estrechas (< 768 px) se apilan. El texto arranca a 64 px (20 de sangría + 32 de la ranura del
// icono de sección + 12), como en el diseño.
const REJILLA = '@3xl/hoja:grid-cols-[220px_minmax(0,1fr)] @3xl/hoja:gap-x-8 @5xl/hoja:grid-cols-[300px_minmax(0,1fr)]';
const SANGRIA = 'px-4 @3xl/hoja:pr-5 @3xl/hoja:pl-16';

// Los secretos llegan del servidor como 8 caracteres + asteriscos. Se pintan con puntos y NUNCA más
// de 8 caracteres de lo recibido (si alguna vez llegara el valor entero, se sigue viendo solo el inicio).
const PUNTOS = '•'.repeat(12);
const inicioVisible = (preview: string) => preview.replace(/\*+$/, '').slice(0, 8);

function getInitials(name: string) {
    return name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join('');
}

/** Nombre propio SOLO para pintar (el dato no cambia): "ANDREA CAROLINA MUÑOZ PAZ" → "Andrea Carolina Muñoz Paz". */
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y']);

function nombrePropio(nombre: string) {
    const mayuscula = (parte: string) => parte.charAt(0).toLocaleUpperCase('es') + parte.slice(1);

    return nombre
        .toLocaleLowerCase('es')
        .split(/\s+/)
        .filter(Boolean)
        .map((palabra, i) => (i > 0 && PARTICULAS.has(palabra) ? palabra : palabra.split('-').map(mayuscula).join('-')))
        .join(' ');
}

/* ── Piezas ─────────────────────────────────────────────────────────────────────────────────────── */

/** Estado en línea: punto + palabra. Esmeralda 700 (5,0:1 sobre la banda) o ámbar 700 (4,8:1). */
function Estado({ ok, si, no }: { ok: boolean; si: string; no: string }) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 text-[12.5px] leading-4 font-medium whitespace-nowrap',
                ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
            )}
        >
            <span className={cn('size-[7px] shrink-0 rounded-full', ok ? 'bg-emerald-600 dark:bg-emerald-500' : 'bg-amber-700 dark:bg-amber-400')} aria-hidden="true" />
            {ok ? si : no}
        </span>
    );
}

/** Avatar de iniciales en tinta navy (los asesores). */
function Iniciales({ name, className }: { name: string; className?: string }) {
    return (
        <span
            className={cn(
                'flex shrink-0 items-center justify-center rounded-full bg-[#2e3f84]/10 text-[11px] leading-none font-semibold tracking-[0.02em] text-[#2e3f84] shadow-[inset_0_0_0_1px_rgba(46,63,132,0.06)] dark:bg-white/8 dark:text-neutral-200 dark:shadow-none',
                className
            )}
            aria-hidden="true"
        >
            {getInitials(name)}
        </span>
    );
}

/** Un estado de la franja: marca + etiqueta arriba; punto, valor grande y detalle debajo. */
function EstadoFranja({ icon: Icon, etiqueta, ok, children }: { icon: LucideIcon; etiqueta: string; ok: boolean; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex h-4 items-center gap-2">
                <Icon className={cn('size-3.5 shrink-0', TEXTO_NAVY)} strokeWidth={2} aria-hidden="true" />
                <span className="truncate text-[12px] leading-4 font-medium text-muted-foreground">{etiqueta}</span>
            </div>
            <div className="flex h-[34px] min-w-0 items-center gap-2.5">
                <span className={cn('size-[9px] shrink-0 rounded-full', ok ? 'bg-emerald-600 dark:bg-emerald-500' : 'bg-slate-500 dark:bg-neutral-500')} aria-hidden="true" />
                {children}
            </div>
        </div>
    );
}

const ValorFranja = ({ children }: { children: ReactNode }) => (
    <span className={cn('text-[24px] leading-[34px] font-medium tracking-[-0.025em] whitespace-nowrap tabular-nums', TEXTO_NAVY)}>{children}</span>
);
const DetalleFranja = ({ children, className }: { children: ReactNode; className?: string }) => (
    <span className={cn('mt-[5px] min-w-0 truncate text-[13px] leading-4 text-muted-foreground tabular-nums', className)}>{children}</span>
);

// Filete vertical entre estados (no un borde de tarjeta). Solo cuando la franja va en una fila.
const Divisor = () => <div className="hidden w-px self-stretch bg-[#2e3f84]/12 @5xl/pagina:block dark:bg-white/10" aria-hidden="true" />;

/** Banda de sección: icono en la ranura, título + estado, qué hace; acciones a la derecha. */
function Banda({
    id,
    icon: Icon,
    titulo,
    estado,
    texto,
    acciones,
}: {
    id: string;
    icon: LucideIcon;
    titulo: string;
    estado: ReactNode;
    texto: string;
    acciones?: ReactNode;
}) {
    return (
        <div
            className={cn(
                'flex flex-wrap items-center gap-x-3 gap-y-3 border-b px-4 py-3 @3xl/hoja:min-h-16 @3xl/hoja:flex-nowrap @3xl/hoja:px-5 @3xl/hoja:py-2.5',
                BANDA,
                FILETE
            )}
        >
            <span className={cn('flex w-8 shrink-0 justify-center self-start pt-px @3xl/hoja:self-center @3xl/hoja:pt-0', TEXTO_NAVY)}>
                <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <div className="flex min-w-0 flex-[1_1_16rem] flex-col gap-[3px]">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h2 id={id} className={cn('text-[15px] leading-5 font-semibold tracking-[-0.01em]', TEXTO_NAVY)}>
                        {titulo}
                    </h2>
                    {estado}
                </div>
                <p className={cn('text-[12.5px] leading-4 @3xl/hoja:truncate', TEXTO_SUAVE)}>{texto}</p>
            </div>
            {acciones && <div className="flex flex-wrap items-center gap-2 @3xl/hoja:shrink-0">{acciones}</div>}
        </div>
    );
}

/** Subtítulo de grupo dentro de una sección ("Credenciales" / "Identificadores"). */
function Subgrupo({ titulo, texto }: { titulo: string; texto: string }) {
    return (
        <div className={cn('flex min-h-10 flex-wrap items-end gap-x-2.5 gap-y-0.5 pt-4 pb-2', SANGRIA)}>
            <h3 className={cn('text-[11px] leading-4 font-semibold tracking-[0.07em] uppercase', TEXTO_SUAVE)}>{titulo}</h3>
            <p className={cn('text-[12px] leading-4', TEXTO_SUAVE)}>{texto}</p>
        </div>
    );
}

/** Fila de ajuste: a la izquierda qué es y qué acepta; a la derecha el campo (o el dato). */
function Fila({
    etiqueta,
    htmlFor,
    ayuda,
    ayudaId,
    children,
    abajo = 'pb-4 @3xl/hoja:pb-[15px]',
}: {
    etiqueta: string;
    htmlFor?: string;
    ayuda: string;
    ayudaId?: string;
    children: ReactNode;
    abajo?: string;
}) {
    const claseEtiqueta = cn('text-[13.5px] leading-[18px] font-semibold tracking-[-0.003em]', TEXTO_NAVY);

    return (
        <div className={cn('grid grid-cols-1 gap-y-2.5 border-b pt-4', REJILLA, SANGRIA, FILETE, abajo)}>
            <div className="flex min-w-0 flex-col gap-[3px]">
                {htmlFor ? (
                    <label htmlFor={htmlFor} className={cn(claseEtiqueta, 'w-fit cursor-pointer')}>
                        {etiqueta}
                    </label>
                ) : (
                    <span className={claseEtiqueta}>{etiqueta}</span>
                )}
                <span id={ayudaId} className={cn('text-[12px] leading-[17px] whitespace-pre-line', TEXTO_SUAVE)}>
                    {ayuda}
                </span>
            </div>
            <div className="min-w-0">{children}</div>
        </div>
    );
}

/** Campo editable. Borde navy al 58 % (#868fb7): 3,1:1 contra la hoja (WCAG 1.4.11). */
function Campo({
    id,
    icon: Icon,
    value,
    onChange,
    placeholder,
    type = 'text',
    mono = false,
    corto = false,
    invalido = false,
    describedBy,
}: {
    id: string;
    icon: LucideIcon;
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    type?: 'text' | 'password';
    mono?: boolean;
    corto?: boolean;
    invalido?: boolean;
    describedBy?: string;
}) {
    return (
        <div className={cn('relative w-full', corto ? 'max-w-[280px]' : 'max-w-[440px]')}>
            <Icon
                className="pointer-events-none absolute top-1/2 left-3 size-[15px] -translate-y-1/2 text-muted-foreground dark:text-neutral-400"
                strokeWidth={1.75}
                aria-hidden="true"
            />
            <input
                id={id}
                name={id}
                type={type}
                // Los secretos nunca se autocompletan: un gestor de contraseñas podría meter la clave de
                // inicio de sesión en el campo del token y reemplazarlo al pulsar Guardar.
                autoComplete={type === 'password' ? 'new-password' : undefined}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                aria-describedby={describedBy}
                aria-invalid={invalido || undefined}
                className={cn(
                    'h-[38px] w-full rounded-[9px] bg-white pr-3 pl-[37px] text-[13px] leading-[18px] text-[#2e3f84] shadow-[inset_0_0_0_1px_rgba(46,63,132,0.58)] transition-shadow outline-none placeholder:text-muted-foreground',
                    'focus:shadow-[inset_0_0_0_1px_#2e3f84,0_0_0_3px_rgba(46,63,132,0.2)]',
                    'dark:bg-white/[0.04] dark:text-neutral-100 dark:shadow-[inset_0_0_0_1px_var(--color-neutral-500)] dark:placeholder:text-neutral-400 dark:focus:shadow-[inset_0_0_0_1px_#8b9ae0,0_0_0_3px_rgba(139,154,224,0.3)]',
                    mono && MONO + ' text-[12.5px] tracking-[0.02em] placeholder:font-sans',
                    invalido && 'shadow-[inset_0_0_0_1px_var(--color-red-600)] dark:shadow-[inset_0_0_0_1px_var(--color-red-400)]'
                )}
            />
        </div>
    );
}

/** Lo que hay guardado, enmascarado, y cómo se conserva. */
function Guardado({ id, etiqueta, preview, conserva }: { id: string; etiqueta: string; preview: string; conserva: string }) {
    const inicio = inicioVisible(preview);

    return (
        <p id={id} className={cn('mt-[7px] flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] leading-4', TEXTO_SUAVE)}>
            <Lock className="size-3 shrink-0" strokeWidth={2} aria-hidden="true" />
            <span>{etiqueta}</span>
            <span className={cn(MONO + ' text-[12px] tracking-[0.02em]', TEXTO_NAVY)} aria-hidden="true">
                {inicio}
                {PUNTOS}
            </span>
            <span className="sr-only">{inicio}…</span>
            {/* En hojas estrechas "vacío, se conserva" baja a su propia línea, alineado tras el candado. */}
            <span className="inline-flex basis-full items-center gap-1.5 pl-[18px] whitespace-nowrap @3xl/hoja:basis-auto @3xl/hoja:pl-0">
                <span className="hidden @3xl/hoja:inline" aria-hidden="true">·</span>
                <span>{conserva}</span>
            </span>
        </p>
    );
}

const ERROR_CAMPO = 'mt-1.5 text-[12.5px] leading-[18px] text-red-700 dark:text-red-400';

const describir = (...ids: (string | false | null | undefined)[]) => ids.filter(Boolean).join(' ') || undefined;

/** Pie de sección: botón + nota. En secciones de campos se alinea con la columna de los campos. */
function Pie({ children, nota, columna = true, final = false }: { children: ReactNode; nota?: string; columna?: boolean; final?: boolean }) {
    return (
        <div
            className={cn(
                'grid grid-cols-1 py-4 @3xl/hoja:min-h-[68px] @3xl/hoja:items-center @3xl/hoja:py-3',
                columna && REJILLA,
                SANGRIA,
                !final && cn('border-b', FILETE)
            )}
        >
            {columna && <span className="hidden @3xl/hoja:block" aria-hidden="true" />}
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
                {children}
                {nota && <span className={cn('text-[12px] leading-4', TEXTO_SUAVE)}>{nota}</span>}
            </div>
        </div>
    );
}

const BOTON_PRIMARIO = cn(
    'h-9 gap-2 rounded-[10px] pr-4 pl-3.5 text-[13px] leading-[18px] font-semibold has-[>svg]:pr-4 has-[>svg]:pl-3.5 focus-visible:ring-offset-2 focus-visible:ring-offset-card',
    FOCO
);

// Desactivado "de verdad" (hoy: Groq sin API key escrita): tinta navy, sin relleno sólido.
const BOTON_APAGADO =
    'bg-[#2e3f84]/6 text-muted-foreground shadow-[inset_0_0_0_1px_rgba(46,63,132,0.1)] hover:bg-[#2e3f84]/6 disabled:opacity-100 dark:bg-white/5 dark:text-neutral-400 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]';

const BOTON_SECUNDARIO = cn(
    'inline-flex h-8 shrink-0 cursor-pointer items-center gap-[7px] rounded-[9px] bg-white pr-3 pl-2.5 text-[12.5px] leading-4 font-semibold whitespace-nowrap text-[#2e3f84] shadow-[inset_0_0_0_1px_rgba(46,63,132,0.16),0_1px_2px_rgba(46,63,132,0.08)] transition-colors hover:bg-[#f6f7fb] disabled:cursor-default disabled:opacity-60',
    'dark:bg-white/5 dark:text-neutral-100 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] dark:hover:bg-white/8',
    FOCO
);

// Avatares de "de turno" en la franja, tocándose. Si hay más gente que huecos, el último es "+N".
const HUECOS_PILA = 7;

export default function SettingsIndex({ settings, advisors }: SettingsIndexProps) {
    const { t } = useTranslation();
    const [testingConnection, setTestingConnection] = useState(false);
    const [loadingProfile, setLoadingProfile] = useState(false);
    const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
    const [advisorSearch, setAdvisorSearch] = useState('');
    const [connectionStatus, setConnectionStatus] = useState<{
        type: 'success' | 'error' | null;
        message: string;
    }>({ type: null, message: '' });

    const [selectedAdvisors, setSelectedAdvisors] = useState<number[]>(
        advisors.filter((advisor) => advisor.is_on_duty).map((advisor) => advisor.id)
    );
    const [savingAdvisors, setSavingAdvisors] = useState(false);

    const whatsappForm = useForm({
        whatsapp_token: '',
        whatsapp_phone_id: settings.whatsapp.phone_id || '',
        whatsapp_business_account_id: settings.whatsapp.business_account_id || '',
        whatsapp_verify_token: '',
    });

    const groqForm = useForm({
        groq_api_key: '',
    });

    const filteredAdvisors = useMemo(() => {
        const searchTerm = advisorSearch.trim().toLowerCase();

        if (!searchTerm) {
            return advisors;
        }

        return advisors.filter((advisor) => `${advisor.name} ${advisor.email}`.toLowerCase().includes(searchTerm));
    }, [advisorSearch, advisors]);

    // Solo para pintar: orden alfabético (con acentos bien ordenados). Marcar a alguien no lo mueve.
    const advisorsInOrder = useMemo(
        () => [...filteredAdvisors].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })),
        [filteredAdvisors]
    );

    // Los de turno (según lo marcado), en el mismo orden de la lista, para la franja.
    const onDutyInOrder = useMemo(
        () =>
            [...advisors]
                .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
                .filter((advisor) => selectedAdvisors.includes(advisor.id)),
        [advisors, selectedAdvisors]
    );

    const handleWhatsAppSubmit = (event: FormEvent) => {
        event.preventDefault();
        whatsappForm.post('/admin/settings/whatsapp', {
            preserveScroll: true,
            onSuccess: () => {
                whatsappForm.reset('whatsapp_token', 'whatsapp_verify_token');
                toast.success(t('settings.whatsapp.savedSuccess'));
            },
            onError: () => toast.error(t('settings.saveError')),
        });
    };

    const handleGroqSubmit = (event: FormEvent) => {
        event.preventDefault();
        groqForm.post('/admin/settings/groq', {
            preserveScroll: true,
            onSuccess: () => {
                groqForm.reset('groq_api_key');
                toast.success(t('settings.groq.savedSuccess'));
            },
            onError: () => toast.error(t('settings.saveError')),
        });
    };

    const testConnection = async () => {
        setTestingConnection(true);
        setConnectionStatus({ type: null, message: '' });

        try {
            // axios usa el token CSRF VIVO de la cookie (el <meta> queda obsoleto tras login por
            // Inertia) y el interceptor global reintenta ante 419. validateStatus deja pasar 4xx/5xx
            // sin lanzar para conservar el manejo del JSON de negocio ({ success, message }).
            const response = await axios.post('/admin/settings/test-whatsapp', null, {
                validateStatus: (status) => status !== 419,
            });

            const data = response.data;

            setConnectionStatus({
                type: data.success ? 'success' : 'error',
                message: data.message,
            });
        } catch {
            setConnectionStatus({
                type: 'error',
                message: t('settings.whatsapp.connectionError'),
            });
        } finally {
            setTestingConnection(false);
        }
    };

    const toggleAdvisor = (advisorId: number) => {
        setSelectedAdvisors((currentAdvisors) =>
            currentAdvisors.includes(advisorId)
                ? currentAdvisors.filter((currentAdvisorId) => currentAdvisorId !== advisorId)
                : [...currentAdvisors, advisorId]
        );
    };

    const saveOnDutyAdvisors = () => {
        setSavingAdvisors(true);
        router.post('/admin/settings/on-duty-advisors', {
            advisor_ids: selectedAdvisors,
        }, {
            preserveScroll: true,
            onFinish: () => setSavingAdvisors(false),
            onSuccess: () => toast.success(t('settings.onDutyAdvisors.savedSuccess')),
            onError: () => toast.error(t('settings.onDutyAdvisors.saveError')),
        });
    };

    const getBusinessProfile = async () => {
        setLoadingProfile(true);

        try {
            const response = await fetch('/admin/settings/business-profile', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();

            if (data.success) {
                setBusinessProfile(data.profile);
            } else {
                setConnectionStatus({
                    type: 'error',
                    message: data.message || t('settings.whatsapp.profileFetchFailed'),
                });
            }
        } catch {
            setConnectionStatus({
                type: 'error',
                message: t('settings.whatsapp.profileFetchError'),
            });
        } finally {
            setLoadingProfile(false);
        }
    };

    /* ── Piezas que dependen de t() ───────────────────────────────────────────────────────────── */

    const conserva = t('settings.keepWhenEmpty');
    const errors = whatsappForm.errors;

    const botonGuardar = (processing: boolean, texto: string) =>
        processing ? (
            <>
                <Loader2 className="size-[15px] animate-spin" aria-hidden="true" />
                {t('common.saving')}
            </>
        ) : (
            <>
                <Check className="size-[15px]" strokeWidth={2} aria-hidden="true" />
                {texto}
            </>
        );

    const dato = (etiqueta: string, valor: ReactNode, className?: string) => (
        <div className="flex min-w-0 flex-col gap-0.5">
            <dt className={cn('text-[12px] leading-4', TEXTO_SUAVE)}>{etiqueta}</dt>
            <dd className={cn('text-[13.5px] leading-5 font-medium [overflow-wrap:anywhere] @3xl/hoja:truncate', TEXTO_NAVY, className)}>{valor}</dd>
        </div>
    );

    const conPila = onDutyInOrder.length > HUECOS_PILA ? HUECOS_PILA - 1 : onDutyInOrder.length;
    const restoPila = onDutyInOrder.length - conPila;

    const advisorCount = advisors.length;
    const filas = {
        '--f1': advisorsInOrder.length,
        '--f2': Math.ceil(advisorsInOrder.length / 2),
        '--f3': Math.ceil(advisorsInOrder.length / 3),
    } as CSSProperties;

    const groqKeyEmpty = !groqForm.data.groq_api_key;

    return (
        <AdminLayout>
            <Head title={t('settings.whatsapp.title')} />

            <div className="min-h-screen bg-background px-4 pt-5 pb-8 md:px-7 md:pt-7">
                <div className="@container/pagina mx-auto flex max-w-7xl flex-col gap-6">
                    {/* ── Cabecera ── */}
                    <header className="flex flex-col gap-1">
                        <h1 className={cn('text-[28px] leading-[34px] font-semibold tracking-[-0.025em]', TEXTO_NAVY)}>{t('settings.whatsapp.title')}</h1>
                        <p className="text-[14px] leading-5 text-muted-foreground">{t('settings.whatsapp.subtitle')}</p>
                    </header>

                    {/* ── Franja de estados (sin cajas: filetes entre estados). La primera columna no baja de 345 px:
                        así "Configurado · Phone ID …" cabe entero también a 1366 con el menú fijado. ── */}
                    <section
                        aria-label={t('settings.strip.label')}
                        className="grid grid-cols-1 gap-y-5 @2xl/pagina:grid-cols-2 @2xl/pagina:gap-x-6 @5xl/pagina:grid-cols-[minmax(345px,1.25fr)_1px_minmax(0,1fr)_1px_minmax(0,1.35fr)] @5xl/pagina:gap-y-0"
                    >
                        <EstadoFranja icon={MessageCircle} etiqueta={t('settings.strip.whatsapp')} ok={settings.whatsapp.is_configured}>
                            <ValorFranja>{settings.whatsapp.is_configured ? t('settings.configured') : t('settings.pending')}</ValorFranja>
                            <DetalleFranja>
                                {settings.whatsapp.phone_id
                                    ? t('settings.strip.phoneId', { id: settings.whatsapp.phone_id })
                                    : t('settings.whatsapp.noPhoneId')}
                            </DetalleFranja>
                        </EstadoFranja>
                        <Divisor />
                        <EstadoFranja icon={AudioLines} etiqueta={t('settings.strip.speech')} ok={settings.groq.is_configured}>
                            <ValorFranja>{settings.groq.is_configured ? t('settings.active') : t('settings.pending')}</ValorFranja>
                            <DetalleFranja>Groq</DetalleFranja>
                        </EstadoFranja>
                        <Divisor />
                        <div className="min-w-0 @2xl/pagina:col-span-2 @5xl/pagina:col-span-1">
                            <EstadoFranja icon={Users} etiqueta={t('settings.onDutyAdvisors.title')} ok={selectedAdvisors.length > 0}>
                                <span className="flex shrink-0 items-baseline gap-[7px]">
                                    <ValorFranja>{selectedAdvisors.length}</ValorFranja>
                                    <span className="text-[13px] leading-4 whitespace-nowrap text-muted-foreground tabular-nums">
                                        {t('settings.strip.ofTotal', { total: advisorCount })}
                                    </span>
                                </span>
                                {conPila > 0 && (
                                    <ul aria-label={t('settings.strip.whoIsOnDuty')} className="ml-1 flex min-w-0 items-center overflow-hidden">
                                        {onDutyInOrder.slice(0, conPila).map((advisor) => (
                                            <li key={advisor.id} title={nombrePropio(advisor.name)} className="flex shrink-0 rounded-full">
                                                <Iniciales name={advisor.name} className="size-7 ring-2 ring-background" />
                                                <span className="sr-only">{nombrePropio(advisor.name)}</span>
                                            </li>
                                        ))}
                                        {restoPila > 0 && (
                                            <li
                                                title={t('settings.strip.moreOnDuty', { count: restoPila })}
                                                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-card text-[11px] leading-none font-semibold text-[#2e3f84] tabular-nums shadow-[inset_0_0_0_1px_rgba(46,63,132,0.14)] ring-2 ring-background dark:text-neutral-100 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
                                            >
                                                <span aria-hidden="true">+{restoPila}</span>
                                                <span className="sr-only">{t('settings.strip.moreOnDuty', { count: restoPila })}</span>
                                            </li>
                                        )}
                                    </ul>
                                )}
                            </EstadoFranja>
                        </div>
                    </section>

                    {/* ── La hoja: WhatsApp, Groq y turno, una sección tras otra ── */}
                    <div className="@container/hoja overflow-hidden rounded-2xl bg-card shadow-[0_0_0_1px_rgba(46,63,132,0.07),0_1px_2px_rgba(46,63,132,0.05),0_14px_32px_-18px_rgba(46,63,132,0.22)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07),0_14px_32px_-18px_rgba(0,0,0,0.6)]">
                        {/* ── 1. WhatsApp Business API ── */}
                        <form onSubmit={handleWhatsAppSubmit} aria-labelledby="settings-whatsapp">
                            <Banda
                                id="settings-whatsapp"
                                icon={MessageCircle}
                                titulo={t('settings.whatsapp.apiTitle')}
                                estado={<Estado ok={settings.whatsapp.is_configured} si={t('settings.configured')} no={t('settings.whatsapp.requiresData')} />}
                                texto={t('settings.whatsapp.bandText')}
                                acciones={
                                    settings.whatsapp.is_configured && (
                                        <>
                                            <button type="button" onClick={testConnection} disabled={testingConnection} className={BOTON_SECUNDARIO}>
                                                {testingConnection ? (
                                                    <Loader2 className="size-[15px] animate-spin" aria-hidden="true" />
                                                ) : (
                                                    <PlugZap className="size-[15px]" strokeWidth={1.75} aria-hidden="true" />
                                                )}
                                                {testingConnection ? t('settings.whatsapp.testing') : t('settings.whatsapp.testConnection')}
                                            </button>
                                            <button type="button" onClick={getBusinessProfile} disabled={loadingProfile} className={BOTON_SECUNDARIO}>
                                                {loadingProfile ? (
                                                    <Loader2 className="size-[15px] animate-spin" aria-hidden="true" />
                                                ) : (
                                                    <Building2 className="size-[15px]" strokeWidth={1.75} aria-hidden="true" />
                                                )}
                                                {t('settings.whatsapp.businessProfile')}
                                            </button>
                                        </>
                                    )
                                }
                            />

                            {/* Resultado de "Probar conexión" (o del perfil, si falla): región viva siempre presente. */}
                            <div aria-live="polite">
                                {connectionStatus.type && (
                                    <Fila etiqueta={t('settings.whatsapp.testRowLabel')} ayuda={t('settings.whatsapp.testRowHelp')} abajo="pb-4 @3xl/hoja:pb-1.5">
                                        <p
                                            className={cn(
                                                'flex items-start gap-2 text-[13px] leading-[18px] font-medium',
                                                connectionStatus.type === 'success' ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'
                                            )}
                                        >
                                            {connectionStatus.type === 'success' ? (
                                                <CircleCheck className="mt-px size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                                            ) : (
                                                <CircleAlert className="mt-px size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                                            )}
                                            <span className="min-w-0 [overflow-wrap:anywhere]">{connectionStatus.message}</span>
                                        </p>
                                    </Fila>
                                )}
                            </div>

                            {businessProfile && (
                                <Fila etiqueta={t('settings.whatsapp.businessProfile')} ayuda={t('settings.whatsapp.profileRowHelp')} abajo="pb-4 @3xl/hoja:pb-[17px]">
                                    <dl className="grid grid-cols-2 gap-x-7 gap-y-3.5 @5xl/hoja:grid-cols-[1.5fr_1fr_1fr]">
                                        {dato(t('settings.whatsapp.profileName'), businessProfile.business_name)}
                                        {dato(t('settings.whatsapp.profilePhone'), businessProfile.phone_number, 'tabular-nums')}
                                        {dato(
                                            t('settings.whatsapp.profileVerification'),
                                            <span
                                                className={cn(
                                                    'flex h-5 items-center gap-1.5',
                                                    businessProfile.verified ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-neutral-300'
                                                )}
                                            >
                                                {businessProfile.verified ? (
                                                    <BadgeCheck className="size-[15px] shrink-0" strokeWidth={2} aria-hidden="true" />
                                                ) : (
                                                    <CircleAlert className="size-[15px] shrink-0" strokeWidth={2} aria-hidden="true" />
                                                )}
                                                {businessProfile.verified ? t('settings.whatsapp.verified') : t('settings.whatsapp.notVerified')}
                                            </span>
                                        )}
                                        {dato(t('settings.whatsapp.phoneId'), businessProfile.phone_number_id, MONO + ' text-[12.5px]')}
                                        {dato(t('settings.whatsapp.profileQuality'), businessProfile.quality_rating, MONO + ' text-[12.5px]')}
                                        {dato(t('settings.whatsapp.profileMessagingLimit'), businessProfile.messaging_limit, MONO + ' text-[12.5px]')}
                                    </dl>
                                </Fila>
                            )}

                            <Subgrupo titulo={t('settings.whatsapp.credentialsTitle')} texto={t('settings.whatsapp.credentialsSubtitle')} />

                            <Fila
                                etiqueta={t('settings.whatsapp.accessToken')}
                                htmlFor="whatsapp_token"
                                ayuda={t('settings.whatsapp.accessTokenHelp')}
                                ayudaId="whatsapp_token-help"
                                abajo={settings.whatsapp.token ? 'pb-3.5 @3xl/hoja:pb-1.5' : undefined}
                            >
                                <Campo
                                    id="whatsapp_token"
                                    icon={KeyRound}
                                    type="password"
                                    value={whatsappForm.data.whatsapp_token}
                                    onChange={(value) => whatsappForm.setData('whatsapp_token', value)}
                                    placeholder={settings.whatsapp.token ? t('settings.whatsapp.replaceTokenPlaceholder') : t('settings.whatsapp.accessTokenPlaceholder')}
                                    invalido={!!errors.whatsapp_token}
                                    describedBy={describir('whatsapp_token-help', errors.whatsapp_token && 'whatsapp_token-error', settings.whatsapp.token && 'whatsapp_token-saved')}
                                />
                                <InputError id="whatsapp_token-error" message={errors.whatsapp_token} className={ERROR_CAMPO} />
                                {settings.whatsapp.token && (
                                    <Guardado id="whatsapp_token-saved" etiqueta={t('settings.whatsapp.savedLabel')} preview={settings.whatsapp.token} conserva={conserva} />
                                )}
                            </Fila>

                            <Fila
                                etiqueta={t('settings.whatsapp.verifyToken')}
                                htmlFor="whatsapp_verify_token"
                                ayuda={t('settings.whatsapp.verifyTokenHelp')}
                                ayudaId="whatsapp_verify_token-help"
                                abajo={settings.whatsapp.verify_token ? 'pb-3.5 @3xl/hoja:pb-1.5' : undefined}
                            >
                                <Campo
                                    id="whatsapp_verify_token"
                                    icon={ShieldCheck}
                                    type="password"
                                    value={whatsappForm.data.whatsapp_verify_token}
                                    onChange={(value) => whatsappForm.setData('whatsapp_verify_token', value)}
                                    placeholder={
                                        settings.whatsapp.verify_token ? t('settings.whatsapp.replaceVerifyTokenPlaceholder') : t('settings.whatsapp.verifyTokenPlaceholder')
                                    }
                                    invalido={!!errors.whatsapp_verify_token}
                                    describedBy={describir(
                                        'whatsapp_verify_token-help',
                                        errors.whatsapp_verify_token && 'whatsapp_verify_token-error',
                                        settings.whatsapp.verify_token && 'whatsapp_verify_token-saved'
                                    )}
                                />
                                <InputError id="whatsapp_verify_token-error" message={errors.whatsapp_verify_token} className={ERROR_CAMPO} />
                                {settings.whatsapp.verify_token && (
                                    <Guardado
                                        id="whatsapp_verify_token-saved"
                                        etiqueta={t('settings.whatsapp.savedLabel')}
                                        preview={settings.whatsapp.verify_token}
                                        conserva={conserva}
                                    />
                                )}
                            </Fila>

                            <Subgrupo titulo={t('settings.whatsapp.identifiersTitle')} texto={t('settings.whatsapp.identifiersSubtitle')} />

                            <Fila etiqueta={t('settings.whatsapp.phoneId')} htmlFor="whatsapp_phone_id" ayuda={t('settings.whatsapp.idHelp')} ayudaId="whatsapp_phone_id-help">
                                <Campo
                                    id="whatsapp_phone_id"
                                    icon={Phone}
                                    mono
                                    corto
                                    value={whatsappForm.data.whatsapp_phone_id}
                                    onChange={(value) => whatsappForm.setData('whatsapp_phone_id', value)}
                                    placeholder={t('settings.whatsapp.phoneIdPlaceholder')}
                                    invalido={!!errors.whatsapp_phone_id}
                                    describedBy={describir('whatsapp_phone_id-help', errors.whatsapp_phone_id && 'whatsapp_phone_id-error')}
                                />
                                <InputError id="whatsapp_phone_id-error" message={errors.whatsapp_phone_id} className={ERROR_CAMPO} />
                            </Fila>

                            <Fila
                                etiqueta={t('settings.whatsapp.businessAccountId')}
                                htmlFor="whatsapp_business_account_id"
                                ayuda={t('settings.whatsapp.idHelp')}
                                ayudaId="whatsapp_business_account_id-help"
                            >
                                <Campo
                                    id="whatsapp_business_account_id"
                                    icon={Building2}
                                    mono
                                    corto
                                    value={whatsappForm.data.whatsapp_business_account_id}
                                    onChange={(value) => whatsappForm.setData('whatsapp_business_account_id', value)}
                                    placeholder={t('settings.whatsapp.businessAccountIdPlaceholder')}
                                    invalido={!!errors.whatsapp_business_account_id}
                                    describedBy={describir('whatsapp_business_account_id-help', errors.whatsapp_business_account_id && 'whatsapp_business_account_id-error')}
                                />
                                <InputError id="whatsapp_business_account_id-error" message={errors.whatsapp_business_account_id} className={ERROR_CAMPO} />
                            </Fila>

                            {settings.whatsapp.webhook_url && (
                                <Fila etiqueta={t('settings.whatsapp.webhookUrl')} ayuda={t('settings.whatsapp.webhookHelp')}>
                                    <div className="flex min-h-[38px] w-full max-w-[440px] items-center gap-2.5 rounded-[9px] bg-[#2e3f84]/[0.035] px-3 py-2.5 dark:bg-white/5">
                                        <Webhook className="size-[15px] shrink-0 text-muted-foreground dark:text-neutral-400" strokeWidth={1.75} aria-hidden="true" />
                                        <span className={cn(MONO, 'min-w-0 flex-1 text-[12.5px] leading-[18px] select-all [overflow-wrap:anywhere]', TEXTO_NAVY)}>
                                            {settings.whatsapp.webhook_url}
                                        </span>
                                        <span title={t('settings.readOnly')} className="flex shrink-0 text-muted-foreground dark:text-neutral-400">
                                            <Lock className="size-[13px]" strokeWidth={2} aria-hidden="true" />
                                            <span className="sr-only">{t('settings.readOnly')}</span>
                                        </span>
                                    </div>
                                </Fila>
                            )}

                            <Pie nota={t('settings.whatsapp.saveNote')}>
                                <Button type="submit" disabled={whatsappForm.processing} className={cn(BOTON_PRIMARIO, 'settings-btn-primary disabled:opacity-50')}>
                                    {botonGuardar(whatsappForm.processing, t('common.save'))}
                                </Button>
                            </Pie>
                        </form>

                        {/* ── 2. Transcripción y corrector (Groq) ── */}
                        <form onSubmit={handleGroqSubmit} aria-labelledby="settings-groq">
                            <Banda
                                id="settings-groq"
                                icon={AudioLines}
                                titulo={t('settings.groq.sectionTitle')}
                                estado={<Estado ok={settings.groq.is_configured} si={t('settings.active')} no={t('settings.pending')} />}
                                texto={t('settings.groq.sectionText')}
                            />

                            <Fila
                                etiqueta={t('settings.groq.apiKeyLabel')}
                                htmlFor="groq_api_key"
                                ayuda={t('settings.groq.apiKeyHelp')}
                                ayudaId="groq_api_key-help"
                                abajo={settings.groq.api_key ? 'pb-3.5 @3xl/hoja:pb-1.5' : undefined}
                            >
                                <Campo
                                    id="groq_api_key"
                                    icon={KeyRound}
                                    type="password"
                                    value={groqForm.data.groq_api_key}
                                    onChange={(value) => groqForm.setData('groq_api_key', value)}
                                    placeholder={settings.groq.api_key ? t('settings.groq.replaceApiKeyPlaceholder') : 'gsk_xxxxx...'}
                                    invalido={!!groqForm.errors.groq_api_key}
                                    describedBy={describir('groq_api_key-help', groqForm.errors.groq_api_key && 'groq_api_key-error', settings.groq.api_key && 'groq_api_key-saved')}
                                />
                                <InputError id="groq_api_key-error" message={groqForm.errors.groq_api_key} className={ERROR_CAMPO} />
                                {settings.groq.api_key && (
                                    <Guardado id="groq_api_key-saved" etiqueta={t('settings.groq.savedLabel')} preview={settings.groq.api_key} conserva={conserva} />
                                )}
                            </Fila>

                            <Pie nota={groqKeyEmpty ? t('settings.groq.enableNote') : undefined}>
                                <Button
                                    type="submit"
                                    disabled={groqForm.processing || !groqForm.data.groq_api_key}
                                    className={cn(BOTON_PRIMARIO, groqKeyEmpty ? BOTON_APAGADO : 'settings-btn-primary disabled:opacity-50')}
                                >
                                    {botonGuardar(groqForm.processing, t('settings.saveConfiguration'))}
                                </Button>
                            </Pie>
                        </form>

                        {/* ── 3. Asesores de turno ── */}
                        <section aria-labelledby="settings-duty">
                            <Banda
                                id="settings-duty"
                                icon={Users}
                                titulo={t('settings.onDutyAdvisors.title')}
                                estado={
                                    <Estado
                                        ok={selectedAdvisors.length > 0}
                                        si={t('settings.onDutyAdvisors.onDutyCount', { count: selectedAdvisors.length })}
                                        no={t('settings.onDutyAdvisors.noneSelected')}
                                    />
                                }
                                texto={t('settings.onDutyAdvisors.bandText')}
                            />

                            <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-2.5 border-b py-3 @3xl/hoja:h-[60px] @3xl/hoja:flex-nowrap @3xl/hoja:py-0', SANGRIA, FILETE)}>
                                <div className="relative w-full @3xl/hoja:w-[320px] @3xl/hoja:shrink-0">
                                    <label htmlFor="advisor-search" className="sr-only">
                                        {t('settings.onDutyAdvisors.searchLabel')}
                                    </label>
                                    <Search
                                        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground dark:text-neutral-400"
                                        strokeWidth={1.75}
                                        aria-hidden="true"
                                    />
                                    <input
                                        id="advisor-search"
                                        name="advisor-search"
                                        type="text"
                                        value={advisorSearch}
                                        onChange={(event) => setAdvisorSearch(event.target.value)}
                                        placeholder={t('settings.onDutyAdvisors.searchPlaceholder')}
                                        className={cn(
                                            'h-9 w-full rounded-[10px] bg-[#2e3f84]/[0.035] pr-9 pl-[38px] text-[13px] leading-[18px] text-foreground shadow-[inset_0_0_0_1px_rgba(46,63,132,0.1)] transition-shadow placeholder:text-muted-foreground dark:bg-white/5 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] dark:placeholder:text-neutral-400',
                                            FOCO
                                        )}
                                    />
                                    {advisorSearch && (
                                        <button
                                            type="button"
                                            onClick={() => setAdvisorSearch('')}
                                            className={cn(
                                                'absolute top-1/2 right-2 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-[#2e3f84]/8 hover:text-[#2e3f84] dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-neutral-100',
                                                FOCO
                                            )}
                                            aria-label={t('common.clearSearch')}
                                            title={t('common.clearSearch')}
                                        >
                                            <X className="size-3.5" aria-hidden="true" />
                                        </button>
                                    )}
                                </div>

                                {advisorCount > 0 && (
                                    <span className="ml-auto text-[12.5px] leading-4 whitespace-nowrap text-muted-foreground tabular-nums" aria-live="polite">
                                        <Trans
                                            i18nKey="settings.onDutyAdvisors.selectedOfTotal"
                                            values={{ selected: selectedAdvisors.length, total: advisorCount }}
                                            components={{ strong: <span className={cn('font-semibold', TEXTO_NAVY)} /> }}
                                        />
                                    </span>
                                )}
                            </div>

                            {advisorCount === 0 ? (
                                <div className="px-4 py-12 text-center">
                                    <Users className="mx-auto mb-3 size-9 text-muted-foreground dark:text-neutral-400" strokeWidth={1.5} aria-hidden="true" />
                                    <p className={cn('text-[15px] leading-5 font-semibold', TEXTO_NAVY)}>{t('settings.onDutyAdvisors.emptyTitle')}</p>
                                    <p className={cn('mt-1 text-[13px] leading-[18px]', TEXTO_SUAVE)}>{t('settings.onDutyAdvisors.emptyDescription')}</p>
                                </div>
                            ) : (
                                <>
                                    {advisorsInOrder.length === 0 ? (
                                        <div className={cn('border-b py-3', SANGRIA, FILETE)}>
                                            <p
                                                className={cn(
                                                    'rounded-xl border border-dashed border-[#2e3f84]/15 px-4 py-7 text-center text-[13px] leading-[18px] dark:border-white/12',
                                                    TEXTO_SUAVE
                                                )}
                                            >
                                                {t('settings.onDutyAdvisors.noResults')}
                                            </p>
                                        </div>
                                    ) : (
                                        // Orden alfabético por columnas (hacia abajo y luego a la derecha): 3, 2 o 1
                                        // columnas según el ancho de la hoja; las filas se calculan para cada caso.
                                        <ul
                                            style={filas}
                                            className={cn(
                                                'grid grid-flow-col grid-cols-1 grid-rows-[repeat(var(--filas),minmax(52px,auto))] gap-x-4 gap-y-1 border-b px-1 py-3 [--filas:var(--f1)] @2xl/hoja:grid-cols-2 @2xl/hoja:[--filas:var(--f2)] @3xl/hoja:pr-5 @3xl/hoja:pl-[52px] @4xl/hoja:grid-cols-3 @4xl/hoja:[--filas:var(--f3)]',
                                                FILETE
                                            )}
                                        >
                                            {advisorsInOrder.map((advisor) => {
                                                const selected = selectedAdvisors.includes(advisor.id);

                                                return (
                                                    <li key={advisor.id} className="min-w-0">
                                                        <label
                                                            className={cn(
                                                                'relative flex h-full min-h-[52px] min-w-0 cursor-pointer items-center gap-3 rounded-[10px] px-3 transition-colors',
                                                                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#2e3f84]/40 dark:has-[:focus-visible]:ring-[#8b9ae0]/60',
                                                                selected
                                                                    ? 'bg-[#2e3f84]/[0.045] dark:bg-white/[0.06]'
                                                                    : 'hover:bg-[#2e3f84]/[0.025] dark:hover:bg-white/[0.03]'
                                                            )}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                className="sr-only"
                                                                checked={selected}
                                                                onChange={() => toggleAdvisor(advisor.id)}
                                                            />
                                                            {/* Casilla: marcada navy con visto blanco; vacía con contorno pizarra 500 (4,76:1). */}
                                                            <span
                                                                className={cn(
                                                                    'flex size-[18px] shrink-0 items-center justify-center rounded-[5px]',
                                                                    selected
                                                                        ? 'bg-[#2e3f84] text-white dark:bg-[#596bcf]'
                                                                        : 'bg-white shadow-[inset_0_0_0_1.5px_var(--color-slate-500)] dark:bg-transparent dark:shadow-[inset_0_0_0_1.5px_var(--color-neutral-400)]'
                                                                )}
                                                                aria-hidden="true"
                                                            >
                                                                {selected && <Check className="size-3" strokeWidth={3} />}
                                                            </span>
                                                            <Iniciales name={advisor.name} className="size-[30px]" />
                                                            <span className="flex min-w-0 flex-col gap-px">
                                                                <span className={cn('truncate text-[13px] leading-[18px] font-semibold', TEXTO_NAVY)}>
                                                                    {nombrePropio(advisor.name)}
                                                                </span>
                                                                <span className={cn('truncate text-[12px] leading-4', TEXTO_SUAVE)}>{advisor.email}</span>
                                                            </span>
                                                        </label>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}

                                    <Pie columna={false} final nota={t('settings.onDutyAdvisors.saveNote')}>
                                        <Button
                                            type="button"
                                            onClick={saveOnDutyAdvisors}
                                            disabled={savingAdvisors}
                                            className={cn(BOTON_PRIMARIO, 'settings-btn-primary disabled:opacity-50')}
                                        >
                                            {botonGuardar(savingAdvisors, t('common.saveChanges'))}
                                        </Button>
                                    </Pie>
                                </>
                            )}
                        </section>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
