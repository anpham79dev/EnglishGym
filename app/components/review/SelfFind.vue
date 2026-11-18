<script setup lang="ts">
import { markedSpans, tokenize, type Span } from '#shared/utils/selfFind'

/**
 * N9 self-find step: tap the words you think are wrong before the AI suggestions show.
 * Tapping works one-handed on a phone, unlike text selection. Marked words are tinted and
 * underlined (not colour alone), and expose aria-pressed for screen readers.
 */
const props = defineProps<{ text: string }>()
const emit = defineEmits<{ done: [spans: Span[] | null] }>()

const tokens = computed(() => tokenize(props.text))
const marked = ref(new Set<number>())
const toggle = (i: number) => {
    const next = new Set(marked.value)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    marked.value = next
}
const spans = computed(() => markedSpans(props.text, tokens.value, marked.value))
</script>

<template>
    <div class="space-y-4">
        <UAlert
            color="primary"
            variant="subtle"
            icon="i-lucide-scan-search"
            title="Tự tìm lỗi trước"
            description="Chạm vào những từ bạn nghi là sai (chạm lại để bỏ). Sau đó mới xem gợi ý của AI. Tự nhận ra lỗi giúp tiến bộ nhanh hơn đọc gợi ý."
        />
        <UCard>
            <p class="leading-loose">
                <template
                    v-for="(t, i) in tokens"
                    :key="i"
                >
                    <button
                        v-if="t.word"
                        type="button"
                        class="rounded px-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-primary"
                        :class="
                            marked.has(i)
                                ? 'bg-warning/20 text-highlighted underline decoration-warning decoration-2 underline-offset-4'
                                : 'hover:bg-elevated'
                        "
                        :aria-pressed="marked.has(i)"
                        @click="toggle(i)"
                    >
                        {{ t.text }}
                    </button>
                    <span v-else>{{ t.text }}</span>
                </template>
            </p>
        </UCard>

        <div
            class="sticky bottom-20 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-default bg-default/90 p-3 shadow-lg backdrop-blur lg:bottom-4"
        >
            <span class="flex-1 text-sm text-muted">Đã đánh dấu {{ spans.length }} chỗ</span>
            <UButton
                color="neutral"
                variant="ghost"
                label="Bỏ qua bước này"
                @click="emit('done', null)"
            />
            <UButton
                size="lg"
                icon="i-lucide-eye"
                label="Xem gợi ý của AI"
                @click="emit('done', spans)"
            />
        </div>
    </div>
</template>
