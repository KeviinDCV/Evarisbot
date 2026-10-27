import CapsLockWarning, { useCapsLock } from '@/components/caps-lock-warning';
import { LanguageSelector } from '@/components/language-selector';
import { Spinner } from '@/components/ui/spinner';
import { useAppearance } from '@/hooks/use-appearance';
import { store } from '@/routes/login';
import { Form, Head } from '@inertiajs/react';
import { ArrowRight, CalendarCheck, Check, CheckCheck, CircleAlert, Eye, EyeOff, Lock, Mail, Moon, ShieldCheck, Sun } from 'lucide-react';
import { type CSSProperties, type InvalidEvent, type PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

type Campo = 'email' | 'password';

/**
 * Avisos de un campo (error y Bloq Mayús) FLOTANDO bajo él, encima del contenido: no empujan la
 * tarjeta ni crean scroll. Va dentro del contenedor `relative` del input.
 */
function Flotantes({ children }: { children: ReactNode }) {
    return <div className="pointer-events-none absolute left-0 top-[calc(100%+9px)] z-30 flex flex-col items-start gap-1.5">{children}</div>;
}

/** Globo de error propio (reemplaza al "Completa este campo" del navegador). */
function Burbuja({ id, texto }: { id: string; texto?: string }) {
    if (!texto) return null;

    return (
        <p
            id={id}
            role="alert"
            className="lh-burbuja relative flex w-max max-w-[min(400px,calc(100vw-64px))] items-start gap-2 rounded-xl px-3 py-2 text-[13px] font-medium leading-snug"
        >
            <CircleAlert aria-hidden="true" className="mt-px h-4 w-4 shrink-0" />
            {texto}
        </p>
    );
}

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

    // Validación propia: los campos siguen siendo `required`/`type=email` (el navegador no deja enviar),
    // pero al cancelar el evento `invalid` no sale su globo y mostramos nuestro mensaje bajo el campo.
    const [erroresLocales, setErroresLocales] = useState<Partial<Record<Campo, string>>>({});
    const ultimoInvalido = useRef(0);

    const alInvalidar = (campo: Campo) => (e: InvalidEvent<HTMLInputElement>) => {
        e.preventDefault();
        const validez = e.currentTarget.validity;
        const texto = validez.valueMissing
            ? t(campo === 'email' ? 'loginHospital.errorEmailEmpty' : 'loginHospital.errorPasswordEmpty')
            : validez.typeMismatch
              ? t('loginHospital.errorEmailFormat')
              : e.currentTarget.validationMessage;
        setErroresLocales((a) => ({ ...a, [campo]: texto }));

        // Varios campos fallan en el mismo intento: el cursor va solo al primero.
        const ahora = Date.now();
        if (ahora - ultimoInvalido.current > 300) e.currentTarget.focus();
        ultimoInvalido.current = ahora;
    };
    // Los errores del servidor ("credenciales no coinciden") se esconden en cuanto la persona vuelve a
    // escribir, para que el globo no quede flotando encima mientras corrige; vuelven si al enviar persisten.
    const [ocultarServidor, setOcultarServidor] = useState(false);
    const alEscribir = (campo: Campo) => () => {
        setErroresLocales((a) => (a[campo] ? { ...a, [campo]: undefined } : a));
        setOcultarServidor(true);
    };

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

            <div className="lh-barra absolute inset-x-0 top-0 flex items-center justify-between gap-3 px-4 py-5 sm:px-8 sm:py-6">
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
            </div>

            <Form
                {...store.form()}
                resetOnSuccess={['password']}
                className="lh-tarjeta relative flex w-full max-w-[440px] flex-col gap-[18px] rounded-[26px] px-6 pb-7 pt-8 sm:px-9"
                style={{ background: 'var(--lh-tarjeta)', color: 'var(--lh-texto)', boxShadow: 'var(--lh-sombra)' }}
                onSubmitCapture={() => setOcultarServidor(false)}
            >
                {({ processing, errors }) => {
                    const errorCorreo = erroresLocales.email ?? (ocultarServidor ? undefined : errors.email);
                    const errorClave = erroresLocales.password ?? (ocultarServidor ? undefined : errors.password);
                    const describeClave = [mayus.activo ? 'aviso-mayus' : null, errorClave ? 'error-clave' : null].filter(Boolean).join(' ') || undefined;

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
                                className="rounded-xl px-4 py-2.5 text-center text-sm font-medium"
                                style={{ background: 'var(--lh-estado-bg)', color: 'var(--lh-acento)' }}
                            >
                                {status}
                            </div>
                        )}

                        <div className="flex flex-col gap-2">
                            <label htmlFor="email" className="text-[13.5px] font-semibold" style={{ color: 'var(--lh-label)' }}>
                                {t('loginHospital.email')}
                            </label>
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
                                    aria-invalid={errorCorreo ? true : undefined}
                                    aria-describedby={errorCorreo ? 'error-correo' : undefined}
                                    onInvalid={alInvalidar('email')}
                                    onInput={alEscribir('email')}
                                    className="lh-input h-[50px] w-full rounded-[14px] pl-[46px] pr-4 text-[15px]"
                                />
                                {errorCorreo && (
                                    <Flotantes>
                                        <Burbuja id="error-correo" texto={errorCorreo} />
                                    </Flotantes>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label htmlFor="password" className="text-[13.5px] font-semibold" style={{ color: 'var(--lh-label)' }}>
                                {t('loginHospital.password')}
                            </label>
                            <div className="relative flex items-center">
                                <Lock aria-hidden="true" className="pointer-events-none absolute left-4 h-[18px] w-[18px]" style={{ color: 'var(--lh-icono)' }} />
                                <input
                                    id="password"
                                    type={verClave ? 'text' : 'password'}
                                    name="password"
                                    required
                                    autoComplete="current-password"
                                    placeholder={t('loginHospital.passwordPlaceholder')}
                                    className="lh-input h-[50px] w-full rounded-[14px] pl-[46px] pr-[52px] text-[15px]"
                                    {...mayus.props}
                                    aria-invalid={errorClave ? true : undefined}
                                    aria-describedby={describeClave}
                                    onInvalid={alInvalidar('password')}
                                    onInput={alEscribir('password')}
                                />
                                <button
                                    type="button"
                                    onClick={() => setVerClave((v) => !v)}
                                    className="lh-ojo absolute right-[3px] flex h-11 w-11 items-center justify-center rounded-[10px] transition-colors hover:bg-[var(--lh-anillo)]"
                                    style={{ color: 'var(--lh-placeholder)' }}
                                    aria-label={verClave ? t('auth.hidePassword', 'Ocultar contraseña') : t('auth.showPassword', 'Mostrar contraseña')}
                                    aria-pressed={verClave}
                                >
                                    {verClave ? <EyeOff className="h-[19px] w-[19px]" aria-hidden="true" /> : <Eye className="h-[19px] w-[19px]" aria-hidden="true" />}
                                </button>
                                {(errorClave || mayus.activo) && (
                                    <Flotantes>
                                        <Burbuja id="error-clave" texto={errorClave} />
                                        {mayus.activo && (
                                            <span className="lh-flotante-sombra rounded-lg">
                                                <CapsLockWarning visible />
                                            </span>
                                        )}
                                    </Flotantes>
                                )}
                            </div>
                        </div>

                        <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm" style={{ color: 'var(--lh-sub)' }}>
                            <input type="checkbox" name="remember" value="1" className="h-[18px] w-[18px] cursor-pointer" style={{ accentColor: 'var(--lh-acento)' }} />
                            {t('loginHospital.keepSession')}
                        </label>

                        <button
                            type="submit"
                            disabled={processing}
                            className="lh-boton mt-1 flex h-[54px] items-center justify-center gap-2.5 rounded-[14px] text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {processing && <Spinner />}
                            {t('loginHospital.submit')}
                            {!processing && <ArrowRight className="h-[18px] w-[18px]" aria-hidden="true" />}
                        </button>

                        <div
                            className="flex items-start gap-2.5 border-t pt-4 text-[13px] leading-normal"
                            style={{ borderColor: 'var(--lh-separador)', color: 'var(--lh-sub)' }}
                        >
                            <ShieldCheck aria-hidden="true" className="mt-px h-[18px] w-[18px] shrink-0" style={{ color: 'var(--lh-escudo)' }} />
                            <p>
                                {t('loginHospital.securityNote')} {t('loginHospital.forgotHelp')}
                            </p>
                        </div>
                    </>
                    );
                }}
            </Form>

            <p className="relative text-center text-[15px] font-medium text-white/90">{t('loginHospital.motto')}</p>

            <p className="relative text-center text-xs text-white/70">{t('loginHospital.footer')}</p>
        </div>
    );
}
