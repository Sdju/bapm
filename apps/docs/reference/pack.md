# bapm pack — флаги

По `bapm help pack`.

## Использование

```text
bapm pack [options]
```

Собирает plain-zip producer archive и/или host `marketplace.json`. Неизвестные флаги отвергаются. `--check-release` не создаёт и не пушит tags. Secret-pattern paths (`.env`, `*.pem`, …) отклоняются.

Claude/Codex здесь — **marketplace-output**, не runtime install targets. Runtime-материализация остаётся cursor-oriented через install/`--target`.

## Параметры

| Флаг                   | Значение                | Эффект                                                                                         | Default        |
| ---------------------- | ----------------------- | ---------------------------------------------------------------------------------------------- | -------------- |
| `--archive`            | —                       | Записать plain zip artifact                                                                    | off            |
| `--agent-plugins`      | —                       | Pack validated Agent Plugins v1 portable root; не эмитит marketplace; нужен root `plugin.json` | off            |
| `--dry-run`            | —                       | Validate / collect без durable zip или marketplace.json                                        | off            |
| `--check-release`      | —                       | Gate tag↔manifest version (pr-004)                                                             | off            |
| `--tag`                | `<name>`                | Tag под check (опционально с `--check-release`; иначе HEAD)                                    | HEAD           |
| `--marketplace`, `-m`  | `all` \| `none` \| list | Фильтр host marketplace emit (`claude`, `codex`)                                               | all configured |
| `--marketplace-path`   | `FORMAT=PATH`           | Override output path (повторяемый; путь под project root)                                      | —              |
| `--offline`            | —                       | Fail closed, если remote package resolve нужен network                                         | off            |
| `--include-prerelease` | —                       | Включать prerelease tags при resolve version ranges                                            | off            |
| `--help`, `-h`         | —                       | Показать help                                                                                  | —              |

## Замечания

- При `marketplace:` в манифесте и выбранных outputs pack эмитит Claude/Codex `marketplace.json`.
- Marketplace-only проекты (без `dependencies:`) эмитят JSON и пропускают пустой zip.
- Gate-only: `--check-release` без `--archive` и без marketplace emit intent.

См. также: [marketplace](/reference/marketplace), [plugin](/reference/plugin), [US-06 Marketplace pack](/guide/situations/marketplace-pack).
