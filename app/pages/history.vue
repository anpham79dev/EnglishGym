<script setup lang="ts">
import type { AttemptKind } from '#shared/types'
import { fetchAttempts } from '~/api/attemptApi'
import { STATUS_LABELS } from '~/constants'

const kind = ref<AttemptKind | undefined>(undefined)
const { data } = await useAsyncData('history', () => fetchAttempts({ kind: kind.value }), {
    watch: [kind],
    default: () => [],
})

const byDay = computed(() => {
    const groups = new Map<string, typeof data.value>()
    for (const a of data.value) {
        const day = new Date(a.createdAt).toLocaleDateString('vi-VN', {
            weekday: 'short',
            day: '2-digit',
            month: '2-digit',
        })
        groups.set(day, [...(groups.get(day) ?? []), a])
    }
    return [...groups.entries()]
})
</script>

<template>
    <main class="page">
        <h1>Lịch sử</h1>
        <div class="tabs">
            <button
                class="btn btn-sm"
                :class="{ active: !kind }"
                @click="kind = undefined"
            >
                Tất cả
            </button>
            <button
                class="btn btn-sm"
                :class="{ active: kind === 'speaking' }"
                @click="kind = 'speaking'"
            >
                Nói
            </button>
            <button
                class="btn btn-sm"
                :class="{ active: kind === 'writing' }"
                @click="kind = 'writing'"
            >
                Viết
            </button>
        </div>
        <div
            v-for="[day, items] in byDay"
            :key="day"
            class="card"
        >
            <h2>{{ day }}</h2>
            <NuxtLink
                v-for="a in items"
                :key="a.id"
                :to="`/review/${a.id}`"
                class="spread line"
            >
                <span>
                    {{ a.kind === 'speaking' ? '🎙' : '✎' }} {{ a.topicTitle ?? 'Tự do' }}
                    <span class="muted">v{{ a.version }}</span>
                </span>
                <span class="badge">{{ STATUS_LABELS[a.status] }}</span>
            </NuxtLink>
        </div>
    </main>
</template>

<style scoped>
.line {
    padding: 8px 0;
    color: var(--text);
    text-decoration: none;
    border-top: 1px solid var(--border);
}
</style>
