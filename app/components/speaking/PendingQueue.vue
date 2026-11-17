<script setup lang="ts">
import { liveQuery } from 'dexie'
import type { LocalAudio } from '~/composables/useLocalDb'

/** Hàng chờ: bài nói đã ghi nhưng chưa gửi được (mất mạng, 429…). Gửi lại dùng đúng client_attempt_id. */
const emit = defineEmits<{ retry: [item: LocalAudio] }>()

const items = ref<LocalAudio[]>([])
const sub = liveQuery(() =>
    useLocalDb().audios.where('status').equals('pending').reverse().sortBy('createdAt'),
).subscribe((v) => (items.value = v))
onBeforeUnmount(() => sub.unsubscribe())

const remove = async (item: LocalAudio) => {
    if (confirm('Xoá bản ghi chưa gửi này?')) await useLocalDb().audios.delete(item.id)
}
</script>

<template>
    <div
        v-if="items.length"
        class="card stack"
    >
        <h2>Chưa gửi ({{ items.length }})</h2>
        <div
            v-for="item in items"
            :key="item.id"
            class="stack item"
        >
            <div class="spread">
                <div>
                    <strong>{{ item.topicTitle }}</strong>
                    <div class="muted">
                        {{ formatDateTime(item.createdAt) }} ·
                        {{ formatDuration(item.durationS) }} ·
                        {{ formatBytes(item.blob.size) }}
                    </div>
                </div>
                <div class="row">
                    <button
                        class="btn btn-sm btn-primary"
                        @click="emit('retry', item)"
                    >
                        Gửi lại
                    </button>
                    <button
                        class="btn btn-sm"
                        @click="remove(item)"
                    >
                        Xoá
                    </button>
                </div>
            </div>
            <p
                v-if="item.lastError"
                class="muted"
            >
                {{ item.lastError }}
            </p>
        </div>
    </div>
</template>

<style scoped>
.item + .item {
    border-top: 1px solid var(--border);
    padding-top: 10px;
}
</style>
