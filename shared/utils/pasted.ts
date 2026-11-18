import { ISSUE_CATEGORIES } from '../constants/app'
import type { AiResult, AttemptKind } from '../types'
import { speakingResultSchema, writingResultSchema } from './aiSchema'

export type PastedResult = { ok: true; result: AiResult } | { ok: false; errors: string[] }

/** Chat AIs usually wrap JSON in ```json fences or add a sentence around it. */
export const extractJson = (raw: string) => {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
    const body = (fenced ? fenced[1]! : raw).trim()
    const start = body.indexOf('{')
    const end = body.lastIndexOf('}')
    return start >= 0 && end > start ? body.slice(start, end + 1) : body
}

/**
 * Parse and validate JSON pasted from another AI with the same schema as Gemini's output.
 * Lenient only where it is safe: an unknown category becomes "other", a missing
 * focus suggestion becomes "".
 */
export const parsePastedResult = (raw: string, kind: AttemptKind): PastedResult => {
    let json: unknown
    try {
        json = JSON.parse(extractJson(raw))
    } catch {
        return { ok: false, errors: ['Không đọc được JSON. Hãy dán nguyên phần JSON AI trả về.'] }
    }
    if (json && typeof json === 'object' && !Array.isArray(json)) {
        const obj = json as Record<string, unknown>
        obj.focus_pattern_suggestion ??= ''
        if (Array.isArray(obj.issues))
            for (const it of obj.issues as Record<string, unknown>[])
                if (it && !(ISSUE_CATEGORIES as readonly unknown[]).includes(it.category))
                    it.category = 'other'
    }
    const schema = kind === 'speaking' ? speakingResultSchema : writingResultSchema
    const parsed = schema.safeParse(json)
    if (!parsed.success)
        return {
            ok: false,
            errors: parsed.error.issues
                .slice(0, 5)
                .map((i) => `${i.path.join('.') || '(gốc)'}: ${i.message}`),
        }
    return { ok: true, result: parsed.data as AiResult }
}
