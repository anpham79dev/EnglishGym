import type { ISSUE_CATEGORIES } from '../constants/app'

export type AttemptKind = 'speaking' | 'writing'
export type AttemptStatus = 'draft' | 'processing' | 'needs_review' | 'confirmed' | 'failed'
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number]

export interface AiIssue {
    original_quote: string
    suggested_correction: string
    reason_vi: string
    category: IssueCategory
    pattern_key_suggestion: string
}

export interface AiResult {
    transcript?: string
    issues: AiIssue[]
    focus_pattern_suggestion: string
}

export interface Topic {
    id: string
    kind: AttemptKind
    title: string
    prompt: string
    level: string
    active: boolean
}

export interface Attempt {
    id: string
    clientAttemptId: string
    kind: AttemptKind
    topicId: string | null
    attemptGroupId: string
    version: number
    status: AttemptStatus
    textOrTranscript: string | null
    finalTranscript: string | null
    durationS: number | null
    mimeType: string | null
    model: string | null
    promptVersion: string | null
    aiJson: string | null
    error: string | null
    selfRating: number | null
    fillerCount: number | null
    createdAt: number
    confirmedAt: number | null
}

export interface Mistake {
    id: string
    patternKey: string
    labelVi: string
    exampleWrong: string
    exampleRight: string
    category: string
    firstSeen: number
    lastSeen: number
    hitCount: number
    isFocus: boolean
}

export interface MistakeHit {
    id: string
    mistakeId: string
    attemptId: string
    issueIndex: number
    originalQuote: string
    correction: string
}

export interface MistakeWithHits extends Mistake {
    hits: (MistakeHit & { kind: AttemptKind; createdAt: number })[]
}

/** Một lỗi người dùng đã duyệt, gửi lên khi xác nhận. */
export interface ConfirmIssue {
    issueIndex: number
    originalQuote: string
    correction: string
    patternKey: string
    labelVi: string
    category: string
}

export interface ConfirmBody {
    finalTranscript?: string
    selfRating?: number | null
    fillerCount?: number | null
    issues: ConfirmIssue[]
}

/** Lỗi trả về khi gọi AI thất bại; client dùng `code` để hiện nút Copy prompt. */
export type ApiErrorCode =
    'QUOTA' | 'DAILY_LIMIT' | 'INVALID_AI' | 'AI_ERROR' | 'TOO_LARGE' | 'BAD_MIME' | 'RATE_LIMIT'
