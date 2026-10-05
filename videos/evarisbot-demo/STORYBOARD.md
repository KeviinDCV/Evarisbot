---
format: 1920x1080
duration: 71s
message: Evarisbot centraliza la atención al paciente por WhatsApp — conversaciones, recordatorios de cita, envíos masivos y control, en una sola plataforma.
arc: Presentación → Qué hace (5 capacidades) → Resultado real → Cierre
audience: Directivos del Hospital Universitario del Valle
mode: collaborative
music: none
language: es
---

# Evarisbot — recorrido de capacidades

Vídeo **mudo**: la tipografía en pantalla lo cuenta todo. Pensado para proyectarse
en una reunión, con alguien que puede hablar encima sin competir con una locución.

Todas las interfaces se **reconstruyen en HTML** con los tokens reales de la marca
(`#2e3f84`, Instrument Sans) y **pacientes ficticios** — las pantallas reales llevan
nombres y teléfonos que no deben salir en un vídeo. Las cifras agregadas sí son reales.

---

## Video direction

Invariantes de todo el vídeo. El trabajador de cada escena las respeta sin repetirlas.

**Ritmo sin voz.** No hay locución: el reloj es la **lectura**. Un rótulo corto necesita
~1,8 s en pantalla antes de que entre lo siguiente; una cifra grande, ~1,2 s. Nada se
revela antes de que lo anterior se haya podido leer. Prohibido volcar la pantalla
entera en el primer 25 % y dejarla quieta — cada escena se **desarrolla** hasta el final.

**Jerarquía constante.** En cada escena manda **un** elemento: o el rótulo, o la
interfaz, o la cifra. Nunca dos a la vez compitiendo. El rótulo entra primero, se lee,
y **cede el protagonismo** encogiendo a un margen mientras la interfaz crece.

**Profundidad.** Tres planos siempre: fondo (canvas `#ffffff` o el azul de marca),
plano medio (la superficie de interfaz con su sombra suave) y primer plano (rótulos,
cursor, apoyos). Las superficies de interfaz llevan sombra y esquinas de 16 px, **sin
borde** — así es la aplicación desde el rediseño de esta semana.

**Movimiento contenido.** Entradas cortas (0,4–0,6 s), `power3.out`. Nada rebota más de
una vez. Es un hospital: la sobriedad es parte del mensaje. Prohibido: destellos,
partículas, degradados morados, chrome de navegador, barras de scroll y cursores reales.

**Color.** Azul `#2e3f84` solo para acentos, cabeceras y el estado activo. Verde
`#059669` **únicamente** para confirmaciones. Blanco de fondo salvo apertura y cierre,
que van a sangre en azul para enmarcar el vídeo.

**Cifras.** Siempre con separador de millar en español (`53.694`) y contando hacia
arriba desde 0. Nunca aparecen de golpe: el conteo *es* la prueba de que son reales.

---

## Frame 1 — Apertura

- status: animated
- src: compositions/frames/01-apertura.html
- duration: 5s
- transition_in: cut
- scene: El nombre aparece sobre el azul institucional; debajo, el hospital.
- blueprint: titlecard-reveal
- asset_candidates: ninguno (tipografía pura sobre el azul de marca)
- motion: discrete-text-sequence, gradient-text-sweep, svg-path-draw

Fondo azul `#2e3f84` a sangre completa. Sin adornos: el vídeo arranca con autoridad.

```
Scene 1 (0.0–1.6s)  Solo "Evarisbot", centrado, blanco, peso 800, muy grande.
                    Entra con un barrido de brillo suave (gradient-text-sweep) de
                    izquierda a derecha. Nada más en pantalla. Layout: centrado.
Scene 2 (1.6–2.8s)  Bajo el nombre se dibuja una línea fina blanca al 40 %
                    (svg-path-draw, 0.5s). Al terminar, aparece debajo
                    "Hospital Universitario del Valle · Evaristo García",
                    pequeño, en versalitas.
Scene 3 (2.8–4.2s)  El bloque nombre+hospital sube ligeramente y cede sitio: entra
                    la frase de encuadre "La atención al paciente, por WhatsApp."
                    en la franja inferior-tercio. Layout: pasa a rule-of-thirds.
Scene 4 (4.2–5.0s)  Todo quieto. Solo respira la línea (opacidad 40→55 %).
```

