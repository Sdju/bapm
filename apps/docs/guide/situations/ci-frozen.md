# US-02: Воспроизводимый CI по lock

## Когда …

Команда коммитит lock, а в CI нужно поставить ровно те же пины без дрейфа и без случайного rewrite lock.

### Цель

В пайплайне воспроизвести граф из закоммиченного lockfile (fail closed при отсутствии lock или drift).

### Шаги

1. Локально после успешного resolve закоммитьте **и** манифест, **и shared** lock (`bapm.lock.yaml` или `apm.lock.yaml`). `bapm.local.lock.yaml` **не** коммитьте — см. [lock-файл](/guide/lockfile).
2. В CI вызовите install в frozen-режиме:

```bash
bapm install --frozen --target cursor
```

3. Альтернатива без явного `--frozen`: если env `CI` truthy (не `""`, `"0"`, `"false"`), `bapm install` по умолчанию уже frozen — достаточно:

```bash
bapm install --target cursor
```

4. Дополнительный integrity-gate (наличие lock, deployed presence, hash re-verify):

```bash
bapm audit --ci
```

### Ожидаемый результат

- Install не переписывает пины lock при совпадении; при наличии — сверяет `deployed_file_hashes`.
- При отсутствии shared lock или drift — non-zero exit **до** мутаций проекта (fail closed).
- Отсутствие personal lock **OK**, если в манифесте нет `local`-источников.
- `audit --ci` проходит, если lock и deployed hashes согласованы с диском.

Флаги: [install](/reference/install), [audit](/reference/audit). Shared vs personal: [lock-файл](/guide/lockfile).

### Если не сработало

- Frozen / missing lock → сначала локально `bapm install` или `bapm lock`, закоммитьте **shared** lock, снова CI.
- В манифесте есть `local`, а personal lock нет → pin отсутствует в effective graph; уберите `local` из CI-манифеста или обеспечьте pin (не коммитьте personal в репозиторий команды).
- Нужно обновить пины в CI → frozen + `--update` **запрещены**; обновите локально (`update` / `install --update` вне frozen), закоммитьте, затем снова frozen CI.
- В CI с truthy `CI` хотите разрешить дрейф → явный `--no-frozen` (осознанно ослабляет воспроизводимость).
- `--frozen` и `--no-frozen` вместе → ошибка взаимного исключения.
