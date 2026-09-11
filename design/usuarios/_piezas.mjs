// Componentes de la pantalla real de Usuarios, reproducidos al píxel.
// Las variantes los reutilizan para que lo que NO cambia se vea idéntico en todas.
import { T, icono, USUARIOS, METRICAS, iniciales, rolTexto } from './_comun.mjs';

export const truncar = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';

/** Tarjeta base del proyecto (.card-gradient + rounded-2xl). */
export const tarjeta = (dentro, extra = '') =>
  `<div style="background: ${T.card}; box-shadow: ${T.cardShadow}; border-radius: 16px; ${extra}">${dentro}</div>`;

/** MetricCard real: tile h-11 w-11 rounded-xl border + etiqueta, valor, detalle. */
export const metrica = (ico, label, value, detail, activo = false) => tarjeta(`
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 44px; height: 44px; flex-shrink: 0; border-radius: 12px; border: 1px solid ${activo ? T.emerald200 : T.border}; background: ${activo ? T.emerald50 : 'rgba(46,63,132,.1)'}; color: ${activo ? T.emerald700 : T.navy}; display: flex; align-items: center; justify-content: center;">${icono(ico, 20)}</div>
          <div style="min-width: 0; flex: 1;">
            <p style="font-size: ${T.xs}; line-height: ${T.lhXs}; font-weight: 600; color: ${T.sub}; ${truncar}">${label}</p>
            <p style="margin-top: 4px; font-size: ${T.lg}; line-height: 1.25; font-weight: 700; color: ${T.navy};">${value}</p>
            <p style="margin-top: 2px; font-size: ${T.xs}; line-height: ${T.lhXs}; color: ${T.sub}; ${truncar}">${detail}</p>
          </div>
        </div>`, 'padding: 16px;');

/** RolePill / OnlinePill reales: rounded-md border px-2.5 py-1 text-[11px] font-semibold. */
export const pastilla = (borde, fondo, color, dentro) =>
  `<span style="display: inline-flex; align-items: center; gap: 6px; border-radius: 8px; border: 1px solid ${borde}; background: ${fondo}; color: ${color}; padding: 4px 10px; font-size: 11px; line-height: 1.5; font-weight: 600; white-space: nowrap;">${dentro}</span>`;
export const rolPill = (r) => r === 'admin'
  ? pastilla('rgba(46,63,132,.2)', 'rgba(46,63,132,.1)', T.navy, icono('shield-check', 14) + rolTexto(r))
  : pastilla(T.sky200, T.sky50, T.sky700, icono('headphones', 14) + rolTexto(r));
export const conexionPill = (on) => on
  ? pastilla(T.emerald200, T.emerald50, T.emerald700, `<span style="width: 8px; height: 8px; border-radius: 9999px; background: ${T.emerald500}; flex-shrink: 0;"></span>En línea`)
  : pastilla(T.slate200, T.slate50, T.slate600, `<span style="width: 8px; height: 8px; border-radius: 9999px; background: ${T.slate400}; flex-shrink: 0;"></span>Desconectado`);

/** Interruptor real de envío masivo: h-6 w-11 rounded-full, bolita h-4 w-4. */
export const interruptor = (activo) =>
  `<div style="position: relative; display: inline-flex; align-items: center; width: 44px; height: 24px; flex-shrink: 0; border-radius: 9999px; background: ${activo ? T.navy : T.slate300};"><span style="display: inline-block; width: 16px; height: 16px; border-radius: 9999px; background: #ffffff; box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1); transform: translateX(${activo ? 24 : 4}px);"></span></div>`;

/** Avatar de iniciales (navy sólido, como en la tabla real). */
export const avatar = (u, size = 36) =>
  `<div style="width: ${size}px; height: ${size}px; flex-shrink: 0; border-radius: 9999px; background: ${T.navy}; color: #ffffff; font-size: ${size >= 44 ? T.base : T.xs}; font-weight: 700; display: flex; align-items: center; justify-content: center;">${iniciales(u.n)}</div>`;

/** Botón primario real (.settings-btn-primary, h-10 rounded-xl px-5 text-xs semibold). */
export const botonPrimario = (texto, ico = 'plus') =>
  `<div style="height: 40px; border-radius: 12px; padding: 0 20px; background: ${T.btnPrimary}; box-shadow: ${T.btnPrimaryShadow}; color: #ffffff; font-size: ${T.xs}; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; gap: 8px; white-space: nowrap; flex-shrink: 0;">${ico ? `<span style="margin-right: 8px; display: flex;">${icono(ico, 16)}</span>` : ''}${texto}</div>`;

