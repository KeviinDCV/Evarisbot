import AppLogoIcon from '@/components/app-logo-icon';
import AppearanceToggleDropdown from '@/components/appearance-dropdown';
import { LanguageSelector } from '@/components/language-selector';
import { MessageNotifications } from '@/components/message-notifications';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useInitials } from '@/hooks/use-initials';
import { GROUPS, PINNED_KEY, readPinned, type NavEntry, type NavGroupDef } from '@/layouts/admin-nav';
import { setMarcoShell } from '@/lib/shell-preference';
import { getUnread, seedUnreadChat, subscribeUnread, type UnreadState } from '@/lib/unread-store';
import { logout } from '@/routes';
import { type SharedData } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { Lock, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Undo2, UserCircle, X } from 'lucide-react';
import { type CSSProperties, type FocusEvent as ReactFocusEvent, type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Avisos } from '@/components/avisos';

/**
 * EL MARCO NAVY — el menú nuevo (detrás del interruptor de lib/shell-preference).
 *
 * El navy deja de ser una pieza flotante y pasa a ser el MARCO de toda la app: el menú vive
 * directamente sobre él y el contenido de cada página va en una ISLA clara con esquinas
 * redondeadas. Diseño aprobado: design/usuarios/_marco.mjs (medidas, tintas y contrastes).
 *
 * Todo lo FUNCIONAL es el riel de hoy (admin-layout.tsx) sin cambios: filtro de rol,
 * contadores vivos, fijar/desfijar, Ctrl+B, Esc por capas, carnet, turno del asesor.
 * Lo que cambia es la forma. El CSS vive en el bloque .marco-* de app.css.
 */

/** Mide antes del paint en el cliente; cae a useEffect en SSR para no avisar en consola. */
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** Posición de la cápsula activa en la página ANTERIOR. El layout se re-monta en cada
 *  navegación (no es un layout persistente de Inertia): sin esta memoria la cápsula
 *  aparecería de golpe en su sitio en vez de viajar desde el ítem que se acaba de dejar. */
let capsulaPrevia: { top: number; href: string } | null = null;

