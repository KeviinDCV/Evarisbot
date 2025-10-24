import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            ssr: 'resources/js/ssr.tsx',
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
        cors: {
            origin: '*', // Allow all origins (or specify 'http://192.168.2.202:8000' for specific origin)
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
