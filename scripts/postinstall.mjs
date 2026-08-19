#!/usr/bin/env node
/**
 * npm postinstall: apply the dsh-locale-ru seam patches automatically so the
 * pack works out of the box after install (locale core, command descriptions,
 * permission presets, effort names, composer labels).
 *
 * Deliberately never fails the install: if the DSH packages are not found
 * (e.g. installed outside a dsh profile) or their layout changed, print a
 * clear warning with the manual command instead. Patching is idempotent.
 */
import { resolveBaseDir, patchCore } from './patch-core.mjs'

const base = resolveBaseDir()
if (!base) {
  console.warn(
    '[dsh-locale-ru] could not locate the installed @deepseek-ai packages, so ' +
    'the Russian language cannot be enabled yet. If you are inside a dsh web ' +
    'profile, reinstall after dsh is set up, or run: ' +
    'node node_modules/dsh-locale-ru/scripts/patch-core.mjs',
  )
  process.exit(0)
}
try {
  const changed = patchCore(base)
  if (changed) {
    console.log(`[dsh-locale-ru] seam patches applied (${changed} spot(s)) under ${base}`)
  } else {
    console.log('[dsh-locale-ru] seam patches already up to date')
  }
} catch (error) {
  console.warn(`[dsh-locale-ru] ${error.message} — run 'node node_modules/dsh-locale-ru/scripts/patch-core.mjs' to retry`)
}
process.exit(0)
