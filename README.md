# bapm

> **UNSTABLE:** ранний публичный релиз. API и on-disk layout могут меняться без major bump. Не для production.

**Better Agent Package Manager** — менеджер зависимостей для конфигурации AI-агентов: объявляете пакеты в `bapm.yml`, `bapm install` разрешает граф, пишет lock и раскладывает skills, rules, agents и MCP туда, где их подхватит агент. Воспринимайте его как npm / pip для вашего агента.

**Документация:** [sdju.github.io/bapm](https://sdju.github.io/bapm/)

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

CLI и host-интеграции ставятся **отдельно**. Для известных hosts достаточно установить `@b-apm/integration-<id>` — object-map `targets:` не обязателен (canonical fallback). Map — чтобы подменить пакет или добавить свой host. Возможности hosts различаются — см. [supported-hosts](https://sdju.github.io/bapm/guide/supported-hosts).

## Установка

Нужен **Node.js ≥ 22.12**.

**1. CLI + интеграция (глобально или в проекте):**

> **UNSTABLE:** пакеты на npm, но релиз ранний — не для production.

```bash
npm i -g @b-apm/cli @b-apm/integration-cursor
# или: pnpm add -g @b-apm/cli @b-apm/integration-cursor
```

Вместо `@b-apm/integration-cursor` можно взять другой `@b-apm/integration-*` (например `@b-apm/integration-claude`) или свой пакет интеграции — набор поддерживаемых артефактов у hosts разный.

Подробности: [поддерживаемые hosts](https://sdju.github.io/bapm/guide/supported-hosts), [выбор host](https://sdju.github.io/bapm/guide/host-selection).

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

Сайт: [https://sdju.github.io/bapm/](https://sdju.github.io/bapm/)

| Раздел               | Ссылка                                                                                   |
| -------------------- | ---------------------------------------------------------------------------------------- |
| Быстрый старт        | [guide/quick-start](https://sdju.github.io/bapm/guide/quick-start)                       |
| Как выбирается host  | [guide/host-selection](https://sdju.github.io/bapm/guide/host-selection)                 |
| Поддерживаемые hosts | [guide/supported-hosts](https://sdju.github.io/bapm/guide/supported-hosts)               |
| Что умеет bapm       | [guide/](https://sdju.github.io/bapm/guide/)                                             |
| Команды              | [guide/commands](https://sdju.github.io/bapm/guide/commands)                             |
| Манифест `bapm.yml`  | [guide/config-manifest](https://sdju.github.io/bapm/guide/config-manifest)               |
| Lock-файл            | [guide/lockfile](https://sdju.github.io/bapm/guide/lockfile)                             |
| Сценарии             | [guide/situations/](https://sdju.github.io/bapm/guide/situations/)                       |
| Справка по флагам    | [reference/](https://sdju.github.io/bapm/reference/)                                     |
| Agent Plugins        | [guide/agent-plugins](https://sdju.github.io/bapm/guide/agent-plugins)                   |
| Архитектура          | [architecture/](https://sdju.github.io/bapm/architecture/)                               |

## Связанные проекты

- [microsoft/apm](https://github.com/microsoft/apm) — исходный APM; bapm — совместимый менеджер с другим UX и архитектурой
- [Agent Plugins](https://github.com/Sdju/agent-plugins) — runtime/плагины агента; пересечение с bapm описано в [guide/agent-plugins](https://sdju.github.io/bapm/guide/agent-plugins)

## Предупреждение

bapm — переписывание [microsoft/apm](https://github.com/microsoft/apm) с другой архитектурой и UX. Большая часть кода и документации перенесена с помощью AI и **пока недостаточно отревьюена**, чтобы считать проект готовым к продакшену.
