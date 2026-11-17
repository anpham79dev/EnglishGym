export default defineNuxtConfig({
    compatibilityDate: '2026-11-01',
    devtools: { enabled: false },
    // SPA: MediaRecorder và IndexedDB chỉ có ở trình duyệt, không cần SSR cho app cá nhân.
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
    // Chỉ server đọc các biến này qua process.env; không dùng runtimeConfig.public.
    nitro: {
        vercel: { functions: { maxDuration: 60 } },
    },
    typescript: { strict: true },
})
