import { createError } from 'h3'
import { randomUUID } from 'node:crypto'
import { and, desc, eq, gte, lt, max, type SQL } from 'drizzle-orm'
import type { Attempt, AttemptKind, ConfirmBody } from '#shared/types'
import { useDb, schema } from '../db'
import { recomputeMistake, toPatternKey } from './mistakeService'
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
}

/**
 * Nộp bài có chống gửi trùng theo client_attempt_id:
 * - đã có và không `failed` → trả lại kết quả cũ, không gọi Gemini lần hai
 * - `failed` → chấm lại trên cùng bản ghi
 */
export const submitAttempt = async (
    input: SubmitInput,
    grade: () => Promise<GradeOutput>,
): Promise<Attempt> => {
    const db = useDb()
    const existing = await db.query.attempts.findFirst({
        where: eq(t.clientAttemptId, input.clientAttemptId),
    })
    if (existing && existing.status !== 'failed') return existing

    let id = existing?.id
    if (!id) {
        id = randomUUID()
        const groupId = input.attemptGroupId || id
        const [row] = await db
            .select({ v: max(t.version) })
            .from(t)
            .where(eq(t.attemptGroupId, groupId))
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
            createdAt: Date.now(),
        })
    } else {
        await db.update(t).set({ status: 'processing', error: null }).where(eq(t.id, id))
    }

    try {
        const out = await grade()
        await db
            .update(t)
            .set({
                status: 'needs_review',
                textOrTranscript:
                    input.kind === 'speaking' ? (out.result.transcript ?? '') : (input.text ?? ''),
                aiJson: out.raw,
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

/**
 * Lưu bản chép lời cuối và các lỗi đã duyệt trong một transaction.
 * Xác nhận lần hai trả lại kết quả cũ; unique (attempt_id, issue_index) chặn đếm trùng.
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
