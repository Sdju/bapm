# bapm config — пользовательские настройки

Обёртка над `~/.bapm/config.json`: валидируемые личные defaults и просмотр ключей. Тот же файл хранит grant-ы `bapm approve` / `bapm deny`; `config` не удаляет их.

## Использование

```text
bapm config
bapm config list [--json]
bapm config get <key>
bapm config set <key> <value>
bapm config unset <key>
```

| Команда                  | Эффект                                                                   |
| ------------------------ | ------------------------------------------------------------------------ |
| `config` / `config list` | Показать известные ключи, число allow/deny grant-ов и путь к файлу       |
| `config list --json`     | JSON с известными ключами (`null`, если не задан) и остальным документом |
| `config get <key>`       | Напечатать сохранённое значение; exit 1, если не задано                  |
| `config set <key> <v>`   | Проверить значение и записать ключ                                       |
| `config unset <key>`     | Удалить ключ; остальные ключи и grant-ы остаются                         |

`--help`, `-h` показывают справку. Неизвестные флаги и ключи отвергаются с exit 1; в ошибке перечислены допустимые ключи.

## Ключи

| Ключ                  | Тип                   | По умолчанию | Что делает                                                        |
| --------------------- | --------------------- | ------------ | ----------------------------------------------------------------- |
| `target`              | target id             | не задан     | Личный агент по умолчанию перед автоопределением                  |
| `mcp-registry-url`    | `http(s)://host`      | не задан     | Базовый URL приватного MCP registry для `mcp search/show/install` |
| `temp-dir`            | путь                  | не задан     | Хранит абсолютный temp-каталог (пока только хранение)             |
| `self-update.channel` | `stable`/`prerelease` | `stable`     | Хранит канал self-update (пока только хранение)                   |

### `target`

`target` — последний явный источник перед автоопределением. Полный порядок выбора:

1. `--target <id>` в `install` / `compile`;
2. `active` в `bapm.local.yml`;
3. `active` в `bapm.yml`;
4. `target` из `~/.bapm/config.json`;
5. единственное автоопределение по маркеру;
6. ошибка, если ничего не сработало.

Значение из конфига не переопределяет проектный `active`: удобно держать личный default, а в командном проекте закрепить агента в манифесте. `bapm targets` показывает источник (`SOURCE=config`).

```bash
bapm config set target cursor   # личный default
bapm targets --json             # STATUS=active, SOURCE=config (если active нет)
bapm config unset target
```

Допустимый id: строчные буквы, цифры, `.`, `_`, `-`; например `cursor`, `claude`, `grok-build`, `hermes`, `intellij`, `x-acme-editor`.

### `mcp-registry-url`

Принимает только `http://` или `https://` URL с хостом. Отвергаются:

- другие схемы (`ws://`, `wss://`, `file://`, URL без схемы);
- встроенные credentials (`https://user:pass@host`);
- query string и fragment;
- пустой хост, некорректный порт, управляющие символы и URL длиннее 2048 символов.

Завершающие `/` нормализуются. Значение используется командами `bapm mcp search/show/install` и registry-lookup при `bapm install`; приоритет: `--registry` → `MCP_REGISTRY_URL` → `mcp-registry-url` → встроенный `https://api.mcp.github.com`. Для приватного registry задайте `MCP_REGISTRY_TOKEN` (не хранится в config).

```bash
bapm config set mcp-registry-url https://mcp.internal.example.com
bapm config get mcp-registry-url
bapm config unset mcp-registry-url
```

### `temp-dir`

Путь раскрывается (`~`) и сохраняется абсолютным. Каталог должен существовать, быть каталогом и быть доступным на запись. Пока значение только хранится: операции clone/download в bapm используют системный temp напрямую.

```bash
mkdir -p ~/.cache/bapm-tmp
bapm config set temp-dir ~/.cache/bapm-tmp
bapm config unset temp-dir
```

### `self-update.channel`

Допустимые значения: `stable` и `prerelease` (регистр не важен). Пока значение только хранится: `bapm self-update --check` продолжает смотреть npm dist-tag `latest`, переменные `BAPM_SELF_UPDATE_DIST_TAG` / `BAPM_SELF_UPDATE_METADATA_URL` остаются действующим способом настройки.

```bash
bapm config set self-update.channel prerelease
bapm config get self-update.channel
bapm config unset self-update.channel   # эффективно снова stable
```

## Хранение и grant-ы

`config set` / `unset` делают read-merge-write: читают текущий JSON, меняют только выбранный ключ, пишут через временный файл и `rename` (атомарно). `executables.allow` / `executables.deny`, созданные `bapm approve` / `bapm deny`, и любые неизвестные пользовательские ключи сохраняются без изменений. Права на файл — `0600`, каталог — `0700` (best-effort на платформах без POSIX mode).

Dotted-ключи хранятся вложенно: `self-update.channel` → `"self-update": { "channel": "prerelease" }`. При `unset` пустая родительская ветка удаляется, но соседние неизвестные ключи остаются.

```json
{
  "target": "cursor",
  "mcp-registry-url": "https://mcp.internal.example.com",
  "temp-dir": "/home/me/.cache/bapm-tmp",
  "self-update": { "channel": "prerelease" },
  "executables": {
    "allow": { "mcp-dep": { "mcp": true } },
    "deny": {}
  }
}
```

`config list --json` выводит известные ключи плоскими полями (dotted-ключ остаётся dotted, независимо от вложенности в файле). Незаданные получают `null`, поэтому форма стабильна для скриптов; `executables` и неизвестные ключи верхнего уровня выводятся как есть. Секретов в этом файле нет: только id target, URL, пути, канал и grant-ы пакетов.

## См. также

- [targets](/reference/targets)
- [Выбор агента](/guide/host-selection)
- [MCP и политика](/guide/situations/policy-mcp)
- [self-update](/reference/self-update)
