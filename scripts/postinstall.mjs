#!/usr/bin/env node
/**
 * npm postinstall: apply the core locale seam patch automatically so the pack
 * works out of the box after `npm i dsh-locale-ru`.
 *
 * Deliberately never fails the install: if the DSH core package is not found
 * (e.g. installed outside a dsh profile) or its layout changed, print a clear
 * warning with the manual command instead. Patching is idempotent.
 */
import { resolveLocaleDir, patchCore } from './patch-core.mjs'

const dir = resolveLocaleDir()
if (!dir) {
  console.warn(
    '[dsh-locale-ru] could not locate @deepseek-ai/dsh-client-locale, so the ' +
    'Russian language cannot be selected yet. If you are inside a dsh web ' +
    'profile, reinstall after dsh is set up, or run: ' +
    'node node_modules/dsh-locale-ru/scripts/patch-core.mjs',
  )
  process.exit(0)
}
try {
  const changed = patchCore(dir)
  if (changed) {
    console.log(`[dsh-locale-ru] core locale patch applied (${changed} spot(s)) in ${dir}`)
  } else {
    console.log('[dsh-locale-ru] core locale patch already up to date')
  }
} catch (error) {
  console.warn(`[dsh-locale-ru] ${error.message} — run 'node node_modules/dsh-locale-ru/scripts/patch-core.mjs' to retry`)
}
process.exit(0)
