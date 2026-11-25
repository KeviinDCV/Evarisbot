<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Permiso de un número para recordatorios de cita por llamada (ver la migración create_permisos_llamada_table). Filas
 * solo se AGREGAN: vale la más reciente de cada número.
 */
class PermisoLlamada extends Model
{
    protected $table = 'permisos_llamada';

    protected $fillable = ['telefono', 'acepta', 'canal', 'user_id', 'conversation_id', 'nota'];

    protected $casts = ['acepta' => 'boolean'];

    /** No volver a preguntar antes de esto (si no respondió o dijo que no). */
    public const DIAS_ENTRE_PREGUNTAS = 60;

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public static function digitos(?string $telefono): string
    {
        return preg_replace('/\D/', '', (string) $telefono);
    }

    /** La fila vigente de un número (con o sin respuesta), o null si nunca se le preguntó. */
    public static function ultimo(?string $telefono): ?self
    {
        $t = self::digitos($telefono);

        return $t === '' ? null : self::where('telefono', $t)->latest('id')->first();
    }

    /** Lo que vale hoy: true (aceptó), false (no / lo quitó) o null (no ha respondido o nunca se le preguntó). */
    public static function vigente(?string $telefono): ?bool
    {
        $t = self::digitos($telefono);
        if ($t === '') {
            return null;
        }
        // La última respuesta real (las filas «pregunta» no cambian lo que dijo antes).
        $fila = self::where('telefono', $t)->whereNotNull('acepta')->latest('id')->first();

        return $fila?->acepta;
    }

    public static function acepta(?string $telefono): bool
    {
        return self::vigente($telefono) === true;
    }

    /** ¿Se le puede hacer la pregunta? Nunca a quien ya respondió; y no más de una vez cada DIAS_ENTRE_PREGUNTAS. */
    public static function sePuedePreguntar(?string $telefono): bool
    {
        $t = self::digitos($telefono);
        if ($t === '' || self::vigente($t) !== null) {
            return false;
        }

        return ! self::where('telefono', $t)->where('canal', 'pregunta')->where('created_at', '>=', now()->subDays(self::DIAS_ENTRE_PREGUNTAS))->exists();
    }

    public static function registrar(?string $telefono, ?bool $acepta, string $canal, ?int $userId = null, ?int $conversationId = null, ?string $nota = null): ?self
    {
        $t = self::digitos($telefono);
        if ($t === '') {
            return null;
        }

        return self::create(['telefono' => $t, 'acepta' => $acepta, 'canal' => $canal, 'user_id' => $userId, 'conversation_id' => $conversationId, 'nota' => $nota !== null ? mb_substr($nota, 0, 255) : null]);
    }
}
