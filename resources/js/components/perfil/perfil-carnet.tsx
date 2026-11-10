import PasswordController from '@/actions/App/Http/Controllers/Settings/PasswordController';
import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import { AvisoBajoCampo, useAvisosCampo } from '@/components/avisos-campo';
import { AvisoEnvio } from '@/components/aviso-envio';
import { IndicadorMayus, useCapsLock } from '@/components/caps-lock-warning';
import { Spinner } from '@/components/ui/spinner';
import { type Appearance, useAppearance } from '@/hooks/use-appearance';
import { useInitials } from '@/hooks/use-initials';
import AdminLayout from '@/layouts/admin-layout';
import { minutosYSegundos, useFallasEnvio } from '@/lib/fallas-envio';
import { cn } from '@/lib/utils';
import { logout } from '@/routes';
import { send } from '@/routes/verification';
import { type SharedData } from '@/types';
import { Transition } from '@headlessui/react';
import { Form, Head, Link, usePage } from '@inertiajs/react';
import { Check, CircleAlert, Clock, Headset, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import { type ReactNode, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// Piezas visuales compartidas por las tarjetas (design/perfil, artboard Main).
const TARJETA = 'rounded-[18px] border border-[#e3e6f0] bg-card p-5 sm:px-6 sm:py-[22px] dark:border-border';
const ETIQUETA = 'text-[13px] font-semibold text-[#3a3f63] dark:text-foreground/85';
// Bordes de campo y círculos de requisito a ≥3:1 sobre la tarjeta en los dos temas (WCAG 1.4.11): #888fb5 en
// claro (3,16:1) y hsl(30,4%,42%) en oscuro (3,04:1; antes 1,9). Texto de ejemplo ≥4,5:1.
const CAMPO =
    'h-[46px] w-full rounded-xl border-[1.5px] border-[#888fb5] bg-[#f7f8fc] px-3.5 text-[16px] text-foreground outline-none transition placeholder:text-[#676d8e] focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10 aria-[invalid=true]:border-red-600 dark:border-[hsl(30,4%,42%)] dark:bg-muted/40 dark:placeholder:text-[hsl(30,5%,58%)] dark:aria-[invalid=true]:border-red-400';
const BOTON =
    'inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-[14.5px] font-semibold text-white transition-colors hover:bg-[#26356f] disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-primary/90';
// El botón durante el bloqueo por intentos: desactivado pero legible (con la opacidad de siempre el blanco quedaba
// en ~3,4:1 justo cuando dice cuánto falta). 6,6:1 en claro.
const BOTON_ESPERA = 'disabled:opacity-100 bg-[#56639c] hover:bg-[#56639c] dark:bg-[hsl(231,30%,38%)] dark:hover:bg-[hsl(231,30%,38%)]';
const SECUNDARIO =
    'inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#dfe2ef] bg-card px-4 text-sm font-semibold text-primary transition-colors hover:bg-[#f4f6fc] dark:border-border dark:text-[hsl(231,85%,84%)] dark:hover:bg-muted/50';

type CampoClave = 'current_password' | 'password' | 'password_confirmation';

/** Requisitos de Password::defaults() (AppServiceProvider): 5 caracteres, letras y números. */
const REGLAS = {
    largo: (v: string) => v.length >= 5,
    letras: (v: string) => /\p{L}/u.test(v),
    numeros: (v: string) => /\d/.test(v),
};
const cumpleReglas = (v: string) => REGLAS.largo(v) && REGLAS.letras(v) && REGLAS.numeros(v);

// El servidor puede responder con la clave cruda («validation.confirmed») o con el texto traducido; se reconoce
// por el contenido para mostrar uno propio, en el idioma de la pantalla y en el campo que corresponde.
const esConfirmacion = (m?: string) => !!m && /confirm|coincid/i.test(m);
const esCorreoUsado = (m?: string) => !!m && /unique|registrad|taken/i.test(m);

function Encabezado({ id, titulo, ayuda }: { id: string; titulo: string; ayuda: string }) {
    return (
        <div>
            <h2 id={id} className="text-[17px] font-semibold text-foreground">
                {titulo}
            </h2>
            <p className="mt-0.5 text-[13.5px] text-muted-foreground">{ayuda}</p>
        </div>
    );
}

/**
 * «Guardado» visible 2 s. El anuncio va en una región `role="status"` que existe SIEMPRE (vacía hasta que se
 * guarda): si la región aparece ya con el texto, como antes, el lector de pantalla puede no decirlo.
 */
function Guardado({ visible, texto }: { visible: boolean; texto: string }) {
    return (
        <>
            <span role="status" className="sr-only">
                {visible ? texto : ''}
            </span>
            <Transition show={visible} enter="transition duration-200" enterFrom="opacity-0" leave="transition duration-500" leaveTo="opacity-0">
                <span aria-hidden="true" className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    <Check className="h-4 w-4" aria-hidden="true" />
                    {texto}
                </span>
            </Transition>
        </>
    );
}

/** Un requisito de la contraseña: verde si se cumple; rojo si se intentó guardar sin cumplirlo. */
function Regla({ cumple, falta, children }: { cumple: boolean; falta: boolean; children: ReactNode }) {
    return (
        <li
            className={cn(
                'flex items-center gap-1.5',
                cumple ? 'font-semibold text-emerald-700 dark:text-emerald-400' : falta ? 'aviso-bajo-campo font-semibold' : 'text-muted-foreground',
            )}
        >
            {cumple ? (
                <Check className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
            ) : falta ? (
                <CircleAlert className="h-4 w-4" aria-hidden="true" />
            ) : (
                <span aria-hidden="true" className="h-4 w-4 rounded-full border-[1.5px] border-[#888fb5] dark:border-[hsl(30,4%,42%)]" />
            )}
            {children}
            <span className="sr-only">{cumple ? '✓' : ''}</span>
        </li>
    );
}

/**
 * Perfil "Carnet y ajustes" (design/perfil, opción A): a la izquierda el carnet de la persona; a la
 * derecha sus datos, la contraseña con los requisitos a la vista y la apariencia/idioma. Los formularios
 * son los mismos de siempre. (La verificación en dos pasos se quitó del perfil a pedido del usuario.)
 *
 * Errores: cada aviso va en el flujo, bajo su campo (los globos flotantes tapaban los requisitos y, en el
 * celular, la etiqueta del campo siguiente). Lo que el navegador puede comprobar antes de enviar se comprueba
 * (requisitos, que «Repetir» coincida, que la nueva sea distinta); lo que solo sabe el servidor (la contraseña
 * actual, un correo repetido) llega traducido en el campo correcto, y el foco va a ese campo.
 */
export default function PerfilCarnet({ mustVerifyEmail, status }: { mustVerifyEmail: boolean; status?: string }) {
    const { t, i18n } = useTranslation();
    const { auth } = usePage<SharedData>().props;
    const usuario = auth.user;
    const iniciales = useInitials();
    const { appearance, updateAppearance } = useAppearance();
    const mayus = useCapsLock();
    const [nueva, setNueva] = useState('');
    const [verClaves, setVerClaves] = useState(false);
    const [focoClave, setFocoClave] = useState<CampoClave | null>(null);
    const fallasDatos = useFallasEnvio();
    const fallasClave = useFallasEnvio();

    // «Guardar cambios» solo cuando hay algo que guardar (antes decía «Guardado» aunque nada cambiara). El
    // servidor guarda el correo en minúsculas: se compara igual.
    const [datos, setDatos] = useState({ name: usuario.name, email: usuario.email });
    const hayCambios = datos.name.trim() !== usuario.name || datos.email.trim().toLowerCase() !== String(usuario.email).toLowerCase();

    const refActual = useRef<HTMLInputElement>(null);
    const refNueva = useRef<HTMLInputElement>(null);
    const refRepetir = useRef<HTMLInputElement>(null);

    const idioma = i18n.language?.startsWith('en') ? 'en' : 'es';
    const desde = usuario.created_at
        ? new Date(usuario.created_at).toLocaleDateString(idioma === 'en' ? 'en-US' : 'es-CO', { month: 'long', year: 'numeric' })
        : null;
    const rol = t(`users.roles.${usuario.role}`, String(usuario.role ?? ''));
    const IconoRol = usuario.role === 'admin' ? ShieldCheck : usuario.role === 'advisor' ? Headset : UserRound;
    const temas: { valor: Appearance; texto: string }[] = [
        { valor: 'light', texto: t('perfilCarnet.themeLight') },
        { valor: 'dark', texto: t('perfilCarnet.themeDark') },
        { valor: 'system', texto: t('perfilCarnet.themeSystem') },
    ];
    const temaActual = temas.find((x) => x.valor === appearance)?.texto ?? temas[0].texto;

    const cambiarIdioma = (codigo: 'es' | 'en') => {
        if (codigo === idioma) return;
        try {
            localStorage.setItem('i18nextLng', codigo);
        } catch {
            // sin localStorage: igual se cambia en esta pestaña
        }
        i18n.changeLanguage(codigo).then(() => window.location.reload());
    };

    const avisosDatos = useAvisosCampo({
        name: { vacio: t('perfilCarnet.errorName') },
        email: { vacio: t('perfilCarnet.errorEmail'), formato: t('perfilCarnet.errorEmailFormat') },
    });
    const avisosClave = useAvisosCampo({
        current_password: { vacio: t('perfilCarnet.errorCurrent') },
        password: { vacio: t('perfilCarnet.errorNew') },
        password_confirmation: { vacio: t('perfilCarnet.errorRepeat') },
    });

    // Lo que se puede saber antes de enviar va como validación del navegador (setCustomValidity): el formulario
    // no se envía y el aviso sale en su campo, como «Escribe…». Se recalcula al escribir en cualquiera de los tres.
    const validarClaves = () => {
        const actual = refActual.current;
        const campoNueva = refNueva.current;
        const repetir = refRepetir.current;
        if (!actual || !campoNueva || !repetir) return;
        const v = campoNueva.value;
        campoNueva.setCustomValidity(
            v && !cumpleReglas(v) ? t('perfilCarnet.errorRules') : v && actual.value && v === actual.value ? t('perfilCarnet.errorSame') : '',
        );
        repetir.setCustomValidity(repetir.value && repetir.value !== v ? t('perfilCarnet.errorMismatch') : '');
    };

    // Bloq Mayús en los TRES campos (antes solo en «Actual»: en «Nueva» es donde más daño hace, porque se guarda
    // en mayúsculas y al día siguiente no se puede entrar). El aviso va dentro del campo enfocado.
    // El campo se marca al enfocarlo y también al teclear en él (el foco no siempre dispara evento, p. ej. si la
    // ventana no tiene el foco del sistema; la tecla siempre llega al campo correcto).
    const propsMayus = (campo: CampoClave) => ({
        ...mayus.combinar({ onFocus: () => setFocoClave(campo) }),
        onKeyDownCapture: () => setFocoClave(campo),
    });
    const mayusEn = (campo: CampoClave) => mayus.activo && focoClave === campo;

    return (
        <AdminLayout>
            <Head title={t('perfilCarnet.title')} />

            <div className="p-4 md:p-6 lg:p-8">
                <div className="mx-auto grid max-w-[1104px] items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
                    {/* ═══ Carnet ═══ */}
                    <section
                        aria-label={t('perfilCarnet.carnetLabel')}
                        className="overflow-hidden rounded-[22px] border border-[#e3e6f0] bg-card shadow-[0_18px_40px_-26px_rgba(46,63,132,0.45)] lg:sticky lg:top-6 dark:border-border"
                    >
                        <div
                            className="relative h-32 overflow-hidden px-5 py-[18px]"
                            style={{ background: 'radial-gradient(ellipse 80% 70% at 50% 0%, #4e5fa4 0%, rgba(78,95,164,0) 70%), #2b3a7d' }}
                        >
                            <img
                                src="/images/favicon.png"
                                alt=""
                                aria-hidden="true"
                                className="pointer-events-none absolute bottom-[-40px] left-1/2 w-[320px] max-w-none -translate-x-1/2 opacity-[0.12]"
                            />
                            <p className="relative text-[11.5px] font-semibold tracking-[0.14em] text-white/90">EVARISBOT · HUV</p>
                        </div>
                        <div className="flex flex-col items-center gap-3.5 px-6 pb-6 text-center">
                            {usuario.avatar ? (
                                <img
                                    src={usuario.avatar}
                                    alt=""
                                    className="relative z-10 -mt-12 h-24 w-24 rounded-full border-4 border-card object-cover shadow-[0_10px_24px_-10px_rgba(46,63,132,0.7)] dark:shadow-[0_10px_24px_-10px_rgba(0,0,0,0.7)]"
                                />
                            ) : (
                                <span
                                    aria-hidden="true"
                                    className="relative z-10 -mt-12 flex h-24 w-24 items-center justify-center rounded-full border-4 border-card text-[32px] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(46,63,132,0.7)] dark:shadow-[0_10px_24px_-10px_rgba(0,0,0,0.7)]"
                                    style={{ background: 'linear-gradient(135deg, #4e5fa4, #2e3f84)' }}
                                >
                                    {iniciales(usuario.name)}
                                </span>
                            )}
                            <div className="flex min-w-0 flex-col items-center gap-1.5">
                                <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-foreground [overflow-wrap:anywhere]">{usuario.name}</h1>
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eef1fb] px-2.5 py-1 text-[12.5px] font-semibold text-primary dark:bg-primary/15 dark:text-[hsl(231,85%,84%)]">
                                    <IconoRol className="h-3.5 w-3.5" aria-hidden="true" />
                                    {rol}
                                </span>
                                {/* Un correo largo se parte en el @ o los puntos si cabe; nunca a mitad de palabra sin necesidad. */}
                                <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{usuario.email}</p>
                            </div>
                            <dl className="flex w-full flex-col gap-2.5 border-t border-[#eceef6] pt-4 text-left text-[13.5px] dark:border-border">
                                {desde && (
                                    <div className="flex justify-between gap-3">
                                        <dt className="text-muted-foreground">{t('perfilCarnet.memberSince')}</dt>
                                        <dd className="font-semibold text-foreground">{desde}</dd>
                                    </div>
                                )}
                                <div className="flex justify-between gap-3">
                                    <dt className="text-muted-foreground">{t('perfilCarnet.themeLanguage')}</dt>
                                    <dd className="font-semibold text-foreground">
                                        {temaActual} · {idioma === 'en' ? 'English' : 'Español'}
                                    </dd>
                                </div>
                            </dl>
                            <Link href={logout()} method="post" as="button" className={cn(SECUNDARIO, 'w-full')}>
                                <LogOut className="h-[17px] w-[17px]" aria-hidden="true" />
                                {t('perfilCarnet.logout')}
                            </Link>
                        </div>
                    </section>

                    <div className="flex min-w-0 max-w-[760px] flex-col gap-[18px]">
                        {/* ═══ Tus datos ═══ */}
                        <section aria-labelledby="perfil-datos" className={TARJETA}>
                            <Form
                                {...ProfileController.update.form()}
                                options={{ preserveScroll: true }}
                                onSubmitCapture={() => {
                                    avisosDatos.alEnviar();
                                    fallasDatos.alReintentar();
                                }}
                                onStart={fallasDatos.alEmpezar}
                                onFinish={fallasDatos.alTerminar}
                                onError={(errores) => {
                                    // El foco al primer campo con error (antes se quedaba en el botón).
                                    const campo = errores.name ? 'name' : errores.email ? 'email' : null;
                                    if (campo) document.getElementById(campo)?.focus();
                                }}
                                className="flex flex-col gap-4"
                            >
                                {({ processing, recentlySuccessful, errors: erroresServidor }) => {
                                    // Con un aviso de falla (bloqueo, red…), el error del intento ANTERIOR ya no aplica: Inertia
                                    // lo conserva porque la respuesta no traía errores nuevos.
                                    const errors = fallasDatos.falla ? {} as typeof erroresServidor : erroresServidor;
                                    const errorNombre = avisosDatos.mensaje('name', errors.name);
                                    const correoServidor = esCorreoUsado(errors.email) ? t('perfilCarnet.errorEmailTaken') : errors.email;
                                    const errorCorreo = avisosDatos.mensaje('email', correoServidor);
                                    return (
                                        <>
                                            <Encabezado id="perfil-datos" titulo={t('perfilCarnet.dataTitle')} ayuda={t('perfilCarnet.dataHelp')} />
                                            {fallasDatos.falla && <AvisoEnvio falla={fallasDatos.falla} />}
                                            <div className="grid gap-x-3.5 gap-y-5 sm:grid-cols-2">
                                                <div className="flex flex-col gap-1.5">
                                                    <label htmlFor="name" className={ETIQUETA}>
                                                        {t('perfilCarnet.name')}
                                                    </label>
                                                    <input
                                                        id="name"
                                                        name="name"
                                                        required
                                                        maxLength={255}
                                                        autoComplete="name"
                                                        defaultValue={usuario.name}
                                                        aria-invalid={avisosDatos.invalido('name', errors.name) || undefined}
                                                        aria-describedby={errorNombre ? 'error-nombre' : undefined}
                                                        onInvalid={avisosDatos.alInvalidar('name')}
                                                        onInput={(e) => {
                                                            avisosDatos.alEscribir('name')();
                                                            const valor = e.currentTarget.value;
                                                            setDatos((d) => ({ ...d, name: valor }));
                                                        }}
                                                        className={CAMPO}
                                                    />
                                                    <AvisoBajoCampo id="error-nombre" texto={errorNombre} />
                                                </div>
                                                <div className="flex flex-col gap-1.5">
                                                    <label htmlFor="email" className={ETIQUETA}>
                                                        {t('perfilCarnet.email')}
                                                    </label>
                                                    <input
                                                        id="email"
                                                        type="email"
                                                        name="email"
                                                        required
                                                        maxLength={255}
                                                        autoComplete="username"
                                                        defaultValue={usuario.email}
                                                        aria-invalid={avisosDatos.invalido('email', correoServidor) || undefined}
                                                        aria-describedby={errorCorreo ? 'error-correo ayuda-correo' : 'ayuda-correo'}
                                                        onInvalid={avisosDatos.alInvalidar('email')}
                                                        onInput={(e) => {
                                                            avisosDatos.alEscribir('email')();
                                                            const valor = e.currentTarget.value;
                                                            setDatos((d) => ({ ...d, email: valor }));
                                                        }}
                                                        className={CAMPO}
                                                    />
                                                    <AvisoBajoCampo id="error-correo" texto={errorCorreo} />
                                                    <p id="ayuda-correo" className="text-[12.5px] text-muted-foreground">
                                                        {t('perfilCarnet.emailHelp')}
                                                    </p>
                                                </div>
                                            </div>

                                            {mustVerifyEmail && usuario.email_verified_at === null && (
                                                <div className="rounded-xl bg-amber-50 p-3.5 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-300">
                                                    {t('settings.profile.emailNotVerified')}{' '}
                                                    <Link href={send()} as="button" className="font-semibold underline hover:no-underline">
                                                        {t('settings.profile.resendVerification')}
                                                    </Link>
                                                    {status === 'verification-link-sent' && (
                                                        <p className="mt-2 font-semibold text-emerald-700 dark:text-emerald-400">{t('settings.profile.verificationSent')}</p>
                                                    )}
                                                </div>
                                            )}

                                            <div className="flex flex-wrap items-center justify-end gap-3">
                                                <Guardado visible={recentlySuccessful} texto={t('perfilCarnet.saved')} />
                                                <button type="submit" disabled={processing || !hayCambios || fallasDatos.bloqueado} className={cn(BOTON, 'tabular-nums', fallasDatos.bloqueado && BOTON_ESPERA)}>
                                                    {fallasDatos.bloqueado ? (
                                                        <>
                                                            <Clock className="h-4 w-4" aria-hidden="true" />
                                                            {t('fallasEnvio.lockedButton', { tiempo: minutosYSegundos(fallasDatos.faltan) })}
                                                        </>
                                                    ) : (
                                                        <>
                                                            {processing && <Spinner />}
                                                            {processing ? t('perfilCarnet.saving') : t('perfilCarnet.save')}
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </>
                                    );
                                }}
                            </Form>
                        </section>

                        {/* ═══ Contraseña ═══ */}
                        <section aria-labelledby="perfil-clave" className={TARJETA}>
                            <Form
                                {...PasswordController.update.form()}
                                options={{ preserveScroll: true }}
                                // Solo se borra la actual (si falla, es la que hay que reescribir); antes se borraban
                                // las tres aunque la nueva estuviera bien, y los requisitos quedaban en verde con el
                                // campo vacío.
                                resetOnError={['current_password']}
                                resetOnSuccess
                                onSuccess={() => {
                                    setNueva('');
                                    setVerClaves(false);
                                }}
                                onSubmitCapture={() => {
                                    avisosClave.alEnviar();
                                    fallasClave.alReintentar();
                                }}
                                onStart={fallasClave.alEmpezar}
                                onFinish={fallasClave.alTerminar}
                                onError={(errores) => {
                                    const campo: CampoClave | null = errores.current_password
                                        ? 'current_password'
                                        : errores.password && !esConfirmacion(errores.password)
                                          ? 'password'
                                          : errores.password || errores.password_confirmation
                                            ? 'password_confirmation'
                                            : null;
                                    if (campo) document.getElementById(campo)?.focus();
                                }}
                                className="flex flex-col gap-4"
                            >
                                {({ processing, recentlySuccessful, errors: erroresServidor }) => {
                                    const errors = fallasClave.falla ? {} as typeof erroresServidor : erroresServidor;
                                    // Lo que solo sabe el servidor, traducido y en su campo. «No coinciden» va en
                                    // «Repetir» (Laravel lo pone en «password»).
                                    const servidorActual = errors.current_password ? t('perfilCarnet.errorCurrentWrong') : undefined;
                                    const servidorNueva = errors.password && !esConfirmacion(errors.password) ? t('perfilCarnet.errorRules') : undefined;
                                    const servidorRepetir =
                                        esConfirmacion(errors.password) || errors.password_confirmation ? t('perfilCarnet.errorMismatch') : undefined;
                                    const errorActual = avisosClave.mensaje('current_password', servidorActual);
                                    const errorNueva = avisosClave.mensaje('password', servidorNueva);
                                    const errorRepetir = avisosClave.mensaje('password_confirmation', servidorRepetir);
                                    const faltanReglas = errorNueva === t('perfilCarnet.errorRules');
                                    const describe = (...ids: (string | false | undefined)[]) => ids.filter(Boolean).join(' ') || undefined;
                                    const campoClave = (campo: CampoClave) =>
                                        cn(CAMPO, mayusEn(campo) && 'pr-[104px]');

                                    return (
                                        <>
                                            <Encabezado id="perfil-clave" titulo={t('perfilCarnet.passwordTitle')} ayuda={t('perfilCarnet.passwordHelp')} />
                                            {fallasClave.falla && <AvisoEnvio falla={fallasClave.falla} />}
                                            <div className="grid gap-x-3.5 gap-y-5 sm:grid-cols-3">
                                                <div className="flex flex-col gap-1.5">
                                                    <label htmlFor="current_password" className={ETIQUETA}>
                                                        {t('perfilCarnet.currentPassword')}
                                                    </label>
                                                    <div className="relative flex items-center">
                                                        <input
                                                            ref={refActual}
                                                            id="current_password"
                                                            name="current_password"
                                                            type={verClaves ? 'text' : 'password'}
                                                            required
                                                            autoComplete="current-password"
                                                            placeholder={t('perfilCarnet.currentPasswordPlaceholder')}
                                                            className={campoClave('current_password')}
                                                            {...propsMayus('current_password')}
                                                            aria-invalid={avisosClave.invalido('current_password', servidorActual) || undefined}
                                                            aria-describedby={describe(errorActual && 'error-actual', mayusEn('current_password') && 'aviso-mayus')}
                                                            onInvalid={avisosClave.alInvalidar('current_password')}
                                                            onInput={() => {
                                                                avisosClave.alEscribir('current_password')();
                                                                validarClaves();
                                                            }}
                                                        />
                                                        {mayusEn('current_password') && <IndicadorMayus className="right-2.5" />}
                                                    </div>
                                                    <AvisoBajoCampo id="error-actual" texto={errorActual} />
                                                </div>
                                                <div className="flex flex-col gap-1.5">
                                                    <label htmlFor="password" className={ETIQUETA}>
                                                        {t('perfilCarnet.newPassword')}
                                                    </label>
                                                    <div className="relative flex items-center">
                                                        <input
                                                            ref={refNueva}
                                                            id="password"
                                                            name="password"
                                                            type={verClaves ? 'text' : 'password'}
                                                            required
                                                            autoComplete="new-password"
                                                            placeholder={t('perfilCarnet.newPasswordPlaceholder')}
                                                            className={campoClave('password')}
                                                            {...propsMayus('password')}
                                                            aria-invalid={avisosClave.invalido('password', servidorNueva) || undefined}
                                                            aria-describedby={describe(errorNueva && 'error-nueva', mayusEn('password') && 'aviso-mayus', 'reglas-clave')}
                                                            onInvalid={avisosClave.alInvalidar('password')}
                                                            onInput={(e) => {
                                                                avisosClave.alEscribir('password')();
                                                                setNueva(e.currentTarget.value);
                                                                validarClaves();
                                                            }}
                                                        />
                                                        {mayusEn('password') && <IndicadorMayus className="right-2.5" />}
                                                    </div>
                                                    <AvisoBajoCampo id="error-nueva" texto={errorNueva} />
                                                </div>
                                                <div className="flex flex-col gap-1.5">
                                                    <label htmlFor="password_confirmation" className={ETIQUETA}>
                                                        {t('perfilCarnet.repeatPassword')}
                                                    </label>
                                                    <div className="relative flex items-center">
                                                        <input
                                                            ref={refRepetir}
                                                            id="password_confirmation"
                                                            name="password_confirmation"
                                                            type={verClaves ? 'text' : 'password'}
                                                            required
                                                            autoComplete="new-password"
                                                            placeholder={t('perfilCarnet.repeatPasswordPlaceholder')}
                                                            className={campoClave('password_confirmation')}
                                                            {...propsMayus('password_confirmation')}
                                                            aria-invalid={avisosClave.invalido('password_confirmation', servidorRepetir) || undefined}
                                                            aria-describedby={describe(errorRepetir && 'error-repetir', mayusEn('password_confirmation') && 'aviso-mayus')}
                                                            onInvalid={avisosClave.alInvalidar('password_confirmation')}
                                                            onInput={() => {
                                                                avisosClave.alEscribir('password_confirmation')();
                                                                validarClaves();
                                                            }}
                                                        />
                                                        {mayusEn('password_confirmation') && <IndicadorMayus className="right-2.5" />}
                                                    </div>
                                                    <AvisoBajoCampo id="error-repetir" texto={errorRepetir} />
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <div className="flex flex-col gap-2.5">
                                                    <ul id="reglas-clave" className="m-0 flex list-none flex-wrap gap-x-4 gap-y-2 p-0 text-[13px]">
                                                        <Regla cumple={REGLAS.largo(nueva)} falta={faltanReglas}>
                                                            {t('perfilCarnet.ruleLength')}
                                                        </Regla>
                                                        <Regla cumple={REGLAS.letras(nueva)} falta={faltanReglas}>
                                                            {t('perfilCarnet.ruleLetters')}
                                                        </Regla>
                                                        <Regla cumple={REGLAS.numeros(nueva)} falta={faltanReglas}>
                                                            {t('perfilCarnet.ruleNumbers')}
                                                        </Regla>
                                                    </ul>
                                                    <label className="flex w-fit cursor-pointer items-center gap-2 text-[13px] text-muted-foreground">
                                                        <input
                                                            type="checkbox"
                                                            checked={verClaves}
                                                            onChange={(e) => setVerClaves(e.currentTarget.checked)}
                                                            className="h-4 w-4 cursor-pointer accent-primary"
                                                        />
                                                        {t('perfilCarnet.showPasswords')}
                                                    </label>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <Guardado visible={recentlySuccessful} texto={t('perfilCarnet.passwordChanged')} />
                                                    <button type="submit" disabled={processing || fallasClave.bloqueado} className={cn(BOTON, 'tabular-nums', fallasClave.bloqueado && BOTON_ESPERA)}>
                                                        {fallasClave.bloqueado ? (
                                                            <>
                                                                <Clock className="h-4 w-4" aria-hidden="true" />
                                                                {t('fallasEnvio.lockedButton', { tiempo: minutosYSegundos(fallasClave.faltan) })}
                                                            </>
                                                        ) : (
                                                            <>
                                                                {processing && <Spinner />}
                                                                {processing ? t('perfilCarnet.changingPassword') : t('perfilCarnet.changePassword')}
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    );
                                }}
                            </Form>
                        </section>

                        {/* ═══ Apariencia e idioma ═══ */}
                        <section aria-labelledby="perfil-apariencia" className={cn(TARJETA, 'flex flex-wrap items-center justify-between gap-4')}>
                            <Encabezado id="perfil-apariencia" titulo={t('perfilCarnet.appearanceTitle')} ayuda={t('perfilCarnet.appearanceHelp')} />
                            <div className="flex flex-wrap items-center gap-3">
                                <div role="group" aria-label={t('perfilCarnet.themeGroup')} className="flex gap-1 rounded-xl bg-[#eef0f7] p-1 dark:bg-muted/60">
                                    {temas.map((tema) => (
                                        <button
                                            key={tema.valor}
                                            type="button"
                                            aria-pressed={appearance === tema.valor}
                                            onClick={() => updateAppearance(tema.valor)}
                                            className={cn(
                                                'h-11 rounded-[9px] px-3.5 text-[13.5px] transition-colors sm:h-9',
                                                appearance === tema.valor
                                                    ? 'bg-card font-semibold text-primary shadow-[0_1px_3px_rgba(46,63,132,0.18)] dark:bg-[hsl(30,4%,26%)] dark:text-foreground'
                                                    : 'font-medium text-[#4a4f73] hover:text-foreground dark:text-[hsl(30,5%,72%)]',
                                            )}
                                        >
                                            {tema.texto}
                                        </button>
                                    ))}
                                </div>
                                <div role="group" aria-label={t('perfilCarnet.languageGroup')} className="flex gap-1 rounded-xl bg-[#eef0f7] p-1 dark:bg-muted/60">
                                    {(['es', 'en'] as const).map((codigo) => (
                                        <button
                                            key={codigo}
                                            type="button"
                                            lang={codigo}
                                            aria-pressed={idioma === codigo}
                                            onClick={() => cambiarIdioma(codigo)}
                                            className={cn(
                                                'h-11 rounded-[9px] px-3.5 text-[13.5px] transition-colors sm:h-9',
                                                idioma === codigo
                                                    ? 'bg-card font-semibold text-primary shadow-[0_1px_3px_rgba(46,63,132,0.18)] dark:bg-[hsl(30,4%,26%)] dark:text-foreground'
                                                    : 'font-medium text-[#4a4f73] hover:text-foreground dark:text-[hsl(30,5%,72%)]',
                                            )}
                                        >
                                            {codigo === 'es' ? 'Español' : 'English'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
