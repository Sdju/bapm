# Команды

Краткий обзор команд по задачам. Все флаги — в [Справке](/reference/) и в `bapm <команда> --help`.

## Установка и обновление

| Команда                | Что делает                                                        |
| ---------------------- | ----------------------------------------------------------------- |
| `bapm init`            | Создаёт `bapm.yml`                                                |
| `bapm init --discover` | Показывает существующий harness и предлагает `active` (read-only) |
| `bapm install`         | Скачивает пакеты, пишет lock, раскладывает файлы агенту           |
| `bapm install <ref>`   | Добавляет пакет в манифест и устанавливает                        |
| `bapm outdated`        | Показывает пакеты, для которых есть более новые версии            |
| `bapm update`          | Обновляет версии в lock (с подтверждением или `-y`)               |
| `bapm uninstall <имя>` | Убирает пакет из манифеста, lock и с диска по точной идентичности |
| `bapm lock`            | Только lock, без раскладки файлов                                 |

```bash
bapm init --discover             # что уже настроено в проекте
bapm init --discover --apply     # создать bapm.yml по найденному
bapm install acme/agent-skills   # добавить пакет
bapm outdated                    # что устарело
bapm update -y                   # обновить
```

## Разобраться, что установлено

| Команда                   | Что делает                                                                  |
| ------------------------- | --------------------------------------------------------------------------- |
| `bapm deps list` / `tree` | Список и дерево зависимостей из lock                                        |
| `bapm deps why <пакет>`   | Почему пакет оказался в проекте                                             |
| `bapm find <путь>`        | Какой пакет положил этот файл                                               |
| `bapm view <пакет>`       | Информация об установленном пакете                                          |
| `bapm targets`            | Какие агенты зарегистрированы и активны                                     |
| `bapm mcp list` / `show`  | Какие MCP-серверы объявлены и куда попали                                   |
| `bapm config`             | Личные defaults: target, registry URL, temp-dir, канал self-update, grant-ы |

```bash
bapm find .agents/skills/code-review/SKILL.md
bapm config get target                    # прочитать личный default
bapm config set target cursor             # записать target
bapm config list --json                   # все известные ключи + grant-ы
bapm config set temp-dir ~/.cache/bapm-tmp
bapm config unset temp-dir
```

Подробности о ключах, валидации и приоритете — в [reference/config](/reference/config).

## Проверить и починить

| Команда            | Что делает                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------- |
| `bapm doctor`      | Проверяет окружение и проект: git, манифест, lock, `apm_modules`                          |
| `bapm audit --ci`  | Сверяет развёрнутые файлы с хешами в lock; для CI                                         |
| `bapm auth <host>` | Показывает источник токена; `--check` проверяет через API, `--export` — строка для `eval` |
| `bapm prune`       | Удаляет из `apm_modules/` пакеты, которых больше нет в lock                               |
| `bapm cache clean` | Очищает `apm_modules/` целиком                                                            |

## Скрипты проекта

| Команда              | Что делает                                                  |
| -------------------- | ----------------------------------------------------------- |
| `bapm run [SCRIPT]`  | Запускает скрипт из `scripts:` (по умолчанию `start`)       |
| `bapm run -p k=v`    | Подставляет `{{k}}` / `${input:k}` и экспортирует `PARAM_K` |
| `bapm preview`       | Печатает resolved-команду скрипта, ничего не выполняя       |
| `bapm run --dry-run` | То же, что preview, для команды `run`                       |

```bash
bapm run
bapm run test
bapm preview greet -p name=World
```

Скрипты выполняются с правами пользователя через системный shell. Подробности и правила экранирования — в [reference/run](/reference/run).

## Агент и безопасность

| Команда                  | Что делает                                                                                                                              |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `bapm compile`           | Собирает `AGENTS.md` / `CLAUDE.md` / `GEMINI.md`; `--target a,b` / `--all` — несколько хостов, `--distributed` — раскладка по `applyTo` |
| `bapm policy status`     | Показывает, какая политика действует в проекте                                                                                          |
| `bapm approve <пакет>`   | Разрешает пакету ставить MCP-серверы (`--bin` / `--hook` — другие типы; только у вас)                                                   |
| `bapm approve --all`     | Разрешает все pending dependency MCP/bin/hook у вас (`-y` в non-TTY; `--json` — только план)                                            |
| `bapm approve --list`    | Показывает user-local grants из `~/.bapm/config.json` (`--json`)                                                                        |
| `bapm approve --pending` | Показывает dependency MCP/bin/hook без allow/deny в project/user/org (только чтение, `--json`)                                          |
| `bapm deny <пакет>`      | Запрещает и убирает MCP-серверы пакета из конфигов хостов (`--bin` / `--hook` — другие типы; только у вас)                              |

## Публикация

| Команда            | Что делает                                     |
| ------------------ | ---------------------------------------------- |
| `bapm plugin init` | Создаёт заготовку пакета-плагина               |
| `bapm pack`        | Собирает zip-архив и `marketplace.json`        |
| `bapm marketplace` | Подключает чужие маркетплейсы и описывает свой |
| `bapm search`      | Ищет плагины в подключённом маркетплейсе       |
| `bapm publish`     | Публикует пакет в registry (экспериментально)  |

`bapm pack --strict-metadata` проверяет метаданные manifest / `plugin.json` / marketplace packages до записи и падает с exit `5` (при одновременном `--check-versions` приоритет у exit `3`). Подробности — в [reference/pack](/reference/pack).

## Служебные

`bapm help`, `bapm version` (`-V`), `bapm self-update --check`.

Пошаговые инструкции: [Сценарии](/guide/situations/).
