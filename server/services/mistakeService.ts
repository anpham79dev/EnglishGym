import { createError } from 'h3'
import { randomUUID } from 'node:crypto'
import { count, desc, eq, inArray, max, min } from 'drizzle-orm'
import type { AttemptKind, MistakeWithHits } from '#shared/types'
import { toPatternKey } from '#shared/utils/patternKey'
import { useDb, schema, type Db, type Tx } from '../db'

const m = schema.mistakes
const h = schema.mistakeHits

export { toPatternKey }

/** Recompute hit_count/first_seen/last_seen from hits; delete if empty. */
export const recomputeMistake = async (tx: Tx | Db, mistakeId: string) => {
    const [agg] = await tx
        .select({
            n: count(h.id),
            first: min(schema.attempts.createdAt),
            last: max(schema.attempts.createdAt),
        })
        .from(h)
        .innerJoin(schema.attempts, eq(schema.attempts.id, h.attemptId))
        .where(eq(h.mistakeId, mistakeId))
    if (!agg || agg.n === 0) {
        await tx.delete(m).where(eq(m.id, mistakeId))
        return
    }
    await tx
        .update(m)
        .set({
            hitCount: agg.n,
            firstSeen: agg.first ?? Date.now(),
            lastSeen: agg.last ?? Date.now(),
        })
        .where(eq(m.id, mistakeId))
}

export const listMistakes = async (kind?: AttemptKind): Promise<MistakeWithHits[]> => {
    const db = useDb()
    const rows = await db.select().from(m).orderBy(desc(m.isFocus), desc(m.lastSeen))
    const hits = await db
        .select({
            id: h.id,
            mistakeId: h.mistakeId,
            attemptId: h.attemptId,
            issueIndex: h.issueIndex,
            originalQuote: h.originalQuote,
            correction: h.correction,
            kind: schema.attempts.kind,
            createdAt: schema.attempts.createdAt,
        })
        .from(h)
        .innerJoin(schema.attempts, eq(schema.attempts.id, h.attemptId))
        .orderBy(desc(schema.attempts.createdAt))

    const byMistake = new Map<string, MistakeWithHits['hits']>()
    for (const hit of hits) {
        if (kind && hit.kind !== kind) continue
        const list = byMistake.get(hit.mistakeId) ?? []
        list.push(hit)
        byMistake.set(hit.mistakeId, list)
    }
    return rows
        .map((row) => ({ ...row, hits: byMistake.get(row.id) ?? [] }))
        .filter((row) => !kind || row.hits.length > 0)
}

export interface MistakePatch {
    labelVi?: string
    patternKey?: string
    exampleWrong?: string
    exampleRight?: string
    category?: string
    isFocus?: boolean
    /** Merge into another mistake. */
    mergeIntoId?: string
    /** Move some hits to another (new or existing) pattern. */
    split?: { hitIds: string[]; patternKey: string; labelVi: string }
}

export const patchMistake = async (id: string, patch: MistakePatch) => {
    const db = useDb()
    const current = await db.query.mistakes.findFirst({ where: eq(m.id, id) })
    if (!current) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy lỗi' })

    await db.transaction(async (tx) => {
        if (patch.mergeIntoId) {
            if (patch.mergeIntoId === id)
                throw createError({ statusCode: 400, statusMessage: 'Không thể gộp vào chính nó' })
            const target = await tx.query.mistakes.findFirst({ where: eq(m.id, patch.mergeIntoId) })
            if (!target)
                throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy lỗi đích' })
            await tx.update(h).set({ mistakeId: target.id }).where(eq(h.mistakeId, id))
            if (current.isFocus)
                await tx.update(m).set({ isFocus: true }).where(eq(m.id, target.id))
            await tx.delete(m).where(eq(m.id, id))
            await recomputeMistake(tx, target.id)
            return
        }

        if (patch.split) {
            const key = toPatternKey(patch.split.patternKey)
            let target = await tx.query.mistakes.findFirst({ where: eq(m.patternKey, key) })
            if (!target) {
                ;[target] = await tx
                    .insert(m)
                    .values({
                        id: randomUUID(),
                        patternKey: key,
                        labelVi: patch.split.labelVi || key,
                        category: current.category,
                        firstSeen: Date.now(),
                        lastSeen: Date.now(),
                    })
                    .returning()
            }
            const moved = await tx
                .update(h)
                .set({ mistakeId: target!.id })
                .where(inArray(h.id, patch.split.hitIds))
                .returning()
            if (moved[0] && !target!.exampleWrong)
                await tx
                    .update(m)
                    .set({
                        exampleWrong: moved[0].originalQuote,
                        exampleRight: moved[0].correction,
                    })
                    .where(eq(m.id, target!.id))
            await recomputeMistake(tx, target!.id)
            await recomputeMistake(tx, id)
            return
        }

        if (patch.patternKey !== undefined) {
            const key = toPatternKey(patch.patternKey)
            const clash = await tx.query.mistakes.findFirst({ where: eq(m.patternKey, key) })
            if (clash && clash.id !== id)
                throw createError({
                    statusCode: 409,
                    statusMessage: `pattern_key "${key}" đã tồn tại, hãy dùng chức năng gộp`,
                })
            patch.patternKey = key
        }
        if (patch.isFocus) await tx.update(m).set({ isFocus: false })

        const { mergeIntoId: _a, split: _b, ...fields } = patch
        if (Object.keys(fields).length) await tx.update(m).set(fields).where(eq(m.id, id))
    })
    return db.query.mistakes.findFirst({ where: eq(m.id, id) })
}
