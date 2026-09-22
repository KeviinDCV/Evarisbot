import { type ReactNode } from 'react';
import MarcoLayout from '@/layouts/marco-layout';

/**
 * El layout de todas las páginas: el menú "Marco navy" (layouts/marco-layout.tsx). Las páginas
 * importan este default. El riel anterior y la opción de volver a él se retiraron el 21-sept-2026;
 * están en el historial de git.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
    return <MarcoLayout>{children}</MarcoLayout>;
}
