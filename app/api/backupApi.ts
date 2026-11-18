type Counts = Record<'topics' | 'attempts' | 'mistakes' | 'mistake_hits', number>

export interface ImportResult {
    before: Counts
    after: Counts
    inFile: Counts
    /** Rows in the file that already existed (same id, client id or pattern_key). */
    skipped: Counts
}

export const exportUrl = (format: 'json' | 'csv' | 'anki') => `/api/export?format=${format}`

export const importBackup = (data: unknown) =>
    $fetch<ImportResult>('/api/import', { method: 'POST', body: data as Record<string, unknown> })
