import { eq } from 'drizzle-orm'
import { useDb, schema } from '../../db'

export default defineEventHandler(async (event) => {
    const userId = event.context.userId as string | null
    if (!userId) return { user: null }
    const user = await useDb().query.users.findFirst({ where: eq(schema.users.id, userId) })
    return { user: user ? { id: user.id, email: user.email } : null }
})
