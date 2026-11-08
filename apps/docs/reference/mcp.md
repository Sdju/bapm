# bapm mcp — поиск, просмотр и установка MCP-серверов

Команда работает с двумя источниками:

- **локальный инвентарь** — объявления `dependencies.mcp` в манифесте и записи lock
  (`mcp_servers`, `mcp_configs`, `mcp_target_servers`, `mcp_config_provenance`);
- **MCP registry** — удалённый каталог серверов (по умолчанию
  `https://api.mcp.github.com`).

`list` всегда читает локальный инвентарь. `search` и `show` по умолчанию идут в
registry; флаг `--local` возвращает прежнее offline-поведение. `install`
разрешает сервер в registry и добавляет конкретную запись в манифест.

## Использование

```text
bapm mcp list [--json] [--global]
bapm mcp show <name> [--registry URL] [--version VER] [--json] [--local] [--global]
bapm mcp search <query> [--registry URL] [--limit N] [--json] [--local] [--global]
bapm mcp install <name> [--registry URL] [--version VER] [--dry-run] [--json]
```

| Флаг         | Эффект                                                                                         |
| ------------ | ---------------------------------------------------------------------------------------------- |
| `--json`     | Стабильный JSON вместо таблицы/полей                                                           |
| `--global`   | Читать инвентарь `~/.bapm` (`BAPM_HOME` override); для `show`/`search` подразумевает `--local` |
| `--registry` | Базовый URL MCP registry (перекрывает env и user config)                                       |
| `--local`    | `search`/`show` только по локальному инвентарю                                                 |
| `--version`  | Версия сервера в registry; по умолчанию `latest`                                               |
| `--limit`    | Максимум результатов `search` (по умолчанию 10)                                                |
| `--dry-run`  | `install`: напечатать запись манифеста, ничего не записывая                                    |
| `--help`     | Показать help (`bapm mcp --help`)                                                              |

`bapm mcp` без подкоманды работает как `bapm mcp list`.

## Registry: URL, авторизация, кеш

Приоритет endpoint-а:

1. `--registry URL`;
2. переменная `MCP_REGISTRY_URL`;
3. `bapm config set mcp-registry-url`;
4. встроенный `https://api.mcp.github.com`.

Явный `--registry` и сохранённый config допускают `http://` (осознанный локальный
выбор). Для `MCP_REGISTRY_URL` с `http://` нужен `MCP_REGISTRY_ALLOW_HTTP=1`.
Встроенные credentials, query string и fragment отвергаются; завершающие `/`
нормализуются.

Для приватного registry задайте `MCP_REGISTRY_TOKEN` (алиас
`BAPM_MCP_REGISTRY_TOKEN`). Токен уходит только в `Authorization: Bearer ...` и
никогда не печатается. Анонимные GET-ответы могут кешироваться общим HTTP-кешем
`BAPM_CACHE_DIR`; запросы с авторизацией кеш обходят. Отключение:
`BAPM_HTTP_CACHE=0` или `BAPM_NO_CACHE=1`.

Ошибки сети, 401/403 и невалидный JSON завершают команду с non-zero и
диагностикой без секретов.

## `search`

```text
bapm mcp search github
bapm mcp search github --limit 20 --json
bapm mcp search leaf --local
```

`--json` возвращает стабильную форму:

```json
{
  "registry": "https://api.mcp.github.com",
  "source": "default",
  "query": "github",
  "servers": [
    {
      "name": "io.github.github/github-mcp-server",
      "description": "GitHub MCP Server",
      "version": "0.4.0",
      "transports": ["stdio", "streamable-http"],
      "packages": [
        {
          "registryType": "npm",
          "identifier": "@modelcontextprotocol/server-github",
          "version": "0.4.0",
          "runtimeHint": "npx"
        }
      ]
    }
  ]
}
```

`transports` выводится из packages (`stdio`) и remotes (`http`,
`streamable-http`, `sse`). Пустой результат — `servers: []` и exit 0.

## `show`

```text
bapm mcp show io.github.github/github-mcp-server
bapm mcp show io.github.github/github-mcp-server --json
bapm mcp show github --local
```

Имя кодируется как один path-сегмент (`/` → `%2F`). Запрос идёт в
`/v0/servers/<name>/versions/<version>`. `--json` содержит `name`,
`description`, `version`, `repositoryUrl`, `websiteUrl`, `transports`,
`packages`, `remotes` и метаданные аргументов/переменных. Значения заголовков
remotes в публичном выводе заменяются списком имён.

`--local` печатает локальную запись: объявление, транспорт, `env`/`headers`
(только имена ключей в текстовом виде), target-конфиги, approval/withheld и
исходные `declaration` / `lock entry`.

