import { createError } from 'h3'
import { randomUUID } from 'node:crypto'
import { and, asc, count, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import { DefaultScheduler } from 'ts-fsrs'
// Relative imports only: scripts/backfill-cards.ts and the backup scripts load this outside Nuxt.
import { MAX_ACTIVE_CARDS_PER_MISTAKE } from '../../shared/constants/app'
import { sentenceAround } from '../../shared/utils/sentence'
import { useDb, schema, type Db, type Tx } from '../db'

const c = schema.cards
const h = schema.mistakeHits
const m = schema.mistakes
const a = schema.attempts
const l = schema.reviewLogs

type Scheduler = Awaited<ReturnType<typeof DefaultScheduler>>
type FsrsCard = ReturnType<Scheduler['newCard']>
type FsrsCardInput = Parameters<Scheduler['review']>[0]['card']
type CardRow = typeof c.$inferSelect

let _scheduler: Promise<Scheduler> | undefined
/** FSRS-7 with the library defaults (90 % retention); no fuzz so tests are deterministic. */
const scheduler = () => (_scheduler ??= DefaultScheduler({ enableFuzz: false }))

const toFsrs = (row: CardRow): FsrsCardInput =>
    ({
        cardId: row.id,
        dueAt: new Date(row.dueAt),
        lastReviewAt: row.lastReviewAt === null ? null : new Date(row.lastReviewAt),
        stability: row.stability,
        stabilityFast: row.stabilityFast,
        difficulty: row.difficulty,
        state: row.state,
        scheduleStatus: row.scheduleStatus,
        reps: row.reps,
        lapses: row.lapses,
        scheduledDays: row.scheduledDays,
        learningStep: row.learningStep,
    }) as unknown as FsrsCardInput

const fromFsrs = (card: FsrsCard) => {
    const x = card as unknown as {
        dueAt: Date
        lastReviewAt: Date | null
        stability: number
        stabilityFast?: number
        difficulty: number
        state: number
        scheduleStatus: string
        reps: number
        lapses: number
        scheduledDays: number
        learningStep: number
    }
    return {
        dueAt: x.dueAt.getTime(),
        lastReviewAt: x.lastReviewAt ? x.lastReviewAt.getTime() : null,
        stability: x.stability,
        stabilityFast: x.stabilityFast ?? 0,
        difficulty: x.difficulty,
        state: x.state,
        scheduleStatus: x.scheduleStatus,
        reps: x.reps,
        lapses: x.lapses,
        scheduledDays: x.scheduledDays,
        learningStep: x.learningStep,
    }
}

/** New cards for freshly confirmed hits; only reviewed mistakes ever become cards. */
export const createCardsForHits = async (tx: Tx | Db, hitIds: string[], now = Date.now()) => {
    if (!hitIds.length) return
    const s = await scheduler()
    for (const hitId of hitIds) {
        const card = s.newCard({ now: new Date(now) })
        await tx
            .insert(c)
            .values({
                id: randomUUID(),
                hitId,
                createdAt: now,
                suspended: false,
                ...fromFsrs(card),
            })
            .onConflictDoNothing()
    }
}

/**
 * Keep at most MAX_ACTIVE_CARDS_PER_MISTAKE active cards per pattern (the most recent hits),
 * so one frequent mistake cannot fill a whole session. Run after confirm, merge and split.
 */
export const rebalanceCards = async (tx: Tx | Db, mistakeId: string) => {
    const rows = await tx
        .select({ id: c.id, suspended: c.suspended })
        .from(c)
        .innerJoin(h, eq(h.id, c.hitId))
        .innerJoin(a, eq(a.id, h.attemptId))
        .where(eq(h.mistakeId, mistakeId))
        .orderBy(desc(a.createdAt), desc(h.issueIndex))
    for (const [i, row] of rows.entries()) {
        const suspended = i >= MAX_ACTIVE_CARDS_PER_MISTAKE
        if (row.suspended !== suspended)
            await tx.update(c).set({ suspended }).where(eq(c.id, row.id))
    }
}

/** Card with everything the review screen shows, plus the next due time per rating. */
const cardViews = async (rows: CardRow[]) => {
    if (!rows.length) return []
    const db = useDb()
    const info = await db
        .select({
            cardId: c.id,
            quote: h.originalQuote,
            correction: h.correction,
            attemptId: h.attemptId,
            mistakeId: m.id,
            labelVi: m.labelVi,
            patternKey: m.patternKey,
            note: m.note,
            kind: a.kind,
            text: a.finalTranscript,
            original: a.textOrTranscript,
        })
        .from(c)
        .innerJoin(h, eq(h.id, c.hitId))
        .innerJoin(m, eq(m.id, h.mistakeId))
        .innerJoin(a, eq(a.id, h.attemptId))
        .where(
            inArray(
                c.id,
                rows.map((r) => r.id),
            ),
        )
    const byId = new Map(info.map((i) => [i.cardId, i]))
    const s = await scheduler()
    const now = new Date()
    return rows.flatMap((row) => {
        const i = byId.get(row.id)
        if (!i) return []
        const next: Record<number, number> = {}
        for (const p of s.preview({ card: toFsrs(row) as never, now }))
            next[p.grade] = fromFsrs(p.card as FsrsCard).dueAt
        return [
            {
                id: row.id,
                dueAt: row.dueAt,
                state: row.state,
                reps: row.reps,
                lapses: row.lapses,
                quote: i.quote,
                correction: i.correction,
                labelVi: i.labelVi,
                patternKey: i.patternKey,
                note: i.note,
                kind: i.kind,
                attemptId: i.attemptId,
                mistakeId: i.mistakeId,
                context: sentenceAround(i.text ?? i.original, i.quote),
                /** ms timestamps keyed by rating 1–4 */
                next,
            },
        ]
    })
}
export type CardView = Awaited<ReturnType<typeof cardViews>>[number]

export const countDue = async (now = Date.now()) => {
    const [row] = await useDb()
        .select({ n: count() })
        .from(c)
        .where(and(eq(c.suspended, false), lte(c.dueAt, now)))
    return row?.n ?? 0
}

export const getDueCards = async (limit = 20) => {
    const now = Date.now()
    const rows = await useDb()
        .select()
        .from(c)
        .where(and(eq(c.suspended, false), lte(c.dueAt, now)))
        .orderBy(asc(c.dueAt))
        .limit(limit)
    return { total: await countDue(now), cards: await cardViews(rows) }
}

export const getCardViews = async (ids: string[]) => {
    if (!ids.length) return []
    const rows = await useDb().select().from(c).where(inArray(c.id, ids))
    const byId = new Map((await cardViews(rows)).map((v) => [v.id, v]))
    return ids.flatMap((id) => byId.get(id) ?? [])
}

/**
 * Grade a card on the server (never on the client, so two devices cannot overwrite each
 * other's schedule) and log the review. Quiz reviews also update the schedule: they are
 * real recalls.
 */
export const reviewCard = async (id: string, rating: 1 | 2 | 3 | 4, quizId?: string | null) => {
    const db = useDb()
    const row = await db.query.cards.findFirst({ where: eq(c.id, id) })
    if (!row) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy thẻ' })
    const s = await scheduler()
    const now = new Date()
    const result = s.review({ card: toFsrs(row) as never, grade: rating, now })
    const next = fromFsrs(result.card as FsrsCard)
    const before = fromFsrs(result.revlog as unknown as FsrsCard)
    await db.transaction(async (tx) => {
        await tx.update(c).set(next).where(eq(c.id, id))
        await tx.insert(l).values({
            id: randomUUID(),
            cardId: id,
            rating,
            state: before.state,
            scheduleStatus: before.scheduleStatus,
            dueAt: before.dueAt,
            stability: before.stability,
            stabilityFast: before.stabilityFast,
            difficulty: before.difficulty,
            scheduledDays: before.scheduledDays,
            learningStep: before.learningStep,
            lastReviewAt: before.lastReviewAt,
            reviewedAt: now.getTime(),
            isQuiz: !!quizId,
            quizId: quizId ?? null,
        })
    })
    return { id, dueAt: next.dueAt }
}

/** Reviews per app day in [from, to), for the calendar and streak. */
export const reviewTimes = async (from = 0, to = Number.MAX_SAFE_INTEGER) =>
    (
        await useDb()
            .select({ t: l.reviewedAt })
            .from(l)
            .where(and(gte(l.reviewedAt, from), lte(l.reviewedAt, to)))
    ).map((r) => r.t)
