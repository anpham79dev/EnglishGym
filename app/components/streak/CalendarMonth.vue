<script setup lang="ts">
import { addDays, dayKey, weekStart } from '#shared/utils/streak'
import { deleteCheckin, fetchCalendar, type CalendarDay } from '~/api/calendarApi'
import { toApiFailure } from '~/api/http'
import { CHECKIN_KINDS, KIND_ICONS } from '~/constants'

/** Month view of practice days (N11), reused by /calendar and the Progress page. */
const notify = useNotify()
const confirm = useConfirm()

const month = ref(dayKey(Date.now()).slice(0, 7))
const { data, refresh, status } = await useAsyncData('calendar', () => fetchCalendar(month.value), {
    watch: [month],
})

const shiftMonth = (n: number) => {
    const d = new Date(`${month.value}-01T00:00:00Z`)
    d.setUTCMonth(d.getUTCMonth() + n)
    month.value = d.toISOString().slice(0, 7)
}
const monthLabel = computed(() => {
    const [y, m] = month.value.split('-')
    return `Tháng ${Number(m)}/${y}`
})
const isCurrentMonth = computed(() => month.value === dayKey(Date.now()).slice(0, 7))

/** Weeks of the month, Monday first, padded with nulls. */
const weeks = computed(() => {
    if (!data.value) return []
    const byDate = new Map(data.value.days.map((d) => [d.date, d]))
    const first = data.value.days[0]!.date
    const last = data.value.days.at(-1)!.date
    const rows: (CalendarDay | null)[][] = []
    for (let w = weekStart(first); w <= last; w = addDays(w, 7))
        rows.push(Array.from({ length: 7 }, (_, i) => byDate.get(addDays(w, i)) ?? null))
    return rows
})

/** 0 nothing, 1 only self-study or reviews, 2 speaking or writing, 3 both. */
const level = (d: CalendarDay) => {
    const both = d.speaking > 0 && d.writing > 0
    if (both) return 3
    if (d.speaking || d.writing) return 2
    if (d.reviews || d.checkins.length) return 1
    return 0
}
const LEVEL_CLASS = [
    'bg-default',
    'bg-primary/10',
    'bg-primary/30',
    'bg-primary text-inverted',
] as const
const LEVEL_TEXT = ['Không luyện', 'Ôn hoặc tự học', 'Có nói hoặc viết', 'Cả nói lẫn viết']

const markers = (d: CalendarDay) =>
    [
        d.speaking && { icon: KIND_ICONS.speaking, label: `${d.speaking} bài nói` },
        d.writing && { icon: KIND_ICONS.writing, label: `${d.writing} bài viết` },
        d.reviews && { icon: 'i-lucide-repeat', label: `${d.reviews} lần ôn` },
        d.checkins.length && { icon: 'i-lucide-book-open', label: 'Tự học' },
    ].filter(Boolean) as { icon: string; label: string }[]

const selected = ref<string | null>(null)
const selectedDay = computed(() => data.value?.days.find((d) => d.date === selected.value) ?? null)
const detailOpen = computed({
    get: () => !!selectedDay.value,
    set: (v) => !v && (selected.value = null),
})
const checkinOpen = ref(false)
const isFuture = (date: string) => !!data.value && date > data.value.today

const removeCheckin = async (id: string) => {
    const ok = await confirm({ title: 'Xoá lần điểm danh này?', confirmLabel: 'Xoá', danger: true })
    if (!ok) return
    try {
        await deleteCheckin(id)
        await refresh()
    } catch (e) {
        notify.error(toApiFailure(e).message)
    }
}
const formatDay = (date: string) => date.split('-').reverse().join('/')
</script>

