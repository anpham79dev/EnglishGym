import { existsSync } from 'node:fs'
import { defineConfig } from 'drizzle-kit'

if (existsSync('.env')) process.loadEnvFile('.env')

export default defineConfig({
    schema: './server/db/schema.ts',
    out: './server/db/migrations',
    dialect: 'turso',
    dbCredentials: {
        url: process.env.DATABASE_URL || 'file:./data/local.db',
        authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
    },
})
