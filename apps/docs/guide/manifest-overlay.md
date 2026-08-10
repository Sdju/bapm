# Personal overlay: bapm.local.yml

Личные host/env/registry настройки **без** правок общего `bapm.yml`. Обзор: [манифест](/guide/config-manifest). Выбор host: [host selection](/guide/host-selection).

## Командный сценарий (first-class)

Общий `bapm.yml` — зависимости и политика команды (agent-neutral). У каждого разработчика — свой агент через local `active`:

```yaml
# bapm.yml (в git) — общий граф, без привязки к агенту Vasya/Masha
name: team-agent-deps
version: 1.0.0
dependencies:
  apm:
    - path: ./packages/shared-skills
```

```yaml
# bapm.local.yml у Vasya (не коммитить)
active:
  - cursor
```

```yaml
# bapm.local.yml у Masha
active:
  - claude
```

Local `active` **заменяет** base `active` целиком (не merge списков). Общий манифест остаётся нейтральным; Cursor у Vasya и Claude у Masha не спорят в PR.

Нужны пакеты `@b-apm/integration-cursor` / `@b-apm/integration-claude` у соответствующего разработчика (project или global).

## Пример

```yaml
# bapm.local.yml
active:
  - cursor
env:
  FOO: "personal"
```

Добавьте в `.gitignore`:

```text
bapm.local.yml
```

## Правила

- Имя строго `bapm.local.yml` (рядом с базовым манифестом, без walk-up).
- `apm.local.yml` в v1 **отклонён**.
- Это **не** source `local:` у зависимостей (каталог `.agents/local`). Overlay — настройки; `local:` — источник пакета.

## Allowlist

| Ключ                 | Merge                                                                               |
| -------------------- | ----------------------------------------------------------------------------------- |
| `active`             | replace всего списка                                                                |
| `target` / `targets` | object-map + object-map → deep-merge (local wins); иначе replace + mutual exclusion |
| `env`                | deep-merge строк (local wins per key)                                               |
| `registries`         | deep-merge по имени registry                                                        |

Всё остальное (`name`, `version`, `dependencies`, `x-*`, …) — отказ.

## Precedence

CLI flags (`--target`, …) → `bapm.local.yml` → base `bapm.yml` / `apm.yml` → process-env overrides (где есть).

Pack и publish **опускают** файл. `bapm doctor` предупреждает, если overlay уже tracked (`git rm --cached bapm.local.yml`).

detect / active / targets — [Hosts](/guide/manifest-hosts).
