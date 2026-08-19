# dsh-locale-ru — русский языковой пакет для интерфейса DSH Web

[English](#english) · Русский

Плагин (client bundle) для [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness),
добавляющий русский язык в веб-интерфейс (`dsh web`): полные словари `ru`
для всех UI-пространств имён (~650 строк), регистрируемые через
`ctx.locale.register(ns, 'ru', dict)`.

После установки в интерфейсе появляется выбор **Настройки → Language → «Русский»**;
если язык браузера русский — интерфейс включается на русском автоматически.

## Установка

> Требование: у вас уже запускается `dsh web` (профиль `web`).
>
> Пакет устанавливается **напрямую из GitHub** (npm-реестр не используется).

### Способ 1 — из репозитория (git URL, рекомендуется)

```sh
cd ~/.dsh/profiles/web
npm install --allow-git all github:karroziv/dsh-locale-ru
```

Либо добавьте зависимость в `~/.dsh/profiles/web/package.json` вручную
(флаг `--allow-git all` или строка `allow-git=true` в `.npmrc` нужны только
для npm 11+, см. ниже):

```json
"dependencies": { "dsh-locale-ru": "github:karroziv/dsh-locale-ru" }
```

### Способ 2 — из GitHub Release (тарбол)

```sh
cd ~/.dsh/profiles/web
npm install --allow-remote all https://github.com/karroziv/dsh-locale-ru/releases/download/v0.1.0/dsh-locale-ru-0.1.0.tgz
```

### Общие шаги после установки

```sh
# 1. Добавить пакет в список бандлов профиля
#    в ~/.dsh/profiles/web/package.json:
#      "dsh": { "profile": { "bundles": [
#        "@deepseek-ai/dsh-base",
#        "@deepseek-ai/dsh-web-app",
#        "dsh-locale-ru"
#      ] } }

# 2. Перезапустить сервер (пересобирается boot-граф и хэши бандлов)
#    перезапустите dsh web
```

> **npm 11+**: по умолчанию заблокированы и git-зависимости, и remote-тарболы,
> и install-скрипты. Флаги `--allow-git all` / `--allow-remote all` включают
> первые два; для автопатча ядра разрешите install-скрипт
> (`npm install-scripts approve dsh-locale-ru`) либо примените патч вручную:
> `node node_modules/dsh-locale-ru/scripts/patch-core.mjs`
>
> **pnpm**: `pnpm add github:karroziv/dsh-locale-ru`; в pnpm 10+ build-скрипты
> тоже требуют одобрения (`pnpm approve-builds`).

Postinstall-скрипт пакета автоматически применяет микро-патч ядра
(`@deepseek-ai/dsh-client-locale`), который регистрирует `ru` в списке языков —
иначе «Русский» не появится в селекторе и выбор не сохранится. Если на момент
установки DSH ещё не развёрнут, патч применится с предупреждением; повторите его
вручную:

```sh
node node_modules/dsh-locale-ru/scripts/patch-core.mjs
```

## Как это работает

- Пакет объявляет `dsh.client` (platform `web`) и бандл `./client`; Node-половина
  `dsh-client-modules` включает его в `window.__DSH_BOOT__` и раздаёт под
  `/plugins/dsh-locale-ru/client.js?rev=<hash>`.
- `apply(ctx)` регистрирует словари `ru` для всех namespace нетипизированной
  формой `ctx.locale.register(ns, 'ru', dict)`.
- Цепочка поиска ключа при активной локали `ru`:
  `ns.ru → ns.zh → common.ru → common.zh → сам ключ`.

## Обновление после апгрейда DSH

Апгрейд DSH перезаписывает пакет `@deepseek-ai/dsh-client-locale`, и микро-патч
ядра нужно применить заново (идемпотентно):

```sh
node node_modules/dsh-locale-ru/scripts/patch-core.mjs
```

## Разработка / пересборка переводов

```sh
# извлечь en/zh словари из исходников deepseek-harness
node scripts/extract-dicts.mjs /путь/к/deepseek-harness scripts/generated
# правим scripts/generated/ru-dicts.json
node scripts/build-bundle.mjs        # пересобрать lib/client.js
node scripts/verify-dicts.mjs        # сверка покрытия ключей и плейсхолдеров
```

## Известные ограничения

- Пропуск ключа показывает zh-текст (fallback по дизайну ядра) — сверка
  `verify-dicts` не даёт пропускам появиться.
- Микро-патч ядра — ручное вмешательство в установленный npm-пакет; после
  апгрейда DSH повторяется одной командой (см. выше).
- Русские плюральные формы (1/2/4/5+) используют двухформенную модель
  `one`/`other`, как в английских словарях ядра.

## Лицензия

MIT.

---

<a name="english"></a>
## English

A client-bundle plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
that localizes the `dsh web` interface into Russian: complete `ru` dictionaries
for every UI namespace (~650 strings), registered via
`ctx.locale.register(ns, 'ru', dict)`.

**Install (from GitHub, no npm account needed):** inside `~/.dsh/profiles/web` run

```sh
npm install --allow-git all github:karroziv/dsh-locale-ru
# or from the release tarball:
# npm install --allow-remote all https://github.com/karroziv/dsh-locale-ru/releases/download/v0.1.0/dsh-locale-ru-0.1.0.tgz
```

then add `"dsh-locale-ru"` to `dsh.profile.bundles` in that profile's
`package.json` and restart `dsh web`. The postinstall script applies the
required one-line core seam patch (`@deepseek-ai/dsh-client-locale` gains `ru`
in `LOCALE_IDS` and `LOCALES`); re-run
`node node_modules/dsh-locale-ru/scripts/patch-core.mjs` after every DSH
upgrade. On npm 11+, git/remote installs and install scripts are blocked by
default — pass `--allow-git all` / `--allow-remote all`, approve the script
(`npm install-scripts approve dsh-locale-ru`), or run the patch command
manually. pnpm: `pnpm add github:karroziv/dsh-locale-ru` (pnpm 10+ requires
`pnpm approve-builds`).

Then pick **Settings → Language → Русский** (or set your browser language to
Russian and it activates automatically).

License: MIT.
