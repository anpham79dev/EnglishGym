import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { describe, expect, it, vi } from 'vitest'
import { dayKey } from '../shared/utils/streak'
import { fakeGrade, schema, setupTestDb, useDb } from './helpers/db'

const { confirmAttempt, submitAttempt } = await import('../server/services/attemptService')
const { offlineGrader } = await import('../server/services/gradeModes')
const { mergeMistake, updateMistake } = await import('../server/services/mistakeService')
const { createTopic, deleteTopic, importTopics } = await import('../server/services/topicService')
const { createCheckin, getCalendarMonth, getStreak } =
    await import('../server/services/streakService')

setupTestDb()

const writing = (text = 'I goed to school yesterday.') => ({
    kind: 'writing' as const,
    clientAttemptId: randomUUID(),
    topicId: null,
    text,
})

describe('N1/N2: chấm không dùng Gemini', () => {
    it('tự duyệt: source manual, ai_json null', async () => {
        const { source, grade } = offlineGrader('writing', 'manual', {})
        const a = await submitAttempt({ ...writing(), source }, grade)
        expect(a.source).toBe('manual')
        expect(a.aiJson).toBeNull()
        expect(a.status).toBe('needs_review')
        expect(a.model).toBe('manual')
    })

    it('tự duyệt bài nói cần bản chép lời', () => {
        expect(() => offlineGrader('speaking', 'manual', { transcript: ' ' })).toThrow()
    })

    it('dán JSON sai thì báo lỗi trước khi tạo row', async () => {
        expect(() => offlineGrader('writing', 'pasted', { pastedJson: '{"x":1}' })).toThrow(
            /JSON chưa đúng/,
        )
        expect(await useDb().select().from(schema.attempts)).toHaveLength(0)
    })

    it('dán JSON đúng: giữ nguyên chuỗi gốc, source pasted', async () => {
        const raw =
            '```json\n{"issues":[{"original_quote":"I goed","suggested_correction":"I went","reason_vi":"x","category":"tense","pattern_key_suggestion":"irregular-past"}],"focus_pattern_suggestion":""}\n```'
        const { source, grade } = offlineGrader('writing', 'pasted', { pastedJson: raw })
        const a = await submitAttempt({ ...writing(), source }, grade)
        expect(a.source).toBe('pasted')
        expect(a.aiJson).toBe(raw)
    })

    it('bài AI lỗi chuyển sang tự duyệt với cùng id, không tạo bài trùng', async () => {
        const input = writing()
        const broken = vi.fn(async () => {
            throw new Error('quota')
        })
        await expect(submitAttempt({ ...input, source: 'gemini' }, broken)).rejects.toThrow()
        const { source, grade } = offlineGrader('writing', 'manual', {})
        const a = await submitAttempt({ ...input, source }, grade)
        expect(a.source).toBe('manual')
        expect(await useDb().select().from(schema.attempts)).toHaveLength(1)
    })
})

describe('N3: kho đề', () => {
    it('import CSV bỏ dòng trùng (kind, title), chuẩn hoá tag', async () => {
        await createTopic({ kind: 'writing', title: 'Bug ticket', prompt: 'p', level: 'B1' })
        const csv =
            'kind,title,prompt,level,tags\n' +
            'writing,bug ticket,"Write it, short",B1,"Work, TOEIC-SW"\n' +
            'speaking,Intro,"Introduce yourself",B1,work\n' +
            'speaking,Intro,"dup in file",B1,\n'
        const res = await importTopics('csv', csv)
        expect(res).toMatchObject({ added: 1, skipped: 2 })
        const intro = await useDb().query.topics.findFirst({
            where: eq(schema.topics.title, 'Intro'),
        })
        expect(intro?.tags).toBe('work')
    })

    it('đề đã có bài nộp chỉ tắt được, không xoá được', async () => {
        const topic = await createTopic({ kind: 'writing', title: 'T', prompt: 'p', level: 'B1' })
        await submitAttempt({ ...writing(), topicId: topic.id }, fakeGrade())
        await expect(deleteTopic(topic.id)).rejects.toMatchObject({ statusCode: 409 })
        const empty = await createTopic({ kind: 'writing', title: 'U', prompt: 'p', level: 'B1' })
        await deleteTopic(empty.id)
        expect(
            await useDb().query.topics.findFirst({ where: eq(schema.topics.id, empty.id) }),
        ).toBeUndefined()
    })
})

describe('N4: ghi chú sổ lỗi', () => {
    it('gộp hai kiểu lỗi thì nối hai ghi chú', async () => {
        const a = await submitAttempt(writing(), fakeGrade())
        await confirmAttempt(a.id, {
            issues: ['a-key', 'b-key'].map((patternKey, i) => ({
                issueIndex: i,
                originalQuote: 'q',
                correction: 'c',
                patternKey,
                labelVi: patternKey,
                category: 'grammar',
            })),
        })
        const all = await useDb().select().from(schema.mistakes)
        const ma = all.find((m) => m.patternKey === 'a-key')!
        const mb = all.find((m) => m.patternKey === 'b-key')!
        await updateMistake(ma.id, { note: 'Unit 12' })
        await updateMistake(mb.id, { note: 'Trang 24' })
        await mergeMistake(mb.id, ma.id)
        const merged = await useDb().query.mistakes.findFirst({
            where: eq(schema.mistakes.id, ma.id),
        })
        expect(merged?.note).toBe('Unit 12\nTrang 24')
    })
})

describe('N11: streak và lịch', () => {
    it('chỉ bài đã duyệt mới tính, điểm danh tay tính khi bật', async () => {
        const a = await submitAttempt(writing(), fakeGrade())
        expect((await getStreak()).current).toBe(0)
        await confirmAttempt(a.id, { issues: [] })
        expect((await getStreak()).current).toBe(1)

        const yesterday = dayKey(Date.now() - 86400e3)
        await createCheckin({ date: yesterday, kind: 'book', minutes: 30, note: '' })
        expect((await getStreak(true)).current).toBe(2)
        expect((await getStreak(false)).current).toBe(1)
    })

    it('không cho điểm danh ngày tương lai', async () => {
        const tomorrow = dayKey(Date.now() + 86400e3)
        await expect(
            createCheckin({ date: tomorrow, kind: 'book', note: '' }),
        ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('lịch tháng đếm bài theo ngày và tổng phút tự học', async () => {
        const a = await submitAttempt(writing(), fakeGrade())
        await confirmAttempt(a.id, { issues: [] })
        const today = dayKey(Date.now())
        await createCheckin({ date: today, kind: 'reading', minutes: 20, note: 'sách' })
        const cal = await getCalendarMonth(today.slice(0, 7))
        const day = cal.days.find((d) => d.date === today)!
        expect(day.writing).toBe(1)
        expect(day.checkins).toHaveLength(1)
        expect(cal.totals).toMatchObject({ practiceDays: 1, writing: 1, selfStudyMinutes: 20 })
    })
})
