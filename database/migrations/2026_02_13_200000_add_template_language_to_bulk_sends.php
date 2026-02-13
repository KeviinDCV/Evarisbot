<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bulk_sends', function (Blueprint $table) {
            $table->string('template_language')->default('es_CO')->after('template_params');
        });
    }

    public function down(): void
    {
        Schema::table('bulk_sends', function (Blueprint $table) {
            $table->dropColumn('template_language');
        });
    }
};
