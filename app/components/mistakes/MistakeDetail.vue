<script setup lang="ts">
import type { MistakeWithHits } from '#shared/types'
import { patchMistake, type MistakePatch } from '~/api/mistakeApi'
import { toApiFailure } from '~/api/http'

/** Slideover with edit, merge and split for one mistake. `changed(true)` closes it. */
const props = defineProps<{ mistake: MistakeWithHits | null; others: MistakeWithHits[] }>()
const emit = defineEmits<{ close: []; changed: [closeDetail?: boolean] }>()
const notify = useNotify()
const confirm = useConfirm()

const open = computed({
    get: () => !!props.mistake,
    set: (v) => !v && emit('close'),
})

const form = reactive({
    labelVi: '',
    patternKey: '',
    exampleWrong: '',
    exampleRight: '',
    note: '',
})
const selectedHits = ref<string[]>([])
const mergeInto = ref<string | undefined>(undefined)
const splitOpen = ref(false)
const split = reactive({ patternKey: '', labelVi: '' })
const busy = ref(false)

watch(
    () => props.mistake?.id,
    () => {
        const m = props.mistake
        if (!m) return
        Object.assign(form, {
            labelVi: m.labelVi,
            patternKey: m.patternKey,
            exampleWrong: m.exampleWrong,
            exampleRight: m.exampleRight,
            note: m.note,
        })
        selectedHits.value = []
        mergeInto.value = undefined
    },
    { immediate: true },
)

const mergeItems = computed(() =>
    props.others.map((o) => ({ label: o.labelVi, description: o.patternKey, value: o.id })),
)

const run = async (patch: MistakePatch, ok: string, closeDetail = false) => {
    if (!props.mistake) return
    busy.value = true
    try {
        await patchMistake(props.mistake.id, patch)
        notify.success(ok)
        emit('changed', closeDetail)
        return true
    } catch (e) {
        notify.error(toApiFailure(e).message)
        return false
    } finally {
        busy.value = false
    }
}

const save = () => run({ ...form }, 'Đã lưu')

const merge = async () => {
    const target = props.others.find((o) => o.id === mergeInto.value)
    if (!target || !props.mistake) return
    const ok = await confirm({
        title: 'Gộp hai kiểu lỗi?',
        description: `Mọi lần mắc của "${props.mistake.labelVi}" chuyển sang "${target.labelVi}". Kiểu lỗi hiện tại sẽ bị xoá.`,
        confirmLabel: 'Gộp',
    })
    if (ok) await run({ mergeIntoId: target.id }, 'Đã gộp', true)
}

const doSplit = async () => {
    if (!split.patternKey.trim()) return
    const allMoved = selectedHits.value.length === props.mistake?.hits.length
    const done = await run(
        {
            split: {
                hitIds: selectedHits.value,
                patternKey: split.patternKey,
                labelVi: split.labelVi,
            },
        },
        'Đã tách',
        allMoved,
    )
    if (done) {
        splitOpen.value = false
        selectedHits.value = []
        Object.assign(split, { patternKey: '', labelVi: '' })
    }
}
</script>

