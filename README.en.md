# dsh-locale-ru — Russian language pack for the DSH web interface

[Русский](README.md) · English

A client-bundle plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
that localizes the `dsh web` interface into Russian: complete `ru` dictionaries
for every UI namespace (~650 strings), registered via
`ctx.locale.register(ns, 'ru', dict)`.

Once installed, the interface gains **Settings → Language → Русский**; if your
browser language is Russian, the interface switches to Russian automatically.

## Installation

> Prerequisite: you already run `dsh web` (the `web` profile).
>
> The package is installed **directly from GitHub** (no npm registry involved).

### Method 1 — from the repository (git URL, recommended)

```sh
cd ~/.dsh/profiles/web
npm install --allow-git all github:karroziv/dsh-locale-ru
```

Or add the dependency to `~/.dsh/profiles/web/package.json` manually (the
`--allow-git all` flag, or `allow-git=true` in `.npmrc`, is only needed on
npm 11+, see below):

```json
"dependencies": { "dsh-locale-ru": "github:karroziv/dsh-locale-ru" }
```

### Method 2 — from a GitHub Release (tarball)

```sh
cd ~/.dsh/profiles/web
npm install --allow-remote all https://github.com/karroziv/dsh-locale-ru/releases/download/v0.1.0/dsh-locale-ru-0.1.0.tgz
```

### Common steps after installation

```sh
# 1. Add the package to the profile's bundle list
#    in ~/.dsh/profiles/web/package.json:
#      "dsh": { "profile": { "bundles": [
#        "@deepseek-ai/dsh-base",
#        "@deepseek-ai/dsh-web-app",
#        "dsh-locale-ru"
#      ] } }

# 2. Restart the server (rebuilds the boot graph and bundle hashes)
#    restart dsh web
```

> **npm 11+**: git dependencies, remote tarballs, and install scripts are all
> blocked by default. The `--allow-git all` / `--allow-remote all` flags enable
> the first two; for the core auto-patch, approve the install script
> (`npm install-scripts approve dsh-locale-ru`) or apply the patch manually:
> `node node_modules/dsh-locale-ru/scripts/patch-core.mjs`
>
> **pnpm**: `pnpm add github:karroziv/dsh-locale-ru`; pnpm 10+ also requires
> approving build scripts (`pnpm approve-builds`).

The package's postinstall script automatically applies a set of seam patches
to the installed DSH packages:

- `@deepseek-ai/dsh-client-locale` — registers `ru` in the language list
  (otherwise "Русский" would not appear in the selector and the choice would
  not persist);
- the `/goal`, `/plan`, `/compact`, `/export`, `/feedback`, `/permission`
  command descriptions — translated to Russian;
- permission-mode labels (`Рабочая папка`, `Полный доступ`, `Только чтение`)
  and DeepSeek reasoning-effort names (`Высокий`, `Низкий`, …) — translated.

If DSH is not yet installed at install time, the patches print a warning
instead; re-run them manually:

```sh
node node_modules/dsh-locale-ru/scripts/patch-core.mjs
```

## How it works

- The package declares `dsh.client` (platform `web`) and the `./client` bundle;
  the Node half of `dsh-client-modules` includes it in `window.__DSH_BOOT__` and
  serves it under `/plugins/dsh-locale-ru/client.js?rev=<hash>`.
- `apply(ctx)` registers the `ru` dictionaries for every namespace via the
  untyped form `ctx.locale.register(ns, 'ru', dict)`.
- Key lookup chain when the active locale is `ru`:
  `ns.ru → ns.zh → common.ru → common.zh → the key itself`.

## Updating after a DSH upgrade

A DSH upgrade rewrites the patched packages, so the seam patches must be
applied again (idempotently):

```sh
node node_modules/dsh-locale-ru/scripts/patch-core.mjs
```

## Development / rebuilding translations

```sh
# extract the en/zh dictionaries from the deepseek-harness sources
node scripts/extract-dicts.mjs /path/to/deepseek-harness scripts/generated
# edit scripts/generated/ru-dicts.json
node scripts/build-bundle.mjs        # rebuild lib/client.js
node scripts/verify-dicts.mjs        # verify key coverage and placeholders
```

## Known limitations

- A missing key falls back to zh text (by core design) — the `verify-dicts`
  check keeps missing keys out.
- The seam patches are manual intervention into installed npm packages;
  after a DSH upgrade it is re-applied with one command (see above).
- Russian plural forms (1/2/4/5+) use the two-form `one`/`other` model, like the
  core's English dictionaries.

## License

MIT.
