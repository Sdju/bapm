# bapm plugin — флаги

По `bapm plugin --help`.

## Обзор

```text
bapm plugin <subcommand>
```

Сейчас доступна подкоманда `init` (scaffold тонкого plugin-проекта). Без subcommand или с `--help` — обзорный help. Только offline — без сети.

## plugin init

```text
bapm plugin init [options] [PROJECT_NAME]
```

| Флаг              | Значение | Эффект                                                                      | Default |
| ----------------- | -------- | --------------------------------------------------------------------------- | ------- |
| `-y`, `--yes`     | —        | Non-interactive defaults (version `0.1.0`); разрешить overwrite             | off     |
| `--target`        | `<id>`   | Записать в `bapm.yml` поле `target: <id>`. Несовместим с `--agent-plugins`  | —       |
| `--agent-plugins` | —        | Agent Plugins v1 portable root (без `bapm.yml`); canonical `plugin.json`    | off     |
| `--skills`        | —        | Минимальный portable `skills/example/SKILL.md` layout (с `--agent-plugins`) | off     |
| `-v`, `--verbose` | —        | Extra logging                                                               | off     |
| `--help`, `-h`    | —        | Показать help                                                               | —       |

### Замечания

- По умолчанию пишет `plugin.json` и `bapm.yml` только (без SKILL.md / agents / skills), пока не включён portable layout.
- Без `--yes` отказывается, если `bapm.yml` или `plugin.json` уже есть.
- `PROJECT_NAME` создаёт subdirectory (kebab-case; без path separators).
- Неизвестные флаги отвергаются.
- Поле `target:` из `--target` [ограничивает раскладку](/guide/manifest-hosts#targets-и-target) одним агентом. Если плагином будут пользоваться в разных агентах, не передавайте `--target` или удалите поле.

См. также: [pack](/reference/pack), [marketplace](/reference/marketplace).
