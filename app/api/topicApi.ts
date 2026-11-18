import type { AttemptKind, Topic } from '#shared/types'

export interface TopicInput {
    kind: AttemptKind
    title: string
    prompt: string
    level?: string
    tags?: string
    active?: boolean
}

export interface TopicImportResult {
    added: number
    skipped: number
    invalid: string[]
}

/** Active topics only, unless `all` (topic bank page). */
export const fetchTopics = (kind?: AttemptKind, all = false) =>
    $fetch<Topic[]>('/api/topics', { query: { kind, all: all || undefined } })

export const createTopic = (body: TopicInput) =>
    $fetch<Topic>('/api/topics', { method: 'POST', body })

export const updateTopic = (id: string, body: Partial<TopicInput>) =>
    $fetch<Topic>(`/api/topics/${id}`, { method: 'PATCH', body })

export const deleteTopic = (id: string) => $fetch(`/api/topics/${id}`, { method: 'DELETE' })

export const importTopics = (format: 'json' | 'csv', content: string) =>
    $fetch<TopicImportResult>('/api/topics/import', { method: 'POST', body: { format, content } })
