import { checkinInputSchema, updateCheckin } from '../../services/streakService'

export default defineEventHandler(async (event) =>
    updateCheckin(requireParam(event, 'id'), await parseBody(event, checkinInputSchema.partial())),
)
