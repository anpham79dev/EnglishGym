import { findQuote } from './quote'

export interface Token {
    text: string
    start: number
    end: number
    /** false for whitespace runs */
    word: boolean
}

/** Words and whitespace runs, with offsets into `text`, for tap-to-mark on a phone. */
export const tokenize = (text: string): Token[] =>
    [...text.matchAll(/\s+|[^\s]+/g)].map((m) => ({
        text: m[0],
        start: m.index!,
        end: m.index! + m[0].length,
        word: !/^\s/.test(m[0]),
    }))

export interface Span {
    start: number
    end: number
    quote: string
}

/** Consecutive marked words (only whitespace between them) become one span. */
export const markedSpans = (text: string, tokens: Token[], marked: Set<number>): Span[] => {
    const spans: Span[] = []
    let current: { start: number; end: number } | null = null
    const flush = () => {
        if (current) spans.push({ ...current, quote: text.slice(current.start, current.end) })
        current = null
    }
    tokens.forEach((t, i) => {
        if (!t.word) return
        if (!marked.has(i)) return flush()
        if (current) current.end = t.end
        else current = { start: t.start, end: t.end }
    })
    flush()
    return spans
}

const overlaps = (a: { start: number; end: number }, b: { start: number; end: number }) =>
    a.start < b.end && b.start < a.end

/**
 * Compare the user's marks with AI issues (N9): an AI issue overlapping a mark is "found by
 * you"; a mark no AI issue covers becomes a suggested manual issue.
 */
export const matchMarks = (text: string, spans: Span[], quotes: string[]) => {
    const locations = quotes.map((q) => findQuote(text, q))
    const found = locations.map((loc) => !!loc && spans.some((s) => overlaps(s, loc)))
    const unmatched = spans.filter((s) => !locations.some((loc) => loc && overlaps(s, loc)))
    return { found, unmatched }
}
