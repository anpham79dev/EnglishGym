export interface ToastItem {
    id: number
    text: string
    type: 'info' | 'error' | 'success'
}

let seq = 0

export const useToast = () => {
    const items = useState<ToastItem[]>('toasts', () => [])

    const show = (text: string, type: ToastItem['type'] = 'info', ms = 3500) => {
        const id = ++seq
        items.value.push({ id, text, type })
        setTimeout(() => (items.value = items.value.filter((t) => t.id !== id)), ms)
    }

    return {
        items,
        info: (t: string) => show(t, 'info'),
        success: (t: string) => show(t, 'success'),
        error: (t: string) => show(t, 'error', 6000),
    }
}
