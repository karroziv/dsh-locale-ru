#!/usr/bin/env node
/**
 * Verify the Russian dictionaries against the extracted English key sets:
 * every en key must have a ru translation in the same namespace, and every
 * {placeholder} used in the en string must appear in the ru string (and the
 * other way around). Extra ru keys are reported as info (zh-only keys that
 * the en dictionary lacks).
 *
 * Usage: node scripts/verify-dicts.mjs <repo>
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const repo = process.argv[2] ?? '/home/karr/deepseek-harness'

// 1. Re-extract the en/zh dictionaries from the repo (single source of truth).
const genDir = join(root, 'scripts/generated')
spawnSync(process.execPath, [join(root, 'scripts/extract-dicts.mjs'), repo, genDir], { stdio: 'inherit' })

const en = JSON.parse(readFileSync(join(genDir, 'en-dicts.json'), 'utf8'))
const ru = JSON.parse(readFileSync(join(genDir, 'ru-dicts.json'), 'utf8'))

let problems = 0
let extras = 0
for (const [ns, dict] of Object.entries(en)) {
  const r = ru[ns] ?? {}
  for (const key of Object.keys(dict)) {
    if (!(key in r)) {
      console.error(`MISSING ${ns}.${key}`)
      problems++
      continue
    }
    const phEn = [...dict[key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
    const phRu = [...r[key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
    if (phEn.join() !== phRu.join()) {
      console.error(`PLACEHOLDER MISMATCH ${ns}.${key}: en=${dict[key]} ru=${r[key]}`)
      problems++
    }
  }
  for (const key of Object.keys(r)) {
    if (!(key in dict)) {
      console.info(`extra ru key ${ns}.${key} (not in en)`)
      extras++
    }
  }
}
const total = Object.values(en).reduce((n, d) => n + Object.keys(d).length, 0)
if (problems) {
  console.error(`\nFAIL: ${problems} problem(s) across ${total} en keys`)
  process.exit(1)
}
console.log(`OK: all ${total} en keys covered (${extras} intentional extra ru keys), placeholders match`)
