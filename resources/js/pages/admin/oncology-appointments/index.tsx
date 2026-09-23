import AppointmentsIndex from '../appointments/index';
import { type ComponentProps } from 'react';

// Citas de Oncología usa las MISMAS pantallas que General: OncologyAppointmentController extiende
// AppointmentController y siempre manda routePrefix ('/admin/oncology-appointments') y pageTitle, que
// es lo único que cambia (rutas, título de pestaña y el ámbito activo en el conmutador General/Oncología).
//
// OJO: tiene que ser un componente propio y NO un `export { default } from ...`. Con la re-exportación,
// Rollup funde esta página y la de General en un solo chunk sin módulo de fachada, el manifest de Vite
// deja de tener las claves resources/js/pages/admin/(oncology-)appointments/index.tsx y el
// @vite([... "resources/js/pages/{$page['component']}.tsx"]) de app.blade.php da 500 al cargar la página.
export default function OncologyAppointmentsIndex(props: ComponentProps<typeof AppointmentsIndex>) {
    return <AppointmentsIndex {...props} />;
}
