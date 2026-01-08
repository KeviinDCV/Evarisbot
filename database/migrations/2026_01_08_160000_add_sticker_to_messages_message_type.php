<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Agrega 'sticker' y 'contact' al ENUM message_type de la tabla messages.
     */
    public function up(): void
    {
        // MySQL requiere ALTER TABLE para modificar ENUMs
        DB::statement("ALTER TABLE messages MODIFY COLUMN message_type ENUM('text', 'image', 'document', 'audio', 'video', 'location', 'sticker', 'contact') DEFAULT 'text'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Revertir al ENUM original (esto podría fallar si hay datos con 'sticker' o 'contact')
        DB::statement("ALTER TABLE messages MODIFY COLUMN message_type ENUM('text', 'image', 'document', 'audio', 'video', 'location') DEFAULT 'text'");
    }
};
