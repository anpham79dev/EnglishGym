<script setup lang="ts">
import type { CheckinKind } from '#shared/types'
import { dayKey } from '#shared/utils/streak'
import { createCheckin } from '~/api/calendarApi'
import { toApiFailure } from '~/api/http'
import { CHECKIN_KINDS } from '~/constants'

/** Manual check-in for a day studied outside the app (books, listening…). */
const props = defineProps<{ date?: string }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [] }>()
const notify = useNotify()

const kind = ref<CheckinKind>('book')
const minutes = ref<number | null>(30)
const note = ref('')
const saving = ref(false)
const day = computed(() => props.date ?? dayKey(Date.now()))

const save = async () => {
    saving.value = true
    try {
        await createCheckin({
            date: day.value,
            kind: kind.value,
            minutes: minutes.value || null,
            note: note.value,
        })
        notify.success('Đã điểm danh')
        note.value = ''
        open.value = false
        emit('saved')
    } catch (e) {
        notify.error(toApiFailure(e).message)
    } finally {
        saving.value = false
    }
}
</script>

<template>
    <UModal
        v-model:open="open"
        title="Điểm danh tự học"
        :description="`Ngày ${day.split('-').reverse().join('/')}. Dùng cho buổi học bằng sách, nghe, đọc ngoài app.`"
    >
        <template #body>
            <form
                class="space-y-4"
                @submit.prevent="save"
            >
                <UFormField label="Bạn đã học gì?">
                    <div
                        class="grid grid-cols-2 gap-2 sm:grid-cols-3"
                        role="radiogroup"
                        aria-label="Loại tự học"
                    >
                        <UButton
                            v-for="(k, value) in CHECKIN_KINDS"
                            :key="value"
                            :icon="k.icon"
                            :label="k.label"
                            :variant="kind === value ? 'solid' : 'outline'"
                            :color="kind === value ? 'primary' : 'neutral'"
                            class="justify-center"
                            role="radio"
                            :aria-checked="kind === value"
                            @click="kind = value"
                        />
                    </div>
                </UFormField>
                <UFormField
                    label="Số phút"
                    help="Có thể để trống."
                >
                    <UInputNumber
                        v-model="minutes"
                        :min="0"
                        :max="1440"
                        :step="5"
                        class="w-40"
                    />
                </UFormField>
                <UFormField label="Ghi chú">
                    <UInput
                        v-model="note"
                        placeholder="Grammar in Use unit 12"
                        class="w-full"
                    />
                </UFormField>
                <div class="flex justify-end gap-2">
                    <UButton
                        color="neutral"
                        variant="ghost"
                        label="Huỷ"
                        @click="open = false"
                    />
                    <UButton
                        type="submit"
                        icon="i-lucide-calendar-check"
                        label="Điểm danh"
                        :loading="saving"
                    />
                </div>
            </form>
        </template>
    </UModal>
</template>
