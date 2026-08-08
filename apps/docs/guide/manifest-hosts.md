# Hosts: target, targets, active

Как bapm выбирает, **куда** материализовать пакеты. Обзор манифеста: [bapm.yml](/guide/config-manifest). Пользовательский how-to (Cursor, npm, локальный модуль): [Поддерживаемые hosts](/guide/supported-hosts).

Из коробки CLI **не** тащит runtime hosts. Cursor, Claude, Codex и другие агенты — через integration-пакет + object-map `targets:` / `target:`. Claude/Codex также дают marketplace-pack (`bapm pack`) из того же пакета.

## Обычно достаточно

```yaml
targets:
  cursor: "@bapm/integration-cursor"
active:
  - cursor
```

Или force на команде (после map + установленного пакета):

```bash
bapm install --target cursor
```

## Приоритет выбора

1. `--target <id>` (CLI; force)
2. `bapm.local.yml` → `active`
3. базовый манифест → `active`
4. sole auto-detect среди зарегистрированных интеграций
5. fail-closed

Приоритет коротко: `--target` → `active` → detect.

## Поля

| Поле      | Форма                     | Смысл                                                                                                |
| --------- | ------------------------- | ---------------------------------------------------------------------------------------------------- |
| `target`  | строка **или** object-map | Legacy: один host id. Object-map (**bapm-расширение**): host → пакет/путь. Нельзя вместе с `targets` |
| `targets` | список **или** object-map | Legacy: несколько id. Object-map предпочтительнее для multi-host                                     |
| `active`  | список строк              | Какие host id **активировать**. Пустой `active: []` — отказ                                          |

`target` / `targets` — заявление предпочтения и ключи для **загрузки** интеграций. Они **сами по себе не активируют** hosts. Для явной активации без detect: `active` или `--target <id>`. Рекомендуется `active` ⊆ объявленных `target`/`targets`, когда оба заданы.

## Object-map (кратко)

```yaml
targets:
  cursor: "@bapm/integration-cursor"
  pi: "./agents/integration/pi-agent"
```

| Форма значения                               | Трактовка                                |
| -------------------------------------------- | ---------------------------------------- |
| `./…`, `../…`, абсолютный путь               | Локальный path относительно project root |
| всё остальное (`@scope/name`, `pkg@version`) | npm package specifier                    |

Когда object-map присутствует, CLI **загружает и регистрирует** каждый пакет/модуль из значений **до** выбора активного host (eager, fail-closed). Map **сам по себе не активирует** host. Без object-map id вроде `cursor` **не** регистрируется автоматически.

Примеры, контракт `createIntegration`, Claude/Codex: [Поддерживаемые hosts](/guide/supported-hosts).

Mutual exclusion `target` + `targets` сохраняется для любой комбинации форм. Пустой `{}`, невалидный ключ или пустое значение — отказ parse.

## Типичные ошибки

| Симптом                                        | Что проверить                                     |
| ---------------------------------------------- | ------------------------------------------------- |
| `Target detection is missing or ambiguous`     | `--target <id>` или `active: […]`                 |
| `Manifest "active" must be a non-empty array`  | Уберите `active: []`                              |
| `must not declare both "target" and "targets"` | Оставьте одно поле                                |
| `Unknown or unregistered target`               | Id не загружен из object-map (пакет + `targets:`) |

Personal overlay с `active`: [Overlay](/guide/manifest-overlay).
