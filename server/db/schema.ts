import { sql } from 'drizzle-orm'
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

const now = sql`(unixepoch() * 1000)`

export const users = sqliteTable('users', {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    createdAt: integer('created_at').notNull().default(now),
})

export const topics = sqliteTable('topics', {
    id: text('id').primaryKey(),
    kind: text('kind', { enum: ['speaking', 'writing'] }).notNull(),
    title: text('title').notNull(),
    prompt: text('prompt').notNull(),
    level: text('level').notNull().default('B1'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    /** Comma-separated tags, e.g. "work,standup" or "toeic-sw,opinion". */
    tags: text('tags').notNull().default(''),
    createdAt: integer('created_at').notNull().default(now),
    /** N8 (TOEIC S&W): preparation and response time in seconds; null = untimed. */
    prepS: integer('prep_s'),
    responseS: integer('response_s'),
})

export const attempts = sqliteTable(
    'attempts',
    {
        id: text('id').primaryKey(),
        clientAttemptId: text('client_attempt_id').notNull().unique(),
        kind: text('kind', { enum: ['speaking', 'writing'] }).notNull(),
        topicId: text('topic_id').references(() => topics.id),
        attemptGroupId: text('attempt_group_id').notNull(),
        version: integer('version').notNull().default(1),
        status: text('status', {
            enum: ['processing', 'needs_review', 'confirmed', 'failed'],
        }).notNull(),
        textOrTranscript: text('text_or_transcript'),
        finalTranscript: text('final_transcript'),
        durationS: integer('duration_s'),
        mimeType: text('mime_type'),
        model: text('model'),
        promptVersion: text('prompt_version'),
        aiJson: text('ai_json'),
        error: text('error'),
        processingAt: integer('processing_at'),
        /** Who produced ai_json: Gemini, nobody (self-review) or pasted from another AI. */
        source: text('source', { enum: ['gemini', 'manual', 'pasted'] })
            .notNull()
            .default('gemini'),
        /** N7: answered a topic tagged "benchmark" (monthly comparison). */
        isBenchmark: integer('is_benchmark', { mode: 'boolean' }).notNull().default(false),
        /** N9: spots marked before seeing AI suggestions; null = step skipped. */
        selfMarkedCount: integer('self_marked_count'),
        /** N8: timed topic finished within the response time or not. */
        timedResult: text('timed_result', { enum: ['in_time', 'overtime'] }),
        selfRating: integer('self_rating'),
        fillerCount: integer('filler_count'),
        createdAt: integer('created_at').notNull().default(now),
        confirmedAt: integer('confirmed_at'),
    },
    (t) => [
        index('attempts_created_idx').on(t.createdAt),
        index('attempts_group_idx').on(t.attemptGroupId),
    ],
)

export const mistakes = sqliteTable('mistakes', {
    id: text('id').primaryKey(),
    patternKey: text('pattern_key').notNull().unique(),
    labelVi: text('label_vi').notNull(),
    exampleWrong: text('example_wrong').notNull().default(''),
    exampleRight: text('example_right').notNull().default(''),
    category: text('category').notNull().default('other'),
    firstSeen: integer('first_seen').notNull(),
    lastSeen: integer('last_seen').notNull(),
    hitCount: integer('hit_count').notNull().default(0),
    isFocus: integer('is_focus', { mode: 'boolean' }).notNull().default(false),
    /** Free note, e.g. the book page to revisit. */
    note: text('note').notNull().default(''),
})

export const mistakeHits = sqliteTable(
    'mistake_hits',
    {
        id: text('id').primaryKey(),
        mistakeId: text('mistake_id')
            .notNull()
            .references(() => mistakes.id),
        attemptId: text('attempt_id')
            .notNull()
            .references(() => attempts.id),
        issueIndex: integer('issue_index').notNull(),
        originalQuote: text('original_quote').notNull(),
        correction: text('correction').notNull(),
        /** N9: you marked this spot yourself before seeing the AI suggestions. */
        selfFound: integer('self_found', { mode: 'boolean' }).notNull().default(false),
    },
    (t) => [
        uniqueIndex('mistake_hits_attempt_issue_uq').on(t.attemptId, t.issueIndex),
        index('mistake_hits_mistake_idx').on(t.mistakeId),
    ],
)

/**
 * Review card (N5): one per confirmed mistake hit, so merging or splitting patterns keeps it.
 * FSRS state mirrors ts-fsrs 6 (FSRS-7) card fields; times are ms like every other table.
 */
export const cards = sqliteTable(
    'cards',
    {
        id: text('id').primaryKey(),
        hitId: text('hit_id')
            .notNull()
            .unique()
            .references(() => mistakeHits.id),
        dueAt: integer('due_at').notNull(),
        stability: real('stability').notNull().default(0),
        stabilityFast: real('stability_fast').notNull().default(0),
        difficulty: real('difficulty').notNull().default(0),
        /** ts-fsrs State: 0 New, 1 Learning, 2 Review, 3 Relearning. */
        state: integer('state').notNull().default(0),
        scheduleStatus: text('schedule_status').notNull().default('new'),
        lastReviewAt: integer('last_review_at'),
        reps: integer('reps').notNull().default(0),
        lapses: integer('lapses').notNull().default(0),
        scheduledDays: real('scheduled_days').notNull().default(0),
        learningStep: integer('learning_step').notNull().default(0),
        /** At most 3 active cards per mistake pattern; the rest wait here. */
        suspended: integer('suspended', { mode: 'boolean' }).notNull().default(false),
        createdAt: integer('created_at').notNull(),
    },
    (t) => [index('cards_due_idx').on(t.suspended, t.dueAt)],
)

/** Weekly quiz (N6): a fixed set of cards, score = share of Good + Easy. */
export const quizzes = sqliteTable('quizzes', {
    id: text('id').primaryKey(),
    createdAt: integer('created_at').notNull(),
    /** JSON array of card ids, in quiz order. */
    cardIds: text('card_ids').notNull(),
    finishedAt: integer('finished_at'),
    score: real('score'),
})

/** One row per card review; pre-review state as returned by ts-fsrs as the revlog. */
export const reviewLogs = sqliteTable(
    'review_logs',
    {
        id: text('id').primaryKey(),
        cardId: text('card_id')
            .notNull()
            .references(() => cards.id),
        /** 1 Again, 2 Hard, 3 Good, 4 Easy. */
        rating: integer('rating').notNull(),
        state: integer('state').notNull(),
        scheduleStatus: text('schedule_status').notNull(),
        dueAt: integer('due_at').notNull(),
        stability: real('stability').notNull(),
        stabilityFast: real('stability_fast').notNull(),
        difficulty: real('difficulty').notNull(),
        scheduledDays: real('scheduled_days').notNull(),
        learningStep: integer('learning_step').notNull(),
        lastReviewAt: integer('last_review_at'),
        reviewedAt: integer('reviewed_at').notNull(),
        isQuiz: integer('is_quiz', { mode: 'boolean' }).notNull().default(false),
        quizId: text('quiz_id').references(() => quizzes.id),
    },
    (t) => [
        index('review_logs_card_idx').on(t.cardId),
        index('review_logs_time_idx').on(t.reviewedAt),
    ],
)

/**
 * N7: which pattern was the weekly focus and when. No foreign key: a focus pattern may later
 * be merged away, and the history should survive that.
 */
export const focusLog = sqliteTable('focus_log', {
    id: text('id').primaryKey(),
    mistakeId: text('mistake_id').notNull(),
    patternKey: text('pattern_key').notNull(),
    startedAt: integer('started_at').notNull(),
    endedAt: integer('ended_at'),
})

/** Manual check-ins for days studied outside the app (books, listening…). */
export const checkins = sqliteTable(
    'checkins',
    {
        id: text('id').primaryKey(),
        /** YYYY-MM-DD in Vietnam time. */
        date: text('date').notNull(),
        kind: text('kind', {
            enum: ['book', 'listening', 'reading', 'vocab', 'grammar', 'other'],
        }).notNull(),
        minutes: integer('minutes'),
        note: text('note').notNull().default(''),
        createdAt: integer('created_at').notNull().default(now),
    },
    (t) => [index('checkins_date_idx').on(t.date)],
)

export const rateCounters = sqliteTable('rate_counters', {
    key: text('key').primaryKey(),
    windowStart: integer('window_start').notNull(),
    count: integer('count').notNull().default(0),
})
