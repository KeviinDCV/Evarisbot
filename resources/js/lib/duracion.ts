import type { TFunction } from 'i18next';

export type UnidadDuracion = 'minutes' | 'hours' | 'days';

export const MINUTOS_POR_UNIDAD: Record<UnidadDuracion, number> = { minutes: 1, hours: 60, days: 1440 };

/** La unidad más grande que expresa los minutos sin decimales (90 → minutos, 120 → horas, 2880 → días). */
export function unidadExacta(minutos: number): UnidadDuracion {
    if (minutos > 0 && minutos % 1440 === 0) return 'days';
    if (minutos > 0 && minutos % 60 === 0) return 'hours';
    return 'minutes';
}

/** "5 minutos", "3 horas", "1 día", "1 hora 30 minutos" (o su versión en inglés). */
export function duracionLegible(minutos: number, t: TFunction): string {
    if (minutos >= 1440 && minutos % 1440 === 0) return t('duration.days', { count: minutos / 1440 });
    if (minutos >= 60 && minutos % 60 === 0) return t('duration.hours', { count: minutos / 60 });
    if (minutos > 60) {
        const horas = Math.floor(minutos / 60);
        return `${t('duration.hours', { count: horas })} ${t('duration.minutes', { count: minutos - horas * 60 })}`;
    }
    return t('duration.minutes', { count: minutos });
}
