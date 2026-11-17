<script setup lang="ts">
import { CATEGORY_LABELS } from '~/constants'
import type { EditableIssue } from '~/composables/useReviewForm'

const issue = defineModel<EditableIssue>({ required: true })
defineProps<{ knownKeys: string[] }>()
const emit = defineEmits<{ remove: [] }>()

const editing = ref(issue.value.manual)
</script>

<template>
    <div
        class="issue"
        :class="{ unchecked: !issue.checked }"
    >
        <div class="spread top">
            <label class="check">
                <input
                    v-model="issue.checked"
                    type="checkbox"
                />
                <span>#{{ issue.index + 1 }}</span>
                <span class="badge">
                    {{
                        CATEGORY_LABELS[issue.category as keyof typeof CATEGORY_LABELS] ??
                        issue.category
                    }}
                </span>
                <span
                    v-if="!issue.matched"
                    class="badge badge-warn"
                >
                    cần xem lại: đoạn trích không khớp
                </span>
                <span
                    v-if="issue.tooLong"
                    class="badge badge-warn"
                >
                    nghi viết lại cả đoạn
                </span>
            </label>
            <button
                class="btn btn-sm"
                @click="editing = !editing"
            >
                {{ editing ? 'Xong' : 'Sửa' }}
            </button>
        </div>

        <template v-if="!editing">
            <p class="pair">
                <s>{{ issue.quote }}</s>
                →
                <strong>{{ issue.correction }}</strong>
            </p>
            <p class="muted">{{ issue.reasonVi }}</p>
            <p class="muted">
                Kiểu lỗi:
                <code>{{ issue.patternKey }}</code>
                <template v-if="issue.labelVi">· {{ issue.labelVi }}</template>
            </p>
        </template>

        <div
            v-else
            class="stack"
        >
            <div>
                <label>Đoạn sai (trích nguyên văn)</label>
                <input v-model="issue.quote" />
            </div>
            <div>
                <label>Sửa thành</label>
                <input v-model="issue.correction" />
            </div>
            <div>
                <label>Kiểu lỗi (pattern_key: bạn chốt)</label>
                <input
                    v-model="issue.patternKey"
                    list="known-keys"
                    placeholder="past-simple-time-marker"
                />
                <datalist id="known-keys">
                    <option
                        v-for="k in knownKeys"
                        :key="k"
                        :value="k"
                    />
                </datalist>
            </div>
            <div>
                <label>Nhãn tiếng Việt</label>
                <input v-model="issue.labelVi" />
            </div>
            <button
                v-if="issue.manual"
                class="btn btn-sm btn-danger"
                @click="emit('remove')"
            >
                Xoá lỗi này
            </button>
        </div>
    </div>
</template>

<style scoped>
.issue {
    border-top: 1px solid var(--border);
    padding: 10px 0;
}

.issue.unchecked {
    opacity: 0.6;
}

.top {
    align-items: flex-start;
}

.check {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
    margin: 0;
}

.check input {
    width: 20px;
    height: 20px;
}

.pair {
    margin: 6px 0 2px;
}

p {
    margin: 4px 0;
}
</style>
