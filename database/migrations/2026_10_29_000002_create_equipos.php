<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Equipos de atención aparte de la línea general (p. ej. Teleconsulta). Sus miembros solo ven los chats de su equipo
 * (todos, de cualquiera de ellos) y la línea general no los ve. Una conversación es de un equipo por equipo_id; sin
 * equipo (null) es de la línea general, como todas las de antes.
 *
 * Solo agrega: una tabla nueva y una columna vacía en usuarios, conversaciones y envíos masivos (cambio instantáneo,
 * sin reconstruir la tabla), más el índice de conversaciones.equipo_id, que se crea sin bloquear la tabla. El envío
 * masivo guarda el equipo de quien lo creó: así su visibilidad y a qué bandeja van las respuestas no cambian si
 * después esa persona entra o sale de un equipo.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('equipos')) {
            Schema::create('equipos', function (Blueprint $table) {
                $table->id();
                $table->string('nombre', 80)->unique();
                $table->timestamps();
            });
        }

        $mysql = in_array(DB::getDriverName(), ['mysql', 'mariadb'], true);
        if ($mysql) {
            // Las tablas están en uso: si otra consulta las tiene ocupadas, se rinde a los 10 s en vez de dejar en cola
            // a todas las demás.
            DB::statement('SET SESSION lock_wait_timeout = 10');
        }

        if (!Schema::hasColumn('users', 'equipo_id')) {
            if ($mysql) {
                DB::statement('ALTER TABLE users ADD COLUMN equipo_id BIGINT UNSIGNED NULL AFTER role, ALGORITHM=INSTANT');
            } else {
                Schema::table('users', fn (Blueprint $t) => $t->unsignedBigInteger('equipo_id')->nullable()->after('role'));
            }
        }

        if (!Schema::hasColumn('conversations', 'equipo_id')) {
            if ($mysql) {
                DB::statement('ALTER TABLE conversations ADD COLUMN equipo_id BIGINT UNSIGNED NULL AFTER assigned_to, ALGORITHM=INSTANT');
            } else {
                Schema::table('conversations', fn (Blueprint $t) => $t->unsignedBigInteger('equipo_id')->nullable()->after('assigned_to'));
            }
        }
        if (!Schema::hasColumn('bulk_sends', 'equipo_id')) {
            if ($mysql) {
                DB::statement('ALTER TABLE bulk_sends ADD COLUMN equipo_id BIGINT UNSIGNED NULL, ALGORITHM=INSTANT');
            } else {
                Schema::table('bulk_sends', fn (Blueprint $t) => $t->unsignedBigInteger('equipo_id')->nullable());
            }
        }

        // El índice aparte: si una corrida anterior agregó la columna y falló aquí, al reintentar se crea igual.
        if (!Schema::hasIndex('conversations', 'conversations_equipo_id_index')) {
            if ($mysql) {
                DB::statement('ALTER TABLE conversations ADD INDEX conversations_equipo_id_index (equipo_id), ALGORITHM=INPLACE, LOCK=NONE');
            } else {
                Schema::table('conversations', fn (Blueprint $t) => $t->index('equipo_id', 'conversations_equipo_id_index'));
            }
        }
    }

    public function down(): void
    {
        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement('SET SESSION lock_wait_timeout = 10');
        }
        if (Schema::hasIndex('conversations', 'conversations_equipo_id_index')) {
            Schema::table('conversations', fn (Blueprint $t) => $t->dropIndex('conversations_equipo_id_index'));
        }
        if (Schema::hasColumn('conversations', 'equipo_id')) {
            Schema::table('conversations', fn (Blueprint $t) => $t->dropColumn('equipo_id'));
        }
        if (Schema::hasColumn('bulk_sends', 'equipo_id')) {
            Schema::table('bulk_sends', fn (Blueprint $t) => $t->dropColumn('equipo_id'));
        }
        if (Schema::hasColumn('users', 'equipo_id')) {
            Schema::table('users', fn (Blueprint $t) => $t->dropColumn('equipo_id'));
        }
        Schema::dropIfExists('equipos');
    }
};
