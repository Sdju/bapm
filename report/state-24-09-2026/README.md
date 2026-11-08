# Состояние расхождений — 24 сентября 2026

Снимок спорных мест между **bapm**, **microsoft/apm** и **OpenAPM v0.1**. Каждый файл — одно расхождение: что заявлено у APM / OpenAPM, какие есть варианты, что делает bapm сейчас.

Поведение сверено с кодом в working tree. Поведение APM — по `CONFORMANCE.md`, чеклисту и пользовательской документации, не по исходному коду APM.

Повторный аудит **08-11-2026**: карточки проверены по текущему дереву, у каждой есть уровень важности, разделы «Влияние», «Проверка» и «Рекомендация». Закрытые и исправленные карточки удалены — их история остаётся в git (коммит `4149149` и fix-коммиты ниже).

## Сводка

| Важность | Карточек | Что означает                                                                                                                                               |
| -------- | -------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| критично |        0 | молчаливая потеря/порча файлов, утечка секрета, принципиально небезопасная команда, дыра в обязательном security-гейте                                     |
| высокая  |        7 | в частом сценарии команда молча делает не то; дыра в CI-гейте; обходится security-контроль; заявленная возможность не работает; ломается совместная работа |
| средняя  |       12 | неверное поведение в узком сценарии; вводящий в заблуждение UX/JSON/диагностика; дрейф спеки; неполная фича с обходом                                      |
| низкая   |       10 | осознанное отличие без вреда, формулировки docs, редкий edge case с простым обходом                                                                        |

Высокий приоритет: сужение `targets`, MCP без каталога/trust, policy-hooks, grant-surface, `--no-policy`, TTY `bin/`, `update -y` в CI и изоляция тестов.

## Как читать карточку

| Поле                                   | Смысл                                                                                                                |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Статус**                             | `открыто` — решение не принято; `намеренно` — осознанное отличие; `исправлено` — в working tree уже другое поведение |
| **Класс**                              | баг, намеренное отличие, долг спеки, тест, продукт                                                                   |
| **Важность**                           | критично / высокая / средняя / низкая + одна фраза-обоснование                                                       |
| **APM / OpenAPM / спека / код / docs** | четыре источника правды, если они расходятся                                                                         |
| **Влияние**                            | кто, когда и что теряет; частота и обходной путь                                                                     |
| **Проверка**                           | точные `path:line`, тесты и минимальное воспроизведение                                                              |

## Индекс

### Намеренные отличия от APM (формат OpenAPM)

| Файл                                                                             | Тема                                                          | Важность |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------- | -------- |
| [diamond-intersection-vs-first-wins.md](./diamond-intersection-vs-first-wins.md) | Ромб зависимостей: пересечение диапазонов vs первое найденное | низкая   |
| [lock-sort-order.md](./lock-sort-order.md)                                       | Порядок записей в lock: `repo_url` vs глубина                 | низкая   |
| [yaml-anchors-strict.md](./yaml-anchors-strict.md)                               | YAML-якоря: строгий OpenAPM vs APM                            | низкая   |
| [openapm-8-5-layout.md](./openapm-8-5-layout.md)                                 | Раскладка файлов по агентам (§8.5) не заявлена                | низкая   |
| [compile-single-file.md](./compile-single-file.md)                               | `compile` пишет один файл, без `applyTo`                      | низкая   |
| [local-overlay-extension.md](./local-overlay-extension.md)                       | `bapm.local.yml` / `local` — только bapm                      | низкая   |
| [experimental-registries.md](./experimental-registries.md)                       | Registry-клиент за флагом, роль сервера не заявлена           | низкая   |

### Незавершённое или спорное поведение CLI

| Файл                                                         | Тема                                            | Важность |
| ------------------------------------------------------------ | ----------------------------------------------- | -------- |
| [install-force-noop.md](./install-force-noop.md)             | `--force` принимается и ничего не делает        | средняя  |
| [orphan-files-cleanup.md](./orphan-files-cleanup.md)         | Сироты после удаления пакета из манифеста       | средняя  |
| [targets-narrow-deploy.md](./targets-narrow-deploy.md)       | Корневые `targets` молча сужают раскладку       | высокая  |
| [update-not-blocked-in-ci.md](./update-not-blocked-in-ci.md) | `update -y` в CI не запрещён                    | высокая  |
| [update-dry-run-branches.md](./update-dry-run-branches.md)   | `--dry-run` показывает ветки как `keep`         | средняя  |
| [deps-why-is-direct.md](./deps-why-is-direct.md)             | `deps why --json`: `is_direct` по `resolved_by` | средняя  |
| [hash-formats.md](./hash-formats.md)                         | Разные форматы хешей в lock                     | низкая   |

### Policy / MCP / trust

