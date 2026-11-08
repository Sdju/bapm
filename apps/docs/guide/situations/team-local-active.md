# Команда с разными агентами

## Ситуация

Команда хранит общие skills и MCP в репозитории. Часть разработчиков работает в Cursor, часть в Claude Code. Если записать агента в `bapm.yml`, одним придётся постоянно менять его под себя, а в PR будут конфликты.

## Решение

Общий `bapm.yml` описывает только зависимости. Агента каждый выбирает в личном `bapm.local.yml`, который не коммитится.

### 1. Общий манифест

```yaml
# bapm.yml — в git
name: team-agent-config
version: 1.0.0
dependencies:
  apm:
    - acme/team-skills
  mcp:
    - name: docs
      registry: false
      transport: http
      url: https://mcp.example.com/
```

Поля `active` здесь нет. Если оно есть, личный файл всё равно его перекроет.

Полей `target` и `targets` здесь тоже быть не должно: они ограничивают, для каких агентов раскладываются файлы. `bapm init --target cursor` пишет только `active` и этот блок не создаёт. Если `target` / `targets` добавили вручную, уберите их, иначе у коллеги в Claude Code install напишет `installed for claude`, но ничего не разложит.

### 2. `.gitignore`

```text
bapm.local.yml
bapm.local.lock.yaml
apm_modules/
```

### 3. Каждый выбирает агента

Разработчик в Cursor:

```bash
npm i -D @b-apm/integration-cursor
```

```yaml
# bapm.local.yml
active:
  target: cursor
```

Разработчик в Claude Code:

```bash
npm i -D @b-apm/integration-claude
```

```yaml
# bapm.local.yml
active:
  target: claude
```

Интеграции можно добавить в `devDependencies` проекта для всех сразу: пока агент выбран через `active`, лишние интеграции не мешают.

### 4. Установка

```bash
bapm install
```

## Результат

- Все получают одни и те же пакеты тех же версий: lock общий.
- Файлы раскладываются по-разному: у первого в `.agents/skills/` и `.cursor/`, у второго в `.claude/` и `.mcp.json`.
- `bapm.yml` и `bapm.lock.yaml` не меняются от смены агента, конфликтов в PR нет.

## Если в проекте несколько маркеров

Автоопределение проверяет маркеры только у установленных интеграций. Если закоммичены и `.cursor/`, и `.claude/`, а у вас установлена одна интеграция, будет выбран её агент. Если установлены обе, без `bapm.local.yml` install завершится ошибкой `Target detection is missing or ambiguous`: создайте `bapm.local.yml` или передайте `--target`.

Если кто-то хочет получать файлы сразу для двух агентов, в `bapm.local.yml` можно указать список: `active: { target: [cursor, claude] }`. MCP-серверы получат оба агента, если их интеграции поддерживают MCP.

## Если не получилось

| Сообщение                                                | Что делать                                                   |
| -------------------------------------------------------- | ------------------------------------------------------------ |
| `Target detection is missing or ambiguous`               | Создайте `bapm.local.yml` с `active` или добавьте `--target` |
| `Manifest "active" rejects legacy bare host-token lists` | Пишите `active: { target: cursor }`, а не `active: [cursor]` |
| `… is not installed or resolvable`                       | Поставьте интеграцию своего агента                           |
| `installed for claude`, но файлов нет                    | В `bapm.yml` остался блок `targets` / `target`. Удалите его  |

Связанное: [Личные настройки](/guide/manifest-overlay) · [Пресеты](/guide/config-manifest#пресеты) — если, кроме агента, различаются наборы пакетов.
