<?php

namespace App\Console\Commands;

use App\Models\Conversation;
use App\Services\LlamadasWhatsApp;
use App\Services\RobotLlamadas;
use Illuminate\Console\Command;

/**
 * Llamada de PRUEBA del robot de recordatorios (cita ficticia; no toca ninguna cita real). Sin --aplicar solo muestra.
 *
 *   php artisan whatsapp:robot-prueba 573001234567 --aplicar
 */
class RobotLlamadaPrueba extends Command
{
    protected $signature = 'whatsapp:robot-prueba {numero : Celular con indicativo (debe tener chat en Evarisbot)} {--aplicar : Llamar de verdad}';

    protected $description = 'Llamada de prueba del robot de recordatorios por voz (cita ficticia)';

    public const TEXTOS_PRUEBA = [
        'mensaje' => 'Hola, le habla el Hospital Universitario del Valle, Evaristo García. Este es un mensaje automático para recordarle su cita de Cardiología, el lunes veinticuatro de noviembre, a las siete y treinta de la mañana, en la sede principal, consultorio cinco.',
        'pregunta' => 'Para confirmar su asistencia, marque uno. Para cancelar la cita, marque dos. Para escuchar de nuevo, marque nueve.',
        'confirmada' => 'Gracias. Su cita quedó confirmada. Recuerde llegar quince minutos antes, con su documento de identidad. Que tenga un buen día.',
        'cancelada' => 'Entendido. Registramos que desea cancelar su cita. Para terminar la cancelación, le enviamos un mensaje por WhatsApp con los datos que necesitamos. Hasta luego.',
        'no_entendi' => 'No reconocimos esa opción.',
        'sin_respuesta' => 'No recibimos respuesta. Puede confirmar o cancelar su cita respondiendo el mensaje de WhatsApp. Hasta luego.',
        'error' => 'En este momento no pudimos registrar su respuesta. Por favor respóndanos el mensaje de WhatsApp. Hasta luego.',
    ];

    public function handle(LlamadasWhatsApp $servicio): int
    {
        $numero = preg_replace('/\D/', '', (string) $this->argument('numero'));
        $conversacion = Conversation::where('phone_number', '+'.$numero)->first();
        if (! $conversacion) {
            $this->error('Ese número no tiene chat en Evarisbot (escríbale primero al hospital desde ese celular).');

            return self::FAILURE;
        }
        if (! LlamadasWhatsApp::activas()) {
            $this->error('Las llamadas de WhatsApp están apagadas (php artisan whatsapp:llamadas).');

            return self::FAILURE;
        }
        if (LlamadasWhatsApp::usuariosEnsayo() !== [] && ! in_array($numero, LlamadasWhatsApp::numerosEnsayo(), true)) {
            $this->error('En ensayo solo se puede llamar a los números invitados (whatsapp:llamadas --boton=…).');

            return self::FAILURE;
        }
        if (! RobotLlamadas::disponible()) {
            $this->error('El robot de llamadas no está corriendo (robot-llamadas/robot.py).');

            return self::FAILURE;
        }
        $this->line("Llamaría a ···".substr($numero, -4)." (chat #{$conversacion->id}) con la voz ".RobotLlamadas::VOZ.' y una cita FICTICIA.');
        if (! $this->option('aplicar')) {
            $this->line('(sin --aplicar: no se llamó)');

            return self::SUCCESS;
        }
        $r = $servicio->llamarRobot($conversacion, self::TEXTOS_PRUEBA);
        $this->line(json_encode(['ok' => $r['ok'], 'error' => $r['error'] ?? null, 'llamada_id' => $r['llamada']->id ?? null], JSON_UNESCAPED_UNICODE));

        return $r['ok'] ? self::SUCCESS : self::FAILURE;
    }
}
