import { submitSpeaking, type GradeChoice } from '~/api/attemptApi'
import {
    isGraded,
    notGradedFailure,
    shouldOfferManualPrompt,
    toApiFailure,
    type ApiFailure,
} from '~/api/http'
import type { LocalAudio } from './useLocalDb'

/** Submit a stored recording; once graded, mark it `sent` and open review. */
export const useSpeakingSubmit = () => {
    const sending = ref(false)
    const failure = ref<ApiFailure | null>(null)
    const failedItem = ref<LocalAudio | null>(null)

    const send = async (item: LocalAudio, choice?: GradeChoice) => {
        sending.value = true
        failure.value = null
        failedItem.value = null
        const db = useLocalDb()
        const fail = async (f: ApiFailure) => {
            failure.value = f
            failedItem.value = item
            await db.audios.update(item.id, { lastError: f.message })
        }
        try {
            const attempt = await submitSpeaking({
                clientAttemptId: item.id,
                topicId: item.topicId,
                attemptGroupId: item.attemptGroupId,
                mimeType: item.mimeType,
                durationS: item.durationS,
                blob: item.blob,
                choice,
                timed: item.timed,
            })
            // Keep it in the "not sent" queue until the server has really graded it.
            if (!isGraded(attempt)) return await fail(notGradedFailure())
            await db.audios.update(item.id, {
                status: 'sent',
                attemptId: attempt.id,
                lastError: undefined,
            })
            await navigateTo(`/review/${attempt.id}`)
        } catch (e) {
            await fail(toApiFailure(e))
        } finally {
            sending.value = false
        }
    }

    const offerManual = computed(() => !!failure.value && shouldOfferManualPrompt(failure.value))

    return { sending, failure, failedItem, offerManual, send }
}
