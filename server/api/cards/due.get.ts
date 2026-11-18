import { z } from 'zod'
import { getDueCards } from '../../services/cardService'

const querySchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) })

export default defineEventHandler(async (event) => {
    const { limit } = parseQuery(event, querySchema)
    return getDueCards(limit)
})
