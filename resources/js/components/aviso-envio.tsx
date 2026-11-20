import { type FallaEnvio } from '@/lib/fallas-envio';
import { Clock, type LucideIcon, RefreshCw, ServerCrash, ShieldAlert, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const FALLAS: Record<FallaEnvio['tipo'], { icono: LucideIcon; texto: string; tono: 'error' | 'info' }> = {
    bloqueo: { icono: ShieldAlert, texto: 'fallasEnvio.locked', tono: 'error' },
    caducada: { icono: RefreshCw, texto: 'fallasEnvio.expired', tono: 'info' },
    servidor: { icono: ServerCrash, texto: 'fallasEnvio.server', tono: 'error' },
    mantenimiento: { icono: Clock, texto: 'fallasEnvio.maintenance', tono: 'info' },
    red: { icono: WifiOff, texto: 'fallasEnvio.offline', tono: 'error' },
};

/**
 * Aviso de un formulario cuando el envío falla fuera de la validación (ver lib/fallas-envio.ts). Rojo para lo
 * que impide guardar; navy para lo que se resuelve solo. `role="alert"` lo anuncia una vez; la cuenta regresiva
 * del bloqueo va en el botón, para que el lector de pantalla no la repita cada segundo.
 */
export function AvisoEnvio({ falla }: { falla: FallaEnvio }) {
    const { t } = useTranslation();
    const { icono: Icono, texto, tono } = FALLAS[falla.tipo];

    return (
        <div role="alert" className={`aviso-envio aviso-envio-${tono} flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-[13.5px] font-medium leading-snug`}>
            <Icono aria-hidden="true" className="mt-px h-[18px] w-[18px] shrink-0" />
            <p className="text-pretty">{t(texto)}</p>
        </div>
    );
}
