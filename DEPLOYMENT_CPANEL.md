# 📦 Despliegue en cPanel

## ✅ Sistema configurado para cPanel

Esta aplicación está configurada para funcionar en **hosting compartido cPanel** sin necesidad de WebSockets o procesos en background.

---

## 🔄 Actualización en Tiempo Real

### ¿Cómo funciona?

En lugar de WebSockets (que NO funcionan en cPanel), usamos **POLLING**:

- **Cada 3 segundos** el navegador consulta automáticamente si hay mensajes nuevos
- **Solo cuando hay un chat abierto** (no consume recursos innecesarios)
- **Compatible al 100% con cPanel** - No requiere configuración adicional

### Ventajas del Polling en cPanel:

✅ **Funciona en cualquier hosting compartido**  
✅ **No requiere servicios adicionales**  
✅ **No necesita configuración especial**  
✅ **Gratis - sin costos adicionales**  

### Desventajas:

⚠️ Demora de hasta 3 segundos (en WebSockets es instantáneo)  
⚠️ Más consumo de ancho de banda (pero mínimo)

---

## 📁 Archivos que NO se usan en cPanel

Los siguientes archivos fueron creados para WebSockets pero **NO se usan** en cPanel:

- `app/Events/MessageSent.php` - Evento de broadcasting (solo para WebSockets)
- `resources/js/echo.ts` - Configuración de Echo (comentado)
- Comandos `php artisan reverb:start` - NO ejecutar en cPanel

**Estos archivos se mantienen por si en el futuro migras a un servidor VPS con soporte WebSockets.**

---

## 🚀 Pasos para Subir a cPanel

### 1. **Comprimir tu proyecto**

Excluye estas carpetas:
- `node_modules/`
- `vendor/`
- `.git/`

### 2. **Subir archivos**

En cPanel File Manager:
- Sube el ZIP a `/home/tuusuario/`
- Extrae el ZIP
- Mueve el contenido de `public/` a `public_html/`

### 3. **Instalar dependencias**

En Terminal de cPanel:

```bash
cd /home/tuusuario/evarisbot
composer install --no-dev --optimize-autoloader
```

### 4. **Configurar Base de Datos**

En cPanel:
1. Crear base de datos MySQL
2. Crear usuario y asignar privilegios
3. Actualizar `.env`:

```env
DB_CONNECTION=mysql
DB_HOST=localhost
DB_DATABASE=nombre_db
DB_USERNAME=usuario_db
DB_PASSWORD=password_db
```

### 5. **Configurar `.env`**

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://tudominio.com

# IMPORTANTE: Broadcasting deshabilitado
BROADCAST_CONNECTION=null

# Queue: usar sync en cPanel (no database)
QUEUE_CONNECTION=sync
```

### 6. **Generar APP_KEY**

```bash
php artisan key:generate
```

### 7. **Migraciones**

```bash
php artisan migrate --force
```

### 8. **Optimizar**

```bash
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

### 9. **Build Assets**

En tu local (antes de subir):

```bash
npm run build
```

Esto genera la carpeta `public/build/` que debes subir a cPanel.

---

## ⚙️ Configuración de WhatsApp

En la aplicación:
1. Login como admin
2. Ve a **Configuración**
3. Ingresa credenciales de WhatsApp Business API

---

## 🔧 Mantenimiento

### Actualizar código:

```bash
php artisan down
# Subir archivos nuevos
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan up
```

### Ver logs de errores:

En cPanel File Manager:
- `/storage/logs/laravel.log`

---

## 💡 Notas Importantes

1. **No corras `php artisan reverb:start`** - No funcionará en cPanel
2. **El tiempo real funciona con polling** - Es normal que tarde 2-3 segundos
3. **QUEUE_CONNECTION=sync** - Los jobs se ejecutan inmediatamente
4. **Si quieres tiempo real instantáneo** - Necesitas un VPS con Reverb/Pusher

---

## 🆘 Problemas Comunes

### "Página en blanco"
- Verifica permisos: `chmod -R 755 storage bootstrap/cache`
- Revisa `.env` esté configurado correctamente

### "Mensajes no se actualizan"
- Verifica que el polling esté activo (abre consola del navegador)
- Revisa que no haya errores JavaScript

### "Error 500"
- Revisa `storage/logs/laravel.log`
- Verifica que `APP_KEY` esté generado
- Confirma permisos de carpetas

---

## 📞 ¿Migrar a VPS en el futuro?

Si más adelante quieres **tiempo real instantáneo**:

1. Migra a un VPS (DigitalOcean, AWS, etc.)
2. Descomenta `import './echo'` en `app.tsx`
3. Reemplaza polling por WebSocket listener
4. Corre `php artisan reverb:start` con supervisor
5. Configura `.env` con credenciales de Reverb

---

**✅ ¡Todo listo para cPanel!** 🎉
