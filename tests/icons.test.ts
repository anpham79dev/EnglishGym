import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import lucide from '@iconify-json/lucide/icons.json' with { type: 'json' }

const appDir = fileURLToPath(new URL('../app', import.meta.url))
const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
    )
const sources = walk(appDir).filter((f) => /\.(vue|ts)$/.test(f))

describe('icon', () => {
    it('mọi tên i-lucide-* trong app/ đều có trong bộ Lucide', () => {
        const known = new Set([...Object.keys(lucide.icons), ...Object.keys(lucide.aliases ?? {})])
        const missing = new Set<string>()
        for (const file of sources)
            for (const m of readFileSync(file, 'utf8').matchAll(/i-lucide-([a-z0-9-]+)/g))
                if (!known.has(m[1]!)) missing.add(`${m[1]} (${file})`)
        expect([...missing]).toEqual([])
    })

    it('không dùng emoji hay ký tự làm icon', () => {
        const symbols = /[←-⇿⌀-⏿■-➿⋯⭐]|[\uD83C-\uD83E][\uDC00-\uDFFF]/
        const hits = sources.flatMap((f) =>
            readFileSync(f, 'utf8')
                .split('\n')
                .filter((l) => symbols.test(l))
                .map((l) => `${f}: ${l.trim()}`),
        )
        expect(hits).toEqual([])
    })
})
