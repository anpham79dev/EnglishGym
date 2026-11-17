import { createError, defineEventHandler } from 'h3'
import { readAuthCookie } from '../utils/session'
const PUBLIC_API = new Set(['/api/auth/login', '/api/auth/me'])

export default defineEventHandler((event) => {
    const path = event.path.split('?')[0]!
    event.context.userId = readAuthCookie(event)
    if (!path.startsWith('/api/') || PUBLIC_API.has(path)) return
    if (!event.context.userId)
        throw createError({ statusCode: 401, statusMessage: 'Chưa đăng nhập' })
})
