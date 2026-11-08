# Собрать AGENTS.md

## Ситуация

Некоторые агенты читают инструкции не из отдельных файлов, а из одного файла в корне проекта: Codex и OpenCode — из `AGENTS.md`, Claude Code — из `CLAUDE.md`, Gemini CLI — из `GEMINI.md`. Нужно собрать такой файл из установленных пакетов.

## Шаги

### 1. Установите пакеты

```bash
bapm install
```

### 2. Проверьте, что будет собрано

```bash
bapm compile --dry-run
```

```text
compile --dry-run: would write AGENTS.md (1 primitives)
```

`bapm compile --validate` только проверяет найденные файлы и ничего не пишет.

### 3. Соберите

```bash
bapm compile
bapm compile -o docs/AGENTS.md         # в другой путь (один хост)
bapm compile -v                        # показать, из каких файлов собрано
bapm compile --target cursor,claude    # два хоста за один запуск
bapm compile --all                     # все compile-capable хосты
```

Имя файла зависит от агента: [таблица](/guide/supported-hosts#layout). Агент выбирается так же, как для install; если в `active` указано несколько агентов, передайте `--target` или `--all`. В multi-target режиме каждый хост пишет свой файл за один запуск.

::: warning Общий `AGENTS.md`
Cursor, Codex, OpenCode, Kiro, Grok Build, Hermes и Antigravity используют один и тот же `AGENTS.md`. Если два выбранных хоста пишут в один путь, `bapm compile` падает с диагностикой collision, перечисляет хосты и путь и ничего не записывает — молчаливой перезаписи нет. Выберите один хост на путь: например, `--target cursor` и отдельный запуск для `claude` или с `-o`.
:::

## Пример: два хоста за один запуск {#multi}

```bash
bapm compile --target cursor,claude
```

```text
Wrote AGENTS.md (cursor) (2 primitives)
Wrote CLAUDE.md (claude) (2 primitives)
```

`--all` работает так же, но выбирает все зарегистрированные compile-capable хосты. Если среди них есть несколько хостов с `AGENTS.md` (обычный случай), запуск завершится collision-ошибкой: выберите явный список без дублей путей.

## Что попадает в файл {#contents}

Состав зависит от агента: то, что агент уже получил отдельными файлами при install, в собранный файл не дублируется.

| Агент                               | Файл                              | Что собирается                            |
| ----------------------------------- | --------------------------------- | ----------------------------------------- |
| Cursor, Codex, OpenCode, Grok Build | `AGENTS.md`                       | всё: instructions, skills, agents и т. д. |
| Kiro, Antigravity                   | `AGENTS.md`                       | всё, кроме instructions (они уже в rules) |
| Claude Code                         | `CLAUDE.md`                       | всё, кроме instructions                   |
| Copilot                             | `.github/copilot-instructions.md` | всё, кроме instructions                   |
| Gemini CLI                          | `GEMINI.md`                       | только instructions                       |

Число в `would write … (N primitives)` считается до этого фильтра, поэтому может быть больше, чем реально попадёт в файл. Grok Bot и Windsurf `compile` не поддерживают.

## Что нужно знать

- `compile` требует `bapm.yml` в текущем каталоге. Без него он сообщит, что интеграция «not installed», хотя дело в манифесте.
- `-o` меняет каталог, но не всегда имя: для Codex, OpenCode, Grok Build и Hermes файл должен называться `AGENTS.md`, для Gemini — `GEMINI.md`. `-o` допустим только при выборе одного хоста.
- `--target` и `--all` взаимоисключающие.
- Файл генерируется целиком: ручные правки пропадут при следующем `compile`. Пишите инструкции в пакете, а не в сгенерированном файле.
- `compile` проще, чем `apm compile` из microsoft/apm: он собирает один файл на хоста без распределения по каталогам через `applyTo`.

## Если не получилось

| Проблема                                             | Что делать                                                                                                       |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `Target detection is missing or ambiguous`           | Передайте `--target <id>` или задайте `active`                                                                   |
| Несколько агентов в `active`                         | Передайте `--target <id>` (или список через запятую, если пути не совпадают)                                     |
| `Compile target collision`                           | Два выбранных хоста пишут в один путь. Оставьте один хост из пары или используйте отдельные запуски              |
| `multiple compile targets cannot share one --output` | Уберите `-o` или выберите один хост                                                                              |
| Файл пустой                                          | Сначала выполните `bapm install`: compile собирает установленное. Для Gemini в файл попадают только instructions |
| `… is not installed`, хотя интеграция есть           | Запускайте из каталога с `bapm.yml`                                                                              |
