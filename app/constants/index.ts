import type { AttemptStatus, IssueCategory } from '#shared/types'

export const NAV_ITEMS = [
    { to: '/', label: 'Hôm nay', icon: '☀' },
    { to: '/speaking', label: 'Luyện nói', icon: '🎙' },
    { to: '/writing', label: 'Luyện viết', icon: '✎' },
    { to: '/mistakes', label: 'Sổ lỗi', icon: '📒' },
] as const

export const CATEGORY_LABELS: Record<IssueCategory, string> = {
    grammar: 'Ngữ pháp',
    tense: 'Thì',
    article: 'Mạo từ',
    preposition: 'Giới từ',
    word_choice: 'Chọn từ',
    collocation: 'Kết hợp từ',
    plural: 'Số nhiều',
    subject_verb_agreement: 'Hoà hợp chủ-vị',
    word_order: 'Trật tự từ',
    spelling: 'Chính tả',
    other: 'Khác',
}

export const STATUS_LABELS: Record<AttemptStatus, string> = {
    draft: 'Nháp',
    processing: 'Đang chấm',
    needs_review: 'Chờ duyệt',
    confirmed: 'Đã lưu',
    failed: 'Lỗi',
}

export const LS_LAST_BACKUP = 'eg:lastBackupAt'
/** Ngưỡng mức âm: thấp hơn coi như không thu được tiếng. */
export const SILENCE_PEAK = 0.04
