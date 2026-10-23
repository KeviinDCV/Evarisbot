<?php

namespace App\Models;

use App\Support\Recordatorios;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\DB;

class Appointment extends Model
{
    protected $fillable = [
        'service',
        'citead', 'cianom', 'citmed', 'mednom', 'citesp', 'espnom',
        'citfc', 'cithor', 'citdoc', 'nom_paciente', 'pactel', 'pactel2', 'pacnac',
        'pachis', 'cittid', 'citide', 'citres', 'cittip', 'nom_cotizante',
        'citcon', 'connom', 'citurg', 'citobsobs', 'duracion', 'ageperdes_g', 'dia',
        'uploaded_by', 'reminder_sent', 'reminder_sent_at', 'reminder_whatsapp_message_id', 'reminder_numero',
        'reminder_status', 'reminder_error', 'conversation_id', 'notes'
    ];

    protected $casts = [
        'citfc' => 'date',
        'cithor' => 'datetime',
        'pacnac' => 'date',
        'reminder_sent' => 'boolean',
        'reminder_sent_at' => 'datetime',
    ];

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    /**
     * Citas de esa fecha a las que todavía se les puede mandar el recordatorio: sin recordatorio, sin cancelar ni
     * confirmar, sin error o con un error que no es culpa de la cita (Recordatorios::errorReintentable) y con
     * teléfono. Lo usan las cifras del panel, el inicio del envío y los comandos dormidos: un solo criterio.
     * Después, en PHP, Recordatorios::celular() separa las que tienen celular válido de las que no.
     * reminder_status puede ser NULL (el MODIFY de la columna la dejó sin NOT NULL): de ahí el whereNull.
     */
    public function scopePorRecordar(Builder $query, string $fecha): Builder
    {
        return $query->where('citfc', $fecha)
            ->where('reminder_sent', false)
            ->where(fn ($q) => $q->whereNull('reminder_status')->orWhereNotIn('reminder_status', Recordatorios::RESUELTAS))
            ->where(fn ($q) => Recordatorios::errorReintentable($q))
            // Con algún teléfono: el principal o el segundo (pactel2).
            ->where(fn ($q) => $q->where(fn ($p) => $p->whereNotNull('pactel')->where('pactel', '!=', ''))
                ->orWhere(fn ($p) => $p->whereNotNull('pactel2')->where('pactel2', '!=', '')));
    }

    /**
     * Verifica si la cita necesita recordatorio
     */
    public function needsReminder(int $daysInAdvance = 2): bool
    {
        if ($this->reminder_sent || !$this->citfc || (!$this->pactel && !$this->pactel2)) {
            return false;
        }

        $reminderDate = now()->addDays($daysInAdvance)->startOfDay();
        $appointmentDate = $this->citfc->startOfDay();

        return $appointmentDate->equalTo($reminderDate);
    }

    /**
     * Marca el recordatorio como enviado. Si la cita ya estaba cancelada o confirmada se conserva ese estado: antes
     * se pisaba con 'sent', se perdía la cancelación y el bot podía «confirmar» una cita cancelada.
     * Se decide en la propia base (CASE), no con lo que se leyó antes de enviar: la cancelación pudo llegar mientras.
     */
    public function markReminderSent(string $messageId, int $numero = 1): void
    {
        static::whereKey($this->getKey())->update([
            'reminder_sent' => true,
            'reminder_sent_at' => now(),
            'reminder_whatsapp_message_id' => $messageId,
            // A cuál teléfono salió: 1 el principal, 2 el segundo (pactel2).
            'reminder_numero' => $numero,
            'reminder_status' => DB::raw("CASE WHEN reminder_status IN ('cancelled', 'confirmed') THEN reminder_status ELSE 'sent' END"),
        ]);
        $this->refresh();
    }

    /**
     * Marca el recordatorio como fallido. Como markReminderSent, no pisa una cita ya cancelada o confirmada (la
     * cancelación pudo llegar mientras Meta respondía): se decide en la base con un CASE.
     */
    public function markReminderFailed(string $error): void
    {
        static::whereKey($this->getKey())->update([
            'reminder_status' => DB::raw("CASE WHEN reminder_status IN ('cancelled', 'confirmed') THEN reminder_status ELSE 'failed' END"),
            'reminder_error' => $error,
        ]);
        $this->refresh();
    }
}
