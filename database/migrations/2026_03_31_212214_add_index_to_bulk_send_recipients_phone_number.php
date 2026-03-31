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
        Schema::table('bulk_send_recipients', function (Blueprint $table) {
            $table->index('phone_number');
            $table->index('contact_name');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('bulk_send_recipients', function (Blueprint $table) {
            $table->dropIndex(['phone_number']);
            $table->dropIndex(['contact_name']);
        });
    }
};
