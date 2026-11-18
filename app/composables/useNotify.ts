/** Short toasts on top of Nuxt UI's useToast (the old hand-made useToast is gone). */
export const useNotify = () => {
    const toast = useToast()
    return {
        info: (title: string) => toast.add({ title, color: 'neutral', icon: 'i-lucide-info' }),
        success: (title: string) =>
            toast.add({ title, color: 'success', icon: 'i-lucide-circle-check' }),
        error: (title: string) =>
            toast.add({ title, color: 'error', icon: 'i-lucide-circle-alert', duration: 7000 }),
    }
}
