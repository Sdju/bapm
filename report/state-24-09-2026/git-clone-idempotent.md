# Повторный clone git-зависимости

**Статус:** исправлено (working tree, change `fix-install-safety`)  
**Класс:** баг  
**Важность:** низкая (закрыто; исторически высокая) — git-зависимости не ставились ни с первого, ни со второго install.  
**Проверено:** 08-11-2026, working tree

## Суть

Resolve уже кладёт дерево в `apm_modules/<id>/<commit>`. Следующий шаг снова вызывал `git clone` в тот же непустой каталог. Падало и на первом, и на втором install (`Failed to download`). Git-зависимости фактически нельзя было поставить.

Теперь downloader сначала проверяет, что `dest` — это checkout того же remote на нужном commit с чистым tracked-деревом (`isCheckoutAt`). Только при несовпадении клонирует во временный каталог рядом и подменяет `dest` через rename с backup. Это делает повторный install идемпотентным и не оставляет полуразрушенный кэш при ошибке.

Untracked-файлы проверку не ломают (`--untracked-files=no`), но локально изменённый tracked-файл делает дерево негодным, и оно заменяется.

## Влияние

- **Сценарий:** манифест с `dependencies.apm: [{ git: ... }]`, первый `bapm install`, затем повторный без изменений.
- **Кого задевает:** любой пользователь git-зависимостей; CI с чистым кэшем; автор пакета, проверяющий установку.
- **Последствие:** раньше install завершался `DOWNLOAD_FAILED` / `Failed to download <url>`, модулей и lock не было; теперь дерево переиспользуется, а грязное/частичное — заменяется.
- **Частота:** каждый install с git-зависимостью.
- **Обходной путь:** до фикса — вручную удалять `apm_modules` перед каждым install, что не помогало при повторном download в том же запуске.

## Состояние

| Источник     | Позиция                                                                                                                                       |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| APM          | Повторный install переиспользует modules cache, не клонирует в занятый путь.                                                                  |
| OpenAPM      | Download идемпотентен относительно pin.                                                                                                       |
| Спека bapm   | ADDED `dependency-resolve`: Modules download is idempotent for materialized git trees.                                                        |
| Код bapm     | `Resolver/defaults.ts`: `isCheckoutAt` (`.git`, remote, HEAD, чистый status) → return; иначе clone в `mkdtemp` и `swapIntoPlace` (rename + backup). |
| Тесты        | `tests/resolve/default-downloader.test.ts` на реальном локальном git-репозитории, без fake downloader.                                        |
| Документация | Прежние «known git issue» блоки сняты.                                                                                                        |

## Проверка

| Артефакт | Где смотреть |
| -------- | ------------ |
| Код      | `packages/core/src/modules/Resolver/defaults.ts:114` — `if (await isCheckoutAt(...)) return`. |
| Код      | `packages/core/src/modules/Resolver/defaults.ts:143` — `isCheckoutAt`: `.git`, `remote.origin.url`, 40-hex HEAD, `status --porcelain` (172). |
| Код      | `packages/core/src/modules/Resolver/defaults.ts:120` — clone в `mkdtemp` рядом; `:213` — `swapIntoPlace` с backup и восстановлением. |
| Код      | `packages/core/src/modules/Resolver/download.ts:37` — ошибка по-прежнему оборачивается в `DOWNLOAD_FAILED`. |
| Тесты    | `packages/core/tests/resolve/default-downloader.test.ts:65` — второй download в тот же dest; `:91` — смена commit; `:146` — грязный tracked-worktree заменяется; `:218` — неудачный clone сохраняет прежний dest. |
| Спека    | `openspec/specs/dependency-resolve/spec.md:430` — reuse at pin, иначе replace. |
| Docs     | `apps/docs/guide/situations/install-fresh.md:60` — общий совет по `Failed to download`; отдельных «known issue» блоков нет. |

Воспроизведение:

```bash
pnpm -C packages/core test tests/resolve/default-downloader.test.ts
```

Ожидание: повторный download того же commit проходит, дерево не клонируется заново.  
Факт: на текущем дереве 11 тестов зелёные, включая конкурентные загрузки в один `dest`.

## Вариации

1. Всегда clone в пустой dest (старое, сломано).
2. Reuse at pin, replace если дерево грязное (текущее, **рекомендуется**).
3. `git fetch` + reset — не сделано, только clone начисто.

## Рекомендация

Сохранять проверку remote + HEAD + чистого tracked-дерева как единый guard и не ослаблять её до «есть `.git`». Замена через соседний temp + rename должна оставаться обязательной: она защищает рабочий кэш при сетевой ошибке. S.

Критерии закрытия:

- [x] повторный download при том же pin не падает;
- [x] stale/грязный/чужой checkout заменяется;
- [x] неудачный clone не портит существующий кэш;
- [x] спека `dependency-resolve` описывает идемпотентность.

## Поведение сейчас

Повторный `bapm install` с уже скачанным коммитом не клонирует. Другой commit — дерево собирается в temp и подменяет старое; при сбое старое восстанавливается через backup. `file://` URL по-прежнему нормализуется как github-координата и не является обходом.

## Связанные

- [zip-extract-merge.md](./zip-extract-merge.md) — второе исправление того же change.
- [lock-secrets.md](./lock-secrets.md) — третье исправление того же change.
- [frozen-ignores-ref-change.md](./frozen-ignores-ref-change.md) — пины и смена `#ref` на уровне frozen.
