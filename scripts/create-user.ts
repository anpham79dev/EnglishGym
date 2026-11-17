/**
 * Tạo hoặc đổi mật khẩu tài khoản duy nhất.
 *   npm run user:create -- you@example.com "mat-khau-dai"
 */
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { eq } from 'drizzle-orm'

if (existsSync('.env')) process.loadEnvFile('.env')

const { useDb, schema } = await import('../server/db')
const { hashPassword } = await import('../server/utils/password')

const [email, password] = process.argv.slice(2)
if (!email || !password || password.length < 8) {
    console.error('Cách dùng: npm run user:create -- <email> <mật khẩu ≥ 8 ký tự>')
    process.exit(1)
}

const db = useDb()
const normalized = email.trim().toLowerCase()
const passwordHash = await hashPassword(password)
const existing = await db.query.users.findFirst({ where: eq(schema.users.email, normalized) })

if (existing) {
    await db.update(schema.users).set({ passwordHash }).where(eq(schema.users.id, existing.id))
    console.log(`Đã đổi mật khẩu cho ${normalized}`)
} else {
    await db.insert(schema.users).values({ id: randomUUID(), email: normalized, passwordHash })
    console.log(`Đã tạo tài khoản ${normalized}`)
}
