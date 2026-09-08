import CapsLockWarning, { useCapsLock } from '@/components/caps-lock-warning';
import InputError from '@/components/input-error';
import { Spinner } from '@/components/ui/spinner';
import AuthLayout from '@/layouts/auth-layout';
import { store } from '@/routes/login';
import { Form, Head } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Eye, EyeOff, Infinity as InfinityIcon, Lock, Mail } from 'lucide-react';
import type { FocusEvent, KeyboardEvent } from 'react';

interface LoginProps {
    status?: string;
    // Provista por el backend; el flujo de reset aún no se expone en la UI.
    canResetPassword?: boolean;
}

// Estilo base de los inputs translúcidos (paleta institucional navy #2e3f84).
const inputBaseStyle: React.CSSProperties = {
    width: '100%',
    fontSize: '14px',
    color: 'var(--auth-input-text)',
    background: 'var(--auth-input-bg)',
    border: '1.5px solid var(--auth-input-border)',
    borderRadius: '14px',
    outline: 'none',
    transition: 'border-color .15s, background .15s, box-shadow .15s',
};

// Foco: borde navy + glow sutil.
const handleFieldFocus = (e: FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'var(--auth-input-border-focus)';
    e.currentTarget.style.background = 'var(--auth-input-bg-focus)';
    e.currentTarget.style.boxShadow = '0 0 0 4px var(--auth-input-glow)';
};
const handleFieldBlur = (e: FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'var(--auth-input-border)';
    e.currentTarget.style.background = 'var(--auth-input-bg)';
    e.currentTarget.style.boxShadow = 'none';
};

export default function Login({ status }: LoginProps) {
    const { t } = useTranslation();
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const mayus = useCapsLock();

    // Refresca la cookie XSRF-TOKEN al montar para que el primer envío del login use un token
    // vivo y no choque con uno caducado/rotado (evita el 419 + reintento que ensucia la consola).
    useEffect(() => {
        axios.get('/csrf-refresh').catch(() => {});
    }, []);

    return (
        <AuthLayout title={t('auth.loginTitle')} description="">
            <Head title={t('auth.loginTitle')} />

            {status && (
                <div
                    className="mb-4 rounded-xl text-center text-sm font-medium"
                    style={{ color: 'var(--auth-status-text)', background: 'var(--auth-status-bg)', padding: '10px 16px' }}
                >
                    {status}
                </div>
            )}

            <Form {...store.form()} resetOnSuccess={['password']} className="flex flex-col">
                {({ processing, errors }) => (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                        {/* Usuario */}
                        <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--auth-label)' }}>{t('auth.username')}</span>
                            <span className="relative flex items-center">
                                <Mail className="pointer-events-none absolute left-[15px] h-[18px] w-[18px]" style={{ color: 'var(--auth-icon)' }} />
                                <input
                                    id="email"
                                    type="email"
                                    name="email"
                                    required
                                    autoFocus
                                    autoComplete="email"
                                    placeholder={t('auth.emailPlaceholder')}
                                    style={{ ...inputBaseStyle, padding: '15px 16px 15px 44px' }}
                                    onFocus={handleFieldFocus}
                                    onBlur={handleFieldBlur}
                                />
                            </span>
                            <InputError message={errors.email} />
                        </label>

                        {/* Contraseña */}
                        <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--auth-label)' }}>{t('common.password')}</span>
                            <span className="relative flex items-center">
                                <Lock className="pointer-events-none absolute left-[15px] h-[18px] w-[18px]" style={{ color: 'var(--auth-icon)' }} />
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    required
                                    autoComplete="current-password"
                                    placeholder={t('auth.passwordPlaceholder')}
                                    style={{ ...inputBaseStyle, padding: '15px 48px 15px 44px' }}
                                    {...mayus.combinar({ onFocus: handleFieldFocus, onBlur: handleFieldBlur })}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-2 flex h-[34px] w-[34px] items-center justify-center rounded-[9px] transition-colors hover:bg-[#2e3f84]/8"
                                    style={{ color: 'var(--auth-icon)', background: 'transparent' }}
                                    aria-label={showPassword ? t('auth.hidePassword', 'Ocultar contraseña') : t('auth.showPassword', 'Mostrar contraseña')}
                                >
                                    {showPassword ? <EyeOff className="h-[19px] w-[19px]" /> : <Eye className="h-[19px] w-[19px]" />}
                                </button>
                            </span>
                            <CapsLockWarning visible={mayus.activo} />
                            <InputError message={errors.password} />
                        </label>

                        {/* Nunca cerrar sesión */}
                        {rememberMe && <input type="hidden" name="remember" value="1" />}
                        <button
                            type="button"
                            onClick={() => setRememberMe(!rememberMe)}
                            className="group mt-0.5 flex w-fit items-center gap-2.5"
                            aria-pressed={rememberMe}
                        >
                            <span
                                className="relative flex h-[19px] w-[19px] flex-shrink-0 items-center justify-center rounded-md border-[1.5px] transition-colors"
                                style={{
                                    borderColor: rememberMe ? 'var(--auth-accent)' : 'var(--auth-check-border)',
                                    backgroundColor: rememberMe ? 'var(--auth-accent)' : 'var(--auth-check-bg)',
                                }}
                            >
                                {rememberMe && (
                                    <svg viewBox="0 0 12 9" fill="none" className="h-3 w-3">
                                        <path d="M1 4L4.5 7.5L11 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                )}
                            </span>
                            <span
                                className="flex select-none items-center gap-[7px] text-sm font-medium"
                                style={{ color: rememberMe ? 'var(--auth-remember-text-on)' : 'var(--auth-remember-text)' }}
                            >
                                <InfinityIcon className="h-3.5 w-3.5 flex-shrink-0" />
                                {t('auth.neverLogout')}
                            </span>
                        </button>

                        {/* Botón: navy SÓLIDO, sin gradiente, sin animación de elevación */}
                        <button
                            type="submit"
                            disabled={processing}
                            className="mt-3.5 flex w-full items-center justify-center font-bold text-white"
                            style={{
                                backgroundColor: 'var(--auth-accent)',
                                border: 'none',
                                borderRadius: '16px',
                                padding: '17px',
                                fontSize: '15.5px',
                                cursor: processing ? 'not-allowed' : 'pointer',
                                opacity: processing ? 0.7 : 1,
                                boxShadow: '0 10px 24px -12px rgba(46,63,132,.55)',
                            }}
                            onMouseEnter={(e) => { if (!processing) e.currentTarget.style.backgroundColor = 'var(--auth-accent-hover)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--auth-accent)'; }}
                        >
                            {processing && <Spinner className="mr-2" />}
                            {t('auth.login')}
                        </button>
                    </div>
                )}
            </Form>
        </AuthLayout>
    );
}
