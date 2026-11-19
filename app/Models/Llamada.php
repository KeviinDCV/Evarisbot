<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Una llamada de WhatsApp (ver App\Services\LlamadasWhatsApp).
 */
class Llamada extends Model
{
    protected $table = 'llamadas';

    protected $fillable = [
        'conversation_id', 'wa_call_id', 'direccion', 'estado', 'telefono', 'iniciada_en', 'sdp_oferta', 'atendida_por',
        'contestada_en', 'terminada_en', 'duracion', 'fin_meta', 'motivo',
        'buzon_message_id', 'buzon_resuelto_por', 'buzon_resuelto_en',
    ];

    protected $casts = [
        'iniciada_en' => 'datetime',
        'contestada_en' => 'datetime',
        'terminada_en' => 'datetime',
        'buzon_resuelto_en' => 'datetime',
        'duracion' => 'integer',
    ];

    protected $hidden = ['sdp_oferta'];

    /** Estados en los que la llamada todavía está viva. */
    public const VIVAS = ['timbrando', 'conectando', 'en_curso'];

    /** Motivos de una llamada atendida que se cortó (Meta la dio por fallida, red del navegador, pestaña cerrada). */
    public const CORTADA = ['cortada', 'red', 'pestana'];

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    public function atendidaPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'atendida_por');
    }

    public function buzonMensaje(): BelongsTo
    {
        return $this->belongsTo(Message::class, 'buzon_message_id');
    }

    public function resueltoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'buzon_resuelto_por');
    }

    /** Hora en que el paciente llamó (la de Meta si llegó; si no, la de registro). */
    public function inicio(): ?\Illuminate\Support\Carbon
    {
        return $this->iniciada_en ?? $this->created_at;
    }

    /**
     * Cómo terminó, para mostrar: timbrando, en_curso, atendida, cortada, buzon (dejó mensaje), fuera_horario, perdida,
     * fallida. «buzon» manda sobre perdida/fuera de horario: lo que importa es que dejó un mensaje que hay que revisar.
     */
    public function resultado(): string
    {
        // Si se perdió el aviso de fin, la llamada no se queda «timbrando» o «en curso» para siempre en el historial.
        $vieja = fn (string $campo, int $minutos) => $this->{$campo} && $this->{$campo}->lt(now()->subMinutes($minutos));

        return match (true) {
            $this->estado === 'timbrando' && ! $vieja('created_at', 3) => 'timbrando',
            in_array($this->estado, ['conectando', 'en_curso'], true) && ! $vieja('updated_at', 180) => 'en_curso',
            in_array($this->estado, ['conectando', 'en_curso'], true) => 'cortada',
            $this->estado === 'terminada' && in_array($this->motivo, self::CORTADA, true) => 'cortada',
            $this->estado === 'terminada' => 'atendida',
            $this->buzon_message_id !== null => 'buzon',
            $this->estado === 'rechazada' && $this->motivo === 'fuera_de_horario' => 'fuera_horario',
            $this->estado === 'fallida' => 'fallida',
            default => 'perdida',
        };
    }

    /** Segundos que el paciente esperó: hasta que lo atendieron o hasta que terminó (null si sigue timbrando). */
    public function espera(): ?int
    {
        $inicio = $this->inicio();
        $fin = $this->contestada_en ?? $this->terminada_en;
        if (! $inicio || ! $fin) {
            return null;
        }

        return max(0, (int) round($fin->getTimestamp() - $inicio->getTimestamp()));
    }
}
