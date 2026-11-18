<script setup lang="ts">
import type { Mistake } from '#shared/types'
import { confirmAttempt, type AttemptDetail } from '~/api/attemptApi'
import { toApiFailure } from '~/api/http'

/**
 * Review form for a `needs_review` attempt. The parent re-mounts it with a new `key`
 * when the data changes, so the form state is rebuilt without manual scope handling.
 * Phone: "Bài" / "Lỗi" tabs. Desktop: text left, issues right.
 */
const props = defineProps<{ detail: AttemptDetail; mistakes: Mistake[] }>()
const emit = defineEmits<{ saved: [] }>()

const notify = useNotify()
const form = useReviewForm(props.detail, props.mistakes)
const { transcript, issues, checked, fillerCount, selfRating } = form
const knownKeys = computed(() => props.mistakes.map((m) => m.patternKey))
const isSpeaking = computed(() => props.detail.attempt.kind === 'speaking')

const tab = ref<'text' | 'issues'>('issues')
const tabs = computed(() => [
    {
        label: isSpeaking.value ? 'Bản chép lời' : 'Bài viết',
        value: 'text',
        icon: 'i-lucide-file-text',
    },
    {
        label: `Lỗi (${checked.value.length}/${issues.value.length})`,
        value: 'issues',
        icon: 'i-lucide-list-checks',
    },
])

const addIssue = () => {
    form.addManual()
    tab.value = 'issues'
}

const saving = ref(false)
const save = async () => {
    if (form.validationError.value) return notify.error(form.validationError.value)
    saving.value = true
    try {
        await confirmAttempt(props.detail.attempt.id, form.toBody())
        notify.success(`Đã lưu ${checked.value.length} lỗi vào sổ`)
        emit('saved')
    } catch (e) {
        notify.error(toApiFailure(e).message)
    } finally {
        saving.value = false
    }
}
</script>

<template>
    <div class="space-y-4">
        <UTabs
            v-model="tab"
            :items="tabs"
            :content="false"
            class="lg:hidden"
        />

        <div class="grid gap-4 lg:grid-cols-2 lg:items-start">
            <!-- Text -->
            <section
                class="space-y-4"
                :class="{ 'max-lg:hidden': tab !== 'text' }"
            >
                <UCard>
                    <template #header>
                        <div class="flex items-center justify-between gap-2">
                            <h2 class="font-semibold text-highlighted">
                                {{ isSpeaking ? 'Bản chép lời' : 'Bài viết' }}
                            </h2>
                            <span
                                v-if="isSpeaking"
                                class="text-xs text-muted"
                            >
                                Sửa chỗ AI nghe sai
                            </span>
                        </div>
                    </template>
                    <div class="space-y-4">
                        <UTextarea
                            v-if="isSpeaking"
                            v-model="transcript"
                            :rows="6"
                            autoresize
                            class="w-full"
                            aria-label="Bản chép lời"
                        />
                        <ReviewHighlightedText
                            :text="transcript"
                            :issues="
                                issues.map((i) => ({
                                    index: i.index,
                                    quote: i.quote,
                                    checked: i.checked,
                                }))
                            "
                        />
                    </div>
                </UCard>

                <UCard>
                    <div class="space-y-4">
                        <ReviewKpiPanel
                            :text="transcript"
                            :duration-s="detail.attempt.durationS"
                            :error-count="checked.length"
                            :filler-count="fillerCount"
                        />
                        <UFormField
                            v-if="isSpeaking"
                            label="Số từ đệm"
                            help="Chỉnh tay nếu đếm sai."
                        >
                            <UInputNumber
                                v-model="fillerCount"
                                :min="0"
                                class="w-36"
                            />
                        </UFormField>
                        <UFormField label="Tự chấm độ trôi chảy">
                            <div
                                class="flex gap-1"
                                role="radiogroup"
                                aria-label="Tự chấm độ trôi chảy"
                            >
                                <UButton
                                    v-for="n in 5"
                                    :key="n"
                                    :variant="selfRating === n ? 'solid' : 'outline'"
                                    :color="selfRating === n ? 'primary' : 'neutral'"
                                    class="size-11 justify-center"
                                    role="radio"
                                    :aria-checked="selfRating === n"
                                    :label="String(n)"
                                    @click="selfRating = n"
                                />
                            </div>
                        </UFormField>
                    </div>
                </UCard>
            </section>

            <!-- Issues -->
            <section
                class="space-y-3"
                :class="{ 'max-lg:hidden': tab !== 'issues' }"
            >
                <div class="flex items-center justify-between gap-2">
                    <h2 class="font-semibold text-highlighted">
                        Lỗi đề xuất
                        <span class="font-normal text-muted">
                            ({{ checked.length }}/{{ issues.length }} giữ)
                        </span>
                    </h2>
                    <UButton
                        icon="i-lucide-plus"
                        color="neutral"
                        variant="outline"
                        size="sm"
                        label="Thêm lỗi"
                        @click="addIssue"
                    />
                </div>
                <p class="text-xs text-muted">
                    Lỗi có đoạn trích khớp đã bật sẵn. Tắt lỗi nào thấy sai: lỗi tắt không vào sổ.
                    Lỗi viền vàng cần xem kỹ.
                </p>
                <UAlert
                    v-if="!issues.length"
                    color="neutral"
                    variant="soft"
                    icon="i-lucide-badge-check"
                    title="AI không thấy lỗi nào chắc chắn"
                    description="Tự thêm lỗi nếu bạn thấy chỗ sai."
                />
                <ReviewIssueEditor
                    v-for="issue in issues"
                    :key="issue.index"
                    :issue="issue"
                    :known-keys="knownKeys"
                    @remove="form.removeIssue(issue.index)"
                />
                <p
                    v-if="form.ai?.focus_pattern_suggestion"
                    class="text-xs text-muted"
                >
                    Gợi ý trọng tâm: {{ form.ai.focus_pattern_suggestion }}
                </p>
            </section>
        </div>

        <!-- Sticky save bar -->
        <div
            class="sticky bottom-20 z-10 flex items-center gap-3 rounded-xl border border-default bg-default/90 p-3 shadow-lg backdrop-blur lg:bottom-4"
        >
            <span class="flex-1 text-sm text-muted">
                Giữ {{ checked.length }}/{{ issues.length }} lỗi
            </span>
            <UButton
                size="lg"
                icon="i-lucide-save"
                :loading="saving"
                :label="`Lưu ${checked.length} lỗi vào sổ`"
                @click="save"
            />
        </div>
    </div>
</template>
