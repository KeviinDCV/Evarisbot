# Configuración de Recordatorios para cPanel

## 📋 Resumen

El sistema de recordatorios está optimizado para funcionar en cPanel sin necesidad de procesos en segundo plano permanentes. Funciona de dos maneras:

1. **Procesamiento Síncrono**: Para hasta 1,000 recordatorios (límite diario de Meta Tier 1), se procesan inmediatamente sin necesidad del queue worker.
2. **Cron Job de Respaldo**: Un cron job procesa periódicamente cualquier job pendiente en la cola.

## ⚙️ Configuración en cPanel

### Paso 1: Configurar el Cron Job

1. Accede a **cPanel** → **Cron Jobs**
2. Agrega un nuevo cron job con la siguiente configuración:

**Frecuencia**: Cada minuto
```
* * * * *
```

**Comando**:
```bash
cd /home/tuusuario/public_html && php artisan reminders:process-queue --limit=50 >> /dev/null 2>&1
```

**O si prefieres cada 5 minutos** (menos carga en el servidor):
```
*/5 * * * *
```

**Comando**:
```bash
cd /home/tuusuario/public_html && php artisan reminders:process-queue --limit=100 >> /dev/null 2>&1
```

> ⚠️ **Importante**: Reemplaza `/home/tuusuario/public_html` con la ruta real de tu proyecto en cPanel.

### Paso 2: Verificar la Ruta del Proyecto

Para encontrar la ruta correcta:
1. En cPanel, ve a **File Manager**
2. Navega hasta la carpeta donde está tu proyecto Laravel
3. La ruta completa será algo como: `/home/tuusuario/public_html/evarisbot` o `/home/tuusuario/evarisbot`

### Paso 3: Verificar Permisos

Asegúrate de que el archivo `artisan` tenga permisos de ejecución:
```bash
chmod +x artisan
```

## 🔧 Cómo Funciona

### Procesamiento Síncrono (Hasta 1,000 recordatorios)

Cuando presionas "Comenzar Envío" en la página de Citas:
- Si hay **1,000 o menos** recordatorios pendientes, se procesan **inmediatamente** de manera síncrona
- No requiere queue worker ni procesos en segundo plano
- Respeta el rate limiting (20 mensajes/minuto por defecto)
- Muestra el progreso en tiempo real

### Procesamiento Asíncrono (Más de 1,000 recordatorios)

Si hay más de 1,000 recordatorios:
- Se crean jobs en la cola
- El cron job los procesa automáticamente cada minuto (o cada 5 minutos según tu configuración)
- Los jobs se procesan respetando el rate limiting

## 📊 Monitoreo

### Ver Jobs Pendientes

Puedes verificar si hay jobs pendientes ejecutando:
```bash
php artisan queue:work --once
```

### Ver Logs

Los logs se guardan en `storage/logs/laravel.log`. Puedes verlos desde cPanel → File Manager → `storage/logs/laravel.log`

## 🚨 Troubleshooting

### Los recordatorios no se envían

1. **Verifica el cron job**: Asegúrate de que esté configurado correctamente en cPanel
2. **Verifica permisos**: El archivo `artisan` debe ser ejecutable
3. **Verifica la ruta**: La ruta en el cron job debe ser correcta
4. **Revisa los logs**: Busca errores en `storage/logs/laravel.log`

### Error: "Queue connection not found"

Asegúrate de que la tabla `jobs` existe en tu base de datos:
```bash
php artisan migrate
```

### Los recordatorios se quedan en "Enviando"

Si tienes menos de 1,000 recordatorios, deberían procesarse inmediatamente. Si se quedan en "Enviando":
1. Verifica que no haya errores en los logs
2. Verifica que el cron job esté corriendo
3. Intenta procesar manualmente: `php artisan reminders:process-queue`

## 💡 Recomendaciones

1. **Para producción**: Configura el cron job para ejecutarse cada minuto con límite de 50 jobs
2. **Para desarrollo**: Puedes ejecutar manualmente `php artisan reminders:process-queue` cuando lo necesites
3. **Monitoreo**: Revisa periódicamente los logs para asegurarte de que todo funciona correctamente

## 📝 Notas Importantes

- El sistema está optimizado para respetar los límites de Meta (1,000 mensajes/día para Tier 1)
- El rate limiting está configurado a 20 mensajes/minuto por defecto (configurable en Settings)
- Los recordatorios se pueden pausar/reanudar desde la interfaz web
- El procesamiento síncrono tiene un timeout máximo de 300 segundos (5 minutos) por job

