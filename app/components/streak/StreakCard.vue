<script setup lang="ts">
import type { StreakSummary } from '#shared/utils/streak'

/** Streak at the top of Today: day streak, weekly goal ring, this week's 7 days. */
const props = defineProps<{ streak: StreakSummary }>()
const emit = defineEmits<{ changed: [] }>()

const checkinOpen = ref(false)
const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

const R = 26
const CIRC = 2 * Math.PI * R
const goalOffset = computed(
    () => CIRC * (1 - Math.min(1, props.streak.weekDays / props.streak.weekGoal)),
)
const goalReached = computed(() => props.streak.weekDays >= props.streak.weekGoal)
</script>

<template>
    <UCard>
        <div class="space-y-4">
            <div class="flex items-center gap-4">
                <NuxtLink
                    to="/calendar"
                    class="flex min-w-0 flex-1 items-center gap-3 rounded-lg hover:opacity-80"
                    aria-label="Mở lịch luyện tập"
                >
                    <span
                        class="grid size-12 shrink-0 place-items-center rounded-xl"
                        :class="
                            streak.current ? 'bg-warning/15 text-warning' : 'bg-elevated text-muted'
                        "
                    >
                        <UIcon
                            name="i-lucide-flame"
                            class="size-7"
                            aria-hidden="true"
                        />
                    </span>
                    <div class="min-w-0">
                        <p class="text-2xl font-semibold text-highlighted tabular-nums">
                            {{ streak.current }}
                            <span class="text-base font-normal text-muted">ngày liên tiếp</span>
                        </p>
                        <p class="truncate text-xs text-muted">
                            <template v-if="!streak.practicedToday && streak.current">
                                Luyện hôm nay để giữ chuỗi.
                            </template>
                            <template v-else>Dài nhất {{ streak.longest }} ngày.</template>
                            <template v-if="streak.weekStreak">
                                {{ streak.weekStreak }} tuần liên tiếp đạt mục tiêu.
                            </template>
                        </p>
                    </div>
                </NuxtLink>

                <div
                    class="relative size-16 shrink-0"
                    role="img"
                    :aria-label="`${streak.weekDays} trên ${streak.weekGoal} ngày tuần này`"
                >
                    <svg
                        viewBox="0 0 64 64"
                        class="absolute inset-0 -rotate-90"
                        aria-hidden="true"
                    >
                        <circle
                            cx="32"
                            cy="32"
                            :r="R"
                            fill="none"
                            stroke-width="6"
                            class="stroke-(--ui-border)"
                        />
                        <circle
                            cx="32"
                            cy="32"
                            :r="R"
                            fill="none"
                            stroke-width="6"
                            stroke-linecap="round"
                            :stroke-dasharray="CIRC"
                            :stroke-dashoffset="goalOffset"
                            :class="goalReached ? 'stroke-(--ui-success)' : 'stroke-(--ui-primary)'"
                        />
                    </svg>
                    <div class="absolute inset-0 grid place-items-center text-center leading-none">
                        <span class="text-sm font-semibold text-highlighted tabular-nums">
                            {{ streak.weekDays }}/{{ streak.weekGoal }}
                        </span>
                    </div>
                </div>
            </div>

            <ol
                class="grid grid-cols-7 gap-1"
                aria-label="Tuần này"
            >
                <li
                    v-for="(d, i) in streak.week"
                    :key="d.date"
                    class="flex flex-col items-center gap-1"
                >
                    <span class="text-[11px] text-muted">{{ WEEKDAYS[i] }}</span>
                    <span
                        class="grid size-8 place-items-center rounded-full border"
                        :class="
                            d.practiced
                                ? 'border-primary bg-primary text-inverted'
                                : 'border-default text-dimmed'
                        "
                    >
                        <UIcon
                            v-if="d.practiced"
                            name="i-lucide-check"
                            class="size-4"
                            aria-hidden="true"
                        />
                        <span class="sr-only">
                            {{ d.practiced ? 'Đã luyện' : 'Chưa luyện' }} {{ d.date }}
                        </span>
                    </span>
                </li>
            </ol>

            <div class="flex gap-2">
                <UButton
                    color="neutral"
                    variant="outline"
                    icon="i-lucide-calendar-check"
                    label="Điểm danh tự học"
                    class="flex-1 justify-center"
                    @click="checkinOpen = true"
                />
                <UButton
                    to="/calendar"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-calendar-days"
                    label="Lịch"
                />
            </div>
        </div>
        <StreakCheckinModal
            v-model:open="checkinOpen"
            @saved="emit('changed')"
        />
    </UCard>
</template>
