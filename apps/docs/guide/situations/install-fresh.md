# Подключить bapm к существующему проекту

## Ситуация

В проекте уже есть `.cursor/` с правилами и skills, которые копировались вручную из других репозиториев. Хочется перевести общие части на пакеты, чтобы обновлять их командой, а не копированием.

## Шаги

### 1. Установите bapm

```bash
npm i -D @b-apm/cli @b-apm/integration-cursor
npx bapm init -y --target cursor
```

### 2. Перенесите общие части в зависимости

Всё, что пришло из другого репозитория, подключите как пакет, а скопированные файлы удалите:

```yaml
dependencies:
  apm:
    - acme/agent-skills#v1.2.0
    - git: https://github.com/acme/monorepo
      path: agent/rules
```

То, что написано специально для этого проекта, можно оставить как есть: bapm не трогает файлы, которые он не ставил, если их имена не совпадают с устанавливаемыми.

::: warning Совпадающие имена перезаписываются
Если в `.agents/skills/` или `.cursor/` уже лежит файл с тем же путём, что и в пакете (например, `.agents/skills/code-review/SKILL.md`), `install` перезапишет его без предупреждения, и `--dry-run` этого не покажет. Перед первым install закоммитьте текущее состояние, чтобы увидеть перезаписанные файлы в `git diff`.
:::

### 3. Установите

```bash
npx bapm install --dry-run   # что будет установлено
npx bapm install
```

### 4. Проверьте

```bash
npx bapm deps list                          # что установлено
npx bapm find .agents/skills/<имя>/SKILL.md # из какого пакета файл
```

Откройте Cursor: skills из пакетов появятся среди доступных.

### 5. Закоммитьте

`bapm.yml`, `bapm.lock.yaml`, `package.json` и `.gitignore` с `apm_modules/` и `bapm.local.yml`.

## Если не получилось

| Сообщение                                      | Что делать                                                                                     |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `… @b-apm/integration-cursor is not installed` | `npm i -D @b-apm/integration-cursor`                                                           |
| `Target detection is missing or ambiguous`     | Кроме `.cursor/`, в проекте есть маркер другого агента. Задайте `active` или `--target cursor` |
| `Failed to download …`                         | Проверьте доступ к репозиторию: `git ls-remote <url>`. Для приватных задайте `GITHUB_TOKEN`    |

Дальше: [Команда с разными агентами](/guide/situations/team-local-active) · [CI по lock-файлу](/guide/situations/ci-frozen).
