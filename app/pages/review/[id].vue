<script setup lang="ts">
import { buildManualPrompt } from '#shared/utils/prompts'
import { confirmAttempt, fetchAttempt } from '~/api/attemptApi'
import { fetchMistakes } from '~/api/mistakeApi'
import { toApiFailure } from '~/api/http'
import { STATUS_LABELS } from '~/constants'

const route = useRoute()
const id = route.params.id as string
const toast = useToast()

const { data, error, refresh } = await useAsyncData(`attempt-${id}`, async () => {
    const [detail, mistakes] = await Promise.all([fetchAttempt(id), fetchMistakes()])
    return { detail, mistakes }
})

// Rebuild the form on new data; own scope so old watchers are disposed.
const form = shallowRef<ReturnType<typeof useReviewForm> | null>(null)
let formScope: ReturnType<typeof effectScope> | null = null
watch(
    data,
    (d) => {
        formScope?.stop()
        formScope = null
        form.value = null
        if (d?.detail.attempt.status !== 'needs_review') return
        formScope = effectScope()
        form.value = formScope.run(() => useReviewForm(d.detail, d.mistakes)) ?? null
    },
    { immediate: true },
)
onScopeDispose(() => formScope?.stop())
const knownKeys = computed(() => data.value?.mistakes.map((m) => m.patternKey) ?? [])
const attempt = computed(() => data.value?.detail.attempt)
const isSpeaking = computed(() => attempt.value?.kind === 'speaking')
const topicText = computed(() => {
    const t = data.value?.detail.topic
    return t ? `${t.title}. ${t.prompt}` : 'Free topic'
})

// Local audio exists only on the recording device.
const audioUrl = ref<string | null>(null)
onMounted(async () => {
    if (!attempt.value || !isSpeaking.value) return
    const local = await useLocalDb().audios.get(attempt.value.clientAttemptId)
    if (local) audioUrl.value = URL.createObjectURL(local.blob)
})
onBeforeUnmount(() => audioUrl.value && URL.revokeObjectURL(audioUrl.value))

const saving = ref(false)
const save = async () => {
    const f = form.value
    if (!f) return
    if (f.validationError.value) return toast.error(f.validationError.value)
    saving.value = true
    try {
        await confirmAttempt(id, f.toBody())
        toast.success(`Đã lưu ${f.checked.value.length} lỗi vào sổ`)
        await refresh()
    } catch (e) {
        toast.error(toApiFailure(e).message)
    } finally {
        saving.value = false
    }
}

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
                v-if="attempt.status === 'processing'"
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
            <template v-if="attempt.status === 'failed'">
                <p class="alert">{{ attempt.error }}</p>
                <p class="muted">
                    Gửi lại từ
                    {{ isSpeaking ? 'mục "Chưa gửi" ở Luyện nói' : 'bản nháp ở Luyện viết' }} (cùng
                    mã lượt nộp, không tạo trùng).
                </p>
                <BaseCopyPrompt
                    :prompt="
                        buildManualPrompt(attempt.kind, topicText, attempt.textOrTranscript ?? '')
                    "
                />
            </template>

            <!-- Review -->
            <template v-if="form">
                <div class="card stack">
                    <div class="spread">
                        <h2>{{ isSpeaking ? 'Bản chép lời' : 'Bài viết' }}</h2>
                        <span
                            v-if="isSpeaking"
                            class="muted"
                        >
                            Sửa chỗ AI nghe sai
                        </span>
                    </div>
                    <textarea
                        v-if="isSpeaking"
                        v-model="form.transcript.value"
                        rows="8"
                    />
                    <ReviewHighlightedText
                        :text="form.transcript.value"
                        :issues="
                            form.issues.value.map((i) => ({
                                index: i.index,
                                quote: i.quote,
                                checked: i.checked,
                            }))
                        "
                    />
                </div>

                <div class="card">
                    <div class="spread">
                        <h2>
                            Lỗi đề xuất ({{ form.checked.value.length }}/{{
                                form.issues.value.length
                            }}
                            giữ)
                        </h2>
                        <button
                            class="btn btn-sm"
                            @click="form.addManual()"
                        >
                            + Thêm
                        </button>
                    </div>
                    <p class="muted">
                        Mặc định đã tick. Bỏ tick lỗi nào thấy sai: lỗi bỏ tick không vào sổ.
                    </p>
                    <p
                        v-if="!form.issues.value.length"
                        class="muted"
                    >
                        AI không thấy lỗi nào chắc chắn.
                    </p>
                    <ReviewIssueEditor
                        v-for="issue in form.issues.value"
                        :key="issue.index"
                        :model-value="issue"
                        :known-keys="knownKeys"
                        @remove="form.removeIssue(issue.index)"
                    />
                    <p
                        v-if="form.ai?.focus_pattern_suggestion"
                        class="muted"
                    >
                        Gợi ý trọng tâm: {{ form.ai.focus_pattern_suggestion }}
                    </p>
                </div>

                <div class="card stack">
                    <ReviewKpiPanel
                        :text="form.transcript.value"
                        :duration-s="attempt.durationS"
                        :error-count="form.checked.value.length"
                        :filler-count="form.fillerCount.value"
                    />
                    <div v-if="isSpeaking">
                        <label for="fillers">Số từ đệm (chỉnh tay nếu đếm sai)</label>
                        <input
                            id="fillers"
                            v-model.number="form.fillerCount.value"
                            type="number"
                            min="0"
                            inputmode="numeric"
                        />
                    </div>
                    <div>
                        <label>Tự chấm độ trôi chảy</label>
                        <div class="row">
                            <button
                                v-for="n in 5"
                                :key="n"
                                class="btn btn-sm"
                                :class="{ 'btn-primary': form.selfRating.value === n }"
                                @click="form.selfRating.value = n"
                            >
                                {{ n }}
                            </button>
                        </div>
                    </div>
                    <button
                        class="btn btn-primary btn-block"
                        :disabled="saving"
                        @click="save"
                    >
                        {{ saving ? 'Đang lưu…' : `Lưu ${form.checked.value.length} lỗi vào sổ` }}
                    </button>
                </div>
            </template>

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
