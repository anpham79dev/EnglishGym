import { z } from 'zod'
import { listAttempts } from '../../services/attemptService'

const querySchema = z.object({
    kind: z.enum(['speaking', 'writing']).optional(),
    from: z.coerce.number().int().optional(),
    to: z.coerce.number().int().optional(),
})

export default defineEventHandler((event) => listAttempts(parseQuery(event, querySchema)))
