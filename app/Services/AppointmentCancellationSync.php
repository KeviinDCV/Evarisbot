<?php

namespace App\Services;

use App\Models\Appointment;
use Illuminate\Support\Facades\Log;

/**
 * Deja la cita en 'cancelled' cuando se envía una plantilla de cancelación.
 *
 * El problema que resuelve: enviar la plantilla sólo mandaba el WhatsApp, sin tocar la
 * cita. El paciente recibía "su cita ha sido cancelada" de un asesor y, si respondía,
 * el bot leía reminder_status (que seguía en 'confirmed') y le contestaba "CONFIRMADA".
 * Dos mensajes contrarios del mismo hospital, con el paciente teniendo razón en quejarse.
 *
 * Qué cita se marca: la que nombra el propio mensaje. Las plantillas de cancelación
 * llevan la fecha y la hora como parámetros, así que se busca por teléfono + fecha + hora.
 *
 * Reglas de seguridad (esto escribe solo, sin que nadie lo revise):
 *   · Sólo actúa con las plantillas listadas en config('whatsapp.cancellation_templates').
 *   · Sólo si coincide EXACTAMENTE UNA cita. Con 0 o con varias, no toca nada y avisa.
 *   · Nunca vuelve a marcar una cita ya cancelada.
 *   · Nunca lanza excepciones: el WhatsApp ya salió y un fallo aquí no puede tumbar el envío.
 */
class AppointmentCancellationSync
{
    /**
     * @param  string  $phone   Teléfono al que se envió (cualquier formato).
     * @param  string  $metaTemplateName  Nombre de la plantilla en Meta.
     * @param  array   $params  Parámetros del cuerpo, en orden ({{1}} = índice 0).
     * @param  string  $origen  Para el registro: 'masivo #95', 'chat', etc.
     * @return int|null  Id de la cita marcada, o null si no se tocó nada.
     */
    public static function fromTemplate(string $phone, string $metaTemplateName, array $params, string $origen): ?int
    {
        try {
            $mapa = config('whatsapp.cancellation_templates', []);
            $conf = $mapa[$metaTemplateName] ?? null;
            if (!$conf) {
                return null; // No es una plantilla de cancelación: nada que hacer.
            }

            $fechaCruda = $params[($conf['date_param'] ?? 0) - 1] ?? null;
            $horaCruda  = $params[($conf['time_param'] ?? 0) - 1] ?? null;

            $fecha = self::aFecha($fechaCruda);
            $hora  = self::aHora($horaCruda);

            if (!$fecha || !$hora) {
                Log::warning('Cancelación: no se pudo leer fecha/hora de la plantilla', [
                    'plantilla' => $metaTemplateName, 'fecha' => $fechaCruda,
                    'hora' => $horaCruda, 'origen' => $origen,
                ]);
                return null;
            }

            $tel = substr(preg_replace('/\D/', '', $phone), -10);
            if (strlen($tel) < 10) {
                return null;
            }

            $citas = Appointment::whereRaw('RIGHT(REGEXP_REPLACE(pactel, "[^0-9]", ""), 10) = ?', [$tel])
                ->where('citfc', $fecha)
                ->where('cithor', $hora)
                ->get();

            if ($citas->count() !== 1) {
                // 0 = la cita no está en el sistema (lista venida de un Excel externo).
                // >1 = duplicadas: marcar "la que sea" podría cancelar la equivocada.
                Log::warning('Cancelación: no se marca ninguna cita', [
                    'motivo' => $citas->count() === 0 ? 'sin coincidencia' : 'varias coinciden',
                    'coincidencias' => $citas->count(),
                    'telefono' => $tel, 'fecha' => $fecha, 'hora' => $hora, 'origen' => $origen,
                ]);
                return null;
            }

            $cita = $citas->first();
            if ($cita->reminder_status === 'cancelled') {
                return null;
            }

            $cita->reminder_status = 'cancelled';
            $cita->notes = trim(($cita->notes ?? '') . ' [' . now()->setTimezone('America/Bogota')->format('Y-m-d H:i')
                . '] Cancelada al enviar la plantilla ' . $metaTemplateName . ' (' . $origen . ')');
            $cita->save();

            Log::info('Cancelación: cita marcada como cancelada', [
                'cita' => $cita->id, 'paciente' => $cita->nom_paciente,
                'fecha' => $fecha, 'hora' => $hora, 'origen' => $origen,
            ]);

            return $cita->id;
        } catch (\Throwable $e) {
            // El mensaje ya salió; pase lo que pase aquí, el envío no se rompe.
            Log::error('Cancelación: fallo al sincronizar el estado de la cita', [
                'error' => $e->getMessage(), 'plantilla' => $metaTemplateName, 'origen' => $origen,
            ]);
            return null;
        }
    }

