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
| `--no-policy`  | —        | Пропустить только repo-local discovery; org policy остаётся | off                                                           |
| `--no-policy-all` | —     | Полный escape: skip discovery, report disabled | off                                                           |
| `--check`      | —        | Non-zero exit, если нет usable policy                 | off (exit 0 для found / absent / disabled / soft diagnostics) |
| `--help`, `-h` | —        | Help для `policy` или `policy status`                 | —                                                             |

## approve / deny

User-local MCP grants в `~/.bapm/config.json` (`executables.allow` / `executables.deny`). **Никогда** не пишут project `bapm.yml` / `apm.yml`.

```text
bapm approve <package-name> [--user]
bapm deny <package-name> [--user]
```

| Флаг / аргумент  | Значение   | Эффект                                                         | Default |
| ---------------- | ---------- | -------------------------------------------------------------- | ------- |
| `<package-name>` | имя пакета | Обязательный positional                                        | —       |
| `--user`         | —          | Принимается для совместимости с APM; запись всегда в `~/.bapm` | —       |
| `--help`, `-h`   | —          | Показать help                                                  | —       |

Без имени пакета команда печатает help и завершается с ошибкой.

Первый `approve` или `deny` включает режим явных разрешений: дальше install требует решение для каждого пакета с MCP и падает с `MCP withheld: unapproved dependency executables`, пока его нет. `approve` разрешает только MCP; разрешение на `bin/` пакета через него не выдаётся.

Разрешение для всей команды задаётся не в файле политики, а в `bapm.yml` проекта:

```yaml
executables:
  allow:
    acme/mcp-tools:
      mcp: true
```

Файл политики (`apm-policy.yml` / `bapm-policy.yml`) в секции `executables` понимает только запреты: `deny` (список пакетов) и `deny_all`. `executables.allow` и top-level `mcp:` он не отвергает, а молча игнорирует: ошибки не будет, но и правило не применится. На MCP-серверы из собственного `dependencies.mcp` проекта он не действует.

Связанные install-флаги: `--policy` / `--no-policy` / `--no-policy-all` / `--trust-transitive-mcp` на [install](/reference/install). `--no-policy` снимает только repo-local файл, org deny остаётся; полный escape — `--no-policy-all` или `BAPM_POLICY_DISABLE=1`. Сценарий: [MCP-сервер не появился](/guide/situations/policy-mcp).

## Регистр в `allow` / `deny` / `require`

При сравнении записей политики с зависимостями:

- для GitHub (`github.com`, `*.ghe.com`, хост из `GITHUB_HOST`) и registry имена владельца и репозитория сравниваются без учёта регистра: `Acme/Tools` совпадёт с `acme/tools`;
- для остальных git-хостов, `local` и маркетплейсов регистр учитывается;
- путь внутри репозитория и `#ref` всегда сравниваются с учётом регистра;
- в `require` символ `*` не является шаблоном.
