# Манифест bapm.yml

Канонический конфиг проекта — **`bapm.yml`**. По нему CLI резолвит граф, пишет lock и раскладывает пакеты в выбранный host.

Discovery ищет файл **только в cwd** (без подъёма по родителям). Backcompat-имя `apm.yml` тоже читается, если `bapm.yml` нет.

## Пример на каждый день

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

Создать каркас:

```bash
bapm init -y --target cursor
```

| Поле               | Зачем                                                         |
| ------------------ | ------------------------------------------------------------- |
| `name` / `version` | Обязательны                                                   |
| `target`           | Предпочитаемый host (`cursor`); **сам по себе не активирует** |
| `active`           | Явный список host id для активации                            |
| `env`              | Bake-defaults для MCP placeholders (**bapm-расширение**)      |
| `dependencies.apm` | Пакеты агента                                                 |
| `dependencies.mcp` | MCP; в Cursor по умолчанию деплоятся **прямые** записи        |

Подробнее формы deps и MCP bake: [Зависимости](/guide/manifest-dependencies).

## Top-level `env:` (bake defaults) {#manifest-env}

Опциональная карта **строка → строка** на корне `bapm.yml` / `apm.yml`. Это **bapm-расширение** (не требование OpenAPM): подставляет значения в MCP placeholders при install bake, когда в process env имени нет.

Ключи — имена переменных окружения: `[A-Za-z_][A-Za-z0-9_]*`. Значения — обычные строки (без вложенного bake в v1).

```yaml
name: my-project
version: 0.1.0
env:
  PLUGIN_TOKEN: "from-yml"
dependencies:
  mcp:
    - name: my-server
      registry: false
      transport: stdio
      command: echo
      args: ["--ok"]
      env:
        TOKEN: "{bake:PLUGIN_TOKEN}"
```

**Precedence при bake:** явные overrides (если переданы) → непустое **process.env** → непустое top-level **`env`**. Process/CI выигрывает; `env:` только «доопределяет» пробелы.

**Не путать:**

| Поле | Где | Зачем |
| ---- | --- | ----- |
| Top-level `env:` | корень манифеста | defaults для `{bake:NAME}` / `${VAR}` |
| `dependencies.mcp[].env` | у MCP-сервера | env map сервера (может содержать placeholders) |
| `bapm.local.yml` → `env` | overlay | deep-merge поверх base `env` (local wins) |

Не коммитьте секреты в git через `env:`. Для личных/секретных значений предпочитайте process env или [personal overlay](/guide/manifest-overlay) (`bapm.local.yml` в `.gitignore`).

## Когда править вручную

| Задача                         | Как                                         |
| ------------------------------ | ------------------------------------------- |
| Новый проект                   | `bapm init -y --target cursor`              |
| Добавить пакет                 | `bapm install <package-ref…>` (или `--dev`) |
| Убрать пакет                   | `bapm uninstall …`                          |
| Path/git/MCP, `name`/`version` | Правка YAML → `bapm install`                |

## Host: `active` и `--target`

Порядок выбора host на install / compile:

1. `--target <id>` (force; игнорирует `active` и detect)
2. `bapm.local.yml` → `active`
3. базовый манифест → `active`
4. sole auto-detect
5. fail-closed

Приоритет коротко: `--target` → `active` → detect.

```yaml
active:
  - cursor
```

Пустой `active: []` — отказ parse. Поле `target` / `targets` **не само по себе активирует** hosts — без `--target`, без `active` и без detect команда попросит указать host.

Object-map (**bapm-расширение**): host id → npm-пакет или локальный путь. Для multi-host предпочтительнее `targets`:

```yaml
targets:
  cursor: "@bapm/integration-cursor"
  pi: "./agents/integration/pi-agent"
```

При наличии map CLI загружает и регистрирует значения до выбора host; map сам по себе host не активирует.

Пользовательский обзор: [Поддерживаемые hosts](/guide/supported-hosts). Полная карта полей: [Hosts и target](/guide/manifest-hosts).

## Personal overlay: `bapm.local.yml`

Опциональный персональный файл рядом с манифестом (не в git). Allowlist: `active`, `target` / `targets`, `env`, `registries`.

Precedence: CLI flags (`--target`, …) → `bapm.local.yml` → base `bapm.yml` / `apm.yml`.

Это **не** source discriminator `local:` у зависимостей.

Подробности: [Personal overlay](/guide/manifest-overlay).

## Дальше по темам

| Тема                                         | Страница                                       |
| -------------------------------------------- | ---------------------------------------------- |
| Формы `dependencies.apm` / MCP bake          | [Зависимости](/guide/manifest-dependencies)    |
| Cursor и кастомные интеграции                | [Поддерживаемые hosts](/guide/supported-hosts) |
| `target` / `targets` / `active` / object-map | [Hosts](/guide/manifest-hosts)                 |
| `bapm.local.yml`                             | [Overlay](/guide/manifest-overlay)             |
| `registries`, `marketplace:`                 | [Registries](/guide/manifest-registries)       |

## Типичные ошибки

| Симптом                                        | Что проверить                             |
| ---------------------------------------------- | ----------------------------------------- |
| `No manifest found`                            | Нет `bapm.yml` / `apm.yml` в cwd → `init` |
| `Manifest requires "name"` / `"version"`       | Добавьте оба поля                         |
| `Target detection is missing or ambiguous`     | `--target cursor` или `active: [cursor]`  |
| `Manifest "active" must be a non-empty array`  | Уберите пустой `active: []`               |
| `must not declare both "target" and "targets"` | Оставьте одно из полей                    |

Lock рядом: [Lock-файл](/guide/lockfile). Init: [init](/reference/init).
