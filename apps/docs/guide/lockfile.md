# Lockfile

Lockfile фиксирует разрешённый граф: commits, hashes, deploy-пути. Без него у команды и CI легко получить «у меня работает иначе».

Discovery — **только cwd**.

## Shared vs personal

| Файл                               | Scope                                             | Commit?                 |
| ---------------------------------- | ------------------------------------------------- | ----------------------- |
| `bapm.lock.yaml` / `apm.lock.yaml` | Shared team pins (git, registry, OpenAPM `path:`) | Да, вместе с манифестом |
| `bapm.local.lock.yaml`             | Personal pins from bapm `local` discriminator     | Нет — gitignore         |

Resolve/install merge both into one **effective** graph. Only the `local` discriminator goes into the personal file; OpenAPM `path:` stays shared even though the lock wire may say `source: local`. Inventory bags (`local_deployed_*`, MCP lists) stay on the shared document.

`apm.local.lock.yaml` is **not** supported — presence fails closed.

When you lock with a `local` source, bapm dual-writes and ensures `.gitignore` covers `bapm.local.lock.yaml` (same idea as ignoring `.agents/local/`). See [local sources](/guide/situations/team-local-active) and [personal overlay](/guide/manifest-overlay).

Legacy checkouts that still have personal-scope rows inside the shared lock keep working on read; the next successful `lock` / install migrates them into `bapm.local.lock.yaml`.

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

Новый shared lock пишется как `bapm.lock.yaml`. Если уже есть `apm.lock.yaml` — write-back в него. Оба сразу — `LOCKFILE_DUAL_CONFLICT`. Legacy `apm.lock` игнорируется. Personal lock is always `bapm.local.lock.yaml`.

## Commit и CI

Коммитьте **shared** lock вместе с манифестом. **Не** коммитьте `bapm.local.lock.yaml`.

В CI при truthy env `CI` (не `""`, `"0"`, `"false"`) `install` по умолчанию **frozen**. Явный выход: `--no-frozen`. Frozen нельзя сочетать с `--update`.

Типичный CI: закоммиченный shared lock + `bapm install --frozen` (или просто `install` при `CI=1`). Keep `local` WIP off CI-critical manifests when possible; missing personal lock is fine when there are no `local` sources.

Сценарий: [CI / frozen](/guide/situations/ci-frozen).

## Что на диске рядом

| Артефакт                                  | Смысл                                                                 |
| ----------------------------------------- | --------------------------------------------------------------------- |
| `bapm.lock.yaml` / `apm.lock.yaml`        | Shared зафиксированный граф                                           |
| `bapm.local.lock.yaml`                    | Personal `local` pins (gitignored)                                    |
| `apm_modules/`                            | Материализованные пакеты                                              |
| `deployed_files` / `deployed_file_hashes` | Атрибуция deploy; `--frozen` может сверить с диском                   |
| Deploy в Cursor                           | `.agents/skills/…`, `.cursor/…` — [быстрый старт](/guide/quick-start) |

`bapm lock` **не** принимает `--target`. Флаги: [lock](/reference/lock), [install](/reference/install). Pack/publish omit the personal lock (same unpublished surface as `bapm.local.yml`).

## Чего не делать

- Не править lock вручную — сломаете пины и hash-карты. Нужен другой pin → `update` / правка манифеста + install.
- Не держать оба имени shared lock-файла.
- Не коммитить `bapm.local.lock.yaml` / не путать его с shared lock.
- Не путать `--force` с обновлением refs: force не refresh'ит mutable refs и не обходит frozen/policy.
- Positional package-ref add в frozen отклонён.

Манифест: [config](/guide/config-manifest). Overlay: [bapm.local.yml](/guide/manifest-overlay). Conformance: [conformance](/guide/conformance).
