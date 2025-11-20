# 🛡️ Instalación Segura de Optimización de Memoria

## ⚠️ IMPORTANTE: Sistema en Producción

Este sistema ya está **funcionando en producción**. Las optimizaciones se instalarán de manera **gradual y controlada** para no interrumpir el servicio.

---

## 📋 Plan de Instalación Gradual

### **Fase 1: Preparación (Sin Riesgo)** ✅

Los siguientes cambios ya están aplicados y son **seguros**:

1. **Eventos optimizados** - Reducen memoria de broadcasting
2. **Archivos de configuración** - Solo configuración, no afectan nada
3. **Scripts de limpieza** - Comandos disponibles pero no se ejecutan solos
4. **Límites de logging** - Optimiza logs futuros, no afecta logs actuales

✅ **Ninguno de estos cambios afecta el funcionamiento actual del sistema.**

---

### **Fase 2: Pruebas Manuales (Recomendado Antes de Automatizar)**

Antes de activar la limpieza automática, prueba manualmente:

#### 1. Ver Qué Se Eliminaría (Modo Dry-Run)

```bash
# Ver mensajes, jobs y sesiones a eliminar
php artisan cleanup:old-data --dry-run

# Ver logs a eliminar
php artisan cleanup:logs --dry-run
```

✅ **Esto NO elimina nada, solo muestra qué haría.**

#### 2. Revisar los Resultados

- ¿Los datos a eliminar son antiguos?
- ¿No hay nada crítico que se vaya a borrar?
- ¿El tamaño liberado es razonable?

#### 3. Ejecutar Limpieza Manual (Primera Vez)

```bash
# Limpiar datos > 30 días
php artisan cleanup:old-data --days=30

# Limpiar logs > 7 días
php artisan cleanup:logs --days=7
```

✅ **Ejecutar durante horario de baja actividad (madrugada).**

#### 4. Verificar Que Todo Funcione

Después de la limpieza manual:
- ¿El chatbot sigue funcionando?
- ¿Se siguen enviando recordatorios?
- ¿Los usuarios pueden usar el sistema?

---

### **Fase 3: Activar Automatización (Solo Después de Pruebas)**

Una vez confirmado que las limpiezas manuales funcionan bien:

#### 1. Agregar Variables de Entorno

Abrir `.env` y agregar **al final**:

```env
# ===== OPTIMIZACIÓN DE MEMORIA (GRADUAL) =====
# Activar solo tareas que ya probaste manualmente

# Activación general
OPTIMIZATION_ENABLED=true

# Limpieza de datos antiguos (probar primero manualmente)
CLEANUP_DATA_ENABLED=true
CLEANUP_DATA_TIME=03:00
CLEANUP_DATA_DAYS=30
CLEANUP_DATA_DRY_RUN=false  # false para que realmente limpie

# Limpieza de logs (probar primero manualmente)
CLEANUP_LOGS_ENABLED=true
CLEANUP_LOGS_TIME=03:30
CLEANUP_LOGS_DAYS=7
CLEANUP_LOGS_DRY_RUN=false  # false para que realmente limpie

# Logging optimizado
LOG_CHANNEL=daily
LOG_LEVEL=info
LOG_DAILY_DAYS=3
```

#### 2. Configurar Task Scheduler de Windows

El sistema usa **Laravel Scheduler** que necesita ejecutarse cada minuto.

**Opción A: Task Scheduler (Recomendado para Windows)**

1. Abrir "Programador de tareas" de Windows
2. Crear tarea básica:
   - **Nombre:** Laravel Scheduler - Evarisbot
   - **Desencadenador:** Diariamente, repetir cada 1 minuto indefinidamente
   - **Acción:** Iniciar programa
     - **Programa:** `C:\xampp\php\php.exe` (ajustar a tu ruta de PHP)
     - **Argumentos:** `artisan schedule:run`
     - **Iniciar en:** `C:\Users\Kechavarro\Documents\GitHub\Evarisbot\evarisbot`
   - **Condiciones:** Desmarcar "Iniciar solo si el equipo está conectado a CA"
   - **Configuración:** Marcar "Permitir ejecución a petición"

**Opción B: Crear Script Automático (Alternativa)**

Crear archivo `start-scheduler.bat`:

```batch
@echo off
:loop
php artisan schedule:run
timeout /t 60 /nobreak > nul
goto loop
```

