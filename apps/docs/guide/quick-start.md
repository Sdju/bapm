# Быстрый старт

Цель: установить CLI и интеграцию, создать минимальный манифест и убедиться, что первый `install` записал ожидаемые файлы. Выберите host до выполнения команд: ниже есть готовый путь для Cursor и короткий путь для любого другого известного host.

::: warning UNSTABLE
Ранний публичный релиз на npm. API и layout могут меняться без major bump. **Не для production.**
:::

## 1. Выберите host

**Cursor:** продолжайте со следующим разделом. Для auto-detect создайте `.cursor/`.

**Другой известный host:** найдите его id, пакет и marker в [таблице hosts](/guide/supported-hosts#таблица). В командах ниже замените `cursor` на этот id и `@b-apm/integration-cursor` на соответствующий пакет. Можно не создавать marker и выбрать host явно через `--target <id>`.

`targets:` не нужен для известных hosts: CLI использует canonical `@b-apm/integration-<id>`. Он нужен только для custom host или замены пакета реализации.

## 2. Создайте проект

```bash
mkdir my-agent && cd my-agent
# Только для Cursor:
mkdir -p .cursor
```

Для другого host вместо `mkdir -p .cursor` используйте его marker из [таблицы](/guide/supported-hosts#таблица), либо не создавайте marker и позже выберите host через `--target <id>`.

Создайте `bapm.yml`:

```yaml
name: my-agent-project
version: 0.0.1
dependencies:
  apm: []
  mcp: []
```

## 3. Установите зависимости

Нужен Node.js ≥ 22.12.

**Рекомендуется: установить в проект.** Версия CLI и интеграции будет видна в `package.json` и зафиксирована lock-файлом пакетного менеджера, поэтому одинаково запускается у коллег и в CI.

```bash
npm i -D @b-apm/cli @b-apm/integration-cursor
```

**Альтернатива для личного CLI:** установите оба пакета глобально и используйте `bapm` вместо `npx bapm` в командах ниже.

```bash
npm i -g @b-apm/cli @b-apm/integration-cursor
```

Не смешивайте эти варианты в одной инструкции: project-local команды начинаются с `npx bapm`, global-команды — с `bapm`.

Запустите install:

```bash
npx bapm install
```

Для другого host без marker выполните `npx bapm install --target <id>`.

Что происходит:

1. CLI находит агента (**detect**: каталог `.cursor/` или legacy `.cursorrules`).
2. Для известного host id подтягивается **стандартный** пакет `@b-apm/integration-cursor` (canonical fallback; object-map `targets:` не обязателен).
3. Зависимости материализуются в layout агента.

Object-map `targets:` — только чтобы **подменить** стандартный пакет или добавить свой host. Не prerequisite для Cursor.

## 4. Проверьте результат

После успешной команды должны появиться:

| Что проверить                  | Ожидаемый результат                                 |
| ------------------------------ | --------------------------------------------------- |
| `bapm.lock.yaml`               | Зафиксированный граф зависимостей                   |
| `apm_modules/`                 | Материализованные пакеты                            |
| `.agents/skills/` и `.cursor/` | Только для Cursor: output поддерживаемых артефактов |

Проверьте план без записи и состояние окружения:

```bash
npx bapm install --dry-run
npx bapm doctor
```

Точные пути и поддерживаемые типы для каждого host: [поддерживаемые hosts](/guide/supported-hosts). MCP и ограничения policy: [сценарий policy и MCP](/guide/situations/policy-mcp).

## 5. Если host нужно выбрать явно

| Способ                             | Когда                                                                      |
| ---------------------------------- | -------------------------------------------------------------------------- |
| Auto-detect (как выше)             | Один явный маркер агента в cwd                                             |
| `active: [cursor]` в манифесте     | Pin без detect / политика команды                                          |
| `bapm.local.yml` → `active`        | Личный агент поверх общего `bapm.yml` — [overlay](/guide/manifest-overlay) |
| `npx bapm install --target cursor` | Force поверх detect / `active`                                             |

`npx bapm init -y --target cursor` по-прежнему может записать `targets:` + `active` (pin) — это удобный scaffold, не единственный путь.

Полезные флаги: `--dry-run`, `-v` / `--verbose`, `--frozen`. Полный список: [install](/reference/install).

## Восстановление

| Симптом                                      | Что проверить                                                                                              |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `No manifest found`                          | В cwd нет `bapm.yml` (или backcompat `apm.yml`)                                                            |
| пакет / `@b-apm/integration-cursor` в ошибке | Project-local: `npm i -D @b-apm/integration-cursor`; global: `npm i -g @b-apm/integration-cursor`          |
| `Target detection is missing or ambiguous`   | Несколько маркеров (`.cursor` + `.claude`) или ни одного — `npx bapm install --target cursor` или `active` |
| `frozen` / lock error при `--frozen`         | Сначала обычный `install` или `lock`                                                                       |
| Свой / кастомный агент                       | Object-map `targets:` — [hosts](/guide/supported-hosts#advanced-custom-targets)                            |

Подробнее о приоритете: [Как выбирается host](/guide/host-selection). Три понятия detect / active / targets: [Hosts](/guide/manifest-hosts). Для MCP и policy: [сценарий policy и MCP](/guide/situations/policy-mcp).

Дальше: [команды](/guide/commands) → [сценарии](/guide/situations/) → [справка](/reference/).
