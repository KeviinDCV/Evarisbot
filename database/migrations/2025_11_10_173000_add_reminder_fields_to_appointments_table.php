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
        Schema::table('appointments', function (Blueprint $table) {
            if (!Schema::hasColumn('appointments', 'reminder_sent')) {
                $table->boolean('reminder_sent')->default(false)->after('dia');
            }
            if (!Schema::hasColumn('appointments', 'reminder_sent_at')) {
                $table->timestamp('reminder_sent_at')->nullable()->after('dia');
            }
            if (!Schema::hasColumn('appointments', 'reminder_whatsapp_message_id')) {
                $table->string('reminder_whatsapp_message_id')->nullable()->after('dia');
            }
            if (!Schema::hasColumn('appointments', 'reminder_status')) {
                $table->enum('reminder_status', ['pending', 'sent', 'delivered', 'read', 'failed'])->default('pending')->after('dia');
            }
            if (!Schema::hasColumn('appointments', 'reminder_error')) {
                $table->text('reminder_error')->nullable()->after('dia');
            }
            if (!Schema::hasColumn('appointments', 'conversation_id')) {
                $table->foreignId('conversation_id')->nullable()->constrained()->onDelete('set null')->after('dia');
            }
        });
        
        // Agregar índices - Laravel ignorará si ya existen
        try {
            Schema::table('appointments', function (Blueprint $table) {
                $table->index('reminder_sent');
                $table->index(['citfc', 'reminder_sent']);
            });
        } catch (\Exception $e) {
            // Índices ya existen, continuar
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->dropForeign(['conversation_id']);
            $table->dropColumn([
                'reminder_sent',
                'reminder_sent_at',
                'reminder_whatsapp_message_id',
                'reminder_status',
                'reminder_error',
                'conversation_id'
            ]);
        });
    }
};
