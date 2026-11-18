<script setup lang="ts">
import type { AttemptKind, Topic } from '#shared/types'
import { toApiFailure } from '~/api/http'
import {
    createTopic,
    deleteTopic,
    fetchTopics,
    importTopics,
    updateTopic,
    type TopicInput,
} from '~/api/topicApi'
import { KIND_ICONS } from '~/constants'

const notify = useNotify()
const confirm = useConfirm()

const { data, refresh, status } = await useAsyncData(
    'topics-all',
    () => fetchTopics(undefined, true),
    {
        default: () => [],
    },
)

const KIND_TABS = [
    { label: 'Nói', value: 'speaking', icon: 'i-lucide-mic' },
    { label: 'Viết', value: 'writing', icon: 'i-lucide-pen-line' },
]
const kind = ref<AttemptKind>('speaking')
const tag = ref<string | null>(null)
const tagsOf = (t: Topic) => (t.tags ? t.tags.split(',') : [])
const ofKind = computed(() => data.value.filter((t) => t.kind === kind.value))
const allTags = computed(() => [...new Set(ofKind.value.flatMap(tagsOf))].sort())
const visible = computed(() =>
    ofKind.value.filter((t) => !tag.value || tagsOf(t).includes(tag.value)),
)
watch(kind, () => (tag.value = null))

// Add / edit
const formOpen = ref(false)
const editingId = ref<string | null>(null)
const form = reactive<Required<TopicInput>>({
    kind: 'speaking',
    title: '',
    prompt: '',
    level: 'B1',
    tags: '',
    active: true,
    prepS: null,
    responseS: null,
})
const saving = ref(false)
const openForm = (t?: Topic) => {
    editingId.value = t?.id ?? null
    Object.assign(form, {
        kind: t?.kind ?? kind.value,
        title: t?.title ?? '',
        prompt: t?.prompt ?? '',
        level: t?.level ?? 'B1',
        tags: t?.tags ?? '',
        active: t?.active ?? true,
        prepS: t?.prepS ?? null,
        responseS: t?.responseS ?? null,
    })
    formOpen.value = true
}
const save = async () => {
    saving.value = true
    try {
        if (editingId.value) await updateTopic(editingId.value, { ...form })
        else await createTopic({ ...form })
        notify.success(editingId.value ? 'Đã lưu đề' : 'Đã thêm đề')
        formOpen.value = false
        await refresh()
    } catch (e) {
        notify.error(toApiFailure(e).message)
    } finally {
        saving.value = false
    }
}

const toggleActive = async (t: Topic, active: boolean) => {
    try {
        await updateTopic(t.id, { active })
        await refresh()
    } catch (e) {
        notify.error(toApiFailure(e).message)
    }
}

const remove = async (t: Topic) => {
    const ok = await confirm({
        title: `Xoá đề "${t.title}"?`,
        description: 'Chỉ xoá được đề chưa có bài nộp. Đề đã dùng thì hãy tắt.',
        confirmLabel: 'Xoá',
        danger: true,
    })
    if (!ok) return
    try {
        await deleteTopic(t.id)
        notify.success('Đã xoá đề')
        await refresh()
    } catch (e) {
        notify.error(toApiFailure(e).message)
    }
}

// Import
const fileInput = ref<HTMLInputElement>()
const importing = ref(false)
const onImport = async (ev: Event) => {
    const file = (ev.target as HTMLInputElement).files?.[0]
    if (!file) return
    importing.value = true
    try {
        const format = file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'json'
        const res = await importTopics(format, await file.text())
        notify.success(`Đã thêm ${res.added} đề, bỏ qua ${res.skipped} đề trùng`)
        if (res.invalid.length)
            notify.error(`${res.invalid.length} dòng không hợp lệ: ${res.invalid[0]}`)
        await refresh()
    } catch (e) {
        notify.error(toApiFailure(e).message)
    } finally {
        importing.value = false
        if (fileInput.value) fileInput.value.value = ''
    }
}
</script>

