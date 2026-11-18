import type { ApiErrorCode, Attempt } from '#shared/types'

export interface ApiFailure {
    status: number
    message: string
    code: ApiErrorCode | null
    offline: boolean
}

/** Normalize $fetch errors. */
export const toApiFailure = (err: unknown): ApiFailure => {
    const e = err as {
        statusCode?: number
        status?: number
        statusMessage?: string
        message?: string
        data?: { statusMessage?: string; message?: string; data?: { code?: ApiErrorCode } }
    }
    const status = e.statusCode ?? e.status ?? 0
    const online = typeof navigator === 'undefined' || navigator.onLine
    const offline = !online
    let code = e.data?.data?.code ?? null
    // Vercel's own gateway errors (function killed at its time limit) carry no code.
    if (!code && (status === 502 || status === 504)) code = 'AI_TIMEOUT'

    let message: string
    if (offline) message = 'Mất mạng. Bài vẫn được giữ trên máy, gửi lại sau.'
    else if (status === 0)
        message = 'Server không phản hồi. Bài vẫn được giữ trên máy, gửi lại sau ít phút.'
    else if (!e.data?.data?.code && code === 'AI_TIMEOUT')
        message = 'Chấm bài quá lâu, server đã dừng. Gửi lại sau ít phút hoặc dùng Copy prompt.'
    else
        message =
            e.data?.statusMessage ??
            e.data?.message ??
            e.statusMessage ??
            e.message ??
            'Lỗi không rõ'
    return { status, offline, code, message }
}

/** Errors where manual grading should be offered. */
export const shouldOfferManualPrompt = (f: ApiFailure) =>
    f.code === 'QUOTA' ||
    f.code === 'DAILY_LIMIT' ||
    f.code === 'INVALID_AI' ||
    f.code === 'AI_ERROR' ||
    f.code === 'AI_TIMEOUT'

/** A submit only counts as done once the attempt has been graded. */
export const isGraded = (a: Pick<Attempt, 'status'>) =>
    a.status === 'needs_review' || a.status === 'confirmed'

/** Failure for a submit that returned without a graded attempt. */
export const notGradedFailure = (): ApiFailure => ({
    status: 0,
    offline: false,
    code: 'IN_PROGRESS',
    message: 'Bài chưa chấm xong. Bài vẫn được giữ trên máy, gửi lại sau ít phút.',
})
