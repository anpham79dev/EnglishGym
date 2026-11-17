import { eq } from 'drizzle-orm'
import { useDb, schema } from '../../db'
import { getAttempt } from '../../services/attemptService'

export default defineEventHandler(async (event) => {
    const attempt = await getAttempt(requireParam(event, 'id'))
    if (!attempt) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy lượt nộp' })

    const db = useDb()
    const topic = attempt.topicId
        ? await db.query.topics.findFirst({ where: eq(schema.topics.id, attempt.topicId) })
        : null
    const hits = await db
        .select({
            issueIndex: schema.mistakeHits.issueIndex,
            originalQuote: schema.mistakeHits.originalQuote,
            correction: schema.mistakeHits.correction,
            patternKey: schema.mistakes.patternKey,
            labelVi: schema.mistakes.labelVi,
        })
        .from(schema.mistakeHits)
        .innerJoin(schema.mistakes, eq(schema.mistakes.id, schema.mistakeHits.mistakeId))
        .where(eq(schema.mistakeHits.attemptId, attempt.id))

    return { attempt, topic: topic ?? null, hits }
})
