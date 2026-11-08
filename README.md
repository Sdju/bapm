# bapm

> **Ранний релиз.** Формат файлов и поведение команд могут меняться без смены major-версии. Большая часть кода перенесена из [microsoft/apm](https://github.com/microsoft/apm) с помощью AI и пока не прошла полноценное ревью. Не для production.

**Better Agent Package Manager** — менеджер пакетов для конфигурации AI-агентов. Skills, rules, описания агентов и MCP-серверы объявляются в `bapm.yml`, а `bapm install` скачивает их, фиксирует версии в lock-файле и раскладывает туда, где их читает ваш агент.

**Документация:** [sdju.github.io/bapm](https://sdju.github.io/bapm/)

## Зачем

- **Одинаковый агент у всей команды.** Набор skills и MCP хранится в git, версии закреплены lock-файлом.
- **Командное и личное раздельно.** Общий `bapm.yml` и личный `bapm.local.yml` (не в git) с вашим агентом и вашими значениями переменных.
- **Пресеты.** Именованные наборы пакетов, которые каждый включает под свою задачу.
- **Несколько агентов на одном проекте.** Cursor, Claude Code, Codex, Copilot и другие получают один и тот же набор пакетов, каждый в своём формате; один install может разложить файлы сразу для нескольких агентов.
- **Переменные в MCP-конфигах.** Токены и адреса пишутся как `${VAR}` и берутся из окружения или личного файла.
- **Воспроизводимый CI** через `bapm install --frozen`.
- **Контроль исполняемого кода.** MCP-серверы и `bin/` из зависимостей не ставятся без явного согласия: разрешения в `bapm.yml`, личные `approve` / `deny` и запрещающая политика проекта или организации.
- **Приватные registry** (экспериментально, `BAPM_EXPERIMENTAL_REGISTRIES=1`).

Сам bapm тоже использует bapm: skills, субагенты и команды репозитория лежат в `.apm/`, а `bapm install` раскладывает их для Cursor. Развёрнутые файлы в git не коммитятся — после клона выполните `pnpm run -r build && pnpm run agents:install`. Как это устроено — в [CONTRIBUTING](CONTRIBUTING.md#конфигурация-агентов).

## Быстрый старт

Нужен Node.js 22.12 или новее.

```bash
npm i -D @b-apm/cli @b-apm/integration-cursor
npx bapm init -y --target cursor
```

Добавьте зависимости в `bapm.yml`:

```yaml
name: my-project
version: 0.1.0
dependencies:
  apm:
    - acme/agent-skills # репозиторий на GitHub
    - git: https://github.com/acme/monorepo
      path: skills/review # подкаталог репозитория
    - path: ./tools/team-skills # локальный каталог
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

```bash
npx bapm install
```

Для Cursor skills окажутся в `.agents/skills/`, rules, агенты и MCP — в `.cursor/`, версии — в `bapm.lock.yaml`. Для другого агента поставьте его интеграцию (`@b-apm/integration-claude`, `-codex`, `-copilot`…) и укажите его id: [поддерживаемые агенты](https://sdju.github.io/bapm/guide/supported-hosts).

`init --target cursor` записывает активацию в `active` и не создаёт блок `targets`. Поле `targets` добавляют вручную только для своей интеграции; помните, что оно ограничивает раскладку перечисленными агентами.

## Файлы

| Файл                   | Назначение                    | В git |
| ---------------------- | ----------------------------- | ----- |
| `bapm.yml`             | Манифест зависимостей         | да    |
| `bapm.lock.yaml`       | Зафиксированные версии и хеши | да    |
| `bapm.local.yml`       | Личные настройки              | нет   |
| `bapm.local.lock.yaml` | Lock личных пакетов           | нет   |
| `apm_modules/`         | Скачанные пакеты              | нет   |

## Документация

| Раздел                                                                     | О чём                                |
| -------------------------------------------------------------------------- | ------------------------------------ |
| [Как работает bapm](https://sdju.github.io/bapm/guide/)                    | Манифест, lock, агенты и интеграции  |
| [Быстрый старт](https://sdju.github.io/bapm/guide/quick-start)             | Первый install                       |
| [Сценарии](https://sdju.github.io/bapm/guide/situations/)                  | Команда, CI, обновления, MCP         |
| [Манифест](https://sdju.github.io/bapm/guide/config-manifest)              | Поля `bapm.yml`, пресеты, переменные |
| [Поддерживаемые агенты](https://sdju.github.io/bapm/guide/supported-hosts) | Пакеты и пути для каждого агента     |
| [Справка](https://sdju.github.io/bapm/reference/)                          | Флаги команд                         |
| [Совместимость с APM](https://sdju.github.io/bapm/guide/conformance)       | Чем bapm отличается от microsoft/apm |
| [Архитектура](https://sdju.github.io/bapm/architecture/)                   | Для контрибьюторов                   |

## Связанные проекты

- [microsoft/apm](https://github.com/microsoft/apm) — исходный APM. bapm читает его формат, но CLI отличается.
- [Agent Plugins](https://github.com/Sdju/agent-plugins) — переносимый формат плагинов агента; см. [Agent Plugins](https://sdju.github.io/bapm/guide/agent-plugins).
