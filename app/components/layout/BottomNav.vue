<script setup lang="ts">
import { NAV_ITEMS } from '~/constants'

const route = useRoute()
const isActive = (to: string) => (to === '/' ? route.path === '/' : route.path.startsWith(to))
</script>

<template>
    <nav class="nav">
        <NuxtLink
            v-for="item in NAV_ITEMS"
            :key="item.to"
            :to="item.to"
            class="item"
            :class="{ active: isActive(item.to) }"
        >
            <span
                class="icon"
                aria-hidden="true"
            >
                {{ item.icon }}
            </span>
            <span>{{ item.label }}</span>
        </NuxtLink>
    </nav>
</template>

<style scoped>
.nav {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 20;
    display: flex;
    height: calc(var(--nav-h) + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
    background: var(--surface);
    border-top: 1px solid var(--border);
}

.item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    color: var(--muted);
    text-decoration: none;
}

.icon {
    font-size: 1.3rem;
    line-height: 1.2;
}

.item.active {
    color: var(--primary);
    font-weight: 700;
}
</style>
