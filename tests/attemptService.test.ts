import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { describe, expect, it, vi } from 'vitest'
import { PROCESSING_STALE_MS } from '../shared/constants/app'
import type { ConfirmIssue } from '../shared/types'
import { fakeGrade, issue, schema, setupTestDb, useDb } from './helpers/db'

const { confirmAttempt, submitAttempt } = await import('../server/services/attemptService')

setupTestDb()

const writing = (clientAttemptId = randomUUID(), text = 'I goed to school yesterday.') => ({
    kind: 'writing' as const,
    clientAttemptId,
    topicId: null,
    text,
})

const confirmIssue = (issueIndex: number, patternKey: string): ConfirmIssue => ({
    issueIndex,
    originalQuote: 'I goed',
    correction: 'I went',
    patternKey,
    labelVi: 'Quá khứ bất quy tắc',
    category: 'tense',
})

const insertProcessing = async (clientAttemptId: string, processingAt: number) => {
    await useDb().insert(schema.attempts).values({
        id: randomUUID(),
        clientAttemptId,
        kind: 'writing',
        topicId: null,
        attemptGroupId: randomUUID(),
        status: 'processing',
        textOrTranscript: 'I goed to school yesterday.',
        createdAt: processingAt,
        processingAt,
    })
}

const mistakeByKey = (key: string) =>
    useDb().query.mistakes.findFirst({ where: eq(schema.mistakes.patternKey, key) })

describe('submitAttempt', () => {
    it('gửi lại cùng clientAttemptId thì không chấm lần hai', async () => {
        const grade = fakeGrade([issue('I goed', 'irregular-past')])
        const input = writing()
        const first = await submitAttempt(input, grade)
        const second = await submitAttempt(input, grade)
        expect(grade).toHaveBeenCalledTimes(1)
        expect(second.id).toBe(first.id)
        expect(second.status).toBe('needs_review')
    })

    it('row failed được chấm lại tại chỗ', async () => {
        const input = writing()
        const broken = vi.fn(async () => {
            throw new Error('Gemini lỗi')
        })
        await expect(submitAttempt(input, broken)).rejects.toThrow('Gemini lỗi')
        const failed = await useDb().query.attempts.findFirst({
            where: eq(schema.attempts.clientAttemptId, input.clientAttemptId),
        })
        expect(failed?.status).toBe('failed')

        const ok = await submitAttempt(input, fakeGrade())
        expect(ok.id).toBe(failed!.id)
        expect(ok.status).toBe('needs_review')
        expect(ok.error).toBeNull()
    })

    it('row processing còn mới trả 409 IN_PROGRESS, không chấm', async () => {
        const input = writing()
        await insertProcessing(input.clientAttemptId, Date.now())
        const grade = fakeGrade()
        await expect(submitAttempt(input, grade)).rejects.toMatchObject({
            statusCode: 409,
            data: { code: 'IN_PROGRESS' },
        })
        expect(grade).not.toHaveBeenCalled()
    })

    it('row processing kẹt quá 2 phút được chấm lại', async () => {
        const input = writing()
        await insertProcessing(input.clientAttemptId, Date.now() - PROCESSING_STALE_MS - 1000)
        const grade = fakeGrade()
        const out = await submitAttempt(input, grade)
        expect(grade).toHaveBeenCalledTimes(1)
        expect(out.status).toBe('needs_review')
    })

    it('hai request song song cùng id: một chấm, một nhận 409', async () => {
        const input = writing()
        const slow = vi.fn(async () => {
            await new Promise((r) => setTimeout(r, 50))
            return fakeGrade()()
        })
        const results = await Promise.allSettled([
            submitAttempt(input, slow),
            submitAttempt(input, slow),
        ])
        expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
        const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
        expect(rejected.reason).toMatchObject({ statusCode: 409 })
        expect(slow).toHaveBeenCalledTimes(1)
    })
})

describe('confirmAttempt', () => {
    it('xác nhận hai lần không đổi hit_count', async () => {
        const a = await submitAttempt(writing(), fakeGrade([issue('I goed', 'irregular-past')]))
        const body = { issues: [confirmIssue(0, 'irregular-past')] }
        await confirmAttempt(a.id, body)
        await confirmAttempt(a.id, body)
        const m = await mistakeByKey('irregular-past')
        expect(m?.hitCount).toBe(1)
        const hits = await useDb().select().from(schema.mistakeHits)
        expect(hits).toHaveLength(1)
    })

    it('nhiều issue cùng pattern_key chỉ tạo một mistake', async () => {
        const a = await submitAttempt(writing(), fakeGrade())
        await confirmAttempt(a.id, {
            issues: [confirmIssue(0, 'Irregular Past'), confirmIssue(1000, 'irregular-past')],
        })
        const all = await useDb().select().from(schema.mistakes)
        expect(all).toHaveLength(1)
        expect(all[0]!.hitCount).toBe(2)
    })
})
