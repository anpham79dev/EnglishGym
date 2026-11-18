<script setup lang="ts">
/** "Wrong -> right" pair; the arrow is an icon, and both sides are labelled for screen readers. */
defineProps<{ wrong: string; right: string }>()
</script>

<template>
    <p class="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span class="sr-only">Sai:</span>
        <s class="text-error decoration-error/60">{{ wrong }}</s>
        <UIcon
            name="i-lucide-arrow-right"
            class="size-4 shrink-0 text-muted"
            aria-hidden="true"
        />
        <span class="sr-only">Đúng:</span>
        <strong class="font-semibold text-success">{{ right }}</strong>
    </p>
</template>
