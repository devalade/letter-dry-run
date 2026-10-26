import { PLACEHOLDER, type RenderedLine } from "./template.ts"

// A data difference means the template wording matched and only a field value
// changed, so the fix is in the claim system mapping. A wording difference means
// the carrier's letter says something the template does not, so the fix is in
// the template.
export type Difference =
  | { kind: "data"; field: string; generated: string; sent: string }
  | { kind: "wording"; generated: string[]; sent: string[] }

export type Comparison =
  | { verdict: "match" }
  | { verdict: "cosmetic" }
  | { verdict: "review"; differences: Difference[] }

export function compareLetter(lines: RenderedLine[], sentText: string): Comparison {
  if (exact(lines.map((line) => line.text).join("\n")) === exact(sentText)) return { verdict: "match" }

  const generated = lines
    .map((line) => ({ text: normalize(line.text), source: normalize(line.source) }))
    .filter((line) => line.text !== "")
  const sent = sentText.split("\n").map(normalize).filter((text) => text !== "")

  const hunks = diffHunks(generated.map((line) => line.text), sent)
  if (hunks.length === 0) return { verdict: "cosmetic" }

  const differences = hunks.flatMap(({ removed, added }) => {
    const removedLines = removed.map((index) => generated[index])
    return explainAsData(removedLines, added) ?? [{ kind: "wording" as const, generated: removedLines.map((line) => line.text), sent: added }]
  })
  return { verdict: "review", differences }
}

// Only whitespace and line endings may differ for an exact match.
function exact(text: string): string {
  return text.replace(/[ \t]+$/gm, "").replace(/\n+$/, "")
}

// Differences a reader would not notice: spacing, smart quotes, dash styles.
function normalize(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
}

// A hunk is a data difference when every changed line still fits its template
// line, so only placeholder values moved.
function explainAsData(removed: RenderedLine[], added: string[]): Difference[] | undefined {
  if (removed.length !== added.length) return undefined
  const differences: Difference[] = []
  for (const [index, line] of removed.entries()) {
    const pattern = templatePattern(line.source)
    const generatedValues = line.text.match(pattern.regex)
    const sentValues = added[index].match(pattern.regex)
    if (!generatedValues || !sentValues) return undefined
    for (const [position, field] of pattern.fields.entries()) {
      const generated = generatedValues[position + 1]
      const sent = sentValues[position + 1]
      if (generated !== sent) differences.push({ kind: "data", field, generated, sent })
    }
  }
  return differences
}

function templatePattern(source: string): { regex: RegExp; fields: string[] } {
  const fields: string[] = []
  const parts = source.split(PLACEHOLDER)
  const body = parts
    .map((part, index) => {
      if (index % 2 === 0) return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      fields.push(part)
      return "(.+?)"
    })
    .join("")
  return { regex: new RegExp(`^${body}$`), fields }
}

type Hunk = { removed: number[]; added: string[] }

// Line diff by longest common subsequence. Letters are a few dozen lines.
function diffHunks(a: string[], b: string[]): Hunk[] {
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }

  const hunks: Hunk[] = []
  let current: Hunk = { removed: [], added: [] }
  const close = () => {
    if (current.removed.length > 0 || current.added.length > 0) hunks.push(current)
    current = { removed: [], added: [] }
  }

  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      close()
      i++
      j++
    } else if (j < b.length && (i === a.length || lcs[i][j + 1] >= lcs[i + 1][j])) {
      current.added.push(b[j++])
    } else {
      current.removed.push(i++)
    }
  }
  close()
  return hunks
}
