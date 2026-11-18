import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { fakeGrade, issue, schema, setupTestDb, useDb } from './helpers/db'

const { confirmAttempt, getAttemptGroup, submitAttempt } =
    await import('../server/services/attemptService')
const { updateMistake } = await import('../server/services/mistakeService')
const { createTopic } = await import('../server/services/topicService')
const { getBenchmarks, getBenchmarkStatus, getWeeklyStats } =
    await import('../server/services/statsService')

setupTestDb()

const TEXT = 'Yesterday I fix the bug in the login page and it work now.'

const submitAndConfirm = async (
    opts: { topicId?: string | null; groupId?: string | null; selfFound?: boolean[] } = {},
) => {
    const a = await submitAttempt(
        {
            kind: 'writing',
            clientAttemptId: randomUUID(),
            topicId: opts.topicId ?? null,
            attemptGroupId: opts.groupId ?? null,
            text: TEXT,
        },
        fakeGrade([issue('I fix', 'past-simple'), issue('it work', 'third-person')]),
    )
    await confirmAttempt(a.id, {
        selfMarkedCount: opts.selfFound ? opts.selfFound.filter(Boolean).length : null,
        issues: ['past-simple', 'third-person'].map((patternKey, i) => ({
            issueIndex: i,
            originalQuote: i ? 'it work' : 'I fix',
            correction: i ? 'it works' : 'I fixed',
            patternKey,
            labelVi: patternKey,
            category: 'grammar',
            selfFound: opts.selfFound?.[i],
        })),
    })
    return a
}

describe('N7: tiến bộ', () => {
    it('bài theo đề có tag benchmark được đánh dấu đối chứng', async () => {
        const topic = await createTopic({
            kind: 'writing',
            title: 'Benchmark',
            prompt: 'p',
            level: 'B1',
            tags: 'benchmark',
        })
        const a = await submitAndConfirm({ topicId: topic.id })
        const row = await useDb().query.attempts.findFirst({ where: eq(schema.attempts.id, a.id) })
        expect(row?.isBenchmark).toBe(true)

        const status = await getBenchmarkStatus()
        expect(status.find((s) => s.kind === 'writing')).toMatchObject({
            done: true,
            topicId: topic.id,
        })
        expect(status.find((s) => s.kind === 'speaking')).toMatchObject({ done: false })
        const months = await getBenchmarks()
        expect(months[0]!.attempts).toHaveLength(1)
    })

    it('đổi lỗi trọng tâm ghi lịch sử, thống kê tuần tính lỗi/100 từ và mức tái phạm', async () => {
        await submitAndConfirm()
        const past = await useDb().query.mistakes.findFirst({
            where: eq(schema.mistakes.patternKey, 'past-simple'),
        })
        await updateMistake(past!.id, { isFocus: true })
        const logs = await useDb().select().from(schema.focusLog)
        expect(logs).toHaveLength(1)
        expect(logs[0]!.endedAt).toBeNull()

        await submitAndConfirm()
        const weeks = await getWeeklyStats(4)
        const now = weeks.at(-1)!
        expect(now.writing).toBe(2)
        // 4 mistakes over 2 × 13 words
        expect(now.errorsPer100).toBe(15.4)
        // Only the second attempt was made while past-simple was the focus: 1 hit / 26 words
        expect(now.focusPer100).toBe(3.8)
        expect(now.focusLabel).toBe('past-simple')
        expect(now.versions).toEqual(['fake|test'])

        await updateMistake(past!.id, { isFocus: false })
        const closed = await useDb().select().from(schema.focusLog)
        expect(closed[0]!.endedAt).not.toBeNull()
    })
})

describe('N9: tự tìm lỗi', () => {
    it('lưu số chỗ tự đánh dấu và lỗi tự bắt được, tính tỉ lệ theo tuần', async () => {
        const a = await submitAndConfirm({ selfFound: [true, false] })
        const row = await useDb().query.attempts.findFirst({ where: eq(schema.attempts.id, a.id) })
        expect(row?.selfMarkedCount).toBe(1)
        const hits = await useDb()
            .select()
            .from(schema.mistakeHits)
            .where(eq(schema.mistakeHits.attemptId, a.id))
        expect(hits.filter((h) => h.selfFound)).toHaveLength(1)
        expect((await getWeeklyStats(4)).at(-1)!.selfFoundRate).toBe(0.5)
    })

    it('bài bỏ qua bước tự tìm không tính vào tỉ lệ', async () => {
        await submitAndConfirm()
        expect((await getWeeklyStats(4)).at(-1)!.selfFoundRate).toBeNull()
    })
})

describe('N10: so sánh phiên bản', () => {
    it('trả các phiên bản theo thứ tự, mỗi bản có lỗi của nó', async () => {
        const v1 = await submitAndConfirm()
        await submitAndConfirm({ groupId: v1.attemptGroupId })
        const group = await getAttemptGroup(v1.attemptGroupId)
        expect(group.versions.map((v) => v.version)).toEqual([1, 2])
        expect(group.versions[1]!.hits.map((h) => h.patternKey).sort()).toEqual([
            'past-simple',
            'third-person',
        ])
    })
})

describe('N8: đề TOEIC có bấm giờ', () => {
    it('đề lưu thời gian chuẩn bị và trả lời, bài lưu kết quả trong giờ hay quá giờ', async () => {
        const { importTopics } = await import('../server/services/topicService')
        const res = await importTopics(
            'json',
            JSON.stringify([
                {
                    kind: 'speaking',
                    title: 'Express an opinion',
                    prompt: 'Do you prefer...',
                    tags: 'toeic-sw,opinion',
                    prepS: 30,
                    responseS: 60,
                },
            ]),
        )
        expect(res.added).toBe(1)
        const topic = await useDb().query.topics.findFirst({
            where: eq(schema.topics.title, 'Express an opinion'),
        })
        expect(topic).toMatchObject({ prepS: 30, responseS: 60 })

        const a = await submitAttempt(
            {
                kind: 'writing',
                clientAttemptId: randomUUID(),
                topicId: topic!.id,
                text: TEXT,
                timedResult: 'overtime',
            },
            fakeGrade(),
        )
        expect(a.timedResult).toBe('overtime')
    })
})
