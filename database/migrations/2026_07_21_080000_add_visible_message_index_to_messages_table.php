<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Índice para la relación lastVisibleMessage (preview de la lista de conversaciones).
 *
 * La lista hace `hasOne(...)->ofMany(['created_at'=>'max','id'=>'max'], fn($q) => $q->where('is_hidden', false))`.
 * Existía messages_conversation_created_index (conversation_id, created_at) que sirve a
 * lastMessage, pero lastVisibleMessage filtra ADEMÁS por is_hidden y no había índice que
 * cubriera las tres columnas: la subconsulta escaneaba las ~170k filas de messages.
 *
 * Medido antes del índice: lastVisibleMessage = 715 ms de los ~614 ms de la lista completa
 * (el resto de relaciones sumaban <120 ms). Es la causa principal de la lentitud reportada.
 *
 * Orden de columnas: is_hidden primero (igualdad), luego conversation_id (agrupación) y
 * created_at/id (el MAX), para que MySQL resuelva el filtro y el máximo con el mismo índice.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->index(
                ['is_hidden', 'conversation_id', 'created_at', 'id'],
                'messages_visible_conv_created_idx'
            );
        });
    }

    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->dropIndex('messages_visible_conv_created_idx');
        });
    }
};
