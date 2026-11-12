<?php

namespace App\Console\Commands;

use App\Models\Setting;
use App\Models\WhatsappTemplate;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

/**
 * Recordatorios de cita como plantillas de SERVICIO (UTILITY).
 *
 * Las actuales (appointment_reminder y appointment_reminder_cartago) se crearon como MARKETING.
 * Meta limita cuántos mensajes de marketing recibe cada persona (error 131049, «no entregado para
 * mantener una interacción saludable»), y más con la calidad del número en RED: el 15/10/2026 un
 * masivo de 231 recordatorios de Cartago tuvo 94 rechazos así. Un recordatorio de cita es un aviso
 * de servicio, y las plantillas UTILITY no tienen ese límite.
 *
 * Mismo encabezado, mismos 6 datos en el mismo orden y los mismos botones Confirmar/Cancelar: sirven
 * igual para Envío masivo y para la pantalla Citas. NO toca las plantillas actuales.
 *
 *   php artisan templates:recordatorios-utility --dry-run   muestra lo que se enviaría (no llama a Meta)
 *   php artisan templates:recordatorios-utility             las crea en Meta (Meta las revisa: minutos a horas)
 *   php artisan templates:recordatorios-utility --estado    consulta en Meta su estado y categoría
 *   php artisan templates:recordatorios-utility --activar   cuando estén APROBADAS como UTILITY: la pantalla Citas
 *                                                          pasa a usarlas y las viejas se ocultan en Envío masivo
 *                                                          (reversible con --desactivar)
 */
class CrearRecordatoriosUtility extends Command
{
    protected $signature = 'templates:recordatorios-utility
        {--dry-run : Muestra las plantillas sin enviarlas a Meta}
        {--estado : Consulta en Meta el estado y la categoría de las nuevas}
        {--activar : Usarlas en Citas y ocultar las viejas en Envío masivo (solo si Meta las aprobó como UTILITY)}
        {--desactivar : Volver a las plantillas anteriores}
        {--eliminar-viejas : Borrar de Meta las viejas de MARKETING (solo con las nuevas aprobadas y activas; en la app quedan ocultas para el historial)}';

    protected $description = 'Crea los recordatorios de cita como plantillas UTILITY (Cali y Cartago) sin tocar las actuales';

    /**
     * Nombre nuevo => [plantilla vieja que reemplaza, sede y dirección, ajuste que la usa en Citas].
     *
     * Primer intento (recordatorio_cita y _cartago, con el texto de siempre): Meta las clasificó como
     * MARKETING al recibirlas y se borraron. Este texto sigue el estilo de las plantillas del hospital
     * que Meta sí acepta como UTILITY (adelanto_cita, cambio_horario_cita…): sin encabezado de marca ni
     * saludos de cortesía, directo a la cita.
     */
    private const PLANTILLAS = [
        'recordatorio_de_cita' => ['appointment_reminder', 'EN LA SEDE PRINCIPAL DEL HOSPITAL, calle 5 #36-08, San Fernando', 'reminder_template_name'],
        'recordatorio_de_cita_cartago' => ['appointment_reminder_cartago', 'EN LA SEDE CARTAGO, Carrera 3b # 1a - 163, barrio Collarejo', 'reminder_template_name_cartago'],
    ];

    private const IDIOMA = 'es_CO';

