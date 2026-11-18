import { z } from 'zod'
import { mergeMistake, splitMistake, updateMistake } from '../../services/mistakeService'

const bodySchema = z.object({
    labelVi: z.string().trim().min(1).max(200).optional(),
    patternKey: z.string().trim().min(1).max(100).optional(),
    exampleWrong: z.string().max(1000).optional(),
    exampleRight: z.string().max(1000).optional(),
    category: z.string().max(50).optional(),
    isFocus: z.boolean().optional(),
    /** Merge into another mistake. */
    mergeIntoId: z.string().min(1).optional(),
    /** Move some hits to another (new or existing) pattern. */
    split: z
        .object({
            hitIds: z.array(z.string().min(1)).min(1),
            patternKey: z.string().trim().min(1).max(100),
            labelVi: z.string().trim().max(200),
        })
        .optional(),
})

export default defineEventHandler(async (event) => {
    const id = requireParam(event, 'id')
    const { mergeIntoId, split, ...fields } = await parseBody(event, bodySchema)
    if (mergeIntoId) return mergeMistake(id, mergeIntoId)
    if (split) return splitMistake(id, split)
    return updateMistake(id, fields)
})
