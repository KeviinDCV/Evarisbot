<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BulkSend extends Model
{
    /** Envíos masivos que pueden salir a la vez (se turnan los mensajes; ver SendBulkMessageJob::$encadenado). */
    public const MAXIMO_SIMULTANEOS = 5;

    /** Texto de los destinatarios que no se alcanzaron a intentar (los vuelve a encolar masivo:reintentar-vencidos). */
    public const ERROR_VENCIDO = 'No alcanzó a enviarse: venció el plazo del envío masivo (no se intentó).';

    /**
     * Cierra el envío al terminar su lote: lo que quedó pendiente (la cadena se cortó) pasa a vencido y los
     * contadores salen de los destinatarios reales. Un envío detenido conserva su estado.
     */
    public function cerrar(bool $cancelado = false): void
    {
        $this->refresh();
        if (!$cancelado && $this->status !== 'cancelled') {
            $this->recipients()->where('status', 'pending')->update(['status' => 'failed', 'error' => self::ERROR_VENCIDO, 'updated_at' => now()]);
        }
        $this->update([
            'status' => ($cancelado || $this->status === 'cancelled') ? 'cancelled' : 'completed',
            'sent_count' => $this->recipients()->where('status', 'sent')->count(),
            'failed_count' => $this->recipients()->where('status', 'failed')->count(),
        ]);
    }

    protected $fillable = [
        'name',
        'template_name',
        'template_params',
        'template_language',
        'column_mapping',
        'status',
        'total_recipients',
        'sent_count',
        'failed_count',
        'batch_id',
        'created_by',
    ];

    protected $casts = [
        'template_params' => 'array',
        'column_mapping' => 'array',
    ];

    /**
     * Usuario que creó el envío masivo
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Destinatarios del envío masivo
     */
    public function recipients(): HasMany
    {
        return $this->hasMany(BulkSendRecipient::class);
    }

    /**
     * Incrementar contador de enviados atómicamente
     */
    public function incrementSent(): void
    {
        $this->increment('sent_count');
    }

    /**
     * Incrementar contador de fallidos atómicamente
     */
    public function incrementFailed(): void
    {
        $this->increment('failed_count');
    }
}
