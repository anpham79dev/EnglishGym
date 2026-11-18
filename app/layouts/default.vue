<template>
    <div class="min-h-dvh bg-default">
        <LayoutSideNav />
        <div class="lg:pl-60">
            <header
                class="sticky top-0 z-20 border-b border-default bg-default/85 pt-[env(safe-area-inset-top)] backdrop-blur"
            >
                <div class="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
                    <LayoutBrand class="lg:invisible" />
                    <LayoutAppMenu />
                </div>
            </header>
            <main class="px-4 pt-5 pb-28 lg:pb-12">
                <slot />
            </main>
        </div>
        <LayoutBottomNav class="lg:hidden" />
    </div>
</template>
