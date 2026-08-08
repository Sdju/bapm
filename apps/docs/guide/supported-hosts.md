# Поддерживаемые hosts и кастомные интеграции

Куда `bapm install` / `bapm compile` раскладывают пакеты. Поля манифеста: [Hosts и target](/guide/manifest-hosts).

| Host | В CLI | Как подключить |
| --- | --- | --- |
| **Cursor** | Нет (отдельный пакет) | Установить `@bapm/integration-cursor`, объявить `targets:`, затем `--target cursor` / `active` |
| **Свой агент** | Нет | npm-пакет или локальный модуль + `targets:` / `target:` object-map |
| **Claude / Codex** | Нет (не runtime) | Пакеты `@bapm/integration-claude` / `@bapm/integration-codex` + [Marketplace pack](/guide/situations/marketplace-pack) |

## Cursor (opt-in пакет)

CLI не регистрирует Cursor сам. Поставьте пакет и объявите object-map:

```bash
npm i -g @bapm/cli @bapm/integration-cursor
# или в проекте: npm i -D @bapm/integration-cursor
```

```yaml
targets:
  cursor: "@bapm/integration-cursor"
active:
  - cursor
```

```bash
bapm init -y --target cursor   # пишет targets: + active
bapm install --target cursor
```

Без `--target` CLI может опереться на auto-detect (`.cursor/` / `.cursorrules`) или на `active` — но только после успешной загрузки map.
## Кастомный npm-пакет

1. Поставьте пакет интеграции (глобально рядом с CLI или в проекте — как принято у вас для зависимостей).
2. Объявите object-map и активируйте host:

```yaml
targets:
  x-acme-editor: "@acme/my-integration"
active:
  - x-acme-editor
```

```bash
bapm install --target x-acme-editor
```

Значения без `./` / `../` / абсолютного пути трактуются как **npm package specifier** (`@scope/name`, `pkg@version`).

## Локальный модуль или скрипт

Путь относительно корня проекта (обязан оставаться внутри project root):

```yaml
targets:
  pi: "./agents/integration/pi-agent"
```

```bash
bapm install --target pi
```

Директория резолвится через Node (`exports` / `main` / `index.*`); можно указать явный `.js` / `.mjs` / `.cjs`.

### Минимальный контракт

Модуль должен экспортировать (первое совпадение):

1. именованный **`createIntegration()`** — без аргументов, возвращает интеграцию; или
2. именованный factory вроде `createCursorIntegration`; или
3. **default export** — объект интеграции или factory.

У экземпляра обязательны непустые:

| Поле | Смысл |
| --- | --- |
| `id` | Должен совпадать с ключом в `targets:` / `target:` |
| `deployRoots` | Массив корней деплоя |
| `detect` | Функция автодетекта host |
| `materialize` | Запись примитивов на диск |

`configureMcp` / `compile` — опционально. Пакеты только для marketplace-output (без runtime hooks) как значение map для install/compile **отклоняются**.

Контракт и helpers: пакет `@bapm/integration-api`. Глубокий authoring: [Architecture](/architecture/).

## Claude и Codex

Это **не** runtime install targets. Для marketplace JSON нужны соответствующие integration-пакеты:

```bash
npm i -D @bapm/integration-claude   # или @bapm/integration-codex
bapm pack --marketplace claude
```

Сценарий: [Marketplace pack](/guide/situations/marketplace-pack).

## Типичные ошибки

| Симптом | Что проверить |
| --- | --- |
| `Unknown or unregistered target` | Пакет установлен? Id объявлен в object-map `targets:`? |
| `Target detection is missing or ambiguous` | `--target <id>` или `active: […]` |
| Отказ загрузки map | Пакет/путь, `createIntegration`, совпадение `id` с ключом, containment пути |

Дальше: [Hosts и target](/guide/manifest-hosts) · [Быстрый старт](/guide/quick-start).
