# US: Личный local без шума в team lock

## Когда …

Нужен локальный WIP-пакет (каталог `.agents/local` или свой путь через `local:`) в **своём** checkout, а командный `bapm.lock.yaml` / `apm.lock.yaml` не должен раздуваться личными пинами и не должен уезжать в PR.

### Цель

Зафиксировать личные `local`-зависимости в `bapm.local.lock.yaml` (gitignore), оставив shared lock только для командного графа.

### Шаги

1. В shared-манифесте (`bapm.yml` в git) держите командные зависимости (`git`, registry, `path:`, …). Личный WIP лучше объявлять через bapm-дискриминатор `local`, а не через OpenAPM `path:` — иначе pin попадёт в shared:

```yaml
# пример только для локальной машины — если кладёте local в shared bapm.yml,
# коллеги/CI тоже увидят эту зависимость в манифесте
dependencies:
  apm:
    - local
    # или: local: ./my-wip-skill
```

Частый вариант: `local` только у себя (или в личной ветке), не в CI-критичном shared-манифесте.

2. Resolve / install:

```bash
bapm lock
# или
bapm install --target cursor
```

3. Убедитесь, что появился gitignored personal lock и shared не содержит личный pin:

```text
bapm.lock.yaml          # командный граф
bapm.local.lock.yaml    # только local-пины
.gitignore              # содержит bapm.local.lock.yaml
```

4. В PR коммитьте shared lock + манифест. **Не** добавляйте `bapm.local.lock.yaml`.

### Ожидаемый результат

- Effective graph при чтении = shared ∪ personal.
- OpenAPM `path:` остаётся в shared (даже если в lock wire `source: local`).
- Bags вроде `local_deployed_*` остаются на shared.
- Без `local` в графе personal-файл не создаётся; после удаления всех `local` устаревший personal очищается.

Подробнее: [Lock-файл](/guide/lockfile), [зависимости](/guide/manifest-dependencies), [overlay](/guide/manifest-overlay) (это про `bapm.local.yml`, не про lock).

### Если не сработало

| Симптом                                      | Что проверить                                                              |
| -------------------------------------------- | -------------------------------------------------------------------------- |
| Личный pin всё ещё в shared                  | Форма в манифесте — `local`, не `path:`; затем снова `bapm lock`           |
| Legacy pin в shared, personal пуст           | Нормально на чтении; следующий успешный lock/install мигрирует             |
| `apm.local.lock.yaml` → ошибка               | Удалите файл; поддерживается только `bapm.local.lock.yaml`                 |
| Doctor WARN: personal tracked                | `git rm --cached bapm.local.lock.yaml` + строка в `.gitignore`             |
| CI frozen падает из‑за `local`               | Уберите `local` из CI-манифеста или обеспечьте pin в effective graph       |
| Pack/publish «утащил» personal               | Не должен: pack/publish опускают `bapm.local.lock.yaml`                    |
