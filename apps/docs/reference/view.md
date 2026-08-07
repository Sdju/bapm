# bapm view — флаги

По `bapm view --help`.

## Использование

```text
bapm view <package>
```

Offline inspect одного установленного пакета из lock + `apm_modules`: identity, pin/ref, путь modules, summary/description из манифеста пакета (если есть). Сеть, registry и `versions` не поддерживаются.

`<package>` — те же формы, что у `deps why`: точное `name` / `repo_url`, уникальный `owner/repo`, уникальный basename.

## Параметры

| Флаг | Значение | Эффект | Default |
| --- | --- | --- | --- |
| `--help`, `-h` | — | Показать help | — |

Не поддерживаются в этом релизе: `view <package> versions`, `--registry`, `-g` / `--global` (ошибка, не silent ignore).

## Коды выхода

| Код | Смысл |
| --- | --- |
| `0` | Уникальный установленный пакет показан |
| `1` | Нет аргумента / not installed / ambiguous |
| `2` | Нет / нечитаемый lock |

См. также: [deps](/reference/deps), [find](/reference/find), [lockfile](/guide/lockfile).
