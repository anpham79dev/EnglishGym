export default defineNuxtRouteMiddleware(async (to) => {
    const { user, refresh } = useAuth()
    if (user.value === undefined) await refresh()

    if (to.path === '/login') return user.value ? navigateTo('/') : undefined
    if (!user.value) return navigateTo('/login')
})
