<script setup lang="ts">
/**
 * One weekly metric as a small single-series chart (N7). Small multiples instead of a
 * multi-series or dual-axis chart: each metric has its own scale and title, so no legend.
 * Marks follow the dataviz rules: 2px line, 8px markers with a 2px surface ring, bars with a
 * rounded data end on the baseline, recessive grid, hover crosshair + tooltip, table view.
 * Colour: --chart-series (teal-600), validated for both light and dark surfaces.
 */
const props = withDefaults(
    defineProps<{
        title: string
        description?: string
        points: { label: string; value: number | null }[]
        format?: (v: number) => string
        /** Indices where the Gemini model or prompt changed (values not comparable across). */
        markers?: number[]
        type?: 'line' | 'bar'
        /** Fixed top of the scale, e.g. 1 for ratios or 7 for days. */
        max?: number
        /** Lower is better (errors per 100 words): the change badge reads accordingly. */
        lowerIsBetter?: boolean
    }>(),
    {
        description: undefined,
        format: (v: number) => String(Math.round(v * 10) / 10),
        markers: () => [],
        type: 'line',
        max: undefined,
        lowerIsBetter: false,
    },
)

const el = ref<HTMLElement>()
const width = ref(320)
let ro: ResizeObserver | undefined
onMounted(() => {
    ro = new ResizeObserver(([e]) => (width.value = Math.max(240, e!.contentRect.width)))
    if (el.value) ro.observe(el.value)
})
onBeforeUnmount(() => ro?.disconnect())

const H = 140
const PAD = { top: 10, right: 8, bottom: 22, left: 34 }
const innerW = computed(() => width.value - PAD.left - PAD.right)
const innerH = H - PAD.top - PAD.bottom

const values = computed(() =>
    props.points.map((p) => p.value).filter((v): v is number => v !== null),
)
const niceMax = computed(() => {
    if (props.max !== undefined) return props.max
    const m = Math.max(0, ...values.value)
    if (m === 0) return 1
    const step = 10 ** Math.floor(Math.log10(m))
    return Math.ceil(m / step) * step
})
/** Mid tick only when it is a value the format can show exactly (no "2" for 1.5 days). */
const ticks = computed(() => {
    const mid = niceMax.value / 2
    return props.format(mid) === props.format(Math.round(mid)) && !Number.isInteger(mid)
        ? [0, niceMax.value]
        : [0, mid, niceMax.value]
})

const n = computed(() => props.points.length)
const band = computed(() => innerW.value / Math.max(1, n.value))
const x = (i: number) => PAD.left + band.value * (i + 0.5)
const y = (v: number) => PAD.top + innerH - (v / niceMax.value) * innerH

/** Line segments, broken at weeks without data. */
const segments = computed(() => {
    const out: string[] = []
    let d = ''
    props.points.forEach((p, i) => {
        if (p.value === null) {
            if (d) out.push(d)
            d = ''
            return
        }
        d += `${d ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`
    })
    if (d) out.push(d)
    return out
})

const barW = computed(() => Math.min(24, band.value * 0.6))
/** Bar with 4px rounded top corners, flat on the baseline. */
const barPath = (i: number, v: number) => {
    const w = barW.value
    const x0 = x(i) - w / 2
    const top = y(v)
    const base = y(0)
    const r = Math.min(4, w / 2, base - top)
    if (base - top < 0.5) return ''
    return `M${x0},${base}V${top + r}Q${x0},${top} ${x0 + r},${top}H${x0 + w - r}Q${x0 + w},${top} ${x0 + w},${top + r}V${base}Z`
}

const latestIndex = computed(() => {
    for (let i = n.value - 1; i >= 0; i--) if (props.points[i]!.value !== null) return i
    return -1
})
const latest = computed(() =>
    latestIndex.value >= 0 ? props.points[latestIndex.value]!.value : null,
)
const previous = computed(() => {
    for (let i = latestIndex.value - 1; i >= 0; i--)
        if (props.points[i]!.value !== null) return props.points[i]!.value
    return null
})
const change = computed(() =>
    latest.value !== null && previous.value !== null ? latest.value - previous.value : null,
)
const changeGood = computed(() =>
    change.value === null || change.value === 0
        ? null
        : props.lowerIsBetter
          ? change.value < 0
          : change.value > 0,
)

const hover = ref<number | null>(null)
const showTable = ref(false)
const labelEvery = computed(() => Math.ceil(n.value / Math.max(1, Math.floor(innerW.value / 48))))
</script>

