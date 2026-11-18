<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import { NAV_ITEMS, navMatches } from '~/constants'

const route = useRoute()
const items = computed<NavigationMenuItem[][]>(() => [
    NAV_ITEMS.map((i) => ({
        label: i.label,
        icon: i.icon,
        to: i.to,
        active: navMatches(i, route.path),
    })),
    [
        { label: 'Lịch luyện tập', icon: 'i-lucide-calendar-days', to: '/calendar' },
        { label: 'Lịch sử', icon: 'i-lucide-history', to: '/history' },
        { label: 'Kho đề', icon: 'i-lucide-library', to: '/topics' },
    ],
])
</script>

<template>
    <aside
        class="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col gap-6 border-r border-default bg-elevated/40 p-4 lg:flex"
    >
        <LayoutBrand class="px-2 pt-1" />
        <UNavigationMenu
            :items="items"
            orientation="vertical"
            aria-label="Điều hướng chính"
        />
    </aside>
</template>
