import { z } from 'zod'
import { MAX_BACKUP_BYTES } from '#shared/constants/app'
import { exportAll, exportAnkiCsv, exportMistakesCsv } from '../services/backupService'

const querySchema = z.object({ format: z.enum(['json', 'csv', 'anki']).default('json') })

export default defineEventHandler(async (event) => {
    const { format } = parseQuery(event, querySchema)
    const stamp = new Date().toISOString().slice(0, 10)

    if (format === 'json') {
        const body = JSON.stringify(await exportAll())
        // Vercel would cut a larger response; fail clearly and point to the local script.
        if (Buffer.byteLength(body) > MAX_BACKUP_BYTES)
            throw apiError(
                413,
                'TOO_LARGE',
                'Dữ liệu quá lớn để tải qua web. Chạy npm run db:backup trên máy.',
            )
        setHeader(event, 'content-type', 'application/json; charset=utf-8')
        setHeader(event, 'content-disposition', `attachment; filename="englishgym-${stamp}.json"`)
        return body
    }
    setHeader(event, 'content-type', 'text/csv; charset=utf-8')
    if (format === 'anki') {
        setHeader(
            event,
            'content-disposition',
            `attachment; filename="englishgym-anki-${stamp}.csv"`,
        )
        return exportAnkiCsv()
    }
    setHeader(
        event,
        'content-disposition',
        `attachment; filename="englishgym-mistakes-${stamp}.csv"`,
    )
    return exportMistakesCsv()
})
