<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Anuncios de lectura obligatoria: un administrador toma un mensaje del chat interno y lo anuncia a todos. A cada
 * administrador y asesor le sale en una ventana que solo se cierra tras 30 s a la vista; aquí queda quién lo leyó.
 * Solo crea tablas nuevas: no toca las que ya existen.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Las llaves foráneas piden un momento la tabla de usuarios y la de mensajes internos, que están en uso: si otra
        // consulta las tiene ocupadas, se rinde a los 10 s en vez de dejar en cola a las demás.
        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement('SET SESSION lock_wait_timeout = 10');
        }

        if (!Schema::hasTable('anuncios')) {
            Schema::create('anuncios', function (Blueprint $table) {
                $table->id();
                // Quién lo anunció (no tiene que leerlo).
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                // El mensaje del chat interno de donde salió; si se borra el chat, el anuncio queda con su texto.
                $table->foreignId('internal_message_id')->nullable()->constrained('internal_messages')->nullOnDelete();
                $table->text('cuerpo');
                $table->timestamp('vence_en')->nullable();
                $table->timestamp('retirado_en')->nullable();
                $table->timestamps();
                $table->index(['retirado_en', 'vence_en']);
            });
        }

        if (!Schema::hasTable('anuncio_lecturas')) {
            Schema::create('anuncio_lecturas', function (Blueprint $table) {
                $table->id();
                $table->foreignId('anuncio_id')->constrained('anuncios')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->timestamp('leido_en');
                $table->unique(['anuncio_id', 'user_id']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('anuncio_lecturas');
        Schema::dropIfExists('anuncios');
    }
};
