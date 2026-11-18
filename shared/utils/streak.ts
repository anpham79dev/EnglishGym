import { APP_UTC_OFFSET_MIN, WEEKLY_GOAL_DAYS } from '../constants/app'

const DAY_MS = 24 * 60 * 60 * 1000
const OFFSET_MS = APP_UTC_OFFSET_MIN * 60 * 1000

/** "YYYY-MM-DD" of a timestamp in app time (Vietnam), same on server and client. */
export const dayKey = (ms: number) => new Date(ms + OFFSET_MS).toISOString().slice(0, 10)

/** Start (ms, UTC) of an app-time day key. */
export const dayStart = (key: string) => Date.parse(`${key}T00:00:00Z`) - OFFSET_MS

export const addDays = (key: string, n: number) =>
    new Date(Date.parse(`${key}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)

/** Monday of the week containing `key`. */
export const weekStart = (key: string) => {
    const dow = new Date(`${key}T00:00:00Z`).getUTCDay() // 0 = Sunday
    return addDays(key, -((dow + 6) % 7))
}

export interface StreakSummary {
    /** Consecutive practice days up to today (or yesterday if today has none yet). */
    current: number
    longest: number
    practicedToday: boolean
    /** Practice days in the current Monday–Sunday week. */
    weekDays: number
    weekGoal: number
    /** Consecutive weeks reaching the goal, ending with the last finished week (plus this week if already reached). */
    weekStreak: number
    /** The 7 days of the current week with a practiced flag. */
    week: { date: string; practiced: boolean }[]
}

export const summarizeStreak = (days: Iterable<string>, today: string): StreakSummary => {
    const set = new Set(days)
    const sorted = [...set].filter((d) => d <= today).sort()

    let longest = 0
    let run = 0
    let prev: string | null = null
    for (const d of sorted) {
        run = prev && addDays(prev, 1) === d ? run + 1 : 1
        longest = Math.max(longest, run)
        prev = d
    }

    const practicedToday = set.has(today)
    let current = 0
    for (let d = practicedToday ? today : addDays(today, -1); set.has(d); d = addDays(d, -1))
        current++

    const monday = weekStart(today)
    const week = Array.from({ length: 7 }, (_, i) => {
        const date = addDays(monday, i)
        return { date, practiced: set.has(date) }
    })
    const weekDays = week.filter((d) => d.practiced).length

    const daysInWeek = (start: string) =>
        Array.from({ length: 7 }, (_, i) => addDays(start, i)).filter((d) => set.has(d)).length
    let weekStreak = weekDays >= WEEKLY_GOAL_DAYS ? 1 : 0
    const earliest = sorted[0]
    for (let w = addDays(monday, -7); earliest && w >= weekStart(earliest); w = addDays(w, -7)) {
        if (daysInWeek(w) < WEEKLY_GOAL_DAYS) break
        weekStreak++
    }

    return {
        current,
        longest,
        practicedToday,
        weekDays,
        weekGoal: WEEKLY_GOAL_DAYS,
        weekStreak,
        week,
    }
}
