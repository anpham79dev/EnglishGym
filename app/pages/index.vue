<script setup lang="ts">
import { MAX_BACKUP_BYTES } from '#shared/constants/app'
import { fetchToday } from '~/api/attemptApi'
import { KIND_ICONS, KIND_LABELS, LS_LAST_BACKUP } from '~/constants'
import type { LocalAudio } from '~/composables/useLocalDb'

const { data, error, refresh } = await useAsyncData('today', () =>
    fetchToday(startOfToday(), localDayIndex()),
)
const { sending, failure, send } = useSpeakingSubmit()
const { download, downloading } = useBackup()

const lastBackup = ref(0)
onMounted(() => {
    try {
        lastBackup.value = Number(localStorage.getItem(LS_LAST_BACKUP) || 0)
    } catch {
        /* private mode */
    }
})
const needBackup = computed(() => {
    const isSunday = new Date().getDay() === 0
    return (
        (isSunday && lastBackup.value < startOfToday()) ||
        Date.now() - lastBackup.value > 8 * DAY_MS
    )
})
/** Web export stops working above MAX_BACKUP_BYTES; warn from 80 %. */
const backupTooBig = computed(() => !!data.value && data.value.backupBytes > MAX_BACKUP_BYTES * 0.8)
const backupNow = async () => {
    if (await download('json')) lastBackup.value = Date.now()
}

const practice = computed(() =>
    data.value
        ? [
              {
                  kind: 'speaking' as const,
                  topic: data.value.speakingTopic,
                  done: data.value.done.speaking,
                  to: { path: '/speaking', query: { topic: data.value.speakingTopic?.id } },
                  cta: 'Bắt đầu nói',
              },
              {
                  kind: 'writing' as const,
                  topic: data.value.writingTopic,
                  done: data.value.done.writing,
                  to: { path: '/writing', query: { topic: data.value.writingTopic?.id } },
                  cta: 'Bắt đầu viết',
              },
          ]
        : [],
)

const retry = (item: LocalAudio) => send(item)
</script>

<template>
    <LayoutPage title="Hôm nay">
        <UAlert
            v-if="error"
            color="error"
            variant="subtle"
            icon="i-lucide-wifi-off"
            title="Không tải được dữ liệu"
            :actions="[
                {
                    label: 'Thử lại',
                    color: 'neutral',
                    variant: 'outline',
                    onClick: () => refresh(),
                },
            ]"
        />

        <div
            v-if="!data && !error"
            class="grid gap-4 sm:grid-cols-2"
        >
            <USkeleton class="h-48 rounded-xl" />
            <USkeleton class="h-48 rounded-xl" />
        </div>

        <template v-if="data">
            <div class="grid gap-4 sm:grid-cols-2">
                <UCard
                    v-for="p in practice"
                    :key="p.kind"
                    :ui="{ root: 'flex flex-col', body: 'flex flex-1 flex-col gap-3' }"
                >
                    <div class="flex items-start justify-between gap-3">
                        <div class="flex items-center gap-3">
                            <span
                                class="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"
                            >
                                <UIcon
                                    :name="KIND_ICONS[p.kind]"
                                    class="size-5"
                                    aria-hidden="true"
                                />
                            </span>
                            <div>
                                <p class="text-xs font-medium text-muted uppercase">
                                    Đề {{ p.kind === 'speaking' ? 'nói' : 'viết' }}
                                </p>
                                <h2 class="font-semibold text-highlighted">
                                    {{ p.topic?.title ?? 'Tự do' }}
                                </h2>
                            </div>
                        </div>
                        <UBadge
                            :color="p.done ? 'success' : 'neutral'"
                            variant="subtle"
                            :icon="p.done ? 'i-lucide-check' : undefined"
                            :label="`${p.done} bài`"
                        />
                    </div>
                    <p
                        v-if="p.topic"
                        class="flex-1 text-sm text-toned"
                    >
                        {{ p.topic.prompt }}
                    </p>
                    <UButton
                        :to="p.to"
                        block
                        size="lg"
                        trailing-icon="i-lucide-arrow-right"
                        :label="p.cta"
                    />
                </UCard>
            </div>

            <UCard v-if="data.pendingReview.length">
                <template #header>
                    <h2 class="font-semibold text-highlighted">
                        Chờ bạn duyệt ({{ data.pendingReview.length }})
                    </h2>
                </template>
                <ul class="-my-2 divide-y divide-default">
                    <li
                        v-for="a in data.pendingReview"
                        :key="a.id"
                    >
                        <NuxtLink
                            :to="`/review/${a.id}`"
                            class="flex min-h-11 items-center gap-3 py-2 hover:text-primary"
                        >
                            <UIcon
                                :name="KIND_ICONS[a.kind]"
                                class="size-5 text-muted"
                                aria-hidden="true"
                            />
                            <span class="flex-1">{{ KIND_LABELS[a.kind] }}</span>
                            <UIcon
                                name="i-lucide-chevron-right"
                                class="size-4 text-muted"
                                aria-hidden="true"
                            />
                        </NuxtLink>
                    </li>
                </ul>
            </UCard>

            <UCard v-if="data.focus">
                <div class="space-y-2">
                    <p class="flex items-center gap-1.5 text-xs font-medium text-warning uppercase">
                        <UIcon
                            name="i-lucide-star"
                            class="size-4"
                            aria-hidden="true"
                        />
                        Lỗi trọng tâm tuần
                    </p>
                    <h2 class="font-semibold text-highlighted">{{ data.focus.labelVi }}</h2>
                    <BaseCorrectionPair
                        :wrong="data.focus.exampleWrong"
                        :right="data.focus.exampleRight"
                    />
                </div>
            </UCard>

            <UAlert
                v-if="failure"
                color="error"
                variant="subtle"
                icon="i-lucide-circle-alert"
                :title="failure.message"
            />
            <SpeakingPendingQueue
                v-if="!sending"
                @retry="retry"
            />

            <UAlert
                v-if="needBackup"
                color="warning"
                variant="subtle"
                icon="i-lucide-hard-drive-download"
                title="Đến lúc sao lưu"
                :description="
                    backupTooBig
                        ? `Dữ liệu khoảng ${formatBytes(data.backupBytes)}, gần hoặc đã vượt giới hạn 4 MB của web. Chạy npm run db:backup trên máy.`
                        : `Bản sao lưu khoảng ${formatBytes(data.backupBytes)}.`
                "
                :actions="
                    backupTooBig
                        ? []
                        : [
                              {
                                  label: 'Sao lưu ngay',
                                  icon: 'i-lucide-download',
                                  loading: downloading,
                                  onClick: backupNow,
                              },
                          ]
                "
            />

            <p class="flex items-center gap-1.5 text-xs text-muted">
                <UIcon
                    name="i-lucide-sparkles"
                    class="size-3.5"
                    aria-hidden="true"
                />
                Gemini hôm nay: {{ data.geminiUsedToday }}/{{ data.geminiDailyLimit }} lượt, model
                {{ data.model }}
            </p>
        </template>
    </LayoutPage>
</template>
