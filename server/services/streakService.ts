import { createError } from 'h3'
import { randomUUID } from 'node:crypto'
import { and, asc, eq, gte, lt } from 'drizzle-orm'
import { z } from 'zod'
import type { AttemptKind, Checkin } from '#shared/types'
import { addDays, dayKey, dayStart, summarizeStreak } from '#shared/utils/streak'
import { useDb, schema } from '../db'

const a = schema.attempts
const c = schema.checkins

/** Hook for other practice sources (card reviews, N5) to count toward the streak. */
const extraDaySources: (() => Promise<string[]>)[] = []
export const registerPracticeDays = (source: () => Promise<string[]>) => {
    extraDaySources.push(source)
}

/**
 * Days with practice, in app time. An attempt counts on the day it was submitted, and only
 * once confirmed (reviewing is part of practising). Manual check-ins count unless excluded.
 */
export const practiceDays = async (includeCheckins = true) => {
    const db = useDb()
    const confirmed = await db
        .select({ createdAt: a.createdAt })
        .from(a)
        .where(eq(a.status, 'confirmed'))
    const days = new Set(confirmed.map((r) => dayKey(r.createdAt)))
    if (includeCheckins) for (const r of await db.select({ date: c.date }).from(c)) days.add(r.date)
    for (const source of extraDaySources) for (const d of await source()) days.add(d)
    return days
}

export const getStreak = async (includeCheckins = true) =>
    summarizeStreak(await practiceDays(includeCheckins), dayKey(Date.now()))

export interface CalendarDay {
    date: string
    speaking: number
    writing: number
    reviews: number
    attempts: { id: string; kind: AttemptKind; topicTitle: string | null; version: number }[]
    checkins: Checkin[]
}

const reviewCounters: ((from: number, to: number) => Promise<Map<string, number>>)[] = []
/** Hook for N5: number of card reviews per day key in [from, to). */
export const registerReviewCounter = (
    counter: (from: number, to: number) => Promise<Map<string, number>>,
) => {
    reviewCounters.push(counter)
}

/** Every day of a month (YYYY-MM) with confirmed attempts, reviews and check-ins. */
export const getCalendarMonth = async (month: string) => {
    const first = `${month}-01`
    const nextMonth = new Date(Date.parse(`${first}T00:00:00Z`))
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1)
    const next = nextMonth.toISOString().slice(0, 10)
    const from = dayStart(first)
    const to = dayStart(next)

    const db = useDb()
    const attempts = await db
        .select({
            id: a.id,
            kind: a.kind,
            createdAt: a.createdAt,
            version: a.version,
            topicTitle: schema.topics.title,
        })
        .from(a)
        .leftJoin(schema.topics, eq(schema.topics.id, a.topicId))
        .where(and(eq(a.status, 'confirmed'), gte(a.createdAt, from), lt(a.createdAt, to)))
        .orderBy(asc(a.createdAt))
    const checkins = await db
        .select()
        .from(c)
        .where(and(gte(c.date, first), lt(c.date, next)))
        .orderBy(asc(c.createdAt))
    const reviews = new Map<string, number>()
    for (const counter of reviewCounters)
        for (const [k, n] of await counter(from, to)) reviews.set(k, (reviews.get(k) ?? 0) + n)

    const days: CalendarDay[] = []
    for (let d = first; d < next; d = addDays(d, 1)) {
        const dayAttempts = attempts.filter((x) => dayKey(x.createdAt) === d)
        days.push({
            date: d,
            speaking: dayAttempts.filter((x) => x.kind === 'speaking').length,
            writing: dayAttempts.filter((x) => x.kind === 'writing').length,
            reviews: reviews.get(d) ?? 0,
            attempts: dayAttempts.map(({ id, kind, topicTitle, version }) => ({
                id,
                kind,
                topicTitle,
                version,
            })),
            checkins: checkins.filter((x) => x.date === d),
        })
    }
    const practiced = days.filter(
        (d) => d.speaking + d.writing + d.reviews + d.checkins.length > 0,
    ).length
    return {
        month,
        today: dayKey(Date.now()),
        days,
        totals: {
            practiceDays: practiced,
            speaking: attempts.filter((x) => x.kind === 'speaking').length,
            writing: attempts.filter((x) => x.kind === 'writing').length,
            reviews: [...reviews.values()].reduce((s, n) => s + n, 0),
            selfStudyMinutes: checkins.reduce((s, x) => s + (x.minutes ?? 0), 0),
        },
    }
}

export const checkinInputSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    kind: z.enum(['book', 'listening', 'reading', 'vocab', 'grammar', 'other']),
    minutes: z
        .number()
        .int()
        .min(1)
        .max(24 * 60)
        .nullish(),
    note: z.string().trim().max(500).default(''),
})
export type CheckinInput = z.infer<typeof checkinInputSchema>

const assertNotFuture = (date: string) => {
    if (date > dayKey(Date.now()))
        throw createError({ statusCode: 400, statusMessage: 'Không điểm danh cho ngày chưa tới' })
}

export const createCheckin = async (input: CheckinInput) => {
    assertNotFuture(input.date)
    const [row] = await useDb()
        .insert(c)
        .values({
            id: randomUUID(),
            date: input.date,
            kind: input.kind,
            minutes: input.minutes ?? null,
            note: input.note,
            createdAt: Date.now(),
        })
        .returning()
    return row!
}

export const updateCheckin = async (id: string, input: Partial<CheckinInput>) => {
    if (input.date) assertNotFuture(input.date)
    const [row] = await useDb().update(c).set(input).where(eq(c.id, id)).returning()
    if (!row) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy lần điểm danh' })
    return row
}

export const deleteCheckin = async (id: string) => {
    await useDb().delete(c).where(eq(c.id, id))
}
