<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('appointments', function (Blueprint $table) {
            $table->id();
            $table->string('citead')->nullable();
            $table->string('cianom')->nullable();
            $table->string('citmed')->nullable();
            $table->string('mednom')->nullable();
            $table->string('citesp')->nullable();
            $table->string('espnom')->nullable();
            $table->date('citfc')->nullable();
            $table->time('cithor')->nullable();
            $table->string('citdoc')->nullable();
            $table->string('nom_paciente')->nullable();
            $table->string('pactel')->nullable();
            $table->date('pacnac')->nullable();
            $table->string('pachis')->nullable();
            $table->string('cittid')->nullable();
            $table->string('citide')->nullable();
            $table->string('citres')->nullable();
            $table->string('cittip')->nullable();
            $table->string('nom_cotizante')->nullable();
            $table->string('citcon')->nullable();
            $table->string('connom')->nullable();
            $table->string('citurg')->nullable();
            $table->text('citobsobs')->nullable();
            $table->string('duracion')->nullable();
            $table->string('ageperdes_g')->nullable();
            $table->string('dia')->nullable();
            $table->foreignId('uploaded_by')->constrained('users')->onDelete('cascade');
            $table->timestamps();
            
            $table->index('citfc');
            $table->index('pactel');
            $table->index('uploaded_by');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('appointments');
    }
};
