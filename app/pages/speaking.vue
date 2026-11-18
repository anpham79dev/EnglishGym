<script setup lang="ts">
import { MAX_AUDIO_BYTES } from '#shared/constants/app'
import { buildManualPrompt, topicToText } from '#shared/utils/prompts'
import { fetchTopics } from '~/api/attemptApi'
import { SILENCE_PEAK } from '~/constants'
import type { Recording } from '~/composables/useRecorder'
import type { LocalAudio } from '~/composables/useLocalDb'

const route = useRoute()
const toast = useToast()
const { data: topics } = await useAsyncData('topics-speaking', () => fetchTopics('speaking'), {
    default: () => [],
})

const topicId = ref<string | null>((route.query.topic as string) || topics.value[0]?.id || null)
const groupId = (route.query.group as string) || null
const topic = computed(() => topics.value.find((t) => t.id === topicId.value) ?? null)

const current = ref<LocalAudio | null>(null)
const audioUrl = ref<string | null>(null)
const warning = ref<string | null>(null)
const { sending, failure, failedItem, offerManual, send } = useSpeakingSubmit()

const setCurrent = (item: LocalAudio | null) => {
    if (audioUrl.value) URL.revokeObjectURL(audioUrl.value)
    current.value = item
    audioUrl.value = item ? URL.createObjectURL(item.blob) : null
}
onBeforeUnmount(() => setCurrent(null))

const onRecorded = async (rec: Recording) => {
    warning.value = null
    if (rec.blob.size > MAX_AUDIO_BYTES) {
        warning.value = `File ${formatBytes(rec.blob.size)} vượt 3 MB. Hãy nói ngắn lại.`
        return
    }
    if (rec.durationS < 3) {
        warning.value = 'Bản ghi quá ngắn.'
        return
    }
    if (rec.peakLevel < SILENCE_PEAK)
        warning.value = 'Gần như không thu được tiếng. Kiểm tra micro rồi nghe lại trước khi nộp.'

    const item: LocalAudio = {
        id: crypto.randomUUID(),
        blob: rec.blob,
        mimeType: rec.mimeType,
        durationS: rec.durationS,
        topicId: topicId.value,
        topicTitle: topic.value?.title ?? 'Tự do',
        attemptGroupId: groupId,
        createdAt: Date.now(),
        status: 'pending',
    }
    // Persist right away so nothing is lost.
    await useLocalDb().audios.put(item)
    setCurrent(item)
}

const discard = async () => {
    if (!current.value) return
    await useLocalDb().audios.delete(current.value.id)
    setCurrent(null)
    toast.info('Đã bỏ bản ghi')
}

const manualPrompt = computed(() => buildManualPrompt('speaking', topicToText(topic.value)))
</script>

<template>
    <main class="page">
        <h1>Luyện nói</h1>
        <p
            v-if="groupId"
            class="alert alert-ok"
        >
            Nói lại: lượt này sẽ được so sánh với lần trước cùng nhóm.
        </p>

        <BaseTopicSelect
            v-model="topicId"
            :topics="topics"
        />

        <SpeakingRecorderPanel
            v-if="!current"
            @recorded="onRecorded"
        />

        <p
            v-if="warning"
            class="alert"
        >
            {{ warning }}
        </p>

        <div
            v-if="current && audioUrl"
            class="card stack"
        >
            <h2>Nghe lại</h2>
            <audio
                :src="audioUrl"
                controls
                preload="metadata"
                style="width: 100%"
            />
            <p class="muted">
                {{ formatDuration(current.durationS) }} · {{ formatBytes(current.blob.size) }} ·
                {{ current.mimeType }}
            </p>
            <div class="row">
                <button
                    class="btn btn-primary"
                    style="flex: 1"
                    :disabled="sending"
                    @click="send(current)"
                >
                    {{ sending ? 'Đang chấm… (có thể tới 1 phút)' : 'Nộp để chấm' }}
                </button>
                <button
                    class="btn"
                    :disabled="sending"
                    @click="discard"
                >
                    Ghi lại
                </button>
            </div>
        </div>

        <p
            v-if="failure"
            class="alert"
        >
            {{ failure.message }}
        </p>
        <BaseCopyPrompt
            v-if="offerManual"
            :prompt="manualPrompt"
            :audio="failedItem"
        />

        <SpeakingPendingQueue
            v-if="!sending"
            @retry="send"
        />
    </main>
</template>
