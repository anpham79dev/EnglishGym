<script setup lang="ts">
import { MAX_RECORD_SECONDS } from '#shared/constants/app'
import type { Recording } from '~/composables/useRecorder'

/**
 * Record button. With a timed topic (N8, TOEIC style) it becomes:
 * "Bắt đầu chuẩn bị" (opens the mic during the tap) -> prep countdown -> recording starts on
 * its own -> stops by itself when the response time is up.
 */
const props = defineProps<{ prepSeconds?: number | null; responseSeconds?: number | null }>()
const emit = defineEmits<{ recorded: [rec: Recording] }>()

const limit = computed(() =>
    Math.min(props.responseSeconds || MAX_RECORD_SECONDS, MAX_RECORD_SECONDS),
)
const timed = computed(() => !!props.responseSeconds)
const { state, elapsed, level, error, acquire, start, stop } = useRecorder(
    (rec) => emit('recorded', rec),
    () => limit.value,
)
const recording = computed(() => state.value === 'recording')
const remaining = computed(() => limit.value - elapsed.value)

// Prep countdown (timed topics only).
const prepLeft = ref<number | null>(null)
let prepTimer: ReturnType<typeof setInterval> | undefined
let prepStream: MediaStream | null = null
const startPrep = async () => {
    prepStream = await acquire()
    if (!prepStream) return
    prepLeft.value = props.prepSeconds ?? 0
    const begin = () => {
        clearInterval(prepTimer)
        prepLeft.value = null
        const s = prepStream
        prepStream = null
        start(s)
    }
    if (!prepLeft.value) return begin()
    prepTimer = setInterval(() => {
        prepLeft.value = (prepLeft.value ?? 1) - 1
        if (prepLeft.value <= 0) begin()
    }, 1000)
}
onBeforeUnmount(() => {
    clearInterval(prepTimer)
    prepStream?.getTracks().forEach((t) => t.stop())
})

const onMainClick = () => {
    if (recording.value) return stop()
    if (prepLeft.value !== null) return
    if (timed.value && props.prepSeconds) return startPrep()
    start()
}

// Progress ring: prep counts down, recording fills up.
const R = 54
const CIRC = 2 * Math.PI * R
const progress = computed(() =>
    prepLeft.value !== null
        ? prepLeft.value / (props.prepSeconds || 1)
        : Math.min(1, elapsed.value / limit.value),
)
const dashOffset = computed(() => CIRC * (1 - progress.value))

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
            <UBadge
                v-if="timed"
                color="primary"
                variant="subtle"
                icon="i-lucide-timer"
                :label="`Chuẩn bị ${prepSeconds ?? 0} giây · Trả lời ${limit} giây`"
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
                        class="transition-[stroke-dashoffset] duration-500"
                        :class="
                            prepLeft !== null ? 'stroke-(--ui-warning)' : 'stroke-(--ui-primary)'
                        "
                    />
                </svg>
                <button
                    type="button"
                    class="absolute inset-3 grid place-items-center rounded-full text-inverted shadow-lg transition-transform focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-95 disabled:opacity-80"
                    :class="
                        recording ? 'bg-error' : prepLeft !== null ? 'bg-warning' : 'bg-primary'
                    "
                    :disabled="prepLeft !== null"
                    :aria-label="
                        recording
                            ? 'Dừng ghi âm'
                            : prepLeft !== null
                              ? `Đang chuẩn bị, còn ${prepLeft} giây`
                              : timed && prepSeconds
                                ? 'Bắt đầu chuẩn bị'
                                : 'Bắt đầu ghi âm'
                    "
                    @click="onMainClick"
                >
                    <span
                        v-if="prepLeft !== null"
                        class="text-4xl font-semibold tabular-nums"
                    >
                        {{ prepLeft }}
                    </span>
                    <UIcon
                        v-else
                        :name="
                            recording
                                ? 'i-lucide-square'
                                : timed && prepSeconds
                                  ? 'i-lucide-timer'
                                  : 'i-lucide-mic'
                        "
                        class="size-12"
                        aria-hidden="true"
                    />
                </button>
            </div>

            <div class="text-center">
                <p class="text-3xl font-semibold text-highlighted tabular-nums">
                    {{ formatDuration(elapsed) }}
                    <span class="text-base font-normal text-muted">
                        / {{ formatDuration(limit) }}
                    </span>
                </p>
                <p
                    class="text-sm text-muted"
                    aria-live="polite"
                >
                    <template v-if="prepLeft !== null">
                        Chuẩn bị, ghi âm tự bắt đầu sau {{ prepLeft }} giây
                    </template>
                    <template v-else-if="recording">Bấm để dừng, còn {{ remaining }} giây</template>
                    <template v-else-if="timed && prepSeconds">Bấm để bắt đầu chuẩn bị</template>
                    <template v-else>Bấm để bắt đầu ghi</template>
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
                {{ timed ? 'Ghi âm tự dừng khi hết giờ.' : 'Nói 1–2 phút.' }} Audio chỉ lưu trên máy
                này, server chỉ lưu chữ.
            </p>
        </div>
    </UCard>
</template>
