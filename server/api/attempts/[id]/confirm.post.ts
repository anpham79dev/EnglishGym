import { z } from 'zod'
import { confirmAttempt } from '../../../services/attemptService'

const bodySchema = z.object({
    finalTranscript: z.string().max(20000).optional(),
    selfRating: z.number().int().min(1).max(5).nullish(),
    fillerCount: z.number().int().min(0).max(1000).nullish(),
    issues: z
        .array(
            z.object({
                issueIndex: z.number().int().min(0),
                originalQuote: z.string().min(1).max(1000),
                correction: z.string().max(1000),
                patternKey: z.string().trim().min(1).max(100),
                labelVi: z.string().trim().max(200),
                category: z.string().max(50),
            }),
        )
        .max(50),
})

export default defineEventHandler(async (event) => {
    const id = requireParam(event, 'id')
    return confirmAttempt(id, await parseBody(event, bodySchema))
})
