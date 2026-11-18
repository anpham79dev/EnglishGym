import { z } from 'zod'
import { getCalendarMonth } from '../services/streakService'

const querySchema = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) })

export default defineEventHandler(async (event) => {
    const { month } = parseQuery(event, querySchema)
    return getCalendarMonth(month)
})