/** Botón de icono secundario real (.settings-btn-secondary, h-8 w-8 rounded-xl). */
export const botonIcono = (ico, titulo) =>
  `<div title="${titulo}" style="width: 32px; height: 32px; flex-shrink: 0; border-radius: 12px; background: ${T.btnSecondary}; box-shadow: ${T.btnSecondaryShadow}; color: ${T.navy}; display: flex; align-items: center; justify-content: center;">${icono(ico, 16)}</div>`;

/** Botón de borrar real (outline + border-0 + text-red-600 sobre bg-background). */
export const botonBorrar = () =>
  `<div title="Eliminar" style="width: 32px; height: 32px; flex-shrink: 0; border-radius: 12px; background: ${T.bg}; box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); color: ${T.red600}; display: flex; align-items: center; justify-content: center;">${icono('trash-2', 16)}</div>`;

/** Campo de búsqueda real (.settings-input h-10 rounded-xl pl-9, lupa a 12 px). */
export const busqueda = (placeholder = 'Buscar por nombre o email...', alto = 40) => `
            <div style="position: relative;">
              <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: ${T.sub};">${icono('search', 16)}</span>
              <div style="height: ${alto}px; border-radius: 12px; padding: 0 36px; background: ${T.input}; box-shadow: ${T.inputShadow}; font-size: ${T.sm}; color: ${T.muted}; display: flex; align-items: center; ${truncar}">${placeholder}</div>
            </div>`;

/** Segmentado real de rol (bg-white/70 p-1 rounded-xl, opciones rounded-lg px-3 py-1.5). */
export const segmentado = (opciones, activa = 0) => `
            <div style="display: inline-flex; border-radius: 12px; background: rgba(255,255,255,.7); padding: 4px;">${opciones.map((o, i) => i === activa
              ? `<div style="border-radius: 10px; padding: 6px 12px; font-size: ${T.xs}; line-height: ${T.lhXs}; font-weight: 600; background: ${T.navy}; color: #ffffff; box-shadow: 0 1px 3px 0 rgb(46 63 132 / .2), 0 1px 2px -1px rgb(46 63 132 / .2); white-space: nowrap;">${o}</div>`
              : `<div style="border-radius: 10px; padding: 6px 12px; font-size: ${T.xs}; line-height: ${T.lhXs}; font-weight: 600; color: ${T.sub}; white-space: nowrap;">${o}</div>`).join('')}
            </div>`;

const th = (txt, alinear = 'left') =>
  `<th style="padding: 14px 16px; text-align: ${alinear}; font-size: ${T.xs}; line-height: ${T.lhXs}; font-weight: 600; color: ${T.navy}; white-space: nowrap;">${txt}</th>`;

const filaActual = (u) => `
            <tr style="border-bottom: 1px solid rgba(212,216,232,.6);">
              <td style="padding: 14px 16px;">
                <div style="display: flex; min-width: 0; align-items: center; gap: 12px;">
                  ${avatar(u, 36)}
                  <div style="min-width: 0;">
                    <p style="font-size: ${T.sm}; line-height: ${T.lhSm}; font-weight: 700; color: ${T.navy}; ${truncar}">${u.n}</p>
                    <p style="font-size: ${T.xs}; line-height: ${T.lhXs}; color: ${T.sub}; ${truncar}">${u.e}</p>
                  </div>
                </div>
              </td>
              <td style="padding: 14px 16px;">${rolPill(u.r)}</td>
              <td style="padding: 14px 16px;">
                <div style="display: flex; flex-direction: column; gap: 6px;">
                  ${conexionPill(u.on)}
                  <span style="font-size: 11px; line-height: 1.5; color: ${T.sub};">${u.act}</span>
                </div>
              </td>
              <td style="padding: 14px 16px; text-align: center;">${u.r === 'advisor' ? interruptor(u.bulk) : `<span style="font-size: ${T.xs}; color: ${T.sub};">-</span>`}</td>
              <td style="padding: 14px 16px;">
                <div style="display: flex; align-items: center; gap: 8px; font-size: ${T.xs}; line-height: ${T.lhXs}; color: ${T.sub};">${icono('calendar', 16)}<span>${u.reg}</span></div>
              </td>
              <td style="padding: 14px 16px;">
                <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px;">${botonIcono('edit-3', 'Editar')}${botonBorrar()}</div>
              </td>
            </tr>`;

