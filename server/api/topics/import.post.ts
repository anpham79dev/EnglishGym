import { z } from 'zod'
import { importTopics } from '../../services/topicService'

const bodySchema = z.object({
    format: z.enum(['json', 'csv']),
    content: z.string().min(1).max(1_000_000),
})

export default defineEventHandler(async (event) => {
    const { format, content } = await parseBody(event, bodySchema)
    return importTopics(format, content)
})
