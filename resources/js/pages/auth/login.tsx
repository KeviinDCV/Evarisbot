import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import AuthLayout from '@/layouts/auth-layout';
import { store } from '@/routes/login';
import { Form, Head } from '@inertiajs/react';
import { useTranslation } from 'react-i18next';

interface LoginProps {
    status?: string;
    canResetPassword: boolean;
}

export default function Login({ status, canResetPassword }: LoginProps) {
    const { t } = useTranslation();
    
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
                                    className="w-full rounded-lg border-0 placeholder:text-gray-400 transition-all duration-200"
                                    style={{
                                        backgroundColor: 'var(--layer-base)',
                                        color: 'var(--primary-base)',
                                        boxShadow: 'var(--shadow-inset-sm)',
                                        height: 'clamp(2.5rem, 2.5rem + 0.5vw, 3rem)',
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
                                <Input
                                    id="password"
                                    type="password"
                                    name="password"
                                    required
                                    tabIndex={2}
                                    autoComplete="current-password"
                                    placeholder={t('auth.passwordPlaceholder')}
                                    className="w-full rounded-lg border-0 placeholder:text-gray-400 transition-all duration-200"
                                    style={{
                                        backgroundColor: 'var(--layer-base)',
                                        color: 'var(--primary-base)',
                                        boxShadow: 'var(--shadow-inset-sm)',
                                        height: 'clamp(2.5rem, 2.5rem + 0.5vw, 3rem)',
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
                                <InputError message={errors.password} />
                            </div>

                            <Button
                                type="submit"
                                className="w-full rounded-lg font-semibold text-white transition-all duration-200 border-0 relative overflow-hidden"
                                style={{
                                    ...{
                                        backgroundColor: 'var(--primary-base)',
                                        boxShadow: 'var(--shadow-md)',
                                        backgroundImage: 'var(--gradient-shine)',
                                        height: 'clamp(2.75rem, 2.75rem + 0.75vw, 3.5rem)',
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
                                tabIndex={3}
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