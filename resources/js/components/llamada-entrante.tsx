import {
    cerrarAviso,
    colgar,
    contestar,
    getEstadoLlamadas,
    ignorar,
    iniciarLlamadas,
    microfonoDisponible,
    PREFIJO_TITULO,
    quitarPrefijoLlamada,
    silenciar,
    suscribirLlamadas,
    type EstadoLlamadas,
    type LlamadaHuerfana,
    type LlamadaPendiente,
} from '@/lib/llamadas';
import { Link } from '@inertiajs/react';
import { Loader2, MessageSquare, Mic, MicOff, Phone, PhoneOff, PhoneOutgoing, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

/** mm:ss (o h:mm:ss) con números de ancho fijo. */
function reloj(segundos: number): string {
    const s = Math.max(0, Math.floor(segundos));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = String(s % 60).padStart(2, '0');
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** +57 300 123 4567 */
function telefonoLegible(t: string | null): string {
    if (!t) return '';
    const d = t.replace(/\D/g, '');
    if (d.length === 12 && d.startsWith('57')) return `+57 ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
    return `+${d}`;
}

function Quien({ llamada }: { llamada: LlamadaPendiente | LlamadaHuerfana }) {
    const { t } = useTranslation();
    const tel = telefonoLegible(llamada.telefono);
    return (
        <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-foreground">{llamada.nombre || tel || t('llamadas.sinNombre')}</p>
            {llamada.nombre && tel && <p className="truncate text-xs text-muted-foreground tabular-nums">{tel}</p>}
        </div>
    );
}

function VerChat({ llamada }: { llamada: LlamadaPendiente | LlamadaHuerfana }) {
    const { t } = useTranslation();
    if (!llamada.conversation_id) return null;
    return (
        <Link
            href={`/admin/chat/${llamada.conversation_id}`}
            preserveScroll
            className="inline-flex items-center gap-1 text-xs font-medium text-[#2e3f84] hover:underline dark:text-blue-300"
        >
            <MessageSquare className="h-3.5 w-3.5" /> {t('llamadas.verChat')}
        </Link>
    );
}

const BOTON = 'inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold transition-[background-color,scale] active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50';

/**
 * Llamada de WhatsApp: timbre, llamada en curso y cómo terminó. Va en el marco de la app (todas las pantallas), abajo a
 * la derecha, por encima de todo. La lógica vive en lib/llamadas.
 */
export function LlamadaEntrante() {
    const { t } = useTranslation();
    const [estado, setEstado] = useState<EstadoLlamadas>(getEstadoLlamadas);
    const [ahora, setAhora] = useState(() => Date.now());

    useEffect(() => {
        iniciarLlamadas();
        setEstado(getEstadoLlamadas());
        return suscribirLlamadas(setEstado);
    }, []);

    // Reloj de la llamada en curso.
    useEffect(() => {
        if (estado.fase !== 'en_curso') return;
        const id = setInterval(() => setAhora(Date.now()), 1000);
        return () => clearInterval(id);
    }, [estado.fase]);

    // Título de la pestaña mientras timbra (se ve aunque la pestaña esté al fondo). Va como prefijo y se quita solo si
    // sigue puesto: así no pisa ni deja pegado el aviso de mensajes nuevos (message-notifications).
    useEffect(() => {
        if (estado.fase !== 'timbrando') return;
        document.title = `${PREFIJO_TITULO}${t('llamadas.titulo')} · ${quitarPrefijoLlamada(document.title)}`;
        return () => {
            document.title = quitarPrefijoLlamada(document.title);
        };
    }, [estado.fase, t]);

    if (estado.fase === 'libre' || typeof document === 'undefined') return null;
    const mic = microfonoDisponible();

    const tarjeta = (
        <div
            role={estado.fase === 'timbrando' ? 'alertdialog' : 'status'}
            aria-live="assertive"
            aria-label={t('llamadas.titulo')}
            className="fixed right-4 bottom-4 z-[250] w-[min(340px,calc(100vw-2rem))] rounded-2xl bg-card p-4 text-card-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06),0_12px_32px_-8px_rgba(15,23,42,0.35)] ring-1 ring-black/5 dark:ring-white/10"
        >
            <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    {estado.fase === 'en_curso'
                        ? t('llamadas.enCurso')
                        : estado.fase === 'huerfana'
                          ? t('llamadas.abierta')
                          : estado.fase === 'llamando'
                            ? t('llamadas.saliente')
                            : t('llamadas.titulo')}
                </span>
                {estado.fase === 'terminada' && (
                    <button
                        type="button"
                        onClick={cerrarAviso}
                        aria-label={t('common.close')}
                        className="relative -m-1 rounded-lg p-1 text-muted-foreground hover:bg-muted before:absolute before:-inset-2 before:content-['']"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            <div className="flex items-center gap-3">
                <div className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
                    {(estado.fase === 'timbrando' || (estado.fase === 'llamando' && estado.sonando)) && (
                        <span className="absolute inset-0 rounded-full bg-emerald-500/25 motion-safe:animate-ping" />
                    )}
                    {estado.fase === 'conectando' ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                    ) : estado.fase === 'llamando' ? (
                        <PhoneOutgoing className="relative h-5 w-5" />
                    ) : (
                        <Phone className="relative h-5 w-5" />
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <Quien llamada={estado.llamada} />
                    {estado.fase === 'en_curso' && (
                        <p className="text-xs font-medium text-emerald-700 tabular-nums dark:text-emerald-400">{reloj((ahora - estado.inicio) / 1000)}</p>
                    )}
                    {estado.fase === 'conectando' && <p className="text-xs text-muted-foreground">{t('llamadas.conectando')}</p>}
                    {estado.fase === 'llamando' && (
                        <p className="text-xs text-muted-foreground">{estado.sonando ? t('llamadas.sonando') : t('llamadas.llamando')}</p>
                    )}
                </div>
            </div>

            {estado.fase === 'timbrando' && (
                <>
                    {estado.otras > 0 && <p className="mt-2 text-xs text-muted-foreground">{t('llamadas.masTimbrando', { count: estado.otras })}</p>}
                    {!mic && <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800 text-pretty dark:text-amber-300">{t('llamadas.microfonoBloqueado')}</p>}
                    <div className="mt-4 flex items-center justify-between gap-2">
                        <VerChat llamada={estado.llamada} />
                        <div className="flex gap-2">
                            <button type="button" onClick={ignorar} className={`${BOTON} bg-muted text-foreground hover:bg-muted/70`}>
                                {t('llamadas.ignorar')}
                            </button>
                            <button
                                type="button"
                                onClick={() => void contestar()}
                                disabled={!mic}
                                className={`${BOTON} bg-emerald-600 text-white hover:bg-emerald-700`}
                            >
                                <Phone className="h-4 w-4" /> {t('llamadas.contestar')}
                            </button>
                        </div>
                    </div>
                </>
            )}

            {(estado.fase === 'en_curso' || estado.fase === 'conectando' || estado.fase === 'llamando') && (
                <div className="mt-4 flex items-center justify-between gap-2">
                    <VerChat llamada={estado.llamada} />
                    <div className="flex gap-2">
                        {estado.fase === 'en_curso' && (
                            <button
                                type="button"
                                onClick={silenciar}
                                aria-pressed={estado.silenciado}
                                className={`${BOTON} ${estado.silenciado ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-muted text-foreground hover:bg-muted/70'}`}
                            >
                                {estado.silenciado ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                                {estado.silenciado ? t('llamadas.activarMicrofono') : t('llamadas.silenciar')}
                            </button>
                        )}
                        <button type="button" onClick={() => void colgar()} className={`${BOTON} bg-red-600 text-white hover:bg-red-700`}>
                            <PhoneOff className="h-4 w-4" /> {t('llamadas.colgar')}
                        </button>
                    </div>
                </div>
            )}

            {estado.fase === 'huerfana' && (
                <>
                    <p className="mt-3 text-xs text-muted-foreground text-pretty">{t('llamadas.huerfana')}</p>
                    <div className="mt-4 flex items-center justify-between gap-2">
                        <VerChat llamada={estado.llamada} />
                        <button type="button" onClick={() => void colgar()} className={`${BOTON} bg-red-600 text-white hover:bg-red-700`}>
                            <PhoneOff className="h-4 w-4" /> {t('llamadas.colgar')}
                        </button>
                    </div>
                </>
            )}

            {estado.fase === 'terminada' && (
                <p className="mt-3 text-sm text-muted-foreground text-pretty">
                    {estado.motivo === 'otro'
                        ? t('llamadas.otro')
                        : estado.motivo === 'error'
                          ? t(`llamadas.errores.${estado.detalle || 'conexion'}`, { defaultValue: t('llamadas.errores.conexion') })
                          : estado.duracion
                            ? t('llamadas.terminadaDuracion', { duracion: reloj(estado.duracion) })
                            : t('llamadas.terminada')}
                </p>
            )}
        </div>
    );

    return createPortal(tarjeta, document.body);
}
