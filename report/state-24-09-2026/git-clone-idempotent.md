# Повторный clone git-зависимости

**Статус:** исправлено (working tree, change `fix-install-safety`)  
**Класс:** баг

## Суть

Resolve уже кладёт дерево в `apm_modules/<id>/<commit>`. Следующий шаг снова вызывал `git clone` в тот же непустой каталог. Падало и на первом, и на втором install (`Failed to download`). Git-зависимости фактически нельзя было поставить.

## Состояние

| Источник     | Позиция                                                                                                                                       |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| APM          | Повторный install переиспользует modules cache, не клонирует в занятый путь.                                                                  |
| OpenAPM      | Download идемпотентен относительно pin.                                                                                                       |
| Спека bapm   | ADDED `dependency-resolve`: Modules download is idempotent for materialized git trees.                                                        |
| Код bapm     | `Resolver/defaults.ts`: если `HEAD` == нужный commit и есть `.git` — return; иначе `rmSync` + clone. `mkdirSync` только для local-path ветки. |
| Документация | Прежние «known git issue» блоки сняты.                                                                                                        |

## Вариации

1. Всегда clone в пустой dest (старое, сломано).
2. Reuse at pin, replace если дерево грязное (текущее).
3. `git fetch` + reset — не сделано, только clone начисто.

## Поведение сейчас

Повторный `bapm install` с уже скачанным коммитом не клонирует. Другой commit — каталог удаляется и клонируется заново. `file://` URL по-прежнему нормализуется как github-координата и не является обходом.
