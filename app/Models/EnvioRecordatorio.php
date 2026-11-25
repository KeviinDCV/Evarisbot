<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Un envío de recordatorios de Citas (historial). Ver App\Support\HistorialEnvios y la migración
 * 2026_11_24_000001_create_envios_recordatorio_tables.
 */
class EnvioRecordatorio extends Model
{
    protected $table = 'envios_recordatorio';

    protected $fillable = [
        'service', 'batch_id', 'tipo', 'fecha_citas', 'fecha_hasta', 'total', 'sin_celular', 'iniciado_por_id',
        'iniciado_por', 'inicio_at', 'fin_at', 'estado', 'motivo', 'enviados', 'con_error', 'sin_enviar', 'omitidas',
    ];

    protected $casts = [
        'inicio_at' => 'datetime',
        'fin_at' => 'datetime',
        'total' => 'integer',
        'sin_celular' => 'integer',
    ];
}
