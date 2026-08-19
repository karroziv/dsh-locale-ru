#!/usr/bin/env node
/**
 * Re-apply the dsh-locale-ru seam patches to the installed DSH packages.
 *
 * DSH ships only zh/en and hardcodes several display strings; the Russian pack
 * needs `ru` registered and a handful of host-side strings translated. Every
 * patch is idempotent (skips replacements already in place), so the script is
 * safe to run again after a DSH upgrade.
 *
 * Patched packages:
 *  - @deepseek-ai/dsh-client-locale  — register `ru` in LOCALE_IDS (Host +
 *    browser schema) and LOCALES (selector + browser detection)
 *  - @deepseek-ai/dsh-command-goal / dsh-command-compact / dsh-plan-mode /
 *    dsh-command-feedback / dsh-session-log-export / dsh-permission-presets
 *    — command descriptions (and the /export error text)
 *  - @deepseek-ai/dsh-permission-presets — preset display names/descriptions
 *  - @deepseek-ai/dsh-llm-deepseek — reasoning effort names
 *  - @deepseek-ai/dsh-client-ui-conversation — permission-mode labels in the
 *    composer (displayName mapping + Full access)
 *
 * Usage:
 *   node scripts/patch-core.mjs [<dsh-client-locale-package-dir>]
 *   import { patchCore } from './patch-core.mjs'
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

/** [packageDirName, file, exact-from, exact-to] pairs. */
const REPLACEMENTS = [
  // ── locale core: register `ru` ──────────────────────────────────────────
  ['dsh-client-locale', 'lib/index.js',
    'const LOCALE_IDS = ["zh", "en"];',
    'const LOCALE_IDS = ["zh", "en", "ru"];'],
  ['dsh-client-locale', 'lib/client.js',
    'const LOCALE_IDS = ["zh", "en"];',
    'const LOCALE_IDS = ["zh", "en", "ru"];'],
  ['dsh-client-locale', 'lib/client.js',
    `}, {
\t\t\tid: "en",
\t\t\tlabel: "English"
\t\t}]);`,
    `}, {
\t\t\tid: "en",
\t\t\tlabel: "English"
\t\t}, {
\t\t\tid: "ru",
\t\t\tlabel: "Русский"
\t\t}]);`],

  // ── command descriptions (host) ─────────────────────────────────────────
  ['dsh-command-goal', 'lib/index.js',
    'description: "set or view the goal for a long-running task"',
    'description: "задать или посмотреть цель для длительной задачи"'],
  ['dsh-command-compact', 'lib/index.js',
    'description: "Compact older conversation history"',
    'description: "Сжать более раннюю историю чата"'],
  ['dsh-plan-mode', 'lib/index.js',
    'description: "Enter or leave plan mode"',
    'description: "Включить или выключить режим плана"'],
  ['dsh-command-feedback', 'lib/index.js',
    'description: "record feedback about this session"',
    'description: "оставить отзыв об этом сеансе"'],
  ['dsh-session-log-export', 'lib/index.js',
    'description: "Download this Session log as a ZIP archive"',
    'description: "Скачать журнал этого сеанса ZIP-архивом"'],
  ['dsh-session-log-export', 'lib/index.js',
    'text: "The Web /export command does not accept a path."',
    'text: "Команда /export в веб-интерфейсе не принимает путь."'],
  ['dsh-permission-presets', 'lib/index.js',
    'description: "Switch the permission preset (sandbox mode + approval policy)"',
    'description: "Переключить пресет прав (режим песочницы + политика подтверждений)"'],

  // ── permission preset display names / descriptions ──────────────────────
  ['dsh-permission-presets', 'lib/index.js',
    'name: "workspace-write",\n\t\t\t\tdescription: "Write inside the workspace and permitted temporary directories; wider retries require approval."',
    'name: "Рабочая папка",\n\t\t\t\tdescription: "Запись внутри рабочей папки и разрешённых временных каталогов; более широкие операции требуют подтверждения."'],
  ['dsh-permission-presets', 'lib/index.js',
    'name: "danger-full-access",\n\t\t\t\tdescription: "Full file access without approval prompts."',
    'name: "Полный доступ",\n\t\t\t\tdescription: "Полный доступ к файлам без запросов подтверждения."'],

  // ── reasoning effort names (DeepSeek provider catalog) ──────────────────
  ['dsh-llm-deepseek', 'lib/index.js', 'name: "Off"', 'name: "Выкл."'],
  ['dsh-llm-deepseek', 'lib/index.js', 'name: "Low"', 'name: "Низкий"'],
  ['dsh-llm-deepseek', 'lib/index.js', 'name: "High"', 'name: "Высокий"'],
  ['dsh-llm-deepseek', 'lib/index.js', 'name: "Max"', 'name: "Максимальный"'],

  // ── settings permission-row labels (client bundle) ──────────────────────
  ['dsh-client-ui-permission-presets', 'lib/client.js',
    `function displayPresetName(name) {
\t\t\tif (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) return name;
\t\t\treturn name.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
\t\t}`,
    `function displayPresetName(name) {
\t\t\tconst ruNames = {
\t\t\t\t"workspace-write": "Рабочая папка",
\t\t\t\t"danger-full-access": "Полный доступ",
\t\t\t\t"read-only": "Только чтение"
\t\t\t};
\t\t\tif (ruNames[name] !== void 0) return ruNames[name];
\t\t\tif (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) return name;
\t\t\treturn name.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
\t\t}`],
  ['dsh-client-ui-permission-presets', 'lib/client.js',
    'return value === "danger-full-access" ? "Full access" : displayPresetName(name);',
    'return value === "danger-full-access" ? "Полный доступ" : displayPresetName(name);'],

  // ── composer permission labels (client bundle) ──────────────────────────
  ['dsh-client-ui-conversation', 'lib/client.js',
    `function displayName(name) {
\t\t\tif (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) return name;
\t\t\treturn name.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
\t\t}
\t\tfunction optionLabel(option) {
\t\t\treturn option.value === FULL_ACCESS ? "Full access" : displayName(option.name);
\t\t}`,
    `function displayName(name) {
\t\t\tconst ruNames = {
\t\t\t\t"workspace-write": "Рабочая папка",
\t\t\t\t"danger-full-access": "Полный доступ",
\t\t\t\t"read-only": "Только чтение"
\t\t\t};
\t\t\tif (ruNames[name] !== void 0) return ruNames[name];
\t\t\tif (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) return name;
\t\t\treturn name.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
\t\t}
\t\tfunction optionLabel(option) {
\t\t\treturn option.value === FULL_ACCESS ? "Полный доступ" : displayName(option.name);
\t\t}`],

  // ── session-log export: hardcoded download button label ─────────────────
  ['dsh-session-log-export', 'lib/client.js',
    'children: [(0, react_jsx_runtime.jsx)("span", { children: "Session log" }), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconDownloadOutline16, { size: 12 })]',
    'children: [(0, react_jsx_runtime.jsx)("span", { children: "Журнал сеанса" }), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconDownloadOutline16, { size: 12 })]'],
]