/** Menos movimiento pedido por el sistema: la cápsula salta en vez de viajar. */
function prefiereMenosMovimiento(): boolean {
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

type PageProps = SharedData & { unreadConversationsCount?: number };

export default function MarcoLayout({ children }: { children: ReactNode }) {
    const { t } = useTranslation();
    const { auth, unreadConversationsCount: initialUnreadCount = 0 } = usePage<PageProps>().props;
    const currentUrl = usePage().url;
    const getInitials = useInitials();

    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [hoverOpen, setHoverOpen] = useState(false);
    // Leído YA de localStorage (misma clave que el riel de hoy): si estaba fijado, el menú
    // se pinta expandido en el primer render, sin animación de apertura al navegar.
    const [pinned, setPinned] = useState(readPinned);
    const [carnetOpen, setCarnetOpen] = useState(false);

    // ── Contadores vivos: el mismo store de módulo que el riel de hoy (ver unread-store). ──
    const [unread, setUnread] = useState<UnreadState>(() => {
        const current = getUnread();
        return current.chat === 0 && current.internal === 0 ? { chat: initialUnreadCount, internal: 0 } : current;
    });
    const [pingChat, setPingChat] = useState(false);
    const prevChatRef = useRef<number>(initialUnreadCount);

    useEffect(() => {
        seedUnreadChat(initialUnreadCount);
        return subscribeUnread((next) => {
            setUnread(next);
            // Late una sola vez cuando ENTRA un mensaje (delta positivo), no en cada poll.
            if (next.chat > prevChatRef.current) {
                setPingChat(true);
                setTimeout(() => setPingChat(false), 560);
            }
            prevChatRef.current = next.chat;
        });
    }, [initialUnreadCount]);

    const railRef = useRef<HTMLElement>(null);
    const navRef = useRef<HTMLElement>(null);
    const carnetBtnRef = useRef<HTMLButtonElement>(null);

    const isAdvisor = auth.user.role === 'advisor';
    /** El turno sólo existe para asesores: es lo que decide si te auto-asignan pacientes. */
    const onDuty = isAdvisor && Boolean(auth.user.is_on_duty);
    const expanded = pinned || hoverOpen || isMobileOpen;
    /** Expandido SIN fijar (en escritorio): el menú flota encima de la isla como un panel. */
    const overlay = hoverOpen && !pinned && !isMobileOpen;

    // ── Al entrar de turno, un barrido teal sube por el borde del menú ──
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
                localStorage.setItem(PINNED_KEY, next ? '1' : '0');
            } catch {
                /* ignorar */
            }
            // Al DES-fijar, colapsa de una aunque el cursor siga encima del menú.
            if (!next) setHoverOpen(false);
            return next;
        });
    }, []);

    /** UNA sola fuente de verdad para el filtro de rol (la misma regla que el riel de hoy). */
    const visibleGroups = GROUPS.map((group) => {
        if (group.adminOnly && isAdvisor) return null;
        const items = group.items.filter((item) => {
            if (!item.needsBulk) return true;
            return !isAdvisor || Boolean(auth.user.can_bulk_send);
        });
        return items.length ? { ...group, items } : null;
    }).filter(Boolean) as NavGroupDef[];

    const isActive = useCallback(
        (item: NavEntry) =>
            currentUrl.startsWith(item.href) || (item.alsoMatches ?? []).some((h) => currentUrl.startsWith(h)),
        [currentUrl],
    );
    const activeHref = visibleGroups.flatMap((g) => g.items).find(isActive)?.href ?? null;

    const badgeFor = (item: NavEntry) => (item.badge === 'chat' ? unread.chat : item.badge === 'internal' ? unread.internal : 0);

    // ── LA CÁPSULA QUE VIAJA ──
    // El blanco del ítem activo es UN elemento que se desliza al destino. El "look" activo
    // (tinta navy) sigue a la cápsula y no a la URL: mientras viaja, el ítem que se deja
    // conserva su tinta y el nuevo aún no se pinta navy sobre navy. El eje de iconos no se
    // mueve al expandir (las cabeceras de grupo tienen alto fijo): sólo cuenta la ruta.
    const [capsula, setCapsula] = useState<{ top: number; href: string } | null>(() => capsulaPrevia);
    useIsoLayoutEffect(() => {
        const el = navRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
        const next = el && activeHref ? { top: el.offsetTop, href: activeHref } : null;
        capsulaPrevia = next;
        if (capsula && next && capsula.top === next.top && capsula.href === next.href) return;
        // Primera carga, sin destino o con menos movimiento: directo a su sitio, antes del paint.
        if (!capsula || !next || prefiereMenosMovimiento()) {
            setCapsula(next);
            return;
        }
        // Pinta un fotograma en la posición anterior y después viaja (doble rAF: el primero
        // puede caer antes del primer paint del layout recién montado).
        let r2 = 0;
        const r1 = requestAnimationFrame(() => {
            r2 = requestAnimationFrame(() => setCapsula(next));
        });
        return () => {
            cancelAnimationFrame(r1);
            cancelAnimationFrame(r2);
        };
    }, [activeHref, visibleGroups.length, isAdvisor, capsula]);

    // ── Apertura con intención (espera de 220ms): en /admin/chat el cursor cruza el menú
    // decenas de veces por hora camino a la lista de conversaciones. ──
    const dwellRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(
        () => () => {
            if (dwellRef.current) clearTimeout(dwellRef.current);
        },
        [],
    );
    const onRailEnter = () => {
        if (pinned) return;
        if (dwellRef.current) clearTimeout(dwellRef.current);
        dwellRef.current = setTimeout(() => setHoverOpen(true), 220);
    };
    /** Con el carnet abierto, sacar el cursor NO colapsa: Tema e Idioma son dropdowns de
     *  Radix en un PORTAL fuera del <aside>, y abrirlos dispara pointerleave. */
    const onRailLeave = () => {
        if (dwellRef.current) clearTimeout(dwellRef.current);
        if (carnetOpen) return;
        setHoverOpen(false);
    };

    /** El foco de teclado expande al instante: la espera existe para el ratón, no para el foco. */
    const onRailFocus = () => setHoverOpen(true);
    const onRailBlur = (e: ReactFocusEvent<HTMLElement>) => {
        if (pinned || carnetOpen) return;
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

    // Atajos: Ctrl+B fija/contrae el menú · Esc cierra por capas (carnet → menú → cajón).
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
                // No secuestrar Ctrl+B mientras se escribe (negrita en el compositor del chat).
                const el = e.target as HTMLElement | null;
                if (el?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName ?? '')) return;
                e.preventDefault();
                togglePin();
            }
            if (e.key === 'Escape') {
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

    /** Contador: el número exacto (999+ como tope) con su significado para el lector. */
    const contador = (item: NavEntry, count: number, shownActive: boolean) => {
        const chat = item.badge === 'chat';
        const tinta = expanded
            ? chat
                ? 'bg-[#dc2626] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.18),0_1px_2px_rgba(0,0,0,.3)]'
                : shownActive
                  ? // Sobre la cápsula BLANCA la píldora translúcida desaparecería: pasa a navy suave.
                    'bg-[#2e3f84]/10 text-[#2e3f84] shadow-[inset_0_0_0_1px_rgba(46,63,132,.14)]'
                  : 'bg-white/[0.14] text-slate-200 shadow-[inset_0_0_0_1px_rgba(255,255,255,.1)]'
            : chat
              ? 'bg-[#dc2626] text-white'
              : 'marco-pildora-interna text-slate-100';
        return (
            <span
                aria-label={t('navigation.unreadCount', { count })}
                className={`flex flex-shrink-0 items-center justify-center rounded-full font-bold tabular-nums leading-none ${tinta} ${
                    expanded
                        ? 'relative ml-2 mr-2.5 h-5 min-w-5 px-1.5 text-[11px] tracking-[.01em]'
                        : // Plegado: insignia montada en la esquina superior derecha de la cápsula,
                          // con anillo del color del marco. Arranca en x=46, a la derecha del glifo
                          // (27–45): al crecer lo hace hacia afuera y nunca tapa el icono.
                          'absolute -top-1 left-[34px] z-20 h-[18px] min-w-[18px] px-[5px] text-[10px] ring-2 ring-[color:var(--marco-anillo)]'
                } ${pingChat && chat ? 'marco-ping' : ''}`}
            >
                {count > 999 ? '999+' : count}
            </span>
        );
    };

    return (
        <div className="marco-raiz relative min-h-screen bg-background lg:fixed lg:inset-0">
            {/* Bypass Blocks (WCAG 2.4.1): primer elemento enfocable del documento. */}
            <a
                href="#main-content"
                className="sr-only rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100]"
            >
                {t('common.skipToContent')}
            </a>

            {/* Móvil: con el cajón abierto el botón sale a la capa oscura, a la derecha del
                cajón, para no tapar la baldosa del logo. */}
            <button
                onClick={() => setIsMobileOpen((v) => !v)}
                className={`fixed top-4 z-[60] rounded-xl bg-gradient-to-b from-[#3e4f94] to-[#2e3f84] p-3 text-white shadow-lg transition-[left] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] lg:hidden ${
                    isMobileOpen ? 'left-[252px]' : 'left-4'
                }`}
                aria-label={isMobileOpen ? t('common.closeMenu') : t('common.menu')}
                aria-expanded={isMobileOpen}
            >
                {isMobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>

            {isMobileOpen && <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setIsMobileOpen(false)} />}

            {/* ══════════════════════ EL MENÚ ══════════════════════
                Ocupa todo el alto desde (0,0). Sin fondo propio: el marco se ve a través. Lo que
                pinta es .marco-panel, con el MISMO degradado anclado al viewport, así que casa sin
                costura con el marco; al expandirse sin fijar, ese panel tapa la isla. Ningún
                transform en escritorio (el cajón móvil sólo se desliza bajo lg). */}
            <aside
                ref={railRef}
                onPointerEnter={onRailEnter}
                onPointerLeave={onRailLeave}
                onFocus={onRailFocus}
                onBlur={onRailBlur}
                aria-label={t('navigation.main', 'Navegación principal')}
                className={`fixed inset-y-0 left-0 z-50 flex w-[240px] flex-col transition-[width] duration-200 ease-[cubic-bezier(.2,.8,.2,1)] max-lg:transition-[translate,visibility] max-lg:duration-300 ${
                    expanded ? 'lg:w-[240px]' : 'lg:w-[72px]'
                } ${isMobileOpen ? 'max-lg:translate-x-0' : 'max-lg:invisible max-lg:-translate-x-full'}`}
            >
                <div
                    aria-hidden
                    className={`marco-panel pointer-events-none absolute inset-0 rounded-r-[22px] lg:inset-y-[10px] lg:right-px ${
                        overlay ? 'marco-panel--flota' : ''
                    } ${isMobileOpen ? 'marco-panel--cajon' : ''}`}
                />

                {sweep && <span className="marco-barrido pointer-events-none absolute -right-px h-20 w-1 rounded-full" />}

                {/* Notificaciones en segundo plano (invisible, global): UNA sola vez. */}
                <MessageNotifications />

                {/* Contenido del menú. Fuera de turno "el edificio está apagado": el filtro va
                    AQUÍ y no en el <aside>, para no desaturar el panel (haría costura con el marco)
                    ni el popover del carnet. */}
                <div
                    className={`relative flex min-h-0 flex-1 flex-col pb-2.5 pt-6 transition-[filter] duration-500 ${
                        isAdvisor && !onDuty ? 'saturate-[.72]' : ''
                    }`}
                >
                    {/* ── Cabecera: ALTO FIJO (120px) en los dos estados; si no, los iconos
                        saltarían al expandir. Plegado queda la baldosa sola, en el eje x=36. ── */}
                    <div className="h-[120px] flex-shrink-0">
                        <div className="flex h-16 items-start">
                            <div
                                className={`flex flex-shrink-0 items-center justify-center bg-white shadow-[0_1px_1px_rgba(0,0,0,.18),0_10px_22px_-10px_rgba(0,0,0,.55),inset_0_-1px_0_rgba(46,63,132,.08)] transition-[width,height,margin,border-radius] duration-200 ease-[cubic-bezier(.2,.8,.2,1)] ${
                                    expanded ? 'ml-6 h-16 w-16 rounded-[14px]' : 'ml-[14px] h-11 w-11 rounded-xl'
                                }`}
                            >
                                {/* El logo a su color real (line-art azul) sobre blanco: aquí no se
                                    aplana a blanco como en el riel de hoy. */}
                                <AppLogoIcon
                                    className={`marco-logo block object-contain transition-[width,height] duration-200 ease-[cubic-bezier(.2,.8,.2,1)] ${
                                        expanded ? 'h-12 w-[60px]' : 'h-8 w-10'
                                    }`}
                                />
                            </div>

                            {/* Contraer/fijar: la salida siempre visible cuando está expandido. */}
                            {expanded && (
                                <button
                                    type="button"
                                    onClick={togglePin}
                                    aria-label={pinned ? t('navigation.collapseMenu', 'Contraer menú') : t('navigation.pinMenu', 'Fijar menú abierto')}
                                    title={pinned ? t('navigation.collapseMenu', 'Contraer menú') : t('navigation.pinMenu', 'Fijar menú abierto')}
                                    className="ml-auto mr-5 mt-[17px] hidden h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-[10px] bg-white/[0.06] text-white/[0.72] shadow-[inset_0_0_0_1px_rgba(255,255,255,.08)] transition-colors hover:bg-white/[0.12] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 lg:inline-flex"
                                >
                                    {pinned ? (
                                        <PanelLeftClose className="h-[18px] w-[18px]" strokeWidth={1.75} />
                                    ) : (
                                        <PanelLeftOpen className="h-[18px] w-[18px]" strokeWidth={1.75} />
                                    )}
                                </button>
                            )}
                        </div>

                        {/* overflow-hidden: plegado, el texto invisible NO puede asomar sobre la isla
                            (captaría los clics de la cabecera de la página). */}
                        <div
                            className={`mt-3.5 flex flex-col gap-0.5 overflow-hidden whitespace-nowrap pl-6 pr-2.5 transition-opacity duration-150 ${
                                expanded ? 'opacity-100' : 'opacity-0'
                            }`}
                        >
                            <span className="text-[18px] font-semibold leading-6 tracking-[-0.018em] text-white">Evarisbot</span>
                            <span className="text-xs font-medium leading-4 text-white/70">{t('navigation.institution', 'Hospital Universitario del Valle')}</span>
                        </div>
                    </div>

                    {/* ── Navegación ── overflow visible: si no, recortaría tooltips e insignias. */}
                    <nav ref={navRef} className="relative mt-7 flex min-h-0 flex-1 flex-col gap-5 overflow-visible">
                        {/* LA CÁPSULA: blanca, con la sombra que la despega del marco sin halo.
                            top-0 obligatorio: el translate parte del borde del <nav>. */}
                        {capsula !== null && (
                            <span
                                aria-hidden
                                className="pointer-events-none absolute left-3 top-0 z-0 h-10 rounded-[10px] bg-white shadow-[0_1px_2px_rgba(0,0,0,.2),0_8px_18px_-10px_rgba(0,0,0,.45)] transition-[transform,width] duration-[420ms] ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none"
                                style={{ transform: `translateY(${capsula.top}px)`, width: expanded ? 218 : 48 }}
                            />
                        )}

                        {visibleGroups.map((group) => (
                            <div key={group.key} className="flex flex-col gap-0.5">
                                {/* Alto CONSTANTE (28px): al abrir, los iconos no se mueven ni un píxel.
                                    Plegado queda un filete corto en el eje; expandido, el nombre. */}
                                <div className="relative flex h-7 items-center overflow-hidden whitespace-nowrap pl-6 pr-2.5">
                                    <span
                                        aria-hidden
                                        className={`absolute left-7 top-1/2 h-px w-4 bg-white/15 transition-opacity duration-150 ${
                                            expanded ? 'opacity-0' : 'opacity-100'
                                        }`}
                                    />
                                    <span
                                        className={`text-[11px] font-semibold uppercase leading-none tracking-[0.09em] text-white/[0.66] transition-opacity duration-150 ${
                                            expanded ? 'opacity-100' : 'opacity-0'
                                        }`}
                                    >
                                        {t(group.label)}
                                    </span>
                                </div>

                                {group.items.map((item) => {
                                    const Icon = item.icon;
                                    const active = isActive(item);
                                    // La tinta sigue a la cápsula (ver arriba); el anuncio, a la URL.
                                    const shownActive = capsula ? capsula.href === item.href : active;
                                    const count = badgeFor(item);

                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            prefetch
                                            onClick={() => setIsMobileOpen(false)}
                                            aria-current={active ? 'page' : undefined}
                                            className={`group relative z-10 ml-3 flex h-10 flex-shrink-0 items-center rounded-[10px] transition-[width,background-color,color] duration-200 ease-[cubic-bezier(.2,.8,.2,1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 ${
                                                shownActive ? 'text-[#2e3f84]' : 'text-white/80 hover:bg-white/[0.08] hover:text-white'
                                            }`}
                                            style={{ width: expanded ? 218 : 48 }}
                                        >
                                            {/* Eje de iconos CONGELADO: el glifo de 18px ocupa x=27–45, centro
                                                en x=36, igual plegado (cápsula de 48) que expandido. */}
                                            <span className={`flex flex-shrink-0 pl-[15px] ${shownActive ? '' : 'text-white/[0.72] group-hover:text-white'}`}>
                                                <Icon className="h-[18px] w-[18px]" strokeWidth={shownActive ? 2 : 1.75} />
                                            </span>

                                            <span
                                                className={`ml-[9px] min-w-0 flex-1 truncate text-sm leading-5 tracking-[-0.003em] transition-opacity duration-150 ${
                                                    expanded ? 'opacity-100' : 'opacity-0'
                                                } ${shownActive ? 'font-semibold' : 'font-medium'}`}
                                            >
                                                {t(item.title)}
                                            </span>

                                            {item.badge && count > 0 && contador(item, count, shownActive)}

                                            {/* Tooltip sólo plegado: navy a la derecha, anclado al icono.
                                                aria-hidden: repite el nombre del enlace (ya en la etiqueta). */}
                                            {!expanded && (
                                                <span
                                                    aria-hidden
                                                    className="pointer-events-none absolute left-full top-1/2 z-[70] ml-4 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#26356f] px-2.5 py-1.5 text-[13px] font-medium text-white opacity-0 shadow-xl ring-1 ring-white/10 transition-opacity duration-150 before:absolute before:right-full before:top-1/2 before:-translate-y-1/2 before:border-4 before:border-transparent before:border-r-[#26356f] before:content-[''] group-hover:opacity-100 group-focus-visible:opacity-100 lg:block"
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

                    {/* ── EL CARNET: tarjeta de usuario. Plegado queda sólo el avatar, en el eje x=36. ── */}
                    <button
                        ref={carnetBtnRef}
                        type="button"
                        onClick={toggleCarnet}
                        aria-haspopup="dialog"
                        aria-expanded={carnetOpen}
                        className={`ml-3 mt-4 flex h-[54px] flex-shrink-0 items-center rounded-[14px] text-left transition-[width,background-color,box-shadow] duration-200 ease-[cubic-bezier(.2,.8,.2,1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 ${
                            expanded
                                ? 'bg-white/[0.07] shadow-[inset_0_0_0_1px_rgba(255,255,255,.08),inset_0_1px_0_rgba(255,255,255,.05)] hover:bg-white/[0.1]'
                                : 'hover:bg-white/[0.08]'
                        }`}
                        style={{ width: expanded ? 218 : 48 }}
                    >
                        <span className="relative ml-[7px] flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center">
                            {/* El anillo de turno: sólo tiene sentido para asesores. */}
                            {isAdvisor && (
                                <>
                                    <svg viewBox="0 0 46 46" className="pointer-events-none absolute left-1/2 top-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2 -rotate-90">
                                        <circle
                                            cx="23"
                                            cy="23"
                                            r="20"
                                            fill="none"
                                            strokeWidth="2.5"
                                            strokeLinecap="round"
                                            stroke={onDuty ? '#2dd4bf' : 'rgba(148,163,184,0.5)'}
                                            strokeDasharray={onDuty ? undefined : '3 4'}
                                        />
                                    </svg>
                                    {onDuty && (
                                        <svg viewBox="0 0 46 46" className="marco-ecg pointer-events-none absolute left-1/2 top-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2">
                                            <path d="M23 3a20 20 0 1 1-.01 0" fill="none" stroke="#5eead4" strokeWidth="1.6" strokeLinecap="round" />
                                        </svg>
                                    )}
                                </>
                            )}
                            <Avatar
                                className={`h-[34px] w-[34px] shadow-[0_0_0_1px_rgba(255,255,255,.2),0_1px_2px_rgba(0,0,0,.25)] transition-[filter] duration-500 ${
                                    isAdvisor && !onDuty ? 'grayscale-[.7]' : ''
                                }`}
                            >
                                <AvatarImage src={auth.user?.avatar} alt={auth.user?.name} />
                                <AvatarFallback className="bg-gradient-to-br from-[#4e5fa4] to-[#3e4f94] text-xs font-bold tracking-[.02em] text-white">
                                    {getInitials(auth.user?.name ?? '')}
                                </AvatarFallback>
                            </Avatar>
                        </span>

                        <span
                            className={`ml-3 flex min-w-0 flex-1 flex-col gap-px pr-2.5 transition-opacity duration-150 ${
                                expanded ? 'opacity-100' : 'opacity-0'
                            }`}
                        >
                            <span className="truncate text-sm font-semibold leading-[18px] text-white">{auth.user?.name}</span>
                            <span
                                className={`truncate text-xs font-medium leading-4 ${isAdvisor && onDuty ? 'text-[#2dd4bf]' : 'text-white/70'}`}
                            >
                                {isAdvisor
                                    ? onDuty
                                        ? t('navigation.onDuty', 'De turno')
                                        : t('navigation.offDuty', 'Fuera de turno')
                                    : t('navigation.admin', 'Administrador')}
                            </span>
                        </span>
                    </button>
                </div>

                {/* Popover del carnet: turno + tema + idioma + perfil + menú anterior + salir.
                    Fuera del contenedor con filtro: se lee siempre a todo color. */}
                {carnetOpen && (
                    <div
                        role="dialog"
                        aria-label={t('navigation.yourStation', 'Tu puesto')}
                        className="absolute bottom-[72px] left-3 z-[80] w-[248px] rounded-2xl border border-border bg-card p-3 shadow-2xl"
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
                                {/* El turno es de SOLO LECTURA para el asesor: SettingsController pone
                                    TODOS los asesores en false antes de aplicar el roster, así que un
                                    interruptor propio se borraría al siguiente guardado. */}
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
                        {/* Salida de emergencia al riel anterior, sólo para administradores: si una
                            pantalla se viera mal con este menú, pueden seguir trabajando con el de antes. */}
                        {!isAdvisor && (
                            <button
                                type="button"
                                onClick={() => {
                                    setCarnetOpen(false);
                                    setMarcoShell(false);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg p-2 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
                            >
                                <Undo2 className="h-4 w-4" />
                                {t('navigation.backToOldMenu', 'Volver al menú anterior')}
                            </button>
                        )}
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
            </aside>

            {/* ══════════════════════ LA ISLA ══════════════════════
                En escritorio: absoluta dentro del marco (NO fixed: un fixed crearía un contexto de
                apilamiento propio y los modales no portaleados de las páginas —z-50/z-[100]—
                quedarían DEBAJO del menú). Sin transform/filter/contain en ningún ancestro: los
                position: fixed de las páginas siguen referidos a la ventana. El <main> es el
                contenedor de scroll; `scroll-region` hace que Inertia lo resetee y restaure como
                hacía con el scroll de la ventana. En móvil no hay isla: página a pantalla completa. */}
            <div className="marco-isla" style={{ '--marco-izq': pinned ? '240px' : '72px' } as CSSProperties}>
                <main
                    id="main-content"
                    tabIndex={-1}
                    scroll-region=""
                    className="min-w-0 overflow-x-hidden pt-16 outline-none max-lg:min-h-screen lg:h-full lg:overflow-y-auto lg:pt-0"
                >
                    {children}
                </main>
            </div>

            <Avisos />
        </div>
    );
}
