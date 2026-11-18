import { createError, defineEventHandler } from 'h3'
import { readAuthCookie } from '../utils/session'
const PUBLIC_API = new Set(['/api/auth/login', '/api/auth/me'])

export default defineEventHandler((event) => {
    const path = event.path.split('?')[0]!
    event.context.userId = readAuthCookie(event)
    // `/api/_nuxt_icon` serves bundled icon data (public, no user data).
    if (!path.startsWith('/api/') || PUBLIC_API.has(path) || path.startsWith('/api/_nuxt_icon'))
        return
    if (!event.context.userId)
        throw createError({ statusCode: 401, statusMessage: 'Chưa đăng nhập' })
})
