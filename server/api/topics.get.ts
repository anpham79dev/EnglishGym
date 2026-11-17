import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { useDb, schema } from '../db'

const querySchema = z.object({ kind: z.enum(['speaking', 'writing']).optional() })

export default defineEventHandler(async (event) => {
    const { kind } = parseQuery(event, querySchema)
    const t = schema.topics
    return useDb()
        .select()
        .from(t)
        .where(and(eq(t.active, true), kind ? eq(t.kind, kind) : undefined))
        .orderBy(t.title)
})
