// Configuración (/admin/settings) rediseñada dentro de la carcasa "Marco navy", en el mismo lenguaje
// que la vista de Usuarios aprobada (design/vista-usuarios/gen_vista.mjs).
//
// Idea: arriba, una franja de tres estados (WhatsApp, Groq, turno) que sustituye a las tres tarjetas.
// Debajo, UNA hoja blanca con las tres secciones una tras otra: cada sección abre con su banda
// (qué es, en qué estado está, qué acciones tiene) y sigue con filas de ajuste: a la izquierda qué
// es el campo y qué acepta, a la derecha el campo. Los secretos nunca se muestran: se enseña el valor
// guardado enmascarado y el campo queda vacío para pegar uno nuevo (vacío = se conserva).
//
// Escribe dos artboards:
//   Main.dc.html      1440x900, la pantalla al entrar (menú fijado, isla 1190x880).
//   Completa.dc.html  1190 x alto necesario: la página entera, con el resultado de "Probar conexión"
//                     y el perfil del negocio ya consultados, para ver todas las piezas.
//
// TODOS los valores son de ejemplo e inventados (tokens enmascarados, IDs, webhook, teléfono, nombres).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { T, icono, USUARIOS, iniciales, documento } from '../usuarios/_comun.mjs';
import { carcasaMarco, ISLA, RADIO_ISLA } from '../usuarios/_marco.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));

// ── Datos de EJEMPLO (inventados, forma de las props reales de SettingsController@index) ─────
// Setting::getPreview enmascara así: 8 primeros caracteres + 12 asteriscos (aquí, puntos).
const WA = {
  token: 'EAAG3f9a' + '•'.repeat(12),
  verify: 'vt7c2e0k' + '•'.repeat(12),
  phoneId: '109876543210987',
  waba: '210987654321098',
  webhook: 'https://evarisbot.huv.gov.co/api/webhook/whatsapp',
  configurado: true,
};
const GROQ = { key: 'gsk_9d41' + '•'.repeat(12), configurado: true };
// Respuesta de "Perfil del negocio" (solo en Completa, tras pulsar el botón).
const PERFIL = {
  nombre: 'Hospital Universitario del Valle', telefono: '+57 300 555 0142', phoneId: WA.phoneId,
  verificado: true, calidad: 'GREEN', limite: 'TIER_1K',
};
const PRUEBA_OK = 'Conexión exitosa con WhatsApp Business API.';

// Asesores (rol advisor, ordenados por nombre como el controlador): los 11 de _comun.mjs + 16 inventados = 27.
const EXTRA = [
  ['ALEJANDRA LÓPEZ CASTAÑO', 'alelopezc@gmail.com'], ['BRAYAN STIVEN GARCÍA MINA', 'brayangarcia.m@gmail.com'],
  ['CAROLINA ESCOBAR NIETO', 'caroescobar@hotmail.com'], ['DANIELA CASTRO VALENCIA', 'danicastrov@gmail.com'],
  ['EDWIN FERNANDO QUIÑONES', 'edwinquinones@gmail.com'], ['ESTEFANÍA RUIZ CARDONA', 'estefaruiz@gmail.com'],
  ['GUSTAVO ADOLFO PAREDES', 'gusparedes@hotmail.com'], ['KAREN LORENA ÁLVAREZ', 'karenalvarez.l@gmail.com'],
  ['LAURA VANESSA MONTOYA', 'lauramontoya@gmail.com'], ['MANUELA GIRALDO BETANCOURT', 'manugiraldo@gmail.com'],
  ['NATALIA OROZCO SERNA', 'nataorozco@hotmail.com'], ['OSCAR IVÁN MOSQUERA', 'oscarmosquera@gmail.com'],
  ['SEBASTIÁN ARANGO ZAPATA', 'sebasarango@gmail.com'], ['TATIANA MARCELA RIASCOS', 'tatiriascos@gmail.com'],
  ['WILMER ANDRÉS CUERO', 'wilmercuero@gmail.com'], ['YURANI PATRICIA ANGULO', 'yuraniangulo@gmail.com'],
];
const DE_TURNO = new Set(['andreacmunoz@gmail.com', 'diegosanchez.r@gmail.com', 'juanprestrepo.v@gmail.com',
  'luisacaicedo@gmail.com', 'mafeloaiza@hotmail.com']);
