// Estadísticas (/admin/statistics) rediseñada dentro de la carcasa "Marco navy", en el mismo lenguaje
// que Usuarios y Configuración (design/vista-usuarios/gen_vista.mjs, design/vista-configuracion/gen_config.mjs).
//
// Idea: arriba, el periodo y una franja con las seis cifras del periodo (cada una lleva a su tema).
// Debajo, UNA hoja blanca que se lee de arriba abajo por temas: costo, mensajes, citas, conversaciones
// y plantillas, menú de bienvenida y asesores. Cada tema abre con su banda y enseña a la vez la cifra y
// su gráfico: desaparece el conmutador Tabla / Gráficos y desaparecen las ventanas de detalle de las
// tarjetas, porque lo que tenían ya está en su tema. El detalle de un asesor se abre en un panel lateral.
//
// Escribe tres artboards:
//   Main.dc.html      1440x900: la pantalla al entrar (menú fijado, isla 1190x880).
//   Completa.dc.html  1190 x alto necesario: la página entera.
//   Detalle.dc.html   1440x900: el panel lateral con el detalle de un asesor, sobre la tabla de asesores.
//
// TODAS las cifras, EPS, servicios y nombres son de EJEMPLO e inventados (forma real de las props de
// StatisticsController@index y @advisorDetail). Periodo de muestra: "Este mes" = 1 a 13 sept 2026.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { T, icono, iniciales, documento } from '../usuarios/_comun.mjs';
import { carcasaMarco, ISLA, RADIO_ISLA } from '../usuarios/_marco.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));

// ══ PALETA DE GRÁFICOS ════════════════════════════════════════════════════════════════════════════
// Pensada para pasarla tal cual a recharts (fill / stroke de <Bar>, <Cell>, <Line>; CartesianGrid y
// ejes con GRAF.rejilla / GRAF.eje). Contraste contra la hoja blanca (#fff), mínimo 3:1 para marcas:
//   serie     #2e3f84  navy de marca, la serie principal (costo, mensajes, conversaciones)   9,72:1
//   serie2    #7c88c0  navy claro, segunda serie sin significado (recibidos de pacientes)    3,42:1
//   entregado #059669  esmeralda 600: entregado, confirmada, autoservicio, envío exitoso    3,77:1
//   pendiente #d97706  ámbar 600: en cola, sin respuesta aún                                3,19:1
//   fallido   #dc2626  rojo 600: error, cancelada, fallida, rechazó privacidad              4,83:1
//   curso     #0284c7  cielo 600: enviado (aún sin entregar), activas, asesores del equipo  4,10:1
//   neutro    #64748b  pizarra 500: pendiente de enviar, en proceso, sin datos              4,76:1
//   pista     rgba(46,63,132,.07)  fondo de barra (no es dato, sin requisito)
//   rejilla   rgba(46,63,132,.08)  líneas horizontales (sin rejilla vertical)
//   eje       #5c6485  texto de ejes y leyendas, 11-12 px (5,81:1 sobre blanco)
// Los segmentos apilados se separan con 2 px de blanco, así no dependen solo del color.
// Texto con color: esmeralda 700 #047857 (5,48:1), ámbar 700 #b45309 (5,02:1), rojo 600 (4,83:1).
export const GRAF = {
  serie: '#2e3f84', serie2: '#7c88c0',
  entregado: '#059669', pendiente: '#d97706', fallido: '#dc2626', curso: '#0284c7', neutro: '#64748b',
  pista: 'rgba(46,63,132,.07)', rejilla: 'rgba(46,63,132,.08)', eje: '#5c6485',
};
const TXT = { ok: '#047857', aviso: '#b45309', mal: '#dc2626' };

// ══ Formato ═══════════════════════════════════════════════════════════════════════════════════════
const miles = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const dec = (x, d = 1) => x.toFixed(d).replace('.', ',');
const pct = (v, t, d = 1) => (t ? dec((v / t) * 100, d) : '0') + ' %';
const usd = (x, d = 2) => 'US$ ' + dec(x, d);

// ══ Datos de EJEMPLO (inventados) ═════════════════════════════════════════════════════════════════
const PERIODO = { activo: 'month', texto: 'Este mes', rango: 'del 1 al 13 de septiembre de 2026' };

const MSG = { total: 48215, sent: 31402, received: 16813,
  estado: { read: 17964, delivered: 9873, sent: 2410, pending: 38, failed: 1117 } };
const CITAS = { total: 12640, reminder: 10982, confirmed: 6814, cancelled: 1207, pending: 1391, failed: 267 };
CITAS.awaiting = CITAS.reminder - CITAS.confirmed - CITAS.cancelled;
const CONV = { active: 312, pending: 146, in_progress: 88, resolved: 5103, closed: 923, scheduled: 302, unread: 142 };
CONV.total = CONV.active + CONV.pending + CONV.in_progress + CONV.resolved + CONV.closed + CONV.scheduled;
const PLANT = { total: 14, sends: 9870, ok: 9604, failed: 266 };
const EQUIPO = { admins: 5, advisors: 27 };

