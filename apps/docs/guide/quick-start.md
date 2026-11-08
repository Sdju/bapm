# Быстрый старт

За несколько минут вы поставите bapm, подключите skill и увидите его в Cursor. Для другого агента шаги те же, отличаются пакет интеграции и каталоги; см. [раздел в конце](#other-agent).

Нужен Node.js 22.12 или новее.

::: warning Ранний релиз
Формат файлов и поведение команд ещё могут меняться без смены major-версии.
:::

## 1. Установите CLI и интеграцию

Ставьте в проект: так версия bapm закреплена в `package.json` и одинакова у коллег и в CI.

```bash
npm i -D @b-apm/cli @b-apm/integration-cursor
```

Команды ниже запускаются через `npx bapm`. Если предпочитаете глобальную установку (`npm i -g @b-apm/cli @b-apm/integration-cursor`), пишите просто `bapm`. Интеграцию bapm ищет сначала в `node_modules` проекта, затем среди глобальных пакетов.

## 2. Создайте манифест {#init}

```bash
npx bapm init -y --target cursor
```

Получится `bapm.yml`:

```yaml
name: my-project
version: 0.1.0
dependencies:
  apm: []
  mcp: []
active:
  - target: cursor
```

`active` закрепляет Cursor как агента проекта. Блок `targets` команда не пишет: для известных агентов bapm сам находит стандартный пакет `@b-apm/integration-<id>`, а `targets` ограничил бы раскладку одним агентом — коллега, выбравший Claude Code, получил бы сообщение `installed for claude`, но ни одного файла.

## 3. Добавьте пакет

Для начала подойдёт локальный skill. Пакету нужен свой манифест с именем и версией, `skills-pkg/bapm.yml`:

```yaml
name: hello-skills
version: 0.1.0
```

и сам skill, `skills-pkg/skills/hello/SKILL.md`:

```markdown
---
name: hello
description: Здоровается с пользователем
---

Когда пользователь здоровается, ответь приветствием и кратко перечисли, чем можешь помочь.
```

и подключите каталог в `bapm.yml`:

```yaml
dependencies:
  apm:
    - path: ./skills-pkg
  mcp: []
```

Пакет из GitHub подключается так же. Если нужен подкаталог репозитория, используйте форму с `git` и `path`:

```yaml
dependencies:
  apm:
    - acme/agent-skills # весь репозиторий github.com/acme/agent-skills
    - git: https://github.com/acme/monorepo
      path: skills/review # только подкаталог
```

## 4. Установите

```bash
npx bapm install
```

```text
bapm: installed for cursor
```

Проверьте, что появилось:

| Путь                            | Что это                       |
| ------------------------------- | ----------------------------- |
| `.agents/skills/hello/SKILL.md` | Skill, который читает Cursor  |
| `apm_modules/`                  | Скачанные пакеты              |
| `bapm.lock.yaml`                | Зафиксированные версии и хеши |

Rules, агенты и MCP из пакетов, если они есть, окажутся в `.cursor/rules/`, `.cursor/agents/` и `.cursor/mcp.json`.

Если в каталоге skill есть дополнительные файлы (`reference.md`, скрипты, вложенные ассеты), bapm скопирует их рядом с `SKILL.md` в `.agents/skills/hello/`.

`npx bapm doctor` проверит окружение и проект, `npx bapm install --dry-run` покажет, что будет установлено, ничего не меняя.

## 5. Закоммитьте

```text
.gitignore
  apm_modules/
  bapm.local.yml
  bapm.local.lock.yaml
```

В git кладите `bapm.yml` и `bapm.lock.yaml`. Коллеге после `git pull` достаточно `npm install` и `npx bapm install`.

Нужно ли коммитить развёрнутые файлы (`.agents/skills/`, `.cursor/…`), решает команда: их всегда можно восстановить через `bapm install`. Исключение — `.cursor/mcp.json`: если в MCP подставляются секреты из переменных окружения, они будут записаны в него открытым текстом. Подробнее: [MCP и секреты](/guide/manifest-dependencies#mcp-и-переменные-окружения).

## Если не получилось

| Сообщение                                                    | Что делать                                                                                                                         |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `No manifest found`                                          | Запускайте команду в каталоге, где лежит `bapm.yml`                                                                                |
| `Failed to load local package manifest`                      | В каталоге локального пакета нет `bapm.yml` / `apm.yml` с `name` и `version`                                                       |
| `… @b-apm/integration-cursor is not installed or resolvable` | Установите интеграцию: `npm i -D @b-apm/integration-cursor`                                                                        |
| `Target detection is missing or ambiguous`                   | Нет `active` и маркера агента, или маркеров несколько (например, `.cursor/` и `.claude/`). Добавьте `--target cursor` или `active` |
| `Manifest "active" rejects legacy bare host-token lists`     | Пишите `active: { target: cursor }` или `active: [{ target: cursor }]`, а не `active: [cursor]`                                    |
| `installed for <id>`, но файлов нет                          | В `bapm.yml` остался блок `targets` (или `target`) без этого агента. Удалите блок                                                  |

## Другой агент {#other-agent}

Замените `cursor` на id агента и поставьте его интеграцию, например для Claude Code:

```bash
npm i -D @b-apm/cli @b-apm/integration-claude
npx bapm init -y --target claude
npx bapm install
```

Id, пакеты и каталоги всех агентов: [Поддерживаемые агенты](/guide/supported-hosts).

## Дальше

- [Команда с разными агентами](/guide/situations/team-local-active) — если коллеги работают не в Cursor.
- [CI по lock-файлу](/guide/situations/ci-frozen).
- [Зависимости](/guide/manifest-dependencies) — все формы записи пакетов и MCP.
