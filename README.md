# bapm

**Better Agent Package Manager** — менеджер зависимостей для конфигурации AI-агентов.

Объявляете пакеты в манифесте (`bapm.yml`), запускаете `bapm install` — bapm разрешает граф, пишет lock-файл и раскладывает skills, rules, agents и MCP в проект (сейчас — в **Cursor**).

Совместим с wire-форматами [OpenAPM](https://github.com/microsoft/apm) / APM, но **не** drop-in замена всей CLI microsoft/apm.

## Предупреждение

Данный проект является переработкой репозитория [microsoft/apm](https://github.com/microsoft/apm) с целью упрощения поддержки различных платформ (Cursor, Claude, Codex) и более гибких и универсальных сценариев при мультиагентной работе. Миграция и контроль над кодом целиком осуществяется посредством AI-агентами.

Данный проект еще не прошел достаточное ревьб для использования в продакшене

## Установка

Нужен **Node.js ≥ 22.12**.

В корне вашего проекта:

```bash
pnpm add -D @bapm/cli
# или: npm i -D @bapm/cli
```

Проверка:

```bash
pnpm exec bapm --help
# или: npx bapm --help
```

## Быстрый старт

```bash
bapm init -y --target cursor
bapm install --target cursor
```

Типичный результат:

| Артефакт | Назначение |
| --- | --- |
| `bapm.yml` | Манифест зависимостей |
| `bapm.lock.yaml` | Зафиксированный граф |
| `apm_modules/` | Материализованные пакеты |
| `.agents/skills/`, `.cursor/rules/`, `.cursor/agents/`, `.cursor/mcp.json` | Деплой в Cursor |

Подробный проход: [быстрый старт](apps/docs/guide/quick-start.md).

## Ключевые моменты

- **Канонический манифест** — `bapm.yml`; `apm.yml` — backcompat-подмножество. Оба сразу — ошибка, merge нет.
- **Runtime install сегодня cursor-only** (`--target cursor`). Claude/Codex — для marketplace-pack, не как host install.
- **Lock + install** — воспроизводимый граф для локальной работы и CI (`--frozen` / env `CI`).
- **MCP** — bake env-плейсхолдеров на install; политика approve/deny для исполняемого MCP.
- **OpenAPM Consumer / Producer / Governance** — заявленный класс совместимости; детали и limitations: [CONFORMANCE.md](CONFORMANCE.md).
- **Agent Plugins v1** — узкая portable-граница (`plugin.json` + skills + `mcp.json`): [AGENT_PLUGINS_COMPATIBILITY.md](AGENT_PLUGINS_COMPATIBILITY.md).

## Документация

| Раздел | Ссылка |
| --- | --- |
| Обзор возможностей | [guide/](apps/docs/guide/index.md) |
| Быстрый старт | [guide/quick-start](apps/docs/guide/quick-start.md) |
| Команды | [guide/commands](apps/docs/guide/commands.md) |
| Манифест `bapm.yml` | [guide/config-manifest](apps/docs/guide/config-manifest.md) |
| Lock-файл | [guide/lockfile](apps/docs/guide/lockfile.md) |
| Сценарии | [guide/situations/](apps/docs/guide/situations/index.md) |
| Справка по флагам | [reference/](apps/docs/reference/index.md) |
| Совместимость / OpenAPM | [guide/conformance](apps/docs/guide/conformance.md) · [CONFORMANCE.md](CONFORMANCE.md) |
| Agent Plugins | [guide/agent-plugins](apps/docs/guide/agent-plugins.md) · [матрица](AGENT_PLUGINS_COMPATIBILITY.md) |
| Архитектура (для контрибьюторов) | [architecture/](apps/docs/architecture/index.md) · [CONTRIBUTING.md](CONTRIBUTING.md) |

Сайт документации публикуется на **GitHub Pages** из `apps/docs` (после настройки Pages в репозитории).

## Связанные проекты

- [microsoft/apm](https://github.com/microsoft/apm) — референсный APM / OpenAPM
- [Agent Plugins](https://agent-plugins.org/) — portable-формат skills + MCP
