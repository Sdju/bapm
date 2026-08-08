# bapm audit — флаги

По `bapm help audit`.

## Использование

```text
bapm audit --ci [-f text|json|sarif] [-o path]
```

CI-гейт: наличие lock, deployed presence и hash re-verify. Неизвестные флаги отвергаются. Markdown-расширение у `-o` не принимается.

## Параметры

| Флаг             | Значение                    | Эффект                                                  | Default                         |
| ---------------- | --------------------------- | ------------------------------------------------------- | ------------------------------- |
| `--ci`           | —                           | CI gate (lock + deployed presence + hash re-verify)     | required for gate path          |
| `-f`, `--format` | `text` \| `json` \| `sarif` | Формат отчёта                                           | `text` (или из расширения `-o`) |
| `-o`, `--output` | `<path>`                    | Записать body в файл (mkdir parents; body не на stdout) | stdout                          |
| `--help`, `-h`   | —                           | Показать help                                           | —                               |

Если `-f` не задан, формат может выводиться из расширения `-o` (`.json` → json, `.sarif` / `.sarif.json` → sarif).

См. также: [doctor](/reference/doctor), [install --frozen](/reference/install), [US-07 Doctor / audit / prune](/guide/situations/doctor-audit-prune).
