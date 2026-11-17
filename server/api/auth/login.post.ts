import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { useDb, schema } from '../../db'

const bodySchema = z.object({
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(1).max(200),
})

const MAX_FAILS = 5
const WINDOW_MS = 15 * MINUTE_MS

export default defineEventHandler(async (event) => {
    const { email, password } = await parseBody(event, bodySchema)
    const key = `login:${getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'}`

    if ((await peekCounter(key, WINDOW_MS)) >= MAX_FAILS)
        throw apiError(429, 'RATE_LIMIT', 'Sai mật khẩu quá nhiều lần, thử lại sau 15 phút')

    const user = await useDb().query.users.findFirst({ where: eq(schema.users.email, email) })
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
        await hitCounter(key, WINDOW_MS)
        throw createError({ statusCode: 401, statusMessage: 'Email hoặc mật khẩu không đúng' })
    }

    await resetCounter(key)
    setAuthCookie(event, user.id)
    return { id: user.id, email: user.email }
})
