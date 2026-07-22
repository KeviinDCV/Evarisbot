import { Link, usePage } from '@inertiajs/react';
import { type PropsWithChildren, type ReactNode, type PointerEvent as ReactPointerEvent, type FocusEvent as ReactFocusEvent, useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { Users, MessageSquare, Settings, LogOut, Menu, X, FileText, Calendar, BarChart3, Send, MessagesSquare, UserCircle, Lock, PanelLeftClose, PanelLeftOpen, type LucideIcon } from 'lucide-react';
import AppLogoIcon from '@/components/app-logo-icon';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { logout } from '@/routes';
import { useInitials } from '@/hooks/use-initials';
import { LanguageSelector } from '@/components/language-selector';
import { useTranslation } from 'react-i18next';
import AppearanceToggleDropdown from '@/components/appearance-dropdown';
import { MessageNotifications } from '@/components/message-notifications';
import { subscribeUnread, getUnread, seedUnreadChat, type UnreadState } from '@/lib/unread-store';
import { Toaster } from 'sonner';

interface AdminLayoutProps {
    children: ReactNode;
}

/** Mide antes del paint en el cliente (evita parpadeo de la cápsula al re-montar por
 *  navegación); cae a useEffect en SSR para no avisar en consola. */
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** Lee el estado fijado guardado, con guarda de SSR. */
function readPinned(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        return localStorage.getItem('evaris.rail.pinned') === '1';
    } catch {
        return false;
    }
}

type NavEntry = {
    href: string;
    title: string;
    icon: LucideIcon;
    /** Cuenta viva que alimenta la barra de señal y la píldora. */
    badge?: 'chat' | 'internal';
    /** El asesor sólo lo ve si tiene el permiso. */
    needsBulk?: boolean;
    /** Rutas extra que también marcan este ítem como activo. */
    alsoMatches?: string[];
};

/**
 * EL RIEL NAVEGA ENTRE SECCIONES; LA SECCIÓN NAVEGA DENTRO DE SÍ MISMA.
 *
 * Por eso Citas es UN icono sin chevron: el submenú General/Oncología (que antes
 * vivía como texto de 9px dentro de un riel de 80px) ahora es un segmentado en la
 * cabecera de la propia página de Citas.
 *
 * La agrupación coincide exactamente con el filtro de rol: TRABAJO es lo que hace
 * un asesor; GESTIÓN es lo admin-only. El rol no esconde cosas — hace el objeto
 * físicamente más pequeño.
 */
const GROUPS: { key: string; label: string; adminOnly?: boolean; items: NavEntry[] }[] = [
    {
        key: 'trabajo',
        label: 'Trabajo',
        items: [
            { href: '/admin/chat', title: 'navigation.conversations', icon: MessageSquare, badge: 'chat' },
            { href: '/admin/internal-chat', title: 'navigation.internalChat', icon: MessagesSquare, badge: 'internal' },
            { href: '/admin/templates', title: 'navigation.templates', icon: FileText },
            { href: '/admin/bulk-sends', title: 'navigation.bulkSends', icon: Send, needsBulk: true },
        ],
    },
    {
        key: 'gestion',
        label: 'Gestión',
        adminOnly: true,
        items: [
            { href: '/admin/appointments', title: 'navigation.appointments', icon: Calendar, alsoMatches: ['/admin/oncology-appointments'] },
            { href: '/admin/statistics', title: 'navigation.statistics', icon: BarChart3 },
            { href: '/admin/users', title: 'navigation.users', icon: Users },
            { href: '/admin/settings', title: 'navigation.settings', icon: Settings },
        ],
    },
];

/** Rojo = un paciente espera. Slate = un colega espera. Nada más en el riel puede ir saturado.
 *  La barra de señal (decorativa, aria-hidden) puede ir clara; la PÍLDORA lleva dígitos blancos
 *  de 10px, así que su relleno debe cumplir 4.5:1 con el blanco: #dc2626 = 4.83:1, #475569 = 7.58:1. */
const TONE = {
    chat: { bar: '#ef4444', pill: 'bg-[#dc2626]' },
    internal: { bar: '#94a3b8', pill: 'bg-[#475569]' },
} as const;

/** La presión se lee sin leer un dígito. */
function barHeight(n: number): string {
    if (n <= 0) return '0%';
    if (n <= 3) return '33%';
    if (n <= 10) return '66%';
    return '100%';
}

