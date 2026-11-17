<template>
    <div>
        <header class="header">
            <NuxtLink
                to="/"
                class="brand"
            >
                EnglishGym
            </NuxtLink>
            <LayoutAppMenu />
        </header>
        <slot />
        <LayoutBottomNav />
    </div>
</template>

<style scoped>
.header {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 680px;
    margin: 0 auto;
    padding: 8px 16px;
    background: var(--bg);
}

.brand {
    font-weight: 800;
    text-decoration: none;
    color: var(--text);
}
</style>
