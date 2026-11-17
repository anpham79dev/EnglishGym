import type { AiResult, ConfirmBody, Mistake } from '#shared/types'
import { countFillers } from '#shared/utils/kpi'
import { toPatternKey } from '#shared/utils/patternKey'
import { assessIssue, quoteExists } from '#shared/utils/quote'
import type { AttemptDetail } from '~/api/attemptApi'

export interface EditableIssue {
    index: number
    quote: string
    correction: string
    reasonVi: string
    category: string
    patternKey: string
    labelVi: string
    checked: boolean
    matched: boolean
    tooLong: boolean
    manual: boolean
}

/** Manual issues start here to avoid clashing with AI indexes. */
const MANUAL_INDEX_BASE = 1000

const parseAi = (raw: string | null): AiResult | null => {
    if (!raw) return null
    try {
        return JSON.parse(raw) as AiResult
    } catch {
        return null
    }
}

/**
 * Review screen state. Only matched, non-rewrite issues are pre-checked.
 */
export const useReviewForm = (detail: AttemptDetail, known: Mistake[]) => {
    const { attempt } = detail
    const ai = parseAi(attempt.aiJson)
    const source = attempt.textOrTranscript ?? ''
    const knownByKey = new Map(known.map((m) => [m.patternKey, m]))

    const transcript = ref(source)
    const selfRating = ref<number | null>(null)
    const fillerCount = ref<number | null>(
        attempt.kind === 'speaking' ? countFillers(source) : null,
    )

    const issues = ref<EditableIssue[]>(
        (ai?.issues ?? []).map((it, index) => {
            const key = toPatternKey(it.pattern_key_suggestion || it.category)
            const existing = knownByKey.get(key)
            const a = assessIssue(source, it.original_quote)
            return {
                index,
                quote: it.original_quote,
                correction: it.suggested_correction,
                reasonVi: it.reason_vi,
                category: it.category,
                patternKey: key,
                labelVi: existing?.labelVi ?? it.reason_vi.slice(0, 120),
                checked: a.defaultChecked,
                matched: a.matched,
                tooLong: a.tooLong,
                manual: false,
            }
        }),
    )

    /** Re-match quotes on transcript edits without changing checkboxes. */
    watch(transcript, (text) => {
        for (const it of issues.value) it.matched = quoteExists(text, it.quote)
    })

    const addManual = () => {
        const next = Math.max(MANUAL_INDEX_BASE - 1, ...issues.value.map((i) => i.index)) + 1
        issues.value.push({
            index: next,
            quote: '',
            correction: '',
            reasonVi: 'Tự thêm',
            category: 'other',
            patternKey: '',
            labelVi: '',
            checked: true,
            matched: true,
            tooLong: false,
            manual: true,
        })
    }

    const removeIssue = (index: number) => {
        issues.value = issues.value.filter((i) => i.index !== index)
    }

    const checked = computed(() => issues.value.filter((i) => i.checked))

    const validationError = computed(() => {
        const bad = checked.value.find((i) => !i.quote.trim() || !i.patternKey.trim())
        return bad ? `Lỗi #${bad.index + 1} cần có đoạn sai và pattern_key` : null
    })

    const toBody = (): ConfirmBody => ({
        finalTranscript: attempt.kind === 'speaking' ? transcript.value : undefined,
        selfRating: selfRating.value,
        fillerCount: fillerCount.value,
        issues: checked.value.map((i) => ({
            issueIndex: i.index,
            originalQuote: i.quote.trim(),
            correction: i.correction.trim(),
            patternKey: i.patternKey,
            labelVi: i.labelVi.trim(),
            category: i.category,
        })),
    })

    return {
        ai,
        transcript,
        selfRating,
        fillerCount,
        issues,
        checked,
        validationError,
        addManual,
        removeIssue,
        toBody,
    }
}
