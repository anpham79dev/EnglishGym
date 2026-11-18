# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

EnglishGym is a single-user English practice tool: speak or write → Gemini suggests mistakes → the user reviews them → confirmed mistakes go into a mistake log. The product spec and scope priorities (P0/P1/P2) are in `docs/plan.md` (Vietnamese); check it before adding features. UI text and code comments are in Vietnamese.

## Commands

```sh
npm run dev                      # Nuxt dev server
npm test                         # Vitest (tests/*.test.ts)
npx vitest run tests/quote.test.ts          # single file
npx vitest run -t "findQuote"               # single test by name
npm run typecheck                # nuxt typecheck (root tsconfig.json references .nuxt/* + tsconfig.tools.json)
npm run build                    # production build (Vercel preset auto-detected on Vercel)
npm run format                   # Prettier: 4 spaces, no semicolons, single quotes, width 100
npm run db:generate              # after editing server/db/schema.ts → new SQL in server/db/migrations
npm run db:migrate               # apply migrations to DATABASE_URL (file:./data/local.db in dev, Turso in prod)
npm run db:seed                  # idempotent topic seed (scripts/seed-topics.ts)
npm run db:backup                # JSON backup straight from DATABASE_URL (no Vercel 4.5 MB limit)
npm run db:restore -- <file>     # import a backup via importAll (merges, keeps existing rows)
npm run db:backfill-cards        # create review cards for hits confirmed before cards existed (idempotent)
npm run user:create -- <email> "<password ≥8 chars>"   # create the user or reset its password
npm run eval:gemini -- --runs 2  # "Buổi 0" Gemini evaluation against golden_samples/
```

Node 24+ is required (`ts-fsrs` 6). Set the Vercel project to Node 24.

Scripts in `scripts/` run through `tsx` and load `.env` themselves. They import with relative paths, never `#shared`, because Nuxt aliases don't exist outside Nuxt. Any `shared/` file a script imports must also use relative imports only. The same goes for runtime imports in server files the scripts pull in (`backupService.ts`, `mistakeService.ts`, `cardService.ts`, `server/utils/http.ts`); type-only `#shared` imports are fine there because they are erased.

Migrations: SQLite cannot `ALTER TABLE ADD COLUMN` with an expression default such as `(unixepoch() * 1000)`. If `db:generate` emits one, edit the SQL to a constant default (see `0002`).

Tests: `vitest.config.ts` maps `#shared` and pins `vitest` to one copy (on Windows a lower-case drive letter in the cwd otherwise loads it twice and every suite fails with "reading 'config'"). Service tests use `tests/helpers/db.ts`: a migrated SQLite file per test file (not `:memory:`, which breaks under libsql transactions), rows wiped before each test, and `fakeGrade()` instead of Gemini. `drizzle.config.ts`, `scripts/` and `tests/` are type-checked by `tsconfig.tools.json` (Node types); Nuxt-generated tsconfigs don't cover them.

Commits: use the project `commit` skill (`.claude/skills/commit`): one-line `type: message`, no author or Co-Authored-By lines.

## Architecture

Full detail (diagrams, data model, attempt lifecycle, "where to change X") is in `ARCHITECTURE.md` (Vietnamese). Summary:

Nuxt 4 full-stack app in SPA mode (`ssr: false`), because MediaRecorder and IndexedDB only exist in the browser. It deploys to Vercel Functions with a Turso/libSQL database through Drizzle.

- `shared/` holds code used by the client, the server and the scripts:
  - `quote.ts`: matching `original_quote` against the source text, only tolerant of whitespace and curly-quote differences
  - `kpi.ts`: KPI calculations
  - `aiSchema.ts`: Zod schemas, converted to JSON Schema for Gemini's `responseJsonSchema`
  - `prompts.ts`: the prompts sent to Gemini, plus the manual "Copy prompt" text
  - `patternKey.ts`
  - `pasted.ts` (JSON pasted from another AI), `csv.ts` (topic import), `streak.ts` (app-time day keys, streak), `sentence.ts` (card front), `selfFind.ts` (N9 marks), `wordDiff.ts` (N10)

  Changing a prompt means bumping `PROMPT_VERSION` in `shared/constants/app.ts`. Every attempt stores `model` and `prompt_version`.
