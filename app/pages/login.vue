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
    <main class="page login">
        <h1>EnglishGym</h1>
        <p class="muted">Nói hoặc viết → phản hồi → duyệt lỗi → ôn lại → thử lại.</p>
        <form
            class="card stack"
            @submit.prevent="submit"
        >
            <p
                v-if="error"
                class="alert"
            >
                {{ error }}
            </p>
            <div>
                <label for="email">Email</label>
                <input
                    id="email"
                    v-model="email"
                    type="email"
                    autocomplete="username"
                    required
                />
            </div>
            <div>
                <label for="password">Mật khẩu</label>
                <input
                    id="password"
                    v-model="password"
                    type="password"
                    autocomplete="current-password"
                    required
                />
            </div>
            <button
                class="btn btn-primary btn-block"
                :disabled="loading"
            >
                {{ loading ? 'Đang đăng nhập…' : 'Đăng nhập' }}
            </button>
        </form>
    </main>
</template>

<style scoped>
.login {
    padding-top: 15vh;
    max-width: 420px;
}
</style>
