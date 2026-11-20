<?php

namespace App\Console\Commands;

use App\Models\Conversation;
use App\Services\LlamadasWhatsApp;
use App\Services\RobotLlamadas;
use Illuminate\Console\Command;

/**
 * Llamada(s) de PRUEBA del robot de recordatorios (cita ficticia; no toca ninguna cita real). Sin --aplicar solo muestra.
 * Con varios números los llama casi a la vez (uno tras otro, sin esperar a que termine el anterior).
 *
 *   php artisan whatsapp:robot-prueba 573001234567 --aplicar
 *   php artisan whatsapp:robot-prueba 573001234567 573009876543 --sin-chat --aplicar
 */
class RobotLlamadaPrueba extends Command
{
    protected $signature = 'whatsapp:robot-prueba
        {numeros* : Celular(es) con indicativo}
        {--sin-chat : Permite números que nunca le han escrito al hospital (la llamada queda sin chat; no se crea ninguno)}
        {--aplicar : Llamar de verdad}';

    protected $description = 'Llamada(s) de prueba del robot de recordatorios por voz (cita ficticia)';

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
        if (! LlamadasWhatsApp::activas()) {
            $this->error('Las llamadas de WhatsApp están apagadas (php artisan whatsapp:llamadas).');

            return self::FAILURE;
        }
        if (! RobotLlamadas::disponible()) {
            $this->error('El robot de llamadas no está corriendo (robot-llamadas/robot.py).');

            return self::FAILURE;
        }

        // Primero se revisan todos; si alguno no sirve, no se llama a nadie.
        $destinos = [];
        foreach ((array) $this->argument('numeros') as $crudo) {
            $numero = preg_replace('/\D/', '', (string) $crudo);
            if (strlen($numero) === 10 && str_starts_with($numero, '3')) {
                $numero = '57'.$numero; // celular colombiano escrito sin indicativo
            }
            if (! preg_match('/^\d{11,15}$/', $numero)) {
                $this->error("«{$crudo}» no parece un celular con indicativo.");

                return self::FAILURE;
            }
            if (LlamadasWhatsApp::usuariosEnsayo() !== [] && ! in_array($numero, LlamadasWhatsApp::numerosEnsayo(), true)) {
                $this->error('···'.substr($numero, -4).': en ensayo solo se puede llamar a los números invitados.');

                return self::FAILURE;
            }
            $conversacion = Conversation::where('phone_number', '+'.$numero)->first();
            if ($conversacion?->is_blocked) {
                $this->error('···'.substr($numero, -4).': el contacto está bloqueado.');

                return self::FAILURE;
            }
            if (! $conversacion && ! $this->option('sin-chat')) {
                $this->error('···'.substr($numero, -4).': no tiene chat en Evarisbot (use --sin-chat para llamarlo igual).');

                return self::FAILURE;
            }
            // Sin chat: un objeto en memoria con el número (NO se guarda; la llamada queda con conversation_id vacío).
            $destinos[$numero] = $conversacion ?? new Conversation(['phone_number' => '+'.$numero]);
        }

        foreach ($destinos as $numero => $c) {
            $this->line('Llamaría a ···'.substr($numero, -4).($c->exists ? " (chat #{$c->id})" : ' (sin chat)').' con la voz '.RobotLlamadas::VOZ.' y una cita FICTICIA.');
        }
        if (! $this->option('aplicar')) {
            $this->line('(sin --aplicar: no se llamó)');

            return self::SUCCESS;
        }

        $todas = true;
        foreach ($destinos as $numero => $c) {
            $r = $servicio->llamarRobot($c, self::TEXTOS_PRUEBA);
            $todas = $todas && $r['ok'];
            $this->line('···'.substr($numero, -4).' → '.json_encode(['ok' => $r['ok'], 'error' => $r['error'] ?? null, 'llamada_id' => $r['llamada']->id ?? null], JSON_UNESCAPED_UNICODE));
        }

        return $todas ? self::SUCCESS : self::FAILURE;
    }
}
