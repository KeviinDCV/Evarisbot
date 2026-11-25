<?php

namespace App\Console\Commands;

use App\Models\Setting;
use App\Models\WhatsappTemplate;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

/**
 * Saludo general para abrir conversaciones como plantilla de SERVICIO (UTILITY).
 *
 * «NUEVA CONVERSACION v2» (nueva_conversacion_v2) es MARKETING: con la calidad del número en RED, Meta la frena
 * con el error 131049 a quien ya alcanzó su tope de marketing o nunca le escribió al hospital. Las anteriores
 * nueva_conversacion y saludo_asesor eran UTILITY y Meta las pasó a MARKETING. saludo_asesor_v2 sigue como UTILITY:
 * este texto sigue su estilo (en respuesta a una solicitud, pide responder para continuar, botón «Continuar»),
 * pero sin cita ni asesor, para los casos que no son de citas. Texto aprobado por el usuario el 19/10/2026.
 *
 * NO toca nueva_conversacion_v2 ni ninguna otra plantilla.
 *
 *   php artisan templates:saludo-utility --dry-run   muestra lo que se enviaría (no llama a Meta)
 *   php artisan templates:saludo-utility             la crea en Meta (Meta la revisa: minutos a horas)
 *   php artisan templates:saludo-utility --estado    consulta en Meta su estado y categoría
 *   php artisan templates:saludo-utility --activar   solo si Meta la aprobó como UTILITY: aparece en la app
 *   php artisan templates:saludo-utility --eliminar-vieja  con la nueva aprobada y activa: borra de Meta
 *                                                          nueva_conversacion_v2 (pedido del usuario el 19/10/2026,
 *                                                          para que no se confundan); en la app queda oculta, no se borra,
 *                                                          para que los mensajes enviados con ella sigan en el historial
 *   php artisan templates:saludo-utility --eliminar-v1  borra de Meta nueva_conversacion (v1), oculta y sin uso
 *   php artisan templates:saludo-utility --desactivar  la oculta en la app
 */
class CrearSaludoUtility extends Command
{
    protected $signature = 'templates:saludo-utility
        {--dry-run : Muestra la plantilla sin enviarla a Meta}
        {--estado : Consulta en Meta el estado y la categoría}
        {--activar : Mostrarla en la app (solo si Meta la aprobó como UTILITY)}
        {--eliminar-vieja : Con la nueva aprobada y activa, borrar de Meta nueva_conversacion_v2 (en la app queda oculta)}
        {--eliminar-v1 : Borrar de Meta nueva_conversacion (v1, oculta en la app y sin uso)}
        {--desactivar : Ocultarla en la app}';

    /** La de MARKETING que reemplaza (Meta la frena con el 131049). */
    public const VIEJA = 'nueva_conversacion_v2';

    /** La primera versión (MARKETING), oculta en la app desde el 30/07/2026. */
    public const V1 = 'nueva_conversacion';

    protected $description = 'Crea el saludo general para abrir conversaciones como plantilla UTILITY, sin tocar las actuales';

    public const NOMBRE = 'saludo_por_solicitud';

    private const IDIOMA = 'es_CO';

    /** Nombre con el que aparece en la lista de plantillas de la app. */
    private const NOMBRE_EN_APP = 'Saludo general (servicio)';

    public static function cuerpo(): string
    {
        return "Buen día.\n"
            . "Le saludamos del Hospital Universitario del Valle Evaristo García en respuesta a su solicitud.\n\n"
            . '*Responda a este mensaje para que un asesor pueda continuar con su atención por este medio.* '
            . 'Mientras no responda, no podremos escribirle nuevamente por WhatsApp.';
    }

    private static function componentes(): array
    {
        return [
            ['type' => 'BODY', 'text' => self::cuerpo()],
            ['type' => 'BUTTONS', 'buttons' => [
                ['type' => 'QUICK_REPLY', 'text' => 'Continuar'],
            ]],
        ];
    }

