/**
 * Write a JSON backup straight from DATABASE_URL (no Vercel size limit).
 *   npm run db:backup                 -> backups/englishgym-YYYY-MM-DD.json
 *   npm run db:backup -- out.json
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

if (existsSync('.env')) process.loadEnvFile('.env')

const { exportAll } = await import('../server/services/backupService')

const out = process.argv[2] || `backups/englishgym-${new Date().toISOString().slice(0, 10)}.json`
mkdirSync(dirname(out), { recursive: true })
const data = await exportAll()
const body = JSON.stringify(data)
writeFileSync(out, body)
console.log(`Đã ghi ${out} (${(Buffer.byteLength(body) / 1024 / 1024).toFixed(2)} MB)`, data.counts)
