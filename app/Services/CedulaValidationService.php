<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * Valida cédulas colombianas y devuelve el nombre de la persona, para el chatbot
 * del chat interno. Soporta dos proveedores (configurable con 'cedula_provider'):
 *
 *   - 'didit'   (POR DEFECTO, GRATIS): Didit Database Validation. 500 validaciones
 *               de cédula GRATIS por mes; valida contra Registraduría/ANI. Ideal para
 *               el piloto sin costo. Header x-api-key (Setting 'didit_api_key' / DIDIT_API_KEY).
 *   - 'verifik' (de pago, ~USD 0.20/consulta): Verifik. Bearer token
 *               (Setting 'verifik_token' / VERIFIK_TOKEN).
 *
 * DISEÑO DEFENSIVO:
 *  - Si el proveedor activo NO tiene credencial, el servicio queda INACTIVO (no-op):
 *    la app y el chatbot funcionan igual que antes. Seguro de desplegar.
 *  - Cualquier fallo de red/respuesta devuelve null y se loguea: nunca rompe el chat.
 *  - Cachea por cédula (12 h) para no re-consultar/re-facturar repetidos.
 *  - Registra MÉTRICAS de uso (sin guardar cédula ni nombre) para reportes.
 *
 * AVISO LEGAL (Ley 1581/2012 - Habeas Data): el uso en producción con datos de
 * pacientes reales exige contrato de Encargado del Tratamiento con el proveedor,
 * aviso de privacidad y finalidad de atención en salud.
 */
class CedulaValidationService
{
    /** Proveedor activo: 'didit' (gratis) o 'verifik' (pago). Default: didit. */
    public function provider(): string
    {
        $p = Setting::get('cedula_provider') ?: env('CEDULA_PROVIDER', 'didit');
        return strtolower(trim((string) $p)) === 'verifik' ? 'verifik' : 'didit';
    }

    public function isConfigured(): bool
    {
        return $this->provider() === 'verifik'
            ? !empty($this->verifikToken())
            : !empty($this->diditApiKey());
    }

    // ── Credenciales / endpoints por proveedor ───────────────────────────────

    private function diditApiKey(): ?string
    {
        $t = Setting::get('didit_api_key') ?: env('DIDIT_API_KEY');
        return $t ? trim((string) $t) : null;
    }

    private function diditBaseUrl(): string
    {
        $url = Setting::get('didit_base_url') ?: env('DIDIT_BASE_URL', 'https://verification.didit.me');
        return rtrim($url, '/');
    }

    private function verifikToken(): ?string
    {
        $t = Setting::get('verifik_token') ?: env('VERIFIK_TOKEN');
        return $t ? trim((string) $t) : null;
    }

    private function verifikBaseUrl(): string
    {
        $url = Setting::get('verifik_base_url') ?: env('VERIFIK_BASE_URL', 'https://api.verifik.co/v2');
        return rtrim($url, '/');
    }

    /**
     * Extrae un número de cédula del texto SOLO cuando es razonablemente seguro,
     * para no consultar por teléfonos, fechas o números de cita:
     *  - el mensaje es básicamente el número (6 a 10 dígitos, admite . , y espacios), o
     *  - viene precedido por "cédula" / "cc" / "documento" / "identificación".
     */
    public function extractCedula(string $text): ?string
    {
        $clean = trim($text);

        if (preg_match('/^[\s.,]*(\d[\d.\s,]{4,13}\d)[\s.,]*$/u', $clean, $m)) {
            $digits = preg_replace('/\D/', '', $m[1]);
            if (strlen($digits) >= 6 && strlen($digits) <= 10) {
                return $digits;
            }
        }

        if (preg_match('/(?:c[ée]dula|c\.?\s?c\.?|documento|identificaci[oó]n)\D{0,10}(\d[\d.\s]{4,13}\d)/iu', $clean, $m)) {
            $digits = preg_replace('/\D/', '', $m[1]);
            if (strlen($digits) >= 6 && strlen($digits) <= 10) {
                return $digits;
            }
        }

        return null;
    }

    /**
     * Consulta el proveedor activo por una cédula.
     *
     * @return array{cedula:string,fullName:string,firstName:?string,lastName:?string,status:?string,provider:string}|null
     */
    public function lookup(string $cedula): ?array
    {
        if (!$this->isConfigured()) {
            return null;
        }

        $cedula = preg_replace('/\D/', '', $cedula);
        if (strlen($cedula) < 6 || strlen($cedula) > 10) {
            return null;
        }

        $provider = $this->provider();

        return Cache::remember("cedula_{$provider}_{$cedula}", now()->addHours(12), function () use ($cedula, $provider) {
            try {
                return $provider === 'verifik'
                    ? $this->lookupVerifik($cedula)
                    : $this->lookupDidit($cedula);
            } catch (\Throwable $e) {
                Log::error('CedulaValidation: error de consulta', [
                    'provider' => $provider,
                    'cedula'   => $cedula,
                    'error'    => $e->getMessage(),
                ]);
                return null;
            }
        });
    }