const COSTO = {
  moneda: 'USD', tarifas: '1 jul 2026',
  cat: [
    { k: 'Marketing', s: 'campañas', billable: 412, rate: 0.0125 },
    { k: 'Utility', s: 'recordatorios y citas', billable: 11804, rate: 0.0008 },
    { k: 'Autenticación', s: 'códigos OTP', billable: 0, rate: 0.0008 },
    { k: 'Servicio', s: 'respuestas en 24 h', billable: 0, free: 12960, rate: 0 },
  ],
  outbound: MSG.sent, sinDatos: 6226,
};
COSTO.cat.forEach((c) => { c.cost = c.billable * c.rate; });
COSTO.total = COSTO.cat.reduce((s, c) => s + c.cost, 0);
COSTO.billable = COSTO.cat.reduce((s, c) => s + c.billable, 0);
COSTO.free = 12960;
COSTO.conTarifa = COSTO.billable + COSTO.free;
COSTO.cobertura = (COSTO.conTarifa / COSTO.outbound) * 100;
if (COSTO.conTarifa + COSTO.sinDatos !== COSTO.outbound) throw new Error('cobertura no cuadra');
// Serie diaria (hora Colombia). 1 sept 2026 = martes; 5-6 y 12-13 = fin de semana.
const DIAS = ['mar', 'mié', 'jue', 'vie', 'sáb', 'dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const PESOS = [1.18, 1.06, 1.12, 0.98, 0.34, 0.1, 1.24, 1.3, 1.11, 1.16, 1.02, 0.31, 0.08];
const sumaP = PESOS.reduce((a, b) => a + b, 0);
const SERIE = PESOS.map((w, i) => ({
  dia: DIAS[i], etq: String(i + 1).padStart(2, '0') + '/09',
  cost: (COSTO.total * w) / sumaP, billable: Math.round((COSTO.billable * w) / sumaP),
}));

const BOT = {
  total: 3412, accepted: 3050, menu: 2874,
  servicio: [['Agendamiento', 1236], ['Información', 812], ['Cancelación', 418], ['Hablar con asesor', 408]],
  desenlace: [['Autoservicio', 1920, GRAF.entregado], ['Pasó a asesor', 812, GRAF.serie], ['Rechazó privacidad', 362, GRAF.fallido], ['En proceso', 318, GRAF.neutro]],
  regimen: [['Subsidiado', 1894], ['Contributivo', 812], ['Especial', 74]],
  eps: [['Pacífico Salud EPS-S', 842], ['Nueva Salud EPS', 611], ['Comunitaria del Valle', 402], ['Farallones EPS', 288],
    ['Salud Andina', 214], ['Unión Médica EPS', 131], ['Vida Plena EPS', 97], ['Cauca Salud', 64]],
  sub: [['Consulta externa', 512], ['Ortopedia', 298], ['Ginecología', 244], ['Medicina interna', 201],
    ['Pediatría', 176], ['Oftalmología', 142], ['Cirugía general', 128], ['Dermatología', 95]],
};
BOT.auto = (1920 / (1920 + 812)) * 100;

// Asesores: nombres de _comun.mjs y gen_config.mjs. [nombre, correo, asignadas, resueltas, activas, agendadas, mensajes, con sin leer]
const A = [
  ['ANDREA CAROLINA MUÑOZ PAZ', 'andreacmunoz@gmail.com', 412, 386, 9, 12, 1842, 3],
  ['DIEGO ALEJANDRO SÁNCHEZ ROJAS', 'diegosanchez.r@gmail.com', 398, 361, 14, 18, 1716, 5],
  ['MARÍA FERNANDA LOAIZA CRUZ', 'mafeloaiza@hotmail.com', 377, 342, 11, 21, 1655, 2],
  ['JUAN PABLO RESTREPO VÉLEZ', 'juanprestrepo.v@gmail.com', 361, 318, 17, 15, 1590, 6],
  ['LUISA MARÍA CAICEDO GÓMEZ', 'luisacaicedo@gmail.com', 344, 309, 12, 19, 1488, 4],
  ['VALENTINA OSPINA TORO', 'valeospina.t@gmail.com', 338, 297, 16, 22, 1432, 7],
  ['CAROLINA ESCOBAR NIETO', 'caroescobar@hotmail.com', 331, 290, 13, 17, 1391, 3],
  ['CRISTIAN DAVID MORENO LASSO', 'cdmoreno@gmail.com', 322, 281, 18, 14, 1370, 8],
  ['PAOLA ANDREA VIVEROS SOLARTE', 'paoviveros@hotmail.com', 318, 279, 10, 20, 1302, 2],
  ['DANIELA CASTRO VALENCIA', 'danicastrov@gmail.com', 305, 268, 15, 16, 1266, 5],
  ['JESSICA TATIANA BOLAÑOS ARIAS', 'jessibolanos@gmail.com', 296, 254, 19, 13, 1204, 9],
  ['KAREN LORENA ÁLVAREZ', 'karenalvarez.l@gmail.com', 288, 249, 12, 18, 1158, 4],
  ['SEBASTIÁN ARANGO ZAPATA', 'sebasarango@gmail.com', 281, 241, 16, 11, 1120, 6],
  ['NATALIA OROZCO SERNA', 'nataorozco@hotmail.com', 276, 236, 14, 15, 1087, 3],
  ['CAMILA ANDREA RINCÓN PÉREZ', 'camirincon@gmail.com', 262, 219, 21, 12, 1031, 11],
  ['ESTEFANÍA RUIZ CARDONA', 'estefaruiz@gmail.com', 241, 198, 17, 10, 942, 7],
  ['OSCAR IVÁN MOSQUERA', 'oscarmosquera@gmail.com', 226, 181, 20, 9, 876, 10],
  ['LAURA VANESSA MONTOYA', 'lauramontoya@gmail.com', 188, 142, 22, 8, 731, 12],
  ['BRAYAN STIVEN GARCÍA MINA', 'brayangarcia.m@gmail.com', 142, 96, 24, 7, 548, 14],
  ['WILMER ANDRÉS CUERO', 'wilmercuero@gmail.com', 98, 52, 26, 5, 402, 9],
  ['EDWIN FERNANDO QUIÑONES', 'edwinquinones@gmail.com', 61, 21, 18, 2, 233, 8],
  ['GUSTAVO ADOLFO PAREDES', 'gusparedes@hotmail.com', 0, 0, 0, 0, 12, 0],
  ['SANTIAGO ANDRÉS HURTADO MEJÍA', 'santihurtado.m@gmail.com', 0, 0, 0, 0, 0, 0],
  ['ALEJANDRA LÓPEZ CASTAÑO', 'alelopezc@gmail.com', 0, 0, 0, 0, 0, 0],
  ['MANUELA GIRALDO BETANCOURT', 'manugiraldo@gmail.com', 0, 0, 0, 0, 0, 0],
  ['TATIANA MARCELA RIASCOS', 'tatiriascos@gmail.com', 0, 0, 0, 0, 0, 0],
  ['YURANI PATRICIA ANGULO', 'yuraniangulo@gmail.com', 0, 0, 0, 0, 0, 0],
].map(([n, e, conv, res, act, sch, msgs, unread]) => ({ n, e, conv, res, act, sch, msgs, unread, rate: conv > 0 ? (res * 100) / conv : null }));
if (A.length !== 27) throw new Error('deben ser 27 asesores');
const ASE = {
  total: A.length,
  conv: A.reduce((s, a) => s + a.conv, 0), res: A.reduce((s, a) => s + a.res, 0),
  sch: A.reduce((s, a) => s + a.sch, 0), msgs: A.reduce((s, a) => s + a.msgs, 0),
};
ASE.rate = (ASE.res * 100) / ASE.conv;
const TOP = A[0];

// Detalle de asesor (GET /admin/statistics/advisor/{id}); al abrir, el periodo del panel es "Todo el tiempo".
const DET = {
  a: TOP, msgs: 14206, conv: 3184, res: 2991, sch: 64, act: 9, pend: 5, mediana: 14,
  diario: [['lun 07', 212], ['mar 08', 248], ['mié 09', 231], ['jue 10', 264], ['vie 11', 219], ['sáb 12', 41], ['dom 13', 12]],
  tipos: [['text', 11873], ['template', 1402], ['image', 604], ['document', 231], ['audio', 96]],
};
DET.rate = (DET.res * 100) / DET.conv;
const PESOS_H = [0, 0, 0, 0, 0, 0.3, 2.2, 7.6, 10.8, 12.1, 11.6, 9.4, 4.8, 6.9, 10.2, 9.1, 6.8, 3.9, 1.8, 0.9, 0.5, 0.2, 0, 0];
const sH = PESOS_H.reduce((a, b) => a + b, 0);
DET.hora = PESOS_H.map((w, h) => [String(h).padStart(2, '0') + ':00', Math.round((DET.msgs * w) / sH)]);
if (DET.tipos.reduce((s, [, v]) => s + v, 0) !== DET.msgs) throw new Error('tipos no suman');

// ══ Tintas y geometría ════════════════════════════════════════════════════════════════════════════
const navyA = (a) => `rgba(46,63,132,${a})`;
const C = { hoja: '#ffffff', filete: navyA(0.08), fileteFondo: navyA(0.12), banda: navyA(0.028), realce: navyA(0.045), campo: navyA(0.035) };
const truncar = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
const num = 'font-variant-numeric: tabular-nums;';
const PAD = 28, PH = 20, RANURA = 32, X_TXT = PH + RANURA + 12; // 64: donde arranca el texto de la hoja
const ANCHO_HOJA = ISLA.ancho - 2 * PAD;                        // 1134
const ANCHO_CUERPO = ANCHO_HOJA - X_TXT - PH;                    // 1050
const H = {
  cab: 58, franja: 76, banda: 64,
  costoA: 290, costoB: 112, mensajes: 226, citas: 236, convPlant: 290,
  botA: 100, botB: 88, botC: 340, aseA: 96, aseB: 52, thead: 36, filaAse: 50,
};
const GAP = 24;

// ══ Piezas ════════════════════════════════════════════════════════════════════════════════════════
const t = (px, lh, peso, color, extra = '') => `font-size: ${px}px; line-height: ${lh}px; font-weight: ${peso}; color: ${color}; ${extra}`;
const punto = (color, d = 8, r = 9999) => `<span style="width: ${d}px; height: ${d}px; flex-shrink: 0; border-radius: ${r}px; background: ${color};"></span>`;
const cuadro = (color) => punto(color, 9, 2.5);
const divisor = (color = C.fileteFondo) => `<div style="width: 1px; align-self: stretch; background: ${color};"></div>`;
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y']);
const nombrePropio = (n) => n.toLocaleLowerCase('es').split(' ').filter(Boolean)
  .map((p, i) => (i > 0 && PARTICULAS.has(p) ? p : p.charAt(0).toLocaleUpperCase('es') + p.slice(1))).join(' ');
const avatar = (n, size = 30) =>
  `<div style="width: ${size}px; height: ${size}px; flex-shrink: 0; border-radius: 9999px; background: ${navyA(0.1)}; color: ${T.navy}; box-shadow: inset 0 0 0 1px ${navyA(0.06)}; font-size: ${size >= 36 ? 13 : 11}px; line-height: 1; font-weight: 600; letter-spacing: .02em; display: flex; align-items: center; justify-content: center;">${iniciales(n)}</div>`;

/** Rótulo en versalitas (el de "Credenciales" en Configuración) con texto de apoyo. */
const rotulo = (titulo, apoyo = '', extra = '') => `
              <div style="height: 16px; display: flex; align-items: baseline; gap: 10px; ${extra}">
                <span style="${t(11, 16, 600, T.muted, 'text-transform: uppercase; letter-spacing: .07em; white-space: nowrap;')}">${titulo}</span>${apoyo ? `
                <span style="${t(12, 16, 400, T.muted, truncar + num)}">${apoyo}</span>` : ''}
              </div>`;

/** Barra apilada horizontal: segmentos separados por 2 px de blanco. */
const apilada = (partes, alto = 12) => {
  const total = partes.reduce((s, p) => s + p.v, 0);
  return `<div style="height: ${alto}px; display: flex; gap: 2px; border-radius: ${alto / 3}px; overflow: hidden;">${partes.filter((p) => p.v > 0).map((p) =>
    `<div title="${p.etq}" style="flex: ${p.v / total} 1 0; min-width: 3px; background: ${p.c};"></div>`).join('')}</div>`;
};

/** Barra simple sobre pista (proporción v/max). */
const barraPista = (v, max, color = GRAF.serie, alto = 6) =>
  `<div style="height: ${alto}px; border-radius: 9999px; background: ${GRAF.pista}; overflow: hidden;"><div style="width: ${max ? Math.max((v / max) * 100, v > 0 ? 1.2 : 0) : 0}%; height: 100%; border-radius: 9999px; background: ${color};"></div></div>`;

/** Fila de leyenda: cuadro, etiqueta, cifra, porcentaje. */
const leyenda = (color, etq, v, total, { alto = 26, fuerte = false } = {}) => `
                <div style="height: ${alto}px; display: grid; grid-template-columns: 9px minmax(0, 1fr) 72px 56px; column-gap: 10px; align-items: center;">
                  ${cuadro(color)}
                  <span style="${t(13, 18, 500, T.navy, truncar)}">${etq}</span>
                  <span style="${t(13, 18, fuerte ? 600 : 500, T.navy, num + 'text-align: right;')}">${miles(v)}</span>
                  <span style="${t(12, 18, 400, T.muted, num + 'text-align: right;')}">${pct(v, total)}</span>
                </div>`;

// Segmentado (el filtro de rol de Usuarios).
const opcion = (texto, activa, peq = false) => activa
  ? `<div style="height: ${peq ? 28 : 30}px; display: flex; align-items: center; padding: 0 ${peq ? 11 : 13}px; border-radius: 8px; background: #ffffff; box-shadow: 0 0 0 1px ${navyA(0.08)}, 0 1px 2px ${navyA(0.12)}, 0 2px 6px -2px ${navyA(0.12)}; ${t(peq ? 12 : 12.5, 16, 600, T.navy, 'white-space: nowrap;')}">${texto}</div>`
  : `<div style="height: ${peq ? 28 : 30}px; display: flex; align-items: center; padding: 0 ${peq ? 11 : 13}px; border-radius: 8px; ${t(peq ? 12 : 12.5, 16, 600, T.muted, 'white-space: nowrap;')}">${texto}</div>`;
const segmentado = (opciones, activa, { peq = false, fondo = navyA(0.055) } = {}) =>
  `<div style="display: flex; align-items: center; gap: 2px; padding: 3px; border-radius: 11px; background: ${fondo}; flex-shrink: 0;">${opciones.map(([k, v]) => opcion(v, k === activa, peq)).join('')}</div>`;
const PERIODOS = [['today', 'Hoy'], ['week', 'Esta semana'], ['month', 'Este mes'], ['year', 'Este año'], ['all', 'Todo el tiempo']];

const campoRango = (texto, { ancho = 188, peq = false } = {}) => `
          <div title="Elige fecha inicio y fecha fin: se aplica al elegir la segunda" style="width: ${ancho}px; height: ${peq ? 34 : 36}px; flex-shrink: 0; border-radius: 10px; background: #ffffff; box-shadow: inset 0 0 0 1px ${navyA(0.16)}, 0 1px 2px ${navyA(0.06)}; display: flex; align-items: center; gap: 9px; padding: 0 12px; color: ${T.muted};">
            ${icono('calendar-range', 15, 1.75)}<span style="${t(peq ? 12 : 12.5, 16, 500, T.muted, truncar)}">${texto}</span>
          </div>`;

const botonPrimario = (ico, texto) =>
  `<div style="height: 36px; flex-shrink: 0; display: inline-flex; align-items: center; gap: 8px; padding: 0 16px 0 14px; border-radius: 10px; background: ${T.btnPrimary}; box-shadow: 0 1px 2px ${navyA(0.3)}, 0 6px 16px -6px ${navyA(0.55)}, inset 0 1px 0 rgba(255,255,255,.14); ${t(13, 18, 600, '#ffffff', 'white-space: nowrap;')}">${icono(ico, 15, 2)}${texto}</div>`;

// ══ Gráfico de columnas (SVG a mano) ══════════════════════════════════════════════════════════════
const rectArriba = (x, y, w, h, r = 3) => {
  if (h <= 0) return '';
  const rr = Math.min(r, h, w / 2);
  return `<path d="M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z"></path>`;
};
/**
 * columnas({ datos: [[etiqueta, valor]], ancho, alto, max, ticks, fmt, cadaEtq, destacar })
 * Eje Y a la izquierda con rejilla horizontal; etiquetas X debajo; relleno GRAF.serie.
 */
const columnas = ({ datos, ancho, alto, max, ticks, fmt = miles, izq = 44, cadaEtq = 1, destacar = -1, anchoBarra = 0.56, color = GRAF.serie, dosLineas = false }) => {
  const abajo = dosLineas ? 36 : 22, arriba = 8;
  const plotW = ancho - izq, plotH = alto - abajo - arriba;
  const paso = plotW / datos.length, bw = Math.max(3, paso * anchoBarra);
  const y = (v) => arriba + plotH - (v / max) * plotH;
  const rejilla = ticks.map((tk) => `
      <line x1="${izq}" x2="${ancho}" y1="${y(tk)}" y2="${y(tk)}" stroke="${tk === 0 ? navyA(0.16) : GRAF.rejilla}" stroke-width="1"></line>
      <text x="${izq - 8}" y="${y(tk) + 4}" text-anchor="end" font-size="11" fill="${GRAF.eje}">${fmt(tk)}</text>`).join('');
  const fondoDest = destacar >= 0 ? `<rect x="${izq + destacar * paso + 2}" y="${arriba}" width="${paso - 4}" height="${plotH}" rx="6" fill="${navyA(0.05)}"></rect>` : '';
  const barras = datos.map(([, v], i) => rectArriba(izq + i * paso + (paso - bw) / 2, y(v), bw, arriba + plotH - y(v))).join('');
  const etqs = dosLineas ? datos.map(([e], i) => {
    const [a, b] = e.split(' '), x = izq + i * paso + paso / 2;
    return `<text x="${x}" y="${alto - 20}" text-anchor="middle" font-size="11" fill="${GRAF.eje}">${a}</text><text x="${x}" y="${alto - 5}" text-anchor="middle" font-size="11" fill="${GRAF.eje}">${b}</text>`;
  }).join('') : datos.map(([e], i) => (i % cadaEtq === 0 ? `<text x="${izq + i * paso + paso / 2}" y="${alto - 6}" text-anchor="middle" font-size="11" fill="${GRAF.eje}"${i === destacar ? ` font-weight="600" style="fill: ${T.navy};"` : ''}>${e}</text>` : '')).join('');
  return `<svg width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}" style="display: block; overflow: visible; font-family: ${T.font}; font-variant-numeric: tabular-nums;">${fondoDest}${rejilla}<g fill="${color}">${barras}</g>${etqs}</svg>`;
};

/** Anillo: segmentos con 2 px de separación; cifra en el centro. */
const anillo = (partes, { d = 156, grosor = 18, centro = '', sub = '' } = {}) => {
  const r = (d - grosor) / 2, circ = 2 * Math.PI * r, total = partes.reduce((s, p) => s + p.v, 0);
  let acum = 0;
  const segs = partes.map((p) => {
    const largo = (p.v / total) * circ - 2.5;
    const s = `<circle cx="${d / 2}" cy="${d / 2}" r="${r}" fill="none" stroke="${p.c}" stroke-width="${grosor}" stroke-dasharray="${largo.toFixed(2)} ${(circ - largo).toFixed(2)}" stroke-dashoffset="${(-acum).toFixed(2)}" transform="rotate(-90 ${d / 2} ${d / 2})"></circle>`;
    acum += (p.v / total) * circ;
    return s;
  }).join('');
  return `
                <div style="position: relative; width: ${d}px; height: ${d}px; flex-shrink: 0;">
                  <svg width="${d}" height="${d}" viewBox="0 0 ${d} ${d}" style="display: block;">${segs}</svg>
                  <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;">
                    <span style="${t(22, 26, 500, T.navy, num + 'letter-spacing: -.02em;')}">${centro}</span>
                    <span style="${t(11.5, 14, 500, T.muted, 'text-align: center;')}">${sub}</span>
                  </div>
                </div>`;
};

// ══ Cabecera y franja ═════════════════════════════════════════════════════════════════════════════
const cabecera = (periodo = PERIODO.activo) => `
        <div style="height: ${H.cab}px; flex-shrink: 0; display: flex; align-items: flex-start; justify-content: space-between; gap: 24px;">
          <div style="min-width: 0; display: flex; flex-direction: column; gap: 4px;">
            <h1 style="${t(28, 34, 600, T.navy, 'letter-spacing: -.025em; white-space: nowrap;')}">Estadísticas</h1>
            <p style="${t(14, 20, 400, T.muted, 'white-space: nowrap;')}"><span style="font-weight: 600; color: ${T.navy};">${PERIODO.texto}</span>, ${PERIODO.rango}</p>
          </div>
          <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
            ${segmentado(PERIODOS, periodo)}
            ${campoRango('Rango de fechas')}
            ${botonPrimario('file-spreadsheet', 'Exportar a Excel')}
          </div>
        </div>`;

const marcaIco = (ico, color = T.navy) => `<span style="display: flex; color: ${color};">${icono(ico, 14, 2)}</span>`;
/** Cifra de la franja: pulsarla lleva a su tema (la flecha lo dice). */
const cifra = ({ ico, color, etq, valor, detalle, destino }) => `
          <div title="Ir a ${destino}" style="min-width: 0; display: flex; flex-direction: column;">
            <div style="height: 16px; display: flex; align-items: center; gap: 8px;">${marcaIco(ico, color)}<span style="${t(12, 16, 500, T.muted, truncar)}">${etq}</span><span style="display: flex; color: ${T.muted}; margin-left: -3px;">${icono('chevron-right', 12, 2)}</span></div>
            <span style="margin-top: 7px; ${t(28, 32, 500, T.navy, num + 'letter-spacing: -.03em; white-space: nowrap;')}">${valor}</span>
            <span style="margin-top: 5px; height: 16px; display: flex; align-items: center; gap: 6px; ${t(12.5, 16, 400, T.muted, num + truncar)}">${detalle}</span>
          </div>`;

const franja = `
        <div style="height: ${H.franja}px; flex-shrink: 0; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr) 1px) minmax(0, 1fr); column-gap: 20px;">
          ${cifra({ ico: 'message-square', etq: 'Mensajes', valor: miles(MSG.total), detalle: `${miles(MSG.sent)} enviados`, destino: 'Mensajes' })}${divisor()}
          ${cifra({ ico: 'calendar-check-2', etq: 'Citas', valor: miles(CITAS.total), detalle: `${miles(CITAS.confirmed)} confirmadas`, destino: 'Citas y recordatorios' })}${divisor()}
          ${cifra({ ico: 'messages-square', etq: 'Conversaciones', valor: miles(CONV.total), detalle: `${punto(GRAF.pendiente, 7)}<span style="color: ${TXT.aviso}; font-weight: 500;">${miles(CONV.unread)} sin leer</span>`, destino: 'Conversaciones' })}${divisor()}
          ${cifra({ ico: 'headphones', color: T.sky700, etq: 'Asesores', valor: miles(ASE.total), detalle: `${dec(ASE.rate)} % de resolución`, destino: 'Rendimiento de asesores' })}${divisor()}
          ${cifra({ ico: 'file-text', etq: 'Plantillas', valor: miles(PLANT.total), detalle: `${miles(PLANT.sends)} envíos`, destino: 'Plantillas y equipo' })}${divisor()}
          ${cifra({ ico: 'wallet', etq: 'Costo estimado', valor: usd(COSTO.total), detalle: 'de WhatsApp (Meta)', destino: 'Costo estimado de WhatsApp' })}
        </div>`;

// ══ Banda de tema ═════════════════════════════════════════════════════════════════════════════════
const banda = ({ ico, titulo, texto, derecha = '' }) => `
            <div style="height: ${H.banda}px; flex-shrink: 0; padding: 0 ${PH}px; display: flex; align-items: center; gap: 12px; background: ${C.banda}; border-bottom: 1px solid ${C.filete};">
              <span style="width: ${RANURA}px; flex-shrink: 0; display: flex; justify-content: center; color: ${T.navy};">${icono(ico, 18, 1.75)}</span>
              <div style="min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 3px;">
                <h2 style="${t(15, 20, 600, T.navy, 'letter-spacing: -.01em; white-space: nowrap;')}">${titulo}</h2>
                <p style="${t(12.5, 16, 400, T.muted, truncar + num)}">${texto}</p>
              </div>${derecha ? `
              <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">${derecha}</div>` : ''}
            </div>`;

const cuerpo = (alto, dentro, { final = false, pad = '18px', extra = '' } = {}) => `
            <div style="height: ${alto}px; flex-shrink: 0; padding: ${pad} ${PH}px ${pad} ${X_TXT}px; ${final ? '' : `border-bottom: 1px solid ${C.filete};`} ${extra}">${dentro}
            </div>`;

// ══ 1. Costo estimado de WhatsApp ═════════════════════════════════════════════════════════════════
const ANCHO_GRAF_COSTO = 590;
const tooltipCosto = (i) => {
  const p = SERIE[i];
  const paso = (ANCHO_GRAF_COSTO - 52) / SERIE.length;
  const x = 52 + i * paso + paso / 2;
  return `
                <div style="position: absolute; left: ${x + 22}px; top: 56px; width: 168px; padding: 9px 12px 10px; border-radius: 10px; background: #ffffff; box-shadow: 0 0 0 1px ${navyA(0.1)}, 0 2px 4px ${navyA(0.06)}, 0 12px 28px -12px ${navyA(0.35)}; display: flex; flex-direction: column; gap: 3px; z-index: 3;">
                  <span style="${t(12, 16, 500, T.muted, num)}">${p.dia} ${p.etq}</span>
                  <span style="display: flex; align-items: center; gap: 8px;">${cuadro(GRAF.serie)}<span style="${t(13, 18, 500, T.navy)}">Costo</span><span style="margin-left: auto; ${t(13, 18, 600, T.navy, num)}">${usd(p.cost)}</span></span>
                  <span style="display: flex; align-items: center; gap: 8px; padding-left: 17px;"><span style="${t(12, 16, 400, T.muted)}">Facturables</span><span style="margin-left: auto; ${t(12, 16, 500, T.navy, num)}">${miles(p.billable)}</span></span>
                </div>`;
};

const tablaCostos = () => {
  const fila = (c) => `
                  <div style="height: 42px; display: grid; grid-template-columns: minmax(0, 1fr) 74px 70px 70px; column-gap: 12px; align-items: center; border-bottom: 1px solid ${C.filete};">
                    <div style="min-width: 0; display: flex; flex-direction: column; gap: 1px;">
                      <span style="${t(13, 17, 500, T.navy, truncar)}">${c.k}</span>
                      <span style="${t(11.5, 14, 400, T.muted, truncar)}">${c.s}</span>
                    </div>
                    <span style="${t(13, 18, 500, c.billable ? T.navy : T.muted, num + 'text-align: right;')}">${miles(c.billable)}</span>
                    <span style="${t(12.5, 18, 400, T.muted, num + 'text-align: right;')}">${c.rate === 0 ? 'Gratis' : usd(c.rate, 4)}</span>
                    <span style="${t(13, 18, 600, c.cost ? T.navy : T.muted, num + 'text-align: right;')}">${usd(c.cost)}</span>
                  </div>`;
  const th = (x, der = true) => `<span style="${t(11, 16, 600, T.muted, 'text-transform: uppercase; letter-spacing: .07em; white-space: nowrap;' + (der ? 'text-align: right;' : ''))}">${x}</span>`;
  return `
                <div style="display: flex; flex-direction: column;">
                  <div style="height: 16px; margin-bottom: 10px; display: grid; grid-template-columns: minmax(0, 1fr) 74px 70px 70px; column-gap: 12px;">${th('Categoría', false)}${th('Facturables')}${th('Tarifa')}${th('Costo')}</div>
                  <div style="height: 1px; background: ${navyA(0.12)};"></div>
                  ${COSTO.cat.map(fila).join('')}
                  <div style="height: 44px; display: grid; grid-template-columns: minmax(0, 1fr) 74px 70px 70px; column-gap: 12px; align-items: center;">
                    <span style="${t(13, 18, 600, T.navy)}">Total estimado</span><span></span><span></span>
                    <span style="${t(14, 18, 600, T.navy, num + 'text-align: right;')}">${usd(COSTO.total)}</span>
                  </div>
                </div>`;
};

const seccionCosto = ({ tooltip = true } = {}) => {
  const max = 2.5;
  const grafico = columnas({
    datos: SERIE.map((p) => [p.etq, p.cost]), ancho: ANCHO_GRAF_COSTO, alto: 214, max, ticks: [0, 0.5, 1, 1.5, 2, 2.5],
    fmt: (v) => (v === 0 ? '0' : dec(v, 2)), izq: 52, destacar: tooltip ? 7 : -1, anchoBarra: 0.5,
  });
  return [
    banda({
      ico: 'wallet', titulo: 'Costo estimado de WhatsApp',
      texto: `Por categoría facturada de Meta, con tarifas de Colombia vigentes al ${COSTO.tarifas}`,
      derecha: `<div style="display: flex; flex-direction: column; align-items: flex-end; gap: 1px;"><span style="${t(12, 16, 400, T.muted)}">Estimado del período</span><span style="${t(20, 24, 600, T.navy, num + 'letter-spacing: -.02em;')}">${usd(COSTO.total)}</span></div>`,
    }),
    cuerpo(H.costoA, `
              <div style="height: 100%; display: grid; grid-template-columns: ${ANCHO_GRAF_COSTO}px 1px minmax(0, 1fr); column-gap: 32px;">
                <div style="position: relative; min-width: 0; display: flex; flex-direction: column; gap: 14px;">
                  <div style="height: 30px; display: flex; align-items: center; justify-content: space-between;">
                    ${rotulo('Evolución del costo', 'en dólares, hora de Colombia')}
                    ${segmentado([['day', 'Por día'], ['month', 'Por mes']], 'day', { peq: true })}
                  </div>
                  ${grafico}${tooltip ? tooltipCosto(7) : ''}
                </div>
                ${divisor(C.filete)}
                ${tablaCostos()}
              </div>`),
    cuerpo(H.costoB, `
              <div style="display: flex; flex-direction: column; gap: 12px;">
                <div style="display: flex; align-items: baseline; justify-content: space-between; gap: 16px;">
                  ${rotulo('Cobertura de precios', `${dec(COSTO.cobertura)} % de los ${miles(COSTO.outbound)} mensajes salientes tiene tarifa de Meta`)}
                </div>
                ${apilada([{ etq: 'Facturables', v: COSTO.billable, c: GRAF.serie }, { etq: 'Gratis', v: COSTO.free, c: GRAF.entregado }, { etq: 'Sin datos de facturación', v: COSTO.sinDatos, c: GRAF.neutro }], 10)}
                <div style="display: flex; align-items: center; gap: 28px;">
                  ${[[GRAF.serie, 'Salientes facturables', COSTO.billable], [GRAF.entregado, 'Gratis (servicio, ventana de 24 h)', COSTO.free], [GRAF.neutro, 'Sin datos de facturación', COSTO.sinDatos]].map(([c, e, v]) =>
                    `<span style="display: flex; align-items: center; gap: 8px; white-space: nowrap;">${cuadro(c)}<span style="${t(12.5, 16, 500, T.navy)}">${e}</span><span style="${t(12.5, 16, 600, T.navy, num)}">${miles(v)}</span></span>`).join('')}
                  <span style="margin-left: auto; display: flex; align-items: center; gap: 6px; ${t(12, 16, 500, TXT.aviso, 'white-space: nowrap;')}">${icono('circle-alert', 13, 2)}Del resto Meta no envió tarifa: el costo real es mayor</span>
                </div>
                <p style="${t(12, 16, 400, T.muted)}">El cobro real y las facturas están en <span style="font-weight: 600; color: ${T.navy};">Meta Business Manager › Facturación</span>.</p>
              </div>`),
  ].join('');
};

// ══ 2. Mensajes ═══════════════════════════════════════════════════════════════════════════════════
const ESTADOS = [
  ['Leídos', MSG.estado.read, GRAF.serie], ['Entregados', MSG.estado.delivered, GRAF.entregado],
  ['Enviados', MSG.estado.sent, GRAF.curso], ['En cola', MSG.estado.pending, GRAF.pendiente], ['Errores', MSG.estado.failed, GRAF.fallido],
];
const salientes = ESTADOS.reduce((s, e) => s + e[1], 0);
const numGrande = (v, etq, color, total) => `
                  <div style="display: flex; flex-direction: column; gap: 4px;">
                    <span style="display: flex; align-items: center; gap: 8px;">${cuadro(color)}<span style="${t(12.5, 16, 500, T.muted)}">${etq}</span></span>
                    <span style="display: flex; align-items: baseline; gap: 8px;"><span style="${t(24, 30, 500, T.navy, num + 'letter-spacing: -.025em;')}">${miles(v)}</span><span style="${t(12.5, 16, 400, T.muted, num)}">${pct(v, total, 0)}</span></span>
                  </div>`;
const seccionMensajes = () => [
  banda({ ico: 'message-square', titulo: 'Mensajes', texto: `${miles(MSG.total)} mensajes intercambiados con pacientes en el período` }),
  cuerpo(H.mensajes, `
              <div style="height: 100%; display: grid; grid-template-columns: minmax(0, 1fr) 1px minmax(0, 1.2fr); column-gap: 32px;">
                <div style="display: flex; flex-direction: column; gap: 18px;">
                  ${rotulo('Quién escribe')}
                  <div style="display: grid; grid-template-columns: 1fr 1fr; column-gap: 24px;">
                    ${numGrande(MSG.sent, 'Enviados por sistema y asesores', GRAF.serie, MSG.total)}
                    ${numGrande(MSG.received, 'Recibidos de pacientes', GRAF.serie2, MSG.total)}
                  </div>
                  ${apilada([{ etq: 'Enviados', v: MSG.sent, c: GRAF.serie }, { etq: 'Recibidos', v: MSG.received, c: GRAF.serie2 }], 12)}
                  <p style="${t(12, 17, 400, T.muted, num)}">Total intercambiados: <span style="font-weight: 600; color: ${T.navy};">${miles(MSG.total)}</span></p>
                </div>
                ${divisor(C.filete)}
                <div style="display: flex; flex-direction: column; gap: 14px;">
                  ${rotulo('Estado de entrega', `de los ${miles(salientes)} mensajes salientes`)}
                  ${apilada(ESTADOS.map(([e, v, c]) => ({ etq: e, v, c })), 12)}
                  <div style="display: flex; flex-direction: column;">${ESTADOS.map(([e, v, c]) => leyenda(c, e, v, salientes)).join('')}
                  </div>
                </div>
              </div>`),
].join('');

// ══ 3. Citas y recordatorios ══════════════════════════════════════════════════════════════════════
const filaBarra = (etq, v, total, color, { alto = 34, anchoEtq = 170 } = {}) => `
                  <div style="height: ${alto}px; display: grid; grid-template-columns: ${anchoEtq}px minmax(0, 1fr) 64px 52px; column-gap: 14px; align-items: center;">
                    <span style="display: flex; align-items: center; gap: 8px; min-width: 0;">${cuadro(color)}<span style="${t(13, 18, 500, T.navy, truncar)}">${etq}</span></span>
                    ${barraPista(v, total, color, 8)}
                    <span style="${t(13, 18, 600, T.navy, num + 'text-align: right;')}">${miles(v)}</span>
                    <span style="${t(12, 18, 400, T.muted, num + 'text-align: right;')}">${pct(v, total)}</span>
                  </div>`;
const RESPUESTA = [
  { etq: 'Confirmadas', v: CITAS.confirmed, c: GRAF.entregado },
  { etq: 'Canceladas', v: CITAS.cancelled, c: GRAF.fallido },
  { etq: 'Sin respuesta aún', v: CITAS.awaiting, c: GRAF.pendiente },
];
const seccionCitas = () => [
  banda({ ico: 'calendar-check-2', titulo: 'Citas y recordatorios', texto: `${miles(CITAS.total)} citas cargadas en el período y qué respondieron los pacientes` }),
  cuerpo(H.citas, `
              <div style="height: 100%; display: grid; grid-template-columns: minmax(0, 1fr) 1px minmax(0, 1fr); column-gap: 32px;">
                <div style="display: flex; flex-direction: column; gap: 14px;">
                  ${rotulo('Citas cargadas', 'y su recordatorio')}
                  <div style="display: flex; align-items: baseline; gap: 10px;"><span style="${t(24, 30, 500, T.navy, num + 'letter-spacing: -.025em;')}">${miles(CITAS.total)}</span><span style="${t(12.5, 16, 400, T.muted)}">total cargadas</span></div>
                  <div style="display: flex; flex-direction: column;">
                    ${filaBarra('Recordatorios enviados', CITAS.reminder, CITAS.total, GRAF.serie)}
                    ${filaBarra('Pendientes', CITAS.pending, CITAS.total, GRAF.neutro)}
                    ${filaBarra('Fallidas', CITAS.failed, CITAS.total, GRAF.fallido)}
                  </div>
                </div>
                ${divisor(C.filete)}
                <div style="display: flex; flex-direction: column; gap: 14px;">
                  ${rotulo('Respuesta de pacientes', 'solo citas con recordatorio entregado')}
                  <div style="display: flex; align-items: center; gap: 32px;">
                    ${anillo(RESPUESTA, { d: 150, grosor: 18, centro: miles(CITAS.reminder), sub: 'con recordatorio' })}
                    <div style="flex: 1; min-width: 0; display: flex; flex-direction: column;">${RESPUESTA.map((r) => leyenda(r.c, r.etq, r.v, CITAS.reminder, { alto: 34 })).join('')}
                    </div>
                  </div>
                </div>
              </div>`),
].join('');

// ══ 4. Conversaciones | Plantillas y equipo ═══════════════════════════════════════════════════════
const COLS_DOBLE = 'minmax(0, 1.45fr) 1px minmax(0, 1fr)';
const mediaBanda = (ico, titulo, texto, primera) => `
                <div style="min-width: 0; display: flex; align-items: center; gap: 12px; ${primera ? '' : 'padding-left: 20px;'}">
                  <span style="width: ${RANURA}px; flex-shrink: 0; display: flex; justify-content: center; color: ${T.navy};">${icono(ico, 18, 1.75)}</span>
                  <div style="min-width: 0; display: flex; flex-direction: column; gap: 3px;">
                    <h2 style="${t(15, 20, 600, T.navy, 'letter-spacing: -.01em; white-space: nowrap;')}">${titulo}</h2>
                    <p style="${t(12.5, 16, 400, T.muted, truncar + num)}">${texto}</p>
                  </div>
                </div>`;
const ESTADOS_CONV = [['Activas', CONV.active], ['Pendientes', CONV.pending], ['En progreso', CONV.in_progress], ['Resueltas', CONV.resolved], ['Cerradas', CONV.closed], ['Agendadas', CONV.scheduled]];
const bloqueDos = (titulo, apoyo, a, b, total) => `
                  <div style="display: flex; flex-direction: column; gap: 12px;">
                    ${rotulo(titulo, apoyo)}
                    ${apilada([{ etq: a[0], v: a[1], c: a[2] }, { etq: b[0], v: b[1], c: b[2] }], 10)}
                    <div style="display: flex; flex-direction: column;">${leyenda(a[2], a[0], a[1], total, { alto: 26 })}${leyenda(b[2], b[0], b[1], total, { alto: 26 })}
                    </div>
                  </div>`;
const seccionConvPlant = () => [
  `
            <div style="height: ${H.banda}px; flex-shrink: 0; padding: 0 ${PH}px; display: grid; grid-template-columns: ${COLS_DOBLE}; column-gap: 0; align-items: center; background: ${C.banda}; border-bottom: 1px solid ${C.filete};">
              ${mediaBanda('messages-square', 'Conversaciones', `${miles(CONV.total)} en el período, por estado`, true)}
              <div style="width: 1px; height: 36px; background: ${C.filete};"></div>
              ${mediaBanda('file-text', 'Plantillas y equipo', `${miles(PLANT.total)} plantillas · ${miles(EQUIPO.admins + EQUIPO.advisors)} usuarios`, false)}
            </div>`,
  `
            <div style="height: ${H.convPlant}px; flex-shrink: 0; padding: 0 ${PH}px; display: grid; grid-template-columns: ${COLS_DOBLE}; border-bottom: 1px solid ${C.filete};">
              <div style="min-width: 0; padding: 18px 32px 18px ${X_TXT - PH}px; display: flex; flex-direction: column; gap: 12px;">
                ${rotulo('Por estado', `de ${miles(CONV.total)} conversaciones`)}
                <div style="display: flex; flex-direction: column;">${ESTADOS_CONV.map(([e, v]) => `
                  <div style="height: 30px; display: grid; grid-template-columns: 96px minmax(0, 1fr) 56px 48px; column-gap: 14px; align-items: center;">
                    <span style="${t(13, 18, 500, T.navy, truncar)}">${e}</span>
                    ${barraPista(v, CONV.resolved, GRAF.serie, 8)}
                    <span style="${t(13, 18, 600, T.navy, num + 'text-align: right;')}">${miles(v)}</span>
                    <span style="${t(12, 18, 400, T.muted, num + 'text-align: right;')}">${pct(v, CONV.total)}</span>
                  </div>`).join('')}
                </div>
                <div style="height: 1px; background: ${C.filete};"></div>
                <div style="height: 22px; display: grid; grid-template-columns: 96px minmax(0, 1fr) 56px 48px; column-gap: 14px; align-items: center;">
                  <span style="grid-column: 1 / 3; display: flex; align-items: center; gap: 8px; ${t(13, 18, 500, TXT.aviso)}">${punto(GRAF.pendiente, 8)}Con mensajes sin leer<span style="${t(12, 16, 400, T.muted)}">pueden estar en cualquier estado</span></span>
                  <span style="${t(13, 18, 600, TXT.aviso, num + 'text-align: right;')}">${miles(CONV.unread)}</span>
                  <span style="${t(12, 18, 400, T.muted, num + 'text-align: right;')}">${pct(CONV.unread, CONV.total)}</span>
                </div>
              </div>
              <div style="width: 1px; margin: 18px 0; background: ${C.filete};"></div>
              <div style="min-width: 0; padding: 18px 0 18px ${20 + RANURA + 12}px; display: flex; flex-direction: column; gap: 24px;">
                ${bloqueDos('Envíos de plantillas', `${miles(PLANT.sends)} en el período`, ['Envíos exitosos', PLANT.ok, GRAF.entregado], ['Envíos fallidos', PLANT.failed, GRAF.fallido], PLANT.sends)}
                ${bloqueDos('Composición del equipo', `${miles(EQUIPO.admins + EQUIPO.advisors)} usuarios`, ['Administradores', EQUIPO.admins, GRAF.serie], ['Asesores', EQUIPO.advisors, GRAF.curso], EQUIPO.admins + EQUIPO.advisors)}
              </div>
            </div>`,
].join('');

// ══ 5. Menú de bienvenida (bot) ═══════════════════════════════════════════════════════════════════
const miniCifra = (etq, valor, detalle, colorValor = T.navy) => `
                  <div style="min-width: 0; display: flex; flex-direction: column; gap: 4px;">
                    <span style="${t(12, 16, 500, T.muted, truncar)}">${etq}</span>
                    <span style="${t(24, 30, 500, colorValor, num + 'letter-spacing: -.025em; white-space: nowrap;')}">${valor}</span>
                    <span style="${t(12, 16, 400, T.muted, num + truncar)}">${detalle}</span>
                  </div>`;
const flecha = `<div style="display: flex; align-items: center; color: ${navyA(0.35)};">${icono('arrow-right', 16, 1.75)}</div>`;
const listaTop = (titulo, filas, total) => `
                <div style="min-width: 0; display: flex; flex-direction: column; gap: 10px;">
                  ${rotulo(titulo)}
                  <div style="display: flex; flex-direction: column;">${filas.map(([e, v]) => `
                    <div style="height: 34px; display: flex; flex-direction: column; justify-content: center; gap: 5px;">
                      <div style="display: flex; align-items: baseline; gap: 10px;"><span style="flex: 1; min-width: 0; ${t(12.5, 16, 500, T.navy, truncar)}">${e}</span><span style="${t(12.5, 16, 600, T.navy, num)}">${miles(v)}</span></div>
                      ${barraPista(v, total, GRAF.serie, 4)}
                    </div>`).join('')}
                  </div>
                </div>`;
const seccionBot = () => [
  banda({
    ico: 'bot', titulo: 'Demanda del menú de bienvenida',
    texto: 'Clasificación automática de lo que pide cada paciente. Si en el período no hay recorridos, este tema no aparece.',
    derecha: `<span style="display: inline-flex; align-items: center; gap: 6px; ${t(12.5, 16, 500, TXT.ok, 'white-space: nowrap;')}">${punto(GRAF.entregado, 7)}${miles(BOT.total)} recorridos</span>`,
  }),
  cuerpo(H.botA, `
              <div style="display: grid; grid-template-columns: minmax(0, 1fr) 16px minmax(0, 1fr) 16px minmax(0, 1fr) 1px minmax(0, 1fr); column-gap: 20px; align-items: center;">
                ${miniCifra('Flujos', miles(BOT.total), 'iniciados')}${flecha}
                ${miniCifra('Llegaron al menú', miles(BOT.menu), `${miles(BOT.accepted)} aceptaron privacidad`)}${flecha}
                ${miniCifra('Autoservicio', dec(BOT.auto) + ' %', 'resueltos sin asesor', TXT.ok)}${divisor(C.filete)}
                ${miniCifra('A un asesor', miles(812), 'requirieron agente')}
              </div>`, { pad: '16px' }),
  cuerpo(H.botB, `
              <div style="display: flex; flex-direction: column; gap: 12px;">
                ${rotulo('Desenlace', `de los ${miles(BOT.total)} flujos`)}
                ${apilada(BOT.desenlace.map(([e, v, c]) => ({ etq: e, v, c })), 10)}
                <div style="display: flex; align-items: center; gap: 28px;">${BOT.desenlace.map(([e, v, c]) =>
                  `<span style="display: flex; align-items: center; gap: 8px; white-space: nowrap;">${cuadro(c)}<span style="${t(12.5, 16, 500, T.navy)}">${e}</span><span style="${t(12.5, 16, 600, T.navy, num)}">${miles(v)}</span><span style="${t(12, 16, 400, T.muted, num)}">${pct(v, BOT.total, 0)}</span></span>`).join('')}
                </div>
              </div>`, { pad: '16px' }),
  cuerpo(H.botC, `
              <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr) 1px) minmax(0, 1fr); column-gap: 32px;">
                <div style="display: flex; flex-direction: column; gap: 22px;">
                  ${listaTop('Por servicio solicitado', BOT.servicio, BOT.total)}
                  ${listaTop('Régimen', BOT.regimen, BOT.total)}
                </div>${divisor(C.filete)}
                ${listaTop('Top EPS', BOT.eps, BOT.total)}${divisor(C.filete)}
                ${listaTop('Top subservicio', BOT.sub, BOT.total)}
              </div>`),
].join('');

// ══ 6. Rendimiento de asesores ════════════════════════════════════════════════════════════════════
const COLS_ASE = 'minmax(0, 1fr) 128px 184px 72px 64px 80px 150px 20px';
const maxConv = Math.max(...A.map((a) => a.conv)), maxMsgs = Math.max(...A.map((a) => a.msgs));
const tramo = (r) => (r === null ? GRAF.neutro : r >= 70 ? GRAF.entregado : r >= 40 ? GRAF.pendiente : GRAF.fallido);
const tramoTxt = (r) => (r === null ? T.slate600 : r >= 70 ? T.navy : r >= 40 ? TXT.aviso : TXT.mal);
const thA = (x, der = false) => `<span style="${t(11, 16, 600, T.muted, 'text-transform: uppercase; letter-spacing: .07em; white-space: nowrap;' + (der ? 'text-align: right;' : ''))}">${x}</span>`;
const barraConv = (a) => a.conv === 0 ? `<div style="height: 8px; border-radius: 9999px; background: ${GRAF.pista};"></div>` : `
                  <div style="height: 8px; border-radius: 9999px; background: ${GRAF.pista}; overflow: hidden;">
                    <div style="width: ${(a.conv / maxConv) * 100}%; height: 100%; display: flex; gap: 2px;">
                      <div style="flex: ${a.res} 1 0; background: ${GRAF.serie};"></div>
                      <div style="flex: ${a.act} 1 0; min-width: 2px; background: ${GRAF.curso};"></div>
                      <div style="flex: ${Math.max(a.conv - a.res - a.act, 0)} 1 0; background: ${GRAF.serie2};"></div>
                    </div>
                  </div>`;
const filaAsesor = (a, { realce = false } = {}) => `
            <div title="Ver detalle de ${nombrePropio(a.n)}" style="height: ${H.filaAse}px; flex-shrink: 0; padding: 0 ${PH}px; display: grid; grid-template-columns: ${COLS_ASE}; column-gap: 20px; align-items: center; border-bottom: 1px solid ${C.filete};${realce ? ` background: ${C.realce};` : ''}">
              <div style="min-width: 0; display: flex; align-items: center; gap: 12px;">
                ${avatar(a.n, 32)}
                <div style="min-width: 0; display: flex; flex-direction: column; gap: 2px;">
                  <span style="${t(13.5, 18, 600, T.navy, 'letter-spacing: -.003em;' + truncar)}">${nombrePropio(a.n)}</span>
                  <span style="${t(12, 16, 400, T.muted, truncar)}">${a.e}</span>
                </div>
              </div>
              <div style="display: flex; flex-direction: column; gap: 5px;">
                ${a.rate === null ? `<span style="${t(13, 18, 500, T.slate600)}">Sin datos</span><span style="${t(11.5, 14, 400, T.muted)}">sin conversaciones</span>` : `
                <span style="${t(13, 18, 600, tramoTxt(a.rate), num)}">${dec(a.rate)} %</span>
                ${barraPista(a.rate, 100, tramo(a.rate), 4)}`}
              </div>
              <div style="display: grid; grid-template-columns: 48px minmax(0, 1fr); column-gap: 12px; align-items: center;">
                <span style="${t(13, 18, 600, a.conv ? T.navy : T.muted, num + 'text-align: right;')}">${miles(a.conv)}</span>${barraConv(a)}
              </div>
              <span style="${t(13, 18, 500, a.res ? T.navy : T.muted, num + 'text-align: right;')}">${miles(a.res)}</span>
              <span style="${t(13, 18, 500, a.act ? T.navy : T.muted, num + 'text-align: right;')}">${miles(a.act)}</span>
              <span style="${t(13, 18, 500, a.sch ? T.navy : T.muted, num + 'text-align: right;')}">${miles(a.sch)}</span>
              <div style="display: grid; grid-template-columns: 48px minmax(0, 1fr); column-gap: 12px; align-items: center;">
                <span style="${t(13, 18, 500, a.msgs ? T.navy : T.muted, num + 'text-align: right;')}">${miles(a.msgs)}</span>${barraPista(a.msgs, maxMsgs, GRAF.serie, 4)}
              </div>
              <span style="display: flex; justify-content: flex-end; color: ${realce ? T.navy : T.muted};">${icono('chevron-right', 16, 1.75)}</span>
            </div>`;

const cabezaTabla = `
            <div style="height: ${H.thead}px; flex-shrink: 0; padding: 0 ${PH}px; display: grid; grid-template-columns: ${COLS_ASE}; column-gap: 20px; align-items: center; background: ${C.banda}; border-bottom: 1px solid ${C.filete};">
              <span style="padding-left: 44px;">${thA(`Asesor · ${A.length}`)}</span>${thA('Resolución')}${thA('Conversaciones')}${thA('Resueltas', true)}${thA('Activas', true)}${thA('Agendadas', true)}${thA('Mensajes')}<span></span>
            </div>`;

const seccionAsesores = (filas = A) => [
  banda({ ico: 'headphones', titulo: 'Rendimiento de asesores', texto: 'Conversaciones asignadas, mensajes enviados y resolución. Pulsa un asesor para ver su detalle.' }),
  cuerpo(H.aseA, `
              <div style="display: grid; grid-template-columns: repeat(5, minmax(0, 1fr) 1px) minmax(0, 1fr); column-gap: 20px;">
                ${miniCifra('Asesores', miles(ASE.total), 'en el equipo')}${divisor(C.filete)}
                ${miniCifra('Conversaciones', miles(ASE.conv), 'asignadas')}${divisor(C.filete)}
                ${miniCifra('Resueltas', miles(ASE.res), 'cerradas o resueltas')}${divisor(C.filete)}
                ${miniCifra('Agendadas', miles(ASE.sch), 'conversaciones')}${divisor(C.filete)}
                ${miniCifra('Mensajes', miles(ASE.msgs), 'enviados')}${divisor(C.filete)}
                ${miniCifra('Resolución', dec(ASE.rate) + ' %', 'promedio del equipo')}
              </div>`, { pad: '16px' }),
  `
            <div style="height: ${H.aseB}px; flex-shrink: 0; padding: 0 ${PH}px 0 ${PH}px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid ${C.filete};">
              <span style="width: ${RANURA}px; flex-shrink: 0; display: flex; justify-content: center; color: ${T.navy};">${icono('award', 18, 1.75)}</span>
              <span style="${t(13, 18, 400, T.muted, truncar)}"><span style="font-weight: 600; color: ${T.navy};">Mejor desempeño:</span> <span style="font-weight: 600; color: ${T.navy};">${nombrePropio(TOP.n)}</span>, con ${miles(TOP.res)} conversaciones resueltas y ${dec(TOP.rate)} % de resolución.</span>
              <span style="margin-left: auto; display: flex; align-items: center; gap: 14px; ${t(12, 16, 400, T.muted, 'white-space: nowrap;')}">Barra de conversaciones:
                <span style="display: flex; align-items: center; gap: 6px;">${cuadro(GRAF.serie)}resueltas</span>
                <span style="display: flex; align-items: center; gap: 6px;">${cuadro(GRAF.curso)}activas</span>
                <span style="display: flex; align-items: center; gap: 6px;">${cuadro(GRAF.serie2)}otras</span>
              </span>
            </div>`,
  cabezaTabla,
  filas.map((a, i) => filaAsesor(a, { realce: i === 0 && filas.realceTop })).join(''),
].join('');

// ══ La hoja ═══════════════════════════════════════════════════════════════════════════════════════
const ALTO = {
  costo: H.banda + H.costoA + H.costoB, mensajes: H.banda + H.mensajes, citas: H.banda + H.citas,
  conv: H.banda + H.convPlant, bot: H.banda + H.botA + H.botB + H.botC,
  ase: H.banda + H.aseA + H.aseB + H.thead + A.length * H.filaAse,
};
const ALTO_HOJA = Object.values(ALTO).reduce((a, b) => a + b, 0);
const sombraHoja = `0 0 0 1px ${navyA(0.07)}, 0 1px 2px ${navyA(0.05)}, 0 14px 32px -18px ${navyA(0.22)}`;
const contenidoHoja = (opc = {}) => seccionCosto(opc) + seccionMensajes() + seccionCitas() + seccionConvPlant() + seccionBot() + seccionAsesores(opc.filas);

const VELO = 40;
const hojaMain = `
        <div style="position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; border-radius: 16px 16px 0 0; background: ${C.hoja}; box-shadow: ${sombraHoja}; overflow: hidden;">
          ${contenidoHoja({ tooltip: true })}
          <div style="position: absolute; left: 0; right: 0; bottom: 0; height: ${VELO}px; z-index: 5; background: linear-gradient(180deg, rgba(255,255,255,0), #ffffff 88%); pointer-events: none;"></div>
        </div>`;

const hojaCompleta = (opc = {}) => `
        <div style="height: ${ALTO_HOJA}px; flex-shrink: 0; display: flex; flex-direction: column; border-radius: 16px; background: ${C.hoja}; box-shadow: ${sombraHoja}; overflow: hidden;">
          ${contenidoHoja(opc)}
        </div>`;

// ══ Panel lateral: detalle de un asesor ═══════════════════════════════════════════════════════════
const ANCHO_PANEL = 620;
const cifraPanel = (etq, valor, detalle, ico) => `
                <div style="min-width: 0; display: flex; flex-direction: column; gap: 3px;">
                  <span style="display: flex; align-items: center; gap: 7px; ${t(12, 16, 500, T.muted, truncar)}"><span style="display: flex; color: ${T.navy};">${icono(ico, 13, 2)}</span>${etq}</span>
                  <span style="${t(24, 30, 500, T.navy, num + 'letter-spacing: -.025em; white-space: nowrap;')}">${valor}</span>
                  <span style="${t(12, 16, 400, T.muted, num + truncar)}">${detalle}</span>
                </div>`;
const panelAsesor = () => {
  const a = DET.a;
  const anchoG = (ANCHO_PANEL - 48 - 28) / 2;
  const maxD = 300, maxH = 1800;
  return `
      <div style="position: absolute; top: 0; right: 0; bottom: 0; width: ${ANCHO_PANEL}px; z-index: 20; background: #ffffff; border-radius: 18px 0 0 18px; box-shadow: 0 0 0 1px ${navyA(0.08)}, -24px 0 48px -24px ${navyA(0.4)}; display: flex; flex-direction: column;">
        <div style="height: 84px; flex-shrink: 0; padding: 0 20px 0 24px; display: flex; align-items: center; gap: 14px; border-bottom: 1px solid ${C.filete};">
          ${avatar(a.n, 40)}
          <div style="min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 2px;">
            <span style="${t(17, 22, 600, T.navy, 'letter-spacing: -.012em;' + truncar)}">${nombrePropio(a.n)}</span>
            <span style="display: flex; align-items: center; gap: 8px; ${t(12.5, 16, 400, T.muted, truncar)}"><span style="display: inline-flex; align-items: center; gap: 5px; color: ${T.sky700}; font-weight: 600;">${icono('headphones', 13, 2)}Asesor</span><span aria-hidden="true">·</span>${a.e}</span>
          </div>
          <div title="Cerrar" style="width: 32px; height: 32px; flex-shrink: 0; border-radius: 9px; display: flex; align-items: center; justify-content: center; color: ${T.muted}; box-shadow: inset 0 0 0 1px ${navyA(0.12)};">${icono('x', 16, 2)}</div>
        </div>
        <div style="height: 60px; flex-shrink: 0; padding: 0 24px; display: flex; align-items: center; gap: 10px; background: ${C.banda}; border-bottom: 1px solid ${C.filete};">
          ${segmentado(PERIODOS, 'all', { peq: true })}
          ${campoRango('Rango', { ancho: 120, peq: true })}
        </div>
        <div style="flex-shrink: 0; padding: 20px 24px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr) 1px) minmax(0, 1fr); column-gap: 18px; row-gap: 18px; border-bottom: 1px solid ${C.filete};">
          ${cifraPanel('Mensajes', miles(DET.msgs), 'enviados', 'send')}${divisor(C.filete)}
          ${cifraPanel('Resolución', dec(DET.rate) + ' %', `${miles(DET.res)} de ${miles(DET.conv)} resueltas`, 'trending-up')}${divisor(C.filete)}
          ${cifraPanel('Respuesta típica', `${DET.mediana} min`, 'mediana de espera', 'timer')}
          ${cifraPanel('Agendadas', miles(DET.sch), 'conversaciones', 'calendar-check-2')}${divisor(C.filete)}
          ${cifraPanel('Abiertas', miles(DET.act + DET.pend), `${DET.act} activas · ${DET.pend} pendientes`, 'activity')}${divisor('transparent')}
          <div></div>
        </div>
        <div style="flex-shrink: 0; padding: 18px 24px 16px; display: grid; grid-template-columns: 1fr 1fr; column-gap: 28px; border-bottom: 1px solid ${C.filete};">
          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${rotulo('Actividad diaria', 'últimos 7 días')}
            ${columnas({ datos: DET.diario, ancho: anchoG, alto: 214, max: maxD, ticks: [0, 100, 200, 300], izq: 32, anchoBarra: 0.52, dosLineas: true })}
          </div>
          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${rotulo('Distribución por hora', 'hora de Colombia')}
            ${columnas({ datos: DET.hora.map(([h, v]) => [h.slice(0, 2), v]), ancho: anchoG, alto: 214, max: maxH, ticks: [0, 600, 1200, 1800], fmt: (v) => (v >= 1000 ? dec(v / 1000, 1) + ' mil' : miles(v)), izq: 42, cadaEtq: 6, anchoBarra: 0.7 })}
          </div>
        </div>
        <div style="flex: 1; min-height: 0; padding: 18px 24px; display: flex; flex-direction: column; gap: 10px;">
          ${rotulo('Tipos de mensaje', `${miles(DET.msgs)} enviados`)}
          <div style="display: flex; flex-direction: column;">${DET.tipos.map(([e, v]) => `
            <div style="height: 30px; display: grid; grid-template-columns: 96px minmax(0, 1fr) 64px 52px; column-gap: 14px; align-items: center;">
              <span style="${t(12.5, 16, 500, T.navy, 'font-family: ui-monospace, Consolas, monospace; font-size: 12px;')}">${e}</span>
              ${barraPista(v, DET.tipos[0][1], GRAF.serie, 6)}
              <span style="${t(13, 18, 600, T.navy, num + 'text-align: right;')}">${miles(v)}</span>
              <span style="${t(12, 18, 400, T.muted, num + 'text-align: right;')}">${pct(v, DET.msgs)}</span>
            </div>`).join('')}
          </div>
        </div>
      </div>`;
};

// ══ Artboards ═════════════════════════════════════════════════════════════════════════════════════
const pantallaMain = `
      <div style="position: absolute; inset: 0; padding: ${PAD}px ${PAD}px 0; display: flex; flex-direction: column; gap: ${GAP}px;">
        ${cabecera()}
        ${franja}
        ${hojaMain}
      </div>`;
const main = documento(carcasaMarco({ activo: 'statistics', contenido: pantallaMain, ancho: 1440 }));
fs.writeFileSync(path.join(DIR, 'Main.dc.html'), main);
console.log(`  Main.dc.html      ${Buffer.byteLength(main)} bytes  (isla ${ISLA.ancho}x${ISLA.alto})`);

const ALTO_COMPLETA = PAD + H.cab + GAP + H.franja + GAP + ALTO_HOJA + PAD;
const completa = documento(`
<div style="position: relative; width: ${ISLA.ancho}px; height: ${ALTO_COMPLETA}px; overflow: hidden; border-radius: ${RADIO_ISLA}px; background: ${T.bg}; font-family: ${T.font};">
      <div style="padding: ${PAD}px; display: flex; flex-direction: column; gap: ${GAP}px;">
        ${cabecera()}
        ${franja}
        ${hojaCompleta({ tooltip: false })}
      </div>
