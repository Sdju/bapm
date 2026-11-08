# bapm mcp — интроспекция MCP-серверов

Read-only команда: показывает MCP-серверы, которые объявлены в манифесте и/или записаны в lock-инвентаре. Ничего не пишет — ни конфиги агентов, ни lock, ни user config. Сеть не используется.

## Использование

```text
bapm mcp list [--json]
bapm mcp show <name> [--json]
bapm mcp search <query> [--json]
```

| Флаг     | Эффект                               |
| -------- | ------------------------------------ |
| `--json` | Стабильный JSON вместо таблицы/полей |
| `--help` | Показать help (`bapm mcp --help`)    |

`bapm mcp` без подкоманды работает как `bapm mcp list`.

## Откуда берутся данные

| Источник                         | Что даёт                                                                 |
| -------------------------------- | ------------------------------------------------------------------------ |
| `bapm.yml` / `apm.yml`           | Прямые объявления `dependencies.mcp`                                     |
| lock `mcp_servers`               | Записанные при install серверы с `package` и транспортом                 |
| lock `mcp_configs`               | Целевые конфиги: `targetId → { path, servers }`                          |
| lock `mcp_target_servers`        | Какие серверы получил каждый target                                      |
| lock `mcp_config_provenance`     | Путь конфига и владелец (`package`) для сервера                          |
| lock `mcp_omissions` (если есть) | Серверы, пропущенные/withheld; при отсутствии поля состояние не хранится |

Если сервер есть и в манифесте, и в lock, поля берутся из lock (`source: "lock"`), а исходное объявление доступно в `bapm mcp show`. Если lock отсутствует, `list` покажет прямые объявления из манифеста (`source: "manifest"`), но без target-конфигов.

## Колонки `list` / `search`

| Колонка     | Значение                                                                 |
| ----------- | ------------------------------------------------------------------------ |
| `NAME`      | Имя MCP-сервера                                                          |
| `PACKAGE`   | Пакет-владелец из lock; имя проекта для прямых серверов                  |
| `ORIGIN`    | `direct` (корень проекта) или `dependency`                               |
| `TRANSPORT` | `stdio`, `http`, `streamable-http`, …; при отсутствии выводится из полей |
| `TARGETS`   | id target-хостов, в чьих конфигах есть сервер                            |
| `APPROVAL`  | `direct` / `allow` / `deny` / `withhold` / `skip` / `omitted`            |
| `CONFIG`    | Путь конфига из provenance или первого target                            |

`APPROVAL` для dependency-серверов считается по тем же грантам, что и install: `executables.allow` / `deny` в манифесте и `~/.bapm/config.json`. `mcp_omissions` в lock пока не пишется bapm, но команда читает поле, если оно появится (в том числе от другой реализации).

## `show`

```text
bapm mcp show github
bapm mcp show github --json
```

Печатает объявление, транспорт, `env`/`headers` (только имена ключей в текстовом виде), target-конфиги, путь конфига, состояние approval/withheld и исходные объекты `declaration` / `lock entry`. Неизвестное имя завершает команду с non-zero и подсказывает доступные имена.

## JSON

`list --json`:

```json
{
  "lockfile": "/abs/path/bapm.lock.yaml",
  "manifest": "/abs/path/bapm.yml",
  "servers": [
    {
      "name": "github",
      "package": "acme/agent-pack",
      "origin": "dependency",
      "transport": "http",
      "command": null,
      "args": null,
      "url": "https://api.githubcopilot.com/mcp/",
      "env": null,
      "headers": { "Authorization": "Bearer ${env:MCP_TOKEN}" },
      "targets": [{ "targetId": "cursor", "path": ".cursor/mcp.json" }],
      "configPath": ".cursor/mcp.json",
      "source": "lock",
      "approval": "allow",
      "withheld": false,
      "omitted": false
    }
  ]
}
```

`show --json` возвращает один объект того же вида плюс `declaration`, `lockEntry`, `lockPath` и `manifestPath`. `search --json` возвращает `{ query, lockfile, manifest, servers }` с теми же summary-полями.

`lockfile` / `manifest` равны `null`, если соответствующего файла нет.

## Что не входит

- `mcp install` — установка и раскладка MCP выполняются командой [`bapm install`](/reference/install); `bapm mcp install` завершится ошибкой с подсказкой.
- Поиск в registry / remote MCP registry — не реализован. `bapm mcp search` ищет только по локальному инвентарю (имя, пакет, транспорт, команда, URL, target id).
- Ownership hash и отдельный `mcp_omissions` writer — будущие расширения.

## См. также

- [install](/reference/install)
- [targets](/reference/targets)
- [policy / approve / deny](/reference/policy)
- [Lock-файл](/guide/lockfile)
