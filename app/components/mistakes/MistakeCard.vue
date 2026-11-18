<script setup lang="ts">
import type { MistakeWithHits } from '#shared/types'
import { patchMistake } from '~/api/mistakeApi'
import { toApiFailure } from '~/api/http'
import { CATEGORY_LABELS } from '~/constants'

/** Row in the mistake log; the detail opens in a slideover (MistakeDetail). */
const props = defineProps<{ mistake: MistakeWithHits }>()
const emit = defineEmits<{ open: []; changed: [] }>()
const notify = useNotify()

const toggleFocus = async () => {
    try {
        await patchMistake(props.mistake.id, { isFocus: !props.mistake.isFocus })
        notify.success(props.mistake.isFocus ? 'Đã bỏ trọng tâm' : 'Đã đặt làm lỗi trọng tâm tuần')
        emit('changed')
    } catch (e) {
        notify.error(toApiFailure(e).message)
    }
}
</script>

<template>
    <div
        class="flex items-start gap-2 rounded-xl border bg-default p-3 transition-colors hover:bg-elevated/60"
        :class="mistake.isFocus ? 'border-warning/60' : 'border-default'"
    >
        <button
            type="button"
            class="min-w-0 flex-1 space-y-1.5 text-left"
            @click="emit('open')"
        >
            <p class="font-medium text-highlighted">{{ mistake.labelVi }}</p>
            <BaseCorrectionPair
                :wrong="mistake.exampleWrong"
                :right="mistake.exampleRight"
                class="text-sm"
            />
            <p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                <UBadge
                    color="neutral"
                    variant="soft"
                    size="sm"
                    :label="
                        CATEGORY_LABELS[mistake.category as keyof typeof CATEGORY_LABELS] ??
                        mistake.category
                    "
                />
                <span class="tabular-nums">{{ mistake.hitCount }} lần</span>
                <span>gần nhất {{ formatDateTime(mistake.lastSeen) }}</span>
            </p>
        </button>
        <UButton
            icon="i-lucide-star"
            :color="mistake.isFocus ? 'warning' : 'neutral'"
            :variant="mistake.isFocus ? 'soft' : 'ghost'"
            :aria-label="mistake.isFocus ? 'Bỏ lỗi trọng tâm tuần' : 'Đặt làm lỗi trọng tâm tuần'"
            :aria-pressed="mistake.isFocus"
            @click="toggleFocus"
        />
    </div>
</template>
