import { z } from 'zod'
import { exportAll, exportAnkiCsv, exportMistakesCsv } from '../services/backupService'

const querySchema = z.object({ format: z.enum(['json', 'csv', 'anki']).default('json') })

export default defineEventHandler(async (event) => {
    const { format } = parseQuery(event, querySchema)
    const stamp = new Date().toISOString().slice(0, 10)

    if (format === 'json') {
        setHeader(event, 'content-disposition', `attachment; filename="englishgym-${stamp}.json"`)
        return exportAll()
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
