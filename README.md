# dsh-locale-ru — русский языковой пакет для интерфейса DeepSeek Harness Web

Русский · [English](README.en.md)

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

Postinstall-скрипт пакета автоматически применяет набор seam-патчей к
установленным пакетам DSH:

- `@deepseek-ai/dsh-client-locale` — регистрирует `ru` в списке языков
  (иначе «Русский» не появится в селекторе и выбор не сохранится);
- описания команд `/goal`, `/plan`, `/compact`, `/export`, `/feedback`,
  `/permission` — переводятся на русский;
- названия режимов прав (`Рабочая папка`, `Полный доступ`, `Только чтение`)
  и уровней рассуждений DeepSeek (`Высокий`, `Низкий`, …) — переводятся.

Если на момент установки DSH ещё не развёрнут, патчи применятся с
предупреждением; повторите их вручную:

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

Апгрейд DSH перезаписывает пропатченные пакеты. Чтобы не делать это вручную,
в пакете есть два скрипта автопатча:

```sh
# 1. Одноразово: пропатчить ВСЕ установки dsh и внедрить postinstall-хуки
#    в их npx-кэши (~/.npm/_npx/<hash>/package.json)
node node_modules/dsh-locale-ru/scripts/ensure-all.mjs

# 2. Сам хук (вызывается npm автоматически):
#    node_modules/dsh-locale-ru/scripts/auto-patch.mjs
```

Хук `auto-patch.mjs` прописывается в `postinstall` каждого npx-кэша. npm
выполняет postinstall проекта кэша после каждой переустановки зависимостей —
то есть ровно между «npm exec обновил @deepseek-ai/dsh» и «стартом сервера»,
поэтому после апгрейда патч применяется до первого запуска.

Чтобы апгрейды были полностью автоматическими, запускайте dsh со **стабильной
спецификацией** `@next` (один и тот же кэш-каталог навсегда, хук сохраняется):

```sh
npm exec --yes @deepseek-ai/dsh@next web
```

Если запускать с закреплённой версией (`@deepseek-ai/dsh@0.1.0-rc.X`), при
переходе на новую версию создаётся новый кэш — достаточно один раз выполнить
`ensure-all.mjs` (или попросить агента), и дальше хук снова работает сам.

После установки патча перезапустите сервер и обновите страницу браузера.

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
- Seam-патчи — ручное вмешательство в установленные npm-пакеты; после
  апгрейда DSH повторяется одной командой (см. выше).
- Русские плюральные формы (1/2/4/5+) используют двухформенную модель
  `one`/`other`, как в английских словарях ядра.

## Связанные проекты

- [imdeniil/dsh-locale-ru](https://github.com/imdeniil/dsh-locale-ru) — альтернативная
  русская локализация DSH (включает перевод магазина плагинов сообщества
  `dsh-community-market` и расширяет список языков в рантайме).

## Лицензия

MIT.
