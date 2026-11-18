import { createError } from 'h3'
import { randomUUID } from 'node:crypto'
import { and, desc, eq, gte, isNull, lt, max, type SQL } from 'drizzle-orm'
import { PROCESSING_STALE_MS } from '#shared/constants/app'
import type { Attempt, AttemptKind, AttemptSource, ConfirmBody } from '#shared/types'
import { toPatternKey } from '#shared/utils/patternKey'
import { useDb, schema } from '../db'
import { apiError } from '../utils/http'
import { recomputeMistake } from './mistakeService'
import type { GradeOutput } from './geminiService'

const t = schema.attempts

export const getAttempt = async (id: string): Promise<Attempt | undefined> =>
    useDb().query.attempts.findFirst({ where: eq(t.id, id) })

export const listAttempts = async (f: { kind?: AttemptKind; from?: number; to?: number }) => {
    const conds: SQL[] = []
    if (f.kind) conds.push(eq(t.kind, f.kind))
    if (f.from) conds.push(gte(t.createdAt, f.from))
    if (f.to) conds.push(lt(t.createdAt, f.to))
    return useDb()
        .select({
            id: t.id,
            kind: t.kind,
            topicId: t.topicId,
            attemptGroupId: t.attemptGroupId,
            version: t.version,
            status: t.status,
            durationS: t.durationS,
            createdAt: t.createdAt,
            topicTitle: schema.topics.title,
        })
        .from(t)
        .leftJoin(schema.topics, eq(schema.topics.id, t.topicId))
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(t.createdAt))
        .limit(200)
}

export interface SubmitInput {
    kind: AttemptKind
    clientAttemptId: string
    topicId: string | null
    attemptGroupId?: string | null
    durationS?: number | null
    mimeType?: string | null
    text?: string | null
    /** gemini (default), manual (self-review, no AI) or pasted (JSON from another AI). */
    source?: AttemptSource
}

/** True when a `processing` row has been stuck long enough to assume its function died. */
export const isStaleProcessing = (a: Pick<Attempt, 'status' | 'processingAt' | 'createdAt'>) =>
    a.status === 'processing' && Date.now() - (a.processingAt ?? a.createdAt) > PROCESSING_STALE_MS

const isUniqueViolation = (err: unknown): boolean => {
    for (let e: unknown = err; e; e = (e as { cause?: unknown }).cause)
        if (e instanceof Error && /UNIQUE constraint failed/i.test(e.message)) return true
    return false
}

const findByClientId = (clientAttemptId: string) =>
    useDb().query.attempts.findFirst({ where: eq(t.clientAttemptId, clientAttemptId) })

/**
 * Returns the row id to grade, or the existing row when there is nothing to grade.
 * Graded rows are returned as is; failed and stale `processing` rows are re-graded in place;
 * a fresh `processing` row means another request is grading it (409).
 */
const claimAttempt = async (input: SubmitInput): Promise<string | Attempt> => {
    const db = useDb()
    const existing = await findByClientId(input.clientAttemptId)
    if (existing) {
        if (existing.status === 'processing' && !isStaleProcessing(existing))
            throw apiError(409, 'IN_PROGRESS', 'Bài đang được chấm, thử lại sau ít phút')
        if (existing.status !== 'failed' && existing.status !== 'processing') return existing
        // Conditional claim: if a parallel request re-claimed the row first, nothing matches.
        const claimed = await db
            .update(t)
            .set({
                status: 'processing',
                error: null,
                processingAt: Date.now(),
                // A failed AI attempt can be finished in another mode under the same id.
                source: input.source ?? 'gemini',
                ...(input.durationS !== undefined ? { durationS: input.durationS } : {}),
            })
            .where(
                and(
                    eq(t.id, existing.id),
                    eq(t.status, existing.status),
                    existing.processingAt === null
                        ? isNull(t.processingAt)
                        : eq(t.processingAt, existing.processingAt),
                ),
            )
            .returning({ id: t.id })
        if (!claimed.length)
            throw apiError(409, 'IN_PROGRESS', 'Bài đang được chấm, thử lại sau ít phút')
        return existing.id
    }

    const id = randomUUID()
    const groupId = input.attemptGroupId || id
    const [row] = await db
        .select({ v: max(t.version) })
        .from(t)
        .where(eq(t.attemptGroupId, groupId))
    const now = Date.now()
    try {
        await db.insert(t).values({
            id,
            clientAttemptId: input.clientAttemptId,
            kind: input.kind,
            topicId: input.topicId,
            attemptGroupId: groupId,
            version: (row?.v ?? 0) + 1,
            status: 'processing',
            textOrTranscript: input.text ?? null,
            durationS: input.durationS ?? null,
            mimeType: input.mimeType ?? null,
            createdAt: now,
            processingAt: now,
            source: input.source ?? 'gemini',
        })
    } catch (err) {
        // A parallel request with the same client id inserted first: it is grading now.
        if (isUniqueViolation(err) && (await findByClientId(input.clientAttemptId)))
            throw apiError(409, 'IN_PROGRESS', 'Bài đang được chấm, thử lại sau ít phút')
        throw err
    }
    return id
}