---

## Frame 2 — Conversaciones

- status: animated
- src: compositions/frames/02-conversaciones.html
- duration: 13s
- transition_in: crossfade
- scene: La bandeja de conversaciones; un chat se abre y el asesor responde.
- blueprint: cursor-ui-demo
- asset_candidates: interfaz reconstruida — lista de chats + hilo abierto + compositor
- motion: waterfall-entry, cursor-click-ripple, spring-pop-entrance

Rótulo: **"Todo el WhatsApp del hospital, en una sola bandeja."**

```
Scene 1 (0.0–2.0s)  Fondo blanco. Solo el rótulo, centrado y grande. Se lee.
Scene 2 (2.0–3.2s)  El rótulo encoge y se ancla arriba-izquierda, cediendo el protagonismo.
                    Desde abajo sube la superficie de la aplicación, ocupando el 70 %
                    inferior. Layout: asimétrico 70/30 con el rótulo de cabecera.
Scene 3 (3.2–5.4s)  Dentro de la superficie entra la LISTA de conversaciones:
                    las filas caen en cascada (waterfall-entry, 60ms entre filas),
                    5 chats con avatar, nombre ficticio, último mensaje y hora.
                    Arriba, las pastillas de filtro: Todos · No leídos 4 · En espera ·
                    Resueltos. La de "Todos" en azul, activa.
Scene 4 (5.4–7.0s)  Un cursor discreto se desplaza a la segunda fila y hace clic
                    (cursor-click-ripple). La fila se resalta y a la derecha se
                    despliega el HILO abierto. Layout: evoluciona a split 40/60.
Scene 5 (7.0–9.0s)  En el hilo entran dos burbujas de paciente (blancas, desde la
                    izquierda, spring-pop-entrance escalonado).
Scene 6 (9.0–11.0s) El asesor responde: burbuja verde `#d9fdd3` desde la derecha.
                    Sus dos checks pasan de gris a AZUL — el acuse de lectura.
Scene 7 (11.0–13.0s) Tres apoyos entran y salen en la franja inferior, uno cada 0,6 s:
                    "Filtros por estado" · "Plantillas rápidas" · "Etiquetas y asignación".
                    La interfaz queda quieta detrás.
```

---

## Frame 3 — Recordatorios automáticos

- status: animated
- src: compositions/frames/03-recordatorios.html
- duration: 14s
- transition_in: crossfade
- scene: Un Excel de la agenda entra al sistema y se convierte en recordatorios; el paciente confirma desde su móvil.
- blueprint: panel-edit-live-sync
- asset_candidates: interfaz reconstruida — carga de Excel + tabla de citas + móvil con WhatsApp
- motion: waterfall-entry, physics-press-reaction, scale-swap-transition

Rótulo: **"Sube la agenda. El resto lo hace solo."**
El corazón del vídeo. Aquí se entiende de un vistazo qué resuelve el sistema.

```
Scene 1 (0.0–1.8s)  Solo el rótulo, centrado. Se lee.
Scene 2 (1.8–3.0s)  El rótulo sube a cabecera. La pantalla se parte:
                    IZQUIERDA (60 %) el panel de citas · DERECHA (40 %) un móvil
                    en marco sencillo. Layout: split-screen 60/40. Ambos vacíos aún.
Scene 3 (3.0–4.6s)  Un archivo "agenda-29-julio.xlsx" cae en la zona de carga del panel
                    izquierdo y se asienta (physics-press-reaction). Zona en azul tenue.
Scene 4 (4.6–7.0s)  La TABLA se rellena sola: 6 filas caen en cascada (waterfall-entry),
                    con paciente, hora, médico, especialidad. Columna Estado: todas
                    "Pendiente" en gris.
