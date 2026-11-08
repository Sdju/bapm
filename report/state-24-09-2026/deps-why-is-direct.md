# `deps why --json`: `is_direct` по пустому `resolved_by`

**Статус:** открыто  
**Класс:** баг / неверная диагностика  
**Важность:** средняя — `is_direct` неверен в обе стороны: прямые git/registry выглядят транзитивными, локальные транзитивные — прямыми.  
**Проверено:** 08-11-2026, working tree

## Суть

JSON `deps why` помечает пакет прямым, если `resolved_by` пустой или отсутствует. Прямота из манифеста / `depth` не берётся. Запись без `resolved_by` (старый lock, `path`, сбой записи) выглядит как direct.

Но у текущего bapm есть и обратная ошибка. Резолвер пишет в lock `resolved_by: root->dep` для всех git/registry-записей, включая depth 1: цепочка начинается с имени проекта. `isDirect` видит непустой `resolved_by` и помечает **прямую** зависимость как `false`, а в `paths[].chain` появляется фиктивный узел `root`, которого нет в lock.

Локальные `path:`-записи наоборот пишутся без `resolved_by` и без `depth`: `buildLockDocument` для `kind: "local"` их не добавляет. Поэтому транзитивный локальный пакет получает `is_direct: true` и цепочку без родителя. Тесты используют рукописные lock без `resolved_by` у прямых, поэтому зелёные и не ловят эмиттер.

## Влияние

- **Сценарий:** скрипт или CI читает `bapm deps why <pkg> --json` и по `is_direct` отделяет прямые зависимости от транзитивных.
- **Кого задевает:** авторы скриптов, аудит зависимостей, пользователь, читающий цепочку.
- **Последствие:** прямой git/registry-пакет считается транзитивным, в chain появляется несуществующий `root`; локальный транзитив считается прямым.
- **Частота:** каждый bapm-сгенерированный git/registry direct; каждый транзитивный `path:`.
- **Обходной путь:** не полагаться на `is_direct`; смотреть `depth` в lock и манифест, либо `deps tree`.

## Состояние

| Источник     | Позиция                                                                                                                                 |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| APM          | `why` отличает direct по манифесту / depth 1.                                                                                           |
| OpenAPM      | `resolved_by` — цепочка родителей; пусто у корня.                                                                                       |
| Спека bapm   | `deps-inspect`:36-48 — `is_direct` в `package` и в узлах chain; цепочка транзитива должна включать родителя.                             |
| Код bapm     | `packages/core/src/modules/Deps/whyDeps.ts:154-160` — `by == null` → `true`; пустой массив/строка → `true`; иначе `false`; `depth`/манифест не читаются. `packages/core/src/modules/Resolver/resolveAndLock.ts:368-369` — `resolved_by`/`depth` для git/registry; `packages/core/src/modules/Resolver/resolveGraph.ts:206,575` — chain с именем проекта; `packages/core/src/modules/Resolver/resolveAndLock.ts:306-327` — local без `resolved_by`/`depth`. |
| Документация | `apps/docs/reference/deps.md:29` — только флаг `--json`; семантика `is_direct` не описана.                                               |
| Тесты        | `packages/core/tests/deps/why-result.test.ts:43-44,108`, `whyDeps.test.ts:83-90` — рукописные lock; теста на вывод `resolveAndLock` нет. |

## Проверка

| Артефакт | Где смотреть                                                                                                                                       |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Код      | `packages/core/src/modules/Deps/whyDeps.ts:154-160` — вся логика `isDirect`; `:173-181` — запись в `package`. `packages/core/src/modules/Resolver/resolveGraph.ts:206` — root chain `[rootName]`; `:575` — `resolved_by` из chain. `packages/core/src/modules/Resolver/resolveAndLock.ts:368-369` — `resolved_by`/`depth`; `:306-327` — local без них. |
| Тесты    | `packages/core/tests/deps/whyDeps.test.ts:83-90` — parent true; транзитив :161-174 — только chain, без ложного direct.                              |
| Спека    | `openspec/specs/deps-inspect/spec.md:36-48` — форма JSON и chain.                                                                                  |
| Docs     | `apps/docs/reference/deps.md:29` — `--json` есть, семантики нет.                                                                                   |

Воспроизведение:

```bash
mkdir -p /tmp/why && cd /tmp/why && printf 'name: root\nversion: 0.0.1\ndependencies:\n  apm: []\n' > bapm.yml
cat > bapm.lock.yaml <<'EOF'
lockfile_version: "1"
dependencies:
  - name: dep
    repo_url: https://example.com/dep.git
    source: git
    resolved_commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    resolved_by: root->dep
EOF
bapm deps why dep --json          # is_direct: false, chain: root -> dep
```

Ожидание: `dep` — прямая зависимость, `is_direct: true`, chain без фиктивного `root`.  
Факт: `is_direct: false`; при удалении `resolved_by` — `true`. Транзитивный `path:`-пакет, наоборот, даёт `true`.

## Вариации

1. Считать direct только depth 1 / имя есть в `dependencies.apm`. — рекомендуется
2. Эвристика `resolved_by` (текущее).
3. Поле optional, если данных мало — не сделано.

## Рекомендация

Вариант 1: `isDirect` должен опираться на `depth === 1` (плюс fallback на `resolved_by` для старых lock), а эмиттер — писать `depth` для всех записей и не включать имя проекта в `resolved_by` прямых. Для local-записей добавить `depth`/`resolved_by` в `buildLockDocument`. Оценка S: правка классификатора, эмиттера и тестов.

Критерии закрытия:

- [ ] прямой git/registry: `is_direct: true`, chain без `root`-пакета.
- [ ] транзитивный local: `is_direct: false`, chain содержит родителя.
- [ ] тест на реальном выводе `resolveAndLock`, docs/спека уточнены.

## Поведение сейчас

Тесты ждут `is_direct: true` у пакетов без родителей. Для текущего lock с `resolved_by: root->dep` прямой пакет получает `false`. Транзитив с незаполненным `resolved_by` (в частности, `path:`) получает `true`. Для скриптов поле нельзя считать надёжным.

## Связанные

- [path-absolute-in-lock.md](./path-absolute-in-lock.md) — local-записи в lock теряют `resolved_by`/`depth` и получают абсолютный `path`.
- [hash-formats.md](./hash-formats.md) — ещё одно поле lock, семантика которого не сведена в docs.
