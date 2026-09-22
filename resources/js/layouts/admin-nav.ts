import { BarChart3, Calendar, FileText, MessageSquare, MessagesSquare, Send, Settings, Users, type LucideIcon } from 'lucide-react';

/**
 * Las secciones del menú (ítems y grupos) y la preferencia de fijado, aparte del layout para
 * que añadir una sección sea tocar solo esta lista.
 */

/** Clave de localStorage del menú fijado (la del riel anterior: así se respeta a quien ya lo tenía fijado). */
export const PINNED_KEY = 'evaris.rail.pinned';

/** Lee el estado fijado guardado, con guarda de SSR. */
export function readPinned(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        return localStorage.getItem(PINNED_KEY) === '1';
    } catch {
        return false;
    }
}

export type NavEntry = {
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

export type NavGroupDef = { key: string; label: string; adminOnly?: boolean; items: NavEntry[] };

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
export const GROUPS: NavGroupDef[] = [
    {
        key: 'trabajo',
        label: 'navigation.groupWork',
        items: [
            { href: '/admin/chat', title: 'navigation.conversations', icon: MessageSquare, badge: 'chat' },
            { href: '/admin/internal-chat', title: 'navigation.internalChat', icon: MessagesSquare, badge: 'internal' },
            { href: '/admin/templates', title: 'navigation.templates', icon: FileText },
            { href: '/admin/bulk-sends', title: 'navigation.bulkSends', icon: Send, needsBulk: true },
        ],
    },
    {
        key: 'gestion',
        label: 'navigation.groupManagement',
        adminOnly: true,
        items: [
            { href: '/admin/appointments', title: 'navigation.appointments', icon: Calendar, alsoMatches: ['/admin/oncology-appointments'] },
            { href: '/admin/statistics', title: 'navigation.statistics', icon: BarChart3 },
            { href: '/admin/users', title: 'navigation.users', icon: Users },
            { href: '/admin/settings', title: 'navigation.settings', icon: Settings },
        ],
    },
];
