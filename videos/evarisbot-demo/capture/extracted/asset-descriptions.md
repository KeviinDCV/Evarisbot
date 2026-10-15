# Inventario de assets

**No hay capturas de pantalla.** La aplicación está tras un inicio de sesión en una
IP local, y las herramientas de captura del navegador están bloqueadas por permisos
en este origen.

Además, y esto pesa más: **las pantallas reales muestran nombres y teléfonos de
pacientes**. Un vídeo que se proyecta en una reunión y se reenvía no debe llevar
datos clínicos identificables.

## Decisión

Las vistas se **reconstruyen en HTML** dentro de la propia composición, con:

- Los tokens de marca **reales**, extraídos en vivo del DOM (`tokens.json`).
- Pacientes y datos **ficticios** pero verosímiles.
- Las cifras agregadas **sí reales** (no identifican a nadie).

Ventaja añadida: al ser HTML vivo en lugar de imágenes planas, cada elemento se
anima por separado — los mensajes entran uno a uno, las cifras cuentan hacia arriba,
los filtros se resaltan.

## Vistas a reconstruir

| Vista | Qué debe leerse en pantalla |
|---|---|
| Conversaciones | Lista de chats con filtros (Todos, No leídos, En espera, Resueltos), un chat abierto con burbujas, y el compositor con plantillas rápidas. |
| Citas y recordatorios | Tabla de citas con estado del recordatorio (Pendiente / Enviado / Confirmada / Cancelada) y el momento en que el paciente responde "Confirmar" desde WhatsApp. |
| Estadísticas | Tarjetas de cifras y la tabla de rendimiento por asesor. |
| Envíos masivos | Asistente por pasos: plantilla, destinatarios desde Excel, y progreso del envío. |
| Chat interno | Conversación entre asesores del equipo, con vistos. |

## Marca

Hospital Universitario del Valle "Evaristo García" — Cali, Colombia.
Lema: *70 años latiendo juntos*. Azul institucional `#2e3f84`.
