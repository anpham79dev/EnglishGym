import { eq } from 'drizzle-orm'
import { useDb, schema } from '../db'
import { apiError } from './http'
import { DAY_MS, hitCounter } from './rateLimit'

/** Enforce GEMINI_DAILY_LIMIT before calling Gemini. */
export const consumeGeminiQuota = async () => {
    const limit = Number(process.env.GEMINI_DAILY_LIMIT || 40)
    const used = await hitCounter('gemini:day', DAY_MS)
    if (used > limit)
        throw apiError(
            429,
            'DAILY_LIMIT',
            `Đã dùng hết ${limit} lượt chấm hôm nay. Dùng Copy prompt.`,
        )
}

export const topicText = async (topicId: string | null) => {
    if (!topicId) return 'Free topic'
    const topic = await useDb().query.topics.findFirst({ where: eq(schema.topics.id, topicId) })
    if (!topic) throw apiError(400, 'AI_ERROR', 'Đề không tồn tại')
    return `${topic.title}. ${topic.prompt}`
}
