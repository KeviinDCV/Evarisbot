<?php

namespace App\Console\Commands;

use App\Models\Setting;
use App\Models\WhatsappTemplate;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

/**
 * Crea en Meta la tercera variante de cancelación de cita.
 *
 * Ya existían dos, y las tres sólo se diferencian en la frase intermedia:
 *   · cancelacion_cita        → "Nuestro equipo se comunicará con usted para reprogramar…"
 *   · cancelacion_de_cita_v2  → "Si tiene alguna duda, por favor dirigirse a su eps."
 *   · ésta                    → ninguna de las dos: sólo la disculpa.
 *
 * Se crea con idioma es_CO para igualar a las dos hermanas activas (5 y 31). El idioma
 * importa: syncTemplates() empareja por (meta_template_name, language), así que crearla
 * en 'es' cuando las demás están en 'es_CO' abriría la puerta a una segunda fila local
 * con el mismo nombre — la tabla no tiene índice único sobre meta_template_name.
 *
 * Los ejemplos se mandan realistas (no 'ejemplo1') porque son lo que revisa Meta, y
 * porque el formato de fecha/hora que se ve aquí es el mismo que la guía del Excel
 * le muestra al asesor: 20/06/2026 y 8:30 AM.
 *
 * Nace con is_active=false a propósito: no aparece en el selector de los 30 asesores
 * hasta que Meta la apruebe y alguien sincronice o ejecute templates:activate.
 */
class CreateCancelacionSinReprogramacion extends Command
{
    protected $signature = 'templates:crear-cancelacion-sin-reprogramacion';

    protected $description = 'Crea en Meta la plantilla de cancelación de cita sin promesa de reprogramación';

    private const NOMBRE = 'cancelacion_de_cita_sin_reprogramacion';

    private const CUERPO = "Estimado/a paciente, {{1}}\n\nLe informamos que su cita médica programada para el {{2}} a las {{3}} ha sido cancelada. Le pedimos disculpas por cualquier inconveniente que esto pueda ocasionarle.\n\nAgradecemos su comprensión.\n\nCordialmente,\nHospital Universitario del Valle Evaristo García\n70 años latiendo juntos.";

    public function handle(): int
    {
        $businessAccountId = Setting::get('whatsapp_business_account_id');
        $token = Setting::get('whatsapp_token');

        if (! $businessAccountId || ! $token) {
            $this->error('WhatsApp API no configurada (faltan whatsapp_business_account_id o whatsapp_token en settings).');

            return 1;
        }

        if (WhatsappTemplate::where('meta_template_name', self::NOMBRE)->exists()) {
            $this->warn('Ya existe localmente una plantilla con ese nombre. No se hace nada.');

            return 0;
        }

        $ejemplos = ['MARÍA PÉREZ LÓPEZ', '20/06/2026', '8:30 AM'];

        $componentes = [[
            'type' => 'BODY',
            'text' => self::CUERPO,
            'example' => ['body_text' => [$ejemplos]],
        ]];

        $this->info('Enviando a Meta…');
        $this->line('  nombre : '.self::NOMBRE);
        $this->line('  idioma : es_CO   categoría: UTILITY');
        $this->newLine();

        try {
            $respuesta = Http::withToken($token)
                ->timeout(30)
                ->post("https://graph.facebook.com/v21.0/{$businessAccountId}/message_templates", [
                    'name' => self::NOMBRE,
                    'category' => 'UTILITY',
                    'language' => 'es_CO',
                    'components' => $componentes,
                ]);
        } catch (\Exception $e) {
            $this->error('✗ No se pudo contactar con Meta: '.$e->getMessage());

            return 1;
        }

        if (! $respuesta->successful()) {
            $err = $respuesta->json();
            $msg = $err['error']['message'] ?? 'Error desconocido';
            $userMsg = $err['error']['error_user_msg'] ?? '';
            $this->error("✗ Meta rechazó la plantilla: {$msg}".($userMsg ? " — {$userMsg}" : ''));

            return 1;
        }

        $datos = $respuesta->json();

        WhatsappTemplate::create([
            'name' => 'Cancelación de cita (sin reprogramación)',
            'meta_template_name' => self::NOMBRE,
            'preview_text' => self::CUERPO,
            'language' => 'es_CO',
            'category' => 'UTILITY',
            'status' => $datos['status'] ?? 'PENDING',
            'meta_template_id' => $datos['id'] ?? null,
            'default_params' => ['', '', ''],
            'is_active' => false,
        ]);

        $this->info('✓ Creada en Meta — ID: '.($datos['id'] ?? 'N/A').'   Estado: '.($datos['status'] ?? 'PENDING'));
        $this->newLine();
        $this->warn('FALTAN DOS PASOS para que funcione de verdad:');
        $this->line('  1. Cuando Meta la apruebe:  php artisan templates:activate '.self::NOMBRE);
        $this->line('  2. Añadirla a config/whatsapp.php → cancellation_templates, y luego');
        $this->line('     php artisan config:cache   (si no, el WhatsApp sale pero la cita');
        $this->line('     sigue "confirmada" y el bot contradice al asesor).');

        return 0;
    }
}
