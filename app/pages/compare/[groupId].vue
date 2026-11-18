<script setup lang="ts">
import { countFillers, countWords, errorsPer100Words, wordsPerMinute } from '#shared/utils/kpi'
import { wordDiff } from '#shared/utils/wordDiff'
import { fetchAttemptGroup, type AttemptGroup } from '~/api/attemptApi'
import { toApiFailure } from '~/api/http'
import { KIND_ICONS, KIND_LABELS } from '~/constants'

/**
 * N10: two versions of the same topic side by side. Mistake patterns are compared by
 * pattern_key: gone, still there, new. Writing also gets a word diff. No AI involved.
 */
const route = useRoute()
const groupId = route.params.groupId as string
const { data, error } = await useAsyncData(`group-${groupId}`, () => fetchAttemptGroup(groupId))

type Version = AttemptGroup['versions'][number]
const versions = computed(() => data.value?.versions ?? [])
const versionItems = computed(() =>
    versions.value.map((v) => ({
        label: `v${v.version} · ${formatDateTime(v.createdAt)}`,
        value: v.id,
    })),
)
const aId = ref<string | undefined>((route.query.a as string) || undefined)
const bId = ref<string | undefined>((route.query.b as string) || undefined)
watchEffect(() => {
    const vs = versions.value
    if (vs.length < 2) return
    aId.value ??= vs.at(-2)!.id
    bId.value ??= vs.at(-1)!.id
})
const A = computed(() => versions.value.find((v) => v.id === aId.value) ?? null)
const B = computed(() => versions.value.find((v) => v.id === bId.value) ?? null)

const textOf = (v: Version) => v.finalTranscript ?? v.textOrTranscript ?? ''
const kpi = (v: Version) => {
    const text = textOf(v)
    const words = countWords(text)
    return {
        words,
        wpm: v.durationS ? wordsPerMinute(words, v.durationS) : null,
        per100: errorsPer100Words(v.hits.length, words),
        fillers: v.fillerCount ?? (v.kind === 'speaking' ? countFillers(text) : null),
        selfRating: v.selfRating,
    }
}
const rows = computed(() => {
    if (!A.value || !B.value) return []
    const a = kpi(A.value)
    const b = kpi(B.value)
    return [
        { label: 'Số từ', a: a.words, b: b.words, better: 'up' as const },
        { label: 'Tốc độ nói (từ/phút)', a: a.wpm, b: b.wpm, better: 'up' as const },
        { label: 'Lỗi/100 từ', a: a.per100, b: b.per100, better: 'down' as const },
        { label: 'Từ đệm', a: a.fillers, b: b.fillers, better: 'down' as const },
        { label: 'Tự chấm', a: a.selfRating, b: b.selfRating, better: 'up' as const },
    ].filter((r) => r.a !== null || r.b !== null)
})
const trend = (r: (typeof rows.value)[number]) => {
    if (r.a === null || r.b === null || r.a === r.b) return null
    const up = (r.b as number) > (r.a as number)
    return { up, good: r.better === 'up' ? up : !up }
}

const patterns = computed(() => {
    if (!A.value || !B.value) return null
    const label = new Map([...A.value.hits, ...B.value.hits].map((h) => [h.patternKey, h.labelVi]))
    const ka = new Set(A.value.hits.map((h) => h.patternKey))
    const kb = new Set(B.value.hits.map((h) => h.patternKey))
    const list = (keys: string[]) => keys.map((k) => ({ key: k, label: label.get(k) ?? k }))
    return {
        gone: list([...ka].filter((k) => !kb.has(k))),
        still: list([...ka].filter((k) => kb.has(k))),
        added: list([...kb].filter((k) => !ka.has(k))),
    }
})

const diff = computed(() => (A.value && B.value ? wordDiff(textOf(A.value), textOf(B.value)) : []))
const tab = ref<'diff' | 'a' | 'b'>('diff')
</script>

