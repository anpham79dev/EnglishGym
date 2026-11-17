<script setup lang="ts">
import type { AttemptKind } from '#shared/types'
import { fetchMistakes } from '~/api/mistakeApi'

const kind = ref<AttemptKind | undefined>(undefined)
const { data, refresh, pending } = await useAsyncData('mistakes', () => fetchMistakes(kind.value), {
    watch: [kind],
    default: () => [],
})

const tabs: { value: AttemptKind | undefined; label: string }[] = [
    { value: undefined, label: 'Tất cả' },
    { value: 'speaking', label: 'Nói' },
    { value: 'writing', label: 'Viết' },
]
</script>

<template>
    <main class="page">
        <h1>Sổ lỗi</h1>
        <div class="tabs">
            <button
                v-for="t in tabs"
                :key="t.label"
                class="btn btn-sm"
                :class="{ active: kind === t.value }"
                @click="kind = t.value"
            >
                {{ t.label }}
            </button>
        </div>
        <p
            v-if="!pending && !data.length"
            class="muted"
        >
            Chưa có lỗi nào được duyệt.
        </p>
        <MistakesMistakeCard
            v-for="m in data"
            :key="m.id"
            :mistake="m"
            :others="data.filter((o) => o.id !== m.id)"
            @changed="refresh()"
        />
        <p class="muted">
            Cuối tuần dành 5 phút xem lại sổ lỗi: gộp lỗi trùng, chọn 1 lỗi trọng tâm (★).
        </p>
    </main>
</template>
