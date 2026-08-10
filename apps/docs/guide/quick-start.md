# Быстрый старт

Цель: поставить CLI и пакет интеграции, затем `bapm install` — агент находится сам, артефакты попадают в layout Cursor.

::: warning UNSTABLE
Ранний публичный релиз на npm. API и layout могут меняться без major bump. **Не для production.**
:::

## Happy path (Cursor, без `targets:`)

Нужен Node.js ≥ 22.12.

**1. CLI + интеграция** (глобально или в проекте):

```bash
npm i -g @b-apm/cli @b-apm/integration-cursor
# или: pnpm add -g @b-apm/cli @b-apm/integration-cursor
# или в проекте: npm i -D @b-apm/cli @b-apm/integration-cursor
```

Вместо `@b-apm/integration-cursor` можно взять другой `@b-apm/integration-*` или свой пакет интеграции. См. [поддерживаемые hosts](/guide/supported-hosts), [выбор host](/guide/host-selection).

**2. Проект с `.cursor/` и `bapm.yml`:**

```bash
mkdir my-agent && cd my-agent
mkdir -p .cursor

cat > bapm.yml <<'EOF'
name: my-agent-project
version: 0.0.1
dependencies:
  apm: []
  mcp: []
EOF

bapm install
```

И всё. Артефакты материализуются в `apm_modules/`, пишется lock; для Cursor skills обычно уходят в `.agents/skills/`, rules / agents / MCP — в `.cursor/`.

Что происходит:

1. CLI находит агента (**detect**: каталог `.cursor/` или legacy `.cursorrules`).
2. Для известного host id подтягивается **стандартный** пакет `@b-apm/integration-cursor` (canonical fallback; object-map `targets:` не обязателен).
3. Зависимости материализуются в layout агента.

Object-map `targets:` — только чтобы **подменить** стандартный пакет или добавить свой host. Не prerequisite для Cursor.

Pin CLI в проекте: `npm i -D @b-apm/cli` → `npx bapm`. Force host: `bapm install --target cursor`.

## Альтернативы выбору host

| Способ                         | Когда                                                                      |
| ------------------------------ | -------------------------------------------------------------------------- |
| Auto-detect (как выше)         | Один явный маркер агента в cwd                                             |
| `active: [cursor]` в манифесте | Pin без detect / политика команды                                          |
| `bapm.local.yml` → `active`    | Личный агент поверх общего `bapm.yml` — [overlay](/guide/manifest-overlay) |
| `bapm install --target cursor` | Force поверх detect / `active`                                             |

`bapm init -y --target cursor` по-прежнему может записать `targets:` + `active` (pin) — это удобный scaffold, не единственный путь.

## Что ожидать на диске

| Артефакт                         | Смысл                                              |
| -------------------------------- | -------------------------------------------------- |
| `bapm.lock.yaml`                 | Зафиксированный граф                               |
| `apm_modules/`                   | Материализованные пакеты                           |
| `.agents/skills/<name>/SKILL.md` | Skills (Cursor)                                    |
| `.cursor/rules/<name>.mdc`       | Rules                                              |
| `.cursor/agents/<name>.md`       | Agents                                             |
| `.cursor/mcp.json`               | MCP (если есть eligible direct `dependencies.mcp`) |

Полезные флаги: `--dry-run`, `-v` / `--verbose`, `--frozen`. Полный список: [install](/reference/install).

## Если не сработало

| Симптом                                     | Что проверить                                                                      |
| ------------------------------------------- | ---------------------------------------------------------------------------------- |
| `No manifest found`                         | В cwd нет `bapm.yml` (или backcompat `apm.yml`)                                    |
| пакет / `@b-apm/integration-cursor` в ошибке | Установите интеграцию в проект или глобально (`npm i -D @b-apm/integration-cursor`) |
| `Target detection is missing or ambiguous`  | Несколько маркеров (`.cursor` + `.claude`) или ни одного — `--target` / `active`   |
| `frozen` / lock error при `--frozen`        | Сначала обычный `install` или `lock`                                               |
| Свой / кастомный агент                      | Object-map `targets:` — [hosts](/guide/supported-hosts#advanced-custom-targets)    |

Подробнее о приоритете: [Как выбирается host](/guide/host-selection). Три понятия detect / active / targets: [Hosts](/guide/manifest-hosts).

Дальше: [команды](/guide/commands) → [сценарии](/guide/situations/) → [справка](/reference/).
