<script setup lang="ts">
import { liveQuery } from 'dexie'
import type { LocalAudio } from '~/composables/useLocalDb'

/** Unsent recordings; retries reuse the same client_attempt_id. */
const emit = defineEmits<{ retry: [item: LocalAudio] }>()
const confirm = useConfirm()

const items = ref<LocalAudio[]>([])
const sub = liveQuery(() =>
    useLocalDb().audios.where('status').equals('pending').reverse().sortBy('createdAt'),
).subscribe((v) => (items.value = v))
onBeforeUnmount(() => sub.unsubscribe())

const remove = async (item: LocalAudio) => {
    const ok = await confirm({
        title: 'Xoá bản ghi chưa gửi?',
        description: 'Bản ghi này chưa được chấm. Xoá rồi thì không lấy lại được.',
        confirmLabel: 'Xoá',
        danger: true,
    })
    if (ok) await useLocalDb().audios.delete(item.id)
}
</script>

<template>
    <UCard v-if="items.length">
        <template #header>
            <h2 class="flex items-center gap-2 font-semibold text-highlighted">
                <UIcon
                    name="i-lucide-cloud-off"
                    class="size-5 text-warning"
                    aria-hidden="true"
                />
                Chưa gửi ({{ items.length }})
            </h2>
        </template>
        <ul class="-my-2 divide-y divide-default">
            <li
                v-for="item in items"
                :key="item.id"
                class="space-y-1 py-3"
            >
                <div class="flex items-center gap-3">
                    <div class="min-w-0 flex-1">
                        <p class="truncate font-medium">{{ item.topicTitle }}</p>
                        <p class="text-xs text-muted tabular-nums">
                            {{ formatDateTime(item.createdAt) }} ·
                            {{ formatDuration(item.durationS) }} ·
                            {{ formatBytes(item.blob.size) }}
                        </p>
                    </div>
                    <UButton
                        icon="i-lucide-send"
                        label="Gửi lại"
                        size="sm"
                        @click="emit('retry', item)"
                    />
                    <UButton
                        icon="i-lucide-trash-2"
                        color="neutral"
                        variant="ghost"
                        size="sm"
                        aria-label="Xoá bản ghi"
                        @click="remove(item)"
                    />
                </div>
                <p
                    v-if="item.lastError"
                    class="text-xs text-error"
                >
                    {{ item.lastError }}
                </p>
            </li>
        </ul>
    </UCard>
</template>
