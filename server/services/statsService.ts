import { and, desc, eq, gte, inArray } from 'drizzle-orm'
import { BENCHMARK_TAG } from '#shared/constants/app'
import type { AttemptKind } from '#shared/types'
import { countWords } from '#shared/utils/kpi'
import { addDays, dayKey, dayStart, weekStart } from '#shared/utils/streak'
import { useDb, schema } from '../db'
import { practiceDays } from './streakService'

const a = schema.attempts
const round1 = (n: number) => Math.round(n * 10) / 10
const per100 = (hits: number, words: number) => (words ? round1((hits / words) * 100) : null)

export interface WeekStats {
    week: string
    practiceDays: number
    speaking: number
    writing: number
    /** Graded by Gemini: total mistakes per 100 words. */
    errorsPer100: number | null
    /** Self-review and pasted JSON, kept apart from Gemini (different grader). */
    otherAttempts: number
    otherErrorsPer100: number | null
    wpm: number | null
    focusLabel: string | null
    /** Hits of the week's focus pattern per 100 words. */
    focusPer100: number | null
    reviews: number
    /** Share of non-quiz reviews rated Good or Easy. */
    retention: number | null
    quizScore: number | null
    /** N9: mistakes you marked yourself ÷ all kept mistakes, in attempts that used the step. */
    selfFoundRate: number | null
    /** Gemini model|prompt_version pairs used; a change means numbers are not comparable. */
    versions: string[]
}

/**
 * Weekly progress for the last `weeks` weeks (N7), Monday to Sunday in app time.
 * Only confirmed attempts count, like the streak.
 */
export const getWeeklyStats = async (weeks = 12, includeCheckins = true): Promise<WeekStats[]> => {
    const db = useDb()
    const thisWeek = weekStart(dayKey(Date.now()))
    const keys = Array.from({ length: weeks }, (_, i) => addDays(thisWeek, -7 * (weeks - 1 - i)))
    const from = dayStart(keys[0]!)
    const weekOf = (ms: number) => weekStart(dayKey(ms))

    const attempts = await db
        .select({
            id: a.id,
            kind: a.kind,
            source: a.source,
            createdAt: a.createdAt,
            text: a.finalTranscript,
            original: a.textOrTranscript,
            durationS: a.durationS,
            model: a.model,
            promptVersion: a.promptVersion,
            selfMarkedCount: a.selfMarkedCount,
        })
        .from(a)
        .where(and(eq(a.status, 'confirmed'), gte(a.createdAt, from)))
    const hits = attempts.length
        ? await db
              .select({
                  attemptId: schema.mistakeHits.attemptId,
                  mistakeId: schema.mistakeHits.mistakeId,
                  selfFound: schema.mistakeHits.selfFound,
              })
              .from(schema.mistakeHits)
              .where(
                  inArray(
                      schema.mistakeHits.attemptId,
                      attempts.map((x) => x.id),
                  ),
              )
        : []
    const focus = await db.select().from(schema.focusLog)
    const focusAt = (ms: number) =>
        focus.find((f) => f.startedAt <= ms && (f.endedAt === null || ms < f.endedAt)) ?? null
    const labels = new Map(
        (
            await db
                .select({ id: schema.mistakes.id, label: schema.mistakes.labelVi })
                .from(schema.mistakes)
        ).map((x) => [x.id, x.label]),
    )
    const reviews = await db
        .select({
            rating: schema.reviewLogs.rating,
            isQuiz: schema.reviewLogs.isQuiz,
            at: schema.reviewLogs.reviewedAt,
        })
        .from(schema.reviewLogs)
        .where(gte(schema.reviewLogs.reviewedAt, from))
    const quizzes = await db
        .select({ score: schema.quizzes.score, at: schema.quizzes.finishedAt })
        .from(schema.quizzes)
        .where(gte(schema.quizzes.finishedAt, from))
    const days = await practiceDays(includeCheckins)

    return keys.map((week) => {
        const inWeek = attempts.filter((x) => weekOf(x.createdAt) === week)
        const words = (x: (typeof inWeek)[number]) => countWords(x.text ?? x.original ?? '')
        const hitsOf = (ids: Set<string>) => hits.filter((h) => ids.has(h.attemptId))

        const gemini = inWeek.filter((x) => x.source === 'gemini')
        const other = inWeek.filter((x) => x.source !== 'gemini')
        const sumWords = (list: typeof inWeek) => list.reduce((s, x) => s + words(x), 0)

        const speakingTimed = inWeek.filter((x) => x.kind === 'speaking' && x.durationS)
        const timedWords = sumWords(speakingTimed)
        const timedMinutes = speakingTimed.reduce((s, x) => s + x.durationS! / 60, 0)

        let focusHits = 0
        for (const x of inWeek) {
            const f = focusAt(x.createdAt)
            if (f)
                focusHits += hits.filter(
                    (h) => h.attemptId === x.id && h.mistakeId === f.mistakeId,
                ).length
        }
        const weekEnd = dayStart(addDays(week, 7))
        const focusNow = focusAt(Math.min(weekEnd - 1, Date.now()))

        const weekReviews = reviews.filter((r) => weekOf(r.at) === week)
        const normal = weekReviews.filter((r) => !r.isQuiz)
        const weekQuizzes = quizzes.filter(
            (q) => q.at !== null && weekOf(q.at) === week && q.score !== null,
        )

        const selfStep = inWeek.filter((x) => x.selfMarkedCount !== null)
        const selfHits = hitsOf(new Set(selfStep.map((x) => x.id)))

        return {
            week,
            practiceDays: [...Array(7).keys()].filter((i) => days.has(addDays(week, i))).length,
            speaking: inWeek.filter((x) => x.kind === 'speaking').length,
            writing: inWeek.filter((x) => x.kind === 'writing').length,
            errorsPer100: per100(hitsOf(new Set(gemini.map((x) => x.id))).length, sumWords(gemini)),
            otherAttempts: other.length,
            otherErrorsPer100: per100(
                hitsOf(new Set(other.map((x) => x.id))).length,
                sumWords(other),
            ),
            wpm: timedMinutes ? round1(timedWords / timedMinutes) : null,
            focusLabel: focusNow ? (labels.get(focusNow.mistakeId) ?? focusNow.patternKey) : null,
            focusPer100: inWeek.length ? per100(focusHits, sumWords(inWeek)) : null,
            reviews: weekReviews.length,
            retention: normal.length
                ? normal.filter((r) => r.rating >= 3).length / normal.length
                : null,
            quizScore: weekQuizzes.length
                ? weekQuizzes.reduce((s, q) => s + q.score!, 0) / weekQuizzes.length
                : null,
            selfFoundRate: selfHits.length
                ? selfHits.filter((h) => h.selfFound).length / selfHits.length
                : null,
            versions: [...new Set(gemini.map((x) => `${x.model}|${x.promptVersion}`))],
        }
    })
}

