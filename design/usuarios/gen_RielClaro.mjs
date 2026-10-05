// "Riel claro" sobre la página real de Usuarios. El riel vive en _rieles.mjs.
import { documento, escribir } from './_comun.mjs';
import { lienzo, paginaActual } from './_piezas.mjs';
import { rielClaro } from './_rieles.mjs';

escribir('RielClaro.dc.html', documento(lienzo(rielClaro('users') + paginaActual({ izquierda: 80 }))));
