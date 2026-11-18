import { createTopic, topicInputSchema } from '../../services/topicService'

export default defineEventHandler(async (event) =>
    createTopic(await parseBody(event, topicInputSchema)),
)
