<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // SQLite no soporta modificar enums directamente, así que usamos un enfoque diferente
        // Simplemente documentamos los nuevos valores posibles para reminder_status:
        // - 'pending': Pendiente de envío
        // - 'sent': Enviado
        // - 'delivered': Entregado
        // - 'read': Leído
        // - 'failed': Falló el envío
        // - 'confirmed': Paciente confirmó asistencia
        // - 'cancelled': Paciente canceló
        // - 'reschedule_requested': Paciente solicitó reprogramar
        
        // En SQLite, los enums son texto, así que no hay restricción
        // Los nuevos valores funcionarán automáticamente
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No hay cambios que revertir
    }
};
