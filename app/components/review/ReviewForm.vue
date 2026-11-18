<script setup lang="ts">
import type { Mistake } from '#shared/types'
import { confirmAttempt, type AttemptDetail } from '~/api/attemptApi'
import { toApiFailure } from '~/api/http'

/**
 * Review form for a `needs_review` attempt. The parent re-mounts it with a new `key`
 * when the data changes, so the form state is rebuilt without manual scope handling.
 */
const props = defineProps<{ detail: AttemptDetail; mistakes: Mistake[] }>()
const emit = defineEmits<{ saved: [] }>()

const toast = useToast()
const form = useReviewForm(props.detail, props.mistakes)
const { transcript, issues, checked, fillerCount, selfRating } = form
const knownKeys = computed(() => props.mistakes.map((m) => m.patternKey))
const isSpeaking = computed(() => props.detail.attempt.kind === 'speaking')

const saving = ref(false)
const save = async () => {
    if (form.validationError.value) return toast.error(form.validationError.value)
    saving.value = true
    try {
        await confirmAttempt(props.detail.attempt.id, form.toBody())
        toast.success(`Đã lưu ${checked.value.length} lỗi vào sổ`)
        emit('saved')
    } catch (e) {
        toast.error(toApiFailure(e).message)
    } finally {
        saving.value = false
    }
}
</script>

<template>
    <div class="card stack">
        <div class="spread">
            <h2>{{ isSpeaking ? 'Bản chép lời' : 'Bài viết' }}</h2>
            <span
                v-if="isSpeaking"
                class="muted"
            >
                Sửa chỗ AI nghe sai
            </span>
        </div>
        <textarea
            v-if="isSpeaking"
            v-model="transcript"
            rows="8"
        />
        <ReviewHighlightedText
            :text="transcript"
            :issues="issues.map((i) => ({ index: i.index, quote: i.quote, checked: i.checked }))"
        />
    </div>

    <div class="card">
        <div class="spread">
            <h2>Lỗi đề xuất ({{ checked.length }}/{{ issues.length }} giữ)</h2>
            <button
                class="btn btn-sm"
                @click="form.addManual()"
            >
                + Thêm
            </button>
        </div>
        <p class="muted">Mặc định đã tick. Bỏ tick lỗi nào thấy sai: lỗi bỏ tick không vào sổ.</p>
        <p
            v-if="!issues.length"
            class="muted"
        >
            AI không thấy lỗi nào chắc chắn.
        </p>
        <ReviewIssueEditor
            v-for="issue in issues"
            :key="issue.index"
            :issue="issue"
            :known-keys="knownKeys"
            @remove="form.removeIssue(issue.index)"
        />
        <p
            v-if="form.ai?.focus_pattern_suggestion"
            class="muted"
        >
            Gợi ý trọng tâm: {{ form.ai.focus_pattern_suggestion }}
        </p>
    </div>

    <div class="card stack">
        <ReviewKpiPanel
            :text="transcript"
            :duration-s="detail.attempt.durationS"
            :error-count="checked.length"
            :filler-count="fillerCount"
        />
        <div v-if="isSpeaking">
            <label for="fillers">Số từ đệm (chỉnh tay nếu đếm sai)</label>
            <input
                id="fillers"
                v-model.number="fillerCount"
                type="number"
                min="0"
                inputmode="numeric"
            />
        </div>
        <div>
            <label>Tự chấm độ trôi chảy</label>
            <div class="row">
                <button
                    v-for="n in 5"
                    :key="n"
                    class="btn btn-sm"
                    :class="{ 'btn-primary': selfRating === n }"
                    @click="selfRating = n"
                >
                    {{ n }}
                </button>
            </div>
        </div>
        <button
            class="btn btn-primary btn-block"
            :disabled="saving"
            @click="save"
        >
            {{ saving ? 'Đang lưu…' : `Lưu ${checked.length} lỗi vào sổ` }}
        </button>
    </div>
</template>
