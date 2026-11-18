export const PROMPT_VERSION = 'v1'
export const EXPORT_SCHEMA_VERSION = 1

export const MAX_AUDIO_BYTES = 3 * 1024 * 1024
export const MAX_RECORD_SECONDS = 120
export const MAX_WRITING_CHARS = 6000

/** Per-call Gemini timeout; two calls plus upload must fit in the 60 s function limit. */
export const GEMINI_TIMEOUT_MS = 25_000
/** A `processing` row older than this is treated as stuck and may be re-graded. */
export const PROCESSING_STALE_MS = 2 * 60 * 1000
/** App day boundary: Vietnam time (UTC+7), shared by server and client. */
export const APP_UTC_OFFSET_MIN = 420
/** Vercel caps function request/response bodies at 4.5 MB; stay below it. */
export const MAX_BACKUP_BYTES = 4 * 1024 * 1024

/** Base MIME types (without ;codecs) accepted by the server. */
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

/** Preference order for MediaRecorder.isTypeSupported(). */
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
