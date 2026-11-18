import { z } from 'zod'
import { getTodaySummary } from '../services/todayService'

const querySchema = z.object({
    /** Start of the user's local day (ms). */
    from: z.coerce.number().int().positive(),
    /** Day index for topic rotation. */
    day: z.coerce.number().int().nonnegative(),
})

export default defineEventHandler(async (event) => {
    const { from, day } = parseQuery(event, querySchema)
    return getTodaySummary(from, day)
})
