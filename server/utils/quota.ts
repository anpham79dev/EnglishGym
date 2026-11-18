import { apiError } from './http'
import { APP_DAY_OFFSET_MS, DAY_MS, hitCounter, peekCounter } from './rateLimit'

const GEMINI_COUNTER = 'gemini:day'

export const geminiDailyLimit = () => Number(process.env.GEMINI_DAILY_LIMIT || 40)

/** Gemini calls made today (Vietnam day). */
export const geminiUsedToday = () => peekCounter(GEMINI_COUNTER, DAY_MS, APP_DAY_OFFSET_MS)

/** Enforce GEMINI_DAILY_LIMIT; call before every Gemini request, retries included. */
export const consumeGeminiQuota = async () => {
    const limit = geminiDailyLimit()
    const used = await hitCounter(GEMINI_COUNTER, DAY_MS, APP_DAY_OFFSET_MS)
    if (used > limit)
        throw apiError(
            429,
            'DAILY_LIMIT',
            `Đã dùng hết ${limit} lượt chấm hôm nay. Dùng Copy prompt.`,
        )
}
