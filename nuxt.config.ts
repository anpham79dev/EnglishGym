export default defineNuxtConfig({
    compatibilityDate: '2026-11-01',
    devtools: { enabled: false },
    telemetry: false,
    // SPA: MediaRecorder and IndexedDB are browser-only.
    ssr: false,
    css: ['~/assets/css/main.css'],
    app: {
        head: {
            title: 'EnglishGym',
            htmlAttrs: { lang: 'vi' },
            meta: [
                {
                    name: 'viewport',
                    content: 'width=device-width, initial-scale=1, viewport-fit=cover',
                },
                { name: 'theme-color', content: '#0f766e' },
            ],
        },
    },
    // Secrets are read from process.env on the server only.
    nitro: {
        vercel: { functions: { maxDuration: 60 } },
    },
    typescript: { strict: true },
})
