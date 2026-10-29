<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Equipo de atención aparte de la línea general (p. ej. Teleconsulta). Se crea y se arma en Configuración → Equipos.
 *
 * Reglas (ConversationController::alcanceAsesor / puedeVer):
 *  - Sus miembros ven y responden TODOS los chats del equipo (de cualquiera de ellos o sin asignar), y ningún otro:
 *    nada de la línea general, aunque estén de turno, y el bot no les reparte chats.
 *  - La línea general no ve los chats de un equipo. Los administradores ven todo.
 *  - Un chat entra al equipo cuando uno de sus miembros lo inicia (nuevo chat o envío masivo) o se le asigna; sale con
 *    «Pasar a línea general» o al asignárselo a alguien de fuera.
 */
class Equipo extends Model
{
    protected $table = 'equipos';

    protected $fillable = ['nombre'];

    public function miembros(): HasMany
    {
        return $this->hasMany(User::class, 'equipo_id');
    }

    public function conversaciones(): HasMany
    {
        return $this->hasMany(Conversation::class, 'equipo_id');
    }
}
