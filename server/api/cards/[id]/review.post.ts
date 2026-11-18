import { z } from 'zod'
import { reviewCard } from '../../../services/cardService'

const bodySchema = z.object({
    /** 1 Again, 2 Hard, 3 Good, 4 Easy */
    rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    quizId: z.string().min(1).nullish(),
})

export default defineEventHandler(async (event) => {
    const { rating, quizId } = await parseBody(event, bodySchema)
    return reviewCard(requireParam(event, 'id'), rating, quizId)
})
