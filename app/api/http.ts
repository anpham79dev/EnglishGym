import type { ApiErrorCode } from '#shared/types'

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
    const offline = status === 0 || (typeof navigator !== 'undefined' && !navigator.onLine)
    return {
        status,
        offline,
        code: e.data?.data?.code ?? null,
        message: offline
            ? 'Mất mạng hoặc server không phản hồi. Bài vẫn được giữ trên máy, gửi lại sau.'
            : (e.data?.statusMessage ??
              e.data?.message ??
              e.statusMessage ??
              e.message ??
              'Lỗi không rõ'),
    }
}

/** Errors where manual grading should be offered. */
export const shouldOfferManualPrompt = (f: ApiFailure) =>
    f.code === 'QUOTA' ||
    f.code === 'DAILY_LIMIT' ||
    f.code === 'INVALID_AI' ||
    f.code === 'AI_ERROR'
