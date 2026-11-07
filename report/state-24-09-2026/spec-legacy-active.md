# В спеках остались сценарии `active: [id]`

**Статус:** открыто в main-спеках / частично в change  
**Класс:** долг спеки

## Суть

Парсер отвергает legacy `active: [cursor]`. Несколько capability-спек до сих пор используют эту форму в WHEN. Агент, который читает спеку, сгенерирует невалидный манифест.

## Состояние

| Источник                | Позиция                                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| APM                     | `active` как список строк исторически жил.                                                                                 |
| OpenAPM / bapm validate | Только structured `{ target: … }` / `{ preset: … }`.                                                                       |
| Спека bapm              | `manifest-yaml-validate` и `manifest-presets` MUST reject bare lists. Другие спеки ещё цитируют `active: [x-acme-editor]`. |
| Код bapm                | Parse падает: `Manifest "active" rejects legacy bare host-token lists`.                                                    |
| Документация            | `guide/host-selection.md` — только structured form.                                                                        |

## Вариации

1. Механически заменить все сценарии (часть сделана в `sync-specs-with-shipped-behavior`).
2. Снова принять bare list — противоречит уже shipped validate.
3. Оставить как есть — ловушка для spec-first работы.

## Поведение сейчас

Валидный манифест: `active: { target: cursor }` или `active: { target: [cursor, claude] }`. Change чинит четыре спеки; полный `rg 'active: \[' openspec/specs` ещё не пустой. Это follow-up 4.1 того change.
