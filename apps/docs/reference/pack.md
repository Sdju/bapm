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

Режим `--strict-metadata` — preflight перед любой записью: проверяет метаданные producer-пакета и выбранных marketplace-пакетов. При ошибке команда завершается с exit `5`, не создавая ни zip, ни `marketplace.json`. Если одновременно запрошен `--check-versions` и версии не выровнены, побеждает exit `3`.

## Параметры

| Флаг                   | Значение                 | Эффект                                                                                         | Default        |
| ---------------------- | ------------------------ | ---------------------------------------------------------------------------------------------- | -------------- |
| `--archive`            | —                        | Записать plain zip artifact. Без флагов и без `marketplace:` zip пишется и так                 | off            |
| `--agent-plugins`      | —                        | Pack validated Agent Plugins v1 portable root; не эмитит marketplace; нужен root `plugin.json` | off            |
| `--format`             | `zip` \| `claude-plugin` | `zip` — обычный APM producer-архив (default); `claude-plugin` — Claude Code plugin bundle      | `zip`          |
| `--dry-run`            | —                        | Validate / collect без durable zip или marketplace.json                                        | off            |
| `--check-release`      | —                        | Проверить, что версия в манифесте совпадает с git-тегом                                        | off            |
| `--check-versions`     | —                        | Marketplace version alignment для local packages (`lockstep` / `tag_pattern` / `per_package`)  | off            |
| `--check-clean`        | —                        | Read-only drift gate: regenerate selected `marketplace.json` и diff с on-disk; exit `4`        | off            |
| `--strict-metadata`    | —                        | Проверить метаданные manifest / `plugin.json` / marketplace packages; exit `5`, без записи     | off            |
| `--tag`                | `<name>`                 | Tag под check (опционально с `--check-release`; иначе HEAD)                                    | HEAD           |
| `--marketplace`, `-m`  | `all` \| `none` \| list  | Фильтр host marketplace emit (`claude`, `codex`, `copilot`)                                    | all configured |
| `--marketplace-path`   | `FORMAT=PATH`            | Override output path (повторяемый; путь под project root)                                      | —              |
| `--offline`            | —                        | Fail closed, если remote package resolve нужен network                                         | off            |
| `--include-prerelease` | —                        | Включать prerelease tags при resolve version ranges                                            | off            |
| `--help`, `-h`         | —                        | Показать help                                                                                  | —              |

## Замечания

