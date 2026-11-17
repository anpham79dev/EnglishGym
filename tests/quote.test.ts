import { describe, expect, it } from 'vitest'
import { findQuote, segmentText } from '../shared/utils/quote'

describe('findQuote', () => {
    const src = 'Yesterday I  fix the bug in the login page. It don’t work.'

    it('khớp chính xác', () => {
        const m = findQuote(src, 'the login page')!
        expect(src.slice(m.start, m.end)).toBe('the login page')
    })

    it('bỏ qua khác biệt khoảng trắng và trả về vị trí gốc', () => {
        const m = findQuote(src, 'I fix the bug')!
        expect(src.slice(m.start, m.end)).toBe('I  fix the bug')
    })

    it('bỏ qua nháy cong/thẳng', () => {
        const m = findQuote(src, "It don't work")!
        expect(src.slice(m.start, m.end)).toBe('It don’t work')
    })

    it('không khớp khi khác chữ hoa/thường hoặc AI bịa đoạn trích', () => {
        expect(findQuote(src, 'yesterday i fix')).toBeNull()
        expect(findQuote(src, 'I fixed the bug')).toBeNull()
        expect(findQuote(src, '   ')).toBeNull()
    })
})

describe('segmentText', () => {
    it('tô các lỗi khớp, bỏ lỗi không khớp và lỗi chồng lấn', () => {
        const src = 'I fix it yesterday and he go home.'
        const segs = segmentText(src, [
            { index: 0, quote: 'I fix it' },
            { index: 1, quote: 'he go' },
            { index: 2, quote: 'not in text' },
            { index: 3, quote: 'fix it yesterday' },
        ])
        expect(segs.map((s) => s.text).join('')).toBe(src)
        expect(segs.filter((s) => s.issueIndex !== null).map((s) => s.issueIndex)).toEqual([0, 1])
    })
})
