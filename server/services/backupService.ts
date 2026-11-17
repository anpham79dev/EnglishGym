import { createError } from 'h3'
import { count } from 'drizzle-orm'
import { z } from 'zod'
import { EXPORT_SCHEMA_VERSION } from '#shared/constants/app'
import { useDb, schema } from '../db'

const TABLES = {
    topics: schema.topics,
    attempts: schema.attempts,
    mistakes: schema.mistakes,
    mistake_hits: schema.mistakeHits,
} as const
type TableName = keyof typeof TABLES
/** FK-safe import order. */
const IMPORT_ORDER: TableName[] = ['topics', 'attempts', 'mistakes', 'mistake_hits']

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
        ],
    )
}

/** Anki CSV: front = wrong + label, back = correction. */
export const exportAnkiCsv = async () => {
    const rows = await useDb().select().from(schema.mistakes)
    const lines = rows.map((r) =>
        [
            csvCell(`Fix: ${r.exampleWrong}<br><small>${r.labelVi}</small>`),
            csvCell(r.exampleRight),
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
})

/**
 * Import an export file; existing rows are kept. Returns counts for verification.
 */
export const importAll = async (input: unknown) => {
    const parsed = importSchema.safeParse(input)
    if (!parsed.success)
        throw createError({
            statusCode: 400,
            statusMessage: 'File nhập không đúng định dạng',
            data: parsed.error.issues,
        })

    const before = await countRecords()
    await useDb().transaction(async (tx) => {
        for (const name of IMPORT_ORDER) {
            const rows = parsed.data[name]
            for (let i = 0; i < rows.length; i += 50) {
                const chunk = rows.slice(i, i + 50)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await tx
                    .insert(TABLES[name])
                    .values(chunk as any)
                    .onConflictDoNothing()
            }
        }
    })
    return {
        before,
        after: await countRecords(),
        inFile: Object.fromEntries(IMPORT_ORDER.map((n) => [n, parsed.data[n].length])),
    }
}
