# US-05: Собрать AGENTS.md (compile)

## Когда …

В проекте уже есть обнаруживаемые примитивы (skills / instructions / agents), и нужен единый target-owned файл для Cursor — обычно `AGENTS.md`.

### Цель

Сгенерировать (или только проверить) compile-вывод без путаницы с `install` / marketplace pack.

### Шаги

1. Убедитесь, что cwd — корень проекта с манифестом и нужными артефактами (после [install](/guide/situations/install-fresh) или ручного layout).
2. Превью пути без записи:

```bash
bapm compile --target cursor --dry-run
```

3. Только discover/validate:

```bash
bapm compile --target cursor --validate
```

4. Запись на диск (default path задаёт target; для cursor типично `AGENTS.md`):

```bash
bapm compile --target cursor
# другой путь:
bapm compile --target cursor -o path/to/OUT.md
```

5. Атрибуция источников: добавьте `-v` / `--verbose`.

### Ожидаемый результат

- Без `--dry-run` / `--validate` появляется файл по default path target или по `-o`.
- `--dry-run` и `--validate` **не** пишут выходной файл.
- Если auto-detect отсутствует или неоднозначен — без `--target` команда просит передать `--target <id>` (например `cursor`) или задать sole `active` в манифесте.
- Если `active` перечисляет несколько hosts — без `--target` compile падает (single-host).

Флаги: [compile](/reference/compile).

### Если не сработало

- `Target detection is missing or ambiguous; pass --target <id>` → укажите `--target cursor` или sole `active: [cursor]`.
- Multi-`active` без `--target` → укажите `--target <id>`.
- Unknown target id → id должен быть зарегистрирован (built-in или object-map).
- Пустой / неожиданный вывод → проверьте, что примитивы лежат там, где target их ищет; сначала сделайте install в Cursor.
- Не путайте с `bapm pack`: compile — host markdown; pack — zip / marketplace.json ([US-06](/guide/situations/marketplace-pack)).
