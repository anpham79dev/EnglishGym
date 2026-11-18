<script setup lang="ts">
import type { Topic } from '#shared/types'

const props = defineProps<{ topics: Topic[] }>()
const model = defineModel<string | null>({ required: true })

/** Select items cannot hold null, so "free topic" uses a sentinel value. */
const FREE = '__free__'
const value = computed({
    get: () => model.value ?? FREE,
    set: (v: string) => (model.value = v === FREE ? null : v),
})
const items = computed(() => [
    { label: 'Tự do', value: FREE },
    ...props.topics.map((t) => ({ label: t.title, value: t.id })),
])
const current = computed(() => props.topics.find((t) => t.id === model.value) ?? null)
</script>

<template>
    <UCard>
        <div class="space-y-3">
            <UFormField label="Đề">
                <USelect
                    v-model="value"
                    :items="items"
                    size="lg"
                    class="w-full"
                />
            </UFormField>
            <p
                v-if="current"
                class="prewrap text-sm text-toned"
            >
                {{ current.prompt }}
            </p>
        </div>
    </UCard>
</template>
