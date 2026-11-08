# Состояние расхождений — 24 сентября 2026

Отчёт закрыт **08-11-2026**. Все 43 карточки либо исправлены в коде, либо задокументированы как намеренные отличия, либо подтверждены как уже закрытые. Файлы карточек удалены; их содержимое и история решений остаются в git.

- Базовый снимок карточек: `4149149`.
- Работа велась в ветке `docs/report-discrepancies-audit`.
- Поведение сверено с working tree; APM — по `CONFORMANCE.md`, чеклисту и пользовательской документации.

## Итог

| Показатель                               | Значение |
| ---------------------------------------- | -------: |
| Карточек в снимке                        |       43 |
| Исправлено в коде                        |       25 |
| Задокументировано как намеренное отличие |       12 |
| Подтверждено закрытым                    |        6 |
| Осталось открытых                        |        0 |

## Пачки исправлений

### Пачка 5 — остатки

| Что                                                       | Коммит                       |
| --------------------------------------------------------- | ---------------------------- |
| `deny` удаляет уже записанный MCP-сервер из host-конфигов | `efc1357` (`fix/deny-prune`) |

### Пачка 4

| Что                                                   | Коммит                                    |
| ----------------------------------------------------- | ----------------------------------------- |
| Unmentioned dependency MCP пропускается с warning     | `72a7e04` (`fix/grant-surface-skip`)      |
| Remote org policy подключён через CLI fetcher         | `2a771ae` (`fix/policy-remote-fetch`)     |
| Copilot/Windsurf: warning о user-global MCP + opt-out | `4d70564` (`fix/global-mcp-warning`)      |
| 7 намеренных отличий сведены в conformance-таблицу    | `878b2da` (`fix/intentional-differences`) |

### Пачка 3

| Что                                                        | Коммит                                  |
| ---------------------------------------------------------- | --------------------------------------- |
| Hooks под ExecutableTrust при наличии grant/org deny       | `bf03d8f` (`fix/hooks-trust`)           |
| `bin/` требует явного согласия даже в TTY                  | `b0f13fe` (`fix/trust-bin-explicit`)    |
| 5 CLI-тестов изолированы от `NODE_PATH`                    | `56032c0` (`fix/cli-test-isolation`)    |
| Спеки `compile-agents-md` и `cursor-mcp-deploy` переписаны | `8ed4f2e` (`fix/stale-specs`)           |
| `--no-policy` не отключает org deny                        | `4b6b22c` (`fix/no-policy-org`)         |
| `install --force` печатает предупреждение о no-op          | `99b167e` (`fix/install-force-warning`) |

### Пачка 2

| Что                                                         | Коммит                                 |
| ----------------------------------------------------------- | -------------------------------------- |
| `update -y` в CI требует `--force`                          | `8a7ede0` (`fix/ci-update-gate`)       |
| Предупреждения install и fail-closed на пустом `targets`    | `ecfd3a5` (`fix/install-diagnostics`)  |
| `deps why --json`: корректный `is_direct`                   | `d57b85a` (`fix/deps-why-direct`)      |
| `update --dry-run` резолвит ветки/literal refs              | `d70c954` (`fix/update-dry-run-refs`)  |
| Docs/spec: orphan cleanup, хеши, policy allow, plugin flags | `0d99181` (`fix/docs-spec-debt`)       |
| Тесты изолированы от реального `~/.bapm`                    | `235a945` (`fix/tests-home-isolation`) |

### Пачка 1

| Что                                                | Коммит                               |
| -------------------------------------------------- | ------------------------------------ |
| MCP `headers`, срезание `origin`, все active-хосты | `7fd32d2` (`fix/mcp-pipeline`)       |
| `uninstall` по точной идентичности                 | `bf19b1f` (`fix/uninstall-identity`) |
| `path:` в lock — project-relative                  | `e70a5b0` (`fix/path-lock-relative`) |
| `init --target` пишет только `active`              | `6eeccf9` (`fix/init-active-only`)   |
| `audit --ci` — только паритет скриптов             | `8738ad7` (`fix/audit-ci-help`)      |
| Frozen ловит смену `#ref`                          | `b9210cc` (`fix/frozen-ref-drift`)   |

### Закрыто до исправлений

Zip-merge, идемпотентный git clone, секреты в lock, приоритет `env`, legacy `active: [id]`, «beyond cursor» в `CONFORMANCE.md`.

## Намеренные отличия (задокументированы)

Сведены в `apps/docs/guide/conformance.md` и limitations `CONFORMANCE.md`:

- ромб зависимостей — пересечение semver-диапазонов (OpenAPM), а не first-wins (APM);
- порядок lock — `(repo_url, virtual_path)`, а не глубина;
- строгий YAML subset — якоря/алиасы отвергаются при чтении;
- OpenAPM §8.5 per-target layout не заявлен; раскладка — per `@b-apm/integration-*`;
- `compile` пишет один файл на запуск, без per-path `applyTo`;
- `bapm.local.yml` / `local:` — расширение только bapm;
- registry-клиент за `BAPM_EXPERIMENTAL_REGISTRIES=1`, роль registry-хоста не заявлена.

## Проверки на финальном HEAD

| Проверка                                   | Результат               |
| ------------------------------------------ | ----------------------- |
| `vp run -r build`                          | 15 пакетов              |
| `packages/core` tests                      | 249 файлов / 1284 теста |
| `packages/cli` tests                       | 119 файлов / 618 тестов |
| `vp check`                                 | 0 ошибок, 15 warnings   |
| `node scripts/check-feod.mjs`              | OK                      |
| `node scripts/check-conformance-drift.mjs` | OK, без diff            |
| `openspec validate --specs --strict`       | 89/89                   |

## Как поддерживать

Новое расхождение оформляйте отдельным файлом в этом каталоге: заголовок, `Статус`, `Класс`, `Важность`, «Суть», «Влияние», «Состояние», «Проверка», «Вариации», «Рекомендация», «Поведение сейчас». После фикса файл удаляйте — решение остаётся в git.
