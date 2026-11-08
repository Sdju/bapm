# P2 — паритетные разрывы

Не блокируют базовый install, но заметно отличают bapm от APM 0.35. Приоритет — после P1.

## CLI surface

| Область                | APM 0.35                                                          | bapm                                    | Verdict         | Действие                                           |
| ---------------------- | ----------------------------------------------------------------- | --------------------------------------- | --------------- | -------------------------------------------------- |
| `auth HOST`            | check/export для GitHub/GHES/GitLab                               | нет команды; Auth module только внутри  | absent          | тонкий `--check/--export` поверх Auth              |
| `targets`              | `targets [--json] [--all]`                                        | нет интроспекции                        | partial         | read-only `bapm targets [--json]`                  |
| `config`               | `config get/list/set/unset`                                       | `~/.bapm/config.json` только для grants | absent          | минимум `config get/list` + `set target`           |
| `mcp`                  | `list/search/show/install` + registry                             | MCP только через install                | absent          | read-only `mcp list/show`; install позже           |
| `init --discover`      | inventory + `--apply`                                             | только `-y/--target`                    | absent          | `--discover` preview без записи                    |
| `run`/`preview`/`list` | scripts + prompt compiler                                         | нет                                     | absent          | defer: нужен prompt engine                         |
| `runtime`              | setup/list/status/remove                                          | нет                                     | absent          | defer                                              |
| `lifecycle`            | init/validate/test/trust/untrust                                  | `lifecycle:` молча игнорируется         | absent          | fail-closed/warn на ключ                           |
| `experimental`         | list/enable/disable/reset                                         | env `BAPM_EXPERIMENTAL_REGISTRIES`      | absent          | defer                                              |
| `--global`             | `install -g`, `compile -g`, `view -g`                             | project-only                            | absent          | отдельный большой change                           |
| approve/deny scope     | project default, `--user` opt-in, `--pending/--all/--recommended` | user-only, `<pkg>` only                 | partial/diverge | read-only `--pending/--list`; решить project-write |

**Evidence:** APM `src/apm_cli/cli.py`, `commands/`; bapm `packages/cli/src/app/registry.ts`, `apps/docs/guide/commands.md`.

## Targets и adapters

| Хост                                        | APM                                         | bapm                             | Решение                            |
| ------------------------------------------- | ------------------------------------------- | -------------------------------- | ---------------------------------- |
| `hermes`                                    | stable, explicit-only                       | нет                              | добавить отдельной интеграцией     |
| `intellij`                                  | MCP-only, copilot profile                   | нет                              | добавить, если JetBrains MCP важен |
| `grok-bot`                                  | stable, skills-only `agent-data/workflows/` | нет (есть `grok-build`)          | добавить отдельным id              |
| `grok-cloud`                                | experimental                                | нет                              | не брать                           |
| `copilot-app`, `copilot-cowork`, `openclaw` | experimental                                | нет                              | не брать                           |
| `vscode`                                    | alias → copilot                             | alias парсится, не нормализуется | нормализовать                      |

**Evidence:** APM `core/target_catalog.py:113-219`; bapm `packages/integration-*`, `apps/docs/guide/supported-hosts.md`.

## MCP / hooks / trust

| Область                 | APM                                 | bapm                                         | Действие                                 |
| ----------------------- | ----------------------------------- | -------------------------------------------- | ---------------------------------------- |
| Standalone MCP registry | list/search/show/install            | нет                                          | thin read-only CLI                       |
| Lock `mcp_omissions`    | есть                                | нет                                          | добавить для withheld/omitted            |
| MCP ownership           | native hash/owned connections       | `managedServers` + lock inventory            | добавить ownership hash                  |
| Codex hooks             | nested groups                       | flat                                         | native nested shape                      |
| Claude hooks            | nested matcher + `type: command`    | flat, без `type`                             | native nested shape                      |
| LSP gate                | 5-й executable type, `--lsp`        | `dependencies.lsp` сохраняется, не деплоится | deploy+gate или fail-closed              |
| Canvas                  | experimental double gate            | нет primitive path                           | явно отклонять/игнорировать с diagnostic |
| Policy discovery        | GitHub multi-candidate, GitLab, ADO | local + GitHub `.github`                     | ADO/multi-candidate отдельным change     |
| Approve UX              | pending/all/recommended/list        | нет                                          | read-only pending/list                   |

**Evidence:** APM `install/mcp/`, `policy/discovery.py`, `security/executables.py`; bapm `packages/core/src/modules/{Mcp,Policy,ExecutableTrust}`, `packages/integration-{codex,claude}`.

## Compile

| APM                                             | bapm                  | Действие                             |
| ----------------------------------------------- | --------------------- | ------------------------------------ |
| multi-target `--target a,b`, `--all`            | один target за запуск | решить product goal                  |
| per-dir `applyTo`, distributed dirs             | нет                   | крупный change                       |
| build-id, link resolution, `--watch`, `--clean` | нет                   | после multi-target                   |
| shared `AGENTS.md` last-writer                  | документировано       | добавить warn/refuse при чужом файле |

**Evidence:** APM `commands/compile/`, `compilation/`; bapm `packages/core/src/modules/Compile`, `apps/docs/reference/compile.md`.

## Pack / marketplace / plugin

| Область                    | APM                           | bapm                       | Действие         |
| -------------------------- | ----------------------------- | -------------------------- | ---------------- |
| `--check-clean`            | drift gate, exit 4            | нет                        | добавить         |
| `--strict-metadata`        | exit 5                        | нет                        | добавить         |
| Claude/agent-plugin bundle | hooks/assets/native manifests | plain zip + Agent Plugins  | producer bundle  |
| Annotated tag `source.sha` | commit, не tag object         | advisory                   | исправить pin    |
| Copilot marketplace output | 0.34                          | только Claude/Codex        | добавить profile |
| Registry host              | client, host не ship-ит       | client за флагом, host N/A | оставить N/A     |

**Evidence:** APM `commands/pack.py`, `bundle/`, `marketplace/output_profiles.py`; bapm `packages/core/src/modules/{Pack,Marketplace}`, `packages/integration-{claude,codex}`.

## Manifest / lock / resolve

| Область                 | APM                                         | bapm                       | Действие                 |
| ----------------------- | ------------------------------------------- | -------------------------- | ------------------------ |
| `$schema` negotiation   | known URIs, unknown fail-closed             | игнорируется               | добавить selector        |
| unknown top-level keys  | warning                                     | молча                      | warning `MF_*`           |
| dependency `extensions` | копируются в lock                           | теряются                   | добавить                 |
| `targets` scalar/CSV    | принимает                                   | отвергает                  | принимать                |
| lock sort               | `(depth, repo_url)`                         | `(repo_url, virtual_path)` | решить interop           |
| immutable literal refs  | equivalence fail-closed                     | shallowest pick            | добавить проверку        |
| shared cache            | git/http cache                              | только `apm_modules`       | N/A или отдельный change |
| local single-file deps  | `.agent.md`/`.instructions.md`/`.prompt.md` | только package root        | investigate              |

**Evidence:** APM `models/`, `deps/lockfile.py`, `cache/`; bapm `Manifest`, `Lockfile`, `Resolver`, `Cache`.

## Что не делать в этом раунде

- `replace:` full support — контракт APM не ratified; минимум P1 diagnostic.
- manifest-v0.1.48 — candidate, не ratified.
- Registry host — bapm product decision.
- APM installer/Homebrew/Authenticode/gh-aw/contributor dashboard.
- Canvas — держать soft, но не молчать.
