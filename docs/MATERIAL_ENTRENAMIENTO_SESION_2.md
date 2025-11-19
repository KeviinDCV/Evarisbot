# Material de Entrenamiento - Sesión 2
## Evarisbot: Funciones Avanzadas, Estadísticas y Gestión de Citas

**Duración:** 2 horas  
**Audiencia:** Personal de Servicios Ambulatorios  
**Requisito:** Haber completado Sesión 1  
**Modalidad:** Presencial con práctica en vivo

---

## Objetivos de Aprendizaje

Al finalizar esta sesión, los participantes podrán:

1. Gestionar citas y recordatorios automáticos
2. Crear y personalizar plantillas de mensajes
3. Generar y analizar estadísticas
4. Exportar informes a Excel/PDF
5. Usar funciones avanzadas del sistema
6. Resolver problemas comunes

---

## Agenda

| Tiempo | Actividad | Tipo |
|--------|-----------|------|
| 0:00 - 0:10 | Repaso Sesión 1 y resolución de dudas | Teórico |
| 0:10 - 0:40 | Gestión de citas y recordatorios | Práctico |
| 0:40 - 1:00 | Plantillas personalizadas | Práctico |
| 1:00 - 1:30 | Estadísticas e informes | Práctico |
| 1:30 - 1:50 | Funciones avanzadas | Práctico |
| 1:50 - 2:00 | Evaluación y cierre | Teórico |

---

## Parte 1: Repaso y Resolución de Dudas (10 min)

### 1.1 Repaso Rápido Sesión 1

**Conceptos Clave:**

- Acceso al sistema  
- Estados de conversación (Pendiente, Activa, Resuelta, Cerrada)  
- Asignación de conversaciones  
- Envío de mensajes básicos  
- Uso de plantillas  

**Mini Quiz:**

1. ¿Cuáles son los 4 estados de una conversación?
2. ¿Cómo se asigna una conversación?
3. ¿Qué significan los checks azules?
4. ¿Cómo se usa una plantilla?

### 1.2 Preguntas de la Práctica

**Espacio para resolver dudas de la práctica entre sesiones**

Temas comunes:
- Dificultades técnicas encontradas
- Situaciones especiales con pacientes
- Sugerencias de mejora

---

## Parte 2: Gestión de Citas y Recordatorios (30 min)

### 2.1 Comprender el Sistema de Citas

**¿Qué son los Recordatorios Automáticos?**

El sistema envía mensajes de WhatsApp automáticamente a los pacientes recordándoles sus citas programadas.

**Beneficios:**

- Reduce inasistencias (no-shows)  
- Mejora satisfacción del paciente  
- Ahorra tiempo al personal  
- Permite confirmaciones anticipadas  

**Flujo Automático:**

```
Cita Programada
      ↓
48 horas antes → Envío automático de recordatorio
      ↓
Paciente responde → "Sí, asistiré" o "Necesito cambiar"
      ↓
Sistema actualiza estado → Confirmada / Cancelada
      ↓
24 horas antes → Recordatorio adicional (si no confirmó)
```

### 2.2 Acceder al Módulo de Citas

**Navegación:**

1. Click en **"Citas"** en el menú superior
2. Verás lista de citas programadas
3. Filtros disponibles:
   - Por fecha
   - Por estado de recordatorio
   - Por paciente/número

**Vista de Citas:**

```
┌────────────────────────────────────────────────────────┐
│  CITAS PROGRAMADAS                    [Importar Citas]│
├────────────────────────────────────────────────────────┤
│  Filtros: [Hoy] [Esta Semana] [Este Mes] [Personaliz.]│
├────────────────────────────────────────────────────────┤
│                                                         │
│  15/Nov/2024 - 10:00 AM                            │
│  Juan Pérez Gómez                                   │
│  +57 300 123 4567                                   │
│  Medicina General - Dr. López                       │
│  Recordatorio: Enviado  |  Estado: Confirmado │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  15/Nov/2024 - 11:30 AM                            │
│  María García                                        │
│  +57 301 987 6543                                   │
│  Cardiología - Dra. Martínez                        │
│  Recordatorio: Pendiente                         │
│  [Enviar Ahora]                                        │
│                                                         │
└────────────────────────────────────────────────────────┘
```

