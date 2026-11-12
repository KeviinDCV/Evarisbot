// "Barra con nombres" (modo fijado real) sobre la página real de Usuarios. El riel vive en _rieles.mjs.
import { documento, escribir } from './_comun.mjs';
import { lienzo, paginaActual } from './_piezas.mjs';
import { rielOscuroNombres } from './_rieles.mjs';

escribir('BarraNombres.dc.html', documento(lienzo(rielOscuroNombres('users') + paginaActual({ izquierda: 276 }))));