<template>
    <LayoutPage
        title="So sánh phiên bản"
        wide
    >
        <UAlert
            v-if="error"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            :title="toApiFailure(error).message"
        />
        <template v-if="data">
            <p class="flex items-center gap-2 text-sm text-muted">
                <UIcon
                    :name="KIND_ICONS[versions[0]!.kind]"
                    class="size-4"
                    aria-hidden="true"
                />
                {{ KIND_LABELS[versions[0]!.kind] }} · {{ data.topic?.title ?? 'Tự do' }} ·
                {{ versions.length }} phiên bản
            </p>

            <UAlert
                v-if="versions.length < 2"
                color="neutral"
                variant="soft"
                icon="i-lucide-info"
                title="Mới có một phiên bản"
                description="Nói lại hoặc viết phiên bản mới từ trang bài để so sánh."
            />

            <template v-else>
                <div class="grid grid-cols-2 gap-3">
                    <UFormField label="Bản trước">
                        <USelect
                            v-model="aId"
                            :items="versionItems"
                            class="w-full"
                        />
                    </UFormField>
                    <UFormField label="Bản sau">
                        <USelect
                            v-model="bId"
                            :items="versionItems"
                            class="w-full"
                        />
                    </UFormField>
                </div>

                <div
                    v-if="A && B"
                    class="grid gap-4 lg:grid-cols-2 lg:items-start"
                >
                    <UCard>
                        <template #header>
                            <h2 class="font-semibold text-highlighted">Chỉ số</h2>
                        </template>
                        <table class="w-full text-sm">
                            <thead class="text-left text-xs text-muted">
                                <tr>
                                    <th class="py-1 font-medium" />
                                    <th class="py-1 text-right font-medium">v{{ A.version }}</th>
                                    <th class="py-1 text-right font-medium">v{{ B.version }}</th>
                                </tr>
                            </thead>
                            <tbody class="tabular-nums">
                                <tr
                                    v-for="r in rows"
                                    :key="r.label"
                                    class="border-t border-default"
                                >
                                    <td class="py-1.5">{{ r.label }}</td>
                                    <td class="py-1.5 text-right">{{ r.a ?? '–' }}</td>
                                    <td class="py-1.5 text-right font-semibold">
                                        <span class="inline-flex items-center gap-1">
                                            <UIcon
                                                v-if="trend(r)"
                                                :name="
                                                    trend(r)!.up
                                                        ? 'i-lucide-arrow-up'
                                                        : 'i-lucide-arrow-down'
                                                "
                                                class="size-3.5"
                                                :class="
                                                    trend(r)!.good ? 'text-success' : 'text-warning'
                                                "
                                                :aria-label="trend(r)!.good ? 'tốt hơn' : 'kém hơn'"
                                            />
                                            {{ r.b ?? '–' }}
                                        </span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </UCard>

                    <UCard v-if="patterns">
                        <template #header>
                            <h2 class="font-semibold text-highlighted">Kiểu lỗi</h2>
                        </template>
                        <div class="space-y-4">
                            <section
                                v-for="group in [
                                    {
                                        key: 'gone',
                                        title: 'Đã hết',
                                        icon: 'i-lucide-circle-check',
                                        color: 'success',
                                        cls: 'text-success',
                                        items: patterns.gone,
                                    },
                                    {
                                        key: 'still',
                                        title: 'Còn lặp lại',
                                        icon: 'i-lucide-repeat',
                                        color: 'warning',
                                        cls: 'text-warning',
                                        items: patterns.still,
                                    },
                                    {
                                        key: 'added',
                                        title: 'Mới xuất hiện',
                                        icon: 'i-lucide-plus',
                                        color: 'error',
                                        cls: 'text-error',
                                        items: patterns.added,
                                    },
                                ] as const"
                                :key="group.key"
                                class="space-y-1.5"
                            >
                                <h3 class="flex items-center gap-1.5 text-sm font-semibold">
                                    <UIcon
                                        :name="group.icon"
                                        class="size-4"
                                        :class="group.cls"
                                        aria-hidden="true"
                                    />
                                    {{ group.title }} ({{ group.items.length }})
                                </h3>
                                <p
                                    v-if="!group.items.length"
                                    class="text-xs text-muted"
                                >
                                    Không có.
                                </p>
                                <div class="flex flex-wrap gap-1.5">
                                    <UBadge
                                        v-for="p in group.items"
                                        :key="p.key"
                                        :color="group.color"
                                        variant="subtle"
                                        :label="p.label"
                                    />
                                </div>
                            </section>
                        </div>
                    </UCard>
                </div>

                <UCard v-if="A && B">
                    <template #header>
                        <UTabs
                            v-model="tab"
                            :items="[
                                { label: 'Thay đổi', value: 'diff', icon: 'i-lucide-git-compare' },
                                { label: `v${A.version}`, value: 'a' },
                                { label: `v${B.version}`, value: 'b' },
                            ]"
                            :content="false"
                            size="sm"
                        />
                    </template>
                    <p
                        v-if="tab === 'diff'"
                        class="prewrap leading-relaxed"
                    >
                        <template
                            v-for="(p, i) in diff"
                            :key="i"
                        >
                            <del
                                v-if="p.type === 'del'"
                                class="bg-error/10 text-error decoration-error/60"
                            >
                                <span class="sr-only">Bỏ:</span>
                                {{ p.text }}
                            </del>
                            <ins
                                v-else-if="p.type === 'add'"
                                class="bg-success/10 text-success no-underline"
                            >
                                <span class="sr-only">Thêm:</span>
                                {{ p.text }}
                            </ins>
                            <template v-else>{{ p.text }}</template>
                        </template>
                    </p>
                    <p
                        v-else
                        class="prewrap leading-relaxed"
                    >
                        {{ textOf(tab === 'a' ? A : B) }}
                    </p>
                    <p
                        v-if="tab === 'diff'"
                        class="mt-3 text-xs text-muted"
                    >
                        Chữ gạch đỏ là phần bỏ đi ở bản sau, chữ nền xanh là phần thêm vào.
                    </p>
                </UCard>
            </template>
        </template>
    </LayoutPage>
</template>
