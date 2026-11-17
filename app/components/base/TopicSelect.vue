<script setup lang="ts">
import type { Topic } from '#shared/types'

const props = defineProps<{ topics: Topic[] }>()
const model = defineModel<string | null>({ required: true })

const current = computed(() => props.topics.find((t) => t.id === model.value) ?? null)
</script>

<template>
    <div class="card stack">
        <div>
            <label for="topic">Đề</label>
            <select
                id="topic"
                v-model="model"
            >
                <option :value="null">Tự do</option>
                <option
                    v-for="t in topics"
                    :key="t.id"
                    :value="t.id"
                >
                    {{ t.title }}
                </option>
            </select>
        </div>
        <p
            v-if="current"
            class="prewrap"
        >
            {{ current.prompt }}
        </p>
    </div>
</template>