const ASESORES = [
  ...USUARIOS.filter((u) => u.r === 'advisor').map((u) => ({ n: u.n, e: u.e })),
  ...EXTRA.map(([n, e]) => ({ n, e })),
].sort((a, b) => a.n.localeCompare(b.n, 'es')).map((a) => ({ ...a, turno: DE_TURNO.has(a.e) }));
if (ASESORES.length !== 27) throw new Error('deben ser 27 asesores, hay ' + ASESORES.length);
const N_TURNO = ASESORES.filter((a) => a.turno).length;

// ── Tintas (T o T.navy con alfa) ─────────────────────────────────────────────
const navyA = (a) => `rgba(46,63,132,${a})`;
const C = {
  hoja: '#ffffff',
  filete: navyA(0.08),
  fileteFondo: navyA(0.12),
  banda: navyA(0.028),
  realce: navyA(0.045),
  campo: navyA(0.035),
  // Borde de campo editable: navy al 58 % sobre blanco = #868fb7, 3,1:1 contra la hoja (WCAG 1.4.11).
  bordeCampo: navyA(0.58),
};
const MONO = "font-family: ui-monospace, 'Cascadia Mono', 'SF Mono', Consolas, monospace;";
const truncar = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
const num = 'font-variant-numeric: tabular-nums;';

// ── Geometría ────────────────────────────────────────────────────────────────
const PAD = 28;          // margen de la isla
const PH = 20;           // sangría de la hoja (como Usuarios)
const RANURA = 32;       // columna del icono de sección (la de los avatares en Usuarios)
const X_TXT = PH + RANURA + 12;   // 64: donde arranca todo el texto de la hoja
const COL_ETQ = 300;     // columna de "qué es este campo"
const HUECO = 32;
const ANCHO_CAMPO = 440;
// Alturas fijas (border-box, el filete va dentro): el alto de Completa sale de sumarlas.
// fila: campo + línea "Guardado" debajo; filaCorta: campo solo (la ayuda cabe en una línea).
const H = { cab: 58, franja: 56, banda: 64, sub: 40, fila: 84, filaCorta: 70, pie: 68, prueba: 60, perfil: 124, barra: 60, itemAsesor: 52 };

// ── Piezas ───────────────────────────────────────────────────────────────────
const punto = (color, d = 8) => `<span style="width: ${d}px; height: ${d}px; flex-shrink: 0; border-radius: 9999px; background: ${color};"></span>`;

// Ámbar = falta algo (hoy "Requiere datos" / "Pendiente" / "Sin asesores" van en ámbar).
// Tailwind amber-700 = #bb4d00: 5,03:1 sobre la hoja, 4,81:1 sobre la banda; sirve de texto y de punto.
const AMBAR = 'oklch(55.5% 0.163 48.998)';

/** Estado en línea: punto + texto (esmeralda 700 sobre la banda 5,0:1; punto esmeralda 600 3,49:1). */
const estado = (ok, siTxt, noTxt) => ok
  ? `<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; line-height: 16px; font-weight: 500; color: ${T.emerald700}; white-space: nowrap;">${punto(T.emerald600, 7)}${siTxt}</span>`
  : `<span style="display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; line-height: 16px; font-weight: 500; color: ${AMBAR}; white-space: nowrap;">${punto(AMBAR, 7)}${noTxt}</span>`;

