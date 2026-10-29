<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Guarda los datos de facturación que Meta envía en los webhooks de estado
     * (objetos `pricing` y `conversation`) para poder estimar el costo del API
     * de WhatsApp dentro del propio panel, sin depender de WhatsApp Manager.
     */
    public function up(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            // Categoría facturada por Meta: marketing | utility | authentication | service
            $table->string('pricing_category')->nullable();
            // Modelo de precios reportado por Meta: PMP (por mensaje) | CBP (por conversación)
            $table->string('pricing_model')->nullable();
            // Si Meta cobró este mensaje (false = gratis: servicio o ventana de 24h)
            $table->boolean('billable')->nullable();
            // Origen de la conversación: marketing | utility | authentication | service
            $table->string('conversation_origin_type')->nullable();
            // Id de conversación de Meta (útil para deduplicar en el modelo CBP)
            $table->string('wa_conversation_id')->nullable();

            $table->index('pricing_category');
        });
    }

    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->dropIndex(['pricing_category']);
            $table->dropColumn([
                'pricing_category',
                'pricing_model',
                'billable',
                'conversation_origin_type',
                'wa_conversation_id',
            ]);
        });
    }
};