<template>
    <UCard :ui="{ body: 'space-y-3' }">
        <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
                <h3 class="font-semibold text-highlighted">{{ title }}</h3>
                <p
                    v-if="description"
                    class="text-xs text-muted"
                >
                    {{ description }}
                </p>
            </div>
            <div class="shrink-0 text-right">
                <p class="text-2xl font-semibold text-highlighted tabular-nums">
                    {{ latest === null ? '–' : format(latest) }}
                </p>
                <p
                    v-if="change !== null && change !== 0"
                    class="flex items-center justify-end gap-0.5 text-xs whitespace-nowrap tabular-nums"
                    :class="changeGood ? 'text-success' : 'text-warning'"
                >
                    <UIcon
                        :name="change > 0 ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'"
                        class="size-3.5"
                        aria-hidden="true"
                    />
                    {{ format(Math.abs(change)) }} so tuần trước
                </p>
            </div>
        </div>

        <div
            v-show="!showTable"
            ref="el"
            class="relative"
        >
            <svg
                :width="width"
                :height="H"
                role="img"
                :aria-label="`${title}: ${points.map((p) => `${p.label} ${p.value === null ? 'không có' : format(p.value)}`).join(', ')}`"
                class="block overflow-visible"
                @mouseleave="hover = null"
            >
                <!-- grid + y ticks -->
                <g>
                    <line
                        v-for="t in ticks"
                        :key="t"
                        :x1="PAD.left"
                        :x2="width - PAD.right"
                        :y1="y(t)"
                        :y2="y(t)"
                        class="stroke-(--ui-border)"
                        stroke-width="1"
                    />
                    <text
                        v-for="t in ticks"
                        :key="`l${t}`"
                        :x="PAD.left - 6"
                        :y="y(t) + 3.5"
                        text-anchor="end"
                        class="fill-(--ui-text-muted) text-[10px] tabular-nums"
                    >
                        {{ format(t) }}
                    </text>
                </g>
                <!-- model/prompt change markers -->
                <line
                    v-for="mi in markers"
                    :key="`m${mi}`"
                    :x1="x(mi) - band / 2"
                    :x2="x(mi) - band / 2"
                    :y1="PAD.top"
                    :y2="y(0)"
                    class="stroke-(--ui-text-dimmed)"
                    stroke-width="1"
                    stroke-dasharray="3 3"
                />
                <!-- crosshair -->
                <line
                    v-if="hover !== null"
                    :x1="x(hover)"
                    :x2="x(hover)"
                    :y1="PAD.top"
                    :y2="y(0)"
                    class="stroke-(--ui-border-accented)"
                    stroke-width="1"
                />
                <!-- data -->
                <template v-if="type === 'bar'">
                    <template
                        v-for="(p, i) in points"
                        :key="i"
                    >
                        <path
                            v-if="p.value !== null"
                            :d="barPath(i, p.value)"
                            class="fill-(--chart-series)"
                            :opacity="hover === null || hover === i ? 1 : 0.55"
                        />
                    </template>
                </template>
                <template v-else>
                    <path
                        v-for="(d, si) in segments"
                        :key="si"
                        :d="d"
                        fill="none"
                        class="stroke-(--chart-series)"
                        stroke-width="2"
                        stroke-linejoin="round"
                        stroke-linecap="round"
                    />
                    <template
                        v-for="(p, i) in points"
                        :key="`p${i}`"
                    >
                        <circle
                            v-if="p.value !== null && (hover === i || i === latestIndex)"
                            :cx="x(i)"
                            :cy="y(p.value)"
                            r="4"
                            class="fill-(--chart-series) stroke-(--ui-bg)"
                            stroke-width="2"
                        />
                    </template>
                </template>
                <!-- x labels -->
                <text
                    v-for="(p, i) in points"
                    v-show="i % labelEvery === (n - 1) % labelEvery"
                    :key="`x${i}`"
                    :x="x(i)"
                    :y="H - 6"
                    text-anchor="middle"
                    class="fill-(--ui-text-muted) text-[10px] tabular-nums"
                >
                    {{ p.label }}
                </text>
                <!-- hit targets, wider than the marks -->
                <rect
                    v-for="(p, i) in points"
                    :key="`h${i}`"
                    :x="x(i) - band / 2"
                    :y="PAD.top"
                    :width="band"
                    :height="innerH"
                    fill="transparent"
                    @mouseenter="hover = i"
                    @touchstart.passive="hover = i"
                />
            </svg>
            <div
                v-if="hover !== null"
                class="pointer-events-none absolute top-0 z-10 rounded-md border border-default bg-default px-2 py-1 text-xs shadow-md"
                :style="{
                    left: `${Math.min(Math.max(x(hover) - 50, 0), width - 110)}px`,
                }"
            >
                <p class="text-muted">Tuần {{ points[hover]!.label }}</p>
                <p class="font-semibold text-highlighted tabular-nums">
                    {{
                        points[hover]!.value === null
                            ? 'Không có dữ liệu'
                            : format(points[hover]!.value!)
                    }}
                </p>
                <p
                    v-if="markers.includes(hover)"
                    class="text-muted"
                >
                    Đổi model/prompt
                </p>
            </div>
        </div>

        <table
            v-if="showTable"
            class="w-full text-sm"
        >
            <thead class="text-left text-xs text-muted">
                <tr>
                    <th class="py-1 font-medium">Tuần</th>
                    <th class="py-1 text-right font-medium">{{ title }}</th>
                </tr>
            </thead>
            <tbody class="tabular-nums">
                <tr
                    v-for="(p, i) in points"
                    :key="i"
                    class="border-t border-default"
                >
                    <td class="py-1">
                        {{ p.label }}
                        <span
                            v-if="markers.includes(i)"
                            class="text-xs text-muted"
                        >
                            (đổi model/prompt)
                        </span>
                    </td>
                    <td class="py-1 text-right">{{ p.value === null ? '–' : format(p.value) }}</td>
                </tr>
            </tbody>
        </table>

        <UButton
            color="neutral"
            variant="link"
            size="xs"
            class="px-0"
            :icon="showTable ? 'i-lucide-chart-line' : 'i-lucide-table'"
            :label="showTable ? 'Xem biểu đồ' : 'Xem bảng số'"
            @click="showTable = !showTable"
        />
    </UCard>
</template>
