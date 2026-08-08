# Быстрый старт

Цель: поставить CLI, завести манифест и выполнить первый `install` в Cursor.

## 1. Установка

Нужен Node.js ≥ 22.12.

### CLI

```bash
npm i -g @bapm/cli
# или: pnpm add -g @bapm/cli

bapm --help
```

### Интеграция с агентом

`install` раскладывает пакеты через **host-интеграцию**. Без неё (или без `--target` / `active` / detect) команда fail-closed.

**Cursor** — отдельный пакет + object-map:

```bash
npm i -g @bapm/integration-cursor
# или: npm i -D @bapm/integration-cursor

bapm init -y --target cursor
# init пишет targets: { cursor: "@bapm/integration-cursor" } и active: [cursor]
```

```yaml
targets:
  cursor: "@bapm/integration-cursor"
active:
  - cursor
```

**Свой агент** — поставьте пакет или локальный модуль, объявите `targets:`, активируйте `--target <id>`. Рекомендации и контракт: [поддерживаемые hosts](/guide/supported-hosts).

Pin CLI в проекте (вторично): `npm i -D @bapm/cli` → `npx bapm`.

Ниже команды — после глобальной установки.

## 2. Манифест и install

```bash
bapm install --target cursor
```

(`init` из шага выше уже создал `bapm.yml` с `name`, `version`, пустыми deps, object-map `targets:` и `active`. Повторный `init` откажется, если манифест есть.)

Минимальный пример вручную:

```yaml
name: my-agent-project
version: 0.0.1
targets:
  cursor: "@bapm/integration-cursor"
active:
  - cursor
dependencies:
  apm:
    - path: ./packages/hello-skill
  mcp: []
```

Карта полей: [манифест](/guide/config-manifest).

`--target cursor` принудительно активирует Cursor-integration. Без force CLI может опереться на auto-detect (наличие `.cursor/` или legacy `.cursorrules`).

### Что ожидать на диске

| Артефакт                         | Смысл                                                    |
| -------------------------------- | -------------------------------------------------------- |
| `bapm.lock.yaml`                 | Зафиксированный граф (новый lock по умолчанию — это имя) |
| `apm_modules/`                   | Материализованные пакеты                                 |
| `.agents/skills/<name>/SKILL.md` | Skills                                                   |
| `.cursor/rules/<name>.mdc`       | Rules                                                    |
| `.cursor/agents/<name>.md`       | Agents                                                   |
| `.cursor/mcp.json`               | MCP (если есть eligible direct `dependencies.mcp`)       |

Полезные флаги: `--dry-run`, `-v` / `--verbose`, `--frozen`. Полный список: [install](/reference/install).

Lock без деплоя: `bapm lock` — [lockfile](/guide/lockfile).

## 3. Если не сработало

| Симптом                              | Что проверить                                                             |
| ------------------------------------ | ------------------------------------------------------------------------- |
| `No manifest found`                  | В cwd нет `bapm.yml` (или backcompat `apm.yml`)                           |
| `frozen` / lock error при `--frozen` | Сначала обычный `install` или `lock`                                      |
| `bapm: command not found`            | `npm i -g @bapm/cli` или `npx` / `pnpm exec` при project-local            |
| Ожидали Claude/Codex runtime         | Это marketplace-pack, не install target — [hosts](/guide/supported-hosts) |
| Свой агент не находится              | Object-map `targets:` + `--target <id>` — [hosts](/guide/supported-hosts) |

## Реже на старте

Публикация scoped-пакета `@bapm/cli` ещё может быть нестабильной; команды установки выше — целевой UX. Сборка из monorepo — для контрибьюторов: [Architecture](/architecture/).

Personal overlay `bapm.local.yml` (личные `active` / `env` / …, не source `local:`) — в `.gitignore`. Подробнее: [overlay](/guide/manifest-overlay).

Дальше: [команды](/guide/commands) → [сценарии](/guide/situations/) → [справка](/reference/).
