<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Para MySQL, necesitamos modificar el ENUM con ALTER TABLE
        DB::statement("ALTER TABLE appointments MODIFY COLUMN reminder_status ENUM('pending', 'sent', 'delivered', 'read', 'failed', 'confirmed', 'cancelled', 'reschedule_requested') DEFAULT 'pending'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Volver al ENUM original
        DB::statement("ALTER TABLE appointments MODIFY COLUMN reminder_status ENUM('pending', 'sent', 'delivered', 'read', 'failed') DEFAULT 'pending'");
    }
};
