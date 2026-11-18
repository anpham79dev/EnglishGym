import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { fakeGrade, schema, setupTestDb, useDb } from './helpers/db'

const { confirmAttempt, submitAttempt } = await import('../server/services/attemptService')
const { mergeMistake, splitMistake, updateMistake } =
    await import('../server/services/mistakeService')

setupTestDb()

/** One confirmed attempt with one hit per pattern key. */
const confirmed = async (...keys: string[]) => {
    const a = await submitAttempt(
        { kind: 'writing', clientAttemptId: randomUUID(), topicId: null, text: 'Some text here.' },
        fakeGrade(),
    )
    await confirmAttempt(a.id, {
        issues: keys.map((patternKey, i) => ({
            issueIndex: i,
            originalQuote: `quote ${i}`,
            correction: `fix ${i}`,
            patternKey,
            labelVi: patternKey,
            category: 'grammar',
        })),
    })
}

const byKey = (key: string) =>
    useDb().query.mistakes.findFirst({ where: eq(schema.mistakes.patternKey, key) })

describe('mistakeService', () => {
    it('gộp: hit_count của lỗi đích đúng, lỗi nguồn bị xoá, trọng tâm đi theo', async () => {
        await confirmed('a-key', 'b-key')
        await confirmed('a-key')
        const a = (await byKey('a-key'))!
        const b = (await byKey('b-key'))!
        await updateMistake(b.id, { isFocus: true })

        await mergeMistake(b.id, a.id)
        expect(await byKey('b-key')).toBeUndefined()
        const merged = (await byKey('a-key'))!
        expect(merged.hitCount).toBe(3)
        expect(merged.isFocus).toBe(true)
    })

    it('tách: hit chuyển sang kiểu mới, lỗi rỗng bị xoá', async () => {
        await confirmed('a-key')
        await confirmed('a-key')
        const a = (await byKey('a-key'))!
        const hits = await useDb()
            .select()
            .from(schema.mistakeHits)
            .where(eq(schema.mistakeHits.mistakeId, a.id))

        await splitMistake(a.id, { hitIds: [hits[0]!.id], patternKey: 'New Key', labelVi: 'Mới' })
        expect((await byKey('a-key'))!.hitCount).toBe(1)
        expect((await byKey('new-key'))!.hitCount).toBe(1)

        await splitMistake(a.id, { hitIds: [hits[1]!.id], patternKey: 'new-key', labelVi: '' })
        expect(await byKey('a-key')).toBeUndefined()
        expect((await byKey('new-key'))!.hitCount).toBe(2)
    })

    it('đổi pattern_key trùng với lỗi khác trả 409', async () => {
        await confirmed('a-key', 'b-key')
        const b = (await byKey('b-key'))!
        await expect(updateMistake(b.id, { patternKey: 'A Key' })).rejects.toMatchObject({
            statusCode: 409,
        })
    })

    it('chỉ một lỗi trọng tâm', async () => {
        await confirmed('a-key', 'b-key')
        await updateMistake((await byKey('a-key'))!.id, { isFocus: true })
        await updateMistake((await byKey('b-key'))!.id, { isFocus: true })
        const focus = await useDb()
            .select()
            .from(schema.mistakes)
            .where(eq(schema.mistakes.isFocus, true))
        expect(focus.map((m) => m.patternKey)).toEqual(['b-key'])
    })
})
