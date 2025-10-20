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
     * Lista de configuraciones que siempre deben estar encriptadas
     */
    protected static $encryptedKeys = [
        'whatsapp_token',
        'whatsapp_verify_token',
        'whatsapp_app_secret',
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
     * Obtener una configuración de forma segura
     */
    public static function get(string $key, $default = null)
    {
        return Cache::remember("setting.{$key}", 3600, function () use ($key, $default) {
            $setting = self::where('key', $key)->first();

            if (!$setting || empty($setting->value)) {
                return $default;
            }

            try {
                return $setting->is_encrypted
                    ? decrypt($setting->value)
                    : $setting->value;
            } catch (\Exception $e) {
                Log::error('Error al desencriptar configuración', [
                    'key' => $key,
                    'error' => $e->getMessage(),
                ]);
                return $default;
            }
        });
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
            // Mostrar solo los primeros 8 caracteres
            return substr($value, 0, 8) . str_repeat('*', 12);
        }

        return $value;
    }
}
