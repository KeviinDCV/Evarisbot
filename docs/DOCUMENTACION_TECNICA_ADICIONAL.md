# Documentación Técnica Adicional - Evarisbot
## Secciones 12-17: Producción, Seguridad, Monitoreo y Mantenimiento

**Versión:** 1.0  
**Fecha:** Noviembre 2024

---

## 12. Configuración de Producción

### 12.1 Variables de Entorno de Producción

**Diferencias críticas entre desarrollo y producción:**

```env
# PRODUCCIÓN
APP_ENV=production
APP_DEBUG=false                    # NUNCA true en producción
APP_URL=https://evarisbot.dominio.com

# DESARROLLO
APP_ENV=local
APP_DEBUG=true
APP_URL=http://localhost:8000
```

### 12.2 Optimizaciones de Laravel

```bash
# Ejecutar en producción después de cada deploy
php artisan config:cache      # Cachea configuraciones
php artisan route:cache       # Cachea rutas
php artisan view:cache        # Cachea vistas Blade
php artisan event:cache       # Cachea listeners de eventos

# Para limpiar cachés (en desarrollo o troubleshooting)
php artisan config:clear
php artisan route:clear
php artisan view:clear
php artisan cache:clear
```

### 12.3 Configuración de OPcache

**Archivo:** `/etc/php/8.2/fpm/conf.d/10-opcache.ini`

```ini
opcache.enable=1
opcache.memory_consumption=256
opcache.interned_strings_buffer=16
opcache.max_accelerated_files=10000
opcache.revalidate_freq=60
opcache.fast_shutdown=1
opcache.validate_timestamps=1  # 0 en producción para máximo rendimiento
```

### 12.4 Configuración de PHP

**Archivo:** `/etc/php/8.2/fpm/php.ini`

```ini
max_execution_time = 300
max_input_time = 300
memory_limit = 512M
post_max_size = 100M
upload_max_filesize = 100M
max_file_uploads = 20

# Seguridad
expose_php = Off
display_errors = Off
log_errors = On
error_log = /var/log/php/error.log

# Session
session.cookie_httponly = 1
session.cookie_secure = 1
session.cookie_samesite = Lax
```

---

## 13. Seguridad

### 13.1 Headers de Seguridad

**Nginx Configuration:**

```nginx
# Agregar en bloque server
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

### 13.2 Protección CSRF

**Laravel incluye protección CSRF por defecto:**

```php
// En formularios Blade
@csrf

// En requests Inertia
import { useForm } from '@inertiajs/react';

const { post } = useForm();
post('/ruta', data); // Token CSRF incluido automáticamente
```

**Excepciones (rutas que no requieren CSRF):**

```php
// app/Http/Middleware/VerifyCsrfToken.php
protected $except = [
    'webhook/whatsapp', // Webhook de Meta no puede incluir CSRF
];
```

### 13.3 Rate Limiting

**Configuración:** `app/Http/Kernel.php`

```php
protected $middlewareAliases = [
    'throttle' => \Illuminate\Routing\Middleware\ThrottleRequests::class,
];
```

**Uso en Rutas:**

```php
// Login: 5 intentos por minuto
Route::post('/login', [AuthController::class, 'login'])
    ->middleware('throttle:5,1');

// API: 60 requests por minuto
Route::middleware('throttle:60,1')->group(function () {
    // Rutas de API
});
```

### 13.4 Validación de Entrada

**Form Requests:**

```php
// app/Http/Requests/SendMessageRequest.php
public function rules()
{
    return [
        'message' => 'required|string|max:4096',
        'conversation_id' => 'required|exists:conversations,id',
    ];
}

public function messages()
{
    return [
        'message.required' => 'El mensaje es obligatorio',
        'message.max' => 'El mensaje no puede exceder 4096 caracteres',
    ];
}
```

### 13.5 SQL Injection Prevention

**Laravel Eloquent previene SQL injection:**

```php
// SEGURO - Eloquent escapa automáticamente
$users = User::where('email', $email)->get();

// SEGURO - Query Builder con bindings
DB::select('select * from users where email = ?', [$email]);

// PELIGROSO - Raw queries sin escape
// NUNCA HACER: DB::select("select * from users where email = '$email'");
```

### 13.6 XSS Prevention

**Blade escapa automáticamente:**

```php
<!-- SEGURO - Escapado automático -->
{{ $user->name }}

<!-- PELIGROSO - Sin escapar (solo si confías en la fuente) -->
{!! $html_content !!}
```

**React:**

```typescript
// SEGURO - React escapa por defecto
<div>{user.name}</div>

