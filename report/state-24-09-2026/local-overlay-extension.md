# `bapm.local.yml` и источник `local`

**Статус:** намеренно  
**Класс:** намеренное отличие  
**Важность:** низкая — расширение полностью опционально и задокументировано; вред возможен только если личный файл или `local`-запись закоммитить, и это ловится doctor/CI.  
**Проверено:** 08-11-2026, working tree

## Суть

Личный оверлей и личные пакеты — два разных расширения bapm, которых нет ни в APM, ни в OpenAPM. `bapm.local.yml` лежит рядом с базовым манифестом и переопределяет только настройки: `active`, `target`, `targets`, `env`, `registries`. Источник `local` подключает пакет из `.agents/local` (или указанного каталога) и пишет его версию в отдельный `bapm.local.lock.yaml`.

Оверлей ищется только в каталоге базового манифеста, без подъёма по родителям; `apm.local.yml` в v1 отвергается (`packages/core/src/modules/Manifest/localOverlay.ts:27-40`). Слияние не симметричное: `active` заменяется целиком, а `env`, `registries` и объектные `target` / `targets` сливаются по ключам с победой локального значения. Зависимости в оверлее объявить нельзя — для них есть отдельный источник `local`.

Переносимый аналог для команды — `path:`: он попадает в общий lock и работает у всех. `local` и оверлей нужны для личного, что не должно менять общий `bapm.yml` / `bapm.lock.yaml`; цена — непереносимость и два дополнительных файла, которые нельзя коммитить.

## Влияние

- **Сценарий:** в команде у части разработчиков Cursor, у части Claude; агент вынесен в `bapm.local.yml`, а черновой skill подключён через `local`.
- **Кого задевает:** команда, CI, безопасность — в `env` оверлея могут лежать личные токены.
- **Последствие:** у коллег и в CI нет личных настроек и пинов; общий lock остаётся чистым. Если закоммитить оверлей с токенами в `env`, они утекут; если закоммитить `local`-запись — CI упадёт.
- **Частота:** постоянно в сценарии «разные агенты у одной команды»; сам по себе безвреден.
- **Обходной путь:** добавить `bapm.local.yml` и `bapm.local.lock.yaml` в `.gitignore`; для общих пакетов использовать `path:` или git.

## Состояние

| Источник     | Позиция                                                                                       |
| ------------ | --------------------------------------------------------------------------------------------- |
| APM          | Нет `*.local.yml`, нет источника `local`.                                                     |
| OpenAPM      | Нет этих полей.                                                                                |
| Спека bapm   | `manifest-local-overlay`: allowlist `active`, `target`, `targets`, `env`, `registries`; `lockfile-local-shared-split` — отдельный personal lock. |
| Код bapm     | `packages/core/src/modules/Manifest/localOverlay.ts:14` — allowlist; `Lockfile/personal.ts:11` — `bapm.local.lock.yaml`. |
| Тесты        | `packages/core/tests/manifest/local-overlay-allowlist.test.ts`; `local-overlay-discovery.test.ts`. |
| Документация | `apps/docs/guide/manifest-overlay.md`; ситуации `team-local-active.md`, `personal-local-lock.md`. |

## Проверка

| Артефакт | Где смотреть |
| -------- | ------------ |
| Код      | `Manifest/localOverlay.ts:14` — allowlist; `:33` — отказ `apm.local.yml`; `:46` — корень без parent walk-up; `Lockfile/personal.ts:11` — имя personal lock. |
| Тесты    | `local-overlay-allowlist.test.ts:25` — разрешённые ключи; `:51` — `dependencies` отвергается; `local-overlay-discovery.test.ts` — поиск только в корне. |
| Спека    | `openspec/specs/manifest-local-overlay/spec.md:9` — discovery; `:37` — allowlist; `lockfile-local-shared-split/spec.md:11` — personal lock. |
| Docs     | `apps/docs/guide/manifest-overlay.md:3` — назначение; `:29-36` — что переопределяется; `situations/personal-local-lock.md:9` — `local` → `bapm.local.lock.yaml`. |

Воспроизведение:

```bash
repo=$PWD
tmp=$(mktemp -d)
printf 'name: demo\nversion: 0.0.1\ndependencies:\n  apm: []\n' > "$tmp/bapm.yml"
printf 'dependencies:\n  apm:\n    - path: ./x\n' > "$tmp/bapm.local.yml"
(cd "$tmp" && node "$repo/packages/cli/dist/cli.mjs" install)
```

Ожидание: оверлей с запрещённым ключом отвергнут, код выхода 1.  
Факт: `bapm: Local overlay key "dependencies" is not allowed (allowlist: active, target, targets, env, registries)`; воспроизведено 08.11.2026.

## Вариации

1. Не вводить расширение — только `path:` в общем манифесте; плюс — один способ, минус — личные настройки и WIP-пакеты не изолированы.
2. Личный слой (текущий выбор); **рекомендуется** — общий lock чист, настройки не конфликтуют в PR.
3. Слить local в общий lock — сломает CI, если машины разные, и засорит общий lock личными пинами.

## Рекомендация

Оставить вариант 2. Расширение решает реальную задачу «разные агенты / личный WIP» и уже покрыто спекой, тестами и docs. Оценка S: усилить предупреждение о коммите `bapm.local.yml` (риск токенов) и закрыть карточку.

Критерии закрытия:

- [ ] вариант 2 подтверждён владельцем;
- [ ] docs явно предупреждают не коммитить `bapm.local.yml` из-за возможных секретов в `env`;
- [ ] `bapm doctor` по-прежнему сообщает о git-tracked personal overlay/lock.

## Поведение сейчас

Оверлей полностью заменяет `active` базы, остальные разрешённые поля сливает по правилам. `local`-пакет попадает только в `bapm.local.lock.yaml`. Если записать `local` в общий `bapm.yml`, в CI frozen install падает на отсутствующем пине (`INSTALL_FROZEN_MISSING_PIN`), а вне CI — на отсутствующем каталоге у коллег. `doctor` предупреждает, если личный файл попал в git, но на код выхода это не влияет. См. [path-absolute-in-lock.md](./path-absolute-in-lock.md) про другой непереносимый путь.

## Связанные

- [path-absolute-in-lock.md](./path-absolute-in-lock.md) — `path:` пишется в lock абсолютным путём, что тоже мешает переносимости.
- [env-precedence.md](./env-precedence.md) — приоритет `env` оверлея против bake и переменных процесса.
- [targets-narrow-deploy.md](./targets-narrow-deploy.md) — `target` / `targets` в оверлее тоже сужают раскладку.
