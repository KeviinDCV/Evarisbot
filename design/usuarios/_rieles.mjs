// Los cuatro rieles del paso 1 (sidebar): {oscuro, claro} x {solo iconos, con nombres}.
// Misma geometría en todos: flotante a 8 px, radio 22, logo 64, cabeceras de grupo 24, ítems 44,
// eje de iconos en x = 32, carnet de 34 px. Lo que cambia es el material y si se ven los nombres.
import { T, icono, NAV, NO_LEIDOS, VISOR, GRANO_ATTR, TONO, altoBarra, iniciales, rielActual } from './_comun.mjs';
import { truncar } from './_piezas.mjs';

export { rielActual };

// ── Material claro (compartido por las dos versiones claras) ─────────────────
// El filete va como anillo interior y no como `border`: así no roba 1 px a la caja y el eje de
// iconos sigue exactamente en x = 32, igual que en el riel oscuro.
const CLARO = {
  fondo: T.card,
  sombra: `inset 0 0 0 1px ${T.border}, 0 1px 2px rgba(46,63,132,.06), 0 12px 32px -12px rgba(46,63,132,.18)`,
  anillo: '#ffffff',
  separador: T.border,
  icono: T.sub,          // 4,6:1 sobre blanco
  texto: '#3b3d4a',      // nombres de sección: el mismo gris oscuro de las filas leídas del chat
  capsula: T.navy,
  capsulaSombra: '0 2px 8px rgba(46,63,132,.25)',
};

// Sobre blanco la barra slate del chat interno (#94a3b8) se queda en 2,56:1, por debajo del 3:1 de
// los elementos gráficos. En claro se oscurece a slate-500 (4,76:1). La roja ya cumple (3,76:1).
const tonoClaro = (badge) => (badge === 'internal' ? { ...TONO.internal, bar: T.slate500 } : TONO[badge]);

const avatarCarnet = () =>
  `<div style="width: 34px; height: 34px; border-radius: 9999px; background: linear-gradient(to bottom right,#4e5fa4,#2e3a75); color: #ffffff; font-size: ${T.xs}; font-weight: 700; display: flex; align-items: center; justify-content: center;">${iniciales(VISOR.nombre)}</div>`;

// ── Oscuro · con nombres (el modo "Fijar menú abierto" que ya existe) ────────
export function rielOscuroNombres(activo = 'users') {
  const grupos = NAV.map((g) => {
    const items = g.items.map((it) => {
      const act = it.id === activo;
      const n = it.badge ? NO_LEIDOS[it.badge] : 0;
      const tono = it.badge ? TONO[it.badge] : null;
      return `
        <div style="position: relative; height: 44px; display: flex; align-items: center; color: ${act ? T.navy : 'rgba(255,255,255,.75)'};">
          ${act ? `<div style="position: absolute; left: 10px; top: 2px; width: calc(100% - 20px); height: 40px; border-radius: 14px; background: rgba(255,255,255,.96); box-shadow: 0 2px 10px rgba(0,0,0,.14);"></div>` : ''}
          ${tono && n > 0 ? `<div style="position: absolute; left: 7px; top: 50%; transform: translateY(-50%); width: 3px; height: ${altoBarra(n)}px; border-radius: 9999px; background: ${tono.bar};"></div>` : ''}
          <div style="position: relative; width: 64px; flex-shrink: 0; display: flex; justify-content: center;">${icono(it.i, 20, act ? 2 : 1.75)}</div>
          <span style="position: relative; min-width: 0; flex: 1; padding-right: 12px; font-size: ${T.sm}; line-height: ${T.lhSm}; font-weight: ${act ? 600 : 500}; ${truncar}">${it.t}</span>
          ${tono && n > 0 ? `<div style="position: absolute; right: 12px; top: 12px; z-index: 2; height: 18px; min-width: 18px; padding: 0 5px; border-radius: 9999px; background: ${tono.pill}; box-shadow: 0 0 0 2px ${T.navy}; color: #ffffff; font-size: 10px; font-weight: 700; font-variant-numeric: tabular-nums; display: flex; align-items: center; justify-content: center;">${n}</div>` : ''}
        </div>`;
    }).join('');
    return `
      <div>
        <div style="height: 24px; display: flex; align-items: center; padding-left: 64px; padding-right: 12px;">
          <span style="font-size: 10px; line-height: 1.5; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: rgba(255,255,255,.7); white-space: nowrap;">${g.grupo}</span>
        </div>${items}
      </div>`;
  }).join('');

  return `
  <div style="position: absolute; left: 8px; top: 8px; bottom: 8px; width: 260px; border-radius: 22px; background: linear-gradient(180deg,#3e4f94 0%,#2e3f84 55%,#26356f 100%); box-shadow: 0 24px 60px -20px rgba(46,63,132,.45), inset 0 1px 0 rgba(255,255,255,.14); display: flex; flex-direction: column; z-index: 5;">
    <div style="position: absolute; inset: 0; border-radius: 22px; background-image: ${GRANO_ATTR}; pointer-events: none;"></div>
    <div style="position: relative; height: 64px; flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding-left: 14px; padding-right: 12px;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <img src="logo-huv.png" alt="HUV" style="width: 36px; height: 36px; flex-shrink: 0; object-fit: contain; filter: brightness(0) invert(1); opacity: .95;">
        <span style="font-size: ${T.sm}; line-height: ${T.lhSm}; font-weight: 600; letter-spacing: .14em; color: #ffffff; opacity: .9; white-space: nowrap;">EVARISBOT</span>
      </div>
      <div title="Contraer menú" style="flex-shrink: 0; display: inline-flex; padding: 6px; border-radius: 8px; color: rgba(255,255,255,.7);">${icono('panel-left-close', 18)}</div>
    </div>
    <div style="position: relative; margin: 0 12px; height: 1px; flex-shrink: 0; background: rgba(255,255,255,.1);"></div>
    <div style="position: relative; flex: 1; min-height: 0; padding: 10px 0;">${grupos}
    </div>
    <div style="position: relative; flex-shrink: 0; padding: 8px 10px 12px; display: flex; flex-direction: column; gap: 8px;">
      <div style="height: 1px; background: rgba(255,255,255,.1);"></div>
      <div style="display: flex; align-items: center; padding: 4px 0; border-radius: 14px;">
        <div style="width: 44px; flex-shrink: 0; display: flex; justify-content: center;">${avatarCarnet()}</div>
        <div style="min-width: 0; flex: 1; padding-left: 4px; padding-right: 8px; display: flex; flex-direction: column;">
          <span style="font-size: 13px; line-height: 1.5; font-weight: 600; color: #ffffff; ${truncar}">${VISOR.nombre}</span>
          <span style="font-size: 11px; line-height: 1.5; font-weight: 600; color: rgba(255,255,255,.6); ${truncar}">${VISOR.rol}</span>
        </div>
      </div>
    </div>
  </div>`;
}

