import { FILLER_PHRASES } from '../constants/app'

export const countWords = (text: string): number => {
    const m = text.trim().match(/[A-Za-z0-9\u00C0-\u024F]+(?:['’-][A-Za-z0-9\u00C0-\u024F]+)*/g)
    return m ? m.length : 0
}

/** words ÷ minutes */
export const wordsPerMinute = (words: number, durationS: number): number | null => {
    if (!durationS || durationS <= 0) return null
    return Math.round((words / (durationS / 60)) * 10) / 10
}

/** Rough filler count; the user can correct it ("like" may be legit). */
export const countFillers = (text: string, phrases: string[] = FILLER_PHRASES): number => {
    const lower = ` ${text
        .toLowerCase()
        .replace(/[^a-z'\s]/g, ' ')
        .replace(/\s+/g, ' ')} `
    let total = 0
    for (const p of phrases) {
        const needle = ` ${p} `
        let from = 0
        while (true) {
            const i = lower.indexOf(needle, from)
            if (i < 0) break
            total++
            from = i + needle.length - 1
        }
    }
    return total
}

/** confirmed errors × 100 ÷ words */
export const errorsPer100Words = (errors: number, words: number): number | null => {
    if (!words) return null
    return Math.round(((errors * 100) / words) * 10) / 10
}
