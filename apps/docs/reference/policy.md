# bapm policy / approve / deny — флаги

По `bapm policy --help` (также `bapm approve --help`, `bapm deny --help`).

## policy status

```text
bapm policy status [options]
```

Только чтение: отчёт об effective policy discovery / enforcement. Не мутирует lockfiles, manifests, modules. Без подкоманды CLI печатает usage и выходит с ошибкой — нужна `status`.

| Флаг              | Значение | Эффект                                                      | Default                                                       |
| ----------------- | -------- | ----------------------------------------------------------- | ------------------------------------------------------------- |
| `--json`          | —        | Stable JSON keys (`outcome`, `source`, `provider`, …)       | off                                                           |
| `--policy`        | `<path>` | Явный policy-файл (побеждает dual-read discovery)           | discovery                                                     |
| `--no-policy`     | —        | Пропустить только repo-local discovery; org policy остаётся | off                                                           |
| `--no-policy-all` | —        | Полный escape: skip discovery, report disabled              | off                                                           |
| `--check`         | —        | Non-zero exit, если нет usable policy                       | off (exit 0 для found / absent / disabled / soft diagnostics) |
| `--help`, `-h`    | —        | Help для `policy` или `policy status`                       | —                                                             |

## Откуда берётся политика

Порядок discovery по умолчанию:

1. **repo-local** — `apm-policy.yml` или `bapm-policy.yml` в корне проекта (dual-read; оба файла одновременно — ошибка).
2. **`github-owner-dotgithub`** — если локального файла нет, bapm берёт git remote `origin` (или единственный remote), проверяет, что его хост совпадает с implementation-default (по умолчанию `github.com`), и перебирает по порядку `.github-private` → `.github` → `.apm` → `_apm`, загружая первый найденный `<owner>/<repo>/apm-policy.yml`.
3. **`azure-devops-org-policy`** — для Azure DevOps remote (`dev.azure.com`, `*.visualstudio.com`, `ssh.dev.azure.com:v3/...`, а также on-prem хостов из `ADO_HOST`/`APM_ADO_HOSTS`) bapm запрашивает `apm/apm-policy`, затем legacy `_apm/_apm` через ADO Items API.

Remote-запрос идёт синхронно через `curl` (`-fsSL`, `--max-time 10`, только `https`). Если remote-хост не GitHub или remote не выбран, org-policy не ищется. Если remote-политика не загрузилась и effective `fetch_failure: block`, install/lock/update завершаются fail-closed с диагностикой; `policy status` показывает `outcome: error` с сетевым диагнозом.

GitHub multi-candidate и Azure DevOps org-policy реализованы. GitLab-провайдер и произвольные ADO-каскады вне scope.

`--no-policy` отключает только шаг 1, поэтому org-policy продолжает применяться. `--no-policy-all` и `BAPM_POLICY_DISABLE=1` / `APM_POLICY_DISABLE=1` отключают и удалённый поиск: сетевого запроса не будет.

## approve / deny

User-local executable grants в `~/.bapm/config.json` (`executables.allow` / `executables.deny`). **Никогда** не пишут project `bapm.yml` / `apm.yml`.

```text
bapm approve <package-name> [--bin|--hook|--mcp] [--user]
bapm approve --list [--json]
bapm approve --pending [--json]
bapm deny <package-name> [--bin|--hook|--mcp] [--user]
```

| Флаг / аргумент  | Значение   | Эффект                                                                   | Default |
| ---------------- | ---------- | ------------------------------------------------------------------------ | ------- |
| `<package-name>` | имя пакета | Обязательный positional                                                  | —       |
| `--mcp`          | —          | Разрешить/запретить MCP-серверы пакета                                   | да      |
| `--bin`          | —          | Разрешить/запретить deploy `bin/` пакета (persisted consent для install) | —       |
| `--hook`         | —          | Разрешить/запретить hooks пакета                                         | —       |
| `--user`         | —          | Принимается для совместимости с APM; запись всегда в `~/.bapm`           | —       |
| `--list`         | —          | Показать user-local grants: package, types, allow/deny, source           | —       |
| `--pending`      | —          | Найти dependency MCP/bin/hook без решения в project/user/org             | —       |
| `--json`         | —          | Stable JSON для `--list` / `--pending`                                   | off     |
| `--help`, `-h`   | —          | Показать help                                                            | —       |

Без имени пакета команда печатает help и завершается с ошибкой. Без type-флага команда по-прежнему пишет `mcp: true` (approve или deny) — для совместимости. Несколько флагов можно передать сразу: каждый тип сохраняется отдельно.

`bapm approve --list` — только чтение `~/.bapm/config.json`: строки с `package`, `types`, `grant` (`allow` / `deny`) и `source` (`user`). `--pending` — только чтение manifest/lock: dependency-пакеты с типами `mcp`, `bin`, `hook`, которые не имеют явного allow/deny в project manifest, user config или org policy. MCP берётся из lock `mcp_servers` (и manifest `dependencies.mcp`, но root/direct серверы не требуют approve), `bin` — из `bin/` в materialized package roots, `hook` — из dependency primitives. JSON-формы: `{source, path, present, grants}` для `--list` и `{lockfile, manifest, pending}` для `--pending`, где pending-строка — `{package, types, reason}`. Оба режима ничего не пишут и не меняют lock/manifest/модули; `--json` без `--list`/`--pending` отклоняется. `bapm deny --list/--pending` не добавлены: используйте `approve --list` для просмотра и `deny <пакет>` для запрета.

Первый `approve` или `deny` включает проверку MCP и hooks у зависимостей, но не требует решения по каждому пакету. Пакет, которого нет ни в `allow`, ни в `deny`, пропускается с предупреждением `MCP_NOT_APPROVED` — install продолжается. Фатальное сообщение `MCP withheld: explicitly denied or unapproved dependency executables` остаётся только для явного deny (project/user/org, включая org `deny_all`) и для пакета, упомянутого в grant-поверхности без `mcp: true` (например `mcp: false` или только `bin: true`). Deny всегда сильнее allow.

`bapm approve <пакет> --bin` выдаёт persisted consent на `bin/`: после него `bapm install` деплоит `bin/` без `--trust-bin` (но deny по-прежнему сильнее). `approve <пакет> --hook` разрешает dependency hooks; в `bapm.yml` это `executables.allow.<pkg>.hook: true`.

`bapm deny <пакет> --mcp` (или `deny` без type-флага) после записи запрета пересобирает MCP-конфиг активных хостов и удаляет записи, которыми bapm владел для этого пакета. Чужие серверы остаются. Если конфиг хоста недоступен или не переписывается, команда завершается успешно, но печатает warning и просит удалить сервер вручную.

Dependency hooks проверяются, когда есть project/user grant-поверхность или org `executables.deny`/`deny_all`. Без grant-поверхности и без org deny hooks раскладываются по legacy-поведению. Root/local hooks проекта под гейт не попадают.

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
