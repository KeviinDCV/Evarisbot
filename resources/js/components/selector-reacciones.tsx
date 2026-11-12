import { FOCO } from '@/components/appointments/piezas-citas';
import { SOMBRA_FLOTA } from '@/components/internal-chat/piezas-chat';
import { cn } from '@/lib/utils';
import {
    AnimatePresence,
    motion,
    useIsPresent,
    useReducedMotion,
} from 'framer-motion';
import { Plus } from 'lucide-react';
import {
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type KeyboardEvent,
} from 'react';
import { useTranslation } from 'react-i18next';

/* ── Reacciones al estilo WhatsApp (Conversaciones y Chat interno) ─────────────────────────────────
   La bandeja sale ENCIMA DEL GLOBO, alineada con su borde (no del botón de la barra), y se abre en 0,2 s
   creciendo desde esa esquina; los emojis aparecen en cadena y al pasar el ratón solo crecen, sin saltar
   ni rótulo, así el clic cae siempre donde se apuntó. Tu reacción va sobre un círculo gris (pulsarla la
   quita) y «+» despliega los 24 del selector de la caja de escribir. Si arriba no cabe (primer mensaje
   del chat), se abre hacia abajo; si tampoco (una foto más alta que lo visible), se posa sobre el globo.
   Solo presentación: qué mensaje la tiene abierta, el clic fuera / Esc y el guardado los lleva cada
   página. La bandeja lleva `data-selector-reacciones`, la marca que esas páginas usan para no cerrarla
   cuando el clic cae dentro. */

export const REACCIONES_RAPIDAS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

/** Los del selector de emojis de la caja de escribir (Conversaciones), en el mismo orden. */
export const MAS_REACCIONES = [
    '😀',
    '😅',
    '😂',
    '🙂',
    '😉',
    '😍',
    '😘',
    '😊',
    '👍',
    '🙏',
    '👏',
    '🙌',
    '👌',
    '💪',
    '🎉',
    '❤️',
    '🔥',
    '✅',
    '⚠️',
    '❌',
    '📅',
    '🕐',
    '📍',
    '📎',
];

const CLAVE_ROTULO: Record<string, string> = {
    '👍': 'like',
    '❤️': 'love',
    '😂': 'haha',
    '😮': 'wow',
    '😢': 'sad',
    '🙏': 'thanks',
};

type Tono = 'whatsapp' | 'navy';

// Conversaciones copia a WhatsApp (bandeja blanca con su sombra, gris #e9edef en lo elegido);
// el Chat interno, el lenguaje navy de sus piezas.
const TONOS: Record<
    Tono,
    { bandeja: string; mia: string; mas: string; filete: string }
> = {
    whatsapp: {
        bandeja:
            'bg-white shadow-[0_2px_5px_rgba(11,20,26,0.26),0_2px_10px_rgba(11,20,26,0.16)] dark:bg-neutral-800 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_2px_12px_rgba(0,0,0,0.55)]',
        mia: 'bg-[#e9edef] dark:bg-white/14',
        mas: 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef] dark:bg-white/10 dark:text-neutral-300 dark:hover:bg-white/16',
        filete: 'border-[#e9edef] dark:border-white/8',
    },
    navy: {
        bandeja: cn('bg-white dark:bg-neutral-900', SOMBRA_FLOTA),
        mia: 'bg-[#2e3f84]/10 dark:bg-white/14',
        mas: 'bg-[#2e3f84]/7 text-[#2e3f84] hover:bg-[#2e3f84]/12 dark:bg-white/10 dark:text-neutral-200 dark:hover:bg-white/16',
        filete: 'border-[#2e3f84]/8 dark:border-white/8',
    },
};

// Alto de la bandeja (48 px) y de la desplegada con la rejilla, más el hueco de 8 px con el globo.
const ALTO_BANDEJA = 48 + 8;
const ALTO_AMPLIADA = 48 + 3 * 36 + 16 + 8;

