import AdminLayout from '@/layouts/admin-layout';
import { BOTON_PELIGRO, FILETE, FOCO, HOJA, MONO, TEXTO_NAVY, TEXTO_SUAVE, nombrePropio } from '@/components/appointments/piezas-citas';
import { AvisoAccion, Banda, Cifra, ConfirmarDetener, Estado, Franja, H1, Rotulo, Segmentado, fechaHora, miles } from '@/components/bulk-sends/piezas-envio';
import { cn } from '@/lib/utils';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, CircleAlert, CircleCheck, CircleX, Clock, MessageSquareText, Phone, Search, Square, UsersRound } from 'lucide-react';
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

// Detener va por axios, como en la pantalla de envíos: usa el token CSRF VIVO de la cookie
// (el <meta> queda obsoleto tras un login por Inertia) y el interceptor reintenta 1 vez ante 419.
// validateStatus deja pasar 4xx/5xx para mostrar el { success, message } del servidor.
const csrfPost = (url: string, body?: unknown) =>
    axios.post(url, body, { validateStatus: (s: number) => s !== 419 });

interface Recipient {
    id: number;
    phone_number: string;
    contact_name: string | null;
    params: Record<string, string> | null;
    status: string;
    error: string | null;
    sent_at: string | null;
}

interface BulkSendDetail {
    id: number;
    name: string;
    template_name: string;
    template_preview: string | null;
    status: string;
    total_recipients: number;
    sent_count: number;
    failed_count: number;
    created_by_name: string;
    created_at: string;
}

interface BulkSendShowProps {
    bulkSend: BulkSendDetail;
    recipients: Recipient[];
}

// Pastilla del estado del envío junto al título (el color de su significado, con icono y texto).
const PASTILLA: Record<string, string> = {
    completed: 'bg-emerald-50 shadow-[inset_0_0_0_1px_var(--color-emerald-200)] dark:bg-emerald-500/10 dark:shadow-[inset_0_0_0_1px_rgba(16,185,129,0.25)]',
    processing: 'bg-sky-50 shadow-[inset_0_0_0_1px_var(--color-sky-200)] dark:bg-sky-500/10 dark:shadow-[inset_0_0_0_1px_rgba(14,165,233,0.25)]',
    failed: 'bg-red-50 shadow-[inset_0_0_0_1px_var(--color-red-200)] dark:bg-red-500/10 dark:shadow-[inset_0_0_0_1px_rgba(239,68,68,0.28)]',
};
const PASTILLA_NEUTRA = 'bg-[#2e3f84]/6 shadow-[inset_0_0_0_1px_rgba(46,63,132,0.12)] dark:bg-white/8 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]';

