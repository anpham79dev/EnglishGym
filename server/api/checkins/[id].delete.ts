import { deleteCheckin } from '../../services/streakService'

export default defineEventHandler(async (event) => {
    await deleteCheckin(requireParam(event, 'id'))
    return { ok: true }
})
