import { createError } from 'h3'
import { randomUUID } from 'node:crypto'
import { and, count, desc, eq, inArray, isNull, max, min } from 'drizzle-orm'
import type { AttemptKind, MistakeWithHits } from '#shared/types'
// Relative import: backupService (and so this file) also runs in scripts outside Nuxt.
import { toPatternKey } from '../../shared/utils/patternKey'
import { useDb, schema, type Db, type Tx } from '../db'
import { rebalanceCards } from './cardService'

const m = schema.mistakes
const h = schema.mistakeHits

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
            selfFound: h.selfFound,
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

export interface MistakeUpdate {
    labelVi?: string
    patternKey?: string
    exampleWrong?: string
    exampleRight?: string
    category?: string
    isFocus?: boolean
    note?: string
}

export interface MistakeSplit {
    hitIds: string[]
    patternKey: string
    labelVi: string
}

/**
 * N7: close the open focus period and, when `mistakeId` is given, start a new one, so the
 * Progress page knows which pattern was the focus in which week.
 */
export const setFocusLog = async (tx: Tx | Db, mistakeId: string | null, now = Date.now()) => {
    await tx.update(schema.focusLog).set({ endedAt: now }).where(isNull(schema.focusLog.endedAt))
    if (!mistakeId) return
    const row = await tx.query.mistakes.findFirst({ where: eq(m.id, mistakeId) })
    if (row)
        await tx.insert(schema.focusLog).values({
            id: randomUUID(),
            mistakeId,
            patternKey: row.patternKey,
            startedAt: now,
        })
}

const requireMistake = async (tx: Tx | Db, id: string, message = 'Không tìm thấy lỗi') => {
    const row = await tx.query.mistakes.findFirst({ where: eq(m.id, id) })
    if (!row) throw createError({ statusCode: 404, statusMessage: message })
    return row
}

const findMistake = (id: string) => useDb().query.mistakes.findFirst({ where: eq(m.id, id) })

/** Move every hit of `id` into `targetId`, then delete `id`. Focus moves with it. */
export const mergeMistake = async (id: string, targetId: string) => {
    if (targetId === id)
        throw createError({ statusCode: 400, statusMessage: 'Không thể gộp vào chính nó' })
    await useDb().transaction(async (tx) => {
        const current = await requireMistake(tx, id)
        const target = await requireMistake(tx, targetId, 'Không tìm thấy lỗi đích')
        await tx.update(h).set({ mistakeId: target.id }).where(eq(h.mistakeId, id))
        // Keep both notes (N4): neither side's book reference is lost.
        const note = [target.note, current.note]
            .map((n) => n.trim())
            .filter(Boolean)
            .join('\n')
        await tx
            .update(m)
            .set({ note, ...(current.isFocus ? { isFocus: true } : {}) })
            .where(eq(m.id, target.id))
        await tx.delete(m).where(eq(m.id, id))
        await recomputeMistake(tx, target.id)
        await rebalanceCards(tx, target.id)
        if (current.isFocus) await setFocusLog(tx, target.id)
    })
    return findMistake(id)
}

/** Move some hits of `id` to another (new or existing) pattern; an emptied mistake is deleted. */
export const splitMistake = async (id: string, split: MistakeSplit) => {
    await useDb().transaction(async (tx) => {
        const current = await requireMistake(tx, id)
        const key = toPatternKey(split.patternKey)
        let target = await tx.query.mistakes.findFirst({ where: eq(m.patternKey, key) })
        if (!target) {
            ;[target] = await tx
                .insert(m)
                .values({
                    id: randomUUID(),
                    patternKey: key,
                    labelVi: split.labelVi || key,
                    category: current.category,
                    firstSeen: Date.now(),
                    lastSeen: Date.now(),
                })
                .returning()
        }
        const moved = await tx
            .update(h)
            .set({ mistakeId: target!.id })
            .where(and(inArray(h.id, split.hitIds), eq(h.mistakeId, id)))
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
        await rebalanceCards(tx, target!.id)
        await rebalanceCards(tx, id)
    })
    return findMistake(id)
}

/** Edit fields; a new pattern_key must not clash, and only one mistake can be the focus. */
export const updateMistake = async (id: string, update: MistakeUpdate) => {
    await useDb().transaction(async (tx) => {
        const current = await requireMistake(tx, id)
        const fields = { ...update }
        if (fields.patternKey !== undefined) {
            const key = toPatternKey(fields.patternKey)
            const clash = await tx.query.mistakes.findFirst({ where: eq(m.patternKey, key) })
            if (clash && clash.id !== id)
                throw createError({
                    statusCode: 409,
                    statusMessage: `pattern_key "${key}" đã tồn tại, hãy dùng chức năng gộp`,
                })
            fields.patternKey = key
        }
        if (fields.isFocus) await tx.update(m).set({ isFocus: false })
        if (Object.keys(fields).length) await tx.update(m).set(fields).where(eq(m.id, id))
        if (fields.isFocus && !current.isFocus) await setFocusLog(tx, id)
        else if (fields.isFocus === false && current.isFocus) await setFocusLog(tx, null)
    })
    return findMistake(id)
}
