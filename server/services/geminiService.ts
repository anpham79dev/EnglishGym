import { apiError } from '../utils/http'
import { ApiError, GoogleGenAI, type Part } from '@google/genai'
import type { z } from 'zod'
import { GEMINI_TIMEOUT_MS, PROMPT_VERSION } from '#shared/constants/app'
import type { AiResult } from '#shared/types'
import { speakingResultSchema, toGeminiSchema, writingResultSchema } from '#shared/utils/aiSchema'
import { buildSpeakingPrompt, buildWritingPrompt } from '#shared/utils/prompts'

let _client: GoogleGenAI | undefined

const client = () => {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw apiError(500, 'AI_ERROR', 'Chưa cấu hình GEMINI_API_KEY')
    return (_client ??= new GoogleGenAI({ apiKey }))
}

export const geminiModel = () => process.env.GEMINI_MODEL || 'gemini-flash-latest'

export interface GradeOutput {
    result: AiResult
    raw: string
    model: string
    promptVersion: string
}

type GradeInput =
    | { kind: 'writing'; topic: string; text: string }
    | { kind: 'speaking'; topic: string; audio: Buffer; mimeType: string }

const callOnce = async (parts: Part[], schema: z.ZodType) => {
    const res = await client().models.generateContent({
        model: geminiModel(),
        contents: [{ role: 'user', parts }],
        config: {
            temperature: 0.2,
            responseMimeType: 'application/json',
            responseJsonSchema: toGeminiSchema(schema),
            // Client-side cut-off so the function never hits Vercel's limit mid-request.
            abortSignal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
        },
    })
    const raw = res.text ?? ''
    let json: unknown
    try {
        json = JSON.parse(raw)
    } catch {
        return { raw, data: null }
    }
    const parsed = schema.safeParse(json)
    return { raw, data: parsed.success ? (parsed.data as AiResult) : null }
}

const isTimeout = (err: unknown) =>
    err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')

export interface GradeOptions {
    /** Runs before every Gemini request, retries included (daily quota). */
    beforeCall?: () => Promise<void>
}

/**
 * Call Gemini and validate with Zod. Invalid JSON is retried once;
 * 429 and timeouts are not retried.
 */
export const gradeWithGemini = async (
    input: GradeInput,
    { beforeCall }: GradeOptions = {},
): Promise<GradeOutput> => {
    const schema = input.kind === 'speaking' ? speakingResultSchema : writingResultSchema
    const parts: Part[] =
        input.kind === 'speaking'
            ? [
                  {
                      inlineData: {
                          mimeType: input.mimeType,
                          data: input.audio.toString('base64'),
                      },
                  },
                  { text: buildSpeakingPrompt(input.topic) },
              ]
            : [{ text: buildWritingPrompt(input.topic, input.text) }]

    const call = async () => {
        await beforeCall?.()
        return callOnce(parts, schema)
    }

    try {
        let out = await call()
        if (!out.data) out = await call()
        if (!out.data)
            throw apiError(502, 'INVALID_AI', 'AI trả về JSON sai cấu trúc 2 lần', {
                raw: out.raw.slice(0, 2000),
            })
        return {
            result: out.data,
            raw: out.raw,
            model: geminiModel(),
            promptVersion: PROMPT_VERSION,
        }
    } catch (err) {
        if (isTimeout(err))
            throw apiError(
                504,
                'AI_TIMEOUT',
                `Gemini không trả lời trong ${GEMINI_TIMEOUT_MS / 1000} giây. Gửi lại sau hoặc dùng Copy prompt.`,
            )
        if (err instanceof ApiError) {
            if (err.status === 429)
                throw apiError(429, 'QUOTA', 'Gemini hết quota. Dùng Copy prompt để chấm thủ công.')
            throw apiError(
                502,
                'AI_ERROR',
                `Gemini lỗi (${err.status}): ${err.message.slice(0, 300)}`,
            )
        }
        throw err
    }
}
