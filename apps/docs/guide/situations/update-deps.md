# US-03: Обновить зависимости

## Когда …

Lock устарел относительно remote tips (branch/tag/semver), и нужно увидеть diff, затем переразрешить пины.

### Цель

Сначала отчёт `outdated`, затем контролируемый `update` (или plan-only) с записью нового lock.

### Шаги

1. Сравните пины lock с remote (report-only, lock не меняется):

```bash
bapm outdated
# или machine-readable:
bapm outdated --json
```

2. Посмотрите план без записи:

```bash
bapm update --dry-run
```

3. Примените (в CI / без TTY нужен `-y`; в интерактивном TTY без `-y` будет `Apply? [y/N]`):

```bash
bapm update -y
# или только выбранные пакеты:
bapm update -y some-package
```

4. Закоммитьте обновлённый lock (и манифест, если меняли refs). Для деплоя в Cursor после update обычно снова:

```bash
bapm install --target cursor
```

Альтернатива переразрешения mutable refs на install: `bapm install --update` (нельзя сочетать с frozen / CI-default frozen).

### Ожидаемый результат

- `outdated` печатает таблицу (или JSON); exit `0` даже при наличии outdated-строк; без lock — non-zero.
- `update --dry-run` показывает план, disk не меняется.
- `update -y` обновляет пины в lock / modules; затем install при необходимости освежает host deploy.

Справка: [outdated](/reference/outdated), [update](/reference/update).

### Если не сработало

- Нет TTY и нет `-y` → confirm не проходит; добавьте `-y` или оставайтесь на `--dry-run`.
- `outdated` падает без lock → сначала `install` / `lock`.
- В CI с frozen install + желание `--update` → сначала обновите вне frozen, закоммитьте lock ([US-02](/guide/situations/ci-frozen)).
- Полный 40-hex SHA в outdated сравнивается с latest annotated semver tag только как отчёт — манифест сам не перепишется.
