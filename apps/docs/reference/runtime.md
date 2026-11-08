# bapm runtime — интроспекция AI runtime CLI

Read-only команда для проверки AI CLI (`copilot`, `codex`, `gemini`, `llm`), которые APM/bapm использует для `scripts:`. Команда ничего не скачивает, не устанавливает и не меняет конфигурацию.

:::caution[Экспериментально и частично]
`bapm runtime list` и `bapm runtime status` реализованы. `bapm runtime setup` и `bapm runtime remove` пока **не реализованы** и завершаются с exit `1` — это осознанно отложено, а не заглушка. Устанавливайте runtime штатным установщиком upstream.
:::

## Использование

```text
bapm runtime list [--json]
bapm runtime status [NAME] [--json]
bapm runtime setup RUNTIME   # не реализовано, exit 1
bapm runtime remove RUNTIME  # не реализовано, exit 1
```

| Команда               | Что делает                                                  |
| --------------------- | ----------------------------------------------------------- |
| `runtime list`        | Все известные runtime, доступность, источник, версия и путь |
| `runtime status`      | Порядок предпочтения и активный runtime                     |
| `runtime status NAME` | Детальный статус одного runtime; неизвестное имя — exit `1` |
| `runtime setup`       | Не реализовано (deferred); ничего не устанавливает          |
| `runtime remove`      | Не реализовано (deferred); ничего не удаляет                |
| `runtime --help`      | Справка; `setup`/`remove` помечены как отложенные           |

`--json` даёт стабильный машиночитаемый вывод для `list` и `status`.

## Известные runtime

Порядок предпочтения совпадает с APM: `copilot -> codex -> gemini -> llm`.

| Runtime   | Бинарник  | Описание                 |
| --------- | --------- | ------------------------ |
| `copilot` | `copilot` | GitHub Copilot CLI       |
| `codex`   | `codex`   | OpenAI Codex CLI         |
| `gemini`  | `gemini`  | Google Gemini CLI        |
| `llm`     | `llm`     | Simon Willison's LLM CLI |

## Как определяется доступность

Проверка локальная, без сети:

1. Управляемый каталог runtime: `BAPM_RUNTIME_DIR`, иначе `~/.bapm/runtimes` и `~/.apm/runtimes`.
2. Поиск бинарника в `PATH` из окружения процесса.
3. Если бинарник найден — короткий локальный вызов `<binary> --version` (таймаут 5 секунд). Ошибка или зависание дают `version: null`.

Источник (`source`) в выводе:

| `source`  | Значение                               |
| --------- | -------------------------------------- |
| `runtime` | Найден в управляемом каталоге runtime  |
| `path`    | Найден через `PATH`                    |
| `null`    | Бинарник не найден, runtime недоступен |

Версия и путь не гарантируют, что runtime настроен для APM-скриптов — команда только сообщает, что бинарник существует.

## `bapm runtime list`

Таблица по умолчанию:

```text
STATUS         RUNTIME  SOURCE   VERSION     PATH              DESCRIPTION
installed      copilot  path     copilot 1.2 /usr/bin/copilot  GitHub Copilot CLI
not installed  codex    -        -           -                 OpenAI Codex CLI
```

JSON (`--json`) — массив строк в порядке предпочтения:

```json
[
  {
    "name": "copilot",
    "binary": "copilot",
    "description": "GitHub Copilot CLI",
    "preference": 10,
    "available": true,
    "source": "path",
    "path": "/usr/bin/copilot",
    "version": "copilot 1.2.3"
  }
]
```

Поля и порядок строк стабильны. Для недоступного runtime: `available: false`, `source: null`, `path: null`, `version: null`.

## `bapm runtime status`

Без `NAME` печатает порядок предпочтения, активный runtime и таблицу известных runtime. Активный runtime — первый доступный в порядке `copilot -> codex -> gemini -> llm`; если доступных нет — `none available`.

```text
Preference order: copilot -> codex -> gemini -> llm
Active runtime: gemini

STATUS         RUNTIME  SOURCE  VERSION ...
...
```

JSON без `NAME`:

```json
{
  "active": "gemini",
  "preferenceOrder": ["copilot", "codex", "gemini", "llm"],
  "runtimes": []
}
```

С `NAME` — детальный статус одного runtime:

```text
Runtime: codex
Status: installed
Source: runtime
Path: /home/me/.bapm/runtimes/codex
Version: codex 0.20.0
Active: yes
Description: OpenAI Codex CLI
Preference order: copilot -> codex -> gemini -> llm
```

JSON с `NAME` добавляет к строке `list` поля `active` и `preferenceOrder`. Неизвестное имя завершает команду с exit `1` и перечисляет известные runtime.

## Отложенные `setup` и `remove`

`bapm runtime setup` и `bapm runtime remove` намеренно не реализованы в этой версии. Они не имитируют установку, ничего не пишут на диск и завершаются с exit `1`:

```text
bapm: runtime setup is not implemented (deferred); bapm runtime is read-only and never downloads, installs, or removes runtimes
```

Установка и удаление runtime остаются за upstream-установщиками (например, npm-пакетами или официальными скриптами). Когда эти операции появятся, документация и контракт будут обновлены.

## Коды возврата

| Код | Значение                                                             |
| --- | -------------------------------------------------------------------- |
| `0` | `list`, `status` или help успешно выполнены                          |
| `1` | Неизвестный subcommand/runtime, неверные аргументы, `setup`/`remove` |

## См. также

- [run / preview](/reference/run) — выполнение скриптов из манифеста
- [targets](/reference/targets) — агенты, которые получают примитивы
- [doctor](/reference/doctor) — проверка окружения и проекта
