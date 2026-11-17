import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

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
            enum: ['draft', 'processing', 'needs_review', 'confirmed', 'failed'],
        }).notNull(),
        textOrTranscript: text('text_or_transcript'),
        finalTranscript: text('final_transcript'),
        durationS: integer('duration_s'),
        mimeType: text('mime_type'),
        model: text('model'),
        promptVersion: text('prompt_version'),
        aiJson: text('ai_json'),
        error: text('error'),
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
    },
    (t) => [
        uniqueIndex('mistake_hits_attempt_issue_uq').on(t.attemptId, t.issueIndex),
        index('mistake_hits_mistake_idx').on(t.mistakeId),
    ],
)

export const rateCounters = sqliteTable('rate_counters', {
    key: text('key').primaryKey(),
    windowStart: integer('window_start').notNull(),
    count: integer('count').notNull().default(0),
})
