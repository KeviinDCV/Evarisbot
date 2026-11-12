import { ArrowBigUp } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FocusEvent, KeyboardEvent } from 'react';

/**
 * Aviso de Bloq Mayús para campos de contraseña.
 *
 * Es la causa más común de "mi contraseña no funciona": el usuario teclea en
 * mayúsculas sin darse cuenta y el sistema le rechaza sin explicar por qué.
 *
 * Uso:
 *   const mayus = useCapsLock();
 *   <input type="password" {...mayus.props} />
 *   <CapsLockWarning visible={mayus.activo} />
 *
 * El navegador solo revela el estado del teclado dentro de un evento, así que
 * se consulta en cada pulsación y también al enfocar (por si ya venía activado
 * antes de tocar el campo). Al enfocar con Tab no hay dato hasta la primera
 * tecla: es una limitación de los navegadores, no del código.
 */
export function useCapsLock() {
    const [activo, setActivo] = useState(false);

    const revisar = (e: KeyboardEvent<HTMLInputElement> | FocusEvent<HTMLInputElement>) => {
        const nativo = e.nativeEvent as unknown as { getModifierState?: (k: string) => boolean };
        if (typeof nativo?.getModifierState === 'function') {
            setActivo(nativo.getModifierState('CapsLock'));
        }
    };

    return {
        activo,
        props: {
            onKeyDown: revisar,
            onKeyUp: revisar,
            onFocus: revisar,
            onBlur: () => setActivo(false),
            'aria-describedby': activo ? 'aviso-mayus' : undefined,
        },
        // Para campos que ya traen sus propios manejadores: se encadenan.
        combinar: (propios: {
            onFocus?: (e: FocusEvent<HTMLInputElement>) => void;
            onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
        }) => ({
            onKeyDown: revisar,
            onKeyUp: revisar,
            onFocus: (e: FocusEvent<HTMLInputElement>) => {
                propios.onFocus?.(e);
                revisar(e);
            },
            onBlur: (e: FocusEvent<HTMLInputElement>) => {
                propios.onBlur?.(e);
                setActivo(false);
            },
            'aria-describedby': activo ? 'aviso-mayus' : undefined,
        }),
    };
}

/**
 * Bloq Mayús DENTRO del campo, a la derecha (antes del ojo si lo hay): no flota debajo tapando lo que sigue.
 * El campo necesita padding derecho para que el texto no pase por debajo. id="aviso-mayus" para aria-describedby.
 */
export function IndicadorMayus({ className }: { className?: string }) {
    const { t } = useTranslation();

    return (
        <span
            id="aviso-mayus"
            role="status"
            className={`indicador-mayus pointer-events-none absolute flex items-center gap-1 rounded-md px-1.5 py-1 text-[11.5px] font-semibold leading-none ${className ?? ''}`}
        >
            <ArrowBigUp aria-hidden="true" className="h-3.5 w-3.5" />
            <span aria-hidden="true">{t('auth.capsLockShort', 'Bloq Mayús')}</span>
            <span className="sr-only">{t('auth.capsLockOn', 'Bloq Mayús está activado')}</span>
        </span>
    );
}

export default function CapsLockWarning({ visible }: { visible: boolean }) {
    const { t } = useTranslation();
    if (!visible) return null;

    return (
        <span
            id="aviso-mayus"
            role="status"
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"
            style={{ background: '#fef3c7', color: '#92400e', fontSize: '12px', fontWeight: 600 }}
        >
            <ArrowBigUp className="h-4 w-4 shrink-0" />
            {t('auth.capsLockOn', 'Bloq Mayús está activado')}
        </span>
    );
}
