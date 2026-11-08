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

## Поведение, которое отличается намеренно

- **Пересечение агентов.** Если и пакет, и ваша запись зависимости ограничивают список агентов, bapm берёт пересечение, а APM — первое найденное.
- **YAML-якоря** обрабатываются строго по OpenAPM.
- **Порядок записей в lock.** bapm сортирует зависимости по `repo_url` (как в OpenAPM), а APM — по глубине в дереве. Lock, переписанный bapm, может отличаться от записанного `apm` порядком записей.
- **`audit` всегда гейт.** `bapm audit` и `bapm audit --ci` выполняют один набор проверок и возвращают один код выхода. `--ci` принимается только для совместимости со скриптами APM и ничего не переключает; «мягкого» отчёта без флага, как в APM, нет.
- **`local` и `bapm.local.yml`** — расширения bapm, их нет ни в APM, ни в OpenAPM. Для переносимых манифестов используйте `path:`.
- **`--no-policy` и org policy.** В bapm флаг `--no-policy` пропускает только файл политики в репозитории (`apm-policy.yml` / `bapm-policy.yml`). Org policy и её `executables.deny`/`deny_all` продолжают действовать. Полный escape — отдельный `--no-policy-all` или `BAPM_POLICY_DISABLE=1` / `APM_POLICY_DISABLE=1`; это отличие от APM, где disable-флаг выключает проверку целиком.
- **Org policy discovery.** Провайдер `github-owner-dotgithub` заявлен и подключён в CLI: при GitHub-remote он загружает `<owner>/.github/apm-policy.yml` для `policy status`, `install`, `lock` и `update`. Полные APM/ADO каскады (`.apm`/`_apm`/Azure DevOps, multi-candidate) не реализованы.

## Что не заявлено

- раскладка файлов по правилам OpenAPM 8.5;
- полные каскады policy discovery для Azure DevOps и multi-candidate (`.apm`/`_apm`); поддерживается только `github-owner-dotgithub`;
- работа bapm в роли registry-сервера;
- совместимость маркетплейсов и Agent Plugins со всеми клиентами;
- полный интерактивный `approve` из APM. Политика и разрешения покрывают MCP и `bin/` зависимостей, а также hooks зависимостей: при наличии `executables.allow` или org `executables.deny`/`deny_all` hook без grant отбрасывается с предупреждением `HOOK_TRUST_WITHHELD`. Без grant-поверхности hooks остаются в мягком режиме (раскладываются); canvas как primitive не реализован.
