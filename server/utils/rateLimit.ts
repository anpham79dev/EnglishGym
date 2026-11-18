import { eq, sql } from 'drizzle-orm'
import { APP_UTC_OFFSET_MIN } from '#shared/constants/app'
import { useDb, schema } from '../db'

export const MINUTE_MS = 60 * 1000
export const DAY_MS = 24 * 60 * MINUTE_MS
/** Shift for day windows so they reset at local midnight (Vietnam time), not UTC midnight. */
export const APP_DAY_OFFSET_MS = APP_UTC_OFFSET_MIN * MINUTE_MS

const windowStartOf = (windowMs: number, offsetMs: number) =>
    Math.floor((Date.now() + offsetMs) / windowMs) * windowMs - offsetMs

/**
 * Fixed-window counter; returns the new count.
 * Stored in the DB because serverless functions keep no memory.
 */
export const hitCounter = async (key: string, windowMs: number, offsetMs = 0): Promise<number> => {
    const t = schema.rateCounters
    const windowStart = windowStartOf(windowMs, offsetMs)
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

export const peekCounter = async (key: string, windowMs: number, offsetMs = 0): Promise<number> => {
    const row = await useDb().query.rateCounters.findFirst({
        where: eq(schema.rateCounters.key, key),
    })
    return row && row.windowStart === windowStartOf(windowMs, offsetMs) ? row.count : 0
}

export const resetCounter = async (key: string) => {
    await useDb().delete(schema.rateCounters).where(eq(schema.rateCounters.key, key))
}
