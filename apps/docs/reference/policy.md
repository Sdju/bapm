# bapm policy / approve / deny — флаги

По `bapm policy --help` (также `bapm approve --help`, `bapm deny --help`).

## policy status

```text
bapm policy status [options]
```

Только чтение: отчёт об effective policy discovery / enforcement. Не мутирует lockfiles, manifests, modules. Без подкоманды CLI печатает usage и выходит с ошибкой — нужна `status`.

| Флаг           | Значение | Эффект                                                | Default                                                       |
| -------------- | -------- | ----------------------------------------------------- | ------------------------------------------------------------- |
| `--json`       | —        | Stable JSON keys (`outcome`, `source`, `provider`, …) | off                                                           |
| `--policy`     | `<path>` | Явный policy-файл (побеждает dual-read discovery)     | discovery                                                     |
| `--no-policy`  | —        | Escape hatch: skip discovery, report disabled         | off                                                           |
| `--check`      | —        | Non-zero exit, если нет usable policy                 | off (exit 0 для found / absent / disabled / soft diagnostics) |
| `--help`, `-h` | —        | Help для `policy` или `policy status`                 | —                                                             |

## approve / deny

User-local MCP grants в `~/.bapm/config.json` (`executables.allow` / `executables.deny`). **Никогда** не пишут project `bapm.yml` / `apm.yml`.

```text
bapm approve <package-name> [--user]
bapm deny <package-name> [--user]
```

| Флаг / аргумент  | Значение   | Эффект                                        | Default           |
| ---------------- | ---------- | --------------------------------------------- | ----------------- |
| `<package-name>` | имя пакета | Обязательный positional                       | —                 |
| `--user`         | —          | Принят для APM parity; путь всегда user-local | всегда user-local |
| `--help`, `-h`   | —          | Показать help                                 | —                 |

Без имени пакета команда печатает help и завершается с ошибкой.

Связанные install-флаги: `--policy` / `--no-policy` / `--trust-transitive-mcp` на [install](/reference/install). Сценарий: [US-04 Policy / MCP](/guide/situations/policy-mcp).

## Allow / deny / require — регистр идентификаторов

При match-time сравнении `dependencies.allow` / `deny` / exact `require` bapm применяет то же правило регистра, что и для Consumer identity (OpenAPM req-pl-018 / req-rs-016 §3):

- ASCII-fold (`A–Z` → `a–z`) сегментов repository coordinates для `github.com`, `*.ghe.com`, значения `GITHUB_HOST` и для `source: registry` (включая registry prefixes).
- Остальные hosts, local и marketplace — byte-exact по path.
- Virtual path внутри репозитория и `#ref` остаются case-sensitive.
- Merge цепочки policy (§6.4) сравнивает authored-записи byte-exactly (fold только при evaluate).
- Exact `require` не интерпретирует `*` как glob.
