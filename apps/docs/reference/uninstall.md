# bapm uninstall — флаги

По `bapm help uninstall`.

## Использование

```text
bapm uninstall <packages...> [--dry-run]
```

Убирает пакеты из манифеста, modules, deploy и lock. Positionals обязательны для полезного запуска (имена пакетов). Неизвестные флаги отвергаются.

## Параметры

| Флаг           | Значение | Эффект             | Default |
| -------------- | -------- | ------------------ | ------- |
| `--dry-run`    | —        | Превью без мутаций | off     |
| `--help`, `-h` | —        | Показать help      | —       |

См. также: [prune](/reference/prune), [install](/reference/install).