Scene 5 (7.0–9.2s)  En el móvil llega el recordatorio: burbuja con fecha, hora, médico,
                    especialidad y consultorio. Debajo, dos botones: Confirmar / Cancelar.
Scene 6 (9.2–10.6s) El botón "Confirmar" se pulsa (physics-press-reaction) y se ilumina.
Scene 7 (10.6–12.4s) LA CLAVE: en la tabla de la izquierda, la fila de ese paciente cambia
                    de "Pendiente" gris a "Confirmada" VERDE (scale-swap-transition), con
                    un halo suave alrededor que llama la atención sin estridencia.
                    Nadie del hospital ha tocado nada.
Scene 8 (12.4–14.0s) Apoyo en la franja inferior: "…o Cancelar, y el hueco queda libre
                    para otro paciente." Todo lo demás, quieto.
```

---

## Frame 4 — Estadísticas y control

- status: animated
- src: compositions/frames/04-estadisticas.html
- duration: 10s
- transition_in: crossfade
- scene: El panel de cifras se construye; los números cuentan hacia arriba.
- blueprint: dataviz-countup
- asset_candidates: interfaz reconstruida — tarjetas de métricas + tabla de asesores
- motion: counting-dynamic-scale, waterfall-entry, stat-bars-and-fills

Rótulo: **"Qué está pasando, en cualquier momento."**

```
Scene 1 (0.0–1.6s)  Solo el rótulo, centrado.
Scene 2 (1.6–2.6s)  Rótulo a cabecera. Entra la superficie del panel. Layout: centrado,
                    la superficie ocupa el 80 % del ancho.
Scene 3 (2.6–5.2s)  CUATRO tarjetas se colocan en rejilla 2×2 (waterfall-entry, 120ms
                    entre ellas). Cada número cuenta desde 0 hasta su valor
                    (counting-dynamic-scale, 1.2s, escala 1→1.06→1 al llegar):
                    Conversaciones 53.694 · Mensajes 168.629 · Citas 106.408 ·
                    Resolución 91,98 %.
Scene 4 (5.2–7.6s)  Bajo las tarjetas se despliega la tabla de rendimiento por asesor:
                    4 filas con nombre y una barra que se llena hasta su porcentaje
                    (stat-bars-and-fills, escalonado). Layout: evoluciona a
                    tarjetas-arriba / tabla-abajo.
Scene 5 (7.6–10.0s) Quieto. Un apoyo discreto abajo: "Actualizado al minuto."
```

---

## Frame 5 — Envíos masivos

- status: animated
- src: compositions/frames/05-envios-masivos.html
- duration: 9s
- transition_in: crossfade
- scene: El asistente de envío masivo avanza por sus pasos y la barra de progreso corre.
- blueprint: agent-progress-theater
- asset_candidates: interfaz reconstruida — asistente por pasos + barra de progreso
- motion: dynamic-content-sequencing, stat-bars-and-fills, counting-dynamic-scale

Rótulo: **"Avisar a cientos de pacientes, en minutos."**

```
Scene 1 (0.0–1.6s)  Solo el rótulo.
Scene 2 (1.6–2.4s)  Rótulo a cabecera. Entra la superficie del asistente, centrada.
Scene 3 (2.4–4.8s)  TRES pasos se encienden en orden (dynamic-content-sequencing, 0.7s
                    cada uno): "1 Plantilla" → "2 Destinatarios" → "3 Enviar".
                    El activo en azul con su marca; los ya hechos, en verde.
Scene 4 (4.8–7.2s)  La barra de progreso avanza de 0 a 100 % (stat-bars-and-fills) y a
                    su lado el contador cuenta hasta 217 (counting-dynamic-scale).
                    Layout: la barra ocupa el ancho, dominando la escena.
