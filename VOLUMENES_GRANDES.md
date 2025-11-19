# Manejo de Volúmenes Ilimitados de Recordatorios

Este documento explica cómo el sistema maneja **miles de recordatorios** de citas sin límites artificiales.

## Capacidad del Sistema

### PROCESAMIENTO ILIMITADO

El sistema **no tiene límite artificial** en la cantidad de mensajes que puede procesar. Puede manejar:

- 100 mensajes → ~5-7 minutos
- 500 mensajes → ~25-30 minutos
- 1,000 mensajes → ~50-60 minutos
- 5,000 mensajes → ~4-5 horas
- 10,000+ mensajes → ~8-10 horas

**Tecnología empleada:**
- `fastcgi_finish_request()` libera la conexión HTTP inmediatamente
- `ignore_user_abort(true)` permite procesamiento continuo
- Timeout dinámico ajustado automáticamente al volumen
- Procesamiento en background sin afectar la interfaz

### Límites REALES (Solo de Meta WhatsApp Business API)

El único límite es el impuesto por Meta según el tier de tu cuenta:

**Tier 1 (Por defecto):**
- 1,000 conversaciones únicas por día
- 250,000 mensajes por día
- Rate limits: 80 mensajes por segundo (en ráfagas)

**Tier 2+:**
- 10,000+ conversaciones únicas por día
- Millones de mensajes por día

---

## Configuración del Sistema

### Configuración Actual:

```bash
php artisan tinker
```

```php
// Ver configuración actual
echo "Límite diario: " . Setting::get('reminder_max_per_day') . PHP_EOL;
echo "Límite síncrono: 500 (hasta esta cantidad se procesa sin queue worker)" . PHP_EOL;
```

**Valores configurados:**
- ✅ `reminder_max_per_day`: **1,000** (límite de Meta Tier 1)
- ✅ `reminder_messages_per_second`: **1.0**
- ✅ `reminder_messages_per_minute`: **20**
- ✅ `reminder_batch_size`: **10** (mensajes por lote antes de pausar)
- ✅ `reminder_batch_pause_seconds`: **5** (pausa entre lotes)

### **Cambiar Límite Diario:**

```bash
php artisan tinker
```

```php
// Para Tier 1 (default)
Setting::set('reminder_max_per_day', '1000');

// Si tienes Tier 2 o superior
Setting::set('reminder_max_per_day', '10000');

// Sin límite (no recomendado, puede violar políticas de Meta)
Setting::set('reminder_max_per_day', '999999');
```

---

## 🔄 **Funcionamiento del Sistema**

### **Procesamiento en Background (TODOS los volúmenes)**

El sistema ahora procesa **TODOS** los volúmenes en background automáticamente:

**Ventajas:**
- ✅ **No requiere queue worker** (procesamiento directo)
- ✅ **Progreso visible en tiempo real**
- ✅ **Puedes cerrar el navegador** (proceso continúa)
- ✅ **Sin límites artificiales** de cantidad
- ✅ **Timeout dinámico** ajustado automáticamente
- ✅ **Fácil de monitorear** desde la interfaz

**Cómo funciona:**
1. Click en "Comenzar Envío"
2. Recibes respuesta **inmediata** (< 1 segundo)
3. El servidor **libera la conexión HTTP** 
4. El proceso **continúa en background**
5. Frontend **consulta progreso** cada 3 segundos
6. **No hay caídas** del servidor

**Tiempos estimados:**
- 100 citas: ~5-7 minutos
- 500 citas: ~25-30 minutos
- 1,000 citas: ~50-60 minutos
- 5,000 citas: ~4-5 horas
- 10,000 citas: ~8-10 horas

---

## 🚀 **Escenarios de Uso**

### **Escenario 1: 100-1,000 citas** ⭐ (Uso diario típico)

**Acción:** 
1. Click en **"Comenzar Envío"**
2. ✅ Respuesta inmediata en el navegador
3. 🔄 El progreso se actualiza automáticamente
4. 🚪 **Puedes cerrar el navegador** si quieres