const botonPrimario = (texto, ico = 'check', { desactivado = false } = {}) => desactivado
  ? `<div title="Se activa al escribir una API key nueva" style="height: 36px; flex-shrink: 0; display: inline-flex; align-items: center; gap: 8px; padding: 0 16px 0 14px; border-radius: 10px; background: ${navyA(0.06)}; box-shadow: inset 0 0 0 1px ${navyA(0.1)}; color: ${T.muted}; font-size: 13px; line-height: 18px; font-weight: 600; white-space: nowrap;">${icono(ico, 15, 2)}${texto}</div>`
  : `<div style="height: 36px; flex-shrink: 0; display: inline-flex; align-items: center; gap: 8px; padding: 0 16px 0 14px; border-radius: 10px; background: ${T.btnPrimary}; box-shadow: 0 1px 2px ${navyA(0.3)}, 0 6px 16px -6px ${navyA(0.55)}, inset 0 1px 0 rgba(255,255,255,.14); color: #ffffff; font-size: 13px; line-height: 18px; font-weight: 600; white-space: nowrap;">${icono(ico, 15, 2)}${texto}</div>`;

const botonSecundario = (ico, texto) =>
  `<div style="height: 32px; flex-shrink: 0; display: inline-flex; align-items: center; gap: 7px; padding: 0 12px 0 10px; border-radius: 9px; background: #ffffff; box-shadow: inset 0 0 0 1px ${navyA(0.16)}, 0 1px 2px ${navyA(0.08)}; color: ${T.navy}; font-size: 12.5px; line-height: 16px; font-weight: 600; white-space: nowrap;"><span style="display: flex; color: ${T.navy};">${icono(ico, 15, 1.75)}</span>${texto}</div>`;

/** Campo editable. Sin valor: texto de ejemplo en pizarra (5,9:1). Con valor: navy. */
const campo = ({ ico, valor = '', ejemplo = '', mono = false, ancho = ANCHO_CAMPO, foco = false }) => `
                <div style="width: ${ancho}px; height: 38px; border-radius: 9px; background: #ffffff; box-shadow: inset 0 0 0 1px ${foco ? T.navy : C.bordeCampo}${foco ? `, 0 0 0 3px ${navyA(0.14)}` : ''}; display: flex; align-items: center; gap: 10px; padding: 0 12px;">
                  <span style="display: flex; color: ${T.muted};">${icono(ico, 15, 1.75)}</span>
                  <span style="min-width: 0; font-size: 13px; line-height: 18px; ${valor ? `color: ${T.navy}; ${mono ? MONO + ' font-size: 12.5px; letter-spacing: .02em;' : ''}` : `color: ${T.muted};`} ${truncar}">${valor || ejemplo}</span>
                </div>`;

/** Lo que hay guardado, enmascarado, y cómo se conserva. */
const guardado = (mascara, genero = 'o') => `
                <div style="margin-top: 7px; display: flex; align-items: center; gap: 6px; font-size: 12px; line-height: 16px; color: ${T.muted}; white-space: nowrap;">
                  <span style="display: flex;">${icono('lock', 12, 2)}</span><span>Guardad${genero}</span>
                  <span style="${MONO} font-size: 12px; letter-spacing: .02em; color: ${T.navy};">${mascara}</span>
                  <span aria-hidden="true">·</span><span>vacío, se conserva</span>
                </div>`;

/** Fila de ajuste: a la izquierda qué es y qué acepta; a la derecha el campo. */
const fila = ({ etiqueta, ayuda, dentro, alto = H.fila, final = false }) => `
            <div style="height: ${alto}px; flex-shrink: 0; padding: 16px ${PH}px 0 ${X_TXT}px; display: grid; grid-template-columns: ${COL_ETQ}px minmax(0, 1fr); column-gap: ${HUECO}px; align-items: start;${final ? '' : ` border-bottom: 1px solid ${C.filete};`}">
              <div style="min-width: 0; display: flex; flex-direction: column; gap: 3px;">
                <span style="font-size: 13.5px; line-height: 18px; font-weight: 600; letter-spacing: -.003em; color: ${T.navy};">${etiqueta}</span>
                <span style="font-size: 12px; line-height: 17px; color: ${T.muted};">${ayuda}</span>
              </div>
              <div style="min-width: 0;">${dentro}
              </div>
            </div>`;