// Rebote corto del tipo «pop» (se pasa un pelo de 1 y vuelve): el de las burbujas de WhatsApp.
const POP = [0.34, 1.56, 0.64, 1] as const;

/**
 * Dónde va la bandeja respecto al globo. `dentro` = posada sobre él, a `top` px de su borde superior.
 * `dx` = cuánto se corre desde el borde del globo al que se alinea (0 salvo que no quepa a lo ancho).
 * `maxAncho` = solo si ni corriéndose cabe (un celular muy estrecho): la fila pasa a dos líneas.
 */
type Sitio = {
    lado: 'arriba' | 'abajo' | 'dentro';
    top?: number;
    dx: number;
    maxAncho?: number;
};

// Distancia mínima de la bandeja a los bordes del chat.
const MARGEN = 8;

/**
 * Arriba del globo si cabe en lo visible del chat (el área con scroll, o la ventana); si no, abajo
 * (primer mensaje del chat). Si tampoco (un globo más alto que lo visible, como una foto larga con el
 * borde de arriba fuera de pantalla), se posa sobre el globo, al principio de lo que se ve.
 * A lo ancho va pegada al borde del globo; si así se saldría del chat (un celular estrecho, un globo
 * con avatar al lado), se corre lo justo hacia dentro.
 */
function colocar(
    bandeja: HTMLElement,
    alto: number,
    preferido: 'arriba' | 'abajo',
    propia: boolean,
): Sitio {
    const globo = bandeja.parentElement;
    if (!globo) return { lado: preferido, dx: 0 };
    let caja: HTMLElement | null = globo.parentElement;
    while (caja) {
        const oy = getComputedStyle(caja).overflowY;
        if (oy === 'auto' || oy === 'scroll' || oy === 'hidden') break;
        caja = caja.parentElement;
    }
    const g = globo.getBoundingClientRect();
    const c = caja
        ? caja.getBoundingClientRect()
        : {
              top: 0,
              bottom: window.innerHeight,
              left: 0,
              right: window.innerWidth,
          };
    // offsetWidth no lo altera la escala de la animación de entrada. Si ni así cabe, se limita al
    // ancho del chat (maxAncho) y la fila de emojis pasa a dos líneas.
    const disponible = Math.max(c.right - c.left - 2 * MARGEN, 0);
    const maxAncho = bandeja.offsetWidth > disponible ? disponible : undefined;
    const ancho = Math.min(bandeja.offsetWidth, disponible);
    // Propia: `right: dx` (su borde derecho queda en g.right - dx). Ajena: `left: dx`.
    const dx = propia
        ? Math.max(
              Math.min(0, g.right - ancho - (c.left + MARGEN)),
              g.right - (c.right - MARGEN),
          )
        : Math.max(
              Math.min(0, c.right - MARGEN - ancho - g.left),
              c.left + MARGEN - g.left,
          );
    const cabe = {
        arriba: g.top - c.top >= alto,
        abajo: c.bottom - g.bottom >= alto,
    };
    const otro = preferido === 'arriba' ? 'abajo' : 'arriba';
    if (cabe[preferido]) return { lado: preferido, dx, maxAncho };
    if (cabe[otro]) return { lado: otro, dx, maxAncho };
    return {
        lado: 'dentro',
        top: Math.max(g.top, c.top) + MARGEN - g.top,
        dx,
        maxAncho,
    };
}

/**
 * Bandeja de reacciones de un mensaje. Va DENTRO del contenedor `relative` del globo; se monta siempre
 * (con `abierto` en falso no pinta nada) para que al cerrarse pueda desvanecerse.
 */
