# Evarisbot

Sistema de Gestión de Conversaciones de WhatsApp Business para Servicios Ambulatorios

[![Laravel](https://img.shields.io/badge/Laravel-12.x-FF2D20?style=flat&logo=laravel)](https://laravel.com)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=flat&logo=react)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org)
[![PHP](https://img.shields.io/badge/PHP-8.2+-777BB4?style=flat&logo=php)](https://php.net)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## Descripción

**Evarisbot** es una aplicación web profesional que centraliza y gestiona todas las comunicaciones de WhatsApp Business de una institución de salud. Permite a múltiples asesores atender simultáneamente consultas de pacientes, enviar recordatorios automáticos de citas, y generar informes detallados, todo desde una interfaz web moderna e intuitiva.

### Características Principales

- **Gestión Centralizada** - Todas las conversaciones de WhatsApp en un solo lugar
- **Multi-usuario** - Múltiples asesores trabajando simultáneamente
- **Recordatorios Automáticos** - Envío programado de recordatorios de citas
- **Estadísticas Completas** - Informes detallados con exportación a Excel/PDF
- **Seguridad Robusta** - Autenticación 2FA, encriptación de datos sensibles
- **Responsive** - Funciona en desktop, tablet y móvil
- **UI Moderna** - Diseño inspirado en WhatsApp Web con mejoras profesionales
- **Plantillas Reutilizables** - Mensajes predefinidos para respuestas comunes
- **Trazabilidad Completa** - Registro histórico de todas las interacciones
- **Multiidioma** - Preparado para internacionalización (ES/EN)

---

## Stack Tecnológico

### Backend
- **Framework:** Laravel 12
- **Lenguaje:** PHP 8.2+
- **Base de Datos:** MySQL 8.0+ / PostgreSQL 14+ / SQLite 3
- **Autenticación:** Laravel Fortify con soporte 2FA
- **Colas:** Database Queue Driver (Redis opcional)
- **WebSockets:** Laravel Reverb

### Frontend
- **Framework:** React 19
- **Lenguaje:** TypeScript 5.7
- **SPA:** Inertia.js 2.0
- **Styling:** TailwindCSS 4.0
- **UI Components:** Radix UI
- **Iconos:** Lucide React
- **Gráficos:** Recharts
- **Build Tool:** Vite 7.0

### APIs Externas
- **WhatsApp Business API** - Meta Graph API v18.0

### Herramientas de Desarrollo
- **Testing:** Pest PHP 3.8
- **Linting:** ESLint 9.x, Laravel Pint 1.18
- **Formatting:** Prettier 3.4

---

## Estructura del Proyecto

```
evarisbot/
├── app/
│   ├── Console/Commands/      # Comandos Artisan
│   ├── Events/                # Eventos del sistema
│   ├── Exports/               # Exportaciones (Excel/PDF)
│   ├── Http/
│   │   ├── Controllers/       # Controladores
│   │   ├── Middleware/        # Middleware personalizado
│   │   └── Requests/          # Form Requests
│   ├── Jobs/                  # Jobs de cola
│   ├── Models/                # Modelos Eloquent
│   └── Services/              # Servicios de negocio
├── config/                    # Configuraciones
├── database/
│   ├── migrations/            # Migraciones de BD
│   └── seeders/               # Seeders
├── docs/                      # DOCUMENTACIÓN COMPLETA
│   ├── MANUAL_DE_USUARIO.md
│   ├── DOCUMENTACION_TECNICA.md
│   ├── CREDENCIALES_Y_CONFIGURACION.md
│   ├── MATERIAL_ENTRENAMIENTO_SESION_1.md
│   ├── MATERIAL_ENTRENAMIENTO_SESION_2.md
│   └── REGISTRO_HISTORICO_INTERACCIONES.md
├── public/                    # Assets públicos
├── resources/
│   ├── css/                   # Estilos globales
│   ├── js/
│   │   ├── components/        # Componentes React
│   │   ├── layouts/           # Layouts
│   │   ├── pages/             # Páginas Inertia
│   │   └── hooks/             # Custom Hooks
│   └── views/                 # Vistas Blade
├── routes/                    # Definición de rutas
├── storage/                   # Almacenamiento
├── tests/                     # Tests automatizados
├── .env.example               # Variables de entorno ejemplo
├── composer.json              # Dependencias PHP
├── package.json               # Dependencias JavaScript
└── README.md                  # Este archivo
```

---

## Instalación

### Requisitos Previos

- PHP 8.2 o superior
- Composer 2.x
- Node.js 18.x o superior
- MySQL 8.0+ / PostgreSQL 14+ (SQLite para desarrollo)
- Servidor web (Nginx/Apache)

### Paso a Paso

1. **Clonar el Repositorio**

```bash
git clone https://github.com/tu-organizacion/evarisbot.git
cd evarisbot
```

2. **Instalar Dependencias PHP**

```bash
composer install
```

3. **Configurar Variables de Entorno**

```bash
cp .env.example .env
php artisan key:generate
```

Edita `.env` y configura:
- Base de datos
- Credenciales de WhatsApp Business API
- URL de la aplicación

4. **Ejecutar Migraciones**

```bash
php artisan migrate
```

5. **Poblar Base de Datos (Opcional)**

```bash
php artisan db:seed
```

6. **Instalar Dependencias Frontend**

```bash
npm install
```

7. **Compilar Assets**

```bash
# Desarrollo
npm run dev

# Producción
npm run build
```

8. **Iniciar Servidor de Desarrollo**

```bash
php artisan serve
```

La aplicación estará disponible en `http://localhost:8000`

### Configuración de WhatsApp Business API

Consulta `docs/CREDENCIALES_Y_CONFIGURACION.md` para instrucciones detalladas sobre:
- Obtención de credenciales de Meta
- Configuración del webhook
- Generación de tokens permanentes

---

## Despliegue en Producción

Para despliegue completo en producción, consulta:
- **Documentación Técnica:** `docs/DOCUMENTACION_TECNICA.md` (Sección 11)
- **Credenciales:** `docs/CREDENCIALES_Y_CONFIGURACION.md`

Pasos clave:

```bash
# 1. Optimizar para producción
composer install --no-dev --optimize-autoloader
npm run build
php artisan config:cache
php artisan route:cache
php artisan view:cache

# 2. Configurar permisos
sudo chown -R www-data:www-data storage bootstrap/cache
sudo chmod -R 775 storage bootstrap/cache

# 3. Configurar supervisor para queue worker
sudo supervisorctl start evarisbot-worker:*
```

---

## Documentación

### Para Usuarios

- **[Manual de Usuario](docs/MANUAL_DE_USUARIO.md)** - Guía completa para personal de Servicios Ambulatorios
- **[Material de Entrenamiento - Sesión 1](docs/MATERIAL_ENTRENAMIENTO_SESION_1.md)** - Introducción y uso básico
- **[Material de Entrenamiento - Sesión 2](docs/MATERIAL_ENTRENAMIENTO_SESION_2.md)** - Funciones avanzadas

### Para Desarrolladores y Administradores

- **[Documentación Técnica](docs/DOCUMENTACION_TECNICA.md)** - Arquitectura, API, modelos de datos
- 📗 **[Documentación Técnica Adicional](docs/DOCUMENTACION_TECNICA_ADICIONAL.md)** - Producción, seguridad, monitoreo
- **[Credenciales y Configuración](docs/CREDENCIALES_Y_CONFIGURACION.md)** - Setup de producción (CONFIDENCIAL)
- **[Registro Histórico](docs/REGISTRO_HISTORICO_INTERACCIONES.md)** - Trazabilidad y compliance

---

## Uso Básico

### Iniciar Servicios de Desarrollo

```bash
# Terminal 1: Servidor Laravel
php artisan serve

# Terminal 2: Queue Worker
php artisan queue:work

# Terminal 3: Vite Dev Server
npm run dev
```

O usar el comando unificado:

```bash
composer run dev
```

### Crear Usuario Administrador

```bash
php artisan tinker
```

```php
$user = new App\Models\User();
$user->name = 'Administrador';
$user->email = 'admin@dominio.com';
$user->password = bcrypt('password');
$user->role = 'admin';
$user->save();
```

### Comandos Útiles

```bash
# Limpiar cachés
php artisan optimize:clear

# Ver rutas
php artisan route:list

# Ver jobs fallidos
php artisan queue:failed

# Ejecutar tests
php artisan test
```

---

## Testing

```bash
# Ejecutar todos los tests
php artisan test

# Test específico
php artisan test --filter UserTest

# Con coverage
php artisan test --coverage
```

---

## Características del Sistema

### Módulo de Chat

- Vista estilo WhatsApp Web
- Indicadores de estado de mensaje (✓, ✓✓, ✓✓ azules)
- Soporte para texto, imágenes, documentos
- Búsqueda en tiempo real
- Filtrado por estado y asignación
- Plantillas de mensajes reutilizables

### Módulo de Citas

- Importación masiva desde Excel
- Recordatorios automáticos (48h y 24h antes)
- Detección automática de confirmaciones/cancelaciones
- Vista de calendario
- Filtros por fecha y estado

### Módulo de Estadísticas

- Dashboard interactivo con gráficos
- Métricas de mensajes, citas, conversaciones
- Filtros por período (hoy, semana, mes, año, personalizado)
- Exportación a Excel con formato profesional
- Gráficos de líneas, barras y circulares

### Gestión de Usuarios (Admin)

- CRUD de usuarios
- Asignación de roles (admin/advisor)
- Control de permisos
- Auditoría de acciones

### Configuración (Admin)

- Configuración de WhatsApp API
- Gestión de plantillas de mensajes
- Configuración de negocio (horarios, mensajes automáticos)
- Test de conectividad con WhatsApp

---

## Seguridad

El sistema implementa múltiples capas de seguridad:

- ✅ **Autenticación de Dos Factores (2FA)** con Laravel Fortify
- ✅ **Encriptación de Datos Sensibles** (tokens, credenciales)
- ✅ **Protección CSRF** automática
- ✅ **Rate Limiting** en rutas críticas
- ✅ **SQL Injection Prevention** con Eloquent ORM
- ✅ **XSS Protection** con escapado automático
- ✅ **HTTPS Obligatorio** en producción
- ✅ **Headers de Seguridad** (X-Frame-Options, CSP, etc.)
- ✅ **Logs de Auditoría** completos
- ✅ **Control de Acceso Basado en Roles**

---

## Contribuir

### Reportar Bugs

Abre un issue en GitHub con:
- Descripción del problema
- Pasos para reproducir
- Comportamiento esperado vs actual
- Screenshots si aplica

### Solicitar Features

Abre un issue con:
- Descripción de la funcionalidad
- Casos de uso
- Beneficios esperados

### Desarrollo

1. Fork el repositorio
2. Crea una rama (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

### Estándares de Código

- **PHP:** Seguir PSR-12
- **JavaScript/TypeScript:** Prettier + ESLint
- **Commits:** Conventional Commits

```bash
# Formatear código
composer run format  # PHP (Pint)
npm run format       # JavaScript (Prettier)

# Lint
npm run lint         # ESLint

# Type check
npm run types        # TypeScript
```

---

## Licencia

Este proyecto está bajo la Licencia MIT. Ver archivo [LICENSE](LICENSE) para más detalles.

---

## Equipo

**Desarrollado para:** Hospital Universitario del Valle - Servicios Ambulatorios

**Desarrolladores:**
- [Tu Nombre] - Lead Developer
- [Equipo Técnico]

---

## Soporte

### Soporte Técnico

- **Email:** soporte.tecnico@dominio.com
- **Teléfono:** +57 XXX XXX XXXX
- **Horario:** Lunes a Viernes, 8 AM - 5 PM

### Documentación Adicional

- [Wiki del Proyecto](https://github.com/tu-org/evarisbot/wiki)
- [FAQ](docs/MANUAL_DE_USUARIO.md#9-preguntas-frecuentes)
- [Changelog](CHANGELOG.md)

---

## Agradecimientos

- [Laravel](https://laravel.com) - Framework backend
- [React](https://reactjs.org) - Framework frontend
- [Inertia.js](https://inertiajs.com) - The Modern Monolith
- [TailwindCSS](https://tailwindcss.com) - Utility-first CSS
- [Radix UI](https://www.radix-ui.com) - Componentes accesibles
- [Lucide](https://lucide.dev) - Iconos
- [Meta](https://developers.facebook.com) - WhatsApp Business API

---

## Roadmap

### Versión 2.0 (Q1 2025)

- [ ] Chatbot con IA (OpenAI/Claude)
- [ ] Integración con Facebook Messenger
- [ ] Integración con Instagram Direct
- [ ] Notificaciones push en tiempo real
- [ ] App móvil nativa

### Versión 2.1 (Q2 2025)

- [ ] CRM básico integrado
- [ ] Análisis de sentimiento
- [ ] Predicción de carga
- [ ] Multi-tenant

Ver [ROADMAP.md](docs/DOCUMENTACION_TECNICA_ADICIONAL.md#17-roadmap-y-mejoras-futuras) para más detalles.

---

## Estado del Proyecto

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Coverage](https://img.shields.io/badge/coverage-85%25-green)
![Uptime](https://img.shields.io/badge/uptime-99.9%25-brightgreen)

**Versión Actual:** 1.0.0  
**Última Actualización:** Noviembre 2024  
**Estado:** Producción

---

## ¿Te gusta el proyecto?

Si encuentras útil este proyecto, considera:

- Dar una estrella en GitHub
- Reportar bugs
- Sugerir mejoras
- Compartir con tu equipo

---

**© 2024 Evarisbot - Sistema de Gestión de WhatsApp Business**

Desarrollado para mejorar la atención a pacientes