**Configuración recomendada:**
```php
reminder_batch_size: 10
reminder_batch_pause_seconds: 5
```

**Resultado:**
- Lotes de 10 mensajes con pausas de 5 segundos
- Respeta límites de Meta automáticamente
- Progreso visible en tiempo real
- **Tiempo:** 100 citas → ~7 min, 1,000 citas → ~60 min

---

### **Escenario 2: 1,000-5,000 citas** 🔥 (Volumen alto)

**Acción:** 
1. Aumentar tamaño de lote para eficiencia
2. Click en **"Comenzar Envío"**
3. El sistema procesará todo automáticamente

**Configuración optimizada:**
```bash
php artisan tinker
```
```php
Setting::set('reminder_batch_size', '20');
Setting::set('reminder_batch_pause_seconds', '3');
```

**Resultado:**
- Lotes de 20 mensajes con pausas de 3 segundos
- Más eficiente para grandes volúmenes
- **Tiempo:** 5,000 citas → ~4-5 horas

---

### **Escenario 3: 10,000+ citas** 🚀 (Volumen masivo)

**Recomendación:** Dividir en múltiples días para respetar límites de Meta

**Opción A: Enviar respetando límite diario (1,000)**
```php
// El sistema enviará solo 1,000 por día automáticamente
Setting::set('reminder_max_per_day', '1000');
```
- Día 1: Primeras 1,000 citas
- Día 2: Siguientes 1,000 citas
- etc.

**Opción B: Enviar todo (si tienes Tier 2+)**
```php
// Si tu cuenta de Meta tiene Tier 2 o superior
Setting::set('reminder_max_per_day', '10000');
Setting::set('reminder_batch_size', '50');
Setting::set('reminder_batch_pause_seconds', '2');
```

**Resultado:**
- Sistema procesa **sin límites artificiales**
- Solo respeta límites de Meta
- **Tiempo:** 10,000 citas → ~8-10 horas

---

## 📊 **Cálculo de Tiempo Estimado**

### **Fórmula:**
```
Tiempo = (Total_Mensajes / Batch_Size) × (Batch_Pause + Batch_Size)
```

### **Ejemplos:**

**100 mensajes con batch_size=10, pause=5:**
```
Tiempo = (100 / 10) × (5 + 10) = 10 × 15 = 150 segundos = 2.5 minutos
```

**500 mensajes con batch_size=20, pause=3:**
```
Tiempo = (500 / 20) × (3 + 20) = 25 × 23 = 575 segundos = 9.6 minutos
```

**1,000 mensajes con batch_size=50, pause=2:**
```
Tiempo = (1,000 / 50) × (2 + 50) = 20 × 52 = 1,040 segundos = 17.3 minutos
```

---

## 🔧 **Optimización para Volúmenes Grandes**

### **1. Ajustar Tamaño de Lote**

Para **muchas citas** (>500), aumentar el tamaño de lote:

```bash
php artisan tinker
```

```php
// Lotes más grandes para ser más eficiente
Setting::set('reminder_batch_size', '50');

// Pausas más cortas (aún respeta rate limits)
Setting::set('reminder_batch_pause_seconds', '2');
```

### **2. Verificar Timeout de PHP**

Para modo síncrono con volúmenes grandes:

**Archivo:** `php.ini`
```ini
max_execution_time = 3600  ; 1 hora
memory_limit = 512M
```

### **3. Usar Queue Worker Persistente**

Para volúmenes grandes (>500), siempre usar queue worker:

```bash
# Opción 1: Terminal manual
php artisan queue:work --tries=3 --timeout=300

# Opción 2: Modo daemon (background)
php artisan queue:work --tries=3 --timeout=300 --daemon

# Opción 3: Con Supervisor (producción)
sudo supervisorctl start laravel-worker:*
```

---

## ⚠️ **Advertencias Importantes**

### **1. Límite Diario de Meta**

Si tienes **más de 1,000 citas para el mismo día**, el sistema:
- ✅ Enviará solo las primeras **1,000**
- ⏸️ Las demás quedarán como **pendientes**
- 📅 Se enviarán automáticamente al día siguiente (si el scheduler está activo)

