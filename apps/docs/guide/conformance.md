# Совместимость с APM и OpenAPM

Страница для тех, кто переходит с [microsoft/apm](https://github.com/microsoft/apm) или сверяет bapm со спецификацией OpenAPM. Для обычной работы она не нужна.

## Коротко

- **Файлы совместимы.** bapm читает `apm.yml` и `apm.lock.yaml` и продолжает писать в `apm.lock.yaml`, если проект уже им пользуется.
- **Формат соответствует OpenAPM v0.1** в ролях Consumer, Producer и Governance: манифест, lock, политика, разрешение зависимостей. Требования OpenAPM к раскладке файлов по агентам (раздел 8.5) пока не проверяются: каждая интеграция раскладывает файлы по-своему. Роль Registry (сервер registry) не реализована: bapm только клиент.
- **CLI — не копия `apm`.** Команды и флаги похожи, но не совпадают один к одному. Скрипты под `apm` могут потребовать правок.

Полный перечень с оговорками: [`CONFORMANCE.md`](https://github.com/Sdju/bapm/blob/master/CONFORMANCE.md) в репозитории.

## Чем bapm отличается от APM

Есть в bapm сверх формата APM:

- поддержка агентов вынесена в пакеты `@b-apm/integration-*`, можно подключить свою;
- личные настройки в `bapm.local.yml`;
- личные пакеты через источник `local` с отдельным `bapm.local.lock.yaml`;
- пресеты (`presets` и `active`).

Пока проще, чем в APM:

- `compile` собирает один файл (`AGENTS.md` и аналоги) для одного агента за запуск, без распределения инструкций по каталогам через `applyTo`;
- установка из registry экспериментальная (`BAPM_EXPERIMENTAL_REGISTRIES=1`).

## Намеренные отличия от APM / OpenAPM

Это осознанные расхождения, а не баги и не скрытые pass в conformance. Каждое зафиксировано в [`CONFORMANCE.md`](https://github.com/Sdju/bapm/blob/master/CONFORMANCE.md).

| Отличие                    | Поведение bapm                                                                            | APM / OpenAPM                                                  | Где подробнее                                        |
| -------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------- |
| Diamond-зависимости        | Пересечение semver-диапазонов; пустое пересечение — ошибка, без first-wins и git-fallback | APM: first-wins                                                | [Зависимости](/guide/manifest-dependencies)          |
| Порядок записей в lock     | `(repo_url, virtual_path)`                                                                | APM: по глубине дерева                                         | [Lock-файл](/guide/lockfile)                         |
| YAML                       | Строгий subset: якоря, алиасы и кастомные теги отвергаются при чтении                     | APM: свободный SafeLoader; OpenAPM: строгий subset             | [Манифест](/guide/config-manifest)                   |
| Раскладка §8.5             | Не заявляется; пути задают пакеты `@b-apm/integration-*`                                  | OpenAPM: каноническая per-target карта                         | [Куда попадают файлы](/guide/supported-hosts#layout) |
| `compile`                  | Один файл хоста за запуск, без per-path `applyTo`                                         | APM: раскладка по каталогам через `applyTo`                    | [compile](/reference/compile)                        |
| `bapm.local.yml` и `local` | Личный оверлей настроек и личный пакет с отдельным lock                                   | Нет ни в APM, ни в OpenAPM                                     | [Личные настройки](/guide/manifest-overlay)          |
| Registry                   | Клиент только за `BAPM_EXPERIMENTAL_REGISTRIES=1`; роль registry-хоста не заявляется      | APM: registry-клиент в обычном install; OpenAPM: роль Registry | [Registries](/guide/manifest-registries)             |

Отдельно, вне таблицы:

- **`audit` всегда гейт.** `bapm audit` и `bapm audit --ci` выполняют один набор проверок и возвращают один код выхода. `--ci` принимается только для совместимости со скриптами APM и ничего не переключает; «мягкого» отчёта без флага, как в APM, нет.
- **`--no-policy` и org policy.** В bapm флаг `--no-policy` пропускает только файл политики в репозитории (`apm-policy.yml` / `bapm-policy.yml`). Org policy и её `executables.deny`/`deny_all` продолжают действовать. Полный escape — отдельный `--no-policy-all` или `BAPM_POLICY_DISABLE=1` / `APM_POLICY_DISABLE=1`; это отличие от APM, где disable-флаг выключает проверку целиком.

## Что не заявлено

- раскладка файлов по правилам OpenAPM 8.5;
- работа bapm в роли registry-сервера;
- совместимость маркетплейсов и Agent Plugins со всеми клиентами;
- полный интерактивный `approve` из APM. Политика и разрешения покрывают MCP и `bin/` зависимостей, а также hooks зависимостей: при наличии `executables.allow` или org `executables.deny`/`deny_all` hook без grant отбрасывается с предупреждением `HOOK_TRUST_WITHHELD`. Без grant-поверхности hooks остаются в мягком режиме (раскладываются); canvas как primitive не реализован.
