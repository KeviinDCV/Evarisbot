<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Crea (o actualiza) el usuario especial "IA - Prueba" que funciona como
 * chatbot en el chat interno. Identificado por un email reservado y role='ai'.
 */
class EnsureAiUser extends Command
{
    protected $signature = 'ai:ensure-user';
    protected $description = 'Crea/actualiza el usuario "IA - Prueba" para el chatbot del chat interno';

    public function handle(): int
    {
        $user = User::firstOrNew(['email' => User::AI_EMAIL]);

        $user->name = 'IA - Prueba';
        $user->role = 'ai';
        if (!$user->exists) {
            $user->password = Hash::make(Str::random(48));
        }
        $user->last_activity_at = now();
        $user->save();

        $this->info("✓ Usuario IA listo (id {$user->id}, {$user->email}, role={$user->role}).");
        $this->line('  Ahora puedes crear un chat directo con "IA - Prueba" en /admin/internal-chat.');

        return self::SUCCESS;
    }
}
