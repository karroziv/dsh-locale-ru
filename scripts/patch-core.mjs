#!/usr/bin/env node
/**
 * Re-apply the core locale seam patch to an installed `@deepseek-ai/dsh-client-locale`
 * package. DSH ships only zh/en; the Russian pack needs `ru` registered in three
 * places. Idempotent: skips any replacement already in place, so it is safe to
 * run again after a DSH update.
 *
 * Usage:
 *   node scripts/patch-core.mjs [<dsh-client-locale-package-dir>]
 *   import { patchCore } from './patch-core.mjs'
 *
 * Default dir resolution: `require.resolve('@deepseek-ai/dsh/package.json')`
 * relative to this script, then the DSH home fallback layout, then a walk up
 * the directory tree from this package.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const REPLACEMENTS = [
  // 1. Host-side schema (lib/index.js): accept `preference: 'ru'`.
  {
    file: 'lib/index.js',
    from: 'const LOCALE_IDS = ["zh", "en"];',
    to: 'const LOCALE_IDS = ["zh", "en", "ru"];',
  },
  // 2. Browser-side schema (lib/client.js).
  {
    file: 'lib/client.js',
    from: 'const LOCALE_IDS = ["zh", "en"];',
    to: 'const LOCALE_IDS = ["zh", "en", "ru"];',
  },
  // 3. Selectable locales (lib/client.js): add the Русский entry.
  {
    file: 'lib/client.js',
    from: `}, {
\t\t\tid: "en",
\t\t\tlabel: "English"
\t\t}]);`,
    to: `}, {
\t\t\tid: "en",
\t\t\tlabel: "English"
\t\t}, {
\t\t\tid: "ru",
\t\t\tlabel: "Русский"
\t\t}]);`,
  },
]

const here = dirname(fileURLToPath(import.meta.url))

/** Candidate locations of the installed `@deepseek-ai/dsh-client-locale` package. */
function candidates() {
  const list = []
  // 1. Resolvable from this package (hoisted profile node_modules, etc.).
  try {
    const require = createRequire(import.meta.url)
    list.push(dirname(require.resolve('@deepseek-ai/dsh-client-locale/package.json')))
  } catch {
    /* keep looking */
  }
  // 2. The dsh launcher installation (npx cache / global) that owns this dsh.
  try {
    const require = createRequire(import.meta.url)
    const dshCli = require.resolve('@deepseek-ai/dsh/package.json')
    list.push(join(dirname(dirname(dshCli)), 'node_modules/@deepseek-ai/dsh-client-locale'))
  } catch {
    /* keep looking */
  }
  // 3. DSH home layouts: profiles/<name>/node_modules and the flat fallback.
  const dshHome = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  list.push(join(dshHome, 'profiles', 'web', 'node_modules', '@deepseek-ai', 'dsh-client-locale'))
  list.push(join(dshHome, 'profiles', 'node_modules', '@deepseek-ai', 'dsh-client-locale'))
  // 4. Walk up from this package's own node_modules tree.
  let dir = here
  for (;;) {
    list.push(join(dir, 'node_modules', '@deepseek-ai', 'dsh-client-locale'))
    const parent = dirname(dir)
    if (parent === dir || dir.endsWith(`${sep}node_modules`)) break
    dir = parent
  }
  return list
}

/** Resolve the locale package directory, or undefined. */
export function resolveLocaleDir(explicit) {
  if (explicit && existsSync(join(explicit, 'package.json'))) return explicit
  if (explicit) return undefined
  for (const c of candidates()) {
    if (existsSync(join(c, 'package.json'))) return c
  }
  return undefined
}

/**
 * Apply the seam patch. Idempotent; throws on a layout that no longer matches
 * the expected patterns (so callers can decide how to surface it).
 * @param dir - resolved `@deepseek-ai/dsh-client-locale` package directory.
 * @returns number of spots patched (0 = already up to date).
 */
export function patchCore(dir) {
  let changed = 0
  for (const r of REPLACEMENTS) {
    const path = join(dir, r.file)
    let text = readFileSync(path, 'utf8')
    if (text.includes(r.to)) continue
    if (!text.includes(r.from)) {
      throw new Error(`pattern not found in ${r.file} — DSH layout changed?`)
    }
    text = text.replace(r.from, r.to)
    writeFileSync(path, text)
    console.log(`patched: ${r.file}`)
    changed++
  }
  return changed
}

// CLI entry
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = resolveLocaleDir(process.argv[2])
  if (!dir) {
    console.error(`cannot locate @deepseek-ai/dsh-client-locale (got ${process.argv[2] ?? 'auto'})`)
    process.exit(1)
  }
  try {
    const changed = patchCore(dir)
    console.log(changed
      ? `core locale patch applied (${changed} spot(s)) in ${dir}`
      : `core locale patch already up to date (${dir})`)
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
