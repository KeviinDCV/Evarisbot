import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [
        laravel({
            // Sin SSR: app.tsx arranca con createRoot (no hydrateRoot), así que el bundle de
            // SSR nunca se usaba — sólo era una bomba cebada apuntando a un cliente que hidrata.
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            refresh: true,
        }),
        react(),
        tailwindcss(),
        wayfinder({
            formVariants: true,
        }),
    ],
    server: {
        host: '0.0.0.0', // Listen on all network interfaces
        port: 5173,
        strictPort: true,
        // Sólo dev. origin:'*' con credentials dejaba que cualquier sitio leyera las
        // respuestas del dev server; se acota a los orígenes reales de desarrollo.
        cors: {
            origin: [/^http:\/\/localhost(:\d+)?$/, /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/],
            credentials: true,
        },
        hmr: {
            host: '192.168.2.202', // Use your machine's network IP for HMR
        },
    },
    esbuild: {
        jsx: 'automatic',
    },
});
