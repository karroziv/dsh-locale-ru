#!/usr/bin/env node
/**
 * Scan every DSH installation on this machine and make the Russian language
 * pack self-healing:
 *
 *  1. apply the seam patches to any `@deepseek-ai` tree where they are
 *     missing (idempotent; safe to run at any time);
 *  2. inject a `postinstall` hook into the owning npm project's
 *     package.json (the npx cache dirs under ~/.npm/_npx/<hash>), so that
 *     every future reinstall of that spec — i.e. every dsh update that npm
 *     exec performs into the same cache dir — re-applies the patches
 *     automatically before the server boots.
 *
 * Because the hook is keyed per npx cache project, the flow that stays on a
 * stable spec string (e.g. `npm exec @deepseek-ai/dsh@next web`) needs no
 * manual step ever again: a version bump reinstalls into the same cache dir,
 * npm runs the project postinstall, and the fresh packages are patched
 * before `dsh web` starts.
 *
 * Usage:
 *   node scripts/ensure-all.mjs
 *
 * Fail-soft: errors are printed as warnings, never thrown.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { patchCore } from "./patch-core.mjs";

const here = dirname(fileURLToPath(import.meta.url));
/** Absolute hook command injected into each cache project's postinstall. */
const HOOK_COMMAND = `node ${join(here, "auto-patch.mjs")}`;

/** All `@deepseek-ai` base dirs found on this machine. */
function findBases() {
  const bases = [];
  const push = (base, ownerDir) => {
    if (existsSync(join(base, "dsh-client-locale", "package.json"))) {
      bases.push({ base, ownerDir });
    }
  };
  // 1. npx cache projects: ~/.npm/_npx/<hash>/node_modules/@deepseek-ai
  const npxRoot = join(homedir(), ".npm", "_npx");
  if (existsSync(npxRoot)) {
    for (const entry of readdirSync(npxRoot)) {
      push(join(npxRoot, entry, "node_modules", "@deepseek-ai"), join(npxRoot, entry));
    }
  }
  // 2. DSH profile workspaces that may host their own @deepseek-ai tree.
  const dshHome = process.env.DSH_HOME ?? join(homedir(), ".dsh");
  for (const profile of ["web", "tui", "headless"]) {
    push(join(dshHome, "profiles", profile, "node_modules", "@deepseek-ai"), join(dshHome, "profiles", profile));
  }
  push(join(dshHome, "profiles", "node_modules", "@deepseek-ai"), join(dshHome, "profiles"));
  return bases;
}

/** Inject (or refresh) the postinstall hook into an npm project's package.json. */
function ensureHook(ownerDir) {
  const pkgPath = join(ownerDir, "package.json");
  if (!existsSync(pkgPath)) {
    console.warn(`[dsh-locale-ru] no package.json in ${ownerDir}, hook skipped`);
    return;
  }
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  } catch (error) {
    console.warn(`[dsh-locale-ru] cannot read ${pkgPath}: ${error.message}`);
    return;
  }
  pkg.scripts ??= {};
  if (pkg.scripts.postinstall === HOOK_COMMAND) return;
  pkg.scripts.postinstall = HOOK_COMMAND;
  try {
    writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
    console.log(`[dsh-locale-ru] postinstall hook installed: ${pkgPath}`);
  } catch (error) {
    console.warn(`[dsh-locale-ru] cannot write ${pkgPath}: ${error.message}`);
  }
}

const bases = findBases();
if (bases.length === 0) {
  console.warn("[dsh-locale-ru] no @deepseek-ai install found; nothing to do");
  process.exit(0);
}

let patched = 0;
let hooked = 0;
for (const { base, ownerDir } of bases) {
  try {
    const changed = patchCore(base);
    if (changed) {
      console.log(`[dsh-locale-ru] patched ${changed} spot(s) under ${base}`);
      patched += changed;
    }
  } catch (error) {
    console.warn(`[dsh-locale-ru] ${base}: ${error.message}`);
  }
  ensureHook(ownerDir);
  hooked++;
}

console.log(
  `[dsh-locale-ru] ensure-all done: ${bases.length} install(s) checked, ${patched} new patch spot(s), ` +
    `postinstall hook ensured in ${hooked} project(s)`,
);
process.exit(0);
