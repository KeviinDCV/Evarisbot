<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Simplifica los estados de conversación de 5 a 2:
     * - pending, in_progress, active, closed -> active
     * - resolved -> resolved
     */
    public function up(): void
    {
        // Convertir todos los estados antiguos a los nuevos
        DB::table('conversations')
            ->whereIn('status', ['pending', 'in_progress', 'closed'])
            ->update(['status' => 'active']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No se puede revertir porque no sabemos el estado original
    }
};
