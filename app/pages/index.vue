<script setup lang="ts">
import { fetchToday } from '~/api/attemptApi'
import { LS_LAST_BACKUP } from '~/constants'
import type { LocalAudio } from '~/composables/useLocalDb'

const { data, error, refresh } = await useAsyncData('today', () =>
    fetchToday(startOfToday(), localDayIndex()),
)
const { sending, failure, send } = useSpeakingSubmit()

const needBackup = computed(() => {
    let last = 0
    try {
        last = Number(localStorage.getItem(LS_LAST_BACKUP) || 0)
    } catch {
        /* ignore */
    }
    const isSunday = new Date().getDay() === 0
    return (isSunday && last < startOfToday()) || Date.now() - last > 8 * DAY_MS
})

const retry = (item: LocalAudio) => send(item)
</script>

<template>
    <main class="page">
        <h1>Hôm nay</h1>
        <p
            v-if="error"
            class="alert"
        >
            Không tải được dữ liệu.
            <button
                class="btn btn-sm"
                @click="refresh()"
            >
                Thử lại
            </button>
        </p>

        <template v-if="data">
            <div class="card">
                <div class="spread">
                    <div>
                        <span class="muted">🎙 Đề nói</span>
                        <h2>{{ data.speakingTopic?.title ?? 'Tự do' }}</h2>
                    </div>
                    <span
                        class="badge"
                        :class="{ 'badge-ok': data.done.speaking }"
                    >
                        {{ data.done.speaking }} bài
                    </span>
                </div>
                <p v-if="data.speakingTopic">{{ data.speakingTopic.prompt }}</p>
                <NuxtLink
                    :to="{ path: '/speaking', query: { topic: data.speakingTopic?.id } }"
                    class="btn btn-primary btn-block"
                >
                    Bắt đầu nói
                </NuxtLink>
            </div>

            <div class="card">
                <div class="spread">
                    <div>
                        <span class="muted">✎ Đề viết</span>
                        <h2>{{ data.writingTopic?.title ?? 'Tự do' }}</h2>
                    </div>
                    <span
                        class="badge"
                        :class="{ 'badge-ok': data.done.writing }"
                    >
                        {{ data.done.writing }} bài
                    </span>
                </div>
                <p v-if="data.writingTopic">{{ data.writingTopic.prompt }}</p>
                <NuxtLink
                    :to="{ path: '/writing', query: { topic: data.writingTopic?.id } }"
                    class="btn btn-primary btn-block"
                >
                    Bắt đầu viết
                </NuxtLink>
            </div>

            <div
                v-if="data.pendingReview.length"
                class="card"
            >
                <h2>Chờ bạn duyệt</h2>
                <div class="row">
                    <NuxtLink
                        v-for="a in data.pendingReview"
                        :key="a.id"
                        :to="`/review/${a.id}`"
                        class="btn btn-sm"
                    >
                        {{ a.kind === 'speaking' ? '🎙' : '✎' }} Duyệt
                    </NuxtLink>
                </div>
            </div>

            <div
                v-if="data.focus"
                class="card"
            >
                <span class="muted">★ Lỗi trọng tâm tuần</span>
                <h2>{{ data.focus.labelVi }}</h2>
                <p>
                    <s>{{ data.focus.exampleWrong }}</s>
                    →
                    <strong>{{ data.focus.exampleRight }}</strong>
                </p>
            </div>

            <p
                v-if="failure"
                class="alert"
            >
                {{ failure.message }}
            </p>
            <SpeakingPendingQueue
                v-if="!sending"
                @retry="retry"
            />

            <div
                v-if="needBackup"
                class="alert"
            >
                Đến lúc sao lưu: mở menu ⋯ →
                <strong>Xuất JSON</strong>
                .
            </div>

            <p class="muted">
                Gemini hôm nay: {{ data.geminiUsedToday }}/{{ data.geminiDailyLimit }} lượt ·
                {{ data.model }}
            </p>
        </template>
    </main>
</template>
