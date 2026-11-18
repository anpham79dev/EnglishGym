<script setup lang="ts">
import { MAX_AUDIO_BYTES } from '#shared/constants/app'
import { buildManualPrompt, topicToText } from '#shared/utils/prompts'
import { fetchTopics } from '~/api/attemptApi'
import { SILENCE_PEAK } from '~/constants'
import type { Recording } from '~/composables/useRecorder'
import type { LocalAudio } from '~/composables/useLocalDb'

const route = useRoute()
const notify = useNotify()
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
    notify.info('Đã bỏ bản ghi')
}

const manualPrompt = computed(() => buildManualPrompt('speaking', topicToText(topic.value)))
</script>

<template>
    <LayoutPage title="Luyện nói">
        <UAlert
            v-if="groupId"
            color="primary"
            variant="subtle"
            icon="i-lucide-repeat"
            title="Nói lại"
            description="Lượt này sẽ được so sánh với lần trước cùng nhóm."
        />

        <BaseTopicSelect
            v-model="topicId"
            :topics="topics"
        />

        <SpeakingRecorderPanel
            v-if="!current"
            @recorded="onRecorded"
        />

        <UAlert
            v-if="warning"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            :title="warning"
        />

        <UCard v-if="current && audioUrl">
            <div class="space-y-4">
                <div class="flex items-center justify-between gap-2">
                    <h2 class="font-semibold text-highlighted">Nghe lại</h2>
                    <span class="text-xs text-muted tabular-nums">
                        {{ formatDuration(current.durationS) }} ·
                        {{ formatBytes(current.blob.size) }}
                    </span>
                </div>
                <audio
                    :src="audioUrl"
                    controls
                    preload="metadata"
                    class="w-full"
                />
                <div class="flex gap-2">
                    <UButton
                        class="flex-1"
                        size="lg"
                        block
                        icon="i-lucide-send"
                        :loading="sending"
                        :label="sending ? 'Đang chấm, có thể tới 1 phút' : 'Nộp để chấm'"
                        @click="send(current)"
                    />
                    <UButton
                        size="lg"
                        color="neutral"
                        variant="outline"
                        icon="i-lucide-rotate-ccw"
                        label="Ghi lại"
                        :disabled="sending"
                        @click="discard"
                    />
                </div>
                <p
                    v-if="sending"
                    class="text-xs text-muted"
                >
                    Bài đã lưu trên máy. Rời trang cũng không mất, bài nằm ở mục "Chưa gửi".
                </p>
            </div>
        </UCard>

        <UAlert
            v-if="failure"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            :title="failure.message"
        />
        <BaseCopyPrompt
            v-if="offerManual"
            :prompt="manualPrompt"
            :audio="failedItem"
        />

        <SpeakingPendingQueue
            v-if="!sending"
            @retry="send"
        />
    </LayoutPage>
</template>
