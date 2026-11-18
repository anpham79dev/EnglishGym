import { createError } from 'h3'
import { randomUUID } from 'node:crypto'
import { and, desc, eq, gte } from 'drizzle-orm'
import { QUIZ_SIZE } from '#shared/constants/app'
import { useDb, schema } from '../db'
import { getCardViews } from './cardService'

const q = schema.quizzes
const DAY = 24 * 60 * 60 * 1000

/**
 * Pick the cards you get wrong most (N6), in priority order:
 * 1. "Again" ratings in the last 30 days
 * 2. pattern recurring in recent attempts (last 14 days)
 * 3. the weekly focus pattern
 * Ties go to the least stable card. Suspended cards are included: a quiz checks everything.
 */
export const pickQuizCards = async (now = Date.now()) => {
    const db = useDb()
    const cards = await db
        .select({
            id: schema.cards.id,
            stability: schema.cards.stability,
            mistakeId: schema.mistakeHits.mistakeId,
            isFocus: schema.mistakes.isFocus,
        })
        .from(schema.cards)
        .innerJoin(schema.mistakeHits, eq(schema.mistakeHits.id, schema.cards.hitId))
        .innerJoin(schema.mistakes, eq(schema.mistakes.id, schema.mistakeHits.mistakeId))

    const again = new Map<string, number>()
    for (const r of await db
        .select({ cardId: schema.reviewLogs.cardId })
        .from(schema.reviewLogs)
        .where(
            and(eq(schema.reviewLogs.rating, 1), gte(schema.reviewLogs.reviewedAt, now - 30 * DAY)),
        ))
        again.set(r.cardId, (again.get(r.cardId) ?? 0) + 1)

    const recent = new Map<string, number>()
    for (const r of await db
        .select({ mistakeId: schema.mistakeHits.mistakeId })
        .from(schema.mistakeHits)
        .innerJoin(schema.attempts, eq(schema.attempts.id, schema.mistakeHits.attemptId))
        .where(gte(schema.attempts.createdAt, now - 14 * DAY)))
        recent.set(r.mistakeId, (recent.get(r.mistakeId) ?? 0) + 1)

    return cards
        .map((card) => ({
            id: card.id,
            score:
                (again.get(card.id) ?? 0) * 100 +
                (recent.get(card.mistakeId) ?? 0) * 10 +
                (card.isFocus ? 5 : 0),
            stability: card.stability,
        }))
        .sort((x, y) => y.score - x.score || x.stability - y.stability)
        .slice(0, QUIZ_SIZE)
        .map((x) => x.id)
}

export const createQuiz = async () => {
    const cardIds = await pickQuizCards()
    if (!cardIds.length)
        throw createError({
            statusCode: 400,
            statusMessage: 'Chưa có thẻ nào. Duyệt vài bài để có lỗi trong sổ trước.',
        })
    const id = randomUUID()
    await useDb()
        .insert(q)
        .values({ id, createdAt: Date.now(), cardIds: JSON.stringify(cardIds) })
    return getQuiz(id)
}

/** Quiz with its cards and the rating already given to each (so a quiz can be resumed). */
export const getQuiz = async (id: string) => {
    const db = useDb()
    const quiz = await db.query.quizzes.findFirst({ where: eq(q.id, id) })
    if (!quiz) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy bài kiểm tra' })
    const answered: Record<string, number> = {}
    for (const r of await db
        .select({ cardId: schema.reviewLogs.cardId, rating: schema.reviewLogs.rating })
        .from(schema.reviewLogs)
        .where(eq(schema.reviewLogs.quizId, id)))
        answered[r.cardId] = r.rating
    return {
        ...quiz,
        cards: await getCardViews(JSON.parse(quiz.cardIds) as string[]),
        answered,
    }
}

/** Score = share of quiz cards answered Good or Easy. */
export const finishQuiz = async (id: string) => {
    const quiz = await getQuiz(id)
    const ratings = Object.values(quiz.answered)
    const total = quiz.cards.length || 1
    const score = ratings.filter((r) => r >= 3).length / total
    await useDb().update(q).set({ score, finishedAt: Date.now() }).where(eq(q.id, id))
    return { ...quiz, score, finishedAt: Date.now() }
}

export const listQuizzes = (limit = 20) =>
    useDb()
        .select({ id: q.id, createdAt: q.createdAt, finishedAt: q.finishedAt, score: q.score })
        .from(q)
        .orderBy(desc(q.createdAt))
        .limit(limit)