    /** "29/07/2026", "2026-07-29" → "2026-07-29" */
    /**
     * Meses en español tal y como los escriben los asesores, con sus abreviaturas.
     * "setiembre" está a propósito: es válido en español y aparece escrito así.
     */
    private const MESES = [
        'enero' => 1, 'ene' => 1,
        'febrero' => 2, 'feb' => 2,
        'marzo' => 3, 'mar' => 3,
        'abril' => 4, 'abr' => 4,
        'mayo' => 5, 'may' => 5,
        'junio' => 6, 'jun' => 6,
        'julio' => 7, 'jul' => 7,
        'agosto' => 8, 'ago' => 8,
        'septiembre' => 9, 'setiembre' => 9, 'sept' => 9, 'sep' => 9,
        'octubre' => 10, 'oct' => 10,
        'noviembre' => 11, 'nov' => 11,
        'diciembre' => 12, 'dic' => 12,
    ];

    private static function aFecha(?string $v): ?string
    {
        $v = trim((string) $v);
        if ($v === '') return null;

        foreach (['d/m/Y', 'Y-m-d', 'd-m-Y'] as $formato) {
            $d = \DateTime::createFromFormat($formato, $v);
            if ($d && $d->format($formato) === $v) {
                return $d->format('Y-m-d');
            }
        }

        return self::aFechaConMesEnLetra($v);
    }

    /**
     * "04 SEPTIEMBRE 2026", "09/SEPTIEMBRE/2026", "9 de septiembre de 2026" → "2026-09-09"
     *
     * Los asesores escriben el mes con letra al abrir una conversación nueva, y hasta
     * ahora eso se rechazaba: el WhatsApp salía, la cita seguía "confirmada" y el bot
     * terminaba contradiciendo al asesor. Es el caso mayoritario de los fallos vistos
     * en el registro, no un formato raro.
     */
    private static function aFechaConMesEnLetra(string $v): ?string
    {
        // Minúsculas y sin tildes, para que "MARZO" y "marzo" den lo mismo.
        $t = mb_strtolower($v, 'UTF-8');
        $t = strtr($t, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u']);

        // Barras, guiones, puntos y comas valen como separador; el "de" sobra.
        $t = preg_replace('/[\/\-.,]+/', ' ', $t);
        $t = preg_replace('/\bde\b/', ' ', $t);
        $t = trim(preg_replace('/\s+/', ' ', $t));

        $partes = explode(' ', $t);
        if (count($partes) !== 3) {
            return null;
        }

        // El año es la parte de cuatro cifras y siempre va al final.
        [$p1, $p2, $anio] = $partes;
        if (! preg_match('/^\d{4}$/', $anio)) {
            return null;
        }

        // Se admiten los dos órdenes: "4 septiembre" y "septiembre 4".
        if (ctype_digit($p1) && isset(self::MESES[$p2])) {
            $dia = (int) $p1;
            $mes = self::MESES[$p2];
        } elseif (isset(self::MESES[$p1]) && ctype_digit($p2)) {
            $mes = self::MESES[$p1];
            $dia = (int) $p2;
        } else {
            return null;
        }

        // checkdate rechaza el 31 de febrero en vez de dejar que PHP lo desplace al mes
        // siguiente. Aquí eso importa: desplazar la fecha cancelaría una cita que no era.
        if (! checkdate($mes, $dia, (int) $anio)) {
            return null;
        }

        return sprintf('%04d-%02d-%02d', (int) $anio, $mes, $dia);
    }

    /** "9:30 AM", "09:30", "9:30 a. m." → "09:30:00" */
    private static function aHora(?string $v): ?string
    {
        $v = trim((string) $v);
        if ($v === '') return null;

        // Normaliza el "a. m." / "p. m." que escribe Excel en español.
        $v = preg_replace('/\s*a\.?\s*m\.?/iu', ' AM', $v);
        $v = preg_replace('/\s*p\.?\s*m\.?/iu', ' PM', $v);

        $t = strtotime($v);
        return $t ? date('H:i:s', $t) : null;
    }
}
