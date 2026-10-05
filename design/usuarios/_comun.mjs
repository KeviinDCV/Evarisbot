// Piezas compartidas por todos los artboards del rediseño de Usuarios.
// Valores copiados del código real: resources/css/app.css, admin-layout.tsx,
// pages/admin/users/index.tsx y tailwindcss 4.1.12 (theme.css). Viewport 1440x900.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const DIR = path.dirname(fileURLToPath(import.meta.url));
const ICONOS = JSON.parse(fs.readFileSync(path.join(DIR, '_iconos.json'), 'utf8'));

// ── Tokens (resueltos a 1440 px de ancho) ─────────────────────────────────────
export const T = {
  bg: '#f0f2f8',                 // --background
  navy: '#2e3f84',               // --primary / marca
  navyLight: '#3e4f94', navyDark: '#26356f', navyDeep: '#2e3a75', navySoft: '#4e5fa4',
  sub: '#6b7494',                // .settings-subtitle
  muted: '#5c6485',              // --muted-foreground (AA)
  border: '#d4d8e8',             // bordes de tarjeta
  thead: 'rgba(244,245,249,.7)', // bg-[#f4f5f9]/70
  card: 'linear-gradient(to bottom,#ffffff,#fcfcfd)',
  cardShadow: '0 1px 2px rgba(46,63,132,.04), 0 3px 8px rgba(46,63,132,.05)',
  input: 'linear-gradient(to bottom,#f4f5f9,#f0f2f8)',
  inputShadow: '0 1px 2px rgba(46,63,132,.04), 0 2px 3px rgba(46,63,132,.06), inset 0 1px 0 rgba(255,255,255,.6)',
  btnPrimary: 'linear-gradient(to bottom,#3e4f94,#2e3f84)',
  btnPrimaryShadow: '0 1px 2px rgba(46,63,132,.15), 0 2px 4px rgba(46,63,132,.2), 0 4px 12px rgba(46,63,132,.25), inset 0 1px 0 rgba(255,255,255,.15)',
  btnSecondary: 'linear-gradient(to bottom,#f4f5f9,#f0f2f8)',
  btnSecondaryShadow: '0 1px 2px rgba(46,63,132,.06), 0 2px 4px rgba(46,63,132,.08), inset 0 1px 0 rgba(255,255,255,.7)',
  // Escala fluida del proyecto (:root) evaluada a 1440 px
  xs: '11.84px', sm: '13.04px', base: '14px', lg: '15.04px', x3: '24px',
  lhXs: '1.3333', lhSm: '1.4286',
  // Tailwind 4.1.12
  emerald50: 'oklch(97.9% 0.021 166.113)', emerald200: 'oklch(90.5% 0.093 164.15)',
  emerald500: 'oklch(69.6% 0.17 162.48)', emerald600: 'oklch(59.6% 0.145 163.225)', emerald700: 'oklch(50.8% 0.118 165.612)',
  sky50: 'oklch(97.7% 0.013 236.62)', sky200: 'oklch(90.1% 0.058 230.902)', sky700: 'oklch(50% 0.134 242.749)',
  slate50: 'oklch(98.4% 0.003 247.858)', slate100: 'oklch(96.8% 0.007 247.896)', slate200: 'oklch(92.9% 0.013 255.508)',
  slate300: 'oklch(86.9% 0.022 252.894)', slate400: 'oklch(70.4% 0.04 256.788)', slate500: 'oklch(55.4% 0.046 257.417)',
  slate600: 'oklch(44.6% 0.043 257.281)',
  red50: 'oklch(97.1% 0.013 17.38)', red600: 'oklch(57.7% 0.245 27.325)', red700: 'oklch(50.5% 0.213 27.518)',
  teal400: 'oklch(77.7% 0.152 181.912)',
  font: "'Instrument Sans', ui-sans-serif, system-ui, 'Segoe UI', sans-serif",
};

// ── Iconos Lucide 0.475 (trazados exactos) ────────────────────────────────────
export function icono(nombre, size = 20, sw = 2, estilo = '') {
  const cuerpo = ICONOS[nombre];
  if (!cuerpo) throw new Error('icono desconocido: ' + nombre);
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0; display: block;${estilo ? ' ' + estilo : ''}">${cuerpo}</svg>`;
}

