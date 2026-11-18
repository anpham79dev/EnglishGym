import { count } from 'drizzle-orm'
import { z } from 'zod'
// Relative imports only: scripts/backup.ts and scripts/restore.ts run this outside Nuxt.
import { EXPORT_SCHEMA_VERSION } from '../../shared/constants/app'
import { useDb, schema, type Tx } from '../db'
import { validationError } from '../utils/http'
import { rebalanceCards } from './cardService'
import { recomputeMistake } from './mistakeService'

const TABLES = {
    topics: schema.topics,
    attempts: schema.attempts,
    mistakes: schema.mistakes,
    mistake_hits: schema.mistakeHits,
    cards: schema.cards,
    quizzes: schema.quizzes,
    review_logs: schema.reviewLogs,
    checkins: schema.checkins,
    focus_log: schema.focusLog,
} as const
type TableName = keyof typeof TABLES
/** FK-safe import order. */
const IMPORT_ORDER: TableName[] = [
    'topics',
    'attempts',
    'mistakes',
    'mistake_hits',
    'cards',
    'quizzes',
    'review_logs',
    'checkins',
    'focus_log',
]

export const countRecords = async () => {
    const db = useDb()
    const out = {} as Record<TableName, number>
    for (const name of IMPORT_ORDER) {
        const [row] = await db.select({ n: count() }).from(TABLES[name])
        out[name] = row?.n ?? 0
    }
    return out
}

export const exportAll = async () => {
    const db = useDb()
    return {
        schema_version: EXPORT_SCHEMA_VERSION,
        exported_at: new Date().toISOString(),
        counts: await countRecords(),
        topics: await db.select().from(schema.topics),
        attempts: await db.select().from(schema.attempts),
        mistakes: await db.select().from(schema.mistakes),
        mistake_hits: await db.select().from(schema.mistakeHits),
        cards: await db.select().from(schema.cards),
        quizzes: await db.select().from(schema.quizzes),
        review_logs: await db.select().from(schema.reviewLogs),
        checkins: await db.select().from(schema.checkins),
        focus_log: await db.select().from(schema.focusLog),
    }
}

const csvCell = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** BOM so Excel reads UTF-8. */
export const toCsv = (rows: Record<string, unknown>[], columns: string[]) =>
    '﻿' +
    [columns.join(','), ...rows.map((r) => columns.map((c) => csvCell(r[c])).join(','))].join(
        '\r\n',
    )

export const exportMistakesCsv = async () => {
    const rows = await useDb().select().from(schema.mistakes)
    return toCsv(
        rows.map((r) => ({
            ...r,
            firstSeen: new Date(r.firstSeen).toISOString(),
            lastSeen: new Date(r.lastSeen).toISOString(),
        })),
        [
            'patternKey',
            'labelVi',
            'category',
            'exampleWrong',
            'exampleRight',
            'hitCount',
            'isFocus',
            'firstSeen',
            'lastSeen',
            'note',
        ],
    )
}

const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Anki CSV (HTML fields): front = wrong + label, back = correction. */
export const exportAnkiCsv = async () => {
    const rows = await useDb().select().from(schema.mistakes)
    const lines = rows.map((r) =>
        [
            csvCell(
                `Fix: ${escapeHtml(r.exampleWrong)}<br><small>${escapeHtml(r.labelVi)}</small>`,
            ),
            csvCell(
                escapeHtml(r.exampleRight) +
                    (r.note.trim()
                        ? `<br><small>${escapeHtml(r.note).replace(/\n/g, '<br>')}</small>`
                        : ''),
            ),
            csvCell(`englishgym ${r.category}`),
        ].join(','),
    )
    return '﻿' + ['#separator:comma', '#html:true', '#tags column:3', ...lines].join('\r\n')
}

const importSchema = z.object({
    schema_version: z.number().int().max(EXPORT_SCHEMA_VERSION),
    topics: z.array(z.record(z.string(), z.unknown())),
    attempts: z.array(z.record(z.string(), z.unknown())),
    mistakes: z.array(z.record(z.string(), z.unknown())),
    mistake_hits: z.array(z.record(z.string(), z.unknown())),
    // Added in schema_version 2; older files have none.
    checkins: z.array(z.record(z.string(), z.unknown())).default([]),
    // Added in schema_version 3.
    cards: z.array(z.record(z.string(), z.unknown())).default([]),
    quizzes: z.array(z.record(z.string(), z.unknown())).default([]),
    review_logs: z.array(z.record(z.string(), z.unknown())).default([]),
    // Added in schema_version 4.
    focus_log: z.array(z.record(z.string(), z.unknown())).default([]),
})

type Row = Record<string, unknown>

const insertChunks = async (tx: Tx, name: TableName, rows: Row[]) => {
    for (let i = 0; i < rows.length; i += 50)
        await tx
            .insert(TABLES[name])
            .values(rows.slice(i, i + 50) as never)
            .onConflictDoNothing()
}

/**
 * Import an export file; existing rows are kept, so it can merge into a non-empty DB.
 * - attempts are matched by client_attempt_id, mistakes by pattern_key; hits are re-pointed
 *   to the existing ids so nothing is orphaned or counted twice
 * - hit_count/first_seen/last_seen are recomputed from hits
 * - an existing focus mistake wins over focus flags from the file
 * Returns counts for verification.
 */
