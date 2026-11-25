import { router } from '@inertiajs/react';
import axios from 'axios';
import { useEffect, useRef, useState } from 'react';

/**
 * Lo que puede salir mal al enviar un formulario de Inertia FUERA de la validación: el bloqueo por intentos
 * (429), la página caducada (419, cuando el reintento de app.tsx ya falló), el mantenimiento (503), otro error
 * del servidor y la falta de red. Sin esto Inertia abre su modal con la página de error en inglés
 * («429 | TOO MANY REQUESTS»…) tapando toda la pantalla, o no dice nada si no hay red.
 *
 * Solo actúa mientras ESTE formulario envía (cada formulario usa su propio hook):
 *   const fallas = useFallasEnvio();
 *   <Form onStart={fallas.alEmpezar} onFinish={fallas.alTerminar} onSubmitCapture={fallas.alReintentar}>
 * Mismo patrón que el login (login-hospital.tsx) y la carga diferida de Estadísticas.
 */
export type FallaEnvio = { tipo: 'bloqueo'; hasta: number } | { tipo: 'caducada' | 'servidor' | 'mantenimiento' | 'red' };

/** 75 → «1:15»; 3540 → «59:00». */
export const minutosYSegundos = (segundos: number) => `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;

export function useFallasEnvio() {
    const [falla, setFalla] = useState<FallaEnvio | null>(null);
    const enviando = useRef(false);
    const [ahora, setAhora] = useState(() => Date.now());

    useEffect(() => {
        const offInvalid = router.on('invalid', (event) => {
            if (!enviando.current) return;
            event.preventDefault();
            const { status, headers } = event.detail.response;
            if (status === 429) {
                // Retry-After: lo que falta del límite que saltó.
                const segundos = Number(headers?.['retry-after']);
                setAhora(Date.now());
                setFalla({ tipo: 'bloqueo', hasta: Date.now() + (segundos > 0 ? segundos : 60) * 1000 });
            } else if (status === 419) {
                // Token nuevo para que el próximo intento pase.
                axios.get('/csrf-refresh').catch(() => {});
                setFalla({ tipo: 'caducada' });
            } else {
                setFalla({ tipo: status === 503 ? 'mantenimiento' : 'servidor' });
            }
        });
        const offException = router.on('exception', (event) => {
            if (!enviando.current) return;
            event.preventDefault();
            setFalla({ tipo: 'red' });
        });
        return () => {
            offInvalid();
            offException();
        };
    }, []);

    // Cuenta regresiva del bloqueo; al llegar a cero se va el aviso.
    const hasta = falla?.tipo === 'bloqueo' ? falla.hasta : null;
    useEffect(() => {
        if (hasta === null) return;
        const reloj = window.setInterval(() => {
            const t = Date.now();
            setAhora(t);
            if (t >= hasta) setFalla(null);
        }, 1000);
        return () => window.clearInterval(reloj);
    }, [hasta]);
    const faltan = hasta === null ? 0 : Math.max(0, Math.ceil((hasta - ahora) / 1000));

    return {
        falla,
        bloqueado: faltan > 0,
        faltan,
        alEmpezar: () => {
            enviando.current = true;
        },
        alTerminar: () => {
            enviando.current = false;
        },
        // Al volver a intentar se quita el aviso anterior (el del bloqueo no: sigue su cuenta regresiva).
        alReintentar: () => setFalla((f) => (f?.tipo === 'bloqueo' ? f : null)),
    };
}
