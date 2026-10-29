<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Anuncio de lectura obligatoria (un mensaje del chat interno que un administrador anunció a todos). A cada
 * administrador y asesor le sale en una ventana sobre cualquier pantalla (components/anuncio-obligatorio.tsx) que solo
 * se puede cerrar tras SEGUNDOS_LECTURA con la pantalla a la vista; al cerrarla queda en anuncio_lecturas.
 */
class Anuncio extends Model
{
    /** Días que se le sigue mostrando a quien no lo ha leído (vacaciones, turnos): después ya no tiene sentido. */
    public const DIAS_VIGENCIA = 7;

    /** Segundos a la vista antes de poder cerrarlo (los cuenta la pantalla, solo con la ventana al frente). */
    public const SEGUNDOS_LECTURA = 30;

    /** Quiénes deben leerlo: las personas, no el usuario de la IA. */
    public const ROLES = ['admin', 'advisor'];

    protected $fillable = ['user_id', 'internal_message_id', 'cuerpo', 'vence_en', 'retirado_en'];

    protected $casts = [
        'vence_en' => 'datetime',
        'retirado_en' => 'datetime',
    ];

    public function autor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function mensaje(): BelongsTo
    {
        return $this->belongsTo(InternalMessage::class, 'internal_message_id');
    }

    public function scopeVigentes(Builder $query): void
    {
        $query->whereNull('retirado_en')->where(fn ($q) => $q->whereNull('vence_en')->orWhere('vence_en', '>', now()));
    }

    public function vigente(): bool
    {
        return $this->retirado_en === null && ($this->vence_en === null || $this->vence_en->isFuture());
    }

    /** Ids que no tienen que leerlo: quien lo anunció y quien escribió el mensaje. */
    public function excluidos(): array
    {
        return array_values(array_unique(array_filter([(int) $this->user_id, (int) ($this->mensaje?->user_id ?? 0)])));
    }

    /** Quiénes deben leerlo: administradores y asesores que ya existían cuando se anunció, menos los excluidos. */
    public function destinatarios(): Builder
    {
        return User::query()
            ->whereIn('role', self::ROLES)
            ->whereNotIn('id', $this->excluidos())
            ->where(fn ($q) => $q->whereNull('created_at')->orWhere('created_at', '<=', $this->created_at));
    }

    /** Ids de quienes ya lo leyeron. */
    public function leidoPor(): array
    {
        return DB::table('anuncio_lecturas')->where('anuncio_id', $this->id)->pluck('user_id')->map(fn ($id) => (int) $id)->all();
    }

    /** Los que le faltan por leer a esta persona, del más viejo al más nuevo (como mucho 5 a la vez). */
    public static function pendientesPara(User $user): Collection
    {
        if (!in_array($user->role, self::ROLES, true)) {
            return collect();
        }

        return static::vigentes()
            ->with(['autor:id,name', 'mensaje:id,user_id'])
            ->where('user_id', '!=', $user->id)
            ->when($user->created_at, fn ($q) => $q->where('created_at', '>=', $user->created_at))
            ->whereNotExists(fn ($q) => $q->selectRaw('1')->from('anuncio_lecturas')
                ->whereColumn('anuncio_lecturas.anuncio_id', 'anuncios.id')
                ->where('anuncio_lecturas.user_id', $user->id))
            ->orderBy('id')
            ->limit(5)
            ->get()
            ->reject(fn (self $a) => in_array((int) $user->id, $a->excluidos(), true))
            ->values();
    }
}
