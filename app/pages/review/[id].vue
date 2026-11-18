<script setup lang="ts">
import { PROCESSING_STALE_MS } from '#shared/constants/app'
import { buildManualPrompt, topicToText } from '#shared/utils/prompts'
import { fetchAttempt } from '~/api/attemptApi'
import { fetchMistakes } from '~/api/mistakeApi'
import { toApiFailure } from '~/api/http'
import { KIND_ICONS, KIND_LABELS, SOURCE_LABELS, STATUS_COLORS, STATUS_LABELS } from '~/constants'

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
    <LayoutPage wide>
        <UAlert
            v-if="error"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            :title="toApiFailure(error).message"
        />

        <div
            v-if="!data && !error"
            class="space-y-4"
        >
            <USkeleton class="h-10 w-64" />
            <USkeleton class="h-64 w-full rounded-xl" />
        </div>

        <template v-if="data && attempt">
            <header class="space-y-1">
                <div class="flex flex-wrap items-center gap-2">
                    <UIcon
                        :name="KIND_ICONS[attempt.kind]"
                        class="size-6 text-primary"
                        aria-hidden="true"
                    />
                    <h1 class="text-2xl font-semibold tracking-tight text-highlighted">
                        {{ KIND_LABELS[attempt.kind] }}
                        <span class="font-normal text-muted">v{{ attempt.version }}</span>
                    </h1>
                    <UBadge
                        :color="STATUS_COLORS[attempt.status]"
                        variant="subtle"
                        :label="STATUS_LABELS[attempt.status]"
                    />
                    <UBadge
                        v-if="attempt.timedResult"
                        :color="attempt.timedResult === 'in_time' ? 'success' : 'warning'"
                        variant="soft"
                        icon="i-lucide-timer"
                        :label="attempt.timedResult === 'in_time' ? 'Xong trong giờ' : 'Quá giờ'"
                    />
                    <UBadge
                        v-if="attempt.isBenchmark"
                        color="neutral"
                        variant="soft"
                        icon="i-lucide-target"
                        label="Đối chứng"
                    />
                    <UBadge
                        v-if="attempt.source !== 'gemini'"
                        color="neutral"
                        variant="soft"
                        :icon="
                            attempt.source === 'manual'
                                ? 'i-lucide-user-check'
                                : 'i-lucide-clipboard-paste'
                        "
                        :label="SOURCE_LABELS[attempt.source]"
                    />
                </div>
                <p class="text-sm text-muted">
                    {{ data.detail.topic?.title ?? 'Tự do' }} ·
                    {{ formatDateTime(attempt.createdAt) }}
                    <template v-if="attempt.durationS">
                        · {{ formatDuration(attempt.durationS) }}
                    </template>
                </p>
            </header>

            <audio
                v-if="audioUrl"
                :src="audioUrl"
                controls
                preload="metadata"
                class="w-full"
            />

            <!-- Processing / failed -->
            <UCard v-if="attempt.status === 'processing' && !stuck">
                <div class="flex items-center gap-3">
                    <UIcon
                        name="i-lucide-loader-circle"
                        class="size-6 animate-spin text-primary"
                        aria-hidden="true"
                    />
                    <p class="flex-1">Bài đang được chấm, thường mất dưới 1 phút.</p>
                    <UButton
                        color="neutral"
                        variant="outline"
                        icon="i-lucide-refresh-cw"
                        label="Tải lại"
                        @click="refresh()"
                    />
                </div>
            </UCard>
            <template v-if="attempt.status === 'failed' || stuck">
                <UAlert
                    color="error"
                    variant="subtle"
                    icon="i-lucide-circle-alert"
                    :title="
                        stuck
                            ? 'Chấm bài bị gián đoạn, bài chưa có kết quả.'
                            : (attempt.error ?? 'Chấm bài lỗi')
                    "
                    :description="`Gửi lại từ ${isSpeaking ? 'mục “Chưa gửi” ở Luyện nói' : 'bản nháp ở Luyện viết'} (cùng mã lượt nộp, không tạo trùng), hoặc chấm thủ công bên dưới.`"
                />
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
            <div
                v-if="attempt.status === 'confirmed'"
                class="grid gap-4 lg:grid-cols-2 lg:items-start"
            >
                <UCard>
                    <template #header>
                        <h2 class="font-semibold text-highlighted">
                            {{ isSpeaking ? 'Bản chép lời cuối' : 'Bài viết' }}
                        </h2>
                    </template>
                    <div class="space-y-4">
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
                            class="text-sm text-muted"
                        >
                            Tự chấm: {{ attempt.selfRating }}/5
                        </p>
                    </div>
                </UCard>
                <div class="space-y-4">
                    <UCard>
                        <template #header>
                            <h2 class="font-semibold text-highlighted">
                                Lỗi đã lưu ({{ data.detail.hits.length }})
                            </h2>
                        </template>
                        <p
                            v-if="!data.detail.hits.length"
                            class="text-sm text-muted"
                        >
                            Không có lỗi nào được lưu cho bài này.
                        </p>
                        <ul class="-my-2 divide-y divide-default">
                            <li
                                v-for="h in data.detail.hits"
                                :key="h.issueIndex"
                                class="space-y-1 py-3"
                            >
                                <BaseCorrectionPair
                                    :wrong="h.originalQuote"
                                    :right="h.correction"
                                />
                                <p class="text-xs text-muted">{{ h.labelVi }}</p>
                            </li>
                        </ul>
                    </UCard>
                    <UButton
                        v-if="attempt.version > 1"
                        block
                        color="neutral"
                        variant="outline"
                        icon="i-lucide-git-compare"
                        label="So với bản trước"
                        :to="`/compare/${attempt.attemptGroupId}?b=${attempt.id}`"
                    />
                    <UButton
                        block
                        size="lg"
                        :icon="isSpeaking ? 'i-lucide-repeat' : 'i-lucide-git-branch'"
                        :label="isSpeaking ? 'Nói lại' : 'Viết phiên bản mới'"
                        @click="retryAgain"
                    />
                </div>
            </div>
        </template>
    </LayoutPage>
</template>
