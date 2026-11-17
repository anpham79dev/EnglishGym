<script setup lang="ts">
import { MAX_RECORD_SECONDS } from '#shared/constants/app'
import type { Recording } from '~/composables/useRecorder'

const emit = defineEmits<{ recorded: [rec: Recording] }>()

const { state, elapsed, level, error, start, stop } = useRecorder((rec) => emit('recorded', rec))
const remaining = computed(() => MAX_RECORD_SECONDS - elapsed.value)
</script>

<template>
    <div class="card stack recorder">
        <p
            v-if="error"
            class="alert"
        >
            {{ error }}
        </p>
        <div class="timer">
            {{ formatDuration(elapsed) }}
            <span class="muted">/ {{ formatDuration(MAX_RECORD_SECONDS) }}</span>
        </div>
        <div
            class="meter"
            aria-hidden="true"
        >
            <div :style="{ width: `${Math.min(100, level * 160)}%` }" />
        </div>
        <button
            v-if="state !== 'recording'"
            class="btn btn-primary btn-block"
            @click="start"
        >
            ● Bắt đầu ghi
        </button>
        <button
            v-else
            class="btn btn-danger btn-block"
            @click="stop"
        >
            ■ Dừng ({{ remaining }}s còn lại)
        </button>
        <p class="muted">Nói 1–2 phút. Audio chỉ lưu trên máy này, server chỉ lưu chữ.</p>
    </div>
</template>

<style scoped>
.timer {
    font-size: 2rem;
    font-weight: 700;
    text-align: center;
    font-variant-numeric: tabular-nums;
}

.meter {
    height: 6px;
    background: var(--mark-off);
    border-radius: 3px;
    overflow: hidden;
}

.meter div {
    height: 100%;
    background: var(--primary);
    transition: width 80ms linear;
}
</style>
