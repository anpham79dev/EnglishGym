import { z } from 'zod'
import { MAX_PASTED_JSON_CHARS, MAX_WRITING_CHARS } from '#shared/constants/app'
import { submitAttempt } from '../../services/attemptService'
import { gradeWithGemini } from '../../services/geminiService'
import { offlineGrader } from '../../services/gradeModes'
import { topicText } from '../../services/topicService'

const bodySchema = z.object({
    clientAttemptId: z.uuid(),
    topicId: z.string().min(1).nullable(),
    attemptGroupId: z.string().min(1).nullish(),
    text: z.string().trim().min(10).max(MAX_WRITING_CHARS),
    /** ai = Gemini (default), manual = self-review, pasted = JSON from another AI. */
    mode: z.enum(['ai', 'manual', 'pasted']).default('ai'),
    pastedJson: z.string().max(MAX_PASTED_JSON_CHARS).nullish(),
    timedResult: z.enum(['in_time', 'overtime']).nullish(),
})

export default defineEventHandler(async (event) => {
    const { mode, pastedJson, ...body } = await parseBody(event, bodySchema)

    if (mode !== 'ai') {
        const { source, grade } = offlineGrader('writing', mode, { pastedJson })
        return submitAttempt({ kind: 'writing', ...body, source }, grade)
    }

    const topic = await topicText(body.topicId)
    return submitAttempt({ kind: 'writing', ...body, source: 'gemini' }, () =>
        gradeWithGemini(
            { kind: 'writing', topic, text: body.text },
            { beforeCall: consumeGeminiQuota },
        ),
    )
})
