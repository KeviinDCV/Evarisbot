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
        'uploaded_by'
    ];

    protected $casts = [
        'citfc' => 'date',
        'cithor' => 'datetime',
        'pacnac' => 'date',
    ];

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