/**
 * La página real de Usuarios (sin el riel). `izquierda` es el hueco que deja el riel:
 * 80 px con el riel colapsado (lg:pl-20), 276 px fijado (lg:pl-[276px]).
 */
export function paginaActual({ izquierda = 80 } = {}) {
  return `
  <div style="position: absolute; left: ${izquierda}px; top: 0; right: 0; bottom: 0; padding: 32px;">
    <div style="max-width: 1280px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px;">

      <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px;">
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <div style="margin-top: 4px; width: 48px; height: 48px; flex-shrink: 0; border-radius: 16px; background: rgba(255,255,255,.7); color: ${T.navy}; box-shadow: 0 1px 3px 0 rgb(46 63 132 / .05), 0 1px 2px -1px rgb(46 63 132 / .05); display: flex; align-items: center; justify-content: center;">${icono('users', 20)}</div>
          <div>
            <h1 style="font-size: ${T.x3}; line-height: 1.5; font-weight: 700; color: ${T.navy};">Gestión de usuarios</h1>
            <p style="margin-top: 8px; font-size: ${T.sm}; line-height: 1.5; color: ${T.sub};">Administra los usuarios del sistema</p>
          </div>
        </div>
        ${botonPrimario('Nuevo usuario')}
      </div>

      <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px;">
        ${metrica('users', 'Usuarios', METRICAS.total, `${METRICAS.total} visibles`)}
        ${metrica('activity', 'En línea', METRICAS.online, 'actividad reciente', true)}
        ${metrica('shield-check', 'Administradores', METRICAS.admins, 'acceso completo')}
        ${metrica('headphones', 'Asesores', METRICAS.advisors, `${METRICAS.bulk} con envío masivo`)}
      </div>

      ${tarjeta(`
        <div style="display: flex; align-items: flex-end; justify-content: space-between; gap: 16px;">
          <div style="min-width: 0; flex: 1;">
            <p style="margin-bottom: 8px; font-size: ${T.xs}; line-height: ${T.lhXs}; font-weight: 600; color: ${T.navy};">Buscar</p>
            ${busqueda()}
          </div>
          <div style="min-width: 0;">
            <p style="margin-bottom: 8px; font-size: ${T.xs}; line-height: ${T.lhXs}; font-weight: 600; color: ${T.navy};">Rol</p>
            ${segmentado(['Todos', 'Administradores', 'Asesores'])}
          </div>
        </div>`, 'padding: 16px;')}

      ${tarjeta(`
        <div style="padding: 16px; border-bottom: 1px solid rgba(212,216,232,.8);">
          <h2 style="font-size: ${T.base}; line-height: 1.5; font-weight: 700; color: ${T.navy};">Directorio de usuarios</h2>
          <p style="margin-top: 4px; font-size: ${T.xs}; line-height: ${T.lhXs}; color: ${T.sub};">${METRICAS.total} de ${METRICAS.total} usuarios</p>
        </div>
        <table style="width: 100%; min-width: 900px; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="border-bottom: 1px solid rgba(212,216,232,.8); background: ${T.thead};">
              ${th('Usuario')}${th('Rol')}${th('Estado')}
              <th style="padding: 14px 16px; text-align: center; font-size: ${T.xs}; line-height: ${T.lhXs}; font-weight: 600; color: ${T.navy}; white-space: nowrap;"><span style="display: inline-flex; align-items: center; justify-content: center; gap: 6px;">${icono('send', 14)}Envío masivo</span></th>
              ${th('Registro')}${th('Acciones', 'right')}
            </tr>
          </thead>
          <tbody>${USUARIOS.slice(0, 8).map(filaActual).join('')}
          </tbody>
        </table>`, 'overflow: hidden;')}

    </div>
  </div>`;
}

/** Lienzo 1440x900 con fondo de la app. */
export const lienzo = (dentro) =>
  `<div style="position: relative; width: 1440px; height: 900px; overflow: hidden; background: ${T.bg}; font-family: ${T.font};">${dentro}
</div>`;
