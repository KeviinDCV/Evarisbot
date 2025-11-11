<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Appointment extends Model
{
    protected $fillable = [
        'citead', 'cianom', 'citmed', 'mednom', 'citesp', 'espnom',
        'citfc', 'cithor', 'citdoc', 'nom_paciente', 'pactel', 'pacnac',
        'pachis', 'cittid', 'citide', 'citres', 'cittip', 'nom_cotizante',
        'citcon', 'connom', 'citurg', 'citobsobs', 'duracion', 'ageperdes_g', 'dia',
        'uploaded_by', 'reminder_sent', 'reminder_sent_at', 'reminder_whatsapp_message_id',
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
     * Verifica si la cita necesita recordatorio
     */
    public function needsReminder(int $daysInAdvance = 2): bool
    {
        if ($this->reminder_sent || !$this->citfc || !$this->pactel) {
            return false;
        }

        $reminderDate = now()->addDays($daysInAdvance)->startOfDay();
        $appointmentDate = $this->citfc->startOfDay();

        return $appointmentDate->equalTo($reminderDate);
    }

    /**
     * Marca el recordatorio como enviado
     */
    public function markReminderSent(string $messageId): void
    {
        $this->update([
            'reminder_sent' => true,
            'reminder_sent_at' => now(),
            'reminder_whatsapp_message_id' => $messageId,
            'reminder_status' => 'sent'
        ]);
    }

    /**
     * Marca el recordatorio como fallido
     */
    public function markReminderFailed(string $error): void
    {
        $this->update([
            'reminder_status' => 'failed',
            'reminder_error' => $error
        ]);
    }
}
