<script setup lang="ts">
import { PROCESSING_STALE_MS } from '#shared/constants/app'
import { buildManualPrompt, topicToText } from '#shared/utils/prompts'
import { fetchAttempt } from '~/api/attemptApi'
import { fetchMistakes } from '~/api/mistakeApi'
import { toApiFailure } from '~/api/http'
import { STATUS_LABELS } from '~/constants'

const route = useRoute()
const id = route.params.id as string

const { data, error, refresh } = await useAsyncData(`attempt-${id}`, async () => {
    const [detail, mistakes] = await Promise.all([fetchAttempt(id), fetchMistakes()])
    return { detail, mistakes }
})

const attempt = computed(() => data.value?.detail.attempt)
const isSpeaking = computed(() => attempt.value?.kind === 'speaking')
const manualPrompt = computed(() =>
    attempt.value
        ? buildManualPrompt(
              attempt.value.kind,
              topicToText(data.value?.detail.topic),
              attempt.value.textOrTranscript ?? '',
          )
        : '',
)
/** Grading died mid-way (e.g. the function hit its time limit): treat it like `failed`. */
const stuck = computed(
    () =>
        attempt.value?.status === 'processing' &&
        Date.now() - (attempt.value.processingAt ?? attempt.value.createdAt) > PROCESSING_STALE_MS,
)

// Local audio exists only on the recording device.
const audioUrl = ref<string | null>(null)
onMounted(async () => {
    if (!attempt.value || !isSpeaking.value) return
    const local = await useLocalDb().audios.get(attempt.value.clientAttemptId)
    if (local) audioUrl.value = URL.createObjectURL(local.blob)
})
onBeforeUnmount(() => audioUrl.value && URL.revokeObjectURL(audioUrl.value))

const retryAgain = () =>
    navigateTo(
        isSpeaking.value
            ? {
                  path: '/speaking',
                  query: {
                      topic: attempt.value?.topicId ?? undefined,
                      group: attempt.value?.attemptGroupId,
                  },
              }
            : { path: '/writing', query: { from: id } },
    )
</script>

<template>
    <main class="page">
        <p
            v-if="error"
            class="alert"
        >
            {{ toApiFailure(error).message }}
        </p>

        <template v-if="data && attempt">
            <div class="spread">
                <h1>{{ isSpeaking ? '🎙 Bài nói' : '✎ Bài viết' }} · v{{ attempt.version }}</h1>
                <span class="badge">{{ STATUS_LABELS[attempt.status] }}</span>
            </div>
            <p class="muted">
                {{ data.detail.topic?.title ?? 'Tự do' }} · {{ formatDateTime(attempt.createdAt) }}
                <template v-if="attempt.durationS">
                    · {{ formatDuration(attempt.durationS) }}
                </template>
            </p>

            <audio
                v-if="audioUrl"
                :src="audioUrl"
                controls
                preload="metadata"
                style="width: 100%; margin-bottom: 12px"
            />

            <!-- Processing / failed -->
            <div
                v-if="attempt.status === 'processing' && !stuck"
                class="card stack"
            >
                <p>Bài đang được chấm.</p>
                <button
                    class="btn"
                    @click="refresh()"
                >
                    Tải lại
                </button>
            </div>
            <template v-if="attempt.status === 'failed' || stuck">
                <p class="alert">
                    {{ stuck ? 'Chấm bài bị gián đoạn, bài chưa có kết quả.' : attempt.error }}
                </p>
                <p class="muted">
                    Gửi lại từ
                    {{ isSpeaking ? 'mục "Chưa gửi" ở Luyện nói' : 'bản nháp ở Luyện viết' }} (cùng
                    mã lượt nộp, không tạo trùng).
                </p>
                <BaseCopyPrompt :prompt="manualPrompt" />
            </template>

            <!-- Review: re-mounted whenever the attempt changes -->
            <ReviewForm
                v-if="attempt.status === 'needs_review'"
                :key="attempt.id + attempt.status"
                :detail="data.detail"
                :mistakes="data.mistakes"
                @saved="refresh()"
            />

            <!-- Confirmed -->
            <template v-if="attempt.status === 'confirmed'">
                <div class="card stack">
                    <h2>{{ isSpeaking ? 'Bản chép lời cuối' : 'Bài viết' }}</h2>
                    <ReviewHighlightedText
                        :text="attempt.finalTranscript ?? ''"
                        :issues="
                            data.detail.hits.map((h) => ({
                                index: h.issueIndex,
                                quote: h.originalQuote,
                                checked: true,
                            }))
                        "
                    />
                    <ReviewKpiPanel
                        :text="attempt.finalTranscript ?? ''"
                        :duration-s="attempt.durationS"
                        :error-count="data.detail.hits.length"
                        :filler-count="attempt.fillerCount"
                    />
                    <p
                        v-if="attempt.selfRating"
                        class="muted"
                    >
                        Tự chấm: {{ attempt.selfRating }}/5
                    </p>
                </div>
                <div class="card">
                    <h2>Lỗi đã lưu ({{ data.detail.hits.length }})</h2>
                    <p
                        v-for="h in data.detail.hits"
                        :key="h.issueIndex"
                    >
                        <s>{{ h.originalQuote }}</s>
                        →
                        <strong>{{ h.correction }}</strong>
                        <span class="muted">· {{ h.labelVi }}</span>
                    </p>
                </div>
                <button
                    class="btn btn-primary btn-block"
                    @click="retryAgain"
                >
                    {{ isSpeaking ? 'Nói lại' : 'Viết phiên bản mới' }}
                </button>
            </template>
        </template>
    </main>
</template>