    public function handle(): int
    {
        $token = (string) Setting::get('whatsapp_token');
        $waba = Setting::get('whatsapp_business_account_id');

        if (! $this->option('dry-run') && ($token === '' || ! $waba)) {
            $this->error('Falta la clave de acceso o el ID de la cuenta de WhatsApp Business en el servidor.');
            return self::FAILURE;
        }

        if ($this->option('estado')) {
            $e = $this->enMeta($token, $waba);
            $this->line(sprintf('%-22s estado=%-10s categoría=%-10s %s', self::NOMBRE, $e['status'] ?? '(no existe)', $e['category'] ?? '-',
                $e['rejected_reason'] && $e['rejected_reason'] !== 'NONE' ? 'motivo: ' . $e['rejected_reason'] : ''));
            return self::SUCCESS;
        }
        if ($this->option('activar')) {
            return $this->activar($token, $waba);
        }
        if ($this->option('eliminar-vieja')) {
            return $this->eliminarVieja($token, $waba);
        }
        if ($this->option('eliminar-v1')) {
            return $this->eliminarV1($token, $waba);
        }
        if ($this->option('desactivar')) {
            WhatsappTemplate::where('meta_template_name', self::NOMBRE)->update(['is_active' => false]);
            $this->info('✓ ' . self::NOMBRE . ' oculta en la app.');
            return self::SUCCESS;
        }

        $this->info(str_repeat('=', 70));
        $this->info('PLANTILLA: ' . self::NOMBRE . '  (idioma ' . self::IDIOMA . ', categoría UTILITY)');
        $this->info(str_repeat('=', 70));
        $this->line(self::cuerpo());
        $this->line('Botón: [Continuar]');

        if ($this->option('dry-run')) {
            $this->warn('  [PRUEBA] No se envió a Meta.');
            return self::SUCCESS;
        }

        if (($this->enMeta($token, $waba)['status'] ?? null) !== null) {
            $this->warn('  Ya existe en Meta: no se vuelve a enviar. Consulte con --estado.');
            return self::SUCCESS;
        }

        $respuesta = Http::withToken($token)->timeout(30)->post("https://graph.facebook.com/v21.0/{$waba}/message_templates", [
            'name' => self::NOMBRE,
            'language' => self::IDIOMA,
            'category' => 'UTILITY',
            'components' => self::componentes(),
        ]);

        if (! $respuesta->successful()) {
            $this->error('  ✗ Meta (' . $respuesta->status() . '): ' . ($respuesta->json('error.error_user_msg') ?: $respuesta->json('error.message') ?: 'error desconocido'));
            return self::FAILURE;
        }

        $this->info('  ✓ Enviada a Meta. id=' . $respuesta->json('id') . ' | estado=' . ($respuesta->json('status') ?? 'PENDING') . ' | categoría=' . ($respuesta->json('category') ?? 'UTILITY'));
        $this->line('Meta la revisa (de minutos a unas horas). Consulte con: php artisan templates:saludo-utility --estado');

        return self::SUCCESS;
    }

    /** @return array{status:?string, category:?string, id:?string, rejected_reason:?string} */
    private function enMeta(string $token, string $waba): array
    {
        $r = Http::withToken($token)->timeout(20)->get("https://graph.facebook.com/v21.0/{$waba}/message_templates", [
            'name' => self::NOMBRE,
            'fields' => 'name,status,category,language,id,rejected_reason',
        ]);
        $fila = collect($r->json('data') ?? [])->first(fn ($f) => ($f['name'] ?? null) === self::NOMBRE && ($f['language'] ?? null) === self::IDIOMA);

        return [
            'status' => $fila['status'] ?? null,
            'category' => $fila['category'] ?? null,
            'id' => $fila['id'] ?? null,
            'rejected_reason' => $fila['rejected_reason'] ?? null,
        ];
    }

    private function activar(string $token, string $waba): int
    {
        $e = $this->enMeta($token, $waba);
        if ($e['status'] !== 'APPROVED' || $e['category'] !== 'UTILITY') {
            $this->error(self::NOMBRE . " no está aprobada como UTILITY (estado={$e['status']}, categoría={$e['category']}). No se cambió nada.");
            return self::FAILURE;
        }

        WhatsappTemplate::updateOrCreate(
            ['meta_template_name' => self::NOMBRE, 'language' => self::IDIOMA],
            [
                'name' => self::NOMBRE_EN_APP,
                'preview_text' => self::cuerpo(),
                'category' => 'UTILITY',
                'status' => 'APPROVED',
                'meta_template_id' => $e['id'],
                'header_format' => null,
                'header_text' => null,
                'footer_text' => null,
                'default_params' => null,
                'is_active' => true,
            ]
        );
        $this->info('✓ ' . self::NOMBRE . ' activa: aparece en la app como «' . self::NOMBRE_EN_APP . '».');

        return self::SUCCESS;
    }

