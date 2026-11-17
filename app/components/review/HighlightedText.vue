<script setup lang="ts">
import { segmentText } from '#shared/utils/quote'

/** Highlights matched quotes only; never renders AI text as HTML. */
const props = defineProps<{
    text: string
    issues: { index: number; quote: string; checked: boolean }[]
}>()

const segments = computed(() =>
    segmentText(
        props.text,
        props.issues.map((i) => ({ index: i.index, quote: i.quote })),
    ),
)
const checkedOf = (idx: number | null) =>
    props.issues.find((i) => i.index === idx)?.checked ?? false
</script>

<template>
    <p class="prewrap">
        <template
            v-for="(s, i) in segments"
            :key="i"
        >
            <mark
                v-if="s.issueIndex !== null"
                :class="{ off: !checkedOf(s.issueIndex) }"
                :title="`Lỗi #${s.issueIndex + 1}`"
            >
                {{ s.text }}
                <sup>{{ s.issueIndex + 1 }}</sup>
            </mark>
            <template v-else>{{ s.text }}</template>
        </template>
    </p>
</template>
