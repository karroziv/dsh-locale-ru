#!/usr/bin/env node
/**
 * Build the plugin's client bundle (`lib/client.js`) from the merged Russian
 * dictionaries (`scripts/generated/ru-dicts.json`).
 *
 * The bundle is a factory-form CJS module registered on
 * `window.__ModuleLoader__`, exactly like the shipped `@deepseek-ai/*`
 * client halves: executing the script only registers the factory; the body
 * (dictionary registration) runs at materialization time.
 *
 * Usage: node scripts/build-bundle.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dicts = JSON.parse(readFileSync(join(root, 'scripts/generated/ru-dicts.json'), 'utf8'))
// The factory id must equal the package name: the loader entry name IS the
// package name, and the browser resolves the bundle by that same id.
const pkgName = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).name

/** Emit a JS object literal for one dictionary (keys sorted for readability). */
function dictLiteral(dict) {
  const entries = Object.entries(dict)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `\t\t\t${JSON.stringify(k)}: ${JSON.stringify(v)}`)
  return `{\n${entries.join(',\n')}\n\t\t}`
}

const namespaces = Object.keys(dicts).sort()
const totalKeys = namespaces.reduce((n, ns) => n + Object.keys(dicts[ns]).length, 0)

const bundle = `/**
 * Russian language pack for the DSH web interface.
 * Registered as the \`ru\` locale for every UI namespace.
 * Bundle id: ${pkgName} (see package.json "dsh.client").
 */
window.__ModuleLoader__.load({
\tid: ${JSON.stringify(pkgName)},
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

\t\t//#region dictionaries
\t\t/** Russian dictionaries per namespace (${namespaces.length} namespaces, ${totalKeys} keys). */
\t\tconst DICTIONARIES = {
${namespaces.map((ns) => `\t\t\t${JSON.stringify(ns)}: ${dictLiteral(dicts[ns])}`).join(',\n')}
\t\t};
\t\t//#endregion

\t\t/** Required service: the locale registry (provides \`ctx.locale\`). */
\t\tconst inject = ["locale"];

\t\t/**
\t\t * Register every Russian dictionary. Runs after the locale plugin
\t\t * activates (inject edge); the untyped single-locale form
\t\t * \`register(ns, "ru", dict)\` is used because \`ru\` is not a shipped
\t\t * LocaleId. Missing keys fall back through the standard chain
\t\t * (ns.zh → common.ru → common.zh → the key itself).
\t\t * @param ctx - client cordis context.
\t\t */
\t\tfunction apply(ctx) {
\t\t\tctx.effect(() => {
\t\t\t\tconst disposers = [];
\t\t\t\tfor (const [ns, dict] of Object.entries(DICTIONARIES)) {
\t\t\t\t\tdisposers.push(ctx.locale.register(ns, "ru", dict));
\t\t\t\t}
\t\t\t\treturn () => { for (const dispose of disposers) dispose(); };
\t\t\t}, "dsh-locale-ru: dictionaries");
\t\t}

\t\texports.apply = apply;
\t\texports.inject = inject;
\t\treturn module.exports;
\t}
});
`

writeFileSync(join(root, 'lib/client.js'), bundle)
console.log(`wrote lib/client.js (${namespaces.length} namespaces, ${totalKeys} keys)`)