    public function handle(): int
    {
        $token = (string) Setting::get('whatsapp_token');
        $waba = Setting::get('whatsapp_business_account_id');

        if (! $this->option('dry-run') && ($token === '' || ! $waba)) {
            $this->error('Falta la clave de acceso o el ID de la cuenta de WhatsApp Business en el servidor.');
            return self::FAILURE;
        }

        if ($this->option('estado')) {
            return $this->estado($token, $waba);
        }
        if ($this->option('activar')) {
            return $this->activar($token, $waba);
        }
        if ($this->option('desactivar')) {
            return $this->desactivar();
        }
        if ($this->option('eliminar-viejas')) {
            return $this->eliminarViejas($token, $waba);
        }

        foreach (self::PLANTILLAS as $nombre => [$vieja, $direccion]) {
            $cuerpo = self::cuerpo($direccion);

            $this->newLine();
            $this->info(str_repeat('=', 70));
            $this->info("PLANTILLA: {$nombre}  (idioma " . self::IDIOMA . ', categoría UTILITY; reemplaza a ' . $vieja . ')');
            $this->info(str_repeat('=', 70));
            $this->line($cuerpo);
            $this->line('Botones: [Confirmar] [Cancelar]');

            if ($this->option('dry-run')) {
                $this->warn('  [PRUEBA] No se envió a Meta.');
                continue;
            }

            $respuesta = Http::withToken($token)->timeout(30)->post("https://graph.facebook.com/v21.0/{$waba}/message_templates", [
                'name' => $nombre,
                'language' => self::IDIOMA,
                'category' => 'UTILITY',
                'components' => self::componentes($cuerpo),
            ]);

            if (! $respuesta->successful()) {
                $this->error('  ✗ Meta (' . $respuesta->status() . '): ' . ($respuesta->json('error.error_user_msg') ?: $respuesta->json('error.message') ?: 'error desconocido'));
                continue;
            }

            $this->info('  ✓ Enviada a Meta. id=' . $respuesta->json('id') . ' | estado=' . ($respuesta->json('status') ?? 'PENDING') . ' | categoría=' . ($respuesta->json('category') ?? 'UTILITY'));
        }

        if (! $this->option('dry-run')) {
            $this->newLine();
            $this->line('Meta las revisa (de minutos a unas horas). Consulte el resultado con:');
            $this->line('  php artisan templates:recordatorios-utility --estado');
            $this->line('Las plantillas actuales NO se tocaron: todo sigue igual hasta usar --activar.');
        }

        return self::SUCCESS;
    }

    /** Texto en el estilo de las plantillas UTILITY del hospital; mismos 6 datos y en el mismo orden. */
    public static function cuerpo(string $sede): string
    {
        return "Buen día, SR(A) {{1}}.\n"
            . "Se escribe del HOSPITAL UNIVERSITARIO DEL VALLE EVARISTO GARCIA para informarle los datos de su cita programada:\n"
            . "Fecha: {{2}}\n"
            . "Hora: {{3}}\n"
            . "Médico: {{4}}\n"
            . "Especialidad: {{5}}\n"
            . "Ubicación: {{6}}, {$sede}.\n"
            . "Llegar 40 minutos antes de la consulta para facturar, con documento de identidad, autorización vigente, orden médica e historia clínica.\n"
            . 'Indique con los botones si asistirá o si necesita cancelar la cita.';
    }

    private static function componentes(string $cuerpo): array
    {
        return [
            [
                'type' => 'BODY',
                'text' => $cuerpo,
                'example' => ['body_text' => [[
                    'Juan Pérez García',
                    'lunes 13 de enero de 2026',
                    '10:30 AM',
                    'Carlos Rodríguez López',
                    'Medicina General',
                    'MEDICINA GENERAL - M01',
                ]]],
            ],
            ['type' => 'BUTTONS', 'buttons' => [
                ['type' => 'QUICK_REPLY', 'text' => 'Confirmar'],
                ['type' => 'QUICK_REPLY', 'text' => 'Cancelar'],
            ]],
        ];
    }

    /** @return array<string, array{status:?string, category:?string, id:?string}> */
    private function enMeta(string $token, string $waba): array
    {
        $resultado = [];
        foreach (array_keys(self::PLANTILLAS) as $nombre) {
            $r = Http::withToken($token)->timeout(20)->get("https://graph.facebook.com/v21.0/{$waba}/message_templates", [
                'name' => $nombre,
                'fields' => 'name,status,category,language,id,rejected_reason',
            ]);
            $fila = collect($r->json('data') ?? [])->firstWhere('language', self::IDIOMA);
            $resultado[$nombre] = [
                'status' => $fila['status'] ?? null,
                'category' => $fila['category'] ?? null,
                'id' => $fila['id'] ?? null,
                'rejected_reason' => $fila['rejected_reason'] ?? null,
            ];
        }

        return $resultado;
    }

    private function estado(string $token, string $waba): int
    {
        foreach ($this->enMeta($token, $waba) as $nombre => $e) {
            $this->line(sprintf('%-28s estado=%-10s categoría=%-10s %s', $nombre, $e['status'] ?? '(no existe)', $e['category'] ?? '-', $e['rejected_reason'] && $e['rejected_reason'] !== 'NONE' ? 'motivo: ' . $e['rejected_reason'] : ''));
        }

        return self::SUCCESS;
    }

