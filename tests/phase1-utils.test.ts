import { describe, expect, it } from 'vitest'
import { csvToObjects, parseCsv } from '../shared/utils/csv'
import { extractJson, parsePastedResult } from '../shared/utils/pasted'
import { addDays, dayKey, summarizeStreak, weekStart } from '../shared/utils/streak'

describe('parsePastedResult', () => {
    const json = JSON.stringify({
        issues: [
            {
                original_quote: 'I goed',
                suggested_correction: 'I went',
                reason_vi: 'quá khứ',
                category: 'verb-form',
                pattern_key_suggestion: 'irregular-past',
            },
        ],
    })

    it('bỏ khối ```json và câu dẫn quanh JSON', () => {
        expect(extractJson('Đây là kết quả:\n```json\n{"a":1}\n```\nChúc bạn học tốt')).toBe(
            '{"a":1}',
        )
    })

    it('nhóm lỗi lạ thành other, thiếu focus thành rỗng', () => {
        const r = parsePastedResult('```json\n' + json + '\n```', 'writing')
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.result.issues[0]!.category).toBe('other')
            expect(r.result.focus_pattern_suggestion).toBe('')
        }
    })

    it('bài nói bắt buộc có transcript', () => {
        const r = parsePastedResult(json, 'speaking')
        expect(r.ok).toBe(false)
        if (!r.ok) expect(r.errors.join()).toContain('transcript')
    })

    it('chuỗi không phải JSON báo lỗi dễ hiểu', () => {
        const r = parsePastedResult('xin chào', 'writing')
        expect(r.ok).toBe(false)
    })
})

describe('parseCsv', () => {
    it('ô trong ngoặc kép có dấu phẩy, ngoặc kép và xuống dòng', () => {
        const rows = parseCsv('kind,title,prompt\r\nwriting,"A, B","Say ""hi""\nthen go"\n')
        expect(rows).toEqual([
            ['kind', 'title', 'prompt'],
            ['writing', 'A, B', 'Say "hi"\nthen go'],
        ])
    })

    it('csvToObjects dùng header viết thường, bỏ BOM', () => {
        expect(csvToObjects('﻿Kind,Title\nspeaking,Intro')).toEqual([
            { kind: 'speaking', title: 'Intro' },
        ])
    })
})

describe('streak', () => {
    it('ngày theo giờ VN: 6h sáng VN là 23h hôm trước theo UTC', () => {
        expect(dayKey(Date.parse('2026-11-17T23:00:00Z'))).toBe('2026-11-18')
    })

    it('tuần bắt đầu thứ Hai, qua giao thừa', () => {
        expect(weekStart('2026-11-18')).toBe('2026-11-16')
        expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
        expect(weekStart('2027-01-01')).toBe('2026-12-28')
    })

    it('hôm nay chưa luyện thì chuỗi tính đến hôm qua', () => {
        const s = summarizeStreak(['2026-11-15', '2026-11-16', '2026-11-17'], '2026-11-18')
        expect(s.current).toBe(3)
        expect(s.practicedToday).toBe(false)
    })

    it('chuỗi đứt và chuỗi dài nhất', () => {
        const s = summarizeStreak(
            ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-17', '2026-11-18'],
            '2026-11-18',
        )
        expect(s.current).toBe(2)
        expect(s.longest).toBe(4)
    })

    it('chuỗi tuần đạt 5/7, cho nghỉ 2 ngày mỗi tuần', () => {
        // Two full weeks with 5 days each, current week 2 days so far.
        const days = [
            ...['02', '03', '04', '05', '06'].map((d) => `2026-11-${d}`),
            ...['09', '10', '12', '13', '15'].map((d) => `2026-11-${d}`),
            '2026-11-16',
            '2026-11-17',
        ]
        const s = summarizeStreak(days, '2026-11-18')
        expect(s.weekDays).toBe(2)
        expect(s.weekStreak).toBe(2)
        expect(s.week.map((d) => d.practiced)).toEqual([
            true,
            true,
            false,
            false,
            false,
            false,
            false,
        ])
    })
})
