import { z } from 'zod'
import { listMistakes } from '../../services/mistakeService'

const querySchema = z.object({ kind: z.enum(['speaking', 'writing']).optional() })

export default defineEventHandler((event) => listMistakes(parseQuery(event, querySchema).kind))
