import { createError } from 'h3'
import { eq } from 'drizzle-orm'
import { topicToText } from '#shared/utils/prompts'
import { useDb, schema } from '../db'

/** Topic description for the grading prompt; an unknown id is a client error, not an AI error. */
export const topicText = async (topicId: string | null) => {
    if (!topicId) return topicToText(null)
    const topic = await useDb().query.topics.findFirst({ where: eq(schema.topics.id, topicId) })
    if (!topic) throw createError({ statusCode: 400, statusMessage: 'Đề không tồn tại' })
    return topicToText(topic)
}