### 2.3 Estados de Recordatorio

**Estados Posibles:**

Pendiente
- Recordatorio aún no enviado
- Falta tiempo para la ventana de envío (48h)

Enviado
- Recordatorio enviado exitosamente
- Esperando respuesta del paciente

**Confirmado** (color verde)
- Paciente confirmó asistencia
- Mensaje recibido: "Sí", "Confirmo", "Asistiré", etc.

**Cancelado** (color rojo)
- Paciente canceló la cita
- Mensaje recibido: "No puedo", "Cancelo", "No asistiré", etc.

**Fallido** (color rojo oscuro)
- Error al enviar recordatorio
- Revisar logs o contactar soporte

### 2.4 Importar Citas desde Excel

**Preparar Archivo Excel:**

El archivo debe tener las siguientes columnas:

| Columna | Descripción | Ejemplo |
|---------|-------------|---------|
| Fecha | Fecha de la cita | 15/11/2024 |
| Hora | Hora de la cita | 10:00 AM |
| Paciente | Nombre completo | Juan Pérez Gómez |
| Teléfono | Número con código país | +573001234567 |
| Servicio | Tipo de consulta | Medicina General |

**Plantilla Ejemplo:**

```
Fecha       | Hora     | Paciente          | Teléfono        | Servicio
15/11/2024  | 10:00 AM | Juan Pérez Gómez  | +573001234567  | Medicina General
15/11/2024  | 11:30 AM | María García      | +573019876543  | Cardiología
16/11/2024  | 09:00 AM | Carlos López      | +573025554444  | Odontología
```

**Proceso de Importación:**

1. Click en **"Importar Citas"**
2. Selecciona archivo Excel (.xlsx o .csv)
3. El sistema valida el formato
4. Revisa la vista previa
5. Click en **"Confirmar Importación"**
6. Las citas se cargan automáticamente

**Validaciones Automáticas:**

- Formato de teléfono correcto  
- Fechas válidas (no pasadas)  
- Campos obligatorios completos  
- Duplicados detectados y alertados  

### 2.5 Envío Manual de Recordatorios

**Cuándo Usar:**

- Cita programada con menos de 48h
- Reenviar recordatorio fallido
- Confirmación adicional solicitada por el paciente

**Procedimiento:**

1. Localiza la cita en la lista
2. Click en **"Enviar Recordatorio"**
3. Vista previa del mensaje a enviar
4. Confirma el envío
5. Estado cambia a **"Enviado"**

### 2.6 Gestionar Respuestas de Citas

**Respuestas Automáticas:**

El sistema detecta automáticamente:

**Confirmaciones:**
- "Sí", "Confirmo", "Asistiré", "Ok", "Claro", "Sí voy"

**Cancelaciones:**
- "No", "Cancelo", "No puedo", "No asistiré", "Cambio"

**Gestión Manual:**

Si la respuesta no es clara:

1. Ir a **Chat** → Buscar conversación del paciente
2. Leer el mensaje completo
3. En el módulo **Citas**, actualizar estado manualmente:
   - Click en la cita
   - Seleccionar: **"Marcar como Confirmada"** o **"Marcar como Cancelada"**

---

## Parte 3: Plantillas Personalizadas (20 min)

### 3.1 ¿Para Qué Crear Plantillas?

**Ventajas:**

- Ahorro de tiempo en respuestas comunes  
- Consistencia en la comunicación  
- Reduce errores de escritura  
- Profesionalismo  

**Casos de Uso:**

- Mensajes de bienvenida
- Solicitudes de información
- Instrucciones pre-cita
- Procedimientos comunes
- Horarios de atención
- Ubicaciones