    private function activar(string $token, string $waba): int
    {
        $meta = $this->enMeta($token, $waba);
        foreach ($meta as $nombre => $e) {
            if ($e['status'] !== 'APPROVED' || $e['category'] !== 'UTILITY') {
                $this->error("{$nombre} todavía no está aprobada como UTILITY (estado={$e['status']}, categoría={$e['category']}). No se cambió nada.");
                return self::FAILURE;
            }
        }

        foreach (self::PLANTILLAS as $nombre => [$vieja, $direccion, $ajuste]) {
            // Envío masivo: la nueva disponible y la vieja oculta (no se borra: --desactivar la vuelve a mostrar).
            WhatsappTemplate::updateOrCreate(
                ['meta_template_name' => $nombre, 'language' => self::IDIOMA],
                [
                    'name' => ucfirst(str_replace('_', ' ', $nombre)),
                    'preview_text' => self::cuerpo($direccion),
                    'category' => 'UTILITY',
                    'status' => 'APPROVED',
                    'meta_template_id' => $meta[$nombre]['id'],
                    'header_format' => null,
                    'header_text' => null,
                    'default_params' => array_fill(0, 6, ''),
                    'is_active' => true,
                ]
            );
            WhatsappTemplate::where('meta_template_name', $vieja)->update(['is_active' => false]);

            // Citas: el servicio de recordatorios usa la nueva.
            Setting::set($ajuste, $nombre, 'Plantilla de recordatorio de cita (UTILITY)');
            $this->info("✓ {$nombre} activa (reemplaza a {$vieja} en Citas y en Envío masivo).");
        }

        // No hace falta reiniciar el worker: la plantilla se lee de settings en cada envío.
        return self::SUCCESS;
    }

    /**
     * Borra de Meta las plantillas viejas de MARKETING. Solo si las nuevas ya están aprobadas como
     * UTILITY y en uso: si no, Citas se quedaría sin plantilla. En la app las filas viejas quedan
     * ocultas (no se borran) para que los envíos pasados sigan mostrando su texto.
     */
    private function eliminarViejas(string $token, string $waba): int
    {
        foreach ($this->enMeta($token, $waba) as $nombre => $e) {
            [, , $ajuste] = self::PLANTILLAS[$nombre];
            if ($e['status'] !== 'APPROVED' || $e['category'] !== 'UTILITY' || Setting::get($ajuste) !== $nombre) {
                $this->error("{$nombre} no está aprobada como UTILITY y activa todavía. No se borró nada.");
                return self::FAILURE;
            }
        }

        foreach (self::PLANTILLAS as [$vieja]) {
            $r = Http::withToken($token)->timeout(20)->get("https://graph.facebook.com/v21.0/{$waba}/message_templates", [
                'name' => $vieja,
                'fields' => 'name,id,language,category',
            ]);
            foreach ($r->json('data') ?? [] as $fila) {
                if (($fila['name'] ?? null) !== $vieja) {
                    continue;
                }
                $borrado = Http::withToken($token)->timeout(20)
                    ->delete("https://graph.facebook.com/v21.0/{$waba}/message_templates?" . http_build_query(['name' => $vieja, 'hsm_id' => $fila['id']]));
                $borrado->json('success') === true
                    ? $this->info("✓ {$vieja} ({$fila['language']}, {$fila['category']}) borrada de Meta.")
                    : $this->error("✗ {$vieja}: Meta respondió " . $borrado->status() . ' ' . ($borrado->json('error.message') ?? ''));
            }
            WhatsappTemplate::where('meta_template_name', $vieja)->update(['is_active' => false]);
        }

        return self::SUCCESS;
    }

    private function desactivar(): int
    {
        foreach (self::PLANTILLAS as $nombre => [$vieja, , $ajuste]) {
            WhatsappTemplate::where('meta_template_name', $nombre)->update(['is_active' => false]);
            WhatsappTemplate::where('meta_template_name', $vieja)->update(['is_active' => true]);
            Setting::set($ajuste, $vieja, 'Plantilla de recordatorio de cita');
            $this->info("✓ De vuelta a {$vieja}.");
        }

        return self::SUCCESS;
    }
}
