<?php

namespace App\Services;

use App\Models\Appointment;
use App\Models\Conversation;
use App\Models\Llamada;
use App\Models\Message;
use App\Models\PermisoLlamada;
use App\Models\Setting;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * RECORDATORIOS DE CITA POR LLAMADA (pedido del 19/11/2026): a quien no respondió el recordatorio de WhatsApp y aceptó
 * recibir llamadas (App\Models\PermisoLlamada), el robot (App\Services\RobotLlamadas) le lee la cita con la voz de Dalia
 * y el paciente marca 1 (confirmar), 2 (cancelar) o 9 (repetir). La cita queda igual que con los botones del recordatorio
 * (WhatsAppService::aplicarRespuestaCita, con «vía llamada») y además le llega por WhatsApp el mismo texto de siempre.
 */
class RecordatoriosPorLlamada
{
    /** 'true' = tras confirmar por WhatsApp, el bot pregunta si quiere recordatorios por llamada. Apagado por defecto. */
    public const AJUSTE_PREGUNTAR = 'recordatorio_llamada_preguntar';

    public static function preguntarActivo(): bool
    {
        try {
            return Setting::get(self::AJUSTE_PREGUNTAR, 'false') === 'true';
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * Lo que dice Dalia sobre esta cita: especialidad (decisión del usuario), fecha, hora y lugar; nunca el nombre ni
     * datos clínicos.
     *
     * @return array<string, string>
     */
    public static function textos(Appointment $a): array
    {
        $partes = ['Hola, le habla el Hospital Universitario del Valle, Evaristo García. Este es un mensaje automático para recordarle su cita'];
        $especialidad = self::nombreHablado((string) $a->espnom);
        if ($especialidad !== '') {
            $partes[] = " de {$especialidad}";
        }
        if ($a->citfc) {
            $partes[] = ', el '.$a->citfc->copy()->locale('es')->isoFormat('dddd D [de] MMMM');
        }
        if ($a->cithor) {
            $partes[] = ', a las '.self::horaHablada($a->cithor->format('H:i'));
        }
        $lugar = self::lugarHablado($a);
        if ($lugar !== '') {
            $partes[] = ", en {$lugar}";
        }

        return [
            'mensaje' => implode('', $partes).'.',
            'pregunta' => 'Para confirmar su asistencia, marque uno. Para cancelar la cita, marque dos. Para escuchar de nuevo, marque nueve. Si no desea recibir más llamadas del hospital, marque tres.',
            'no_llamar' => 'Entendido. No le volveremos a llamar para recordarle sus citas. Seguirá recibiendo los recordatorios por WhatsApp. Hasta luego.',
            'confirmada' => 'Gracias. Su cita quedó confirmada. Recuerde llegar quince minutos antes, con su documento de identidad. Que tenga un buen día.',
            'cancelada' => 'Entendido. Registramos que desea cancelar su cita. Para terminar la cancelación, le enviamos un mensaje por WhatsApp con los datos que necesitamos. Hasta luego.',
            'ya_cancelada' => 'Esta cita ya estaba cancelada y no se puede confirmar por este medio. Si necesita ayuda, escríbanos por WhatsApp. Hasta luego.',
            'no_entendi' => 'No reconocimos esa opción.',
            'sin_respuesta' => 'No recibimos respuesta. Puede confirmar o cancelar su cita respondiendo el mensaje de WhatsApp. Hasta luego.',
            'error' => 'En este momento no pudimos registrar su respuesta. Por favor respóndanos el mensaje de WhatsApp. Hasta luego.',
        ];
    }

    /** «07:30» → «7 y 30 de la mañana»; «14:00» → «2 en punto de la tarde». */
    public static function horaHablada(string $hhmm): string
    {
        [$h, $m] = array_map('intval', explode(':', $hhmm) + [0, 0]);
        $parte = match (true) {
            $h < 12 => 'de la mañana',
            $h === 12 => 'del mediodía',
            $h < 19 => 'de la tarde',
            default => 'de la noche',
        };
        $h12 = $h % 12 === 0 ? 12 : $h % 12;
        $minutos = $m === 0 ? 'en punto' : ($m === 30 ? 'y media' : "y {$m}");

        return "{$h12} {$minutos} {$parte}";
    }

    /** «CARDIOLOGIA PEDIATRICA» → «Cardiología Pediátrica» (mayúsculas y tildes para que la voz lo pronuncie bien). */
    public static function nombreHablado(string $texto): string
    {
        $t = trim(preg_replace('/\s+/', ' ', $texto));
        if ($t === '') {
            return '';
        }
        $t = mb_convert_case(mb_strtolower($t), MB_CASE_TITLE);
        // Terminaciones frecuentes en la base sin tilde.
        $t = preg_replace(
            ['/logia\b/u', '/grafia\b/u', '/iatria\b/u', '/cirugia\b/u', '/metria\b/u', '/scopia\b/u', '/tomia\b/u', '/patia\b/u', '/atrica\b/u', '/ologica\b/u', '/ologico\b/u', '/fisica\b/u', '/clinica\b/u', '/medica\b/u', '/medico\b/u', '/genetica\b/u', '/nutricion\b/u', '/rehabilitacion\b/u', '/atencion\b/u', '/Cirugia\b/u'],
            ['logía', 'grafía', 'iatría', 'cirugía', 'metría', 'scopía', 'tomía', 'patía', 'átrica', 'ológica', 'ológico', 'física', 'clínica', 'médica', 'médico', 'genética', 'nutrición', 'rehabilitación', 'atención', 'Cirugía'],
            $t
        );

        return str_replace([' De ', ' Del ', ' Y ', ' La ', ' El ', ' En '], [' de ', ' del ', ' y ', ' la ', ' el ', ' en '], $t);
    }

    /** «Urología General, consultorio U 01» (lo mismo que la línea «Ubicación» del recordatorio). */
    public static function lugarHablado(Appointment $a): string
    {
        $connom = self::nombreHablado((string) $a->connom);
        $citcon = trim((string) $a->citcon);
        $consultorio = $citcon !== '' ? 'consultorio '.trim(preg_replace('/(?<=[A-Za-z])(?=\d)/', ' ', $citcon)) : '';

        return trim($connom.($connom !== '' && $consultorio !== '' ? ', ' : '').$consultorio);
    }

    /**
     * El paciente marcó una tecla en la llamada de su cita. 1 confirma, 2 cancela, 9 repite. Devuelve lo que el robot
     * debe decir (clave de textos()) y si termina la llamada.
     *
     * @return array{decir?: string, fin?: bool, repetir?: bool}
     */
    public function tecla(Llamada $llamada, string $tecla): array
    {
        if ($tecla === '9') {
            return ['repetir' => true];
        }
        if ($tecla === '3') {
            // No quiere más llamadas (se llama sin pedir permiso antes: RondaLlamadas 'salvo_no'). Queda como «no» y no se
            // le vuelve a llamar; la cita no cambia y se le confirma por escrito.
            try {
                PermisoLlamada::registrar($llamada->telefono, false, 'llamada', null, $llamada->conversation_id, 'Marcó 3 en la llamada de recordatorio');
            } catch (\Throwable $e) {
                Log::error('Recordatorio por llamada: no se pudo anotar el «no llamar»', ['llamada_id' => $llamada->id, 'error' => $e->getMessage()]);

                return ['decir' => 'error', 'fin' => true];
            }
            $llamada->update(['tecla' => '3', 'resultado_robot' => 'no_llamar']);
            Log::info('Recordatorio por llamada: el paciente pidió no más llamadas', ['llamada_id' => $llamada->id, 'cita_id' => $llamada->cita_id]);
            $this->escribir($llamada, "Listo, no le volveremos a llamar para recordarle sus citas. Seguirá recibiendo los recordatorios por WhatsApp.\n\n_HUV - Evaristo García_");

            return ['decir' => 'no_llamar', 'fin' => true];
        }
        if ($tecla !== '1' && $tecla !== '2') {
            return ['decir' => 'no_entendi', 'fin' => false];
        }
        $accion = $tecla === '1' ? 'confirmar' : 'cancelar';
        $texto = null;
        $estadoFinal = null;
        $cita = null;
        try {
            DB::transaction(function () use ($llamada, $accion, &$texto, &$estadoFinal, &$cita) {
                if ($llamada->conversation_id) {
                    Conversation::whereKey($llamada->conversation_id)->lockForUpdate()->first(['id']);
                }
                $cita = Appointment::whereKey($llamada->cita_id)->lockForUpdate()->first();
                if (! $cita) {
                    return;
                }
                [$texto] = app(WhatsAppService::class)->aplicarRespuestaCita($cita, $accion, 'llamada');
                $estadoFinal = $cita->fresh()->reminder_status;
            });
        } catch (\Throwable $e) {
            Log::error('Recordatorio por llamada: no se pudo aplicar la tecla', ['llamada_id' => $llamada->id, 'error' => $e->getMessage()]);

            return ['decir' => 'error', 'fin' => true];
        }
        if (! $cita) {
            return ['decir' => 'error', 'fin' => true];
        }

        $resultado = match (true) {
            $accion === 'confirmar' && $estadoFinal === 'confirmed' => 'confirmo',
            $accion === 'cancelar' && $estadoFinal === 'cancelled' => 'cancelo',
            default => 'sin_cambio',
        };
        $llamada->update(['tecla' => $tecla, 'resultado_robot' => $resultado]);
        Log::info('Recordatorio por llamada: respuesta del paciente', ['llamada_id' => $llamada->id, 'cita_id' => $llamada->cita_id, 'resultado' => $resultado]);

        // Lo mismo que con los botones: el texto de siempre por WhatsApp (al contestar la llamada se abrió la ventana de
        // 24 h). Para cancelar es imprescindible: pide los datos que hacen efectiva la cancelación.
        if ($texto && ! $this->escribir($llamada, $texto."\n\n_HUV - Evaristo García_") && $resultado === 'cancelo') {
            // El paciente canceló pero no le llegaron por WhatsApp los datos que se piden: que lo vea un asesor.
            $this->avisarAsesores($llamada, $texto);
        }

        return match (true) {
            $resultado === 'confirmo' => ['decir' => 'confirmada', 'fin' => true],
            $resultado === 'cancelo' => ['decir' => 'cancelada', 'fin' => true],
            $accion === 'confirmar' && $estadoFinal === 'cancelled' => ['decir' => 'ya_cancelada', 'fin' => true],
            default => ['decir' => 'error', 'fin' => true],
        };
    }

    /** Envía el texto por WhatsApp y lo deja (oculto) en el hilo, como las respuestas del bot. false si no salió. */
    private function escribir(Llamada $llamada, string $texto): bool
    {
        try {
            $conversacion = $llamada->conversation_id ? Conversation::find($llamada->conversation_id) : null;
            if (! $conversacion) {
                return false;
            }
            $r = app(WhatsAppService::class)->sendTextMessage($conversacion->phone_number, $texto);
            if (! ($r['success'] ?? false)) {
                Log::warning('Recordatorio por llamada: no se pudo enviar el texto por WhatsApp', ['llamada_id' => $llamada->id, 'error' => $r['error'] ?? null]);

                return false;
            }
            Message::create([
                'conversation_id' => $conversacion->id,
                'content' => $texto,
                'message_type' => 'text',
                'is_from_user' => false,
                'is_hidden' => true,
                'whatsapp_message_id' => $r['message_id'] ?? null,
                'status' => 'sent',
                'sent_by' => null,
            ]);

            return true;
        } catch (\Throwable $e) {
            Log::warning('Recordatorio por llamada: falló el texto por WhatsApp', ['llamada_id' => $llamada->id, 'error' => $e->getMessage()]);

            return false;
        }
    }

    /**
     * El texto que no salió queda VISIBLE en el chat como mensaje fallido (el asesor lo ve y lo reenvía o escribe) y el
     * chat vuelve a la bandeja con un no leído, como cuando falla la respuesta a un botón del recordatorio.
     */
    private function avisarAsesores(Llamada $llamada, string $texto): void
    {
        try {
            $conversacion = $llamada->conversation_id ? Conversation::find($llamada->conversation_id) : null;
            if (! $conversacion) {
                return;
            }
            Message::create([
                'conversation_id' => $conversacion->id,
                'content' => $texto,
                'message_type' => 'text',
                'is_from_user' => false,
                'is_hidden' => false,
                'status' => 'failed',
                'error_message' => 'No se pudo enviar después de la llamada de recordatorio (el paciente canceló marcando 2).',
                'sent_by' => null,
            ]);
            if (in_array($conversacion->status, ['resolved', 'scheduled', 'closed'], true)) {
                $conversacion->update(['status' => 'active']);
            }
            $conversacion->incrementUnread();
            \App\Support\TiempoReal::conversacion('mensaje_entrante', $conversacion->id);
            Log::warning('Recordatorio por llamada: se avisó a los asesores', ['llamada_id' => $llamada->id]);
        } catch (\Throwable $e) {
            Log::error('Recordatorio por llamada: no se pudo avisar a los asesores', ['llamada_id' => $llamada->id, 'error' => $e->getMessage()]);
        }
    }

    /**
     * ¿Se le puede llamar por esta cita? (permiso según el modo de RondaLlamadas, número, que no sea la copia repetida de
     * otra cita y que no se haya llamado ya por ella).
     */
    public static function sePuedeLlamar(Appointment $a, ?Conversation $c): bool
    {
        return $c !== null
            && ! $c->is_blocked
            && in_array($a->reminder_status, ['sent', 'delivered', 'read'], true)
            && $a->citfc && $a->citfc->toDateString() >= now('America/Bogota')->toDateString()
            && ! str_contains((string) $a->notes, \App\Support\RondaLlamadas::MARCA_GEMELA)
            && \App\Support\RondaLlamadas::permitido(PermisoLlamada::vigente($c->phone_number))
            && ! Llamada::where('cita_id', $a->id)->where('origen', 'robot')->exists();
    }
}
