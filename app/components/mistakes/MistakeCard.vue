<script setup lang="ts">
import type { Mistake, MistakeWithHits } from '#shared/types'
import { patchMistake, type MistakePatch } from '~/api/mistakeApi'
import { toApiFailure } from '~/api/http'
import { CATEGORY_LABELS } from '~/constants'

const props = defineProps<{ mistake: MistakeWithHits; others: Mistake[] }>()
const emit = defineEmits<{ changed: [] }>()
const toast = useToast()

const open = ref(false)
const form = reactive({
    labelVi: props.mistake.labelVi,
    patternKey: props.mistake.patternKey,
    exampleWrong: props.mistake.exampleWrong,
    exampleRight: props.mistake.exampleRight,
})
const mergeInto = ref('')
const selectedHits = ref<string[]>([])

const run = async (patch: MistakePatch, ok: string) => {
    try {
        await patchMistake(props.mistake.id, patch)
        toast.success(ok)
        emit('changed')
    } catch (e) {
        toast.error(toApiFailure(e).message)
    }
}

const save = () => run({ ...form }, 'Đã lưu')
const toggleFocus = () =>
    run(
        { isFocus: !props.mistake.isFocus },
        props.mistake.isFocus ? 'Đã bỏ trọng tâm' : 'Đã đặt làm lỗi trọng tâm tuần',
    )
const merge = () => {
    const target = props.others.find((o) => o.id === mergeInto.value)
    if (target && confirm(`Gộp "${props.mistake.labelVi}" vào "${target.labelVi}"?`))
        run({ mergeIntoId: target.id }, 'Đã gộp')
}
const split = () => {
    const patternKey = prompt('pattern_key cho kiểu lỗi mới (hoặc key đã có):')
    if (!patternKey) return
    const labelVi = prompt('Nhãn tiếng Việt:') ?? ''
    run({ split: { hitIds: selectedHits.value, patternKey, labelVi } }, 'Đã tách')
}
</script>

<template>
    <div class="card">
        <div class="spread">
            <div>
                <strong>{{ mistake.labelVi }}</strong>
                <div class="muted">
                    <code>{{ mistake.patternKey }}</code>
                    ·
                    {{
                        CATEGORY_LABELS[mistake.category as keyof typeof CATEGORY_LABELS] ??
                        mistake.category
                    }}
                    · {{ mistake.hitCount }} lần · gần nhất {{ formatDateTime(mistake.lastSeen) }}
                </div>
            </div>
            <button
                class="btn btn-sm"
                :class="{ 'btn-primary': mistake.isFocus }"
                :title="mistake.isFocus ? 'Lỗi trọng tâm tuần' : 'Đặt làm trọng tâm tuần'"
                @click="toggleFocus"
            >
                {{ mistake.isFocus ? '★' : '☆' }}
            </button>
        </div>
        <p class="pair">
            <s>{{ mistake.exampleWrong }}</s>
            →
            <strong>{{ mistake.exampleRight }}</strong>
        </p>
        <button
            class="btn btn-sm"
            @click="open = !open"
        >
            {{ open ? 'Thu gọn' : 'Chi tiết / sửa' }}
        </button>

        <div
            v-if="open"
            class="stack detail"
        >
            <div>
                <label>Nhãn</label>
                <input v-model="form.labelVi" />
            </div>
            <div>
                <label>pattern_key</label>
                <input v-model="form.patternKey" />
            </div>
            <div>
                <label>Ví dụ sai</label>
                <input v-model="form.exampleWrong" />
            </div>
            <div>
                <label>Ví dụ đúng</label>
                <input v-model="form.exampleRight" />
            </div>
            <button
                class="btn btn-primary"
                @click="save"
            >
                Lưu
            </button>

            <div class="row">
                <select v-model="mergeInto">
                    <option value="">Gộp vào kiểu lỗi…</option>
                    <option
                        v-for="o in others"
                        :key="o.id"
                        :value="o.id"
                    >
                        {{ o.labelVi }} ({{ o.patternKey }})
                    </option>
                </select>
                <button
                    class="btn"
                    :disabled="!mergeInto"
                    @click="merge"
                >
                    Gộp
                </button>
            </div>

            <h2>Các lần sai</h2>
            <label
                v-for="hit in mistake.hits"
                :key="hit.id"
                class="hit"
            >
                <input
                    v-model="selectedHits"
                    type="checkbox"
                    :value="hit.id"
                />
                <span>
                    <s>{{ hit.originalQuote }}</s>
                    → {{ hit.correction }}
                    <span class="muted">
                        · {{ hit.kind === 'speaking' ? 'nói' : 'viết' }} ·
                        {{ formatDateTime(hit.createdAt) }} ·
                        <NuxtLink :to="`/review/${hit.attemptId}`">xem</NuxtLink>
                    </span>
                </span>
            </label>
            <button
                class="btn"
                :disabled="!selectedHits.length"
                @click="split"
            >
                Tách {{ selectedHits.length || '' }} lần đã chọn sang kiểu khác
            </button>
        </div>
    </div>
</template>

<style scoped>
.pair {
    margin: 8px 0;
}

.detail {
    margin-top: 12px;
}

.hit {
    display: flex;
    gap: 8px;
    font-weight: 400;
}

.hit input {
    width: 18px;
    flex: none;
}
</style>
