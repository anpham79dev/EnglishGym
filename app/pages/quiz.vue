<script setup lang="ts">
import { QUIZ_SIZE } from '#shared/constants/app'
import {
    createQuiz,
    fetchQuizzes,
    finishQuiz,
    reviewCard,
    type Quiz,
    type Rating,
} from '~/api/cardApi'
import { toApiFailure } from '~/api/http'

/**
 * Weekly quiz (N6): the cards you get wrong most, without hints. Answers also update the
 * review schedule, since each one is a real recall.
 */
const notify = useNotify()
const { data: history, refresh: refreshHistory } = await useAsyncData('quizzes', fetchQuizzes, {
    default: () => [],
})

const quiz = ref<Quiz | null>(null)
const starting = ref(false)
const busy = ref(false)
const remaining = computed(() => quiz.value?.cards.filter((c) => !quiz.value!.answered[c.id]) ?? [])
const card = computed(() => remaining.value[0] ?? null)
const answeredCount = computed(() => (quiz.value ? Object.keys(quiz.value.answered).length : 0))

const start = async () => {
    starting.value = true
    try {
        quiz.value = await createQuiz()
    } catch (e) {
        notify.error(toApiFailure(e).message)
    } finally {
        starting.value = false
    }
}

const rate = async (rating: Rating) => {
    if (!quiz.value || !card.value) return
    busy.value = true
    try {
        await reviewCard(card.value.id, rating, quiz.value.id)
        quiz.value.answered = { ...quiz.value.answered, [card.value.id]: rating }
        if (!remaining.value.length) {
            quiz.value = await finishQuiz(quiz.value.id)
            await refreshHistory()
        }
    } catch (e) {
        notify.error(toApiFailure(e).message)
    } finally {
        busy.value = false
    }
}

const percent = (s: number | null) => (s === null ? '–' : `${Math.round(s * 100)}%`)
</script>

<template>
    <LayoutPage title="Kiểm tra tuần">
        <template v-if="!quiz">
            <UCard>
                <div class="space-y-3">
                    <p class="text-toned">
                        {{ QUIZ_SIZE }} câu lấy từ những lỗi bạn hay sai nhất: hay chấm "Lại", còn
                        lặp lại trong bài gần đây, hoặc là lỗi trọng tâm. Không có gợi ý nhóm lỗi
                        trước khi lật thẻ.
                    </p>
                    <UButton
                        size="lg"
                        icon="i-lucide-clipboard-check"
                        label="Bắt đầu kiểm tra"
                        :loading="starting"
                        @click="start"
                    />
                </div>
            </UCard>

            <UCard v-if="history.length">
                <template #header>
                    <h2 class="font-semibold text-highlighted">Các lần trước</h2>
                </template>
                <ul class="-my-2 divide-y divide-default">
                    <li
                        v-for="q in history"
                        :key="q.id"
                        class="flex items-center justify-between py-2 text-sm"
                    >
                        <span>{{ formatDateTime(q.createdAt) }}</span>
                        <UBadge
                            :color="
                                q.score === null
                                    ? 'neutral'
                                    : q.score >= 0.7
                                      ? 'success'
                                      : 'warning'
                            "
                            variant="subtle"
                            :label="q.finishedAt ? percent(q.score) : 'Chưa xong'"
                        />
                    </li>
                </ul>
            </UCard>
        </template>

        <template v-else-if="card">
            <div class="space-y-1">
                <div class="flex justify-between text-xs text-muted tabular-nums">
                    <span>Câu {{ answeredCount + 1 }}/{{ quiz.cards.length }}</span>
                </div>
                <UProgress
                    :model-value="answeredCount"
                    :max="quiz.cards.length"
                    size="sm"
                />
            </div>
            <DrillFlashcard
                :card="card"
                quiz
                :busy="busy"
                @rate="rate"
            />
        </template>

        <UCard v-else>
            <div class="flex flex-col items-center gap-3 py-8 text-center">
                <UIcon
                    name="i-lucide-trophy"
                    class="size-12 text-warning"
                    aria-hidden="true"
                />
                <p class="text-3xl font-semibold text-highlighted tabular-nums">
                    {{ percent(quiz.score) }}
                </p>
                <p class="text-sm text-muted">
                    Tỉ lệ câu bạn chấm "Được" hoặc "Dễ". Điểm theo tuần nằm ở trang Tiến bộ.
                </p>
                <UButton
                    to="/"
                    label="Về Hôm nay"
                    trailing-icon="i-lucide-arrow-right"
                />
            </div>
        </UCard>
    </LayoutPage>
</template>
