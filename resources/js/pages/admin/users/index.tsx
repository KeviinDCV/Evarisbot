import { Head, router, useForm } from '@inertiajs/react';
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
import InputError from '@/components/input-error';
import { cn } from '@/lib/utils';
import {
    Check,
    Edit3,
    Ellipsis,
    Headphones,
    KeyRound,
    Mail,
    Search,
    Send,
    ShieldCheck,
    Trash2,
    UserCircle,
    UserPlus,
    Users,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { toast } from 'sonner';

interface User {
    id: number;
    name: string;
    email: string;
    role: 'admin' | 'advisor';
    can_bulk_send: boolean;
    created_at: string;
    is_online: boolean;
    online_status: 'online' | 'offline' | 'never';
    last_activity_at: string | null;
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

function getInitials(name: string) {
    return name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join('');
}

/**
 * Nombre propio SOLO para pintar (el dato guardado no cambia): conviven "ANDREA CAROLINA MUÑOZ PAZ"
 * y "Sofía Quintero Ramos", y la lista en mayúsculas sostenidas se lee gritada. Las partículas
 * (de, del, la…) van en minúscula salvo al principio; los compuestos con guion se respetan.
 */
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

/* ── Tintas de la vista (design/vista-usuarios/gen_vista.mjs) ──────────────────────────────────────
   Todo es navy #2e3f84 con alfa sobre la hoja blanca; en oscuro, blanco con alfa sobre bg-card. */
const FILETE = 'border-[#2e3f84]/8 dark:border-white/8';
const TEXTO_NAVY = 'text-[#2e3f84] dark:text-neutral-100';
// Nombres de columna y opciones inactivas: en oscuro el muted-foreground no llega a 4,5:1 sobre la
// banda tintada (4,45:1), así que ahí suben a neutral-400 (5,85:1).
const TEXTO_SUAVE = 'text-muted-foreground dark:text-neutral-400';
const FOCO = 'outline-none focus-visible:ring-2 focus-visible:ring-[#2e3f84]/40 dark:focus-visible:ring-[#8b9ae0]/60';

// Columnas de la lista. Medio (hoja ≥ 768 px): compactas. Ancho (hoja ≥ 1024 px): las del diseño.
// Por debajo de 768 px de hoja, cada persona es una tarjeta apilada (otra plantilla).
// Solo la plantilla: quien la usa decide cuándo es grid (desde @3xl/hoja).
const COLUMNAS =
    'grid-cols-[minmax(0,1fr)_120px_136px_96px_88px_64px] items-center gap-x-4 @3xl/hoja:px-5 @5xl/hoja:grid-cols-[minmax(0,1fr)_160px_180px_124px_116px_68px] @5xl/hoja:gap-x-6';

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
            {getInitials(user.name)}
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
function InterruptorEnvio({ activo, etiqueta, onToggle }: { activo: boolean; etiqueta: string; onToggle: () => void }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={activo}
            aria-label={etiqueta}
            title={etiqueta}
            onClick={onToggle}
            className={cn(
                'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus-visible:ring-offset-2 focus-visible:ring-offset-card',
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
    'flex size-[30px] shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-[#2e3f84]/8 hover:text-[#2e3f84] dark:text-neutral-400 dark:hover:bg-white/8 dark:hover:text-neutral-100',
    'aria-expanded:bg-[#2e3f84]/8 aria-expanded:text-[#2e3f84] aria-expanded:shadow-[inset_0_0_0_1px_rgba(46,63,132,0.1)] dark:aria-expanded:bg-white/8 dark:aria-expanded:text-neutral-100 dark:aria-expanded:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]',
    FOCO
);

/** Lápiz (Editar) + menú "…" con Editar y Eliminar. */
function Acciones({
    etiquetas,
    onEdit,
    onDelete,
}: {
    etiquetas: { edit: string; delete: string; more: string };
    onEdit: () => void;
    onDelete: () => void;
}) {
    return (
        <div className="flex items-center justify-end gap-1">
            <button type="button" onClick={onEdit} className={BOTON_FANTASMA} title={etiquetas.edit} aria-label={etiquetas.edit}>
                <Edit3 className="size-4" strokeWidth={1.75} aria-hidden="true" />
            </button>
            {/* modal={false}: el menú abre un Dialog de Radix; en modo modal los dos se pisan el
                bloqueo del body y la página se quedaba sin clics al cerrar el diálogo. */}
            <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                    <button type="button" className={BOTON_FANTASMA} title={etiquetas.more} aria-label={etiquetas.more}>
                        <Ellipsis className="size-4" strokeWidth={1.75} aria-hidden="true" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="end"
                    sideOffset={4}
                    className="flex w-[216px] flex-col gap-0.5 rounded-xl border-0 bg-white p-1 shadow-[0_0_0_1px_rgba(46,63,132,0.1),0_2px_4px_rgba(46,63,132,0.06),0_12px_28px_-12px_rgba(46,63,132,0.3)] dark:bg-popover dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_12px_28px_-12px_rgba(0,0,0,0.7)]"
                >
                    <DropdownMenuItem
                        onSelect={onEdit}
                        className="h-[30px] cursor-pointer gap-2.5 rounded-lg px-2.5 py-0 text-[13px] leading-[18px] font-medium text-[#2e3f84] focus:bg-[#2e3f84]/6 focus:text-[#2e3f84] dark:text-neutral-100 dark:focus:bg-white/8 dark:focus:text-neutral-100"
                    >
                        <Edit3 className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
                        {etiquetas.edit}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="mx-1.5 my-0 bg-[#2e3f84]/8 dark:bg-white/8" />
                    <DropdownMenuItem
                        onSelect={onDelete}
                        className="h-[30px] cursor-pointer gap-2.5 rounded-lg px-2.5 py-0 text-[13px] leading-[18px] font-medium text-red-600 focus:bg-red-50 focus:text-red-700 dark:text-red-400 dark:focus:bg-red-500/10 dark:focus:text-red-300"
                    >
                        <Trash2 className="size-4 text-red-600 dark:text-red-400" strokeWidth={1.75} aria-hidden="true" />
                        {etiquetas.delete}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

/** Una cifra de la franja: marca + etiqueta arriba, número grande debajo (con su añadido). */
function Cifra({
    marca,
    etiqueta,
    valor,
    extra,
    base = false,
    className,
}: {
    marca: ReactNode;
    etiqueta: string;
    valor: number;
    extra?: ReactNode;
    base?: boolean;
    className?: string;
}) {
    return (
        <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
            <div className="flex h-4 items-center gap-2">
                {marca}
                <span className="truncate text-[12px] leading-4 font-medium text-muted-foreground">{etiqueta}</span>
            </div>
            <div className={cn('flex h-[34px] min-w-0', base ? 'items-baseline gap-2' : 'items-center gap-3.5')}>
                <span className={cn('text-[30px] leading-[34px] font-medium tracking-[-0.03em] tabular-nums', TEXTO_NAVY)}>{valor}</span>
                {extra}
            </div>
        </div>
    );
}

// Filete vertical neutro entre cifras (no un borde de tarjeta). Solo cuando la franja va en una fila.
const Divisor = () => <div className="hidden w-px self-stretch bg-[#2e3f84]/12 @5xl/pagina:block dark:bg-white/10" aria-hidden="true" />;

// Nombres de columna de las bandas.
const Th = ({ children, className }: { children: ReactNode; className?: string }) => (
    <span className={cn('truncate text-[11px] leading-4 font-semibold tracking-[0.07em] uppercase', TEXTO_SUAVE, className)}>{children}</span>
);

// Avatares de "En línea ahora", tocándose (sin solaparse: no se muerden iniciales). Caben 7 huecos
// con ≥ 1120 px de contenido y 6 por debajo (1366 con el menú fijado); si hay más gente, el último
// hueco es "+N". Se pintan las dos variantes y cada una se ve en su ancho.
const HUECOS_ANCHO = 7;
const HUECOS_ESTRECHO = 6;
const SOLO_ANCHO = 'hidden @min-[1120px]/pagina:flex';
const SOLO_ESTRECHO = 'flex @min-[1120px]/pagina:hidden';

function avataresVisibles(total: number, huecos: number) {
    return total > huecos ? huecos - 1 : total;
}

export default function UsersIndex({ users }: UsersIndexProps) {
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
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
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [userToEdit, setUserToEdit] = useState<User | null>(null);

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

    const stats = useMemo(() => {
        const admins = users.filter((user) => user.role === 'admin').length;
        const advisors = users.filter((user) => user.role === 'advisor').length;
        const online = users.filter((user) => user.is_online).length;
        const bulkEnabled = users.filter((user) => user.role === 'advisor' && user.can_bulk_send).length;

        return { admins, advisors, online, bulkEnabled };
    }, [users]);

    // Quién está en línea ahora (todos, sin filtros), en el orden del servidor.
    const onlineUsers = useMemo(() => users.filter((user) => user.is_online), [users]);

    const filteredUsers = useMemo(() => {
        const searchTerm = search.trim().toLowerCase();

        const visibles = users.filter((user) => {
            const matchesSearch = !searchTerm || `${user.name} ${user.email}`.toLowerCase().includes(searchTerm);
            const matchesRole = roleFilter === 'all' || user.role === roleFilter;

            return matchesSearch && matchesRole;
        });

        // Los conectados arriba. Se ordena SÓLO por ese criterio: Array.sort es estable,
        // así que dentro de cada grupo se conserva el orden que manda el servidor (los más
        // recientes primero). Ordenar además por última actividad haría saltar las filas
        // cada vez que alguien hace algo.
        return visibles.sort((a, b) => Number(b.is_online) - Number(a.is_online));
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

    const roleOptions: { value: RoleFilter; label: string }[] = [
        { value: 'all', label: t('common.all') },
        { value: 'admin', label: t('users.roleFilter.admins') },
        { value: 'advisor', label: t('users.roleFilter.advisors') },
    ];

    const getRoleLabel = (role: User['role']) => {
        return role === 'admin' ? t('users.roles.admin') : t('users.roles.advisor');
    };

    const formatLastActivity = (lastActivity: string | null) => {
        if (!lastActivity) return t('users.neverConnected');

        const date = new Date(lastActivity);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return t('users.justNow');
        if (diffMins < 60) return t('users.minutesAgo', { count: diffMins });
        if (diffHours < 24) return t('users.hoursAgo', { count: diffHours });
        if (diffDays === 1) return t('users.yesterday');
        if (diffDays < 7) return t('users.daysAgo', { count: diffDays });

        return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatCreatedAt = (createdAt: string) => {
        return new Date(createdAt).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    };

    const handleDelete = () => {
        if (!userToDelete) return;

        router.delete(`/admin/users/${userToDelete.id}`, {
            onSuccess: () => {
                setUserToDelete(null);
                toast.success(t('users.toastDeleted'));
            },
            onError: () => toast.error(t('users.toastDeleteError')),
        });
    };

    const handleCreate = (event: FormEvent) => {
        event.preventDefault();
        createForm.post('/admin/users', {
            onSuccess: () => {
                setShowCreateModal(false);
                createForm.reset();
                toast.success(t('users.toastCreated'));
            },
        });
    };

    const handleEdit = (event: FormEvent) => {
        event.preventDefault();
        if (!userToEdit) return;

        editForm.put(`/admin/users/${userToEdit.id}`, {
            onSuccess: () => {
                setShowEditModal(false);
                setUserToEdit(null);
                toast.success(t('users.toastUpdated'));
            },
        });
    };

    const openEditModal = (user: User) => {
        setUserToEdit(user);
        editForm.setData({
            name: user.name,
            email: user.email,
            password: '',
            password_confirmation: '',
            role: user.role,
        });
        editForm.clearErrors();
        setShowEditModal(true);
    };

    const openCreateModal = () => {
        createForm.reset();
        createForm.clearErrors();
        setShowCreateModal(true);
    };

    const toggleBulkSend = (user: User) => {
        router.post(`/admin/users/${user.id}/toggle-bulk-send`, {}, {
            preserveScroll: true,
            onSuccess: () => toast.success(
                user.can_bulk_send
                    ? t('users.toastBulkSendRemoved', { name: user.name })
                    : t('users.toastBulkSendGranted', { name: user.name })
            ),
        });
    };

    const actionLabels = { edit: t('common.edit'), delete: t('common.delete'), more: t('users.moreActions') };

    /* ── Piezas que dependen de t() ───────────────────────────────────────────────────────────── */

    const bulkCell = (user: User) =>
        user.role === 'advisor' ? (
            <InterruptorEnvio
                activo={user.can_bulk_send}
                etiqueta={user.can_bulk_send ? t('users.disableBulkSend') : t('users.enableBulkSend')}
                onToggle={() => toggleBulkSend(user)}
            />
        ) : (
            <span title={t('users.onlyAdvisors')} className="text-[13px] leading-[18px] text-muted-foreground">
                —
            </span>
        );

    const statusWord = (user: User) => (
        <span
            className={cn(
                'text-[13px] leading-[18px] font-medium whitespace-nowrap',
                user.is_online ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-neutral-300'
            )}
        >
            {user.is_online ? t('users.online') : t('users.offline')}
        </span>
    );

    const lastActivityText = (user: User) => (user.is_online ? t('users.justNow') : formatLastActivity(user.last_activity_at));

    const nameBlock = (user: User) => (
        <div className="flex min-w-0 flex-col gap-0.5">
            <span className={cn('truncate text-[13.5px] leading-[18px] font-semibold tracking-[-0.003em]', TEXTO_NAVY)}>{nombrePropio(user.name)}</span>
            <span className="truncate text-[12px] leading-4 text-muted-foreground">{user.email}</span>
        </div>
    );

    const enPilaAncho = avataresVisibles(onlineUsers.length, HUECOS_ANCHO);
    const enPilaEstrecho = avataresVisibles(onlineUsers.length, HUECOS_ESTRECHO);
    const pila = onlineUsers.slice(0, enPilaAncho);

    const chipResto = (resto: number, visibilidad: string) =>
        resto > 0 && (
            <li
                title={t('users.moreOnline', { count: resto })}
                className={cn(
                    'size-7 shrink-0 items-center justify-center rounded-full bg-card text-[11px] leading-none font-semibold text-[#2e3f84] tabular-nums shadow-[inset_0_0_0_1px_rgba(46,63,132,0.14)] ring-2 ring-background dark:text-neutral-100 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]',
                    visibilidad
                )}
            >
                <span aria-hidden="true">+{resto}</span>
                <span className="sr-only">{t('users.moreOnline', { count: resto })}</span>
            </li>
        );

    return (
        <AdminLayout>
            <Head title={t('users.title')} />

            <div className="min-h-screen bg-background px-4 pt-5 pb-8 md:px-7 md:pt-7">
                <div className="@container/pagina mx-auto flex max-w-7xl flex-col gap-6">
                    {/* ── Cabecera ── */}
                    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                        <div className="flex flex-col gap-1">
                            <h1 className={cn('text-[28px] leading-[34px] font-semibold tracking-[-0.025em]', TEXTO_NAVY)}>{t('users.title')}</h1>
                            <p className="text-[14px] leading-5 text-muted-foreground">{t('users.subtitle')}</p>
                        </div>

                        <Button
                            onClick={openCreateModal}
                            className="h-[38px] gap-2 self-start rounded-[10px] pr-4 pl-3.5 text-[13px] leading-[18px] font-semibold settings-btn-primary has-[>svg]:pr-4 has-[>svg]:pl-3.5"
                        >
                            <UserPlus className="size-4" strokeWidth={2} aria-hidden="true" />
                            {t('users.newUser')}
                        </Button>
                    </header>

                    {/* ── Franja de cifras (sin cajas: filetes entre cifras) ── */}
                    <section
                        aria-label={t('users.summaryLabel')}
                        className="grid grid-flow-dense grid-cols-2 gap-x-6 gap-y-5 @xl/pagina:grid-cols-3 @5xl/pagina:grid-cols-[minmax(0,1fr)_1px_minmax(0,1.55fr)_1px_minmax(0,1fr)_1px_minmax(0,1fr)_1px_minmax(0,1.3fr)] @5xl/pagina:gap-y-0"
                    >
                        <Cifra
                            marca={<Users className={cn('size-3.5', TEXTO_NAVY)} strokeWidth={2} aria-hidden="true" />}
                            etiqueta={t('users.metricUsers')}
                            valor={users.length}
                        />
                        <Divisor />
                        <Cifra
                            className="col-span-2 @5xl/pagina:col-span-1"
                            marca={
                                <span className="flex w-3.5 justify-center">
                                    <PuntoEstado online />
                                </span>
                            }
                            etiqueta={t('users.metricOnlineNow')}
                            valor={stats.online}
                            extra={
                                pila.length > 0 && (
                                    <ul aria-label={t('users.whoIsOnline')} className="flex min-w-0 items-center">
                                        {pila.map((user, i) => (
                                            <li
                                                key={user.id}
                                                title={nombrePropio(user.name)}
                                                className={cn('shrink-0 rounded-full', i < enPilaEstrecho ? 'flex' : SOLO_ANCHO)}
                                            >
                                                <Avatar user={user} size={28} className="ring-2 ring-background" />
                                                <span className="sr-only">{nombrePropio(user.name)}</span>
                                            </li>
                                        ))}
                                        {chipResto(onlineUsers.length - enPilaEstrecho, SOLO_ESTRECHO)}
                                        {chipResto(onlineUsers.length - enPilaAncho, SOLO_ANCHO)}
                                    </ul>
                                )
                            }
                        />
                        <Divisor />
                        <Cifra
                            marca={<ShieldCheck className={cn('size-3.5', TEXTO_NAVY)} strokeWidth={2} aria-hidden="true" />}
                            etiqueta={t('users.metricAdmins')}
                            valor={stats.admins}
                        />
                        <Divisor />
                        <Cifra
                            marca={<Headphones className="size-3.5 text-sky-700 dark:text-sky-300" strokeWidth={2} aria-hidden="true" />}
                            etiqueta={t('users.metricAdvisors')}
                            valor={stats.advisors}
                        />
                        <Divisor />
                        <Cifra
                            marca={<Send className={cn('size-3.5', TEXTO_NAVY)} strokeWidth={2} aria-hidden="true" />}
                            etiqueta={t('users.metricBulk')}
                            valor={stats.bulkEnabled}
                            base
                            extra={
                                <span className="truncate text-[13px] leading-4 text-muted-foreground">
                                    {t('users.metricBulkOf', { count: stats.advisors })}
                                </span>
                            }
                        />
                    </section>

                    {/* ── La hoja: barra (buscar, rol, recuento) + lista agrupada ── */}
                    <section className="@container/hoja rounded-2xl bg-card shadow-[0_0_0_1px_rgba(46,63,132,0.07),0_1px_2px_rgba(46,63,132,0.05),0_14px_32px_-18px_rgba(46,63,132,0.22)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07),0_14px_32px_-18px_rgba(0,0,0,0.6)]">
                        <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-2.5 border-b px-4 py-3 @3xl/hoja:h-[60px] @3xl/hoja:flex-nowrap @3xl/hoja:px-5 @3xl/hoja:py-0', FILETE)}>
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
                                    placeholder={t('users.searchPlaceholder')}
                                    className={cn(
                                        'h-9 w-full rounded-[10px] bg-[#2e3f84]/[0.035] pr-9 pl-[38px] text-[13px] leading-[18px] text-foreground shadow-[inset_0_0_0_1px_rgba(46,63,132,0.1)] transition-shadow placeholder:text-muted-foreground dark:bg-white/5 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] dark:placeholder:text-neutral-400',
                                        FOCO
                                    )}
                                />
                                {search && (
                                    <button
                                        type="button"
                                        onClick={() => setSearch('')}
                                        className={cn(
                                            'absolute top-1/2 right-2 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-[#2e3f84]/8 hover:text-[#2e3f84] dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-neutral-100',
                                            FOCO
                                        )}
                                        aria-label={t('users.clearSearch')}
                                        title={t('users.clearSearch')}
                                    >
                                        <X className="size-3.5" aria-hidden="true" />
                                    </button>
                                )}
                            </div>

                            {/* Segmentado: la opción elegida en blanco. Las cifras de cada rol ya están arriba. */}
                            <div
                                role="group"
                                aria-label={t('users.roleFilterLabel')}
                                className="flex items-center gap-0.5 rounded-[11px] bg-[#2e3f84]/[0.055] p-[3px] dark:bg-white/5"
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
                                                'h-[30px] cursor-pointer rounded-lg px-3 text-[12.5px] leading-4 font-semibold whitespace-nowrap transition-colors @md/hoja:px-3.5',
                                                FOCO,
                                                activa
                                                    ? 'bg-white text-[#2e3f84] shadow-[0_0_0_1px_rgba(46,63,132,0.08),0_1px_2px_rgba(46,63,132,0.12),0_2px_6px_-2px_rgba(46,63,132,0.12)] dark:bg-white/12 dark:text-neutral-100 dark:shadow-none'
                                                    : cn(TEXTO_SUAVE, 'hover:text-[#2e3f84] dark:hover:text-neutral-100')
                                            )}
                                        >
                                            {option.label}
                                        </button>
                                    );
                                })}
                            </div>

                            <span className="ml-auto text-[12.5px] leading-4 whitespace-nowrap text-muted-foreground tabular-nums" aria-live="polite">
                                <Trans
                                    i18nKey="users.directoryCountRich"
                                    values={{ filtered: filteredUsers.length, total: users.length }}
                                    components={{ strong: <span className={cn('font-semibold', TEXTO_NAVY)} /> }}
                                />
                            </span>
                        </div>

                        {groups.length > 0 ? (
                            groups.map((group, groupIndex) => {
                                const lastGroup = groupIndex === groups.length - 1;
                                const groupId = group.online ? 'users-group-online' : 'users-group-offline';

                                return (
                                    // Cada grupo envuelve su banda: al desplazarse (desde lg, el scroll es el de
                                    // la isla) la banda se queda pegada arriba mientras dure su grupo.
                                    <section key={groupId} aria-labelledby={groupId}>
                                        <div
                                            className={cn(
                                                'flex h-9 items-center border-b bg-card bg-[image:linear-gradient(rgba(46,63,132,0.028),rgba(46,63,132,0.028))] px-4 lg:sticky lg:top-0 lg:z-[2] @3xl/hoja:grid dark:bg-[image:linear-gradient(rgba(255,255,255,0.03),rgba(255,255,255,0.03))]',
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
                                                <Th className="hidden @3xl/hoja:block">{t('users.tableStatus')}</Th>
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
                                                            <RolePill role={user.role} label={getRoleLabel(user.role)} />
                                                        </div>
                                                        <div className="flex min-w-0 flex-col gap-0.5">
                                                            {statusWord(user)}
                                                            <span title={t('users.lastActivity')} className="truncate text-[12px] leading-4 text-muted-foreground">
                                                                {lastActivityText(user)}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center">{bulkCell(user)}</div>
                                                        <span className="truncate text-[12.5px] leading-[18px] whitespace-nowrap text-muted-foreground tabular-nums">
                                                            {formatCreatedAt(user.created_at)}
                                                        </span>
                                                        <Acciones etiquetas={actionLabels} onEdit={() => openEditModal(user)} onDelete={() => setUserToDelete(user)} />
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
                                                                    <Acciones etiquetas={actionLabels} onEdit={() => openEditModal(user)} onDelete={() => setUserToDelete(user)} />
                                                                </div>
                                                            </div>
                                                            <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                                                                <RolePill role={user.role} label={getRoleLabel(user.role)} />
                                                                <span className="flex min-w-0 items-baseline gap-1.5">
                                                                    {statusWord(user)}
                                                                    <span className="text-[12px] leading-4 text-muted-foreground" aria-hidden="true">
                                                                        ·
                                                                    </span>
                                                                    <span title={t('users.lastActivity')} className="truncate text-[12px] leading-4 text-muted-foreground">
                                                                        {lastActivityText(user)}
                                                                    </span>
                                                                </span>
                                                            </div>
                                                            <div className="mt-2.5 flex items-center justify-between gap-3">
                                                                <div className="flex items-center gap-2.5">
                                                                    <span className="text-[12px] leading-4 font-medium text-muted-foreground">{t('users.tableBulkSend')}</span>
                                                                    {bulkCell(user)}
                                                                </div>
                                                                <span className="text-[12px] leading-4 whitespace-nowrap text-muted-foreground tabular-nums">
                                                                    {t('users.registeredOn')} {formatCreatedAt(user.created_at)}
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
                            <div className="px-4 py-14 text-center">
                                <UserCircle className="mx-auto mb-3 size-12 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
                                <h2 className={cn('text-[15px] leading-5 font-semibold', TEXTO_NAVY)}>{t('users.noUsers')}</h2>
                                <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-[18px] text-muted-foreground">{t('users.noUsersFiltered')}</p>
                            </div>
                        )}
                    </section>
                </div>

                <Dialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
                    <DialogContent className="card-gradient rounded-2xl shadow-2xl sm:rounded-2xl">
                        <DialogHeader>
                            <DialogTitle className="settings-title">{t('users.deleteConfirm')}</DialogTitle>
                            <DialogDescription className="settings-subtitle">
                                <Trans
                                    i18nKey="users.deleteMessageFull"
                                    values={{ name: userToDelete?.name ?? '' }}
                                    components={{ strong: <strong /> }}
                                />{' '}
                                {t('users.deleteWarning')}
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button variant="outline" className="rounded-xl font-medium settings-btn-secondary">
                                    {t('common.cancel')}
                                </Button>
                            </DialogClose>
                            <Button onClick={handleDelete} className="rounded-xl border-0 bg-gradient-to-b from-red-500 to-red-600 font-medium text-white shadow-md transition-all duration-200 hover:from-red-600 hover:to-red-700">
                                {t('common.delete')}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
                    <DialogContent className="card-gradient overflow-hidden rounded-2xl p-0 shadow-2xl sm:max-w-xl sm:rounded-2xl">
                        <DialogHeader className="border-b border-[#d4d8e8]/80 px-5 py-4 dark:border-white/10">
                            <DialogTitle className="flex items-center gap-2 text-xl settings-title">
                                <UserCircle className="h-5 w-5 text-[#2e3f84] dark:text-neutral-100" />
                                {t('users.createTitle')}
                            </DialogTitle>
                            <DialogDescription className="text-xs settings-subtitle">
                                {t('users.createSubtitle')}
                            </DialogDescription>
                        </DialogHeader>

                        <form onSubmit={handleCreate} className="space-y-4 px-5 py-4">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label htmlFor="create-name" className="flex items-center gap-2 text-xs font-semibold settings-label">
                                        <UserCircle className="h-3.5 w-3.5" />
                                        {t('users.fullName')}
                                    </Label>
                                    <Input
                                        id="create-name"
                                        type="text"
                                        value={createForm.data.name}
                                        onChange={(event) => createForm.setData('name', event.target.value)}
                                        placeholder={t('users.fullNamePlaceholder')}
                                        className="rounded-xl text-sm settings-input focus:ring-2 focus:ring-[#2e3f84]/30"
                                        required
                                    />
                                    <InputError message={createForm.errors.name} />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="create-email" className="flex items-center gap-2 text-xs font-semibold settings-label">
                                        <Mail className="h-3.5 w-3.5" />
                                        {t('auth.email')}
                                    </Label>
                                    <Input
                                        id="create-email"
                                        type="email"
                                        value={createForm.data.email}
                                        onChange={(event) => createForm.setData('email', event.target.value)}
                                        placeholder={t('users.emailPlaceholder')}
                                        className="rounded-xl text-sm settings-input focus:ring-2 focus:ring-[#2e3f84]/30"
                                        required
                                    />
                                    <InputError message={createForm.errors.email} />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="create-password" className="flex items-center gap-2 text-xs font-semibold settings-label">
                                        <KeyRound className="h-3.5 w-3.5" />
                                        {t('auth.password')}
                                    </Label>
                                    <Input
                                        id="create-password"
                                        type="password"
                                        value={createForm.data.password}
                                        onChange={(event) => createForm.setData('password', event.target.value)}
                                        placeholder={t('users.passwordPlaceholder')}
                                        className="rounded-xl text-sm settings-input focus:ring-2 focus:ring-[#2e3f84]/30"
                                        required
                                    />
                                    <InputError message={createForm.errors.password} />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="create-password-confirm" className="flex items-center gap-2 text-xs font-semibold settings-label">
                                        <KeyRound className="h-3.5 w-3.5" />
                                        {t('users.confirmPassword')}
                                    </Label>
                                    <Input
                                        id="create-password-confirm"
                                        type="password"
                                        value={createForm.data.password_confirmation}
                                        onChange={(event) => createForm.setData('password_confirmation', event.target.value)}
                                        placeholder={t('users.confirmPasswordPlaceholder')}
                                        className="rounded-xl text-sm settings-input focus:ring-2 focus:ring-[#2e3f84]/30"
                                        required
                                    />
                                    <InputError message={createForm.errors.password_confirmation} />
                                </div>

                                <div className="space-y-1.5 md:col-span-2">
                                    <Label htmlFor="create-role" className="flex items-center gap-2 text-xs font-semibold settings-label">
                                        <ShieldCheck className="h-3.5 w-3.5" />
                                        {t('users.role')}
                                    </Label>
                                    <Select value={createForm.data.role} onValueChange={(value) => createForm.setData('role', value as User['role'])}>
                                        <SelectTrigger className="h-10 w-full rounded-xl text-sm settings-input focus:ring-2 focus:ring-[#2e3f84]/30 sm:w-1/2">
                                            <SelectValue placeholder={t('users.selectRole')} />
                                        </SelectTrigger>
                                        <SelectContent className="card-gradient rounded-xl p-1 shadow-lg">
                                            <SelectItem value="advisor" className="cursor-pointer rounded-md text-sm focus:bg-gray-100 dark:focus:bg-gray-800">{t('users.roles.advisor')}</SelectItem>
                                            <SelectItem value="admin" className="cursor-pointer rounded-md text-sm focus:bg-gray-100 dark:focus:bg-gray-800">{t('users.roles.admin')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <InputError message={createForm.errors.role} />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 border-t border-[#d4d8e8]/80 pt-4 dark:border-white/10">
                                <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)} className="rounded-xl text-sm settings-btn-secondary">
                                    {t('common.cancel')}
                                </Button>
                                <Button type="submit" disabled={createForm.processing} className="rounded-xl text-sm settings-btn-primary disabled:opacity-50">
                                    {createForm.processing ? t('users.creating') : t('users.createUser')}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>

                <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
                    <DialogContent className="card-gradient overflow-hidden rounded-2xl p-0 shadow-2xl sm:max-w-xl sm:rounded-2xl">
                        <DialogHeader className="border-b border-[#d4d8e8]/80 px-5 py-4 dark:border-white/10">
                            <DialogTitle className="flex items-center gap-2 text-xl settings-title">
                                <Edit3 className="h-5 w-5 text-[#2e3f84] dark:text-neutral-100" />
                                {t('users.editTitle')}
                            </DialogTitle>
                            <DialogDescription className="text-xs settings-subtitle">
                                {t('users.editSubtitleFor', { name: userToEdit?.name })}
                            </DialogDescription>
                        </DialogHeader>

                        <form onSubmit={handleEdit} className="space-y-4 px-5 py-4">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label htmlFor="edit-name" className="flex items-center gap-2 text-xs font-semibold settings-label">
                                        <UserCircle className="h-3.5 w-3.5" />
                                        {t('users.fullName')}
                                    </Label>
                                    <Input
                                        id="edit-name"
                                        type="text"
                                        value={editForm.data.name}
                                        onChange={(event) => editForm.setData('name', event.target.value)}
                                        placeholder={t('users.fullNamePlaceholder')}
                                        className="rounded-xl text-sm settings-input focus:ring-2 focus:ring-[#2e3f84]/30"
                                        required
                                    />
                                    <InputError message={editForm.errors.name} />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="edit-email" className="flex items-center gap-2 text-xs font-semibold settings-label">
                                        <Mail className="h-3.5 w-3.5" />
                                        {t('auth.email')}
                                    </Label>
                                    <Input
                                        id="edit-email"
                                        type="email"
                                        value={editForm.data.email}
                                        onChange={(event) => editForm.setData('email', event.target.value)}
                                        placeholder={t('users.emailPlaceholder')}
                                        className="rounded-xl text-sm settings-input focus:ring-2 focus:ring-[#2e3f84]/30"
                                        required
                                    />
                                    <InputError message={editForm.errors.email} />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="edit-password" className="flex items-center gap-2 text-xs font-semibold settings-label">
                                        <KeyRound className="h-3.5 w-3.5" />
                                        {t('users.newPassword')} <span className="text-[10px] opacity-60">{t('users.optional')}</span>
                                    </Label>
                                    <Input
                                        id="edit-password"
                                        type="password"
                                        value={editForm.data.password}
                                        onChange={(event) => editForm.setData('password', event.target.value)}
                                        placeholder={t('users.newPasswordPlaceholder')}
                                        className="rounded-xl text-sm settings-input focus:ring-2 focus:ring-[#2e3f84]/30"
                                    />
                                    <InputError message={editForm.errors.password} />
                                </div>

                                <div className={cn('space-y-1.5 transition-opacity', !editForm.data.password && 'pointer-events-none opacity-35')}>
                                    <Label htmlFor="edit-password-confirm" className="flex items-center gap-2 text-xs font-semibold settings-label">
                                        <KeyRound className="h-3.5 w-3.5" />
                                        {t('users.confirmNewPassword')}
                                    </Label>
                                    <Input
                                        id="edit-password-confirm"
                                        type="password"
                                        value={editForm.data.password_confirmation}
                                        onChange={(event) => editForm.setData('password_confirmation', event.target.value)}
                                        placeholder={t('users.confirmNewPasswordPlaceholder')}
                                        className="rounded-xl text-sm settings-input focus:ring-2 focus:ring-[#2e3f84]/30"
                                        required={!!editForm.data.password}
                                    />
                                    <InputError message={editForm.errors.password_confirmation} />
                                </div>

                                <div className="space-y-1.5 md:col-span-2">
                                    <Label htmlFor="edit-role" className="flex items-center gap-2 text-xs font-semibold settings-label">
                                        <ShieldCheck className="h-3.5 w-3.5" />
                                        {t('users.role')}
                                    </Label>
                                    <Select value={editForm.data.role} onValueChange={(value) => editForm.setData('role', value as User['role'])}>
                                        <SelectTrigger className="h-10 w-full rounded-xl text-sm settings-input focus:ring-2 focus:ring-[#2e3f84]/30 sm:w-1/2">
                                            <SelectValue placeholder={t('users.selectRole')} />
                                        </SelectTrigger>
                                        <SelectContent className="card-gradient rounded-xl p-1 shadow-lg">
                                            <SelectItem value="advisor" className="cursor-pointer rounded-md text-sm focus:bg-gray-100 dark:focus:bg-gray-800">{t('users.roles.advisor')}</SelectItem>
                                            <SelectItem value="admin" className="cursor-pointer rounded-md text-sm focus:bg-gray-100 dark:focus:bg-gray-800">{t('users.roles.admin')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <InputError message={editForm.errors.role} />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 border-t border-[#d4d8e8]/80 pt-4 dark:border-white/10">
                                <Button type="button" variant="outline" onClick={() => setShowEditModal(false)} className="rounded-xl text-sm settings-btn-secondary">
                                    {t('common.cancel')}
                                </Button>
                                <Button type="submit" disabled={editForm.processing} className="rounded-xl text-sm settings-btn-primary disabled:opacity-50">
                                    {editForm.processing ? t('common.saving') : t('users.saveChanges')}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
        </AdminLayout>
    );
}
