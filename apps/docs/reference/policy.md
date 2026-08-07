# bapm policy / approve / deny — флаги

По `bapm help policy` (также `bapm help approve`, `bapm help deny`).

## policy status

```text
bapm policy status [options]
```

Только чтение: отчёт об effective policy discovery / enforcement. Не мутирует lockfiles, manifests, modules. Без подкоманды CLI печатает usage и выходит с ошибкой — нужна `status`.

| Флаг | Значение | Эффект | Default |
| --- | --- | --- | --- |
| `--json` | — | Stable JSON keys (`outcome`, `source`, `provider`, …) | off |
| `--policy` | `<path>` | Явный policy-файл (побеждает dual-read discovery) | discovery |
| `--no-policy` | — | Escape hatch: skip discovery, report disabled | off |
| `--check` | — | Non-zero exit, если нет usable policy | off (exit 0 для found / absent / disabled / soft diagnostics) |
| `--help`, `-h` | — | Help для `policy` или `policy status` | — |

## approve / deny

User-local MCP grants в `~/.bapm/config.json` (`executables.allow` / `executables.deny`). **Никогда** не пишут project `bapm.yml` / `apm.yml`.

```text
bapm approve <package-name> [--user]
bapm deny <package-name> [--user]
```

| Флаг / аргумент | Значение | Эффект | Default |
| --- | --- | --- | --- |
| `<package-name>` | имя пакета | Обязательный positional | — |
| `--user` | — | Принят для APM parity; путь всегда user-local | всегда user-local |
| `--help`, `-h` | — | Показать help | — |

Без имени пакета команда печатает help и завершается с ошибкой.

Связанные install-флаги: `--policy` / `--no-policy` / `--trust-transitive-mcp` на [install](/reference/install). Сценарий: [US-04 Policy / MCP](/guide/situations/policy-mcp).
