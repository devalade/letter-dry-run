import type { Carrier, SentLetter } from "./carrier.ts"
import { compareLetter, type Comparison } from "./compare.ts"
import { render } from "./template.ts"

export type LetterResult = SentLetter & (Comparison | { verdict: "blocked"; missingFields: string[] })

// One finding is one fix. Five letters that differ for the same reason are one
// mapping change or one template edit, not five reviews.
export type Finding =
  | { kind: "mapping"; field: string; letters: string[]; examples: { generated: string; sent: string }[] }
  | { kind: "template"; template: string; letters: string[]; generated: string[]; sent: string[] }
  | { kind: "missing-data"; field: string; letters: string[] }

export type DryRun = { carrier: string; letters: LetterResult[]; findings: Finding[] }

export function dryRun(carrier: Carrier): DryRun {
  const letters = carrier.sentLetters.map((letter) => replay(letter, carrier))
  return { carrier: carrier.name, letters, findings: findFixes(letters) }
}

function replay(letter: SentLetter, carrier: Carrier): LetterResult {
  const claim = carrier.claims.get(letter.claimId)!
  const template = carrier.templates.get(letter.template)!
  const rendering = render(template, { ...claim.fields, letter_date: formatLetterDate(letter.date) })
  if (rendering.kind === "missing-fields") return { ...letter, verdict: "blocked", missingFields: rendering.fields }
  return { ...letter, ...compareLetter(rendering.lines, letter.text) }
}

function findFixes(letters: LetterResult[]): Finding[] {
  const findings = new Map<string, Finding>()
  const add = (key: string, create: () => Finding, letter: LetterResult, example?: { generated: string; sent: string }) => {
    const finding = findings.get(key) ?? create()
    findings.set(key, finding)
    if (!finding.letters.includes(letter.file)) finding.letters.push(letter.file)
    if (example && finding.kind === "mapping" && !finding.examples.some((seen) => seen.sent === example.sent && seen.generated === example.generated)) {
      finding.examples.push(example)
    }
  }

  for (const letter of letters) {
    if (letter.verdict === "blocked") {
      for (const field of letter.missingFields) {
        add(`missing:${field}`, () => ({ kind: "missing-data", field, letters: [] }), letter)
      }
    }
    if (letter.verdict !== "review") continue
    for (const difference of letter.differences) {
      if (difference.kind === "data") {
        const { field, generated, sent } = difference
        add(`mapping:${field}`, () => ({ kind: "mapping", field, letters: [], examples: [] }), letter, { generated, sent })
      } else {
        const { generated, sent } = difference
        const key = `template:${letter.template}:${JSON.stringify([generated, sent])}`
        add(key, () => ({ kind: "template", template: letter.template, letters: [], generated, sent }), letter)
      }
    }
  }
  return [...findings.values()].sort((a, b) => b.letters.length - a.letters.length)
}

function formatLetterDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  })
}
