<script setup lang="ts">
/** Confirmation modal opened through useConfirm(); emits close(true | false). */
withDefaults(
    defineProps<{
        title: string
        description?: string
        confirmLabel?: string
        danger?: boolean
    }>(),
    { description: undefined, confirmLabel: 'Đồng ý', danger: false },
)
const emit = defineEmits<{ close: [ok: boolean] }>()
</script>

<template>
    <UModal
        :title="title"
        :description="description"
        :close="false"
        :ui="{ footer: 'justify-end' }"
    >
        <template #footer>
            <UButton
                color="neutral"
                variant="ghost"
                label="Huỷ"
                @click="emit('close', false)"
            />
            <UButton
                :color="danger ? 'error' : 'primary'"
                :label="confirmLabel"
                @click="emit('close', true)"
            />
        </template>
    </UModal>
</template>