</div>`);
fs.writeFileSync(path.join(DIR, 'Completa.dc.html'), completa);
console.log(`  Completa.dc.html  ${Buffer.byteLength(completa)} bytes  (${ISLA.ancho}x${ALTO_COMPLETA})`);

// Detalle: la página desplazada hasta la tabla de asesores (fila de la asesora resaltada), velada, y el panel encima.
const filasDet = [...A]; filasDet.realceTop = true;
const DESPLAZ = PAD + H.cab + GAP + H.franja + GAP + ALTO.costo + ALTO.mensajes + ALTO.citas + ALTO.conv + ALTO.bot - 20;
const pantallaDet = `
      <div style="position: absolute; left: 0; right: 0; top: ${-DESPLAZ}px; padding: ${PAD}px; display: flex; flex-direction: column; gap: ${GAP}px;">
        ${cabecera()}
        ${franja}
        ${hojaCompleta({ tooltip: false, filas: filasDet })}
      </div>
      <div style="position: absolute; inset: 0; z-index: 10; background: ${navyA(0.2)};"></div>
      ${panelAsesor()}`;
const detalle = documento(carcasaMarco({ activo: 'statistics', contenido: pantallaDet, ancho: 1440 }));
fs.writeFileSync(path.join(DIR, 'Detalle.dc.html'), detalle);
console.log(`  Detalle.dc.html   ${Buffer.byteLength(detalle)} bytes  (1440x900)`);
