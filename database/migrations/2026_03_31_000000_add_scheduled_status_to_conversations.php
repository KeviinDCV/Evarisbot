<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE conversations MODIFY COLUMN status ENUM('active', 'pending', 'in_progress', 'resolved', 'closed', 'scheduled') DEFAULT 'active'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE conversations MODIFY COLUMN status ENUM('active', 'pending', 'in_progress', 'resolved', 'closed') DEFAULT 'active'");
    }
};
