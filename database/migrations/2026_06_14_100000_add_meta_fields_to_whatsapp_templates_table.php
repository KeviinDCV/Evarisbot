<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('whatsapp_templates', function (Blueprint $table) {
            $table->string('category')->default('UTILITY')->after('language');
            $table->string('status')->default('APPROVED')->after('category');
            $table->string('meta_template_id')->nullable()->after('status');
            $table->text('header_text')->nullable()->after('meta_template_id');
            $table->text('footer_text')->nullable()->after('header_text');
        });
    }

    public function down(): void
    {
        Schema::table('whatsapp_templates', function (Blueprint $table) {
            $table->dropColumn(['category', 'status', 'meta_template_id', 'header_text', 'footer_text']);
        });
    }
};
