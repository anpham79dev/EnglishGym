type Counts = Record<'topics' | 'attempts' | 'mistakes' | 'mistake_hits', number>

export interface ImportResult {
    before: Counts
    after: Counts
    inFile: Counts
}

export const exportUrl = (format: 'json' | 'csv' | 'anki') => `/api/export?format=${format}`

export const importBackup = (data: unknown) =>
    $fetch<ImportResult>('/api/import', { method: 'POST', body: data as Record<string, unknown> })