### 3.2 Crear una Plantilla (Solo Administradores)

**Acceso:**

1. Ir a **Configuración** → **Plantillas**
2. Click en **"Nueva Plantilla"**

**Campos del Formulario:**

| Campo | Descripción |
|-------|-------------|
| **Nombre** | Identificador breve (ej: "Recordatorio Cita") |
| **Categoría** | reminder, welcome, instruction, general |
| **Contenido** | Texto del mensaje |
| **Variables** | Campos dinámicos (ver más abajo) |

**Variables Disponibles:**

Puedes usar variables que se reemplazan automáticamente:

```
{patient_name}       → Nombre del paciente
{appointment_date}   → Fecha de la cita (15/11/2024)
{appointment_time}   → Hora de la cita (10:00 AM)
{service_type}       → Tipo de servicio (Medicina General)
{business_name}      → Nombre de la institución
```

**Ejemplo de Plantilla:**

```
Nombre: Recordatorio de Cita 48h
Categoría: reminder

Contenido:
Hola {patient_name}, 👋

Te recordamos tu cita en {business_name}:

Fecha: {appointment_date}
Hora: {appointment_time}
Servicio: {service_type}

Por favor confirma tu asistencia respondiendo SÍ.

Si necesitas cambiar la cita, responde CAMBIO.

¡Te esperamos! 😊
```

**Resultado al Enviar:**

```
Hola Juan Pérez Gómez, 👋

Te recordamos tu cita en Hospital Universitario del Valle:

Fecha: 15/11/2024
Hora: 10:00 AM
Servicio: Medicina General

Por favor confirma tu asistencia respondiendo SÍ.

Si necesitas cambiar la cita, responde CAMBIO.

¡Te esperamos! 😊
```

### 3.3 Editar Plantilla Existente

1. Ir a **Configuración** → **Plantillas**
2. Buscar la plantilla a editar
3. Click en **✏️ Editar**
4. Realizar cambios
5. **Guardar**

**Nota:** Los cambios afectan futuros usos, no mensajes ya enviados.

### 3.4 Solicitar Nueva Plantilla (Asesores)

Si no eres administrador pero necesitas una plantilla:

1. Anota el contenido propuesto
2. Identifica las variables necesarias
3. Envía solicitud al administrador del sistema
4. Incluye ejemplo de uso

---

## Parte 4: Estadísticas e Informes (30 min)

### 4.1 Acceder al Módulo de Estadísticas

**Navegación:**

1. Click en **"Estadísticas"** en el menú superior
2. Vista general del dashboard

**Dashboard Principal:**

