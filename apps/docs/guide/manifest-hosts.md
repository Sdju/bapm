# Hosts: detect, active, targets

Как bapm выбирает, **куда** материализовать пакеты. Полный приоритет: [Как выбирается host](/guide/host-selection). How-to по пакетам: [Поддерживаемые hosts](/guide/supported-hosts).

Из коробки CLI **не** бандлит runtime hosts. Стандартные агенты — отдельные пакеты `@b-apm/integration-*`. Object-map не обязателен для канонических hosts.

## Три понятия (громко)

| Понятие     | Роль                                                                          |
| ----------- | ----------------------------------------------------------------------------- |
| **detect**  | Auto: интеграция говорит «cwd похож на мой host» (маркеры вроде `.cursor/`)   |
| **active**  | Explicit choose: какие host id активны (base и/или `bapm.local.yml`)          |
| **targets** | Replace/add **пакет реализации** (host id → npm/path). **Не активирует** host |

`targets:` сами по себе не активируют hosts и не нужны, чтобы «разрешить» cursor/claude/… — для известных id CLI пробует `@b-apm/integration-<id>`.

## Обычно достаточно (без map)

```bash
npm i -D @b-apm/integration-cursor
# в проекте есть .cursor/  →
bapm install
```

Или pin без detect:

```yaml
# bapm.yml
active:
  - cursor
```

## Object-map — когда нужен

```yaml
targets:
  cursor: "./agents/integration/my-cursor" # override canonical
  x-acme-editor: "@acme/my-integration" # custom host
```

| Форма значения                               | Трактовка                                |
| -------------------------------------------- | ---------------------------------------- |
| `./…`, `../…`, абсолютный путь               | Локальный path относительно project root |
| всё остальное (`@scope/name`, `pkg@version`) | npm package specifier                    |

Map entries загружаются **fail-closed**. Canonical hosts без ключа в map — soft resolve `@b-apm/integration-*`.

## Поля манифеста

| Поле      | Форма                     | Смысл                                                                                                |
| --------- | ------------------------- | ---------------------------------------------------------------------------------------------------- |
| `target`  | строка **или** object-map | Legacy: один host id. Object-map (**bapm-расширение**): host → пакет/путь. Нельзя вместе с `targets` |
| `targets` | список **или** object-map | Legacy: несколько id. Object-map — override/add impl                                                 |
| `active`  | список строк              | Какие host id **активировать**. Пустой `active: []` — отказ                                          |

## Типичные ошибки

| Симптом                                        | Что проверить                                                                    |
| ---------------------------------------------- | -------------------------------------------------------------------------------- |
| `Target detection is missing or ambiguous`     | `--target` / `active`; при маркере без пакета — установите `@b-apm/integration-*` |
| `Unknown or unregistered target`               | Пакет не установлен / custom id без map                                          |
| `Manifest "active" must be a non-empty array`  | Уберите `active: []`                                                             |
| `must not declare both "target" and "targets"` | Оставьте одно поле                                                               |

Personal overlay: [Overlay](/guide/manifest-overlay).
