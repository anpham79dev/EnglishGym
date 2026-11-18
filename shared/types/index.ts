import type { ISSUE_CATEGORIES } from '../constants/app'

export type AttemptKind = 'speaking' | 'writing'
export type AttemptStatus = 'processing' | 'needs_review' | 'confirmed' | 'failed'
/** gemini = graded by Gemini; manual = self-review, no AI; pasted = JSON from another AI. */
export type AttemptSource = 'gemini' | 'manual' | 'pasted'
/** How the client wants an attempt graded. */
export type SubmitMode = 'ai' | 'manual' | 'pasted'
export type CheckinKind = 'book' | 'listening' | 'reading' | 'vocab' | 'grammar' | 'other'
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
    tags: string
    createdAt: number
    prepS: number | null
    responseS: number | null
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
    /** When the row last entered `processing` (ms); used to detect stuck grading. */
    processingAt: number | null
    source: AttemptSource
    isBenchmark: boolean
    selfMarkedCount: number | null
    timedResult: 'in_time' | 'overtime' | null
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
    note: string
}

export interface MistakeHit {
    id: string
    mistakeId: string
    attemptId: string
    issueIndex: number
    originalQuote: string
    correction: string
    selfFound: boolean
}

export interface MistakeWithHits extends Mistake {
    hits: (MistakeHit & { kind: AttemptKind; createdAt: number })[]
}

/** An issue approved by the user on confirm. */
export interface ConfirmIssue {
    issueIndex: number
    originalQuote: string
    correction: string
    patternKey: string
    labelVi: string
    category: string
    /** N9: marked by the user before seeing AI suggestions. */
    selfFound?: boolean
}

export interface ConfirmBody {
    finalTranscript?: string
    selfRating?: number | null
    fillerCount?: number | null
    /** N9: number of spots marked in the self-find step; omitted when skipped. */
    selfMarkedCount?: number | null
    issues: ConfirmIssue[]
}

export interface Checkin {
    id: string
    date: string
    kind: CheckinKind
    minutes: number | null
    note: string
    createdAt: number
}

/** Error codes; the client uses them to decide on "Copy prompt". */
export type ApiErrorCode =
    | 'QUOTA'
    | 'DAILY_LIMIT'
    | 'INVALID_AI'
    | 'AI_ERROR'
    | 'AI_TIMEOUT'
    | 'IN_PROGRESS'
    | 'TOO_LARGE'
    | 'BAD_MIME'
    | 'RATE_LIMIT'
    | 'BAD_JSON'
