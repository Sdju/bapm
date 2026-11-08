# CI по lock-файлу

## Ситуация

В CI (тесты агентов, сборка образа, проверка PR) нужно поставить ровно те версии пакетов, что закоммичены, и упасть, если кто-то изменил `bapm.yml`, но забыл обновить lock.

## Шаги

### 1. Закоммитьте lock

Локально выполните `bapm install` и закоммитьте `bapm.yml` и `bapm.lock.yaml`. `bapm.local.yml` и `bapm.local.lock.yaml` не коммитьте.

### 2. Запустите install в CI

```bash
npm ci
npx bapm install
```

В CI (переменная `CI` задана, так делают GitHub Actions, GitLab CI и большинство других систем) install автоматически работает как `--frozen`. Вне CI то же поведение включается флагом:

```bash
npx bapm install --frozen
```

Если агент не определяется по маркеру, добавьте `--target <id>`.

### 3. Проверьте целостность (по желанию)

```bash
npx bapm audit --ci
```

`audit --ci` сверяет развёрнутые файлы с хешами в lock и завершается с ненулевым кодом при расхождении. Отчёт для GitHub code scanning: `bapm audit --ci -f sarif -o bapm.sarif`.

### Пример для GitHub Actions

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 22
- run: npm ci
- run: npx bapm install
- run: npx bapm audit --ci
```

## Когда frozen install падает

| Сообщение                                                                    | Что это значит и что делать                                                                                                                                               |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Frozen install requires an existing lockfile`                               | `bapm.lock.yaml` не закоммичен                                                                                                                                            |
| `Frozen install missing direct dependency pin(s)`                            | В `bapm.yml` добавили пакет, а lock не обновили. Выполните `bapm install` локально и закоммитьте lock                                                                     |
| `Frozen deployed file hash mismatch`                                         | Развёрнутый файл отличается от записанного в lock. Обычно его правили вручную или закоммитили изменённую копию                                                            |
| `Frozen install ref drift`                                                   | У закреплённого пакета в `bapm.yml` сменили `#ref`, а lock не обновили. Выполните `bapm install --update` локально и закоммитьте lock                                     |
| `Frozen install would deploy files for package "…" that the lock does not record` | Lock не содержит `deployed_file_hashes`/`deployed_files` для пакета, чьи примитивы install собирается развернуть (старый lock или ручная правка). Выполните `bapm install` локально и закоммитьте lock |
| `Frozen install detected local content changed for "…"`                      | Содержимое локального пакета (`local:`/`path:`) изменилось после записи `content_hash`. Frozen не разворачивает изменённый локальный код: выполните `bapm install` локально и закоммитьте lock |
| `Frozen install missing direct dependency pin(s): <имя>`, хотя lock обновлён | В общий `bapm.yml` попала личная зависимость `local`: она пишется в `bapm.local.lock.yaml`, которого в CI нет. См. [Личные пакеты](/guide/situations/personal-local-lock) |

::: warning Frozen не разворачивает незаписанные файлы
Frozen install сверяет would-be deploy set с inventory в lock. Если для пакета, который поставляет примитивы (skill/command/agent/instruction/hook), в lock нет `deployed_file_hashes` или `deployed_files`, install падает с `INSTALL_FROZEN_UNDER_RECORDED` до записи harness-файлов и lock. Тот же код возвращается, если локальный пакет не имеет `content_hash`/`tree_sha256` или его дерево изменилось. Исправление одно: `bapm install` вне CI и коммит lock.
:::

::: warning Смена `#ref` требует обновления lock
Frozen сверяет `ref` прямых git-зависимостей с `resolved_ref` в lock. Если поменять `#ref` (например, `#v1` на `#v2`) и не обновить lock, frozen install упадёт с `Frozen install ref drift` до записи модулей и lock. Обновите lock вне CI: `bapm install --update`, затем закоммитьте его.
:::

`bapm install --update` в CI запрещён: frozen несовместим с `--update`. `bapm update -y` в CI тоже завершается с ненулевым кодом (`UPDATE_FROZEN_REFUSED`) и **не меняет lock**: update в frozen/CI-контексте требует явного override. Обновляйте локально ([сценарий](/guide/situations/update-deps)) и коммитьте lock. Если в каком-то job дрейф версий действительно допустим, отключите frozen для install явно (`bapm install --no-frozen`), а для update передайте явный override: `bapm update -y --force`.

## Секреты для MCP в CI

Если MCP-серверы используют `${VAR}`, задайте переменные в секретах CI: без них install упадёт с `MCP env bake failed`. Если MCP в этом job не нужны, ставьте только пакеты: `bapm install --only apm`.
