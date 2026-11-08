# Frozen не ловит смену `#ref`

**Статус:** открыто  
**Класс:** баг / дыра в CI-гейте  
**Важность:** высокая — CI-гейт молча ставит старый коммит после смены `#ref`, если lock не обновлён.  
**Проверено:** 08-11-2026, working tree

## Суть

Frozen проверяет: lock есть, у каждой прямой зависимости есть пин, развёрнутые файлы совпадают с хешами (`deployed_file_hashes`, `tree_sha256`). Сверки `git/ref` из манифеста с `resolved_ref`/`resolved_commit` в lock нет: `Install/frozen.ts` про ref не знает.

Причина глубже гейта. Frozen-путь вызывает `resolveDependencyGraph` с `updateRefs: false` и `existingLock`; для git-literal (ветка, тег, `#ref`) warm-pin переиспользуется без проверки ref. `warmConstraintMatchesLiteral` буквально игнорирует ref (`void ref`), поэтому `#v1` → `#v2` не меняет `resolved_commit`.

Это не только frozen. Обычный `bapm install` без `--update` тоже реплеит warm-pin: он перезаписывает в lock `resolved_ref: v2`, но оставляет `resolved_commit` от v1 — lock становится внутренне противоречивым. Коммит двигают только `bapm install --update` или `bapm update`. `bapm outdated` для текущих lock смотрит `resolved_ref` из lock, а не ref из манифеста, поэтому смену `#ref` тоже не показывает.

## Влияние

- **Сценарий:** CI с `CI=true`; в `bapm.yml` у закреплённого пакета `#v1` заменили на `#v2`, lock не обновляли.
- **Кого задевает:** команда и CI; при старом коммите — ещё и безопасность.
- **Последствие:** install выходит `0`, ставится коммит v1; CI зелёный, но проверяется не тот код. После обычного install lock может говорить `v2`, а пин остаться от `v1`.
- **Частота:** каждая смена ref до ручного `update`; типичный сценарий ревью зависимости.
- **Обходной путь:** `bapm install --update` или `bapm update`, затем закоммитить lock; сверять diff манифеста и lock на ревью.

## Состояние

| Источник     | Позиция                                                                                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| APM          | Frozen/lock gate в первую очередь про пины и дерево, не про дрейф constraint у уже записанной строки.                                                           |
| OpenAPM      | lk-018 / frozen: lock присутствует, пины прямых, integrity. Сверка constraint↔pin — отдельный вопрос.                                                           |
| Спека bapm   | `install-pipeline`:23-25 — lock, прямые пины, хеши; `dependency-resolve`:220-230 — warm replay только при неизменном ref.                                       |
| Код bapm     | `packages/core/src/modules/Install/frozen.ts:17-45` — lock + пины; `packages/core/src/modules/Resolver/resolveGraph.ts:811-815, 911-920` — literal warm-pin без сверки ref; `packages/core/src/modules/Install/runInstall.ts:237-247` — frozen resolve. |
| Документация | `apps/docs/guide/situations/ci-frozen.md:56-57`, `apps/docs/reference/install.md:51` — warning «что frozen не ловит».                                           |

## Проверка

| Артефакт | Где смотреть                                                                                                                                                    |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Код      | `packages/core/src/modules/Install/frozen.ts:17` — `enforceFrozen`; `:36-44` — только missing pins; `:64-112` — сравнение по `repo_url`/path/name, не по ref. `packages/core/src/modules/Resolver/resolveGraph.ts:911-920` — `warmConstraintMatchesLiteral` игнорирует `ref` (`void ref`). `packages/core/src/modules/Install/runInstall.ts:171-172` — вызов gate; `:237-247` — frozen resolve с `updateRefs:false`; `:279-284` — проверка хешей. `packages/core/src/modules/Outdated/runOutdated.ts:229-232` — `outdated` берёт `resolved_ref` из lock раньше манифеста. |
| Тесты    | `packages/core/tests/install/frozen.test.ts:95-127` — успешный frozen не меняет lock; кейса «ref изменился» нет.                                                |
| Спека    | `openspec/specs/install-pipeline/spec.md:23-25` — frozen требует lock, пины, хеши; `openspec/specs/dependency-resolve/spec.md:220-230` — warm replay при неизменном ref. |
| Docs     | `apps/docs/guide/situations/ci-frozen.md:56-57` — предупреждение; `apps/docs/reference/install.md:51` — то же в reference.                                       |

