import { topicInputSchema, updateTopic } from '../../services/topicService'

export default defineEventHandler(async (event) =>
    updateTopic(requireParam(event, 'id'), await parseBody(event, topicInputSchema.partial())),
)
