import { z } from 'zod'
import { listTopics } from '../../services/topicService'

const querySchema = z.object({
    kind: z.enum(['speaking', 'writing']).optional(),
    /** Topic bank page: include turned-off topics. */
    all: z.stringbool().optional(),
})

export default defineEventHandler(async (event) => {
    const { kind, all } = parseQuery(event, querySchema)
    return listTopics({ kind, includeInactive: all })
})
