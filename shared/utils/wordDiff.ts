export interface DiffPart {
    type: 'same' | 'add' | 'del'
    text: string
}

/**
 * Word-level diff of two versions (N10), LCS based. Whitespace is kept with the word before
 * it so the output reads naturally. Inputs are short (one attempt), so O(n·m) is fine.
 */
export const wordDiff = (a: string, b: string): DiffPart[] => {
    const split = (s: string) => s.match(/\S+\s*/g) ?? []
    const x = split(a)
    const y = split(b)
    const key = (w: string) => w.trim()
    const n = x.length
    const m = y.length
    const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
    for (let i = n - 1; i >= 0; i--)
        for (let j = m - 1; j >= 0; j--)
            lcs[i]![j] =
                key(x[i]!) === key(y[j]!)
                    ? lcs[i + 1]![j + 1]! + 1
                    : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!)

    const parts: DiffPart[] = []
    const push = (type: DiffPart['type'], text: string) => {
        const last = parts.at(-1)
        if (last?.type === type) last.text += text
        else parts.push({ type, text })
    }
    let i = 0
    let j = 0
    while (i < n && j < m) {
        if (key(x[i]!) === key(y[j]!)) {
            push('same', y[j]!)
            i++
            j++
        } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) push('del', x[i++]!)
        else push('add', y[j++]!)
    }
    while (i < n) push('del', x[i++]!)
    while (j < m) push('add', y[j++]!)
    return parts
}
