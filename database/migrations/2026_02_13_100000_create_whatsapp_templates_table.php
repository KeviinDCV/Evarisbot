<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('whatsapp_templates', function (Blueprint $table) {
            $table->id();
            $table->string('name'); // Nombre visible en la UI
            $table->string('meta_template_name'); // Nombre exacto del template en Meta
            $table->text('preview_text')->nullable(); // Texto de previsualización del mensaje
            $table->string('language')->default('es_CO'); // Idioma del template en Meta
            $table->json('default_params')->nullable(); // Parámetros por defecto (JSON)
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('whatsapp_templates');
    }
};