<template>
    <LayoutPage title="Kho đề">
        <template #actions>
            <div class="flex gap-2">
                <UButton
                    color="neutral"
                    variant="outline"
                    icon="i-lucide-file-up"
                    label="Nhập file"
                    :loading="importing"
                    @click="fileInput?.click()"
                />
                <UButton
                    icon="i-lucide-plus"
                    label="Thêm đề"
                    @click="openForm()"
                />
            </div>
        </template>
        <input
            ref="fileInput"
            type="file"
            accept=".json,.csv,application/json,text/csv"
            hidden
            @change="onImport"
        />

        <UTabs
            v-model="kind"
            :items="KIND_TABS"
            :content="false"
        />

        <div
            v-if="allTags.length"
            class="flex flex-wrap gap-2"
            role="group"
            aria-label="Lọc theo tag"
        >
            <UButton
                v-for="t in allTags"
                :key="t"
                size="sm"
                icon="i-lucide-tag"
                :label="t"
                :variant="tag === t ? 'solid' : 'outline'"
                :color="tag === t ? 'primary' : 'neutral'"
                :aria-pressed="tag === t"
                @click="tag = tag === t ? null : t"
            />
        </div>

        <USkeleton
            v-if="status === 'pending' && !data.length"
            class="h-40 w-full rounded-xl"
        />
        <UCard v-else-if="!visible.length">
            <div class="flex flex-col items-center gap-3 py-6 text-center">
                <UIcon
                    name="i-lucide-library"
                    class="size-10 text-muted"
                    aria-hidden="true"
                />
                <p class="text-muted">Chưa có đề nào ở mục này.</p>
                <UButton
                    icon="i-lucide-plus"
                    label="Thêm đề"
                    @click="openForm()"
                />
            </div>
        </UCard>

        <ul class="space-y-2">
            <li
                v-for="t in visible"
                :key="t.id"
                class="flex items-start gap-3 rounded-xl border border-default bg-default p-3"
                :class="{ 'opacity-60': !t.active }"
            >
                <UIcon
                    :name="KIND_ICONS[t.kind]"
                    class="mt-0.5 size-5 shrink-0 text-primary"
                    aria-hidden="true"
                />
                <div class="min-w-0 flex-1 space-y-1">
                    <p class="font-medium text-highlighted">
                        {{ t.title }}
                        <span
                            v-if="!t.active"
                            class="text-xs font-normal text-muted"
                        >
                            (đang tắt)
                        </span>
                    </p>
                    <p class="line-clamp-2 text-sm text-toned">{{ t.prompt }}</p>
                    <div class="flex flex-wrap gap-1">
                        <UBadge
                            color="neutral"
                            variant="soft"
                            size="sm"
                            :label="t.level"
                        />
                        <UBadge
                            v-if="t.responseS"
                            color="neutral"
                            variant="soft"
                            size="sm"
                            icon="i-lucide-timer"
                            :label="`${t.prepS ?? 0}s / ${t.responseS}s`"
                        />
                        <UBadge
                            v-for="tg in tagsOf(t)"
                            :key="tg"
                            color="primary"
                            variant="soft"
                            size="sm"
                            :label="tg"
                        />
                    </div>
                </div>
                <div class="flex flex-col items-end gap-2">
                    <USwitch
                        :model-value="t.active"
                        :aria-label="`${t.active ? 'Tắt' : 'Bật'} đề ${t.title}`"
                        @update:model-value="(v) => toggleActive(t, v)"
                    />
                    <div class="flex">
                        <UButton
                            icon="i-lucide-pencil"
                            color="neutral"
                            variant="ghost"
                            size="sm"
                            :aria-label="`Sửa đề ${t.title}`"
                            @click="openForm(t)"
                        />
                        <UButton
                            icon="i-lucide-trash-2"
                            color="neutral"
                            variant="ghost"
                            size="sm"
                            :aria-label="`Xoá đề ${t.title}`"
                            @click="remove(t)"
                        />
                    </div>
                </div>
            </li>
        </ul>

        <UCollapsible>
            <UButton
                color="neutral"
                variant="link"
                icon="i-lucide-info"
                trailing-icon="i-lucide-chevron-down"
                label="Định dạng file nhập"
                class="px-0"
            />
            <template #content>
                <div class="mt-2 space-y-2 text-sm text-toned">
                    <p>
                        JSON: một mảng, mỗi phần tử có
                        <code>kind</code>
                        (speaking hoặc writing),
                        <code>title</code>
                        ,
                        <code>prompt</code>
                        , tuỳ chọn
                        <code>level</code>
                        ,
                        <code>tags</code>
                        . CSV: dòng đầu là
                        <code>kind,title,prompt,level,tags</code>
                        ; ô có dấu phẩy thì đặt trong ngoặc kép.
                    </p>
                    <p>Đề trùng loại và tiêu đề với đề đã có sẽ được bỏ qua.</p>
                </div>
            </template>
        </UCollapsible>

        <UModal
            v-model:open="formOpen"
            :title="editingId ? 'Sửa đề' : 'Thêm đề'"
        >
            <template #body>
                <form
                    class="space-y-4"
                    @submit.prevent="save"
                >
                    <UFormField label="Loại">
                        <UTabs
                            v-model="form.kind"
                            :items="KIND_TABS"
                            :content="false"
                            size="sm"
                        />
                    </UFormField>
                    <UFormField
                        label="Tiêu đề"
                        required
                    >
                        <UInput
                            v-model="form.title"
                            class="w-full"
                        />
                    </UFormField>
                    <UFormField
                        label="Nội dung đề"
                        required
                    >
                        <UTextarea
                            v-model="form.prompt"
                            :rows="4"
                            autoresize
                            class="w-full"
                        />
                    </UFormField>
                    <div class="grid grid-cols-3 gap-3">
                        <UFormField label="Trình độ">
                            <UInput
                                v-model="form.level"
                                class="w-full"
                            />
                        </UFormField>
                        <UFormField
                            label="Tag"
                            help="Cách nhau bằng dấu phẩy, ví dụ work,benchmark"
                            class="col-span-2"
                        >
                            <UInput
                                v-model="form.tags"
                                class="w-full"
                            />
                        </UFormField>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <UFormField
                            label="Chuẩn bị (giây)"
                            help="Để trống nếu không bấm giờ."
                        >
                            <UInputNumber
                                v-model="form.prepS"
                                :min="0"
                                :max="600"
                                class="w-full"
                            />
                        </UFormField>
                        <UFormField
                            label="Trả lời (giây)"
                            help="Dạng đề TOEIC S&amp;W."
                        >
                            <UInputNumber
                                v-model="form.responseS"
                                :min="10"
                                :max="3600"
                                class="w-full"
                            />
                        </UFormField>
                    </div>
                    <div class="flex justify-end gap-2">
                        <UButton
                            color="neutral"
                            variant="ghost"
                            label="Huỷ"
                            @click="formOpen = false"
                        />
                        <UButton
                            type="submit"
                            icon="i-lucide-save"
                            label="Lưu"
                            :loading="saving"
                            :disabled="!form.title.trim() || !form.prompt.trim()"
                        />
                    </div>
                </form>
            </template>
        </UModal>
    </LayoutPage>
</template>
