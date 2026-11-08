# bapm marketplace — флаги

По `bapm marketplace --help`.

## Обзор

```text
bapm marketplace <subcommand> [options]
```

Реестр consumer + authoring для манифеста. Host marketplace outputs пишет [`bapm pack`](/reference/pack), не эта команда. В этом релизе не реализованы (по help): `outdated`, `audit` под `marketplace`.

`bapm pack` понимает три host-профиля: `claude` → `.claude-plugin/marketplace.json`, `codex` → `.agents/plugins/marketplace.json`, `copilot` → `.github/plugin/marketplace.json`. Профиль включается через `marketplace.outputs.<format>` (boolean или map с `path`); legacy-ключи `marketplace.claude`/`codex`/`copilot` тоже принимаются. Опция `pack --check-clean` сверяет сгенерированные JSON с файлами на диске и завершается exit `4` при drift или missing.

При resolve remote-пакетов annotated/signed tag пинится на commit (peeled `refs/tags/X^{}`), а не на SHA tag-объекта; lightweight tags сохраняют прямой commit. Поэтому `source.sha` в marketplace JSON — всегда полный 40-символьный commit, а сокращённые SHA отвергаются.

## Consumer

| Подкоманда      | Назначение                                                       |
| --------------- | ---------------------------------------------------------------- |
| `add SOURCE`    | Зарегистрировать marketplace (probe-fetch before persist)        |
| `list`          | Список registered marketplaces                                   |
| `browse NAME`   | Список плагинов в registered marketplace                         |
| `update [NAME]` | Clear cache и refetch (все, если NAME опущен)                    |
| `remove NAME`   | Удалить registered marketplace (`-y` обязателен non-interactive) |
| `validate NAME` | Thin schema + duplicate-name checks (consumer marketplace.json)  |

### add options

| Флаг           | Значение  | Эффект                                                                                     | Default |
| -------------- | --------- | ------------------------------------------------------------------------------------------ | ------- |
| `--name`, `-n` | `<alias>` | Display name (`[a-zA-Z0-9._-]+`)                                                           | —       |
| `--ref`, `-r`  | `<ref>`   | Git ref                                                                                    | `main`  |
| `--host`       | `<fqdn>`  | Host для `OWNER/REPO` shorthand (github.com, `*.ghe.com`, `GITHUB_HOST` GHES, gitlab, ado) | —       |
| `-h`, `--help` | —         | Показать help                                                                              | —       |

## Authoring

| Подкоманда                 | Назначение                                            |
| -------------------------- | ----------------------------------------------------- |
| `init`                     | Scaffold блок `marketplace:` в манифесте              |
| `package add\|set\|remove` | Редактировать package entries в `marketplace:`        |
| `check`                    | Validate authoring schema (+ online github ls-remote) |
| `migrate`                  | Fold legacy `marketplace.yml` в манифест              |

### Authoring options (из help)

| Область   | Флаги                                                                                                                           |
| --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `init`    | `--force`, `--owner <name>`, `--name <project>`                                                                                 |
| `package` | `--name`, `--version`, `--ref`, `--subdir`, `--tag-pattern`, `--tags`, `--include-prerelease`, `--no-verify`, `-y` (для remove) |
| `check`   | `--offline` (schema-only validation)                                                                                            |
| `migrate` | `--dry-run`, `--force` / `-y`                                                                                                   |

См. также: [pack](/reference/pack), [plugin](/reference/plugin), карта [команд](/guide/commands).