```
┌─────────────────────────────────────────────────────────┐
│  ESTADÍSTICAS                         [Exportar Excel] │
│                                                          │
│  Período: [Hoy ▼] [Esta Semana] [Este Mes] [Este Año]  │
│           [Personalizado: __ a __]                      │
├─────────────────────────────────────────────────────────┤
│  MÉTRICAS GENERALES                                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐         │
│  │ MENSAJES   │ │ CITAS      │ │ CONVERSAC. │         │
│  │    1,245   │ │     89     │ │    234     │         │
│  └────────────┘ └────────────┘ └────────────┘         │
│                                                          │
│  GRÁFICO DE MENSAJES POR DÍA                         │
│  [Gráfico de líneas]                                    │
│                                                          │
│  ESTADOS DE CITAS                                    │
│  [Gráfico circular: Confirmadas 65%, Pendientes 25%...]│
│                                                          │
│  CONVERSACIONES POR ASESOR                           │
│  [Gráfico de barras]                                    │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Seleccionar Período de Análisis

**Períodos Predefinidos:**

- **Hoy:** Solo el día actual
- **Esta Semana:** Últimos 7 días
- **Este Mes:** Mes calendario actual
- **Este Año:** Año actual
- **Todo el Tiempo:** Histórico completo

**Personalizado:**

1. Click en **"Personalizado"**
2. Selecciona **Fecha Inicio**
3. Selecciona **Fecha Fin**
4. Click en **"Aplicar"**
5. Las estadísticas se actualizan automáticamente

### 4.3 Métricas Disponibles

**1. Mensajes**

| Métrica | Descripción |
|---------|-------------|
| **Enviados** | Mensajes enviados por asesores |
| **Recibidos** | Mensajes de pacientes |
| **Contestados** | Porcentaje de respuesta |
| **Por Estado** | Desglose (enviado, entregado, leído, fallido) |

**2. Citas**

| Métrica | Descripción |
|---------|-------------|
| **Total** | Citas programadas |
| **Recordatorios Enviados** | Cantidad de recordatorios |
| **Confirmadas** | Citas confirmadas por pacientes |
| **Canceladas** | Citas canceladas |
| **Tasa de Confirmación** | Porcentaje confirmado vs total |

**3. Conversaciones**

| Métrica | Descripción |
|---------|-------------|
| **Total** | Todas las conversaciones |
| **Activas** | En curso |
| **Resueltas** | Finalizadas exitosamente |
| **Pendientes** | Sin asignar |
| **Tiempo Promedio** | Duración media de atención |

**4. Usuarios**

| Métrica | Descripción |
|---------|-------------|
| **Conversaciones por Asesor** | Distribución de carga |
| **Mensajes por Asesor** | Productividad |
| **Tiempo de Respuesta** | Rapidez de atención |

### 4.4 Interpretar Gráficos

**Gráfico de Líneas - Mensajes en el Tiempo:**

- **Eje X:** Fechas
- **Eje Y:** Cantidad de mensajes
- **Líneas:** Enviados vs Recibidos

**Qué Buscar:**
- Picos de actividad (días/horas con más mensajes)
- Tendencias (aumento o disminución)
- Patrones (días de la semana con más actividad)

**Gráfico Circular - Estados de Citas:**

- Muestra proporción de cada estado
- Verde: Confirmadas
- Amarillo: Pendientes
- Rojo: Canceladas

**Qué Buscar:**
- Tasa de confirmación saludable (>70%)
- Tasa de cancelación aceptable (<15%)

**Gráfico de Barras - Conversaciones por Asesor:**

- Cada barra = un asesor
- Altura = cantidad de conversaciones

**Qué Buscar:**
- Distribución equilibrada de carga
- Identificar asesores con sobrecarga

### 4.5 Exportar Informes

**Exportar a Excel:**

1. Selecciona el período deseado
2. Click en **"Exportar a Excel"** (botón superior derecho)
3. El archivo se descarga automáticamente
4. Nombre: `estadisticas_YYYY-MM-DD_HHMMSS.xlsx`

**Contenido del Excel:**

El archivo incluye **6 hojas**:

1. **Resumen** - Overview general
2. **Mensajes** - Detalle de mensajería
3. **Citas** - Estadísticas de recordatorios
4. **Conversaciones** - Estados y distribución
5. **Plantillas** - Uso de plantillas
6. **Usuarios** - Métricas por asesor

**Formato Profesional:**

✅ Colores institucionales  
✅ Tablas con bordes y estilos  
✅ Gráficos incluidos  
✅ Listo para presentar  

**Exportar a PDF:** (Próximamente)

### 4.6 Usar Estadísticas para Mejorar

**Casos de Uso:**

**1. Identificar Horas Pico**
- Revisar gráfico de mensajes por hora
- Asignar más personal en horas críticas

**2. Evaluar Efectividad de Recordatorios**
- Revisar tasa de confirmación
- Si es baja (<60%), ajustar mensaje de recordatorio

**3. Balancear Carga de Trabajo**
- Revisar conversaciones por asesor
- Reasignar si hay desequilibrio

**4. Reportes Mensuales**
- Exportar estadísticas del mes
- Presentar a dirección
- Identificar tendencias y áreas de mejora

---

## Parte 5: Funciones Avanzadas (20 min)

### 5.1 Notas Internas

**¿Qué son?**

Comentarios visibles solo para el equipo, no para el paciente.

**Usar Notas:**

1. Abrir conversación
2. Click en icono **📝 Notas**
3. Escribir nota
4. Guardar

**Ejemplos de Uso:**

```
"Paciente tiene restricción alimentaria (celíaco)"
"Solicitar autorización de EPS antes de cita"
"Familiar contacta por paciente: María (hija)"
"Próximo control: 30 días después de cirugía"
```

**Buenas Prácticas:**

✅ Ser específico y conciso  
✅ Incluir fechas cuando sea relevante  
✅ Actualizar cuando haya cambios  
✅ Usar para información clínicamente relevante  

### 5.2 Búsqueda Avanzada

**Búsqueda Básica:**
- Escribe en el campo de búsqueda
- Busca por nombre o número

**Filtros Combinados:**

1. **Por Estado + Asignación**
   - Ejemplo: Ver solo "Activas" + "Mis conversaciones"

2. **Por Fecha**
   - Conversaciones de la última semana
   - Conversaciones del día específico

3. **Por Contenido** (búsqueda en mensajes)
   - Buscar "resultados laboratorio"
   - Buscar número de orden

### 5.3 Atajos de Teclado

**Navegación:**

| Atajo | Acción |
|-------|--------|
| `Ctrl + K` | Abrir búsqueda rápida |
| `↑` / `↓` | Navegar entre conversaciones |
| `Enter` | Abrir conversación seleccionada |
| `Esc` | Cerrar conversación |

**Mensajes:**

| Atajo | Acción |
|-------|--------|
| `Enter` | Enviar mensaje |
| `Shift + Enter` | Nueva línea |
| `Ctrl + V` | Pegar (texto o imagen) |
| `Alt + T` | Abrir plantillas |

### 5.4 Configuración Personal

**Acceder:**

1. Click en tu nombre (esquina superior derecha)
2. Selecciona **"Mi Perfil"**

**Opciones Disponibles:**

**Datos Personales:**
- Actualizar nombre
- Cambiar email
- Actualizar foto de perfil

**Seguridad:**
- Cambiar contraseña
- Activar/desactivar 2FA
- Ver dispositivos activos
- Generar nuevos códigos de recuperación

**Notificaciones:**
- Sonido al recibir mensaje
- Notificaciones del navegador
- Email de resumen diario

**Preferencias:**
- Idioma (español/inglés)
- Zona horaria
- Formato de fecha

### 5.5 Funciones de Administrador

**Solo para usuarios con rol Admin:**

**Gestión de Usuarios:**
- Crear nuevos usuarios
- Editar permisos
- Desactivar cuentas
- Ver actividad de usuarios

**Configuración del Sistema:**
- Actualizar tokens de WhatsApp
- Configurar mensajes automáticos
- Definir horarios de atención
- Gestionar plantillas globales

**Monitoreo:**
- Ver todas las conversaciones
- Auditoría de acciones
- Logs del sistema

---

## Parte 6: Resolución de Problemas (Opcional)

### 6.1 Problemas Comunes y Soluciones

**Problema: No puedo ver nuevas conversaciones**

✅ **Soluciones:**
1. Actualiza la página (F5)
2. Verifica los filtros aplicados
3. Limpia caché del navegador

**Problema: Mensaje no se envía**

✅ **Soluciones:**
1. Verifica conexión a internet
2. Confirma que la conversación esté asignada
3. Revisa que el número sea válido
4. Contacta soporte si persiste

**Problema: No encuentro una conversación**

✅ **Soluciones:**
1. Usa la búsqueda global
2. Verifica filtros de estado
3. Revisa "Todas las conversaciones" no solo "Mis conversaciones"

**Problema: Olvidé mi contraseña**

✅ **Soluciones:**
1. Click en "¿Olvidaste tu contraseña?"
2. Ingresa tu email
3. Recibirás enlace de recuperación
4. Crea nueva contraseña

---

## Evaluación Final

### Ejercicio Integral

**Escenario Completo:**

Eres el asesor responsable de gestionar las citas del servicio de Medicina General del día de mañana.

**Tareas:**

1. **Importar Citas**
   - Descarga archivo de ejemplo
   - Importa 5 citas para mañana

2. **Verificar Recordatorios**
   - Revisa cuáles ya tienen recordatorio enviado
   - Envía manualmente los pendientes

3. **Gestionar Respuestas**
   - Revisa el chat de los pacientes que respondieron
   - Actualiza estado de citas (confirmadas/canceladas)

4. **Generar Reporte**
   - Exporta estadísticas de citas de la semana
   - Identifica tasa de confirmación

5. **Crear Nota Interna**
   - En una conversación, agrega nota relevante

**Tiempo:** 15 minutos

**Checklist de Evaluación:**

- [ ] Importé citas correctamente
- [ ] Envié recordatorios manuales
- [ ] Actualicé estados de citas
- [ ] Exporté estadísticas a Excel
- [ ] Agregué notas internas
- [ ] Interpreté correctamente las métricas

---

## Certificación de Competencias

**Competencias Adquiridas:**

Al completar ambas sesiones, has demostrado capacidad para:

✅ **Básicas:**
- Acceder y navegar el sistema
- Gestionar conversaciones
- Enviar y recibir mensajes
- Usar plantillas

✅ **Intermedias:**
- Gestionar citas y recordatorios
- Interpretar estados de citas
- Importar información desde Excel
- Buscar y filtrar información

✅ **Avanzadas:**
- Analizar estadísticas
- Generar informes profesionales
- Usar funciones de productividad
- Resolver problemas comunes

---

## Recursos Complementarios

**Documentación Completa:**
- 📘 Manual de Usuario: `docs/MANUAL_DE_USUARIO.md`
- 📗 Documentación Técnica: `docs/DOCUMENTACION_TECNICA.md`
- 📙 Material Sesión 1: `docs/MATERIAL_ENTRENAMIENTO_SESION_1.md`

**Videos y Tutoriales:**
- [Próximamente] Gestión avanzada de citas
- [Próximamente] Análisis de estadísticas
- [Próximamente] Tips y trucos

**Soporte Continuo:**
- Email: soporte@dominio.com
- Extensión: XXXX
- Horario: Lunes a Viernes, 8 AM - 5 PM

---

## Siguientes Pasos

**Práctica Continua:**

1. Usa el sistema diariamente
2. Explora nuevas funcionalidades
3. Comparte tips con el equipo
4. Sugiere mejoras

**Capacitación Continua:**

- Sesiones mensuales de actualización
- Nuevas funcionalidades al lanzarse
- Mejores prácticas compartidas

**Convertirte en Usuario Experto:**

- Ayuda a nuevos usuarios
- Identifica oportunidades de optimización
- Participa en pruebas de nuevas features

---

## Encuesta de Satisfacción

**Por favor completa:**

1. ¿El contenido fue claro y comprensible? (1-5)
2. ¿Los ejercicios prácticos fueron útiles? (1-5)
3. ¿Te sientes preparado para usar el sistema? (1-5)
4. ¿Qué tema te gustaría profundizar más?
5. ¿Qué sugerencias tienes para mejorar la capacitación?

---

**¡Felicitaciones por Completar el Entrenamiento!** 🎉

Has adquirido las habilidades necesarias para usar Evarisbot de manera efectiva.

**Próximos Pasos:**
- Comienza a usar el sistema en producción
- Contacta soporte si tienes dudas
- Comparte tus experiencias con el equipo

**Fecha de Certificación:** _______________  
**Instructor:** _______________  
**Participante:** _______________  
**Firma:** _______________

---

**Fin de la Sesión 2**

¡Gracias por tu participación y dedicación!
