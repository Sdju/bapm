# bapm plugin — флаги

По `bapm help plugin`.

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
| `--target`        | `<id>`   | Записать host target (например `cursor`)                                    | —       |
| `--agent-plugins` | —        | Agent Plugins v1 portable root (без `bapm.yml`); canonical `plugin.json`    | off     |
| `--skills`        | —        | Минимальный portable `skills/example/SKILL.md` layout (с `--agent-plugins`) | off     |
| `-v`, `--verbose` | —        | Extra logging                                                               | off     |
| `--help`, `-h`    | —        | Показать help                                                               | —       |

### Замечания

- По умолчанию пишет `plugin.json` и `bapm.yml` только (без SKILL.md / agents / skills), пока не включён portable layout.
- Без `--yes` отказывается, если `bapm.yml` или `plugin.json` уже есть.
- `PROJECT_NAME` создаёт subdirectory (kebab-case; без path separators).
- Неизвестные флаги отвергаются.

См. также: [pack](/reference/pack), [marketplace](/reference/marketplace).
