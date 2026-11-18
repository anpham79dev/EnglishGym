import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const root = fileURLToPath(new URL('.', import.meta.url))

// Windows: when the shell's cwd has a lower-case drive letter (d:\, as VS Code opens it),
// the CLI loads Vitest from d:\ while test files resolve `vitest` to D:\. Two module copies
// means every suite fails with "Cannot read properties of undefined (reading 'config')".
// Pin `vitest` to the copy the CLI itself loaded.
const vitestEntry = join(process.cwd(), 'node_modules/vitest/dist/index.js')

export default defineConfig({
    resolve: {
        alias: [
            { find: /^vitest$/, replacement: vitestEntry },
            // Services import shared code through the Nuxt alias.
            { find: '#shared', replacement: `${root}shared` },
        ],
    },
    test: {
        include: ['tests/**/*.test.ts'],
    },
})
