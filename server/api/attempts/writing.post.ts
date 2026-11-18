import { z } from 'zod'
import { MAX_WRITING_CHARS } from '#shared/constants/app'
import { submitAttempt } from '../../services/attemptService'
import { gradeWithGemini } from '../../services/geminiService'
import { topicText } from '../../services/topicService'

const bodySchema = z.object({
    clientAttemptId: z.uuid(),
    topicId: z.string().min(1).nullable(),
    attemptGroupId: z.string().min(1).nullish(),
    text: z.string().trim().min(10).max(MAX_WRITING_CHARS),
})

export default defineEventHandler(async (event) => {
    const body = await parseBody(event, bodySchema)
    const topic = await topicText(body.topicId)

    return submitAttempt({ kind: 'writing', ...body }, () =>
        gradeWithGemini(
            { kind: 'writing', topic, text: body.text },
            { beforeCall: consumeGeminiQuota },
        ),
    )
})
