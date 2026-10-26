import type { Difference } from "./compare.ts"
import type { DryRun, Finding, LetterResult } from "./dry-run.ts"

export function summarize(run: DryRun) {
  const count = (verdict: LetterResult["verdict"]) => run.letters.filter((letter) => letter.verdict === verdict).length
  return {
    total: run.letters.length,
    cleared: count("match") + count("cosmetic"),
    review: count("review"),
    blocked: count("blocked"),
    fixes: run.findings.length,
  }
}

export function renderReport(run: DryRun): string {
  const summary = summarize(run)
  const needsPerson = run.letters.filter((letter) => letter.verdict === "review" || letter.verdict === "blocked")
  const cleared = run.letters.filter((letter) => letter.verdict === "match" || letter.verdict === "cosmetic")

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Letter dry run · ${escape(run.carrier)}</title>
<style>${STYLE}</style>
</head>
<body>
<main>
  <p class="eyebrow">Letter dry run · ${escape(run.carrier)}</p>
  <h1>${summary.total} sent letters replayed. ${summary.cleared} cleared without a person.</h1>
  <p class="lede">The other ${summary.review + summary.blocked} come down to <strong>${summary.fixes} fixes</strong>.
  Compliance reviews the fixes, not the letters.</p>

  <div class="bar" role="img" aria-label="${summary.cleared} cleared, ${summary.review} need review, ${summary.blocked} blocked">
    ${segment("cleared", summary.cleared, summary.total)}
    ${segment("review", summary.review, summary.total)}
    ${segment("blocked", summary.blocked, summary.total)}
  </div>
  <ul class="legend">
    <li><i class="cleared"></i>${summary.cleared} cleared</li>
    <li><i class="review"></i>${summary.review} need review</li>
    <li><i class="blocked"></i>${summary.blocked} blocked by missing data</li>
  </ul>

  <h2>Fixes, largest first</h2>
  ${run.findings.map(renderFinding).join("\n")}

  <h2>Letters that need a person</h2>
  ${needsPerson.map(renderLetter).join("\n")}

  <details>
    <summary>${cleared.length} cleared letters</summary>
    <ul class="cleared-list">
      ${cleared.map((letter) => `<li><code>${escape(letter.file)}</code> <span>${letter.verdict === "match" ? "identical" : "spacing or line endings only"}</span></li>`).join("\n")}
    </ul>
  </details>
</main>
</body>
</html>
`
}

function renderFinding(finding: Finding): string {
  const letters = `${finding.letters.length} letter${finding.letters.length === 1 ? "" : "s"}`
  if (finding.kind === "mapping") {
    return `<article class="fix">
    <header><span class="tag">Claim system mapping</span><code>${escape(finding.field)}</code><span class="count">${letters}</span></header>
    <p>The template wording matched and only the value differs, so the fix is in where this field comes from, not in the template.</p>
    ${finding.examples.map((example) => valueChange(example.generated, example.sent)).join("")}
  </article>`
  }
  if (finding.kind === "template") {
    return `<article class="fix">
    <header><span class="tag">Template wording</span><code>${escape(finding.template)}</code><span class="count">${letters}</span></header>
    <p>The carrier's letters say something the template does not. One template edit covers all of them.</p>
    ${lineDiff(finding.generated, finding.sent)}
  </article>`
  }
  return `<article class="fix">
    <header><span class="tag">Missing data</span><code>${escape(finding.field)}</code><span class="count">${letters}</span></header>
    <p>The claim record has no value for this field, so the letter cannot be generated at all.</p>
  </article>`
}

function renderLetter(letter: LetterResult): string {
  const body =
    letter.verdict === "blocked"
      ? `<p>Missing: ${letter.missingFields.map((field) => `<code>${escape(field)}</code>`).join(", ")}</p>`
      : letter.verdict === "review"
        ? letter.differences.map(renderDifference).join("")
        : ""
  return `<article class="letter">
    <header><code>${escape(letter.file)}</code><span class="verdict ${letter.verdict}">${letter.verdict}</span></header>
    ${body}
  </article>`
}

function renderDifference(difference: Difference): string {
  if (difference.kind === "data") {
    return `<p class="field"><code>${escape(difference.field)}</code></p>${valueChange(difference.generated, difference.sent)}`
  }
  return lineDiff(difference.generated, difference.sent)
}

function valueChange(generated: string, sent: string): string {
  return `<dl class="values"><dt>Generated</dt><dd>${escape(generated)}</dd><dt>Carrier sent</dt><dd>${escape(sent)}</dd></dl>`
}

function lineDiff(generated: string[], sent: string[]): string {
  const lines = [
    ...generated.map((line) => `<li class="del"><span>Generated</span>${escape(line)}</li>`),
    ...sent.map((line) => `<li class="add"><span>Carrier sent</span>${escape(line)}</li>`),
  ]
  return `<ul class="diff">${lines.join("")}</ul>`
}

function segment(kind: string, value: number, total: number): string {
  if (value === 0) return ""
  return `<span class="${kind}" style="flex-grow:${value / total}"></span>`
}

function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

const STYLE = `
:root {
  --bg: #fbfaf7; --surface: #ffffff; --ink: #1c1b19; --muted: #6b6760; --line: #e4e0d8;
  --accent: #1f5f4a; --cleared: #1f5f4a; --review: #c27c0e; --blocked: #a33a2c;
  --del-bg: #fbecea; --add-bg: #e8f3ee;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #151513; --surface: #1d1d1a; --ink: #ecebe6; --muted: #9d998f; --line: #34332e;
    --accent: #6cc3a2; --cleared: #4fa385; --review: #d9a03f; --blocked: #d86a5b;
    --del-bg: #3a2220; --add-bg: #1d3329;
  }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink);
  font: 15px/1.55 ui-sans-serif, -apple-system, "Segoe UI", sans-serif; }
