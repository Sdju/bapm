# Зависимости в манифесте

Блоки `dependencies` и `devDependencies` — **mapping**, не список. Обзор манифеста: [bapm.yml](/guide/config-manifest).

## Пример

```yaml
dependencies:
  apm:
    - org/example-skill#v1.0.0
    - path: ./packages/hello-skill
    - local
    - git: https://github.com/org/repo.git
      ref: main
      path: packages/skill
  mcp: []
```

`bapm install <ref>` дописывает в `dependencies.apm`; `--dev` — в `devDependencies.apm`.

## Ключи списков

| Ключ   | Валидация                                            |
| ------ | ---------------------------------------------------- |
| `apm`  | Список; каждая запись глубоко проверяется            |
| `mcp`  | Список, если присутствует; без deep-resolve на parse |
| `lsp`  | То же: list shape без deep-resolve                   |
| другие | List сохраняется as-is; не-list sibling keys тоже    |

`bapm init` пишет пустые `dependencies.apm` и `dependencies.mcp`.

## Формы `dependencies.apm`

1. **Строка** (shorthand): `org/repo`, `org/repo/path`, `org/repo#v1.0.0`.
2. **Объект** ровно с **одним** source kind: `git` \| `id` \| `path` \| `registry` \| `marketplace` \| `local`.

Особые пары (не второй source kind):

- `git` + `path` — `path` как companion (для `git: parent` поле `path` обязательно)
- `id` + `registry` — указатель на именованный registry

`local` — **bapm-расширение** (не vocabulary OpenAPM v0.1). Портативная OpenAPM-форма — `path:`.

| Форма `local`                 | Эффективный путь |
| ----------------------------- | ---------------- |
| `- local`                     | `.agents/local`  |
| `local: true` / `null` / `""` | `.agents/local`  |
| `local: ./alt`                | указанный путь   |
| `local: false`                | отказ            |

Если в графе есть `local`, bapm ensure `.gitignore` и fail-closed при tracked файлах под этим корнем. Обычный `path:` этот gate не включает.

Allowlist meta-ключей объекта: `version`, `ref`, `alias`, `skills`, `targets`, `allow_insecure`, `type`, `prerelease`, `name` (marketplace), companions `path` / `registry`. Ключи `x-*` допускаются.

Marketplace-форма: непустые `marketplace` и `name` (опционально `version`).

```yaml
dependencies:
  apm:
    - id: my-pkg
      registry: my-registry
      version: "^1.0.0"
    - name: plugin-name
      marketplace: my-marketplace
      version: "1.2.3"
```

## MCP env placeholders (Cursor bake)

В `dependencies.mcp[].env` (и `headers`) при install в Cursor плейсхолдеры **запекаются** в литералы из окружения. Неразрешённый — install падает.

| Форма                             | Источник           |
| --------------------------------- | ------------------ |
| `${VAR}` / `${env:VAR}` / `<VAR>` | OpenAPM/APM parity |
| `{bake:NAME}` / `{bake:env:NAME}` | только bapm        |

Lookup: overrides → process.env → top-level манифеста [`env:`](/guide/config-manifest#manifest-env) (непустое).

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
        BAKED: "{bake:API_TOKEN}"
```

По умолчанию в `.cursor/mcp.json` попадают **прямые** `dependencies.mcp`; transitive — с `--trust-transitive-mcp`.

## Типичные ошибки

| Симптом                                       | Что проверить                                                         |
| --------------------------------------------- | --------------------------------------------------------------------- |
| `must have exactly one source kind`           | Ровно один из `git`\|`id`\|`path`\|`registry`\|`marketplace`\|`local` |
| `MCP env bake failed` / unresolved            | Задайте переменную в окружении или в top-level `env:` перед install   |
| `OpenAPM v0.1 rejects top-level "workspaces"` | Уберите `workspaces` с корня (это не deps)                            |

Сценарий MCP/policy: [Policy и MCP](/guide/situations/policy-mcp).
