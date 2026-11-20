<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Buzón de voz de las llamadas: el mensaje de voz que dejó el paciente (llega como audio con el id de la llamada) y
 * quién lo dio por resuelto en la pantalla «Llamadas».
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('llamadas', function (Blueprint $table) {
            $table->unsignedBigInteger('buzon_message_id')->nullable()->after('motivo');
            $table->foreignId('buzon_resuelto_por')->nullable()->after('buzon_message_id')->constrained('users')->nullOnDelete();
            $table->timestamp('buzon_resuelto_en')->nullable()->after('buzon_resuelto_por');
            $table->index('buzon_message_id');
            $table->index(['conversation_id', 'created_at']);
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::table('llamadas', function (Blueprint $table) {
            $table->dropConstrainedForeignId('buzon_resuelto_por');
            $table->dropIndex(['buzon_message_id']);
            $table->dropIndex(['conversation_id', 'created_at']);
            $table->dropIndex(['created_at']);
            $table->dropColumn(['buzon_message_id', 'buzon_resuelto_en']);
        });
    }
};
