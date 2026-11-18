import { finishQuiz } from '../../../services/quizService'

export default defineEventHandler((event) => finishQuiz(requireParam(event, 'id')))
