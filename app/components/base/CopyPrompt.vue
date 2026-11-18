<script setup lang="ts">
/** Fallback when Gemini fails: grade manually in another AI. */
const props = defineProps<{
    prompt: string
    audio?: { blob: Blob; mimeType: string } | null
}>()

const notify = useNotify()

const copy = async () => {
    if (await copyText(props.prompt)) notify.success('Đã copy prompt')
    else notify.error('Không copy được, hãy bôi đen và copy tay')
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
    <UCard>
        <div class="space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
                <h2 class="flex items-center gap-2 font-semibold text-highlighted">
                    <UIcon
                        name="i-lucide-clipboard-copy"
                        class="size-5 text-primary"
                        aria-hidden="true"
                    />
                    Chấm thủ công
                </h2>
                <div class="flex gap-2">
                    <UButton
                        v-if="audio"
                        color="neutral"
                        variant="outline"
                        icon="i-lucide-download"
                        label="Tải audio"
                        @click="saveAudio"
                    />
                    <UButton
                        icon="i-lucide-copy"
                        label="Copy prompt"
                        @click="copy"
                    />
                </div>
            </div>
            <p class="text-sm text-muted">
                Dán prompt vào AI chat khác{{ audio ? ' kèm file audio' : '' }}. Bài vẫn được giữ
                trên máy để gửi lại khi Gemini hoạt động.
            </p>
            <UCollapsible>
                <UButton
                    color="neutral"
                    variant="link"
                    trailing-icon="i-lucide-chevron-down"
                    label="Xem prompt"
                    class="px-0"
                />
                <template #content>
                    <pre
                        class="prewrap mt-2 max-h-72 overflow-auto rounded-lg bg-elevated p-3 text-xs text-toned"
                        >{{ prompt }}</pre>
                </template>
            </UCollapsible>
        </div>
    </UCard>
</template>
