import { createError, getQuery, getRouterParam, readBody, type H3Event } from 'h3'
import type { z } from 'zod'
import type { ApiErrorCode } from '#shared/types'

/** Error with `data.code` for the client. */
export const apiError = (
    statusCode: number,
    code: ApiErrorCode,
    message: string,
    extra: Record<string, unknown> = {},
) => createError({ statusCode, statusMessage: message, data: { code, ...extra } })

/** 400 with Zod issues; the single shape for every validation error. */
export const validationError = (issues: unknown, message = 'Dữ liệu không hợp lệ') =>
    createError({ statusCode: 400, statusMessage: message, data: { issues } })

export const parseBody = async <T extends z.ZodType>(
    event: H3Event,
    schema: T,
): Promise<z.infer<T>> => {
    const result = schema.safeParse(await readBody(event))
    if (!result.success) throw validationError(result.error.issues)
    return result.data
}

export const parseQuery = <T extends z.ZodType>(event: H3Event, schema: T): z.infer<T> => {
    const result = schema.safeParse(getQuery(event))
    if (!result.success) throw validationError(result.error.issues, 'Tham số không hợp lệ')
    return result.data
}

export const requireParam = (event: H3Event, name: string): string => {
    const value = getRouterParam(event, name)
    if (!value) throw createError({ statusCode: 400, statusMessage: `Thiếu ${name}` })
    return value
}