## `install`

```text
bapm mcp install io.github.github/github-mcp-server --dry-run
bapm mcp install io.github.github/github-mcp-server --registry https://mcp.internal
```

Команда разрешает registry-сервер в конкретный запуск:

- npm/generic package → `command: npx` (или `runtimeHint`) с `-y` для npx/bunx;
- pypi → `uvx` (или `runtimeHint`);
- docker/oci → `docker run -i --rm`;
- remote-only сервер → `transport` + `url`.

Затем `install` добавляет эквивалентную запись в `dependencies.mcp` с
`registry: false` и запускает существующий MCP configure-pass (`bapm install
--only mcp`). Trust- и policy-логика не дублируются. Если имя уже объявлено,
команда завершается ошибкой, чтобы не перезаписать ручную запись.

`--dry-run` печатает только YAML-фрагмент (или `manifest` в `--json`) и ничего не
пишет в проект.

## Локальный инвентарь

| Источник                         | Что даёт                                                                 |
| -------------------------------- | ------------------------------------------------------------------------ |
| `bapm.yml` / `apm.yml`           | Прямые объявления `dependencies.mcp`                                     |
| lock `mcp_servers`               | Записанные при install серверы с `package` и транспортом                 |
| lock `mcp_configs`               | Целевые конфиги: `targetId → { path, servers }`                          |
| lock `mcp_target_servers`        | Какие серверы получил каждый target                                      |
| lock `mcp_config_provenance`     | Путь конфига и владелец (`package`) для сервера                          |
| lock `mcp_omissions` (если есть) | Серверы, пропущенные/withheld; при отсутствии поля состояние не хранится |

Если сервер есть и в манифесте, и в lock, поля берутся из lock (`source:
"lock"`), а исходное объявление доступно в `bapm mcp show --local`. Если lock
отсутствует, `list` покажет прямые объявления из манифеста (`source:
"manifest"`), но без target-конфигов.

### Колонки `list` / `search --local`

| Колонка     | Значение                                                                 |
| ----------- | ------------------------------------------------------------------------ |
| `NAME`      | Имя MCP-сервера                                                          |
| `PACKAGE`   | Пакет-владелец из lock; имя проекта для прямых серверов                  |
| `ORIGIN`    | `direct` (корень проекта) или `dependency`                               |
| `TRANSPORT` | `stdio`, `http`, `streamable-http`, …; при отсутствии выводится из полей |
| `TARGETS`   | id target-хостов, в чьих конфигах есть сервер                            |
| `APPROVAL`  | `direct` / `allow` / `deny` / `withhold` / `skip` / `omitted`            |
| `CONFIG`    | Путь конфига из provenance или первого target                            |

`APPROVAL` для dependency-серверов считается по тем же грантам, что и install:
`executables.allow` / `deny` в манифесте и `~/.bapm/config.json`.

## Global MCP

`bapm mcp list/show --global` читает user-scope проект `~/.bapm` (или
`BAPM_HOME`): `bapm.yml` и `bapm.lock.yaml` в этом каталоге. Это тот же
инвентарь и тот же trust/approval расчёт, что для проекта, но без чтения
project manifest/lock. JSON добавляет `scope: "global"` и `root`, текстовый
вывод печатает `global scope: <path>`.

Установка global MCP выполняется командой:

```text
bapm install --global --only mcp --target cursor
bapm install -g --mcp --target opencode
```

Global root и пути хостов:

| Host     | Config                             |
| -------- | ---------------------------------- |
| Cursor   | `~/.cursor/mcp.json`               |
| OpenCode | `~/.config/opencode/opencode.json` |

Только MCP: global skills/rules/agents/commands/hooks и `compile` пока не
поддерживаются, поэтому `bapm install -g` без `--only mcp`/`--mcp` завершается
ошибкой. Неподдерживаемый хост возвращает `Global MCP is not supported for
target(s)`.

## `install` из манифеста

Запись без `command` и `url` с `registry: true` или `registry: <URL>` разрешается
через registry при `bapm install`, если CLI передал lookup-порт. Если сервер не
найден/недоступен или не содержит installable package/remote, install
по-прежнему fail-closed с `MCP_REGISTRY_UNSUPPORTED` и подсказкой
`bapm mcp show` / `bapm mcp install --dry-run`. Явное описание
(`registry: false`, `command`/`url`) не требует сети.

## См. также

- [install](/reference/install)
- [targets](/reference/targets)
- [config](/reference/config)
- [policy / approve / deny](/reference/policy)
- [Lock-файл](/guide/lockfile)