const here = dirname(fileURLToPath(import.meta.url))

/** Candidate `@deepseek-ai` directories containing the installed packages. */
function baseCandidates() {
  const list = []
  const pushBase = (localeDir) => {
    if (localeDir) list.push(dirname(localeDir))
  }
  // 1. Resolvable from this package (hoisted profile node_modules, etc.).
  try {
    const require = createRequire(import.meta.url)
    pushBase(dirname(require.resolve('@deepseek-ai/dsh-client-locale/package.json')))
  } catch { /* keep looking */ }
  // 2. The dsh launcher installation (npx cache / global) that owns this dsh.
  try {
    const require = createRequire(import.meta.url)
    const dshCli = require.resolve('@deepseek-ai/dsh/package.json')
    pushBase(join(dirname(dirname(dshCli)), 'node_modules/@deepseek-ai/dsh-client-locale'))
  } catch { /* keep looking */ }
  // 3. DSH home layouts: profiles/<name>/node_modules and the flat fallback.
  const dshHome = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  pushBase(join(dshHome, 'profiles', 'web', 'node_modules', '@deepseek-ai', 'dsh-client-locale'))
  pushBase(join(dshHome, 'profiles', 'node_modules', '@deepseek-ai', 'dsh-client-locale'))
  // 4. Walk up from this package's own node_modules tree.
  let dir = here
  for (;;) {
    pushBase(join(dir, 'node_modules', '@deepseek-ai', 'dsh-client-locale'))
    const parent = dirname(dir)
    if (parent === dir || dir.endsWith(`${sep}node_modules`)) break
    dir = parent
  }
  return list
}

/**
 * Resolve the `@deepseek-ai` base directory containing the patched packages,
 * or undefined.
 * @param explicit - optional explicit path: either the base dir itself or the
 *   `dsh-client-locale` package dir (dirname is taken in the latter case).
 */
export function resolveBaseDir(explicit) {
  if (explicit) {
    const dir = existsSync(join(explicit, 'dsh-client-locale', 'package.json'))
      ? explicit
      : existsSync(join(explicit, 'package.json')) && existsSync(join(dirname(explicit), 'dsh-client-locale', 'package.json'))
        ? dirname(explicit)
        : undefined
    if (dir) return dir
  }
  for (const c of baseCandidates()) {
    if (existsSync(join(c, 'dsh-client-locale', 'package.json'))) return c
  }
  return undefined
}

/** Backward-compatible alias: resolve the locale package dir. */
export function resolveLocaleDir(explicit) {
  const base = resolveBaseDir(explicit)
  return base ? join(base, 'dsh-client-locale') : undefined
}

/**
 * Apply all seam patches under one `@deepseek-ai` base. Idempotent; throws on
 * a layout that no longer matches the expected patterns.
 * @param base - resolved `@deepseek-ai` directory.
 * @returns number of spots patched (0 = already up to date).
 */
export function patchCore(base) {
  let changed = 0
  for (const [pkg, file, from, to] of REPLACEMENTS) {
    const path = join(base, pkg, file)
    let text = readFileSync(path, 'utf8')
    if (text.includes(to)) continue
    if (!text.includes(from)) {
      throw new Error(`pattern not found in ${pkg}/${file} — DSH layout changed?`)
    }
    text = text.split(from).join(to)
    writeFileSync(path, text)
    console.log(`patched: ${pkg}/${file}`)
    changed++
  }
  return changed
}

// CLI entry
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const base = resolveBaseDir(process.argv[2])
  if (!base) {
    console.error(`cannot locate the @deepseek-ai package directory (got ${process.argv[2] ?? 'auto'})`)
    process.exit(1)
  }
  try {
    const changed = patchCore(base)
    console.log(changed
      ? `dsh-locale-ru seam patches applied (${changed} spot(s)) under ${base}`
      : `dsh-locale-ru seam patches already up to date (${base})`)
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
