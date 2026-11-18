<script setup lang="ts">
import { fetchStats, type WeekStats } from '~/api/statsApi'
import { KIND_ICONS, KIND_LABELS } from '~/constants'

/** N7: weekly trends, the practice calendar and monthly benchmark attempts side by side. */
const route = useRoute()
const { settings } = useSettings()
const range = ref(12)
const { data, error, status } = await useAsyncData(
    'stats',
    () => fetchStats(range.value, settings.value.streakIncludeCheckins),
    { watch: [range] },
)

const TABS = [
    { label: 'Thống kê', value: 'stats', icon: 'i-lucide-chart-line' },
    { label: 'Lịch', value: 'calendar', icon: 'i-lucide-calendar-days' },
    { label: 'Đối chứng', value: 'benchmark', icon: 'i-lucide-target' },
]
const tab = ref((route.query.tab as string) || 'stats')
const RANGES = [
    { label: '8 tuần', value: 8 },
    { label: '12 tuần', value: 12 },
    { label: '26 tuần', value: 26 },
]

const weeks = computed(() => data.value?.weeks ?? [])
const label = (w: string) => `${w.slice(8)}/${w.slice(5, 7)}`
const series = (pick: (w: WeekStats) => number | null) =>
    weeks.value.map((w) => ({ label: label(w.week), value: pick(w) }))

/** Weeks where the Gemini model or prompt version differs from the previous graded week. */
const markers = computed(() => {
    const out: number[] = []
    let last: string | null = null
    weeks.value.forEach((w, i) => {
        if (!w.versions.length) return
        const key = [...w.versions].sort().join(',')
        if (last !== null && key !== last) out.push(i)
        last = key
    })
    return out
})

const pct = (v: number) => `${Math.round(v * 100)}%`
const num = (v: number) => String(Math.round(v * 10) / 10)
const hasAny = computed(() => weeks.value.some((w) => w.speaking + w.writing + w.reviews > 0))
const otherTotal = computed(() => weeks.value.reduce((s, w) => s + w.otherAttempts, 0))
const monthLabel = (m: string) => `Tháng ${Number(m.slice(5))}/${m.slice(0, 4)}`
</script>

