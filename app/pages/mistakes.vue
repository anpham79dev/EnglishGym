<script setup lang="ts">
import type { AttemptKind, MistakeWithHits } from '#shared/types'
import { fetchMistakes } from '~/api/mistakeApi'
import { CATEGORY_LABELS } from '~/constants'

const FILTERS = [
    { label: 'Tất cả', value: 'all' },
    { label: 'Nói', value: 'speaking', icon: 'i-lucide-mic' },
    { label: 'Viết', value: 'writing', icon: 'i-lucide-pen-line' },
]
const filter = ref<'all' | AttemptKind>('all')
const kind = computed(() => (filter.value === 'all' ? undefined : filter.value))

const { data, refresh, status } = await useAsyncData('mistakes', () => fetchMistakes(kind.value), {
    watch: [kind],
    default: () => [],
})

const search = ref('')
const category = ref<string | null>(null)
const categories = computed(() => [...new Set(data.value.map((m) => m.category))])
const categoryLabel = (c: string) => CATEGORY_LABELS[c as keyof typeof CATEGORY_LABELS] ?? c

const visible = computed(() => {
    const q = search.value.trim().toLowerCase()
    return data.value.filter(
        (m) =>
            (!category.value || m.category === category.value) &&
            (!q ||
                [m.labelVi, m.exampleWrong, m.exampleRight, m.patternKey, m.note].some((s) =>
                    s.toLowerCase().includes(q),
                )),
    )
})

const openId = ref<string | null>(null)
const opened = computed<MistakeWithHits | null>(
    () => data.value.find((m) => m.id === openId.value) ?? null,
)
const onChanged = async (closeDetail = false) => {
    if (closeDetail) openId.value = null
    await refresh()
}
</script>

<template>
    <LayoutPage title="Sổ lỗi">
        <UTabs
            v-model="filter"
            :items="FILTERS"
            :content="false"
        />

        <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Tìm theo nhãn, ví dụ, kiểu lỗi hoặc ghi chú"
            size="lg"
            class="w-full"
            aria-label="Tìm lỗi"
        />

        <div
            v-if="categories.length > 1"
            class="flex flex-wrap gap-2"
            role="group"
            aria-label="Lọc theo nhóm lỗi"
        >
            <UButton
                :variant="category === null ? 'solid' : 'outline'"
                :color="category === null ? 'primary' : 'neutral'"
                size="sm"
                label="Mọi nhóm"
                :aria-pressed="category === null"
                @click="category = null"
            />
            <UButton
                v-for="c in categories"
                :key="c"
                :variant="category === c ? 'solid' : 'outline'"
                :color="category === c ? 'primary' : 'neutral'"
                size="sm"
                :label="categoryLabel(c)"
                :aria-pressed="category === c"
                @click="category = category === c ? null : c"
            />
        </div>

        <div
            v-if="status === 'pending' && !data.length"
            class="space-y-3"
        >
            <USkeleton
                v-for="i in 3"
                :key="i"
                class="h-24 w-full rounded-xl"
            />
        </div>

        <UCard v-else-if="!data.length">
            <div class="flex flex-col items-center gap-3 py-6 text-center">
                <UIcon
                    name="i-lucide-notebook-pen"
                    class="size-10 text-muted"
                    aria-hidden="true"
                />
                <p class="text-muted">
                    Chưa có lỗi nào. Lỗi chỉ vào sổ sau khi bạn duyệt một bài nộp.
                </p>
                <UButton
                    to="/"
                    label="Luyện bài đầu tiên"
                    trailing-icon="i-lucide-arrow-right"
                />
            </div>
        </UCard>

        <p
            v-else-if="!visible.length"
            class="py-6 text-center text-sm text-muted"
        >
            Không có lỗi nào khớp bộ lọc.
        </p>

        <ul class="space-y-2">
            <li
                v-for="m in visible"
                :key="m.id"
            >
                <MistakesMistakeCard
                    :mistake="m"
                    @open="openId = m.id"
                    @changed="onChanged()"
                />
            </li>
        </ul>

        <p class="flex items-start gap-2 text-xs text-muted">
            <UIcon
                name="i-lucide-lightbulb"
                class="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
            />
            Cuối tuần dành 5 phút xem lại sổ lỗi: gộp lỗi trùng, chọn một lỗi trọng tâm.
        </p>

        <MistakesMistakeDetail
            :mistake="opened"
            :others="data.filter((o) => o.id !== openId)"
            @close="openId = null"
            @changed="onChanged"
        />
    </LayoutPage>
</template>
