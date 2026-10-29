import { CircleAlert } from 'lucide-react';
import { type InvalidEvent, type ReactNode, useRef, useState } from 'react';

/**
 * Avisos de validación propios, flotando bajo el campo (sin el globo "Completa este campo" del
 * navegador y sin empujar el contenido). Como el navegador, solo UN globo a la vez: el del primer
 * campo que falta. Los demás se marcan en rojo (`invalido`) y, al corregir el que tiene el globo,
 * el globo pasa al siguiente.
 *
 *   const avisos = useAvisosCampo({ name: { vacio: 'Escribe tu nombre.' } });
 *   <div className="relative">
 *     <input name="name" required aria-invalid={avisos.invalido('name', errors.name) || undefined}
 *            onInvalid={avisos.alInvalidar('name')} onInput={avisos.alEscribir('name')} />
 *     <AvisoCampo id="error-name" texto={avisos.error('name', errors.name)} />
 *   </div>
 *   <Form onSubmitCapture={avisos.alEnviar}>
 */
export type TextosCampo = Record<string, { vacio: string; formato?: string }>;

export function useAvisosCampo(textos: TextosCampo) {
    const [locales, setLocales] = useState<Record<string, string | undefined>>({});
    const [orden, setOrden] = useState<string[]>([]);
    const [ocultos, setOcultos] = useState<Record<string, boolean>>({});
    const ultimoInvalido = useRef(0);

    // Se cancela el evento `invalid`: el navegador no muestra su globo y el formulario sigue sin enviarse.
    const alInvalidar = (campo: string) => (e: InvalidEvent<HTMLInputElement>) => {
        e.preventDefault();
        const validez = e.currentTarget.validity;
        const texto = validez.valueMissing
            ? textos[campo]?.vacio
            : validez.typeMismatch
              ? (textos[campo]?.formato ?? e.currentTarget.validationMessage)
              : e.currentTarget.validationMessage;

        // Un intento nuevo (los `invalid` de un mismo envío llegan seguidos): se empieza de cero.
        const ahora = Date.now();
        const nuevoIntento = ahora - ultimoInvalido.current > 300;
        ultimoInvalido.current = ahora;

        setLocales((l) => ({ ...(nuevoIntento ? {} : l), [campo]: texto }));
        setOrden((o) => (nuevoIntento ? [campo] : [...o.filter((c) => c !== campo), campo]));
        if (nuevoIntento) e.currentTarget.focus();
    };

    // Al escribir se quita el aviso de ese campo (también el del servidor, hasta el próximo envío).
    const alEscribir = (campo: string) => () => {
        setLocales((l) => (l[campo] ? { ...l, [campo]: undefined } : l));
        setOrden((o) => (o.includes(campo) ? o.filter((c) => c !== campo) : o));
        setOcultos((o) => (o[campo] ? o : { ...o, [campo]: true }));
    };

    const alEnviar = () => setOcultos({});

    const delServidorVisible = (campo: string, delServidor?: string) => (ocultos[campo] ? undefined : delServidor);

    // El globo: el aviso propio solo en el primer campo pendiente; los del servidor, en su campo.
    const error = (campo: string, delServidor?: string) => {
        if (locales[campo]) return orden[0] === campo ? locales[campo] : undefined;
        return delServidorVisible(campo, delServidor);
    };

    // El borde rojo: cualquier campo con aviso, tenga o no el globo.
    const invalido = (campo: string, delServidor?: string) => Boolean(locales[campo] || delServidorVisible(campo, delServidor));

    return { alInvalidar, alEscribir, alEnviar, error, invalido };
}

/** El globo; va dentro del contenedor `relative` del input. */
export function AvisoCampo({ id, texto, extra }: { id: string; texto?: string; extra?: ReactNode }) {
    if (!texto && !extra) return null;

    return (
        <div className="pointer-events-none absolute left-0 top-[calc(100%+9px)] z-30 flex flex-col items-start gap-1.5">
            {texto && (
                <p
                    id={id}
                    role="alert"
                    className="aviso-flotante relative flex w-max max-w-[min(400px,calc(100vw-64px))] items-start gap-2 rounded-xl px-3 py-2 text-[13px] font-medium leading-snug"
                >
                    <CircleAlert aria-hidden="true" className="mt-px h-4 w-4 shrink-0" />
                    {texto}
                </p>
            )}
            {extra}
        </div>
    );
}