<template>
    <LayoutPage
        title="Tiến bộ"
        wide
    >
        <UTabs
            v-model="tab"
            :items="TABS"
            :content="false"
        />

        <template v-if="tab === 'stats'">
            <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="text-sm text-muted">
                    Chỉ tính bài đã duyệt. Vạch đứt là tuần đổi model hoặc prompt: số liệu hai bên
                    vạch không so trực tiếp được.
                </p>
                <UTabs
                    v-model="range"
                    :items="RANGES"
                    :content="false"
                    size="xs"
                />
            </div>

            <UAlert
                v-if="error"
                color="error"
                variant="subtle"
                icon="i-lucide-circle-alert"
                title="Không tải được thống kê"
            />
            <div
                v-if="status === 'pending' && !data"
                class="grid gap-4 md:grid-cols-2"
            >
                <USkeleton
                    v-for="i in 4"
                    :key="i"
                    class="h-56 rounded-xl"
                />
            </div>

            <UCard v-else-if="data && !hasAny">
                <div class="flex flex-col items-center gap-3 py-6 text-center">
                    <UIcon
                        name="i-lucide-chart-line"
                        class="size-10 text-muted"
                        aria-hidden="true"
                    />
                    <p class="text-muted">Chưa có dữ liệu. Duyệt vài bài để thấy xu hướng.</p>
                </div>
            </UCard>

            <div
                v-else-if="data"
                class="grid gap-4 md:grid-cols-2"
            >
                <ProgressWeekChart
                    title="Lỗi trên 100 từ"
                    description="Bài Gemini chấm. Càng thấp càng tốt."
                    :points="series((w) => w.errorsPer100)"
                    :markers="markers"
                    :format="num"
                    lower-is-better
                />
                <ProgressWeekChart
                    title="Tái phạm lỗi trọng tâm"
                    :description="`Lần mắc lỗi trọng tâm trên 100 từ${weeks.at(-1)?.focusLabel ? `, hiện là: ${weeks.at(-1)!.focusLabel}` : ''}.`"
                    :points="series((w) => w.focusPer100)"
                    :markers="markers"
                    :format="num"
                    lower-is-better
                />
                <ProgressWeekChart
                    title="Tốc độ nói"
                    description="Từ mỗi phút, bài nói có ghi âm."
                    :points="series((w) => w.wpm)"
                    :format="num"
                />
                <ProgressWeekChart
                    title="Tỉ lệ tự bắt được lỗi"
                    description="Lỗi bạn tự đánh dấu trước khi xem AI, trên tổng lỗi đã lưu."
                    :points="series((w) => w.selfFoundRate)"
                    :format="pct"
                    :max="1"
                />
                <ProgressWeekChart
                    title="Tỉ lệ nhớ khi ôn"
                    description="Lần ôn chấm Được hoặc Dễ."
                    :points="series((w) => w.retention)"
                    :format="pct"
                    :max="1"
                />
                <ProgressWeekChart
                    title="Điểm kiểm tra tuần"
                    :points="series((w) => w.quizScore)"
                    :format="pct"
                    :max="1"
                />
                <ProgressWeekChart
                    title="Số ngày luyện"
                    description="Mục tiêu 5 ngày mỗi tuần."
                    type="bar"
                    :points="series((w) => w.practiceDays)"
                    :format="(v) => String(Math.round(v))"
                    :max="7"
                />
                <ProgressWeekChart
                    title="Bài đã duyệt"
                    description="Nói và viết cộng lại."
                    type="bar"
                    :points="series((w) => w.speaking + w.writing)"
                    :format="(v) => String(Math.round(v))"
                />
            </div>

            <p
                v-if="otherTotal"
                class="flex items-start gap-2 text-xs text-muted"
            >
                <UIcon
                    name="i-lucide-info"
                    class="mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                />
                {{ otherTotal }} bài tự duyệt hoặc chấm bằng AI khác được tính riêng, không gộp vào
                biểu đồ lỗi trên 100 từ.
            </p>
        </template>

        <UCard v-else-if="tab === 'calendar'">
            <StreakCalendarMonth />
        </UCard>

        <template v-else>
            <p class="text-sm text-muted">
                Mỗi tháng làm một bài nói và một bài viết với đề có tag
                <code>benchmark</code>
                . Đặt các tháng cạnh nhau để thấy mình tiến bộ thế nào.
            </p>
            <UCard v-if="!data?.benchmarks.length">
                <div class="flex flex-col items-center gap-3 py-6 text-center">
                    <UIcon
                        name="i-lucide-target"
                        class="size-10 text-muted"
                        aria-hidden="true"
                    />
                    <p class="text-muted">Chưa có bài đối chứng nào.</p>
                    <UButton
                        to="/topics"
                        icon="i-lucide-library"
                        label="Xem đề benchmark trong Kho đề"
                    />
                </div>
            </UCard>
            <div class="space-y-4">
                <UCard
                    v-for="m in data?.benchmarks ?? []"
                    :key="m.month"
                >
                    <template #header>
                        <h2 class="font-semibold text-highlighted">{{ monthLabel(m.month) }}</h2>
                    </template>
                    <ul class="grid gap-3 sm:grid-cols-2">
                        <li
                            v-for="a in m.attempts"
                            :key="a.id"
                        >
                            <NuxtLink
                                :to="`/review/${a.id}`"
                                class="block space-y-2 rounded-lg border border-default p-3 hover:bg-elevated/50"
                            >
                                <p class="flex items-center gap-2 font-medium">
                                    <UIcon
                                        :name="KIND_ICONS[a.kind]"
                                        class="size-4 text-primary"
                                        aria-hidden="true"
                                    />
                                    {{ KIND_LABELS[a.kind] }}
                                    <span class="truncate text-xs font-normal text-muted">
                                        {{ formatDateTime(a.createdAt) }}
                                    </span>
                                </p>
                                <dl class="grid grid-cols-3 gap-2 text-center">
                                    <div class="rounded bg-elevated px-1 py-1">
                                        <dd class="font-semibold tabular-nums">{{ a.words }}</dd>
                                        <dt class="text-[11px] text-muted">từ</dt>
                                    </div>
                                    <div class="rounded bg-elevated px-1 py-1">
                                        <dd class="font-semibold tabular-nums">
                                            {{ a.wpm ?? '–' }}
                                        </dd>
                                        <dt class="text-[11px] text-muted">từ/phút</dt>
                                    </div>
                                    <div class="rounded bg-elevated px-1 py-1">
                                        <dd class="font-semibold tabular-nums">
                                            {{ a.errorsPer100 ?? '–' }}
                                        </dd>
                                        <dt class="text-[11px] text-muted">lỗi/100 từ</dt>
                                    </div>
                                </dl>
                            </NuxtLink>
                        </li>
                    </ul>
                </UCard>
            </div>
        </template>
    </LayoutPage>
</template>
