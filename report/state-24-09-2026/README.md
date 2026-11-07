# Состояние расхождений — 24 сентября 2026

Снимок спорных мест между **bapm**, **microsoft/apm** и **OpenAPM v0.1**. Каждый файл — одно расхождение: что заявлено у APM / OpenAPM, какие есть варианты, что делает bapm сейчас.

Поведение сверено с кодом в working tree (включая незакоммиченные правки `fix-install-safety` и help/CONFORMANCE). Поведение APM — по `CONFORMANCE.md`, чеклисту и пользовательской документации, не по исходному коду APM.

## Как читать карточку

| Поле                                   | Смысл                                                                                                                |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Статус**                             | `открыто` — решение не принято; `намеренно` — осознанное отличие; `исправлено` — в working tree уже другое поведение |
| **Класс**                              | баг, намеренное отличие, долг спеки, тест, продукт                                                                   |
| **APM / OpenAPM / спека / код / docs** | четыре источника правды, если они расходятся                                                                         |

## Индекс

### Намеренные отличия от APM (формат OpenAPM)

| Файл                                                                             | Тема                                                          |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| [diamond-intersection-vs-first-wins.md](./diamond-intersection-vs-first-wins.md) | Ромб зависимостей: пересечение диапазонов vs первое найденное |
| [lock-sort-order.md](./lock-sort-order.md)                                       | Порядок записей в lock: `repo_url` vs глубина                 |
| [yaml-anchors-strict.md](./yaml-anchors-strict.md)                               | YAML-якоря: строгий OpenAPM vs APM                            |
| [openapm-8-5-layout.md](./openapm-8-5-layout.md)                                 | Раскладка файлов по агентам (§8.5) не заявлена                |
| [compile-single-file.md](./compile-single-file.md)                               | `compile` пишет один файл, без `applyTo`                      |
| [local-overlay-extension.md](./local-overlay-extension.md)                       | `bapm.local.yml` / `local` — только bapm                      |
| [experimental-registries.md](./experimental-registries.md)                       | Registry-клиент за флагом, роль сервера не заявлена           |

### Незавершённое или спорное поведение CLI

| Файл                                                             | Тема                                                    |
| ---------------------------------------------------------------- | ------------------------------------------------------- |
| [install-force-noop.md](./install-force-noop.md)                 | `--force` принимается и ничего не делает                |
| [mcp-first-agent-only.md](./mcp-first-agent-only.md)             | MCP пишется только первому агенту из `active`           |
| [mcp-headers-dropped.md](./mcp-headers-dropped.md)               | HTTP `headers` MCP не попадают в конфиг агента          |
| [mcp-origin-in-host-config.md](./mcp-origin-in-host-config.md)   | Поле `origin` живёт во внутреннем объекте сервера       |
| [uninstall-incomplete.md](./uninstall-incomplete.md)             | `uninstall` частичный, сравнение по подстроке           |
| [orphan-files-cleanup.md](./orphan-files-cleanup.md)             | Сироты после удаления пакета из манифеста               |
| [targets-narrow-deploy.md](./targets-narrow-deploy.md)           | Корневые `targets` молча сужают раскладку               |
| [init-target-writes-targets.md](./init-target-writes-targets.md) | `init --target` пишет сужающий блок `targets:`          |
| [audit-ci-flag.md](./audit-ci-flag.md)                           | `audit` и `audit --ci` сейчас одно и то же              |
| [frozen-ignores-ref-change.md](./frozen-ignores-ref-change.md)   | Frozen не ловит смену `#ref` у уже закреплённого пакета |
| [update-not-blocked-in-ci.md](./update-not-blocked-in-ci.md)     | `update -y` в CI не запрещён                            |
| [update-dry-run-branches.md](./update-dry-run-branches.md)       | `--dry-run` показывает ветки как `keep`                 |
| [deps-why-is-direct.md](./deps-why-is-direct.md)                 | `deps why --json`: `is_direct` по пустому `resolved_by` |
| [hash-formats.md](./hash-formats.md)                             | Разные форматы хешей в lock                             |
| [path-absolute-in-lock.md](./path-absolute-in-lock.md)           | `path:` пишется в lock абсолютным путём                 |

### Policy / MCP / trust

| Файл                                                                 | Тема                                                    |
| -------------------------------------------------------------------- | ------------------------------------------------------- |
| [policy-hooks-ungated.md](./policy-hooks-ungated.md)                 | Hooks и canvas не под ExecutableTrust                   |
| [policy-file-deny-only.md](./policy-file-deny-only.md)               | Файл политики только запрещает                          |
| [grant-surface-all-or-nothing.md](./grant-surface-all-or-nothing.md) | Любое разрешение включает проверку всех MCP-пакетов     |
| [deny-does-not-undeploy.md](./deny-does-not-undeploy.md)             | `deny` не убирает уже записанный сервер                 |
| [no-policy-disables-org.md](./no-policy-disables-org.md)             | `--no-policy` отключает и org deny                      |
| [trust-bin-interactive.md](./trust-bin-interactive.md)               | В TTY `bin/` ставится без `--trust-bin`                 |
| [mcp-dir-must-exist.md](./mcp-dir-must-exist.md)                     | Часть агентов пишет MCP только если каталог уже есть    |
| [skipped-primitives-silent.md](./skipped-primitives-silent.md)       | Неподдерживаемые типы файлов пропускаются без сообщения |
| [copilot-windsurf-home-mcp.md](./copilot-windsurf-home-mcp.md)       | Copilot и Windsurf пишут MCP в `$HOME`                  |

### Спека vs код / тесты

| Файл                                                                     | Тема                                                                  |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| [env-precedence.md](./env-precedence.md)                                 | Приоритет `env`: overlay vs bake                                      |
| [spec-legacy-active.md](./spec-legacy-active.md)                         | В спеках остались сценарии `active: [id]`                             |
| [conformance-beyond-cursor.md](./conformance-beyond-cursor.md)           | `CONFORMANCE.md` всё ещё говорит «beyond cursor»                      |
| [stale-specs-compile-and-cursor.md](./stale-specs-compile-and-cursor.md) | `compile-agents-md` и `cursor-mcp-deploy` про старый cursor-only срез |
| [plugin-flags-vs-spec.md](./plugin-flags-vs-spec.md)                     | `--agent-plugins` / `--skills` есть в CLI, нет в спеке                |
| [policy-remote-not-wired.md](./policy-remote-not-wired.md)               | Remote/ADO policy cascade не подключён                                |
| [no-mcp-subcommand.md](./no-mcp-subcommand.md)                           | В спеке ещё мелькает `bapm mcp`, в CLI его нет                        |
| [tests-home-isolation.md](./tests-home-isolation.md)                     | Тесты читают `~/.bapm` пользователя                                   |
| [cli-tests-cursor-resolves.md](./cli-tests-cursor-resolves.md)           | Пять CLI-тестов ждут, что Cursor не резолвится                        |

### Закрыто в этом working tree

| Файл                                                 | Тема                                   |
| ---------------------------------------------------- | -------------------------------------- |
| [zip-extract-merge.md](./zip-extract-merge.md)       | Zip больше не заменяет каталог целиком |
| [git-clone-idempotent.md](./git-clone-idempotent.md) | Повторный git clone в непустой каталог |
| [lock-secrets.md](./lock-secrets.md)                 | Запечённые секреты в lock              |