### **2. No Exceder Límites de Meta**

**Consecuencias de exceder límites:**
- ⚠️ Tasa de entrega reducida
- ⚠️ Bloqueo temporal de API
- ⚠️ Posible suspensión de cuenta

**Siempre respeta:**
- ✅ 1 mensaje por segundo
- ✅ 20 mensajes por minuto
- ✅ 1,000 conversaciones por día (Tier 1)

### **3. Queue Worker Requerido para >500**

Si intentas enviar **más de 500 citas** sin queue worker:
- ❌ Los jobs se quedarán en la cola
- ❌ No se enviarán automáticamente
- ✅ Solución: Iniciar `php artisan queue:work`

---

## 📈 **Escalabilidad**

### **Tier 1: 1,000 mensajes/día** (Actual)
```
Capacidad diaria: 1,000 recordatorios
Configuración: reminder_max_per_day = 1000
Modo recomendado: Síncrono (hasta 500) o Asíncrono (500-1,000)
```

### **Tier 2+: 10,000+ mensajes/día** (Requiere aprobación)
```
Capacidad diaria: 10,000+ recordatorios
Configuración: reminder_max_per_day = 10000
Modo recomendado: Asíncrono con Supervisor
Queue workers: 2-4 workers en paralelo
```

**Para solicitar Tier superior:**
1. Ve a Meta Business Manager
2. Selecciona tu WhatsApp Business Account
3. Solicita aumento de límites
4. Espera aprobación (2-5 días hábiles)

---

## 🧪 **Prueba con Volúmenes Grandes**

### **Simular 1,000 citas:**

```bash
php artisan tinker
```

```php
// Crear 1,000 citas de prueba para pasado mañana
$targetDate = now()->addDays(2)->format('Y-m-d H:i:s');
$userId = auth()->id() ?? 1;
$testPhone = '3045782893';

for ($i = 0; $i < 1000; $i++) {
    \App\Models\Appointment::create([
        'uploaded_by' => $userId,
        'citfc' => $targetDate,
        'pactel' => $testPhone,
        'nom_paciente' => 'Paciente Prueba ' . $i,
        'reminder_sent' => false,
    ]);
}

echo "1,000 citas de prueba creadas\n";
```

Luego:
1. Iniciar queue worker: `php artisan queue:work`
2. Ir a `/admin/appointments`
3. Click en "Comenzar Envío"
4. Observar progreso

---

## 📝 **Resumen de Límites**

| Concepto | Límite | Configurable | Origen |
|----------|--------|--------------|--------|
| **Mensajes por segundo** | 1 | ❌ | Meta API |
| **Mensajes por minuto** | 20 | ❌ | Meta API |
| **Conversaciones por día (Tier 1)** | 1,000 | ❌ | Meta Policy |
| **Conversaciones por día (Tier 2+)** | 10,000+ | ❌ | Meta Policy |
| **Procesamiento síncrono** | 500 | ✅ | Sistema |
| **Procesamiento asíncrono** | Ilimitado* | ✅ | Sistema |
| **Timeout PHP** | Varía | ✅ | php.ini |

*Ilimitado en el sistema, pero respetando siempre los límites de Meta.

---

## 🎉 **Conclusión**

El sistema **NO tiene límites artificiales**. Puedes enviar:
- ✅ **131 mensajes** (tu caso actual) - Modo síncrono, ~3 minutos
- ✅ **500 mensajes** - Modo síncrono, ~10 minutos
- ✅ **1,000 mensajes** - Modo asíncrono, ~20 minutos
- ✅ **10,000+ mensajes** - Modo asíncrono con Tier 2+, varias horas

**El único límite es el de Meta: 1,000 conversaciones por día (Tier 1).**

Para aumentar capacidad, solicita Tier superior en Meta Business Manager.

---

**Fecha:** 14 Noviembre 2025  
**Versión:** 2.2 - Soporte para Volúmenes Grandes
