<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Segundo teléfono de la cita (columna «pactel2» del Excel, opcional) y a cuál de los dos números salió el recordatorio.
 * Si el primero no tiene WhatsApp, no es válido o WhatsApp no lo entrega, el recordatorio se manda al segundo.
 * Solo agrega columnas que admiten vacío: las citas que ya existen no cambian.
 */
return new class extends Migration
{
    public function up(): void
    {
        $faltaTelefono2 = !Schema::hasColumn('appointments', 'pactel2');
        $faltaNumero = !Schema::hasColumn('appointments', 'reminder_numero');
        if (!$faltaTelefono2 && !$faltaNumero) {
            return;
        }

        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            // La tabla está en uso (recordatorios, webhook): cambio instantáneo, sin reconstruirla (ALGORITHM=INSTANT
            // falla en vez de copiar la tabla), y si otra consulta la tiene ocupada se rinde a los 5 s en vez de
            // dejar en cola a todas las demás.
            DB::statement('SET SESSION lock_wait_timeout = 5');
            $columnas = array_filter([
                $faltaTelefono2 ? 'ADD COLUMN pactel2 VARCHAR(255) NULL AFTER pactel' : null,
                // 1 = al teléfono principal, 2 = al segundo; null = sin recordatorio todavía (o de antes de esto).
                $faltaNumero ? 'ADD COLUMN reminder_numero TINYINT UNSIGNED NULL AFTER reminder_whatsapp_message_id' : null,
            ]);
            DB::statement('ALTER TABLE appointments '.implode(', ', $columnas).', ALGORITHM=INSTANT');

            return;
        }

        Schema::table('appointments', function (Blueprint $table) use ($faltaTelefono2, $faltaNumero) {
            if ($faltaTelefono2) {
                $table->string('pactel2')->nullable()->after('pactel');
            }
            if ($faltaNumero) {
                $table->unsignedTinyInteger('reminder_numero')->nullable()->after('reminder_whatsapp_message_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            if (Schema::hasColumn('appointments', 'reminder_numero')) {
                $table->dropColumn('reminder_numero');
            }
            if (Schema::hasColumn('appointments', 'pactel2')) {
                $table->dropColumn('pactel2');
            }
        });
    }
};
