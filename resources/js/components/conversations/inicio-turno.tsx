import { useTranslation } from 'react-i18next';

type Props = {
    /** Nombre del asesor como se muestra (solo el primero). */
    nombre: string;
    deTurno: boolean;
    /** Las sin asignar solo las ven un administrador o un asesor de turno. */
    mostrarEsperan: boolean;
    mias: number;
    esperan: number;
    enEspera: number;
    /** Conversaciones distintas a las que escribió hoy (0: no se muestra la línea). */
    respondidasHoy: number;
    onFiltrar: (estado: 'unanswered' | 'pending_response') => void;
};

/**
 * Inicio de Conversaciones sin chat abierto (diseño «Tu turno de un vistazo», design/inicio-conversaciones): el saludo y
 * lo pendiente, en discreto. Antes solo decía «Selecciona una conversación». Las cifras «Esperan asesor» y «En espera»
 * llevan a esos filtros.
 */
export function InicioTurno({ nombre, deTurno, mostrarEsperan, mias, esperan, enEspera, respondidasHoy, onFiltrar }: Props) {
    const { t, i18n } = useTranslation();

    const ahora = new Date();
    const hora = ahora.getHours();
    const saludo = hora < 12 ? 'conversations.inicio.saludoManana' : hora < 19 ? 'conversations.inicio.saludoTarde' : 'conversations.inicio.saludoNoche';
    const fechaTexto = ahora.toLocaleDateString(i18n.language?.startsWith('en') ? 'en-US' : 'es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
    const fecha = fechaTexto.charAt(0).toUpperCase() + fechaTexto.slice(1);

    const tarjeta = 'rounded-[14px] border border-border bg-card px-3.5 py-3 flex flex-col gap-0.5 text-left';
    const cifra = 'text-[22px] leading-tight font-semibold tabular-nums text-[#2e3f84] dark:text-blue-300';
    const rotulo = 'text-[13px] text-[#3b4466] dark:text-neutral-300';
    const pulsable = 'cursor-pointer transition-colors hover:border-[#c9d0ea] hover:bg-[#f7f8fc] dark:hover:border-neutral-600 dark:hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2e3f84]';

    return (
        <div className="w-full max-w-[520px] px-6 flex flex-col gap-[18px]">
            <div>
                <p className="m-0 text-xs text-muted-foreground">
                    {fecha}
                    {deTurno ? ` · ${t('conversations.inicio.deTurno')}` : ''}
                </p>
                <h3 className="mt-1 text-[22px] font-semibold text-[#2e3f84] dark:text-neutral-200">{t(saludo, { nombre })}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t('conversations.inicio.subtitulo')}</p>
            </div>

            <div className={`grid gap-2.5 ${mostrarEsperan ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <div className={tarjeta}>
                    <span className={cifra}>{mias}</span>
                    <span className={rotulo}>{t('conversations.inicio.mias')}</span>
                </div>
                {mostrarEsperan && (
                    <button type="button" onClick={() => onFiltrar('unanswered')} aria-label={t('conversations.inicio.verEsperan', { count: esperan })} className={`${tarjeta} ${pulsable}`}>
                        <span className={cifra}>{esperan}</span>
                        <span className={rotulo}>{t('conversations.inicio.esperan')}</span>
                    </button>
                )}
                <button type="button" onClick={() => onFiltrar('pending_response')} aria-label={t('conversations.inicio.verEnEspera', { count: enEspera })} className={`${tarjeta} ${pulsable}`}>
                    <span className={cifra}>{enEspera}</span>
                    <span className={rotulo}>{t('conversations.inicio.enEspera')}</span>
                </button>
            </div>

            {respondidasHoy > 0 && (
                <p className="m-0 text-xs text-muted-foreground">{t('conversations.inicio.respondidasHoy', { count: respondidasHoy })}</p>
            )}
        </div>
    );
}
