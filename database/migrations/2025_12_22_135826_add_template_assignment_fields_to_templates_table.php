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
        Schema::table('templates', function (Blueprint $table) {
            // Add is_global field to determine if template is available to all users
            $table->boolean('is_global')->default(true)->after('is_active');
            
            // Add index for better performance on is_global queries
            $table->index('is_global');
        });

        // Create pivot table for template-user assignments
        Schema::create('template_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('template_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->timestamps();
            
            // Ensure a template can only be assigned to a user once
            $table->unique(['template_id', 'user_id']);
            
            // Add indexes for performance
            $table->index('template_id');
            $table->index('user_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('template_user');
        
        Schema::table('templates', function (Blueprint $table) {
            $table->dropIndex(['is_global']);
            $table->dropColumn('is_global');
        });
    }
};
