# US-06: Marketplace pack (Claude / Codex)

## Когда …

Нужны **host marketplace outputs** (`marketplace.json` для Claude и/или Codex) и/или plain-zip archive — без ожидания, что Claude/Codex станут runtime install target как Cursor.

### Цель

Эмитнуть marketplace JSON (и опционально zip) из блока `marketplace:` в манифесте; не смешивать с `bapm install --target …`.

### Шаги

1. Заведите или дополните authoring-блок в манифесте:

```bash
bapm marketplace init
# пакеты в marketplace::
bapm marketplace package add …
bapm marketplace check
```

Подробнее: [marketplace](/reference/marketplace), поле `marketplace:` в [Registries](/guide/manifest-registries).

2. Превью без durable writes:

```bash
bapm pack --dry-run
```

3. Эмит marketplace JSON (по умолчанию — все configured hosts; фильтр `claude` / `codex`):

```bash
bapm pack --marketplace all
# только Claude:
bapm pack --marketplace claude
# свой путь:
bapm pack --marketplace-path claude=./out/claude-marketplace.json
```

4. При необходимости plain zip рядом:

```bash
bapm pack --archive
```

5. Gate версий tag↔manifest без создания tags:

```bash
bapm pack --check-release
```

### Ожидаемый результат

- При `marketplace:` и выбранных outputs появляются Claude/Codex `marketplace.json` (не runtime deploy в `.cursor/`).
- Marketplace-only проект (без `dependencies:`) эмитит JSON и **пропускает** пустой zip.
- `--agent-plugins` пакует portable Agent Plugins root и **не** эмитит marketplace; нужен root `plugin.json`.

Флаги: [pack](/reference/pack). Runtime install по-прежнему: [US-01](/guide/situations/install-fresh) с `--target cursor`.

### Если не сработало

- Нет `marketplace:` → добавьте через `marketplace init` / правку YAML.
- Ожидали `install --target claude|codex` → **не** shipped как runtime; Claude/Codex — marketplace-output integrations.
- Secret-pattern paths (`.env`, `*.pem`, …) → pack отказывается (sc-007).
- Remote resolve без сети → `--offline` fail closed, если сеть нужна.
- `--check-release` не пушит и не создаёт tags — только gate.
