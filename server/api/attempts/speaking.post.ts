import { z } from 'zod'
import {
    ALLOWED_AUDIO_MIME,
    MAX_AUDIO_BYTES,
    MAX_PASTED_JSON_CHARS,
    MAX_RECORD_SECONDS,
    MAX_WRITING_CHARS,
    baseMime,
} from '#shared/constants/app'
import { submitAttempt } from '../../services/attemptService'
import { gradeWithGemini } from '../../services/geminiService'
import { offlineGrader } from '../../services/gradeModes'
import { topicText } from '../../services/topicService'

const fieldsSchema = z.object({
    clientAttemptId: z.uuid(),
    topicId: z.string().min(1).nullable(),
    attemptGroupId: z.string().min(1).nullish(),
    /** Only needed for AI grading; self-review and pasted JSON send no audio. */
    mimeType: z.string().min(1).max(100).nullish(),
    /** Missing when the recording is not on this device (then no speaking rate). */
    durationS: z.coerce
        .number()
        .int()
        .min(1)
        .max(MAX_RECORD_SECONDS + 10)
        .nullish(),
    mode: z.enum(['ai', 'manual', 'pasted']).default('ai'),
    transcript: z.string().max(MAX_WRITING_CHARS).nullish(),
    pastedJson: z.string().max(MAX_PASTED_JSON_CHARS).nullish(),
    timedResult: z.enum(['in_time', 'overtime']).nullish(),
})

export default defineEventHandler(async (event) => {
    const len = Number(getHeader(event, 'content-length') || 0)
    if (len > MAX_AUDIO_BYTES + 64 * 1024)
        throw apiError(413, 'TOO_LARGE', 'File audio quá 3 MB, hãy nói ngắn hơn')

    const parts = (await readMultipartFormData(event)) ?? []
    const fields: Record<string, string | null> = {}
    let audio: Buffer | undefined
    for (const p of parts) {
        if (p.name === 'audio') audio = p.data
        else if (p.name) fields[p.name] = p.data.toString('utf8') || null
    }
    const parsed = fieldsSchema.safeParse(fields)
    if (!parsed.success) throw validationError(parsed.error.issues)
    const { mode, transcript, pastedJson, ...body } = parsed.data

    if (mode !== 'ai') {
        const { source, grade } = offlineGrader('speaking', mode, { transcript, pastedJson })
        return submitAttempt({ kind: 'speaking', ...body, source }, grade)
    }

    if (!audio?.length) throw createError({ statusCode: 400, statusMessage: 'Thiếu file audio' })
    if (audio.length > MAX_AUDIO_BYTES)
        throw apiError(413, 'TOO_LARGE', 'File audio quá 3 MB, hãy nói ngắn hơn')
    if (!body.mimeType) throw createError({ statusCode: 400, statusMessage: 'Thiếu mimeType' })

    const mime = baseMime(body.mimeType)
    if (!(ALLOWED_AUDIO_MIME as readonly string[]).includes(mime)) {
        console.warn('[speaking] MIME bị từ chối:', body.mimeType)
        throw apiError(415, 'BAD_MIME', `Định dạng ${body.mimeType} chưa được hỗ trợ`)
    }

    const topic = await topicText(body.topicId)
    return submitAttempt({ kind: 'speaking', ...body, source: 'gemini' }, () =>
        gradeWithGemini(
            { kind: 'speaking', topic, audio: audio!, mimeType: mime },
            { beforeCall: consumeGeminiQuota },
        ),
    )
})
