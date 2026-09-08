<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Fortify\TwoFactorAuthenticatable;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable, TwoFactorAuthenticatable;

    /**
     * Email reservado del usuario especial "IA - Prueba" (chatbot del chat interno).
     */
    public const AI_EMAIL = 'ia-prueba@evarisbot.local';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'is_on_duty',
        'can_bulk_send',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'two_factor_secret',
        'two_factor_recovery_codes',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'two_factor_confirmed_at' => 'datetime',
            'last_activity_at' => 'datetime',
        ];
    }
    
    /**
     * Check if the user has admin role.
     *
     * @return bool
     */
    /**
     * Al borrar un usuario se llevan sus plantillas personales.
     *
     * Sin esto quedaban huérfanas: templates.created_by es ON DELETE SET NULL mientras
     * que template_user.user_id es ON DELETE CASCADE, así que la plantilla sobrevivía
     * sin autor y sin nadie asignado — invisible para todos y ocupando sitio para siempre.
     *
     * Va aquí y no en el controlador porque hay DOS caminos de borrado: el admin desde
     * la gestión de usuarios y el propio usuario desde sus ajustes de perfil.
     *
     * El filtro por is_global es la salvaguarda que importa: el catálogo institucional
     * lo creó un admin, y borrar a ese admin no puede llevarse las plantillas que usan
     * los 30 asesores.
     */
    protected static function booted(): void
    {
        static::deleting(function (self $usuario) {
            $suyas = Template::where('created_by', $usuario->id)
                ->where('is_global', false)
                ->get();

            foreach ($suyas as $plantilla) {
                $plantilla->assignedUsers()->detach();
                $plantilla->delete();
            }
        });
    }
    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }
    
    /**
     * Check if the user has advisor role.
     *
     * @return bool
     */
    public function isAdvisor(): bool
    {
        return $this->role === 'advisor';
    }

    /**
     * ¿Es el usuario especial de IA (chatbot del chat interno)?
     */
    public function isAi(): bool
    {
        return $this->role === 'ai' || $this->email === self::AI_EMAIL;
    }

    /**
     * Obtener el usuario de IA, si existe.
     */
    public static function aiUser(): ?self
    {
        return static::where('email', self::AI_EMAIL)->first();
    }
    
    /**
     * Check if the user is on duty (receiving all conversations).
     *
     * @return bool
     */
    public function isOnDuty(): bool
    {
        return (bool) $this->is_on_duty;
    }
    
    /**
     * Check if the user is currently online.
     * A user is considered online if they had activity in the last 5 minutes.
     *
     * @return bool
     */
    public function isOnline(): bool
    {
        if (!$this->last_activity_at) {
            return false;
        }
        
        return $this->last_activity_at->diffInMinutes(now()) < 5;
    }
    
    /**
     * Get the online status as a string.
     *
     * @return string
     */
    public function getOnlineStatus(): string
    {
        if ($this->isOnline()) {
            return 'online';
        }
        
        if ($this->last_activity_at) {
            return 'offline';
        }
        
        return 'never';
    }
}