import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * Ícono que aparece, desaparece o cambia dentro de un botón (ver ↔ ocultar, listo ↔ girando) con escala,
 * opacidad y un leve desenfoque en vez de saltar. `clave` null = sin ícono; cambiar la clave cruza los dos.
 * No se anima al montar (initial={false}) y, con «reducir movimiento» del sistema, tampoco al cambiar
 * (MotionConfig reducedMotion="user" en app.tsx).
 */
export function IconoAnimado({ clave, children }: { clave: string | null; children?: ReactNode }) {
    return (
        <AnimatePresence mode="popLayout" initial={false}>
            {clave !== null && (
                <motion.span
                    key={clave}
                    className="flex shrink-0"
                    initial={{ opacity: 0, scale: 0.25, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, scale: 0.25, filter: 'blur(4px)' }}
                    transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
                    aria-hidden="true"
                >
                    {children}
                </motion.span>
            )}
        </AnimatePresence>
    );
}
