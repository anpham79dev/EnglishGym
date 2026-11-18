<script setup lang="ts">
import { toApiFailure } from '~/api/http'

definePageMeta({ layout: 'blank' })

const email = ref('')
const password = ref('')
const error = ref<string | null>(null)
const loading = ref(false)
const { login } = useAuth()

const submit = async () => {
    loading.value = true
    error.value = null
    try {
        await login(email.value, password.value)
        await navigateTo('/')
    } catch (e) {
        error.value = toApiFailure(e).message
    } finally {
        loading.value = false
    }
}
</script>

<template>
    <div class="grid min-h-dvh place-items-center px-4 py-10">
        <div class="w-full max-w-sm space-y-6">
            <div class="space-y-3 text-center">
                <span
                    class="mx-auto grid size-14 place-items-center rounded-2xl bg-primary text-inverted"
                >
                    <UIcon
                        name="i-lucide-dumbbell"
                        class="size-8"
                        aria-hidden="true"
                    />
                </span>
                <h1 class="text-2xl font-semibold tracking-tight text-highlighted">EnglishGym</h1>
                <p class="text-sm text-muted">
                    Nói hoặc viết, duyệt lỗi AI gợi ý, rồi luyện lại đúng chỗ mình hay sai.
                </p>
            </div>
            <UCard>
                <form
                    class="space-y-4"
                    @submit.prevent="submit"
                >
                    <UAlert
                        v-if="error"
                        color="error"
                        variant="subtle"
                        icon="i-lucide-circle-alert"
                        :title="error"
                    />
                    <UFormField
                        label="Email"
                        name="email"
                    >
                        <UInput
                            v-model="email"
                            type="email"
                            autocomplete="username"
                            required
                            size="lg"
                            class="w-full"
                        />
                    </UFormField>
                    <UFormField
                        label="Mật khẩu"
                        name="password"
                    >
                        <UInput
                            v-model="password"
                            type="password"
                            autocomplete="current-password"
                            required
                            size="lg"
                            class="w-full"
                        />
                    </UFormField>
                    <UButton
                        type="submit"
                        block
                        size="lg"
                        :loading="loading"
                        label="Đăng nhập"
                    />
                </form>
            </UCard>
        </div>
    </div>
</template>
