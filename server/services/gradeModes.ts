import { PROMPT_VERSION } from '#shared/constants/app'
import type { AttemptKind, AttemptSource, SubmitMode } from '#shared/types'
import { parsePastedResult } from '#shared/utils/pasted'
import { apiError } from '../utils/http'
import type { GradeOutput } from './geminiService'

/**
 * Graders that never call Gemini (N1, N2). Invalid pasted JSON is rejected before the
 * attempt row is touched, so a bad paste never turns an attempt into `failed`.
 */
export const offlineGrader = (
    kind: AttemptKind,
    mode: Exclude<SubmitMode, 'ai'>,
    input: { transcript?: string | null; pastedJson?: string | null },
): { source: AttemptSource; grade: () => Promise<GradeOutput> } => {
    if (mode === 'manual') {
        if (kind === 'speaking' && !input.transcript?.trim())
            throw apiError(400, 'BAD_JSON', 'Tự duyệt bài nói cần bản chép lời bạn tự gõ')
        return {
            source: 'manual',
            grade: async () => ({
                result: {
                    transcript: input.transcript?.trim() || undefined,
                    issues: [],
                    focus_pattern_suggestion: '',
                },
                raw: '',
                model: 'manual',
                promptVersion: PROMPT_VERSION,
            }),
        }
    }

    const raw = input.pastedJson ?? ''
    const parsed = parsePastedResult(raw, kind)
    if (!parsed.ok)
        throw apiError(400, 'BAD_JSON', `JSON chưa đúng: ${parsed.errors.join('; ')}`, {
            errors: parsed.errors,
        })
    return {
        source: 'pasted',
        grade: async () => ({
            result: parsed.result,
            // Kept verbatim for later comparison, like Gemini's raw output.
            raw,
            model: 'pasted',
            promptVersion: PROMPT_VERSION,
        }),
    }
}
