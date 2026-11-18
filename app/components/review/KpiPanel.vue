<script setup lang="ts">
import { countWords, errorsPer100Words, wordsPerMinute } from '#shared/utils/kpi'

const props = defineProps<{
    text: string
    durationS: number | null
    errorCount: number
    fillerCount: number | null
}>()

const words = computed(() => countWords(props.text))
const wpm = computed(() => (props.durationS ? wordsPerMinute(words.value, props.durationS) : null))
const per100 = computed(() => errorsPer100Words(props.errorCount, words.value))

const tiles = computed(() =>
    [
        { value: words.value, label: 'từ', show: true },
        { value: wpm.value ?? '–', label: 'từ/phút', show: !!props.durationS },
        { value: props.fillerCount, label: 'từ đệm', show: props.fillerCount !== null },
        { value: per100.value ?? '–', label: 'lỗi/100 từ', show: true },
    ].filter((t) => t.show),
)
</script>

<template>
    <dl class="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div
            v-for="t in tiles"
            :key="t.label"
            class="rounded-lg bg-elevated px-3 py-2 text-center"
        >
            <dd class="text-xl font-semibold text-highlighted tabular-nums">{{ t.value }}</dd>
            <dt class="text-xs text-muted">{{ t.label }}</dt>
        </div>
    </dl>
</template>
