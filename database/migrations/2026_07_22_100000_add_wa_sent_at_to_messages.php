<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Hora REAL en que WhatsApp dice que el paciente envió el mensaje.
 *
 * Hasta ahora sólo teníamos created_at, que es cuando NUESTRO webhook procesó el mensaje.
 * Esa diferencia hace que el cálculo de la ventana de 24 h no coincida con el de Meta:
 * medido en producción, los rechazos 131047 empiezan a las 23,29 h por nuestro reloj —
 * pero hay entregas correctas hasta las 25,47 h. La franja es difusa justamente porque
 * comparamos contra el reloj equivocado.
 *
 * El webhook YA envía este dato (messageData['timestamp']) y el código lo extraía sin
 * usarlo. Se guarda en una columna aparte para no tocar created_at, del que dependen el
 * orden del hilo y el "último mensaje".
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->timestamp('wa_sent_at')->nullable()->after('whatsapp_message_id');
            // La ventana se calcula buscando el último entrante: conviene indexarlo.
            $table->index(['conversation_id', 'is_from_user', 'wa_sent_at'], 'messages_conv_inbound_wasent_idx');
        });
    }

    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->dropIndex('messages_conv_inbound_wasent_idx');
            $table->dropColumn('wa_sent_at');
        });
    }
};
