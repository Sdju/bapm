# Команды

Карта CLI. Флаги — в [Справке](/reference/) и `bapm <command> --help`. Установка: [Быстрый старт](/guide/quick-start).

## Каждый день

```bash
bapm init -y --target cursor
bapm install --target cursor
bapm update -y
bapm outdated
```

| Команда     | Назначение                                        | Справка                           |
| ----------- | ------------------------------------------------- | --------------------------------- |
| `init`      | Создать `bapm.yml`                                | [init](/reference/init)           |
| `install`   | Resolve + lock + modules + deploy (при target)    | [install](/reference/install)     |
| `lock`      | Только resolve + lockfile, без host deploy        | [lock](/reference/lock)           |
| `update`    | Переразрешить пины (`--dry-run` / `-y`)           | [update](/reference/update)       |
| `outdated`  | Сравнить пины lock с remote tips                  | [outdated](/reference/outdated)   |
| `uninstall` | Убрать пакеты из манифеста, modules, deploy, lock | [uninstall](/reference/uninstall) |
| `prune`     | Удалить orphan-модули вне графа                   | [prune](/reference/prune)         |

Deploy в Cursor — после установки `@b-apm/integration-cursor` и выбора host через detect, `active` или `--target cursor`. `targets:` нужен только для override/custom host — [поддерживаемые hosts](/guide/supported-hosts).

## Инспекция и проверка

| Команда  | Назначение                              | Справка                     |
| -------- | --------------------------------------- | --------------------------- |
| `deps`   | `list` \| `tree` \| `why` \| `clean`    | [deps](/reference/deps)     |
| `find`   | Какой пакет владеет deployed-путём      | [find](/reference/find)     |
| `view`   | Offline inspect пакета (lock + modules) | [view](/reference/view)     |
| `audit`  | Integrity checks (`--ci`)               | [audit](/reference/audit)   |
| `doctor` | Sanity checks окружения и проекта       | [doctor](/reference/doctor) |

## Вывод и политика

| Команда            | Назначение                                        | Справка                                   |
| ------------------ | ------------------------------------------------- | ----------------------------------------- |
| `compile`          | Собрать вывод (по умолчанию cursor → `AGENTS.md`) | [compile](/reference/compile)             |
| `policy`           | Статус policy (read-only)                         | [policy](/reference/policy)               |
| `approve` / `deny` | User-local MCP allow/deny в `~/.bapm/config.json` | [policy](/reference/policy#approve--deny) |

## Реже: pack, marketplace, meta

| Команда            | Назначение                                          | Справка                               |
| ------------------ | --------------------------------------------------- | ------------------------------------- |
| `help` / `version` | Справка и версия (`-V`)                             | —                                     |
| `cache`            | Info / clean `apm_modules`                          | [cache](/reference/cache)             |
| `self-update`      | Обновление CLI относительно npm (`--check`)         | [self-update](/reference/self-update) |
| `pack`             | Zip / marketplace.json                              | [pack](/reference/pack)               |
| `plugin`           | Scaffold plugin-проекта (`plugin init`)             | [plugin](/reference/plugin)           |
| `marketplace`      | Registry + authoring                                | [marketplace](/reference/marketplace) |
| `search`           | Поиск плагинов                                      | [search](/reference/search)           |
| `publish`          | Experimental PUT (`BAPM_EXPERIMENTAL_REGISTRIES=1`) | [publish](/reference/publish)         |

Experimental registry resolve/install и `publish` — только с `BAPM_EXPERIMENTAL_REGISTRIES=1`.

Сценарии: [Сценарии](/guide/situations/).