<template>
    <USlideover
        v-model:open="open"
        :title="mistake?.labelVi ?? ''"
        description="Sửa, gộp hoặc tách kiểu lỗi"
        :ui="{ content: 'max-w-lg' }"
    >
        <template #body>
            <div
                v-if="mistake"
                class="space-y-6"
            >
                <section class="space-y-3">
                    <h3 class="text-sm font-semibold text-highlighted">Thông tin</h3>
                    <UFormField label="Nhãn">
                        <UInput
                            v-model="form.labelVi"
                            class="w-full"
                        />
                    </UFormField>
                    <UFormField
                        label="Kiểu lỗi"
                        help="Mã ngắn dùng để gom các lần sai giống nhau."
                    >
                        <UInput
                            v-model="form.patternKey"
                            class="w-full"
                        />
                    </UFormField>
                    <UFormField label="Ví dụ sai">
                        <UInput
                            v-model="form.exampleWrong"
                            class="w-full"
                        />
                    </UFormField>
                    <UFormField label="Ví dụ đúng">
                        <UInput
                            v-model="form.exampleRight"
                            class="w-full"
                        />
                    </UFormField>
                    <UFormField
                        label="Ghi chú"
                        help="Nối với sách bạn đang học, ví dụ Grammar in Use unit 12, trang 24."
                    >
                        <UTextarea
                            v-model="form.note"
                            :rows="2"
                            autoresize
                            class="w-full"
                        />
                    </UFormField>
                    <UButton
                        icon="i-lucide-save"
                        label="Lưu"
                        :loading="busy"
                        @click="save"
                    />
                </section>

                <USeparator />

                <section class="space-y-3">
                    <h3 class="text-sm font-semibold text-highlighted">Gộp vào kiểu lỗi khác</h3>
                    <div class="flex gap-2">
                        <USelectMenu
                            v-model="mergeInto"
                            :items="mergeItems"
                            value-key="value"
                            placeholder="Chọn kiểu lỗi đích"
                            class="min-w-0 flex-1"
                        />
                        <UButton
                            color="neutral"
                            variant="outline"
                            icon="i-lucide-merge"
                            label="Gộp"
                            :disabled="!mergeInto"
                            @click="merge"
                        />
                    </div>
                </section>

                <USeparator />

                <section class="space-y-3">
                    <div class="flex items-center justify-between gap-2">
                        <h3 class="text-sm font-semibold text-highlighted">
                            Các lần sai ({{ mistake.hits.length }})
                        </h3>
                        <UButton
                            color="neutral"
                            variant="outline"
                            size="sm"
                            icon="i-lucide-split"
                            :label="
                                selectedHits.length ? `Tách ${selectedHits.length} lần` : 'Tách'
                            "
                            :disabled="!selectedHits.length"
                            @click="splitOpen = true"
                        />
                    </div>
                    <ul class="divide-y divide-default">
                        <li
                            v-for="hit in mistake.hits"
                            :key="hit.id"
                            class="flex items-start gap-3 py-3"
                        >
                            <UCheckbox
                                :model-value="selectedHits.includes(hit.id)"
                                :aria-label="`Chọn lần sai ${hit.originalQuote}`"
                                class="mt-0.5"
                                @update:model-value="
                                    (v) =>
                                        (selectedHits = v
                                            ? [...selectedHits, hit.id]
                                            : selectedHits.filter((x) => x !== hit.id))
                                "
                            />
                            <div class="min-w-0 flex-1 space-y-1">
                                <BaseCorrectionPair
                                    :wrong="hit.originalQuote"
                                    :right="hit.correction"
                                    class="text-sm"
                                />
                                <p class="flex items-center gap-2 text-xs text-muted">
                                    <UIcon
                                        :name="
                                            hit.kind === 'speaking'
                                                ? 'i-lucide-mic'
                                                : 'i-lucide-pen-line'
                                        "
                                        class="size-3.5"
                                        aria-hidden="true"
                                    />
                                    {{ formatDateTime(hit.createdAt) }}
                                    <ULink
                                        :to="`/review/${hit.attemptId}`"
                                        class="text-primary"
                                    >
                                        Xem bài
                                    </ULink>
                                </p>
                            </div>
                        </li>
                    </ul>
                </section>
            </div>
        </template>
    </USlideover>

    <UModal
        v-model:open="splitOpen"
        title="Tách sang kiểu lỗi khác"
        :description="`${selectedHits.length} lần sai đã chọn sẽ chuyển sang kiểu lỗi mới hoặc kiểu đã có.`"
    >
        <template #body>
            <form
                class="space-y-4"
                @submit.prevent="doSplit"
            >
                <UFormField
                    label="Kiểu lỗi"
                    required
                    help="Gõ mã đã có để chuyển vào kiểu đó."
                >
                    <UInput
                        v-model="split.patternKey"
                        placeholder="past-simple-time-marker"
                        class="w-full"
                    />
                </UFormField>
                <UFormField label="Nhãn tiếng Việt">
                    <UInput
                        v-model="split.labelVi"
                        class="w-full"
                    />
                </UFormField>
                <div class="flex justify-end gap-2">
                    <UButton
                        color="neutral"
                        variant="ghost"
                        label="Huỷ"
                        @click="splitOpen = false"
                    />
                    <UButton
                        type="submit"
                        icon="i-lucide-split"
                        label="Tách"
                        :loading="busy"
                        :disabled="!split.patternKey.trim()"
                    />
                </div>
            </form>
        </template>
    </UModal>
</template>