Воспроизведение:

```bash
ROOT="$(pwd)"; BAPM="$ROOT/packages/cli/dist/cli.mjs"; tmp=$(mktemp -d); cd "$tmp"
git init -q repo && cd repo && git config user.email a@b && git config user.name t
printf 'name: dep\nversion: 0.0.1\ndependencies:\n  apm: []\n' > bapm.yml
git add -A && git commit -qm v1 && git tag v1
printf '# v2\n' > extra.txt && git add -A && git commit -qm v2 && git tag v2
cd "$tmp" && mkdir proj && cd proj && mkdir -p .cursor && ln -s "$ROOT/node_modules" node_modules
printf 'name: root\nversion: 0.0.1\ntarget: cursor\ndependencies:\n  apm:\n    - git: file://%s/repo\n      ref: v1\n' "$tmp" > bapm.yml
node "$BAPM" install --no-frozen              # lock: resolved_ref v1
sed -i 's/ref: v1/ref: v2/' bapm.yml          # ref сменили, lock не трогали
CI=1 node "$BAPM" install; echo "exit=$?"     # exit=0
grep resolved_commit bapm.lock.yaml           # коммит всё ещё от v1
```

Ожидание: frozen замечает расхождение `ref` и падает, не меняя lock.  
Факт: exit `0`, lock не меняется, ставится коммит v1. Обычный `install` без `--update` меняет `resolved_ref` на v2, но оставляет коммит v1.

## Вариации

1. Считать расхождение `#ref` и pin ошибкой frozen (как «забыли обновить lock»). — рекомендуется
2. Игнорировать (текущее) — ловится только ревью; `outdated` смотрит `resolved_ref` из lock, а не манифест.
3. Отдельная проверка в `audit --ci` — сейчас её нет: `Audit/` не сравнивает манифест с lock.

## Рекомендация

Вариант 1: в frozen-гейте сравнить `git/ref` (или `constraint`) из манифеста с `resolved_ref`/`constraint` в lock и падать с отдельным кодом (`INSTALL_FROZEN_REF_DRIFT`). В не-frozen warm replay не переиспользовать literal pin, если ref изменился, и не писать `resolved_ref` без нового `resolved_commit`. Оценка S/M: гейт и тесты — S; аккуратный warm replay и миграционные кейсы — M.

Критерии закрытия:

- [ ] frozen падает до записи modules/lock при смене `#ref` у закреплённого пакета.
- [ ] обычный install/update не оставляет `resolved_ref` от нового ref при старом `resolved_commit`.
- [ ] тесты на `#v1`→`#v2` для frozen и non-frozen; docs/спека обновлены.

## Поведение сейчас

`CI=1 bapm install` и `bapm install --frozen` проходят. Ставится `resolved_commit` из lock. Чтобы сменить ref, нужен `bapm install --update` или `bapm update` вне CI. `bapm install` без `--update` создаёт противоречие: `resolved_ref` новый, `resolved_commit` старый.

## Связанные

- [update-not-blocked-in-ci.md](./update-not-blocked-in-ci.md) — вторая дыра того же CI-гейта: `update -y` не блокируется.
- [update-dry-run-branches.md](./update-dry-run-branches.md) — план `update` не показывает drift веток/тегов.
- [hash-formats.md](./hash-formats.md) — frozen дополнительно сверяет хеши, но не ref.
