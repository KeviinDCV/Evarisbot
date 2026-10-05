<?php

use App\Services\AppointmentCancellationSync;

/**
 * El mecanismo de cancelación estuvo desde el 29 de julio sin marcar ni una sola cita:
 * los asesores escriben el mes con letra ("04 SEPTIEMBRE 2026", "09/SEPTIEMBRE/2026")
 * y el lector de fechas sólo entendía formatos numéricos, así que devolvía null y se
 * abandonaba en silencio. El WhatsApp salía, la cita seguía "confirmada" y el bot
 * acababa contradiciendo al asesor.
 *
 * Los dos primeros casos de cada bloque son fallos reales sacados del registro.
 */
function invocarPrivado(string $metodo, ?string $valor): ?string
{
    $m = new ReflectionMethod(AppointmentCancellationSync::class, $metodo);
    $m->setAccessible(true);

    return $m->invoke(null, $valor);
}

it('lee las fechas con el mes escrito en letra', function (string $entrada, string $esperado) {
    expect(invocarPrivado('aFecha', $entrada))->toBe($esperado);
})->with([
    ['04 SEPTIEMBRE 2026', '2026-09-04'],      // fallo real, 2026-09-03 15:18
    ['09/SEPTIEMBRE/2026', '2026-09-09'],      // fallo real, 2026-09-03 15:51
    ['9 de septiembre de 2026', '2026-09-09'],
    ['SEPTIEMBRE 4 2026', '2026-09-04'],
    ['4 sep 2026', '2026-09-04'],
    ['04 setiembre 2026', '2026-09-04'],
    ['1 DE ENERO DE 2027', '2027-01-01'],
    ['15 Diciembre 2026', '2026-12-15'],
]);

it('sigue leyendo los formatos numéricos de siempre', function (string $entrada, string $esperado) {
    expect(invocarPrivado('aFecha', $entrada))->toBe($esperado);
})->with([
    ['29/07/2026', '2026-07-29'],
    ['2026-07-29', '2026-07-29'],
    ['29-07-2026', '2026-07-29'],
]);

it('rechaza lo que no es una fecha en vez de inventarse una', function (string $entrada) {
    // Importa que rechace: una fecha mal leída cancelaría la cita equivocada.
    expect(invocarPrivado('aFecha', $entrada))->toBeNull();
})->with([
    '31 febrero 2026',      // día inexistente; PHP lo desplazaría al 3 de marzo
    '04 SEPTIEMBRE',        // sin año
    '04 SEPTUEMBRE 2026',   // mes mal escrito
    '32/13/2026',
    'manana',
    '',
]);

it('lee las horas tal como las escriben los asesores', function (string $entrada, string $esperado) {
    expect(invocarPrivado('aHora', $entrada))->toBe($esperado);
})->with([
    ['4:00 PM', '16:00:00'],
    ['9:00 AM', '09:00:00'],
    ['9:30 a. m.', '09:30:00'],
    ['09:00:00', '09:00:00'],
]);
