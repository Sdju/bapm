# Разные форматы хешей в lock

**Статус:** открыто  
**Класс:** намеренное внутри lock / путаница для читателя

## Суть

В одном `bapm.lock.yaml` соседствуют `sha256:<hex>` (envelope, OpenAPM lk-016) и голый lowercase hex у `deployed_file_hashes`. Сравнивать строки между полями нельзя.

## Состояние

| Источник       | Позиция                                                                                                   |
| -------------- | --------------------------------------------------------------------------------------------------------- |
| APM            | Смесь hex / алгоритмических префиксов в разных полях.                                                     |
| OpenAPM lk-016 | Скалярные хеши зависимостей — envelope `algo:hex`.                                                        |
| Спека bapm     | `Lockfile/hash.ts` нормализует `resolved_hash`, `tree_sha256`, `source_digest`.                           |
| Код bapm       | `normalizeHashValue`: 64 hex → `sha256:…`. `deployedInventory.ts`: «lowercase hex (no algorithm prefix)». |
| Документация   | Пользователю форматы не сведены в одну таблицу.                                                           |

## Вариации

1. Везде envelope.
2. Везде голый hex.
3. Envelope для identity/tree, голый hex для карты файлов (текущее).

## Поведение сейчас

`tree_sha256: sha256:abcd…` и `deployed_file_hashes: { ".cursor/rules/x.mdc": "abcd…" }` могут описывать один алгоритм. Frozen/audit сравнивают каждое поле своим нормализатором. Ручной diff и сторонние скрипты ломаются, если ждут один формат.