// ── Claro · solo iconos ──────────────────────────────────────────────────────
export function rielClaro(activo = 'users') {
  const grupos = NAV.map((g) => {
    const items = g.items.map((it) => {
      const act = it.id === activo;
      const n = it.badge ? NO_LEIDOS[it.badge] : 0;
      const tono = it.badge ? tonoClaro(it.badge) : null;
      return `
        <div style="position: relative; height: 44px; display: flex; align-items: center; color: ${act ? '#ffffff' : CLARO.icono};">
          ${act ? `<div style="position: absolute; left: 10px; top: 2px; width: 44px; height: 40px; border-radius: 14px; background: ${CLARO.capsula}; box-shadow: ${CLARO.capsulaSombra};"></div>` : ''}
          ${tono && n > 0 ? `<div style="position: absolute; left: 7px; top: 50%; transform: translateY(-50%); width: 3px; height: ${altoBarra(n)}px; border-radius: 9999px; background: ${tono.bar};"></div>` : ''}
          <div style="position: relative; width: 64px; display: flex; justify-content: center;">${icono(it.i, 20, act ? 2 : 1.75)}</div>
          ${tono && n > 0 ? `<div style="position: absolute; left: 44px; top: 6px; height: 18px; min-width: 18px; padding: 0 4px; border-radius: 9999px; background: ${tono.pill}; box-shadow: 0 0 0 2px ${CLARO.anillo}; color: #ffffff; font-size: 11px; line-height: 1; font-weight: 700; font-variant-numeric: tabular-nums; display: flex; align-items: center; justify-content: center;">${n}</div>` : ''}
        </div>`;
    }).join('');
    return `<div><div style="height: 24px;"></div>${items}</div>`;
  }).join('');

  return `
  <div style="position: absolute; left: 8px; top: 8px; bottom: 8px; width: 64px; border-radius: 22px; background: ${CLARO.fondo}; box-shadow: ${CLARO.sombra}; display: flex; flex-direction: column; z-index: 5;">
    <div style="position: relative; height: 64px; flex-shrink: 0; display: flex; align-items: center; padding-left: 14px;">
      <img src="logo-huv.png" alt="HUV" style="width: 36px; height: 36px; object-fit: contain;">
    </div>
    <div style="position: relative; margin: 0 12px; height: 1px; flex-shrink: 0; background: ${CLARO.separador};"></div>
    <div style="position: relative; flex: 1; padding: 10px 0;">${grupos}</div>
    <div style="position: relative; flex-shrink: 0; padding: 8px 10px 12px;">
      <div style="height: 1px; margin-bottom: 8px; background: ${CLARO.separador};"></div>
      <div style="display: flex; align-items: center; padding: 4px 0; border-radius: 14px;">
        <div style="width: 44px; display: flex; justify-content: center;">${avatarCarnet()}</div>
      </div>
    </div>
  </div>`;
}

