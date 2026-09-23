import AppointmentsView from '../appointments/view';
import { type ComponentProps } from 'react';

// Lista de Citas de Oncología: la misma de General (el ámbito y las rutas salen de routePrefix).
// Componente propio y no re-exportación: ver la nota en ./index.tsx (claves del manifest de Vite).
export default function OncologyAppointmentsView(props: ComponentProps<typeof AppointmentsView>) {
    return <AppointmentsView {...props} />;
}
