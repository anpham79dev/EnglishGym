/**
 * RFC 4180-style CSV parser: quoted cells may contain commas, quotes ("") and newlines.
 * Topic prompts often contain commas, so splitting on "," is not enough.
 */
export const parseCsv = (input: string): string[][] => {
    const text = input.replace(/^﻿/, '')
    const rows: string[][] = []
    let row: string[] = []
    let cell = ''
    let quoted = false
    for (let i = 0; i < text.length; i++) {
        const ch = text[i]!
        if (quoted) {
            if (ch === '"' && text[i + 1] === '"') {
                cell += '"'
                i++
            } else if (ch === '"') quoted = false
            else cell += ch
            continue
        }
        if (ch === '"') quoted = true
        else if (ch === ',') {
            row.push(cell)
            cell = ''
        } else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && text[i + 1] === '\n') i++
            row.push(cell)
            rows.push(row)
            row = []
            cell = ''
        } else cell += ch
    }
    if (cell || row.length) {
        row.push(cell)
        rows.push(row)
    }
    return rows.filter((r) => r.some((c) => c.trim()))
}

/** CSV with a header row to objects keyed by lower-cased header names. */
export const csvToObjects = (input: string): Record<string, string>[] => {
    const [header, ...rows] = parseCsv(input)
    if (!header) return []
    const keys = header.map((h) => h.trim().toLowerCase())
    return rows.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])))
}
