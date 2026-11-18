import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { sentenceAround } from '../shared/utils/sentence'
import { fakeGrade, schema, setupTestDb, useDb } from './helpers/db'

const { confirmAttempt, submitAttempt } = await import('../server/services/attemptService')
const { getDueCards, reviewCard } = await import('../server/services/cardService')
const { mergeMistake } = await import('../server/services/mistakeService')
const { createQuiz, finishQuiz } = await import('../server/services/quizService')
const { exportAll, importAll } = await import('../server/services/backupService')
const { getStreak } = await import('../server/services/streakService')

setupTestDb()

const TEXT = 'Yesterday I goed to school. Then I eat lunch with friend.'

const confirmed = async (keys: string[]) => {
    const a = await submitAttempt(
        { kind: 'writing', clientAttemptId: randomUUID(), topicId: null, text: TEXT },
        fakeGrade(),
    )
    await confirmAttempt(a.id, {
        issues: keys.map((patternKey, i) => ({
            issueIndex: i,
            originalQuote: i === 0 ? 'I goed' : 'I eat',
            correction: i === 0 ? 'I went' : 'I ate',
            patternKey,
            labelVi: patternKey,
            category: 'tense',
        })),
    })
    return a
}

const allCards = () => useDb().select().from(schema.cards)

describe('sentenceAround', () => {
    it('lấy đúng câu chứa đoạn trích, giữ dấu câu', () => {
        expect(sentenceAround(TEXT, 'I eat')).toEqual({
            before: 'Then ',
            quote: 'I eat',
            after: ' lunch with friend.',
        })
    })
    it('không thấy đoạn trích thì trả null', () => {
        expect(sentenceAround(TEXT, 'not here')).toBeNull()
    })
})

describe('N5: thẻ ôn', () => {
    it('xác nhận bài tạo một thẻ mỗi lỗi, xác nhận lần hai không tạo thêm', async () => {
        const a = await confirmed(['past-a', 'past-b'])
        expect(await allCards()).toHaveLength(2)
        await confirmAttempt(a.id, { issues: [] })
        expect(await allCards()).toHaveLength(2)
    })

    it('thẻ mới đến hạn ngay, có câu ngữ cảnh và thời điểm ôn kế tiếp cho 4 mức', async () => {
        await confirmed(['past-a'])
        const due = await getDueCards()
        expect(due.total).toBe(1)
        const card = due.cards[0]!
        expect(card.context?.quote).toBe('I goed')
        expect(Object.keys(card.next).sort()).toEqual(['1', '2', '3', '4'])
        expect(card.next[4]!).toBeGreaterThan(card.next[1]!)
    })

    it('ôn "Được" thì due bị đẩy lùi, có log, và tính là ngày luyện', async () => {
        await confirmed(['past-a'])
        const [card] = await allCards()
        const res = await reviewCard(card!.id, 3)
        expect(res.dueAt).toBeGreaterThan(Date.now())
        expect(await useDb().select().from(schema.reviewLogs)).toHaveLength(1)
        expect((await getDueCards()).total).toBe(0)
        expect((await getStreak()).practicedToday).toBe(true)
    })

    it('mỗi kiểu lỗi tối đa 3 thẻ hoạt động, gộp kiểu lỗi không mất thẻ', async () => {
        for (let i = 0; i < 4; i++) await confirmed(['past-a'])
        await confirmed(['past-b'])
        let cards = await allCards()
        expect(cards).toHaveLength(5)
        expect(cards.filter((c) => !c.suspended)).toHaveLength(4) // 3 of past-a + 1 of past-b

        const mistakes = await useDb().select().from(schema.mistakes)
        const a = mistakes.find((m) => m.patternKey === 'past-a')!
        const b = mistakes.find((m) => m.patternKey === 'past-b')!
        await mergeMistake(b.id, a.id)
        cards = await allCards()
        expect(cards).toHaveLength(5)
        expect(cards.filter((c) => !c.suspended)).toHaveLength(3)
    })
})

describe('N6: kiểm tra tuần', () => {
    it('ưu tiên thẻ hay bị "Lại", điểm = tỉ lệ Được + Dễ', async () => {
        await confirmed(['past-a', 'past-b'])
        const cards = await allCards()
        const hard = cards[1]!
        await reviewCard(hard.id, 1)
        const quiz = await createQuiz()
        expect(quiz.cards[0]!.id).toBe(hard.id)

        await reviewCard(quiz.cards[0]!.id, 1, quiz.id)
        await reviewCard(quiz.cards[1]!.id, 4, quiz.id)
        const done = await finishQuiz(quiz.id)
        expect(done.score).toBe(0.5)
        const quizLogs = await useDb()
            .select()
            .from(schema.reviewLogs)
            .where(eq(schema.reviewLogs.isQuiz, true))
        expect(quizLogs).toHaveLength(2)
    })

    it('chưa có thẻ thì báo lỗi rõ ràng', async () => {
        await expect(createQuiz()).rejects.toMatchObject({ statusCode: 400 })
    })
})

describe('xuất/nhập có thẻ', () => {
    it('nhập vào DB đã có cùng bài: thẻ không trỏ tới hit đã bị bỏ qua', async () => {
        await confirmed(['past-a'])
        const [card] = await allCards()
        await reviewCard(card!.id, 3)
        const file = JSON.parse(JSON.stringify(await exportAll()))

        // Same attempt and issue, but the hit row in the file has a different id.
        file.mistake_hits[0].id = randomUUID()
        file.cards[0].hitId = file.mistake_hits[0].id
        file.cards[0].id = randomUUID()
        file.review_logs[0].cardId = file.cards[0].id
        file.review_logs[0].id = randomUUID()

        const res = await importAll(file)
        expect(res.after.mistake_hits).toBe(1)
        expect(res.after.cards).toBe(1)
        const orphans = await useDb().$client.execute(
            `SELECT c.id FROM cards c LEFT JOIN mistake_hits h ON h.id = c.hit_id WHERE h.id IS NULL
             UNION ALL
             SELECT l.id FROM review_logs l LEFT JOIN cards c ON c.id = l.card_id WHERE c.id IS NULL`,
        )
        expect(orphans.rows).toHaveLength(0)
    })

    it('file phiên bản cũ (chưa có thẻ) vẫn nhập được', async () => {
        await confirmed(['past-a'])
        const file = JSON.parse(JSON.stringify(await exportAll()))
        delete file.cards
        delete file.review_logs
        delete file.quizzes
        file.schema_version = 1
        await expect(importAll(file)).resolves.toBeTruthy()
    })
})
