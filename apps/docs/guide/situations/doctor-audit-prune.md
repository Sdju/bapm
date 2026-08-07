# US-07: Doctor / audit / prune после ручной поломки

## Когда …

После ручных правок в `apm_modules/`, deploy-файлах Cursor, lock или env install «ведёт себя странно»: лишние каталоги, несовпадение hashes, сомнения в окружении.

### Цель

Диагностировать окружение (`doctor`), проверить integrity (`audit`), убрать orphan-модули (`prune`), затем при необходимости переустановить по lock.

### Шаги

1. Sanity окружения и проекта:

```bash
bapm doctor
bapm doctor -v
```

`-v` даёт богаче detail и informational network probe (`git ls-remote`); auth check смотрит только **имена** `GITHUB_TOKEN` / `GH_TOKEN`, не секреты.

2. Integrity gate (lock + deployed presence + hash re-verify):

```bash
bapm audit --ci
# отчёт в файл:
bapm audit --ci -f json -o audit.json
```

3. Orphan-модули вне графа lock:

```bash
bapm prune --dry-run
bapm prune
```

4. Если hashes/deploy разъехались, но lock правильный — переустановите по frozen lock:

```bash
bapm install --frozen --target cursor
```

Если lock сам битый/устаревший относительно манифеста — вне CI обновите осознанно (`install` без frozen или [US-03](/guide/situations/update-deps)), затем снова audit.

### Ожидаемый результат

- `doctor` сообщает о проблемах окружения/проекта; network probe с `-v` не critical.
- `audit --ci` падает при отсутствии lock, missing deploy или hash mismatch.
- `prune` удаляет только orphans вне resolved graph; `--dry-run` только превью.
- После `install --frozen` диск снова согласован с закоммиченным lock (если пины валидны).

Справка: [doctor](/reference/doctor), [audit](/reference/audit), [prune](/reference/prune).

### Если не сработало

- `audit` без `--ci` → для CI-gate path флаг обязателен (см. help/reference).
- Prune не трогает «лишние» файлы вне modules graph (ручной мусор в `.cursor/` может остаться) → переinstall / ручная чистка deploy + frozen install.
- Doctor «зелёный», audit красный → смотрите lock/hashes, не только env tokens.
- Не правите lock вручную «чтобы сходится» — перегенерируйте через install/update ([lockfile](/guide/lockfile)).
