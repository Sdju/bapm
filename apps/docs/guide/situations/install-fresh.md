# US-01: Свежий install в Cursor

## Когда …

Новый проект без манифеста и lockfile: нужно завести `bapm.yml` и первый раз материализовать зависимости в Cursor.

### Цель

Получить рабочий `bapm.yml`, lock и deploy в Cursor (skills / rules / agents / MCP при наличии).

### Шаги

1. Убедитесь, что в проекте доступна команда `bapm` (см. [Быстрый старт](/guide/quick-start)).
2. В корне **вашего** проекта:

```bash
bapm init -y --target cursor
```

3. Добавьте зависимости в `dependencies.apm` / `dependencies.mcp` (вручную или через `bapm install <package-ref…>`).
4. Установите. Без `.cursor/` задайте host явно или через `active`:

```bash
bapm install --target cursor
# или в bapm.yml: active: [cursor], затем:
# bapm install
```

Опционально: `bapm install --target cursor --dry-run` — план без записи; `-v` — больше диагностики.

### Ожидаемый результат

- `bapm.yml` с `target: cursor` и/или `active: [cursor]` (или уже существующий манифест без dual-conflict).
- `bapm.lock.yaml` (новый lock по умолчанию) и `apm_modules/`.
- Deploy в Cursor: `.agents/skills/…`, `.cursor/rules/…`, `.cursor/agents/…`, при eligible MCP — `.cursor/mcp.json`.

Подробнее: [манифест](/guide/config-manifest), [install](/reference/install).

### Если не сработало

- `Refusing to init: … already exists` → манифест уже есть; правьте файл, не вызывайте `init` повторно.
- `Both apm.yml and bapm.yml are present` → оставьте один файл.
- `No manifest found` → сделайте `init` или `install <ref>` (создаст минимальный `apm.yml`).
- `Target detection is missing or ambiguous` / нет `.cursor/` → передайте `--target cursor` или задайте `active: [cursor]`.
- Ожидали Claude/Codex как runtime → сейчас runtime install target — **cursor-only**; marketplace outputs — отдельно ([US-06](/guide/situations/marketplace-pack)).
