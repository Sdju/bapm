# Манифест bapm.yml

Канонический конфиг проекта — **`bapm.yml`**: полный набор полей bapm. Файл **`apm.yml`** — подмножество ради обратной совместимости с OpenAPM/APM (dual-read того же parser), а не равноправный «второй бренд навсегда».

Манифест — декларация проекта: имя, версия и зависимости агента. По нему CLI резолвит граф, пишет lock и (при активном host target) материализует runtime.

Discovery ищет файл **только в текущем каталоге** (cwd). Подъёма по родителям нет.

## Dual-read: bapm.yml и apm.yml

Ровно один файл в cwd:

| Ситуация | Поведение |
| --- | --- |
| Только `bapm.yml` | Используется он (предпочтительная запись) |
| Только `apm.yml` | Используется он (backcompat / OpenAPM) |
| Оба сразу | Отказ merge (`MANIFEST_DUAL_CONFLICT`) |
| Ни одного | `MANIFEST_NOT_FOUND` (кроме package-ref add — см. ниже) |

- `bapm init` всегда пишет **`bapm.yml`** и отказывается, если уже есть любой из двух файлов.
- `bapm install <package-ref…>` без манифеста может создать минимальный **`apm.yml`** (parity с APM), затем дописать зависимость.
- Новые проекты и ручная правка — целитесь в **`bapm.yml`**. `apm.yml` оставляйте, если уже живёте на OpenAPM-имени или CLI создал его при add без init.

Не держите оба файла «на всякий случай» — CLI их не объединяет.

## Схема bapm.yml (актуальная)

Ниже — поля, которые parser и типы Manifest принимают **сегодня**. Это карта формы, не полный dump OpenSpec.

### Обязательные

| Поле | Тип | Правило |
| --- | --- | --- |
| `name` | строка | Непустая. |
| `version` | строка | Непустая. Числоподобный YAML лучше в кавычках (`"0.1.0"`). Не-semver — предупреждение, не отказ. |

### Известные опциональные (top-level)

| Поле | Тип | Правило |
| --- | --- | --- |
| `dependencies` | mapping | Блоки списков зависимостей (см. ниже). |
| `devDependencies` | mapping | То же для dev; `bapm install <ref> --dev` пишет сюда. |
| `target` | строка **или** object-map | Legacy: один host id (`cursor`). Object-map (**bapm-расширение**): `host-id → npm-пакет или локальный путь`. Нельзя вместе с `targets`. |
| `targets` | список строк **или** object-map | Legacy: несколько host id. Object-map (**bapm-расширение**): те же ключи→пакеты/пути. Нельзя вместе с `target`. Для multi-host object-map **предпочтительнее `targets`**. |
| `active` | список строк | **bapm-расширение**: какие host id **активировать** на install/MCP (можно несколько) или compile (ровно один без `--target`). Непустой список mf-005 токенов. Пустой `active: []` — отказ parse. Dual-read на `apm.yml` / `bapm.yml`. |
| `registries` | mapping | Именованные registry (см. ниже). |
| `default_host` | строка | Есть в модели манифеста и **сохраняется** при разборе; отдельной специальной валидации в parser нет. |
| `marketplace` | mapping | **Authoring-расширение bapm** (отдельный путь валидации). Не consumer day-to-day; см. ниже и [marketplace](/reference/marketplace). |

### Выбор активного host (приоритет)

Порядок selection для install / compile:

1. `--target <id>` (CLI flag; force; для этого run игнорирует `active` и detect)
2. `bapm.local.yml` → `active` (персональный overlay, если файл есть)
3. базовый манифест `bapm.yml` / `apm.yml` → `active`
4. sole auto-detect среди зарегистрированных интеграций
5. fail-closed (подсказка: `--target <id>` и/или `active` в манифесте / overlay)

Поле `target` / `targets` — заявление предпочтения / ключи intersection / object-map для **загрузки** пакетов. Оно **не** заменяет `active` и **само по себе не активирует** hosts. Для явной активации без detect используйте `active` или `bapm install --target cursor`. Рекомендуется `active` ⊆ объявленных `target`/`targets`, когда оба заданы.

```yaml
active:
  - cursor
```

Пустой `active: []` отклоняется (fail-closed): ключ объявляет intent активации; «ничего не материализовать» — опустите поле. Dual-read: те же правила для `apm.yml` и `bapm.yml`.

### Personal overlay: `bapm.local.yml`

Опциональный **персональный** файл рядом с базовым манифестом (тот же project root, без walk-up по родителям). Имя строго `bapm.local.yml`. Файл `apm.local.yml` в v1 **отклонён** (fail-closed).

