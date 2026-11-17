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
</script>

<template>
    <div class="kpis">
        <div>
            <strong>{{ words }}</strong>
            <span>từ</span>
        </div>
        <div v-if="durationS">
            <strong>{{ wpm ?? '–' }}</strong>
            <span>từ/phút</span>
        </div>
        <div v-if="fillerCount !== null">
            <strong>{{ fillerCount }}</strong>
            <span>từ đệm</span>
        </div>
        <div>
            <strong>{{ per100 ?? '–' }}</strong>
            <span>lỗi/100 từ</span>
        </div>
    </div>
</template>

<style scoped>
.kpis {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
    gap: 8px;
}

.kpis div {
    background: var(--bg);
    border-radius: 10px;
    padding: 8px;
    text-align: center;
}

.kpis strong {
    display: block;
    font-size: 1.25rem;
}

.kpis span {
    font-size: 0.8rem;
    color: var(--muted);
}
</style>
