import { exportUrl } from '~/api/backupApi'
import { toApiFailure } from '~/api/http'
import { LS_LAST_BACKUP } from '~/constants'

export type ExportFormat = 'json' | 'csv' | 'anki'

const FILE_NAMES: Record<ExportFormat, string> = {
    json: 'englishgym',
    csv: 'englishgym-mistakes',
    anki: 'englishgym-anki',
}

/**
 * Download an export through fetch, so a server error (e.g. 413 when the backup is too big
 * for Vercel) shows as a toast instead of replacing the page.
 */
export const useBackup = () => {
    const notify = useNotify()
    const downloading = ref(false)

    const download = async (format: ExportFormat) => {
        downloading.value = true
        try {
            const blob = await $fetch<Blob>(exportUrl(format), { responseType: 'blob' })
            const stamp = new Date().toISOString().slice(0, 10)
            downloadBlob(
                blob,
                `${FILE_NAMES[format]}-${stamp}.${format === 'json' ? 'json' : 'csv'}`,
            )
            if (format === 'json') {
                try {
                    localStorage.setItem(LS_LAST_BACKUP, String(Date.now()))
                } catch {
                    /* private mode: the reminder just shows again */
                }
            }
            notify.success(format === 'json' ? 'Đã tải bản sao lưu' : 'Đã tải file CSV')
            return true
        } catch (e) {
            notify.error(toApiFailure(e).message)
            return false
        } finally {
            downloading.value = false
        }
    }

    return { download, downloading }
}
