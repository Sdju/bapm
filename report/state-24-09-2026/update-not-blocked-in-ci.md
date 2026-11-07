# `update -y` в CI не запрещён

**Статус:** открыто  
**Класс:** продукт

## Суть

`install` в CI сам включает frozen и отказывается от `--update`. Команда `bapm update` смотрит только на явный `options.frozen`. CLI это поле из `CI` не выставляет. В пайплайне `update -y` перепишет lock.

## Состояние

| Источник     | Позиция                                                                                                                                            |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| APM          | Update в CI обычно отдельный job; install frozen не равен запрету `apm update`.                                                                    |
| OpenAPM      | Frozen — свойство install verify, не глобальный lock на мутацию.                                                                                   |
| Спека bapm   | Update MAY отказаться при frozen context; install `--update` + frozen — MUST fail.                                                                 |
| Код bapm     | `Update/runUpdate.ts`: отказ только если `options.frozen === true` и нет override. CLI Update `CI` не читает. Install читает `CI` и ставит frozen. |
| Документация | `ci-frozen.md`: «`update -y` при этом не блокируется — не запускайте его в CI».                                                                    |

## Вариации

1. Как install: `CI` ⇒ `update` без явного override падает.
2. Разрешить (текущее) и предупредить в docs.
3. Требовать `--force` в CI для update.

## Поведение сейчас

`CI=true bapm update -y` применяет план и пишет lock. `CI=true bapm install --update` падает. Защита — дисциплина пайплайна, не флаг.
