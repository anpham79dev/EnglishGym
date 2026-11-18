export const DAY_MS = 24 * 60 * 60 * 1000

export const startOfToday = () => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.getTime()
}

/** Local day index for daily topic rotation. */
export const localDayIndex = () =>
    Math.floor((startOfToday() - new Date().getTimezoneOffset() * 60_000) / DAY_MS)

export const formatDateTime = (ms: number) =>
    new Date(ms).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })

export const formatDuration = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export const formatBytes = (n: number) =>
    n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`

/** "10 phút", "3 giờ", "5 ngày", "2 tháng": time until a card is due again. */
export const formatInterval = (ms: number) => {
    const min = Math.max(1, Math.round(ms / 60_000))
    if (min < 60) return `${min} phút`
    const h = Math.round(min / 60)
    if (h < 24) return `${h} giờ`
    const d = Math.round(h / 24)
    if (d < 45) return `${d} ngày`
    return `${Math.round(d / 30)} tháng`
}

export const copyText = async (text: string) => {
    try {
        await navigator.clipboard.writeText(text)
        return true
    } catch {
        const el = document.createElement('textarea')
        el.value = text
        document.body.appendChild(el)
        el.select()
        const ok = document.execCommand('copy')
        el.remove()
        return ok
    }
}

export const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}
