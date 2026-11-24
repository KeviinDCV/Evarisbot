<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Historial de envíos de recordatorios de Citas (pedido del 24/11/2026): cada envío («pasado mañana», «mañana» o
 * «todas») queda con sus citas, para ver en Citas quién confirmó, canceló o no respondió en ESE envío, y sus llamadas.
 * Antes solo existía el último envío en settings (reminder_ultimo_envio / reminder_lote_ids) y se sobrescribía.
 *
 * Tablas NUEVAS: no toca appointments. Las cifras se cuentan en vivo (App\Support\HistorialEnvios); las de aquí son
 * la foto al cerrar.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Sin esperar un día entero por un bloqueo (el lock_wait_timeout global es 86.400 s): mejor fallar y reintentar.
        if (DB::getDriverName() === 'mysql' || DB::getDriverName() === 'mariadb') {
            DB::statement('SET SESSION lock_wait_timeout = 5');
        }

        Schema::create('envios_recordatorio', function (Blueprint $table) {
            $table->id();
            $table->string('service', 20)->default('general');
            $table->string('batch_id', 64)->nullable()->unique(); // el lote de la cola (job_batches.id)
            $table->string('tipo', 20); // normal (pasado mañana) | dia_antes (mañana) | todas
            $table->date('fecha_citas')->nullable(); // la fecha de las citas (en «todas», la primera)
            $table->date('fecha_hasta')->nullable(); // solo «todas»: la última
            $table->unsignedInteger('total')->default(0); // citas encoladas
            $table->unsignedInteger('sin_celular')->default(0); // quedaron fuera por no tener celular
            $table->foreignId('iniciado_por_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('iniciado_por', 255)->nullable(); // el nombre en ese momento (queda aunque se borre el usuario)
            $table->timestamp('inicio_at')->nullable(); // UTC
            $table->timestamp('fin_at')->nullable(); // UTC
            $table->string('estado', 20)->default('en_curso'); // en_curso | terminado | detenido | cortado
            $table->string('motivo', 20)->nullable(); // del corte: plantilla | cuenta | limite
            // Foto al cerrar (EnvioRecordatorios::progreso). La pantalla cuenta en vivo: las respuestas llegan después.
            $table->unsignedInteger('enviados')->nullable();
            $table->unsignedInteger('con_error')->nullable();
            $table->unsignedInteger('sin_enviar')->nullable();
            $table->unsignedInteger('omitidas')->nullable();
            $table->timestamps();
            $table->index(['service', 'id']);
        });

        // Las citas de cada envío. Sin clave foránea hacia appointments: las citas se borran (y el envío queda).
        Schema::create('envio_recordatorio_cita', function (Blueprint $table) {
            $table->foreignId('envio_id')->constrained('envios_recordatorio')->cascadeOnDelete();
            $table->unsignedBigInteger('appointment_id');
            $table->primary(['envio_id', 'appointment_id']);
            // ¿En qué envíos estuvo una cita? (y el más reciente, con MAX): solo con el índice.
            $table->index(['appointment_id', 'envio_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('envio_recordatorio_cita');
        Schema::dropIfExists('envios_recordatorio');
    }
};
