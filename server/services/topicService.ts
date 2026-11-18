import { createError } from 'h3'
import { randomUUID } from 'node:crypto'
import { and, asc, count, eq } from 'drizzle-orm'
import { z } from 'zod'
import type { AttemptKind } from '#shared/types'
import { csvToObjects } from '#shared/utils/csv'
import { topicToText } from '#shared/utils/prompts'
import { useDb, schema } from '../db'
import { validationError } from '../utils/http'

const t = schema.topics

/** Topic description for the grading prompt; an unknown id is a client error, not an AI error. */
export const topicText = async (topicId: string | null) => {
    if (!topicId) return topicToText(null)
    const topic = await useDb().query.topics.findFirst({ where: eq(t.id, topicId) })
    if (!topic) throw createError({ statusCode: 400, statusMessage: 'Đề không tồn tại' })
    return topicToText(topic)
}

/** "Work, standup ,work" -> "work,standup" */
export const normalizeTags = (raw: string | string[] | undefined | null) =>
    [
        ...new Set(
            (Array.isArray(raw) ? raw : (raw ?? '').split(','))
                .map((s) => s.trim().toLowerCase())
                .filter(Boolean),
        ),
    ].join(',')

export const topicInputSchema = z.object({
    kind: z.enum(['speaking', 'writing']),
    title: z.string().trim().min(1).max(200),
    prompt: z.string().trim().min(1).max(4000),
    level: z.string().trim().max(20).default('B1'),
    tags: z.union([z.string().max(500), z.array(z.string().max(50)).max(20)]).optional(),
    active: z.boolean().optional(),
})
export type TopicInput = z.infer<typeof topicInputSchema>

export const listTopics = (f: { kind?: AttemptKind; includeInactive?: boolean }) =>
    useDb()
        .select()
        .from(t)
        .where(
            and(
                f.includeInactive ? undefined : eq(t.active, true),
                f.kind ? eq(t.kind, f.kind) : undefined,
            ),
        )
        .orderBy(asc(t.kind), asc(t.title))

export const createTopic = async (input: TopicInput) => {
    const [row] = await useDb()
        .insert(t)
        .values({
            id: randomUUID(),
            kind: input.kind,
            title: input.title,
            prompt: input.prompt,
            level: input.level || 'B1',
            tags: normalizeTags(input.tags),
            active: input.active ?? true,
            createdAt: Date.now(),
        })
        .returning()
    return row!
}

export const updateTopic = async (id: string, input: Partial<TopicInput>) => {
    const { tags, ...rest } = input
    const [row] = await useDb()
        .update(t)
        .set({ ...rest, ...(tags !== undefined ? { tags: normalizeTags(tags) } : {}) })
        .where(eq(t.id, id))
        .returning()
    if (!row) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy đề' })
    return row
}

/** Topics with attempts are referenced by a foreign key: they can only be turned off. */
export const deleteTopic = async (id: string) => {
    const db = useDb()
    const [used] = await db
        .select({ n: count() })
        .from(schema.attempts)
        .where(eq(schema.attempts.topicId, id))
    if (used && used.n > 0)
        throw createError({
            statusCode: 409,
            statusMessage: `Đề đã có ${used.n} bài nộp, chỉ tắt được, không xoá được`,
        })
    await db.delete(t).where(eq(t.id, id))
}

/**
 * Import topics from JSON (array, or { topics: [...] }) or CSV with columns
 * kind,title,prompt,level,tags. Rows that duplicate an existing (kind, title) are skipped.
 */
export const importTopics = async (format: 'json' | 'csv', content: string) => {
    let rows: unknown[]
    try {
        if (format === 'csv') rows = csvToObjects(content)
        else {
            const json = JSON.parse(content) as unknown
            rows = Array.isArray(json) ? json : ((json as { topics?: unknown[] }).topics ?? [])
        }
    } catch {
        throw createError({ statusCode: 400, statusMessage: 'File không đọc được' })
    }

    const valid: TopicInput[] = []
    const invalid: string[] = []
    rows.forEach((row, i) => {
        const parsed = topicInputSchema.safeParse(row)
        if (parsed.success) valid.push(parsed.data)
        else invalid.push(`Dòng ${i + 1}: ${parsed.error.issues[0]?.path.join('.')} không hợp lệ`)
    })
    if (!valid.length && invalid.length) throw validationError(invalid, 'Không có đề hợp lệ')

    const db = useDb()
    const existing = await db.select({ kind: t.kind, title: t.title }).from(t)
    const seen = new Set(existing.map((e) => `${e.kind}|${e.title.toLowerCase()}`))
    let added = 0
    let skipped = 0
    await db.transaction(async (tx) => {
        for (const input of valid) {
            const key = `${input.kind}|${input.title.toLowerCase()}`
            if (seen.has(key)) {
                skipped++
                continue
            }
            seen.add(key)
            await tx.insert(t).values({
                id: randomUUID(),
                kind: input.kind,
                title: input.title,
                prompt: input.prompt,
                level: input.level || 'B1',
                tags: normalizeTags(input.tags),
                active: input.active ?? true,
                createdAt: Date.now(),
            })
            added++
        }
    })
    return { added, skipped, invalid }
}
