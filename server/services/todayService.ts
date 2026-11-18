import { eq, gte } from 'drizzle-orm'
import type { AttemptKind } from '#shared/types'
import { useDb, schema } from '../db'
import { geminiDailyLimit, geminiUsedToday } from '../utils/quota'
import { geminiModel } from './geminiService'

/**
 * Rough size of the JSON export (bytes), from column lengths instead of building the export.
 * Per-row constants cover keys and short fields; x1.1 covers JSON escaping of ai_json.
 */
export const estimateBackupBytes = async () => {
    const bytes = (col: string) => `coalesce(length(cast(${col} as blob)), 0)`
    const res = await useDb().$client.execute(
        `SELECT
          (SELECT coalesce(sum(${bytes('ai_json')} + ${bytes('text_or_transcript')}
                 + ${bytes('final_transcript')} + ${bytes('error')} + 500), 0) FROM attempts)
        + (SELECT coalesce(sum(${bytes('label_vi')} + ${bytes('example_wrong')}
                 + ${bytes('example_right')} + 300), 0) FROM mistakes)
        + (SELECT coalesce(sum(${bytes('original_quote')} + ${bytes('correction')} + 200), 0)
                 FROM mistake_hits)
        + (SELECT coalesce(sum(${bytes('title')} + ${bytes('prompt')} + 150), 0) FROM topics)
          AS n`,
    )
    return Math.round(Number(res.rows[0]?.n ?? 0) * 1.1)
}

/**
 * Data for the Today screen.
 * @param from start of the user's local day (ms)
 * @param day day index for topic rotation
 */
export const getTodaySummary = async (from: number, day: number) => {
    const db = useDb()

    const topics = await db
        .select()
        .from(schema.topics)
        .where(eq(schema.topics.active, true))
        .orderBy(schema.topics.id)
    const pick = (kind: AttemptKind) => {
        const list = topics.filter((t) => t.kind === kind)
        return list.length ? list[day % list.length]! : null
    }

    const todays = await db
        .select({ kind: schema.attempts.kind, status: schema.attempts.status })
        .from(schema.attempts)
        .where(gte(schema.attempts.createdAt, from))
    const done = (kind: AttemptKind) =>
        todays.filter((a) => a.kind === kind && a.status === 'confirmed').length

    const focus = await db.query.mistakes.findFirst({ where: eq(schema.mistakes.isFocus, true) })
    const pendingReview = await db
        .select({ id: schema.attempts.id, kind: schema.attempts.kind })
        .from(schema.attempts)
        .where(eq(schema.attempts.status, 'needs_review'))

    return {
        speakingTopic: pick('speaking'),
        writingTopic: pick('writing'),
        done: { speaking: done('speaking'), writing: done('writing') },
        submittedToday: todays.length,
        focus: focus ?? null,
        pendingReview,
        geminiUsedToday: await geminiUsedToday(),
        geminiDailyLimit: geminiDailyLimit(),
        model: geminiModel(),
        backupBytes: await estimateBackupBytes(),
    }
}
