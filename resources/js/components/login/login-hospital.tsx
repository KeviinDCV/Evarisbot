import { useAvisosCampo } from '@/components/avisos-campo';
import { useCapsLock } from '@/components/caps-lock-warning';
import { LanguageSelector } from '@/components/language-selector';
import { Spinner } from '@/components/ui/spinner';
import { useAppearance } from '@/hooks/use-appearance';
import { store } from '@/routes/login';
import { Form, Head, router } from '@inertiajs/react';
import axios from 'axios';
import {
    ArrowBigUp,
    ArrowRight,
    CalendarCheck,
    Check,
    CheckCheck,
    CircleAlert,
    Clock,
    Eye,
    EyeOff,
    KeyRound,
    Lock,
    type LucideIcon,
    Mail,
    Moon,
    RefreshCw,
    ServerCrash,
    ShieldAlert,
    ShieldCheck,
    Sun,
    WifiOff,
} from 'lucide-react';
import { type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

type Campo = 'email' | 'password';

/**
 * Lo que puede salir mal al enviar fuera de la validación (credenciales): sin esto Inertia abría su modal con la
 * página de error del servidor en inglés («429 | TOO MANY REQUESTS», «419 | PAGE EXPIRED», «500 | SERVER ERROR»)
 * tapando toda la pantalla, o no decía nada si no había red.
 */
type Falla = { tipo: 'bloqueo'; hasta: number } | { tipo: 'caducada' | 'servidor' | 'mantenimiento' | 'red' };

const FALLAS: Record<Falla['tipo'], { icono: LucideIcon; texto: string; tono: 'error' | 'info' }> = {
    bloqueo: { icono: ShieldAlert, texto: 'loginHospital.lockedNotice', tono: 'error' },
    caducada: { icono: RefreshCw, texto: 'loginHospital.expiredNotice', tono: 'info' },
    servidor: { icono: ServerCrash, texto: 'loginHospital.serverNotice', tono: 'error' },
    mantenimiento: { icono: Clock, texto: 'loginHospital.maintenanceNotice', tono: 'info' },
    red: { icono: WifiOff, texto: 'loginHospital.offlineNotice', tono: 'error' },
};

/** 75 → «1:15»; 3540 → «59:00». */
const minutosYSegundos = (segundos: number) => `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;

/**
 * Login "Tarjeta sobre el hospital" (design/login, artboard Tarjeta): fondo navy con el edificio
 * del HUV en grande, avisos decorativos que flotan alrededor y la tarjeta blanca al centro.
 * El formulario es el mismo de siempre (Fortify): correo, contraseña y "remember". Debajo, la frase
 * de Evarisbot (sin cifras: el usuario prefirió no mostrarlas en la entrada).
 */
export default function LoginHospital({ status }: { status?: string }) {
    const { t } = useTranslation();
    const { appearance, updateAppearance } = useAppearance();
    const [verClave, setVerClave] = useState(false);
    const mayus = useCapsLock();

    // Validación propia (avisos-campo): los campos siguen siendo `required`/`type=email`, pero sin el globo del
    // navegador. Cada campo dice lo suyo EN LA FILA DE SU ETIQUETA («Correo ··· Escribe tu correo.»): ahí hay
    // sitio, no tapa nada ni empuja la tarjeta. Antes el aviso flotaba bajo el campo, en 9–18 px donde no cabe un
    // globo de 36, y tapaba la etiqueta «Contraseña», la casilla o «Entrar».
    const validacion = useAvisosCampo({
        email: { vacio: t('loginHospital.errorEmailEmpty'), formato: t('loginHospital.errorEmailFormat') },
        password: { vacio: t('loginHospital.errorPasswordEmpty') },
    });
    const alEscribir = (campo: Campo) => validacion.alEscribir(campo);
    const [falla, setFalla] = useState<Falla | null>(null);
    const alEnviar = () => {
        validacion.alEnviar();
        // Al volver a intentar se quita el aviso anterior (el del bloqueo no: sigue su cuenta regresiva).
        setFalla((f) => (f?.tipo === 'bloqueo' ? f : null));
    };

    // Respuestas que no son de Inertia (página de error del servidor) y fallos de red, SOLO mientras este
    // formulario envía: se cancela el modal de Inertia y se muestra un aviso propio en la tarjeta. Mismo
    // patrón que la carga diferida de Estadísticas.
    const enviando = useRef(false);
    const [ahora, setAhora] = useState(() => Date.now());
    useEffect(() => {
        const offInvalid = router.on('invalid', (event) => {
            if (!enviando.current) return;
            event.preventDefault();
            const { status, headers } = event.detail.response;
            if (status === 429) {
                // Retry-After: lo que falta del límite que saltó (5 por minuto, o 30 por hora por correo).
                const segundos = Number(headers?.['retry-after']);
                setAhora(Date.now());
                setFalla({ tipo: 'bloqueo', hasta: Date.now() + (segundos > 0 ? segundos : 60) * 1000 });
            } else if (status === 419) {
                // El reintento de app.tsx ya falló una vez: se pide token nuevo para que el próximo «Entrar» pase.
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

    // Cuenta regresiva del bloqueo: «Entrar» queda desactivado y dice cuánto falta; al llegar a cero se va el aviso.
    const hastaBloqueo = falla?.tipo === 'bloqueo' ? falla.hasta : null;
    useEffect(() => {
        if (hastaBloqueo === null) return;
        const reloj = window.setInterval(() => {
            const t = Date.now();
            setAhora(t);
            if (t >= hastaBloqueo) setFalla(null);
        }, 1000);
        return () => window.clearInterval(reloj);
    }, [hastaBloqueo]);
    const faltan = hastaBloqueo === null ? 0 : Math.max(0, Math.ceil((hastaBloqueo - ahora) / 1000));
    const bloqueado = faltan > 0;

    const oscuro =
        appearance === 'dark' ||
        (appearance === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    // Decorativos: no son datos en vivo (por eso aria-hidden) y solo caben en pantallas anchas. Cada uno con
    // su color de brillo (RGB) para cuando le toca destacar y su profundidad (cuánto sigue al mouse).
    const avisos: { lugar: string; icono: ReactNode; texto: string; brillo: string; profundidad: number }[] = [
        { lugar: 'left-[7%] top-[24%]', icono: <CalendarCheck className="lh-chip-icono h-4 w-4 text-[#7ee2b2]" />, texto: t('loginHospital.chipConfirmed'), brillo: '126, 226, 178', profundidad: 22 },
        { lugar: 'left-[11%] top-[60%]', icono: <CheckCheck className="lh-chip-icono h-4 w-4 text-[#b9c3ff]" />, texto: t('loginHospital.chipDelivered'), brillo: '185, 195, 255', profundidad: 14 },
        { lugar: 'right-[8%] top-[30%]', icono: <span className="lh-punto relative h-2 w-2 rounded-full bg-emerald-400" />, texto: t('loginHospital.chipNewMessage'), brillo: '52, 211, 153', profundidad: 18 },
        { lugar: 'right-[12%] top-[64%]', icono: <Check className="lh-chip-icono h-4 w-4 text-[#7ee2b2]" />, texto: t('loginHospital.chipResolved'), brillo: '126, 226, 178', profundidad: 26 },
    ];

    // Los avisos siguen un poco al mouse, cada uno a su profundidad: la posición va en variables CSS de la raíz
    // (sin volver a pintar React), una vez por cuadro. Con el puntero fuera vuelven a su sitio.
    const raiz = useRef<HTMLDivElement>(null);
    const cuadro = useRef(0);
    const moverAvisos = (x: number, y: number) => {
        cancelAnimationFrame(cuadro.current);
        cuadro.current = requestAnimationFrame(() => {
            raiz.current?.style.setProperty('--lh-mx', x.toFixed(3));
            raiz.current?.style.setProperty('--lh-my', y.toFixed(3));
        });
    };
    const alMoverPuntero = (e: ReactPointerEvent<HTMLDivElement>) => {
        if (e.pointerType === 'mouse') moverAvisos(e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5);
    };
    useEffect(() => () => cancelAnimationFrame(cuadro.current), []);

    return (
        <div
            ref={raiz}
            onPointerMove={alMoverPuntero}
            onPointerLeave={() => moverAvisos(0, 0)}
            className="lh-raiz relative flex min-h-svh flex-col items-center justify-center gap-5 overflow-clip px-4 pb-12 pt-24 text-white antialiased sm:px-6"
        >
            <Head title={t('auth.loginTitle')} />

            <img
                src="/images/favicon.png"
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute bottom-[-90px] left-1/2 w-[min(1180px,170vw)] max-w-none -translate-x-1/2 select-none opacity-[0.09]"
            />

            {/* Tres capas por aviso para que los movimientos no se pisen: el lugar (sigue al mouse), la que
                flota y el aviso (llega, destaca y lleva el destello). */}
            {avisos.map((aviso, i) => (
                <div
                    key={aviso.lugar}
                    aria-hidden="true"
                    className={`lh-chip-lugar pointer-events-none absolute hidden xl:block ${aviso.lugar}`}
                    style={{ '--lh-i': i, '--lh-brillo': aviso.brillo, '--lh-prof': `${aviso.profundidad}px` } as CSSProperties}
                >
                    <div className="lh-chip-flota">
                        <div className="lh-chip flex items-center gap-2.5 rounded-[14px] border border-white/[0.18] bg-white/10 px-3.5 py-2.5 text-[13px] font-medium text-white">
                            {aviso.icono}
                            {aviso.texto}
                        </div>
                    </div>
                </div>
            ))}

            <header className="lh-barra absolute inset-x-0 top-0 flex items-center justify-between gap-3 px-4 py-5 sm:px-8 sm:py-6">
                <p className="text-[15px] font-semibold tracking-[0.04em] text-white/90">EVARISBOT</p>
                <div className="flex items-center gap-2.5">
                    <button
                        type="button"
                        onClick={() => updateAppearance(oscuro ? 'light' : 'dark')}
                        className="lh-control flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/[0.16]"
                        title={oscuro ? t('common.switchToLight') : t('common.switchToDark')}
                        aria-label={oscuro ? t('common.switchToLight') : t('common.switchToDark')}
                    >
                        {oscuro ? <Sun className="h-[18px] w-[18px]" aria-hidden="true" /> : <Moon className="h-[18px] w-[18px]" aria-hidden="true" />}
                    </button>
                    <LanguageSelector variant="translucido" />
                </div>
            </header>

            {/* `contents`: el <main> marca la región principal sin entrar en el flex de la raíz. */}
            <main className="contents">
                <Form
                    {...store.form()}
                    resetOnSuccess={['password']}
                    className="lh-tarjeta relative flex w-full max-w-[440px] flex-col rounded-[26px] px-6 pb-7 pt-8 sm:px-9"
                    style={{ background: 'var(--lh-tarjeta)', color: 'var(--lh-texto)', boxShadow: 'var(--lh-sombra)' }}
                    onSubmitCapture={alEnviar}
                    onStart={() => {
                        enviando.current = true;
                    }}
                    onFinish={() => {
                        enviando.current = false;
                    }}
                >
                    {({ processing, errors }) => {
                        // Lo que no es de un campo va en UN lugar, arriba de los campos: una falla del envío
                        // (bloqueo, servidor, red) o el error del servidor («credenciales no coinciden», que no dice
                        // cuál de los dos está mal). Con una falla, el error del intento anterior ya no aplica:
                        // Inertia lo conserva porque la respuesta no traía errores nuevos.
                        // El servidor siempre responde en español con el texto de Laravel («Estas credenciales no
                        // coinciden con nuestros registros»): se reconoce y se muestra uno propio, que dice qué hacer y
                        // sale en el idioma de la pantalla. Cualquier otro mensaje del servidor se muestra tal cual.
                        const delServidor = falla ? undefined : (errors.email ?? errors.password);
                        const errorServidor = delServidor && /credenciales|credentials/i.test(delServidor) ? t('loginHospital.wrongCredentials') : delServidor;
                        const mensajeCorreo = validacion.mensaje('email');
                        const mensajeClave = validacion.mensaje('password');
                        const describeClave = [mayus.activo ? 'aviso-mayus' : null, mensajeClave ? 'error-clave' : null].filter(Boolean).join(' ') || undefined;

                        return (
                        <>
                            <div className="flex flex-col items-center gap-3 text-center">
                                <img src="/images/logo.png" alt="Hospital Universitario del Valle" className="auth-logo lh-logo h-[92px] w-auto" />
                                <div className="flex flex-col gap-1">
                                    <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em]">{t('loginHospital.welcome')}</h1>
                                    <p className="text-[14.5px]" style={{ color: 'var(--lh-sub)' }}>
                                        {t('loginHospital.tagline')}
                                    </p>
                                </div>
                            </div>

                            {status && (
                                <div
                                    role="status"
                                    className="rounded-xl px-4 py-2.5 text-center text-sm font-medium text-pretty"
                                    style={{ background: 'var(--lh-estado-bg)', color: 'var(--lh-falla-info-texto)' }}
                                >
                                    {status}
                                </div>
                            )}

                            {falla ? (
                                <AvisoTarjeta tono={FALLAS[falla.tipo].tono} icono={FALLAS[falla.tipo].icono} texto={t(FALLAS[falla.tipo].texto)} />
                            ) : (
                                errorServidor && <AvisoTarjeta tono="error" icono={CircleAlert} texto={errorServidor} />
                            )}

                            {/* Los campos y la casilla, juntos; la tarjeta separa más los grupos (cabecera, campos,
                                botón, notas) que lo de dentro de cada uno. */}
                            <div className="lh-campos flex flex-col">
                                <div className="flex flex-col gap-2">
                                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                        <label htmlFor="email" className="text-[13.5px] font-semibold" style={{ color: 'var(--lh-label)' }}>
                                            {t('loginHospital.email')}
                                        </label>
                                        {mensajeCorreo && <MensajeCampo id="error-correo" texto={mensajeCorreo} />}
                                    </div>
                                    <div className="relative flex items-center">
                                        <Mail aria-hidden="true" className="pointer-events-none absolute left-4 h-[18px] w-[18px]" style={{ color: 'var(--lh-icono)' }} />
                                        <input
                                            id="email"
                                            type="email"
                                            name="email"
                                            required
                                            autoFocus
                                            autoComplete="email"
                                            placeholder={t('loginHospital.emailPlaceholder')}
                                            aria-invalid={validacion.invalido('email') || undefined}
                                            aria-describedby={mensajeCorreo ? 'error-correo' : undefined}
                                            onInvalid={validacion.alInvalidar('email')}
                                            onInput={alEscribir('email')}
                                            className="lh-input h-[50px] w-full rounded-[14px] pl-[46px] pr-4 text-base"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                        <label htmlFor="password" className="text-[13.5px] font-semibold" style={{ color: 'var(--lh-label)' }}>
                                            {t('loginHospital.password')}
                                        </label>
                                        {mensajeClave && <MensajeCampo id="error-clave" texto={mensajeClave} />}
                                    </div>
                                    <div className="relative flex items-center">
                                        <Lock aria-hidden="true" className="pointer-events-none absolute left-4 h-[18px] w-[18px]" style={{ color: 'var(--lh-icono)' }} />
                                        <input
                                            id="password"
                                            type={verClave ? 'text' : 'password'}
                                            name="password"
                                            required
                                            autoComplete="current-password"
                                            placeholder={t('loginHospital.passwordPlaceholder')}
                                            className={`lh-input h-[50px] w-full rounded-[14px] pl-[46px] text-base ${mayus.activo ? 'pr-[148px]' : 'pr-[52px]'}`}
                                            {...mayus.props}
                                            aria-invalid={validacion.invalido('password') || undefined}
                                            aria-describedby={describeClave}
                                            onInvalid={validacion.alInvalidar('password')}
                                            onInput={alEscribir('password')}
                                        />
                                        {/* Bloq Mayús DENTRO del campo, junto al ojo: antes flotaba debajo y tapaba «Entrar». */}
                                        {mayus.activo && (
                                            <span
                                                id="aviso-mayus"
                                                role="status"
                                                className="lh-mayus pointer-events-none absolute right-[50px] flex items-center gap-1 rounded-md px-1.5 py-1 text-[11.5px] font-semibold leading-none"
                                            >
                                                <ArrowBigUp aria-hidden="true" className="h-3.5 w-3.5" />
                                                <span aria-hidden="true">{t('loginHospital.capsShort')}</span>
                                                <span className="sr-only">{t('auth.capsLockOn', 'Bloq Mayús está activado')}</span>
                                            </span>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => setVerClave((v) => !v)}
                                            className="lh-ojo absolute right-[3px] flex h-11 w-11 items-center justify-center rounded-[10px] transition-colors hover:bg-[var(--lh-anillo)]"
                                            style={{ color: 'var(--lh-placeholder)' }}
                                            aria-label={t('auth.showPassword', 'Mostrar contraseña')}
                                            aria-pressed={verClave}
                                            title={verClave ? t('auth.hidePassword', 'Ocultar contraseña') : t('auth.showPassword', 'Mostrar contraseña')}
                                        >
                                            {verClave ? <EyeOff className="h-[19px] w-[19px]" aria-hidden="true" /> : <Eye className="h-[19px] w-[19px]" aria-hidden="true" />}
                                        </button>
                                    </div>
                                </div>

                                <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm" style={{ color: 'var(--lh-sub)' }}>
                                    <input type="checkbox" name="remember" value="1" className="lh-check h-[18px] w-[18px] cursor-pointer" style={{ accentColor: 'var(--lh-acento)' }} />
                                    {t('loginHospital.keepSession')}
                                </label>
                            </div>

                            <button
                                type="submit"
                                disabled={processing || bloqueado}
                                className={`lh-boton flex h-[54px] items-center justify-center gap-2.5 rounded-[14px] text-base font-semibold text-white tabular-nums disabled:cursor-not-allowed disabled:opacity-70 ${bloqueado ? 'lh-boton-espera' : ''}`}
                            >
                                {bloqueado ? (
                                    <>
                                        <Clock className="h-[18px] w-[18px]" aria-hidden="true" />
                                        {t('loginHospital.lockedButton', { tiempo: minutosYSegundos(faltan) })}
                                    </>
                                ) : (
                                    <>
                                        {processing && <Spinner />}
                                        {t('loginHospital.submit')}
                                        {!processing && <ArrowRight className="h-[18px] w-[18px]" aria-hidden="true" />}
                                    </>
                                )}
                            </button>

                            {/* Dos notas distintas, cada una con su ícono: la ayuda (qué hacer) y el aviso (quién puede
                                entrar). Antes iban en un mismo párrafo y la ayuda se perdía en la letra pequeña. */}
                            <ul className="lh-notas flex flex-col border-t text-[13px] leading-normal" style={{ borderColor: 'var(--lh-separador)', color: 'var(--lh-sub)' }}>
                                <li className="flex items-start gap-2.5">
                                    <KeyRound aria-hidden="true" className="mt-px h-[18px] w-[18px] shrink-0" style={{ color: 'var(--lh-escudo)' }} />
                                    <span className="text-pretty">{t('loginHospital.forgotHelp')}</span>
                                </li>
                                <li className="flex items-start gap-2.5">
                                    <ShieldCheck aria-hidden="true" className="mt-px h-[18px] w-[18px] shrink-0" style={{ color: 'var(--lh-escudo)' }} />
                                    <span className="text-pretty">{t('loginHospital.securityNote')}</span>
                                </li>
                            </ul>
                        </>
                        );
                    }}
                </Form>

                <p className="relative text-center text-[15px] font-medium text-balance text-white/90">{t('loginHospital.motto')}</p>
            </main>

            <footer className="relative text-center text-xs text-balance text-white/70">{t('loginHospital.footer')}</footer>
        </div>
    );
}

/** Aviso de un campo, en la fila de su etiqueta (a la derecha; si es largo, baja a su propia línea). */
function MensajeCampo({ id, texto }: { id: string; texto: string }) {
    return (
        <p id={id} role="alert" className="lh-error-campo flex items-start gap-1.5 text-[12.5px] font-medium leading-snug">
            <CircleAlert aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0" />
            {texto}
        </p>
    );
}

/**
 * Aviso de la tarjeta, arriba de los campos: fallas del envío y el error del servidor. `role="alert"` lo anuncia
 * una vez; la cuenta regresiva del bloqueo va en el botón (no aquí), para que el lector no la repita cada segundo.
 */
function AvisoTarjeta({ tono, icono: Icono, texto }: { tono: 'error' | 'info'; icono: LucideIcon; texto: string }) {
    return (
        <div role="alert" className={`lh-falla lh-falla-${tono} flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-[13.5px] font-medium leading-snug`}>
            <Icono aria-hidden="true" className="mt-px h-[18px] w-[18px] shrink-0" />
            <p className="text-pretty">{texto}</p>
        </div>
    );
}
