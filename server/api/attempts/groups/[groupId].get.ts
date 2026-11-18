import { getAttemptGroup } from '../../../services/attemptService'

export default defineEventHandler((event) => getAttemptGroup(requireParam(event, 'groupId')))
