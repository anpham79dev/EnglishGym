import { deleteTopic } from '../../services/topicService'

export default defineEventHandler(async (event) => {
    await deleteTopic(requireParam(event, 'id'))
    return { ok: true }
})