/**
 * Idempotent on client_attempt_id: graded rows are returned as is,
 * failed or stuck rows are re-graded in place.
 */
export const submitAttempt = async (
    input: SubmitInput,
    grade: () => Promise<GradeOutput>,
): Promise<Attempt> => {
    const db = useDb()
    const claimed = await claimAttempt(input)
    if (typeof claimed !== 'string') return claimed
    const id = claimed

    try {
        const out = await grade()
        await db
            .update(t)
            .set({
                status: 'needs_review',
                textOrTranscript:
                    input.kind === 'speaking' ? (out.result.transcript ?? '') : (input.text ?? ''),
                // Self-review has no AI output; ai_json stays null rather than an empty string.
                aiJson: input.source === 'manual' ? null : out.raw,
                model: out.model,
                promptVersion: out.promptVersion,
                error: null,
            })
            .where(eq(t.id, id))
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        await db.update(t).set({ status: 'failed', error: message }).where(eq(t.id, id))
        throw err
    }
    return (await getAttempt(id))!
}

/** Attempt with its topic and confirmed hits, for the review page. */
export const getAttemptDetail = async (id: string) => {
    const attempt = await getAttempt(id)
    if (!attempt) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy lượt nộp' })

    const db = useDb()
    const topic = attempt.topicId
        ? await db.query.topics.findFirst({ where: eq(schema.topics.id, attempt.topicId) })
        : null
    const hits = await db
        .select({
            issueIndex: schema.mistakeHits.issueIndex,
            originalQuote: schema.mistakeHits.originalQuote,
            correction: schema.mistakeHits.correction,
            patternKey: schema.mistakes.patternKey,
            labelVi: schema.mistakes.labelVi,
        })
        .from(schema.mistakeHits)
        .innerJoin(schema.mistakes, eq(schema.mistakes.id, schema.mistakeHits.mistakeId))
        .where(eq(schema.mistakeHits.attemptId, attempt.id))

    return { attempt, topic: topic ?? null, hits }
}

/**
 * Save the final transcript and approved issues in one transaction.
 * Re-confirming is a no-op; unique (attempt_id, issue_index) prevents double counts.
 */
export const confirmAttempt = async (id: string, body: ConfirmBody): Promise<Attempt> => {
    const db = useDb()
    const attempt = await getAttempt(id)
    if (!attempt) throw createError({ statusCode: 404, statusMessage: 'Không tìm thấy lượt nộp' })
    if (attempt.status === 'confirmed') return attempt
    if (attempt.status !== 'needs_review')
        throw createError({
            statusCode: 409,
            statusMessage: `Lượt nộp đang ở trạng thái ${attempt.status}`,
        })

    const now = Date.now()
    await db.transaction(async (tx) => {
        const touched = new Set<string>()
        for (const issue of body.issues) {
            const patternKey = toPatternKey(issue.patternKey)
            let mistake = await tx.query.mistakes.findFirst({
                where: eq(schema.mistakes.patternKey, patternKey),
            })
            if (!mistake) {
                ;[mistake] = await tx
                    .insert(schema.mistakes)
                    .values({
                        id: randomUUID(),
                        patternKey,
                        labelVi: issue.labelVi || patternKey,
                        exampleWrong: issue.originalQuote,
                        exampleRight: issue.correction,
                        category: issue.category || 'other',
                        firstSeen: now,
                        lastSeen: now,
                        hitCount: 0,
                    })
                    .returning()
            }
            await tx
                .insert(schema.mistakeHits)
                .values({
                    id: randomUUID(),
                    mistakeId: mistake!.id,
                    attemptId: id,
                    issueIndex: issue.issueIndex,
                    originalQuote: issue.originalQuote,
                    correction: issue.correction,
                })
                .onConflictDoNothing()
            touched.add(mistake!.id)
        }
        for (const mistakeId of touched) await recomputeMistake(tx, mistakeId)

        await tx
            .update(t)
            .set({
                status: 'confirmed',
                finalTranscript:
                    attempt.kind === 'speaking'
                        ? (body.finalTranscript ?? attempt.textOrTranscript)
                        : attempt.textOrTranscript,
                selfRating: body.selfRating ?? null,
                fillerCount: body.fillerCount ?? null,
                confirmedAt: now,
            })
            .where(eq(t.id, id))
    })
    return (await getAttempt(id))!
}