// PELIGROSO - dangerouslySetInnerHTML
<div dangerouslySetInnerHTML={{ __html: content }} />
```

### 13.7 Firewall (UFW)

```bash
# Habilitar UFW
sudo ufw enable

# Permitir SSH
sudo ufw allow 22/tcp

# Permitir HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Denegar todo lo demás por defecto
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Ver estado
sudo ufw status verbose
```

### 13.8 Fail2Ban (Protección contra fuerza bruta)

```bash
# Instalar
sudo apt install fail2ban

# Configurar
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo nano /etc/fail2ban/jail.local
```

```ini
[nginx-limit-req]
enabled = true
filter = nginx-limit-req
action = iptables-multiport[name=ReqLimit, port="http,https", protocol=tcp]
logpath = /var/log/nginx/evarisbot-error.log
findtime = 600
bantime = 7200
maxretry = 10
```

---

## 14. Monitoreo y Logs

### 14.1 Laravel Logs

**Configuración:** `config/logging.php`

```php
'channels' => [
    'stack' => [
        'driver' => 'stack',
        'channels' => ['daily', 'slack'],
        'ignore_exceptions' => false,
    ],

    'daily' => [
        'driver' => 'daily',
        'path' => storage_path('logs/laravel.log'),
        'level' => env('LOG_LEVEL', 'info'),
        'days' => 14,  // Retener 14 días
    ],
],
```

**Uso en Código:**

```php
use Illuminate\Support\Facades\Log;

// Diferentes niveles
Log::emergency('Sistema caído');
Log::alert('Acción inmediata requerida');
Log::critical('Condición crítica');
Log::error('Error que no detiene la aplicación');
Log::warning('Advertencia');
Log::notice('Evento normal pero significativo');
Log::info('Información general');
Log::debug('Información de debugging');

// Con contexto
Log::info('Usuario creado', [
    'user_id' => $user->id,
    'email' => $user->email,
]);
```

**Ver Logs en Tiempo Real:**

```bash
# Laravel Pail (recomendado)
php artisan pail

# Tail tradicional
tail -f storage/logs/laravel.log

# Filtrar errores
tail -f storage/logs/laravel.log | grep ERROR
```

### 14.2 Nginx Logs

```bash
# Access log
tail -f /var/log/nginx/evarisbot-access.log

# Error log
tail -f /var/log/nginx/evarisbot-error.log

# Analizar accesos más frecuentes
awk '{print $1}' /var/log/nginx/evarisbot-access.log | sort | uniq -c | sort -rn | head -20
```

### 14.3 MySQL Slow Query Log

**Habilitar:**

```sql
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 2;  -- Queries > 2 segundos
SET GLOBAL slow_query_log_file = '/var/log/mysql/slow-query.log';
```

**Analizar:**

```bash
# Ver queries lentas
sudo mysqldumpslow /var/log/mysql/slow-query.log
```

### 14.4 Monitoreo de Sistema

**Herramientas Recomendadas:**

1. **htop** - Monitor de recursos

```bash
sudo apt install htop
htop
```

2. **iotop** - Monitor de I/O

```bash
sudo apt install iotop
sudo iotop
```

3. **nethogs** - Monitor de red

```bash
sudo apt install nethogs
sudo nethogs
```

### 14.5 Laravel Horizon (Opcional - Para colas con Redis)

```bash
# Instalar
composer require laravel/horizon

# Publicar configuración
php artisan horizon:install

# Iniciar
php artisan horizon
```

Dashboard: `https://evarisbot.dominio.com/horizon`

### 14.6 Alertas por Email

**Configurar canal Slack en logs:**

```php
// config/logging.php
'slack' => [
    'driver' => 'slack',
    'url' => env('LOG_SLACK_WEBHOOK_URL'),
    'username' => 'Evarisbot Log',
    'emoji' => ':boom:',
    'level' => 'error',
],
```

**Enviar alerta crítica:**

```php
Log::channel('slack')->critical('Error crítico en producción', [
    'error' => $exception->getMessage(),
    'trace' => $exception->getTraceAsString(),
]);
```

---

## 15. Mantenimiento

### 15.1 Rotación de Logs

**Laravel Logs** (automática con driver 'daily'):

```php
// config/logging.php
'daily' => [
    'driver' => 'daily',
    'path' => storage_path('logs/laravel.log'),
    'level' => 'info',
    'days' => 14,  // Automático
],
```

**Nginx Logs** (con logrotate):