- При `marketplace:` в манифесте и выбранных outputs pack эмитит Claude (`claude`), Codex (`codex`) и/или Copilot (`copilot`) `marketplace.json`.
- Annotated/signed tags резолвятся в commit, на который указывает tag (peeled `refs/tags/X^{}`), а не в SHA tag-объекта: `source.sha` всегда содержит полный 40-символьный commit. Lightweight tags остаются без изменений; сокращённые SHA в `source.sha` отвергаются.
- Marketplace-only проекты (без `dependencies:`) эмитят JSON и пропускают пустой zip.
- Gate-only: `--check-release` / `--check-versions` / `--check-clean` без `--archive` и без marketplace emit intent.
- `--check-versions` без marketplace block — skip с informational сообщением, exit 0.
- `--check-clean` без marketplace block — skip, exit 0. При drift/missing — exit `4`; при `--check-versions`-misalignment exit `3` имеет приоритет.
- `--strict-metadata` — не gate-only: без `--archive` он всё равно собирает обычный pack (zip; marketplace-only проект может пропустить пустой zip). Ошибки метаданных дают exit `5`; при одновременном `--check-versions` exit `3` имеет приоритет.
- Из архива опускаются `bapm.local.yml` и `bapm.local.lock.yaml` (unpublished surface).
- Пример `.bapmignore`: `README.md`, `CHANGELOG.md`, `docs/**` — типичные authoring-файлы вне дистрибутива; игнорированный `.env` не вызывает secret-refuse.
- Нечитаемый `.bapmignore` (например, каталог вместо файла) — fail closed, архив не создаётся.
- Zip ставится через `bapm install ./file.zip` в пустой каталог: файлы, которые уже есть с другим содержимым, install не перезаписывает ([подробнее](/reference/install#замечания)).

### Что проверяет `--strict-metadata`

APM использует exit `5`, когда не может подтвердить (certify) remote-метаданные marketplace-пакетов. bapm не скачивает remote `apm.yml` при pack, поэтому реализована консервативная схема-проверка; она документирует ровно то, что гарантирует:

- **manifest** (`bapm.yml` / `apm.yml`): обязательные `name` (непустая строка) и `version` (semver 2.0.0). Опциональные `description`, `license`, `repository` — непустые строки; `author` — непустая строка (OpenAPM); `homepage` — абсолютный `http(s)` URL; `keywords` / `tags` — массивы строк. Неизвестные ключи не валят strict-проверку.
- **`plugin.json`** в корне и стандартных APM-путях (`.claude-plugin/`, `.github/plugin/`, `.cursor-plugin/`): обязательный `name`; непустые строки для `description`, `license`, `repository`; `version` — semver 2.0.0, если задан; `homepage` — `http(s)` URL; `author` — строка или объект с непустым `name` и строковыми `email` / `url`; `keywords` — массив строк. Для `bapm pack --agent-plugins` дополнительно требуется канонический `$schema` Agent Plugins v1 и валидное portable-имя.
- **marketplace packages** (только для выбранных outputs): локальные `source: ./…` записи проходят как есть (local metadata certifiable). Для remote-записей нужен явный непустой `description` и фиксированный display-`version` semver без range (`^`, `~`, `>=`, `*` и т.п.): bapm не фетчит remote-метаданные, поэтому иначе подтвердить их нельзя.

Диагностика содержит путь поля, например `bapm.yml#/version`, `plugin.json#/author/name` или `marketplace.packages[0].description`. Проверка выполняется до записи zip и `marketplace.json`, поэтому при exit `5` артефактов не остаётся.

### `--agent-plugins`: portable Agent Plugin archive

`bapm pack --agent-plugins` собирает plain-zip с portable-деревом Agent Plugins v1. В архив попадают (если они есть в корне и не исключены `.bapmignore`):

- корневые `plugin.json` и `mcp.json`;
- объявленные в `plugin.json` `commands` и `hooks` — по тем же относительным путям, что и в исходном плагине;
- `skills/` вместе с `SKILL.md` и вспомогательными файлами skill-каталогов;
- `agents/` и прочие sibling-assets (скрипты и файлы рядом с hooks/commands);
- нативные manifest-файлы вроде `.claude-plugin/plugin.json`.

Пути в `plugin.json` не переписываются: архив сохраняет исходную раскладку, поэтому consumer находит declared paths после распаковки.

Producer проверяет declared `commands` / `hooks` / `skills` до записи zip. Отсутствующий путь, path traversal, symlink или путь, вырезанный `.bapmignore` / hard-exclude-правилами, дают non-zero exit и не оставляют архив. `.bapmignore` можно использовать для authoring-файлов (`README.md`, `docs/**`), но не для компонентов, которые объявлены в `plugin.json`.

### `--format claude-plugin`: Claude Code plugin bundle

`bapm pack --format claude-plugin` собирает zip в раскладке, которую понимает Claude Code:

```text
plugin.json                 # manifest для APM/bapm-совместимых consumer'ов
.claude-plugin/plugin.json  # нативный Claude Code manifest (тот же JSON)
commands/
agents/
skills/
hooks/                      # hooks/*.json и скрипты рядом с ними
assets/                     # sibling assets, если они есть в пакете
```

Источник manifest'а выбирается так: корневой `plugin.json`, затем `.claude-plugin/plugin.json`, иначе manifest синтезируется из `bapm.yml` / `apm.yml` (`name`, `version`, `description`, `author`, `license`, `homepage`, `repository`, `keywords`). Полученный manifest записывается в оба пути, поэтому bundle работает и как Claude plugin, и как plugin-пакет для остальных consumer'ов.

Дерево пакета сохраняется по относительным путям: `commands/`, `agents/`, `skills/<name>/` вместе с вспомогательными файлами, `hooks/` вместе со скриптами и sibling assets. Пути в manifest'е не переписываются. Если в корне есть `hooks.json` и manifest не объявляет `hooks`, в manifest добавляется `"hooks": "./hooks.json"`.

Перед записью zip проверяются declared `commands` / `hooks` / `agents` / `skills` (а также строковые path-формы `mcpServers`, `lspServers`, `monitors`). Отсутствующий путь, `..` / absolute traversal, symlink или путь, вырезанный `.bapmignore` / hard-exclude-правилами, дают non-zero exit и не оставляют архив. Голое имя skill (`"hello"`) резолвится в `skills/hello`. Корневые `bapm.yml` / `apm.yml` и lock-файлы в Claude bundle не попадают.

APM при `--format claude-plugin` по умолчанию пишет каталог `{name}-{version}/`, а с `--archive` — zip. bapm pack всегда пишет один zip-артефакт (как и его default pack); каталог можно получить обычной распаковкой.

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
