# bapm

**Better Agent Package Manager** — менеджер зависимостей для конфигурации AI-агентов: объявляете пакеты в `bapm.yml`, `bapm install` разрешает граф, пишет lock и раскладывает skills, rules, agents и MCP туда, где их подхватит агент.

CLI и host-интеграции ставятся **отдельно**. Для известных hosts достаточно установить `@bapm/integration-<id>` — object-map `targets:` не обязателен (canonical fallback). Map — чтобы подменить пакет или добавить свой host.

## Установка

Нужен **Node.js ≥ 22.12**.

**1. CLI + интеграция (глобально или в проекте):**

```bash
npm i -g @bapm/cli @bapm/integration-cursor
# или: pnpm add -g @bapm/cli @bapm/integration-cursor
```

**2. Happy path** — в проекте с `.cursor/` и `bapm.yml`:

```bash
bapm install
```

| Агент      | Что сделать                                                                 |
| ---------- | --------------------------------------------------------------------------- |
| **Cursor** | `npm i -D @bapm/integration-cursor`, detect или `active` / `--target cursor` |
| **Свой**   | npm/path модуль + `targets:` + `--target <id>`                              |

Подробности: [поддерживаемые hosts](apps/docs/guide/supported-hosts.md), [выбор host](apps/docs/guide/host-selection.md).

Pin CLI в проекте: `npm i -D @bapm/cli`, затем `npx bapm`.

## Быстрый пример

```bash
npm i -g @bapm/cli @bapm/integration-cursor
# cwd с .cursor/ и bapm.yml
bapm install
# или force:
bapm install --target cursor
```

## Артефакты

| Артефакт                                                                   | Назначение               |
| -------------------------------------------------------------------------- | ------------------------ |
| `bapm.yml`                                                                 | Манифест зависимостей    |
| `bapm.lock.yaml`                                                           | Зафиксированный граф     |
| `apm_modules/`                                                             | Материализованные пакеты |
| `.agents/skills/`, `.cursor/rules/`, `.cursor/agents/`, `.cursor/mcp.json` | Деплой в Cursor          |

## Документация

| Раздел               | Ссылка                                                        |
| -------------------- | ------------------------------------------------------------- |
| Быстрый старт        | [guide/quick-start](apps/docs/guide/quick-start.md)           |
| Как выбирается host  | [guide/host-selection](apps/docs/guide/host-selection.md)     |
| Поддерживаемые hosts | [guide/supported-hosts](apps/docs/guide/supported-hosts.md)   |
| Что умеет bapm       | [guide/](apps/docs/guide/index.md)                            |
| Команды              | [guide/commands](apps/docs/guide/commands.md)                 |
| Манифест `bapm.yml`  | [guide/config-manifest](apps/docs/guide/config-manifest.md)   |
| Lock-файл            | [guide/lockfile](apps/docs/guide/lockfile.md)                 |
| Сценарии             | [guide/situations/](apps/docs/guide/situations/index.md)      |
| Справка по флагам    | [reference/](apps/docs/reference/index.md)                    |
| Agent Plugins        | [guide/agent-plugins](apps/docs/guide/agent-plugins.md)       |
| Архитектура          | [architecture/](apps/docs/architecture/index.md)              |

## Ключевое

- Канонический манифест — `bapm.yml`.
- Runtime host — opt-in пакет `@bapm/integration-*`; selection: `--target` → local `active` → base `active` → sole detect.
- `targets:` — override/add impl, не активация host.
- Lock + install — воспроизводимый граф; в CI — `--frozen` / env `CI`.
- MCP — bake env-плейсхолдеров на install; policy approve/deny для исполняемого MCP.
