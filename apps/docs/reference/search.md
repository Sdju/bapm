# bapm search — флаги

По `bapm help search`.

## Использование

```text
bapm search QUERY@MARKETPLACE [options]
```

`QUERY@MARKETPLACE` — строка поиска и alias зарегистрированного marketplace, разделённые по **последнему** `@`. Пустые совпадения → exit `0` с подсказкой. Неизвестный marketplace / плохой expression / unknown flags → non-zero.

Установить hit: `bapm install NAME@MARKETPLACE`.

## Параметры

| Флаг              | Значение | Эффект                           | Default |
| ----------------- | -------- | -------------------------------- | ------- |
| `--limit`         | `<n>`    | Максимум результатов             | `20`    |
| `-v`, `--verbose` | —        | Более детальный вывод совпадений | off     |
| `--help`, `-h`    | —        | Показать help                    | —       |

См. также: [marketplace](/reference/marketplace), [install](/reference/install).
