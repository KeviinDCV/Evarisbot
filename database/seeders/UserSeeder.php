<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Crear un usuario Administrador
        User::create([
            'name' => 'Administrador',
            'email' => 'admin@evarisbot.com',
            'password' => Hash::make('admin123'),
            'role' => 'admin',
            'email_verified_at' => now(),
        ]);

        // Crear un usuario Asesor
        User::create([
            'name' => 'Asesor Demo',
            'email' => 'asesor@evarisbot.com',
            'password' => Hash::make('asesor123'),
            'role' => 'advisor',
            'email_verified_at' => now(),
        ]);

        $this->command->info('✅ Usuarios creados exitosamente:');
        $this->command->info('   👤 Administrador: admin@evarisbot.com / admin123');
        $this->command->info('   👤 Asesor: asesor@evarisbot.com / asesor123');
    }
}
