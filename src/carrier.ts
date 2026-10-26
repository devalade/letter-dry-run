import { readdirSync, readFileSync } from "node:fs"
import { basename, join } from "node:path"

export type Claim = { id: string; fields: Record<string, string> }

export type SentLetter = {
  file: string
  claimId: string
  template: string
  date: string
  text: string
}

export type Carrier = {
  name: string
  claims: Map<string, Claim>
  templates: Map<string, string>
  sentLetters: SentLetter[]
}

// sent/<claim>--<template>--<YYYY-MM-DD>.txt, one file per letter the carrier actually mailed
const SENT_FILE = /^(.+)--([a-z0-9-]+)--(\d{4}-\d{2}-\d{2})\.txt$/

export function loadCarrier(dir: string): Carrier {
  const claims = parseClaims(JSON.parse(readFileSync(join(dir, "claims.json"), "utf8")))
  const templates = new Map(
    textFiles(join(dir, "templates")).map((file) => [basename(file, ".txt"), readFileSync(file, "utf8")]),
  )
  const sentLetters = textFiles(join(dir, "sent")).map((file) => parseSentLetter(file, claims, templates))
  return { name: basename(dir), claims, templates, sentLetters }
}

function parseClaims(json: unknown): Map<string, Claim> {
  if (!Array.isArray(json)) throw new Error("claims.json must be an array of claims")
  const claims = json.map((record: Record<string, unknown>) => {
    const fields = Object.fromEntries(Object.entries(record).map(([key, value]) => [key, String(value)]))
    if (!fields.claim_number) throw new Error(`claim without claim_number: ${JSON.stringify(record)}`)
    return { id: fields.claim_number, fields }
  })
  return new Map(claims.map((claim) => [claim.id, claim]))
}

function parseSentLetter(file: string, claims: Map<string, Claim>, templates: Map<string, string>): SentLetter {
  const match = basename(file).match(SENT_FILE)
  if (!match) throw new Error(`sent letter must be named <claim>--<template>--<date>.txt: ${file}`)
  const [, claimId, template, date] = match
  if (!claims.has(claimId)) throw new Error(`${file}: unknown claim ${claimId}`)
  if (!templates.has(template)) throw new Error(`${file}: unknown template ${template}`)
  return { file: basename(file), claimId, template, date, text: readFileSync(file, "utf8") }
}

function textFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".txt"))
    .sort()
    .map((name) => join(dir, name))
}
