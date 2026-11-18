<script setup lang="ts">
import type { CardView, Rating } from '~/api/cardApi'
import { KIND_ICONS } from '~/constants'

/**
 * One review card (N5) or quiz question (N6).
 * Front: the sentence you wrote or said, with the wrong part highlighted. Optionally type
 * your fix, then flip. Back: the correction, your note and a link to the original attempt.
 * In quiz mode the pattern label stays hidden until the answer is shown.
 */
const props = defineProps<{ card: CardView; quiz?: boolean; busy?: boolean }>()
const emit = defineEmits<{ rate: [rating: Rating] }>()

const flipped = ref(false)
const answer = ref('')
watch(
    () => props.card.id,
    () => {
        flipped.value = false
        answer.value = ''
    },
)

const RATINGS: {
    value: Rating
    label: string
    color: 'error' | 'warning' | 'primary' | 'success'
}[] = [
    { value: 1, label: 'Lại', color: 'error' },
    { value: 2, label: 'Khó', color: 'warning' },
    { value: 3, label: 'Được', color: 'primary' },
    { value: 4, label: 'Dễ', color: 'success' },
]
const now = Date.now()
const normalized = (s: string) => s.trim().toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ')
const answeredRight = computed(
    () =>
        !!answer.value.trim() &&
        normalized(answer.value).includes(normalized(props.card.correction)),
)
</script>

<template>
    <div class="space-y-4">
        <UCard :ui="{ body: 'space-y-4' }">
            <div class="flex items-center gap-2 text-xs text-muted">
                <UIcon
                    :name="KIND_ICONS[card.kind]"
                    class="size-4"
                    aria-hidden="true"
                />
                <span>{{ card.kind === 'speaking' ? 'Bạn đã nói' : 'Bạn đã viết' }}</span>
                <UBadge
                    v-if="!quiz || flipped"
                    color="neutral"
                    variant="soft"
                    size="sm"
                    class="ml-auto"
                    :label="card.labelVi"
                />
            </div>

            <p class="text-lg leading-relaxed text-highlighted">
                <template v-if="card.context">
                    {{ card.context.before }}
                    <mark>{{ card.context.quote }}</mark>
                    {{ card.context.after }}
                </template>
                <mark v-else>{{ card.quote }}</mark>
            </p>

            <div
                v-if="!flipped"
                class="space-y-3"
            >
                <UFormField
                    label="Bạn sẽ sửa thế nào?"
                    help="Không bắt buộc. Tự nghĩ câu đúng trước khi lật thẻ."
                >
                    <UInput
                        v-model="answer"
                        size="lg"
                        class="w-full"
                        autocapitalize="off"
                        @keydown.enter="flipped = true"
                    />
                </UFormField>
                <UButton
                    block
                    size="lg"
                    icon="i-lucide-eye"
                    label="Xem đáp án"
                    @click="flipped = true"
                />
            </div>

            <Transition
                enter-active-class="transition duration-200 ease-out"
                enter-from-class="opacity-0 -translate-y-1"
            >
                <div
                    v-if="flipped"
                    class="space-y-3 border-t border-default pt-4"
                >
                    <BaseCorrectionPair
                        :wrong="card.quote"
                        :right="card.correction"
                        class="text-base"
                    />
                    <p
                        v-if="answer.trim()"
                        class="flex items-center gap-1.5 text-sm"
                        :class="answeredRight ? 'text-success' : 'text-muted'"
                    >
                        <UIcon
                            :name="
                                answeredRight ? 'i-lucide-circle-check' : 'i-lucide-message-square'
                            "
                            class="size-4"
                            aria-hidden="true"
                        />
                        Bạn trả lời: {{ answer }}
                    </p>
                    <p
                        v-if="card.note"
                        class="prewrap flex items-start gap-1.5 text-sm text-toned"
                    >
                        <UIcon
                            name="i-lucide-sticky-note"
                            class="mt-0.5 size-4 shrink-0"
                            aria-hidden="true"
                        />
                        {{ card.note }}
                    </p>
                    <ULink
                        :to="`/review/${card.attemptId}`"
                        class="inline-flex items-center gap-1 text-sm text-primary"
                    >
                        Xem bài gốc
                        <UIcon
                            name="i-lucide-arrow-up-right"
                            class="size-4"
                            aria-hidden="true"
                        />
                    </ULink>
                </div>
            </Transition>
        </UCard>

        <div
            v-if="flipped"
            class="grid grid-cols-4 gap-2"
            role="group"
            aria-label="Bạn nhớ thế nào?"
        >
            <UButton
                v-for="r in RATINGS"
                :key="r.value"
                :color="r.color"
                variant="soft"
                size="lg"
                :disabled="busy"
                class="flex-col justify-center gap-0.5 py-2"
                @click="emit('rate', r.value)"
            >
                <span class="font-semibold">{{ r.label }}</span>
                <span class="text-xs font-normal opacity-80">
                    {{ formatInterval(card.next[r.value] - now) }}
                </span>
            </UButton>
        </div>
    </div>
</template>
