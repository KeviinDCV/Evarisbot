<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Migra de un solo archivo (media_url, media_filename) a múltiples archivos (media_files JSON)
     */
    public function up(): void
    {
        Schema::table('templates', function (Blueprint $table) {
            // Agregar columna JSON para múltiples archivos
            $table->json('media_files')->nullable()->after('media_filename');
        });

        // Migrar datos existentes al nuevo formato
        $templates = DB::table('templates')
            ->whereNotNull('media_url')
            ->get();

        foreach ($templates as $template) {
            $mediaFiles = [[
                'url' => $template->media_url,
                'filename' => $template->media_filename,
                'type' => $template->message_type,
            ]];

            DB::table('templates')
                ->where('id', $template->id)
                ->update(['media_files' => json_encode($mediaFiles)]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('templates', function (Blueprint $table) {
            $table->dropColumn('media_files');
        });
    }
};
