// Templates are plain text with {{field}} placeholders and single-level
// {{#if field = value}} ... {{/if}} blocks, the shape most state-specific
// claims language takes.

export type RenderedLine = { text: string; source: string }

export type Rendering =
  | { kind: "rendered"; lines: RenderedLine[] }
  | { kind: "missing-fields"; fields: string[] }

export const PLACEHOLDER = /\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/g
const IF_OPEN = /^\{\{#if\s+([a-z_][a-z0-9_]*)\s*=\s*(.+?)\s*\}\}$/
const IF_CLOSE = /^\{\{\/if\}\}$/

export function render(template: string, fields: Record<string, string>): Rendering {
  const missing = new Set<string>()
  const lookup = (field: string) => {
    if (fields[field] === undefined) missing.add(field)
    return fields[field] ?? ""
  }

  const lines = selectLines(template, lookup).map((source) => ({
    source,
    text: source.replace(PLACEHOLDER, (_, field: string) => lookup(field)),
  }))

  if (missing.size > 0) return { kind: "missing-fields", fields: [...missing] }
  return { kind: "rendered", lines }
}

function selectLines(template: string, lookup: (field: string) => string): string[] {
  const kept: string[] = []
  let included = true
  for (const line of template.split("\n")) {
    const open = line.trim().match(IF_OPEN)
    if (open) {
      included = lookup(open[1]) === open[2]
      continue
    }
    if (IF_CLOSE.test(line.trim())) {
      included = true
      continue
    }
    if (included) kept.push(line)
  }
  return kept
}