/** Subtítulo de grupo dentro de una sección (hoy: "Credenciales" / "Identificadores"). */
const sub = (titulo, texto) => `
            <div style="height: ${H.sub}px; flex-shrink: 0; padding: 0 ${PH}px 8px ${X_TXT}px; display: flex; align-items: flex-end; gap: 10px;">
              <span style="font-size: 11px; line-height: 16px; font-weight: 600; text-transform: uppercase; letter-spacing: .07em; color: ${T.muted}; white-space: nowrap;">${titulo}</span>
              <span style="font-size: 12px; line-height: 16px; color: ${T.muted}; ${truncar}">${texto}</span>
            </div>`;

/** Banda de sección: icono en la ranura, título + estado, qué hace; acciones a la derecha. */
const banda = ({ ico, titulo, texto, est, acciones = '' }) => `
            <div style="height: ${H.banda}px; flex-shrink: 0; padding: 0 ${PH}px; display: flex; align-items: center; gap: 12px; background: ${C.banda}; border-bottom: 1px solid ${C.filete};">
              <span style="width: ${RANURA}px; flex-shrink: 0; display: flex; justify-content: center; color: ${T.navy};">${icono(ico, 18, 1.75)}</span>
              <div style="min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 3px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <h2 style="font-size: 15px; line-height: 20px; font-weight: 600; letter-spacing: -.01em; color: ${T.navy}; white-space: nowrap;">${titulo}</h2>${est}
                </div>
                <p style="font-size: 12.5px; line-height: 16px; color: ${T.muted}; ${truncar}">${texto}</p>
              </div>${acciones ? `
              <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">${acciones}</div>` : ''}
            </div>`;

/**
 * Pie de sección. En secciones de campos el botón se alinea con el borde izquierdo de los campos;
 * en la de turno (lista a todo el ancho) con el buscador y las casillas.
 */
const pie = (boton, nota, { final = false, columna = true } = {}) => `
            <div style="height: ${H.pie}px; flex-shrink: 0; padding: 0 ${PH}px 0 ${X_TXT}px; display: grid; grid-template-columns: ${columna ? `${COL_ETQ}px ` : ''}minmax(0, 1fr); column-gap: ${HUECO}px; align-items: center;${final ? '' : ` border-bottom: 1px solid ${C.filete};`}">
              ${columna ? '<span></span>' : ''}
              <div style="display: flex; align-items: center; gap: 14px;">${boton}<span style="font-size: 12px; line-height: 16px; color: ${T.muted};">${nota}</span></div>
            </div>`;

// ── Sección 1: WhatsApp Business API ─────────────────────────────────────────
const resultadoPrueba = fila({
  etiqueta: 'Prueba de conexión',
  ayuda: 'Respuesta de Meta al pulsar el botón.',
  alto: H.prueba,
  dentro: `
                <div style="height: 38px; display: flex; align-items: center; gap: 8px; margin-top: -10px; color: ${T.emerald700}; font-size: 13px; line-height: 18px; font-weight: 500;">${icono('circle-check', 16, 2)}${PRUEBA_OK}</div>`,
});

const dato = (etq, valor, extra = '') => `
                  <div style="min-width: 0; display: flex; flex-direction: column; gap: 2px;">
                    <span style="font-size: 12px; line-height: 16px; color: ${T.muted};">${etq}</span>
                    <span style="font-size: 13.5px; line-height: 20px; font-weight: 500; color: ${T.navy}; ${extra} ${truncar}">${valor}</span>
                  </div>`;

const perfil = fila({
  etiqueta: 'Perfil del negocio',
  ayuda: 'Lo que Meta tiene registrado de este número.',
  alto: H.perfil,
  dentro: `
                <div style="display: grid; grid-template-columns: 1.5fr 1fr 1fr; column-gap: 28px; row-gap: 14px;">
                  ${dato('Nombre verificado', PERFIL.nombre)}
                  ${dato('Teléfono', PERFIL.telefono, num)}
                  <div style="min-width: 0; display: flex; flex-direction: column; gap: 2px;">
                    <span style="font-size: 12px; line-height: 16px; color: ${T.muted};">Verificación</span>
                    <span style="height: 20px; display: flex; align-items: center; gap: 6px; font-size: 13.5px; line-height: 20px; font-weight: 500; color: ${PERFIL.verificado ? T.emerald700 : T.slate600};">${icono(PERFIL.verificado ? 'badge-check' : 'circle-alert', 15, 2)}${PERFIL.verificado ? 'Verificado' : 'No verificado'}</span>
                  </div>
                  ${dato('Phone ID', PERFIL.phoneId, MONO + ' font-size: 12.5px;')}
                  ${dato('Calidad', PERFIL.calidad, MONO + ' font-size: 12.5px;')}
                  ${dato('Límite de mensajes', PERFIL.limite, MONO + ' font-size: 12.5px;')}
                </div>`,
});

const seccionWhatsApp = ({ completa }) => [
  banda({
    ico: 'message-circle',
    titulo: 'WhatsApp Business API',
    texto: 'La conexión con Meta por la que se envían y reciben los mensajes de los pacientes.',
    est: estado(WA.configurado, 'Configurado', 'Requiere datos'),
    // Solo con la conexión configurada, como hoy.
    acciones: WA.configurado ? `${botonSecundario('plug-zap', 'Probar conexión')}${botonSecundario('building-2', 'Perfil del negocio')}` : '',
  }),
  completa ? resultadoPrueba : '',
  completa ? perfil : '',
  sub('Credenciales', 'Tokens privados usados por Meta y el webhook.'),
  fila({
    etiqueta: 'Token de acceso',
    ayuda: 'Mínimo 20 caracteres.<br>Meta lo comprueba al guardar.',
    dentro: campo({ ico: 'key-round', ejemplo: 'Pega un token nuevo para reemplazarlo' }) + guardado(WA.token),
  }),
  fila({
    etiqueta: 'Verify token',
    ayuda: 'Meta lo usa para verificar el webhook.<br>Mínimo 8 caracteres.',
    dentro: campo({ ico: 'shield-check', ejemplo: 'Pega un verify token nuevo para reemplazarlo' }) + guardado(WA.verify),
  }),
  sub('Identificadores', 'IDs operativos de WhatsApp Business.'),
  fila({
    etiqueta: 'Phone ID',
    ayuda: 'Solo números, de 10 a 20 dígitos.',
    dentro: campo({ ico: 'phone', valor: WA.phoneId, mono: true, ancho: 280 }),
    alto: H.filaCorta,
  }),
  fila({
    etiqueta: 'Business account ID',
    ayuda: 'Solo números, de 10 a 20 dígitos.',
    dentro: campo({ ico: 'building-2', valor: WA.waba, mono: true, ancho: 280 }),
    alto: H.filaCorta,
  }),
  fila({
    etiqueta: 'Webhook URL',
    ayuda: 'Donde Meta entrega los mensajes. Solo lectura.',
    alto: H.filaCorta,
    dentro: `
                <div style="width: ${ANCHO_CAMPO}px; height: 38px; border-radius: 9px; background: ${C.campo}; display: flex; align-items: center; gap: 10px; padding: 0 12px;">
                  <span style="display: flex; color: ${T.muted};">${icono('webhook', 15, 1.75)}</span>
                  <span style="min-width: 0; flex: 1; ${MONO} font-size: 12.5px; line-height: 18px; color: ${T.navy}; ${truncar}">${WA.webhook}</span>
                  <span title="Solo lectura" style="display: flex; color: ${T.muted};">${icono('lock', 13, 2)}</span>
                </div>`,
  }),
  pie(botonPrimario('Guardar'), 'Un campo que dejes vacío conserva lo guardado.'),
].join('');

const altoWhatsApp = (completa) =>
  H.banda + (completa ? H.prueba + H.perfil : 0) + 2 * H.sub + 2 * H.fila + 3 * H.filaCorta + H.pie;

// ── Sección 2: Groq ──────────────────────────────────────────────────────────
const seccionGroq = () => [
  banda({
    ico: 'audio-lines',
    titulo: 'Transcripción y corrector',
    texto: 'Groq pasa a texto los audios que llegan por WhatsApp y corrige la ortografía, con una sola API key.',
    est: estado(GROQ.configurado, 'Activo', 'Pendiente'),
  }),
  fila({
    etiqueta: 'API key de Groq',
    ayuda: 'Mínimo 20 caracteres.<br>Groq la comprueba al guardar.',
    dentro: campo({ ico: 'key-round', ejemplo: 'Pega una API key nueva para reemplazarla' }) + guardado(GROQ.key, 'a'),
  }),
  pie(botonPrimario('Guardar configuración', 'check', { desactivado: true }), 'Se activa cuando escribes una API key nueva.'),
].join('');
const altoGroq = H.banda + H.fila + H.pie;

// ── Sección 3: Asesores de turno ─────────────────────────────────────────────
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y']);
const nombrePropio = (n) => n.toLocaleLowerCase('es').split(' ').filter(Boolean)
  .map((p, i) => (i > 0 && PARTICULAS.has(p) ? p : p.charAt(0).toLocaleUpperCase('es') + p.slice(1))).join(' ');

const avatar = (a, size = 30, anillo = '') =>
  `<div style="width: ${size}px; height: ${size}px; flex-shrink: 0; border-radius: 9999px; background: ${navyA(0.1)}; color: ${T.navy}; box-shadow: ${anillo ? anillo + ', ' : ''}inset 0 0 0 1px ${navyA(0.06)}; font-size: 11px; line-height: 1; font-weight: 600; letter-spacing: .02em; display: flex; align-items: center; justify-content: center;">${iniciales(a.n)}</div>`;

/** Casilla: marcada navy con visto blanco; vacía con contorno pizarra 500 (4,76:1). */
const casilla = (on) => on
  ? `<span style="width: 18px; height: 18px; flex-shrink: 0; border-radius: 5px; background: ${T.navy}; color: #ffffff; display: flex; align-items: center; justify-content: center;">${icono('check', 12, 3)}</span>`
  : `<span style="width: 18px; height: 18px; flex-shrink: 0; border-radius: 5px; background: #ffffff; box-shadow: inset 0 0 0 1.5px ${T.slate500};"></span>`;

const itemAsesor = (a) => `
                <div title="${a.turno ? 'Quitar del turno' : 'Poner de turno'}" style="height: ${H.itemAsesor}px; min-width: 0; display: flex; align-items: center; gap: 12px; padding: 0 12px; border-radius: 10px;${a.turno ? ` background: ${C.realce};` : ''}">
                  ${casilla(a.turno)}${avatar(a)}
                  <div style="min-width: 0; display: flex; flex-direction: column; gap: 1px;">
                    <span style="font-size: 13px; line-height: 18px; font-weight: 600; color: ${T.navy}; ${truncar}">${nombrePropio(a.n)}</span>
                    <span style="font-size: 12px; line-height: 16px; color: ${T.muted}; ${truncar}">${a.e}</span>
                  </div>
                </div>`;

const buscador = `
              <div style="position: relative; width: 320px; flex-shrink: 0;">
                <span style="position: absolute; left: 12px; top: 10px; color: ${T.muted};">${icono('search', 16, 1.75)}</span>
                <div style="height: 36px; border-radius: 10px; padding: 0 12px 0 38px; background: ${C.campo}; box-shadow: inset 0 0 0 1px ${navyA(0.1)}; font-size: 13px; line-height: 18px; color: ${T.muted}; display: flex; align-items: center; ${truncar}">Buscar asesor...</div>
              </div>`;

const FILAS_LISTA = Math.ceil(ASESORES.length / 3);
const HUECO_LISTA = 4;
const altoLista = 12 + FILAS_LISTA * H.itemAsesor + (FILAS_LISTA - 1) * HUECO_LISTA + 12;

const seccionTurno = () => [
  banda({
    ico: 'users',
    titulo: 'Asesores de turno',
    texto: 'Las conversaciones que entran por WhatsApp se asignan a uno de los asesores de turno.',
    est: estado(N_TURNO > 0, `${N_TURNO} de turno`, 'Sin asesores'),
  }),
  `
            <div style="height: ${H.barra}px; flex-shrink: 0; padding: 0 ${PH}px 0 ${X_TXT}px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid ${C.filete};">
              ${buscador}
              <span style="margin-left: auto; font-size: 12.5px; line-height: 16px; color: ${T.muted}; ${num} white-space: nowrap;"><span style="font-weight: 600; color: ${T.navy};">${N_TURNO}</span> de ${ASESORES.length} seleccionados</span>
            </div>`,
  // Orden alfabético por columnas (hacia abajo y luego a la derecha). Marcar no mueve a nadie de sitio.
  `
            <div style="height: ${altoLista}px; flex-shrink: 0; padding: 12px ${PH}px 12px ${X_TXT - 12}px; display: grid; grid-auto-flow: column; grid-template-rows: repeat(${FILAS_LISTA}, ${H.itemAsesor}px); grid-template-columns: repeat(3, minmax(0, 1fr)); column-gap: 16px; row-gap: ${HUECO_LISTA}px; border-bottom: 1px solid ${C.filete};">${ASESORES.map(itemAsesor).join('')}
            </div>`,
  pie(botonPrimario('Guardar cambios'), 'Al guardar, quedan de turno solo los marcados y los demás salen del turno.', { final: true, columna: false }),
].join('');
const altoTurno = H.banda + H.barra + altoLista + H.pie;

// ── Cabecera y franja ────────────────────────────────────────────────────────
const cabecera = `
        <div style="height: ${H.cab}px; flex-shrink: 0; display: flex; flex-direction: column; gap: 4px;">
          <h1 style="font-size: 28px; line-height: 34px; font-weight: 600; letter-spacing: -.025em; color: ${T.navy};">Configuración del sistema</h1>
          <p style="font-size: 14px; line-height: 20px; color: ${T.muted};">Gestiona las configuraciones globales de Evarisbot</p>
        </div>`;

const marcaIco = (ico) => `<span style="display: flex; color: ${T.navy};">${icono(ico, 14, 2)}</span>`;
const divisor = `<div style="width: 1px; align-self: stretch; background: ${C.fileteFondo};"></div>`;

/** Un estado de la franja: etiqueta arriba, valor grande con su punto de color, detalle al lado. */
const estadoFranja = (ico, etiqueta, ok, valor, detalle) => `
          <div style="min-width: 0; display: flex; flex-direction: column; gap: 6px;">
            <div style="height: 16px; display: flex; align-items: center; gap: 8px;">${marcaIco(ico)}<span style="font-size: 12px; line-height: 16px; font-weight: 500; color: ${T.muted}; ${truncar}">${etiqueta}</span></div>
            <div style="height: 34px; display: flex; align-items: center; gap: 10px; min-width: 0;">
              ${punto(ok ? T.emerald600 : T.slate500, 9)}
              <span style="font-size: 24px; line-height: 34px; font-weight: 500; letter-spacing: -.025em; color: ${T.navy}; white-space: nowrap;">${valor}</span>
              <span style="margin-top: 5px; font-size: 13px; line-height: 16px; color: ${T.muted}; ${num} ${truncar}">${detalle}</span>
            </div>
          </div>`;

const pila = `<div style="display: flex; align-items: center; flex-shrink: 0; margin-left: 4px;">${ASESORES.filter((a) => a.turno).map((a) =>
  `<div title="${nombrePropio(a.n)}" style="flex-shrink: 0; border-radius: 9999px;">${avatar(a, 28, `0 0 0 2px ${T.bg}`)}</div>`).join('')}</div>`;

const franja = `
        <div style="height: ${H.franja}px; flex-shrink: 0; display: grid; grid-template-columns: minmax(0, 1.25fr) 1px minmax(0, 1fr) 1px minmax(0, 1.35fr); column-gap: 24px;">
          ${estadoFranja('message-circle', 'WhatsApp Business', WA.configurado, WA.configurado ? 'Configurado' : 'Pendiente', WA.phoneId ? `Phone ID ${WA.phoneId}` : 'Sin Phone ID')}${divisor}
          ${estadoFranja('audio-lines', 'Transcripción y corrector', GROQ.configurado, GROQ.configurado ? 'Activo' : 'Pendiente', 'Groq')}${divisor}
          <div style="min-width: 0; display: flex; flex-direction: column; gap: 6px;">
            <div style="height: 16px; display: flex; align-items: center; gap: 8px;">${marcaIco('users')}<span style="font-size: 12px; line-height: 16px; font-weight: 500; color: ${T.muted};">Asesores de turno</span></div>
            <div style="height: 34px; display: flex; align-items: center; gap: 10px;">
              ${punto(N_TURNO > 0 ? T.emerald600 : T.slate500, 9)}
              <span style="display: flex; align-items: baseline; gap: 7px;"><span style="font-size: 24px; line-height: 34px; font-weight: 500; letter-spacing: -.025em; color: ${T.navy}; ${num}">${N_TURNO}</span><span style="font-size: 13px; line-height: 16px; color: ${T.muted}; ${num} white-space: nowrap;">de ${ASESORES.length}</span></span>
              ${pila}
            </div>
          </div>
        </div>`;

// ── La hoja ──────────────────────────────────────────────────────────────────
const sombraHoja = `0 0 0 1px ${navyA(0.07)}, 0 1px 2px ${navyA(0.05)}, 0 14px 32px -18px ${navyA(0.22)}`;
const contenidoHoja = (completa) => seccionWhatsApp({ completa }) + seccionGroq() + seccionTurno();

// Main: la hoja sigue bajo el borde de la isla; el velo funde lo que asoma (como en Usuarios).
const VELO = 38;
const hojaMain = `
        <div style="position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; border-radius: 16px 16px 0 0; background: ${C.hoja}; box-shadow: ${sombraHoja}; overflow: hidden;">
          ${contenidoHoja(false)}
          <div style="position: absolute; left: 0; right: 0; bottom: 0; height: ${VELO}px; z-index: 5; background: linear-gradient(180deg, rgba(255,255,255,0), #ffffff 88%); pointer-events: none;"></div>
        </div>`;

const ALTO_HOJA_COMPLETA = altoWhatsApp(true) + altoGroq + altoTurno;
const hojaCompleta = `
        <div style="height: ${ALTO_HOJA_COMPLETA}px; flex-shrink: 0; display: flex; flex-direction: column; border-radius: 16px; background: ${C.hoja}; box-shadow: ${sombraHoja}; overflow: hidden;">
          ${contenidoHoja(true)}
        </div>`;

// ── Artboards ────────────────────────────────────────────────────────────────
const GAP = 24;
const pantallaMain = `
      <div style="position: absolute; inset: 0; padding: ${PAD}px ${PAD}px 0; display: flex; flex-direction: column; gap: ${GAP}px;">
        ${cabecera}
        ${franja}
        ${hojaMain}
      </div>`;

const main = documento(carcasaMarco({ activo: 'settings', contenido: pantallaMain, ancho: 1440 }));
fs.writeFileSync(path.join(DIR, 'Main.dc.html'), main);
console.log(`  Main.dc.html      ${Buffer.byteLength(main)} bytes  (isla ${ISLA.ancho}x${ISLA.alto})`);

const ALTO_COMPLETA = PAD + H.cab + GAP + H.franja + GAP + ALTO_HOJA_COMPLETA + PAD;
const completa = documento(`
<div style="position: relative; width: ${ISLA.ancho}px; height: ${ALTO_COMPLETA}px; overflow: hidden; border-radius: ${RADIO_ISLA}px; background: ${T.bg}; font-family: ${T.font};">
      <div style="padding: ${PAD}px; display: flex; flex-direction: column; gap: ${GAP}px;">
        ${cabecera}
        ${franja}
        ${hojaCompleta}
      </div>
</div>`);
fs.writeFileSync(path.join(DIR, 'Completa.dc.html'), completa);
console.log(`  Completa.dc.html  ${Buffer.byteLength(completa)} bytes  (${ISLA.ancho}x${ALTO_COMPLETA})`);
