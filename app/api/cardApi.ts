import type { AttemptKind } from '#shared/types'
import type { SentenceContext } from '#shared/utils/sentence'

export type Rating = 1 | 2 | 3 | 4

export interface CardView {
    id: string
    dueAt: number
    state: number
    reps: number
    lapses: number
    quote: string
    correction: string
    labelVi: string
    patternKey: string
    note: string
    kind: AttemptKind
    attemptId: string
    mistakeId: string
    context: SentenceContext | null
    /** Next due time (ms) for each rating. */
    next: Record<Rating, number>
}

export interface Quiz {
    id: string
    createdAt: number
    finishedAt: number | null
    score: number | null
    cards: CardView[]
    /** cardId -> rating given during this quiz */
    answered: Record<string, Rating>
}

export type QuizSummary = Pick<Quiz, 'id' | 'createdAt' | 'finishedAt' | 'score'>

export const fetchDueCards = (limit = 20) =>
    $fetch<{ total: number; cards: CardView[] }>('/api/cards/due', { query: { limit } })

export const reviewCard = (id: string, rating: Rating, quizId?: string) =>
    $fetch<{ id: string; dueAt: number }>(`/api/cards/${id}/review`, {
        method: 'POST',
        body: { rating, quizId },
    })

export const createQuiz = () => $fetch<Quiz>('/api/quizzes', { method: 'POST' })
export const fetchQuiz = (id: string) => $fetch<Quiz>(`/api/quizzes/${id}`)
export const finishQuiz = (id: string) =>
    $fetch<Quiz>(`/api/quizzes/${id}/finish`, { method: 'POST' })
export const fetchQuizzes = () => $fetch<QuizSummary[]>('/api/quizzes')
