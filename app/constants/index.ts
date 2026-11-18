import type { AttemptKind, AttemptStatus, IssueCategory } from '#shared/types'

/** Icons are Lucide names only (no emoji or symbol characters anywhere in the UI). */
export const NAV_ITEMS = [
    { to: '/', label: 'Hôm nay', icon: 'i-lucide-house' },
    { to: '/speaking', label: 'Luyện nói', icon: 'i-lucide-mic' },
    { to: '/writing', label: 'Luyện viết', icon: 'i-lucide-pen-line' },
    { to: '/mistakes', label: 'Sổ lỗi', icon: 'i-lucide-notebook-pen' },
] as const

export const KIND_ICONS: Record<AttemptKind, string> = {
    speaking: 'i-lucide-mic',
    writing: 'i-lucide-pen-line',
}

export const KIND_LABELS: Record<AttemptKind, string> = {
    speaking: 'Bài nói',
    writing: 'Bài viết',
}

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
    processing: 'Đang chấm',
    needs_review: 'Chờ duyệt',
    confirmed: 'Đã lưu',
    failed: 'Lỗi',
}

export const STATUS_COLORS: Record<AttemptStatus, 'info' | 'warning' | 'success' | 'error'> = {
    processing: 'info',
    needs_review: 'warning',
    confirmed: 'success',
    failed: 'error',
}

export const LS_LAST_BACKUP = 'eg:lastBackupAt'
/** Peak level below this means no voice was captured. */
export const SILENCE_PEAK = 0.04