```bash
# /etc/logrotate.d/nginx
/var/log/nginx/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        [ -f /var/run/nginx.pid ] && kill -USR1 `cat /var/run/nginx.pid`
    endscript
}
```

### 15.2 Limpieza de Base de Datos

**Limpiar sesiones antiguas:**

```bash
php artisan session:gc
```

**Limpiar jobs fallidos antiguos:**

```sql
DELETE FROM failed_jobs WHERE failed_at < NOW() - INTERVAL 30 DAY;
```

**Limpiar mensajes antiguos (opcional):**

```sql
-- CUIDADO: Evaluar política de retención antes de ejecutar
DELETE FROM messages WHERE created_at < NOW() - INTERVAL 1 YEAR;
```

### 15.3 Optimización de Base de Datos

```sql
# Optimizar tablas
OPTIMIZE TABLE conversations, messages, appointments, users;

# Analizar tablas
ANALYZE TABLE conversations, messages;

# Ver tamaño de tablas
SELECT 
    table_name AS 'Table',
    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)'
FROM information_schema.TABLES
WHERE table_schema = 'evarisbot_production'
ORDER BY (data_length + index_length) DESC;
```

### 15.4 Actualizaciones

**Proceso de Actualización:**

```bash
# 1. Backup completo
/home/deploy/backup-db.sh
tar -czf ~/evarisbot-backup-$(date +%Y%m%d).tar.gz /var/www/evarisbot

# 2. Modo mantenimiento
php artisan down --message="Actualización en progreso" --retry=60

# 3. Pull cambios
git pull origin main

# 4. Actualizar dependencias
composer install --no-dev --optimize-autoloader
npm install
npm run build

# 5. Migraciones
php artisan migrate --force

# 6. Limpiar cachés
php artisan config:clear
php artisan cache:clear
php artisan view:clear

# 7. Recrear cachés
php artisan config:cache
php artisan route:cache
php artisan view:cache

# 8. Reiniciar servicios
sudo systemctl restart php8.2-fpm
sudo supervisorctl restart evarisbot-worker:*

# 9. Salir de mantenimiento
php artisan up
```

### 15.5 Tareas Programadas (Scheduler)

**Definir en:** `app/Console/Kernel.php`

```php
protected function schedule(Schedule $schedule)
{
    // Limpiar sesiones expiradas (diario)
    $schedule->command('session:gc')->daily();

    // Enviar recordatorios de citas (cada hora)
    $schedule->command('reminders:send')->hourly();

    // Generar reporte diario (6 AM)
    $schedule->command('report:daily')->dailyAt('06:00');

    // Backup de BD (2 AM)
    $schedule->command('backup:database')->dailyAt('02:00');

    // Limpiar logs antiguos (semanal)
    $schedule->command('log:clean')->weekly();
}
```

---

## 16. Troubleshooting

### 16.1 Problemas Comunes

#### Página en Blanco / Error 500

**Diagnóstico:**

```bash
# Ver logs de Laravel
tail -100 storage/logs/laravel.log

# Ver logs de Nginx
tail -100 /var/log/nginx/evarisbot-error.log

# Ver logs de PHP
tail -100 /var/log/php8.2-fpm.log
```

**Soluciones:**

```bash
# Limpiar cachés
php artisan config:clear
php artisan cache:clear
php artisan view:clear

# Verificar permisos
sudo chown -R www-data:www-data storage bootstrap/cache
sudo chmod -R 775 storage bootstrap/cache

# Regenerar autoload
composer dump-autoload
```

#### Mensajes no se Envían

**Diagnóstico:**

```bash
# Verificar worker de cola
sudo supervisorctl status evarisbot-worker:*

# Ver jobs fallidos
php artisan queue:failed

# Ver logs del worker
tail -f storage/logs/worker.log
```

**Soluciones:**

```bash
# Reiniciar worker
sudo supervisorctl restart evarisbot-worker:*

# Reintentar jobs fallidos
php artisan queue:retry all

# Verificar configuración de WhatsApp
php artisan tinker
> app(\App\Services\WhatsAppService::class)->isConfigured()
```

#### Webhook no Funciona

**Diagnóstico:**

```bash
# Test manual del webhook
curl "https://evarisbot.dominio.com/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=TEST"

# Ver logs
tail -f storage/logs/laravel.log | grep webhook
```

**Soluciones:**

1. Verificar que WHATSAPP_VERIFY_TOKEN en `.env` coincide con Meta
2. Verificar que la URL es accesible públicamente
3. Verificar certificado SSL válido
4. Revisar firewall no está bloqueando IPs de Meta