Это **не** то же самое, что source discriminator `local:` / `local` у зависимостей (каталог `.agents/local`). Overlay — личные настройки host/env/registry; `local:` — источник пакета.

**Allowlist** top-level ключей (всё остальное, включая `name` / `version` / `dependencies` / `x-*`, — отказ):

| Ключ | Merge |
| --- | --- |
| `active` | replace всего списка |
| `target` / `targets` | object-map + object-map → deep-merge ключей (local wins); иначе replace поля + mutual exclusion |
| `env` | deep-merge строкового map (local wins per key) |
| `registries` | deep-merge по имени registry (local entry overlays) |

**Precedence** настроек (выше побеждает): CLI flags (`--target`, …) → `bapm.local.yml` → base `bapm.yml`/`apm.yml` → process-env overrides (только где у setting есть env override).

Держите overlay вне git/pack/publish: добавьте в `.gitignore` строку `bapm.local.yml`. Pack и publish **опускают** файл; `bapm doctor` предупреждает, если он уже tracked (`git rm --cached bapm.local.yml`).

```yaml
# bapm.local.yml — пример
active:
  - x-acme-editor
env:
  FOO: "personal"
```

### Object-map `target` / `targets` (bapm-расширение)

Помимо legacy-форм (`target: cursor`, `targets: [cursor, claude]`), оба поля могут быть **object-map** host id → npm package **или** локальный путь к integration-модулю:

```yaml
targets:
  cursor: "@bapm/integration-cursor"
  pi: "./agents/integration/pi-agent"
```

Это **bapm-расширение** (не обязательный vocabulary OpenAPM): ключи — mf-005 host tokens (canonical / alias / `x-<vendor>-<name>`); значения — непустые opaque-строки. Классификация при загрузке:

| Форма значения | Как трактуется |
| --- | --- |
| `./…`, `../…`, абсолютный путь (`/` или Windows drive) | Локальный filesystem path относительно project / manifest cwd |
| всё остальное (`pkg`, `@scope/name`, `pkg@version`) | npm package specifier |

Локальные **директории** резолвятся через Node module resolution (`package.json` `exports` / `main`, затем `index.*`). Можно указать явный entry-файл (например `./agents/integration/pi-agent/index.mjs`), если Node его принимает. Значения без `./` (например `agents/foo`) **не** считаются путём — это имя npm-пакета.

Локальные пути обязаны оставаться **внутри project root** (lexical containment): `../` escape и абсолютные пути вне корня проекта — fail-closed до import. Симлинк-jail за пределы корня в v1 не усиливается. TypeScript-исходники без сборки Node обычно не загрузит — указывайте JS entry или `main` на собранный файл.

Пустой `{}`, невалидный ключ или пустое значение — отказ parse. Mutual exclusion `target` + `targets` сохраняется для любой комбинации форм. Dual-read `apm.yml` использует те же правила.

Активный host выбирается по приоритету `--target` → `active` → auto-detect **уже зарегистрированных** интеграций (fail, если ни то ни другое). Когда object-map присутствует, CLI **загружает и регистрирует** каждый npm-пакет или локальный модуль из значений map **до** выбора активного host (eager, fail-closed при ошибке resolve/export/id/containment). Map / `target` / `targets` **сами по себе не активируют** host — без `--target`, без `active` и без успешного detect команда завершится с просьбой передать `--target <id>` (или задать `active`). Built-in Cursor остаётся доступен без строки `cursor` в map (запись в map опциональна и может переопределить built-in). Для multi-host object-map предпочтительнее поле `targets` (singular `target` с несколькими ключами тоже принимается).

### Отклонённые

| Поле | Поведение |
| --- | --- |
| `workspaces` | Отказ валидации (`OpenAPM v0.1 rejects top-level "workspaces"`). |

### Неизвестные и `x-*`

Любые другие top-level ключи (включая `x-*`, а также поля вроде `description` / `author`, которые пишет scaffold) **сохраняются** в документе для будущего rewrite. Они не обязаны быть в таблице выше, чтобы манифест оставался валидным.

### `dependencies` / `devDependencies`

Оба блока — **mapping**, не список.

| Ключ списка | Валидация |
| --- | --- |
| `apm` | Список; каждая запись **глубоко** проверяется (см. формы APM ниже). |
| `mcp` | Должен быть список, если присутствует; содержимое без deep-resolve на этапе parse. |
| `lsp` | То же: list shape сохраняется без deep-resolve. |
| другие ключи | Если значение — список, форма списка сохраняется; не-list sibling keys тоже оставляются as-is. |

`bapm init` / минимальный scaffold пишет пустые `dependencies.apm` и `dependencies.mcp`. В plugin-mode scaffold дополнительно возможны `devDependencies.apm`, `includes: auto`, `scripts: {}` (retained top-level).

