export const PROMPT_VERSION = 'v1'
export const EXPORT_SCHEMA_VERSION = 1

export const MAX_AUDIO_BYTES = 3 * 1024 * 1024
export const MAX_RECORD_SECONDS = 120
export const MAX_WRITING_CHARS = 6000

/** MIME gốc (bỏ ;codecs=) server chấp nhận. Bổ sung sau khi thử ở Buổi 0. */
export const ALLOWED_AUDIO_MIME = [
    'audio/webm',
    'audio/ogg',
    'audio/mp4',
    'audio/aac',
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-m4a',
    'audio/flac',
] as const

/** Thứ tự ưu tiên khi dò bằng MediaRecorder.isTypeSupported(). */
export const RECORDER_MIME_CANDIDATES = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
]

export const ISSUE_CATEGORIES = [
    'grammar',
    'tense',
    'article',
    'preposition',
    'word_choice',
    'collocation',
    'plural',
    'subject_verb_agreement',
    'word_order',
    'spelling',
    'other',
] as const

export const FILLER_PHRASES = ['um', 'uh', 'er', 'ah', 'hmm', 'you know', 'i mean', 'like']

export const baseMime = (mime: string) => mime.split(';')[0]!.trim().toLowerCase()
