<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class Setting extends Model
{
    protected $fillable = [
        'key',
        'value',
        'is_encrypted',
        'description',
        'updated_by',
    ];

    protected $casts = [
        'is_encrypted' => 'boolean',
    ];

    /**
     * Lista de configuraciones que siempre deben estar encriptadas.
     * Estar aquí también hace que getPreview() la enmascare: sin groq_api_key en la lista, la
     * pantalla de Configuración recibía la API key ENTERA en las props de la página.
     * Una key guardada antes de este cambio sigue en claro (su fila tiene is_encrypted = false y
     * get() la lee según esa marca); se cifra la próxima vez que se guarde desde Configuración.
     */
    protected static $encryptedKeys = [
        'whatsapp_token',
        'whatsapp_verify_token',
        'whatsapp_app_secret',
        'groq_api_key',
    ];

    /**
     * Claves que solo se cambian desde la consola del servidor (php artisan whatsapp:guardar-token,
     * whatsapp:firma…). Con una sesión de administrador robada se podía poner el token y el número
     * de una cuenta ajena y desviar los mensajes de los pacientes.
     */
    protected static $serverOnlyKeys = [
        'whatsapp_token',
        'whatsapp_verify_token',
        'whatsapp_app_secret',
        'whatsapp_phone_id',
        'whatsapp_phone_number_id',
        'whatsapp_business_account_id',
        'groq_api_key',
    ];

    /**
     * Relación con el usuario que actualizó la configuración
     */
    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * Guardar una configuración de forma segura
     */
    public static function set(string $key, $value, ?string $description = null): self
    {
        if (in_array($key, self::$serverOnlyKeys, true) && !app()->runningInConsole()) {
            throw new \RuntimeException("La configuración {$key} solo se cambia desde la consola del servidor.");
        }

        $shouldEncrypt = in_array($key, self::$encryptedKeys);

        if ($shouldEncrypt && !empty($value)) {
            $value = encrypt($value);
        }

        $setting = self::updateOrCreate(
            ['key' => $key],
            [
                'value' => $value,
                'is_encrypted' => $shouldEncrypt,
                'description' => $description,
                'updated_by' => auth()->id(),
            ]
        );

        // Limpiar caché
        Cache::forget("setting.{$key}");

        // Log de auditoría
        Log::channel('single')->info('Configuración actualizada', [
            'key' => $key,
            'user_id' => auth()->id(),
            'user_email' => auth()->user()?->email,
            'ip' => request()->ip(),
        ]);

        return $setting;
    }

    /**
     * Obtener una configuración de forma segura.
     *
     * En la caché (que es la tabla `cache` de la base) se guarda la fila TAL COMO está en la base:
     * cifrada si es un secreto. Antes se guardaba ya descifrada y el token de Meta y la clave de Groq
     * quedaban en claro en esa tabla, al alcance de cualquiera que leyera la base o una copia.
     * La clave de caché sigue siendo "setting.{key}" porque otras partes la borran con ese nombre.
     */
    public static function get(string $key, $default = null)
    {
        $cached = Cache::remember("setting.{$key}", 3600, function () use ($key) {
            $setting = self::where('key', $key)->first();

            return [
                '__setting' => 1,
                'v' => $setting?->value,
                'e' => (bool) $setting?->is_encrypted,
            ];
        });

        // Entrada guardada por la versión anterior (valor ya resuelto): se respeta hasta que caduque.
        if (!is_array($cached) || !isset($cached['__setting'])) {
            return $cached ?? $default;
        }

        if ($cached['v'] === null || $cached['v'] === '') {
            return $default;
        }

        if (!$cached['e']) {
            return $cached['v'];
        }

        try {
            return decrypt($cached['v']);
        } catch (\Exception $e) {
            Log::error('Error al desencriptar configuración', [
                'key' => $key,
                'error' => $e->getMessage(),
            ]);
            return $default;
        }
    }

    /**
     * Verificar si una configuración existe
     */
    public static function has(string $key): bool
    {
        return self::where('key', $key)->exists();
    }

    /**
     * Eliminar una configuración
     */
    public static function remove(string $key): bool
    {
        Cache::forget("setting.{$key}");
        
        Log::channel('single')->warning('Configuración eliminada', [
            'key' => $key,
            'user_id' => auth()->id(),
            'user_email' => auth()->user()?->email,
        ]);

        return self::where('key', $key)->delete();
    }

    /**
     * Obtener vista parcialmente oculta del valor (para mostrar en frontend)
     */
    public static function getPreview(string $key): ?string
    {
        $value = self::get($key);

        if (empty($value)) {
            return null;
        }

        if (in_array($key, self::$encryptedKeys)) {
            // Ningún carácter del secreto sale hacia la pantalla: solo que está guardado.
            return str_repeat('*', 12);
        }

        return $value;
    }
}
