<script setup lang="ts">
import { exportUrl, importBackup } from '~/api/backupApi'
import { toApiFailure } from '~/api/http'
import { LS_LAST_BACKUP } from '~/constants'

const open = ref(false)
const fileInput = ref<HTMLInputElement>()
const { logout } = useAuth()
const toast = useToast()

const download = (format: 'json' | 'csv' | 'anki') => {
    window.location.href = exportUrl(format)
    if (format === 'json') {
        try {
            localStorage.setItem(LS_LAST_BACKUP, String(Date.now()))
        } catch {
            /* ignore */
        }
    }
    open.value = false
}

const onImport = async (ev: Event) => {
    const file = (ev.target as HTMLInputElement).files?.[0]
    if (!file) return
    try {
        const res = await importBackup(JSON.parse(await file.text()))
        const lines = Object.entries(res.after).map(
            ([k, v]) =>
                `${k}: ${res.before[k as keyof typeof res.before]} → ${v} (file: ${res.inFile[k as keyof typeof res.inFile]})`,
        )
        alert(`Nhập xong. Số bản ghi trước → sau:\n${lines.join('\n')}`)
    } catch (e) {
        toast.error(e instanceof SyntaxError ? 'File không phải JSON' : toApiFailure(e).message)
    } finally {
        if (fileInput.value) fileInput.value.value = ''
        open.value = false
    }
}

const clearSentAudio = async () => {
    if (!confirm('Xoá các audio đã gửi khỏi máy này? Bản chép lời trên server vẫn giữ nguyên.'))
        return
    const n = await useLocalDb().audios.where('status').equals('sent').delete()
    toast.success(`Đã xoá ${n} audio`)
    open.value = false
}
</script>

<template>
    <div class="menu">
        <button
            class="btn btn-sm"
            aria-label="Menu"
            @click="open = !open"
        >
            ⋯
        </button>
        <div
            v-if="open"
            class="backdrop"
            @click="open = false"
        />
        <div
            v-if="open"
            class="panel card"
        >
            <NuxtLink
                to="/history"
                class="btn btn-block"
                @click="open = false"
            >
                Lịch sử
            </NuxtLink>
            <button
                class="btn btn-block"
                @click="download('json')"
            >
                Xuất JSON (sao lưu)
            </button>
            <button
                class="btn btn-block"
                @click="download('csv')"
            >
                Xuất CSV sổ lỗi
            </button>
            <button
                class="btn btn-block"
                @click="download('anki')"
            >
                Xuất CSV cho Anki
            </button>
            <button
                class="btn btn-block"
                @click="fileInput?.click()"
            >
                Nhập từ file JSON
            </button>
            <input
                ref="fileInput"
                type="file"
                accept="application/json,.json"
                hidden
                @change="onImport"
            />
            <button
                class="btn btn-block"
                @click="clearSentAudio"
            >
                Xoá audio cục bộ đã gửi
            </button>
            <button
                class="btn btn-block btn-danger"
                @click="logout"
            >
                Đăng xuất
            </button>
        </div>
    </div>
</template>

<style scoped>
.menu {
    position: relative;
}

.backdrop {
    position: fixed;
    inset: 0;
    z-index: 30;
}

.panel {
    position: absolute;
    right: 0;
    top: 44px;
    z-index: 31;
    width: 250px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.15);
}
</style>
