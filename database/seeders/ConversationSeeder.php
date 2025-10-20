<?php

namespace Database\Seeders;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Database\Seeder;

class ConversationSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Obtener usuarios para asignar
        $admin = User::where('role', 'admin')->first();
        $advisor = User::where('role', 'advisor')->first();

        // Conversación 1: Cliente María López (Activa)
        $conv1 = Conversation::create([
            'phone_number' => '+573001234567',
            'contact_name' => 'María López',
            'status' => 'active',
            'assigned_to' => $advisor?->id,
            'last_message_at' => now()->subMinutes(5),
            'unread_count' => 2,
        ]);

        Message::create([
            'conversation_id' => $conv1->id,
            'content' => 'Hola, necesito información sobre sus servicios',
            'is_from_user' => true,
            'status' => 'read',
            'created_at' => now()->subMinutes(30),
        ]);

        Message::create([
            'conversation_id' => $conv1->id,
            'content' => '¡Hola María! Claro, con gusto te ayudo. ¿Qué servicio te interesa?',
            'is_from_user' => false,
            'sent_by' => $advisor?->id,
            'status' => 'read',
            'created_at' => now()->subMinutes(28),
        ]);

        Message::create([
            'conversation_id' => $conv1->id,
            'content' => 'Estoy interesada en el plan empresarial',
            'is_from_user' => true,
            'status' => 'delivered',
            'created_at' => now()->subMinutes(5),
        ]);

        Message::create([
            'conversation_id' => $conv1->id,
            'content' => '¿Cuál es el precio?',
            'is_from_user' => true,
            'status' => 'delivered',
            'created_at' => now()->subMinutes(5),
        ]);

        // Conversación 2: Cliente Juan Pérez (Pendiente)
        $conv2 = Conversation::create([
            'phone_number' => '+573009876543',
            'contact_name' => 'Juan Pérez',
            'status' => 'pending',
            'assigned_to' => null,
            'last_message_at' => now()->subHours(2),
            'unread_count' => 1,
        ]);

        Message::create([
            'conversation_id' => $conv2->id,
            'content' => 'Buenos días, quisiera hacer una consulta',
            'is_from_user' => true,
            'status' => 'delivered',
            'created_at' => now()->subHours(2),
        ]);

        // Conversación 3: Cliente Ana Martínez (Resuelta)
        $conv3 = Conversation::create([
            'phone_number' => '+573005554321',
            'contact_name' => 'Ana Martínez',
            'status' => 'resolved',
            'assigned_to' => $admin?->id,
            'last_message_at' => now()->subDay(),
            'unread_count' => 0,
        ]);

        Message::create([
            'conversation_id' => $conv3->id,
            'content' => '¿Tienen descuentos disponibles?',
            'is_from_user' => true,
            'status' => 'read',
            'created_at' => now()->subDay()->subHours(3),
        ]);

        Message::create([
            'conversation_id' => $conv3->id,
            'content' => 'Sí, actualmente tenemos un 20% de descuento en el plan anual',
            'is_from_user' => false,
            'sent_by' => $admin?->id,
            'status' => 'read',
            'created_at' => now()->subDay()->subHours(2),
        ]);

        Message::create([
            'conversation_id' => $conv3->id,
            'content' => 'Perfecto, me interesa. Gracias!',
            'is_from_user' => true,
            'status' => 'read',
            'created_at' => now()->subDay(),
        ]);

        // Conversación 4: Cliente sin nombre (En progreso)
        $conv4 = Conversation::create([
            'phone_number' => '+573007778888',
            'contact_name' => null,
            'status' => 'in_progress',
            'assigned_to' => $advisor?->id,
            'last_message_at' => now()->subMinutes(45),
            'unread_count' => 0,
        ]);

        Message::create([
            'conversation_id' => $conv4->id,
            'content' => 'Hola',
            'is_from_user' => true,
            'status' => 'read',
            'created_at' => now()->subHour(),
        ]);

        Message::create([
            'conversation_id' => $conv4->id,
            'content' => '¡Hola! ¿En qué puedo ayudarte?',
            'is_from_user' => false,
            'sent_by' => $advisor?->id,
            'status' => 'read',
            'created_at' => now()->subMinutes(45),
        ]);

        $this->command->info('✅ 4 conversaciones de prueba creadas con sus mensajes');
    }
}
