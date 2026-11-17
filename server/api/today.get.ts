import { and, eq, gte } from 'drizzle-orm'
import { z } from 'zod'
import { useDb, schema } from '../db'
import { geminiModel } from '../services/geminiService'

const querySchema = z.object({
    /** Mốc 0h hôm nay theo giờ máy người dùng (ms). */
    from: z.coerce.number().int().positive(),
    /** Số thứ tự ngày, dùng để xoay vòng đề. */
    day: z.coerce.number().int().nonnegative(),
})

export default defineEventHandler(async (event) => {
    const { from, day } = parseQuery(event, querySchema)
    const db = useDb()

    const topics = await db
        .select()
        .from(schema.topics)
        .where(eq(schema.topics.active, true))
        .orderBy(schema.topics.id)
    const pick = (kind: 'speaking' | 'writing') => {
        const list = topics.filter((t) => t.kind === kind)
        return list.length ? list[day % list.length]! : null
    }

    const todays = await db
        .select({ kind: schema.attempts.kind, status: schema.attempts.status })
        .from(schema.attempts)
        .where(gte(schema.attempts.createdAt, from))
    const done = (kind: string) =>
        todays.filter((a) => a.kind === kind && a.status === 'confirmed').length

    const focus = await db.query.mistakes.findFirst({ where: eq(schema.mistakes.isFocus, true) })
    const pendingReview = await db
        .select({ id: schema.attempts.id, kind: schema.attempts.kind })
        .from(schema.attempts)
        .where(and(eq(schema.attempts.status, 'needs_review')))

    return {
        speakingTopic: pick('speaking'),
        writingTopic: pick('writing'),
        done: { speaking: done('speaking'), writing: done('writing') },
        submittedToday: todays.length,
        focus: focus ?? null,
        pendingReview,
        geminiUsedToday: await peekCounter('gemini:day', DAY_MS),
        geminiDailyLimit: Number(process.env.GEMINI_DAILY_LIMIT || 40),
        model: geminiModel(),
    }
})