// ── Claro · con nombres (nuevo) ──────────────────────────────────────────────
// La barra abierta de hoy con el material claro. Cabeceras de grupo a 11 px (no 10) porque en
// gris sobre blanco el tamaño pesa más en la lectura que sobre navy.
export function rielClaroNombres(activo = 'users') {
  const grupos = NAV.map((g) => {
    const items = g.items.map((it) => {
      const act = it.id === activo;
      const n = it.badge ? NO_LEIDOS[it.badge] : 0;
      const tono = it.badge ? tonoClaro(it.badge) : null;
      return `
        <div style="position: relative; height: 44px; display: flex; align-items: center; color: ${act ? '#ffffff' : CLARO.icono};">
          ${act ? `<div style="position: absolute; left: 10px; top: 2px; width: calc(100% - 20px); height: 40px; border-radius: 14px; background: ${CLARO.capsula}; box-shadow: ${CLARO.capsulaSombra};"></div>` : ''}
          ${tono && n > 0 ? `<div style="position: absolute; left: 7px; top: 50%; transform: translateY(-50%); width: 3px; height: ${altoBarra(n)}px; border-radius: 9999px; background: ${tono.bar};"></div>` : ''}
          <div style="position: relative; width: 64px; flex-shrink: 0; display: flex; justify-content: center;">${icono(it.i, 20, act ? 2 : 1.75)}</div>
          <span style="position: relative; min-width: 0; flex: 1; padding-right: 12px; font-size: ${T.sm}; line-height: ${T.lhSm}; font-weight: ${act ? 600 : 500}; color: ${act ? '#ffffff' : CLARO.texto}; ${truncar}">${it.t}</span>
          ${tono && n > 0 ? `<div style="position: absolute; right: 12px; top: 12px; z-index: 2; height: 18px; min-width: 18px; padding: 0 4px; border-radius: 9999px; background: ${tono.pill}; box-shadow: 0 0 0 2px ${act ? T.navy : CLARO.anillo}; color: #ffffff; font-size: 11px; line-height: 1; font-weight: 700; font-variant-numeric: tabular-nums; display: flex; align-items: center; justify-content: center;">${n}</div>` : ''}
        </div>`;
    }).join('');
    return `
      <div>
        <div style="height: 24px; display: flex; align-items: center; padding-left: 64px; padding-right: 12px;">
          <span style="font-size: 11px; line-height: 1.5; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: ${T.sub}; white-space: nowrap;">${g.grupo}</span>
        </div>${items}
      </div>`;
  }).join('');

  return `
  <div style="position: absolute; left: 8px; top: 8px; bottom: 8px; width: 260px; border-radius: 22px; background: ${CLARO.fondo}; box-shadow: ${CLARO.sombra}; display: flex; flex-direction: column; z-index: 5;">
    <div style="position: relative; height: 64px; flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding-left: 14px; padding-right: 12px;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <img src="logo-huv.png" alt="HUV" style="width: 36px; height: 36px; flex-shrink: 0; object-fit: contain;">
        <span style="font-size: ${T.sm}; line-height: ${T.lhSm}; font-weight: 600; letter-spacing: .14em; color: ${T.navy}; white-space: nowrap;">EVARISBOT</span>
      </div>
      <div title="Contraer menú" style="flex-shrink: 0; display: inline-flex; padding: 6px; border-radius: 8px; color: ${T.sub};">${icono('panel-left-close', 18)}</div>
    </div>
    <div style="position: relative; margin: 0 12px; height: 1px; flex-shrink: 0; background: ${CLARO.separador};"></div>
    <div style="position: relative; flex: 1; min-height: 0; padding: 10px 0;">${grupos}
    </div>
    <div style="position: relative; flex-shrink: 0; padding: 8px 10px 12px; display: flex; flex-direction: column; gap: 8px;">
      <div style="height: 1px; background: ${CLARO.separador};"></div>
      <div style="display: flex; align-items: center; padding: 4px 0; border-radius: 14px;">
        <div style="width: 44px; flex-shrink: 0; display: flex; justify-content: center;">${avatarCarnet()}</div>
        <div style="min-width: 0; flex: 1; padding-left: 4px; padding-right: 8px; display: flex; flex-direction: column;">
          <span style="font-size: 13px; line-height: 1.5; font-weight: 600; color: ${T.navy}; ${truncar}">${VISOR.nombre}</span>
          <span style="font-size: 11px; line-height: 1.5; font-weight: 600; color: ${T.sub}; ${truncar}">${VISOR.rol}</span>
        </div>
      </div>
    </div>
  </div>`;
}
