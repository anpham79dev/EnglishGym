import { describe, expect, it } from 'vitest'
import { markedSpans, matchMarks, tokenize } from '../shared/utils/selfFind'
import { wordDiff } from '../shared/utils/wordDiff'

const TEXT = 'Yesterday I fix the bug in the login page.'
const tokens = tokenize(TEXT)
const wordIndex = (w: string) => tokens.findIndex((t) => t.text === w)

describe('N9: tự tìm lỗi', () => {
    it('các từ liền nhau gộp thành một đoạn, từ rời là đoạn riêng', () => {
        const marked = new Set([wordIndex('I'), wordIndex('fix'), wordIndex('page.')])
        expect(markedSpans(TEXT, tokens, marked).map((s) => s.quote)).toEqual(['I fix', 'page.'])
    })

    it('lỗi AI chồng lấn chỗ đánh dấu là tự bắt được; chỗ đánh dấu thừa thành gợi ý', () => {
        const spans = markedSpans(TEXT, tokens, new Set([wordIndex('fix'), wordIndex('Yesterday')]))
        const res = matchMarks(TEXT, spans, ['I fix the bug', 'in the login page'])
        expect(res.found).toEqual([true, false])
        expect(res.unmatched.map((s) => s.quote)).toEqual(['Yesterday'])
    })

    it('đoạn trích AI không có trong bài thì không tính là tự bắt được', () => {
        const spans = markedSpans(TEXT, tokens, new Set([wordIndex('fix')]))
        expect(matchMarks(TEXT, spans, ['not in text']).found).toEqual([false])
    })
})

describe('N10: diff theo từ', () => {
    it('đánh dấu từ bị bỏ và từ thêm mới', () => {
        const parts = wordDiff('I fix the bug yesterday.', 'I fixed the bug yesterday.')
        expect(parts).toEqual([
            { type: 'same', text: 'I ' },
            { type: 'del', text: 'fix ' },
            { type: 'add', text: 'fixed ' },
            { type: 'same', text: 'the bug yesterday.' },
        ])
    })

    it('ghép lại phần same + add bằng đúng bản mới', () => {
        const b = 'We shipped it on Friday, then fixed two bugs.'
        const parts = wordDiff('We ship it Friday and fix bug.', b)
        expect(
            parts
                .filter((p) => p.type !== 'del')
                .map((p) => p.text)
                .join(''),
        ).toBe(b)
    })
})
