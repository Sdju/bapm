# bapm

**Better Agent Package Manager** — менеджер зависимостей для конфигурации AI-агентов: объявляете пакеты в `bapm.yml`, `bapm install` разрешает граф, пишет lock и раскладывает skills, rules, agents и MCP туда, где их подхватит агент. Воспринимайте его как npm / pip для вашего агента.

Зачем?

- Устанавливайте легко и быстро любые зависимости для вашего агента
- Подключайте корпоративные модули из вашего private registry
- Разделяйте возможности агента для всей команды и ваши личные
- Используйте различные агенты на 1 проекте не думая как переиспользовать общие MCP/Skills/Instructions...
- Настраивайте корпоративные политики для агентов в вашей компании

Почему не amp?

- Нет привязки к конкретному агенту, используйте отдельные интеграционные пакеты под ваши потребности
- Есть возможность интеграции с кастомными агентами
- Заточен под командную работу, особый контроль над разделением личных и командых артефактов
- Более продвинутая система работы
- SOON: Поддержка кастомных артефактов или паттернов для агентов
- SOON: Система плагинов для расширения функционала bapm

CLI и host-интеграции ставятся **отдельно**. Для известных hosts достаточно установить `@bapm/integration-<id>` — object-map `targets:` не обязателен (canonical fallback). Map — чтобы подменить пакет или добавить свой host.

## Установка

Нужен **Node.js ≥ 22.12**.

**1. CLI + интеграция (глобально или в проекте):**

> !WARNING: на данный момент пакеты не доступны в npm. Примеры ниже демонстрационные и будут доступны только после первого релиза.

```bash
npm i -g @bapm/cli @bapm/integration-cursor
# или: pnpm add -g @bapm/cli @bapm/integration-cursor
```

Вместо @bapm/integration-cursor можно использовать любой другой интеграционный пакет, например @bapm/integration-claude... Или использовать свой собственный пакет для интеграции с вашим агентом.

Подробности: [поддерживаемые hosts](apps/docs/guide/supported-hosts.md), [выбор host](apps/docs/guide/host-selection.md).

**2. Happy path** — в проекте с `.cursor/` и `bapm.yml`:

```bash
bapm install
```

И все. Артефакты будут разложены в `.cursor/` и `apm_modules/` соответственно.

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
