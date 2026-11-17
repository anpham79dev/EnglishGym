import { z } from 'zod'
import { patchMistake } from '../../services/mistakeService'

const bodySchema = z.object({
    labelVi: z.string().trim().min(1).max(200).optional(),
    patternKey: z.string().trim().min(1).max(100).optional(),
    exampleWrong: z.string().max(1000).optional(),
    exampleRight: z.string().max(1000).optional(),
    category: z.string().max(50).optional(),
    isFocus: z.boolean().optional(),
    mergeIntoId: z.string().min(1).optional(),
    split: z
        .object({
            hitIds: z.array(z.string().min(1)).min(1),
            patternKey: z.string().trim().min(1).max(100),
            labelVi: z.string().trim().max(200),
        })
        .optional(),
})

export default defineEventHandler(async (event) =>
    patchMistake(requireParam(event, 'id'), await parseBody(event, bodySchema)),
)
