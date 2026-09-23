<?php

namespace App\Console\Commands;

use App\Models\Setting;
use App\Models\WhatsappTemplate;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

/**
 * Reprogramación de cita a teleconsulta, para iniciar conversaciones nuevas.
 *
 * El texto es el que pidió coordinación, con una única corrección obligatoria: venía
 * con las variables {{1}} {{2}} {{3}} {{4}} {{6}} — sin {{5}}. Meta exige numeración
 * correlativa 1..N y habría rechazado la plantilla. El hueco viene de haberla copiado
 * de 'reprogramacion_cita', donde {{5}} era la hora; aquí la hora se sustituyó por
 * "en el transcurso del día", así que el doctor pasa de {{6}} a {{5}}. Lo que lee el
 * paciente no cambia: el número no se muestra.
 */
class CreateReprogramacionTeleconsulta extends Command
{
    protected $signature = 'templates:crear-reprogramacion-teleconsulta';

    protected $description = 'Crea en Meta la plantilla de reprogramación de cita a teleconsulta';

    private const NOMBRE = 'reprogramacion_teleconsulta';

    /** {{1}} paciente · {{2}} especialidad · {{3}} fecha original · {{4}} fecha nueva · {{5}} doctor */
    private const CUERPO = "Cordial saludo, Sr.(a) {{1}}.\n\nEl Hospital Universitario del Valle \u{201C}Evaristo García\u{201D} se permite informar que la cita de {{2}}, programada para el día {{3}}, ha sido cancelada y reprogramada para el día {{4}}, en el transcurso del día, con el(la) Dr.(a) {{5}}, bajo la modalidad de tele consulta.\n\n📌 Importante: No es necesario acercarse al Hospital. Un asesor se comunicará con usted vía WhatsApp para enviarle el enlace de acceso a la tele consulta.\nPara la atención, debe tener disponibles en formato PDF los siguientes documentos:\n•\tAutorización vigente.\n•\tOrden médica.\n•\tHistoria clínica.\n•\tResultados de exámenes, si aplica.\n•\tRealizar el copago, en caso de que corresponda, a través del enlace que será enviado.\n\nAgradecemos su comprensión y esperamos poder brindarle una adecuada atención.\nCordialmente,\nHospital Universitario del Valle \u{201C}Evaristo García\u{201D}\n70 años latiendo juntos ❤️";

    public function handle(): int
    {
        $waba = Setting::get('whatsapp_business_account_id');
        $token = Setting::get('whatsapp_token');

        if (! $waba || ! $token) {
            $this->error('WhatsApp API no configurada.');

            return 1;
        }

        if (WhatsappTemplate::where('meta_template_name', self::NOMBRE)->exists()) {
            $this->warn('Ya existe localmente. No se hace nada.');

            return 0;
        }

        // Salvaguarda: si alguien edita el cuerpo y vuelve a dejar un hueco, se para aquí
        // en vez de gastar un rechazo de Meta.
        preg_match_all('/\{\{(\d+)\}\}/', self::CUERPO, $m);
        $nums = array_values(array_unique(array_map('intval', $m[1])));
        sort($nums);
        if ($nums !== range(1, count($nums))) {
            $this->error('Las variables no son correlativas ({{'.implode('}}, {{', $nums).'}}). Meta lo rechazaría.');

            return 1;
        }

        $ejemplos = ['MARÍA PÉREZ LÓPEZ', 'Medicina Interna', '20/06/2026', '27/06/2026', 'GARCÍA RAMÍREZ'];

        if (count($ejemplos) !== count($nums)) {
            $this->error('Hay '.count($nums).' variables y '.count($ejemplos).' ejemplos.');

            return 1;
        }

        $this->info('Enviando a Meta…');
        $this->line('  nombre : '.self::NOMBRE.'   idioma: es_CO   categoría: UTILITY');
        $this->line('  cuerpo : '.mb_strlen(self::CUERPO).' caracteres, '.count($nums).' variables');
        $this->newLine();

        try {
            $r = Http::withToken($token)->timeout(30)->post(
                "https://graph.facebook.com/v21.0/{$waba}/message_templates",
                [
                    'name' => self::NOMBRE,
                    'category' => 'UTILITY',
                    'language' => 'es_CO',
                    'components' => [[
                        'type' => 'BODY',
                        'text' => self::CUERPO,
                        'example' => ['body_text' => [$ejemplos]],
                    ]],
                ]
            );
        } catch (\Exception $e) {
            $this->error('✗ No se pudo contactar con Meta: '.$e->getMessage());

            return 1;
        }

        if (! $r->successful()) {
            $err = $r->json();
            $this->error('✗ Meta la rechazó: '.($err['error']['message'] ?? 'error desconocido')
                .(($u = $err['error']['error_user_msg'] ?? '') ? " — {$u}" : ''));

            return 1;
        }

        $d = $r->json();

        WhatsappTemplate::create([
            'name' => 'Reprogramación a teleconsulta',
            'meta_template_name' => self::NOMBRE,
            'preview_text' => self::CUERPO,
            'language' => 'es_CO',
            'category' => 'UTILITY',
            'status' => $d['status'] ?? 'PENDING',
            'meta_template_id' => $d['id'] ?? null,
            'default_params' => array_fill(0, count($nums), ''),
            'is_active' => false,
        ]);

        $this->info('✓ Creada — ID: '.($d['id'] ?? 'N/A').'   Estado: '.($d['status'] ?? 'PENDING'));
        $this->newLine();
        $this->line('Cuando Meta la apruebe:  php artisan templates:activate '.self::NOMBRE);

        return 0;
    }
}
