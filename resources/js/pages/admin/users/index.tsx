import { Head, router, useForm, usePage } from '@inertiajs/react';
import AdminLayout from '@/layouts/admin-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { AvisoCampo, useAvisosCampo } from '@/components/avisos-campo';
import InputError from '@/components/input-error';
import { cn } from '@/lib/utils';
import { iniciales, nombrePropio } from '@/lib/nombres';
import { plano } from '@/lib/texto';
import {
    Check,
    Clock,
    Copy,
    Edit3,
    Ellipsis,
    Eye,
    EyeOff,
    Headphones,
    KeyRound,
    Loader2,
    Mail,
    Search,
    Send,
    ShieldCheck,
    Sparkles,
    Trash2,
    UserCircle,
    UserPlus,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { toast } from '@/lib/toast';
import axios from 'axios';

interface User {
    id: number;
    name: string;
    email: string;
    role: 'admin' | 'advisor';
    can_bulk_send: boolean;
    is_on_duty?: boolean;
    created_at: string;
    is_online: boolean;
    online_status: 'online' | 'offline' | 'never';
    last_activity_at: string | null;
    /** Chats abiertos asignados a esta persona (quedan sin asignar si se elimina). */
    chats_abiertos?: number;
    /** Plantillas no globales que creó: User::booted() las borra con la cuenta (también si las asignó a otros). */
    plantillas_propias?: number;
}

interface UsersIndexProps {
    users: User[];
}

interface UserFormData {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    role: User['role'];
}

type RoleFilter = 'all' | User['role'];

/**
 * Contraseña aleatoria que cumple Password::defaults() (5+ caracteres, letras y números): 12
 * caracteres sin los que se confunden al dictarla (0/O, 1/l/I).
 */
function generarClave(largo = 12) {
    const letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
    const numeros = '23456789';
    const todos = letras + numeros;
    const azar = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
    const caracteres = [letras[azar(letras.length)], numeros[azar(numeros.length)]];
    while (caracteres.length < largo) caracteres.push(todos[azar(todos.length)]);
    for (let i = caracteres.length - 1; i > 0; i--) {
        const j = azar(i + 1);
        [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
    }
    return caracteres.join('');
}

/** Copiar al portapapeles también por http (la red interna no tiene https: navigator.clipboard no existe). */
async function copiarTexto(texto: string): Promise<boolean> {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(texto);
            return true;
        }
    } catch {
        // se intenta a la antigua
    }
    const area = document.createElement('textarea');
    area.value = texto;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
        ok = document.execCommand('copy');
    } catch {
        ok = false;
    }
    area.remove();
    return ok;
}