/** Benchmark attempts (topics tagged "benchmark"), grouped by month for side-by-side reading. */
export const getBenchmarks = async () => {
    const db = useDb()
    const rows = await db
        .select({
            id: a.id,
            kind: a.kind,
            createdAt: a.createdAt,
            text: a.finalTranscript,
            durationS: a.durationS,
            source: a.source,
            topicTitle: schema.topics.title,
        })
        .from(a)
        .leftJoin(schema.topics, eq(schema.topics.id, a.topicId))
        .where(and(eq(a.isBenchmark, true), eq(a.status, 'confirmed')))
        .orderBy(desc(a.createdAt))
    const hitCounts = new Map<string, number>()
    if (rows.length)
        for (const h of await db
            .select({ attemptId: schema.mistakeHits.attemptId })
            .from(schema.mistakeHits)
            .where(
                inArray(
                    schema.mistakeHits.attemptId,
                    rows.map((r) => r.id),
                ),
            ))
            hitCounts.set(h.attemptId, (hitCounts.get(h.attemptId) ?? 0) + 1)

    const months = new Map<string, unknown[]>()
    for (const r of rows) {
        const words = countWords(r.text ?? '')
        const item = {
            id: r.id,
            kind: r.kind,
            createdAt: r.createdAt,
            topicTitle: r.topicTitle,
            source: r.source,
            words,
            wpm: r.durationS ? round1(words / (r.durationS / 60)) : null,
            errorsPer100: per100(hitCounts.get(r.id) ?? 0, words),
        }
        const month = dayKey(r.createdAt).slice(0, 7)
        months.set(month, [...(months.get(month) ?? []), item])
    }
    return [...months.entries()].map(([month, attempts]) => ({ month, attempts }))
}

/** Today: whether this month's benchmark is done per kind, and which topic to use. */
export const getBenchmarkStatus = async () => {
    const db = useDb()
    const monthStart = dayStart(`${dayKey(Date.now()).slice(0, 7)}-01`)
    const done = await db
        .select({ kind: a.kind })
        .from(a)
        .where(and(eq(a.isBenchmark, true), gte(a.createdAt, monthStart)))
    const topics = await db.select().from(schema.topics).where(eq(schema.topics.active, true))
    const topicFor = (kind: AttemptKind) =>
        topics.find((t) => t.kind === kind && t.tags.split(',').includes(BENCHMARK_TAG))?.id ?? null
    return (['speaking', 'writing'] as const).map((kind) => ({
        kind,
        done: done.some((d) => d.kind === kind),
        topicId: topicFor(kind),
    }))
}
