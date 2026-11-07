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
| `Frozen install missing direct dependency pin(s): <имя>`, хотя lock обновлён | В общий `bapm.yml` попала личная зависимость `local`: она пишется в `bapm.local.lock.yaml`, которого в CI нет. См. [Личные пакеты](/guide/situations/personal-local-lock) |

::: warning Что frozen не ловит
Frozen проверяет, что lock есть, у каждой прямой зависимости есть пин и развёрнутые файлы совпадают с хэшами. Если в `bapm.yml` у уже закреплённого пакета поменяли `#ref` (например, `#v1` на `#v2`), а lock не обновили, frozen install пройдёт и поставит старую версию из lock. Такие правки проверяйте на ревью.
:::

`bapm install --update` в CI запрещён: frozen несовместим с `--update`. `bapm update -y` при этом не блокируется и перепишет lock — не запускайте его в CI. Обновляйте локально ([сценарий](/guide/situations/update-deps)) и коммитьте lock. Если в каком-то job дрейф версий допустим, отключите frozen явно: `bapm install --no-frozen`.

## Секреты для MCP в CI

Если MCP-серверы используют `${VAR}`, задайте переменные в секретах CI: без них install упадёт с `MCP env bake failed`. Если MCP в этом job не нужны, ставьте только пакеты: `bapm install --only apm`.
