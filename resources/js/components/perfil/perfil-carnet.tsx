import PasswordController from '@/actions/App/Http/Controllers/Settings/PasswordController';
import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import { AvisoCampo, useAvisosCampo } from '@/components/avisos-campo';
import CapsLockWarning, { useCapsLock } from '@/components/caps-lock-warning';
import { Spinner } from '@/components/ui/spinner';
import { type Appearance, useAppearance } from '@/hooks/use-appearance';
import { useInitials } from '@/hooks/use-initials';
import AdminLayout from '@/layouts/admin-layout';
import { cn } from '@/lib/utils';
import { logout } from '@/routes';
import { send } from '@/routes/verification';
import { type SharedData } from '@/types';
import { Transition } from '@headlessui/react';
import { Form, Head, Link, usePage } from '@inertiajs/react';
import { Check, LogOut, ShieldCheck } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';

// Piezas visuales compartidas por las tarjetas (design/perfil, artboard Main).
const TARJETA = 'rounded-[18px] border border-[#e3e6f0] bg-card p-5 sm:px-6 sm:py-[22px] dark:border-border';
const ETIQUETA = 'text-[13px] font-semibold text-[#3a3f63] dark:text-foreground/85';
const CAMPO =
    'h-[46px] w-full rounded-xl border-[1.5px] border-[#dfe2ef] bg-[#f7f8fc] px-3.5 text-[15px] text-foreground outline-none transition placeholder:text-[#6b7192] focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10 aria-[invalid=true]:border-red-600 dark:border-border dark:bg-muted/40 dark:aria-[invalid=true]:border-red-400';
const BOTON =
    'inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-[14.5px] font-semibold text-white transition-colors hover:bg-[#26356f] disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-primary/90';
const SECUNDARIO =
    'inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#dfe2ef] bg-card px-4 text-sm font-semibold text-primary transition-colors hover:bg-[#f4f6fc] dark:border-border dark:hover:bg-muted/50';

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

function Guardado({ visible, texto }: { visible: boolean; texto: string }) {
    return (
        <Transition show={visible} enter="transition duration-200" enterFrom="opacity-0" leave="transition duration-500" leaveTo="opacity-0">
            <span role="status" className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                <Check className="h-4 w-4" aria-hidden="true" />
                {texto}
            </span>
        </Transition>
    );
}