Ejecutar este archivo al iniciar Windows (agregarlo al inicio de Windows).

#### 3. Verificar Que el Scheduler Funciona

```bash
# Ver última ejecución del scheduler
php artisan schedule:list
```

Debe mostrar las tareas programadas.

#### 4. Monitorear Primeros Días

Revisar logs diariamente en `storage/logs/laravel.log`:

```bash
# Buscar ejecuciones de limpieza
php artisan tail --lines=100 | findstr "Limpieza"
```

---

### **Fase 4: Queue Worker Optimizado**

El queue worker debe reiniciarse periódicamente para liberar memoria.

#### Detener Worker Actual

Si tienes un worker corriendo:

```bash
# Ver procesos PHP
tasklist | findstr php.exe

# Matar proceso específico
taskkill /PID <numero_proceso> /F
```

#### Iniciar Worker Optimizado

Usar el nuevo script `start-queue-worker.bat`:

```batch
# Ejecutar este archivo en lugar del comando anterior
start-queue-worker.bat
```

Este script:
- Limita memoria a 512MB
- Reinicia cada 100 jobs
- Reinicia cada hora
- Timeout de 60 segundos por job

#### Agregar al Inicio de Windows

1. Crear acceso directo a `start-queue-worker.bat`
2. Copiar a `shell:startup` (Win+R, escribir `shell:startup`)
3. El worker se iniciará automáticamente al encender el PC

---

## 🔍 Monitoreo y Verificación

### Ver Estado de Memoria

```bash
# Ver uso de memoria del servidor
systeminfo | findstr "Memoria"
```

### Ver Logs de Optimización

```bash
# Ver últimas 50 líneas del log
php artisan tail --lines=50
```

### Ver Tamaño de Base de Datos

```bash
# En MySQL
SELECT 
    table_schema AS 'Database',
    ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'Size (MB)' 
FROM information_schema.tables 
WHERE table_schema = 'evarisbot'
GROUP BY table_schema;
```

### Ver Tamaño de Logs

```bash
# Ver tamaño de carpeta de logs
dir /s "storage\logs"
```

---

## 🚨 Desactivación de Emergencia

Si algo sale mal, desactivar inmediatamente:

### 1. Desactivar en .env

```env
OPTIMIZATION_ENABLED=false
CLEANUP_DATA_ENABLED=false
CLEANUP_LOGS_ENABLED=false
```

### 2. Limpiar Caché de Config

```bash
php artisan config:clear
php artisan config:cache
```

### 3. Verificar Que Se Desactivó

```bash
php artisan schedule:list
```

Las tareas de limpieza no deben aparecer en la lista.

---

## 📊 Resultados Esperados

Después de implementar las optimizaciones:

### Inmediato (Fase 1)
- ✅ Broadcasting: ~90% menos memoria
- ✅ Logs: Rotación automática cada 3 días
- ✅ Worker: Reinicio automático cada hora

### Primeros 7 Días (Fase 3)
- ✅ Logs: Reducción de ~70%
- ✅ BD: Limpieza de jobs antiguos
- ✅ Sesiones expiradas eliminadas

### Después de 30 Días (Fase 3)
- ✅ Mensajes antiguos purgados
- ✅ BD optimizada (VACUUM)
- ✅ Uso estable de memoria (~2-3GB en vez de 10GB)

---

## 📞 Soporte

Si tienes dudas o problemas durante la instalación:

1. Revisa los logs: `storage/logs/laravel.log`
2. Ejecuta comandos en modo `--dry-run` primero
3. No actives automatización hasta estar seguro

---

## ✅ Checklist de Instalación

- [ ] Fase 1: Archivos de configuración creados
- [ ] Fase 2: Pruebas manuales exitosas (`--dry-run`)
- [ ] Fase 2: Limpieza manual sin errores
- [ ] Fase 2: Sistema funciona normalmente después de limpieza
- [ ] Fase 3: Variables agregadas a `.env`
- [ ] Fase 3: Laravel Scheduler configurado en Windows
- [ ] Fase 3: Primeras ejecuciones automáticas verificadas
- [ ] Fase 4: Worker optimizado iniciado
- [ ] Monitoreo: Logs revisados diariamente primera semana

---

**Fecha de instalación:** _______________
**Instalado por:** _______________
**Notas:** _______________