| Файл                                                                 | Тема                                                    | Важность |
| -------------------------------------------------------------------- | ------------------------------------------------------- | -------- |
| [policy-hooks-ungated.md](./policy-hooks-ungated.md)                 | Hooks и canvas не под ExecutableTrust                   | высокая  |
| [policy-file-deny-only.md](./policy-file-deny-only.md)               | Файл политики только запрещает                          | средняя  |
| [grant-surface-all-or-nothing.md](./grant-surface-all-or-nothing.md) | Любое разрешение включает проверку всех MCP-пакетов     | высокая  |
| [deny-does-not-undeploy.md](./deny-does-not-undeploy.md)             | `deny` не убирает уже записанный сервер                 | средняя  |
| [no-policy-disables-org.md](./no-policy-disables-org.md)             | `--no-policy` отключает и org deny                      | высокая  |
| [trust-bin-interactive.md](./trust-bin-interactive.md)               | В TTY `bin/` ставится без `--trust-bin`                 | высокая  |
| [mcp-dir-must-exist.md](./mcp-dir-must-exist.md)                     | Часть агентов пишет MCP только если каталог уже есть    | средняя  |
| [skipped-primitives-silent.md](./skipped-primitives-silent.md)       | Неподдерживаемые типы файлов пропускаются без сообщения | средняя  |
| [copilot-windsurf-home-mcp.md](./copilot-windsurf-home-mcp.md)       | Copilot и Windsurf пишут MCP в `$HOME`                  | средняя  |

### Спека vs код / тесты

| Файл                                                                     | Тема                                                                  | Важность |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------- | -------- |
| [stale-specs-compile-and-cursor.md](./stale-specs-compile-and-cursor.md) | `compile-agents-md` и `cursor-mcp-deploy` про старый cursor-only срез | средняя  |
| [plugin-flags-vs-spec.md](./plugin-flags-vs-spec.md)                     | `--agent-plugins` / `--skills` есть в CLI, нет в спеке                | низкая   |
| [policy-remote-not-wired.md](./policy-remote-not-wired.md)               | Remote/ADO policy cascade не подключён к CLI                          | средняя  |
| [no-mcp-subcommand.md](./no-mcp-subcommand.md)                           | В спеке ещё мелькает `bapm mcp`, в CLI его нет                        | низкая   |
| [tests-home-isolation.md](./tests-home-isolation.md)                     | Тесты читают `~/.bapm` пользователя                                   | высокая  |
| [cli-tests-cursor-resolves.md](./cli-tests-cursor-resolves.md)           | Пять CLI-тестов ждут, что канонические интеграции не резолвятся       | средняя  |

## Исправлено и удалено (08.11.2026)

| Что                                                | Коммит                               |
| -------------------------------------------------- | ------------------------------------ |
| MCP `headers`, срезание `origin`, все active-хосты | `7fd32d2` (`fix/mcp-pipeline`)       |
| `uninstall` по точной идентичности                 | `bf19b1f` (`fix/uninstall-identity`) |
| `path:` в lock — project-relative                  | `e70a5b0` (`fix/path-lock-relative`) |
| `init --target` пишет только `active`              | `6eeccf9` (`fix/init-active-only`)   |
| `audit --ci` — только паритет скриптов             | `8738ad7` (`fix/audit-ci-help`)      |
| Frozen ловит смену `#ref`                          | `b9210cc` (`fix/frozen-ref-drift`)   |

Ранее закрыты и удалены: zip-merge, идемпотентный git clone, секреты в lock, приоритет `env`, legacy `active: [id]`, «beyond cursor» в `CONFORMANCE.md`.

## Что изменилось после повторного аудита (08.11.2026)

- **Уточнено:** `skipped-primitives-silent` — интеграции формируют skip-diagnostics, но install их не печатает; таблица `supported-hosts.md` устарела по Grok Build.
- **Новое:** `policy-remote-not-wired` — провайдер `github-owner-dotgithub` есть в core, но CLI не передаёт fetcher, поэтому org-policy в реальном запуске не ищется.
- **Уточнено:** `trust-bin-interactive` — TTY-implicit consent работает не всегда: при наличии grant-поверхности без разрешения пакета bin тоже withhold.
- **Уточнено:** `update-not-blocked-in-ci` — спека `lifecycle-update` говорит MUST отказать в frozen-контексте, а CLI не вычисляет effective frozen из `CI`.

## Как поддерживать

- Карточка — один файл; после изменения поведения обновляйте `Статус`, `Поведение сейчас`; после фикса удаляйте файл и строку индекса.
- `path:line` в разделах «Состояние»/«Проверка» — ориентир, а не контракт: при рефакторинге сверяйте grep'ом.
- Уровень важности пересматривается только с новым сценарием влияния, а не «на глаз».
