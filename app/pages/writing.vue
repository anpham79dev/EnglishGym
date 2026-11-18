<script setup lang="ts">
import { MAX_WRITING_CHARS } from '#shared/constants/app'
import { countWords } from '#shared/utils/kpi'
import { buildManualPrompt, topicToText } from '#shared/utils/prompts'
import { fetchAttempt, submitWriting, type GradeChoice } from '~/api/attemptApi'
import { fetchTopics } from '~/api/topicApi'
import {
    isGraded,
    notGradedFailure,
    shouldOfferManualPrompt,
    toApiFailure,
    type ApiFailure,
} from '~/api/http'
import type { WritingDraft } from '~/composables/useLocalDb'

const route = useRoute()
const db = useLocalDb()
const confirm = useConfirm()
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
/** Text of the last failed submit; editing after a failure starts a new attempt id. */
let failedText: string | null = null

const topic = computed(() => topics.value.find((t) => t.id === draft.topicId) ?? null)
const words = computed(() => countWords(draft.text))

// N8: timed topic. The clock starts with the first keystroke; going over only warns, the
// text box stays editable, and the attempt records whether it was finished in time.
const timeLimit = computed(() => topic.value?.responseS ?? null)
const timerStart = ref<number | null>(null)
const now = ref(Date.now())
let clock: ReturnType<typeof setInterval> | undefined
watch(
    () => draft.text,
    (text) => {
        if (timeLimit.value && text && timerStart.value === null) timerStart.value = Date.now()
    },
)
watch(timeLimit, () => (timerStart.value = null))
onMounted(() => (clock = setInterval(() => (now.value = Date.now()), 1000)))
onBeforeUnmount(() => clearInterval(clock))
const timeLeft = computed(() =>
    timeLimit.value && timerStart.value !== null
        ? timeLimit.value - Math.floor((now.value - timerStart.value) / 1000)
        : timeLimit.value,
)
const overtime = computed(() => timeLeft.value !== null && timeLeft.value < 0)

onMounted(async () => {
    const fromId = route.query.from as string | undefined
    if (fromId) {
        // New version: same group, server bumps version.
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

// The failed request may still have been graded on the server; reusing its id would return
// that old result and drop the edits. A fresh id grades the new text (the old one stays in
// "Chờ bạn duyệt" if it did succeed).
watch(
    () => draft.text,
    (text) => {
        if (failedText === null || text === failedText) return
        draft.clientAttemptId = crypto.randomUUID()
        failedText = null
    },
)

const submit = async (choice?: GradeChoice) => {
    sending.value = true
    failure.value = null
    failedText = null
    await db.drafts.put({ ...toRaw(draft), updatedAt: Date.now() })
    const fail = async (f: ApiFailure) => {
        failure.value = f
        // Still being graded under this id: keep it so a resend picks up that result.
        if (f.code !== 'IN_PROGRESS') failedText = draft.text
        await db.drafts.update('current', { lastError: f.message })
    }
    try {
        const attempt = await submitWriting({
            clientAttemptId: draft.clientAttemptId,
            topicId: draft.topicId,
            attemptGroupId: draft.attemptGroupId,
            text: draft.text,
            choice,
            timedResult: timeLimit.value ? (overtime.value ? 'overtime' : 'in_time') : null,
        })
        // Keep the draft until the server has really graded it.
        if (!isGraded(attempt)) return await fail(notGradedFailure())
        await db.drafts.delete('current')
        await navigateTo(`/review/${attempt.id}`)
    } catch (e) {
        await fail(toApiFailure(e))
    } finally {
        sending.value = false
    }
}

const clearDraft = async () => {
    const ok = await confirm({
        title: 'Xoá bản nháp?',
        description: 'Nội dung đang viết sẽ mất.',
        confirmLabel: 'Xoá',
        danger: true,
    })
    if (!ok) return
    await db.drafts.delete('current')
    failedText = null
    timerStart.value = null
    Object.assign(draft, { text: '', clientAttemptId: crypto.randomUUID(), attemptGroupId: null })
}

const manualPrompt = computed(() =>
    buildManualPrompt('writing', topicToText(topic.value), draft.text),
)

// N1/N2: finish without Gemini. Opens by itself when Gemini fails in a way manual grading helps.
const showFallback = ref(false)
watch(failure, (f) => f && shouldOfferManualPrompt(f) && (showFallback.value = true))
</script>

<template>
    <LayoutPage title="Luyện viết">
        <template #actions>
            <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-eraser"
                label="Xoá nháp"
                :disabled="!draft.text"
                @click="clearDraft"
            />
        </template>

        <UAlert
            v-if="draft.attemptGroupId"
            color="primary"
            variant="subtle"
            icon="i-lucide-git-branch"
            title="Phiên bản mới"
            description="Sửa các lỗi đã duyệt rồi nộp lại."
        />

        <BaseTopicSelect
            v-model="draft.topicId"
            :topics="topics"
        />

        <UTextarea
            v-model="draft.text"
            :maxlength="MAX_WRITING_CHARS"
            :rows="14"
            autoresize
            :maxrows="30"
            placeholder="Tự viết bằng tiếng Anh. Bản nháp tự lưu trên máy."
            spellcheck="false"
            autocapitalize="sentences"
            size="xl"
            class="w-full"
            :ui="{ base: 'min-h-[50dvh] leading-relaxed' }"
            aria-label="Bài viết"
        />

        <UAlert
            v-if="failure"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            :title="failure.message"
        />
        <BaseGradeFallback
            v-if="showFallback"
            kind="writing"
            :prompt="manualPrompt"
            :sending="sending"
            @submit="submit"
        />
        <UButton
            v-else
            color="neutral"
            variant="link"
            icon="i-lucide-sparkles"
            label="Không dùng Gemini: dán JSON hoặc tự duyệt"
            class="px-0"
            :disabled="draft.text.trim().length < 10"
            @click="showFallback = true"
        />

        <!-- Sticky submit bar: stays above the bottom nav and the on-screen keyboard. -->
        <div
            class="sticky bottom-20 z-10 flex items-center gap-3 rounded-xl border border-default bg-default/90 p-3 shadow-lg backdrop-blur lg:bottom-4"
        >
            <span class="flex-1 text-sm text-muted tabular-nums">
                {{ words }} từ · {{ draft.text.length }}/{{ MAX_WRITING_CHARS }}
            </span>
            <UBadge
                v-if="timeLimit"
                :color="overtime ? 'warning' : 'neutral'"
                variant="subtle"
                size="lg"
                icon="i-lucide-timer"
                class="tabular-nums"
                :label="
                    overtime
                        ? `Quá giờ ${formatDuration(-timeLeft!)}`
                        : timerStart === null
                          ? `${formatDuration(timeLimit)}, tính khi bắt đầu gõ`
                          : formatDuration(timeLeft!)
                "
                aria-live="polite"
            />
            <UButton
                size="lg"
                icon="i-lucide-send"
                :loading="sending"
                :disabled="draft.text.trim().length < 10"
                :label="sending ? 'Đang chấm' : 'Nộp để nhận gợi ý'"
                @click="submit()"
            />
        </div>
    </LayoutPage>
</template>
