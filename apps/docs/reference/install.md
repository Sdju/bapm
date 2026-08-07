# bapm install — флаги

По `bapm help install`.

## Использование

```text
bapm install [options]
bapm install <package-ref...>   # добавить в dependencies.apm (или --dev → devDependencies.apm), затем install
bapm install <archive.zip>      # install из pack-produced plain zip
```

Неизвестные флаги отвергаются. Локальный путь к `.zip` обрабатывается как archive; остальные positionals — package refs. Нельзя смешивать `.zip` и package refs. Frozen-режим отклоняет positional package-ref add.

Если манифеста ещё нет, positional package-ref add может создать минимальный манифест (см. notes в help).

## Параметры

| Флаг | Значение | Эффект | Default |
| --- | --- | --- | --- |
| `--frozen` | — | Fail, если lock нет или пины дрейфуют; при наличии — re-verify `deployed_file_hashes` | off (но см. CI ниже) |
| `--no-frozen` | — | Отключить frozen, в том числе CI-default | — |
| `--dry-run` | — | Превью direct deps / would-add; без durable project writes | off |
| `--force` | — | Accept force (overwrite / future security gates). Не обновляет refs и не обходит frozen/policy | off |
| `--allow-insecure` | — | Dual consent для direct `http://` deps с `allow_insecure: true` | off |
| `--allow-insecure-host` | `<hostname>` | Разрешить transitive `http://` с этого FQDN (повторяемый) | — |
| `--dev` | — | При package-ref add писать в `devDependencies.apm` (без positional — no-op) | off |
| `--only` | `apm` \| `mcp` | Только APM packages (без MCP) или только MCP configure (без APM materialize) | оба |
| `--target` | `<id>` | Принудительно активировать registered host target (например `cursor`) | auto-detect / манифест |
| `--exclude` | `<id>` | Пропустить MCP configure для runtime id; **не** полный skip install (повторяемый) | — |
| `--update` | — | Переразрешить mutable refs; нельзя с frozen / CI-default frozen | off |
| `--parallel-downloads` | `<n>` | Параллельные загрузки; `0` = serial | `4` |
| `-v`, `--verbose` | — | Богаче progress / diagnostics (не ослабляет frozen/policy) | off |
| `--policy` | `<path>` | Явный policy-файл (побеждает `apm-policy.yml` / `bapm-policy.yml`) | discovery |
| `--no-policy` | — | Пропустить policy discovery/checks (также `BAPM_POLICY_DISABLE=1`) | off |
| `--trust-transitive-mcp` | — | Деплоить MCP из зависимостей; по умолчанию только direct `dependencies.mcp` | off |
| `--help`, `-h` | — | Показать help | — |

## Замечания

- `--frozen` и `--no-frozen` взаимно исключаются.
- Frozen (явный или CI-default) нельзя сочетать с `--update`.
- Если env `CI` truthy (не `""`, `"0"`, `"false"`), install по умолчанию frozen, пока не передан `--no-frozen` (OpenAPM req-lk-018).
- `--force` ≠ `--target` (forced-target activation).
- При активном cursor eligible MCP пишутся в `.cursor/mcp.json` (прямые mcp по умолчанию). Auto-detect без `.cursor/` не создаёт каталог только ради MCP.

Сценарии: [Быстрый старт](/guide/quick-start), [US-01](/guide/situations/install-fresh), [US-02 CI / frozen](/guide/situations/ci-frozen).