export const importAll = async (input: unknown) => {
    const parsed = importSchema.safeParse(input)
    if (!parsed.success)
        throw validationError(parsed.error.issues, 'File nhập không đúng định dạng')
    const data = parsed.data

    const before = await countRecords()
    await useDb().transaction(async (tx) => {
        await insertChunks(tx, 'topics', data.topics)

        // attempts: file id -> id in DB
        const attemptIds = new Map<string, string>()
        const byClientId = new Map(
            (
                await tx
                    .select({ id: schema.attempts.id, cid: schema.attempts.clientAttemptId })
                    .from(schema.attempts)
            ).map((a) => [a.cid, a.id]),
        )
        const newAttempts: Row[] = []
        for (const row of data.attempts) {
            const fileId = String(row.id)
            const existingId = byClientId.get(String(row.clientAttemptId))
            if (existingId) {
                attemptIds.set(fileId, existingId)
                continue
            }
            attemptIds.set(fileId, fileId)
            byClientId.set(String(row.clientAttemptId), fileId)
            newAttempts.push(row)
        }
        await insertChunks(tx, 'attempts', newAttempts)

        // mistakes: file id -> id in DB, matched by pattern_key
        const existingMistakes = await tx
            .select({
                id: schema.mistakes.id,
                key: schema.mistakes.patternKey,
                isFocus: schema.mistakes.isFocus,
            })
            .from(schema.mistakes)
        const mistakeIds = new Map<string, string>()
        const byKey = new Map(existingMistakes.map((x) => [x.key, x.id]))
        let hasFocus = existingMistakes.some((x) => x.isFocus)
        const newMistakes: Row[] = []
        for (const row of data.mistakes) {
            const fileId = String(row.id)
            const existingId = byKey.get(String(row.patternKey))
            if (existingId) {
                mistakeIds.set(fileId, existingId)
                continue
            }
            mistakeIds.set(fileId, fileId)
            byKey.set(String(row.patternKey), fileId)
            if (row.isFocus) {
                if (hasFocus) row.isFocus = false
                hasFocus = true
            }
            newMistakes.push(row)
        }
        await insertChunks(tx, 'mistakes', newMistakes)

        // hits: re-point; a hit already in the DB (same attempt and issue index, any id) is
        // mapped to that row so cards below never point to a hit that was skipped
        const hitKey = (attemptId: string, issueIndex: unknown) => `${attemptId}|${issueIndex}`
        const existingHits = new Map(
            (
                await tx
                    .select({
                        id: schema.mistakeHits.id,
                        attemptId: schema.mistakeHits.attemptId,
                        issueIndex: schema.mistakeHits.issueIndex,
                    })
                    .from(schema.mistakeHits)
            ).map((x) => [hitKey(x.attemptId, x.issueIndex), x.id]),
        )
        const hitIds = new Map<string, string>()
        const touched = new Set<string>()
        const newHits: Row[] = []
        for (const row of data.mistake_hits) {
            const mistakeId = mistakeIds.get(String(row.mistakeId)) ?? String(row.mistakeId)
            const attemptId = attemptIds.get(String(row.attemptId)) ?? String(row.attemptId)
            const key = hitKey(attemptId, row.issueIndex)
            const existingId = existingHits.get(key)
            if (existingId) {
                hitIds.set(String(row.id), existingId)
                continue
            }
            hitIds.set(String(row.id), String(row.id))
            existingHits.set(key, String(row.id))
            touched.add(mistakeId)
            newHits.push({ ...row, mistakeId, attemptId })
        }
        await insertChunks(tx, 'mistake_hits', newHits)
        for (const id of touched) await recomputeMistake(tx, id)

        // cards: one per hit; a hit that already has a card keeps the card in the DB
        const cardByHit = new Map(
            (
                await tx
                    .select({ id: schema.cards.id, hitId: schema.cards.hitId })
                    .from(schema.cards)
            ).map((x) => [x.hitId, x.id]),
        )
        const cardIds = new Map<string, string>()
        const newCards: Row[] = []
        for (const row of data.cards) {
            const hitId = hitIds.get(String(row.hitId)) ?? String(row.hitId)
            const existingId = cardByHit.get(hitId)
            if (existingId) {
                cardIds.set(String(row.id), existingId)
                continue
            }
            cardIds.set(String(row.id), String(row.id))
            cardByHit.set(hitId, String(row.id))
            newCards.push({ ...row, hitId })
        }
        await insertChunks(tx, 'cards', newCards)

        const mapCard = (id: unknown) => cardIds.get(String(id)) ?? String(id)
        await insertChunks(
            tx,
            'quizzes',
            data.quizzes.map((row) => ({
                ...row,
                cardIds: JSON.stringify(
                    (JSON.parse(String(row.cardIds ?? '[]')) as string[]).map(mapCard),
                ),
            })),
        )
        await insertChunks(
            tx,
            'review_logs',
            data.review_logs.map((row) => ({ ...row, cardId: mapCard(row.cardId) })),
        )
        const allMistakes = await tx.select({ id: schema.mistakes.id }).from(schema.mistakes)
        for (const { id } of allMistakes) await rebalanceCards(tx, id)

        await insertChunks(tx, 'checkins', data.checkins)
        await insertChunks(
            tx,
            'focus_log',
            data.focus_log.map((row) => ({
                ...row,
                mistakeId: mistakeIds.get(String(row.mistakeId)) ?? String(row.mistakeId),
            })),
        )
    })

    const after = await countRecords()
    const inFile = Object.fromEntries(IMPORT_ORDER.map((n) => [n, data[n].length])) as Record<
        TableName,
        number
    >
    const skipped = Object.fromEntries(
        IMPORT_ORDER.map((n) => [n, Math.max(0, inFile[n] - (after[n] - before[n]))]),
    ) as Record<TableName, number>
    return { before, after, inFile, skipped }
}
