# Быстрый старт

Цель: поставить CLI в свой проект, завести манифест и выполнить первый `install` в Cursor.

## 1. Установка CLI

В корне **вашего** проекта (не репозитория bapm):

```bash
pnpm add -D bapm
# или:
npm i -D bapm
```

Дальше вызывайте бинарь:

```bash
pnpm exec bapm --help
# или:
npx bapm --help
```

Ниже в примерах команда записана как `bapm …` — после установки зависимости так и есть (через `pnpm exec` / `npx` / скрипт в `package.json`).

### Оговорка про npm

Публичный пакет с именем `bapm` на npm сегодня занят **другим** продуктом; публикация этого CLI ещё не стабилизирована. Следите за релизами проекта. Команды установки выше — целевой UX продукта. Сборка из исходников monorepo — только для контрибьюторов: [Architecture](/architecture/).

Нужен Node.js ≥ 22.12.

## 2. Манифест проекта

В корне проекта нужен ровно один манифест:

- `bapm.yml` — канонический полный конфиг (то, что пишет `bapm init`);
- или `apm.yml` — backcompat-подмножество OpenAPM/APM (dual-read того же parser).

Оба файла сразу — ошибка (`MANIFEST_DUAL_CONFLICT`); bapm не мержит их. Полная карта полей: [манифест](/guide/config-manifest).

### Создать через init

```bash
bapm init -y --target cursor
```

Появится `bapm.yml` с `name`, `version`, пустыми `dependencies.apm` / `dependencies.mcp` и полем `target: cursor`. Команда откажется, если уже есть `apm.yml` или `bapm.yml`.

### Или минимальный пример вручную

```yaml
name: my-agent-project
version: 0.0.1
target: cursor
dependencies:
  apm:
    - path: ./packages/hello-skill
  mcp: []
```

Локальный пакет-зависимость должен сам иметь `apm.yml` или `bapm.yml` (например skill с `.apm/skills/...`).

Подробнее: [манифест](/guide/config-manifest).

## 3. Первый install в Cursor

```bash
bapm install --target cursor
```

`--target cursor` **принудительно** активирует Cursor-integration, даже если в проекте ещё нет каталога `.cursor/`. Без force CLI может опереться на auto-detect (наличие `.cursor/` или legacy `.cursorrules`).

Полезные флаги на старте:

| Флаг | Зачем |
| --- | --- |
| `--target cursor` | Явно выбрать Cursor runtime |
| `--dry-run` | Посмотреть план без записи на диск |
| `-v` / `--verbose` | Больше диагностики |
| `--frozen` | Только по существующему lock без дрейфа пинов |

Полный список: [Справка: install](/reference/install).

### Что ожидать на диске

После успешного install (типичный happy path):

| Артефакт | Смысл |
| --- | --- |
| `bapm.lock.yaml` (или `apm.lock.yaml`) | Зафиксированный граф; свежий lock по умолчанию пишется как `bapm.lock.yaml` |
| `apm_modules/` | Материализованные пакеты (имя каталога — wire-parity с APM) |
| `.agents/skills/<name>/SKILL.md` | Skills |
| `.cursor/rules/<name>.mdc` | Instructions / rules |
| `.cursor/agents/<name>.md` | Agents |
| `.cursor/mcp.json` | MCP-серверы (если есть eligible `dependencies.mcp`; по умолчанию — прямые) |

Точный набор файлов зависит от содержимого зависимостей. Install с `--target cursor` может создать нужные deploy-корни; auto-detect без force **не** создаёт `.cursor/` только ради MCP.

Lock без деплоя в хост: `bapm lock` — см. [lockfile](/guide/lockfile).

## 4. Если не сработало

| Симптом | Что проверить |
| --- | --- |
| `No manifest found` | В cwd нет ни `apm.yml`, ни `bapm.yml` |
| `Both apm.yml and bapm.yml are present` | Оставьте один файл |
| `frozen` / lock error при `--frozen` | Сначала обычный `install` или `lock`, чтобы появился lock |
| `bapm: command not found` | Установите CLI в проект (`pnpm add -D bapm` / `npm i -D bapm`) и вызывайте через `pnpm exec bapm` / `npx bapm` |
| Ожидали Claude/Codex runtime | Сейчас runtime — cursor-only; см. [совместимость](/guide/conformance) |

Дальше: [команды](/guide/commands) → [сценарии](/guide/situations/) → [справка](/reference/).