### Запись в `dependencies.apm`

Два вида:

1. **Строка** (shorthand), например `org/repo`, `org/repo/path`, `org/repo#v1.0.0`.
2. **Объект** ровно с **одним** source kind среди: `git` | `id` | `path` | `registry` | `marketplace` | `local`.

Особые пары (не считаются вторым source kind):

- `git` + `path` — `path` как companion (virtual_path); для `git: parent` поле `path` обязательно.
- `id` + `registry` — `registry` как указатель на именованный registry, не отдельный source.

`local` — **bapm-расширение** (не vocabulary OpenAPM v0.1): взаимоисключающий source kind, **не** companion к `git`. Портативная OpenAPM-форма по-прежнему `path:`.

Значения `local`:

| Форма | Эффективный путь |
| --- | --- |
| `- local` (строка в списке) | `.agents/local` |
| `local: true`, `local:` / `null`, `local: ""` | `.agents/local` |
| `local: ./alt` (непустая строка) | указанный путь |
| `local: false` / не-скаляр | отказ |

При resolve/install, если в графе есть хотя бы один `local`, bapm **ensure**: дописывает покрывающее правило в `.gitignore` проекта (если его нет) и **fail-closed**, если git уже индексирует файлы под этим корнем. Обычный OpenAPM `path:` этот gate **не** включает.

Допустимые meta-ключи объекта (allowlist): `version`, `ref`, `alias`, `skills`, `targets`, `allow_insecure`, `type`, `prerelease`, `name` (для marketplace-формы), плюс companions `path` / `registry` выше. Ключи `x-*` на записи зависимости допускаются; прочие неизвестные ключи — отказ.

Marketplace-форма объекта: непустые `marketplace` и `name` (опционально `version`).

Примеры:

```yaml
dependencies:
  apm:
    - org/example-skill#v1.0.0
    - path: ./packages/hello-skill
    - local
    - local: true
    - local: ./vendor/wip-skill
    - git: https://github.com/org/repo.git
      ref: main
      path: packages/skill
    - id: my-pkg
      registry: my-registry
      version: "^1.0.0"
    - name: plugin-name
      marketplace: my-marketplace
      version: "1.2.3"
  mcp: []
```

### `registries`

Именованный mapping. Ключ `default` — **не URL**, а имя уже объявленного registry.

| Форма значения | Поля |
| --- | --- |
| строка | HTTP(S) URL registry |
| объект | обязательный `url`; опционально `insecure` (bool), `aliases` (список hostname); `x-*` допускаются; **`token` в YAML запрещён** |

`http://` без `insecure: true` допускается только для exempt-хостов (loopback / RFC1918); иначе нужен `insecure: true`.

```yaml
registries:
  default: my-reg
  my-reg:
    url: https://registry.example.com
    aliases:
      - registry.example.com
  local-http:
    url: http://127.0.0.1:4873
    insecure: true
```

### `marketplace:` (authoring, не day-to-day)

Отдельный блок в **`bapm.yml`** для authoring marketplace (`bapm marketplace …`, `bapm pack`). Валидируется своим путём, не общим Manifest parse.

Типичные ключи блока: `owner`, `build` (`tagPattern`), `outputs`, `packages` (записи с `name` + `source`, опционально version/ref/subdir/…). Имя/описание/версия marketplace по умолчанию наследуются с top-level манифеста. Подробности команд: [marketplace](/reference/marketplace), сценарий: [Marketplace pack](/guide/situations/marketplace-pack).

## Поля день ото дня

Типичный consumer-минимум:

```yaml
name: my-project
version: 0.1.0
target: cursor
active:
  - cursor
dependencies:
  apm:
    - path: ./packages/hello-skill
  mcp: []
```

| Поле | Зачем пользователю |
| --- | --- |
| `name` | Обязательно. Имя проекта / пакета. |
| `version` | Обязательно. Строка версии. |
| `target` / `targets` | Предпочитаемый host / object-map load; **не** активация сами по себе. |
| `active` | Явный список host id для активации (приоритет: `--target` → `active` → detect). |
| `dependencies.apm` | Agent/APM-пакеты. |
| `dependencies.mcp` | MCP-серверы; при активном Cursor по умолчанию в `.cursor/mcp.json` попадают **прямые** записи (transitive — только с `--trust-transitive-mcp`). В `env` / `headers` можно писать APM-плейсхолдеры `${VAR}`, `${env:VAR}` / legacy `<VAR>` и bapm-директиву `{bake:NAME}` / `{bake:env:NAME}` — при install bapm **запекает** их в литералы из окружения процесса (Cursor не подставляет `${…}` в runtime). Неразрешённый плейсхолдер → install падает до записи placeholders в `.cursor/mcp.json`. |
| `devDependencies.apm` | Dev-зависимости; `bapm install <ref> --dev`. |

