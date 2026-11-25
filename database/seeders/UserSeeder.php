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
            'password' => Hash::make($claveAdmin = \Illuminate\Support\Str::password(16)),
            'role' => 'admin',
            'email_verified_at' => now(),
        ]);

        // Crear un usuario Asesor
        User::create([
            'name' => 'Asesor Demo',
            'email' => 'asesor@evarisbot.com',
            'password' => Hash::make($claveAsesor = \Illuminate\Support\Str::password(16)),
            'role' => 'advisor',
            'email_verified_at' => now(),
        ]);

        $this->command->info('✅ Usuarios creados exitosamente:');
        $this->command->info('   👤 Administrador: admin@evarisbot.com / ' . $claveAdmin);
        $this->command->info('   👤 Asesor: asesor@evarisbot.com / ' . $claveAsesor);
        $this->command->warn('   Contraseñas aleatorias: cámbielas al primer ingreso. No use este seeder en producción.');
    }
}
