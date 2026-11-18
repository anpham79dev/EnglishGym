import type { Attempt, AttemptKind, ConfirmBody, Mistake, SubmitMode, Topic } from '#shared/types'
import type { StreakSummary } from '#shared/utils/streak'

export interface AttemptDetail {
    attempt: Attempt
    topic: Topic | null
    hits: {
        issueIndex: number
        originalQuote: string
        correction: string
        patternKey: string
        labelVi: string
    }[]
}

export interface AttemptListItem {
    id: string
    kind: AttemptKind
    topicId: string | null
    topicTitle: string | null
    attemptGroupId: string
    version: number
    status: Attempt['status']
    durationS: number | null
    createdAt: number
}

export interface TodaySummary {
    speakingTopic: Topic | null
    writingTopic: Topic | null
    done: { speaking: number; writing: number }
    submittedToday: number
    focus: Mistake | null
    pendingReview: { id: string; kind: AttemptKind }[]
    geminiUsedToday: number
    geminiDailyLimit: number
    model: string
    /** Estimated JSON export size; above MAX_BACKUP_BYTES use npm run db:backup. */
    backupBytes: number
    streak: StreakSummary
    /** N5: review cards due now. */
    dueCards: number
    /** N6: a weekly quiz was finished since Monday. */
    quizDoneThisWeek: boolean
    /** N7: this month's benchmark per kind and the topic to use. */
    benchmark: { kind: AttemptKind; done: boolean; topicId: string | null }[]
}

/** How to grade a submit: Gemini (default), self-review, or JSON pasted from another AI. */
export interface GradeChoice {
    mode: SubmitMode
    pastedJson?: string
    /** Self-review of a speaking attempt: the transcript typed by the user. */
    transcript?: string
}

export const fetchToday = (from: number, day: number, checkins = true) =>
    $fetch<TodaySummary>('/api/today', { query: { from, day, checkins } })

export const fetchAttempts = (query: { kind?: AttemptKind; from?: number; to?: number } = {}) =>
    $fetch<AttemptListItem[]>('/api/attempts', { query })

export const fetchAttempt = (id: string) => $fetch<AttemptDetail>(`/api/attempts/${id}`)

export const submitWriting = (body: {
    clientAttemptId: string
    topicId: string | null
    attemptGroupId?: string | null
    text: string
    choice?: GradeChoice
    timedResult?: 'in_time' | 'overtime' | null
}) => {
    const { choice, ...rest } = body
    return $fetch<Attempt>('/api/attempts/writing', {
        method: 'POST',
        body: { ...rest, mode: choice?.mode ?? 'ai', pastedJson: choice?.pastedJson },
    })
}

export const submitSpeaking = (input: {
    clientAttemptId: string
    topicId: string | null
    attemptGroupId?: string | null
    mimeType: string
    durationS: number
    blob: Blob
    choice?: GradeChoice
    timed?: boolean
}) => {
    const mode = input.choice?.mode ?? 'ai'
    const form = new FormData()
    form.append('clientAttemptId', input.clientAttemptId)
    form.append('topicId', input.topicId ?? '')
    form.append('attemptGroupId', input.attemptGroupId ?? '')
    form.append('mimeType', input.mimeType)
    form.append('durationS', String(Math.max(1, Math.round(input.durationS))))
    form.append('mode', mode)
    // N8: the recorder stops at the response time, so a timed answer is always in time.
    if (input.timed) form.append('timedResult', 'in_time')
    if (input.choice?.pastedJson) form.append('pastedJson', input.choice.pastedJson)
    if (input.choice?.transcript) form.append('transcript', input.choice.transcript)
    // Audio is only uploaded for AI grading; it is never stored on the server.
    if (mode === 'ai')
        form.append('audio', input.blob, `audio.${input.mimeType.includes('mp4') ? 'm4a' : 'webm'}`)
    return $fetch<Attempt>('/api/attempts/speaking', {
        method: 'POST',
        body: form,
        timeout: 90_000,
    })
}

export const confirmAttempt = (id: string, body: ConfirmBody) =>
    $fetch<Attempt>(`/api/attempts/${id}/confirm`, { method: 'POST', body })

export interface AttemptGroup {
    groupId: string
    topic: Topic | null
    versions: (Attempt & {
        hits: { originalQuote: string; correction: string; patternKey: string; labelVi: string }[]
    })[]
}

export const fetchAttemptGroup = (groupId: string) =>
    $fetch<AttemptGroup>(`/api/attempts/groups/${groupId}`)
