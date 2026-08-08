# Personal overlay: bapm.local.yml

Личные host/env/registry настройки **без** правок общего `bapm.yml`. Обзор: [манифест](/guide/config-manifest).

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

| Ключ | Merge |
| --- | --- |
| `active` | replace всего списка |
| `target` / `targets` | object-map + object-map → deep-merge (local wins); иначе replace + mutual exclusion |
| `env` | deep-merge строк (local wins per key) |
| `registries` | deep-merge по имени registry |

Всё остальное (`name`, `version`, `dependencies`, `x-*`, …) — отказ.

## Precedence

CLI flags (`--target`, …) → `bapm.local.yml` → base `bapm.yml` / `apm.yml` → process-env overrides (где есть).

Pack и publish **опускают** файл. `bapm doctor` предупреждает, если overlay уже tracked (`git rm --cached bapm.local.yml`).
