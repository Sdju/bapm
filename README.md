# bapm

**Better Agent Package Manager** — менеджер зависимостей для конфигурации AI-агентов: объявляете пакеты в `bapm.yml`, `bapm install` разрешает граф, пишет lock и раскладывает skills, rules, agents и MCP туда, где их подхватит агент.

CLI и host-интеграции ставятся **отдельно**. Cursor — через `@bapm/integration-cursor` и object-map `targets:`. Свой агент — npm-пакет или локальный модуль по тому же контракту.

## Установка

Нужен **Node.js ≥ 22.12**.

**1. CLI (глобально):**

```bash
npm i -g @bapm/cli
# или: pnpm add -g @bapm/cli
```

**2. Интеграция с вашим агентом** — без неё `install` некуда раскладывать пакеты.

| Агент      | Что сделать                                                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Cursor** | `npm i -g @bapm/integration-cursor` (или `npm i -D` в проекте), объявить `targets:` / `active`, затем `bapm install --target cursor` |
| **Свой**   | Поставить npm-пакет или положить локальный модуль, объявить в `targets:`, затем `--target <id>`                                      |

Пример для Cursor:

```bash
npm i -g @bapm/cli @bapm/integration-cursor
```

```yaml
targets:
  cursor: "@bapm/integration-cursor"
active:
  - cursor
```

Подробности, кастомные интеграции и скрипты: [поддерживаемые hosts](apps/docs/guide/supported-hosts.md).

Pin CLI в проекте (редко): `npm i -D @bapm/cli`, затем `npx bapm`.

## Быстрый пример

```bash
bapm init -y --target cursor
# убедитесь, что @bapm/integration-cursor установлен
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

| Раздел               | Ссылка                                                      |
| -------------------- | ----------------------------------------------------------- |
| Быстрый старт        | [guide/quick-start](apps/docs/guide/quick-start.md)         |
| Поддерживаемые hosts | [guide/supported-hosts](apps/docs/guide/supported-hosts.md) |
| Что умеет bapm       | [guide/](apps/docs/guide/index.md)                          |
| Команды              | [guide/commands](apps/docs/guide/commands.md)               |
| Манифест `bapm.yml`  | [guide/config-manifest](apps/docs/guide/config-manifest.md) |
| Lock-файл            | [guide/lockfile](apps/docs/guide/lockfile.md)               |
| Сценарии             | [guide/situations/](apps/docs/guide/situations/index.md)    |
| Справка по флагам    | [reference/](apps/docs/reference/index.md)                  |
| Agent Plugins        | [guide/agent-plugins](apps/docs/guide/agent-plugins.md)     |
| Архитектура          | [architecture/](apps/docs/architecture/index.md)            |

## Ключевое

- Канонический манифест — `bapm.yml`.
- Runtime host — opt-in: пакет интеграции + object-map `targets:` + `--target <id>` / `active` / detect.
- Claude/Codex — marketplace-pack (`bapm pack`), не runtime install; пакеты `@bapm/integration-claude` / `@bapm/integration-codex` тоже opt-in.
- Lock + install — воспроизводимый граф; в CI — `--frozen` / env `CI`.
- MCP — bake env-плейсхолдеров на install; policy approve/deny для исполняемого MCP.

## APM compatible

Совместим с wire-форматами OpenAPM / APM. Детали и границы: [Совместимость](apps/docs/guide/conformance.md) · [`CONFORMANCE.md`](CONFORMANCE.md).

## Связанные проекты

- [microsoft/apm](https://github.com/microsoft/apm) — референсный APM / OpenAPM
- [Agent Plugins](https://agent-plugins.org/) — portable-формат skills + MCP

## Предупреждение

Проект — переработка [microsoft/apm](https://github.com/microsoft/apm) с упором на гибкие сценарии и поддержку хостов. Миграция и контроль кода во многом через AI-агентов. Для продакшена ревью ещё недостаточно.
