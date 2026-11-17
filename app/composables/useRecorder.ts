import { MAX_RECORD_SECONDS, RECORDER_MIME_CANDIDATES } from '#shared/constants/app'

export type RecorderState = 'idle' | 'recording' | 'stopped'

export interface Recording {
    blob: Blob
    mimeType: string
    durationS: number
    /** Mức âm lớn nhất 0–1; quá thấp nghĩa là gần như không thu được tiếng. */
    peakLevel: number
}

const pickMime = () => {
    if (typeof MediaRecorder === 'undefined') return null
    return RECORDER_MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? ''
}

export const useRecorder = (onDone: (rec: Recording) => void) => {
    const state = ref<RecorderState>('idle')
    const elapsed = ref(0)
    const level = ref(0)
    const error = ref<string | null>(null)

    let recorder: MediaRecorder | null = null
    let stream: MediaStream | null = null
    let audioCtx: AudioContext | null = null
    let chunks: Blob[] = []
    let startedAt = 0
    let peak = 0
    let timer: ReturnType<typeof setInterval> | undefined
    let raf = 0

    const cleanup = () => {
        clearInterval(timer)
        cancelAnimationFrame(raf)
        stream?.getTracks().forEach((t) => t.stop())
        audioCtx?.close().catch(() => {})
        stream = null
        audioCtx = null
        level.value = 0
    }

    const meter = (s: MediaStream) => {
        audioCtx = new AudioContext()
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 512
        audioCtx.createMediaStreamSource(s).connect(analyser)
        const buf = new Uint8Array(analyser.fftSize)
        const tick = () => {
            analyser.getByteTimeDomainData(buf)
            let max = 0
            for (const v of buf) max = Math.max(max, Math.abs(v - 128) / 128)
            level.value = max
            peak = Math.max(peak, max)
            raf = requestAnimationFrame(tick)
        }
        tick()
    }

    const start = async () => {
        error.value = null
        const mime = pickMime()
        if (mime === null || !navigator.mediaDevices?.getUserMedia) {
            error.value = 'Trình duyệt này không hỗ trợ ghi âm.'
            return
        }
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true },
            })
        } catch (e) {
            const name = (e as DOMException).name
            error.value =
                name === 'NotAllowedError'
                    ? 'Mic bị từ chối. Mở cài đặt trang và cho phép micro.'
                    : name === 'NotFoundError'
                      ? 'Không tìm thấy micro.'
                      : `Không mở được micro (${name}).`
            return
        }

        chunks = []
        peak = 0
        recorder = new MediaRecorder(stream, {
            ...(mime ? { mimeType: mime } : {}),
            audioBitsPerSecond: 32_000,
        })
        recorder.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data)
        recorder.onstop = () => {
            const durationS = (Date.now() - startedAt) / 1000
            const mimeType = recorder?.mimeType || mime || 'audio/webm'
            cleanup()
            state.value = 'stopped'
            onDone({
                blob: new Blob(chunks, { type: mimeType }),
                mimeType,
                durationS,
                peakLevel: peak,
            })
        }
        meter(stream)
        recorder.start(1000)
        startedAt = Date.now()
        elapsed.value = 0
        state.value = 'recording'
        timer = setInterval(() => {
            elapsed.value = Math.floor((Date.now() - startedAt) / 1000)
            if (elapsed.value >= MAX_RECORD_SECONDS) stop()
        }, 250)
    }

    const stop = () => {
        if (recorder?.state === 'recording') recorder.stop()
    }

    const reset = () => {
        stop()
        cleanup()
        state.value = 'idle'
        elapsed.value = 0
    }

    onBeforeUnmount(reset)

    return { state, elapsed, level, error, start, stop, reset }
}
