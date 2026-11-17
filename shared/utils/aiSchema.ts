import { z } from 'zod'
import { ISSUE_CATEGORIES } from '../constants/app'

export const aiIssueSchema = z.object({
    original_quote: z.string().min(1),
    suggested_correction: z.string(),
    reason_vi: z.string(),
    category: z.enum(ISSUE_CATEGORIES),
    pattern_key_suggestion: z.string(),
})

export const writingResultSchema = z.object({
    issues: z.array(aiIssueSchema).max(30),
    focus_pattern_suggestion: z.string(),
})

export const speakingResultSchema = writingResultSchema.extend({
    transcript: z.string().min(1),
})

/** JSON Schema for Gemini `responseJsonSchema`, minus unsupported keys. */
export const toGeminiSchema = (schema: z.ZodType): Record<string, unknown> => {
    const strip = (node: unknown): unknown => {
        if (Array.isArray(node)) return node.map(strip)
        if (node && typeof node === 'object') {
            const out: Record<string, unknown> = {}
            for (const [k, v] of Object.entries(node)) {
                if (k === '$schema' || k === 'additionalProperties') continue
                out[k] = strip(v)
            }
            return out
        }
        return node
    }
    return strip(z.toJSONSchema(schema)) as Record<string, unknown>
}
