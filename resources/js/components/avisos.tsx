import { useEffect, useState } from 'react';
import { Toaster } from 'sileo';

/**
 * Relleno de la píldora de los avisos, en la familia navy de la marca. En la app clara va casi negro
 * para que los colores de estado se lean sobre él (el rojo de error queda en 5,1:1 con el ajuste de
 * app.css); en la oscura, un navy más claro para que se despegue del fondo (todos los estados ≥ 5,4:1
 * con los tonos claros de app.css).
 */
const RELLENO = { claro: '#141a38', oscuro: '#262f63' } as const;

/** ¿La app está en modo oscuro? Sigue a la clase `dark` de <html>, que es la que aplica el selector de tema. */
function useModoOscuro(): boolean {
    const [oscuro, setOscuro] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));

    useEffect(() => {
        const raiz = document.documentElement;
        const observador = new MutationObserver(() => setOscuro(raiz.classList.contains('dark')));
        observador.observe(raiz, { attributes: true, attributeFilter: ['class'] });
        return () => observador.disconnect();
    }, []);

    return oscuro;
}

/**
 * El contenedor de los avisos (Sileo), abajo a la derecha como antes. Se monta una sola vez, en el layout.
 * theme="light" en Sileo significa "página clara con píldora oscura y texto claro": la píldora es oscura
 * en los dos modos de la app, así que siempre va "light".
 */
export function Avisos() {
    const oscuro = useModoOscuro();

    return <Toaster position="bottom-right" theme="light" options={{ fill: oscuro ? RELLENO.oscuro : RELLENO.claro }} />;
}