main { max-width: 760px; margin: 0 auto; padding: 48px 16px 80px; }
.eyebrow { color: var(--muted); font-size: 13px; letter-spacing: .04em; text-transform: uppercase; margin: 0 0 8px; }
h1 { font-family: ui-serif, Georgia, serif; font-weight: 500; font-size: clamp(26px, 5vw, 36px); line-height: 1.15; margin: 0 0 12px; }
.lede { font-size: 17px; color: var(--muted); margin: 0 0 28px; }
.lede strong { color: var(--ink); }
h2 { font-size: 13px; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); margin: 44px 0 12px; }
.bar { display: flex; gap: 3px; height: 14px; }
.bar span { border-radius: 3px; }
.cleared { background: var(--cleared); } .review { background: var(--review); } .blocked { background: var(--blocked); }
.legend { display: flex; flex-wrap: wrap; gap: 6px 20px; list-style: none; padding: 0; margin: 10px 0 0; color: var(--muted); font-size: 13px; }
.legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 6px; }
article { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 16px; margin: 0 0 12px; }
article header { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; }
article p { margin: 8px 0; color: var(--muted); }
.tag { font-weight: 600; }
.count { margin-left: auto; color: var(--muted); font-size: 13px; }
code { font: 13px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; overflow-wrap: anywhere; }
.values { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; margin: 8px 0 0; font-size: 14px; }
.values dt { color: var(--muted); }
.values dd { margin: 0; font-family: ui-monospace, Menlo, monospace; }
.diff { list-style: none; padding: 0; margin: 10px 0 0; font-size: 14px; }
.diff li { padding: 6px 10px; border-radius: 4px; margin-bottom: 4px; }
.diff li span { display: block; font-size: 11px; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); }
.diff .del { background: var(--del-bg); } .diff .add { background: var(--add-bg); }
.field { margin-top: 12px; }
.verdict { margin-left: auto; font-size: 12px; padding: 2px 8px; border-radius: 99px; color: var(--bg); }
.verdict.review { background: var(--review); } .verdict.blocked { background: var(--blocked); }
details { margin-top: 32px; }
summary { cursor: pointer; color: var(--muted); }
.cleared-list { padding-left: 18px; }
.cleared-list span { color: var(--muted); font-size: 13px; }
`
