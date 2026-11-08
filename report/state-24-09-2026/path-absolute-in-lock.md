# `path:` пишется в lock абсолютным путём

**Статус:** открыто  
**Класс:** баг / переносимость  
**Важность:** средняя — install не падает, но общий lock хранит абсолютный путь одной машины и переносит его дальше.  
**Проверено:** 08-11-2026, working tree

## Суть

Общий `path: ./tools/team-skills` должен работать у всей команды. В lock bapm кладёт абсолютный путь машины, которая сделала install: `repo_url` при этом относительный (`local:tools/team-skills`), а поле `path` — абсолютный путь. На другой машине тот же lock врёт: `path` указывает на несуществующий каталог.

Хуже, что путь «залипает». `buildLockDocument` для `kind: "local"` сначала берёт `prev.path` из уже загруженного lock и только при его отсутствии пишет `n.path`. Поэтому install на другой машине не исправляет абсолютный путь: он переносит чужой `/home/alice/...` дальше, пока lock не удалят или identity не изменится.

При этом frozen install не падает: пин ищется по `repo_url`/имени, а материализация идёт из манифеста, не из поля `path`. То есть исходное «врёт или падает» верно только в части «врёт»; функционального отказа нет, но общий lock содержит неверную локальную локацию, а `find`/внешние потребители видят чужой путь.

## Влияние

- **Сценарий:** команда коммитит `bapm.lock.yaml` с зависимостью `path: ./tools/team-skills`.
- **Кого задевает:** команда, CI, внешние скрипты и `find`, читающие `path` из lock.
- **Последствие:** в lock навсегда остаётся путь первой машины; свежие lock на разных машинах отличаются; диагностика показывает несуществующий путь.
- **Частота:** любая общая `path:`-зависимость; типичный монорепозиторный сценарий.
- **Обходной путь:** для личных пакетов — `local:` (пишется в `bapm.local.lock.yaml`); для общих — терпеть абсолютный `path` или перегенерировать lock.

## Состояние

| Источник     | Позиция                                                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| APM          | Локальный path в lock обычно канонизируется относительно проекта или остаётся как в манифесте.                                              |
| OpenAPM      | Identity path — переносимый идентификатор, не путь CI-агента.                                                                                |
| Спека bapm   | `local-path-source`:42-63,103-106 — `path:` резолвится как local и попадает в общий lock; требований к формату `path` в lock нет.            |
| Код bapm     | `packages/core/src/modules/Resolver/resolveGraph.ts:641,929-932` — identity `local:<путь относительно cwd>`; `:660-672` — `path: abs`; `packages/core/src/modules/Resolver/resolveAndLock.ts:315-320` — `prev.path` приоритетнее текущего. |
| Документация | `apps/docs/guide/manifest-dependencies.md:48` — «в текущей версии в lock записывается абсолютный путь»; `apps/docs/guide/lockfile.md:35` — то же. |
| Тесты        | `packages/core/tests/resolve/local-source-resolve.test.ts:125-138` — проверяет только `source: local`; формат `path` не закреплён.            |

## Проверка

| Артефакт | Где смотреть                                                                                                                                       |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Код      | `packages/core/src/modules/Resolver/resolveGraph.ts:641` — `local:${normalizeLocalIdentity(abs, cwd)}`; `:929-932` — relativize от `cwd`.           |
| Код      | `packages/core/src/modules/Resolver/resolveGraph.ts:660-672` — `path: abs` в edge; `packages/core/src/modules/Resolver/resolveAndLock.ts:306-327` — запись local-записи.       |
| Код      | `packages/core/src/modules/Resolver/resolveAndLock.ts:315-320` — если `prev.path` есть, берётся он, а не текущий `n.path`.                          |
| Тесты    | `packages/core/tests/resolve/local-source-resolve.test.ts:125-138` — `path:` остаётся local; `separate-local-lockfile-partition.test.ts:52-63` — shared lock. |
| Спека    | `openspec/specs/local-path-source/spec.md:42-63,103-106` — path как local, shared lock.                                                             |
| Docs     | `apps/docs/guide/manifest-dependencies.md:48`, `apps/docs/guide/lockfile.md:35` — абсолютный путь задокументирован.                                |

Воспроизведение:

```bash
tmp=$(mktemp -d); cd "$tmp"; mkdir -p proj/pkgs/a; cd proj
printf 'name: root\nversion: 0.0.1\ndependencies:\n  apm:\n    - path: ./pkgs/a\n' > bapm.yml
printf 'name: pkg-a\nversion: 0.0.1\ndependencies:\n  apm: []\n' > pkgs/a/bapm.yml
bapm lock; grep -E 'repo_url|path:' bapm.lock.yaml
# repo_url: local:pkgs/a
# path: /tmp/…/proj/pkgs/a
sed -i 's#path: .*#path: /home/alice/proj/pkgs/a#' bapm.lock.yaml
bapm lock; grep 'path:' bapm.lock.yaml   # всё ещё /home/alice/…
```

Ожидание: в lock относительный, переносимый путь (например, `./pkgs/a`).  
Факт: абсолютный `path`; после подмены на чужой путь `bapm lock` его сохраняет. `CI=1 bapm install` при этом проходит.

## Вариации

1. Писать путь относительно корня проекта. — рекомендуется
2. Писать абсолютный (текущее) — lock не шарится.
3. Как `local`: вынести в `bapm.local.lock.yaml` — тогда это уже не командные `path:`.

## Рекомендация

Вариант 1: хранить `path` как project-relative POSIX (`./pkgs/a`), при чтении резолвить от `cwd`; при загрузке абсолютного пути внутри проекта — нормализовать, чужой путь не переиспользовать. `repo_url` уже относительный, так что identity менять не нужно. Оценка S: правка записи/чтения и тест на двух `cwd`.

Критерии закрытия:

- [ ] `bapm lock`/`install` пишут в lock только относительный `path` для in-root зависимости.
- [ ] повторный install на другой машине не сохраняет чужой абсолютный путь.
- [ ] frozen install по-прежнему проходит; docs/тест обновлены.

## Поведение сейчас

`bapm.lock.yaml` содержит что-то вроде `/home/alice/proj/tools/team-skills`. У Bob и в CI путь другой, но install не падает: резолв идёт из манифеста. Поле `path` остаётся чужим и не обновляется. Для черновиков, которых нет у команды, документация советует `local`, не `path:`.

## Связанные

- [deps-why-is-direct.md](./deps-why-is-direct.md) — local-записи теряют `resolved_by`/`depth`, из-за чего `deps why` врёт.
- [hash-formats.md](./hash-formats.md) — второй неоднородный формат в том же lock.
