import type { AttemptKind, Mistake, MistakeWithHits } from '#shared/types'

export interface MistakePatch {
    labelVi?: string
    patternKey?: string
    exampleWrong?: string
    exampleRight?: string
    isFocus?: boolean
    mergeIntoId?: string
    split?: { hitIds: string[]; patternKey: string; labelVi: string }
}

export const fetchMistakes = (kind?: AttemptKind) =>
    $fetch<MistakeWithHits[]>('/api/mistakes', { query: { kind } })

export const patchMistake = (id: string, body: MistakePatch) =>
    $fetch<Mistake | undefined>(`/api/mistakes/${id}`, { method: 'PATCH', body })