export function SelectorReacciones({
    abierto,
    propia,
    actual,
    onElegir,
    tono = 'whatsapp',
}: {
    abierto: boolean;
    /** Mensaje propio: la bandeja se alinea con el borde derecho del globo. */
    propia: boolean;
    /** Tu reacción de ahora (sale marcada; elegirla de nuevo la quita). */
    actual?: string | null;
    onElegir: (emoji: string) => void;
    tono?: Tono;
}) {
    // Cada apertura es una bandeja nueva: si se reabre mientras la anterior aún se desvanece,
    // AnimatePresence reutilizaría esa (con su sitio medido y la rejilla desplegada) en vez de montar otra.
    const [vez, setVez] = useState(0);
    const [antes, setAntes] = useState(abierto);
    if (abierto !== antes) {
        setAntes(abierto);
        if (abierto) setVez(vez + 1);
    }
    return (
        <AnimatePresence>
            {abierto && (
                <Bandeja
                    key={vez}
                    propia={propia}
                    actual={actual ?? null}
                    onElegir={onElegir}
                    tono={tono}
                />
            )}
        </AnimatePresence>
    );
}

function Bandeja({
    propia,
    actual,
    onElegir,
    tono,
}: {
    propia: boolean;
    actual: string | null;
    onElegir: (emoji: string) => void;
    tono: Tono;
}) {
    const { t } = useTranslation();
    const reducir = useReducedMotion();
    const presente = useIsPresent();
    const ref = useRef<HTMLDivElement>(null);
    const rejillaRef = useRef<HTMLDivElement>(null);
    const [sitio, setSitio] = useState<Sitio>({ lado: 'arriba', dx: 0 });
    const [ampliada, setAmpliada] = useState(false);
    const estilo = TONOS[tono];
    // Tu reacción, si no es de las seis rápidas, se ofrece también en la fila (marcada) para quitarla de un toque.
    const fila =
        actual && !REACCIONES_RAPIDAS.includes(actual)
            ? [...REACCIONES_RAPIDAS, actual]
            : REACCIONES_RAPIDAS;

    // Antes de pintar: hacia dónde abre, y el foco al primer emoji (para el teclado; con el ratón no
    // se ve el aro porque el foco llega desde un clic). Al cerrarse, si se abrió con el teclado,
    // el foco vuelve al botón de reaccionar en vez de perderse en la página.
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        setSitio(colocar(el, ALTO_BANDEJA, 'arriba', propia));
        const previo =
            document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
        const volverA =
            previo &&
            previo !== document.body &&
            previo.matches(':focus-visible')
                ? previo
                : null;
        el.querySelector<HTMLButtonElement>('button')?.focus({
            preventScroll: true,
        });
        return () => {
            const foco = document.activeElement;
            if (
                volverA?.isConnected &&
                (!foco || foco === document.body || el.contains(foco))
            )
                volverA.focus({ preventScroll: true });
        };
        // `propia` no cambia en la vida de un mensaje: en la práctica corre una vez, al abrirse.
    }, [propia]);

    useEffect(() => {
        if (ampliada)
            rejillaRef.current
                ?.querySelector<HTMLButtonElement>('button')
                ?.focus({ preventScroll: true });
    }, [ampliada]);

    // Mientras se desvanece sigue tapando lo de debajo pero ya no elige: el segundo clic de un doble
    // clic no cambia nada (ni aquí ni en la reacción del mensaje de al lado, que queda debajo).
    const elegir = (emoji: string) => {
        if (presente) onElegir(emoji);
    };

    // «+»: se vuelve a colocar con el alto desplegado (si ya no cabe hacia donde abrió, cambia de lado).
    const ampliar = () => {
        const el = ref.current;
        if (el) {
            const nuevo = colocar(
                el,
                ALTO_AMPLIADA,
                sitio.lado === 'abajo' ? 'abajo' : 'arriba',
                propia,
            );
            // Si ya estaba limitada, ahora mide justo ese límite: se conserva.
            setSitio({ ...nuevo, maxAncho: nuevo.maxAncho ?? sitio.maxAncho });
        }
        setAmpliada(true);
    };

    // Flechas, Inicio y Fin recorren los emojis (Esc la cierra la página).
    const navegar = (e: KeyboardEvent<HTMLDivElement>) => {
        const botones = Array.from(
            ref.current?.querySelectorAll<HTMLButtonElement>('button') ?? [],
        );
        const i = botones.indexOf(document.activeElement as HTMLButtonElement);
        if (i < 0) return;
        const destino = {
            ArrowRight: i + 1,
            ArrowDown: i + 1,
            ArrowLeft: i - 1,
            ArrowUp: i - 1,
            Home: 0,
            End: botones.length - 1,
        }[e.key];
        if (destino === undefined) return;
        e.preventDefault();
        botones[(destino + botones.length) % botones.length]?.focus();
    };

    const entrada = (i: number) =>
        reducir
            ? {}
            : {
                  initial: { opacity: 0, scale: 0.35 },
                  animate: { opacity: 1, scale: 1 },
                  transition: {
                      delay: 0.03 + i * 0.022,
                      duration: 0.26,
                      ease: POP,
                  },
              };

    return (
        <motion.div
            ref={ref}
            data-selector-reacciones
            role="toolbar"
            aria-label={t('reactions.tray')}
            onKeyDown={navegar}
            initial={{ opacity: 0, scale: reducir ? 1 : 0.86 }}
            animate={{
                opacity: 1,
                scale: 1,
                transition: {
                    duration: reducir ? 0.01 : 0.2,
                    ease: [0.2, 0.9, 0.3, 1.12],
                },
            }}
            exit={{
                opacity: 0,
                scale: reducir ? 1 : 0.92,
                transition: { duration: reducir ? 0.01 : 0.12, ease: 'easeIn' },
            }}
            style={{
                transformOrigin: `${propia ? 'calc(100% - 22px)' : '22px'} ${sitio.lado === 'arriba' ? '100%' : '0%'}`,
                top: sitio.lado === 'dentro' ? sitio.top : undefined,
                left: propia ? undefined : sitio.dx,
                right: propia ? sitio.dx : undefined,
                maxWidth: sitio.maxAncho,
            }}
            className={cn(
                'absolute z-30 flex w-max flex-col',
                sitio.lado === 'arriba' && 'bottom-full mb-2',
                sitio.lado === 'abajo' && 'top-full mt-2',
                ampliada || sitio.maxAncho !== undefined
                    ? 'rounded-[20px]'
                    : 'rounded-full',
                estilo.bandeja,
            )}
        >
            <div className="flex flex-wrap items-center gap-0.5 p-1">
                {fila.map((emoji, i) => (
                    <button
                        key={emoji}
                        type="button"
                        onClick={() => elegir(emoji)}
                        aria-label={
                            CLAVE_ROTULO[emoji]
                                ? t(`reactions.${CLAVE_ROTULO[emoji]}`)
                                : emoji
                        }
                        aria-pressed={actual === emoji}
                        className={cn(
                            'group/emo flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full',
                            FOCO,
                            actual === emoji && estilo.mia,
                        )}
                    >
                        <motion.span className="flex" {...entrada(i)}>
                            <span className="block origin-[50%_80%] text-[27px] leading-none transition-[scale] duration-150 ease-out group-hover/emo:scale-[1.28] group-focus-visible/emo:scale-[1.28] group-active/emo:scale-110">
                                {emoji}
                            </span>
                        </motion.span>
                    </button>
                ))}
                <button
                    type="button"
                    onClick={ampliar}
                    aria-label={t('reactions.more')}
                    aria-expanded={ampliada}
                    className={cn(
                        'group/mas mr-1 ml-0.5 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors',
                        FOCO,
                        estilo.mas,
                    )}
                >
                    <motion.span className="flex" {...entrada(fila.length)}>
                        <Plus
                            className="size-[18px] transition-[scale] duration-150 ease-out group-hover/mas:scale-115"
                            strokeWidth={2.2}
                            aria-hidden="true"
                        />
                    </motion.span>
                </button>
            </div>
            <AnimatePresence initial={false}>
                {ampliada && (
                    <motion.div
                        key="rejilla"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        transition={{
                            duration: reducir ? 0.01 : 0.18,
                            ease: 'easeOut',
                        }}
                        className="overflow-hidden"
                    >
                        <div
                            ref={rejillaRef}
                            className={cn(
                                'grid grid-cols-8 gap-0.5 border-t px-1 pt-1.5 pb-1.5',
                                estilo.filete,
                            )}
                        >
                            {MAS_REACCIONES.map((emoji) => (
                                <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => elegir(emoji)}
                                    aria-label={emoji}
                                    aria-pressed={actual === emoji}
                                    className={cn(
                                        'group/emo flex h-9 cursor-pointer items-center justify-center rounded-full',
                                        FOCO,
                                        actual === emoji && estilo.mia,
                                    )}
                                >
                                    <span className="block origin-[50%_80%] text-[22px] leading-none transition-[scale] duration-150 ease-out group-hover/emo:scale-[1.25] group-focus-visible/emo:scale-[1.25]">
                                        {emoji}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

/**
 * Conversaciones: las reacciones del paciente y la tuya en UNA pastilla sobre el borde inferior del globo,
 * como WhatsApp (con el total si son dos). Aparece con un pequeño salto (al abrir el chat no salta, solo lo
 * que llega después) y al quitarla se va al momento, a la vez que el hueco que el globo le guarda (con
 * salida animada, la pastilla tapaba la hora mientras se encogía). Va dentro del globo, que es `relative`.
 */
export function PastillaReacciones({
    emojis,
    propia,
    titulo,
    onQuitar,
}: {
    /** Un emoji por reacción, en orden (pueden repetirse: paciente y asesor con el mismo). */
    emojis: string[];
    propia: boolean;
    titulo: string;
    /** Si hay una tuya, pulsar la pastilla la quita. */
    onQuitar?: () => void;
}) {
    const reducir = useReducedMotion();
    const unicos = Array.from(new Set(emojis));
    return (
        <AnimatePresence initial={false}>
            {emojis.length > 0 && (
                <motion.button
                    key="pastilla"
                    type="button"
                    // e.detail > 1: el segundo clic de un doble clic (sobre esta pastilla o sobre la de
                    // otro mensaje que quedó debajo de la bandeja) no vuelve a mandar nada.
                    onClick={(e) => {
                        if (e.detail <= 1) onQuitar?.();
                    }}
                    aria-disabled={!onQuitar}
                    title={titulo}
                    aria-label={titulo}
                    initial={reducir ? { opacity: 0 } : { scale: 0 }}
                    animate={{
                        opacity: 1,
                        scale: 1,
                        transition: {
                            duration: reducir ? 0.01 : 0.32,
                            ease: POP,
                        },
                    }}
                    className={cn(
                        'absolute -bottom-2.5 z-10 inline-flex h-[22px] items-center gap-0.5 rounded-full bg-white px-1.5 shadow-[0_1px_2px_rgba(11,20,26,0.22)] ring-2 ring-[#eef0f6] dark:bg-neutral-800 dark:ring-[hsl(30_4%_8%)]',
                        FOCO,
                        propia
                            ? 'right-2 origin-[80%_50%]'
                            : 'left-2 origin-[20%_50%]',
                        onQuitar ? 'cursor-pointer' : 'cursor-default',
                    )}
                >
                    <AnimatePresence initial={false}>
                        {unicos.map((emoji) => (
                            <motion.span
                                key={emoji}
                                initial={reducir ? false : { scale: 0.3 }}
                                animate={{
                                    scale: 1,
                                    transition: { duration: 0.28, ease: POP },
                                }}
                                className="block text-[14px] leading-none"
                            >
                                {emoji}
                            </motion.span>
                        ))}
                    </AnimatePresence>
                    {emojis.length > 1 && (
                        <span className="text-[11.5px] leading-none font-medium text-[#667781] tabular-nums dark:text-neutral-400">
                            {emojis.length}
                        </span>
                    )}
                </motion.button>
            )}
        </AnimatePresence>
    );
}