export default function AdminLayout({ children }: PropsWithChildren<AdminLayoutProps>) {
    const { t } = useTranslation();
    const { auth, unreadConversationsCount: initialUnreadCount = 0 } = usePage().props as any;
    const currentUrl = usePage().url;
    const getInitials = useInitials();

    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [hoverOpen, setHoverOpen] = useState(false);
    // Estado inicial leído YA de localStorage: si estaba fijado, el riel se pinta
    // expandido en el primer render, sin animación de apertura al navegar entre páginas
    // (el layout se re-monta por página porque no es un layout persistente de Inertia).
    const [pinned, setPinned] = useState(readPinned);
    const [carnetOpen, setCarnetOpen] = useState(false);

    // Los contadores viven en un store a nivel de módulo (lib/unread-store): el layout se
    // re-monta en CADA navegación y, con el bucle dentro de un efecto, cada cambio de página
    // disparaba dos fetches inmediatos y reiniciaba el temporizador — justo lo que alimentaba
    // el ERR_NO_BUFFER_SPACE. Fuera de React, el bucle sobrevive a los re-montajes.
    const [unread, setUnread] = useState<UnreadState>(() => {
        const current = getUnread();
        // Semilla del servidor en el primer arranque (aún sin datos del store).
        return current.chat === 0 && current.internal === 0 ? { chat: initialUnreadCount, internal: 0 } : current;
    });
    const unreadConversationsCount = unread.chat;
    const unreadInternalChatCount = unread.internal;

    // Late una sola vez cuando ENTRA un mensaje (delta positivo), no en cada poll.
    const [pingChat, setPingChat] = useState(false);
    const prevChatRef = useRef<number>(initialUnreadCount);

    useEffect(() => {
        seedUnreadChat(initialUnreadCount);
        return subscribeUnread((next) => {
            setUnread(next);
            if (next.chat > prevChatRef.current) {
                setPingChat(true);
                setTimeout(() => setPingChat(false), 560);
            }
            prevChatRef.current = next.chat;
        });
        // initialUnreadCount cambia con cada respuesta de Inertia; sembrarlo no reinicia el bucle.
    }, [initialUnreadCount]);

    const railRef = useRef<HTMLElement>(null);
    const navRef = useRef<HTMLDivElement>(null);
    const carnetBtnRef = useRef<HTMLButtonElement>(null);
    const [capsuleTop, setCapsuleTop] = useState<number | null>(null);

    const isAdvisor = auth.user.role === 'advisor';
    /** El turno sólo existe para asesores: es lo que decide si te auto-asignan pacientes. */
    const onDuty = isAdvisor && Boolean(auth.user.is_on_duty);
    const expanded = pinned || hoverOpen || isMobileOpen;

    // ── El turno enciende el edificio: barrido teal al pasar de fuera → de turno ──
    const [sweep, setSweep] = useState(false);
    const prevDutyRef = useRef<boolean | null>(null);
    useEffect(() => {
        if (prevDutyRef.current === false && onDuty) {
            setSweep(true);
            const id = setTimeout(() => setSweep(false), 950);
            return () => clearTimeout(id);
        }
        prevDutyRef.current = onDuty;
    }, [onDuty]);

    const togglePin = useCallback(() => {
        setPinned((p) => {
            const next = !p;
            try {
                localStorage.setItem('evaris.rail.pinned', next ? '1' : '0');
            } catch {
                /* ignorar */
            }
            // Al DES-fijar, colapsa de una — aunque el cursor siga encima del riel
            // (si no, hoverOpen podría dejarlo abierto y parecería que "no cierra").
            if (!next) setHoverOpen(false);
            return next;
        });
    }, []);


    /**
     * UNA sola fuente de verdad para el filtro de rol: alimenta el riel, el tablero
     * y los atajos. Un asesor no puede llegar a /admin/users por ningún camino.
     */
    const visibleGroups = GROUPS.map((group) => {
        if (group.adminOnly && isAdvisor) return null;
        const items = group.items.filter((item) => {
            if (!item.needsBulk) return true;
            return !isAdvisor || Boolean(auth.user.can_bulk_send);
        });
        return items.length ? { ...group, items } : null;
    }).filter(Boolean) as { key: string; label: string; items: NavEntry[] }[];

    const isActive = useCallback(
        (item: NavEntry) =>
            currentUrl.startsWith(item.href) || (item.alsoMatches ?? []).some((h) => currentUrl.startsWith(h)),
        [currentUrl],
    );

    const badgeFor = (item: NavEntry) =>
        item.badge === 'chat' ? unreadConversationsCount : item.badge === 'internal' ? unreadInternalChatCount : 0;

    // La cápsula líquida viaja hasta el ítem activo. El eje de iconos NO se mueve al
    // abrir el tablero (las cabeceras de grupo mantienen alto constante), así que sólo
    // hace falta recalcular al cambiar de ruta o de rol.
    useIsoLayoutEffect(() => {
        const el = navRef.current?.querySelector<HTMLElement>('[data-active="true"]');
        setCapsuleTop(el ? el.offsetTop : null);
    }, [currentUrl, visibleGroups.length, isAdvisor]);

    // Apertura con intención: en /admin/chat el cursor cruza el riel decenas de veces
    // por hora camino a la lista de conversaciones. Sin la espera, el riel manotearía.
    const dwellRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const onRailEnter = () => {
        if (pinned) return;
        if (dwellRef.current) clearTimeout(dwellRef.current);
        dwellRef.current = setTimeout(() => setHoverOpen(true), 220);
    };
    /**
     * El popover del carnet manda: mientras esté abierto, sacar el cursor NO colapsa el riel.
     *
     * Tema e Idioma son dropdowns de Radix que se renderizan en un PORTAL fuera del <aside>
     * (y Radix pone pointer-events:none en el body al abrirlos). Sin esta guarda, abrirlos
     * hacía que el puntero "saliera" del riel, disparando pointerleave y cerrándolo todo.
     */
    const onRailLeave = () => {
        if (dwellRef.current) clearTimeout(dwellRef.current);
        if (carnetOpen) return;
        setHoverOpen(false);
    };

    /**
     * Expandir con TECLADO. hoverOpen sólo lo activaba el puntero, así que quien navega con
     * Tab recorría una columna de 64px de iconos sin etiqueta. El foco expande al instante:
     * la espera de 220ms existe para el aleteo del ratón, no para el foco.
     * (onFocus/onBlur de React burbujean, así que basta ponerlos en el <aside>.)
     */
    const onRailFocus = () => setHoverOpen(true);
    const onRailBlur = (e: ReactFocusEvent<HTMLElement>) => {
        if (pinned || carnetOpen) return;
        // El foco sigue dentro del riel: no colapsar.
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setHoverOpen(false);
    };

    const toggleCarnet = () => {
        const next = !carnetOpen;
        setCarnetOpen(next);
        if (next) setHoverOpen(true);
    };

    // Con el carnet abierto, el cierre es por clic fuera — ignorando los portales de Radix,
    // donde viven los menús de Tema/Idioma.
    useEffect(() => {
        if (!carnetOpen) return;
        const onDown = (e: MouseEvent) => {
            const target = e.target as HTMLElement | null;
            if (!target) return;
            if (railRef.current?.contains(target)) return;
            if (target.closest('[data-radix-popper-content-wrapper],[role="menu"],[role="listbox"]')) return;
            setCarnetOpen(false);
            setHoverOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [carnetOpen]);
    /**
     * Luz especular sin un solo re-render de React.
     *
     * El rect se cachea al entrar (el riel es fixed con inset fijo: su origen no cambia,
     * ni siquiera durante la transición de ancho) y la escritura de las vars se coalesce
     * con rAF. Antes se llamaba getBoundingClientRect() en CADA pointermove, y al leerlo
     * después de escribir las vars forzaba un recálculo de estilo por evento.
     */
    const rectRef = useRef<DOMRect | null>(null);
    const rafRef = useRef<number | null>(null);
    const posRef = useRef({ x: 0, y: 0 });

    const onRailMove = (e: ReactPointerEvent<HTMLElement>) => {
        const el = railRef.current;
        if (!el) return;
        const r = rectRef.current ?? (rectRef.current = el.getBoundingClientRect());
        posRef.current = { x: e.clientX - r.left, y: e.clientY - r.top };
        if (rafRef.current !== null) return;
        rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            const node = railRef.current;
            if (!node) return;
            node.style.setProperty('--mx', `${posRef.current.x}px`);
            node.style.setProperty('--my', `${posRef.current.y}px`);
        });
    };

    useEffect(
        () => () => {
            if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        },
        [],
    );

    // Atajos: Ctrl+B fija/contrae el riel · Esc lo cierra.
    // Ctrl+B es seguro porque ya existe el botón visible ‹| en la cabecera para des-fijar,
    // así que aunque se active sin querer siempre hay una salida a la vista.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
                // No secuestrar Ctrl+B mientras se escribe (el composer del chat es un
                // <textarea>): el asesor podría estar intentando poner negrita.
                const el = e.target as HTMLElement | null;
                if (el?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName ?? '')) return;
                e.preventDefault();
                togglePin();
            }
            if (e.key === 'Escape') {
                // Cerrar sólo la capa MÁS INTERNA: si el carnet está abierto, Esc lo cierra
                // y devuelve el foco al avatar — sin colapsar además el riel bajo el usuario.
                if (carnetOpen) {
                    setCarnetOpen(false);
                    carnetBtnRef.current?.focus();
                    return;
                }
                setHoverOpen(false);
                setIsMobileOpen(false);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [togglePin, carnetOpen]);

    return (
        <div className="relative min-h-screen bg-background">
            {/* Bypass Blocks (WCAG 2.4.1, nivel A): sin esto el teclado recorre todo el riel
                en CADA navegación. Debe ser el primer elemento enfocable del documento. */}
            <a
                href="#main-content"
                className="sr-only rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100]"
            >
                {t('common.skipToContent')}
            </a>

            {/* Botón de menú en móvil */}
            <button
                onClick={() => setIsMobileOpen((v) => !v)}
                className="fixed left-4 top-4 z-[60] rounded-xl bg-gradient-to-b from-[#3e4f94] to-[#2e3f84] p-3 text-white shadow-lg lg:hidden"
                aria-label={isMobileOpen ? t('common.closeMenu') : t('common.menu')}
                aria-expanded={isMobileOpen}
            >
                {isMobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>

            {isMobileOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}

            {/* ══════════════════════ EL PUESTO ══════════════════════ */}
            <aside
                ref={railRef}
                onPointerEnter={onRailEnter}
                onPointerLeave={onRailLeave}
                onFocus={onRailFocus}
                onBlur={onRailBlur}
                onPointerMove={onRailMove}
                aria-label={t('navigation.main', 'Navegación principal')}
                className={`puesto-rail fixed bottom-2 left-2 top-2 z-50 flex flex-col rounded-[22px] transition-[width,filter,transform] duration-200 ease-[cubic-bezier(.2,.8,.2,1)] ${
                    expanded ? 'w-[260px]' : 'w-16'
                } ${isMobileOpen ? 'translate-x-0' : '-translate-x-[110%] lg:translate-x-0'} ${
                    // Fuera de turno el edificio está apagado. Sólo aplica a asesores.
                    isAdvisor && !onDuty ? 'saturate-[.72]' : 'saturate-100'
                }`}
            >
                {/* El hilo: sólo existe si estás de turno */}
                {onDuty && <span className="puesto-hilo pointer-events-none absolute bottom-6 right-0 top-6 w-0.5 rounded-full" />}
                {sweep && <span className="puesto-sweep pointer-events-none absolute -right-px h-20 w-1 rounded-full" />}

                {/* Logo */}
                <div className="flex h-16 flex-shrink-0 items-center gap-3 pl-[14px]">
                    <AppLogoIcon className="puesto-logo h-9 w-9 flex-shrink-0 object-contain" />
                    <span
                        className={`whitespace-nowrap text-sm font-semibold tracking-[0.14em] text-white transition-opacity duration-150 ${
                            expanded ? 'opacity-90' : 'opacity-0'
                        }`}
                    >
                        EVARISBOT
                    </span>

                    {/* Botón VISIBLE de contraer/fijar: la única forma segura de cerrar el riel
                        cuando quedó abierto. Sólo aparece expandido (colapsado no cabe junto al logo). */}
                    {expanded && (
                        <button
                            onClick={togglePin}
                            aria-label={pinned ? t('navigation.collapseMenu', 'Contraer menú') : t('navigation.pinMenu', 'Fijar menú abierto')}
                            title={pinned ? t('navigation.collapseMenu', 'Contraer menú') : t('navigation.pinMenu', 'Fijar menú abierto')}
                            className="ml-auto mr-3 hidden flex-shrink-0 rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white lg:inline-flex"
                        >
                            {pinned ? <PanelLeftClose className="h-[18px] w-[18px]" /> : <PanelLeftOpen className="h-[18px] w-[18px]" />}
                        </button>
                    )}
                </div>
                <div className="mx-3 h-px flex-shrink-0 bg-white/10" />

                {/* Notificaciones en segundo plano (invisible, global) */}
                <MessageNotifications />

                {/* ── Navegación ── */}
                {/* overflow visible: si no, el riel recortaría los tooltips del estado colapsado */}
                <nav ref={navRef} className="relative min-h-0 flex-1 overflow-visible py-2.5">
                    {/* LA CÁPSULA LÍQUIDA — el único elemento claro sobre oscuro.
                        top-0 es obligatorio: sin él, el absoluto cae en su posición estática
                        y sumaría el padding del nav sobre el offsetTop, quedando desfasada. */}
                    {capsuleTop !== null && (
                        <span
                            aria-hidden
                            className="pointer-events-none absolute left-2.5 top-0 z-0 h-10 rounded-[14px] bg-white/[0.96] shadow-[0_2px_10px_rgba(0,0,0,0.14)] transition-[transform,width] duration-[420ms] ease-[cubic-bezier(.2,.8,.2,1)]"
                            style={{ transform: `translateY(${capsuleTop + 2}px)`, width: expanded ? 'calc(100% - 20px)' : '44px' }}
                        />
                    )}

                    {visibleGroups.map((group) => (
                        <div key={group.key}>
                            {/* Alto CONSTANTE: al abrir, los iconos no se mueven ni un píxel. */}
                            <div className="flex h-6 items-center pl-16 pr-3">
                                <span
                                    // /70 (no /45): a 10px el contraste manda. La jerarquía la dan
                                    // el tamaño y el tracking, no bajar el alfa hasta romper AA.
                                    className={`whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.08em] text-white/70 transition-opacity duration-150 ${
                                        expanded ? 'opacity-100' : 'opacity-0'
                                    }`}
                                >
                                    {group.label}
                                </span>
                            </div>

                            {group.items.map((item) => {
                                const Icon = item.icon;
                                const active = isActive(item);
                                const count = badgeFor(item);
                                const tone = item.badge ? TONE[item.badge] : null;

                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        data-active={active ? 'true' : undefined}
                                        onClick={() => setIsMobileOpen(false)}
                                        aria-current={active ? 'page' : undefined}
                                        className={`group relative z-10 flex h-11 w-full items-center transition-colors ${
                                            active ? 'text-[#2e3f84]' : 'text-white/75 hover:text-white'
                                        }`}
                                    >
                                        {/* Barra de señal: la presión, sin leer un dígito. Va DENTRO del riel. */}
                                        {tone && count > 0 && (
                                            <span
                                                aria-hidden
                                                className="absolute left-[7px] top-1/2 w-[3px] -translate-y-1/2 rounded-full transition-[height] duration-300"
                                                style={{ height: barHeight(count), maxHeight: '26px', background: tone.bar }}
                                            />
                                        )}

                                        {/* Fondo de hover que NO compite con la cápsula */}
                                        {!active && (
                                            <span
                                                aria-hidden
                                                className="pointer-events-none absolute left-2.5 top-0.5 -z-10 h-10 rounded-[14px] bg-white/0 transition-[background-color,width] duration-150 group-hover:bg-white/[0.08]"
                                                style={{ width: expanded ? 'calc(100% - 20px)' : '44px' }}
                                            />
                                        )}

                                        {/* Eje de iconos CONGELADO en x=32 */}
                                        <span className="flex w-16 flex-shrink-0 items-center justify-center">
                                            <Icon className="h-5 w-5" strokeWidth={active ? 2 : 1.75} />
                                        </span>

                                        <span
                                            className={`min-w-0 flex-1 truncate pr-3 text-sm transition-opacity duration-150 ${
                                                expanded ? 'opacity-100' : 'opacity-0'
                                            } ${active ? 'font-semibold' : 'font-medium'}`}
                                        >
                                            {t(item.title)}
                                        </span>

                                        {/* Píldora con el número EXACTO. Nunca toca el glifo: el icono ocupa
                                            22–42px y la píldora arranca en 44px, así que al crecer lo hace
                                            hacia afuera. El anillo del color del riel la vuelve una insignia
                                            montada en el borde, no una mancha pegada al icono. */}
                                        {tone && count > 0 && (
                                            <span
                                                // Sin aria-label el lector anunciaba "Conversaciones 239" —
                                                // un número suelto sin significado.
                                                aria-label={t('navigation.unreadCount', { count })}
                                                className={`absolute top-1.5 z-20 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-[5px] text-[10px] font-bold tabular-nums text-white ring-2 ring-[#2e3f84] dark:ring-[#1b2246] ${
                                                    tone.pill
                                                } ${pingChat && item.badge === 'chat' ? 'puesto-ping' : ''} ${
                                                    expanded ? 'right-3 top-3' : 'left-[44px]'
                                                }`}
                                            >
                                                {count > 999 ? '999+' : count}
                                            </span>
                                        )}

                                        {/* Tooltip sólo cuando el riel está colapsado */}
                                        {!expanded && (
                                            // group-focus-visible además de hover: con el riel colapsado
                                            // ésta es la ÚNICA etiqueta visible, y el foco por teclado
                                            // no expande el riel — sin esto el usuario de teclado no ve nada.
                                            // aria-hidden: es una ayuda VISUAL que repite el nombre del enlace
                                            // (que ya está en el span de la etiqueta). Sin esto el lector
                                            // anunciaba "Conversaciones 239 Conversaciones".
                                            <span
                                                aria-hidden
                                                // Navy institucional en vez del gris genérico, con una
                                                // flecha que lo ancla al icono: se lee como parte del riel.
                                                className="pointer-events-none absolute left-full top-1/2 z-[70] ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#26356f] px-2.5 py-1.5 text-[13px] font-medium text-white opacity-0 shadow-xl ring-1 ring-white/10 transition-opacity duration-150 before:absolute before:right-full before:top-1/2 before:-translate-y-1/2 before:border-4 before:border-transparent before:border-r-[#26356f] before:content-[''] group-hover:opacity-100 group-focus-visible:opacity-100 lg:block"
                                            >
                                                {t(item.title)}
                                            </span>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    ))}
                </nav>

                {/* ── EL CARNET: un objeto se traga los cuatro controles de abajo ── */}
                <div className="relative flex-shrink-0 px-2.5 pb-3 pt-2">
                    <div className="mb-2 h-px bg-white/10" />

                    <button
                        ref={carnetBtnRef}
                        onClick={toggleCarnet}
                        aria-haspopup="dialog"
                        aria-expanded={carnetOpen}
                        className="flex w-full items-center rounded-[14px] py-1 transition-colors hover:bg-white/[0.08]"
                    >
                        <span className="relative flex w-[44px] flex-shrink-0 items-center justify-center">
                            {/* El anillo de turno: sólo tiene sentido para asesores. */}
                            {isAdvisor && (
                                <>
                                    <svg viewBox="0 0 46 46" className="pointer-events-none absolute h-[46px] w-[46px] -rotate-90">
                                        <circle
                                            cx="23"
                                            cy="23"
                                            r="20"
                                            fill="none"
                                            strokeWidth="2.5"
                                            strokeLinecap="round"
                                            stroke={onDuty ? 'rgba(255,255,255,0.16)' : 'rgba(148,163,184,0.5)'}
                                            strokeDasharray={onDuty ? undefined : '3 4'}
                                        />
                                        {onDuty && (
                                            <circle
                                                cx="23"
                                                cy="23"
                                                r="20"
                                                fill="none"
                                                stroke="#2dd4bf"
                                                strokeWidth="2.5"
                                                strokeLinecap="round"
                                                strokeDasharray="126"
                                                strokeDashoffset="0"
                                                style={{ transition: 'stroke-dashoffset 500ms cubic-bezier(.2,.8,.2,1)' }}
                                            />
                                        )}
                                    </svg>
                                    {onDuty && (
                                        <svg viewBox="0 0 46 46" className="puesto-ecg pointer-events-none absolute h-[46px] w-[46px]">
                                            <path d="M23 3a20 20 0 1 1-.01 0" fill="none" stroke="#5eead4" strokeWidth="1.6" strokeLinecap="round" />
                                        </svg>
                                    )}
                                </>
                            )}
                            <Avatar
                                className={`h-[34px] w-[34px] transition-[filter] duration-500 ${
                                    isAdvisor && !onDuty ? 'grayscale-[.7]' : ''
                                }`}
                            >
                                <AvatarImage src={auth.user?.avatar} alt={auth.user?.name} />
                                <AvatarFallback className="bg-gradient-to-br from-[#4e5fa4] to-[#2e3a75] text-xs font-bold text-white">
                                    {getInitials(auth.user?.name)}
                                </AvatarFallback>
                            </Avatar>
                        </span>

                        <span
                            className={`min-w-0 flex-1 pl-1 pr-2 text-left transition-opacity duration-150 ${
                                expanded ? 'opacity-100' : 'opacity-0'
                            }`}
                        >
                            <span className="block truncate text-[13px] font-semibold text-white">{auth.user?.name}</span>
                            <span
                                className={`block truncate text-[11px] font-semibold ${
                                    isAdvisor ? (onDuty ? 'text-[#2dd4bf]' : 'text-white/60') : 'text-white/60'
                                }`}
                            >
                                {isAdvisor
                                    ? onDuty
                                        ? t('navigation.onDuty', 'De turno')
                                        : t('navigation.offDuty', 'Fuera de turno')
                                    : t('navigation.admin', 'Administrador')}
                            </span>
                        </span>
                    </button>

                    {/* Popover del carnet: turno + tema + idioma + perfil + salir */}
                    {carnetOpen && (
                        <div
                            role="dialog"
                            aria-label={t('navigation.yourStation', 'Tu puesto')}
                            className="absolute bottom-[72px] left-2 z-[80] w-[248px] rounded-2xl border border-border bg-card p-3 shadow-2xl"
                        >
                            {isAdvisor && (
                                <>
                                    <p className="text-[13px] font-semibold text-foreground">
                                        {onDuty ? t('navigation.onDuty', 'De turno') : t('navigation.offDuty', 'Fuera de turno')}
                                    </p>
                                    <p className="mb-2 text-[11px] text-muted-foreground">
                                        {onDuty
                                            ? t('navigation.onDutyHint', 'Recibes conversaciones nuevas.')
                                            : t('navigation.offDutyHint', 'No se te asignan conversaciones.')}
                                    </p>
                                    {/*
                                        El turno es de SOLO LECTURA para el asesor, y es una decisión de
                                        correctitud: SettingsController pone TODOS los asesores en false antes
                                        de aplicar el roster, así que un interruptor propio se borraría al
                                        siguiente guardado y dejaría de recibir pacientes sin que nadie se entere.
                                    */}
                                    <div className="mb-3 flex items-start gap-2 rounded-lg bg-muted p-2 text-[11px] leading-snug text-muted-foreground">
                                        <Lock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                                        <span>{t('navigation.dutyReadOnly', 'Tu turno lo asigna coordinación desde Configuración.')}</span>
                                    </div>
                                    <div className="mb-2 h-px bg-border" />
                                </>
                            )}

                            <div className="flex items-center justify-between py-1">
                                <span className="text-[13px] text-foreground">{t('common.theme', 'Tema')}</span>
                                <AppearanceToggleDropdown />
                            </div>
                            <div className="flex items-center justify-between py-1">
                                <span className="text-[13px] text-foreground">{t('common.language', 'Idioma')}</span>
                                <LanguageSelector variant="admin" />
                            </div>

                            <div className="my-2 h-px bg-border" />

                            <Link
                                href="/settings/profile"
                                onClick={() => setCarnetOpen(false)}
                                className="flex w-full items-center gap-2 rounded-lg p-2 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
                            >
                                <UserCircle className="h-4 w-4" />
                                {t('navigation.profile', 'Perfil')}
                            </Link>
                            <Link
                                href={logout()}
                                method="post"
                                as="button"
                                className="flex w-full items-center gap-2 rounded-lg p-2 text-[13px] font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                            >
                                <LogOut className="h-4 w-4" />
                                {t('common.logout')}
                            </Link>
                        </div>
                    )}
                </div>
            </aside>

            {/* ══════════════════════ Lienzo ══════════════════════ */}
            <main
                id="main-content"
                tabIndex={-1}
                className={`min-h-screen min-w-0 overflow-x-hidden pt-16 outline-none transition-[padding] duration-200 ease-[cubic-bezier(.2,.8,.2,1)] lg:pt-0 ${
                    pinned ? 'lg:pl-[276px]' : 'lg:pl-20'
                }`}
            >
                {children}
            </main>

            <Toaster position="bottom-right" richColors closeButton duration={4000} />
        </div>
    );
}
