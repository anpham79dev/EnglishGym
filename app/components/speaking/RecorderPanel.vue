<script setup lang="ts">
import { MAX_RECORD_SECONDS } from '#shared/constants/app'
import type { Recording } from '~/composables/useRecorder'

const emit = defineEmits<{ recorded: [rec: Recording] }>()

const { state, elapsed, level, error, start, stop } = useRecorder((rec) => emit('recorded', rec))
const recording = computed(() => state.value === 'recording')
const remaining = computed(() => MAX_RECORD_SECONDS - elapsed.value)

// Progress ring around the record button.
const R = 54
const CIRC = 2 * Math.PI * R
const dashOffset = computed(() => CIRC * (1 - Math.min(1, elapsed.value / MAX_RECORD_SECONDS)))

/** Five bars driven by the input level, so a silent mic is visible at a glance. */
const bars = computed(() =>
    [0.5, 0.8, 1, 0.8, 0.5].map((w) => Math.max(0.12, Math.min(1, level.value * 2.2 * w))),
)
</script>

<template>
    <UCard>
        <div class="flex flex-col items-center gap-5 py-4">
            <UAlert
                v-if="error"
                color="error"
                variant="subtle"
                icon="i-lucide-mic-off"
                :title="error"
                class="w-full"
            />

            <div class="relative size-36">
                <svg
                    viewBox="0 0 120 120"
                    class="absolute inset-0 -rotate-90"
                    aria-hidden="true"
                >
                    <circle
                        cx="60"
                        cy="60"
                        :r="R"
                        fill="none"
                        stroke-width="6"
                        class="stroke-(--ui-border)"
                    />
                    <circle
                        cx="60"
                        cy="60"
                        :r="R"
                        fill="none"
                        stroke-width="6"
                        stroke-linecap="round"
                        :stroke-dasharray="CIRC"
                        :stroke-dashoffset="dashOffset"
                        class="stroke-(--ui-primary) transition-[stroke-dashoffset] duration-500"
                    />
                </svg>
                <button
                    type="button"
                    class="absolute inset-3 grid place-items-center rounded-full text-inverted shadow-lg transition-transform focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-95"
                    :class="recording ? 'bg-error' : 'bg-primary'"
                    :aria-label="recording ? 'Dừng ghi âm' : 'Bắt đầu ghi âm'"
                    @click="recording ? stop() : start()"
                >
                    <UIcon
                        :name="recording ? 'i-lucide-square' : 'i-lucide-mic'"
                        class="size-12"
                        aria-hidden="true"
                    />
                </button>
            </div>

            <div class="text-center">
                <p class="text-3xl font-semibold text-highlighted tabular-nums">
                    {{ formatDuration(elapsed) }}
                    <span class="text-base font-normal text-muted">
                        / {{ formatDuration(MAX_RECORD_SECONDS) }}
                    </span>
                </p>
                <p class="text-sm text-muted">
                    {{ recording ? `Bấm để dừng, còn ${remaining} giây` : 'Bấm để bắt đầu ghi' }}
                </p>
            </div>

            <div
                class="flex h-8 items-center gap-1"
                aria-hidden="true"
            >
                <span
                    v-for="(h, i) in bars"
                    :key="i"
                    class="w-1.5 rounded-full transition-[height] duration-75"
                    :class="recording ? 'bg-primary' : 'bg-accented'"
                    :style="{ height: `${recording ? h * 100 : 12}%` }"
                />
            </div>

            <p class="text-center text-xs text-muted">
                Nói 1–2 phút. Audio chỉ lưu trên máy này, server chỉ lưu chữ.
            </p>
        </div>
    </UCard>
</template>
