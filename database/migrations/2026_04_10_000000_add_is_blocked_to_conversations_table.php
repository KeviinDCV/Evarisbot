<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            $table->boolean('is_blocked')->default(false)->after('is_pinned');
            $table->timestamp('blocked_at')->nullable()->after('is_blocked');
            $table->unsignedBigInteger('blocked_by')->nullable()->after('blocked_at');

            $table->foreign('blocked_by')->references('id')->on('users')->nullOnDelete();
            $table->index('is_blocked');
        });
    }

    public function down(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            $table->dropForeign(['blocked_by']);
            $table->dropIndex(['is_blocked']);
            $table->dropColumn(['is_blocked', 'blocked_at', 'blocked_by']);
        });
    }
};
