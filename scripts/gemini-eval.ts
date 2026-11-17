/**
 * Gemini evaluation (plan "Buổi 0"). No Nuxt or DB needed.
 *
 *   golden_samples/
 *     clip01.webm            ← audio (webm, ogg, mp4, m4a, mp3, wav…)
 *     clip01.json            ← hand-written answer key:
 *       { "topic": "Describe a bug",
 *         "transcript": "...verbatim, mistakes included...",
 *         "issues": [ { "original_quote": "I fix it yesterday" } ] }
 *
 *   npm run eval:gemini                 # 1 run
 *   npm run eval:gemini -- --runs 2     # 2 runs to check stability
 *
 * Output: golden_samples/results/<timestamp>.json plus a summary vs. the plan thresholds.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { GoogleGenAI } from '@google/genai'
import { speakingResultSchema, toGeminiSchema } from '../shared/utils/aiSchema'
import { buildSpeakingPrompt } from '../shared/utils/prompts'
import { findQuote } from '../shared/utils/quote'
import { countWords } from '../shared/utils/kpi'

if (existsSync('.env')) process.loadEnvFile('.env')

const DIR = 'golden_samples'
const MIME: Record<string, string> = {
    '.webm': 'audio/webm',
    '.ogg': 'audio/ogg',
    '.opus': 'audio/ogg',
    '.mp4': 'audio/mp4',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.flac': 'audio/flac',
}

interface Golden {
    topic?: string
    transcript: string
    issues: { original_quote: string }[]
}

const runs = Number(process.argv[process.argv.indexOf('--runs') + 1]) || 1
const apiKey = process.env.GEMINI_API_KEY
const model = process.env.GEMINI_MODEL || 'gemini-flash-latest'
if (!apiKey) {
    console.error('Thiếu GEMINI_API_KEY trong .env')
    process.exit(1)
}
const ai = new GoogleGenAI({ apiKey })

const words = (s: string) =>
    s
        .toLowerCase()
        .replace(/[^a-z0-9'\s]/g, ' ')
        .split(/\s+/)
        .filter(Boolean)

/** Word error rate (word-level Levenshtein). */
const wer = (ref: string, hyp: string) => {
    const r = words(ref)
    const h = words(hyp)
    const d = Array.from({ length: r.length + 1 }, (_, i) => [i, ...Array(h.length).fill(0)])
    for (let j = 1; j <= h.length; j++) d[0]![j] = j
    for (let i = 1; i <= r.length; i++)
        for (let j = 1; j <= h.length; j++)
            d[i]![j] = Math.min(
                d[i - 1]![j]! + 1,
                d[i]![j - 1]! + 1,
                d[i - 1]![j - 1]! + (r[i - 1] === h[j - 1] ? 0 : 1),
            )
    return r.length ? d[r.length]![h.length]! / r.length : 0
}

const overlaps = (a: string, b: string) => {
    const wa = new Set(words(a))
    return words(b).some((w) => wa.has(w) && w.length > 2)
}

const clips = readdirSync(DIR).filter((f) => MIME[extname(f).toLowerCase()])
if (!clips.length) {
    console.error(`Chưa có clip trong ${DIR}/`)
    process.exit(1)
}

const rows: Record<string, unknown>[] = []
let totalGoldenIssues = 0
let preservedIssues = 0
let totalSuggested = 0
let suspectedFabricated = 0
let validJson = 0
let rewriteFlags = 0
let calls = 0

