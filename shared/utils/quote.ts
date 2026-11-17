/**
 * Locate an AI quote in the source text. Only whitespace runs and curly/straight
 * quotes are ignored; case and punctuation must match.
 */
const QUOTE_MAP: Record<string, string> = {
    '\u2018': "'",
    '\u2019': "'",
    '\u201B': "'",
    '\u2032': "'",
    '\u201C': '"',
    '\u201D': '"',
    '\u2033': '"',
}

interface Normalized {
    text: string
    /** map[i] = source index of normalized char i */
    map: number[]
}

const normalize = (input: string): Normalized => {
    let text = ''
    const map: number[] = []
    let prevSpace = false
    for (let i = 0; i < input.length; i++) {
        const ch = input[i]!
        if (/\s/.test(ch)) {
            if (prevSpace) continue
            text += ' '
            map.push(i)
            prevSpace = true
            continue
        }
        text += QUOTE_MAP[ch] ?? ch
        map.push(i)
        prevSpace = false
    }
    return { text, map }
}

export interface QuoteMatch {
    start: number
    end: number
}

export const findQuote = (source: string, quote: string): QuoteMatch | null => {
    const q = quote.trim()
    if (!q || !source) return null

    const exact = source.indexOf(q)
    if (exact >= 0) return { start: exact, end: exact + q.length }

    const ns = normalize(source)
    const nq = normalize(q).text.trim()
    if (!nq) return null
    const idx = ns.text.indexOf(nq)
    if (idx < 0) return null
    const start = ns.map[idx]!
    const end = ns.map[idx + nq.length - 1]! + 1
    return { start, end }
}

export const quoteExists = (source: string, quote: string) => findQuote(source, quote) !== null

export interface TextSegment {
    text: string
    issueIndex: number | null
}

/**
 * Split text into highlight segments. Unmatched or overlapping quotes are skipped.
 */
export const segmentText = (
    source: string,
    quotes: { index: number; quote: string }[],
): TextSegment[] => {
    const ranges = quotes
        .map((q) => ({ index: q.index, m: findQuote(source, q.quote) }))
        .filter((r): r is { index: number; m: QuoteMatch } => r.m !== null)
        .sort((a, b) => a.m.start - b.m.start)

    const segments: TextSegment[] = []
    let cursor = 0
    for (const r of ranges) {
        if (r.m.start < cursor) continue
        if (r.m.start > cursor)
            segments.push({ text: source.slice(cursor, r.m.start), issueIndex: null })
        segments.push({ text: source.slice(r.m.start, r.m.end), issueIndex: r.index })
        cursor = r.m.end
    }
    if (cursor < source.length) segments.push({ text: source.slice(cursor), issueIndex: null })
    return segments
}

export interface IssueAssessment {
    /** Quote exists in the source. */
    matched: boolean
    /** Suspiciously long quote: likely a rewrite. */
    tooLong: boolean
    /** Pre-check only matched, non-rewrite issues. */
    defaultChecked: boolean
}

export const assessIssue = (source: string, quote: string): IssueAssessment => {
    const matched = quoteExists(source, quote)
    const tooLong = source.length > 80 && quote.trim().length > source.trim().length * 0.5
    return { matched, tooLong, defaultChecked: matched && !tooLong }
}