// ── Datos de MUESTRA (forma real: 33 usuarios, 5 admin, 27 asesores, 9 con envío masivo) ──
// Nombres y correos inventados. Conectados primero, como ordena la pantalla real.
export const USUARIOS = [
  { n: 'ANDREA CAROLINA MUÑOZ PAZ',     e: 'andreacmunoz@gmail.com',       r: 'advisor', bulk: true,  on: true,  act: 'Justo ahora',         reg: '14 nov 2025' },
  { n: 'Sofía Quintero Ramos',          e: 'squintero@correohuv.gov.co',   r: 'admin',   bulk: false, on: true,  act: 'Justo ahora',         reg: '20 oct 2025' },
  { n: 'JUAN PABLO RESTREPO VÉLEZ',     e: 'juanprestrepo.v@gmail.com',    r: 'advisor', bulk: false, on: true,  act: 'Justo ahora',         reg: '03 feb 2026' },
  { n: 'MARÍA FERNANDA LOAIZA CRUZ',    e: 'mafeloaiza@hotmail.com',       r: 'advisor', bulk: true,  on: true,  act: 'Justo ahora',         reg: '21 ene 2026' },
  { n: 'DIEGO ALEJANDRO SÁNCHEZ ROJAS', e: 'diegosanchez.r@gmail.com',     r: 'advisor', bulk: false, on: true,  act: 'Justo ahora',         reg: '09 mar 2026' },
  { n: 'LUISA MARÍA CAICEDO GÓMEZ',     e: 'luisacaicedo@gmail.com',       r: 'advisor', bulk: false, on: true,  act: 'Justo ahora',         reg: '17 abr 2026' },
  { n: 'Hernán Ocampo Díaz',            e: 'hocampo@correohuv.gov.co',     r: 'admin',   bulk: false, on: true,  act: 'Justo ahora',         reg: '20 oct 2025' },
  { n: 'VALENTINA OSPINA TORO',         e: 'valeospina.t@gmail.com',       r: 'advisor', bulk: true,  on: false, act: 'Hace 12 min',         reg: '28 nov 2025' },
  { n: 'CRISTIAN DAVID MORENO LASSO',   e: 'cdmoreno@gmail.com',           r: 'advisor', bulk: false, on: false, act: 'Hace 2h',             reg: '12 dic 2025' },
  { n: 'PAOLA ANDREA VIVEROS SOLARTE',  e: 'paoviveros@hotmail.com',       r: 'advisor', bulk: true,  on: false, act: 'Ayer',                reg: '05 feb 2026' },
  { n: 'Ricardo Salazar Mejía',         e: 'rsalazar@correohuv.gov.co',    r: 'admin',   bulk: false, on: false, act: 'Hace 3 días',         reg: '22 oct 2025' },
  { n: 'JESSICA TATIANA BOLAÑOS ARIAS', e: 'jessibolanos@gmail.com',       r: 'advisor', bulk: false, on: false, act: 'Hace 5 días',         reg: '30 jun 2026' },
  { n: 'CAMILA ANDREA RINCÓN PÉREZ',    e: 'camirincon@gmail.com',         r: 'advisor', bulk: true,  on: false, act: '02 sept 2026, 16:40', reg: '11 may 2026' },
  { n: 'SANTIAGO ANDRÉS HURTADO MEJÍA', e: 'santihurtado.m@gmail.com',     r: 'advisor', bulk: false, on: false, act: 'Nunca conectado',     reg: '19 ago 2026' },
];
export const METRICAS = { total: 33, online: 7, admins: 5, advisors: 27, bulk: 9 };
export const NO_LEIDOS = { chat: 24, internal: 2 };
export const VISOR = { nombre: 'Sofía Quintero Ramos', rol: 'Administrador' };

export const iniciales = (n) => n.split(' ').filter(Boolean).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('');
export const rolTexto = (r) => (r === 'admin' ? 'Administrador' : 'Asesor');

// ── Navegación (orden y grupos reales de admin-layout.tsx) ───────────────────
export const NAV = [
  { grupo: 'TRABAJO', items: [
    { id: 'chat', t: 'Conversaciones', i: 'message-square', badge: 'chat' },
    { id: 'internal', t: 'Chat Interno', i: 'messages-square', badge: 'internal' },
    { id: 'templates', t: 'Plantillas', i: 'file-text' },
    { id: 'bulk', t: 'Envío Masivo', i: 'send' },
  ]},
  { grupo: 'GESTIÓN', items: [
    { id: 'appointments', t: 'Citas', i: 'calendar' },
    { id: 'statistics', t: 'Estadísticas', i: 'bar-chart-3' },
    { id: 'users', t: 'Usuarios', i: 'users' },
    { id: 'settings', t: 'Configuración', i: 'settings' },
  ]},
];

// Grano del riel (app.css .puesto-rail::before)
export const GRANO = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='.035'/%3E%3C/svg%3E")`;

