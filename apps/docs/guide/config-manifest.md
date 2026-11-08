# Манифест `bapm.yml`

`bapm.yml` лежит в корне проекта и описывает, какие пакеты и MCP-серверы нужны агенту. Файл коммитится в git и общий для всей команды.

bapm ищет манифест только в текущем каталоге. Вместо `bapm.yml` можно использовать `apm.yml` из microsoft/apm; если лежат оба файла, команды завершаются ошибкой — оставьте один.

## Пример

```yaml
name: my-project
version: 0.1.0

dependencies:
  apm:
    - acme/agent-skills#v1.2.0
    - path: ./tools/team-skills
  mcp:
    - name: github
      registry: false
      transport: stdio
      command: npx
      args: ["-y", "@modelcontextprotocol/server-github"]
      env:
        GITHUB_TOKEN: "${GITHUB_TOKEN}"

active:
  target: cursor
```

Создать заготовку: `bapm init -y --target cursor`.

## Поля

| Поле              | Обязательно | Зачем                                                                                                                                              |
| ----------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`, `version` | да          | Имя и версия проекта                                                                                                                               |
| `$schema`         | нет         | Контракт манифеста; без него — рабочий черновик, см. ниже                                                                                          |
| `dependencies`    | нет         | `apm` — пакеты агента, `mcp` — MCP-серверы, `lsp` — LSP-серверы для Claude/Copilot. [Формы записи](/guide/manifest-dependencies)                             |
| `devDependencies` | нет         | То же, что `dependencies`; сюда пишет `bapm install --dev <ref>`                                                                                   |
| `active`          | нет         | Какого агента и какие пресеты использовать. [Подробнее](/guide/manifest-hosts#active)                                                              |
| `presets`         | нет         | Именованные наборы зависимостей, см. ниже                                                                                                          |
| `env`             | нет         | Значения по умолчанию для переменных в MCP-конфигах, см. ниже                                                                                      |
| `targets`         | нет         | Своя интеграция агента; заодно ограничивает, каким агентам раскладываются файлы. [Подробнее](/guide/manifest-hosts#targets-и-target)               |
| `executables`     | нет         | Разрешения для MCP и `bin/` из зависимостей для всей команды. [Подробнее](/guide/situations/policy-mcp)                                            |
| `lifecycle`       | нет         | Сохраняется, но **не исполняется**: install печатает `LIFECYCLE_UNSUPPORTED`. См. [install](/reference/install)                                    |
| `canvas`          | нет         | **Не реализован**: install печатает `CANVAS_UNSUPPORTED` и ничего не разворачивает. См. [install](/reference/install)                              |
| `registries`      | нет         | Приватные registry (экспериментально). [Подробнее](/guide/manifest-registries)                                                                     |
| `marketplace`     | нет         | Описание маркетплейса для `bapm pack`. [Подробнее](/guide/manifest-registries#marketplace)                                                         |

Личные настройки, которые не должны попадать в git (ваш агент, ваши значения переменных), кладите в [`bapm.local.yml`](/guide/manifest-overlay).

## `$schema`, неизвестные ключи и `x-*`

Поле `$schema` выбирает контракт манифеста. Без него используется текущий рабочий черновик bapm/APM. Явно поддержаны идентификаторы OpenAPM v0.1:

```yaml
$schema: https://microsoft.github.io/apm/specs/schemas/manifest-v0.1.schema.json
# также принимаются manifest-v0.1.41.schema.json и manifest-v0.1.48.schema.json
```

Неизвестный `$schema` завершает загрузку ошибкой `MANIFEST_SCHEMA_UNSUPPORTED`, а не откатывается молча к черновику. Кандидатный `manifest-source-replacements-v1.schema.json` тоже отвергается отдельной ошибкой: bapm не реализует `replace:` и не должен устанавливать upstream вместо fork/local checkout.

Незнакомые верхнеуровневые ключи сохраняются в документе, но теперь дают предупреждение `MF_006_UNKNOWN_TOP_LEVEL`: вероятная опечатка не должна молча становиться мёртвой настройкой. Ключи вида `x-[a-z][a-z0-9-]*` считаются расширениями вендора, не предупреждаются, сохраняются при записи и попадают в `extensions` строки lock-файла зависимости.

## Формы `target` и `targets`

Кроме массива и object-map, принимаются APM-формы со скаляром и CSV:

```yaml
targets: cursor # → [cursor]
targets: "cursor,claude" # → [cursor, claude]
target: "claude,copilot" # → [claude, copilot]
target: [cursor, claude] # list sugar
```

Одновременно `target` и `targets` указывать по-прежнему нельзя. Алиасы (`vscode`, `agents`) нормализуются в `copilot`.

## Пресеты

Пресет — именованный набор зависимостей, который ставится, только если его включили. Удобно, когда части команды нужны дополнительные skills: например, аналитикам — skills для работы с данными, а разработчикам — для ревью кода.

```yaml
dependencies:
  apm:
    - acme/base-skills # ставится всем

presets:
  - name: developer
    dependencies:
      apm:
        - acme/code-review-skills
  - name: analyst
    dependencies:
      apm:
        - acme/data-skills

active:
  target: cursor
  preset: developer # пресет по умолчанию для проекта
```

Каждый выбирает свой пресет в личном `bapm.local.yml`:

```yaml
active:
  target: cursor
  preset: analyst