function Regla({ cumple, children }: { cumple: boolean; children: ReactNode }) {
    return (
        <li className={cn('flex items-center gap-1.5', cumple ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground')}>
            {cumple ? (
                <Check className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
            ) : (
                <span aria-hidden="true" className="h-4 w-4 rounded-full border-[1.5px] border-[#c3c7da] dark:border-border" />
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
 */
export default function PerfilCarnet({ mustVerifyEmail, status }: { mustVerifyEmail: boolean; status?: string }) {
    const { t, i18n } = useTranslation();
    const { auth } = usePage<SharedData>().props;
    const usuario = auth.user;
    const iniciales = useInitials();
    const { appearance, updateAppearance } = useAppearance();
    const mayus = useCapsLock();
    const [nueva, setNueva] = useState('');

    const idioma = i18n.language?.startsWith('en') ? 'en' : 'es';
    const desde = usuario.created_at
        ? new Date(usuario.created_at).toLocaleDateString(idioma === 'en' ? 'en-US' : 'es-CO', { month: 'long', year: 'numeric' })
        : null;
    const rol = t(`users.roles.${usuario.role}`, String(usuario.role ?? ''));
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

    return (
        <AdminLayout>
            <Head title={t('perfilCarnet.title')} />

            <div className="p-4 md:p-6 lg:p-8">
                <div className="mx-auto grid max-w-[1180px] items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
                    {/* ═══ Carnet ═══ */}
                    <aside
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
                                    className="relative z-10 -mt-12 h-24 w-24 rounded-full border-4 border-card object-cover shadow-[0_10px_24px_-10px_rgba(46,63,132,0.7)]"
                                />
                            ) : (
                                <span
                                    aria-hidden="true"
                                    className="relative z-10 -mt-12 flex h-24 w-24 items-center justify-center rounded-full border-4 border-card text-[32px] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(46,63,132,0.7)]"
                                    style={{ background: 'linear-gradient(135deg, #4e5fa4, #2e3f84)' }}
                                >
                                    {iniciales(usuario.name)}
                                </span>
                            )}
                            <div className="flex flex-col items-center gap-1.5">
                                <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-foreground">{usuario.name}</h1>
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eef1fb] px-2.5 py-1 text-[12.5px] font-semibold text-primary dark:bg-primary/15">
                                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                                    {rol}
                                </span>
                                <p className="break-all text-sm text-muted-foreground">{usuario.email}</p>
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
                    </aside>

                    <div className="flex min-w-0 max-w-[760px] flex-col gap-[18px]">
                        {/* ═══ Tus datos ═══ */}
                        <section aria-labelledby="perfil-datos" className={TARJETA}>
                            <Form
                                {...ProfileController.update.form()}
                                options={{ preserveScroll: true }}
                                onSubmitCapture={avisosDatos.alEnviar}
                                className="flex flex-col gap-4"
                            >
                                {({ processing, recentlySuccessful, errors }) => {
                                    const errorNombre = avisosDatos.error('name', errors.name);
                                    const errorCorreo = avisosDatos.error('email', errors.email);
                                    return (
                                        <>
                                            <Encabezado id="perfil-datos" titulo={t('perfilCarnet.dataTitle')} ayuda={t('perfilCarnet.dataHelp')} />
                                            <div className="grid gap-x-3.5 gap-y-5 sm:grid-cols-2">
                                                <div className="flex flex-col gap-1.5">
                                                    <label htmlFor="name" className={ETIQUETA}>
                                                        {t('perfilCarnet.name')}
                                                    </label>
                                                    <div className="relative">
                                                        <input
                                                            id="name"
                                                            name="name"
                                                            required
                                                            autoComplete="name"
                                                            defaultValue={usuario.name}
                                                            aria-invalid={avisosDatos.invalido('name', errors.name) || undefined}
                                                            aria-describedby={errorNombre ? 'error-nombre' : undefined}
                                                            onInvalid={avisosDatos.alInvalidar('name')}
                                                            onInput={avisosDatos.alEscribir('name')}
                                                            className={CAMPO}
                                                        />
                                                        <AvisoCampo id="error-nombre" texto={errorNombre} />
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-1.5">
                                                    <label htmlFor="email" className={ETIQUETA}>
                                                        {t('perfilCarnet.email')}
                                                    </label>
                                                    <div className="relative">
                                                        <input
                                                            id="email"
                                                            type="email"
                                                            name="email"
                                                            required
                                                            autoComplete="username"
                                                            defaultValue={usuario.email}
                                                            aria-invalid={avisosDatos.invalido('email', errors.email) || undefined}
                                                            aria-describedby={errorCorreo ? 'error-correo' : 'ayuda-correo'}
                                                            onInvalid={avisosDatos.alInvalidar('email')}
                                                            onInput={avisosDatos.alEscribir('email')}
                                                            className={CAMPO}
                                                        />
                                                        <AvisoCampo id="error-correo" texto={errorCorreo} />
                                                    </div>
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
                                                <button type="submit" disabled={processing} className={BOTON}>
                                                    {processing && <Spinner />}
                                                    {processing ? t('perfilCarnet.saving') : t('perfilCarnet.save')}
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
                                resetOnError={['password', 'password_confirmation', 'current_password']}
                                resetOnSuccess
                                onSuccess={() => setNueva('')}
                                onSubmitCapture={avisosClave.alEnviar}
                                className="flex flex-col gap-4"
                            >
                                {({ processing, recentlySuccessful, errors }) => {
                                    const errorActual = avisosClave.error('current_password', errors.current_password);
                                    const errorNueva = avisosClave.error('password', errors.password);
                                    const errorRepetir = avisosClave.error('password_confirmation', errors.password_confirmation);
                                    return (
                                        <>
                                            <Encabezado id="perfil-clave" titulo={t('perfilCarnet.passwordTitle')} ayuda={t('perfilCarnet.passwordHelp')} />
                                            <div className="grid gap-x-3.5 gap-y-5 sm:grid-cols-3">
                                                <div className="flex flex-col gap-1.5">
                                                    <label htmlFor="current_password" className={ETIQUETA}>
                                                        {t('perfilCarnet.currentPassword')}
                                                    </label>
                                                    <div className="relative">
                                                        <input
                                                            id="current_password"
                                                            name="current_password"
                                                            type="password"
                                                            required
                                                            autoComplete="current-password"
                                                            placeholder={t('perfilCarnet.currentPasswordPlaceholder')}
                                                            className={CAMPO}
                                                            {...mayus.props}
                                                            aria-invalid={avisosClave.invalido('current_password', errors.current_password) || undefined}
                                                            aria-describedby={errorActual ? 'error-actual' : undefined}
                                                            onInvalid={avisosClave.alInvalidar('current_password')}
                                                            onInput={avisosClave.alEscribir('current_password')}
                                                        />
                                                        <AvisoCampo
                                                            id="error-actual"
                                                            texto={errorActual}
                                                            extra={mayus.activo ? <CapsLockWarning visible /> : undefined}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-1.5">
                                                    <label htmlFor="password" className={ETIQUETA}>
                                                        {t('perfilCarnet.newPassword')}
                                                    </label>
                                                    <div className="relative">
                                                        <input
                                                            id="password"
                                                            name="password"
                                                            type="password"
                                                            required
                                                            autoComplete="new-password"
                                                            placeholder={t('perfilCarnet.newPasswordPlaceholder')}
                                                            aria-invalid={avisosClave.invalido('password', errors.password) || undefined}
                                                            aria-describedby={errorNueva ? 'error-nueva reglas-clave' : 'reglas-clave'}
                                                            onInvalid={avisosClave.alInvalidar('password')}
                                                            onInput={(e) => {
                                                                avisosClave.alEscribir('password')();
                                                                setNueva(e.currentTarget.value);
                                                            }}
                                                            className={CAMPO}
                                                        />
                                                        <AvisoCampo id="error-nueva" texto={errorNueva} />
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-1.5">
                                                    <label htmlFor="password_confirmation" className={ETIQUETA}>
                                                        {t('perfilCarnet.repeatPassword')}
                                                    </label>
                                                    <div className="relative">
                                                        <input
                                                            id="password_confirmation"
                                                            name="password_confirmation"
                                                            type="password"
                                                            required
                                                            autoComplete="new-password"
                                                            placeholder={t('perfilCarnet.repeatPasswordPlaceholder')}
                                                            aria-invalid={avisosClave.invalido('password_confirmation', errors.password_confirmation) || undefined}
                                                            aria-describedby={errorRepetir ? 'error-repetir' : undefined}
                                                            onInvalid={avisosClave.alInvalidar('password_confirmation')}
                                                            onInput={avisosClave.alEscribir('password_confirmation')}
                                                            className={CAMPO}
                                                        />
                                                        <AvisoCampo id="error-repetir" texto={errorRepetir} />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                {/* Requisitos de Password::defaults() (AppServiceProvider): 5 caracteres, letras y números. */}
                                                <ul id="reglas-clave" className="m-0 flex list-none flex-wrap gap-x-4 gap-y-2 p-0 text-[13px]">
                                                    <Regla cumple={nueva.length >= 5}>{t('perfilCarnet.ruleLength')}</Regla>
                                                    <Regla cumple={/\p{L}/u.test(nueva)}>{t('perfilCarnet.ruleLetters')}</Regla>
                                                    <Regla cumple={/\d/.test(nueva)}>{t('perfilCarnet.ruleNumbers')}</Regla>
                                                </ul>
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <Guardado visible={recentlySuccessful} texto={t('perfilCarnet.passwordChanged')} />
                                                    <button type="submit" disabled={processing} className={BOTON}>
                                                        {processing && <Spinner />}
                                                        {t('perfilCarnet.changePassword')}
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
                                                'h-9 rounded-[9px] px-3.5 text-[13.5px] transition-colors',
                                                appearance === tema.valor
                                                    ? 'bg-card font-semibold text-primary shadow-[0_1px_3px_rgba(46,63,132,0.18)]'
                                                    : 'font-medium text-[#4a4f73] hover:text-foreground dark:text-muted-foreground',
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
                                                'h-9 rounded-[9px] px-3.5 text-[13.5px] transition-colors',
                                                idioma === codigo
                                                    ? 'bg-card font-semibold text-primary shadow-[0_1px_3px_rgba(46,63,132,0.18)]'
                                                    : 'font-medium text-[#4a4f73] hover:text-foreground dark:text-muted-foreground',
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
