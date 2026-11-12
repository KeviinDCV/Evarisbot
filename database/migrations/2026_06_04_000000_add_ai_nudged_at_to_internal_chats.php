<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Marca el momento en que se envió el recordatorio "¿Sigues ahí?" en un chat
 * con la IA, para no repetirlo entre el minuto 5 y el 10 de inactividad.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('internal_chats', function (Blueprint $table) {
            $table->timestamp('ai_nudged_at')->nullable()->after('created_by');
        });
    }

    public function down(): void
    {
        Schema::table('internal_chats', function (Blueprint $table) {
            $table->dropColumn('ai_nudged_at');
        });
    }
};
