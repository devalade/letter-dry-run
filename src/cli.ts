#!/usr/bin/env node
import { writeFileSync } from "node:fs"
import { loadCarrier } from "./carrier.ts"
import { dryRun } from "./dry-run.ts"
import { renderReport, summarize } from "./report.ts"

const [carrierDir, out = "dry-run-report.html"] = process.argv.slice(2)
if (!carrierDir) {
  console.error("usage: node src/cli.ts <carrier-dir> [report.html]")
  process.exit(1)
}

const run = dryRun(loadCarrier(carrierDir))
writeFileSync(out, renderReport(run))

const summary = summarize(run)
console.log(`${summary.total} letters replayed for ${run.carrier}`)
console.log(`  ${summary.cleared} cleared, ${summary.review} need review, ${summary.blocked} blocked`)
console.log(`  ${summary.fixes} fixes cover every letter that needs a person`)
console.log(`Report: ${out}`)
