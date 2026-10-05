<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('message_reactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('message_id')->constrained()->onDelete('cascade');
            $table->string('emoji', 16);
            // true = el paciente reaccionó; false = un asesor/sistema reaccionó
            $table->boolean('from_user')->default(true);
            // Asesor que envió la reacción (solo salientes)
            $table->foreignId('reacted_by')->nullable()->constrained('users')->nullOnDelete();
            // wamid del propio mensaje de reacción (para trazabilidad de salientes)
            $table->string('whatsapp_message_id')->nullable();
            $table->timestamps();

            // Cada lado (paciente / negocio) tiene como máximo una reacción por mensaje:
            // reaccionar de nuevo reemplaza; emoji vacío elimina la fila.
            $table->unique(['message_id', 'from_user']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('message_reactions');
    }
};
