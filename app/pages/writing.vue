<script setup lang="ts">
import { MAX_WRITING_CHARS } from '#shared/constants/app'
import { countWords } from '#shared/utils/kpi'
import { buildManualPrompt } from '#shared/utils/prompts'
import { fetchAttempt, fetchTopics, submitWriting } from '~/api/attemptApi'
import { shouldOfferManualPrompt, toApiFailure, type ApiFailure } from '~/api/http'
import type { WritingDraft } from '~/composables/useLocalDb'

const route = useRoute()
const db = useLocalDb()
const { data: topics } = await useAsyncData('topics-writing', () => fetchTopics('writing'), {
    default: () => [],
})

const draft = reactive<WritingDraft>({
    id: 'current',
    clientAttemptId: crypto.randomUUID(),
    topicId: (route.query.topic as string) || topics.value[0]?.id || null,
    attemptGroupId: null,
    text: '',
    updatedAt: Date.now(),
})
const loaded = ref(false)
const sending = ref(false)
const failure = ref<ApiFailure | null>(null)

const topic = computed(() => topics.value.find((t) => t.id === draft.topicId) ?? null)
const words = computed(() => countWords(draft.text))

onMounted(async () => {
    const fromId = route.query.from as string | undefined
    if (fromId) {
        // Phiên bản mới của bài đã nộp: cùng attempt_group_id, version tăng ở server.
        const { attempt } = await fetchAttempt(fromId)
        Object.assign(draft, {
            clientAttemptId: crypto.randomUUID(),
            topicId: attempt.topicId,
            attemptGroupId: attempt.attemptGroupId,
            text: attempt.finalTranscript ?? attempt.textOrTranscript ?? '',
        })
    } else {
        const saved = await db.drafts.get('current')
        if (
            saved &&
            saved.text.trim() &&
            (!route.query.topic || saved.topicId === route.query.topic)
        )
            Object.assign(draft, saved)
    }
    loaded.value = true
})

let saveTimer: ReturnType<typeof setTimeout> | undefined
watch(
    () => [draft.text, draft.topicId],
    () => {
        if (!loaded.value) return
        clearTimeout(saveTimer)
        saveTimer = setTimeout(() => db.drafts.put({ ...toRaw(draft), updatedAt: Date.now() }), 400)
    },
)

const submit = async () => {
    sending.value = true
    failure.value = null
    await db.drafts.put({ ...toRaw(draft), updatedAt: Date.now() })
    try {
        const attempt = await submitWriting({
            clientAttemptId: draft.clientAttemptId,
            topicId: draft.topicId,
            attemptGroupId: draft.attemptGroupId,
            text: draft.text,
        })
        await db.drafts.delete('current')
        await navigateTo(`/review/${attempt.id}`)
    } catch (e) {
        failure.value = toApiFailure(e)
        await db.drafts.update('current', { lastError: failure.value.message })
    } finally {
        sending.value = false
    }
}

const clearDraft = async () => {
    if (!confirm('Xoá bản nháp hiện tại?')) return
    await db.drafts.delete('current')
    Object.assign(draft, { text: '', clientAttemptId: crypto.randomUUID(), attemptGroupId: null })
}

const manualPrompt = computed(() =>
    buildManualPrompt(
        'writing',
        topic.value ? `${topic.value.title}. ${topic.value.prompt}` : 'Free topic',
        draft.text,
    ),
)
</script>

<template>
    <main class="page">
        <h1>Luyện viết</h1>
        <p
            v-if="draft.attemptGroupId"
            class="alert alert-ok"
        >
            Đang viết phiên bản mới. Sửa các lỗi đã duyệt rồi nộp lại.
        </p>

        <BaseTopicSelect
            v-model="draft.topicId"
            :topics="topics"
        />

        <div class="card stack">
            <textarea
                v-model="draft.text"
                :maxlength="MAX_WRITING_CHARS"
                rows="12"
                placeholder="Tự viết bằng tiếng Anh. Bản nháp tự lưu trên máy."
                spellcheck="false"
                autocapitalize="sentences"
            />
            <div class="spread">
                <span class="muted">
                    {{ words }} từ · {{ draft.text.length }}/{{ MAX_WRITING_CHARS }}
                </span>
                <button
                    class="btn btn-sm"
                    :disabled="!draft.text"
                    @click="clearDraft"
                >
                    Xoá nháp
                </button>
            </div>
            <button
                class="btn btn-primary btn-block"
                :disabled="sending || draft.text.trim().length < 10"
                @click="submit"
            >
                {{ sending ? 'Đang chấm…' : 'Nộp để nhận gợi ý lỗi' }}
            </button>
        </div>

        <p
            v-if="failure"
            class="alert"
        >
            {{ failure.message }}
        </p>
        <BaseCopyPrompt
            v-if="failure && shouldOfferManualPrompt(failure)"
            :prompt="manualPrompt"
        />
    </main>
</template>
