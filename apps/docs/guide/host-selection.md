# Как выбирается host

Куда `bapm install` / `bapm compile` раскладывают пакеты. Поля манифеста: [Hosts](/guide/manifest-hosts). Таблица пакетов: [Поддерживаемые hosts](/guide/supported-hosts).

## Два отдельных вопроса

1. **Какой host активен?** (selection)
2. **Какой пакет реализации загрузить?** (resolution)

Их нельзя смешивать: `targets:` меняет пакет, но **не активирует** host.

## Precedence (selection)

```
--target <id>
    ↓ иначе
bapm.local.yml → active
    ↓ иначе (local не задал active)
базовый bapm.yml / apm.yml → active
    ↓ иначе
sole auto-detect среди зарегистрированных интеграций
    ↓ иначе (0 или ≥2)
fail-closed
```

| Шаг            | Поведение                                                                 |
| -------------- | ------------------------------------------------------------------------- |
| `--target`     | Force; перекрывает `active` и detect                                      |
| local `active` | Из `bapm.local.yml`; **заменяет** весь список base `active` (overlay)     |
| base `active`  | Из committed манифеста                                                    |
| auto-detect    | Ровно один зарегистрированный host с `detect === true`                    |
| ambiguity      | Несколько detect / несколько active без `--target` → ошибка (fail-closed) |
| missing        | Нет detect, нет `active`, нет `--target` → ошибка                         |

## Resolution (пакет реализации)

Отдельно от выбора id:

```
явный targets: / target: object-map для этого id
    ↓ иначе
canonical @bapm/integration-<id> (если id известен CLI)
    ↓ иначе
host не регистрируется (custom id без map → unknown target)
```

- Map **absent** или **partial** — для известных hosts CLI всё равно пробует canonical пакет (если он установлен в проекте / global).
- Map entry **перекрывает** canonical для этого ключа; остальные известные hosts по-прежнему через fallback.
- Custom id (`x-acme-…`) — только через object-map (или явная регистрация).

Пакет интеграции — обычная npm-зависимость: bapm **не** бандлит integrations в `@bapm/cli` и **не** песочничит npm. Это отдельно от MCP trust / policy / frozen / hashes.

## Типичные сценарии

| Ситуация                               | Решение                                                          |
| -------------------------------------- | ---------------------------------------------------------------- |
| Один агент, пакет установлен           | `bapm install` (detect)                                          |
| Два маркера (`.cursor` + `.claude`)    | `--target` или `active` / local overlay                          |
| Команда: общий манифест, разные агенты | `bapm.local.yml` → `active` — [overlay](/guide/manifest-overlay) |
| Подменить реализацию Cursor            | `targets: { cursor: "./my-cursor" }`                             |

Дальше: [быстрый старт](/guide/quick-start) · [supported hosts](/guide/supported-hosts).
