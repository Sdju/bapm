# bapm

> **UNSTABLE:** ранний публичный релиз. API и on-disk layout могут меняться без major bump. Не для production.

**Better Agent Package Manager** — менеджер зависимостей для конфигурации AI-агентов: объявляете пакеты в `bapm.yml`, `bapm install` разрешает граф, пишет lock и раскладывает skills, rules, agents и MCP туда, где их подхватит агент. Воспринимайте его как npm / pip для вашего агента.

Зачем?

- Устанавливайте легко и быстро зависимости для вашего агента
- Подключайте корпоративные модули из private registry (**experimental**, нужна переменная `BAPM_EXPERIMENTAL_REGISTRIES=1`)
- Разделяйте возможности агента для всей команды и ваши личные (`bapm.yml` + `bapm.local.yml`)
- Используйте разные агенты на одном проекте и переиспользуйте общие MCP / Skills / Instructions
- Общий манифест и lock для hosts; on-disk layout у каждого агента свой
- Настраивайте корпоративные политики для агентов в вашей компании

```yml
name: project
version: 1.0.0
dependencies:
  apm:
    - mycompany/ai-tools # github shorthand → org/repo
    - git: https://github.com/anthropics/skills
      path: skills/frontend-design # подкаталог в репозитории (virtual path)
    - path: ./my/local-plugin # локальный пакет
  mcp:
    - name: github
      registry: false
      transport: http
      url: https://api.githubcopilot.com/mcp/
      env:
        API_TOKEN: "${API_TOKEN}"
```

После `bapm install` выбранный host получает поддерживаемые примитивы. То, чего host не умеет, **пропускается с диагностикой** (без тихой «замены» на другой тип). Сводку instructions / skills в markdown даёт отдельно `bapm compile` (например `AGENTS.md` у Cursor).

CLI и host-интеграции ставятся **отдельно**. Для известных hosts достаточно установить `@b-apm/integration-<id>` — object-map `targets:` не обязателен (canonical fallback). Map — чтобы подменить пакет или добавить свой host. Возможности hosts различаются — см. [supported-hosts](apps/docs/guide/supported-hosts.md).

## Установка

Нужен **Node.js ≥ 22.12**.

**1. CLI + интеграция (глобально или в проекте):**

> **UNSTABLE:** пакеты на npm, но релиз ранний — не для production.

```bash
npm i -g @b-apm/cli @b-apm/integration-cursor
# или: pnpm add -g @b-apm/cli @b-apm/integration-cursor
```

Вместо `@b-apm/integration-cursor` можно взять другой `@b-apm/integration-*` (например `@b-apm/integration-claude`) или свой пакет интеграции — набор поддерживаемых артефактов у hosts разный.

Подробности: [поддерживаемые hosts](apps/docs/guide/supported-hosts.md), [выбор host](apps/docs/guide/host-selection.md).

**2. Happy path** — в проекте с `.cursor/` и `bapm.yml`:

```bash
bapm install
```

Артефакты материализуются в `apm_modules/`, пишется lock; для Cursor skills обычно уходят в `.agents/skills/`, rules / agents / MCP — в `.cursor/`.

## Быстрый пример

```bash
npm i -g @b-apm/cli @b-apm/integration-cursor
# cwd с .cursor/ и bapm.yml
bapm install
# или force без предварительного .cursor/:
bapm install --target cursor
```

## Артефакты

| Артефакт         | Назначение                      |
| ---------------- | ------------------------------- |
| `bapm.yml`       | Манифест зависимостей           |
| `bapm.local.yml` | Локальный overlay (личный слой) |
| `bapm.lock.yaml` | Зафиксированный граф            |
| `apm_modules/`   | Материализованные пакеты        |

## Документация

| Раздел               | Ссылка                                                      |
| -------------------- | ----------------------------------------------------------- |
| Быстрый старт        | [guide/quick-start](apps/docs/guide/quick-start.md)         |
| Как выбирается host  | [guide/host-selection](apps/docs/guide/host-selection.md)   |
| Поддерживаемые hosts | [guide/supported-hosts](apps/docs/guide/supported-hosts.md) |
| Что умеет bapm       | [guide/](apps/docs/guide/index.md)                          |
| Команды              | [guide/commands](apps/docs/guide/commands.md)               |
| Манифест `bapm.yml`  | [guide/config-manifest](apps/docs/guide/config-manifest.md) |
| Lock-файл            | [guide/lockfile](apps/docs/guide/lockfile.md)               |
| Сценарии             | [guide/situations/](apps/docs/guide/situations/index.md)    |
| Справка по флагам    | [reference/](apps/docs/reference/index.md)                  |
| Agent Plugins        | [guide/agent-plugins](apps/docs/guide/agent-plugins.md)     |
| Архитектура          | [architecture/](apps/docs/architecture/index.md)            |

## Связанные проекты

- [microsoft/apm](https://github.com/microsoft/apm) — исходный APM; bapm — совместимый менеджер с другим UX и архитектурой
- [Agent Plugins](https://github.com/Sdju/agent-plugins) — runtime/плагины агента; пересечение с bapm описано в [guide/agent-plugins](apps/docs/guide/agent-plugins.md)

## Предупреждение

bapm — переписывание [microsoft/apm](https://github.com/microsoft/apm) с другой архитектурой и UX. Большая часть кода и документации перенесена с помощью AI и **пока недостаточно отревьюена**, чтобы считать проект готовым к продакшену.