Scene 5 (7.2–9.0s)  Apoyo: "Un festivo, un cambio de sede, una cancelación masiva."
```

---

## Frame 6 — Chat interno

- status: animated
- src: compositions/frames/06-chat-interno.html
- duration: 7s
- transition_in: crossfade
- scene: Dos asesores se coordinan dentro de la plataforma.
- blueprint: transcript-scroll-artifact-reveal
- asset_candidates: interfaz reconstruida — hilo de chat interno con vistos
- motion: spring-pop-entrance, discrete-text-sequence

Rótulo: **"El equipo, coordinado sin salir de la plataforma."**
Cierra el recorrido con las personas, no con la máquina.

```
Scene 1 (0.0–1.5s)  Solo el rótulo.
Scene 2 (1.5–2.2s)  Rótulo a cabecera; entra la superficie del chat interno, centrada
                    y algo más estrecha que las anteriores (es un chat, no un panel).
Scene 3 (2.2–3.4s)  Burbuja de la asesora 1 (izquierda): "¿Alguien puede tomar el chat
                    de la señora Rojas? Salgo a almorzar." (spring-pop-entrance)
Scene 4 (3.4–4.8s)  Burbuja del asesor 2 (derecha, azul tenue): "Yo lo tomo 👍"
Scene 5 (4.8–5.8s)  Bajo la burbuja aparece el visto: doble check azul + "Visto por Ana".
Scene 6 (5.8–7.0s)  Quieto, respirando.
```

---

## Frame 7 — Lo que lleva hecho

- status: animated
- src: compositions/frames/07-cifras.html
- duration: 8s
- transition_in: crossfade
- scene: Las cifras reales de operación, en grande.
- blueprint: kinetic-type-beats
- asset_candidates: ninguno (tipografía y número puros)
- motion: counting-dynamic-scale, kinetic-beat-slam

Rótulo: **"En 253 días de operación."** Datos reales, sin redondear.

```
Scene 1 (0.0–1.2s)  Fondo blanco. Solo "En 253 días de operación.", centrado arriba.
Scene 2 (1.2–2.6s)  Entra "53.694" enorme, contando desde 0 (counting-dynamic-scale),
                    con "pacientes atendidos" debajo, pequeño. Layout: centrado.
Scene 3 (2.6–3.8s)  Sustitución en el mismo sitio: "106.408 · citas gestionadas".
                    La cifra anterior sale hacia arriba mientras entra la nueva
                    (kinetic-beat-slam).
Scene 4 (3.8–5.0s)  "50.023 · citas confirmadas por el propio paciente".
Scene 5 (5.0–6.6s)  "3.606 · canceladas a tiempo" — SE SOSTIENE MÁS. Debajo, su apoyo
                    en azul: "huecos liberados para otro paciente",
                    creciendo desde el centro. Es la cifra que un directivo traduce
                    solo a capacidad recuperada.
Scene 6 (6.6–8.0s)  Las cinco cifras se recolocan pequeñas en una fila inferior, todas
                    visibles a la vez, y "91,98 % resueltas" cierra a la derecha.
                    Layout: de centrado a franja completa.
```

---

## Frame 8 — Cierre

- status: animated
- src: compositions/frames/08-cierre.html
- duration: 5s
- transition_in: crossfade
- scene: Vuelta al azul de marca con el nombre y el lema del hospital.
- blueprint: logo-assemble-lockup
- asset_candidates: ninguno (tipografía sobre el azul de marca)
- motion: center-outward-expansion, gradient-text-sweep

```
Scene 1 (0.0–1.2s)  El blanco se llena de azul `#2e3f84` desde el centro hacia fuera
                    (center-outward-expansion), tapando la escena anterior.
Scene 2 (1.2–2.4s)  "Evarisbot" entra centrado, blanco, grande.
Scene 3 (2.4–3.6s)  Debajo, línea fina y "Hospital Universitario del Valle".
Scene 4 (3.6–5.0s)  Aparece el lema "70 años latiendo juntos." con un barrido suave
                    (gradient-text-sweep) y se sostiene en silencio.
                    Sin llamada a la acción: el público ya está dentro del hospital.
```
