<?php

namespace App\Console\Commands;

use App\Models\Setting;
use App\Services\CedulaValidationService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

/**
 * Prueba la validación de una cédula sin pasar por el chatbot.
 *
 *   php artisan cedula:test 1234567890
 *   php artisan cedula:test 1234567890 --provider=didit --key=TU_API_KEY_DE_DIDIT
 *   php artisan cedula:test 1234567890 --provider=verifik --key=TU_TOKEN_DE_VERIFIK
 *   php artisan cedula:test 1234567890 --raw     (muestra la respuesta cruda del proveedor)
 */
class TestCedula extends Command
{
    protected $signature = 'cedula:test {cedula : Número de cédula a validar}
        {--provider= : didit (gratis) o verifik (pago); por defecto el configurado}
        {--key= : Guarda la credencial del proveedor elegido en Settings}
        {--raw : Muestra la respuesta cruda del proveedor (para depurar)}';

    protected $description = 'Prueba la validación de una cédula (Didit gratis / Verifik)';

    public function handle(CedulaValidationService $svc): int
    {
        if ($provider = $this->option('provider')) {
            $provider = strtolower($provider) === 'verifik' ? 'verifik' : 'didit';
            Setting::set('cedula_provider', $provider, 'Proveedor de validación de cédulas');
            $this->info("Proveedor fijado en Settings: {$provider}");
        }

        if ($key = $this->option('key')) {
            $settingKey = $svc->provider() === 'verifik' ? 'verifik_token' : 'didit_api_key';
            Setting::set($settingKey, $key, 'Credencial de validación de cédulas');
            $this->info("Credencial guardada en Settings ({$settingKey}).");
        }

        if (!$svc->isConfigured()) {
            $this->error('Proveedor "' . $svc->provider() . '" sin credencial. Usa --key=... o define la variable en .env/Settings.');
            return self::FAILURE;
        }

        $cedula = preg_replace('/\D/', '', (string) $this->argument('cedula'));
        $this->line("Proveedor: <info>{$svc->provider()}</info> · Consultando cédula <info>{$cedula}</info> ...");

        $result = $svc->lookup($cedula);

        if (!$result) {
            $this->error('No se pudo validar (no encontrada, no vigente, credencial inválida o error de red).');
            $this->line('Detalle del error en storage/logs/laravel.log. Vuelve a correr con --raw para ver la respuesta cruda.');
            if ($this->option('raw')) {
                $this->dumpRaw($svc, $cedula);
            }
            return self::FAILURE;
        }

        $this->info('✓ Cédula validada:');
        $this->table(
            ['Campo', 'Valor'],
            collect($result)->map(fn ($v, $k) => [$k, is_scalar($v) ? (string) $v : json_encode($v)])->values()->all()
        );

        if ($this->option('raw')) {
            $this->dumpRaw($svc, $cedula);
        }

        return self::SUCCESS;
    }

    /** Llama directamente al proveedor y vuelca la respuesta cruda (para afinar el parseo). */
    private function dumpRaw(CedulaValidationService $svc, string $cedula): void
    {
        $this->newLine();
        $this->comment('── Respuesta cruda del proveedor ──');
        try {
            if ($svc->provider() === 'verifik') {
                $r = Http::withToken(Setting::get('verifik_token') ?: env('VERIFIK_TOKEN'))
                    ->acceptJson()
                    ->get((Setting::get('verifik_base_url') ?: env('VERIFIK_BASE_URL', 'https://api.verifik.co/v2')) . '/co/cedula', [
                        'documentType' => 'CC', 'documentNumber' => $cedula,
                    ]);
            } else {
                $r = Http::withHeaders(['x-api-key' => Setting::get('didit_api_key') ?: env('DIDIT_API_KEY')])
                    ->acceptJson()
                    ->asMultipart()
                    ->post((Setting::get('didit_base_url') ?: env('DIDIT_BASE_URL', 'https://verification.didit.me')) . '/v3/database-validation/', [
                        ['name' => 'issuing_state', 'contents' => 'COL'],
                        ['name' => 'services', 'contents' => 'col_cedula'],
                        ['name' => 'personal_number', 'contents' => $cedula],
                    ]);
            }
            $this->line('HTTP ' . $r->status());
            $this->line(json_encode($r->json(), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) ?: $r->body());
        } catch (\Throwable $e) {
            $this->error('Error en la llamada cruda: ' . $e->getMessage());
        }
    }
}
