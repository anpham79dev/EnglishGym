/**
 * Import a JSON backup straight into DATABASE_URL (no Vercel size limit).
 * Same merge rules as POST /api/import; existing rows are kept.
 *   npm run db:restore -- backups/englishgym-YYYY-MM-DD.json
 */
import { existsSync, readFileSync } from 'node:fs'

if (existsSync('.env')) process.loadEnvFile('.env')

const file = process.argv[2]
if (!file || !existsSync(file)) {
    console.error('Cách dùng: npm run db:restore -- <file.json>')
    process.exit(1)
}

const { importAll } = await import('../server/services/backupService')
const res = await importAll(JSON.parse(readFileSync(file, 'utf8')))
console.table(
    Object.fromEntries(
        Object.keys(res.after).map((k) => {
            const n = k as keyof typeof res.after
            return [
                n,
                {
                    trước: res.before[n],
                    sau: res.after[n],
                    trong_file: res.inFile[n],
                    bỏ_qua: res.skipped[n],
                },
            ]
        }),
    ),
)