- `server/api/*` routes stay thin: validate with Zod (`parseBody`/`parseQuery`/`validationError` in `server/utils/http.ts`), then call `server/services/*`. Routes that only read one table (`topics.get`, `auth/*`) may query directly. Routes use Nitro auto-imports; services and `server/utils` import h3 helpers and each other explicitly.
- `app/api/*` contains the client fetch functions, one file per domain (this layout follows the user's CRM project). Pages stay thin; feature components live in `app/components/<feature>/` and are auto-imported with a folder prefix (e.g. `<SpeakingRecorderPanel>`).
- Feature map (spec and status in `docs/review-fixes.md`, part B):
  - grading modes `ai | manual | pasted` (`gradeModes.ts`); `attempts.source` records which one, and only `ai` touches Gemini or the quota
  - topic bank with tags, import, TOEIC timing `prep_s/response_s` (`topicService.ts`, `/topics`)
  - mistake notes; focus history in `focus_log` (`setFocusLog`)
  - streak and calendar from confirmed attempts, card reviews and manual `checkins` (`streakService.ts`), all in app time
  - review cards (`cardService.ts`, ts-fsrs 6 / FSRS-7): one card per confirmed hit, created inside `confirmAttempt`; at most 3 active cards per pattern (`rebalanceCards` after confirm, merge, split, import); the server schedules, never the client
  - weekly quiz (`quizService.ts`), weekly stats and monthly benchmarks (`statsService.ts`, topics tagged `benchmark`), version compare (`getAttemptGroup`, `/compare/:groupId`), self-find step before AI suggestions (`ReviewSelfFind`, `mistake_hits.self_found`)
  - per-device preferences live in `useSettings()` (localStorage), never on the server
- UI is Nuxt UI 4 on Tailwind 4. Follow the project skill `.claude/skills/ui-ux` for any screen work: theme tokens only (no hex colours in components), Lucide icons via `UIcon` only (no emoji or symbol characters as icons), `useNotify()` for toasts, `useConfirm()` instead of `confirm()`, every page wrapped in `<LayoutPage>`. Icons are bundled (`icon.clientBundle.scan` with `globInclude: ['**/*.{vue,ts}']`, because the default scan skips `.ts` and icon names in `app/constants` were missed; `fallbackToApi: false`), and `/api/_nuxt_icon` is exempt from auth. `tests/icons.test.ts` fails on unknown Lucide names and on emoji in `app/`.

### Core flow and invariants

1. **Submit** (`POST /api/attempts/{writing,speaking}`) goes through `submitAttempt` in `attemptService.ts`. It is idempotent on `client_attempt_id`, which the client generates:
   - An existing row that is not `failed` is returned as is, without calling Gemini again.
   - A `failed` row is re-graded in place.

   - A `processing` row younger than `PROCESSING_STALE_MS` (2 min, from `processing_at`) returns 409 `IN_PROGRESS`; an older one is treated as dead and re-graded. Claiming a row is a conditional UPDATE, so parallel requests can't both grade.
   - The client only treats `needs_review`/`confirmed` as done (marks audio `sent`, deletes the draft).

   Statuses: `processing → needs_review | failed → confirmed`.
2. **Grading** (`geminiService.ts`):
   - JSON that fails schema validation is retried exactly once, then the error is `INVALID_AI`.
   - Each call aborts after `GEMINI_TIMEOUT_MS` (25 s) with `AI_TIMEOUT` and is not retried; the Vercel function limit is 60 s.
   - Gemini 429 is never retried; it becomes `QUOTA`.
   - A daily call cap (`GEMINI_DAILY_LIMIT`) is stored in the `rate_counters` table, never in memory, because serverless functions don't keep RAM between calls. It is consumed before every call (retries included, via `beforeCall`) and resets at midnight Vietnam time (`APP_UTC_OFFSET_MIN`).
   - Errors carry `data.code` (`ApiErrorCode`), and the client uses that code to decide whether to show "Copy prompt".
3. **Review is mandatory.** Nothing is written to `mistakes` until `POST /api/attempts/:id/confirm`:
   - It runs in one transaction.
   - A second confirm is a no-op.
   - The unique index on `mistake_hits(attempt_id, issue_index)` prevents double counting.

   `hit_count`, `first_seen` and `last_seen` are always recomputed from hits by `recomputeMistake`; never increment them by hand. User-added issues use `issue_index` 1000 and up. The same transaction creates a review card for each newly inserted hit.
4. `ai_json` keeps Gemini's raw output and is never modified. User edits go to `final_transcript` and `mistake_hits`. `pattern_key` from the AI is only a suggestion; the user confirms it at review time.
5. Review defaults (`app/composables/useReviewForm.ts`): an issue is pre-checked only if its quote matches the source and doesn't look like a rewrite (`assessIssue`). Highlighting only happens on an exact match, and AI text is never rendered as HTML.

### Client storage

Audio never goes to the server for storage; it is sent only for grading. Dexie (`app/composables/useLocalDb.ts`) stores:
- audio blobs, keyed by `client_attempt_id`. Rows with `status: 'pending'` are the retry queue.
- the current writing draft.

Audio is saved right after recording stops, and the upload limit is 3 MB (`MAX_AUDIO_BYTES`). Allowed MIME types are in `ALLOWED_AUDIO_MIME`, and the server compares the base MIME without `;codecs`.

### Auth

Single user. The session is an HMAC-signed cookie `<userId>.<exp>.<sig>` (`server/utils/session.ts`, helpers named `*AuthCookie` to avoid clashing with h3's session helpers), and there is no sessions table. `server/middleware/auth.ts` protects every `/api/*` route except login and me; `app/middleware/auth.global.ts` guards pages.

### Backup

`GET /api/export?format=json|csv|anki` and `POST /api/import`. Import inserts in foreign-key order with `onConflictDoNothing`, maps file ids onto existing rows (attempts by `client_attempt_id`, mistakes by `pattern_key`, hits by `(attempt_id, issue_index)`, cards by `hit_id`), re-points hits, cards, review logs and quiz card lists, recomputes touched mistakes, rebalances cards, keeps an existing focus, and returns before/after/inFile/skipped counts. Above `MAX_BACKUP_BYTES` (4 MB, under Vercel's 4.5 MB body limit) the web export/import refuse and point to `db:backup`/`db:restore`. Bump `EXPORT_SCHEMA_VERSION` if the export shape changes.

## Environment

Use server-only `process.env` variables: `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_DAILY_LIMIT`, `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `SESSION_SECRET` (≥32 chars). Never expose them through `runtimeConfig.public` or `NUXT_PUBLIC_*`. See `.env.example`.
