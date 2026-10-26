import assert from "node:assert/strict"
import { test } from "node:test"
import { loadCarrier } from "../src/carrier.ts"
import { compareLetter } from "../src/compare.ts"
import { dryRun } from "../src/dry-run.ts"
import { render } from "../src/template.ts"

test("the example carrier reduces six exceptions to four fixes", () => {
  const run = dryRun(loadCarrier("examples/example-mutual"))

  const verdicts = Object.groupBy(run.letters, (letter) => letter.verdict)
  assert.equal(verdicts.match?.length, 7)
  assert.equal(verdicts.cosmetic?.length, 2)
  assert.equal(verdicts.review?.length, 5)
  assert.equal(verdicts.blocked?.length, 1)

  assert.deepEqual(
    run.findings.map((finding) => [finding.kind, finding.letters.length]),
    [
      ["mapping", 2],
      ["template", 2],
      ["mapping", 1],
      ["missing-data", 1],
    ],
  )
})

test("a changed value is a mapping difference, a changed sentence is a wording difference", () => {
  const template = "Dear {{name}},\nYour deductible is {{deductible}}.\nThank you."
  const rendering = render(template, { name: "Ana", deductible: "$500" })
  assert.equal(rendering.kind, "rendered")
  if (rendering.kind !== "rendered") return

  assert.deepEqual(compareLetter(rendering.lines, "Dear Ana,\nYour deductible is $1,000.\nThank you."), {
    verdict: "review",
    differences: [{ kind: "data", field: "deductible", generated: "$500", sent: "$1,000" }],
  })
  assert.deepEqual(compareLetter(rendering.lines, "Dear Ana,\nYour deductible is $500.\nThanks again."), {
    verdict: "review",
    differences: [{ kind: "wording", generated: ["Thank you."], sent: ["Thanks again."] }],
  })
  assert.deepEqual(compareLetter(rendering.lines, "Dear  Ana,\r\n\r\nYour deductible is $500.\r\nThank you."), {
    verdict: "cosmetic",
  })
})

test("a claim without a field the template needs is blocked, not guessed", () => {
  const rendering = render("Policy: {{policy_number}}", { claim_number: "X-1" })
  assert.deepEqual(rendering, { kind: "missing-fields", fields: ["policy_number"] })
})
