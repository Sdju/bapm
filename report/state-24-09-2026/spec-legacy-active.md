# В спеках были валидные сценарии `active: [id]`

**Статус:** исправлено (change `2026-11-08-sync-specs-with-shipped-behavior` заархивирован)  
**Класс:** долг спеки  
**Важность:** низкая (закрыто; исторически средняя) — примеры `active: [id]` в `openspec/specs` остались только в сценариях отказа, валидных примеров больше нет.  
**Проверено:** 08-11-2026, working tree

## Суть

Парсер bapm отвергает legacy bare-list `active: [cursor]` и принимает только structured-формы: `active: { target: cursor }`, `active: { preset: developer }` или список таких односложных мап. Это зафиксировано в `manifest-presets` и `manifest-yaml-validate`.

В снимке 24-09-2026 несколько capability-спек использовали `active: [x-acme-editor]` в WHEN как валидный манифест. Агент, который читает спеку как контракт, сгенерировал бы невалидный документ и получил бы ошибку парсера. Change `sync-specs-with-shipped-behavior` должен был заменить такие сценарии; исходная карточка считала это незакрытым follow-up.

Сейчас в main-спеках остались только отрицательные сценарии: они намеренно показывают, что форма `[cursor]` отвергается. Это корректно и не является примером для копирования.

## Влияние

- **Сценарий:** spec-first разработка или агент, который по WHEN-сценарию генерирует `bapm.yml` с `active: [cursor]`.
- **Кого задевает:** автор спеки, агент-реализатор, новый участник, читающий capability-спеку.
- **Последствие:** сгенерированный манифест падает на парсере с `Manifest "active" rejects legacy bare host-token lists`; в худшем случае агент «исправляет» валидатор под старую спеку.
- **Частота:** при каждой правке спеки/генерации манифеста по спеке; runtime-пользователей не затрагивает.
- **Обходной путь:** писать structured-форму; в остальных спеках теперь только rejection-примеры.

## Состояние

| Источник                | Позиция                                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| APM                     | `active` как список строк исторически жил.                                                                                 |
| OpenAPM / bapm validate | Только structured `{ target: … }` / `{ preset: … }`.                                                                       |
| Спека bapm              | `manifest-yaml-validate` и `manifest-presets` MUST reject bare lists; все оставшиеся `active: [x]` — сценарии отказа.      |
| Код bapm                | Parse падает: `Manifest "active" rejects legacy bare host-token lists`.                                                    |
| Документация            | `guide/host-selection.md` — только structured form.                                                                        |

## Проверка

| Артефакт | Где смотреть                                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------------- |
| Код      | `packages/core/src/modules/Manifest/active.ts:152` — legacy bare host-token list → ошибка.                                 |
| Тесты    | `packages/core/tests/manifest/active-field.test.ts:61`, `presets-active-parse.test.ts:77`, `producer/emit-active-structured.test.ts:24`. |
| Спека    | `openspec/specs/manifest-yaml-validate/spec.md:345` — reject bare sequences; `:359`, `:364`, `:388`, `:397` — rejection-сценарии. |
| Спека    | `openspec/specs/manifest-presets/spec.md:30` — reject; `:49-51` — сценарий «Legacy bare host list rejected».              |
| Docs     | `apps/docs/guide/host-selection.md:56` — `active: [cursor]` не поддерживается.                                            |

Воспроизведение:

```bash
rg -n 'active:\s*\[' openspec/specs
```

Ожидание: все совпадения — сценарии/требования отказа, ни одного валидного примера.  
Факт: 6 совпадений в двух спеках, все в контексте `MUST be rejected` / `rejected`.

## Вариации

1. Механически заменить все валидные сценарии — выполнено change; остались rejection-примеры, рекомендуется.
2. Снова принять bare list — противоречит shipped validate.
3. Оставить валидные примеры как есть — ловушка для spec-first работы.

## Рекомендация

Закрыть: вариант 1 уже применён. При будущих правках спек проверять `rg 'active:\s*\['` и не добавлять bare-list в WHEN без явного «rejected». Оценка S.

Критерии закрытия:

- [x] В `openspec/specs` нет валидных примеров `active: [id]`.
- [x] Валидатор и тесты отвергают legacy-форму.
- [x] Документация показывает structured-форму.

## Поведение сейчас

Валидный манифест: `active: { target: cursor }` или `active: { target: [cursor, claude] }`. Change заменил валидные сценарии в четырёх спеках; полный `rg 'active: \[' openspec/specs` непустой только за счёт rejection-сценариев. Follow-up 4.1 можно считать закрытым.

## Связанные

- [stale-specs-compile-and-cursor.md](./stale-specs-compile-and-cursor.md) — другой незакрытый follow-up того же change (4.2).
- [plugin-flags-vs-spec.md](./plugin-flags-vs-spec.md) — дрейф спек producer/plugin относительно CLI.