`bapm init -y --target cursor` создаёт каркас с `name` (из имени каталога или аргумента), `version: 0.1.0`, пустыми `dependencies.apm` / `dependencies.mcp` и при необходимости `target`.

### Что обычно не правят вручную каждый день

- `registries` — для registry/id-форм deps и insecure/aliases.
- `marketplace:` — authoring, не consumer-минимум.
- `default_host` — retained; отдельной UX-команды «обязательно выставить» нет.
- Top-level `workspaces` — **нельзя**.

## Когда править вручную, а когда через команды

| Задача | Как |
| --- | --- |
| Новый проект с нуля | `bapm init -y --target cursor` → **`bapm.yml`** |
| Добавить пакет | `bapm install <package-ref…>` (допишет в `dependencies.apm`) или `… --dev` → `devDependencies.apm` |
| Убрать пакет из манифеста и deploy | `bapm uninstall …` |
| Поменять path/git-запись, MCP, `name`/`version` | Правка YAML вручную, затем `bapm install` (или `bapm lock`, если нужен только lock) |
| Только посмотреть бы add | `bapm install <ref> --dry-run` (без durable writes) |

Ручной edit уместен для структуры deps и метаданных. Повторно не создавайте манифест через `init`, если файл уже есть — команда не перезапишет.

### MCP env placeholders (Cursor bake)

В `dependencies.mcp[].env` (и `headers`, если заданы) поддерживаются формы APM Cursor legacy **и** явная bapm-директива:

| Форма | Источник |
| --- | --- |
| `${VAR}` / `${env:VAR}` / `<VAR>` | OpenAPM/APM parity |
| `{bake:NAME}` / `{bake:env:NAME}` | **только bapm** (не OpenAPM); `NAME` — идентификатор `[A-Za-z_][A-Za-z0-9_]*` |

```yaml
dependencies:
  mcp:
    - name: my-server
      registry: false
      transport: stdio
      command: npx
      args: ["-y", "my-mcp"]
      env:
        API_TOKEN: "${API_TOKEN}"
        # или: "${env:API_TOKEN}" / "<API_TOKEN>"
        # bapm-only — явный маркер «обязательно запечь»:
        BAKED: "{bake:API_TOKEN}"
        # или: "{bake:env:API_TOKEN}"
```

Перед записью `.cursor/mcp.json` bapm подставляет значения из окружения (сначала явные overrides API, затем `process.env`). Пустая строка не считается значением. Если переменная не задана — install завершается с ошибкой и именем ключа (секрет в сообщение не попадает). Литералы без плейсхолдеров пишутся как есть. `{bake:…}` означает «bapm должен запечь здесь»; APM-формы на Cursor по-прежнему тоже bake’ятся.

## Типичные ошибки

| Симптом | Что проверить |
| --- | --- |
| `No manifest found` / `MANIFEST_NOT_FOUND` | В cwd нет ни `apm.yml`, ни `bapm.yml`. Сделайте `init` или `install <ref>` (создаст минимальный `apm.yml`). |
| `MCP env bake failed` / `unresolved placeholder` | Задайте недостающую переменную в окружении перед `bapm install --target cursor`. |
| `Both apm.yml and bapm.yml are present` | Оставьте один файл. |
| `Manifest requires "name"` / `"version"` | Добавьте оба поля; version — непустая строка. |
| `must not declare both "target" and "targets"` | Оставьте либо `target`, либо `targets`. |
| `OpenAPM v0.1 rejects top-level "workspaces"` | Уберите `workspaces` с корня манифеста. |
| `must have exactly one source kind` / `unknown source kind` | В object-dep — ровно один из `git`\|`id`\|`path`\|`registry`\|`marketplace` (с учётом companions). |
| `Registry … uses http:// without insecure: true` | Выставьте `insecure: true` или используйте HTTPS / exempt host. |
| `Target detection is missing or ambiguous; pass --target <id>` | Нет однозначного auto-detect (например нет `.cursor/`). Передайте `--target cursor` или задайте `active: [cursor]`. |
| `Manifest "active" must be a non-empty array` / empty `active: []` | Укажите хотя бы один mf-005 id или уберите поле `active`. |
| `Unknown or unregistered target: …` | Id не зарегистрирован (built-in или object-map). Проверьте map / `--target`. |
| `Refusing to init: … already exists` | Манифест уже есть; правьте существующий файл. |

Дальше: [Быстрый старт](/guide/quick-start). Lock рядом: [Lockfile](/guide/lockfile). Init-флаги: [init](/reference/init).