    /** Didit Database Validation (gratis 500/mes). */
    private function lookupDidit(string $cedula): ?array
    {
        $response = Http::withHeaders(['x-api-key' => $this->diditApiKey()])
            ->acceptJson()
            ->connectTimeout(5)
            ->timeout(25)
            ->asMultipart()
            ->post($this->diditBaseUrl() . '/v3/database-validation/', [
                ['name' => 'issuing_state',   'contents' => 'COL'],
                ['name' => 'services',        'contents' => 'col_cedula'],
                ['name' => 'personal_number', 'contents' => $cedula],
            ]);

        if (!$response->successful()) {
            Log::warning('Didit: respuesta no exitosa', [
                'status' => $response->status(),
                'cedula' => $cedula,
                'body'   => mb_substr($response->body(), 0, 500),
            ]);
            return null;
        }

        $json = $response->json() ?? [];
        // La respuesta puede traer source_data al tope o anidado bajo el servicio (col_cedula).
        $src = $json['source_data']
            ?? ($json['col_cedula']['source_data'] ?? null)
            ?? $this->findKeyDeep($json, 'source_data');

        $matchType = $json['match_type']
            ?? ($json['col_cedula']['match_type'] ?? null)
            ?? $this->findKeyDeep($json, 'match_type');

        if (!is_array($src)) {
            return null;
        }

        $firstName = $src['first_name'] ?? $src['firstName'] ?? null;
        $lastName  = $src['last_name'] ?? $src['lastName'] ?? null;
        $fullName  = $src['full_name'] ?? $src['fullName'] ?? trim(($firstName ?? '') . ' ' . ($lastName ?? ''));

        if (trim((string) $fullName) === '') {
            return null;
        }

        return [
            'cedula'    => $cedula,
            'fullName'  => trim((string) $fullName),
            'firstName' => $firstName ? trim((string) $firstName) : null,
            'lastName'  => $lastName ? trim((string) $lastName) : null,
            'status'    => is_string($matchType) ? $matchType : null,
            'provider'  => 'didit',
        ];
    }

    /** Verifik (de pago). */
    private function lookupVerifik(string $cedula): ?array
    {
        $response = Http::withToken($this->verifikToken())
            ->acceptJson()
            ->connectTimeout(5)
            ->timeout(20)
            ->get($this->verifikBaseUrl() . '/co/cedula', [
                'documentType'   => 'CC',
                'documentNumber' => $cedula,
            ]);

        if (!$response->successful()) {
            Log::warning('Verifik: respuesta no exitosa', [
                'status' => $response->status(),
                'cedula' => $cedula,
                'body'   => mb_substr($response->body(), 0, 500),
            ]);
            return null;
        }

        $data = $response->json('data');
        if (!is_array($data)) {
            $data = $response->json();
        }
        if (!is_array($data)) {
            return null;
        }

        $firstName = $data['firstName'] ?? null;
        $lastName  = $data['lastName'] ?? null;
        $fullName  = $data['fullName'] ?? trim(($firstName ?? '') . ' ' . ($lastName ?? ''));
        $status    = $data['status'] ?? $data['estado'] ?? null;

        if (trim((string) $fullName) === '') {
            return null;
        }

        return [
            'cedula'    => $cedula,
            'fullName'  => trim((string) $fullName),
            'firstName' => $firstName ? trim((string) $firstName) : null,
            'lastName'  => $lastName ? trim((string) $lastName) : null,
            'status'    => $status ? trim((string) $status) : null,
            'provider'  => 'verifik',
        ];
    }

    /**
     * Detecta una cédula en un texto libre, la valida y registra la métrica de uso.
     * No-op si el servicio no está configurado o no hay cédula en el texto.
     *
     * @param  array{user_id?:int|null,internal_chat_id?:int|null}  $context
     */
    public function detectAndValidate(?string $text, array $context = []): ?array
    {
        if (!$this->isConfigured() || !$text) {
            return null;
        }

        $cedula = $this->extractCedula($text);
        if (!$cedula) {
            return null;
        }

        $result = $this->lookup($cedula);
        $this->logUsage($result ? 'found' : 'not_found', $context);

        return $result;
    }

    /** Busca recursivamente la primera ocurrencia de una clave en un arreglo anidado. */
    private function findKeyDeep(array $data, string $key)
    {
        if (array_key_exists($key, $data)) {
            return $data[$key];
        }
        foreach ($data as $v) {
            if (is_array($v)) {
                $found = $this->findKeyDeep($v, $key);
                if ($found !== null) {
                    return $found;
                }
            }
        }
        return null;
    }

    /** Registra una métrica de uso (SIN cédula ni nombre) para reportes. */
    private function logUsage(string $outcome, array $context): void
    {
        try {
            if (!Schema::hasTable('cedula_validation_logs')) {
                return;
            }
            DB::table('cedula_validation_logs')->insert([
                'user_id'          => $context['user_id'] ?? null,
                'internal_chat_id' => $context['internal_chat_id'] ?? null,
                'provider'         => $this->provider(),
                'outcome'          => $outcome,
                'created_at'       => now(),
            ]);
        } catch (\Throwable $e) {
            Log::warning('CedulaValidation: no se pudo registrar la métrica', ['error' => $e->getMessage()]);
        }
    }
}
