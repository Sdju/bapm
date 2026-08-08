# bapm prune — флаги

По `bapm help prune`.

## Использование

```text
bapm prune [--dry-run]
```

Удаляет orphan-модули, которых нет в resolved graph lockfile. Неизвестные флаги отвергаются.

## Параметры

| Флаг           | Значение | Эффект              | Default |
| -------------- | -------- | ------------------- | ------- |
| `--dry-run`    | —        | Превью без удаления | off     |
| `--help`, `-h` | —        | Показать help       | —       |

См. также: [uninstall](/reference/uninstall), [deps clean](/reference/deps).
