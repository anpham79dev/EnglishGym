import Dexie, { type Table } from 'dexie'

/** Audio chỉ nằm trên máy đã ghi. Bản ghi `pending` chính là hàng chờ gửi lại. */
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
        // Xin trình duyệt hạn chế tự xoá dữ liệu; không đảm bảo, nên app vẫn không hứa giữ audio.
        navigator.storage?.persist?.().catch(() => {})
    }
    return _db
}
