import { submitSpeaking } from '~/api/attemptApi'
import { shouldOfferManualPrompt, toApiFailure, type ApiFailure } from '~/api/http'
import type { LocalAudio } from './useLocalDb'

/** Submit a stored recording; on success mark it `sent` and open review. */
export const useSpeakingSubmit = () => {
    const sending = ref(false)
    const failure = ref<ApiFailure | null>(null)
    const failedItem = ref<LocalAudio | null>(null)

    const send = async (item: LocalAudio) => {
        sending.value = true
        failure.value = null
        failedItem.value = null
        const db = useLocalDb()
        try {
            const attempt = await submitSpeaking({
                clientAttemptId: item.id,
                topicId: item.topicId,
                attemptGroupId: item.attemptGroupId,
                mimeType: item.mimeType,
                durationS: item.durationS,
                blob: item.blob,
            })
            await db.audios.update(item.id, {
                status: 'sent',
                attemptId: attempt.id,
                lastError: undefined,
            })
            await navigateTo(`/review/${attempt.id}`)
        } catch (e) {
            const f = toApiFailure(e)
            failure.value = f
            failedItem.value = item
            await db.audios.update(item.id, { lastError: f.message })
        } finally {
            sending.value = false
        }
    }

    const offerManual = computed(() => !!failure.value && shouldOfferManualPrompt(failure.value))

    return { sending, failure, failedItem, offerManual, send }
}