```

Пресеты объявляются только в `bapm.yml`; в `bapm.local.yml` их можно выбирать, но не объявлять. Кроме `dependencies`, пресет может содержать `devDependencies` и собственный `active`, который включает другие пресеты или агентов.

::: warning Файлы выключенного пресета остаются на диске
Если выключить пресет или вручную убрать пакет из манифеста, `bapm install` перестанет его ставить. Обычный (не-frozen) install удалит файлы, записанные за пакетом в `deployed_file_hashes` предыдущего lock; без inventory или в `--frozen` (включая CI-default) они останутся. Пустые каталоги не удаляются. `bapm prune` убирает только каталоги в `apm_modules/`; оставшиеся файлы удалите вручную.
:::

## Переменные для MCP: `env`

MCP-серверам часто нужны токены и адреса. В манифесте их пишут как `${VAR}`. Для `{bake:VAR}` и для хостов, которые подставляют значения при `install` (например Codex `env`), значение ищется:

1. в переменной окружения процесса;
2. если её нет — в `env` из `bapm.local.yml`;
3. если нет и там — в `env` из `bapm.yml`.

Если значение не нашлось нигде, `{bake:VAR}` завершается ошибкой `MCP env bake failed`. Cursor и OpenCode `${VAR}` не подставляют при install, а записывают ссылку `${env:VAR}` / `{env:VAR}` — значение должно быть в окружении при запуске агента.

```yaml
# bapm.yml — значения по умолчанию, без секретов
env:
  GITHUB_API_URL: "https://api.github.com"
```

```yaml
# bapm.local.yml — личные значения, не в git
env:
  GITHUB_TOKEN: "ghp_…"
```

Не кладите секреты в `env` файла `bapm.yml`: он в git. Как значения попадают в конфиги агента и чем это грозит: [MCP и переменные окружения](/guide/manifest-dependencies#mcp-и-переменные-окружения).

## Скрипты: `scripts`

Секция `scripts:` хранит именованные shell-команды для `bapm run` / `bapm preview` (аналог npm scripts). Ключ — имя скрипта, значение — строка команды. `start` используется по умолчанию, если имя не передано.

```yaml
scripts:
  start: "echo hello"
  test: "node --test"
  greet: "echo hello {{name}}"
```

```bash
bapm run                 # start
bapm run test
bapm preview greet -p name=World
```

Параметры `-p name=value` подставляются как `{{name}}` или `${input:name}` и дополнительно экспортируются как `PARAM_NAME`. Команды выполняются с правами пользователя через системный shell; значения параметров shell-экранируются. Подробности: [run / preview](/reference/run).

## Shared cache: git + HTTP (opt-in)

По умолчанию bapm клонирует git-зависимости прямо в `apm_modules`, без общего кеша. Чтобы несколько проектов на машине переиспользовали bare mirror и кэш registry-ответов, задайте корень кеша:

```bash
export BAPM_CACHE_DIR="$HOME/.cache/bapm"
bapm install
```

Layout: `<BAPM_CACHE_DIR>/git/<sha256(normalized repo url)>.git` для git mirrors и `<BAPM_CACHE_DIR>/http/<sha256(url + request headers)>` для HTTP `GET 200` responses. Один git mirror на репозиторий, не на ref. Local `path`, `file://` и `local:` источники не кешируются. Cache не меняет ключи `apm_modules` и изоляцию identity (rs-016).

HTTP-кэш по умолчанию включён при заданном `BAPM_CACHE_DIR`; `BAPM_HTTP_CACHE=0` отключает только HTTP, а `BAPM_HTTP_CACHE_TTL` задаёт свежесть в секундах (default `300`). Запросы с `Authorization` / `Cookie`, non-GET методы и ответы `4xx`/`5xx` не кэшируются.

Отключить использование кеша в одном запуске или в CI можно `BAPM_NO_CACHE=1`; `BAPM_CACHE_DIR` при этом можно оставить заданным. При ошибке кеша install печатает warning и делает обычный clone, поэтому opt-in не должен ломать установку.

Посмотреть путь/размер и очистить только shared-кэши: `bapm cache info`, `bapm cache info --shared`, `bapm cache clean --shared -y`, `bapm cache prune --shared`. Обычный `bapm cache clean -y` по-прежнему очищает `apm_modules`. Подробнее: [cache](/reference/cache).

## Какие правки делать вручную

| Задача                            | Как                                                                                                       |
| --------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Новый проект                      | `bapm init -y --target cursor`                                                                            |
| Добавить пакет из GitHub          | `bapm install acme/agent-skills` (допишет в манифест)                                                     |
| Подкаталог репозитория, путь, MCP | Правка `bapm.yml`, затем `bapm install`                                                                   |
| Удалить пакет                     | `bapm uninstall <имя>` (точное имя, alias, URL или basename пути) — см. [uninstall](/reference/uninstall) |

## Частые ошибки

| Сообщение                                                | Что делать                                                            |
| -------------------------------------------------------- | --------------------------------------------------------------------- |
| `No manifest found`                                      | В текущем каталоге нет `bapm.yml` / `apm.yml`                         |
| `Manifest requires "name"` / `"version"`                 | Добавьте оба поля                                                     |
| `Manifest "active" rejects legacy bare host-token lists` | `active: { target: cursor }` вместо `active: [cursor]`                |
| `must have exactly one source kind`                      | В записи зависимости указан больше чем один источник (`git`, `path`…) |
| `OpenAPM v0.1 rejects top-level "workspaces"`            | Уберите поле `workspaces`: bapm его не поддерживает                   |

Дальше: [Зависимости](/guide/manifest-dependencies) · [Личные настройки](/guide/manifest-overlay) · [Lock-файл](/guide/lockfile).