#### Assets no Cargan (CSS/JS)

**Diagnóstico:**

```bash
# Verificar que los assets fueron compilados
ls -la public/build

# Ver errores de Vite
npm run build
```

**Soluciones:**

```bash
# Recompilar assets
npm install
npm run build

# Limpiar caché del navegador
# o agregar versioning en manifest
```

### 16.2 Comandos Útiles de Debugging

```bash
# Ver configuración activa
php artisan config:show

# Ver rutas registradas
php artisan route:list

# Ver información de la BD
php artisan db:show

# Test de conexión a BD
php artisan db:monitor

# Limpiar todo
php artisan optimize:clear

# Ver eventos y listeners
php artisan event:list

# Ejecutar tinker (REPL de Laravel)
php artisan tinker
```

### 16.3 Monitoreo de Rendimiento

**Identificar Queries Lentas:**

```php
// Agregar en AppServiceProvider::boot()
DB::listen(function ($query) {
    if ($query->time > 100) { // > 100ms
        Log::warning('Slow query', [
            'sql' => $query->sql,
            'bindings' => $query->bindings,
            'time' => $query->time,
        ]);
    }
});
```

**Laravel Debugbar (solo desarrollo):**

```bash
composer require barryvdh/laravel-debugbar --dev
```

---

## 17. Roadmap y Mejoras Futuras

### 17.1 Corto Plazo (1-3 meses)

**Features:**

1. **Notificaciones en Tiempo Real**
   - Implementar Laravel Reverb completamente
   - Notificaciones de nuevos mensajes sin recargar
   - Indicadores de "escribiendo..."

2. **Mejoras en Plantillas**
   - Editor visual de plantillas
   - Más variables dinámicas
   - Plantillas con botones interactivos

3. **Dashboard Mejorado**
   - Gráficos más interactivos
   - Métricas en tiempo real
   - Comparativas período anterior

**Técnico:**

1. **Tests Automatizados**
   - Unit tests para servicios críticos
   - Feature tests para flujos principales
   - CI/CD con GitHub Actions

2. **Optimización**
   - Implementar Redis para caché
   - Eager loading en consultas complejas
   - Índices de BD adicionales

### 17.2 Mediano Plazo (3-6 meses)

**Features:**

1. **Multi-canal**
   - Integración con Facebook Messenger
   - Integración con Instagram Direct
   - Vista unificada de todos los canales

2. **Chatbot Básico**
   - Respuestas automáticas por palabras clave
   - Horarios de atención automáticos
   - Menú interactivo

3. **CRM Básico**
   - Perfiles de pacientes
   - Historial médico básico
   - Seguimiento de casos

**Técnico:**

1. **Escalabilidad**
   - Migrar colas a Redis
   - Implementar load balancing
   - Separar servidor de BD

2. **Monitoreo Avanzado**
   - Implementar Sentry para errores
   - Métricas con Prometheus + Grafana
   - APM (Application Performance Monitoring)

### 17.3 Largo Plazo (6-12 meses)

**Features:**

1. **IA y Automatización**
   - Chatbot con NLP (OpenAI/Claude)
   - Categorización automática de mensajes
   - Sugerencias de respuestas

2. **Analytics Avanzado**
   - Predicción de carga
   - Análisis de sentimiento
   - Reportes personalizables

3. **Multi-tenant**
   - Soportar múltiples organizaciones
   - Aislamiento de datos
   - Configuración por tenant

**Técnico:**

1. **Microservicios (Opcional)**
   - Separar servicio de WhatsApp
   - API Gateway
   - Event-driven architecture

2. **DevOps Avanzado**
   - Kubernetes para orquestación
   - Auto-scaling
   - Disaster recovery completo

### 17.4 Mejoras de Seguridad

- [ ] Implementar auditoría completa de acciones
- [ ] Rotación automática de tokens
- [ ] Penetration testing
- [ ] GDPR/compliance completo
- [ ] Encriptación de mensajes en reposo

### 17.5 Mejoras de UX

- [ ] PWA (Progressive Web App)
- [ ] Modo oscuro
- [ ] Accesibilidad mejorada (WCAG 2.1)
- [ ] Mobile app nativa (React Native)
- [ ] Búsqueda avanzada con filtros

---

**© 2024 - Evarisbot - Sistema de Gestión de WhatsApp Business**

**Última actualización:** Noviembre 2024  
**Versión de la Documentación:** 1.0

Para consultas técnicas: tecnico@dominio.com
