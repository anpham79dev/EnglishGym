<script setup lang="ts">
import type { AttemptKind } from '#shared/types'
import { fetchAttempts } from '~/api/attemptApi'
import { KIND_ICONS, KIND_LABELS, STATUS_COLORS, STATUS_LABELS } from '~/constants'

const FILTERS = [
    { label: 'Tất cả', value: 'all' },
    { label: 'Nói', value: 'speaking', icon: 'i-lucide-mic' },
    { label: 'Viết', value: 'writing', icon: 'i-lucide-pen-line' },
]
const filter = ref<'all' | AttemptKind>('all')
const kind = computed(() => (filter.value === 'all' ? undefined : filter.value))

const { data, status } = await useAsyncData('history', () => fetchAttempts({ kind: kind.value }), {
    watch: [kind],
    default: () => [],
})

const byDay = computed(() => {
    const groups = new Map<string, typeof data.value>()
    for (const a of data.value) {
        const day = new Date(a.createdAt).toLocaleDateString('vi-VN', {
            weekday: 'long',
            day: '2-digit',
            month: '2-digit',
        })
        groups.set(day, [...(groups.get(day) ?? []), a])
    }
    return [...groups.entries()]
})
const timeOf = (ms: number) =>
    new Date(ms).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
</script>

<template>
    <LayoutPage title="Lịch sử">
        <UTabs
            v-model="filter"
            :items="FILTERS"
            :content="false"
        />

        <div
            v-if="status === 'pending' && !data.length"
            class="space-y-3"
        >
            <USkeleton
                v-for="i in 3"
                :key="i"
                class="h-16 w-full rounded-xl"
            />
        </div>

        <UCard v-else-if="!data.length">
            <div class="flex flex-col items-center gap-3 py-6 text-center">
                <UIcon
                    name="i-lucide-inbox"
                    class="size-10 text-muted"
                    aria-hidden="true"
                />
                <p class="text-muted">Chưa có bài nộp nào.</p>
                <UButton
                    to="/"
                    label="Luyện bài đầu tiên"
                    trailing-icon="i-lucide-arrow-right"
                />
            </div>
        </UCard>

        <section
            v-for="[day, items] in byDay"
            :key="day"
            class="space-y-2"
        >
            <h2 class="text-sm font-semibold text-muted first-letter:uppercase">{{ day }}</h2>
            <ol class="relative space-y-2 border-l border-default pl-4">
                <li
                    v-for="a in items"
                    :key="a.id"
                    class="relative"
                >
                    <span
                        class="absolute top-4 -left-[21px] size-2.5 rounded-full border-2 border-default bg-primary"
                        aria-hidden="true"
                    />
                    <NuxtLink
                        :to="`/review/${a.id}`"
                        class="flex items-center gap-3 rounded-xl border border-default bg-default p-3 transition-colors hover:bg-elevated"
                    >
                        <span
                            class="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"
                        >
                            <UIcon
                                :name="KIND_ICONS[a.kind]"
                                class="size-5"
                            />
                            <span class="sr-only">{{ KIND_LABELS[a.kind] }}</span>
                        </span>
                        <div class="min-w-0 flex-1">
                            <p class="truncate font-medium">{{ a.topicTitle ?? 'Tự do' }}</p>
                            <p class="text-xs text-muted tabular-nums">
                                {{ timeOf(a.createdAt) }} · v{{ a.version }}
                                <template v-if="a.durationS">
                                    · {{ formatDuration(a.durationS) }}
                                </template>
                            </p>
                        </div>
                        <UBadge
                            :color="STATUS_COLORS[a.status]"
                            variant="subtle"
                            :label="STATUS_LABELS[a.status]"
                        />
                    </NuxtLink>
                </li>
            </ol>
        </section>
    </LayoutPage>
</template>
