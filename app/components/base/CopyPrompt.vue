<script setup lang="ts">
/** Fallback when Gemini fails: grade manually in another AI. */
const props = defineProps<{
    prompt: string
    audio?: { blob: Blob; mimeType: string } | null
}>()

const toast = useToast()

const copy = async () => {
    if (await copyText(props.prompt)) toast.success('Đã copy prompt')
    else toast.error('Không copy được, hãy bôi đen và copy tay')
}

const saveAudio = () => {
    if (!props.audio) return
    const ext = props.audio.mimeType.includes('mp4')
        ? 'm4a'
        : props.audio.mimeType.includes('ogg')
          ? 'ogg'
          : 'webm'
    downloadBlob(props.audio.blob, `englishgym-${Date.now()}.${ext}`)
}
</script>

<template>
    <div class="card stack">
        <div class="spread">
            <strong>Chấm thủ công</strong>
            <div class="row">
                <button
                    v-if="audio"
                    class="btn btn-sm"
                    @click="saveAudio"
                >
                    Tải audio
                </button>
                <button
                    class="btn btn-sm btn-primary"
                    @click="copy"
                >
                    Copy prompt
                </button>
            </div>
        </div>
        <p class="muted">
            Dán prompt vào AI chat khác{{ audio ? ' kèm file audio' : '' }}. Bài vẫn được giữ trên
            máy để gửi lại khi Gemini hoạt động.
        </p>
        <details>
            <summary class="muted">Xem prompt</summary>
            <pre class="prewrap muted">{{ prompt }}</pre>
        </details>
    </div>
</template>
