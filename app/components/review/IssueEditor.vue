<script setup lang="ts">
import { CATEGORY_LABELS } from '~/constants'
import type { EditableIssue } from '~/composables/useReviewForm'

/**
 * Edits the review form's issue object in place (it is reactive and owned by useReviewForm).
 * This is deliberately not a two-way v-model: the parent never receives an update event.
 */
const props = defineProps<{ issue: EditableIssue; knownKeys: string[] }>()
const emit = defineEmits<{ remove: [] }>()

// A new manual issue opens straight into the editor.
const editing = ref(props.issue.manual && !props.issue.quote)
const suspicious = computed(() => !props.issue.matched || props.issue.tooLong)
const categoryLabel = computed(
    () =>
        CATEGORY_LABELS[props.issue.category as keyof typeof CATEGORY_LABELS] ??
        props.issue.category,
)
</script>

<template>
    <div
        class="rounded-xl border p-3 transition-opacity"
        :class="[
            suspicious ? 'border-warning/60 bg-warning/5' : 'border-default',
            issue.checked ? '' : 'opacity-60',
        ]"
    >
        <div class="flex items-start gap-3">
            <USwitch
                v-model="issue.checked"
                :aria-label="`Giữ lỗi #${issue.index + 1}`"
                class="mt-0.5"
            />
            <div class="min-w-0 flex-1 space-y-1.5">
                <div class="flex flex-wrap items-center gap-1.5">
                    <span class="text-sm font-semibold text-highlighted">
                        #{{ issue.index + 1 }}
                    </span>
                    <UBadge
                        color="neutral"
                        variant="soft"
                        size="sm"
                        :label="categoryLabel"
                    />
                    <UBadge
                        v-if="issue.manual"
                        color="primary"
                        variant="soft"
                        size="sm"
                        label="Tự thêm"
                    />
                    <UBadge
                        v-if="issue.selfFound"
                        color="success"
                        variant="subtle"
                        size="sm"
                        icon="i-lucide-scan-search"
                        label="Bạn tự bắt được"
                    />
                    <UBadge
                        v-if="!issue.matched"
                        color="warning"
                        variant="subtle"
                        size="sm"
                        icon="i-lucide-search-x"
                        label="Đoạn trích không khớp"
                    />
                    <UBadge
                        v-if="issue.tooLong"
                        color="warning"
                        variant="subtle"
                        size="sm"
                        icon="i-lucide-triangle-alert"
                        label="Nghi viết lại cả đoạn"
                    />
                </div>
                <BaseCorrectionPair
                    v-if="issue.quote"
                    :wrong="issue.quote"
                    :right="issue.correction"
                    :class="{ 'line-through decoration-muted': !issue.checked }"
                />
                <p class="text-sm text-toned">{{ issue.reasonVi }}</p>
                <p class="text-xs text-muted">
                    Kiểu lỗi: {{ issue.labelVi || 'chưa đặt' }}
                    <code class="ml-1 rounded bg-elevated px-1">{{ issue.patternKey || '—' }}</code>
                </p>
            </div>
            <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="sm"
                :aria-label="`Sửa lỗi #${issue.index + 1}`"
                @click="editing = true"
            />
        </div>

        <USlideover
            v-model:open="editing"
            :title="`Sửa lỗi #${issue.index + 1}`"
            description="Bạn chốt đoạn sai, cách sửa và kiểu lỗi trước khi lưu vào sổ."
        >
            <template #body>
                <div class="space-y-4">
                    <UFormField
                        label="Đoạn sai"
                        help="Chép nguyên văn từ bài để được tô sáng."
                    >
                        <UInput
                            v-model="issue.quote"
                            class="w-full"
                        />
                    </UFormField>
                    <UFormField label="Sửa thành">
                        <UInput
                            v-model="issue.correction"
                            class="w-full"
                        />
                    </UFormField>
                    <UFormField
                        label="Kiểu lỗi"
                        help="Chọn kiểu đã có hoặc gõ kiểu mới, ví dụ past-simple-time-marker."
                    >
                        <UInputMenu
                            v-model="issue.patternKey"
                            :items="knownKeys"
                            create-item
                            class="w-full"
                            @create="(v: string) => (issue.patternKey = v)"
                        />
                    </UFormField>
                    <UFormField label="Nhãn tiếng Việt">
                        <UInput
                            v-model="issue.labelVi"
                            class="w-full"
                        />
                    </UFormField>
                </div>
            </template>
            <template #footer>
                <div class="flex w-full justify-between gap-2">
                    <UButton
                        v-if="issue.manual"
                        color="error"
                        variant="ghost"
                        icon="i-lucide-trash-2"
                        label="Xoá lỗi này"
                        @click="emit('remove')"
                    />
                    <UButton
                        class="ml-auto"
                        icon="i-lucide-check"
                        label="Xong"
                        @click="editing = false"
                    />
                </div>
            </template>
        </USlideover>
    </div>
</template>
