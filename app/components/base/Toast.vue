<script setup lang="ts">
const { items } = useToast()
</script>

<template>
    <div class="toasts">
        <div
            v-for="t in items"
            :key="t.id"
            class="toast"
            :class="t.type"
        >
            {{ t.text }}
        </div>
    </div>
</template>

<style scoped>
.toasts {
    position: fixed;
    left: 16px;
    right: 16px;
    bottom: calc(var(--nav-h) + 12px + env(safe-area-inset-bottom));
    z-index: 50;
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: center;
    pointer-events: none;
}

.toast {
    max-width: 560px;
    width: 100%;
    background: var(--text);
    color: var(--bg);
    border-radius: 10px;
    padding: 10px 14px;
    font-size: 0.95rem;
}

.toast.error {
    background: var(--danger);
    color: #fff;
}

.toast.success {
    background: var(--primary);
    color: var(--primary-text);
}
</style>
