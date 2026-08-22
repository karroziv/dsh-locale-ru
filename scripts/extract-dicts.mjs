#!/usr/bin/env node
/**
 * Extract the zh/en locale dictionaries from the DSH source checkout and
 * write them as JSON for the Russian language pack.
 *
 * Usage: node scripts/extract-dicts.mjs <repo> <out-dir>
 *   <repo>    path to the deepseek-harness source checkout
 *   <out-dir> directory receiving en-dicts.json / zh-dicts.json
 *
 * Output shape: { "<namespace>": { "<key>": "<string>", ... }, ... }
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { globSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

const repo = process.argv[2]
const outDir = process.argv[3]
if (!repo || !outDir) {
  console.error('usage: node scripts/extract-dicts.mjs <repo> <out-dir>')
  process.exit(1)
}

/** Parse a `{ 'key': 'value', bareKey: 'value', key: CONST_REF, multiLine: ... }` block starting at `start`. */
function parseDictBlock(lines, start) {
  const dict = {}
  for (const ln of lines.slice(start + 1)) {
    if (ln.trim().startsWith('}')) break
    let m = ln.match(/\s*'([^']+)':\s*'((?:[^'\\]|\\.)*)'/)
    if (!m) m = ln.match(/\s*([A-Za-z0-9_.]+):\s*'((?:[^'\\]|\\.)*)'/)
    if (!m) {
      // Reference values (e.g. `welcomeTitle: WELCOME_NOTICE_COPY.en.title,`)
      // and multi-line strings (`sectionIntro:` followed by `'...' + '...'`):
      // keep the key so coverage verification sees it, mark the source.
      m = ln.match(/\s*'?([A-Za-z0-9_.]+)'?:\s*([A-Za-z_][A-Za-z0-9_.]*),?\s*$/) ?? (ln.trim().endsWith(':') ? ln.match(/\s*'?([A-Za-z0-9_.]+)'?:\s*$/) : null)
    }
    if (m) dict[m[1]] = m[2] ? m[2].replace(/\\'/g, "'").replace(/\\\\/g, '\\') : 'REF'
  }
  return dict
}

/** Locate `export const <var> ... = {` and parse its block. */
function parseVar(lines, varName) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(new RegExp(`export const ${varName}\\b`)) && lines[i].includes('{')) {
      return parseDictBlock(lines, i)
    }
  }
  return {}
}

/** Namespace hint per package (locales.ts files do not always declare `NS`). */
const PKG_NS = {
  'ui-commands': 'command', 'ui-conversation': 'conversation', 'ui-deliverables': 'deliverables',
  'ui-goal': 'goal', 'ui-input-trigger': 'slash.menu', 'ui-jobs': 'job', 'ui-message-feedback': 'feedback',
  'ui-model-selection': 'model', 'ui-permission-presets': 'settings.permission', 'ui-plan': 'plan',
  'ui-settings-general': 'settings', 'ui-settings-models': 'settings.models',
  'ui-settings-plugin-inventory': 'settings.pluginInventory', 'ui-settings-plugins': 'settings.plugins',
  'ui-sidebar': 'sidebar', 'ui-skill': 'skill', 'ui-subagent': 'subagent', 'ui-theme': 'settings.theme',
  'ui-trajectory': 'trajectory', 'ui-user-questions': 'question', 'ui-workflow-run': 'workflowRun',
  'ui-workspace': 'workspace', 'ui-agent-preset': 'settings.agentPreset',
}

const out = {} // ns -> { zh: {}, en: {} }

// Client packages outside packages/client/ (session export, cordis panel, …)
// also own locale namespaces; scan them with the same parsing path.
const LOCALES_GLOBS = [
  join(repo, 'packages/client/*/src/client/locales.ts'),
  join(repo, 'packages/session-query/*/src/client/locales.ts'),
  join(repo, 'packages/extensions/*/src/client/locales.ts'),
]

for (const f of LOCALES_GLOBS.flatMap((g) => globSync(g)).sort()) {
  const pkg = basename(dirname(dirname(dirname(f))))
  const lines = readFileSync(f, 'utf8').split('\n')
  const zh = parseVar(lines, 'zh')
  const en = parseVar(lines, 'en')
  let ns = PKG_NS[pkg]
  if (!ns) {
    const m = readFileSync(f, 'utf8').match(/`([^`]+)` namespace/)
    if (m) ns = m[1]
  }
  if (!ns) {
    const m = readFileSync(f, 'utf8').match(/export const NS = '([^']+)'/)
    if (m) ns = m[1]
  }
  if (!ns) ns = pkg
  out[ns] ??= { zh: {}, en: {} }
  Object.assign(out[ns].zh, zh)
  Object.assign(out[ns].en, en)
  // ui-permission-presets additionally owns the `permission.access` gate dicts
  // (accessZh / accessEn live in the same file).
  if (pkg === 'ui-permission-presets') {
    out['permission.access'] ??= { zh: {}, en: {} }
    Object.assign(out['permission.access'].zh, parseVar(lines, 'accessZh'))
    Object.assign(out['permission.access'].en, parseVar(lines, 'accessEn'))
  }
}

// common namespace: locale/src/locales/{zh,en}.ts
for (const tag of ['zh', 'en']) {
  const f = join(repo, `packages/client/locale/src/locales/${tag}.ts`)
  const lines = readFileSync(f, 'utf8').split('\n')
  out['common'] ??= { zh: {}, en: {} }
  Object.assign(out['common'][tag], parseVar(lines, tag))
}

// settings.locale: locale/src/locales/settings.ts
{
  const f = join(repo, 'packages/client/locale/src/locales/settings.ts')
  const lines = readFileSync(f, 'utf8').split('\n')
  out['settings.locale'] = { zh: parseVar(lines, 'zh'), en: parseVar(lines, 'en') }
}

// directory-browser: inline `['zh', { ... }]` arrays in ui-directory-picker-browse/src/client/index.ts
{
  const f = join(repo, 'packages/client/ui-directory-picker-browse/src/client/index.ts')
  const lines = readFileSync(f, 'utf8').split('\n')
  out['directory-browser'] ??= { zh: {}, en: {} }
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/\s*\['(zh|en)', \{/)
    if (m) Object.assign(out['directory-browser'][m[1]], parseDictBlock(lines, i))
  }
}

mkdirSync(outDir, { recursive: true })
const enOut = {}, zhOut = {}
for (const [ns, d] of Object.entries(out)) {
  enOut[ns] = d.en
  zhOut[ns] = d.zh
}
writeFileSync(join(outDir, 'en-dicts.json'), JSON.stringify(enOut, null, 2) + '\n')
writeFileSync(join(outDir, 'zh-dicts.json'), JSON.stringify(zhOut, null, 2) + '\n')

let total = 0
for (const [ns, d] of Object.entries(out)) {
  total += Object.keys(d.en).length
  if (Object.keys(d.en).length !== Object.keys(d.zh).length) {
    const onlyZh = Object.keys(d.zh).filter((k) => !(k in d.en))
    const onlyEn = Object.keys(d.en).filter((k) => !(k in d.zh))
    console.warn(`  [mismatch] ${ns}: en=${Object.keys(d.en).length} zh=${Object.keys(d.zh).length}` +
      (onlyZh.length ? ` zh-only=${onlyZh.join(',')}` : '') +
      (onlyEn.length ? ` en-only=${onlyEn.join(',')}` : ''))
  }
}
console.log(`wrote ${Object.keys(out).length} namespaces, ${total} en keys -> ${outDir}`)
