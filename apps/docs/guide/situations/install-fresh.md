# US-01: Свежий install в Cursor

## Когда …

Новый проект без манифеста и lockfile: нужно завести `bapm.yml` и первый раз материализовать зависимости в Cursor.

::: warning UNSTABLE
Ранний публичный релиз на npm. Команды `npm i` рабочие, но релиз нестабильный. См. [быстрый старт](/guide/quick-start).
:::

### Цель

Получить рабочий `bapm.yml`, lock и deploy в Cursor (skills / rules / agents / MCP при наличии) — **без** обязательного object-map `targets:`.

### Шаги

1. Установите CLI и интеграцию вместе (`npm i -g` или `-D` — [Быстрый старт](/guide/quick-start)).
2. В корне проекта:

```bash
npm i -D @b-apm/integration-cursor
mkdir -p .cursor   # если ещё нет маркера Cursor
# минимальный манифест (или bapm init -y --target cursor — scaffold с pin)
```

Пример `bapm.yml` без map:

```yaml
name: my-agent-project
version: 0.0.1
dependencies:
  apm: []
  mcp: []
```

3. Добавьте зависимости в `dependencies.apm` / `dependencies.mcp`.
4. Установите:

```bash
bapm install
# force при необходимости:
# bapm install --target cursor
```

Опционально: `--dry-run`, `-v`.

### Ожидаемый результат

- Lock и `apm_modules/`.
- Deploy в Cursor: `.agents/skills/…`, `.cursor/rules/…`, `.cursor/agents/…`, при eligible MCP — `.cursor/mcp.json`.

Подробнее: [host selection](/guide/host-selection), [install](/reference/install).

### Если не сработало

| Симптом                    | Что сделать                         |
| -------------------------- | ----------------------------------- |
| пакет / integration-cursor | `npm i -D @b-apm/integration-cursor` |
| ambiguous detect           | `--target cursor` или `active`      |
| нет манифеста              | создайте `bapm.yml` или `bapm init` |
