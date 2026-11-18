import { z } from 'zod'
import { getBenchmarks, getWeeklyStats } from '../services/statsService'

const querySchema = z.object({
    weeks: z.coerce.number().int().min(4).max(52).default(12),
    checkins: z.stringbool().default(true),
})

export default defineEventHandler(async (event) => {
    const { weeks, checkins } = parseQuery(event, querySchema)
    return {
        weeks: await getWeeklyStats(weeks, checkins),
        benchmarks: await getBenchmarks(),
    }
})
