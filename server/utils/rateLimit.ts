import { eq, sql } from 'drizzle-orm'
import { useDb, schema } from '../db'

export const MINUTE_MS = 60 * 1000
export const DAY_MS = 24 * 60 * MINUTE_MS

const windowStartOf = (windowMs: number) => Math.floor(Date.now() / windowMs) * windowMs

/**
 * Tăng bộ đếm trong cửa sổ cố định, trả về số lượt sau khi tăng.
 * Lưu trong DB vì serverless function không giữ RAM giữa các lần gọi.
 */
export const hitCounter = async (key: string, windowMs: number): Promise<number> => {
    const t = schema.rateCounters
    const windowStart = windowStartOf(windowMs)
    const rows = await useDb()
        .insert(t)
        .values({ key, windowStart, count: 1 })
        .onConflictDoUpdate({
            target: t.key,
            set: {
                count: sql`CASE WHEN ${t.windowStart} = ${windowStart} THEN ${t.count} + 1 ELSE 1 END`,
                windowStart,
            },
        })
        .returning({ count: t.count })
    return rows[0]?.count ?? 1
}

export const peekCounter = async (key: string, windowMs: number): Promise<number> => {
    const row = await useDb().query.rateCounters.findFirst({
        where: eq(schema.rateCounters.key, key),
    })
    return row && row.windowStart === windowStartOf(windowMs) ? row.count : 0
}

export const resetCounter = async (key: string) => {
    await useDb().delete(schema.rateCounters).where(eq(schema.rateCounters.key, key))
}
