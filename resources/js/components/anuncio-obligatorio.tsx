import { quitarAnuncio, subscribeAnuncios, type AnuncioPendiente } from '@/lib/unread-store';
import axios from 'axios';
import { Megaphone } from 'lucide-react';
import { Fragment, type ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

/** Segundos ya mirados de cada anuncio: si recarga la página no vuelve a empezar de cero. */
const claveVisto = (id: number) => `evarisbot:anuncio-visto:${id}`;

function leerVisto(id: number): number {
    try {
        return Math.max(0, Number(localStorage.getItem(claveVisto(id))) || 0);
    } catch {
        return 0;
    }
}

function guardarVisto(id: number, segundos: number | null): void {
    try {
        if (segundos === null) localStorage.removeItem(claveVisto(id));
        else localStorage.setItem(claveVisto(id), String(segundos));
    } catch {
        // Sin almacenamiento: al recargar vuelve a contar desde cero.
    }
}

/** *negrita* como en el chat interno; el resto, tal cual (los saltos de línea los respeta el contenedor). */
function conNegritas(texto: string): ReactNode[] {
    return texto.split(/(\*[^*\n]+\*)/g).map((trozo, i) =>
        /^\*[^*\n]+\*$/.test(trozo) ? <strong key={i}>{trozo.slice(1, -1)}</strong> : <Fragment key={i}>{trozo}</Fragment>,
    );
}

/**
 * Anuncio de lectura obligatoria (app/Models/Anuncio.php): sale encima de cualquier pantalla y no se cierra con Esc ni
 * con clic afuera. «Entendido» se habilita tras `segundos` (30) con la pestaña a la vista Y la ventana al frente: si
 * se va a otra pestaña o a otro programa, el conteo se pausa. Si hay varios, van uno tras otro.
 *
 * Sin el Dialog de Radix a propósito: abierto sobre Conversaciones (que tiene sus propios Dialog y Tooltip de Radix)
 * entraba en un bucle de Presence («Maximum update depth») y dejaba la página en blanco. Es una capa propia y, mientras
 * está, la app de debajo queda `inert` (ni clics ni foco con el teclado).
 */
export function AnuncioObligatorio() {
    const { t, i18n } = useTranslation();
    const [lista, setLista] = useState<AnuncioPendiente[]>([]);
    useEffect(() => subscribeAnuncios(setLista), []);

    const actual = lista[0] ?? null;
    const total = actual?.segundos || 30;
    const [visto, setVisto] = useState(0);
    const [atento, setAtento] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [fallo, setFallo] = useState(false);

    // Al pasar a otro anuncio, retoma lo que ya llevaba mirado.
    const idActual = actual?.id ?? null;
    useEffect(() => {
        if (idActual === null) return;
        setVisto(Math.min(leerVisto(idActual), total));
        setFallo(false);
    }, [idActual, total]);

    // Solo cuenta con la pestaña a la vista y la ventana del navegador al frente.
    useEffect(() => {
        const revisar = () => setAtento(document.visibilityState === 'visible' && document.hasFocus());
        revisar();
        document.addEventListener('visibilitychange', revisar);
        window.addEventListener('focus', revisar);
        window.addEventListener('blur', revisar);
        return () => {
            document.removeEventListener('visibilitychange', revisar);
            window.removeEventListener('focus', revisar);
            window.removeEventListener('blur', revisar);
        };
    }, []);

    useEffect(() => {
        if (idActual === null || !atento || visto >= total) return;
        const reloj = window.setTimeout(() => {
            const nuevo = Math.min(total, visto + 1);
            guardarVisto(idActual, nuevo);
            setVisto(nuevo);
        }, 1000);
        return () => window.clearTimeout(reloj);
    }, [idActual, atento, visto, total]);

    // Con el anuncio a la vista, la app de debajo no responde (ni al ratón ni al Tab) y el foco va a la ventana.
    const caja = useRef<HTMLDivElement>(null);
    const abierto = idActual !== null;
    useEffect(() => {
        if (!abierto) return;
        const app = document.getElementById('app');
        app?.setAttribute('inert', '');
        caja.current?.focus();
        return () => app?.removeAttribute('inert');
    }, [abierto]);

    if (!actual) return null;

    const restante = Math.max(0, total - visto);
    const listo = restante === 0;
    const fecha = actual.creado
        ? new Date(actual.creado).toLocaleString(i18n.language, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
        : '';

    const entendido = async () => {
        if (!listo || guardando) return;
        setGuardando(true);
        setFallo(false);
        try {
            await axios.post(`/admin/internal-chat/anuncios/${actual.id}/leido`);
            guardarVisto(actual.id, null);
            quitarAnuncio(actual.id);
        } catch {
            // Un fallo del servidor no puede dejar a nadie sin trabajar: se cierra igual. Si vuelve a salir (no quedó
            // guardado), ya cumplió sus segundos y se puede cerrar de una vez.
            setFallo(true);
            window.setTimeout(() => quitarAnuncio(actual.id), 1500);
        } finally {
            setGuardando(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0f1530]/60 p-4 backdrop-blur-[3px] animate-in fade-in-0">
            <div
                ref={caja}
                role="dialog"
                aria-modal="true"
                aria-labelledby="anuncio-titulo"
                aria-describedby="anuncio-cuerpo"
                tabIndex={-1}
                className="flex max-h-full w-[min(520px,100%)] flex-col gap-4 rounded-2xl bg-white p-6 text-[#1f2447] shadow-[0_30px_80px_-20px_rgba(8,14,46,0.55)] outline-none animate-in fade-in-0 zoom-in-95 dark:bg-neutral-900 dark:text-neutral-100"
            >
                <div className="flex items-start gap-3.5">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#2e3f84]/10 text-[#2e3f84] dark:bg-white/10 dark:text-blue-300">
                        <Megaphone className="size-5" strokeWidth={2} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h2 id="anuncio-titulo" className="text-[17px] leading-6 font-semibold">{t('anuncio.titulo')}</h2>
                        <p className="text-[13px] leading-5 text-[#5b6088] dark:text-neutral-400">
                            {t('anuncio.de', { autor: actual.autor, fecha })}
                            {lista.length > 1 && <span> · {t('anuncio.contador', { actual: 1, total: lista.length })}</span>}
                        </p>
                    </div>
                </div>

                <div id="anuncio-cuerpo" className="min-h-0 overflow-y-auto rounded-xl bg-[#f4f5fa] px-4 py-3.5 text-[15px] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere] dark:bg-white/5">
                    {conNegritas(actual.cuerpo)}
                </div>

                <div className="flex flex-col gap-2">
                    <div className="h-1.5 overflow-hidden rounded-full bg-[#2e3f84]/10 dark:bg-white/10" aria-hidden="true">
                        <div
                            className="h-full rounded-full bg-[#2e3f84] transition-[width] duration-1000 ease-linear dark:bg-blue-400"
                            style={{ width: `${(Math.min(visto, total) / total) * 100}%` }}
                        />
                    </div>
                    <p className="text-[12.5px] leading-5 text-[#5b6088] dark:text-neutral-400">
                        {listo ? t('anuncio.listo') : atento ? t('anuncio.cuenta', { s: restante }) : t('anuncio.pausa')}
                    </p>
                    {fallo && <p className="text-[12.5px] leading-5 text-red-600 dark:text-red-400">{t('anuncio.error')}</p>}
                </div>

                <button
                    type="button"
                    onClick={entendido}
                    disabled={!listo || guardando}
                    className="h-11 rounded-xl bg-[#2e3f84] text-[15px] font-semibold text-white transition-colors hover:bg-[#26356f] disabled:cursor-not-allowed disabled:opacity-45 dark:bg-blue-500 dark:hover:bg-blue-400"
                >
                    {listo ? t('anuncio.entendido') : `${t('anuncio.entendido')} (${restante})`}
                </button>
            </div>
        </div>,
        document.body,
    );
}