// Dentro de un style="..." las comillas dobles del url() cortarían el atributo:
// escapadas a &quot; el HTML queda canónico y el grano se pinta.
export const GRANO_ATTR = GRANO.replace(/"/g, '&quot;');

// Barra de presión: 33 % / 66 % / 100 % de 44 px, con tope de 26 px (admin-layout.tsx barHeight)
export const altoBarra = (n) => (n <= 0 ? 0 : n <= 3 ? 14.52 : 26);
export const TONO = { chat: { bar: '#ef4444', pill: '#dc2626' }, internal: { bar: '#94a3b8', pill: '#475569' } };

/** El riel actual ("El Puesto"), colapsado a 64 px, visto por un administrador. */
export function rielActual(activo = 'users') {
  const grupos = NAV.map((g) => {
    const items = g.items.map((it) => {
      const act = it.id === activo;
      const n = it.badge ? NO_LEIDOS[it.badge] : 0;
      const tono = it.badge ? TONO[it.badge] : null;
      return `
        <div style="position: relative; height: 44px; display: flex; align-items: center; color: ${act ? T.navy : 'rgba(255,255,255,.75)'};">
          ${act ? `<div style="position: absolute; left: 10px; top: 2px; width: 44px; height: 40px; border-radius: 14px; background: rgba(255,255,255,.96); box-shadow: 0 2px 10px rgba(0,0,0,.14);"></div>` : ''}
          ${tono && n > 0 ? `<div style="position: absolute; left: 7px; top: 50%; transform: translateY(-50%); width: 3px; height: ${altoBarra(n)}px; border-radius: 9999px; background: ${tono.bar};"></div>` : ''}
          <div style="position: relative; width: 64px; display: flex; justify-content: center;">${icono(it.i, 20, act ? 2 : 1.75)}</div>
          ${tono && n > 0 ? `<div style="position: absolute; left: 44px; top: 6px; height: 18px; min-width: 18px; padding: 0 5px; border-radius: 9999px; background: ${tono.pill}; box-shadow: 0 0 0 2px ${T.navy}; color: #ffffff; font-size: 10px; font-weight: 700; font-variant-numeric: tabular-nums; display: flex; align-items: center; justify-content: center;">${n}</div>` : ''}
        </div>`;
    }).join('');
    return `<div><div style="height: 24px;"></div>${items}</div>`;
  }).join('');

  return `
  <div style="position: absolute; left: 8px; top: 8px; bottom: 8px; width: 64px; border-radius: 22px; background: linear-gradient(180deg,#3e4f94 0%,#2e3f84 55%,#26356f 100%); box-shadow: 0 24px 60px -20px rgba(46,63,132,.45), inset 0 1px 0 rgba(255,255,255,.14); display: flex; flex-direction: column; z-index: 5;">
    <div style="position: absolute; inset: 0; border-radius: 22px; background-image: ${GRANO_ATTR}; pointer-events: none;"></div>
    <div style="position: relative; height: 64px; flex-shrink: 0; display: flex; align-items: center; padding-left: 14px;">
      <img src="logo-huv.png" alt="HUV" style="width: 36px; height: 36px; object-fit: contain; filter: brightness(0) invert(1); opacity: .95;">
    </div>
    <div style="position: relative; margin: 0 12px; height: 1px; flex-shrink: 0; background: rgba(255,255,255,.1);"></div>
    <div style="position: relative; flex: 1; padding: 10px 0;">${grupos}</div>
    <div style="position: relative; flex-shrink: 0; padding: 8px 10px 12px;">
      <div style="height: 1px; margin-bottom: 8px; background: rgba(255,255,255,.1);"></div>
      <div style="display: flex; align-items: center; padding: 4px 0; border-radius: 14px;">
        <div style="width: 44px; display: flex; justify-content: center;">
          <div style="width: 34px; height: 34px; border-radius: 9999px; background: linear-gradient(to bottom right,#4e5fa4,#2e3a75); color: #ffffff; font-size: ${T.xs}; font-weight: 700; display: flex; align-items: center; justify-content: center;">${iniciales(VISOR.nombre)}</div>
        </div>
      </div>
    </div>
  </div>`;
}

/** Envoltorio .dc.html estático (sin lógica). */
export function documento(cuerpo, estilosExtra = '') {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&amp;display=swap">
  <style>
    body { margin: 0; background: ${T.bg}; font-family: ${T.font}; -webkit-font-smoothing: antialiased; }
    * { box-sizing: border-box; }
    p, h1, h2, h3 { margin: 0; }
    a { color: ${T.navy}; } a:hover { color: ${T.navyDark}; }
    ${estilosExtra}
  </style>
</helmet>
${cuerpo}
</x-dc>
</body>
</html>
`;
}

export function escribir(nombre, html) {
  fs.writeFileSync(path.join(DIR, nombre), html);
  console.log(`  ${nombre.padEnd(28)} ${String(html.length).padStart(7)} bytes`);
}
