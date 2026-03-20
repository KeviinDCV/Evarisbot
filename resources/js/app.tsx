import '../css/app.css';
// Echo/Reverb deshabilitado para compatibilidad con cPanel (usar polling en su lugar)
// import './echo';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { initializeTheme } from './hooks/use-appearance';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';
import axios from 'axios';

// Configure axios to automatically send XSRF-TOKEN cookie with requests
axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
axios.defaults.withCredentials = true;
axios.defaults.withXSRFToken = true;

// Retry once on 419 (CSRF token mismatch) by refreshing the token
axios.interceptors.response.use(
    response => response,
    async error => {
        const originalRequest = error.config;
        if (error.response?.status === 419 && !originalRequest._retried) {
            originalRequest._retried = true;
            // Fetch a fresh page to get updated XSRF-TOKEN cookie
            await axios.get(window.location.pathname, { headers: { 'X-Inertia': 'false' } }).catch(() => {});
            return axios(originalRequest);
        }
        return Promise.reject(error);
    }
);

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    resolve: (name) =>
        resolvePageComponent(
            `./pages/${name}.tsx`,
            import.meta.glob('./pages/**/*.tsx'),
        ),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(
            <I18nextProvider i18n={i18n}>
                <App {...props} />
            </I18nextProvider>
        );
    },
    progress: {
        color: '#4B5563',
    },
});

// This will set light / dark mode on load...
initializeTheme();
