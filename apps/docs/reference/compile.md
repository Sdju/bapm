# bapm compile — флаги

По `bapm compile --help`.

## Использование

```text
bapm compile [-o PATH] [--target <id>[,<id>…]] [--all] [--distributed] [--strategy <name>] [--clean] [--dry-run] [-v] [--watch] [--validate]
bapm compile --global [--target <id>[,<id>…]] [--all] [--distributed] [--clean] [--dry-run] [-v] [--watch]
```

Выбранный агент задаёт путь по умолчанию и состав файла: `AGENTS.md` (Cursor, Codex, OpenCode, Kiro, Grok Build, Hermes, Antigravity), `CLAUDE.md`, `.github/copilot-instructions.md`, `GEMINI.md`. Windsurf, Grok Bot и IntelliJ compile не поддерживают. Что попадает в файл у каждого агента: [Собрать AGENTS.md](/guide/situations/compile-agents#contents). Нужен `bapm.yml` в текущем каталоге; для `--global` — в global root. Неизвестные флаги отвергаются.

## Global {#global}

`bapm compile --global` (`-g`) собирает **user-scope root context** из
global-проекта `~/.bapm` (`BAPM_HOME` override) и пишет файлы в home-каталоги
агентов. Project `bapm.yml`, project lock и project harness-файлы не читаются
и не изменяются.

```bash
bapm install --global            # сначала ставит глобальные пакеты/примитивы
bapm compile --global --all      # собрать все поддерживаемые хосты
bapm compile -g --target cursor  # только ~/.cursor/AGENTS.md
bapm compile -g --dry-run        # показать would-write пути
```

| Host         | Global compile output   |
| ------------ | ----------------------- |
| Cursor       | `~/.cursor/AGENTS.md`   |
| Claude Code  | `~/.claude/CLAUDE.md`   |
| Codex CLI    | `~/.codex/AGENTS.md`    |
| agent-skills | — (compile отсутствует) |

Другие хосты, включая Gemini, Copilot, OpenCode, Windsurf, Kiro и custom
targets, дают ошибку
`Global compile is not supported for target "…". Supported global compile hosts: …`.
Для них остаётся project compile. Global selection: `--target` / `--all` →
`active` из `~/.bapm/bapm.yml` → `target` из `~/.bapm/config.json` →
`detectGlobal` по `~/.cursor`, `~/.claude`, `~/.codex` → fail.

Особенности global-режима:

- `-o` / `--output` запрещён: путь принадлежит хосту и задаётся его
  `globalCompileOutput` (home-relative).
- `--distributed` и multi-target (`--target cursor,claude` или `--all`)
  работают, пока пути выбранных хостов различны. Distributed-каталоги
  раскладываются внутри home-root выбранного хоста, например
  `~/.cursor/src/AGENTS.md`; выходы за пределы home-root отвергаются.
- Build ID, `--dry-run`, `--validate`, `--clean` и `--watch` используют
  global root как источник входа, а `$HOME` как deploy-root.
- `--clean` сканирует только home-root выбранных хостов (`.cursor`, `.claude`,
  `.codex`), а не весь `$HOME`; удаляются только orphaned generated-файлы с
  валидным Build ID.
- `--watch` следит за `~/.bapm` (манифест, `.apm/`, `apm_modules/`, локальные
  зависимости), а пишет в home. Требуется существующий
  `~/.bapm/bapm.yml`; `compile -g` не создаёт global-манифест (это делает
  `bapm install -g`).

Остающийся gap: global compile реализован только для Cursor, Claude Code и
Codex; остальные хосты и их user-scope пути не поддержаны в этом релизе.

`--target cursor,claude` и `--all` собирают несколько файлов за один запуск. `--all` берёт все зарегистрированные хосты с поддержкой compile.

::: warning Общий `AGENTS.md`
Cursor, Codex, OpenCode, Kiro, Grok Build, Hermes и Antigravity используют один и тот же `AGENTS.md`. Если среди выбранных хостов несколько пишут в один путь, `bapm compile` завершается ошибкой и перечисляет хосты и путь — файл не перезаписывается. Выберите по одному хосту на путь: `--target cursor`, затем отдельный запуск с `-o` или другим хостом.
:::

## Параметры

| Флаг              | Значение       | Эффект                                                                                                                                                                 | Default                                |
| ----------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `-o`, `--output`  | `PATH`         | Другой путь. Только для одного выбранного хоста. Для Codex, OpenCode, Grok Build и Hermes имя должно быть `AGENTS.md`, для Gemini — `GEMINI.md`. С `--global` запрещён | путь агента                            |
| `--target`        | `<id>[,<id>…]` | Force host или список хостов через запятую (перекрывает `active`)                                                                                                      | `active` (sole) → config → auto-detect |
| `--global`, `-g`  | —              | Собрать user-scope root из `~/.bapm` в home-каталоги Cursor/Claude/Codex                                                                                               | off                                    |
| `--all`           | —              | Собрать для всех зарегистрированных compile-capable хостов                                                                                                             | off                                    |
| `--distributed`   | —              | Opt-in: разложить instructions по каталогам из `applyTo`                                                                                                               | off                                    |
| `--strategy`      | `<name>`       | `single-file` (по умолчанию) или `distributed`                                                                                                                         | `single-file`                          |
| `--clean`         | —              | Удалить осиротевшие generated-файлы выбранных хостов (только с валидным Build ID)                                                                                      | off                                    |
| `--dry-run`       | —              | Превью всех would-write путей и would-remove для `--clean`; не менять файлы                                                                                            | off                                    |
| `-v`, `--verbose` | —              | Thin source attribution (name, type, path)                                                                                                                             | off                                    |
| `--watch`, `-w`   | —              | Собрать один раз, затем пересобирать при изменении входов; Ctrl+C / SIGTERM останавливает                                                                              | off                                    |
| `--validate`      | —              | Только discover/validate; не писать и не чистить                                                                                                                       | off                                    |
| `--help`, `-h`    | —              | Показать help                                                                                                                                                          | —                                      |

`--dry-run` и `--validate` не пишут выходные файлы. В multi-target режиме `--dry-run` печатает по строке на каждый хост. `--validate` имеет приоритет: `--clean` при нём не удаляет файлы.

`--watch` несовместим с `--validate`: watch обязан писать результат каждого прогона, поэтому CLI отвергает сочетание до запуска. `--watch --dry-run` разрешён и только печатает would-write на каждом изменении. С `--watch` можно использовать `--target`, `--all`, `--distributed`, `--strategy` и `--clean`.

Выбор host: `--target` / `--all` → sole манифест `active` → `target` из `~/.bapm/config.json` → sole auto-detect → fail. Multi-`active` без `--target` — ошибка. `--target` и `--all` взаимоисключающие. `-o` нельзя сочетать с несколькими хостами: один путь не может быть общим для разных хостов. `--clean` использует тот же выбор хостов и не требует явного `--target`, если срабатывает sole `active` / config / auto-detect.

`grok-bot`, `hermes` и `intellij` — explicit-only; у `intellij` нет `compile`, поэтому `--target intellij` завершается диагностикой, а не записью файла.

::: tip Collision policy
Перед записью compile вычисляет пути всех выбранных хостов. Если два хоста претендуют на один путь (например, `AGENTS.md`), запуск падает с диагностикой вида `Compile target collision: hosts "cursor", "codex" all write "AGENTS.md"` и ничего не пишет. Молчаливой перезаписи нет.
:::

## Build ID {#build-id}

Каждый собранный Markdown-файл заканчивается одной детерминированной строкой:

```text
<!-- Build ID: 4f0c2a7b91de -->
```

Это первые 12 hex-символов SHA-256 от нормализованного содержимого без самой строки Build ID (нормализуются переводы строк, BOM и хвостовые пробелы строк). Поэтому:

- одинаковый вход даёт одинаковый Build ID при повторных запусках;
- изменённый вход даёт другой Build ID;
- ручная правка сгенерированного файла делает Build ID невалидным (это защищает `--clean`).

Build ID — это маркер дрейфа, а не подпись и не attestation происхождения.

## Clean {#clean}

`--clean` удаляет только **осиротевшие** generated-выходы выбранных хостов: файлы, которые имеют форму выходного файла хоста (`AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md` и т. д.), не входят в текущий план сборки и содержат валидный Build ID, совпадающий с содержимым.

```bash
bapm compile --clean --dry-run   # показать, что будет удалено
bapm compile --clean             # собрать текущие файлы и удалить осиротевшие
```

Правила безопасности:

- файл без Build ID считается ручным и не удаляется;
- generated-файл, изменённый после сборки, имеет невалидный Build ID и не удаляется (в verbose-режиме видно `kept … (modified)`);
- текущие запланированные выходы не удаляются;
- `--clean --dry-run` ничего не пишет и не удаляет, только печатает `would remove …`;
- `--clean --validate` не удаляет ничего (validate-first);
- в multi-target режиме учитываются формы выходов всех выбранных хостов; в distributed mode осиротевшие вложенные файлы прошлых раскладок тоже удаляются.

`--clean` — это очистка orphans, а не «удалить всё сгенерированное»: текущий выход пересобирается обычной записью, а удаляются только файлы, которых больше нет в плане. С `--global` поиск ограничен home-root выбранных хостов (`.cursor`, `.claude`, `.codex`), поэтому `$HOME` целиком не сканируется.

## Distributed mode {#distributed}

`--distributed` (то же, что `--strategy distributed`) — opt-in. По умолчанию compile по-прежнему собирает один файл на хост.

В distributed mode compile читает `applyTo` у instruction-примитивов (строка, список через запятую или YAML-список; `globs` принимается как алиас) и берёт буквальный префикс каталога до первого glob-сегмента:

| `applyTo`         | Каталог        |
| ----------------- | -------------- |
| `src/**`          | `src/`         |
| `src/**/*.ts`     | `src/`         |
| `src/foo.ts`      | `src/`         |
| `docs/*.md`       | `docs/`        |
| `**/*.ts`, `*.ts` | корень проекта |
| `{src,lib}/**`    | корень проекта |
| имя без `/`       | корень проекта |

Имя и префикс файла остаются за хостом: `src/**` даёт `src/AGENTS.md` для Cursor/Codex, `src/CLAUDE.md` для Claude и `.github/src/copilot-instructions.md` для Copilot. Instructions без `applyTo`, с root-only glob и все не-instruction примитивы остаются в корневом выходном файле. Если все instructions разложены по подкаталогам, пустой корневой файл не создаётся.

`--target`, `--all`, `--dry-run` и `--validate` работают как обычно. `-o` в distributed mode запрещён: у каждого каталога свой файл. Абсолютные пути, `..`, служебные каталоги (`.git`, `node_modules`, `apm_modules`, `bapm_modules`) и симлинки в пути выхода отвергаются до записи. С `--global` distributed-каталоги раскладываются внутри home-root выбранного хоста; выходы за пределы этого root отвергаются. Это консервативное подмножество APM: файловый scoring и наследование контекста APM-оптимизатора не реализованы.

Сценарий: [Собрать AGENTS.md](/guide/situations/compile-agents).

## Watch {#watch}

```bash
bapm compile --watch
bapm compile --watch --target cursor,claude
bapm compile --watch --distributed --clean
bapm compile --global --watch --all
```

С `--global` watch следит за global root `~/.bapm`, а не за текущим project.

`--watch` делает один обычный compile, затем следит за входами:

- `bapm.yml` / `apm.yml` и `bapm.local.yml` (а также `apm.local.yml`, если он появится);
- корневые `SKILL.md` и `*.prompt.md`;
- `.apm/`, `apm_modules/`, `skills/`, `hooks/`, `.agents/local/`;
- каталоги локальных зависимостей из манифеста (`local:` / `path:`).

Изменения склеиваются debounce-окном ~200 мс, прогоны не пересекаются: событие во время сборки даёт один отложенный перезапуск. При изменении манифеста набор отслеживаемых локальных каталогов пересчитывается.

Если compile упал (например, манифест временно невалиден), ошибка печатается, watcher продолжает работать; следующее изменение запускает новую попытку. Ctrl+C и SIGTERM закрывают watcher и завершают процесс с кодом `0`. Сетевых запросов watch не добавляет: если изменились зависимости, выполните `bapm install` отдельно.

Ограничения: watch не следит за git-зависимостями и не переустанавливает `apm_modules`; изменение уже установленного пакета в кэше не подхватывается, пока пакет не будет материализован заново. Watch также не реализует file-match scoring и наследование контекста APM-оптимизатора.
