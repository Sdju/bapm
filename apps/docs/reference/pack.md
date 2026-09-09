# bapm pack — флаги

По `bapm pack --help`.

## Использование

```text
bapm pack [options]
```

Собирает plain-zip producer archive и/или host `marketplace.json`. Неизвестные флаги отвергаются. `--check-release` не создаёт и не пушит tags. Secret-pattern paths (`.env`, `*.pem`, …) отклоняются.

Опциональный файл `.bapmignore` в корне проекта (синтаксис как у `.gitignore`: `#`, `!`, `*`, `**`) исключает совпавшие пути из zip. Корневые `bapm.yml` / `apm.yml` всегда остаются в наборе; сам `.bapmignore` в архив не попадает. При отсутствии `.bapmignore` поведение как раньше — `.gitignore` **не** подставляется.

Claude/Codex здесь — **marketplace-output** emit. Runtime install/compile для тех же hosts — через `@b-apm/integration-claude` / `@b-apm/integration-codex` и detect, `active` или `--target`; `targets:` нужен только для override/custom host (см. [hosts](/guide/supported-hosts)).

## Параметры

| Флаг                   | Значение                | Эффект                                                                                         | Default        |
| ---------------------- | ----------------------- | ---------------------------------------------------------------------------------------------- | -------------- |
| `--archive`            | —                       | Записать plain zip artifact                                                                    | off            |
| `--agent-plugins`      | —                       | Pack validated Agent Plugins v1 portable root; не эмитит marketplace; нужен root `plugin.json` | off            |
| `--dry-run`            | —                       | Validate / collect без durable zip или marketplace.json                                        | off            |
| `--check-release`      | —                       | Gate tag↔manifest version (pr-004)                                                             | off            |
| `--tag`                | `<name>`                | Tag под check (опционально с `--check-release`; иначе HEAD)                                    | HEAD           |
| `--marketplace`, `-m`  | `all` \| `none` \| list | Фильтр host marketplace emit (`claude`, `codex`)                                               | all configured |
| `--marketplace-path`   | `FORMAT=PATH`           | Override output path (повторяемый; путь под project root)                                      | —              |
| `--offline`            | —                       | Fail closed, если remote package resolve нужен network                                         | off            |
| `--include-prerelease` | —                       | Включать prerelease tags при resolve version ranges                                            | off            |
| `--help`, `-h`         | —                       | Показать help                                                                                  | —              |

## Замечания

- При `marketplace:` в манифесте и выбранных outputs pack эмитит Claude/Codex `marketplace.json`.
- Marketplace-only проекты (без `dependencies:`) эмитят JSON и пропускают пустой zip.
- Gate-only: `--check-release` без `--archive` и без marketplace emit intent.
- Из архива опускаются `bapm.local.yml` и `bapm.local.lock.yaml` (unpublished surface).
- Пример `.bapmignore`: `README.md`, `CHANGELOG.md`, `docs/**` — типичные authoring-файлы вне дистрибутива; игнорированный `.env` не вызывает secret-refuse.
- Нечитаемый `.bapmignore` (например, каталог вместо файла) — fail closed, архив не создаётся.

### Пример `.bapmignore`

```gitignore
# omit authoring docs from the producer zip
README.md
CHANGELOG.md
docs/**

# keep LICENSE after a broad markdown omit
*.md
!LICENSE.md
```

См. также: [publish](/reference/publish), [marketplace](/reference/marketplace), [plugin](/reference/plugin), [US-06 Marketplace pack](/guide/situations/marketplace-pack), [lock-файл](/guide/lockfile).
