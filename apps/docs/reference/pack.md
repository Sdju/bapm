# bapm pack — флаги

По `bapm pack --help`.

## Использование

```text
bapm pack [options]
```

Собирает plain-zip producer archive и/или host `marketplace.json`. Неизвестные флаги отвергаются. `--check-release` не создаёт и не пушит tags. `--check-versions` — отдельный gate выравнивания версий local packages marketplace (не путать с `--check-release`). Secret-pattern paths (`.env`, `*.pem`, …) отклоняются.

Опциональный файл `.bapmignore` в корне проекта (синтаксис как у `.gitignore`: `#`, `!`, `*`, `**`) исключает совпавшие пути из zip. Корневые `bapm.yml` / `apm.yml` всегда остаются в наборе; сам `.bapmignore` в архив не попадает. При отсутствии `.bapmignore` поведение как раньше — `.gitignore` **не** подставляется.

Для `--check-versions`: если у local package есть `bapm.yml`/`apm.yml`, YAML **authoritative** (при битом манифесте fallback на `plugin.json` нет). Иначе версия читается из `plugin.json` (корневой или стандартные APM-пути: `.github/plugin/`, `.claude-plugin/`, `.cursor-plugin/`).

Для `marketplace.json` нужны установленные `@b-apm/integration-claude`, `@b-apm/integration-codex` и/или `@b-apm/integration-copilot`. `pack` только собирает файлы и не устанавливает пакеты в проект.

Режим `--check-clean` — read-only drift gate по APM-семантике: `pack` заново собирает выбранные host `marketplace.json` в памяти и сравнивает их с файлами на диске. Отсутствующий или отличающийся артефакт даёт exit `4`; ничего не записывается (ни zip, ни JSON). Проверяются только marketplace outputs, а не произвольные uncommitted-файлы git.

## Параметры

| Флаг                   | Значение                | Эффект                                                                                         | Default        |
| ---------------------- | ----------------------- | ---------------------------------------------------------------------------------------------- | -------------- |
| `--archive`            | —                       | Записать plain zip artifact. Без флагов и без `marketplace:` zip пишется и так                 | off            |
| `--agent-plugins`      | —                       | Pack validated Agent Plugins v1 portable root; не эмитит marketplace; нужен root `plugin.json` | off            |
| `--dry-run`            | —                       | Validate / collect без durable zip или marketplace.json                                        | off            |
| `--check-release`      | —                       | Проверить, что версия в манифесте совпадает с git-тегом                                        | off            |
| `--check-versions`     | —                       | Marketplace version alignment для local packages (`lockstep` / `tag_pattern` / `per_package`)  | off            |
| `--check-clean`        | —                       | Read-only drift gate: regenerate selected `marketplace.json` и diff с on-disk; exit `4`        | off            |
| `--tag`                | `<name>`                | Tag под check (опционально с `--check-release`; иначе HEAD)                                    | HEAD           |
| `--marketplace`, `-m`  | `all` \| `none` \| list | Фильтр host marketplace emit (`claude`, `codex`, `copilot`)                                    | all configured |
| `--marketplace-path`   | `FORMAT=PATH`           | Override output path (повторяемый; путь под project root)                                      | —              |
| `--offline`            | —                       | Fail closed, если remote package resolve нужен network                                         | off            |
| `--include-prerelease` | —                       | Включать prerelease tags при resolve version ranges                                            | off            |
| `--help`, `-h`         | —                       | Показать help                                                                                  | —              |

## Замечания

- При `marketplace:` в манифесте и выбранных outputs pack эмитит Claude (`claude`), Codex (`codex`) и/или Copilot (`copilot`) `marketplace.json`.
- Marketplace-only проекты (без `dependencies:`) эмитят JSON и пропускают пустой zip.
- Gate-only: `--check-release` / `--check-versions` / `--check-clean` без `--archive` и без marketplace emit intent.
- `--check-versions` без marketplace block — skip с informational сообщением, exit 0.
- `--check-clean` без marketplace block — skip, exit 0. При drift/missing — exit `4`; при `--check-versions`-misalignment exit `3` имеет приоритет.
- Из архива опускаются `bapm.local.yml` и `bapm.local.lock.yaml` (unpublished surface).
- Пример `.bapmignore`: `README.md`, `CHANGELOG.md`, `docs/**` — типичные authoring-файлы вне дистрибутива; игнорированный `.env` не вызывает secret-refuse.
- Нечитаемый `.bapmignore` (например, каталог вместо файла) — fail closed, архив не создаётся.
- Zip ставится через `bapm install ./file.zip` в пустой каталог: файлы, которые уже есть с другим содержимым, install не перезаписывает ([подробнее](/reference/install#замечания)).

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

См. также: [publish](/reference/publish), [marketplace](/reference/marketplace), [plugin](/reference/plugin), [Сборка маркетплейса](/guide/situations/marketplace-pack), [lock-файл](/guide/lockfile).
