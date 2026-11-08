# `uninstall` частичный и сравнивает по подстроке

**Статус:** открыто  
**Класс:** баг  
**Важность:** высокая — команда завершается успешно, но оставляет запись в манифесте или снимает лишние пакеты; следующая установка возвращает удалённое, а состав проекта расходится с намерением.  
**Проверено:** 08-11-2026, working tree

## Суть

Help обещает убрать пакеты из manifest, modules и lock (`packages/cli/src/modules/Uninstall/services/runUninstall.ts:32-36`), спека требует того же для каждого именованного пакета (`openspec/specs/lifecycle-uninstall-prune/spec.md:11`). Фактически идентичность пакета нигде не вычисляется: `depMatchesName` сравнивает `name`, `repo_url` и хвост URL через `includes` (`packages/core/src/modules/Uninstall/runUninstall.ts:142-146`), `matchesManifest` — через `entryName(...).includes(name)` (`:148-151`), а `filterApm` дополнительно проверяет `r.includes(n)` (`:174-179`).

`entryName` для `path:` берёт только последний сегмент пути (`:157-160`), для git — последний сегмент URL (`:161-168`), для object-form — `alias` или `id`. Если манифест пакета называется `@acme/tool`, а зависимость объявлена как `path: ./pkgdir`, то lock-имя `@acme/tool` найдётся, а manifest-запись с `entryName = "pkgdir"` — нет. Команда снимет lock, modules и deployed-файлы, но оставит строку в `bapm.yml`; следующий `install` вернёт пакет.

Обратная сторона — подстрока. `bapm uninstall skill` с пакетами `skill` и `skill-extra` снимает оба: для `filterApm` достаточно `n.includes(r)`. Полный git URL может найтись в lock через `repo.includes(name)`, но в манифесте запись при этом не чистится. Docs описывают часть этого (`apps/docs/reference/uninstall.md:21-27`), но формулировка «`path:` и `local` ничего не удаляет» шире фактического поведения: простой случай с совпадающим basename работает и покрыт тестом.

## Влияние

- **Сценарий:** монорепозиторий, зависимость `path: ./vendor/acme-tools` с манифестным именем `@acme/tools`; пользователь делает `bapm uninstall @acme/tools`.
- **Кого задевает:** команды с path/local-зависимостями и переименованными пакетами; CI, где состав зависимостей проверяется после uninstall.
- **Последствие:** lock и файлы очищены, манифест — нет; следующий install восстанавливает пакет. При коротком имени удаляются соседние пакеты. Exit code 0 в обоих случаях.
- **Частота:** регулярно для path/local и для имён, не совпадающих с хвостом URL/пути; подстрочный захват — при коротких именах.
- **Обходной путь:** вручную удалить запись из `bapm.yml`, затем `bapm uninstall <имя>` (для git) и `bapm prune`; либо сразу править манифест и lock.

## Состояние

| Источник     | Позиция                                                                                                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| APM          | `apm uninstall <name>` убирает запись из манифеста и lock по идентичности пакета.                                                                                                                       |
| OpenAPM      | Lifecycle uninstall — полное снятие прямой зависимости.                                                                                                                                                 |
| Спека bapm   | `lifecycle-uninstall-prune:11`: снять named packages из manifest + modules + deploy + lock.                                                                                                             |
| Код bapm     | `Uninstall/runUninstall.ts:142-146` — `includes` по name/repo; `:148-151` — `entryName.includes`; `:174-179` — взаимные `includes`; `entryName` (`:153-172`) берёт basename пути или хвост git URL.     |
| Документация | `apps/docs/reference/uninstall.md:21-27` — warning про git, `path:`/`local` и подстроку; часть утверждений жёстче кода.                                                                                |

## Проверка

| Артефакт | Где смотреть                                                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Код      | `packages/core/src/modules/Uninstall/runUninstall.ts:145` — четыре условия совпадения, три из них подстрочные.                                    |
| Код      | `packages/core/src/modules/Uninstall/runUninstall.ts:177` — `filterApm` удаляет и `n.includes(r)`, и `r.includes(n)`.                             |
| Тесты    | `packages/core/tests/lifecycle/uninstall-prune.test.ts:33` — успешный path-случай, где basename совпадает с именем; кейсов с расхождением имён и подстрокой нет. |
| Спека    | `openspec/specs/lifecycle-uninstall-prune/spec.md:11,13-16` — полное снятие named packages.                                                       |

Воспроизведение:

```bash
mkdir bapm-un && cd bapm-un
mkdir -p pkgdir
printf 'name: "@acme/tool"\nversion: 0.1.0\ndependencies:\n  apm: []\n' > pkgdir/bapm.yml
printf 'name: bapm-un\nversion: 0.1.0\ndependencies:\n  apm:\n    - path: ./pkgdir\n' > bapm.yml
bapm lock
bapm uninstall @acme/tool
cat bapm.yml
```

Ожидание: `@acme/tool` исчез из манифеста, lock и modules.  
Факт: `bapm uninstall @acme/tool` печатает `uninstall @acme/tool`, exit 0; lock пуст, но `path: ./pkgdir` остался в `bapm.yml` (проверено 08-11-2026).

Подстрока: при `path: ./skill` и `path: ./skill-extra` команда `bapm uninstall skill` печатает оба `uninstall …` и удаляет обе записи вместо одной.

## Вариации

1. Точное совпадение по `name` / каноническому `repo_url` / alias (рекомендуется) — предсказуемо; для неоднозначности можно требовать `--all` или выдавать список кандидатов.
2. Подстрока (текущее) — удобно для ленивого ввода, но снимает лишнее и оставляет манифест при расхождении имён.
3. Принимать полный git URL и путь как отдельные идентификаторы — сейчас URL частично распознаётся в lock, но не в манифесте.

## Рекомендация

Вариант 1: вычислить каноническую идентичность (manifest `name`, alias, lock `repo_url`), сравнивать точно; при нескольких кандидатах — fail-closed со списком и флагом `--all`. Для `path:` дополнительно сопоставлять объявленный путь с `local:`-записью lock, а не только basename. Обновить docs: простой path-случай работает, ломается расхождение имени и basename. Оценка M: правка сопоставления, тесты на path/git/alias и подстроку.

Критерии закрытия:

- [ ] `uninstall @acme/tool` для `path: ./pkgdir` удаляет и манифест, и lock.
- [ ] короткое имя не удаляет `skill-extra` без явного `--all`.
- [ ] тесты покрывают git (имя ≠ хвост URL), path (имя ≠ basename), alias и dry-run.

## Поведение сейчас

- **git:** по имени пакета команда убирает запись из lock и удаляет развёрнутые файлы; запись в `bapm.yml` остаётся, если имя не совпало с хвостом URL, и следующий `install` возвращает пакет. Полный URL может найтись в lock через `repo.includes`, но манифест при этом не чистится.
- **`path:` и `local`:** простой случай с совпадающим basename работает (тест §9). Если манифестное имя отличается от basename пути, команда завершается успешно, снимает lock/modules/deploy, но оставляет запись в манифесте.
- **Подстрока:** `bapm uninstall skill` может снять `skill` и `skill-extra`.
- Надёжный обход: править `bapm.yml` руками, затем `uninstall` / `prune`.

## Связанные

- [orphan-files-cleanup.md](./orphan-files-cleanup.md) — что происходит с развёрнутыми файлами после снятия пакета.
- [targets-narrow-deploy.md](./targets-narrow-deploy.md) — ещё одна команда, которая завершается успехом при неполном результате.