for (const file of clips) {
    const name = basename(file, extname(file))
    const goldenPath = join(DIR, `${name}.json`)
    if (!existsSync(goldenPath)) {
        console.warn(`Bỏ qua ${file}: thiếu ${name}.json`)
        continue
    }
    const golden = JSON.parse(readFileSync(goldenPath, 'utf8')) as Golden
    const audio = readFileSync(join(DIR, file)).toString('base64')
    const mimeType = MIME[extname(file).toLowerCase()]!

    for (let run = 1; run <= runs; run++) {
        calls++
        const started = Date.now()
        let raw = ''
        let error: string | null = null
        try {
            const res = await ai.models.generateContent({
                model,
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { inlineData: { mimeType, data: audio } },
                            { text: buildSpeakingPrompt(golden.topic ?? 'Free topic') },
                        ],
                    },
                ],
                config: {
                    temperature: 0.2,
                    responseMimeType: 'application/json',
                    responseJsonSchema: toGeminiSchema(speakingResultSchema),
                },
            })
            raw = res.text ?? ''
        } catch (e) {
            error = e instanceof Error ? e.message : String(e)
        }

        let parsed: ReturnType<typeof speakingResultSchema.safeParse> | null = null
        try {
            parsed = speakingResultSchema.safeParse(JSON.parse(raw))
        } catch {
            /* invalid JSON */
        }
        const ok = parsed?.success ? parsed.data : null
        if (ok) validJson++

        const transcript = ok?.transcript ?? ''
        totalGoldenIssues += golden.issues.length
        const preserved = golden.issues.filter((g) => findQuote(transcript, g.original_quote))
        if (ok) preservedIssues += preserved.length

        const issues = ok?.issues ?? []
        totalSuggested += issues.length
        const notInTranscript = issues.filter((i) => !findQuote(transcript, i.original_quote))
        const noGoldenMatch = issues.filter(
            (i) => !golden.issues.some((g) => overlaps(g.original_quote, i.original_quote)),
        )
        suspectedFabricated += noGoldenMatch.length
        const rewrite = issues.some(
            (i) => countWords(i.original_quote) > Math.max(25, countWords(transcript) * 0.5),
        )
        if (rewrite) rewriteFlags++

        const row = {
            clip: file,
            run,
            ms: Date.now() - started,
            error,
            validJson: !!ok,
            wer: ok ? Math.round(wer(golden.transcript, transcript) * 1000) / 10 : null,
            goldenIssues: golden.issues.length,
            preserved: preserved.length,
            suggested: issues.length,
            quoteNotInTranscript: notInTranscript.length,
            suspectedFabricated: noGoldenMatch.map((i) => i.original_quote),
            rewriteFlag: rewrite,
            transcript,
            issues,
            raw: ok ? undefined : raw.slice(0, 2000),
        }
        rows.push(row)
        console.log(
            `${file} #${run}: json=${row.validJson} WER=${row.wer}% giữ lỗi ${row.preserved}/${row.goldenIssues} gợi ý=${row.suggested} nghi bịa=${noGoldenMatch.length}${error ? ` LỖI: ${error}` : ''}`,
        )
    }
}

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0)
const summary = {
    model,
    runs,
    calls,
    preservedRate: pct(preservedIssues, totalGoldenIssues),
    fabricatedRate: pct(suspectedFabricated, totalSuggested),
    validJsonRate: pct(validJson, calls),
    rewriteCases: rewriteFlags,
}

mkdirSync(join(DIR, 'results'), { recursive: true })
const out = join(DIR, 'results', `${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
writeFileSync(out, JSON.stringify({ summary, rows }, null, 2))

const verdict = (ok: boolean) => (ok ? 'ĐẠT ' : 'CHƯA')
console.log('\n=== Tóm tắt (mục 4) ===')
console.log(`Model: ${model}`)
console.log(
    `${verdict(summary.preservedRate >= 85)} Giữ lỗi ngữ pháp trong transcript: ${summary.preservedRate}% (≥ 85%)`,
)
console.log(
    `${verdict(summary.fabricatedRate <= 10)} Gợi ý nghi bịa*: ${summary.fabricatedRate}% (≤ 10%)`,
)
console.log(
    `${verdict(summary.validJsonRate >= 95)} JSON hợp lệ: ${summary.validJsonRate}% (≥ 95%)`,
)
console.log(
    `${verdict(rewriteFlags === 0)} Không viết lại cả bài: ${rewriteFlags} ca nghi viết lại (0)`,
)
console.log('* "nghi bịa" = gợi ý không trùng lỗi chuẩn nào; mở file kết quả để duyệt tay.')
console.log(`Chi tiết: ${out}`)
