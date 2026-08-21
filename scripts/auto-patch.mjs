#!/usr/bin/env node
/**
 * Hook body: apply the dsh-locale-ru seam patches to the `@deepseek-ai`
 * packages of the npm project that is currently being installed (or to an
 * explicit base directory).
 *
 * This is the script referenced from the `postinstall` hook that
 * `ensure-all.mjs` injects into every npx cache project
 * (`~/.npm/_npx/<hash>/package.json`). npm runs a project's own postinstall
 * after (re)installing its dependencies — i.e. exactly between "npm exec
 * installed/updated @deepseek-ai/dsh" and "the dsh server boots" — so every
 * update is patched before the first boot, with no manual step.
 *
 * Usage:
 *   node auto-patch.mjs                # patch <cwd>/node_modules/@deepseek-ai
 *   node auto-patch.mjs <base-dir>     # patch an explicit base dir
 *
 * Fail-soft by design: any error prints a warning and exits 0 so a broken
 * patch can never prevent dsh from starting.
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { patchCore, resolveBaseDir } from "./patch-core.mjs";

/** Apply the patch under one base; never throws. @returns whether a base was handled. */
function tryPatch(base, label) {
  if (!base || !existsSync(join(base, "dsh-client-locale", "package.json"))) return false;
  try {
    const changed = patchCore(base);
    console.log(
      `[dsh-locale-ru] ${label}: ${changed ? `${changed} spot(s) patched` : "already up to date"}`,
    );
  } catch (error) {
    console.warn(`[dsh-locale-ru] ${label}: ${error.message}`);
  }
  return true;
}

const explicit = process.argv[2];
if (explicit) {
  // Accept either the base dir itself or a dsh-client-locale package dir.
  const base = resolveBaseDir(explicit) ?? (existsSync(join(explicit, "package.json")) ? dirname(explicit) : void 0);
  tryPatch(base, `patch ${explicit}`);
} else {
  // npm runs lifecycle scripts with cwd = the project root (the npx cache dir).
  const cwdBase = join(process.cwd(), "node_modules", "@deepseek-ai");
  if (!tryPatch(cwdBase, `patch ${cwdBase}`)) {
    console.warn(
      "[dsh-locale-ru] auto-patch: no @deepseek-ai install under cwd; " +
        "skipping (run ensure-all.mjs to scan every npx cache dir)",
    );
  }
}
process.exit(0);