/** Requisitos de la contraseña, marcándose mientras se escribe (y si las dos coinciden). */
function ReglasClave({ clave, confirmacion, textos }: { clave: string; confirmacion: string; textos: { largo: string; letras: string; numeros: string; coinciden: string } }) {
    const reglas: [boolean, string][] = [
        [clave.length >= 5, textos.largo],
        [/\p{L}/u.test(clave), textos.letras],
        [/\d/.test(clave), textos.numeros],
        [clave !== '' && clave === confirmacion, textos.coinciden],
    ];

    return (
        <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1.5 p-0 text-[12.5px]">
            {reglas.map(([cumple, texto]) => (
                <li key={texto} className={cn('flex items-center gap-1.5', cumple ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground')}>
                    {cumple ? (
                        <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                    ) : (
                        <span aria-hidden="true" className="size-3.5 rounded-full border-[1.5px] border-[#c3c7da] dark:border-white/25" />
                    )}
                    {texto}
                </li>
            ))}
        </ul>
    );
}

/* ── Tintas de la vista (design/vista-usuarios/gen_vista.mjs) ──────────────────────────────────────
   Todo es navy #2e3f84 con alfa sobre la hoja blanca; en oscuro, blanco con alfa sobre bg-card. */
const FILETE = 'border-[#2e3f84]/8 dark:border-white/8';
const TEXTO_NAVY = 'text-[#2e3f84] dark:text-neutral-100';
// Nombres de columna y opciones inactivas: en oscuro el muted-foreground no llega a 4,5:1 sobre la
// banda tintada (4,45:1), así que ahí suben a neutral-400 (5,85:1).
const TEXTO_SUAVE = 'text-muted-foreground dark:text-neutral-400';
// Foco: el contorno global de la app (navy sólido de 2 px con separación, app.css). Antes era un anillo
// navy al 40 % (2,1:1 contra la hoja, por debajo de 3:1) que además apagaba el global con outline-none.
const FOCO = 'focus-visible:outline-offset-2';
// Con puntero táctil (pointer-coarse:) los controles suben a 40–44 px y los campos a 16 px de letra: con menos,
// iOS acerca la página al enfocarlos. Con ratón todo queda como el diseño.

// Columnas de la lista. Medio (hoja ≥ 768 px): compactas. Ancho (hoja ≥ 1024 px): las del diseño.
// Por debajo de 768 px de hoja, cada persona es una tarjeta apilada (otra plantilla).
// Solo la plantilla: quien la usa decide cuándo es grid (desde @3xl/hoja).
const COLUMNAS =
    'grid-cols-[minmax(0,1fr)_120px_136px_96px_88px_64px] items-center gap-x-4 @3xl/hoja:px-5 @5xl/hoja:grid-cols-[minmax(0,1fr)_184px_172px_120px_116px_68px] @5xl/hoja:gap-x-6';

// Fondo de fila en una variable: el aro del punto de presencia lleva el MISMO color que su fila
// (en reposo, al pasar el ratón o con el menú "…" abierto), así nunca asoma un anillo blanco.
const FONDO_FILA =
    'bg-[color:var(--fila)] [--fila:var(--color-card)] hover:[--fila:color-mix(in_srgb,var(--color-card),#2e3f84_3.5%)] has-[[aria-expanded=true]]:[--fila:color-mix(in_srgb,var(--color-card),#2e3f84_3.5%)] dark:hover:[--fila:color-mix(in_srgb,var(--color-card),white_3%)] dark:has-[[aria-expanded=true]]:[--fila:color-mix(in_srgb,var(--color-card),white_3%)]';

/* ── Piezas ─────────────────────────────────────────────────────────────────────────────────────── */

/** Avatar de iniciales: navy sólido para administradores, tinta navy para asesores. */
function Avatar({ user, size = 32, className }: { user: User; size?: 28 | 32; className?: string }) {
    const admin = user.role === 'admin';

    return (
        <span
            className={cn(
                'flex shrink-0 items-center justify-center rounded-full font-semibold leading-none tracking-[0.02em]',
                size === 32 ? 'size-8 text-[12px]' : 'size-7 text-[11px]',
                admin
                    ? 'bg-[#2e3f84] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] dark:bg-[#4e5fa4]'
                    : 'bg-[#2e3f84]/10 text-[#2e3f84] shadow-[inset_0_0_0_1px_rgba(46,63,132,0.06)] dark:bg-white/8 dark:text-neutral-200 dark:shadow-none',
                className
            )}
            aria-hidden="true"
        >
            {iniciales(user.name)}
        </span>
    );
}

/** Avatar con el punto de presencia (esmeralda 600: 3,67:1 contra la hoja). */
function AvatarPresencia({ user }: { user: User }) {
    return (
        <span className="relative shrink-0">
            <Avatar user={user} />
            {user.is_online && (
                <span className="absolute -right-[3px] -bottom-[3px] size-[11px] rounded-full bg-emerald-600 ring-2 ring-[color:var(--fila)] dark:bg-emerald-500" />
            )}
        </span>
    );
}

function PuntoEstado({ online }: { online: boolean }) {
    return (
        <span
            className={cn('size-2 shrink-0 rounded-full', online ? 'bg-emerald-600 dark:bg-emerald-500' : 'bg-slate-500 dark:bg-neutral-500')}
            aria-hidden="true"
        />
    );
}

/** Rol: etiqueta tintada, sin borde duro. */
/** El rol y, si es un asesor de turno, la etiqueta «De turno» (antes no se veía en ningún lado). */
function RolYTurno({ user, etiqueta, turno }: { user: User; etiqueta: string; turno: string }) {
    return (
        <span className="flex flex-wrap items-center gap-1.5">
            <RolePill role={user.role} label={etiqueta} />
            {user.role === 'advisor' && user.is_on_duty && (
                <span className="inline-flex h-6 items-center gap-1 rounded-[7px] bg-emerald-50 pr-2 pl-1.5 text-[12px] leading-4 font-semibold whitespace-nowrap text-emerald-800 shadow-[inset_0_0_0_1px_var(--color-emerald-200)] dark:bg-emerald-500/10 dark:text-emerald-300 dark:shadow-[inset_0_0_0_1px_rgba(16,185,129,0.25)]">
                    <Clock className="size-3.5" strokeWidth={2} aria-hidden="true" />
                    {turno}
                </span>
            )}
        </span>
    );
}

function RolePill({ role, label }: { role: User['role']; label: string }) {
    const admin = role === 'admin';
    const Icono = admin ? ShieldCheck : Headphones;

    return (
        <span
            className={cn(
                'inline-flex h-6 items-center gap-1.5 rounded-[7px] pr-[9px] pl-[7px] text-[12px] leading-4 font-semibold whitespace-nowrap',
                admin
                    ? 'bg-[#2e3f84]/7 text-[#2e3f84] shadow-[inset_0_0_0_1px_rgba(46,63,132,0.14)] dark:bg-white/6 dark:text-neutral-100 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]'
                    : 'bg-sky-50 text-sky-700 shadow-[inset_0_0_0_1px_var(--color-sky-200)] dark:bg-sky-500/10 dark:text-sky-300 dark:shadow-[inset_0_0_0_1px_rgba(14,165,233,0.25)]'
            )}
        >
            <Icono className="size-3.5" strokeWidth={2} aria-hidden="true" />
            {label}
        </span>
    );
}

/**
 * Interruptor de envío masivo (solo en esta vista). Encendido: pista navy y bolita blanca con la
 * marca. Apagado: pista con contorno pizarra 500 y bolita pizarra 500 (4,76:1): se distingue sin color.
 */
function InterruptorEnvio({
    activo,
    nombre,
    pista,
    ocupado,
    onToggle,
}: {
    activo: boolean;
    /** Nombre accesible fijo («Envío masivo de Luisa»): el estado lo dice aria-checked. */
    nombre: string;
    /** Lo que hará al pulsarlo (tooltip). */
    pista: string;
    ocupado: boolean;
    onToggle: () => void;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={activo}
            aria-label={nombre}
            aria-busy={ocupado || undefined}
            aria-disabled={ocupado || undefined}
            title={pista}
            onClick={() => !ocupado && onToggle()}
            className={cn(
                'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-[background-color,opacity] duration-200 aria-disabled:cursor-wait aria-disabled:opacity-60',
                // Con el dedo, 20 × 36 px es poco: un área invisible de 12 px alrededor (44 × 60 px).
                'pointer-coarse:after:absolute pointer-coarse:after:-inset-3',
                FOCO,
                activo
                    ? 'bg-[#2e3f84] shadow-[inset_0_1px_1px_rgba(0,0,0,0.2)] dark:bg-[#596bcf]'
                    : 'bg-card shadow-[inset_0_0_0_1.5px_var(--color-slate-500)] dark:shadow-[inset_0_0_0_1.5px_var(--color-neutral-400)]'
            )}
        >
            <span
                className={cn(
                    'absolute flex items-center justify-center rounded-full transition-all duration-200',
                    activo
                        ? 'top-0.5 left-[18px] size-4 bg-white text-[#2e3f84] shadow-[0_1px_2px_rgba(0,0,0,0.28)]'
                        : 'top-[5px] left-[5px] size-2.5 bg-slate-500 dark:bg-neutral-400'
                )}
                aria-hidden="true"
            >
                {activo && <Check className="size-2.5" strokeWidth={3.5} />}
            </span>
        </button>
    );
}

const BOTON_FANTASMA = cn(
    'flex size-[30px] shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-[#2e3f84]/8 hover:text-[#2e3f84] pointer-coarse:size-10 dark:text-neutral-400 dark:hover:bg-white/8 dark:hover:text-neutral-100',
    'aria-expanded:bg-[#2e3f84]/8 aria-expanded:text-[#2e3f84] aria-expanded:shadow-[inset_0_0_0_1px_rgba(46,63,132,0.1)] dark:aria-expanded:bg-white/8 dark:aria-expanded:text-neutral-100 dark:aria-expanded:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]',
    FOCO
);

/**
 * Lápiz (Editar) + menú "…" con Editar, Restablecer contraseña y Eliminar. Cada acción recibe el botón
 * de la fila desde el que se abrió, para devolverle el foco al cerrar la ventana.
 */
function Acciones({
    etiquetas,
    userId,
    nombre,
    puedeEliminar,
    onEdit,
    onResetPassword,
    onDelete,
}: {
    etiquetas: { edit: string; delete: string; more: string; reset: string };
    userId: number;
    nombre: string;
    /** No en la propia fila: el servidor no deja eliminarse a uno mismo. */
    puedeEliminar: boolean;
    onEdit: (origen: HTMLElement | null) => void;
    onResetPassword: (origen: HTMLElement | null) => void;
    onDelete: (origen: HTMLElement | null) => void;
}) {
    const { t } = useTranslation();
    const disparador = useRef<HTMLButtonElement>(null);

    return (
        <div className="flex items-center justify-end gap-1" data-acciones={userId}>
            <button
                type="button"
                data-accion="editar"
                // Repite «Editar» del menú «…»: fuera del orden de Tab para no sumar 16 paradas a la lista.
                tabIndex={-1}
                onClick={(event) => onEdit(event.currentTarget)}
                className={BOTON_FANTASMA}
                title={etiquetas.edit}
                aria-label={t('users.editFor', { name: nombre })}
            >
                <Edit3 className="size-4" strokeWidth={1.75} aria-hidden="true" />
            </button>
            {/* modal={false}: el menú abre un Dialog de Radix; en modo modal los dos se pisan el
                bloqueo del body y la página se quedaba sin clics al cerrar el diálogo. */}
            <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                    <button ref={disparador} type="button" data-accion="mas" className={BOTON_FANTASMA} title={etiquetas.more} aria-label={t('users.moreActionsFor', { name: nombre })}>
                        <Ellipsis className="size-4" strokeWidth={1.75} aria-hidden="true" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="end"
                    sideOffset={4}
                    className="flex w-[216px] flex-col gap-0.5 rounded-xl border-0 bg-white p-1 shadow-[0_0_0_1px_rgba(46,63,132,0.1),0_2px_4px_rgba(46,63,132,0.06),0_12px_28px_-12px_rgba(46,63,132,0.3)] dark:bg-popover dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_12px_28px_-12px_rgba(0,0,0,0.7)]"
                >
                    <DropdownMenuItem
                        onSelect={() => onEdit(disparador.current)}
                        className="h-[30px] cursor-pointer gap-2.5 rounded-lg px-2.5 py-0 pointer-coarse:h-11 text-[13px] leading-[18px] font-medium text-[#2e3f84] focus:bg-[#2e3f84]/6 focus:text-[#2e3f84] dark:text-neutral-100 dark:focus:bg-white/8 dark:focus:text-neutral-100"
                    >
                        <Edit3 className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
                        {etiquetas.edit}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onSelect={() => onResetPassword(disparador.current)}
                        className="h-[30px] cursor-pointer gap-2.5 rounded-lg px-2.5 py-0 pointer-coarse:h-11 text-[13px] leading-[18px] font-medium text-[#2e3f84] focus:bg-[#2e3f84]/6 focus:text-[#2e3f84] dark:text-neutral-100 dark:focus:bg-white/8 dark:focus:text-neutral-100"
                    >
                        <KeyRound className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
                        {etiquetas.reset}
                    </DropdownMenuItem>
                    {puedeEliminar && (
                        <>
                    <DropdownMenuSeparator className="mx-1.5 my-0 bg-[#2e3f84]/8 dark:bg-white/8" />
                    <DropdownMenuItem
                        onSelect={() => onDelete(disparador.current)}
                        className="h-[30px] cursor-pointer gap-2.5 rounded-lg px-2.5 py-0 pointer-coarse:h-11 text-[13px] leading-[18px] font-medium text-red-600 focus:bg-red-50 focus:text-red-700 dark:text-red-400 dark:focus:bg-red-500/10 dark:focus:text-red-300"
                    >
                        <Trash2 className="size-4 text-red-600 dark:text-red-400" strokeWidth={1.75} aria-hidden="true" />
                        {etiquetas.delete}
                    </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

// Nombres de columna de las bandas.
const Th = ({ children, className }: { children: ReactNode; className?: string }) => (
    <span className={cn('truncate text-[11px] leading-4 font-semibold tracking-[0.07em] uppercase', TEXTO_SUAVE, className)}>{children}</span>
);

export default function UsersIndex({ users }: UsersIndexProps) {
    const { t, i18n } = useTranslation();
    // Quien está usando la página: no ve «Eliminar» en su fila ni puede cambiar su propio rol.
    const yoId = usePage<{ auth: { user: { id: number } | null } }>().props.auth.user?.id;

    /**
     * Las ventanas se abren por estado (sin un Trigger de Radix), así que al cerrarlas el foco caía al
     * principio de la página. Se recuerda el botón de origen y se le devuelve; si ya no existe o no se ve
     * (fila eliminada, la otra variante de la fila), va al buscador.
     */
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [abiertoBorrar, setAbiertoBorrar] = useState(false);
    const [eliminando, setEliminando] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [userToEdit, setUserToEdit] = useState<User | null>(null);
    // La ventana de edición abierta desde «Restablecer contraseña»: título, explicación y botón hablan de la clave.
    const [modoClave, setModoClave] = useState(false);

    const origenFoco = useRef<{ el: HTMLElement | null; userId?: number; vecino?: number } | null>(null);
    const recordarOrigen = (origen: HTMLElement | null, userId?: number, vecino?: number) => {
        origenFoco.current = {
            el: origen ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null),
            userId,
            vecino,
        };
    };
    const devolverFoco = (event: Event) => {
        event.preventDefault();
        const origen = origenFoco.current;
        origenFoco.current = null;
        const visible = (el: Element | null | undefined): el is HTMLElement =>
            el instanceof HTMLElement && el.isConnected && el.getClientRects().length > 0;
        // De las dos variantes de cada fila (escritorio / celular) solo una se ve.
        const boton = (id: number | undefined, accion: string | undefined) =>
            id === undefined ? undefined : [...document.querySelectorAll(`[data-acciones="${id}"] [data-accion="${accion ?? 'mas'}"]`)].find(visible);
        const destino =
            (visible(origen?.el) ? origen?.el : undefined) ??
            boton(origen?.userId, origen?.el?.getAttribute('data-accion') ?? undefined) ??
            boton(origen?.vecino, 'mas');
        if (destino) destino.focus();
        else document.getElementById('user-search')?.focus({ preventScroll: true });
    };

    /**
     * Envíos de esta página (crear, editar, eliminar, envío masivo): si el servidor responde con su página
     * de error (500, 419, 429, 503) o no hay red, Inertia abría su ventana en inglés. Se cancela y se avisa
     * con un toast propio, como en Configuración. El sondeo de presencia no cuenta.
     */
    const enviando = useRef(0);
    const alEmpezarEnvio = () => {
        enviando.current += 1;
    };
    const alTerminarEnvio = () => {
        enviando.current = Math.max(0, enviando.current - 1);
    };
    useEffect(() => {
        const offInvalid = router.on('invalid', (event) => {
            if (enviando.current === 0) return;
            event.preventDefault();
            const status = event.detail.response.status;
            if (status === 404) {
                toast.error(t('users.toastGone'));
                setAbiertoBorrar(false);
                setShowEditModal(false);
                router.reload({ only: ['users'] });
                return;
            }
            if (status === 419) axios.get('/csrf-refresh').catch(() => {});
            toast.error(
                t(status === 419 ? 'fallasEnvio.expired' : status === 429 ? 'settings.saveTooMany' : status === 503 ? 'fallasEnvio.maintenance' : 'fallasEnvio.server')
            );
        });
        const offException = router.on('exception', (event) => {
            if (enviando.current === 0) return;
            event.preventDefault();
            toast.error(t('fallasEnvio.offline'));
        });
        return () => {
            offInvalid();
            offException();
        };
    }, [t]);
    const [search, setSearch] = useState('');

    // Teclado: «/» lleva al buscador, salvo que ya se esté escribiendo en un campo o haya una ventana o menú abierto.
    useEffect(() => {
        const alTeclear = (event: KeyboardEvent) => {
            if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
            const origen = event.target instanceof HTMLElement ? event.target : null;
            if (origen?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"]')) return;
            if (document.querySelector('[role="dialog"], [role="menu"]')) return;
            const buscador = document.getElementById('user-search');
            if (!buscador) return;
            event.preventDefault();
            buscador.focus();
        };
        document.addEventListener('keydown', alTeclear);
        return () => document.removeEventListener('keydown', alTeclear);
    }, []);
    const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');

    /**
     * Refresco del estado de conexión.
     *
     * is_online se calcula en el servidor (actividad en los últimos 5 minutos), así que sin
     * esto la lista mostraría siempre la foto del momento en que se abrió la página y el
     * orden "conectados primero" quedaría congelado.
     *
     * Cada 30 s basta de sobra para una ventana de 5 minutos, y sólo con la pestaña visible:
     * este servidor ya ha tenido problemas de agotamiento de sockets por sondeos simultáneos.
     * Es una recarga parcial (sólo la prop 'users') y conserva búsqueda, filtro y scroll.
     */
    useEffect(() => {
        let ultimo = Date.now();
        let enVuelo = false;

        const refrescar = () => {
            if (document.hidden || enVuelo) return;
            // 'focus' y 'visibilitychange' llegan casi juntos al volver a la pestaña;
            // sin esta guarda se lanzarían dos recargas seguidas.
            if (Date.now() - ultimo < 5000) return;

            enVuelo = true;
            ultimo = Date.now();
            router.reload({
                only: ['users'],
                onFinish: () => {
                    enVuelo = false;
                },
            });
        };

        const id = setInterval(refrescar, 30000);
        document.addEventListener('visibilitychange', refrescar);
        // 'focus' además de 'visibilitychange': si el usuario se va a OTRA APLICACIÓN
        // (no a otra pestaña), Chrome sigue teniendo la pestaña por visible y
        // visibilitychange no llega nunca — pero congela los temporizadores de las
        // ventanas en segundo plano. Sin esto había que recargar a mano para ver
        // quién estaba conectado, que es justo lo que se reportó.
        window.addEventListener('focus', refrescar);

        return () => {
            clearInterval(id);
            document.removeEventListener('visibilitychange', refrescar);
            window.removeEventListener('focus', refrescar);
        };
    }, []);

    const createForm = useForm<UserFormData>({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        role: 'advisor',
    });

    const editForm = useForm<UserFormData>({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        role: 'advisor',
    });

    // Contraseña visible (al generarla se muestra para poder copiarla) y avisos flotantes propios.
    const [verClaveCrear, setVerClaveCrear] = useState(false);
    const [verClaveEditar, setVerClaveEditar] = useState(false);
    const [generadaCrear, setGeneradaCrear] = useState(false);
    const [generadaEditar, setGeneradaEditar] = useState(false);
    const textosCampos = {
        name: { vacio: t('users.errorName') },
        email: { vacio: t('users.errorEmail'), formato: t('users.errorEmailFormat') },
        password: { vacio: t('users.errorPassword') },
        password_confirmation: { vacio: t('users.errorConfirm') },
    };
    const avisosCrear = useAvisosCampo(textosCampos);
    const avisosEditar = useAvisosCampo(textosCampos);
    const textosReglas = {
        largo: t('perfilCarnet.ruleLength'),
        letras: t('perfilCarnet.ruleLetters'),
        numeros: t('perfilCarnet.ruleNumbers'),
        coinciden: t('users.ruleMatch'),
    };
    const copiarClave = async (clave: string) => {
        if (await copiarTexto(clave)) toast.success(t('users.passwordCopied'));
        else toast.error(t('users.copyFailed'));
    };

    const stats = useMemo(() => {
        const admins = users.filter((user) => user.role === 'admin').length;
        const advisors = users.filter((user) => user.role === 'advisor').length;
        const bulkEnabled = users.filter((user) => user.role === 'advisor' && user.can_bulk_send).length;

        return { admins, advisors, bulkEnabled };
    }, [users]);

    const filteredUsers = useMemo(() => {
        const searchTerm = plano(search.trim());

        const visibles = users.filter((user) => {
            const matchesSearch = !searchTerm || plano(`${user.name} ${user.email}`).includes(searchTerm);
            const matchesRole = roleFilter === 'all' || user.role === roleFilter;

            return matchesSearch && matchesRole;
        });

        // Los conectados arriba, en el orden que manda el servidor (Array.sort es estable):
        // ordenarlos por última actividad haría saltar las filas cada vez que alguien hace algo.
        // Los desconectados, del que se conectó más recientemente al que hace más tiempo (su
        // última actividad ya no cambia); los que nunca han entrado, al final.
        const ultimaVez = (user: User) => (user.last_activity_at ? Date.parse(user.last_activity_at) || 0 : 0);
        return visibles.sort((a, b) => Number(b.is_online) - Number(a.is_online) || (a.is_online ? 0 : ultimaVez(b) - ultimaVez(a)));
    }, [roleFilter, search, users]);

    // Las dos bandas de la lista: primero los que están, luego el resto (mismo orden de arriba).
    const groups = useMemo(
        () =>
            [
                { online: true, users: filteredUsers.filter((user) => user.is_online) },
                { online: false, users: filteredUsers.filter((user) => !user.is_online) },
            ].filter((group) => group.users.length > 0),
        [filteredUsers]
    );

    // ¿Hay búsqueda o filtro de rol? Cambian el recuento («3 de 16 usuarios») y el mensaje de lista vacía.
    const busqueda = search.trim();
    const filtrando = busqueda !== '' || roleFilter !== 'all';
    const quitarFiltros = () => {
        setSearch('');
        setRoleFilter('all');
        // El botón desaparece con la lista vacía: el foco va al buscador, no al principio de la página.
        document.getElementById('user-search')?.focus({ preventScroll: true });
    };

    // Cada opción lleva cuántos hay (antes eran tres cifras grandes de la franja de arriba).
    const roleOptions: { value: RoleFilter; label: string; count: number }[] = [
        { value: 'all', label: t('common.all'), count: users.length },
        { value: 'admin', label: t('users.roleFilter.admins'), count: stats.admins },
        { value: 'advisor', label: t('users.roleFilter.advisors'), count: stats.advisors },
    ];

    const getRoleLabel = (role: User['role']) => {
        return role === 'admin' ? t('users.roles.admin') : t('users.roles.advisor');
    };

    // Fechas en el idioma de la interfaz, como en el resto de la app (antes siempre es-ES, también en inglés).
    const enIngles = i18n.language?.startsWith('en');

    /** «5 nov 2026» (sin el año si es de este año); en inglés, «Nov 5, 2026». */
    const fechaCorta = (fecha: Date, conAnio = fecha.getFullYear() !== new Date().getFullYear()) => {
        const opciones: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', ...(conAnio ? { year: 'numeric' } : {}) };
        if (enIngles) return fecha.toLocaleDateString('en-US', opciones);
        // es-CO escribe «5 de nov. de 2026»; en columnas estrechas queda «5 nov 2026».
        return new Intl.DateTimeFormat('es-CO', opciones)
            .formatToParts(fecha)
            .filter((parte) => parte.type !== 'literal')
            .map((parte) => parte.value.replace(/\.$/, ''))
            .join(' ');
    };

    /** Fecha y hora completas, para el tooltip: «5 de noviembre de 2026, 5:40 p. m.». */
    const fechaLarga = (fecha: Date) =>
        fecha.toLocaleString(enIngles ? 'en-US' : 'es-CO', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' });

    /** Cuánto hace: «Justo ahora», «Hace 26 min», «Hace 3 h», «Ayer», «Hace 3 días», «5 nov». */
    const haceCuanto = (fecha: Date) => {
        const minutos = Math.floor((Date.now() - fecha.getTime()) / 60000);
        if (minutos < 1) return t('users.justNow');
        if (minutos < 60) return t('users.minutesAgo', { count: minutos });
        const horas = Math.floor(minutos / 60);
        if (horas < 24) return t('users.hoursAgo', { count: horas });
        const dias = Math.floor(horas / 24);
        if (dias === 1) return t('users.yesterday');
        if (dias < 7) return t('users.daysAgo', { count: dias });
        return fechaCorta(fecha);
    };

    /**
     * La columna Estado. En línea: «En línea» y hace cuánto fue su última actividad (antes, «Justo ahora» para
     * todos). Desconectado: solo hace cuánto (la banda ya dice «Desconectados»; antes repetía «Desconectado» en
     * cada fila). De turno y sin conexión: «Sin conexión» en ámbar, porque el reparto del turno no mira la
     * conexión (WhatsAppService) y le pueden llegar pacientes sin estar.
     */
    const estadoDe = (user: User) => {
        const ultima = user.last_activity_at ? new Date(user.last_activity_at) : null;
        const deTurnoSinConexion = user.role === 'advisor' && !!user.is_on_duty && !user.is_online;

        return {
            principal: user.is_online
                ? { texto: t('users.online'), clase: 'text-emerald-700 dark:text-emerald-400', pista: undefined }
                : deTurnoSinConexion
                  ? { texto: t('users.onDutyOffline'), clase: 'text-amber-700 dark:text-amber-400', pista: t('users.onDutyOfflineHint') }
                  : null,
            detalle: ultima ? haceCuanto(ultima) : t('users.neverConnected'),
            exacta: ultima ? t('users.lastActivityAt', { fecha: fechaLarga(ultima) }) : undefined,
            // Para el lector de pantalla: «Última actividad: hace 26 min».
            prefijo: ultima ? `${t('users.lastActivity')}:` : undefined,
        };
    };

    const handleDelete = () => {
        if (!userToDelete || eliminando) return;
        const nombre = nombrePropio(userToDelete.name);

        router.delete(`/admin/users/${userToDelete.id}`, {
            preserveScroll: true,
            onStart: () => {
                setEliminando(true);
                alEmpezarEnvio();
            },
            // El servidor rechaza algunos casos con un redirect y un flash de error (p. ej. eliminarse a uno
            // mismo): para Inertia eso es un éxito, así que se mira el flash antes de decir «eliminado».
            onSuccess: (page) => {
                const error = (page.props as { flash?: { error?: string | null } }).flash?.error;
                setAbiertoBorrar(false);
                if (error) toast.error(error);
                else toast.success(t('users.toastDeletedName', { name: nombre }));
            },
            onError: () => toast.error(t('users.toastDeleteErrorName', { name: nombre })),
            onFinish: () => {
                setEliminando(false);
                alTerminarEnvio();
            },
        });
    };

    const handleCreate = (event: FormEvent) => {
        event.preventDefault();
        avisosCrear.alEnviar();
        const nombre = nombrePropio(createForm.data.name);
        createForm.post('/admin/users', {
            onStart: alEmpezarEnvio,
            onFinish: alTerminarEnvio,
            onSuccess: () => {
                setShowCreateModal(false);
                createForm.reset();
                toast.success(t('users.toastCreatedName', { name: nombre }));
            },
        });
    };

    const handleEdit = (event: FormEvent) => {
        event.preventDefault();
        if (!userToEdit) return;
        avisosEditar.alEnviar();
        const nombre = nombrePropio(editForm.data.name);
        const cambioClave = modoClave && !!editForm.data.password;

        editForm.put(`/admin/users/${userToEdit.id}`, {
            onStart: alEmpezarEnvio,
            onFinish: alTerminarEnvio,
            onSuccess: () => {
                setShowEditModal(false);
                toast.success(t(cambioClave ? 'users.toastPasswordChanged' : 'users.toastUpdatedName', { name: nombre }));
            },
        });
    };

    // generar = true: "Restablecer contraseña" (abre la edición con una contraseña nueva ya puesta y visible).
    const openEditModal = (user: User, generar = false, origen: HTMLElement | null = null) => {
        recordarOrigen(origen, user.id);
        const clave = generar ? generarClave() : '';
        setUserToEdit(user);
        editForm.setData({
            name: user.name,
            email: user.email,
            password: clave,
            password_confirmation: clave,
            role: user.role,
        });
        editForm.clearErrors();
        setVerClaveEditar(generar);
        setGeneradaEditar(generar);
        setModoClave(generar);
        setShowEditModal(true);
    };

    const openCreateModal = (origen: HTMLElement | null = null) => {
        recordarOrigen(origen);
        createForm.reset();
        createForm.clearErrors();
        setVerClaveCrear(false);
        setGeneradaCrear(false);
        setShowCreateModal(true);
    };

    const pedirEliminar = (user: User, origen: HTMLElement | null) => {
        const i = filteredUsers.findIndex((u) => u.id === user.id);
        recordarOrigen(origen, user.id, (filteredUsers[i + 1] ?? filteredUsers[i - 1])?.id);
        setUserToDelete(user);
        setAbiertoBorrar(true);
    };

    const generarParaCrear = () => {
        const clave = generarClave();
        createForm.setData((datos) => ({ ...datos, password: clave, password_confirmation: clave }));
        setVerClaveCrear(true);
        setGeneradaCrear(true);
        // Los campos ya están llenos: fuera los avisos de "vacío" que hubiera.
        avisosCrear.alEscribir('password')();
        avisosCrear.alEscribir('password_confirmation')();
    };

    const generarParaEditar = () => {
        const clave = generarClave();
        editForm.setData((datos) => ({ ...datos, password: clave, password_confirmation: clave }));
        setVerClaveEditar(true);
        setGeneradaEditar(true);
        // Los campos ya están llenos: fuera los avisos de "vacío" que hubiera.
        avisosEditar.alEscribir('password')();
        avisosEditar.alEscribir('password_confirmation')();
    };

    // Interruptores de envío masivo guardando ahora (el ref evita el doble clic aunque el estado no se haya
    // pintado todavía; el estado es para pintarlos ocupados).
    const enVueloEnvio = useRef(new Set<number>());
    const [cambiandoEnvio, setCambiandoEnvio] = useState<number[]>([]);

    /** El servidor invierte el permiso; «Deshacer» lo vuelve a invertir. */
    const toggleBulkSend = (user: User, deshacer = false) => {
        if (enVueloEnvio.current.has(user.id)) return;
        const nombre = nombrePropio(user.name);
        const activar = !user.can_bulk_send;
        enVueloEnvio.current.add(user.id);
        setCambiandoEnvio((ids) => [...ids, user.id]);

        router.post(`/admin/users/${user.id}/toggle-bulk-send`, {}, {
            async: true,
            showProgress: true,
            preserveScroll: true,
            onStart: alEmpezarEnvio,
            onSuccess: () => {
                if (deshacer) {
                    toast.info(t('users.toastBulkSendUndone', { name: nombre }));
                    return;
                }
                toast.success(t(activar ? 'users.toastBulkSendGranted' : 'users.toastBulkSendRemoved', { name: nombre }), {
                    boton: { titulo: t('users.undo'), alPulsar: () => toggleBulkSend({ ...user, can_bulk_send: activar }, true) },
                });
            },
            onError: () => toast.error(t('users.toastBulkSendError', { name: nombre })),
            onFinish: () => {
                enVueloEnvio.current.delete(user.id);
                setCambiandoEnvio((ids) => ids.filter((id) => id !== user.id));
                alTerminarEnvio();
            },
        });
    };

    const actionLabels = { edit: t('common.edit'), delete: t('common.delete'), more: t('users.moreActions'), reset: t('users.resetPassword') };

    /* ── Piezas que dependen de t() ───────────────────────────────────────────────────────────── */

    const bulkCell = (user: User) =>
        user.role === 'advisor' ? (
            <InterruptorEnvio
                activo={user.can_bulk_send}
                nombre={t('users.bulkSendFor', { name: nombrePropio(user.name) })}
                pista={user.can_bulk_send ? t('users.disableBulkSend') : t('users.enableBulkSend')}
                ocupado={cambiandoEnvio.includes(user.id)}
                onToggle={() => toggleBulkSend(user)}
            />
        ) : (
            // Los administradores siempre pueden (CheckBulkSendAccess): antes era un «—» que solo se explicaba
            // en el tooltip.
            <span title={t('users.bulkAlwaysHint')} className="text-[13px] leading-[18px] text-muted-foreground">
                <span aria-hidden="true">{t('users.bulkAlways')}</span>
                <span className="sr-only">{t('users.bulkAlwaysHint')}</span>
            </span>
        );

    /** Lo principal del estado (En línea / Sin conexión), si lo hay. conPista: su explicación para el lector. */
    const estadoPrincipal = (user: User, className?: string, conPista = true) => {
        const { principal } = estadoDe(user);
        if (!principal) return null;

        return (
            <span title={principal.pista} className={cn('text-[13px] leading-[18px] font-medium', principal.clase, className)}>
                {principal.texto}
                {conPista && principal.pista && <span className="sr-only">. {principal.pista}</span>}
            </span>
        );
    };

    /**
     * Hace cuánto fue su última actividad; si no hay estado principal, va como dato principal. En la tarjeta
     * de celular no hay encabezado «Actividad»: ahí la etiqueta se ve («Última actividad: 15 oct»).
     */
    const estadoDetalle = (user: User, className?: string, conEtiqueta = false) => {
        const { principal, detalle, exacta, prefijo } = estadoDe(user);
        const etiquetaVisible = conEtiqueta && !principal;

        return (
            <span
                title={exacta}
                className={cn(
                    principal ? 'text-[12px] leading-4 text-muted-foreground' : 'text-[13px] leading-[18px] font-medium text-slate-600 dark:text-neutral-300',
                    className
                )}
            >
                {prefijo && <span className={etiquetaVisible ? 'font-normal text-muted-foreground' : 'sr-only'}>{prefijo} </span>}
                {detalle}
            </span>
        );
    };

    const nameBlock = (user: User) => (
        <div className="flex min-w-0 flex-col gap-0.5">
            <span className={cn('truncate text-[13.5px] leading-[18px] font-semibold tracking-[-0.003em]', TEXTO_NAVY)}>{nombrePropio(user.name)}</span>
            <span className="truncate text-[12px] leading-4 text-muted-foreground">{user.email}</span>
        </div>
    );

    return (
        <AdminLayout>
            <Head title={t('users.title')} />

            <div className="min-h-screen bg-background px-4 pt-5 pb-8 md:px-7 md:pt-7">
                <div className="@container/pagina mx-auto flex max-w-7xl flex-col gap-6">
                    {/* ── Cabecera: título y botón en la misma fila (también en el celular, donde el botón iba
                        solo en otra); la explicación debajo del título. Sin franja de cifras: repetía el filtro
                        y la banda «En línea», y bajaba la primera persona al 46 % de una pantalla de 1366×641. ── */}
                    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 sm:items-start sm:gap-x-6">
                        <h1 className={cn('text-[28px] leading-[34px] font-semibold tracking-[-0.025em]', TEXTO_NAVY)}>{t('users.title')}</h1>
                        <Button
                            onClick={(event) => openCreateModal(event.currentTarget)}
                            className="h-[38px] gap-2 rounded-[10px] pr-4 pl-3.5 text-[13px] leading-[18px] font-semibold settings-btn-primary has-[>svg]:pr-4 has-[>svg]:pl-3.5 pointer-coarse:h-11 sm:row-span-2"
                        >
                            <UserPlus className="size-4" strokeWidth={2} aria-hidden="true" />
                            {t('users.newUser')}
                        </Button>
                        <p className="col-span-2 text-[14px] leading-5 text-pretty text-muted-foreground sm:col-span-1">{t('users.subtitle')}</p>
                    </header>

                    {/* ── La hoja: barra (buscar, rol con sus cifras, resumen) + lista agrupada ── */}
                    <section className="@container/hoja rounded-2xl bg-card shadow-[0_0_0_1px_rgba(46,63,132,0.07),0_1px_2px_rgba(46,63,132,0.05),0_14px_32px_-18px_rgba(46,63,132,0.22)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07),0_14px_32px_-18px_rgba(0,0,0,0.6)]">
                        {/* Desde lg (el scroll es el de la isla) y con la barra en una fila, se queda arriba al
                            desplazarse: el buscador ya no se pierde; las bandas se pegan justo debajo (top 60 px). */}
                        <div
                            className={cn(
                                'flex flex-wrap items-center gap-x-3 gap-y-2.5 rounded-t-2xl border-b bg-card px-4 py-3 @3xl/hoja:h-[60px] @3xl/hoja:flex-nowrap @3xl/hoja:px-5 @3xl/hoja:py-0 lg:@3xl/hoja:sticky lg:@3xl/hoja:top-0 lg:@3xl/hoja:z-[3]',
                                FILETE
                            )}
                        >
                            <div className="relative w-full @3xl/hoja:w-[300px] @3xl/hoja:shrink-0">
                                <Label htmlFor="user-search" className="sr-only">
                                    {t('common.search')}
                                </Label>
                                <Search
                                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground dark:text-neutral-400"
                                    strokeWidth={1.75}
                                    aria-hidden="true"
                                />
                                <input
                                    id="user-search"
                                    name="user-search"
                                    type="text"
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Escape' && search) {
                                            event.preventDefault();
                                            setSearch('');
                                        }
                                    }}
                                    aria-keyshortcuts="/"
                                    placeholder={t('users.searchPlaceholder')}
                                    className={cn(
                                        // Con el dedo no hay pista «/»: sin texto, el campo usa todo el ancho (a 320 px el
                                        // ejemplo «Buscar por nombre o correo» se cortaba); con texto, deja sitio al botón ×.
                                        search ? 'pointer-coarse:pr-12' : 'pointer-coarse:pr-3',
                                        'h-9 w-full rounded-[10px] bg-[#2e3f84]/[0.035] pr-9 pl-[38px] text-[13px] leading-[18px] text-foreground pointer-coarse:h-11 pointer-coarse:text-[16px] shadow-[inset_0_0_0_1px_rgba(46,63,132,0.1)] transition-shadow placeholder:text-muted-foreground dark:bg-white/5 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] dark:placeholder:text-neutral-400',
                                        FOCO
                                    )}
                                />
                                {search && (
                                    <button
                                        type="button"
                                        onClick={() => setSearch('')}
                                        className={cn(
                                            'absolute top-1/2 right-2 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md pointer-coarse:right-1 pointer-coarse:size-9 text-muted-foreground transition-colors hover:bg-[#2e3f84]/8 hover:text-[#2e3f84] dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-neutral-100',
                                            FOCO
                                        )}
                                        aria-label={t('users.clearSearch')}
                                        title={t('users.clearSearch')}
                                    >
                                        <X className="size-3.5" aria-hidden="true" />
                                    </button>
                                )}
                                {/* Pista del atajo «/» (solo con ratón y con el campo vacío; el lector lo sabe por aria-keyshortcuts). */}
                                {!search && (
                                    <kbd
                                        aria-hidden="true"
                                        className="pointer-events-none absolute top-1/2 right-2.5 hidden h-5 min-w-5 -translate-y-1/2 items-center justify-center rounded-[5px] px-1 font-sans text-[11px] leading-none font-medium text-muted-foreground shadow-[inset_0_0_0_1px_rgba(46,63,132,0.16)] pointer-fine:flex dark:text-neutral-400 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)]"
                                    >
                                        /
                                    </kbd>
                                )}
                            </div>

                            {/* Segmentado: la opción elegida en blanco, con cuántos hay de cada rol (si cabe). */}
                            <div
                                role="group"
                                aria-label={t('users.roleFilterLabel')}
                                className="flex w-full items-center gap-0.5 rounded-[11px] bg-[#2e3f84]/[0.055] p-[3px] @md/hoja:w-auto dark:bg-white/5"
                            >
                                {roleOptions.map((option) => {
                                    const activa = roleFilter === option.value;

                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            aria-pressed={activa}
                                            onClick={() => setRoleFilter(option.value)}
                                            className={cn(
                                                'h-[30px] flex-1 cursor-pointer rounded-lg px-1.5 text-[12.5px] leading-4 font-semibold whitespace-nowrap transition-colors pointer-coarse:h-10 @xs/hoja:px-3 @md/hoja:flex-none @md/hoja:px-3.5',
                                                FOCO,
                                                activa
                                                    ? 'bg-white text-[#2e3f84] shadow-[0_0_0_1px_rgba(46,63,132,0.08),0_1px_2px_rgba(46,63,132,0.12),0_2px_6px_-2px_rgba(46,63,132,0.12)] dark:bg-white/12 dark:text-neutral-100 dark:shadow-none'
                                                    : cn(TEXTO_SUAVE, 'hover:text-[#2e3f84] dark:hover:text-neutral-100')
                                            )}
                                        >
                                            {/* El espacio separa también el nombre accesible («Asesores 12», no «Asesores12»). */}
                                            {option.label}{' '}
                                            <span className="ml-0.5 hidden font-normal tabular-nums @md/hoja:inline">{option.count}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* El resultado de la búsqueda se anuncia al lector de pantalla (la cifra visible va al lado). */}
                            <span className="sr-only" aria-live="polite">
                                {busqueda ? t('users.directoryCount', { filtered: filteredUsers.length, total: users.length }) : ''}
                            </span>
                            {/* A la derecha: con búsqueda, cuántos coinciden; sin ella y si cabe, cuántos asesores
                                tienen envío masivo (lo único de la antigua franja que la lista no decía ya). */}
                            <div
                                className={cn(
                                    'ml-auto items-center gap-1.5 text-[12.5px] leading-4 whitespace-nowrap text-muted-foreground tabular-nums',
                                    // Sin búsqueda, solo donde cabe: en la segunda línea de la barra (hoja de 672 a
                                    // 767 px) o con la barra en una fila desde 1024 px; entre medias no alcanza.
                                    busqueda ? 'flex' : stats.advisors > 0 ? 'hidden @2xl/hoja:flex @3xl/hoja:hidden @5xl/hoja:flex' : 'hidden'
                                )}
                            >
                                {busqueda ? (
                                    <span aria-hidden="true">
                                        <Trans
                                            i18nKey="users.directoryCountRich"
                                            values={{ filtered: filteredUsers.length, total: users.length }}
                                            components={{ strong: <span className={cn('font-semibold', TEXTO_NAVY)} /> }}
                                        />
                                    </span>
                                ) : (
                                    <>
                                        <Send className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
                                        <span>
                                            <Trans
                                                i18nKey="users.bulkRatioRich"
                                                count={stats.advisors}
                                                values={{ con: stats.bulkEnabled, count: stats.advisors }}
                                                components={{ strong: <span className={cn('font-semibold', TEXTO_NAVY)} /> }}
                                            />
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>

                        {groups.length > 0 ? (
                            groups.map((group, groupIndex) => {
                                const lastGroup = groupIndex === groups.length - 1;
                                const groupId = group.online ? 'users-group-online' : 'users-group-offline';

                                return (
                                    // Cada grupo envuelve su banda: al desplazarse (desde lg, el scroll es el de
                                    // la isla) la banda se queda pegada bajo la barra mientras dure su grupo.
                                    <section key={groupId} aria-labelledby={groupId}>
                                        <div
                                            className={cn(
                                                'flex h-9 items-center border-b bg-card bg-[image:linear-gradient(rgba(46,63,132,0.028),rgba(46,63,132,0.028))] px-4 lg:sticky lg:top-0 lg:z-[2] @3xl/hoja:grid lg:@3xl/hoja:top-[60px] dark:bg-[image:linear-gradient(rgba(255,255,255,0.03),rgba(255,255,255,0.03))]',
                                                COLUMNAS,
                                                FILETE
                                            )}
                                        >
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <span className="flex w-8 shrink-0 justify-center">
                                                        <PuntoEstado online={group.online} />
                                                    </span>
                                                    <h2 id={groupId} className="flex items-baseline gap-2">
                                                        <span
                                                            className={cn(
                                                                'text-[13px] leading-4 font-semibold',
                                                                group.online ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-neutral-300'
                                                            )}
                                                        >
                                                            {group.online ? t('users.groupOnline') : t('users.groupOffline')}
                                                        </span>
                                                        <span className="text-[12.5px] leading-4 font-medium text-muted-foreground tabular-nums dark:text-neutral-400">
                                                            {group.users.length}
                                                        </span>
                                                    </h2>
                                                </div>
                                                <Th className="hidden @3xl/hoja:block">{t('users.role')}</Th>
                                                {/* «Actividad», no «Estado»: en los desconectados la celda es solo cuándo fue su última actividad. */}
                                                <Th className="hidden @3xl/hoja:block">{t('users.tableActivity')}</Th>
                                                <Th className="hidden @3xl/hoja:block">{t('users.tableBulkSend')}</Th>
                                                <Th className="hidden @3xl/hoja:block">{t('users.tableRegistered')}</Th>
                                                <Th className="hidden text-right @3xl/hoja:block">{t('users.tableActions')}</Th>
                                        </div>

                                        <ul>
                                            {group.users.map((user) => (
                                                <li
                                                    key={user.id}
                                                    className={cn(
                                                        'border-b transition-colors',
                                                        // La última fila de la hoja cierra sus esquinas (sin overflow-hidden, que
                                                        // anularía las bandas pegadas).
                                                        lastGroup && 'last:rounded-b-2xl last:border-b-0',
                                                        FILETE,
                                                        FONDO_FILA
                                                    )}
                                                >
                                                    {/* Fila de escritorio (hoja ≥ 768 px) */}
                                                    <div className={cn('hidden min-h-[53px] py-2 @3xl/hoja:grid', COLUMNAS)}>
                                                        <div className="flex min-w-0 items-center gap-3">
                                                            <AvatarPresencia user={user} />
                                                            {nameBlock(user)}
                                                        </div>
                                                        <div className="flex min-w-0">
                                                            <RolYTurno user={user} etiqueta={getRoleLabel(user.role)} turno={t('users.onDuty')} />
                                                        </div>
                                                        <div className="flex min-w-0 flex-col gap-0.5">
                                                            {estadoPrincipal(user, 'truncate')}
                                                            {estadoDetalle(user, 'truncate')}
                                                        </div>
                                                        <div className="flex items-center">{bulkCell(user)}</div>
                                                        <span className="truncate text-[12.5px] leading-[18px] whitespace-nowrap text-muted-foreground tabular-nums">
                                                            <span className="sr-only">{t('users.tableRegistered')}: </span>
                                                            {fechaCorta(new Date(user.created_at), true)}
                                                        </span>
                                                        <Acciones
                                                            etiquetas={actionLabels}
                                                            userId={user.id}
                                                            nombre={nombrePropio(user.name)}
                                                            puedeEliminar={user.id !== yoId}
                                                            onEdit={(origen) => openEditModal(user, false, origen)}
                                                            onResetPassword={(origen) => openEditModal(user, true, origen)}
                                                            onDelete={(origen) => pedirEliminar(user, origen)}
                                                        />
                                                    </div>

                                                    {/* Tarjeta apilada (hoja < 768 px): las mismas piezas y acciones */}
                                                    <div className="flex items-start gap-3 px-4 py-3.5 @3xl/hoja:hidden">
                                                        <div className="pt-0.5">
                                                            <AvatarPresencia user={user} />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-start gap-2">
                                                                <div className="min-w-0 flex-1 pt-0.5">{nameBlock(user)}</div>
                                                                <div className="-mt-0.5 -mr-1.5">
                                                                    <Acciones
                                                            etiquetas={actionLabels}
                                                            userId={user.id}
                                                            nombre={nombrePropio(user.name)}
                                                            puedeEliminar={user.id !== yoId}
                                                            onEdit={(origen) => openEditModal(user, false, origen)}
                                                            onResetPassword={(origen) => openEditModal(user, true, origen)}
                                                            onDelete={(origen) => pedirEliminar(user, origen)}
                                                        />
                                                                </div>
                                                            </div>
                                                            <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                                                                <RolYTurno user={user} etiqueta={getRoleLabel(user.role)} turno={t('users.onDuty')} />
                                                                <span className="flex min-w-0 items-baseline gap-1.5">
                                                                    {estadoPrincipal(user) && (
                                                                        <>
                                                                            {estadoPrincipal(user, 'whitespace-nowrap', false)}
                                                                            <span className="text-[12px] leading-4 text-muted-foreground" aria-hidden="true">
                                                                                ·
                                                                            </span>
                                                                        </>
                                                                    )}
                                                                    {estadoDetalle(user, 'truncate', true)}
                                                                </span>
                                                            </div>
                                                            {/* Sin ratón no hay tooltip: la explicación de «Sin conexión» se ve aquí. */}
                                                            {estadoDe(user).principal?.pista && (
                                                                <p className="mt-1.5 text-[12px] leading-4 text-pretty text-amber-800 dark:text-amber-300">
                                                                    {estadoDe(user).principal?.pista}
                                                                </p>
                                                            )}
                                                            {/* En pantallas muy angostas (320 px) la fecha baja a otra línea en vez de salirse. */}
                                                            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                                                                <div className="flex items-center gap-2.5">
                                                                    <span className="text-[12px] leading-4 font-medium whitespace-nowrap text-muted-foreground">{t('users.tableBulkSend')}</span>
                                                                    {bulkCell(user)}
                                                                </div>
                                                                <span className="text-[12px] leading-4 whitespace-nowrap text-muted-foreground tabular-nums">
                                                                    {t('users.registeredOnDate', { fecha: fechaCorta(new Date(user.created_at), true) })}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </section>
                                );
                            })
                        ) : (
                            // Sin resultados: dice qué se buscó y deja quitarlo (antes, «No hay usuarios» aunque los hubiera).
                            <div className="px-4 py-14 text-center">
                                {busqueda ? (
                                    <Search className="mx-auto mb-3 size-10 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                                ) : (
                                    <UserCircle className="mx-auto mb-3 size-12 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                                )}
                                <h2 className={cn('mx-auto max-w-md text-[15px] leading-5 font-semibold text-balance break-words', TEXTO_NAVY)}>
                                    {busqueda ? t('users.noMatchTitle', { search: busqueda }) : filtrando ? t('users.noRoleTitle') : t('users.noUsers')}
                                </h2>
                                {busqueda && (
                                    <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-[18px] text-pretty text-muted-foreground">
                                        {t(roleFilter === 'admin' ? 'users.noMatchInAdmins' : roleFilter === 'advisor' ? 'users.noMatchInAdvisors' : 'users.noMatchText')}
                                    </p>
                                )}
                                {filtrando && (
                                    <button
                                        type="button"
                                        onClick={quitarFiltros}
                                        className={cn(
                                            'mt-4 inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold pointer-coarse:h-11 text-[#2e3f84] shadow-[inset_0_0_0_1px_rgba(46,63,132,0.2)] transition-colors hover:bg-[#2e3f84]/6 dark:text-neutral-100 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)] dark:hover:bg-white/8',
                                            FOCO
                                        )}
                                    >
                                        <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
                                        {busqueda && roleFilter !== 'all' ? t('users.clearAll') : busqueda ? t('users.clearSearch') : t('users.showAll')}
                                    </button>
                                )}
                            </div>
                        )}
                    </section>
                </div>

                {/* Eliminar. Lo que pasa en la base al borrar una cuenta (reglas ON DELETE de producción, 10/11/2026):
                    conversaciones, mensajes y citas se conservan sin su nombre (SET NULL) y su trabajo deja de contar en
                    Estadísticas; se borran sus mensajes del chat interno y los anuncios que publicó (CASCADE), y
                    User::booted() borra sus plantillas no globales, también las que asignó a otros. */}
                <Dialog open={abiertoBorrar} onOpenChange={(open) => !open && !eliminando && setAbiertoBorrar(false)}>
                    <DialogContent className="card-gradient max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl shadow-2xl sm:rounded-2xl" onCloseAutoFocus={devolverFoco}>
                        {/* A la izquierda y sin pasar bajo la ✕ de cerrar (en el celular el nombre largo la tapaba). */}
                        <DialogHeader className="pr-8 text-left">
                            <DialogTitle className="text-[17px] leading-[22px] tracking-[-0.01em] text-balance settings-title">
                                {t('users.deleteTitle', { name: userToDelete ? nombrePropio(userToDelete.name) : '' })}
                            </DialogTitle>
                            <DialogDescription asChild>
                                <div className="settings-subtitle flex flex-col gap-2 text-[14px] leading-5 text-pretty">
                                    {!!userToDelete?.chats_abiertos && (
                                        <p className="font-semibold text-foreground">{t('users.deleteChats', { count: userToDelete.chats_abiertos })}</p>
                                    )}
                                    <p>{t('users.deleteKeeps')}</p>
                                    <p>
                                        {t('users.deleteErases')}
                                        {!!userToDelete?.plantillas_propias && <> {t('users.deleteTemplates', { count: userToDelete.plantillas_propias })}</>}{' '}
                                        <strong className="font-semibold text-foreground">{t('users.deleteWarning')}</strong>
                                    </p>
                                </div>
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button variant="outline" aria-disabled={eliminando || undefined} className="rounded-xl text-[13px] font-semibold settings-btn-secondary aria-disabled:opacity-60 pointer-coarse:h-11">
                                    {t('common.cancel')}
                                </Button>
                            </DialogClose>
                            <Button
                                onClick={handleDelete}
                                aria-disabled={eliminando || undefined}
                                aria-busy={eliminando || undefined}
                                className="gap-2 rounded-xl border-0 bg-red-600 text-[13px] font-semibold text-white hover:bg-red-700 aria-disabled:cursor-wait aria-disabled:opacity-70 pointer-coarse:h-11"
                            >
                                {eliminando && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                                {eliminando
                                    ? t('users.deleting')
                                    : t('users.deleteButton', { name: userToDelete ? nombrePropio(userToDelete.name).split(' ')[0] : '' })}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
                    <DialogContent className="card-gradient max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-0 shadow-2xl sm:max-w-xl sm:rounded-2xl" onCloseAutoFocus={devolverFoco}>
                        <DialogHeader className="border-b border-[#d4d8e8]/80 py-4 pr-12 pl-5 text-left dark:border-white/10">
                            <DialogTitle className="flex items-start gap-2 text-[17px] leading-[22px] font-semibold tracking-[-0.01em] text-balance settings-title">
                                <UserCircle className="mt-px size-5 shrink-0 text-[#2e3f84] dark:text-neutral-100" aria-hidden="true" />
                                {t('users.createTitle')}
                            </DialogTitle>
                            <DialogDescription className="text-[14px] leading-5 text-pretty settings-subtitle">
                                {t('users.createSubtitle')}
                            </DialogDescription>
                        </DialogHeader>

                        <form onSubmit={handleCreate} className="space-y-4 px-5 py-5">
                            <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label htmlFor="create-name" className="flex items-center gap-2 text-[13px] leading-[18px] font-semibold settings-label">
                                        <UserCircle className="h-3.5 w-3.5" />
                                        {t('users.fullName')}
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            id="create-name"
                                            type="text"
                                            value={createForm.data.name}
                                            onChange={(event) => createForm.setData('name', event.target.value)}
                                            placeholder={t('users.fullNamePlaceholder')}
                                            autoComplete="off"
                                            required
                                            aria-invalid={avisosCrear.invalido('name', createForm.errors.name) || undefined}
                                            onInvalid={avisosCrear.alInvalidar('name')}
                                            onInput={avisosCrear.alEscribir('name')}
                                            className="rounded-xl text-[13.5px] settings-input md:text-[13.5px] pointer-coarse:h-11 pointer-coarse:text-[16px] focus:ring-2 focus:ring-[#2e3f84]/30 aria-[invalid=true]:border-red-500"
                                        />
                                        <AvisoCampo id="create-name-error" texto={avisosCrear.error('name', createForm.errors.name)} />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="create-email" className="flex items-center gap-2 text-[13px] leading-[18px] font-semibold settings-label">
                                        <Mail className="h-3.5 w-3.5" />
                                        {t('auth.email')}
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            id="create-email"
                                            type="email"
                                            value={createForm.data.email}
                                            onChange={(event) => createForm.setData('email', event.target.value)}
                                            placeholder={t('users.emailPlaceholder')}
                                            autoComplete="off"
                                            required
                                            aria-invalid={avisosCrear.invalido('email', createForm.errors.email) || undefined}
                                            onInvalid={avisosCrear.alInvalidar('email')}
                                            onInput={avisosCrear.alEscribir('email')}
                                            className="rounded-xl text-[13.5px] settings-input md:text-[13.5px] pointer-coarse:h-11 pointer-coarse:text-[16px] focus:ring-2 focus:ring-[#2e3f84]/30 aria-[invalid=true]:border-red-500"
                                        />
                                        <AvisoCampo id="create-email-error" texto={avisosCrear.error('email', createForm.errors.email)} />
                                    </div>
                                </div>
                                <div className={cn('space-y-1.5')}>
                                    <Label htmlFor="create-password" className="flex items-center gap-2 text-[13px] leading-[18px] font-semibold settings-label">
                                        <KeyRound className="h-3.5 w-3.5" />
                                        {t('auth.password')}
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            id="create-password"
                                            type={verClaveCrear ? 'text' : 'password'}
                                            value={createForm.data.password}
                                            onChange={(event) => createForm.setData('password', event.target.value)}
                                            placeholder={t('users.passwordPlaceholder')}
                                            autoComplete="new-password"
                                            required={true}
                                            aria-invalid={avisosCrear.invalido('password', createForm.errors.password) || undefined}
                                            onInvalid={avisosCrear.alInvalidar('password')}
                                            onInput={avisosCrear.alEscribir('password')}
                                            className="rounded-xl pr-[72px] text-[13.5px] settings-input md:text-[13.5px] pointer-coarse:pr-[92px] pointer-coarse:h-11 pointer-coarse:text-[16px] focus:ring-2 focus:ring-[#2e3f84]/30 aria-[invalid=true]:border-red-500"
                                        />
                                        <div className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center gap-0.5">
                                            {createForm.data.password && (
                                                <button type="button" onClick={() => copiarClave(createForm.data.password)} className={BOTON_FANTASMA} title={t('users.copyPassword')} aria-label={t('users.copyPassword')}>
                                                    <Copy className="size-4" strokeWidth={1.75} aria-hidden="true" />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setVerClaveCrear((v) => !v)}
                                                className={BOTON_FANTASMA}
                                                aria-pressed={verClaveCrear}
                                                aria-label={verClaveCrear ? t('auth.hidePassword') : t('auth.showPassword')}
                                                title={verClaveCrear ? t('auth.hidePassword') : t('auth.showPassword')}
                                            >
                                                {verClaveCrear ? <EyeOff className="size-4" strokeWidth={1.75} aria-hidden="true" /> : <Eye className="size-4" strokeWidth={1.75} aria-hidden="true" />}
                                            </button>
                                        </div>
                                        <AvisoCampo id="create-password-error" texto={avisosCrear.error('password', createForm.errors.password)} />
                                    </div>
                                </div>
                                <div className={cn('space-y-1.5')}>
                                    <Label htmlFor="create-password-confirm" className="flex items-center gap-2 text-[13px] leading-[18px] font-semibold settings-label">
                                        <KeyRound className="h-3.5 w-3.5" />
                                        {t('users.confirmPassword')}
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            id="create-password-confirm"
                                            type={verClaveCrear ? 'text' : 'password'}
                                            value={createForm.data.password_confirmation}
                                            onChange={(event) => createForm.setData('password_confirmation', event.target.value)}
                                            placeholder={t('users.confirmPasswordPlaceholder')}
                                            autoComplete="new-password"
                                            required={true}
                                            aria-invalid={avisosCrear.invalido('password_confirmation', createForm.errors.password_confirmation) || undefined}
                                            onInvalid={avisosCrear.alInvalidar('password_confirmation')}
                                            onInput={avisosCrear.alEscribir('password_confirmation')}
                                            className="rounded-xl pr-[72px] text-[13.5px] settings-input md:text-[13.5px] pointer-coarse:pr-[92px] pointer-coarse:h-11 pointer-coarse:text-[16px] focus:ring-2 focus:ring-[#2e3f84]/30 aria-[invalid=true]:border-red-500"
                                        />
                                        <div className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center gap-0.5">
                                            {createForm.data.password_confirmation && (
                                                <button type="button" onClick={() => copiarClave(createForm.data.password_confirmation)} className={BOTON_FANTASMA} title={t('users.copyPassword')} aria-label={t('users.copyPassword')}>
                                                    <Copy className="size-4" strokeWidth={1.75} aria-hidden="true" />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setVerClaveCrear((v) => !v)}
                                                className={BOTON_FANTASMA}
                                                aria-pressed={verClaveCrear}
                                                aria-label={verClaveCrear ? t('auth.hidePassword') : t('auth.showPassword')}
                                                title={verClaveCrear ? t('auth.hidePassword') : t('auth.showPassword')}
                                            >
                                                {verClaveCrear ? <EyeOff className="size-4" strokeWidth={1.75} aria-hidden="true" /> : <Eye className="size-4" strokeWidth={1.75} aria-hidden="true" />}
                                            </button>
                                        </div>
                                        <AvisoCampo id="create-password-confirm-error" texto={avisosCrear.error('password_confirmation', createForm.errors.password_confirmation)} />
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-2">
                                    <ReglasClave clave={createForm.data.password} confirmacion={createForm.data.password_confirmation} textos={textosReglas} />
                                    <button
                                        type="button"
                                        onClick={generarParaCrear}
                                        className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold pointer-coarse:h-11 text-[#2e3f84] shadow-[inset_0_0_0_1px_rgba(46,63,132,0.2)] transition-colors hover:bg-[#2e3f84]/6 dark:text-neutral-100 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)] dark:hover:bg-white/8"
                                    >
                                        <Sparkles className="size-4" strokeWidth={1.75} aria-hidden="true" />
                                        {t('users.generatePassword')}
                                    </button>
                                </div>
                                {generadaCrear && (
                                    <p className="rounded-lg bg-emerald-50 px-3 py-2 text-[12.5px] leading-[18px] text-pretty text-emerald-900 md:col-span-2 dark:bg-emerald-500/10 dark:text-emerald-300">
                                        {t('users.generatedHint')}
                                    </p>
                                )}
                                <div className="space-y-1.5 md:col-span-2">
                                    <Label htmlFor="create-role" className="flex items-center gap-2 text-[13px] leading-[18px] font-semibold settings-label">
                                        <ShieldCheck className="h-3.5 w-3.5" />
                                        {t('users.role')}
                                    </Label>
                                    <Select value={createForm.data.role} onValueChange={(value) => createForm.setData('role', value as User['role'])}>
                                        <SelectTrigger
                                            id="create-role"
                                            aria-describedby="create-role-ayuda"
                                            className="h-10 w-full rounded-xl text-[13.5px] settings-input md:text-[13.5px] pointer-coarse:h-11 pointer-coarse:text-[16px] focus:ring-2 focus:ring-[#2e3f84]/30 sm:w-1/2"
                                        >
                                            <SelectValue placeholder={t('users.selectRole')} />
                                        </SelectTrigger>
                                        <SelectContent className="card-gradient rounded-xl p-1 shadow-lg">
                                            <SelectItem value="advisor" className="cursor-pointer rounded-md text-[13.5px] focus:bg-gray-100 dark:focus:bg-gray-800">{t('users.roles.advisor')}</SelectItem>
                                            <SelectItem value="admin" className="cursor-pointer rounded-md text-[13.5px] focus:bg-gray-100 dark:focus:bg-gray-800">{t('users.roles.admin')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {/* Qué puede hacer cada rol: es una decisión de acceso y antes no se explicaba. */}
                                    <p id="create-role-ayuda" className="text-[12.5px] leading-[18px] text-pretty text-muted-foreground">
                                        {t(createForm.data.role === 'admin' ? 'users.roleHelpAdmin' : 'users.roleHelpAdvisor')}
                                    </p>
                                    <InputError message={createForm.errors.role} />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 border-t border-[#d4d8e8]/80 pt-4 dark:border-white/10">
                                <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)} className="rounded-xl text-[13px] font-semibold settings-btn-secondary pointer-coarse:h-11">
                                    {t('common.cancel')}
                                </Button>
                                <Button type="submit" disabled={createForm.processing} className="rounded-xl text-[13px] font-semibold settings-btn-primary disabled:opacity-50 pointer-coarse:h-11">
                                    {createForm.processing ? t('users.creating') : t('users.createUser')}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>

                <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
                    <DialogContent className="card-gradient max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-0 shadow-2xl sm:max-w-xl sm:rounded-2xl" onCloseAutoFocus={devolverFoco}>
                        <DialogHeader className="border-b border-[#d4d8e8]/80 py-4 pr-12 pl-5 text-left dark:border-white/10">
                            {/* Desde «Restablecer contraseña» la ventana habla de la clave (antes decía «Editar usuario»
                                igual). La explicación dice la consecuencia de guardar, no repite el título. */}
                            <DialogTitle className="flex items-start gap-2 text-[17px] leading-[22px] font-semibold tracking-[-0.01em] text-balance settings-title">
                                {modoClave ? (
                                    <KeyRound className="mt-px size-5 shrink-0 text-[#2e3f84] dark:text-neutral-100" aria-hidden="true" />
                                ) : (
                                    <Edit3 className="mt-px size-5 shrink-0 text-[#2e3f84] dark:text-neutral-100" aria-hidden="true" />
                                )}
                                {userToEdit
                                    ? t(modoClave ? 'users.resetTitleFor' : 'users.editFor', { name: nombrePropio(userToEdit.name) })
                                    : t('users.editTitle')}
                            </DialogTitle>
                            <DialogDescription className="text-[14px] leading-5 text-pretty settings-subtitle">
                                {modoClave
                                    ? t(userToEdit?.id === yoId ? 'users.resetSubtitleSelf' : 'users.resetSubtitle')
                                    : t(userToEdit?.id === yoId ? 'users.editSubtitleEmailSelf' : 'users.editSubtitleEmail')}
                            </DialogDescription>
                        </DialogHeader>

                        <form onSubmit={handleEdit} className="space-y-4 px-5 py-5">
                            <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label htmlFor="edit-name" className="flex items-center gap-2 text-[13px] leading-[18px] font-semibold settings-label">
                                        <UserCircle className="h-3.5 w-3.5" />
                                        {t('users.fullName')}
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            id="edit-name"
                                            type="text"
                                            value={editForm.data.name}
                                            onChange={(event) => editForm.setData('name', event.target.value)}
                                            placeholder={t('users.fullNamePlaceholder')}
                                            autoComplete="off"
                                            required
                                            aria-invalid={avisosEditar.invalido('name', editForm.errors.name) || undefined}
                                            onInvalid={avisosEditar.alInvalidar('name')}
                                            onInput={avisosEditar.alEscribir('name')}
                                            className="rounded-xl text-[13.5px] settings-input md:text-[13.5px] pointer-coarse:h-11 pointer-coarse:text-[16px] focus:ring-2 focus:ring-[#2e3f84]/30 aria-[invalid=true]:border-red-500"
                                        />
                                        <AvisoCampo id="edit-name-error" texto={avisosEditar.error('name', editForm.errors.name)} />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="edit-email" className="flex items-center gap-2 text-[13px] leading-[18px] font-semibold settings-label">
                                        <Mail className="h-3.5 w-3.5" />
                                        {t('auth.email')}
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            id="edit-email"
                                            type="email"
                                            value={editForm.data.email}
                                            onChange={(event) => editForm.setData('email', event.target.value)}
                                            placeholder={t('users.emailPlaceholder')}
                                            autoComplete="off"
                                            required
                                            aria-invalid={avisosEditar.invalido('email', editForm.errors.email) || undefined}
                                            onInvalid={avisosEditar.alInvalidar('email')}
                                            onInput={avisosEditar.alEscribir('email')}
                                            className="rounded-xl text-[13.5px] settings-input md:text-[13.5px] pointer-coarse:h-11 pointer-coarse:text-[16px] focus:ring-2 focus:ring-[#2e3f84]/30 aria-[invalid=true]:border-red-500"
                                        />
                                        <AvisoCampo id="edit-email-error" texto={avisosEditar.error('email', editForm.errors.email)} />
                                    </div>
                                </div>
                                <div className={cn('space-y-1.5')}>
                                    <Label htmlFor="edit-password" className="flex items-center gap-2 text-[13px] leading-[18px] font-semibold settings-label">
                                        <KeyRound className="h-3.5 w-3.5" />
                                        {/* Al restablecer, la contraseña es el propósito de la ventana: no «(opcional)». */}
                                        {modoClave ? t('users.newPasswordLabel') : t('users.newPassword')}
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            id="edit-password"
                                            type={verClaveEditar ? 'text' : 'password'}
                                            value={editForm.data.password}
                                            onChange={(event) => {
                                                const valor = event.target.value;
                                                editForm.setData((datos) => ({ ...datos, password: valor, password_confirmation: valor ? datos.password_confirmation : '' }));
                                            }}
                                            placeholder={t('users.newPasswordPlaceholder')}
                                            autoComplete="new-password"
                                            required={false}
                                            aria-invalid={avisosEditar.invalido('password', editForm.errors.password) || undefined}
                                            onInvalid={avisosEditar.alInvalidar('password')}
                                            onInput={avisosEditar.alEscribir('password')}
                                            className="rounded-xl pr-[72px] text-[13.5px] settings-input md:text-[13.5px] pointer-coarse:pr-[92px] pointer-coarse:h-11 pointer-coarse:text-[16px] focus:ring-2 focus:ring-[#2e3f84]/30 aria-[invalid=true]:border-red-500"
                                        />
                                        <div className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center gap-0.5">
                                            {editForm.data.password && (
                                                <button type="button" onClick={() => copiarClave(editForm.data.password)} className={BOTON_FANTASMA} title={t('users.copyPassword')} aria-label={t('users.copyPassword')}>
                                                    <Copy className="size-4" strokeWidth={1.75} aria-hidden="true" />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setVerClaveEditar((v) => !v)}
                                                className={BOTON_FANTASMA}
                                                aria-pressed={verClaveEditar}
                                                aria-label={verClaveEditar ? t('auth.hidePassword') : t('auth.showPassword')}
                                                title={verClaveEditar ? t('auth.hidePassword') : t('auth.showPassword')}
                                            >
                                                {verClaveEditar ? <EyeOff className="size-4" strokeWidth={1.75} aria-hidden="true" /> : <Eye className="size-4" strokeWidth={1.75} aria-hidden="true" />}
                                            </button>
                                        </div>
                                        <AvisoCampo id="edit-password-error" texto={avisosEditar.error('password', editForm.errors.password)} />
                                    </div>
                                </div>
                                <div className={cn('space-y-1.5', 'transition-opacity', !editForm.data.password && 'pointer-events-none opacity-35')}>
                                    <Label htmlFor="edit-password-confirm" className="flex items-center gap-2 text-[13px] leading-[18px] font-semibold settings-label">
                                        <KeyRound className="h-3.5 w-3.5" />
                                        {t('users.confirmNewPassword')}
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            id="edit-password-confirm"
                                            disabled={!editForm.data.password}
                                            type={verClaveEditar ? 'text' : 'password'}
                                            value={editForm.data.password_confirmation}
                                            onChange={(event) => editForm.setData('password_confirmation', event.target.value)}
                                            placeholder={t('users.confirmNewPasswordPlaceholder')}
                                            autoComplete="new-password"
                                            required={!!editForm.data.password}
                                            aria-invalid={avisosEditar.invalido('password_confirmation', editForm.errors.password_confirmation) || undefined}
                                            onInvalid={avisosEditar.alInvalidar('password_confirmation')}
                                            onInput={avisosEditar.alEscribir('password_confirmation')}
                                            className="rounded-xl pr-[72px] text-[13.5px] settings-input md:text-[13.5px] pointer-coarse:pr-[92px] pointer-coarse:h-11 pointer-coarse:text-[16px] disabled:opacity-100 focus:ring-2 focus:ring-[#2e3f84]/30 aria-[invalid=true]:border-red-500"
                                        />
                                        <div className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center gap-0.5">
                                            {editForm.data.password_confirmation && (
                                                <button type="button" onClick={() => copiarClave(editForm.data.password_confirmation)} className={BOTON_FANTASMA} title={t('users.copyPassword')} aria-label={t('users.copyPassword')}>
                                                    <Copy className="size-4" strokeWidth={1.75} aria-hidden="true" />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                disabled={!editForm.data.password}
                                                onClick={() => setVerClaveEditar((v) => !v)}
                                                className={BOTON_FANTASMA}
                                                aria-pressed={verClaveEditar}
                                                aria-label={verClaveEditar ? t('auth.hidePassword') : t('auth.showPassword')}
                                                title={verClaveEditar ? t('auth.hidePassword') : t('auth.showPassword')}
                                            >
                                                {verClaveEditar ? <EyeOff className="size-4" strokeWidth={1.75} aria-hidden="true" /> : <Eye className="size-4" strokeWidth={1.75} aria-hidden="true" />}
                                            </button>
                                        </div>
                                        <AvisoCampo id="edit-password-confirm-error" texto={avisosEditar.error('password_confirmation', editForm.errors.password_confirmation)} />
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-2">
                                    {editForm.data.password ? <ReglasClave clave={editForm.data.password} confirmacion={editForm.data.password_confirmation} textos={textosReglas} /> : <span />}
                                    <button
                                        type="button"
                                        onClick={generarParaEditar}
                                        className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold pointer-coarse:h-11 text-[#2e3f84] shadow-[inset_0_0_0_1px_rgba(46,63,132,0.2)] transition-colors hover:bg-[#2e3f84]/6 dark:text-neutral-100 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)] dark:hover:bg-white/8"
                                    >
                                        <Sparkles className="size-4" strokeWidth={1.75} aria-hidden="true" />
                                        {t('users.generatePassword')}
                                    </button>
                                </div>
                                {generadaEditar && (
                                    <p className="rounded-lg bg-emerald-50 px-3 py-2 text-[12.5px] leading-[18px] text-pretty text-emerald-900 md:col-span-2 dark:bg-emerald-500/10 dark:text-emerald-300">
                                        {t('users.generatedHint')}
                                    </p>
                                )}
                                <div className="space-y-1.5 md:col-span-2">
                                    <Label htmlFor="edit-role" className="flex items-center gap-2 text-[13px] leading-[18px] font-semibold settings-label">
                                        <ShieldCheck className="h-3.5 w-3.5" />
                                        {t('users.role')}
                                    </Label>
                                    <Select
                                        value={editForm.data.role}
                                        onValueChange={(value) => editForm.setData('role', value as User['role'])}
                                        disabled={userToEdit?.id === yoId}
                                    >
                                        <SelectTrigger
                                            id="edit-role"
                                            aria-describedby={userToEdit?.id === yoId ? 'edit-role-propio' : 'edit-role-ayuda'}
                                            className="h-10 w-full rounded-xl text-[13.5px] settings-input md:text-[13.5px] pointer-coarse:h-11 pointer-coarse:text-[16px] focus:ring-2 focus:ring-[#2e3f84]/30 sm:w-1/2"
                                        >
                                            <SelectValue placeholder={t('users.selectRole')} />
                                        </SelectTrigger>
                                        <SelectContent className="card-gradient rounded-xl p-1 shadow-lg">
                                            <SelectItem value="advisor" className="cursor-pointer rounded-md text-[13.5px] focus:bg-gray-100 dark:focus:bg-gray-800">{t('users.roles.advisor')}</SelectItem>
                                            <SelectItem value="admin" className="cursor-pointer rounded-md text-[13.5px] focus:bg-gray-100 dark:focus:bg-gray-800">{t('users.roles.admin')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {userToEdit?.id === yoId ? (
                                        <p id="edit-role-propio" className="text-[12.5px] leading-[18px] text-muted-foreground">
                                            {t('users.ownRoleHint')}
                                        </p>
                                    ) : (
                                        <p id="edit-role-ayuda" className="text-[12.5px] leading-[18px] text-pretty text-muted-foreground">
                                            {t(editForm.data.role === 'admin' ? 'users.roleHelpAdmin' : 'users.roleHelpAdvisor')}
                                        </p>
                                    )}
                                    <InputError message={editForm.errors.role} />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 border-t border-[#d4d8e8]/80 pt-4 dark:border-white/10">
                                <Button type="button" variant="outline" onClick={() => setShowEditModal(false)} className="rounded-xl text-[13px] font-semibold settings-btn-secondary pointer-coarse:h-11">
                                    {t('common.cancel')}
                                </Button>
                                <Button type="submit" disabled={editForm.processing} className="rounded-xl text-[13px] font-semibold settings-btn-primary disabled:opacity-50 pointer-coarse:h-11">
                                    {editForm.processing ? t('common.saving') : modoClave ? t('users.savePassword') : t('users.saveChanges')}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </AdminLayout>
    );
}
