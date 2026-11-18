import { getQuiz } from '../../services/quizService'

export default defineEventHandler((event) => getQuiz(requireParam(event, 'id')))
