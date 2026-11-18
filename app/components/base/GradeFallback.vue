<script setup lang="ts">
import type { AttemptKind } from '#shared/types'
import type { GradeChoice } from '~/api/attemptApi'

/**
 * Ways to finish an attempt without Gemini (N1, N2):
 * - paste the JSON another AI returned for the manual prompt
 * - self-review: no AI suggestions, add mistakes yourself on the review screen
 */
const props = defineProps<{
    kind: AttemptKind
    prompt: string
    audio?: { blob: Blob; mimeType: string } | null
    sending?: boolean
}>()
const emit = defineEmits<{ submit: [choice: GradeChoice] }>()

const tab = ref<'pasted' | 'manual'>('pasted')
const tabs = [
    { label: 'Dán JSON từ AI khác', value: 'pasted', icon: 'i-lucide-clipboard-paste' },
    { label: 'Tự duyệt', value: 'manual', icon: 'i-lucide-user-check' },
]
const pastedJson = ref('')
const transcript = ref('')
const isSpeaking = computed(() => props.kind === 'speaking')
</script>

<template>
    <UCard>
        <template #header>
            <div class="space-y-1">
                <h2 class="font-semibold text-highlighted">Hoàn thành bài không cần Gemini</h2>
                <p class="text-sm text-muted">
                    Không tốn lượt chấm. Lỗi vẫn chỉ vào sổ sau khi bạn duyệt.
                </p>
            </div>
        </template>

        <div class="space-y-4">
            <UTabs
                v-model="tab"
                :items="tabs"
                :content="false"
                size="sm"
            />

            <template v-if="tab === 'pasted'">
                <ol class="list-inside list-decimal space-y-1 text-sm text-toned">
                    <li>
                        Copy prompt{{ isSpeaking ? ' và tải file audio' : '' }}, dán vào ChatGPT,
                        Claude hoặc Gemini web.
                    </li>
                    <li>Dán nguyên câu trả lời JSON vào ô bên dưới.</li>
                </ol>
                <BaseCopyPrompt
                    :prompt="prompt"
                    :audio="audio"
                />
                <UFormField
                    label="Kết quả JSON"
                    help="Có khối ```json hay câu dẫn xung quanh cũng được, app tự bỏ."
                >
                    <UTextarea
                        v-model="pastedJson"
                        :rows="6"
                        autoresize
                        :maxrows="16"
                        placeholder='{"issues": [...], "focus_pattern_suggestion": "..."}'
                        class="w-full font-mono text-xs"
                    />
                </UFormField>
                <UButton
                    block
                    icon="i-lucide-check"
                    label="Dùng kết quả này"
                    :loading="sending"
                    :disabled="!pastedJson.trim()"
                    @click="emit('submit', { mode: 'pasted', pastedJson })"
                />
            </template>

            <template v-else>
                <p class="text-sm text-toned">
                    Không có gợi ý của AI. Ở màn hình duyệt, bạn dùng nút "Thêm lỗi" để tự ghi lỗi
                    mình thấy.
                </p>
                <UFormField
                    v-if="isSpeaking"
                    label="Bản chép lời"
                    help="Nghe lại bản ghi và gõ đúng những gì bạn đã nói, kể cả chỗ sai."
                    required
                >
                    <UTextarea
                        v-model="transcript"
                        :rows="5"
                        autoresize
                        class="w-full"
                    />
                </UFormField>
                <UButton
                    block
                    color="neutral"
                    variant="outline"
                    icon="i-lucide-user-check"
                    label="Tự duyệt, không chấm AI"
                    :loading="sending"
                    :disabled="isSpeaking && !transcript.trim()"
                    @click="emit('submit', { mode: 'manual', transcript })"
                />
            </template>
        </div>
    </UCard>
</template>
