# Lockfile

Lockfile фиксирует разрешённый граф: commits, hashes, deploy-пути. Без него у команды и CI легко получить «у меня работает иначе».

Discovery — **только cwd**.

## Когда появляется

```bash
bapm lock                 # resolve + lock, без deploy в Cursor
bapm install --target cursor   # lock + modules + deploy
```

| Действие           | Команда                            |
| ------------------ | ---------------------------------- |
| Только lock        | `bapm lock`                        |
| Lock + install     | `bapm install`                     |
| Без дрейфа пинов   | `bapm install --frozen`            |
| Переразрешить refs | `bapm update` / `install --update` |
| Только план        | `bapm update --dry-run`            |

Новый lock пишется как `bapm.lock.yaml`. Если уже есть `apm.lock.yaml` — write-back в него. Оба сразу — `LOCKFILE_DUAL_CONFLICT`. Legacy `apm.lock` игнорируется.

## Commit и CI

Коммитьте lock **вместе с манифестом**.

В CI при truthy env `CI` (не `""`, `"0"`, `"false"`) `install` по умолчанию **frozen**. Явный выход: `--no-frozen`. Frozen нельзя сочетать с `--update`.

Типичный CI: закоммиченный lock + `bapm install --frozen` (или просто `install` при `CI=1`).

Сценарий: [CI / frozen](/guide/situations/ci-frozen).

## Что на диске рядом

| Артефакт                                  | Смысл                                                                 |
| ----------------------------------------- | --------------------------------------------------------------------- |
| `bapm.lock.yaml` / `apm.lock.yaml`        | Зафиксированный граф                                                  |
| `apm_modules/`                            | Материализованные пакеты                                              |
| `deployed_files` / `deployed_file_hashes` | Атрибуция deploy; `--frozen` может сверить с диском                   |
| Deploy в Cursor                           | `.agents/skills/…`, `.cursor/…` — [быстрый старт](/guide/quick-start) |

`bapm lock` **не** принимает `--target`. Флаги: [lock](/reference/lock), [install](/reference/install).

## Чего не делать

- Не править lock вручную — сломаете пины и hash-карты. Нужен другой pin → `update` / правка манифеста + install.
- Не держать оба имени lock-файла.
- Не путать `--force` с обновлением refs: force не refresh'ит mutable refs и не обходит frozen/policy.
- Positional package-ref add в frozen отклонён.

Манифест: [config](/guide/config-manifest). Conformance: [conformance](/guide/conformance).
