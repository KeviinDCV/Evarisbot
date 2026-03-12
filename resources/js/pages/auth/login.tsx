import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import AuthLayout from '@/layouts/auth-layout';
import { store } from '@/routes/login';
import { Form, Head } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Eye, EyeOff, Infinity } from 'lucide-react';

interface LoginProps {
    status?: string;
    canResetPassword: boolean;
}

export default function Login({ status, canResetPassword }: LoginProps) {
    const { t } = useTranslation();
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    return (
        <AuthLayout
            title={t('auth.loginTitle')}
            description=""
        >
            <Head title={t('auth.loginTitle')} />

            <Form
                {...store.form()}
                resetOnSuccess={['password']}
                className="flex flex-col"
                style={{ gap: 'var(--space-md)' }}
            >
                {({ processing, errors }) => (
                    <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                                <Label
                                    htmlFor="email"
                                    className="font-semibold"
                                    style={{
                                        color: 'var(--primary-base)',
                                        fontSize: 'var(--text-sm)'
                                    }}
                                >
                                    {t('auth.username')}
                                </Label>
                                <Input
                                    id="email"
                                    type="email"
                                    name="email"
                                    required
                                    autoFocus
                                    tabIndex={1}
                                    autoComplete="email"
                                    placeholder={t('auth.emailPlaceholder')}
                                    className="w-full rounded-xl border-0 placeholder:text-muted-foreground transition-all duration-200"
                                    style={{
                                        backgroundColor: 'var(--layer-base)',
                                        color: 'var(--primary-base)',
                                        boxShadow: 'var(--shadow-inset-sm)',
                                        height: 'clamp(2.25rem, 2.25rem + 0.25vw, 2.5rem)',
                                        padding: '0 var(--space-base)',
                                        fontSize: 'var(--text-base)'
                                    }}
                                    onFocus={(e) => {
                                        e.target.style.backgroundColor = 'var(--layer-elevated)';
                                        e.target.style.boxShadow = 'var(--shadow-inset-md)'; // Deeper inset on focus
                                    }}
                                    onBlur={(e) => {
                                        e.target.style.backgroundColor = 'var(--layer-base)';
                                        e.target.style.boxShadow = 'var(--shadow-inset-sm)';
                                    }}
                                />
                                <InputError message={errors.email} />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                                <Label
                                    htmlFor="password"
                                    className="font-semibold"
                                    style={{
                                        color: 'var(--primary-base)',
                                        fontSize: 'var(--text-sm)'
                                    }}
                                >
                                    {t('common.password')}
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        name="password"
                                        required
                                        tabIndex={2}
                                        autoComplete="current-password"
                                        placeholder={t('auth.passwordPlaceholder')}
                                        className="w-full rounded-xl border-0 placeholder:text-muted-foreground transition-all duration-200 pr-10"
                                        style={{
                                            backgroundColor: 'var(--layer-base)',
                                            color: 'var(--primary-base)',
                                            boxShadow: 'var(--shadow-inset-sm)',
                                            height: 'clamp(2.25rem, 2.25rem + 0.25vw, 2.5rem)',
                                            padding: '0 var(--space-base)',
                                            paddingRight: '2.5rem',
                                            fontSize: 'var(--text-base)'
                                        }}
                                        onFocus={(e) => {
                                            e.target.style.backgroundColor = 'var(--layer-elevated)';
                                            e.target.style.boxShadow = 'var(--shadow-inset-md)';
                                        }}
                                        onBlur={(e) => {
                                            e.target.style.backgroundColor = 'var(--layer-base)';
                                            e.target.style.boxShadow = 'var(--shadow-inset-sm)';
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-primary dark:text-primary transition-colors duration-200"
                                        tabIndex={-1}
                                    >
                                        {showPassword ? (
                                            <EyeOff className="w-4 h-4" />
                                        ) : (
                                            <Eye className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                                <InputError message={errors.password} />
                            </div>

                            {/* Nunca cerrar sesión */}
                            {rememberMe && (
                                <input type="hidden" name="remember" value="1" />
                            )}
                            <button
                                type="button"
                                onClick={() => setRememberMe(!rememberMe)}
                                className="flex items-center gap-2.5 group w-fit"
                                tabIndex={3}
                            >
                                {/* Custom checkbox */}
                                <span
                                    className="relative flex-shrink-0 w-5 h-5 rounded border-2 transition-all duration-200 flex items-center justify-center"
                                    style={{
                                        borderColor: rememberMe ? 'var(--primary-base)' : 'var(--border-muted, #c7cde0)',
                                        backgroundColor: rememberMe ? 'var(--primary-base)' : 'var(--layer-base)',
                                        boxShadow: rememberMe ? 'var(--shadow-sm)' : 'none',
                                    }}
                                >
                                    {rememberMe && (
                                        <svg viewBox="0 0 12 9" fill="none" className="w-3 h-3">
                                            <path d="M1 4L4.5 7.5L11 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    )}
                                </span>
                                <span
                                    className="flex items-center gap-1.5 text-sm font-medium select-none transition-colors duration-200"
                                    style={{ color: rememberMe ? 'var(--primary-base)' : 'var(--muted-foreground, #6b7280)' }}
                                >
                                    <Infinity className="w-3.5 h-3.5 flex-shrink-0" />
                                    Nunca cerrar sesión
                                </span>
                            </button>

                            <Button
                                type="submit"
                                className="w-full rounded-full font-semibold text-white transition-all duration-200 border-0 relative overflow-hidden"
                                style={{
                                    ...{
                                        backgroundColor: 'var(--primary-base)',
                                        boxShadow: 'var(--shadow-md)',
                                        backgroundImage: 'var(--gradient-shine)',
                                        height: 'clamp(2.5rem, 2.5rem + 0.25vw, 2.75rem)',
                                        fontSize: 'var(--text-base)',
                                        marginTop: 'var(--space-sm)'
                                    }
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'var(--primary-darker)';
                                    e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; // Two-layer shadow on hover
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.backgroundImage = 'var(--gradient-shine)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'var(--primary-base)';
                                    e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.backgroundImage = 'var(--gradient-shine)';
                                }}
                                onMouseDown={(e) => {
                                    // Active state: pressed down effect
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                                }}
                                onMouseUp={(e) => {
                                    // Release: return to hover state
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                                }}
                                tabIndex={4}
                                disabled={processing}
                            >
                                {processing && <Spinner className="mr-2" />}
                                {t('auth.login')}
                            </Button>
                        </div>
                    </>
                )}
            </Form>

            {status && (
                <div className="mb-4 text-center text-sm font-medium text-green-600">
                    {status}
                </div>
            )}
        </AuthLayout>
    );
}