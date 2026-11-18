import Dexie, { type Table } from 'dexie'

/** Audio stays on this device; `pending` rows are the retry queue. */
export interface LocalAudio {
    /** = client_attempt_id */
    id: string
    blob: Blob
    mimeType: string
    durationS: number
    topicId: string | null
    topicTitle: string
    attemptGroupId: string | null
    createdAt: number
    status: 'pending' | 'sent'
    attemptId?: string
    lastError?: string
    /** N8: recorded on a timed topic (auto-stopped at the response time). */
    timed?: boolean
}

export interface WritingDraft {
    id: 'current'
    clientAttemptId: string
    topicId: string | null
    attemptGroupId: string | null
    text: string
    updatedAt: number
    lastError?: string
}

class LocalDb extends Dexie {
    audios!: Table<LocalAudio, string>
    drafts!: Table<WritingDraft, string>

    constructor() {
        super('englishgym')
        this.version(1).stores({
            audios: 'id, status, attemptId, createdAt',
            drafts: 'id',
        })
    }
}

let _db: LocalDb | undefined

export const useLocalDb = () => {
    if (!_db) {
        _db = new LocalDb()
        // Best effort: the browser may still evict data.
        navigator.storage?.persist?.().catch(() => {})
    }
    return _db
}
