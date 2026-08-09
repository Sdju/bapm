# US: Команда с разными агентами

## Когда …

Общий репозиторий зависимостей агента; у Vasya — Cursor, у Masha — Claude. Не хочется конфликтовать в `bapm.yml` из‑за `active`.

### Цель

Agent-neutral base-манифест + личный выбор host через `bapm.local.yml`.

### Шаги

1. В git — общий `bapm.yml` с `dependencies` (без обязательного `active` под одного человека).
2. Каждый разработчик ставит свой `@bapm/integration-*`.
3. Личный overlay (в `.gitignore`):

```yaml
# Vasya — bapm.local.yml
active:
  - cursor
```

```yaml
# Masha — bapm.local.yml
active:
  - claude
```

4. `bapm install` — local `active` заменяет base `active`.

### Ожидаемый результат

Одинаковый граф зависимостей; разный layout агента. Overlay не уезжает в pack/publish.

Подробнее: [Personal overlay](/guide/manifest-overlay), [host selection](/guide/host-selection).

### Если не сработало

Несколько detect без `active` → fail-closed; задайте local `active` или `--target`.
