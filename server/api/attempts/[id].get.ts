import { getAttemptDetail } from '../../services/attemptService'

export default defineEventHandler(async (event) => getAttemptDetail(requireParam(event, 'id')))
