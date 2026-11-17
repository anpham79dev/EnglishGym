import { z } from 'zod'
import {
    ALLOWED_AUDIO_MIME,
    MAX_AUDIO_BYTES,
    MAX_RECORD_SECONDS,
    baseMime,
} from '#shared/constants/app'
import { submitAttempt } from '../../services/attemptService'
import { gradeWithGemini } from '../../services/geminiService'

const fieldsSchema = z.object({
    clientAttemptId: z.uuid(),
    topicId: z.string().min(1).nullable(),
    attemptGroupId: z.string().min(1).nullish(),
    mimeType: z.string().min(1).max(100),
    durationS: z.coerce
        .number()
        .int()
        .min(1)
        .max(MAX_RECORD_SECONDS + 10),
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
    if (!parsed.success)
        throw createError({
            statusCode: 400,
            statusMessage: 'Dữ liệu không hợp lệ',
            data: parsed.error.issues,
        })
    const body = parsed.data

    if (!audio?.length) throw createError({ statusCode: 400, statusMessage: 'Thiếu file audio' })
    if (audio.length > MAX_AUDIO_BYTES)
        throw apiError(413, 'TOO_LARGE', 'File audio quá 3 MB, hãy nói ngắn hơn')

    const mime = baseMime(body.mimeType)
    if (!(ALLOWED_AUDIO_MIME as readonly string[]).includes(mime)) {
        console.warn('[speaking] MIME bị từ chối:', body.mimeType)
        throw apiError(415, 'BAD_MIME', `Định dạng ${body.mimeType} chưa được hỗ trợ`)
    }

    const topic = await topicText(body.topicId)
    return submitAttempt({ kind: 'speaking', ...body, mimeType: body.mimeType }, async () => {
        await consumeGeminiQuota()
        return gradeWithGemini({ kind: 'speaking', topic, audio: audio!, mimeType: mime })
    })
})
