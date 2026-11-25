// "Actual": /admin/users tal como se ve hoy (1440x900, administrador, riel colapsado).
import { rielActual, documento, escribir } from './_comun.mjs';
import { lienzo, paginaActual } from './_piezas.mjs';

escribir('Actual.dc.html', documento(lienzo(rielActual('users') + paginaActual({ izquierda: 80 }))));
