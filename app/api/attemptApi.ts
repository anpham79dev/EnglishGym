import type { Attempt, AttemptKind, ConfirmBody, Mistake, Topic } from '#shared/types'

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
}

export const fetchTopics = (kind?: AttemptKind) =>
    $fetch<Topic[]>('/api/topics', { query: { kind } })

export const fetchToday = (from: number, day: number) =>
    $fetch<TodaySummary>('/api/today', { query: { from, day } })

export const fetchAttempts = (query: { kind?: AttemptKind; from?: number; to?: number } = {}) =>
    $fetch<AttemptListItem[]>('/api/attempts', { query })

export const fetchAttempt = (id: string) => $fetch<AttemptDetail>(`/api/attempts/${id}`)

export const submitWriting = (body: {
    clientAttemptId: string
    topicId: string | null
    attemptGroupId?: string | null
    text: string
}) => $fetch<Attempt>('/api/attempts/writing', { method: 'POST', body })

export const submitSpeaking = (input: {
    clientAttemptId: string
    topicId: string | null
    attemptGroupId?: string | null
    mimeType: string
    durationS: number
    blob: Blob
}) => {
    const form = new FormData()
    form.append('clientAttemptId', input.clientAttemptId)
    form.append('topicId', input.topicId ?? '')
    form.append('attemptGroupId', input.attemptGroupId ?? '')
    form.append('mimeType', input.mimeType)
    form.append('durationS', String(Math.max(1, Math.round(input.durationS))))
    form.append('audio', input.blob, `audio.${input.mimeType.includes('mp4') ? 'm4a' : 'webm'}`)
    return $fetch<Attempt>('/api/attempts/speaking', {
        method: 'POST',
        body: form,
        timeout: 90_000,
    })
}

export const confirmAttempt = (id: string, body: ConfirmBody) =>
    $fetch<Attempt>(`/api/attempts/${id}/confirm`, { method: 'POST', body })
