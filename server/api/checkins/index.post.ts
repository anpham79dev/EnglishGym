import { checkinInputSchema, createCheckin } from '../../services/streakService'

export default defineEventHandler(async (event) =>
    createCheckin(await parseBody(event, checkinInputSchema)),
)
