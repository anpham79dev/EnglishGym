import { MAX_BACKUP_BYTES } from '#shared/constants/app'
import { importAll } from '../services/backupService'

export default defineEventHandler(async (event) => {
    if (Number(getHeader(event, 'content-length') || 0) > MAX_BACKUP_BYTES)
        throw apiError(413, 'TOO_LARGE', 'File quá lớn để nhập qua web. Chạy npm run db:restore.')
    return importAll(await readBody(event))
})
