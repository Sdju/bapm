# Команды

Карта CLI. Детали флагов — на страницах [Справки](/reference/) и в `bapm help <command>`.

Установка и первый запуск: [Быстрый старт](/guide/quick-start). Experimental registry resolve/install и `publish` включаются через `BAPM_EXPERIMENTAL_REGISTRIES=1`.

## Проект

| Команда | Назначение | Справка |
| --- | --- | --- |
| `init` | Создать `bapm.yml` (откажется, если уже есть `apm.yml` / `bapm.yml`) | [флаги](/reference/init) |
| `install` | Разрешить зависимости, записать lock, материализовать модули и (при активном target) задеплоить в хост | [флаги](/reference/install) |
| `lock` | Только resolve + lockfile, без host deploy; также `lock export` (SBOM) | [флаги](/reference/lock) |
| `update` | Переразрешить пины (`--dry-run` / `-y`) | [флаги](/reference/update) |
| `outdated` | Сравнить пины lock с remote tips | [флаги](/reference/outdated) |
| `uninstall` | Убрать пакеты из манифеста, modules, deploy, lock | [флаги](/reference/uninstall) |
| `prune` | Удалить orphan-модули вне графа | [флаги](/reference/prune) |

## Инспекция

| Команда | Назначение | Справка |
| --- | --- | --- |
| `deps` | Инспекция lock: `list` \| `tree` \| `why` \| `clean` | [флаги](/reference/deps) |
| `find` | Найти, какой locked-пакет владеет deployed-путём | [флаги](/reference/find) |
| `view` | Offline inspect установленного пакета (lock + modules) | [флаги](/reference/view) |
| `audit` | Integrity checks (`--ci`) | [флаги](/reference/audit) |
| `doctor` | Sanity checks окружения и проекта | [флаги](/reference/doctor) |

## Вывод для хоста

| Команда | Назначение | Справка |
| --- | --- | --- |
| `compile` | Собрать target-owned вывод из обнаруженных примитивов (по умолчанию cursor → `AGENTS.md`) | [флаги](/reference/compile) |

Runtime-материализация сегодня **только Cursor**. Селектор `--target <id>` остаётся user-facing.

## Политика

| Команда | Назначение | Справка |
| --- | --- | --- |
| `policy` | Статус policy (read-only): `policy status` | [флаги](/reference/policy) |
| `approve` | User-local MCP allow в `~/.bapm/config.json` (не в project yml) | [policy](/reference/policy#approve--deny) |
| `deny` | User-local MCP deny в `~/.bapm/config.json` | [policy](/reference/policy#approve--deny) |

## Мета

| Команда | Назначение | Справка |
| --- | --- | --- |
| `help` | Справка (`bapm help`, `bapm help install`, …) | — |
| `version` | Версия CLI (`-V` / `--version`) | — |
| `self-update` | Проверка/обновление CLI относительно npm metadata (`--check`) | [флаги](/reference/self-update) |
| `cache` | Info / clean каталога `apm_modules` | [флаги](/reference/cache) |
| `pack` | Plain-zip archive и/или marketplace.json (`--archive` / `--check-release`) | [флаги](/reference/pack) |
| `plugin` | Scaffold тонкого plugin-проекта (`plugin init`) | [флаги](/reference/plugin) |
| `marketplace` | Consumer registry + authoring (`init` / `package` / `check`, …) | [флаги](/reference/marketplace) |
| `search` | Поиск плагинов в registered marketplace | [флаги](/reference/search) |
| `publish` | Experimental PUT в registry (`BAPM_EXPERIMENTAL_REGISTRIES=1`) | [флаги](/reference/publish) |

Полный список: [/reference/](/reference/). Типовые сценарии: [Сценарии](/guide/situations/).
