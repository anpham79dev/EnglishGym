/**
 * Real SQLite file per test file (vitest isolates modules per file, so `useDb()` is fresh).
 * Not `:memory:`: @libsql/client opens a new connection after `transaction()`, and a new
 * in-memory connection is an empty DB, which would silently break the services.
 */
import { mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { afterAll, beforeAll, beforeEach, vi } from 'vitest'
import type { AiIssue } from '../../shared/types'
import type { GradeOutput } from '../../server/services/geminiService'

const PREFIX = 'englishgym-test-'
// Windows can keep the DB file locked past afterAll; sweep leftovers from earlier runs
// (old enough that no parallel test file can still be using them).
for (const name of readdirSync(tmpdir()).filter((n) => n.startsWith(PREFIX))) {
    const path = join(tmpdir(), name)
    try {
        if (Date.now() - statSync(path).mtimeMs > 10 * 60 * 1000)
            rmSync(path, { recursive: true, force: true })
    } catch {
        // still locked: next run
    }
}

const dir = mkdtempSync(join(tmpdir(), PREFIX))
// Must be set before the first useDb() call.
process.env.DATABASE_URL = `file:${join(dir, 'test.db').replace(/\\/g, '/')}`

const { useDb, schema } = await import('../../server/db')
export { useDb, schema }

const migrationsFolder = fileURLToPath(new URL('../../server/db/migrations', import.meta.url))

/** Migrate once, wipe all rows before each test, delete the file at the end. */
export const setupTestDb = () => {
    beforeAll(async () => {
        await migrate(useDb(), { migrationsFolder })
    })
    beforeEach(async () => {
        const db = useDb()
        // FK order: children first.
        await db.delete(schema.checkins)
        await db.delete(schema.focusLog)
        await db.delete(schema.reviewLogs)
        await db.delete(schema.quizzes)
        await db.delete(schema.cards)
        await db.delete(schema.mistakeHits)
        await db.delete(schema.mistakes)
        await db.delete(schema.attempts)
        await db.delete(schema.topics)
        await db.delete(schema.rateCounters)
    })
    afterAll(() => {
        useDb().$client.close()
        try {
            rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
        } catch {
            // Windows may still hold the file (transaction connections); the OS temp dir is fine.
        }
    })
}

export const issue = (quote: string, patternKey: string, correction = 'fixed'): AiIssue => ({
    original_quote: quote,
    suggested_correction: correction,
    reason_vi: 'lý do',
    category: 'grammar',
    pattern_key_suggestion: patternKey,
})

/** Stand-in for Gemini: returns a fixed result and counts calls. */
export const fakeGrade = (issues: AiIssue[] = [], transcript?: string) =>
    vi.fn(async (): Promise<GradeOutput> => {
        const result = { transcript, issues, focus_pattern_suggestion: '' }
        return { result, raw: JSON.stringify(result), model: 'fake', promptVersion: 'test' }
    })
