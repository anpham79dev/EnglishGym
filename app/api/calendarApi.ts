import type { AttemptKind, Checkin, CheckinKind } from '#shared/types'

export interface CalendarDay {
    date: string
    speaking: number
    writing: number
    reviews: number
    attempts: { id: string; kind: AttemptKind; topicTitle: string | null; version: number }[]
    checkins: Checkin[]
}

export interface CalendarMonth {
    month: string
    today: string
    days: CalendarDay[]
    totals: {
        practiceDays: number
        speaking: number
        writing: number
        reviews: number
        selfStudyMinutes: number
    }
}

export interface CheckinInput {
    date: string
    kind: CheckinKind
    minutes?: number | null
    note?: string
}

export const fetchCalendar = (month: string) =>
    $fetch<CalendarMonth>('/api/calendar', { query: { month } })

export const createCheckin = (body: CheckinInput) =>
    $fetch<Checkin>('/api/checkins', { method: 'POST', body })

export const deleteCheckin = (id: string) => $fetch(`/api/checkins/${id}`, { method: 'DELETE' })
