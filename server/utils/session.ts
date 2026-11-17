import { createHmac, timingSafeEqual } from 'node:crypto'
import { deleteCookie, getCookie, setCookie, type H3Event } from 'h3'

const COOKIE = 'eg_session'
const MAX_AGE_S = 60 * 60 * 24 * 30

const secret = () => {
    const s = process.env.SESSION_SECRET
    if (!s || s.length < 32) throw new Error('SESSION_SECRET phải có ít nhất 32 ký tự')
    return s
}

const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url')

/** Cookie dạng `<userId>.<expMs>.<hmac>`: không cần bảng sessions cho app một người dùng. */
export const setAuthCookie = (event: H3Event, userId: string) => {
    const payload = `${userId}.${Date.now() + MAX_AGE_S * 1000}`
    setCookie(event, COOKIE, `${payload}.${sign(payload)}`, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: MAX_AGE_S,
    })
}

export const clearAuthCookie = (event: H3Event) => deleteCookie(event, COOKIE, { path: '/' })

export const readAuthCookie = (event: H3Event): string | null => {
    const raw = getCookie(event, COOKIE)
    if (!raw) return null
    const lastDot = raw.lastIndexOf('.')
    if (lastDot < 0) return null
    const payload = raw.slice(0, lastDot)
    const sig = Buffer.from(raw.slice(lastDot + 1))
    const expected = Buffer.from(sign(payload))
    if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null
    const [userId, exp] = payload.split('.')
    if (!userId || !exp || Number(exp) < Date.now()) return null
    return userId
}
