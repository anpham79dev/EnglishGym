<script setup lang="ts">
import { KIND_ICONS } from '~/constants'

/** "Luyện" tab: choose speaking or writing (B7 navigation). */
const OPTIONS = [
    {
        to: '/speaking',
        icon: KIND_ICONS.speaking,
        title: 'Luyện nói',
        text: 'Ghi âm 1–2 phút theo đề, nghe lại, nộp để nhận bản chép lời và lỗi gợi ý.',
    },
    {
        to: '/writing',
        icon: KIND_ICONS.writing,
        title: 'Luyện viết',
        text: 'Viết theo đề, bản nháp tự lưu trên máy, nộp để nhận lỗi gợi ý.',
    },
]
</script>

<template>
    <LayoutPage title="Luyện">
        <div class="grid gap-4 sm:grid-cols-2">
            <NuxtLink
                v-for="o in OPTIONS"
                :key="o.to"
                :to="o.to"
                class="group flex flex-col gap-3 rounded-xl border border-default bg-default p-5 transition-colors hover:border-primary hover:bg-elevated/50"
            >
                <span class="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
                    <UIcon
                        :name="o.icon"
                        class="size-6"
                        aria-hidden="true"
                    />
                </span>
                <span class="text-lg font-semibold text-highlighted">{{ o.title }}</span>
                <span class="text-sm text-toned">{{ o.text }}</span>
                <span class="mt-auto flex items-center gap-1 text-sm font-medium text-primary">
                    Bắt đầu
                    <UIcon
                        name="i-lucide-arrow-right"
                        class="size-4 transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                    />
                </span>
            </NuxtLink>
        </div>
        <div class="flex flex-wrap gap-2">
            <UButton
                to="/topics"
                color="neutral"
                variant="outline"
                icon="i-lucide-library"
                label="Kho đề"
            />
            <UButton
                to="/history"
                color="neutral"
                variant="outline"
                icon="i-lucide-history"
                label="Lịch sử bài nộp"
            />
        </div>
    </LayoutPage>
</template>
