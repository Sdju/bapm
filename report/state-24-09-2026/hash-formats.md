# Разные форматы хешей в lock

**Статус:** открыто  
**Класс:** намеренное внутри lock / дрейф спеки  
**Важность:** низкая — форматы различаются, но чтение принимает оба; страдают ручной diff и внешние скрипты.  
**Проверено:** 08-11-2026, working tree

## Суть

В одном `bapm.lock.yaml` соседствуют `sha256:<hex>` (envelope, OpenAPM lk-016) и голый lowercase hex у `deployed_file_hashes`. Сравнивать строки между полями нельзя: это разные величины, а не только разные форматы.

Скалярные поля `resolved_hash`, `tree_sha256`, `source_digest` нормализуются в envelope. Карта `deployed_file_hashes` пишется `hashFileBytes` как голый hex; при чтении `parse` нормализует и её в `sha256:<hex>`. Поэтому формат зависит от команды: `bapm install` (материализация) пишет голый hex, `bapm lock` после загрузки переписывает карту в envelope; APM-лок тоже приходит с `sha256:`. Фикстура `real-apm-root.lock.yaml` как раз содержит `sha256:` в карте.

Функционально сравнение терпит оба вида: `verifyDeployedFileHashes` нормализует expected, `treeSha256` — записанный envelope. Но спека говорит «on write … envelope», а карта пишется голым hex; это дрейф, который проявляется diff-шумом и поломкой сторонних парсеров.

## Влияние

- **Сценарий:** общий lock с `deployed_file_hashes`, ревью diff, внешний SBOM/скрипт разбирает хеши.
- **Кого задевает:** авторы инструментов, ревьюеры, команда при перезаписи lock.
- **Последствие:** скрипт, ждущий `sha256:` или голый hex, ломается; формат может «перескочить» при следующей записи, создавая шум.
- **Частота:** при каждом lock с развёрнутыми файлами; особенно при смешении bapm/APM.
- **Обходной путь:** нормализовать оба вида (`sha256:` + lowercase hex); не сравнивать `deployed_file_hashes` с `tree_sha256` напрямую.

## Состояние

| Источник       | Позиция                                                                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| APM            | Смесь hex / алгоритмических префиксов в разных полях; в `real-apm-root.lock.yaml` карта уже с `sha256:`.                                      |
| OpenAPM lk-016 | Скалярные хеши зависимостей — envelope `algo:hex`.                                                                                            |
| Спека bapm     | `lockfile-yaml-rw`:118-130 — на чтении bare 64-hex → `sha256:<hex>`, на записи hash-поля — envelope; исключение для карты не описано.          |
| Код bapm       | `packages/core/src/modules/Lockfile/hash.ts:9-22,36` — нормализует `resolved_hash`, `tree_sha256`, `source_digest`; `packages/core/src/modules/Install/deployedInventory.ts:3,16-18` — карта как голый hex. |
| Код bapm       | `packages/core/src/modules/Lockfile/parse.ts:77-79,186-194` — карта и скаляры нормализуются при чтении; `packages/core/src/modules/Lockfile/serialize.ts:137` — запись без отдельной нормализации. |
| Документация   | `apps/docs/guide/lockfile.md` не сводит форматы в таблицу; `CONFORMANCE.md:91` фиксирует lk-016 как consumer.                                 |
| Тесты          | `packages/core/tests/lockfile/parse-serialize.test.ts:159-169` — только скаляр `resolved_hash`; формат карты не закреплён.                     |

## Проверка

| Артефакт | Где смотреть                                                                                                                                          |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Код      | `packages/core/src/modules/Lockfile/hash.ts:9-22` — bare 64-hex → `sha256:`; `:36` — список скалярных полей.                                          |
| Код      | `packages/core/src/modules/Install/deployedInventory.ts:16-18` — `hashFileBytes` возвращает голый hex; `:99-103` — сравнение принимает оба вида.        |
| Код      | `packages/core/src/modules/Lockfile/parse.ts:186-194` — нормализация скаляров и карты; `packages/core/src/modules/Lockfile/treeSha256.ts:27-29` — envelope для tree.              |
| Тесты    | `packages/core/tests/lockfile/parse-serialize.test.ts:159-169` — скаляр; `fixtures/real-apm-root.lock.yaml:41` — APM-карта с `sha256:`.                |
| Спека    | `openspec/specs/lockfile-yaml-rw/spec.md:118-130` — envelope on write.                                                                                |
| Docs     | `apps/docs/guide/lockfile.md` — форматы не описаны.                                                                                                    |

Воспроизведение:

```bash
# проект с target и развёрнутым файлом
bapm install --no-frozen; grep -A1 deployed_file_hashes bapm.lock.yaml  # голый hex
bapm lock;                grep -A1 deployed_file_hashes bapm.lock.yaml  # sha256:…
grep -n 'tree_sha256' bapm.lock.yaml | head -1                        # sha256:…
```

Ожидание: один формат (envelope) во всех хеш-полях.  
Факт: envelope у `tree_sha256`, голый hex у карты; после load→serialize карта станет envelope.

## Вариации

1. Везде envelope. — рекомендуется
2. Везде голый hex.
3. Envelope для identity/tree, голый hex для карты файлов (текущее).

## Рекомендация

Вариант 1: нормализовать `deployed_file_hashes` при записи так же, как при чтении, чтобы и свежий, и перезаписанный lock давали `sha256:<hex>`. Это совпадает со спекой и APM-фикстурой. Если решено оставить голый hex (вариант 3), зафиксировать исключение в `lockfile-yaml-rw` и docs. Оценка M: правка сериализации, обновление фикстур/тестов и таблицы форматов в docs.

Критерии закрытия:

- [ ] все хеш-поля в lock имеют один документированный формат.
- [ ] load→serialize не меняет формат карты.
- [ ] тест на карту и docs/спека обновлены.

## Поведение сейчас

`tree_sha256: sha256:abcd…` и `deployed_file_hashes: { ".cursor/rules/x.mdc": "abcd…" }` могут описывать один алгоритм. Frozen/audit сравнивают каждое поле своим нормализатором и принимают оба вида. Ручной diff и сторонние скрипты ломаются, если ждут один формат.

## Связанные

- [frozen-ignores-ref-change.md](./frozen-ignores-ref-change.md) — frozen проверяет эти хеши, но не ref.
- [path-absolute-in-lock.md](./path-absolute-in-lock.md) — второй непортируемый формат в том же lock.