export default function BulkSendShow({ bulkSend, recipients }: BulkSendShowProps) {
    const { t, i18n } = useTranslation();
    const lng = i18n.language;
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    // Detener desde el detalle (nuevo): confirmación, estado de la llamada y aviso con la respuesta.
    const [confirmarDetener, setConfirmarDetener] = useState(false);
    const [deteniendo, setDeteniendo] = useState(false);
    const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

    // Obtener todas las claves de params únicas
    const paramKeys = useMemo(() => {
        const keys = new Set<string>();
        recipients.forEach(r => {
            if (r.params) {
                Object.keys(r.params).forEach(k => keys.add(k));
            }
        });
        return Array.from(keys);
    }, [recipients]);

    const filteredRecipients = useMemo(() => {
        return recipients.filter((r) => {
            const s = search.toLowerCase();
            const paramsMatch = r.params ? Object.values(r.params).some(v => String(v).toLowerCase().includes(s)) : false;
            const errorMatch = r.error ? r.error.toLowerCase().includes(s) : false;
            const matchesSearch = !search ||
                (r.contact_name?.toLowerCase().includes(s)) ||
                r.phone_number.includes(search) ||
                paramsMatch ||
                errorMatch;
            const matchesStatus = filterStatus === 'all' || r.status === filterStatus;
            return matchesSearch && matchesStatus;
        });
    }, [recipients, search, filterStatus]);

    const recipientStats = useMemo(() => {
        const sent = recipients.filter((recipient) => recipient.status === 'sent').length;
        const failed = recipients.filter((recipient) => recipient.status === 'failed').length;
        const pending = recipients.filter((recipient) => recipient.status === 'pending').length;
        const withError = recipients.filter((recipient) => Boolean(recipient.error)).length;

        return { sent, failed, pending, withError };
    }, [recipients]);

    const pendingCount = bulkSend.total_recipients - bulkSend.sent_count - bulkSend.failed_count;
    const successRate = bulkSend.total_recipients > 0
        ? Math.round((bulkSend.sent_count / bulkSend.total_recipients) * 100)
        : 0;

    // La MISMA llamada que "Detener…" de la pantalla de envíos (BulkSendController::cancel → { success, message }).
    const handleCancel = async () => {
        setDeteniendo(true);
        setAviso(null);
        try {
            const response = await csrfPost(`/admin/bulk-sends/${bulkSend.id}/cancel`);
            const data = response.data;
            setAviso({ tipo: data?.success ? 'ok' : 'error', texto: data?.message || (data?.success ? '' : t('bulkSends.cancelError')) });
            router.reload();
        } catch {
            setAviso({ tipo: 'error', texto: t('bulkSends.cancelError') });
        } finally {
            setDeteniendo(false);
        }
    };

    /* ── Presentación ── */

    // El nombre del destinatario: el contacto o, si no hay, la columna del Excel que parezca un nombre.
    const nombreDe = (r: Recipient) =>
        r.contact_name ||
        (r.params &&
            (() => {
                const nameKey = Object.keys(r.params!).find((k) => /nombre|name|paciente|contacto|cliente/i.test(k));
                return nameKey ? r.params![nameKey] : null;
            })()) ||
        '';

    // Peso de cada columna de dato según lo que trae (estimado por caracteres; las mayúsculas son más anchas),
    // entre 72 y 220. Las columnas se estrechan juntas; por debajo de su mínimo, la tabla tiene scroll propio.
    const anchoDato = useMemo(() => {
        const px = (texto: string) => [...texto].reduce((a, ch) => a + (/[A-ZÁÉÍÓÚÑ]/.test(ch) ? 7.4 : /[0-9]/.test(ch) ? 7.6 : 5.9), 0);
        return Object.fromEntries(
            paramKeys.map((key) => {
                const muestra = recipients.slice(0, 300).map((r) => String(r.params?.[key] ?? ''));
                const ancho = Math.max(key.length * 7.6, ...muestra.map(px)) + 28;
                return [key, Math.round(Math.min(220, Math.max(72, ancho)))];
            })
        ) as Record<string, number>;
    }, [paramKeys, recipients]);
    // Rejilla: nº · destinatario · un dato por columna · resultado. Cada columna pesa lo que trae (fr) y tiene un mínimo.
    const columnas = `44px minmax(170px, 200fr) ${paramKeys.map((k) => `minmax(64px, ${anchoDato[k]}fr)`).join(' ')} minmax(200px, 250fr)`;
    const anchoMinimo = 12 + 20 + 44 + 170 + paramKeys.length * 64 + 200;

    const filtros = [
        { value: 'all', label: t('bulkSends.filterAll'), count: recipients.length },
        { value: 'sent', label: t('bulkSends.sent'), count: recipientStats.sent },
        { value: 'failed', label: t('bulkSends.failed'), count: recipientStats.failed },
        { value: 'pending', label: t('bulkSends.pending'), count: recipientStats.pending },
    ].map((f) => ({ ...f, count: f.count > 0 ? miles(f.count, lng) : undefined }));

    const resultado = (r: Recipient) => (
        <div className="flex min-w-0 flex-col gap-0.5">
            <Estado status={r.status} peq />
            {r.error ? (
                <span className="truncate pl-5 text-[12px] leading-4 text-red-700 dark:text-red-400" title={r.error}>
                    {r.error}
                </span>
            ) : (
                <span className={cn('truncate pl-5 text-[12px] leading-4 tabular-nums', TEXTO_SUAVE)} title={r.sent_at || undefined}>
                    {r.sent_at ? t('bulkSends.sentAtNoError', { sentAt: fechaHora(r.sent_at, lng) }) : t('bulkSends.noError')}
                </span>
            )}
        </div>
    );

    const mensaje = bulkSend.template_preview
        ? bulkSend.template_preview.split(/(\{\{\d+\}\})/g).map((trozo, i) =>
              /^\{\{\d+\}\}$/.test(trozo) ? (
                  <span
                      key={i}
                      className={cn(
                          'mx-0.5 inline-flex h-[22px] items-center rounded-md bg-[#2e3f84]/7 px-[7px] align-baseline text-[12px] leading-4 font-semibold shadow-[inset_0_0_0_1px_rgba(46,63,132,0.12)] dark:bg-white/8 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]',
                          MONO,
                          TEXTO_NAVY
                      )}
                  >
                      {trozo}
                  </span>
              ) : (
                  <React.Fragment key={i}>{trozo}</React.Fragment>
              )
          )
        : null;

    return (
        <AdminLayout>
            <Head title={t('bulkSends.showPageTitle', { name: bulkSend.name || bulkSend.template_name })} />

            <div className="min-h-screen bg-background px-4 pt-5 pb-8 md:px-7 md:pt-6">
                <div className="@container/pagina mx-auto flex max-w-7xl flex-col gap-[22px]">
                    {/* ── Cabecera: volver, nombre + estado, plantilla · responsable · fecha; Detener si está enviando ── */}
                    <header className="flex flex-col gap-2.5">
                        <Link
                            href="/admin/bulk-sends"
                            className={cn('-mx-1.5 inline-flex w-fit items-center gap-1.5 rounded-lg px-1.5 py-0.5 text-[13px] leading-[18px] font-semibold transition-colors hover:bg-[#2e3f84]/6 dark:hover:bg-white/8', TEXTO_NAVY, FOCO)}
                        >
                            <ArrowLeft className="size-[15px]" strokeWidth={2} aria-hidden="true" />
                            {t('bulkSends.backToBulkSends')}
                        </Link>

                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                            <div className="flex min-w-0 flex-col gap-1">
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                    <h1 className={cn(H1, 'min-w-0 [overflow-wrap:anywhere]')}>{bulkSend.name || t('bulkSends.heading')}</h1>
                                    <span className={cn('inline-flex h-7 items-center rounded-lg pr-[11px] pl-[9px]', PASTILLA[bulkSend.status] ?? PASTILLA_NEUTRA)}>
                                        <Estado status={bulkSend.status} />
                                    </span>
                                </div>
                                <p className={cn('flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[14px] leading-5 tabular-nums', TEXTO_SUAVE)}>
                                    <span className={cn('text-[13px] font-semibold [overflow-wrap:anywhere]', MONO, TEXTO_NAVY)}>{bulkSend.template_name}</span>
                                    <span aria-hidden="true">·</span>
                                    <span>{bulkSend.created_by_name}</span>
                                    <span aria-hidden="true">·</span>
                                    <span title={bulkSend.created_at}>{fechaHora(bulkSend.created_at, lng)}</span>
                                </p>
                            </div>

                            {bulkSend.status === 'processing' && (
                                <button
                                    type="button"
                                    onClick={() => setConfirmarDetener(true)}
                                    disabled={deteniendo}
                                    aria-haspopup="dialog"
                                    title={t('bulkSends.stopAsksConfirmation')}
                                    className={cn(BOTON_PELIGRO, 'self-start')}
                                >
                                    <Square strokeWidth={2} aria-hidden="true" />
                                    {deteniendo ? t('bulkSends.stopping') : t('bulkSends.stopButton')}
                                </button>
                            )}
                        </div>
                    </header>

                    {aviso && aviso.texto && <AvisoAccion tipo={aviso.tipo} texto={aviso.texto} onCerrar={() => setAviso(null)} />}

                    {/* ── Franja de cifras del envío ── */}
                    <Franja
                        etiqueta={t('bulkSends.showSummaryLabel')}
                        cifras={[
                            <Cifra
                                key="t"
                                marca={<Phone className={cn('size-3.5 shrink-0', TEXTO_NAVY)} strokeWidth={2} aria-hidden="true" />}
                                etiqueta={t('bulkSends.total')}
                                valor={miles(bulkSend.total_recipients, lng)}
                                detalle={<span className="truncate">{t('bulkSends.showTotalDetail')}</span>}
                            />,
                            <Cifra
                                key="s"
                                marca={<CircleCheck className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={2} aria-hidden="true" />}
                                etiqueta={t('bulkSends.sent')}
                                valor={miles(recipientStats.sent, lng)}
                                detalle={<span className="truncate font-semibold text-emerald-700 dark:text-emerald-400">{t('bulkSends.successRateSuffix', { rate: successRate })}</span>}
                            />,
                            <Cifra
                                key="f"
                                marca={<CircleX className="size-3.5 shrink-0 text-red-600 dark:text-red-400" strokeWidth={2} aria-hidden="true" />}
                                etiqueta={t('bulkSends.failed')}
                                valor={miles(recipientStats.failed, lng)}
                                detalle={<span className="truncate">{t('bulkSends.showFailedDetail')}</span>}
                            />,
                            <Cifra
                                key="p"
                                marca={<Clock className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" strokeWidth={2} aria-hidden="true" />}
                                etiqueta={t('bulkSends.pending')}
                                valor={miles(Math.max(0, pendingCount), lng)}
                                detalle={<span className="truncate">{t('bulkSends.showPendingDetail')}</span>}
                            />,
                            <Cifra
                                key="e"
                                marca={<CircleAlert className="size-3.5 shrink-0 text-red-600 dark:text-red-400" strokeWidth={2} aria-hidden="true" />}
                                etiqueta={t('bulkSends.statWithError')}
                                valor={miles(recipientStats.withError, lng)}
                                detalle={<span className="truncate">{t('bulkSends.showWithErrorDetail')}</span>}
                            />,
                        ]}
                    />

                    {/* ── La hoja: mensaje enviado y destinatarios uno por uno ── */}
                    <div className={HOJA}>
                        {bulkSend.template_preview && (
                            <section aria-labelledby="mensaje-enviado" className={cn('flex items-start gap-3 rounded-t-2xl border-b px-4 pt-3.5 pb-4 @3xl/hoja:px-5', FILETE)}>
                                <span className={cn('hidden w-8 shrink-0 justify-center pt-0.5 @3xl/hoja:flex', TEXTO_NAVY)}>
                                    <MessageSquareText className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
                                </span>
                                <div className="flex min-w-0 flex-1 flex-col gap-2">
                                    <Rotulo as="h2" id="mensaje-enviado" titulo={t('bulkSends.messageSent')} apoyo={t('bulkSends.messageSentHint')} />
                                    <p className={cn('text-[13.5px] leading-[26px] whitespace-pre-wrap [overflow-wrap:anywhere]', TEXTO_NAVY)}>{mensaje}</p>
                                </div>
                            </section>
                        )}

                        <section aria-labelledby="destinatarios-envio">
                            <Banda
                                id="destinatarios-envio"
                                icon={UsersRound}
                                titulo={t('bulkSends.recipients')}
                                cuenta={miles(filteredRecipients.length, lng)}
                                texto={t('bulkSends.recipientsOrderHint')}
                                className={bulkSend.template_preview ? undefined : 'rounded-t-2xl'}
                                accionesClassName="w-full @5xl/hoja:w-auto"
                                acciones={
                                    <>
                                        <Segmentado opciones={filtros} activa={filterStatus} onElegir={setFilterStatus} etiqueta={t('bulkSends.filterByStatus')} />
                                        <div className="relative w-full @3xl/hoja:w-[270px]">
                                            <label htmlFor="bulk-recipients-search" className="sr-only">
                                                {t('bulkSends.searchRecipientsLabel')}
                                            </label>
                                            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground dark:text-neutral-400" strokeWidth={1.75} aria-hidden="true" />
                                            <input
                                                id="bulk-recipients-search"
                                                type="text"
                                                value={search}
                                                onChange={(e) => setSearch(e.target.value)}
                                                placeholder={t('bulkSends.searchRecipientsPlaceholder')}
                                                className={cn(
                                                    'h-9 w-full rounded-[10px] bg-[#2e3f84]/[0.035] pr-3 pl-[38px] text-[13px] leading-[18px] text-foreground shadow-[inset_0_0_0_1px_rgba(46,63,132,0.1)] transition-shadow placeholder:text-muted-foreground dark:bg-white/5 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] dark:placeholder:text-neutral-400',
                                                    FOCO
                                                )}
                                            />
                                        </div>
                                    </>
                                }
                            />

                            {filteredRecipients.length === 0 ? (
                                <div className="px-4 py-8 @3xl/hoja:px-5">
                                    <div className="flex flex-col items-center gap-2 rounded-xl border-[1.5px] border-dashed border-[#2e3f84]/26 bg-[#2e3f84]/[0.035] px-5 py-7 text-center dark:border-white/20 dark:bg-white/[0.03]">
                                        <span className={cn('flex size-10 items-center justify-center rounded-xl bg-white shadow-[inset_0_0_0_1px_rgba(46,63,132,0.12)] dark:bg-white/5 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]', TEXTO_SUAVE)}>
                                            <Search className="size-[19px]" strokeWidth={1.9} aria-hidden="true" />
                                        </span>
                                        <p className={cn('text-[13.5px] leading-[18px] font-semibold', TEXTO_NAVY)}>{t('bulkSends.noRecipientsFound')}</p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Hoja ancha: una columna por dato del Excel. Las columnas se reparten en proporción a lo
                                        que traen y se estrechan juntas; si aun así no caben, la tabla tiene su propio scroll. */}
                                    <div className="custom-scrollbar hidden overflow-x-auto rounded-b-2xl @3xl/hoja:block">
                                        <div role="table" aria-label={t('bulkSends.recipients')} style={{ minWidth: anchoMinimo }}>
                                            <div role="rowgroup">
                                                <div role="row" className={cn('grid h-9 items-center border-b bg-[#2e3f84]/[0.028] pr-5 pl-3 dark:bg-white/[0.03]', FILETE)} style={{ gridTemplateColumns: columnas }}>
                                                    {['#', t('bulkSends.colRecipient'), ...paramKeys, t('bulkSends.colResult')].map((h, i) => (
                                                        <span
                                                            key={`${h}-${i}`}
                                                            role="columnheader"
                                                            className={cn('truncate px-2 text-[11px] leading-4 font-semibold tracking-[0.07em] uppercase', i === 0 && 'text-right', TEXTO_SUAVE)}
                                                            title={h}
                                                        >
                                                            {h}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div role="rowgroup">
                                                {filteredRecipients.map((r, index) => {
                                                    const nombre = nombreDe(r);
                                                    return (
                                                        <div
                                                            key={r.id}
                                                            role="row"
                                                            className={cn('grid min-h-[54px] items-center border-b py-2 pr-5 pl-3 transition-colors last:border-b-0 hover:bg-[#2e3f84]/[0.025] dark:hover:bg-white/[0.025]', FILETE)}
                                                            style={{ gridTemplateColumns: columnas }}
                                                        >
                                                            <span role="cell" className={cn('px-2 text-right text-[12.5px] leading-4 font-medium tabular-nums', TEXTO_SUAVE)}>{index + 1}</span>
                                                            <div role="cell" className="flex min-w-0 flex-col gap-0.5 px-2">
                                                                <span className={cn('truncate text-[13px] leading-[18px] font-semibold', nombre ? TEXTO_NAVY : TEXTO_SUAVE)} title={nombre || undefined}>
                                                                    {nombre ? nombrePropio(nombre) : '—'}
                                                                </span>
                                                                <span className={cn('flex items-center gap-[5px] text-[12px] leading-4 tabular-nums', MONO, TEXTO_SUAVE)}>
                                                                    <Phone className="size-3 shrink-0" strokeWidth={2} aria-hidden="true" />
                                                                    {r.phone_number}
                                                                </span>
                                                            </div>
                                                            {paramKeys.map((key) => (
                                                                <span
                                                                    key={key}
                                                                    role="cell"
                                                                    className={cn('min-w-0 truncate px-2 text-[12.5px] leading-4 tabular-nums', r.params?.[key] ? TEXTO_NAVY : TEXTO_SUAVE)}
                                                                    title={r.params?.[key] || ''}
                                                                >
                                                                    {r.params?.[key] || '—'}
                                                                </span>
                                                            ))}
                                                            <div role="cell" className="min-w-0 px-2">
                                                                {resultado(r)}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Hoja estrecha: una tarjeta por destinatario con sus datos debajo. */}
                                    <ul className="@3xl/hoja:hidden" aria-label={t('bulkSends.recipients')}>
                                        {filteredRecipients.map((r, index) => {
                                            const nombre = nombreDe(r);
                                            return (
                                                <li key={r.id} className={cn('flex flex-col gap-2 border-b px-4 py-3.5 last:rounded-b-2xl last:border-b-0', FILETE)}>
                                                    <div className="flex items-start gap-3">
                                                        <span className={cn('w-6 shrink-0 pt-px text-right text-[12px] leading-[18px] font-medium tabular-nums', TEXTO_SUAVE)}>{index + 1}</span>
                                                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                                            <span className={cn('truncate text-[13.5px] leading-[18px] font-semibold', nombre ? TEXTO_NAVY : TEXTO_SUAVE)}>{nombre ? nombrePropio(nombre) : '—'}</span>
                                                            <span className={cn('text-[12px] leading-4 tabular-nums', MONO, TEXTO_SUAVE)}>{r.phone_number}</span>
                                                        </div>
                                                    </div>
                                                    <div className="pl-9">{resultado(r)}</div>
                                                    {paramKeys.length > 0 && (
                                                        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 pl-9">
                                                            {paramKeys.map((key) => (
                                                                <div key={key} className="flex min-w-0 flex-col">
                                                                    <dt className={cn('truncate text-[11px] leading-4 font-semibold tracking-[0.05em] uppercase', TEXTO_SUAVE)}>{key}</dt>
                                                                    <dd className={cn('truncate text-[12.5px] leading-4', TEXTO_NAVY)}>{r.params?.[key] || '—'}</dd>
                                                                </div>
                                                            ))}
                                                        </dl>
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </>
                            )}
                        </section>
                    </div>
                </div>
            </div>

            {/* ── Detener (nuevo en el detalle): la misma confirmación y la misma llamada que en Envío masivo ── */}
            <ConfirmarDetener
                abierto={confirmarDetener && bulkSend.status === 'processing'}
                onSeguir={() => setConfirmarDetener(false)}
                onDetener={() => {
                    setConfirmarDetener(false);
                    handleCancel();
                }}
                pendientes={Math.max(0, pendingCount)}
                procesados={bulkSend.sent_count + bulkSend.failed_count}
            />
        </AdminLayout>
    );
}
