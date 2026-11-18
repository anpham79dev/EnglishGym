export default defineNuxtConfig({
    compatibilityDate: '2026-11-01',
    devtools: { enabled: false },
    telemetry: false,
    // SPA: MediaRecorder and IndexedDB are browser-only.
    ssr: false,
    modules: ['@nuxt/ui'],
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
    // Inter is downloaded at build time and served from the app; the UI is Vietnamese.
    fonts: {
        defaults: { weights: [400, 500, 600, 700], subsets: ['latin', 'latin-ext', 'vietnamese'] },
    },
    icon: {
        // Icons come from @iconify-json/lucide in the bundle, never from the Iconify API.
        clientBundle: {
            // The default scan skips .ts files, so icon names kept in app/constants were missed.
            scan: { globInclude: ['**/*.{vue,ts}'] },
            includeCustomCollections: true,
        },
        fallbackToApi: false,
    },
    // Secrets are read from process.env on the server only.
    nitro: {
        vercel: { functions: { maxDuration: 60 } },
    },
    typescript: { strict: true },
})
