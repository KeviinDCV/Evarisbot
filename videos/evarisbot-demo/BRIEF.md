---
flow: companion
storyboard: review
length: 60-75s
format: 16:9
language: es
capture: authenticated-manual
---

# Brief — Evarisbot

## Producto

**Evarisbot** — plataforma de atención al paciente por WhatsApp del **Hospital
Universitario del Valle "Evaristo García"** (Cali, Colombia). En producción, operada
a diario por 27 asesores.

## Intent

**Mostrar qué hace la aplicación**, no persuadir con una narrativa.

El usuario fue explícito: *"más que historia es un vídeo mostrando qué hace la
aplicación como tal"*. Es un **recorrido de capacidades**: cada bloque enseña una
pantalla real y explica qué resuelve. Las cifras entran como respaldo de lo que se
ve, nunca como el argumento principal.

## Audiencia

Directivos del hospital. Conocen el problema (citas perdidas, pacientes sin
información) pero no la herramienta. Lenguaje llano: nada de "webhook", "plantilla
de Meta" ni "cola de trabajos".

## Qué mostrar

Cuatro áreas, en este orden:

1. **Conversaciones** — el chat con el paciente: lista, filtros, plantillas rápidas.
2. **Citas y recordatorios automáticos** — carga del Excel y envío automático; el
   paciente confirma o cancela desde WhatsApp.
3. **Estadísticas y control** — el panel de cifras y rendimiento.
4. **Envíos masivos y chat interno** — comunicación a cientos de pacientes y
   coordinación del equipo.

## Cifras verificadas

Medidas directamente sobre la base de datos de producción el 29-jul-2026.
**No inventar ni redondear al alza.**

| Dato | Valor |
|---|---|
| Pacientes atendidos | 53.694 |
| Días en funcionamiento | 253 |
| Mensajes intercambiados | 168.629 (≈666/día) |
| Citas gestionadas | 106.408 |
| Recordatorios enviados | 79.026 |
| Citas confirmadas por el paciente | 50.023 (63,3% de los enviados) |
| Canceladas a tiempo | 3.606 |
| Conversaciones resueltas | 91,98% |
| Respuesta típica | 23,6 min (mediana) |
| Asesores | 27 |

**Cuidado con el coste:** la cifra de facturación de Meta ($159,75 USD) cubre solo
el 26% histórico de los mensajes salientes. **No usarla como titular** — el coste
real es mayor y afirmarlo sería engañoso ante directivos.

## Customizations

- Capturas de pantalla **reales** de la aplicación, obtenidas con sesión iniciada
  por el usuario (la app está tras login en IP local: no se puede rastrear).
- Las pantallas capturadas son los `asset_candidates` protagonistas.
- Español de Colombia.
- Sin jerga técnica.

## Notas

Marca visual de la app: azul institucional `#2e3f84`, superficies claras con
degradado suave y sombra (`card-gradient`), esquinas redondeadas, tipografía sin
serifa. El hospital cumple **70 años** ("70 años latiendo juntos").
