import { BaseConfirmDialog } from '#components'

/** Promise-based confirm modal; replaces window.confirm(). Resolves false when dismissed. */
export const useConfirm = () => {
    const overlay = useOverlay()
    const dialog = overlay.create(BaseConfirmDialog)
    return async (props: {
        title: string
        description?: string
        confirmLabel?: string
        danger?: boolean
    }) => (await dialog.open(props).result) === true
}
