<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { MAX_BACKUP_BYTES } from '#shared/constants/app'
import { importBackup, type ImportResult } from '~/api/backupApi'
import { toApiFailure } from '~/api/http'
import type { AppSettings } from '~/composables/useSettings'

const fileInput = ref<HTMLInputElement>()
const { logout } = useAuth()
const notify = useNotify()
const confirm = useConfirm()
const { download } = useBackup()
const colorMode = useColorMode()
const { settings, set } = useSettings()

const importResult = ref<ImportResult | null>(null)
const TABLE_LABELS: Record<keyof ImportResult['after'], string> = {
    topics: 'Đề',
    attempts: 'Bài nộp',
    mistakes: 'Kiểu lỗi',
    mistake_hits: 'Lần mắc',
    checkins: 'Điểm danh',
}

const onImport = async (ev: Event) => {
    const file = (ev.target as HTMLInputElement).files?.[0]
    if (!file) return
    try {
        // Vercel rejects bodies over 4.5 MB; big backups go through the local script.
        if (file.size > MAX_BACKUP_BYTES) {
            notify.error(
                `File ${formatBytes(file.size)} quá lớn để nhập qua web. Chạy npm run db:restore trên máy.`,
            )
            return
        }
        importResult.value = await importBackup(JSON.parse(await file.text()))
    } catch (e) {
        notify.error(e instanceof SyntaxError ? 'File không phải JSON' : toApiFailure(e).message)
    } finally {
        if (fileInput.value) fileInput.value.value = ''
    }
}

const clearSentAudio = async () => {
    const ok = await confirm({
        title: 'Xoá audio đã gửi?',
        description: 'Chỉ xoá file trên máy này. Bản chép lời trên server vẫn giữ nguyên.',
        confirmLabel: 'Xoá',
        danger: true,
    })
    if (!ok) return
    const n = await useLocalDb().audios.where('status').equals('sent').delete()
    notify.success(`Đã xoá ${n} audio`)
}

const themeItem = (label: string, value: 'system' | 'light' | 'dark', icon: string) => ({
    label,
    icon,
    type: 'checkbox' as const,
    checked: colorMode.preference === value,
    onUpdateChecked: () => (colorMode.preference = value),
})

const settingItem = (label: string, key: keyof AppSettings) => ({
    label,
    type: 'checkbox' as const,
    checked: settings.value[key],
    onUpdateChecked: (v: boolean) => set(key, v),
    onSelect: (e: Event) => e.preventDefault(),
})

const items = computed<DropdownMenuItem[][]>(() => [
    [
        { label: 'Lịch sử', icon: 'i-lucide-history', to: '/history' },
        { label: 'Lịch luyện tập', icon: 'i-lucide-calendar-days', to: '/calendar' },
        { label: 'Kho đề', icon: 'i-lucide-library', to: '/topics' },
    ],
    [
        {
            label: 'Xuất JSON (sao lưu)',
            icon: 'i-lucide-download',
            onSelect: () => download('json'),
        },
        { label: 'Xuất CSV sổ lỗi', icon: 'i-lucide-sheet', onSelect: () => download('csv') },
        { label: 'Xuất CSV cho Anki', icon: 'i-lucide-layers', onSelect: () => download('anki') },
        {
            label: 'Nhập từ file JSON',
            icon: 'i-lucide-upload',
            onSelect: () => fileInput.value?.click(),
        },
    ],
    [
        {
            label: 'Giao diện',
            icon: 'i-lucide-sun-moon',
            children: [
                [
                    themeItem('Theo máy', 'system', 'i-lucide-monitor'),
                    themeItem('Sáng', 'light', 'i-lucide-sun'),
                    themeItem('Tối', 'dark', 'i-lucide-moon'),
                ],
            ],
        },
        {
            label: 'Cài đặt',
            icon: 'i-lucide-settings',
            children: [[settingItem('Streak tính cả ngày tự học', 'streakIncludeCheckins')]],
        },
        { label: 'Xoá audio đã gửi', icon: 'i-lucide-trash-2', onSelect: clearSentAudio },
    ],
    [{ label: 'Đăng xuất', icon: 'i-lucide-log-out', color: 'error', onSelect: logout }],
])
</script>

<template>
    <UDropdownMenu
        :items="items"
        :content="{ align: 'end' }"
    >
        <UButton
            icon="i-lucide-ellipsis"
            color="neutral"
            variant="ghost"
            size="lg"
            aria-label="Menu"
        />
    </UDropdownMenu>
    <input
        ref="fileInput"
        type="file"
        accept="application/json,.json"
        hidden
        @change="onImport"
    />

    <UModal
        :open="!!importResult"
        title="Nhập xong"
        description="Số bản ghi trước và sau khi nhập. Dòng đã có sẵn được bỏ qua."
        @update:open="(v) => !v && (importResult = null)"
    >
        <template #body>
            <table
                v-if="importResult"
                class="w-full text-sm"
            >
                <thead class="text-left text-muted">
                    <tr>
                        <th class="py-1 font-medium">Bảng</th>
                        <th class="py-1 text-right font-medium">Trước</th>
                        <th class="py-1 text-right font-medium">Sau</th>
                        <th class="py-1 text-right font-medium">Trong file</th>
                        <th class="py-1 text-right font-medium">Bỏ qua</th>
                    </tr>
                </thead>
                <tbody class="tabular-nums">
                    <tr
                        v-for="(label, key) in TABLE_LABELS"
                        :key="key"
                        class="border-t border-default"
                    >
                        <td class="py-1.5">{{ label }}</td>
                        <td class="py-1.5 text-right">{{ importResult.before[key] }}</td>
                        <td class="py-1.5 text-right font-semibold">
                            {{ importResult.after[key] }}
                        </td>
                        <td class="py-1.5 text-right">{{ importResult.inFile[key] }}</td>
                        <td class="py-1.5 text-right text-muted">
                            {{ importResult.skipped[key] }}
                        </td>
                    </tr>
                </tbody>
            </table>
        </template>
    </UModal>
</template>
