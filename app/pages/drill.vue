<script setup lang="ts">
import { fetchDueCards, reviewCard, type Rating } from '~/api/cardApi'
import { toApiFailure } from '~/api/http'

const notify = useNotify()
const { data, error, refresh, status } = await useAsyncData('due-cards', () => fetchDueCards(20))

const index = ref(0)
const done = ref(0)
const busy = ref(false)
const card = computed(() => data.value?.cards[index.value] ?? null)
const sessionSize = computed(() => data.value?.cards.length ?? 0)

const rate = async (rating: Rating) => {
    if (!card.value) return
    busy.value = true
    try {
        await reviewCard(card.value.id, rating)
        done.value++
        index.value++
    } catch (e) {
        notify.error(toApiFailure(e).message)
    } finally {
        busy.value = false
    }
}

const again = async () => {
    index.value = 0
    await refresh()
}
</script>

<template>
    <LayoutPage title="Ôn lỗi">
        <template #actions>
            <UButton
                to="/quiz"
                color="neutral"
                variant="outline"
                icon="i-lucide-clipboard-check"
                label="Kiểm tra tuần"
            />
        </template>

        <UAlert
            v-if="error"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            :title="toApiFailure(error).message"
        />
        <USkeleton
            v-if="status === 'pending' && !data"
            class="h-72 w-full rounded-xl"
        />

        <template v-if="data">
            <div
                v-if="card"
                class="space-y-1"
            >
                <div class="flex justify-between text-xs text-muted tabular-nums">
                    <span>Thẻ {{ index + 1 }}/{{ sessionSize }}</span>
                    <span>Còn {{ data.total - done }} thẻ đến hạn</span>
                </div>
                <UProgress
                    :model-value="index"
                    :max="sessionSize"
                    size="sm"
                />
            </div>

            <DrillFlashcard
                v-if="card"
                :card="card"
                :busy="busy"
                @rate="rate"
            />

            <UCard v-else>
                <div class="flex flex-col items-center gap-3 py-8 text-center">
                    <UIcon
                        :name="done ? 'i-lucide-circle-check-big' : 'i-lucide-coffee'"
                        class="size-12"
                        :class="done ? 'text-success' : 'text-muted'"
                        aria-hidden="true"
                    />
                    <p class="font-medium text-highlighted">
                        {{ done ? `Xong ${done} thẻ hôm nay` : 'Không có thẻ nào đến hạn' }}
                    </p>
                    <p class="text-sm text-muted">
                        Thẻ ôn được tạo từ những lỗi bạn đã duyệt. Lịch ôn tự giãn ra khi bạn nhớ
                        tốt.
                    </p>
                    <div class="flex gap-2">
                        <UButton
                            v-if="done"
                            color="neutral"
                            variant="outline"
                            icon="i-lucide-refresh-cw"
                            label="Kiểm tra thẻ mới"
                            @click="again"
                        />
                        <UButton
                            to="/"
                            label="Về Hôm nay"
                            trailing-icon="i-lucide-arrow-right"
                        />
                    </div>
                </div>
            </UCard>
        </template>
    </LayoutPage>
</template>