<template>
    <div class="space-y-4">
        <div class="flex items-center justify-between gap-2">
            <UButton
                icon="i-lucide-chevron-left"
                color="neutral"
                variant="ghost"
                aria-label="Tháng trước"
                @click="shiftMonth(-1)"
            />
            <h2 class="font-semibold text-highlighted">{{ monthLabel }}</h2>
            <UButton
                icon="i-lucide-chevron-right"
                color="neutral"
                variant="ghost"
                aria-label="Tháng sau"
                :disabled="isCurrentMonth"
                @click="shiftMonth(1)"
            />
        </div>

        <USkeleton
            v-if="!data && status === 'pending'"
            class="h-80 w-full rounded-xl"
        />

        <div
            v-if="data"
            class="space-y-1"
        >
            <div class="grid grid-cols-7 gap-1 text-center text-xs text-muted">
                <span
                    v-for="w in ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']"
                    :key="w"
                >
                    {{ w }}
                </span>
            </div>
            <div
                v-for="(week, wi) in weeks"
                :key="wi"
                class="grid grid-cols-7 gap-1"
            >
                <template
                    v-for="(d, di) in week"
                    :key="di"
                >
                    <span v-if="!d" />
                    <button
                        v-else
                        type="button"
                        class="flex aspect-square min-h-11 flex-col items-center justify-between rounded-lg border p-1 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-40"
                        :class="[
                            LEVEL_CLASS[level(d)],
                            d.date === data.today ? 'border-primary' : 'border-default',
                        ]"
                        :disabled="isFuture(d.date)"
                        :aria-label="`${formatDay(d.date)}: ${LEVEL_TEXT[level(d)]}`"
                        @click="selected = d.date"
                    >
                        <span class="tabular-nums">{{ Number(d.date.slice(8)) }}</span>
                        <span
                            class="flex flex-wrap justify-center gap-px"
                            aria-hidden="true"
                        >
                            <UIcon
                                v-for="m in markers(d)"
                                :key="m.icon"
                                :name="m.icon"
                                class="size-3"
                            />
                        </span>
                    </button>
                </template>
            </div>
        </div>

        <ul
            class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted"
            aria-label="Chú thích"
        >
            <li class="flex items-center gap-1">
                <UIcon
                    :name="KIND_ICONS.speaking"
                    class="size-3.5"
                    aria-hidden="true"
                />
                Nói
            </li>
            <li class="flex items-center gap-1">
                <UIcon
                    :name="KIND_ICONS.writing"
                    class="size-3.5"
                    aria-hidden="true"
                />
                Viết
            </li>
            <li class="flex items-center gap-1">
                <UIcon
                    name="i-lucide-repeat"
                    class="size-3.5"
                    aria-hidden="true"
                />
                Ôn
            </li>
            <li class="flex items-center gap-1">
                <UIcon
                    name="i-lucide-book-open"
                    class="size-3.5"
                    aria-hidden="true"
                />
                Tự học
            </li>
        </ul>

        <dl
            v-if="data"
            class="grid grid-cols-2 gap-2 sm:grid-cols-4"
        >
            <div
                v-for="t in [
                    { label: 'ngày luyện', value: data.totals.practiceDays },
                    { label: 'bài nói', value: data.totals.speaking },
                    { label: 'bài viết', value: data.totals.writing },
                    { label: 'phút tự học', value: data.totals.selfStudyMinutes },
                ]"
                :key="t.label"
                class="rounded-lg bg-elevated px-3 py-2 text-center"
            >
                <dd class="text-xl font-semibold text-highlighted tabular-nums">{{ t.value }}</dd>
                <dt class="text-xs text-muted">{{ t.label }}</dt>
            </div>
        </dl>

        <USlideover
            v-model:open="detailOpen"
            :title="selectedDay ? `Ngày ${formatDay(selectedDay.date)}` : ''"
            :description="selectedDay ? LEVEL_TEXT[level(selectedDay)] : ''"
        >
            <template #body>
                <div
                    v-if="selectedDay"
                    class="space-y-5"
                >
                    <section class="space-y-2">
                        <h3 class="text-sm font-semibold text-highlighted">Bài đã duyệt</h3>
                        <p
                            v-if="!selectedDay.attempts.length"
                            class="text-sm text-muted"
                        >
                            Không có bài nào.
                        </p>
                        <ULink
                            v-for="a in selectedDay.attempts"
                            :key="a.id"
                            :to="`/review/${a.id}`"
                            class="flex items-center gap-2 rounded-lg border border-default p-2 hover:bg-elevated"
                        >
                            <UIcon
                                :name="KIND_ICONS[a.kind]"
                                class="size-4 text-primary"
                                aria-hidden="true"
                            />
                            <span class="flex-1 truncate">{{ a.topicTitle ?? 'Tự do' }}</span>
                            <span class="text-xs text-muted">v{{ a.version }}</span>
                        </ULink>
                    </section>

                    <section
                        v-if="selectedDay.reviews"
                        class="text-sm"
                    >
                        <h3 class="font-semibold text-highlighted">Ôn lỗi</h3>
                        <p class="text-muted">{{ selectedDay.reviews }} lần ôn thẻ.</p>
                    </section>

                    <section class="space-y-2">
                        <div class="flex items-center justify-between">
                            <h3 class="text-sm font-semibold text-highlighted">Tự học</h3>
                            <UButton
                                size="sm"
                                icon="i-lucide-calendar-check"
                                label="Điểm danh"
                                @click="checkinOpen = true"
                            />
                        </div>
                        <p
                            v-if="!selectedDay.checkins.length"
                            class="text-sm text-muted"
                        >
                            Chưa điểm danh.
                        </p>
                        <div
                            v-for="c in selectedDay.checkins"
                            :key="c.id"
                            class="flex items-start gap-2 rounded-lg border border-default p-2"
                        >
                            <UIcon
                                :name="CHECKIN_KINDS[c.kind].icon"
                                class="mt-0.5 size-4 text-primary"
                                aria-hidden="true"
                            />
                            <div class="min-w-0 flex-1 text-sm">
                                <p>
                                    {{ CHECKIN_KINDS[c.kind].label }}
                                    <span
                                        v-if="c.minutes"
                                        class="text-muted"
                                    >
                                        · {{ c.minutes }} phút
                                    </span>
                                </p>
                                <p
                                    v-if="c.note"
                                    class="text-xs text-muted"
                                >
                                    {{ c.note }}
                                </p>
                            </div>
                            <UButton
                                icon="i-lucide-trash-2"
                                color="neutral"
                                variant="ghost"
                                size="xs"
                                aria-label="Xoá lần điểm danh"
                                @click="removeCheckin(c.id)"
                            />
                        </div>
                    </section>
                </div>
            </template>
        </USlideover>

        <StreakCheckinModal
            v-if="selectedDay"
            v-model:open="checkinOpen"
            :date="selectedDay.date"
            @saved="refresh()"
        />
    </div>
</template>
