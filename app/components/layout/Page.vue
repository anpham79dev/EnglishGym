<script setup lang="ts">
/** Page shell: title row with optional actions; `wide` for two-column screens on desktop. */
withDefaults(defineProps<{ title?: string; wide?: boolean }>(), {
    title: undefined,
    wide: false,
})
</script>

<template>
    <div
        class="mx-auto w-full space-y-4"
        :class="wide ? 'max-w-5xl' : 'max-w-2xl'"
    >
        <div
            v-if="title || $slots.actions"
            class="flex items-center justify-between gap-3"
        >
            <h1 class="text-2xl font-semibold tracking-tight text-highlighted">{{ title }}</h1>
            <slot name="actions" />
        </div>
        <slot />
    </div>
</template>
