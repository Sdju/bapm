# bapm lock — флаги

По `bapm lock --help`.

## Использование

```text
bapm lock [options]
bapm lock export [options]
```

Неизвестные флаги и неожиданные positionals отвергаются. `--target` у `lock` нет — это resolve + lockfile без host deploy.

## Параметры

| Флаг                   | Значение | Эффект                              | Default   |
| ---------------------- | -------- | ----------------------------------- | --------- |
| `--update`             | —        | Переразрешить mutable refs          | off       |
| `-v`, `--verbose`      | —        | Подробный вывод                     | off       |
| `--parallel-downloads` | `<n>`    | Параллельные загрузки; `0` = serial | `4`       |
| `--policy`             | `<path>` | Явный policy-файл                   | discovery |
| `--no-policy`          | —        | Пропустить policy discovery/checks  | off       |
| `--help`, `-h`         | —        | Показать help                       | —         |

## lock export

Read-only SBOM из существующего lockfile (без resolve/deploy).

```text
bapm lock export [-f|--format cyclonedx|spdx] [-o|--output <file>] [--timestamp <iso>]
```

| Флаг             | Значение              | Эффект                       | Default                 |
| ---------------- | --------------------- | ---------------------------- | ----------------------- |
| `-f`, `--format` | `cyclonedx` \| `spdx` | Формат SBOM                  | `cyclonedx`             |
| `-o`, `--output` | `<file>`              | Путь записи                  | stdout / поведение core |
| `--timestamp`    | `<iso>`               | Явная метка времени в отчёте | —                       |
| `--help`, `-h`   | —                     | Показать help lock           | —                       |

При записи с `local`-источниками dual-write shared + `bapm.local.lock.yaml` (механика: [lock-файл](/guide/lockfile)).

## Локальный одиночный файл в lock

Зависимость `path:` на файл `.agent.md`, `.instructions.md` или `.prompt.md` — это virtual-file пакет. bapm пишет для него обычную local-строку с APM-полями; `name` — имя файла с суффиксом, `path`/`local_path` — путь от корня проекта, `content_hash` — хэш snapshot-пакета (`.apm/<agents|instructions|prompts>/<файл>` + сгенерированный `apm.yml`), а не отдельного файла.

```yaml
dependencies:
  - repo_url: local:ai/scout.agent.md
    name: scout.agent.md
    source: local
    path: ai/scout.agent.md
    local_path: ai/scout.agent.md
    package_type: local
    depth: 1
    resolved_by: root->scout.agent.md
    declaring_parent: root
    content_hash: sha256:…
    deployed_files:
      - .cursor/agents/scout.md
    deployed_file_hashes:
      .cursor/agents/scout.md: sha256:…
```

Суффикс задаёт тип и каталог snapshot: `.agent.md` → agent/`.apm/agents`, `.instructions.md` → instruction/`.apm/instructions`, `.prompt.md` → command (prompt)/`.apm/prompts`. Остальные `*.md` не принимаются как одиночные зависимости — используйте каталог с манифестом. `--frozen` и audit replay заново собирают snapshot из исходного файла и сравнивают `content_hash`; symlink, неизвестный суффикс, отсутствующий/невалидный frontmatter и изменение файла считаются drift.

## Проверки при resolve

- Два literal `git` + `ref` к одному пакету должны указывать на один коммит. Иначе resolve падает с `RESOLVE_IMMUTABLE_CONFLICT` и перечисляет обе цепочки/ref/commit. Semver-диапазоны не входят в эту проверку.
- `x-*` поля манифеста зависимости записываются в `extensions` строки lock; пустое поле не эмитится. См. [lock-файл](/guide/lockfile#расширения-зависимости-в-lock).

Связанные команды: [install](/reference/install), [update](/reference/update).