    /**
     * Borra de Meta la vieja de MARKETING. Solo si la nueva ya está aprobada como UTILITY y activa en la app (si no,
     * quedarían sin saludo para abrir conversaciones) y si ningún envío masivo pendiente o en curso la usa. En la app
     * la fila vieja queda oculta, no se borra: los mensajes enviados con ella siguen mostrando su texto.
     */
    private function eliminarVieja(string $token, string $waba): int
    {
        $e = $this->enMeta($token, $waba);
        $activa = WhatsappTemplate::where('meta_template_name', self::NOMBRE)->where('is_active', true)->exists();
        if ($e['status'] !== 'APPROVED' || $e['category'] !== 'UTILITY' || ! $activa) {
            $this->error(self::NOMBRE . " no está aprobada como UTILITY y activa todavía (estado={$e['status']}, categoría={$e['category']}, activa=" . ($activa ? 'sí' : 'no') . '). No se borró nada.');
            return self::FAILURE;
        }

        $enUso = \App\Models\BulkSend::where('template_name', self::VIEJA)->whereIn('status', ['pending', 'processing'])->count();
        if ($enUso > 0) {
            $this->error("Hay {$enUso} envío(s) masivo(s) pendientes o en curso con " . self::VIEJA . '. No se borró nada; vuelva a intentarlo cuando terminen.');
            return self::FAILURE;
        }

        return $this->borrarDeMeta($token, $waba, self::VIEJA) ? self::SUCCESS : self::FAILURE;
    }

    /**
     * Borra de Meta la v1 (nueva_conversacion, MARKETING), pedido del usuario el 19/10/2026. No depende de la nueva:
     * en la app está oculta desde el 30/07/2026 y nadie la envía. Se niega si está activa en la app, si la usa un envío
     * masivo pendiente o en curso, o si un ajuste la menciona.
     */
    private function eliminarV1(string $token, string $waba): int
    {
        if (WhatsappTemplate::where('meta_template_name', self::V1)->where('is_active', true)->exists()) {
            $this->error(self::V1 . ' está activa en la app. No se borró nada.');
            return self::FAILURE;
        }
        if (\App\Models\BulkSend::where('template_name', self::V1)->whereIn('status', ['pending', 'processing'])->exists()) {
            $this->error('Un envío masivo pendiente o en curso usa ' . self::V1 . '. No se borró nada.');
            return self::FAILURE;
        }
        if (\Illuminate\Support\Facades\DB::table('settings')->where('value', self::V1)->exists()) {
            $this->error('Un ajuste usa ' . self::V1 . '. No se borró nada.');
            return self::FAILURE;
        }

        return $this->borrarDeMeta($token, $waba, self::V1) ? self::SUCCESS : self::FAILURE;
    }

    /**
     * Oculta la plantilla en la app (no borra la fila: los mensajes enviados con ella siguen en el historial) y la borra
     * de Meta, en todos sus idiomas, por nombre e id.
     */
    private function borrarDeMeta(string $token, string $waba, string $nombre): bool
    {
        // Primero se oculta en la app: así nadie la elige mientras se borra en Meta.
        WhatsappTemplate::where('meta_template_name', $nombre)->update(['is_active' => false]);

        $r = Http::withToken($token)->timeout(20)->get("https://graph.facebook.com/v21.0/{$waba}/message_templates", [
            'name' => $nombre,
            'fields' => 'name,id,language,category',
        ]);
        $filas = array_values(array_filter($r->json('data') ?? [], fn ($f) => ($f['name'] ?? null) === $nombre));
        if (! $filas) {
            $this->warn("{$nombre} ya no existe en Meta. En la app quedó oculta.");
            return true;
        }

        $ok = true;
        foreach ($filas as $fila) {
            $borrado = Http::withToken($token)->timeout(20)
                ->delete("https://graph.facebook.com/v21.0/{$waba}/message_templates?" . http_build_query(['name' => $nombre, 'hsm_id' => $fila['id']]));
            if ($borrado->json('success') === true) {
                $this->info("✓ {$nombre} ({$fila['language']}, {$fila['category']}) borrada de Meta. En la app queda oculta para el historial.");
            } else {
                $ok = false;
                $this->error("✗ {$nombre}: Meta respondió " . $borrado->status() . ' ' . ($borrado->json('error.message') ?? ''));
            }
        }

        return $ok;
    }
}
