<script setup lang="ts">
import { NAV_ITEMS, navMatches } from '~/constants'

const route = useRoute()
const isActive = (to: string) =>
    navMatches(
        NAV_ITEMS.find((i) => i.to === to)!,
        route.path,
    )
</script>

<template>
    <nav
        class="fixed inset-x-0 bottom-0 z-30 border-t border-default bg-default/90 pb-[env(safe-area-inset-bottom)] backdrop-blur"
        aria-label="Điều hướng chính"
    >
        <ul class="mx-auto flex max-w-xl">
            <li
                v-for="item in NAV_ITEMS"
                :key="item.to"
                class="flex-1"
            >
                <NuxtLink
                    :to="item.to"
                    class="flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs transition-colors"
                    :class="
                        isActive(item.to)
                            ? 'font-semibold text-primary'
                            : 'text-muted hover:text-default'
                    "
                    :aria-current="isActive(item.to) ? 'page' : undefined"
                >
                    <UIcon
                        :name="item.icon"
                        class="size-6"
                        aria-hidden="true"
                    />
                    <span>{{ item.label }}</span>
                </NuxtLink>
            </li>
        </ul>
    </nav>
</template>
