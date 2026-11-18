import type { AttemptKind, AttemptSource } from '#shared/types'

export interface WeekStats {
    week: string
    practiceDays: number
    speaking: number
    writing: number
    errorsPer100: number | null
    otherAttempts: number
    otherErrorsPer100: number | null
    wpm: number | null
    focusLabel: string | null
    focusPer100: number | null
    reviews: number
    retention: number | null
    quizScore: number | null
    selfFoundRate: number | null
    versions: string[]
}

export interface BenchmarkMonth {
    month: string
    attempts: {
        id: string
        kind: AttemptKind
        createdAt: number
        topicTitle: string | null
        source: AttemptSource
        words: number
        wpm: number | null
        errorsPer100: number | null
    }[]
}

export const fetchStats = (weeks = 12, checkins = true) =>
    $fetch<{ weeks: WeekStats[]; benchmarks: BenchmarkMonth[] }>('/api/stats', {
        query: { weeks, checkins },
    })
