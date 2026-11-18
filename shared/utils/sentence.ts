import { findQuote } from './quote'

export interface SentenceContext {
    before: string
    quote: string
    after: string
}

/**
 * The sentence of `text` that contains `quote`, split around the quote so the UI can
 * highlight it. Null when the quote is not in the text (edited transcript, manual issue).
 */
export const sentenceAround = (
    text: string | null | undefined,
    quote: string,
): SentenceContext | null => {
    if (!text) return null
    const m = findQuote(text, quote)
    if (!m) return null
    const boundary = /[.!?\n]/
    let start = m.start
    while (start > 0 && !boundary.test(text[start - 1]!)) start--
    let end = m.end
    while (end < text.length && !boundary.test(text[end]!)) end++
    if (end < text.length && text[end] !== '\n') end++ // keep the closing punctuation
    return {
        before: text.slice(start, m.start).trimStart(),
        quote: text.slice(m.start, m.end),
        after: text.slice(m.end, end).trimEnd(),
    }
}
