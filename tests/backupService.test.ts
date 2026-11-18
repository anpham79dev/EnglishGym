import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { fakeGrade, schema, setupTestDb, useDb } from './helpers/db'

const { confirmAttempt, submitAttempt } = await import('../server/services/attemptService')
const { updateMistake } = await import('../server/services/mistakeService')
const { exportAll, exportAnkiCsv, importAll } = await import('../server/services/backupService')

setupTestDb()

const confirmed = async (keys: string[], quote = 'I goed') => {
    const a = await submitAttempt(
        { kind: 'writing', clientAttemptId: randomUUID(), topicId: null, text: 'Some text here.' },
        fakeGrade(),
    )
    await confirmAttempt(a.id, {
        issues: keys.map((patternKey, i) => ({
            issueIndex: i,
            originalQuote: quote,
            correction: 'I went',
            patternKey,
            labelVi: patternKey,
            category: 'tense',
        })),
    })
}

const wipe = async () => {
    const db = useDb()
    await db.delete(schema.focusLog)
    await db.delete(schema.reviewLogs)
    await db.delete(schema.quizzes)
    await db.delete(schema.cards)
    await db.delete(schema.mistakeHits)
    await db.delete(schema.mistakes)
    await db.delete(schema.attempts)
}

const byKey = (key: string) =>
    useDb().query.mistakes.findFirst({ where: eq(schema.mistakes.patternKey, key) })

/** Hits whose mistake or attempt does not exist. */
const orphanHits = async () => {
    const res = await useDb().$client.execute(
        `SELECT h.id FROM mistake_hits h
         LEFT JOIN mistakes m ON m.id = h.mistake_id
         LEFT JOIN attempts a ON a.id = h.attempt_id
         WHERE m.id IS NULL OR a.id IS NULL`,
    )
    return res.rows.length
}

describe('importAll', () => {
    it('khôi phục vào DB trống: đủ số bản ghi', async () => {
        await confirmed(['irregular-past', 'article'])
        await confirmed(['irregular-past'])
        const file = JSON.parse(JSON.stringify(await exportAll()))
        await wipe()

        const res = await importAll(file)
        expect(res.after).toMatchObject({ attempts: 2, mistakes: 2, mistake_hits: 3 })
        expect(res.skipped).toMatchObject({ attempts: 0, mistakes: 0, mistake_hits: 0 })
        expect((await byKey('irregular-past'))!.hitCount).toBe(2)
    })

    it('gộp vào DB có pattern_key trùng: không có hit mồ côi, hit_count đúng, một trọng tâm', async () => {
        await confirmed(['irregular-past'])
        await updateMistake((await byKey('irregular-past'))!.id, { isFocus: true })
        const file = JSON.parse(JSON.stringify(await exportAll()))
        await wipe()

        // Second DB: same pattern_key, different mistake id, its own focus.
        await confirmed(['irregular-past', 'article'])
        await updateMistake((await byKey('article'))!.id, { isFocus: true })

        const res = await importAll(file)
        expect(await orphanHits()).toBe(0)
        expect((await byKey('irregular-past'))!.hitCount).toBe(2)
        expect(res.skipped.mistakes).toBe(1)
        const focus = await useDb()
            .select()
            .from(schema.mistakes)
            .where(eq(schema.mistakes.isFocus, true))
        expect(focus.map((m) => m.patternKey)).toEqual(['article'])
    })

    it('nhập lại cùng file lần hai không đổi gì', async () => {
        await confirmed(['irregular-past'])
        const file = JSON.parse(JSON.stringify(await exportAll()))
        const res = await importAll(file)
        expect(res.after).toEqual(res.before)
        expect((await byKey('irregular-past'))!.hitCount).toBe(1)
    })
})

describe('exportAnkiCsv', () => {
    it('escape HTML trong các trường', async () => {
        await confirmed(['a<b'], 'x < y & "z"')
        const csv = await exportAnkiCsv()
        expect(csv).toContain('Fix: x &lt; y &amp; &quot;z&quot;<br><small>a&lt;b</small>')
        expect(csv).not.toContain('x < y')
    })
})

describe('estimateBackupBytes', () => {
    it('sát với kích thước file JSON thật', async () => {
        const { estimateBackupBytes } = await import('../server/services/todayService')
        for (let i = 0; i < 20; i++) await confirmed(['irregular-past', `key-${i % 5}`])
        const real = Buffer.byteLength(JSON.stringify(await exportAll()))
        const est = await estimateBackupBytes()
        expect(est / real).toBeGreaterThan(0.8)
        expect(est / real).toBeLessThan(1.5)
    })
})
