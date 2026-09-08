<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Evita que eliminar un usuario destruya activos del hospital.
 *
 * Estas cinco columnas guardan QUIÉN creó algo, no a quién pertenece. Estaban en
 * ON DELETE CASCADE, así que borrar una cuenta arrastraba consigo las citas, las
 * plantillas y el historial de envíos. Con los datos de hoy, eliminar a un solo
 * administrador borraba 40.990 citas y 29 de las 30 plantillas.
 *
 * Pasan a ON DELETE SET NULL: el activo sobrevive y solo pierde la atribución de
 * autor. Es el mismo criterio que ya usan conversations.assigned_to y messages.sent_by.
 *
 * NO se tocan las cascadas que sí son datos personales (pines de conversación,
 * participación en chats internos, plantillas asignadas a un usuario).
 */
return new class extends Migration
{
    /**
     * [tabla, columna]. La FK sigue la convención {tabla}_{columna}_foreign,
     * que es como están creadas las cinco.
     */
    private const AUTHORSHIP_COLUMNS = [
        ['appointments', 'uploaded_by'],
        ['templates', 'created_by'],
        ['bulk_sends', 'created_by'],
        ['template_sends', 'sent_by'],
        ['internal_chats', 'created_by'],
    ];

    public function up(): void
    {
        foreach (self::AUTHORSHIP_COLUMNS as [$table, $column]) {
            // La FK se suelta primero: MySQL no deja redefinir una columna
            // mientras una restricción la está referenciando.
            Schema::table($table, function (Blueprint $t) use ($column) {
                $t->dropForeign([$column]);
            });

            Schema::table($table, function (Blueprint $t) use ($column) {
                $t->unsignedBigInteger($column)->nullable()->change();
            });

            Schema::table($table, function (Blueprint $t) use ($column) {
                $t->foreign($column)->references('id')->on('users')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        // Volver a NOT NULL es imposible si ya se eliminó algún usuario y quedaron
        // filas huérfanas. Antes que inventar un autor o borrar datos reales,
        // preferimos parar y que una persona decida.
        foreach (self::AUTHORSHIP_COLUMNS as [$table, $column]) {
            $orphans = DB::table($table)->whereNull($column)->count();

            if ($orphans > 0) {
                throw new RuntimeException(
                    "No se puede revertir: {$table}.{$column} tiene {$orphans} fila(s) sin autor. "
                    . 'Reasigna esas filas a un usuario existente antes de hacer rollback.'
                );
            }
        }

        foreach (self::AUTHORSHIP_COLUMNS as [$table, $column]) {
            Schema::table($table, function (Blueprint $t) use ($column) {
                $t->dropForeign([$column]);
            });

            Schema::table($table, function (Blueprint $t) use ($column) {
                $t->unsignedBigInteger($column)->nullable(false)->change();
            });

            Schema::table($table, function (Blueprint $t) use ($column) {
                $t->foreign($column)->references('id')->on('users')->cascadeOnDelete();
            });
        }
    }
};
