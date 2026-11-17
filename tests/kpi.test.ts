import { describe, expect, it } from 'vitest'
import { countFillers, countWords, errorsPer100Words, wordsPerMinute } from '../shared/utils/kpi'

describe('KPI', () => {
    it('đếm từ, tính cả từ có nháy và gạch nối', () => {
        expect(countWords("I don't know, it's a front-end bug.")).toBe(7)
        expect(countWords('   ')).toBe(0)
    })

    it('tốc độ nói = số từ ÷ phút', () => {
        expect(wordsPerMinute(150, 90)).toBe(100)
        expect(wordsPerMinute(10, 0)).toBeNull()
    })

    it('đếm từ đệm, không đếm "like" nằm trong từ khác', () => {
        expect(countFillers('Um, I think, uh, you know, it is like... likely broken')).toBe(4)
    })

    it('lỗi trên 100 từ', () => {
        expect(errorsPer100Words(3, 150)).toBe(2)
        expect(errorsPer100Words(3, 0)).toBeNull()
    })
})
